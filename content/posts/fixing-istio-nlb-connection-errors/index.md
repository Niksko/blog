---
title: "Adventures in running Istio behind an NLB"
date: 2023-09-19T01:00:56Z
draft: true
#image: "<TODO>"
summary: "How I diagnosed and fixed sporadic connection errors when running Istio behind an NLB in AWS"
categories:
  - technology
tags:
  - Istio
  - AWS
  - Kubernetes
  - networking
---

Running Kubernetes can be a fun adventure, filled with failure modes you could never have imagined.
This story is no exception.

At [SEEK](https://www.seek.com.au/work-for-seek/) we're running Kubernetes in production and using
[AWS network loadbalancers](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html) (NLBs)
to load balance traffic between [Istio ingress gateways](https://istio.io/latest/docs/tasks/traffic-management/ingress/ingress-control/)
in order to ingress traffic to our clusters.
As part of diagnosing an elevated rate of timeouts and errors that one of our applications was experiencing, I found
a few interesting failure modes with this setup that behaved in unexpected ways.

## Context

### AWS NLBs

NLBs operate at layer 4, which means they effectively act as TCP loadbalancers when proxying HTTP/1 and HTTP/2 traffic.
An NLB operates by accepting connections from clients, and then creating a new connection to targets behind the
loadbalancer, balancing incoming traffic among those clients.
A single client connection is sent to the same target for the duration of the connection.
This stuff is all pretty standard, and well documented in [the AWS NLB documentation](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html).

{{< figure src="NLB-diagram.jpg" caption="The basics of how an NLB works" alt="A diagram of how an NLB works at a conceptual level, showing the client connecting to the NLB with a single connection, and the NLB connecting to the server with another connection" >}}

One other aspect of NLBs that's worth mentioning is that they support two features that are relevant to the
diagnosis of the timeouts and errors we were seeing: client IP preservation and cross-zone loadbalancing.

Client IP preservation allows the target (the server upstream of the NLB) to think that it is communicating directly
with the client without the NLB in the middle.
The NLB accomplishes this by sending IP packets where the source address is the IP address of the NLB client (the
server downstream that is connecting to the NLB) instead of itself.

How this works internally is not explained, but consider this: when the NLB target is sending traffic back to the
NLB when client IP preservation is enabled, won't it end up at the wrong server?
Let's say our NLB has an IP address of `10.0.0.100`, and our client IP address is `1.2.3.4`.
Our target received an IP packet with source address `1.2.3.4`, but it was actually sent from IP `10.0.0.100`.
Our target is primed to send return traffic to `1.2.3.4` (the IP of the client), when it actually needs to send
return traffic to `10.0.0.100` (the IP address of the NLB).
Shouldn't this cause many problems?

All I could find is [this Reddit post](https://www.reddit.com/r/aws/comments/mv41vs/how_do_nlbs_preserve_the_ip_address_of_clients/gvajpmv/)
where "an AWS employee familiar with the subject" claims that this is resolved through AWS software defined
networking "magic".
Connections are tracked, and presumably, when traffic makes it out of the target and on to AWS's internal network
bound for the wrong destination, AWS rewrites the destination IP and ensures that it makes it to the NLB.
The fact that this magic is part of the AWS internal network fabric is important, and will crop up later.

{{< figure src="client-ip-preservation.jpg" caption="How NLB client IP preservation works, presumably" alt="A diagram of how NLB client IP preservation is presumed to work, showing the IP address translation that happens, and how this is reversed on the return path" >}}

The other feature that NLB's support (as do other types of AWS loadbalancer) is cross-zone loadbalancing.
To understand cross-zone loadbalancing, it's important to imagine an NLB not as a single physical entity that's
sitting somewhere in your VPC, but instead as a single logical entity with multiple physical 'loadbalancer nodes',
each of which sits inside one subnet per AWS availability zone (AZ).

Cross-zone loadbalancing means that traffic from a client that arrives at once of these 'loadbalancer nodes' in, say,
AZ `a` can be loadbalanced to a target in AZs `b` or `c`.
With cross-zone loadbalancing switched off, client traffic arriving at the node in AZ `a` will only ever be sent to
a target in AZ `a`.
If you have no healthy targets in AZ `a`, your traffic will be dropped.

{{< figure src="cross-zone-loadbalancing.jpg" caption="When cross-zone loadbalancing is ON, traffic is routed to a server in any zone. When cross-zone loadbalancing is OFF, traffic is only routed to the AZ that the client connects to" alt="A diagram of how cross-zone loadbalancing works, comparing when it is ON and OFF" >}}

In our clusters, we had both client IP preservation and cross-zone loadbalancing turned on.
Why we had client IP preservation turned on I'm not completely sure, but you can see the merit behind switching on
cross-zone loadbalancing.
A lack of capacity within a single AZ will not impact the availability of your cluster, because traffic will be
routed to the other available capacity in other AZs.

### Istio and Kubernetes services

One other piece of context required to understand these timeouts and errors is how Kubernetes service networking
works, conceptually and from a TCP connection point of view.

[Kubernetes Services](https://kubernetes.io/docs/concepts/services-networking/service/#services-in-kubernetes) are
implemented with iptables trickery.
In order to provide a Kubernetes `Service` with a stable IP address within a Kubernetes cluster, iptables rules
perform network address translation (NAT) to route traffic around the cluster.

When you want to create a stable network identity in Kubernetes, you create a `Service` resource, and Kubernetes
assigns that service an IP address from a predefined range in a virtual IP space, by default `10.96.0.0/16`.
This IP space only exists within the cluster, and in order to route traffic to it, you have to be inside the
Kubernetes cluster.
iptables NATing will then ensure that if you send traffic to the IP of your service, say `10.96.0.1`, it will make
it to the workloads that are serving traffic for this service.

When you need to expose this service outside of the cluster, you need a way of getting traffic from outside the
cluster to inside the cluster, where it can then be NATed to the virtual service IP.
Kubernetes accomplishes this with a `NodePort` type service, where a particular port is designated as being the
external entry point on each Kubernetes node that routes to a particular service.
So in our example above, Kubernetes might assign port `54321` to route to the service with IP `10.96.0.1`.
Then, any traffic sent to port `54321` on a node will be NATed to route to the virtual IP `10.96.0.1` which will
make it to the workloads behind the desired service.

This `NodePort` can be declared as the target for a loadbalancer like an NLB, and this allows integration between
cloud-provider loadbalancers and Kuberentes services, to route external traffic into a Kubernetes cluster.
This is exactly what we do in order to allow internet traffic to ingress into our Kubernetes clusters.
There is a `NodePort` service that exposes a port on our nodes, and behind this service are our Istio ingress
gateway pods that handle the traffic.

{{< figure src="service-nat.jpg" caption="How traffic is routed via a `NodePort` service in Kubernetes." alt="A diagram of how traffic is routed from a client through an NLB to a `NodePort` on a server, at which point `iptables`takes over to route traffic to the workload" >}}

It's worth noting that all of this iptables NATing is just that: NATing.
There are no additional TCP connections being created here.
Traffic is having its source and destination IP and port rewritten, along with some connection tracking to ensure
that traffic can return to where it came from.
But there is no additional connection setup or teardown.
As far as the client sending traffic to the `NodePort` (which in this case is an NLB) and the server receiving the
traffic (in this case, the Istio ingress gateway pods) are concerned, they are connecting directly to each other.

The final aspect of Kubernetes services that we need to talk about is the `externalTrafficPolicy`.
This traffic policy determines how traffic is routed around the cluster.
In `Cluster` mode, all nodes in the cluster listen on the designated port (`54321` in our example) for traffic, and
then do the iptables trickery to forward this traffic to its intended destination (one of the health Istio ingress
gateway pods).
In `Cluster` mode, traffic could be routed to any available backend pod, regardless of whether it is local to the
node, or on another node.

`Cluster` mode can introduce inefficiency, because traffic might arrive at a node that has a ready ingress gateway
pod, only for the traffic to be sent to another node, incurring latency (and potentially cost if that other node is
in another AZ).
However it's conceptually simple: every node listens for traffic and forwards it, making it simple to put all nodes
behind a loadbalancer.

The other mode is `Local` mode, where the node only listens on a `NodePort` and only forwards traffic if the node
itself contains a target for that service.
This means that traffic makes fewer hops on its way to its destination, but now not all of your nodes are in the
loadbalancer because not all of them have ingress gateway pods.

In our cluster we have our Istio ingress gateway service configured in `Cluster` mode.

### The AWS VPC CNI plugin

The final piece of context required to understand this issue is what the AWS VPC CNI plugin does, and consequences
this has for the IP addresses that nodes and pods are assigned within a Kubernetes cluster.

In Kubernetes, a [container network interface (CNI) plugin](https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/)
is responsible for allowing pods within a Kubernetes cluster to implement the [Kubernetes network model](https://kubernetes.io/docs/concepts/services-networking/#the-kubernetes-network-model).
In short, this model requires that pods are able to communicate with each other without any NAT.

There are many ways to achieve this (and other) requirements of the Kubernetes network model, but the method that
AWS chooses is to leverage the ability of EC2 elastic network interfaces (ENI) to be assigned multiple IP addresses.
This allows each pod in an EKS cluster to have a real IP address within the VPC that it is deployed to, which makes
it easier to interoperate with other AWS services.

The consequence of this is that unlike with some other CNI plugins, packets that traverse the network within their
VPC carry the source IP of the pod, rather than the source IP of the EC2 instance that they are running on, despite
needing to traverse that EC2 instance to get outside of the node.
In other CNI plugins, packets from pods are source NATed in order to give the illusion that they originated from the
node, and then destination NATed on the return traffic flow to ensure they end up at the correct pod.

## Diagnosis

In order to diagnose the timeouts and errors I was seeing, I started by looking at commonalities between the timeouts
and errors.
It quickly became apparent that there were two different types of problems:

* One problem was requests from a workload inside the cluster trying to egress to another internal service.
  These requests all seemed to be some form of timeout, as they clustered at around 8s.
* Another problem was 'downstream disconnect' (Envoy reports these as a `DC` response flag) errors, which appeared
  to be happening at the Istio loadbalancer.

I decided to tackle the timeouts first, as there appeared to be a bit more information about them, and they seemed
like the might be easier to reproduce.

In fact, they were relatively easy to reproduce.
Spinning up a pod in the cluster and cURLing another service on the cluster, I was able to reproduce the timeouts
relatively quickly.
Every so often, a request would hang for a few seconds while trying to connect, and then cURL would display
```
upstream connect error or disconnect/reset before headers. reset reason: connection failure
```

Some combination of Googling to do with NLBs and connection errors fairly quickly surfaced a useful blog post
and [this piece of troubleshooting documentation from AWS](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/load-balancer-troubleshooting.html#intermittent-connection-failure).
Some searching of internal documentation surfaced a post from a colleague that also discussed the perils of NLB
cross-zone loadbalancing.

For a thorough treatment, [this blog post from Brandon Cook](https://archive.md/X521B) explains the issue well and
outlines what is happening.
My very quick summary is that when cross-zone loadbalancing is enabled along with client IP preservation, it's
possible for a loadbalancer target to receive traffic from a client via two different traffic paths.
One traffic path goes via one loadbalancer node in one AZ, and the other goes via another loadbalancer node in a
different AZ.
If these two loadbalancer nodes happen to pick the same port to use for proxying the connection, then the client
sees two connections with the same TCP 5-tuple.
This results in a TCP reset.

At this point, I was able to experiment with switching off cross-zone loadbalancing and client IP preservation, and
managed to resolve the issue.
However this blog post isn't quite finished yet.
What was particularly interesting was that it required disabling _both_ cross-zone loadbalancing _and_ client IP
preservation in order to resolve the connection failures.
This was curious, because all of the troubleshooting docs and blog posts I could find seemed to indicate that
turning off just _one_ of these features should resolve the problem.
Why should it require turning off both?
Here's where the fun starts!

## Tracking down the source of the issue

At this point I had resolved the connection errors, but I was keen to understand what exactly was going wrong.

A note on this, for completeness: this is the abridged version of my investigation that doesn't include all of the
false starts and missteps along the way.
All troubleshooting stories have these digressions, and during my troubleshooting I ended up learning a huge amount
about some of the excellent eBPF based [BCC tools](https://github.com/iovisor/bcc), and about eBPF itself.
I decided that the BCC tools weren't telling me exactly I wanted, so I managed to learn a bit more about eBPF and
I'm now relatively confident writing my own [bpftrace](https://github.com/iovisor/bpftrace) scripts.
Once you're writing `bpftrace` scripts and printing userland and kernel stacks, it's not too long before you end up
reading Linux kernel code to understand why you ended up hitting a particular syscall, and I've learned a bunch from
that as well (not least of which is that the Linux kernel code is pretty readable and understandable with some
squinting).
With that out of the way, here's what actually helped me figure out what was happening.

I was hoping to see logs or traces that explained what was happening.
Some sort of error or some sort of trace hinting at where things were breaking.
I couldn't find any, and this is where I resorted to much eBPFing, most of which just told me what I already knew
(that connections were failing to be established and timing out).

I'd love to be able to say that some particular piece of information triggered this thought, but eventually I had an
idea that perhaps what we were seeing was 'hairpinning'.
The [AWS NLB troubleshooting docs](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/load-balancer-troubleshooting.html#loopback-timeout)
do mention the hairpinning problem, which is when traffic is sent from a client, to an NLB, and then back to the
same IP address.
Our cURL reproduction of the timeout isn't calling ourselves, however because of how we have our Kubernetes services
set up (the `externalTrafficPolicy: Cluster` discussed above), it is possible that the request that we send via the
NLB is routed back to the EC2 instance that we are on.

At this point, I was able to validate that hairpinning was playing a part in the problem by looking at traces for
the requests I was sending.
Since the connection was never successful for the unsuccessful requests, there was no corresponding trace from the
server side of the connection.
However I could see from the trace metadata that the node that handled the traffic was never the node that the
client pod was on.
This was a good hint that I was on the right track.

As before, cue a lot more eBPF tracing, but more intensely this time, digging down into the kernel and trying to
understand TCP state machine transitions.
What I found among all of this was that it was difficult to see what was going on because of all of the NAT
happening, as well as the mess of ports.
Eventually though, I managed to get a bit more insight in to what was happening using trusty `tcpdump`.

`tcpdump` has a handy mode that dumps packets to the CLI, which was invaluable for quick analysis of what was going on.
However as usual, the more robust way of doing a proper packet analysis was done by writing the packets to a `.pcap`
file and doing the analysis in Wireshark.
What was interesting about the packet captures was that I could see the following sequence of packets:

* SYN packet from the client pod to the NLB
* A SYN packet with a destination of the node, on the `nodePort` that you would expect for the service that we are
  calling.
* Another SYN packet from the node over to the port of the ingress gateway, which is the ultimate destination.

What's interesting about this sequence is that if we were just seeing the hairpinning described in the AWS docs, I
wouldn't expect to see the TCP SYN being sent from the node over to the ingress gateway pod.
The troubleshooting doc says that because the source and destination IPs are the same, this hairpinned packet will
be dropped.
I didn't piece this together until much later, but this is where the AWS VPC CNI plugin comes in.
Since client IP preservation is on, the source IP of the packet that is hairpinned back to the node is the IP
address of the client.
However because the AWS VPC CNI plugin assigns real IP addresses to pods (as opposed to virtual IP addresses as
discussed in the VPC CNI context), when the hairpinned packet arrives at the node, the source IP is the pod IP,
which is different to the destination IP which is the node IP.
This is why this connection isn't immediately dropped at this point, and instead lives on to make it to its eventual
destination.

At this point, I figured that perhaps something was going wrong when the traffic made it over to the destination node.
I ran a packet capture on the destination, and was puzzled to find that it looked like the TCP SYN made it just fine,
and was met with a standard SYN-ACK response.
Armed with this information, I could now locate the corresponding SYN-ACK back on the client node.
It was around this time that I decided to take full packet captures on both nodes and have a look at them in Wireshark.

Wireshark had some interesting things to say as part of its 'expert analysis'.
It flagged the SYN-ACK back on the client node as having 'TCP port numbers reused', which further confirmed that I
was on the right track.
Now that I could locate the SYN-ACK, I now saw a RST in the packet capture from the client pod, and this RST was
being sent to the ingress gateway.

All of this was pretty puzzling.
Cue yet more eBPF tracing and fiddling around, to no avail.
Ultimately I had all of the information I needed to understand what was happening, it just needed some thinking and
reasoning, and also recalling much of the information I put in the context about how the VPC CNI plugin works, and
how Kubernetes services work.
I was extremely puzzled and determined to figure out who was sending the RST packets and why.
This is where I descended into the Envoy codebase and ultimately the Linux TCP stack in order to figure out why the
RSTs were being sent, but I didn't really get anywhere.

To add even more complexity to the mix, the presence of an Istio sidecar on the client pod was causing extra
confusion, because it was holding a connection to the client process running in the pod and a separate connection to
the upstream.
This resulted in confusing packet captures that included multiple RSTs.
Ultimately the Istio sidecar isn't doing anything out of the ordinary, and I can reproduce the issue without it.
However it's a good lesson in attempting to minimize the moving parts in a reproduction as much as possible.
I think I was shocked that I was able to so easily reproduce the error after a few cURLs that I neglected to
eliminate as much complexity as possible.

In the end, here is what is happening.
In this example:

* `10.0.1.123` is the IP of the client pod
* `10.0.1.1` is the IP of the node that the client pod is on
* `10.5.0.3` is the IP of the loadbalancer node that we hit
* `10.0.2.1` is the IP of the ingress gateway pod, the ultimate destination of the traffic

<TODO diagram>

1. The client sends a TCP SYN to the NLB, source IP `10.0.1.123`, destination IP `10.5.0.3`.
1. The NLB sends a TCP SYN to the node to try to establish a connection to the target.
   Normally this would have source IP `10.5.0.3`, destination IP `10.0.1.1.`, however because client IP preservation
   is on, the source IP is actually that of the pod, `10.0.1.123`.
1. The client node NATs this traffic over to the destination ingress gateway pod, source IP `10.0.1.1`, destination
   IP `10.0.2.1`
1. The destination ingress gateway responds with a SYN-ACK
1. The client node receives the SYN-ACK, and NATs the traffic in the opposite direction as before.
   This results in a SYN-ACK being sent to the client pod.

This is where things break, because what should happen is that the SYN-ACK is sent back to the NLB, the target
connection is established, and the NLB can then send a SYN-ACK back to the client to establish the client connection.
However instead, it's almost as if we've sidestepped the NLB and directly sent the SYN-ACK to the client pod.
This doesn't work, because the ports are wrong.
The client pod is expecting a SYN-ACK from the loadbalancer on port 32411, but instead receive a SYN-ACK from an IP
it doesn't know about on completely the wrong port.
This causes it to send an RST.
We could have avoided this if the node knew about the NLB client IP preservation magic, but it has no knowledge of
this.
Since the packet from the ingress gateway pod never made another hop over the VPC network after it made it to the
client node, there was no opportunity for it to be routed correctly.
This is noted in the AWS docs for NLBs as

> When client IP preservation is enabled, targets must be in the same VPC as the Network Load Balancer, and traffic must flow directly from the Network Load Balancer to the target.

We violated the second clause here, in that traffic _did not_ flow directly from the NLB to the target.
Instead, it flowed via a node and then to the target.

What about the original connection that the client made to the NLB?
Well this explains some retransmission we see around the place in the packet captures.
The client never sees a response to its SYN, and neither does the loadbalancer, so they continue to try to establish
a connection.
However this is doomed to fail, because the SYN-ACK will never make it back to its destination, and as far as the
node is concerned it is correctly NATing traffic.

## Conclusion

I learned a lot debugging this issue.
Ultimately the cause was [yet again](https://medium.com/seek-blog/beware-of-transit-gateways-bearing-large-packets-77702c4c1b20)
AWS networking minutia interacting with traffic in interesting ways, but I learned a lot along the way and
solidified my understanding of the complex beast that is Kubernetes networking.

I think my big takeaways from this set of troubleshooting were:

* Being persistent is important.
  There were many dead ends while I was trying to figure out what was happening, but each time I would set things
  down and return to the problem a few days later.
  Ultimately, these are software systems, and they behave in sometimes inscrutable but predictable ways.
  Our role when troubleshooting is to make sense of the information we're presented with.
  It will eventually make sense, it may just take a lot longer than you think.
* You can learn an incredible amount from tangents, even if it doesn't get you closer to a solution.
  I learned a huge amount about eBPF and tracing live systems troubleshooting this problem, even though the data I
  actually needed to make sense of things came from `tcpdump` which I've used heaps of times.
  That learning is incredibly valuable, and the next time that I need to troubleshoot a problem where eBPF is the
  right tool, I'll be prepared.
* Almost contradicting the previous point, going on tangents, particularly unfruitful tangents, often leads you to
  solidify your knowledge, which may actually help you solve your original problem.
  My eBPF noodling forced me to think about and make sure I understood the TCP connection state machine as well as
  where in this mess of machines exchanging packets there were TCP connections, and where there was just address and
  port translation.
  Ultimately, thinking hard about where there was TCP connection state lead to my realization that the pod didn't
  have any connection state associated with the 5-tuple of the SYN-ACK.
  Ironically, staring down a dead-end before you've realized it's a dead-end means that you often descend far lower
  in the stack than you might otherwise, because you're convinced that looking just one level lower might provide
  the answers you need.
* Taking notes is incredibly valuable for piecing things together afterwards, and is a pretty easy habit to get in to.
  As soon as you start troubleshooting, start taking notes.
  Best case: you get a blog post out of it.
  Worst case: you took some unnecessary notes.

[Icons in this post were created by Vectors Market - Flaticon](https://www.flaticon.com/authors/flat-color/flat?author_id=137&type=standard)
