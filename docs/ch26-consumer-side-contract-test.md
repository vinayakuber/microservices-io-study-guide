# Chapter 26: Consumer-Side Contract Test

> Verify that the client of a service can communicate with the service.

_Also known as: Chris Richardson · Microservice Patterns Ch. · microservices.io /patterns/testing/consumer-side-contract-test.html_

## Flow

### The client's half of the contract

> **Why this matters:** Every contract has two sides; this pattern puts the client under test and asks whether it can still talk to the service it depends on.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s0n0["<b>1. The client is the subject</b><br/>The client is the service's caller — the side that forms requests a…"]:::start
  s0n1["<b>2. Communicate means two directions</b><br/>Communication means sending a well-formed request and consuming the…"]:::step
  s0n2["<b>3. Contrast with consumer-driven</b><br/>The consumer-driven test checks the provider meets expectations; th…"]:::stop
  s0n0 --> s0n1
  s0n1 --> s0n2
```

1. **The client is the subject** — The client is the service's caller — the side that forms requests and reads replies — and it is what the test verifies.

2. **Communicate means two directions** — Communication means sending a well-formed request and consuming the service's reply, so the test checks both.

3. **Contrast with consumer-driven** — The consumer-driven test checks the **provider** meets expectations; the consumer-side test checks the **client** can talk.

```java
// CLIENT SIDE — verify the client can communicate with the service (the client's half of the contract)
// PARTIES: CLI = OrderServiceProxy (the client) · SVC = Order Service (the service) · TST = the client-side test
// STATE (before):
//    request : { method:"", path:"", headers:{} }
//    response : { status:0, body:{} }
// DEF: call_get_order · CALLED BY: TST exercising the client against the service contract
// -> order_id : "ORD-4007"
//    step 1 · form request : request.method : "" -> "GET" · request.path : "" -> "/orders/ORD-4007"  BECAUSE the client must send the service's expected method and path
//    step 2 · send and receive : response.status : 0 -> 200  BECAUSE the service answers the well-formed request
//    step 3 · parse body : response.body : {} -> {"orderId":"ORD-4007","state":"CREATED"}  BECAUSE the client reads the order's JSON from the reply
// <- verdict : "pass" · response.status : 200  BECAUSE the client sent a valid request and consumed the reply
//    alt client cannot communicate : response.status : 200 -> 500  BECAUSE the client sent a malformed path
//       verdict : "pass" -> "fail"  BECAUSE the client no longer reaches the service's contract
```

### Forming the outgoing request

> **Why this matters:** The first half of "can communicate" is the request: the client must send the method, path, and headers the service expects, or nothing downstream works.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s1n0["<b>1. Method</b><br/>The client must use the HTTP method the service's contract specifie…"]:::start
  s1n1["<b>2. Path</b><br/>The client must substitute the concrete id into the path template,…"]:::step
  s1n2["<b>3. Headers</b><br/>The client must advertise the format it can read, such as an Accept…"]:::stop
  s1n0 --> s1n1
  s1n1 --> s1n2
```

1. **Method** — The client must use the HTTP method the service's contract specifies, such as GET.

2. **Path** — The client must substitute the concrete id into the path template, such as /orders/{orderId}.

3. **Headers** — The client must advertise the format it can read, such as an Accept header.

```java
// CLIENT SIDE — the outgoing request: the client must form the service's expected method, path, and headers
// PARTIES: CLI = OrderServiceProxy · SVC = Order Service
// STATE (before):
//    outbound : { method:"", path:"", headers:{} }
//    verdict : ""
// DEF: build_request · CALLED BY: the client-side test
// -> order_id : "ORD-4007" · -> accept : "application/json"
//    step 1 · method : outbound.method : "" -> "GET"  BECAUSE the contract says GET /orders/{orderId}
//    step 2 · path : outbound.path : "" -> "/orders/ORD-4007"  BECAUSE the client substitutes the order id into the path template
//    step 3 · headers : outbound.headers : {} -> {"Accept":"application/json"}  BECAUSE the client advertises the format it can read
// <- outbound : {"method":"GET","path":"/orders/ORD-4007","headers":{"Accept":"application/json"}}
//    alt wrong path : outbound.path : "/orders/ORD-4007" -> "/order/ORD-4007"  BECAUSE a client typo drops the plural
//       verdict : "pass" -> "fail"  BECAUSE the service expects /orders, not /order
```

