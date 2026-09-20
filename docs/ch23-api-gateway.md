# Chapter 23: API Gateway

> Implement an API gateway that is the single entry point for all clients, proxying some requests and fanning others out to multiple services.

_Also known as: Chris Richardson · Microservice Patterns Ch. 23 · microservices.io /patterns/apigateway.html_

## Flow

### Why clients cannot chase fine-grained APIs

> **Why this matters:** Microservices expose fine-grained APIs, so one page needs data from many services — and a slow mobile network can only afford a few round-trips.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. One page spans many services</b><br/>product P-9 data is spread over Product Info, Pricing, Inventory, and Review"]:::start
  n1["<b>2. Call Product Info</b><br/>page gains title POJOs in Action, author Chris Richardson, roundtrips 0 becomes 1"]:::step
  n2["<b>3. Call Pricing</b><br/>page gains price 39.99, roundtrips 1 becomes 2"]:::step
  n3["<b>4. Call Inventory</b><br/>page gains stock 3, roundtrips 2 becomes 3"]:::step
  n4["<b>5. Call Review</b><br/>page gains reviews 12, roundtrips 3 becomes 4"]:::step
  n5["<b>6. Page assembled, expensively</b><br/>4 round-trips over a slow mobile network"]:::stop
  n6["<b>Alt - a LAN client</b><br/>4 round-trips are cheap, a server-side web app can afford them"]:::warn
  n0 -->|"1. client must call each"| n1
  n1 -->|"2. next service"| n2
  n2 -->|"3. next service"| n3
  n3 -->|"4. next service"| n4
  n4 -->|"5. mobile pays the price"| n5
  n4 -->|"6. alt - fast network"| n6
```

1. **One page spans many services** — Product details data is spread over Product Info, Pricing, Order, Inventory, Review, and more.

2. **Clients must call each service** — A client needing the details of one product must fetch data from numerous services.

3. **Mobile can only afford a few calls** — A mobile network is much slower, so the client should make few round-trips.

```java
// CLIENT SIDE — before a gateway, one client talks to many services directly
// PARTIES: MOB = mobile client · PROD = Product Info Service · PRI = Pricing Service · INV = Inventory Service · REV = Review Service
// STATE (before):
//    page : {}                              // the product page the client assembles
//    roundtrips : 0                          // network calls made so far
// DEF: render_product_page · CALLED BY: MOB displaying one product
// -> product : "P-9"                         // the product the client must display
//    step 1 · call PROD    // page : {} -> {title:"POJOs in Action", author:"Chris Richardson"}  · roundtrips : 0 -> 1
//    step 2 · call PRI     // page : {title:"POJOs in Action", author:"Chris Richardson"} -> {title:"POJOs in Action", author:"Chris Richardson", price:39.99}  · roundtrips : 1 -> 2
//    step 3 · call INV     // page : {title:"POJOs in Action", author:"Chris Richardson", price:39.99} -> {title:"POJOs in Action", author:"Chris Richardson", price:39.99, stock:3}  · roundtrips : 2 -> 3
//    step 4 · call REV     // page : {title:"POJOs in Action", author:"Chris Richardson", price:39.99, stock:3} -> {title:"POJOs in Action", author:"Chris Richardson", price:39.99, stock:3, reviews:12}  · roundtrips : 3 -> 4
// <- page : {title:"POJOs in Action", author:"Chris Richardson", price:39.99, stock:3, reviews:12}  · 4 round-trips over a slow mobile network
//    alt the client is on a LAN : 4 round-trips are cheap -> a server-side web app can afford them, the mobile client cannot
```

### Proxy a request to one service

> **Why this matters:** The gateway handles a request in two ways: some are simply proxied or routed to the appropriate service, while others fan out.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Client hits the single entry point</b><br/>CLI sends GET /products/P-9 to the gateway"]:::start
  n1["<b>2. Match the path</b><br/>route_table maps /products to PROD"]:::core
  n2["<b>3. Forward to the service</b><br/>the gateway proxies the request to Product Info Service"]:::step
  n3["<b>4. Response returns through the gateway</b><br/>response is title POJOs in Action, author Chris Richardson"]:::step
  n4["<b>5. Client never learns the host</b><br/>the client got its answer without PROD host or port"]:::stop
  n5["<b>Alt - route table changes</b><br/>/products now maps to PROD-v2, the client keeps sending to the gateway unchanged"]:::warn
  n0 -->|"1. one request in"| n1
  n1 -->|"2. lookup the URL"| n2
  n2 -->|"3. proxy it"| n3
  n3 -->|"4. answer out"| n4
  n2 -->|"5. alt - route swap"| n5
```

