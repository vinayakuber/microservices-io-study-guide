# Chapter 10: Self-Registration

> A service instance registers itself with the service registry on startup, periodically renews its registration, and unregisters itself on shutdown.

_Also known as: Chris Richardson · Microservice Patterns Ch. 10 · microservices.io /patterns/self-registration.html_

## Flow

### The instance registers itself

> **Why this matters:** The instance is the best source of its own location, so it can register its host and IP itself and make itself discoverable.

1. **Register on startup** — The instance registers its host and IP address with the registry and makes itself available.

2. **Renew periodically** — The client typically renews its registration so the registry knows it is still alive.

3. **Unregister on shutdown** — The instance unregisters itself from the registry on shutdown.

4. **Chassis handles it** — This is typically handled by a **microservice chassis** framework.

```java
// SERVICE SIDE — the instance registers its own host and IP on startup and unregisters on shutdown
// PARTIES: SVC = order-service instance · REG = service registry
// DEF: self — the instance's own registration state = self_state "DOWN", flipped to "AVAILABLE" after it registers
// STATE (before):
//    registry : {"order-service" -> []}
//    self_state : "DOWN"
// DEF: the service boots · CALLED BY: SVC startup on host 10.0.1.7
// -> boot : {"host":"10.0.1.7","ip":"10.0.1.7","port":8080}
//    step 1 · SVC registers itself : registry["order-service"] : [] -> [{"host":"10.0.1.7","ip":"10.0.1.7","port":8080}]
//    step 2 · SVC marks itself available : self_state : "DOWN" -> "AVAILABLE"
//    step 3 · discovery reads the entry back : lookup "order-service" -> returns [{"host":"10.0.1.7","ip":"10.0.1.7","port":8080}]   BECAUSE the registry serves the row the instance wrote
// <- registry row : "order-service" -> [{"host":"10.0.1.7","ip":"10.0.1.7","port":8080}]   (now discoverable: written by SVC, read by discovery)
//    alt shutdown : SVC unregisters itself -> registry["order-service"] : [{"host":"10.0.1.7","ip":"10.0.1.7","port":8080}] -> []
```

### Renewal keeps the entry alive

> **Why this matters:** Because instances die without notice, a lease that must be renewed is what lets the registry tell alive from dead.

1. **Heartbeat timer** — The instance renews its registration before the lease expires.

2. **Registry stays fresh** — The registry keeps the entry alive for as long as renewals arrive.

3. **Crash detection** — If renewals stop, the registry drops the entry and stops routing to the dead instance.

4. **Eureka in the example** — The @EnableEurekaClient annotation registers the instance with the Eureka registry.

```java
// SERVICE SIDE — the instance periodically renews its registration so the registry knows it is still alive
// PARTIES: SVC = order-service instance · REG = service registry
// STATE (before):
//    registry : {"order-service" -> [{"host":"10.0.1.7","port":8080,"ttl":30}]}
//    renew_count : 0
// DEF: the lease approaches expiry · CALLED BY: SVC heartbeat timer every 30s
// -> renew : "heartbeat"   (sent before the ttl lapses)
//    step 1 · SVC renews : renew_count : 0 -> 1   BECAUSE the timer fired
//    step 2 · REG extends the entry : registry["order-service"] : [{"host":"10.0.1.7","port":8080,"ttl":30}] -> [{"host":"10.0.1.7","port":8080,"ttl":60}]
// <- registry row : "order-service" -> [{"host":"10.0.1.7","port":8080,"ttl":60}]   (the lease was pushed out)
//    alt missed renewal : no heartbeat arrives -> REG evicts the entry when ttl : 60 -> 0
```

### A richer state model, with a blind spot

> **Why this matters:** Self-registration gives a richer state model than UP/DOWN, but it fails exactly when an instance is too broken to notice it should leave.

1. **Knows its own state** — The instance can model more than UP/DOWN, such as STARTING or AVAILABLE.

2. **Steer traffic away** — The instance can rewrite its registry entry to reflect its current state.

3. **The blind spot** — A running but broken instance often cannot unregister itself.

4. **Still coupled** — Self-registration couples the service to the registry and is re-implemented per language.

