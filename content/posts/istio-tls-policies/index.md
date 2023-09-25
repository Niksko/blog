---
title: "Istio TLS policies - ugly bits and undocumented bits"
date: 2019-06-12T00:43:25Z
image: "sailboat.jpg"
imageAlt: "An image of a sailboat on the water on a stormy day"
summary: "One of the selling points of deploying Istio in your Kubernetes cluster is that it provides mechanisms to enforce authentication between pods communicating with other services within the cluster.
The documentation of these leaves a lot to be desired, as we discovered when we first started playing with these features while gearing up to roll out Istio more widely."
draft: false
---

{{< figure src="sailboat.jpg" caption="Photo by [Alina Pkhakadze](https://unsplash.com/@alinap) on [Unsplash](https://unsplash.com)" alt="An image of a sailboat on the water on a stormy day." >}}

_Note: this information was accurate as of Istio 1.1._
_The pace of development for the Istio project is swift, so some of this might be out of date by the time you read this._

One of the selling points of deploying Istio in your Kubernetes cluster is that it provides mechanisms to enforce authentication between pods communicating with other services within the cluster.
The documentation of these leaves a lot to be desired, as we discovered when we first started playing with these features while gearing up to roll out Istio more widely.

This guide is intended as a general overview of the resources Istio provides you for managing your pod to service communication for people interested in rolling out Istio to their own cluster.
It also aims to fill in some current gaps in the Istio documentation.

Having a rough idea of basic Istio concepts (eg. the sidecar injection model) will let you get the most out of this guide.
Having a cluster that you can experiment with and run commands will help your own understanding, but I've aimed to make this guide self contained in that it shows the outcomes of commands being executed in a cluster.

## Connection handling - service side

