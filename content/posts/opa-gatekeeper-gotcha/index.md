---
title: "Opa Gatekeeper Gotcha"
date: 2022-09-26T23:34:09Z
draft: true
---

A fun little gotcha with OPA Gatekeeper.

You want to define e.g. all resources in this namespace must have the following labels, so that it's easy to 
identify information about them.
So you use Gatekeeper and the Gatekeeper library to enforce this

<show example of a naive constraint, that has the resources it applies to set to *>

Cool, you deploy your first deployment workload, and it doesn't work.

```yaml
status:
  conditions:
    - lastTransitionTime: '2022-09-26T23:21:51Z'
      message: >-
        pods "httpbin-78f658c47f-" is forbidden: error looking up service
        account tenant-automat-reference-app/default: serviceaccount "default"
        not found
      reason: FailedCreate
      status: 'True'
      type: ReplicaFailure
```

Huh? That's weird.

<Explain default service accounts here>

(Redact the namespace info)

```
$ kubectl get serviceaccounts -n tenant-automat-reference-app`
No resources found in tenant-automat-reference-app namespace.
```

Even stranger.

<Link to docs about the controller creating the default SA for you>

Turns out, we overlooked something important in our mandatory labels constraint.

Log from control plane:

```
E0926 22:53:47.849664      14 serviceaccounts_controller.go:180] tenant-automat-reference-app failed with : admission webhook "validation.gatekeeper.sh" denied the request: [resources-must-have-valid-owners] you must provide an owner label
[resources-must-have-a-repo] you must provide annotation(s): {"repository"}
```

Solution is to allowlist resources like this that are created automatically for you by Kubernetes.
In some cases, labels will flow down. 
This is why the `ReplicaSet` and `Endpoints` can be created for you.
But the `ServiceAccount` behaves differently.

Or just set up your own default `ServiceAccount`.