```java
// SERVICE SIDE — self-registration knows its own state, but a broken instance often lacks the self-awareness to leave
// PARTIES: SVC = order-service instance · REG = service registry
// DEF: routed — the traffic the registry directs at this instance = traffic_routed "all", steered to "none" once it marks itself STARTING
// DEF: self — the instance's own modeled state = self_state "AVAILABLE" becoming "STARTING" on degradation
// DEF: traffic — the requests callers send to the instance = "all", steered to "none" while STARTING
// STATE (before):
//    registry : {"order-service" -> [{"host":"10.0.1.7","port":8080,"state":"AVAILABLE"}]}
//    self_state : "AVAILABLE"
//    traffic_routed : "all"
// DEF: the instance degrades internally · CALLED BY: a dependency that stops responding
// -> degrade : "dependency timeout"
//    step 1 · SVC models its own state : self_state : "AVAILABLE" -> "STARTING"   BECAUSE the instance knows a state model richer than UP/DOWN
//    step 2 · SVC rewrites its entry : registry["order-service"] : [{"host":"10.0.1.7","port":8080,"state":"AVAILABLE"}] -> [{"host":"10.0.1.7","port":8080,"state":"STARTING"}]
//    step 3 · traffic steered away : traffic_routed : "all" -> "none"   BECAUSE callers skip STARTING instances
// <- registry row : "order-service" -> [{"host":"10.0.1.7","port":8080,"state":"STARTING"}]
//    alt no self-awareness : SVC runs but cannot handle requests -> it never unregisters itself, the stale entry stays
```


## System Design Interview

> **The question:** Design service registration from the service itself. Premise: each service instance registers itself at startup and renews a heartbeat lease with the registry, so the registry reflects live instances.

**The pipeline:** service instance → self-registrar → service registry

### order-service instance — the service instance

_Role: service instance_

![order-service instance — the service instance](../diagrams/d2/decomp/ch10-0.png)

### self-registrar (in-process chassis code) — the registrar

_Role: self-registrar_

![self-registrar (in-process chassis code) — the registrar](../diagrams/d2/decomp/ch10-1.png)

### service registry (Eureka) — the registry

_Role: registry_

![service registry (Eureka) — the registry](../diagrams/d2/decomp/ch10-2.png)

```java
// SYSTEM DESIGN — self-registration as a pipeline: service instance -> self-registrar (startup register + heartbeat lease) -> service registry
// PARTIES: SVC = order-service instance (registers itself and renews) · REG = service registry (Eureka)
// DEF: registrar — the in-process code inside SVC that registers and renews; here it writes {"host":"10.0.1.7","port":8080}
// DEF: lease — the ttl the registry keeps an entry alive; here 30 pushed to 60 by a heartbeat
// DEF: state — the instance's own modeled state; here "AVAILABLE"
// STATE (before):
//    registry : {"order-service" -> []}
//    state    : "DOWN"
//    lease    : 0
// DEF: register_and_renew · CALLED BY: SVC booting on host 10.0.1.7
// -> boot : {"host":"10.0.1.7","port":8080}
//    step 1 · SVC registers itself    registry : {"order-service" -> []} -> {"order-service" -> [{"host":"10.0.1.7","port":8080}]}   BECAUSE the instance writes its own row at startup
//    step 2 · SVC marks itself available    state : "DOWN" -> "AVAILABLE"   BECAUSE the registrar flips the self-state after a successful register
//    step 3 · SVC renews the lease    lease : 0 -> 60   BECAUSE the heartbeat timer pushes the ttl out before it lapses
//    step 4 · discovery reads the row back    lookup "order-service" -> returns [{"host":"10.0.1.7","port":8080}]   BECAUSE the registry serves the row the instance wrote
// <- registry row : "order-service" -> [{"host":"10.0.1.7","port":8080}]   (written by SVC, read by discovery)
```

## Interview Questions

### Q1

An order-service instance boots at 10.0.3.7 and must become discoverable without any external process acting for it.

**Interviewer's question:** Who registers the instance in self-registration, and what does the instance record?

**Solution:** The service instance registers itself on startup, recording its own host and IP, and unregisters itself on shutdown — typically handled by a microservice chassis.

**System-design components:**
- Instance self-registration
- Host and IP address
- Microservice chassis