### Consuming the incoming response

> **Why this matters:** The second half is the reply: the client must read the status, headers, and body correctly, or it will misparse a healthy service.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s2n0["<b>1. Read the status</b><br/>The client must confirm the call succeeded before trying to parse a…"]:::start
  s2n1["<b>2. Read the headers</b><br/>The client must check the content type so it decodes the body the r…"]:::step
  s2n2["<b>3. Decode the body</b><br/>The client must turn the reply body into its own fields, such as or…"]:::stop
  s2n0 --> s2n1
  s2n1 --> s2n2
```

1. **Read the status** — The client must confirm the call succeeded before trying to parse anything.

2. **Read the headers** — The client must check the content type so it decodes the body the right way.

3. **Decode the body** — The client must turn the reply body into its own fields, such as orderId and state.

```java
// CLIENT SIDE — the incoming response: the client must read the service's status, headers, and body correctly
// PARTIES: CLI = OrderServiceProxy · SVC = Order Service
// STATE (before):
//    received : { status:0, headers:{}, body:{} }
//    parsed : { orderId:"", state:"" }
// DEF: consume_response · CALLED BY: the client-side test after the call returns
// -> raw_reply : {"status":200,"headers":{"Content-Type":"application/json"},"body":{"orderId":"ORD-4007","state":"CREATED"}}
//    step 1 · read status : received.status : 0 -> 200  BECAUSE the client confirms the call succeeded before parsing
//    step 2 · read headers : received.headers : {} -> {"Content-Type":"application/json"}  BECAUSE the client checks the body is JSON before decoding
//    step 3 · decode body : parsed.orderId : "" -> "ORD-4007" · parsed.state : "" -> "CREATED"  BECAUSE the client decodes the JSON body into its own fields
// <- parsed : {"orderId":"ORD-4007","state":"CREATED"} · received.status : 200
//    alt unexpected body : received.body : {} -> {"error":"not found"}  BECAUSE the service returned an error shape instead
//       parsed.orderId : "ORD-4007" -> ""  BECAUSE an error body carries no orderId to decode
```

### The client is the thing under test

> **Why this matters:** Placing the test on the client side means a client regression is caught where it is written, before it ships to every service it calls.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s3n0["<b>1. Assert on the client's own behavior</b><br/>The test checks what the client sends and what it reads, not the pr…"]:::start
  s3n1["<b>2. Both assertions must hold</b><br/>A passing test means the request assertion and the response asserti…"]:::step
  s3n2["<b>3. A wrong path fails fast</b><br/>If the client forms the wrong path, it cannot reach the service's e…"]:::stop
  s3n0 --> s3n1
  s3n1 --> s3n2
```

1. **Assert on the client's own behavior** — The test checks what the client sends and what it reads, not the provider's internals.

2. **Both assertions must hold** — A passing test means the request assertion and the response assertion both succeeded.

3. **A wrong path fails fast** — If the client forms the wrong path, it cannot reach the service's endpoint and the test fails.

```java
// CLIENT SIDE — the client is the subject under test, not the provider
// PARTIES: CLI = OrderServiceProxy (subject) · SVC = Order Service (the service it talks to)
// STATE (before):
//    cli_behavior : { sends:"", reads:"" }
//    checks : 0
//    failures : 0
// DEF: assert_client_can_talk · CALLED BY: the consumer-side test
// -> order_id : "ORD-4007"
//    step 1 · check outgoing : cli_behavior.sends : "" -> "GET /orders/ORD-4007"  BECAUSE the test asserts the client forms the correct request
//    step 2 · check incoming : cli_behavior.reads : "" -> "orderId,state"  BECAUSE the test asserts the client parses the reply's fields
//    step 3 · tally : checks : 0 -> 2  BECAUSE both the request and the response assertions pass
// <- failures : 0  BECAUSE the client can communicate with the service
//    alt client cannot talk : cli_behavior.sends : "GET /orders/ORD-4007" -> "GET /order/ORD-4007"  BECAUSE the client used the wrong path
//       failures : 0 -> 1  BECAUSE the wrong path means the client cannot reach the service's endpoint
```


## Key Concepts

