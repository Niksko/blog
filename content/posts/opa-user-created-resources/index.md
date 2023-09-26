---
title: "A useful OPA snippet for selecting user-created resources"
date: 2023-07-02T11:06:26Z
draft: false
summary: "Documenting a neat solution to the problem of enforcing OPA policies against resources, but only when they have been created by a user (as opposed to those created by an internal Kubernetes controller)"
image: "post.jpg"
imageAlt: "A photo of a sunset with the silhouette of a signpost"
categories:
  - technology
tags:
  - Kubernetes
  - OPA
---

{{< figure src="post.jpg" caption="Photo by [Javier Allegue Barros](https://unsplash.com/@soymeraki) on [Unsplash](https://unsplash.com/photos/C7B-ExXpOIEnt)" alt="A photo of a sunset with the silhouette of a signpost" >}}

At [work](https://www.seek.com.au/work-for-seek/) we're continuing to use [OPA Gatekeeper](https://open-policy-agent.github.io/gatekeeper/website/docs/)
in our Kubernetes clusters to enforce policy on the resources that are deployed there.

As I documented in [my previous post on broad Gatekeeper policies]({{< ref "posts/opa-gatekeeper-gotcha/index" >}}),
one of the things we want to do is enforce wide-ranging policy across all resources of a particular `Kind`.
For example, we might want to enforce that all resources created in the cluster have a label that indicates who the
owner of the resource is.

When this becomes challenging is when you run in to situations where your users are not the only entities creating
resources in the cluster.
And this is a surprisingly common occurrence, as I wrote about in my previous blog post.
Kubernetes contains many internal controllers that watch for resources that users typically create like `Deployment`s,
and in response create resources like `ReplicaSet`s (and then in turn, the `Pod`s you wanted).
Suddenly, your nice policy that enforces that every resource must have a `metadata.my-company.com/owner` label is
impossible to enforce on every resource, because there's no way to tell the Kubernetes `ReplicaSet` controller to
add this label to resources it creates.

In my [my previous post]({{< ref "posts/opa-gatekeeper-gotcha/index" >}}) I suggested a few options for solving this
problem, but after some experimentation I've discovered a much better solution.
This solution uses the `managedFields` property that was introduced to Kubernetes standard metadata in Kubernetes
1.18 to determine whether a resource has been created by a user.

This solution is specifically designed for GitOps environments, where there is a single entity that ultimately
creates resources on behalf of users.
I _think_ you could use this in environments were developers create resources directly, but you'd need to adapt it
to have a much longer list of managed field owners that trigger the enforcement.

## Kubernetes `managedFields`

The trick to this post is that since Kubernetes 1.18, Kubernetes records which actor has changed a field on a resource.
https://kubernetes.io/blog/2020/04/01/kubernetes-1.18-feature-server-side-apply-beta-2/
As an example, a simple `ConfigMap` with managed fields might look like this:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: test-cm
  namespace: default
  labels:
    test-label: test
  managedFields:
    - manager: kubectl
      operation: Apply
      apiVersion: v1
      time: "2010-10-10T0:00:00Z"
      fieldsType: FieldsV1
      fieldsV1:
        f:metadata:
          f:labels:
            f:test-label: {}
        f:data:
          f:key: {}
data:
  key: some value
```

Note that as of modern versions of `kubectl`, you'll need to pass the `--show-managed-fields` flag, otherwise `kubectl`
won't show you the `managedFields` field of the resources you view.
People got upset that they had a bunch more noise in their `kubectl` outputs when this feature was added, so they put
it behind a flag.

What's nice about `managedFields` is that we can now determine who is responsible for setting values on a particular
Kubernetes object.
And if an entity who is capable of complying with the policy constraints we would like to enforce has set some of
those fields, then we can choose to enforce our policy constraint.
If the resource consists entirely of fields that are set by an entity that can't comply with these policy
constraints, such as a Kubernetes internal controller, then we can ignore the resource.

## Enforcing constraints on user-created resources using `managedFields`

The OPA required to make this work is fairly straightforward.

```rego
# Set this based on the user that creates resources on behalf of your users
user_manager := "some-user-manager"

has_user_managed_fields(managed_fields, user_manager_name) {
	some i
	managed_fields_entry := managed_fields[i]
	managed_fields_entry.manager == user_manager_name
}

violation[{"msg": msg, "details": {}}] {
	has_user_managed_fields(input.review.object.metadata.managedFields, user_manager)
	# Add any rules here that should only apply to user-created resources
	msg := sprintf("<some violation messae>")
}
```

The `has_user_managed_fields` rule will ensure that at least one of the managed fields entries has a manager that
matches whatever you define to be a manager that indicates that the resource was created by a user.
For example, if you're using ArgoCD as your GitOps tool, any resource created by ArgoCD on behalf of users will have
many of its fields managed by `argocd-controller`.
Resources like the default `ServiceAccount` or `ReplicaSet`s which are created on behalf of users by Kubernetes
internal controllers will not match the `has_user_managed_fields` rule, and so will be exempt from the constraint.

This has worked quite well for us across a few different constraints.
If you're using something that lets you easily share policy between constraints as libraries like
[Konstraint](https://github.com/plexsystems/konstraint), I'd suggest putting this functionality in a library that
you share around to your policies, because you'll likely end up writing it a lot for policies that are wide-ranging
like enforcing metadata across all resources.

Hopefully this helps you when designing your Gatekeeper policies!