```java
// SERVICE SIDE — the instance registers its own host and IP on startup and unregisters on shutdown
// PARTIES: SVC = order-service instance · REG = service registry
// DEF: self — the instance's own registration state = self_state "DOWN", flipped to "AVAILABLE" after it registers
// STATE (before):
//    registry : {"order-service" -> []}
//    self_state : "DOWN"
// DEF: the service boots · CALLED BY: SVC startup on host 10.0.3.7
// -> boot : {"host":"10.0.3.7","ip":"10.0.3.7","port":8080}
//    step 1 · SVC registers itself : registry["order-service"] : [] -> [{"host":"10.0.3.7","ip":"10.0.3.7","port":8080}]
//    step 2 · SVC marks itself available : self_state : "DOWN" -> "AVAILABLE"
// <- registry row : "order-service" -> [{"host":"10.0.3.7","ip":"10.0.3.7","port":8080}]   (now discoverable)
//    alt shutdown : SVC unregisters itself -> registry["order-service"] : [{"host":"10.0.3.7","ip":"10.0.3.7","port":8080}] -> []
```

_This is exactly the instance-registers-itself mechanism in this chapter._

_Covers:_ The instance registers itself

_From the 28 problems:_ 01-scale-from-zero-to-millions

### Q2

An order-service instance has a lease on its registry entry, and its heartbeat timer must keep it alive before the lease lapses.

**Interviewer's question:** Why does self-registration require periodic renewal, and what happens when renewals stop?

**Solution:** The instance renews its registration so the registry knows it is still alive; if renewals stop, the registry drops the entry and stops routing to the dead instance.

**System-design components:**
- Heartbeat timer
- Lease (ttl)
- Registry eviction on missed renewal

```java
// SERVICE SIDE — the instance periodically renews its registration so the registry knows it is still alive
// PARTIES: SVC = order-service instance · REG = service registry
// STATE (before):
//    registry : {"order-service" -> [{"host":"10.0.3.7","port":8080,"ttl":45}]}
//    renew_count : 0
// DEF: the lease approaches expiry · CALLED BY: SVC heartbeat timer every 45s
// -> renew : "heartbeat"   (sent before the ttl lapses)
//    step 1 · SVC renews : renew_count : 0 -> 1   BECAUSE the timer fired
//    step 2 · REG extends the entry : registry["order-service"] : [{"host":"10.0.3.7","port":8080,"ttl":45}] -> [{"host":"10.0.3.7","port":8080,"ttl":90}]
// <- registry row : "order-service" -> [{"host":"10.0.3.7","port":8080,"ttl":90}]   (the lease was pushed out)
//    alt missed renewal : no heartbeat arrives -> REG evicts the entry when ttl : 90 -> 0
```

_This is exactly the renewal-keeps-the-entry-alive mechanism in this chapter._

_Covers:_ Renewal keeps the entry alive

_From the 28 problems:_ 01-scale-from-zero-to-millions

### Q3

An instance is starting up and wants to keep traffic away until it is truly ready — something a bare UP/DOWN flag cannot express.

**Interviewer's question:** What richer state model does self-registration enable, and how does it steer traffic?

**Solution:** Because the instance knows its own state, it can model more than UP/DOWN — such as STARTING or AVAILABLE — and rewrite its registry entry to steer traffic away.

**System-design components:**
- Richer state model (STARTING/AVAILABLE)
- Self-state rewrite
- Traffic steering

```java
// SERVICE SIDE — self-registration knows its own state: the instance walks STARTING to AVAILABLE, richer than UP/DOWN
// PARTIES: SVC = order-service instance · REG = service registry
// DEF: self — the instance's own modeled state = self_state "STARTING", becoming "AVAILABLE" once it is ready
// DEF: traffic — the requests callers send to the instance = "none" while STARTING, "all" once AVAILABLE
// STATE (before):
//    registry : {"order-service" -> [{"host":"10.0.3.7","port":8080,"state":"STARTING"}]}
//    self_state : "STARTING"
//    traffic_routed : "none"
// DEF: the instance finishes warming up · CALLED BY: SVC completing its startup sequence
// -> ready : "true"
//    step 1 · SVC models its own state : self_state : "STARTING" -> "AVAILABLE"   BECAUSE the instance knows a state model richer than UP/DOWN
//    step 2 · SVC rewrites its entry : registry["order-service"] : [{"host":"10.0.3.7","port":8080,"state":"STARTING"}] -> [{"host":"10.0.3.7","port":8080,"state":"AVAILABLE"}]
//    step 3 · traffic steered back : traffic_routed : "none" -> "all"   BECAUSE callers now accept AVAILABLE instances
// <- registry row : "order-service" -> [{"host":"10.0.3.7","port":8080,"state":"AVAILABLE"}]
//    alt degraded : SVC marks itself STARTING again -> traffic_routed : "all" -> "none" (steers traffic away)
```

