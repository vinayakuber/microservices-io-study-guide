# Chapter 35: Health Check API

> A service exposes a health check endpoint that a monitoring service, registry, or load balancer periodically calls to detect whether an instance can handle requests.

_Also known as: Chris Richardson · Microservice Patterns Ch. 35 · microservices.io /patterns/observability/health-check-api.html_

## Flow

### Expose a health check endpoint

> **Why this matters:** A service instance can be running yet unable to handle requests; without an endpoint that reports its health, nothing outside the instance can tell the difference. Exposing /health is the entry point for both alerting and routing.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s0n0["<b>1. Add the endpoint</b><br/>The service exposes a health check API endpoint such as HTTP /health."]:::start
  s0n1["<b>2. Return the health</b><br/>The endpoint returns the health of the service as its result."]:::step
  s0n2["<b>3. Run it on every poll</b><br/>A health check client invokes the endpoint to check the health of t…"]:::stop
  s0n0 --> s0n1
  s0n1 --> s0n2
```

1. **Add the endpoint** — The service exposes a health check API endpoint such as HTTP /health.

2. **Return the health** — The endpoint returns the health of the service as its result.

3. **Run it on every poll** — A health check client invokes the endpoint to check the health of the instance.

```java
// ORDER SERVICE SIDE — the /health handler reports whether its database dependency is up
// PARTIES: SVC = Order Service instance · DB = its database · MON = monitoring service
// STATE (before):
//    health : { db:"UNKNOWN", status:null }
// DEF: health_check · CALLED BY: MON polling GET /health every 30 s
// -> req : "GET /health"
//    step 1 · probe the DB connection pool -> open   // health.db : "UNKNOWN" -> "UP"
//    step 2 · combine all checks into one verdict   // health.status : null -> "UP"
//    step 3 · respond with the verdict as the body   // body : {} -> {"status":"UP"}
// <- health : {"db":"UP", "status":"UP"} · MON now marks the instance healthy
//    alt DB pool exhausted : probe -> closed, health.db : "UNKNOWN" -> "DOWN", status : null -> "DOWN", body : {"status":"DOWN"}
```

### Check the things that can fail

> **Why this matters:** Health is not a boolean the process knows on its own; it is the result of probing real dependencies. A handler that checks connections, the host, and application logic can actually detect the running-but-broken state.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s1n0["<b>1. Check infrastructure connections</b><br/>The handler checks the status of the connections to the infrastruct…"]:::start
  s1n1["<b>2. Check the host</b><br/>The handler checks the status of the host, such as disk space."]:::step
  s1n2["<b>3. Run application-specific logic</b><br/>The handler runs application-specific checks on top of the generic…"]:::stop
  s1n0 --> s1n1
  s1n1 --> s1n2
```

1. **Check infrastructure connections** — The handler checks the status of the connections to the infrastructure services the instance uses.

2. **Check the host** — The handler checks the status of the host, such as disk space.

3. **Run application-specific logic** — The handler runs application-specific checks on top of the generic ones.

```java
// ORDER SERVICE SIDE — one handler runs three checks: infra connections, host disk, app logic
// PARTIES: SVC = Order Service instance · DB = its database · HOST = the machine it runs on
// STATE (before):
//    checks : { db:"UNKNOWN", disk:"UNKNOWN", app:"UNKNOWN" }
// DEF: run_checks · CALLED BY: the /health handler on each poll
// -> poll : 1 incoming GET /health
//    step 1 · check the status of connections to infrastructure services -> open   // checks.db : "UNKNOWN" -> "UP"
//    step 2 · check the host's disk space -> 12 free, above the 1 floor   // checks.disk : "UNKNOWN" -> "UP"
//    step 3 · run application-specific logic -> passes   // checks.app : "UNKNOWN" -> "UP"
// <- result : checks = {"db":"UP","disk":"UP","app":"UP"} · healthy only if all 3 are UP
//    alt one check fails : checks.db : "UP" -> "DOWN" -> the whole instance reports DOWN
```

### Invoke it periodically

