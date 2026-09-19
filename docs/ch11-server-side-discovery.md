# Chapter 11: Server-Side Discovery

> The client makes a request to a router at a well-known location, which queries the service registry and forwards the request to an available service instance.

_Also known as: Chris Richardson · Microservice Patterns Ch. 11 · microservices.io /patterns/server-side-discovery.html_

## Flow

### A router hides the instances

> **Why this matters:** Instead of teaching every client the registry, the application teaches it one well-known router address that hides the changing instances.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s0n0["<b>1. Call the router</b><br/>The client makes a request via a router (load balancer) at a well-k…"]:::start
  s0n1["<b>2. Router queries the registry</b><br/>The router queries a service registry, which might be built into th…"]:::step
  s0n2["<b>3. Forward to an instance</b><br/>The router forwards the request to an available service instance."]:::step
  s0n3["<b>4. Client stays simple</b><br/>The client never performs discovery — it just calls the router."]:::stop
  s0n0 --> s0n1
  s0n1 --> s0n2
  s0n2 --> s0n3
```

1. **Call the router** — The client makes a request via a router (load balancer) at a well-known location.

2. **Router queries the registry** — The router queries a service registry, which might be built into the router.

3. **Forward to an instance** — The router forwards the request to an available service instance.

4. **Client stays simple** — The client never performs discovery — it just calls the router.

```java
// ROUTER SIDE — the client calls a well-known router, which consults the registry and forwards to an instance
// PARTIES: CLI = client · RTR = router (load balancer) · REG = service registry · SVC = order-service instance
// STATE (before):
//    registry : {"order-service" -> [{"host":"10.0.1.7","port":8080},{"host":"10.0.1.8","port":8080}]}
//    lookup : []
//    router_target : "unset"
//    forwarded : "none"
// DEF: a client sends a request · CALLED BY: CLI calling the router's well-known address
// -> request : "POST http://router.example.com/orders"
//    step 1 · RTR queries REG : lookup : [] -> ["10.0.1.7:8080","10.0.1.8:8080"]   BECAUSE the router asks the registry for available instances
//    step 2 · RTR picks one : router_target : "unset" -> "10.0.1.7:8080"
//    step 3 · RTR forwards : forwarded : "none" -> "10.0.1.7:8080"   BECAUSE the router relays the request to the chosen instance
// <- forwarded call : "POST http://10.0.1.7:8080/orders"   (the client never resolved the instance itself)
```

### ELB: router and registry in one

> **Why this matters:** AWS ELB collapses the router and the registry into one managed component, which is why it is the canonical example.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s1n0["<b>1. ELB as router</b><br/>A client makes HTTP(s) requests or TCP connections to the ELB, whic…"]:::start
  s1n1["<b>2. ELB as registry</b><br/>The ELB also functions as a Service Registry."]:::step
  s1n2["<b>3. External or internal</b><br/>An ELB can load-balance Internet traffic or, in a VPC, internal tra…"]:::step
  s1n3["<b>4. Two ways to register</b><br/>EC2 instances are registered with the ELB explicitly via an API cal…"]:::stop
  s1n0 --> s1n1
  s1n1 --> s1n2
  s1n2 --> s1n3
```

1. **ELB as router** — A client makes HTTP(s) requests or TCP connections to the ELB, which load-balances across EC2 instances.

2. **ELB as registry** — The ELB also functions as a Service Registry.

3. **External or internal** — An ELB can load-balance Internet traffic or, in a VPC, internal traffic.

4. **Two ways to register** — EC2 instances are registered with the ELB explicitly via an API call, or automatically via an autoscaling group.

```java
// ELB SIDE — the load balancer is also the registry; instances register explicitly or via an autoscaling group
// PARTIES: CLI = client · ELB = Elastic Load Balancer (router + registry) · EC2 = service instances
// STATE (before):
//    elb_targets : {"order-service" -> [{"id":"i-abc","host":"10.0.3.1"},{"id":"i-def","host":"10.0.3.2"}]}
// DEF: an autoscaling group adds an instance · CALLED BY: the ASG scaling out
// -> scale_out : {"id":"i-ghi","host":"10.0.3.3"}
//    step 1 · ASG registers with ELB : elb_targets["order-service"] : [{"id":"i-abc","host":"10.0.3.1"},{"id":"i-def","host":"10.0.3.2"}] -> [{"id":"i-abc","host":"10.0.3.1"},{"id":"i-def","host":"10.0.3.2"},{"id":"i-ghi","host":"10.0.3.3"}]
//    step 2 · target count : 2 -> 3   BECAUSE the autoscaling group registered the new EC2 instance
// <- load-balanced set : ["10.0.3.1","10.0.3.2","10.0.3.3"]   (ELB now spreads traffic across 3 instances)
//    alt explicit API call : an operator calls the ELB register-target API -> target count : 3 -> 3 (the same i-ghi is already present)
```