_This is exactly the richer-state-model benefit of self-registration in this chapter._

_Covers:_ A richer state model, with a blind spot

_From the 28 problems:_ 01-scale-from-zero-to-millions

### Q4

The team's services are written in Java and Go, and both must register themselves with the same registry.

**Interviewer's question:** What is the blind spot of self-registration, and what does its coupling cost in a polyglot system?

**Solution:** A running-but-broken instance often lacks the self-awareness to unregister itself, and self-registration couples the service to the registry and must be re-implemented per language.

**System-design components:**
- Lack of self-awareness
- Coupling to the registry
- Per-language registration logic

```java
// SERVICE SIDE — self-registration couples the service to the registry and is re-implemented per language
// PARTIES: SVC = order-service instance · REG = service registry
// STATE (before):
//    registry : {"order-service" -> []}
//    languages : {"java":false, "go":false}
//    coupled : "false"
// DEF: the second service in Go must register too · CALLED BY: the Go order-service starting up
// -> language : "go"
//    step 1 · register in Java : languages["java"] : false -> true   BECAUSE the Java instance already implemented registration against REG
//    step 2 · re-implement in Go : languages["go"] : false -> true   BECAUSE discovery logic must be written per language/framework
//    step 3 · the service is coupled to the registry : coupled : "false" -> "true"   BECAUSE each service now calls REG directly
// <- cost : registration logic exists in 2 languages · both services coupled to the registry
//    alt broken instance : SVC runs but cannot handle requests -> it never unregisters itself, the stale entry stays
```

_This is exactly the lack-of-self-awareness and coupling drawbacks in this chapter._

_Covers:_ A richer state model, with a blind spot

_From the 28 problems:_ 01-scale-from-zero-to-millions

## Key Concepts

### The Problem

**The registry must know who is alive.** Instances must be registered on startup, unregistered on shutdown, and removed when they crash or can no longer handle requests.


### The Solution

On startup the instance registers its host and IP, periodically renews the registration, and unregisters on shutdown.

```java
// SERVICE SIDE — the instance registers its own host and IP on startup and unregisters on shutdown
// PARTIES: SVC = order-service instance · REG = service registry
// DEF: self — the instance's own registration state = self_state "DOWN", flipped to "AVAILABLE" after it registers
// STATE (before):
//    registry : {"order-service" -> []}
//    self_state : "DOWN"
// DEF: the service boots · CALLED BY: SVC startup on host 10.0.3.7
// -> boot : {"host":"10.0.3.7","ip":"10.0.3.7","port":8080}
//    step 1 · SVC registers itself : registry["order-service"] : [] -> [{"host":"10.0.3.7","ip":"10.0.3.7","port":8080}]
//    step 2 · SVC marks itself available : self_state : "DOWN" -> "AVAILABLE"
// <- registry row : "order-service" -> [{"host":"10.0.3.7","ip":"10.0.3.7","port":8080}]   (now discoverable)
//    alt shutdown : SVC unregisters itself -> registry["order-service"] : [{"host":"10.0.3.7","ip":"10.0.3.7","port":8080}] -> []
```


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| The instance registers itself | On startup the instance registers its host and IP, periodically renews the registration, and unregisters on shutdown. | A Spring Boot service annotated with @EnableEurekaClient registers itself with the Eureka registry. |
| A richer state model | Because the instance knows its own state, it can implement a state model richer than UP/DOWN, such as STARTING or AVAILABLE. | An instance can mark itself STARTING and steer traffic away before it is ready, something a superficial RUNNING/NOT RUNNING check cannot express. |
| Lacking self-awareness | An instance that is running but unable to handle requests often lacks the self-awareness to unregister itself. | A hung thread or exhausted pool leaves the process alive, so the instance stays registered and keeps receiving doomed requests. |