### The Problem

**The client's half goes unverified.** You need an automated check that the client of a service can still communicate with that service.


### The Solution

Verify that the client of a service can communicate with the service.


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| Consumer-side contract test | Verify that the client of a service can communicate with the service. | A consumer-side suite asserts the proxy sends GET /orders/{orderId} and decodes the returned order. |
| Verifies the client, not the provider | This pattern checks the client's side, while the consumer-driven contract test checks the provider's side. | A client that sends a well-formed request still fails if the service returns a 404. |
| Send and read, nothing in between | The test verifies the client forms the expected request (method, path, headers, body) and consumes the expected response (status, headers, body). | A miss on the path or a misparse of the body is caught, while deeper business logic is left to other tests. |


### Tradeoffs & When

- This pattern checks the client's side, while the consumer-driven contract test checks the provider's side.
- The test verifies the client forms the expected request (method, path, headers, body) and consumes the expected response (status, headers, body).


<details><summary>All concepts (index)</summary>

### Problem: The client's half goes unverified

**Why.** A service can change, and a client can regress, without anyone noticing that the two no longer fit together.

**Claim.** You need an automated check that the client of a service can still communicate with that service.

**Grounding.** The pattern's own statement names the client as the thing under test, not the service.

**In the wild.** An OrderServiceProxy that builds the wrong path silently stops talking to Order Service.
### Solution: Consumer-side contract test

**Why.** Communication is the client's own responsibility, so it deserves its own test.

**Claim.** Verify that the client of a service can communicate with the service.

**Grounding.** The test exercises the client's outgoing request and its parsing of the incoming reply.

**In the wild.** A consumer-side suite asserts the proxy sends GET /orders/{orderId} and decodes the returned order.
### Tradeoff: Verifies the client, not the provider

**Why.** Passing this test proves only that the client speaks the contract; it says nothing about whether the provider behaves correctly.

**Claim.** This pattern checks the client's side, while the consumer-driven contract test checks the provider's side.

**Grounding.** The two pattern statements are complementary: the provider meets expectations, and the client can communicate.

**In the wild.** A client that sends a well-formed request still fails if the service returns a 404.
### Tradeoff: Send and read, nothing in between

**Why.** "Communicate" is concrete, so the test targets two moments and nothing else.

**Claim.** The test verifies the client forms the expected request (method, path, headers, body) and consumes the expected response (status, headers, body).

**Grounding.** Those are the same shape fields a REST contract carries on the consumer-provider relationship.

**In the wild.** A miss on the path or a misparse of the body is caught, while deeper business logic is left to other tests.

</details>


## Quiz

1. What does a consumer-side contract test verify?

   - A. That the provider meets every client's expectations
   - B. That the client of a service can communicate with the service
   - C. That the database is consistent
   - D. That messages are encrypted

<details><summary>Reveal answer</summary>

**B.** The pattern statement is: verify that the client of a service can communicate with the service. Verifying the provider meets expectations is the consumer-driven test, and the other options are unrelated.

</details>

2. Which side is the subject under test in a consumer-side contract test?

   - A. The provider
   - B. The client
   - C. The message broker
   - D. The network

<details><summary>Reveal answer</summary>

**B.** The name and the pattern statement both point at the client as the subject under test. The provider is the subject of the consumer-driven test instead, and the broker or network are not the subject.

</details>

3. What two directions of communication does "can communicate" concretely cover?

   - A. Sending a well-formed request and consuming the reply
   - B. Reading and writing the database
   - C. Encrypting and decrypting
   - D. Logging and tracing

<details><summary>Reveal answer</summary>

**A.** Communicating with a service means the client forms the outgoing request and consumes the incoming response — status, headers, and body. Database, encryption, and observability concerns are not what this pattern verifies.

</details>

4. How does a consumer-side contract test relate to a consumer-driven contract test?

   - A. They are the same thing
   - B. Consumer-side checks the client can talk; consumer-driven checks the provider meets clients' expectations
   - C. The consumer-side test replaces the provider
   - D. The consumer-driven test only tests the client

<details><summary>Reveal answer</summary>

**B.** They are complementary halves: consumer-driven verifies the provider against consumers' expectations, while consumer-side verifies the client can communicate. They are not identical, and neither replaces the provider.

</details>