1. **The client hits the single entry point** — Every client sends its request to the API gateway, not to individual services.

2. **The gateway routes to the right service** — For a simple request, the gateway proxies it to the appropriate service.

3. **The response returns through the gateway** — The client receives the answer without learning the service instance or location.

```java
// GATEWAY SIDE — a simple request is proxied straight to one service
// PARTIES: CLI = client · GW = API Gateway · PROD = Product Info Service
// DEF: route — a path-to-service mapping the gateway proxies on = one entry of route_table; here route_table maps "/products" -> "PROD"
// STATE (before):
//    route_table : {"/products" : "PROD"}      // the gateway's route map
//    response : null
// DEF: route_request · CALLED BY: GW handling one request
// -> request : "GET /products/P-9"             // the client sends one request to the gateway
//    step 1 · match the path    // path : null -> "/products"  BECAUSE the gateway looks the URL up in its route table
//    step 2 · forward to the service    // target : null -> "PROD"  BECAUSE route_table maps "/products" to the Product Info Service
//    step 3 · return the response    // response : null -> {title:"POJOs in Action", author:"Chris Richardson"}
// <- response : {title:"POJOs in Action", author:"Chris Richardson"}  · the client never learned PROD's host or port
//    alt the route table changes : "/products" now maps to "PROD-v2" -> the client keeps sending to the gateway unchanged
```

### Fan out to many services

> **Why this matters:** For a page that needs several services, the gateway fans out to multiple services and returns one composed response, cutting the client down to a single round-trip.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. One request enters the gateway</b><br/>client sends GET /product/P-9, not four requests"]:::start
  n1["<b>2. Fan out to Product Info</b><br/>response gains title POJOs in Action, author Chris Richardson"]:::step
  n2["<b>3. Fan out to Pricing</b><br/>response gains price 39.99"]:::step
  n3["<b>4. Fan out to Review</b><br/>response gains reviews 12"]:::step
  n4["<b>5. Compose the page</b><br/>the gateway merges the partial results into one response"]:::core
  n5["<b>6. One round-trip for the client</b><br/>the client received the composed page in a single call"]:::stop
  n6["<b>A service call fails</b><br/>the circuit breaker opens, the gateway returns a partial page instead of hanging"]:::warn
  n0 -->|"1. fan out"| n1
  n1 -->|"2. next service"| n2
  n2 -->|"3. next service"| n3
  n3 -->|"4. merge partials"| n4
  n4 -->|"5. single reply"| n5
  n2 -->|"6. failure - partial page"| n6