Istio provides two custom resources that determine what types of connections sidecars will accept on the service side of pod to service communication.
These are the `MeshPolicy` and the `Policy` CRDs.
They differ in that the `MeshPolicy` CRD applies to the entire cluster, where as the `Policy` CRD is namespace scoped.
Other than this, they follow the same API, documented in [the Istio reference docs](https://istio.io/docs/reference/config/security/istio.authentication.v1alpha1/).

Being cluster scoped, the `MeshPolicy` CRD has a concept of a 'default' policy.
This must be:

* placed in the Istio 'administrative root namespace' (`istio-system` by default, but configurable in the main Istio config map)
* be named `default`
* contain no targets (since it is intended to apply to the entire mesh)

A simple default `MeshPolicy` looks like this:

```yml
apiVersion: "authentication.istio.io/v1alpha1"
kind: "MeshPolicy"
metadata:
  name: "default"
spec:
  peers:
  - mtls:
      mode: PERMISSIVE
```

The policy enables mTLS in 'permissive' mode
This allows mTLS communication in an 'opt-in' fashion, while still allowing plain HTTP communication between sidecars.

The alternative to permissive mode is 'strict' mode, which can be enabled with mode: STRICT.
In this mode, sidecars must communicate using TLS and provide a client certificate.
Confusingly, the following are all equivalent methods of enabling STRICT mode:

* `- mtls: null`
* `- mtls: `
* `- mtls: {}`

This is documented, but very hard to find.

It's also possible to define the natural third option ie. HTTP only with no option of mTLS.
To do this, you omit the peers block entirely.

You can also define namespace-scoped and service-scoped mTLS policies using the `Policy` CRD.
For example, if you wanted to enforce mTLS for a service named `foo` in your `bar` namespace, you could create a policy like this:

```yml
apiVersion: authentication.istio.io/v1alpha1
kind: Policy
metadata:
  name: foo-policy
  namespace: bar
spec:
  targets:
  - name: foo
  peers:
  - mtls:
      mode: STRICT
```

The key takeaway here is that `MeshPolicy` and `Policy` dictate the types of connections that are accepted by a service.

## Checking mTLS configuration

Now is a useful time to discuss how to determine which communication options are open to a given pod, and between a given pod and service.
The `istioctl` CLI tool provides you with the following useful command:

```shell
$ istioctl authn tls-check somepod-123456-abcdef

HOST:PORT                        STATUS    SERVER  CLIENT  AUTHN POLICY  DESTINATION RULE
foo.bar.svc.cluster.local:8000   CONFLICT  mTLS    HTTP    default/      -
```

The output of this command indicates that when communicating with the `foo.bar.svc.cluster.local:8000` service, the following conditions will apply:

* `STATUS: CONFLICT` indicates that communication between the pod and service will not be possible, because the client pod only uses HTTP, and the server service can only accept mTLS.
* `SERVER: mTLS` indicates that this service has been configured to communicate only using mTLS (and has been configured as such by the `AUTHN POLICY: default/`).
* `CLIENT: HTTP` indicates that from this pods point of view, clients wishing to communicate with this service have been configured to use HTTP only (`DESTINATION RULE: -` indicates that this is due to no destination rule matching this service, see more below).

You can also add an extra argument to this command in the form of a fully qualified `service:port` string to show only information for that service.

## Connection handling - client side

The decision for the client pod to use HTTP or mTLS to connect to a given service is determined by the `DestinationRule` CRD.
This CRD is namespace scoped, and includes a host field to target a specific host or set of hosts.
An example of a `DestinationRule` instructing clients that want to connect to the `baz` service in the `bar` namespace to use mTLS looks like this:

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: baz
  namespace: bar
spec:
  host: baz.bar.svc.cluster.local
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL
```

`DestinationRule`s are very flexible, almost to the point of confusion.
All of the following must be taken in to account when determining what `DestinationRule`s are in effect:

* Which destination rule applies to a particular communication is considered in the following order:
  1. rules in the client namespace
  2. rules in the service namespace
  3. rules in the 'administrative root namespace' (usually `istio-system`, as mentioned above)

    The first applicable rule is applied.
    This effectively allows the client's namespace to set how they communicate, then allows for the service to dictate how it should be communicated with, and finally allows a default method from the administrative root namespace.

* You can include a wildcard in the host field (eg. `*.bar.svc.cluster.local`, or `*.local` for all hosts in the mesh).
  This allows you to provide default destination rules for the entire mesh, or for an entire namespace.

* The `DestinationRule` spec exposes an `exportTo` field.
  This allows for the destination rule to be included in the above resolution order as if it were in another namespace.
  This field is currently restricted to either `.` or `*` indicating no export or export to all namespaces respectively.
  This allows administrators to provide destination rules to other namespaces.
  One particularly important example of this is when you wish to enforce mTLS connections between sidecars and the Istio control plane (Pilot).
  This can be accomplished by a `DestinationRule` that is exported to all namespaces for the `istio-pilot.istio-system.svc.cluster.local` service.

The most conceptually confusing part about this for me was that its not possible to explicitly declare that a particular pod should use a particular method to communicate with other pods.
Every piece of configuration determines either what the service should accept, or what clients talking to a service should provide.

The mode field supports a number of options other than `ISTIO_MUTUAL`.
These modes are `DISABLED`, `SIMPLE` and `MUTUAL`.
Disabled enforces that the client must use plain HTTP to communicate with the service.
The other two options require more explanation and are out of scope for this article, however they both involve TLS negotiation at the client level rather than the sidecar level.
The section below regarding ALPN headers may provide some insight as to how this would work.

## Defaults and non-sidecar communications

It's worth mentioning some defaults, which are thankfully quite sensible.
Some of these were discovered by trial and error, since `istioctl` will not give you information on services without sidecars, or clients without sidecars.

* If a pod doesn't have a sidecar, it's not really subject to any rules.
  This may seem strange, but all of Istio's policy and security enforcement is handled by Envoy, so no sidecar means no enforcement.
  If you want to make _absolutely_ sure that all traffic in your cluster uses mTLS, you need to enforce sidecar injection.
  As soon as a pod exists without a sidecar, you're back to relying on things like network policies to enforce which pods can talk to each other.
* If no destination rule applies, the client will attempt to use HTTP.
  This can be confusing, because even in `STRICT` mTLS mode (as provided by a `MeshPolicy` or `Policy`), you will get pods being unable to communicate if they don't have a destination rule that is applicable to them.
  This can be diagnosed using `istioctl authn tls-check`. The Istio Helm charts provide a default `DestinationRule` of host: `*.local` to avoid issues.
* If no MeshPolicy or Policy applies, servers will only accept HTTP.
  This is perhaps the most confusing, as I would have expected this behavior to be similar to PERMISSIVE mode, but it is not.

## Validating connectivity

At this point, we have the tools to validate that Istio is configured for the type of pod to service authentication we want, and to troubleshoot when the state is not what we expect.
However if you're like me, this isn't particularly satisfying.
We're relying on Istio's own tooling to tell us whether mTLS is configured properly.
Ideally, we'd like a way to verify that mTLS is set up and working 'out of band', to give us greater confidence that nobody can snoop on our pod to service communications.

Istio provides documentation on how to verify this using `curl` in its [mTLS deep dive documentation](https://istio.io/docs/tasks/security/authentication/authn-policy/).
This documentation walks you through setting up strict mTLS between a pod and a service, and then verifying from the sidecar container (to bypass any connection handling by the sidecar) that:

* HTTP fails, because mTLS is in strict mode
* TLS without providing client certs also fails
* TLS with client certs succeeds

This lets us confirm that mTLS is in use, and does so in a way that is immune to Istio tooling bugs.

However, if you configure your cluster with a `PERMISSIVE` mTLS policy, the final test of curling the service while providing client certs fails.
This was how our cluster was configured during testing, and it was incredibly puzzling as to why this was happening.
After a little digging and some helpful people on the Istio Slack, I _think_ I have an explanation.
It also serves to expose how Istio's mTLS works under the hood, and provides information about the other TLS modes provided by the `DestinationRule` CRD operate.

## ALPN and how it's used by Istio

ALPN stands for 'Application Layer Protocol Negotiation', and it is an extension to the TLS specification.
Roughly speaking, ALPN is intended to reduce connection setup time by including negotiation of the protocol that will be carried over TLS in the TLS handshake.
This means that once the TLS handshake is complete (which takes two round trips), you don't have to waste an extra round trip setting up a http1.1, http2 or other application layer protocol connection.

The crucial piece of understanding required to relate this to Istio and the issue with `PERMISSIVE` mode mentioned above, is that Istio uses it's own ALPN header with the value `istio` when in `PERMISSIVE` mode. This allows Istio sidecars to differentiate between traffic that is intended to be tunneled over mTLS, and traffic that is natively http and should not be tunneled. This is still confusing, but after some consideration I have the following theory as to why the above mentioned `curl` fails in permissive mode, but succeeds in strict mode.

In permissive mode, the destination service can accept both HTTP and mTLS traffic.
However there is another option, which is implied by the HTTP mode, but is confusing when phrased this way.
A better phrasing would be that the pod can accept _plaintext_ or mTLS traffic, from the perspective of the sidecar.
What this is getting at is that if the application running inside the pod is able to broker its _own_ TLS connection, this should still be permitted by "HTTP/plaintext" mode.
When we `curl` our service that's running in permissive mode, the sidecar needs to make a choice between two equally valid scenarios when it sees a TLS handshake client hello packet:

* Scenario 1: is this a client that is trying to set up a TLS connection with the application that this sidecar is proxying, OR
* Scenario 2: is this another sidecar client that is trying to set up a TLS connection with me, the sidecar

The mechanism for determining this is the ALPN header.
If the ALPN header is `istio`, a special value used only by sidecars (in theory), then we know that this is scenario 2.
If the ALPN header instead contains `http/1.1` then we know that this is scenario 1.

This explains why our curl works in `STRICT` mode, but doesn't work in `PERMISSIVE` mode. In `STRICT` mode, all client hellos are negotiation with the sidecar for mTLS, and so no differentiation is required.
As such, Envoy's do not send `istio` in their ALPN header for these connections, and so everyone is on the same page and the TLS connection can be successfully negotiated.
In `PERMISSIVE` mode, if you send `http/1.1` as your ALPN header (which curl does by default, with no way to override), the connection is assumed to be attempting to negotiate TLS with the application behind the sidecar.
If this doesn't support TLS, then the handshake will fail and you'll get an error.
If you send the `istio` ALPN header, then the connection succeeds.

You can verify this by setting up a cluster as per the Istio [mutual TLS deep-dive docs](https://istio.io/docs/tasks/security/authentication/authn-policy/), but then setting the cluster wide `MeshPolicy` to `PERMISSIVE`.
You should observe the behavior described above when you get to the 'verify requests' section.

In order to dig further, we need a tool that allows us to send different ALPN headers.
We can accomplish this using the `openssl` tool.
The default `sleep` pods deployed as part of the Istio documentation do not contain `openssl`.
Modify their deployments to use an image that does, for example, [netshoot](https://medium.com/r/?url=https%3A%2F%2Fhub.docker.com%2Fr%2Fnicolaka%2Fnetshoot).

Once you've updated the images in your `sleep` deployment, you should be able to use `openssl` to verify the behavior described above:

```shell
$ kubectl exec $(kubectl get pod -l app=sleep -o jsonpath={.items..metadata.name}) -c istio-proxy -- openssl s_client -alpn http
/1.1 -connect httpbin:8000/headers -key /etc/certs/key.pem -cert /etc/certs/cert-chain.pem -CAfile /etc/certs/root-cert.pem

140223038092952:error:140790E5:SSL routines:ssl23_write:ssl handshake failure:s23_lib.c:177:
CONNECTED(00000003)
---
no peer certificate available
---
No client certificate CA names sent
---
SSL handshake has read 0 bytes and written 320 bytes
---
New, (NONE), Cipher is (NONE)
Secure Renegotiation IS NOT supported
Compression: NONE
Expansion: NONE
No ALPN negotiated
SSL-Session:
    Protocol  : TLSv1.2
    Cipher    : 0000
    Session-ID:
    Session-ID-ctx:
    Master-Key:
    Key-Arg   : None
    PSK identity: None
    PSK identity hint: None
    SRP username: None
    Start Time: 1560308549
    Timeout   : 300 (sec)
    Verify return code: 0 (ok)
---
command terminated with exit code 1
```

However if you pass the `istio` ALPN header, you get the following:

```shell
$ kubectl exec $(kubectl get pod -l app=sleep -o jsonpath={.items..metadata.name}) -c istio-proxy -- openssl s_client -alpn ist
io -connect httpbin:8000/headers -key /etc/certs/key.pem -cert /etc/certs/cert-chain.pem -CAfile /etc/certs/root-cert.pem
depth=1 O = cluster.local
verify return:1
depth=0
verify return:1
DONE
CONNECTED(00000003)
---
Certificate chain
 0 s:
   i:/O=cluster.local
---
Server certificate

<SNIP>

---
SSL handshake has read 3126 bytes and written 2277 bytes
---
New, TLSv1/SSLv3, Cipher is ECDHE-RSA-AES128-GCM-SHA256
Server public key is 2048 bit
Secure Renegotiation IS supported
Compression: NONE
Expansion: NONE
No ALPN negotiated
SSL-Session:
    Protocol  : TLSv1.2
    Cipher    : ECDHE-RSA-AES128-GCM-SHA256

<SNIP>

    Start Time: 1560309161
    Timeout   : 300 (sec)
    Verify return code: 0 (ok)
---
```

This indicates a successful TLS handshake, indicating that mTLS is configured properly.
Note the line that states `No ALPN negotiated`.
Didn't we just pass an ALPN header value of `istio`?
My reasoning here is that ultimately it was simply being used as a marker to the sidecar, and at this stage the sidecar doesn't know what protocol it is going to transport.
Therefore, the ALPN header is used merely as an indicator, but dropped while negotiating the connection.

## Conclusion

Hopefully this information helps you configure your Istio installation and your applications to enforce the TLS policy you want, where you want it.
As I dive deeper into setting up Istio in a production environment, I hope to provide more explainers such as this one that help de-mystify the wide range of configuration options that Istio offers.
