---
title: "IaC in the home - two years on"
date: 2020-04-11T02:25:23Z
draft: false
image: "container-ship.jpg"
summary: "After two years of running a home Kubernetes setup, I have more thoughts and lessons about how to run a home cluster."
---

_This is the third post in a series about how I manage my home Kubernetes cluster.
For context, read [the original post]({{< ref "posts/iac-in-the-home/index" >}}) and [the followup at one year]({{< ref "posts/iac-in-the-home-one-year-on/index" >}})._

{{< figure src="container-ship.jpg" caption="Photo by [torben](https://unsplash.com/@runfilm) on [Unsplash](https://unsplash.com)" alt="A black and white image of a container ship, viewed from the rear.">}}

I've now been running my home Kubernetes "cluster" (inverted commas, because there's only one node) for two years.
A fair bit has changed since I wrote the last post, so I thought it might be time for an update.

On a personal note, I started working in a team building a Kubernetes platform full time.
This was an incredibly exciting move for me, and has shifted my career in an exciting new direction.
Running Kubernetes at home helped me to get a running start in my new role, and probably contributed to me getting the role in the first place.
I guess all of this pain has some upsides.

Needless to say, working in that team has shaped and altered my views on best practice for running a cluster.
It's also improved my Kubernetes understanding greatly.
Because of this, I've made a range of changes to my home cluster, expanding both its functionality and its maintainability.
The sections below go in to more detail about how and why the changes were made, and document any speedbumps along the way.

## MetalLB

Kubernetes is geared towards large-scale deployments for running many workloads.
It's meant to be run on a public cloud.
This means that the options for setting up load balancing outside of the public cloud providers aren't ideal.
I used to run everything via a `NodePort`, but this means you need the port in your URLs when requesting services inside the cluster.
And you can't use ports 80 or 443 because these are taken by the Kubernetes API server.

