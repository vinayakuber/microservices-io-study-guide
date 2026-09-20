# Chapter 6: Remote Procedure Invocation

> Synchronous inter-service communication where a client uses a request/reply-based protocol to invoke a service.

_Also known as: Chris Richardson · Microservice Patterns Ch. 6 · microservices.io /patterns/communication-style/rpi.html_

## Flow

### Invoke over request/reply

> **Why this matters:** RPI is the familiar synchronous call: the client sends a request and waits for a reply, with no broker in between.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Request/reply protocol, no broker</b><br/>pick how to invoke the remote service"]:::start
  n1["<b>2a. REST</b><br/>HTTP request and response"]:::step
  n2["<b>2b. gRPC</b><br/>binary RPC"]:::step
  n3["<b>2c. Apache Thrift</b><br/>cross-language RPC"]:::step
  n4["<b>3. CLIENT POSTs the request</b><br/>email ada example, password s3cret"]:::step
  n5["<b>4. SVC creates the user and answers</b><br/>status PENDING becomes 200"]:::core
  n6["<b>5. CLIENT reads the status code</b><br/>verdict UNSET becomes OK"]:::step
  n7["<b>6. CLIENT returns the new id</b><br/>result null becomes user-9"]:::step
  n8["<b>7. Reply user-9, Right</b><br/>one request, one prompt reply over HTTP"]:::stop
  n9["<b>No reply arrives</b><br/>the client blocks, both sides must be up"]:::warn
  n0 -->|"1a. protocol one"| n1
  n0 -->|"1b. protocol two"| n2
  n0 -->|"1c. protocol three"| n3
  n1 -->|"2. send the call"| n4
  n2 -->|"2. send the call"| n4
  n3 -->|"2. send the call"| n4
  n4 -->|"3. wait"| n5
  n5 -->|"4. read code"| n6
  n6 -->|"5. map"| n7
  n7 -->|"6. reply"| n8
  n5 -->|"7. if service down"| n9
```

1. **Send a request** — The client uses a request/reply protocol (REST, gRPC, or Apache Thrift) to call a service.

2. **Wait for the reply** — The client blocks until the reply arrives, then carries on.

3. **Map the response** — A 200 OK yields the new id; RegistrationServiceProxy returns **Right(id)**.

```java
// CLIENT SIDE — RPI: the client POSTs a request and waits for a reply, with no broker in between
// PARTIES: CLIENT = Registration Service · SVC = User Registration service (remote)
// STATE (before):
//    request : null
//    status : "PENDING"
//    verdict : "UNSET"
//    result : null
//    url : "http://user-reg:8080/register"
// DEF: registerUser · CALLED BY: a new user signing up (RestTemplate.postForEntity)
// -> email : "ada@example.com" · -> password : "s3cret"
//    step 1 · CLIENT POSTs the request to SVC  : request : null -> { email: "ada@example.com", password: "s3cret" }
//    step 2 · SVC creates the user and answers : status : "PENDING" -> 200
//    step 3 · CLIENT reads the status code     : verdict : "UNSET" -> "OK"
//    step 4 · CLIENT returns the new id        : result : null -> "user-9"
// <- reply : "user-9" (Right) · one request, one prompt reply over HTTP
```

### Map errors to typed results

> **Why this matters:** A failed or duplicate call must become a typed result, not an unhandled exception.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Proxy inspects the HTTP status</b><br/>the response code decides the result type"]:::start
  n1["<b>2. Client POSTs the request</b><br/>same email, ada example, signs up again"]:::step
  n2["<b>3. Service answers</b><br/>status PENDING becomes a code"]:::core
  n3["<b>4a. 200 OK path</b><br/>verdict OK, return Right id"]:::step
  n4["<b>4b. 409 CONFLICT path</b><br/>verdict CONFLICT, Left DuplicateRegistrationError"]:::step
  n5["<b>5. Typed result</b><br/>Right or Left, not an unhandled exception"]:::stop
  n6["<b>Service down</b><br/>no reply at all, both sides must be up"]:::warn
  n0 -->|"1. send the call"| n1
  n1 -->|"2. code comes back"| n2
  n2 -->|"3a. status is 200"| n3
  n2 -->|"3b. status is 409"| n4
  n3 -->|"4. typed"| n5
  n4 -->|"4. typed"| n5
  n2 -->|"5. no answer"| n6
```

1. **Catch the status** — The proxy inspects the HTTP status code of the response.

2. **Map 200 to success** — An **HttpStatus.OK** returns Right(id).

3. **Map CONFLICT to an error** — An HttpClientErrorException with CONFLICT becomes **Left(DuplicateRegistrationError)**.

