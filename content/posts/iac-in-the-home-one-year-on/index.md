---
title: "Infrastructure as code in the home - one year on"
date: 2019-01-09T00:43:25Z
draft: false
summary: "One year on, I revisit my home infrastructure as code setup. I explore what worked, what didn't and what has changed over the last year."
image: "servers.jpg"
imageAlt: "A number of server racks with wires going everywhere"
categories:
  - technology
tags:
  - Kubernetes
  - homelab
---

_It's been almost a year since I published my original article on running my Kubernetes setup at home.
Have a read of [the original]({{< ref "posts/iac-in-the-home/index" >}}) for context._

{{< figure src="servers.jpg" caption="This is not what my home server looks like. Photo by [Taylor Vick](https://unsplash.com/@tvick) on [Unsplash](https://unsplash.com)." alt="An image of a server rack, with the mesh doors closed. Many colored ethernet cables connect different components." >}}

I've now been running Kubernetes at home for almost a year.
Some things have worked well, others have not, and I've just finished a round of cleanup, maintenance, and re-acquainting myself with the system.
I thought it might be time for some reflection.

## Recapping goals from last time

Looking back on my last post on this topic, I had a few explicit goals.

* Disposability.
  In other words, being able to tear down the system and start again quite easily if something breaks.
* Change management.
  Not letting small changes accumulate to the point where it's hard to understand the machine's state.
* Flexibility.
  The ability to re-provision the server with a new OS if desired.

I've managed to achieve some of these, but not others.

On the first goal of disposability, I failed to account for the fact that the system I had designed was, in fact, incredibly complicated.
With Matchbox, Terraform, Ignition configs and probably more gotchas, when it came to making changes, there was a lot to re-acquaint myself with.
So on that front, the setup I chose probably wasn't the best choice.
Automated headless provisioning is certainly very cool, and I learned a lot about PXE/iPXE/TFTP/DNS/DCHP in the process.
However it was really hard to remember how everything worked 10 months later.
I probably would have been far better served by something quite a lot simpler - perhaps just a USB stick that will bootstrap to Kubernetes.

On the second goal of change management, I feel it's gone reasonably well.
Using Kubernetes to run applications means no manual fiddling with the filesystem.
The only times I've had to SSH in are to add new devices (see below), and to troubleshoot issues I've had.
However aside from adding a new hard drive, it's mostly been to observe the state of the machine and not to fiddle.
So I'm giving myself a tick on that one.

On the last goal of flexibility, it probably wasn't a great goal to begin with.
I certainly could just wipe everything and start again on a new OS if I wanted to, but it's a bit of a moot point.
I'm happy enough with Kubernetes and the current performance of the server that I won't be moving any time soon.
Couple this with the entire exercise being more about learning that practicality, we'll call this one a wash and move on.

## Things that have proved difficult

Some things have proved incredibly difficult to get right.
Partly due to my own inexperience, but also due to bugs and weird quirks.
Here are a few of the issues I've run in to.

### Ingress

Ingress was confusing to set up when using a single node, and running on bare metal.

Ingress allows the outside world to talk to applications in your cluster
It's usually handled via a load balancer from a cloud provider (eg. and AWS ELB).
However, if you have a bare metal cluster, you need to use a reverse proxy like Nginx.
This is easy enough to configure via a Helm chart, but it requires some custom configuration.
Because I have the additional constraint of only a single node, Nginx has to bind to non-standard ports so as not to conflict with the bound ports used for the K8s API.
Not particularly bad, but I spent an afternoon baffled as to why my service and pod appeared to be working, and yet I couldn't access the service running in the pod.
Eventually I realised I was hitting the wrong port the whole time.

### Storage

Configuring storage has sucked.
A lot.
The ideal state is to have dynamic provisioning of persistent volumes, but this is pretty hard to do unless you're using cloud provider backed storage or a cluster filesystem.

First I tried [Rook](https://medium.com/r/?url=https%3A%2F%2Fgithub.com%2Frook%2Frook), a storage provider that works on top of the [Ceph storage cluster software](https://medium.com/r/?url=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FCeph_%28software%29).
After a very confusing time getting it set up, it seem to work ok.
Then I tried adding a new drive to the system, expecting things to Just Work.
This apparently wasn't supported in the version of Rook I was using (admittedly, my own fault for using something still in beta).
So I had to rip everything down and start again.

Then I had Rook working, but when I came time to mount an RWX PVC from multiple pods, I ran into the issue that apparently this [just doesn't work right now](https://medium.com/r/?url=https%3A%2F%2Fgithub.com%2Frook%2Frook%2Fissues%2F2300).
So then I had to tear Rook down and start again.

This time I used the [NFS external storage provider](https://medium.com/r/?url=https%3A%2F%2Fgithub.com%2Fkubernetes-incubator%2Fexternal-storage%2Ftree%2Fmaster%2Fnfs).
But this refused to work in a configuration with multiple nfs providers (one per drive) attached to the same provisioner and storage class.
Old documentation suggested this would work by creating a race to fulfill the storage, however in practice it seems that one provisioner would acquire a lock, and the other one would just do nothing.
Eventually I settled on a single NFS provisioner (because this allows for dynamic provisioning of PVs) with a btrfs filesystem that spanned multiple drives ([instructions on setting this up](https://medium.com/r/?url=https%3A%2F%2Fbtrfs.wiki.kernel.org%2Findex.php%2FUsing_Btrfs_with_Multiple_Devices)).
Adding a new systemd mount unit and another one shot to perform a btrfs scan, and I finally have multiple pods mounting a single RWX claim with dynamic provisioning.

An aside here: LVM would be great here, but sadly this doesn't seem to be supported by CoreOS at the moment, nor as part of Ignition.
This might be a solution in the future.
That said, support for dynamic provisioning of local storage is still Coming Soon, so you'd still need an NFS mount to facilitate this.

### Upgrades

As I mentioned above, disposability was a goal, but it hasn't gone as intended.
Firstly, the system of Matchbox, DnsMasq and Terraform is too complicated for me to remember 10 months on.
So re-provisioning from scratch is probably out of the question right now.
There's also the issue that I would lose all of my data, since it's only a cluster of one machine.

Thankfully, it appears that CoreOS upgrades are seamless.
I figured my OS was probably pretty old, but a simple reboot and I could see that the version number had updated to a more recent release, and the cluster came up with no ill effects.

Sadly, when I attempted to install Tectonic (after refreshing my memory on the whole Matchbox/Terraform/DnsMasq stuff), I found that Tectonic will not allow you to enter the same MAC address for the master and worker nodes.
This is annoying, because it seems as if Tectonic would have allowed me to do in-place Kubernetes version upgrades, instead of having to nuke things and start again.

For the moment I've parked this.
I'm happy that I've got an up-to-date OS, and updating to the latest Kubernetes to get all the goodies that come with it will have to wait.
I'm optimistic though, and the documentation has certainly become more comprehensive and easy to read since I last touched it.

## Conclusion

It's been a fun year or so running this cluster, and I'm looking to keep the setup I've got.
There have been a few issues along the way, but they've all been great learning experiences.
Hopefully I'll have another update in a year or so.