[MetalLB](https://metallb.universe.tf/) provides a load balancer for bare-metal Kubernetes clusters, solving this problem.
I'm operating MetalLB in 'Layer 2 mode', which means MetalLB will participate in address resolution of IPv4 addresses via the standard ARP protocol.
What this means practically is that I've assigned an IPv4 address block on my home network to MetalLB, and it will advertise these address for me, and associate them with Kubernetes `LoadBalancer` objects.
From the outside, it simply looks like my server advertises multiple addresses.
This removes the port conflict on 80 and 443, freeing those up for use for cluster services.

Combining this new IP address for load balancing with some DNS entries in my router means that I can now access services easily in a browser, without having to remember which port I bound them to.

## Istio

[Istio](https://istio.io/) is a service mesh, that enables smarter networking within a cluster.
It's complete and total overkill for a home Kubernetes cluster.
I'm running it anyway, because it's cool tech and it's relevant to my work.

The installation of Istio has come a long way since I first installed it.
At first, my instructions included cloning the source repo, making modifications, running incantations, and all the sorts of things you can't remember six months later.
Thankfully the Istio contributors have prioritised usability in recent releases, and the installation process is now relatively straightforward.

While writing this post, I updated to Istio 1.5 - the latest release at the time.
After updating my `istioctl` tool, I ran `istioctl operator init`.
This detected the existing install of the Istio operator in my cluster, and upgraded it to the latest version automatically.

Upgrading Istio turned out to be a bit of a bad idea, because the API for defining control planes appears to have changed.
The old resource had `kind: IstioControlPlane`, where as the new resource is `kind: IstioOperator`.
This meant that removing the old control plane configuration did nothing, instead of removing the old control plane as I'd hoped.
It also appears that the Istio operator now looks in the `istio-system` namespace for control plane configuration objects, rather than in its own `istio-operator` namespace.

As is often the case, tearing everything down with a `kubectl delete ns istio-system --grace-period=0 --force` solved things.
Reapplying my control plane configuration with the new resource kind gave me a new control plane
Even better, my new control plane is just the `default` profile.
Istio's Secret Discovery Service graduated to stable, which was the last 'experimental' feature I was using (requiring extra control plane configuration to enable).

After an Istio upgrade, you generally need to bounce your sidecar-injected pods to force them to get re-injected with the latest version of the Istio sidecar.
After doing this, my services weren't resolving in the browser, with an `ERR_CONNECTION_RESET`.
Fixing this required re-applying my certificate objects, which lived in the `istio-system` namespace, as discussed in the next section.
After this, all my services seemed to be in working order.
The Istio upgrade process gets easier every time!

## Certificates

Browser warnings, red padlocks, or just grey padlocks are annoying.
Wouldn't it be nice to have nice, SSL secured services, within our home cluster?
And on top of that, can we get SSL certificates without exposing my home cluster to the internet?

My solution to this is to hook up my home cluster into Cloudflare, which is what I use for my DNS.
[cert-manager](https://github.com/jetstack/cert-manager) set up inside Kubernetes allows me to create certificate files alongside the deployments of my applications.
Using the Cloudflare API, cert-manager is able to automatically fulfil the [DNS-01](https://letsencrypt.org/docs/challenge-types/#dns-01-challenge) challenge that Let's Encrypt uses.
This means that I can safely provision certificates for services in my home network.

The final step is to configure Istio to use the certificates that cert-manager provisions.
This is the only flaw with this set up, which I hope can be fixed in the future.
Currently, the secrets for the certificate must be created in the `istio-system` namespace, alongside the Istio Ingress Gateway.
There's an [open issue](https://github.com/jetstack/cert-manager/issues/2522) on the cert-manager project that discusses this and considers workarounds, as well as linking off to the relevant Istio issues.
For now, we have to create the certificates in the `istio-system` namespace (and remember to re-deploy if we delete the namespace).

Along with a DNS entry (something I haven't put in my cluster... yet), I can now access my cluster services at friendly domains like https://deluge.home.skouf.com.

## Migration from Container Linux to Flatcar Linux

When I set up my server, I wanted a lightweight operating system that was designed for running containers.
Container Linux fit the bill, and has served me well.

Unfortunately, in January of 2018, CoreOS (the creators of Container Linux) [were bought by Red Hat](https://www.cnbc.com/2018/01/30/red-hat-buys-coreos-for-250-mililon.html).
As such, Container Linux was folded into Red Hat's existing Atomic project, and [Container Linux is set to reach end of life as of May 26th 2020](https://coreos.com/os/eol/).

[Flatcar Linux](https://www.flatcar-linux.org/) is a friendly fork of Container Linux, and is largely compatible with Container Linux.
Flatcar made upgrading from Container Linux really easy, so Flatcar became the obvious choice for underlying OS.
[Flatcar has a guide on directly updating from Container Linux](https://docs.flatcar-linux.org/os/update-from-container-linux/), as well as a script that runs everything for you.

Running this script took about 10 seconds, and after a reboot, everything seemed to come back up.
However the message upon sshing in seemed like things hadn't worked.

{{< figure src="before-upgrade.jpg" caption="Pre-upgrade message indicating an old version of Container Linux." alt="A screenshot of a terminal. The text indicates that we are running Container Linux.">}}
{{< figure src="latest-container-linux.jpg" caption="After updating to the latest Container Linux, we now get this end-of-life warning." alt="A screenshot of a terminal. The text indicates that we are still running Container Linux, but now at a newer version. There is also a warning about the end-of-life of Container Linux.">}}

After some poking around with the `update_engine_client` tool, I ended up running the script again.
This time I was pretty confident that I was updating to Flatcar.
The version I was updating to, `2345.3.1`, is the latest version of Flatcar; this version doesn't exist in Container Linux.
Evidently, I was just a little out of date with my Container Linux install, and needed to update first for a smooth experience.

{{< figure src="update-progress.jpg" caption="The update engine performing the update to `2345.3.1`." alt="A screenshot of a terminal. The text indicates that the update engine is in the process of downloading a new update.">}}
{{< figure src="upgrade-successful.jpg" caption="The upgrade was a success!" alt="A screenshot of a terminal. The text indicates that the machine now runs Flatcar Linux." >}}

You'll notice the images above have `Update Strategy: No Reboots`.
I'm sure I did this to maintain uptime, but it's probably not a great idea.
While I was fiddling with things, I decided to enable a maintenance window for applying updates.

[Flatcar Linux have docs on this](https://docs.flatcar-linux.org/os/update-strategies/#auto-updates-with-a-maintenance-window), though I had to install a [locksmithd systemd unit](https://github.com/flatcar-linux/locksmith/blob/flatcar-master/systemd/locksmithd.service) and fiddle with some configuration files to get it working.
Now my system will update itself every Monday at 10am.
I chose this time because my server makes a few noises after rebooting, and I didn't want to wake people up.

## Conclusion

And so ends another year of running Kubernetes at home.
The cluster is in great shape, and has experienced relatively few issues over the last 12 months.
I'm spending around an evening every six months or so doing upkeep and maintenance, which seems reasonable to me.
Considering that I'm learning a lot along the way, I'm really happy with the setup.

See you in a year!