### Tradeoffs & When

- Because the instance knows its own state, it can implement a state model richer than UP/DOWN, such as STARTING or AVAILABLE.
- An instance that is running but unable to handle requests often lacks the self-awareness to unregister itself.


<details><summary>All concepts (index)</summary>

### Problem: The registry must know who is alive

**Why.** Discovery only works if the registry has an accurate, current list of instances, and that list changes every time an instance starts, stops, crashes, or degrades.

**Claim.** Instances must be registered on startup, unregistered on shutdown, and removed when they crash or can no longer handle requests.

**Grounding.** Richardson's three forces for registration apply to self-registration too: startup, shutdown, crash, and running-but-incapable instances.

**In the wild.** A stale entry means a client-side or server-side lookup can route a request to an instance that will never answer.
### Solution: The instance registers itself

**Why.** Nobody knows an instance's own host and IP better than the instance, so it can register those details directly.

**Claim.** On startup the instance registers its host and IP, periodically renews the registration, and unregisters on shutdown.

**Grounding.** Richardson's solution: the instance "registers itself (host and IP address)" and "must typically periodically renew its registration."

**In the wild.** A Spring Boot service annotated with @EnableEurekaClient registers itself with the Eureka registry.
### Tradeoff: A richer state model

**Why.** An instance that registers itself can express more about itself than a foreign observer can see from outside.

**Claim.** Because the instance knows its own state, it can implement a state model richer than UP/DOWN, such as STARTING or AVAILABLE.

**Grounding.** Richardson gives this as the benefit of self-registration over a third-party registrar.

**In the wild.** An instance can mark itself STARTING and steer traffic away before it is ready, something a superficial RUNNING/NOT RUNNING check cannot express.
### Tradeoff: Lacking self-awareness

**Why.** The same introspection that gives a rich state model fails exactly when the instance is unhealthy enough to need removing.

**Claim.** An instance that is running but unable to handle requests often lacks the self-awareness to unregister itself.

**Grounding.** Richardson lists this as a drawback, alongside coupling the service to the registry and re-implementing logic per language.

**In the wild.** A hung thread or exhausted pool leaves the process alive, so the instance stays registered and keeps receiving doomed requests.

</details>


## Quiz

1. In self-registration, who registers the instance with the registry?

   - A. A third-party registrar process
   - B. The service instance itself, on startup
   - C. The router that fronts the registry
   - D. The registry polls the network for instances

<details><summary>Reveal answer</summary>

**B.** The instance is responsible for registering itself, with its host and IP, on startup. A is the third-party alternative, C is server-side discovery, and D is not how registration works.

</details>

2. Why must the instance periodically renew its registration?

   - A. To change its IP address
   - B. So the registry knows it is still alive
   - C. To re-encode its hostname
   - D. To increment its port number

<details><summary>Reveal answer</summary>

**B.** The reference says the client must typically renew its registration so the registry knows it is still alive; a missed renewal means the entry is dropped. A, C, and D are not the purpose of renewal.

</details>

3. What benefit does self-registration offer?

   - A. It removes the need for a service registry
   - B. It lets the instance model its own state as more than UP/DOWN, such as STARTING or AVAILABLE
   - C. It avoids coupling the service to the registry
   - D. It requires no chassis framework

<details><summary>Reveal answer</summary>

**B.** Because the instance knows its own state, it can implement a richer state model than UP/DOWN. A is false (a registry is still required), C inverts the coupling drawback, and D is false because this is typically handled by a chassis.

</details>

4. What is a drawback of self-registration?

   - A. A running-but-broken instance often lacks the self-awareness to unregister itself
   - B. It is always handled by a separate sidecar
   - C. It cannot use Eureka
   - D. It requires a third-party registrar

<details><summary>Reveal answer</summary>

**A.** The reference lists the lack of self-awareness as a drawback, alongside coupling to the registry and per-language logic. B and D describe third-party registration, and C is false because the example uses Eureka.

</details>