### Cluster proxies on every host

> **Why this matters:** In a cluster, the router moves onto each host as a local proxy, so a client only ever dials a local port.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s2n0["<b>1. A proxy on each host</b><br/>Kubernetes and Marathon run a proxy on each host that acts as a ser…"]:::start
  s2n1["<b>2. Connect to the local port</b><br/>The client connects to the local proxy using the port assigned to t…"]:::step
  s2n2["<b>3. Proxy forwards</b><br/>The proxy forwards the request to a service instance running somewh…"]:::stop
  s2n0 --> s2n1
  s2n1 --> s2n2
```

1. **A proxy on each host** — Kubernetes and Marathon run a proxy on each host that acts as a server-side discovery router.

2. **Connect to the local port** — The client connects to the local proxy using the port assigned to that service.

3. **Proxy forwards** — The proxy forwards the request to a service instance running somewhere in the cluster.

```java
// CLUSTER SIDE — each host runs a proxy; the client connects to the local proxy's port and it forwards into the cluster
// PARTIES: CLI = client on a host · PRX = per-host proxy (server-side router) · SVC = service instance in the cluster
// STATE (before):
//    cluster_map : {"order-service" -> "port 8080"}
//    proxy_target : "unset"
//    selected : []
//    forwarded : "none"
// DEF: a client calls a service · CALLED BY: CLI connecting to the local proxy
// -> connect : "localhost:8080"   (the port assigned to order-service)
//    step 1 · proxy resolves the port : proxy_target : "unset" -> "order-service"   BECAUSE port 8080 is assigned to order-service in the cluster
//    step 2 · proxy finds an instance : selected : [] -> ["10.0.4.9:8080"]   BECAUSE the proxy looks up the cluster for order-service
//    step 3 · proxy forwards : forwarded : "none" -> "10.0.4.9:8080"   BECAUSE it relays the request to that instance
// <- forwarded call : "POST http://10.0.4.9:8080/orders"   (the client only ever spoke to localhost:8080)
//    alt another host : its local proxy forwards the same port to a different pod 10.0.4.12
```

### Costs: extra hops, protocols, replication

> **Why this matters:** The price of a simpler client is an extra hop and an extra component that must be replicated and must speak the right protocols.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s3n0["<b>1. Extra hop</b><br/>More network hops are required than with client-side discovery."]:::start
  s3n1["<b>2. Install and configure</b><br/>Unless part of the cloud, the router is another component to instal…"]:::step
  s3n2["<b>3. Replicate it</b><br/>The router must be replicated for availability and capacity."]:::step
  s3n3["<b>4. Protocol support</b><br/>The router must support the needed protocols (HTTP, gRPC, Thrift) u…"]:::stop
  s3n0 --> s3n1
  s3n1 --> s3n2
  s3n2 --> s3n3
```

1. **Extra hop** — More network hops are required than with client-side discovery.

2. **Install and configure** — Unless part of the cloud, the router is another component to install and configure.

3. **Replicate it** — The router must be replicated for availability and capacity.

4. **Protocol support** — The router must support the needed protocols (HTTP, gRPC, Thrift) unless it is a TCP-based router.

```java
// ROUTER SIDE — server-side discovery adds a network hop and a component that must be replicated and protocol-fit
// PARTIES: CLI = client · RTR = router · REG = registry · SVC = instance
// STATE (before):
//    hops : 0
//    router_replicas : 1
//    supported : ["http"]
// DEF: measure one request's cost · CALLED BY: CLI sending a request through the router
// -> request : "POST /orders"
//    step 1 · hops : 0 -> 3   BECAUSE the path is CLI -> RTR -> REG -> SVC, one more hop than client-side discovery's 2
//    step 2 · replicate the router : router_replicas : 1 -> 2   BECAUSE the router must be replicated for availability and capacity
//    step 3 · protocol check : supported : ["http"] -> ["http","tcp"]   BECAUSE the router must speak the clients' protocols unless it is a TCP-based router
// <- cost summary : "3 hops, 2 replicas, protocols [http, tcp]"   (more moving parts than client-side)
```


## Key Concepts

### The Problem

**The client cannot track instances.** The client needs a stable, well-known address to call, behind which the changing set of instances is hidden.


### The Solution