```java
// CLIENT SIDE — RPI error path: a duplicate sign-up maps a 409 CONFLICT to a typed error
// PARTIES: CLIENT = Registration Service · SVC = User Registration service (remote)
// STATE (before):
//    request : null
//    status : "PENDING"
//    verdict : "UNSET"
//    result : null
//    url : "http://user-reg:8080/register"
// DEF: registerUser_duplicate · CALLED BY: the same email signing up twice
// -> email : "ada@example.com" · -> password : "s3cret"
//    step 1 · CLIENT POSTs the request again    : request : null -> { email: "ada@example.com" }
//    step 2 · SVC finds the email already taken : status : "PENDING" -> 409
//    step 3 · CLIENT matches the 409            : verdict : "UNSET" -> "CONFLICT"
//    step 4 · CLIENT returns the typed error    : result : null -> "DuplicateRegistrationError"
// <- reply : "DuplicateRegistrationError" (Left) · the 409 becomes a domain error
//    alt SVC down : no reply at all  BECAUSE client and service must both be available for the whole call
```

### The availability price

> **Why this matters:** Because both client and service must be up for the whole interaction, RPI reduces availability and blocks threads.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Both sides must be available</b><br/>client and service for the whole interaction"]:::start
  n1["<b>2. CLIENT blocks its thread</b><br/>thread FREE becomes WAITING"]:::step
  n2["<b>3. SVC is down, no reply arrives</b><br/>elapsed_ms 0 becomes 800"]:::core
  n3["<b>4. The timer expires</b><br/>verdict UNSET becomes TIMEOUT"]:::step
  n4["<b>5. The thread is released</b><br/>thread WAITING becomes FREE"]:::step
  n5["<b>6. TIMEOUT after 800 ms</b><br/>800 ms of the caller thread spent waiting"]:::stop
  n6["<b>SVC slow but alive</b><br/>the reply arrives late, no broker to buffer"]:::warn
  n0 -->|"1. thread waits"| n1
  n1 -->|"2. no answer"| n2
  n2 -->|"3. timer fires"| n3
  n3 -->|"4. release"| n4
  n4 -->|"5. timeout"| n5
  n2 -->|"6. if merely slow"| n6
```

1. **Both sides must be available** — Client and service must be available for the duration of the interaction.

2. **Threads wait** — The caller thread is held while it waits for the reply.

3. **Only request/reply** — RPI usually cannot express notifications, publish/subscribe, or async response.

```java
// CLIENT SIDE — RPI availability: client and service must both be available for the whole call
// PARTIES: CLIENT = Registration Service · SVC = User Registration service (unresponsive)
// STATE (before):
//    thread : "FREE"
//    elapsed_ms : 0
//    timeout_ms : 800
//    verdict : "UNSET"
// DEF: registerUser_unavailable · CALLED BY: a sign-up while SVC is unresponsive
// -> request : { email: "ada@example.com" }
//    step 1 · CLIENT blocks its thread on the call : thread : "FREE" -> "WAITING"
//    step 2 · SVC is down, so no reply arrives     : elapsed_ms : 0 -> 800
//    step 3 · the timer expires and the call fails : verdict : "UNSET" -> "TIMEOUT"
//    step 4 · the thread is released               : thread : "WAITING" -> "FREE"
// <- reply : "TIMEOUT" after 800 ms · 800 ms of the caller thread spent waiting
//    alt SVC slow but alive : the reply arrives late  BECAUSE there is no broker to buffer the work
```

### Discovery and resilience wiring

> **Why this matters:** A client must find a service instance and guard the call: discovery resolves the location, a circuit breaker contains failure.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. The client must find an instance</b><br/>discovery resolves the location"]:::start
  n1["<b>2. CLIENT asks the registry</b><br/>lookup null becomes user-registration"]:::step
  n2["<b>3. Registry returns a network location</b><br/>location null becomes 10.0.0.7 8080"]:::core
  n3["<b>4. CLIENT builds the URL from config</b><br/>url null becomes http 10.0.0.7 8080 register"]:::step
  n4["<b>5. Invoke behind a circuit breaker</b><br/>request null becomes email ada example"]:::step
  n5["<b>6. Reply user-9</b><br/>URL from discovery, call guarded by a breaker"]:::stop
  n6["<b>Breaker open</b><br/>the call fails fast without touching SVC"]:::warn
  n0 -->|"1. lookup"| n1
  n1 -->|"2. answer"| n2
  n2 -->|"3. build URL"| n3
  n3 -->|"4. invoke"| n4
  n4 -->|"5. reply"| n5
  n4 -->|"6. if breaker open"| n6
```

1. **Discover the instance** — The client needs to discover locations of service instances, via client-side or server-side discovery.

2. **Resolve the URL from config** — Externalized configuration supplies the network location (the **user_registration_url**).

3. **Guard with a circuit breaker** — A client typically uses a Circuit Breaker to improve reliability (the **@HystrixCommand** wrapper).