```

1. **One request enters the gateway** — The client sends a single request for the whole page.

2. **The gateway fans out** — The gateway calls the several services that own pieces of the page.

3. **The gateway composes and returns** — It merges the partial results and sends one response back to the client.

```java
// GATEWAY SIDE — a page request is handled by fanning out to multiple services
// PARTIES: CLI = client · GW = API Gateway · PROD = Product Info Service · PRI = Pricing Service · REV = Review Service
// STATE (before):
//    response : {}                              // the composed response the gateway builds
// DEF: compose_product_details · CALLED BY: GW answering one page request
// -> request : "GET /product/P-9"               // the client sends one request, not four
//    step 1 · call PROD    // response : {} -> {title:"POJOs in Action", author:"Chris Richardson"}
//    step 2 · call PRI     // response : {title:"POJOs in Action", author:"Chris Richardson"} -> {title:"POJOs in Action", author:"Chris Richardson", price:39.99}
//    step 3 · call REV     // response : {title:"POJOs in Action", author:"Chris Richardson", price:39.99} -> {title:"POJOs in Action", author:"Chris Richardson", price:39.99, reviews:12}
// <- response : {title:"POJOs in Action", author:"Chris Richardson", price:39.99, reviews:12}  · one round-trip for the client
//    alt one service call fails : the gateway's circuit breaker opens -> the gateway returns a partial page instead of hanging
```

### The costs and variations

> **Why this matters:** The gateway adds a network hop and is another moving part, but it also insulates clients from partitioning and instance locations — and can expose a different API per client.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Every request passes through the gateway</b><br/>one more network leg per call"]:::start
  n1["<b>2. CLI to GW</b><br/>hops gains CLI-GW, latency 0 becomes 12 ms"]:::step
  n2["<b>3. GW to PROD</b><br/>hops gains GW-PROD, latency 12 becomes 24 ms"]:::step
  n3["<b>4. Back to CLI</b><br/>hops gains GW-CLI, latency 24 becomes 36 ms"]:::step
  n4["<b>5. Three hops, 36 ms</b><br/>the extra gateway hop added 12 ms, insignificant for most applications"]:::stop
  n5["<b>Alt - no gateway</b><br/>the client calls PROD directly in 24 ms but must locate and call every other service itself"]:::warn
  n6["<b>Variation - a different API per client</b><br/>the gateway can expose an API suited to each client"]:::warn
  n7["<b>Variation - Backends for frontends</b><br/>a separate gateway per client type is the BFF variation"]:::warn
  n0 -->|"1. measure the hop"| n1
  n1 -->|"2. second leg"| n2
  n2 -->|"3. third leg"| n3
  n3 -->|"4. tally"| n4
  n3 -->|"5. alt - direct call"| n5
  n0 -->|"6. per-client API"| n6
  n0 -->|"7. BFF"| n7
```

1. **An extra hop, usually insignificant** — Every request passes through the gateway, adding one more network leg.

2. **A different API per client** — Rather than one-size-fits-all, the gateway can expose an API suited to each client.

3. **A Backends for frontends variation** — A separate gateway per client type is the Backends for frontends variation.

```java
// GATEWAY SIDE — the gateway adds one network hop, a small and usually insignificant cost
// PARTIES: CLI = client · GW = API Gateway · PROD = Product Info Service
// STATE (before):
//    hops : []                                // network legs recorded so far
//    latency_ms : 0                            // total time tallied
// DEF: measure_hop · CALLED BY: GW tallying one request's latency
// -> request : "GET /product/P-9"
//    step 1 · CLI to GW    // hops : [] -> ["CLI->GW"]  · latency_ms : 0 -> 12
//    step 2 · GW to PROD   // hops : ["CLI->GW"] -> ["CLI->GW","GW->PROD"]  · latency_ms : 12 -> 24
//    step 3 · back to CLI  // hops : ["CLI->GW","GW->PROD"] -> ["CLI->GW","GW->PROD","GW->CLI"]  · latency_ms : 24 -> 36
// <- latency_ms : 36 over 3 hops  · the extra gateway hop added 12 ms, insignificant for most applications
//    alt no gateway existed : the client calls PROD directly in 24 ms -> but it must then locate and call every other service itself
```


## Key Concepts

### The Problem

**Clients cannot chase fine-grained APIs.** A client needing the details of a product must fetch data from numerous services, over a network whose speed differs per client type.


### The Solution

An API gateway is the single entry point for all clients; it proxies simple requests and fans others out to multiple services, and may expose a different API for each client.


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| The API gateway | An API gateway is the single entry point for all clients; it proxies simple requests and fans others out to multiple services, and may expose a different API for each client. | Netflix runs an API gateway with client-specific adapter code. |
| Fewer round-trips, one more hop | It reduces the number of requests and round-trips — essential for mobile — but adds one network hop through the gateway. | A mobile client retrieves data from multiple services in a single round-trip. |
| Yet another moving part | It insulates clients from partitioning and instance locations, but at the cost of increased complexity. | The gateway often also authenticates users, uses a Circuit Breaker to invoke services, and implements API Composition. |