The client calls a router (load balancer) at a well-known location; the router queries a registry and forwards to an available instance.


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| A router in front of the registry | The client calls a router (load balancer) at a well-known location; the router queries a registry and forwards to an available instance. | AWS ELB acts as both router and registry; Kubernetes and Marathon run a proxy on each host for the same purpose. |
| Simpler client, extra hops | The client code is simpler because it just calls the router, but more network hops are required than with client-side discovery. | Client to router to instance (via the registry) is one hop longer than client to registry to instance. |
| A router to replicate and protocol-fit | Unless it is part of the cloud, the router must be installed and configured, replicated for availability and capacity, and it must support the needed protocols (HTTP, gRPC, Thrift) unless it is a TCP-based router. | A cloud-managed ELB removes the operational cost; a self-run router restores it, including the replication burden. |


### Tradeoffs & When

- The client code is simpler because it just calls the router, but more network hops are required than with client-side discovery.
- Unless it is part of the cloud, the router must be installed and configured, replicated for availability and capacity, and it must support the needed protocols (HTTP, gRPC, Thrift) unless it is a TCP-based router.


<details><summary>All concepts (index)</summary>

### Problem: The client cannot track instances

**Why.** Instances appear and disappear under dynamic IPs, so a client that must pick an instance directly cannot keep up.

**Claim.** The client needs a stable, well-known address to call, behind which the changing set of instances is hidden.

**Grounding.** Richardson's context mirrors client-side discovery: dynamic IPs and load-varying instance counts break fixed locations.

**In the wild.** Rather than teaching every client the registry, the application teaches it one router address.
### Solution: A router in front of the registry

**Why.** A well-known middleman can absorb the lookup and forwarding that would otherwise live in each client.

**Claim.** The client calls a router (load balancer) at a well-known location; the router queries a registry and forwards to an available instance.

**Grounding.** Richardson's solution: the router "queries a service registry, which might be built into the router, and forwards the request."

**In the wild.** AWS ELB acts as both router and registry; Kubernetes and Marathon run a proxy on each host for the same purpose.
### Tradeoff: Simpler client, extra hops

**Why.** Moving discovery to the router simplifies the client but lengthens the request path.

**Claim.** The client code is simpler because it just calls the router, but more network hops are required than with client-side discovery.

**Grounding.** Richardson lists both: simpler client code, and "more network hops are required than when using Client Side Discovery."

**In the wild.** Client to router to instance (via the registry) is one hop longer than client to registry to instance.
### Tradeoff: A router to replicate and protocol-fit

**Why.** The router is now on the request path, so it must scale and speak the right protocols.

**Claim.** Unless it is part of the cloud, the router must be installed and configured, replicated for availability and capacity, and it must support the needed protocols (HTTP, gRPC, Thrift) unless it is a TCP-based router.

**Grounding.** Richardson lists these as drawbacks of server-side discovery.

**In the wild.** A cloud-managed ELB removes the operational cost; a self-run router restores it, including the replication burden.

</details>


## Quiz

1. How does a client reach an instance in server-side discovery?

   - A. It queries the registry and calls the instance directly
   - B. It calls a router at a well-known location, which forwards to an instance
   - C. It broadcasts to every instance
   - D. It hardcodes each host and port

<details><summary>Reveal answer</summary>

**B.** The client makes a request via a router at a well-known location; the router queries the registry and forwards to an available instance. A is client-side discovery, and C and D are not the pattern.

</details>

2. In the AWS example, what two roles does the ELB play?

   - A. Router (load balancer) and service registry
   - B. Database and message broker
   - C. Sidecar and third-party registrar
   - D. API gateway and backend-for-frontend

<details><summary>Reveal answer</summary>

**A.** The ELB load-balances traffic (router) and also functions as a Service Registry. B, C, and D are unrelated roles.

</details>

3. How do EC2 instances get registered with the ELB?

   - A. Only by editing a config file
   - B. Explicitly via an API call, or automatically as part of an autoscaling group
   - C. Only by the client at request time
   - D. The ELB never registers instances

<details><summary>Reveal answer</summary>

**B.** The reference says EC2 instances are registered either explicitly via an API call or automatically as part of an autoscaling group. A, C, and D contradict this.

</details>

4. Which is a drawback of server-side discovery?

   - A. The client code is simpler
   - B. More network hops than client-side discovery, and the router must be installed, configured, and replicated
   - C. The client is coupled to the registry
   - D. It cannot handle TCP traffic

<details><summary>Reveal answer</summary>

**B.** The reference lists extra network hops and the install/configure/replicate burden as drawbacks. A is a benefit, C is client-side discovery's drawback, and D is false because a TCP-based router can handle TCP.

</details>

