---
title: "An OPA Gatekeeper gotcha when enforcing policy on all resource kinds"
date: 2022-10-02T06:52:09Z
draft: false 
summary: "Documenting and providing potential solutions for a beginner OPA Gatekeeper gotcha that I ran into recently"
image: "gate.jpg"
---

{{< figure src="gate.jpg" caption="Photo by [Jose Fontano](https://unsplash.com/@josenothose?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText) on [Unsplash](https://unsplash.com/s/photos/closed-gate?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText)" alt="A close up of a gate that is locked closed by a padlock and some chain" >}}

**EDIT 2023-07-02**: After some thinking time, I've found a better solution to this problem.
Read about it in my newer article on [OPA user-created resources]({{< ref "posts/opa-user-created-resources/index" >}})

At [work](https://www.seek.com.au/work-for-seek/) we're beginning to roll out [OPA Gatekeeper](https://open-policy-agent.github.io/gatekeeper/website/docs/)
in our Kubernetes clusters to enforce policy on the resources that are deployed there.
As part of some early forays into enforcing policy, I ran in to this frustrating 'gotcha' that I figured was worth 
documenting.

A common use case for OPA Gatekeeper is to enforce that resources have particular metadata.
This helps to ensure that, for example, it's easy to tell who owns a particular Kubernetes resource, by enforcing 
that all resources have a label called `owner`.

This particular use case of enforcing the presence of labels is so common, that the open source [OPA Gatekeeper Library](https://github.com/open-policy-agent/gatekeeper-library)
contains [a constraint template that does just that](https://github.com/open-policy-agent/gatekeeper-library/tree/master/library/general/requiredlabels).

Using this policy is fairly straightforward.
Once the `ConstraintTemplate` resource is installed in to your Kubernetes cluster running Gatkeeper, you can create 
a resource like this:

```yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: must-have-owner-label
spec:
  match:
    kinds:
      - apiGroups: ['']
        kinds: ['*']
  parameters:
    message: |
      All resources must have an owner label.
    labels:
      - key: 'owner'
```

This above constraint enforces that all resources have a label called `owner`.
Simple, right?
What could possibly go wrong...

Unfortunately, the above constraint will cause you a number of issues, which I'll outline below.

## The first issue you will run in to

The first issue you will encounter will happen when you try and deploy some sort of workload, say, a `Deployment`.
If you're anything like me, you'll want to validate that this works by deploying a simple `Deployment`, maybe 
something like:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: httpbin
  namespace: my-namespace
  labels:
    owner: nik
spec:
  replicas: 1
  selector:
    matchLabels:
      app: httpbin
      owner: nik
  template:
    metadata:
      labels:
        app: httpbin
        owner: nik
    spec:
      containers:
        - image: docker.io/kennethreitz/httpbin
          imagePullPolicy: IfNotPresent
          name: httpbin
          ports:
            - containerPort: 80
```

But you'll need a `Namespace` to deploy this to, so let's create that as well:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: my-namespace
  labels:
    owner: nik
```

With the constraint as written above, OPA Gatekeeper will enforce our `owner` label constraint on non-namespaced 
resources as well.
But that's ok, because we included the `owner` label on the namespace.

Seems like it should work, right?

If you create your namespace and then try to create your deployment, it will succeed, but your `Deployment` will soon
take on the following status:

```yaml
...
status:
  conditions:
    - lastTransitionTime: '2022-09-26T23:21:51Z'
      message: >-
        pods "httpbin-78f658c47f-" is forbidden: error looking up service
        account my-namespace/default: serviceaccount "default"
        not found
      reason: FailedCreate
      status: 'True'
      type: ReplicaFailure
...
```

Huh?
That's a weird one.
I've never seen that error before.

If you're new to Kubernetes, you might not know that if you don't specify a `serviceAccount` for a pod, your pod 
will be assigned to the default service account for a namespace, which is called `default`.
In this case, we didn't specify a service account as part of our pod template, so we get the `default` service account.
But our error message is saying that there is no `default` service account in the namespace we created.
How does the `default` service account get there in the first place?

Well, the [Kubernetes docs on service account administration](https://kubernetes.io/docs/reference/access-authn-authz/service-accounts-admin/#serviceaccount-controller)
have this to say:

> A ServiceAccount controller manages the ServiceAccounts inside namespaces, and ensures a ServiceAccount named
> "default" exists in every active namespace.

Ok, so our `default` service account should definitely exist.

When you're told a resource doesn't exist in a permissioned environment like Kubernetes, it's always a good idea to 
just double check that the resource actually doesn't exist using some sort of privileged user.
This helps you rule out a situation where something just has insufficient permissions to know that there really _is_ 
a service account in that namespace called `default`.

As a privileged user:

```sh
$ kubectl get serviceaccounts -n my-namespace
No resources found in tenant-automat-reference-app namespace.
```

Ok, so there is definitely no service account in our namespace, despite the fact that the docs tell us there should be.
What's going on?

As it turns out, we overlooked something important in our mandatory labels constraint.
The key to debugging this issue was to have a look at the control plane logs.
The docs above tell us that it's the job of the 'ServiceAccount controller' to ensure that the `default` service 
account exists, so perhaps something went wrong while it was trying to create the service account?
That's exactly what we find:

```sh
E0926 22:53:47.849664      14 serviceaccounts_controller.go:180] my-namespace failed with : admission webhook 
"validation.gatekeeper.sh" denied the request: [must-have-owner-label] All resources must have an owner label.
```

That explains things.
The service account controller tried to create the `default` service account.
But since it has no way of knowing that we now enforce that every resource must have an `owner` label, the 
Gatekeeper validating admission webhook denies its request to create the `default` service account.

## The second issue you will run in to

Even if you manage to get around this first issue, for example, by excluding `ServiceAccount` resources from the 
resources that Gatekeeper cares about, you're not out of the woods quite yet.
You will run in to exactly the same issue when you create a `Service` resource that selects your pods.

This is because backing a `Service` resource is an `Endpoint` resource that is also created for you by the endpoint 
controller.
And this controller too does not know about our requirement that every resource must have an `onwer` label.
So you will get a cryptic message saying that your pod 'could not bind to an endpoint'.

If you again look at the control plane logs, you will find:

```sh
I0927 00:03:23.031559      14 event.go:291] "Event occurred" object="httpbin" kind="Endpoints" apiVersion="v1"
type="Warning" reason="FailedToCreateEndpoint" message="Failed to create endpoint for service my-namespace/httpbin: 
admission webhook \"validation.gatekeeper.sh\" denied the request: [must-have-owner-label] All resources must have an
owner label.
```

## Solutions

This is a bit of an annoying issue.
What options are available to you?

### Option 1

Set up your constraint resource to not include resources like `Endpoint` and `ServiceAccount`.

However this comes with a serious drawback: you can no-longer use a wildcard to say 'apply to every resource' as we 
did in our constraint above.
This is because Gatekeeper lacks an option to exclude resources from a constraint, it can only include.
So the effect is that you will have to list every resource that your constraint applies to.

This solution is viable, but not particularly nice.
Whenever you install a new kind of resource in to your cluster, you'll need to update this constraint to include 
that resource if you want to enforce an ownership label.
And if you have other similar universally-enforced constraints, you'll have to update those too.
There may be ways to DRY this list of 'resources that you can safely enforce policies on', but it's a bit of a pain 
to have to update it when you install new resources.
You could also automate the generation of this list, but again, it seems like a lot of hassle.

It's also not entirely clear to me which resources should be on this list, leading me to believe that you'd have to 
construct the list by trial and error.
For example, in the above exercise, the `ReplicaSet` resource is created just fine, because it seems to inherit the 
labels of the parent `Deployment` resource.

### Option 2

Update your `ConstraintTemplate` to allow excluding resources.

Unfortunately, the only other viable option I've found to solve this problem is to deviate from the open source 
required labels constraint template, and add your own custom rules around how to enforce this constraint.

This would mean adding some fields to the `spec` of the `ConstraintTemplate`.
Perhaps an `exemptKinds` field that accepts a list of `kind`s to ignore.
Or if necessary, an `exemptResources` field that allows for defining more complex combinations of exempt kinds, 
exemptions by name, namespace or API group.

Although this would require some custom Rego, it shouldn't be too hard to create.
The cost here is that you're deviating from the open source required labels constraint template.
However given that the constraint template is only around 30 lines of Rego, you're not losing out on my by defining 
your own constraint template.

## Conclusion

Hopefully this post serves as some documentation of this frustrating beginner gotcha, as I couldn't find anyone else 
having the same issue.
If you're interested in more content on OPA, Rego and Gatekeeper, please reach out and let me know!