```java
// CLIENT SIDE — RPI wiring: discover an instance, resolve its URL, then invoke behind a breaker
// PARTIES: CLIENT = Registration Service · DISC = service registry · SVC = User Registration instance
// STATE (before):
//    registry : { "user-registration": "10.0.0.7:8080" }
//    lookup : null
//    location : null
//    url : null
//    request : null
// DEF: resolve_and_call · CALLED BY: CLIENT before its first call
// -> service_name : "user-registration"
//    step 1 · CLIENT asks DISC for an instance   : lookup : null -> "user-registration"
//    step 2 · DISC returns a network location    : location : null -> "10.0.0.7:8080"
//    step 3 · CLIENT builds the URL              : url : null -> "http://10.0.0.7:8080/register"
//    step 4 · CLIENT invokes SVC behind a breaker : request : null -> { email: "ada@example.com" }
// <- reply : "user-9" · the URL came from discovery, the call rides behind a circuit breaker
//    alt breaker open : the call fails fast without touching SVC  BECAUSE a client typically uses a Circuit Breaker
```


## Key Concepts

### The Problem

**Synchronous coupling.** Synchronous communication results in tight runtime coupling between client and service.


### The Solution

The client uses a request/reply-based protocol to make requests to a service, via REST, gRPC, or Apache Thrift.


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| Request/reply invocation | The client uses a request/reply-based protocol to make requests to a service, via REST, gRPC, or Apache Thrift. | RegistrationServiceProxy POSTs a RegistrationBackendRequest and returns the new id on a 200 OK. |
| Simple, familiar, no broker | RPI is simple and familiar, request/reply is easy, and the system is simpler because there is no intermediate broker. | A two-service system where a plain REST call needs no queue, topic, or broker to keep alive. |
| Only request/reply, reduced availability | RPI usually only supports request/reply, and availability is reduced because client and service must be available for the whole interaction. | A caller cannot send a fire-and-forget notification through an RPI-only API. |


### Tradeoffs & When

- RPI is simple and familiar, request/reply is easy, and the system is simpler because there is no intermediate broker.
- RPI usually only supports request/reply, and availability is reduced because client and service must be available for the whole interaction.


<details><summary>All concepts (index)</summary>

### Problem: Synchronous coupling

**Why.** When a call is synchronous, both ends must be alive for the whole interaction, so a slow or dead callee stalls the caller.

**Claim.** Synchronous communication results in tight runtime coupling between client and service.

**Grounding.** The reference lists it as a force: both the client and service must be available for the duration of the request.

**In the wild.** A registration call that blocks until the user service answers, holding the caller thread the entire time.
### Solution: Request/reply invocation

**Why.** Sometimes a service genuinely needs an immediate answer from another service.

**Claim.** The client uses a request/reply-based protocol to make requests to a service, via REST, gRPC, or Apache Thrift.

**Grounding.** The solution: use RPI; the client uses a request/reply protocol; the examples are REST, gRPC, and Apache Thrift.

**In the wild.** RegistrationServiceProxy POSTs a RegistrationBackendRequest and returns the new id on a 200 OK.
### Tradeoff: Simple, familiar, no broker

**Why.** A system is easier to run when there is no intermediate component to operate.

**Claim.** RPI is simple and familiar, request/reply is easy, and the system is simpler because there is no intermediate broker.

**Grounding.** The resulting context lists simplicity, easy request/reply, and no broker as benefits.

**In the wild.** A two-service system where a plain REST call needs no queue, topic, or broker to keep alive.
### Tradeoff: Only request/reply, reduced availability

**Why.** Synchrony is a restriction, not just a style choice.

**Claim.** RPI usually only supports request/reply, and availability is reduced because client and service must be available for the whole interaction.

**Grounding.** The resulting context lists the pattern restriction and reduced availability as drawbacks.

**In the wild.** A caller cannot send a fire-and-forget notification through an RPI-only API.

</details>


## Quiz

1. What protocol does an RPI client use to call a service?

   - A. A request/reply-based protocol
   - B. A fire-and-forget protocol
   - C. A publish/subscribe protocol
   - D. A shared-memory protocol

<details><summary>Reveal answer</summary>

**A.** RPI is defined by a request/reply-based protocol. Fire-and-forget (B) and publish/subscribe (C) are messaging styles, and shared memory (D) is not inter-process communication.

</details>

2. Which is NOT an RPI technology named in the reference?

   - A. REST
   - B. gRPC
   - C. Apache Thrift
   - D. Apache Kafka

<details><summary>Reveal answer</summary>

**D.** Kafka is a message broker, not an RPI mechanism. REST (A), gRPC (B), and Apache Thrift (C) are the RPI examples.

</details>

3. Which is a benefit of RPI?

   - A. It supports publish/subscribe
   - B. It is simple, familiar, and needs no broker
   - C. It buffers messages while the consumer is down
   - D. It decouples sender from consumer

<details><summary>Reveal answer</summary>

**B.** RPI is simple, familiar, and broker-free. Options A, C, and D are messaging benefits, not RPI benefits.

</details>

4. Which is a drawback of RPI?

   - A. The broker must be highly available
   - B. Client and service must both be available for the whole interaction
   - C. It cannot use REST
   - D. It requires Kafka

<details><summary>Reveal answer</summary>

**B.** RPI reduces availability because both sides must be up for the duration. Options A and D are messaging broker concerns, and C is false since REST is an RPI example.

</details>

