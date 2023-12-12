---
title: "A Deeper Dive of kube-scheduler"
date: 2023-12-11T20:15:26-08:00
draft: false
---

At OpenAI I have spent the last few months of my life developing a Kubernetes scheduler plugin to customize preemption to better suit our ML workloads. This has been the most challenging project in my career so far. There were countless times where I wanted to quit and just declare it was too difficult. The only reason I pursued was because I really wanted to know how the hell the scheduler worked.

Unfortunately getting a complete understanding of kube-scheduler was an untrodden path because there are no online resources explaining how it *actually works*. The scheduling framework [README](https://github.com/kubernetes/enhancements/blob/ffe2e24/keps/sig-scheduling/624-scheduling-framework/README.md)  provides a good outline but isn’t comprehensive. The scheduling framework is also a somewhat leaky abstraction so you really do need to know how the scheduler works internally if you want to write a non-trivial plugin. The scheduler codebase is incredibly complicated and the goal of this blog post is to shine a light on how everything fits together. I will mostly focus on explaining preemption because it’s both the most undocumented and most complex part of the scheduler. I hope this lowers the barrier of entry for future wanderers trying to create their own scheduling plugins.

## Misconceptions

 I’ve always naively assumed I knew how kube-scheduler worked under the hood because it was “just doing bin-packing”. I couldn’t have been more wrong and have since learned a lot by studying its inner workings. The Kubernetes scheduler is brilliantly designed in my opinion and an inspiring example of how effective good plugin frameworks can be.

## Prerequisite Knowledge

I’m assuming the reader is a seasoned Kubernetes user and understands how pod scheduling works from a user perspective. You can read [this](https://kubernetes.io/docs/concepts/scheduling-eviction/) to brush up on Kubernetes scheduling if needed. First let’s define some terms that maybe only experienced Kubernetes users have come across.

[Nominated Pod](https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/#user-exposed-information):

A nominated pod `p` is a pod which has just preempted some set of lower priority pod(s) `v`. After this preemption, `p` is re-queued to schedule once all pods in `v` terminate. A “nominated node” is the node on which the preemption took place. The scheduler will prefer to place `p` to it’s nominated node when possible but this is not guaranteed.

[PDB (Pod Disruption Budget)](https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/#poddisruptionbudget-is-supported-but-not-guaranteed):

A Kubernetes feature which lets you ask the scheduler to avoid preempting certain pods on a  best-effort basis. The PDB object has a label selector that is used to match a set of pods you hope to protect from preemption.

## Scheduling Framework Overview

A pod being scheduled goes through the following different stages of the scheduler [framework](https://github.com/kubernetes/enhancements/blob/ffe2e24e7c04a6b4a4b9102abfb36f365da7d322/keps/sig-scheduling/624-scheduling-framework/README.md#proposal).

{{< figure src="/scheduling_framework.png" alt="Kubernetes Scheduling Framework" width="100%">}}

The behavior of each stage can be modified by both custom and K8s native plugins. Also each stage (except for `Sort`) can have multiple registered plugins and the framework documentation provides clear semantics on how multiple plugins of the same stage interact with each other. All of my source code links will be for Kubernetes v1.28, but all the concepts and implementations mostly haven’t changed since the introduction of the scheduler framework in v1.19.

The pod `p` currently being scheduled enters the [scheduling cycle](https://github.com/kubernetes/enhancements/blob/ffe2e24e7c04a6b4a4b9102abfb36f365da7d322/keps/sig-scheduling/624-scheduling-framework/README.md#scheduling-cycle--binding-cycle) once it is popped off the scheduler’s pod queue. The queue is sorted by pod priority and you can learn more about how it works [here](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-scheduling/scheduler_queues.md). Each scheduling cycle runs serially pod-by-pod and attempts to assign the current pod to some node in the cluster. Below I’ll explain the minimal set of things you need to understand about the scheduling framework to grok how preemption works.

#### [CycleState Object](https://github.com/kubernetes/enhancements/blob/ffe2e24e7c04a6b4a4b9102abfb36f365da7d322/keps/sig-scheduling/624-scheduling-framework/README.md#cyclestate):

CycleState is just basically a thread safe key-value store. An empty CycleState object is [created](https://github.com/kubernetes/kubernetes/blob/2a23061f6c23b65a916956f2ede2371041944b15/pkg/scheduler/schedule_one.go#L102) at the start of every scheduling cycle to store arbitrary state needed in the current scheduling cycle. There is one shared CycleState object per scheduling cycle and plugins typically use it to store their internal state and as a communication channel between the multiple scheduling stages. The CycleState object [must implement](https://github.com/kubernetes/kubernetes/blob/89ab733760ac26f0c4c620f8c3d07103f02cefd2/pkg/scheduler/framework/cycle_state.go#L80-L82) a deep copy function and we’ll soon see this is needed to make preemption efficient and accurate.

#### [Filter Stage](https://github.com/kubernetes/enhancements/blob/ffe2e24e7c04a6b4a4b9102abfb36f365da7d322/keps/sig-scheduling/624-scheduling-framework/README.md#filter):

Each Filter plugin decides whether a specific pod should be able to schedule on a specific node. A pod can only be scheduled onto a “feasible” node, which is a node where the pod passes all Filter plugins. Each Filter plugin decides to accept or reject a specific node by running a custom function that takes the following data inputs:

1. A [node](https://github.com/kubernetes/kubernetes/blob/fd5c40611257c694d2338960976726344e2b45e5/pkg/scheduler/framework/types.go#L492-L532) object
2. A [pod](https://github.com/kubernetes/kubernetes/blob/fd5c40611257c694d2338960976726344e2b45e5/staging/src/k8s.io/api/core/v1/types.go#L4392-L4411) object
3. A [CycleState](https://github.com/kubernetes/kubernetes/blob/89ab733760ac26f0c4c620f8c3d07103f02cefd2/pkg/scheduler/framework/cycle_state.go#L42-L57) object

If there are no feasible nodes for the pod being currently scheduled then the scheduler will attempt preemption by running the PostFilter plugins.

#### [PreFilter Stage](https://github.com/kubernetes/enhancements/blob/ffe2e24e7c04a6b4a4b9102abfb36f365da7d322/keps/sig-scheduling/624-scheduling-framework/README.md#prefilter):

**Note: This is the most confusing stage of the scheduling framework. It is also key to truly understanding preemption.**

All PreFilter plugins are run once right before the Filter stage above. The main purpose of the PreFilter plugins is to initialize any custom state needed by a plugin and persist it to CycleState. This custom state is fetched by it’s corresponding Filter plugin and used to make scheduling decisions. This custom state can also be mutated during preemption as the scheduler searches for which pods it can legally preempt. You need to implement the [AddPod](https://github.com/kubernetes/kubernetes/blob/89ab733760ac26f0c4c620f8c3d07103f02cefd2/pkg/scheduler/framework/interface.go#L341-L343) and [RemovePod](https://github.com/kubernetes/kubernetes/blob/89ab733760ac26f0c4c620f8c3d07103f02cefd2/pkg/scheduler/framework/interface.go#L344-L346) PreFilter callbacks if your Filter plugin has any custom state has that depends on pod information. This ensures that preemption respects the restrictions imposed by your Filter plugins and won’t make a preemption decision that will lead to a violation of your constraints.

#### [PostFilter Stage](https://github.com/kubernetes/enhancements/blob/ffe2e24e7c04a6b4a4b9102abfb36f365da7d322/keps/sig-scheduling/624-scheduling-framework/README.md#postfilter):

PostFilter plugins run if the Filter stage fails. You can register [multiple](https://github.com/kubernetes/enhancements/blob/master/keps/sig-scheduling/624-scheduling-framework/README.md#postfilter) PostFilter plugins if you like and they will be executed in order of declaration. PostFilter plugins are typically used to implement preemption but you can in theory run whatever code you want. The preemption algorithm shipped in Kubernetes by default is implemented by the `DefaultPreemption` [PostFilter](https://github.com/kubernetes/kubernetes/blob/ad9b60e2c9ddb21e8b00cabbe27e639638a0ea88/pkg/scheduler/framework/plugins/defaultpreemption/default_preemption.go#L84-L105).

#### [Binding Cycle](https://github.com/kubernetes/enhancements/blob/ffe2e24e7c04a6b4a4b9102abfb36f365da7d322/keps/sig-scheduling/624-scheduling-framework/README.md#scheduling-cycle--binding-cycle):

A pod is sent for “binding” once the scheduler decides the pod should land on a specific node. Understanding the binding stages aren’t necessary for this blog post but one important thing to note is that all pod binding is [done asynchronously](https://github.com/kubernetes/enhancements/blob/ffe2e24e7c04a6b4a4b9102abfb36f365da7d322/keps/sig-scheduling/624-scheduling-framework/README.md#concurrency). This is done so the main scheduling loop isn’t blocked and enables higher scheduling throughput. The scheduler [starts assuming](https://github.com/kubernetes/kubernetes/blob/2a23061f6c23b65a916956f2ede2371041944b15/pkg/scheduler/schedule_one.go#L191-L196) the pod is already scheduled once a pod enters the binding cycle. If the pod binding fails later for whatever reason, the [Unreserve](https://github.com/kubernetes/enhancements/blob/ffe2e24e7c04a6b4a4b9102abfb36f365da7d322/keps/sig-scheduling/624-scheduling-framework/README.md#reserve) rollback hook will be called for all plugins so that each plugin can revert any optimistic updates to their custom state.

#### Eating Your Own Dogfood:

One of my favorite things about the kube-scheduler codebase is that every native scheduling feature is implemented using the framework above. Here are some examples:

1. Resource requests in Kubernetes work via the [Fit](https://github.com/kubernetes/kubernetes/blob/89ab733760ac26f0c4c620f8c3d07103f02cefd2/pkg/scheduler/framework/plugins/noderesources/fit.go) plugin which [implements](https://github.com/kubernetes/kubernetes/blob/89ab733760ac26f0c4c620f8c3d07103f02cefd2/pkg/scheduler/framework/plugins/noderesources/fit.go#L252-L255) a Filter plugin to exclude nodes that lack the pod’s requested resources
2. Taints and tolerations functionality comes from the [TaintToleration](https://github.com/kubernetes/kubernetes/blob/89ab733760ac26f0c4c620f8c3d07103f02cefd2/pkg/scheduler/framework/plugins/tainttoleration/taint_toleration.go) plugin which also uses a [Filter](https://github.com/kubernetes/kubernetes/blob/89ab733760ac26f0c4c620f8c3d07103f02cefd2/pkg/scheduler/framework/plugins/tainttoleration/taint_toleration.go#L63-L74) plugin to block scheduling pods without sufficient tolerations on tainted nodes
3. Standard pod preemption comes from the [DefaultPreemption](https://github.com/kubernetes/kubernetes/blob/89ab733760ac26f0c4c620f8c3d07103f02cefd2/pkg/scheduler/framework/plugins/defaultpreemption/default_preemption.go) plugin which is implemented using a [PostFilter](https://github.com/kubernetes/kubernetes/blob/89ab733760ac26f0c4c620f8c3d07103f02cefd2/pkg/scheduler/framework/plugins/defaultpreemption/default_preemption.go#L84-L105) plugin

## Deep Dive: Default Preemption

Pod preemption is by far the most complicated functionality in the scheduler because it ties together multiple scheduling stages in complex and undocumented ways. It’s important to clarify what default preemption is trying to accomplish before diving into the details.

> The goal of default preemption is to find the optimal set of victim pods located on the same node that need to be removed in order for a higher priority pod `p` to use that node. This minimal set of victims must also preferably not violate PDBs, have minimal pod priority, and also create minimal pod churn once evicted
> 

Deciding which pods to preempt can get complex because there can be scheduling co-dependencies between pods. For example if victim pod `server` has a [required pod-affinity](https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/#types-of-inter-pod-affinity-and-anti-affinity) with a colocated victim pod `database`, then default preemption should also remove `server` if it decides to remove `database` (but not vice versa!). Also remember that any custom plugin can introduce arbitrary scheduling dependencies like this. When performing preemption the scheduler must always honor all these scheduling dependencies, preempt the minimal set of pods, optimize for honoring PDBs, and also minimize the priority of preempted victims. So it’s no wonder this beast is so damn complicated 😅

How it all interplays together is really quite genius though. Below is a full code trace of every important step in the scheduling cycle when pod `p` performs a successful preemption. There are some complex behaviors which I’ve annotated with [1] and [2] to discuss separately for readability reasons. I’ll be assuming the `DefaultPreemption` is the only registered PostFilter plugin.

#### Preemption Control Flow

1. Scheduler pops pod `p` off the priority queue and begins the scheduling cycle
2. Scheduler [takes a snapshot](https://github.com/kubernetes/kubernetes/blob/2a23061f6c23b65a916956f2ede2371041944b15/pkg/scheduler/schedule_one.go#L391) of all the node objects and pod objects in cluster at the current instant in time
3. PreFilter stage:
    1. All PreFilter plugins are run and some may decide to persist their initial custom state into CycleState
    2. Any PreFilter plugin can also decide to fail and the entire scheduling cycle will be aborted for pod `p`
4. Filter stage:
    1. All Filter plugins are run [2] for `p` on each node in cluster [in parallel](https://github.com/kubernetes/kubernetes/blob/2a23061f6c23b65a916956f2ede2371041944b15/pkg/scheduler/schedule_one.go#L557-L593)  
    2. If all Filter plugins pass for a specific node then it will be considered feasible
5. `DefaultPreemption` [PostFilter](https://github.com/kubernetes/kubernetes/blob/ad9b60e2c9ddb21e8b00cabbe27e639638a0ea88/pkg/scheduler/framework/plugins/defaultpreemption/default_preemption.go#L84-L105) runs if there are no feasible nodes:
    1. First [findCandidates](https://github.com/kubernetes/kubernetes/blob/ec5096fa869b801d6eb1bf019819287ca61edc4d/pkg/scheduler/framework/preemption/preemption.go#L210-L212) searches for legal eviction candidates whose removal would allow preemptor `p` to schedule. Here is how the search works:
        1. Note: An “eviction candidate” is just [a set of victims pods located on the same node that](https://github.com/kubernetes/kubernetes/blob/ec5096fa869b801d6eb1bf019819287ca61edc4d/pkg/scheduler/framework/preemption/preemption.go#L45-L52), if removed, would allow `p` to schedule on that node
        2. [DryRunPreemption](https://github.com/kubernetes/kubernetes/blob/ec5096fa869b801d6eb1bf019819287ca61edc4d/pkg/scheduler/framework/preemption/preemption.go#L563-L568) searches to find all possible eviction candidates in the cluster. It does this by running [SelectVictimsOnNode](https://github.com/kubernetes/kubernetes/blob/ec5096fa869b801d6eb1bf019819287ca61edc4d/pkg/scheduler/framework/plugins/defaultpreemption/default_preemption.go#L138-L140) [1] on each node in cluster in parallel. Each parallel call is given it’s own separate copy of the node and CycleState objects
        3. Each call to [SelectVictimsOnNode](https://github.com/kubernetes/kubernetes/blob/ec5096fa869b801d6eb1bf019819287ca61edc4d/pkg/scheduler/framework/plugins/defaultpreemption/default_preemption.go#L138-L140) [1] returns an eviction candidate `C` if one exists for it’s specified node
    2. [SelectCandidate](https://github.com/kubernetes/kubernetes/blob/ec5096fa869b801d6eb1bf019819287ca61edc4d/pkg/scheduler/framework/preemption/preemption.go#L314-L316) picks the best eviction candidate `B` from the list returned by findCandidates
        1. Eviction candidates are selected according to [this](https://github.com/kubernetes/kubernetes/blob/ec5096fa869b801d6eb1bf019819287ca61edc4d/pkg/scheduler/framework/preemption/preemption.go#L438-L451) criteria which prefers evicting candidates that have less PDB violations, lower priority pods, etc
    3. [prepareCandidate](https://github.com/kubernetes/kubernetes/blob/ec5096fa869b801d6eb1bf019819287ca61edc4d/pkg/scheduler/framework/preemption/preemption.go#L345-L349) performs the actual preemption of `B`
        1. Deletes the victim pods belonging to `B` and cleans up nominations for victim pods if necessary
        2. Emits a Kubernetes `Preempted` event
6. The PostFilter plugin then [returns the nominated node](https://github.com/openai/kubernetes/blob/ec5096fa869b801d6eb1bf019819287ca61edc4d/pkg/scheduler/framework/interface.go#L734-L741) `nn` if there was a successful preemption
7. Scheduler [sets](https://github.com/kubernetes/kubernetes/blob/89ab733760ac26f0c4c620f8c3d07103f02cefd2/pkg/scheduler/schedule_one.go#L1002-L1007) `p`'s `.status.nominatedNodeName` field to `nn` and also [tracks](https://github.com/kubernetes/kubernetes/blob/2a23061f6c23b65a916956f2ede2371041944b15/pkg/scheduler/schedule_one.go#L1030-L1037) the nomination in the scheduler’s local cache
8. Pod `p` is re-queued since it can’t schedule until the preempted victims have terminated and released their resources

#### [1] Understanding [SelectVictimsOnNode](https://github.com/kubernetes/kubernetes/blob/ec5096fa869b801d6eb1bf019819287ca61edc4d/pkg/scheduler/framework/plugins/defaultpreemption/default_preemption.go#L138-L140)

This function searches for the best possible eviction that could happen on a specific node `n_i` that would allow `p` to schedule. The main thing to note here is that the node `n_i` and CycleState `s_i` objects passed to this function are deep copies so they be harmlessly modified. This allows the scheduler to run SelectVictimsOnNode for all nodes in parallel to search the entire cluster for what it can legally preempt. The following logic is used to determine the best possible eviction on the current node:

1. First all pods with lower priority than `p` [are removed](https://github.com/kubernetes/kubernetes/blob/ad9b60e2c9ddb21e8b00cabbe27e639638a0ea88/pkg/scheduler/framework/plugins/defaultpreemption/default_preemption.go#L166-L176) from the copied node `n_i`. All of these removed pods `v_j` are considered to be possible victims
    1. All PreFilter `RemovePod` callbacks are [invoked](https://github.com/kubernetes/kubernetes/blob/ad9b60e2c9ddb21e8b00cabbe27e639638a0ea88/pkg/scheduler/framework/plugins/defaultpreemption/default_preemption.go#L152) with (`v_j`, `n_i`) for *all scheduling plugins* (both custom and native). This alerts each plugin that a certain pod was removed and gives them a chance to update their custom state stored in the copy `s_i`
2. Then these removed pods are iterated through one-by-one and [attempted to be re-added back to the copied node](https://github.com/kubernetes/kubernetes/blob/89ab733760ac26f0c4c620f8c3d07103f02cefd2/pkg/scheduler/framework/plugins/defaultpreemption/default_preemption.go#L199-L214) `n_i`
    1. Pods protected by PDBs are [attempted](https://github.com/kubernetes/kubernetes/blob/34e620d18c036acf035cb42c6f445dd568f60303/pkg/scheduler/framework/plugins/defaultpreemption/default_preemption.go#L216-L222) to be restored first. Then pods with higher priorities are [attempted](https://github.com/kubernetes/kubernetes/blob/34e620d18c036acf035cb42c6f445dd568f60303/pkg/scheduler/framework/plugins/defaultpreemption/default_preemption.go#L224-L228) to be restored
    2. When trying to restore each single victim pod `v_j` the scheduler will:
        1. Re-run all PreFilter `AddPod` callbacks with (`v_j`, `n_i`) for *all scheduling plugins* (both custom and native). This alerts each plugin that a new pod was added and gives the plugins a chance to update their custom state stored in the copy `s_i`
        2. Then all Filter plugins [2] are run with (`p`, `n_i`, `s_i`) as inputs. If they all pass, then the attempt to restore `v_j` succeeded because we’ve confirmed that `p` can schedule on the node even while `v_j` is present
        3. If `v_j` has been successfully restored (or “reprieved” in kube-scheduler parlance), it will not be included in the eviction candidate `C` returned by SelectVictimsOnNode
3. All the pods that were initially removed but failed to be restored are returned as victims in eviction candidate `C`

#### [2] Reducing Pod Churn

You almost have the full explanation of how preemption works now except there is one essential detail missing. Whenever I mentioning running all Filter plugins above (annotated with `[2]`), the scheduler will actually trick all the Filter plugin implementations into thinking that nominated pods on that node are already scheduled. This might not surprise you yet because the function to run all Filter plugins is named `RunFilterPluginsWithNominatedPods`. The sneaky thing is that the scheduler will only only secretly add [nominated pods which have a priority ≥ to](https://github.com/kubernetes/kubernetes/blob/246d363ea4bab2ac99a938d0cee73d72fc44de45/pkg/scheduler/framework/runtime/framework.go#L974) `p`'s priority.

Recall that nominated pods are re-queued to schedule and haven’t entered the binding cycle yet. So without this hidden reservation system, most nominated pods would experience repeated churn because any pod ahead in the queue could steal their spot once their victim pods finish terminating. Using `p`'s priority to decide which nominated pods to reserve space for reduces pod churn because it prevents `p` from scheduling now and then getting later preempted by a higher priority nominated pod. This optimization is an example of an efficiency win that also creates a leaky abstraction. This reservation system will silently break if the developer wants to implement a custom preemption algorithm which doesn’t always preempt according to priority.

If all Filter plugins pass with nominated pods added, there is actually one more thing to verify before the node is considered feasible. Let’s imagine that we’re running a website and our `server` pod needs to be co-located with a `database` pod in order to serve traffic and we ensure this via a required inter-pod affinity. Because the scheduler lies to the Filter plugins that all nominated pods are scheduled, the inter-pod affinity Filter plugin would happily approve the scheduling of pod `server` onto `database`’s nominated node. Recall though that nominated pods like `database` aren’t guaranteed to schedule on their nominated nodes. So we can’t just allow the `server` pod schedule onto this nominated node now and send it for binding because it could lead to a violation of a required inter-pod affinity. This is why the scheduler additionally [re-runs all Filter plugins](https://github.com/kubernetes/kubernetes/blob/246d363ea4bab2ac99a938d0cee73d72fc44de45/pkg/scheduler/framework/runtime/framework.go#L936-L953) without nominated pods and makes sure they all pass. This ensures that a node’s nominated pods aren’t actually strictly needed to legally schedule `p` on that node.

## Additional Benefits of Snapshotting

There are additional benefits to taking a snapshot of all pods and nodes at the start of each scheduling cycle which I haven’t discussed yet. Using a snapshot in the scheduling cycle also:

1. Ensures that all plugins see and act based on the same cluster state
2. Minimizes etcd load
3. Improves both scheduling throughput and latency
4. Gives the scheduler an avenue to implement certain optimizations. For example, all plugins are tricked into thinking that pods undergoing binding are actually scheduled because the scheduler lies about this via the snapshot

## Key Takeaways

I feel that working in the scheduler codebase has made me a better programmer. Here are some key lessons that I’ve personally internalized after spending (too) much time in this codebase.

##### 1) Embrace Reading Source Code

All the existing kube-scheduler documentation and “deep dive” articles online provide nowhere near the level of detail needed to write a scheduling plugin. You just have to accept that you’ll often need to read the code directly if you want to work on new or fringe projects. Most of my learning came from reading the [scheduler-plugins](https://github.com/kubernetes-sigs/scheduler-plugins) and kube-scheduler source code.

##### 2) Lean into the OSS Community

The Kubernetes community is full of amazingly helpful and knowledgable people. When I was struggling to understand the scheduling of nominated pods, I reached out to [Wei](https://github.com/Huang-Wei) and within hours I was unblocked. I’m still surprised by how willing maintainers are to assist random people on the internet. I recommend joining the Kubernetes Slack workspace if you’re stuck on something or have a very specific question.

##### 3) Well Designed Frameworks Are Extremely Powerful

I’m still amazed at how general, extensible, and powerful the scheduling plugin framework is. Every Kubernetes scheduling feature is still implemented using this framework that is almost 10 releases old! Allowing developers to build on the same framework opens up endless possibilities for customization without needing to fork the scheduler. The scheduling plugin framework has inspired me to spend more time searching for the right core abstractions when designing my own frameworks.

##### 4) Snapshots Are Clutch

Before working on the scheduling plugin, I hardly thought about using snapshotting and viewed it as a technique reserved for complex tasks like say implementing [MVCC](https://en.wikipedia.org/wiki/Multiversion_concurrency_control). I’ve now started using snapshotting more in other systems I work on and I love it. I view it as an opportunity to simultaneously introduce consistency and improve performance. It’s not a silver bullet though obviously because not all systems can accept the tradeoff of stale data that comes with snapshotting.

## More Scheduling Resources

1. See the Pod Preemption [design proposal](https://github.com/kubernetes/design-proposals-archive/blob/main/scheduling/pod-preemption.md) to see why certain scheduling design decisions were made
2. See the [Scheduler Queueing](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-scheduling/scheduler_queues.md) design doc to learn more about how the scheduler queue works
3. Visit [scheduler-plugins](https://github.com/kubernetes-sigs/scheduler-plugins) to see what OSS scheduler plugins exist and how they’re implemented. Ideally you use one of these plugins instead of building your own because writing your own plugin is hard!
4. Check out [kube-scheduler-simulator](https://github.com/kubernetes-sigs/kube-scheduler-simulator) for an interactive visualization of the scheduler’s decisions. You can bring your own custom scheduler and watch it in action
5. Use [kwok](https://kwok.sigs.k8s.io/) to stress test and e2e test your scheduler plugin without actually running kubelet. You can similarly test other parts of the control plane like CRDs, controllers, etc. without needing any physical hardware
    1. For example, you can use kwok to create fake nodes with GPUs and see what the scheduler would do
    2. I like to deploy kwok into [k3d](https://k3d.io/v5.6.0/) because k3d can also run real pods. This is useful if your pod scheduling depends on other pods running in-cluster (e.g. a pod webhook)
6. Check out the #wg-batch and #sig-scheduling Kubernetes Slack channels. I check both these channels daily now and ask tons of questions there. The folks there are very responsive and knowledgable

## Thanks

1. [Andrew Cann,](https://www.linkedin.com/in/andrew-cann/) [Ben Chess](https://www.linkedin.com/in/ben-chess-69bba21/), [Christian Gibson](https://www.linkedin.com/in/christianjgibson/), and [Wei Huang](https://github.com/Huang-Wei) providing feedback on this post
2. [Wei Huang](https://github.com/Huang-Wei) for helping me navigate the kube-scheduler codebase