### Tradeoffs & When

- It reduces the number of requests and round-trips — essential for mobile — but adds one network hop through the gateway.
- It insulates clients from partitioning and instance locations, but at the cost of increased complexity.


<details><summary>All concepts (index)</summary>

### Problem: Clients cannot chase fine-grained APIs

**Why.** Microservices give fine-grained APIs, so one page needs data from many services.

**Claim.** A client needing the details of a product must fetch data from numerous services, over a network whose speed differs per client type.

**Grounding.** The reference problem — how clients access the individual services — with the forces of granularity mismatch, different clients needing different data, and differing network performance.

**In the wild.** A product details page spread over Product Info, Pricing, Order, Inventory, and Review services.
### Solution: The API gateway

**Why.** Clients need one entry point and an API matched to their needs.

**Claim.** An API gateway is the single entry point for all clients; it proxies simple requests and fans others out to multiple services, and may expose a different API for each client.

**Grounding.** This is the reference solution, including the Netflix client-specific adapter example.

**In the wild.** Netflix runs an API gateway with client-specific adapter code.
### Tradeoff: Fewer round-trips, one more hop

**Why.** The gateway fans out internally, so the client makes one round-trip instead of many.

**Claim.** It reduces the number of requests and round-trips — essential for mobile — but adds one network hop through the gateway.

**Grounding.** Both are in the reference: the round-trip benefit, and the drawback of increased response time from the extra hop, called insignificant for most applications.

**In the wild.** A mobile client retrieves data from multiple services in a single round-trip.
### Tradeoff: Yet another moving part

**Why.** The gateway sits in front of every request, so it must be built, deployed, and managed.

**Claim.** It insulates clients from partitioning and instance locations, but at the cost of increased complexity.

**Grounding.** The reference benefits — insulating clients from partitioning and from locating instances — balanced against the drawback of increased complexity.

**In the wild.** The gateway often also authenticates users, uses a Circuit Breaker to invoke services, and implements API Composition.

</details>


## Quiz

1. How does an API gateway handle requests?

   - A. Only by proxying every request to one fixed service
   - B. By proxying simple requests and fanning others out to multiple services
   - C. Only by fanning out to every service on every request
   - D. By storing a copy of every service's database

<details><summary>Reveal answer</summary>

**B.** The reference says the gateway handles requests in two ways: some are simply proxied or routed to the appropriate service, and others are handled by fanning out to multiple services. A and C each name only one way, and D is not part of the gateway's job.

</details>

2. Which is a force the API gateway addresses?

   - A. The granularity of microservice APIs differs from what a client needs
   - B. Services cannot communicate with each other
   - C. Databases cannot be partitioned
   - D. Clients never need to authenticate

<details><summary>Reveal answer</summary>

**A.** A listed force is that microservices provide fine-grained APIs while clients need coarser data, so a client must interact with multiple services. The other options are not forces named in the reference.

</details>

3. Which is a stated benefit of the API gateway?

   - A. It eliminates all network latency
   - B. It reduces the number of requests and round-trips
   - C. It removes the need for service discovery
   - D. It guarantees a single database for all services

<details><summary>Reveal answer</summary>

**B.** The reference lists reducing requests and round-trips as a benefit — a client can retrieve data from multiple services in a single round-trip. It does not eliminate latency (it adds a hop), does not remove service discovery (it must use it), and does not unify databases.

</details>

4. What is a stated drawback of the API gateway?

   - A. It forces every client to use the same API
   - B. It cannot implement security
   - C. Increased complexity and increased response time from an extra hop
   - D. It requires a message broker

<details><summary>Reveal answer</summary>

**C.** The reference drawbacks are increased complexity and increased response time from the additional network hop. The gateway can expose a different API per client and may implement security, ruling out A and B; a broker is not required.

</details>

