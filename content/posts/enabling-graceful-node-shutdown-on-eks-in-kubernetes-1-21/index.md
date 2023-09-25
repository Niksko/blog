---
title: "Enabling graceful node shutdown on EKS in Kubernetes 1.21"
date: 2021-08-02T00:58:34Z
draft: false
image: "swan.jpg"
imageAlt: "An image of a white swan swimming in a fairly calm body of water"
summary: Kubernetes 1.21 supports graceful node shutdown, for gracefully terminating pods when a node is shutting down. This post explains how to configure this feature on EKS.
---

{{< figure src="swan.jpg" caption="Your cluster (hopefully) after enabling this feature. Photo by [Oliver Rowley](https://unsplash.com/@oliver_rowley?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText) on [Unsplash](https://unsplash.com/s/photos/swan?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText)" alt="An image of a white swan swimming in a fairly calm body of water" >}}

[Kubernetes 1.21 was released in April](https://kubernetes.io/blog/2021/04/08/kubernetes-1-21-release-announcement/), and
with it, a new feature graduated to beta.
[Graceful node shutdown](https://kubernetes.io/docs/concepts/architecture/nodes/#graceful-node-shutdown) allows the
kubelet to detect when the system is being shut down, and delays this shutdown by a small amount of time to ensure
that all of the pods on the node can be terminated gracefully.

This feature fills a gap in the current tooling when running Kubernetes in AWS.
We have the [Node Termination Handler](https://github.com/aws/aws-node-termination-handler) for detecting node shutdowns
based on EC2 events, but this won't handle the simple case of stopping or restarting a node outside of the node's
normal lifecycle (e.g. lifecycle events related to being part of an ASG).

With [EKS now supporting Kubernetes 1.21](https://aws.amazon.com/blogs/containers/amazon-eks-1-21-released/), you might
think you get access to graceful node shutdown for free.

Not quite.

It requires a little bit of configuration, but it's a pretty simple fix for a lot of gain.

This post is a bit of a journal of my process when figuring out how to configure this feature on EKS, with a section
at the end that outlines the final set of steps to enable this feature.

## Process

To start, we'll SSH/SSM to a node, and try and configure the feature manually.
Once we've got that working, we'll automate.

My first thought was to just add the required configuration fields to the kubelet's configuration file, and see if
that worked.

The kubelet reads configuration from `/etc/kubernetes/kubelet/kubelet-config.json`, and the configuration API is
documented at [kubelet.config.k8s.io/v1beta1](https://kubernetes.io/docs/reference/config-api/kubelet-config.v1beta1/#kubelet-config-k8s-io-v1beta1-KubeletConfiguration).

I tried adding the `shutdownGracePeriod` and `shutdownGracePeriodCriticalPods` fields.
The format is the standard Golang duration format i.e. `3m30s` for 3 minutes and 30 seconds.

On our cluster, from the time a pod first goes into `Pending`, to launching a new node and that pod being scheduled (with low priority)
is about 3m15s. So 4m feels like a good amount of time to wait for regular pods to be evicted, and then another 2m for system
critical pods.

In the end, my `KubeletConfiguration` looked like this

```json
{
  "kind": "KubeletConfiguration",
  "apiVersion": "kubelet.config.k8s.io/v1beta1",
  "address": "0.0.0.0",
  ...
  <snip>
  ...
  "maxPods": 58,
  "shutdownGracePeriod": "6m",
  "shutdownGracePeriodCriticalPods": "2m"
}
```

The two lines at the bottom are the new parts.

Now, the kubelet should be configured, we need to restart the Systemd service so that the configuration takes effect.

```bash
sudo systemctl restart kubelet
```

The graceful node shutdown feature uses [Systemd inhibitor locks](https://www.freedesktop.org/wiki/Software/systemd/inhibit/),
so we should be able to check whether the kubelet has taken a lock:

```bash
$ sudo systemd-inhibit --list
0 inhibitors listed.
```

However we find no inhibitors.

Looking at the kubelet logs:

```bash
$ sudo journalctl -u kubelet | grep shutdown
Jul 29 06:22:01 <node-hostname> kubelet[20169]: E0729 06:22:01.860159   20169 kubelet.go:1407] "Failed to start node shutdown manager" err="failed reading InhibitDelayMaxUSec property from logind: Message recipient disconnected from message bus without replying"
```

This indicates an issue with logind.

Based on the [logind man page](https://www.freedesktop.org/software/systemd/man/logind.conf.html), the issue is probably
that we haven't configured `InhibitDelayMaxSec`.

We can check that by looking at `/etc/systemd/logind.conf` and seeing that the file has all of the options commented
out.
We're going to leave `/etc/systemd/logind.conf` alone, because this is where Amazon would configure any defaults they
wanted to configure.
Instead, we're going to create a file under `/etc/systemd/logind.conf.d/`.

At this point, I discovered that there actually already was a file in this directory called `99-kubelet.conf`:

```bash
$ cat /etc/systemd/logind.conf.d/99-kubelet.conf
# Kubelet logind override
[Login]
InhibitDelayMaxSec=360
```

Seems like the kubelet attempts to configure logind for us if it can't make the graceful node shutdown feature work.

So at this point, it seems like we should just be able to restart the `systemd-logind` service and then `kubelet`,
and the feature should work. And we can:

```bash
$ sudo systemctl restart systemd-logind
$ sudo systemd-inhibit --list
0 inhibitors listed.
$ sudo systemctl restart kubelet
$ sudo systemd-inhibit --list
     Who: kubelet (UID 0/root, PID 24485/kubelet)
    What: shutdown
     Why: Kubelet needs time to handle node shutdown
    Mode: delay

1 inhibitors listed.
```

However relying on the kubelet to create configuration for us isn't ideal.
Instead, we can create the required config ourselves.

```bash
$ mkdir -p /etc/systemd/logind.conf.d
$ cat << EOF > 50-max-delay.conf
[Login]
InhibitDelayMaxSec=360
EOF
$ sudo mv 50-max-delay.conf /etc/systemd/logind.conf.d/
$ sudo systemctl restart systemd-logind
$ sudo systemctl restart kubelet
$ sudo systemd-inhibit --list
     Who: kubelet (UID 0/root, PID 24485/kubelet)
    What: shutdown
     Why: Kubelet needs time to handle node shutdown
    Mode: delay

1 inhibitors listed.
```

Doing this on a fresh system shows no `99-kubelet.conf` this time, indicating that this file is only created if it's needed.

## Final changes to enable the feature

The above was fine for exploration, but now we need a concrete way of enabling this feature on our nodes at startup.

The following userdata script will do this, with the grep-ing and sed-ing adapted from
[an article from AWS on configuring node image caching](https://aws.amazon.com/premiumsupport/knowledge-center/eks-worker-nodes-image-cache/)

```bash
# Inject shutdownGracePeriod value unless it has already been set.
if ! grep -q shutdownGracePeriod /etc/kubernetes/kubelet/kubelet-config.json;
then
    sed -i '/"apiVersion*/a \ \ "shutdownGracePeriod": "6m",' /etc/kubernetes/kubelet/kubelet-config.json
fi

# Inject shutdownGracePeriodCriticalPods value unless it has already been set.
if ! grep -q shutdownGracePeriodCriticalPods /etc/kubernetes/kubelet/kubelet-config.json;
then
    sed -i '/"shutdownGracePeriod*/a \ \ "shutdownGracePeriodCriticalPods": "2m",' /etc/kubernetes/kubelet/kubelet-config.json
fi

mkdir -p /etc/systemd/logind.conf.d
cat << EOF > /etc/systemd/logind.conf.d/50-max-delay.conf
[Login]
InhibitDelayMaxSec=360
EOF

sudo systemctl restart systemd-logind
```

Adjust the times to suit your particular cluster. Enjoy!