> **Why this matters:** A single health check is a snapshot; failures happen between snapshots. A client that polls on a fixed interval catches transitions from healthy to unhealthy over time.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s2n0["<b>1. Choose a client</b><br/>A monitoring service, service registry, or load balancer acts as th…"]:::start
  s2n1["<b>2. Poll on an interval</b><br/>The client periodically invokes the endpoint on each instance."]:::step
  s2n2["<b>3. Compare with the previous result</b><br/>The client notices when an instance flips from UP to DOWN."]:::stop
  s2n0 --> s2n1
  s2n1 --> s2n2
```

1. **Choose a client** — A monitoring service, service registry, or load balancer acts as the health check client.

2. **Poll on an interval** — The client periodically invokes the endpoint on each instance.

3. **Compare with the previous result** — The client notices when an instance flips from UP to DOWN.

```java
// MONITORING SERVICE SIDE — a health-check client polls every instance on a fixed interval
// PARTIES: MON = monitoring service · SVC1 = instance 1 · SVC2 = instance 2
// STATE (before):
//    seen : { "SVC1":"UP", "SVC2":"UP" }        // health recorded on the last tick
// DEF: poll_loop · CALLED BY: MON's scheduler, every 30 s
// -> tick : 2
//    step 1 · GET /health on SVC1 -> "UP"   // seen["SVC1"] : "UP" -> "UP" (no change)
//    step 2 · GET /health on SVC2 -> "DOWN"   // seen["SVC2"] : "UP" -> "DOWN"
//    step 3 · count the healthy instances   // healthy : 2 -> 1   BECAUSE SVC2 flipped to DOWN
// <- observation : seen = {"SVC1":"UP","SVC2":"DOWN"} · MON raises an alert and SVC2 is pulled from routing
//    alt both UP this tick : healthy : 1 -> 2 -> no alert, routing unchanged
```

### Route and alert on the result

> **Why this matters:** The value of a health check is what you do with the answer: keep traffic off broken instances and wake a human. Routing and alerting are the two actions that consume the endpoint's verdict.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s3n0["<b>1. Stop routing to failed instances</b><br/>The load balancer or service registry does not route requests to a…"]:::start
  s3n1["<b>2. Generate an alert</b><br/>The monitoring system generates an alert when a service instance fa…"]:::step
  s3n2["<b>3. Recover into the pool</b><br/>When the instance reports healthy again, it returns to routing."]:::stop
  s3n0 --> s3n1
  s3n1 --> s3n2
```

1. **Stop routing to failed instances** — The load balancer or service registry does not route requests to a failed instance.

2. **Generate an alert** — The monitoring system generates an alert when a service instance fails.

3. **Recover into the pool** — When the instance reports healthy again, it returns to routing.

```java
// LOAD BALANCER SIDE — routing drops the failed instance and monitoring raises an alert
// PARTIES: LB = load balancer · REG = service registry · SVC1 = healthy instance · SVC2 = failed instance
// STATE (before):
//    pool : { "SVC1":"UP", "SVC2":"DOWN" }       // the routing pool with per-instance health
// DEF: route_and_alert · CALLED BY: LB after a health check reports SVC2 DOWN
// -> health : "SVC2 DOWN"
//    step 1 · LB removes SVC2 from its routing table   // pool : {"SVC1":"UP","SVC2":"DOWN"} -> {"SVC1":"UP"}
//    step 2 · the next request is routed only to a working instance   // target : null -> "SVC1"
//    step 3 · REG drops SVC2 and MON raises an alert   // alert : null -> "SVC2 DOWN at tick 2"
// <- outcome : pool = {"SVC1":"UP"} · requests route only to working instances, and an alert is generated
//    alt SVC2 recovers : health "SVC2 UP" -> pool : {"SVC1":"UP"} -> {"SVC1":"UP","SVC2":"UP"}
```


## Key Concepts

### The Problem

**Running but unable to serve.** Being alive is not the same as being healthy, so a process check alone is not enough to detect the failure.


### The Solution

A service has a health check API endpoint such as HTTP /health that returns the health of the service.


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| Health check API endpoint | A service has a health check API endpoint such as HTTP /health that returns the health of the service. | Spring Boot Actuator provides a /health endpoint customized through HealthIndicator beans whose health() method returns a Health value. |
| May miss a failure | The health check might not be sufficiently comprehensive, or the instance might fail between health checks. | A load balancer can send traffic to an instance that was healthy one second ago and is broken now. |
| One endpoint, three consumers | A health check client can be a monitoring service, a service registry, or a load balancer, each acting on the answer differently. | A monitoring service raises an alert, a service registry drops the instance, and a load balancer stops routing to it. |


### Tradeoffs & When

- The health check might not be sufficiently comprehensive, or the instance might fail between health checks.
- A health check client can be a monitoring service, a service registry, or a load balancer, each acting on the answer differently.


<details><summary>All concepts (index)</summary>

### Problem: Running but unable to serve

**Why.** A service instance can be incapable of handling requests yet still be running, for example when it has run out of database connections.

**Claim.** Being alive is not the same as being healthy, so a process check alone is not enough to detect the failure.

**Grounding.** The pattern exists to answer how to detect that a running service instance is unable to handle requests.

**In the wild.** When this state is missed, a monitoring system fails to alert and a load balancer keeps routing to the broken instance.
### Solution: Health check API endpoint

**Why.** The instance itself must report whether it can serve, via something a client can poll.

**Claim.** A service has a health check API endpoint such as HTTP /health that returns the health of the service.

**Grounding.** The handler checks infrastructure connections, host status such as disk space, and application-specific logic; a client periodically invokes the endpoint.

**In the wild.** Spring Boot Actuator provides a /health endpoint customized through HealthIndicator beans whose health() method returns a Health value.
### Tradeoff: May miss a failure

**Why.** A health check is a point-in-time sample, not a guarantee.

**Claim.** The health check might not be sufficiently comprehensive, or the instance might fail between health checks.

**Grounding.** The reference lists this as the drawback: requests might still be routed to a failed service instance.

**In the wild.** A load balancer can send traffic to an instance that was healthy one second ago and is broken now.
### Tradeoff: One endpoint, three consumers

**Why.** The same /health answer drives different decisions in different systems.

**Claim.** A health check client can be a monitoring service, a service registry, or a load balancer, each acting on the answer differently.

**Grounding.** The reference names all three as the client that periodically invokes the endpoint.

**In the wild.** A monitoring service raises an alert, a service registry drops the instance, and a load balancer stops routing to it.

</details>


## Quiz

1. What problem does the Health Check API pattern address?

   - A. A service instance can be running yet unable to handle requests
   - B. Services crash too often at startup
   - C. Databases are too slow to query
   - D. Load balancers are too expensive

<details><summary>Reveal answer</summary>

**A.** The context is a service instance that is still running but incapable of handling requests, for example because it ran out of database connections. B, C, and D are not the problem described.

</details>

2. Which checks does the /health handler perform?

   - A. Only CPU temperature and fan speed
   - B. Connections to infrastructure services, host status such as disk space, and application-specific logic
   - C. Only the number of open database connections
   - D. Only memory usage

<details><summary>Reveal answer</summary>

**B.** The reference lists the status of connections to infrastructure services, the status of the host such as disk space, and application-specific logic. A, C, and D are too narrow or not in the reference.

</details>

3. Who periodically invokes the health check endpoint?

   - A. The end user of the application
   - B. A health check client such as a monitoring service, service registry, or load balancer
   - C. The database server
   - D. Only a developer running it by hand

<details><summary>Reveal answer</summary>

**B.** The reference names a monitoring service, service registry, or load balancer as the client that periodically invokes the endpoint. A, C, and D are not the clients described.

</details>

4. What is the stated drawback of the Health Check API?

   - A. It requires a second database for every service
   - B. The check may not be sufficiently comprehensive, or the instance may fail between checks, so requests can still be routed to a failed instance
   - C. It removes the service registry from the architecture
   - D. It uses two-phase commit for every check

<details><summary>Reveal answer</summary>

**B.** The reference lists both gaps: the check might not be comprehensive, and an instance might fail between health checks. A, C, and D are not in the reference.

</details>

