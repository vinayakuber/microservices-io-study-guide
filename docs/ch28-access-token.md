# Chapter 28: Access Token

> The API gateway authenticates each request and passes an access token that securely identifies the requestor to every service that handles the request.

_Also known as: Chris Richardson · Microservice Patterns Ch. 28 · microservices.io /patterns/security/access-token.html_

## Flow

### Authenticate at the gateway

> **Why this matters:** The API gateway is the single entry point for every client request. If each downstream service re-authenticated the same requestor, the cost and the attack surface would multiply; authenticating once at the gateway and minting a portable token buys a single, trusted identity statement for the whole system.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s0n0["<b>1. Client reaches the single entry point</b><br/>The client sends its request, with credentials, to the API gateway…"]:::start
  s0n1["<b>2. The gateway authenticates the request</b><br/>The gateway authenticates the request, confirming who the requestor…"]:::step
  s0n2["<b>3. The gateway issues an access token</b><br/>The gateway mints an access token, e.g. a JSON Web Token, that secu…"]:::stop
  s0n0 --> s0n1
  s0n1 --> s0n2
```

1. **Client reaches the single entry point** — The client sends its request, with credentials, to the API gateway — the one entry point for all client requests.

2. **The gateway authenticates the request** — The gateway authenticates the request, confirming who the requestor is.

3. **The gateway issues an access token** — The gateway mints an access token, e.g. a JSON Web Token, that securely identifies the requestor to ride along with later requests.

```java
// API GATEWAY SIDE — authenticate the requestor once and mint a token that carries their identity
// PARTIES: CL = client app · GW = API Gateway (single entry point) · SVC = order service
// STATE (before):
//    gw_auth : {}                         // identities GW has verified this session
//    payload : ""                         // the identity claim GW will sign into the token
//    token : ""                           // the access token GW will hand back
// DEF: authenticate · CALLED BY: CL posting credentials to the login route
// -> credentials : {"user":"alice","password":"hunter2"}
//    step 1 · GW verifies the credentials    // gw_auth : {} -> {"alice":"verified"}
//    step 2 · GW builds the identity claim    // payload : "" -> {"sub":"alice"}
//    step 3 · GW signs the claim into a JSON Web Token    // token : "" -> "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbGljZSJ9.sig"  BECAUSE the signature lets any service verify the identity without re-authenticating
// <- token : "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbGljZSJ9.sig" returned to CL for every later request
//    alt unknown user : gw_auth : {} -> {"alice":"unknown"} · token : "" -> ""  BECAUSE there is no verified identity to sign, so no token is issued
```

### Verify identity and authorization at the service

> **Why this matters:** A token only helps if services can trust it. Each service must be able to confirm who made the request and that they are allowed to perform the operation, without a round-trip back to the gateway.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s1n0["<b>1. The gateway forwards the token</b><br/>The gateway passes the access token in each request it forwards to…"]:::start
  s1n1["<b>2. The service verifies the requestor</b><br/>The receiving service checks the token to learn the identity of the…"]:::step
  s1n2["<b>3. The service checks authorization</b><br/>The service verifies that the requestor is authorized to perform th…"]:::stop
  s1n0 --> s1n1
  s1n1 --> s1n2
```

1. **The gateway forwards the token** — The gateway passes the access token in each request it forwards to a service.

2. **The service verifies the requestor** — The receiving service checks the token to learn the identity of the requestor.

3. **The service checks authorization** — The service verifies that the requestor is authorized to perform the requested operation.

```java
// ORDER SERVICE SIDE — verify the requestor identity and authorization straight from the token
// PARTIES: GW = API Gateway · SVC = order service · CL = client app
// STATE (before):
//    allowed_roles : {"alice":"customer"}    // roles that may act on orders
//    requestor : ""                          // identity read out of the token
//    verdict : "pending"                     // the authorization decision, not yet made
// DEF: handle_order · CALLED BY: GW forwarding a request that carries the token
// -> token : "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbGljZSJ9.sig" · -> operation : "place_order"
//    step 1 · SVC verifies the token signature    // verdict : "pending" -> "authentic"
//    step 2 · SVC reads the identity from the token claims    // requestor : "" -> "alice"
//    step 3 · SVC checks the role against the operation    // verdict : "authentic" -> "authorized"  BECAUSE allowed_roles maps "alice" to "customer", which may place an order
// <- verdict : "authorized" — SVC proceeds with "place_order"
//    alt invalid signature : verdict : "pending" -> "rejected" — SVC refuses the request
```

### Propagate the token across service calls

> **Why this matters:** Requests are not one hop; a service often invokes other services to satisfy a request. Passing the same token onward keeps the requestor's identity intact across the entire call chain, so no service has to re-establish it.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s2n0["<b>1. A service receives the token</b><br/>An intermediate service receives a request that carries the access…"]:::start
  s2n1["<b>2. It includes the token downstream</b><br/>When that service invokes another service, it includes the same acc…"]:::step
  s2n2["<b>3. The next service verifies from the same token</b><br/>The downstream service verifies identity and authorization from tha…"]:::stop
  s2n0 --> s2n1
  s2n1 --> s2n2
```

1. **A service receives the token** — An intermediate service receives a request that carries the access token.

2. **It includes the token downstream** — When that service invokes another service, it includes the same access token in the request.

3. **The next service verifies from the same token** — The downstream service verifies identity and authorization from that token, with no fresh authentication.

```java
// PAYMENT SERVICE SIDE — a service includes the token when it calls another service
// PARTIES: SVC = order service · PAY = payment service · CL = client app
// STATE (before):
//    incoming : ""                     // token SVC received on its own request
//    forwarded : ""                    // token SVC sends onward to PAY
//    pay_verdict : "pending"           // PAY's authorization decision
// DEF: invoke_payment · CALLED BY: SVC needing to charge the customer's card
// -> token : "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbGljZSJ9.sig"
//    step 1 · SVC stores the token it received    // incoming : "" -> "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbGljZSJ9.sig"
//    step 2 · SVC attaches the same token to its call to PAY    // forwarded : "" -> "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbGljZSJ9.sig"
//    step 3 · PAY verifies the token and authorizes the charge    // pay_verdict : "pending" -> "authorized"  BECAUSE the token still identifies "alice", whose role permits the charge
// <- pay_verdict : "authorized" — the charge is processed for "alice"
```


## Key Concepts

### The Problem

**Communicating the requestor identity.** Each service needs to know who made the request without re-authenticating on every hop.


### The Solution

The API gateway passes an access token (e.g. a JSON Web Token) that securely identifies the requestor in each request; a service may include it in requests to other services.


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| Pass an access token with each request | The API gateway passes an access token (e.g. a JSON Web Token) that securely identifies the requestor in each request; a service may include it in requests to other services. | JSON Web Token is the canonical format; the reference points to JWT usage examples and supporting libraries. |
| Identity now flows with every request | The benefit is that the identity of the requestor is securely passed around the system. | The cost is that each forwarded request must carry the token, so the credential travels on every hop. |
| Authorization is distributed to the services | With the token in hand, each service can verify that the requestor is authorized, without consulting the gateway. | The tradeoff is that verification duty is spread across every service, so each one must implement token validation. |


### Tradeoffs & When

- The benefit is that the identity of the requestor is securely passed around the system.
- With the token in hand, each service can verify that the requestor is authorized, without consulting the gateway.


<details><summary>All concepts (index)</summary>

### Problem: Communicating the requestor identity

**Why.** The API gateway authenticates a request and forwards it to numerous services, which may in turn invoke other services.

**Claim.** Each service needs to know who made the request without re-authenticating on every hop.

**Grounding.** The reference problem: how to communicate the identity of the requestor to the services that handle the request.

**In the wild.** Without a shared credential, every service duplicates authentication logic and each hop needs its own proof of identity.
### Solution: Pass an access token with each request

**Why.** The gateway can authenticate once and stamp the requestor identity into a portable, signed credential.

**Claim.** The API gateway passes an access token (e.g. a JSON Web Token) that securely identifies the requestor in each request; a service may include it in requests to other services.

**Grounding.** This is the reference solution, nearly verbatim.

**In the wild.** JSON Web Token is the canonical format; the reference points to JWT usage examples and supporting libraries.
### Tradeoff: Identity now flows with every request

**Why.** The token has to reach every service in the call chain to be useful.

**Claim.** The benefit is that the identity of the requestor is securely passed around the system.

**Grounding.** Listed as the first benefit in the resulting context.

**In the wild.** The cost is that each forwarded request must carry the token, so the credential travels on every hop.
### Tradeoff: Authorization is distributed to the services

**Why.** Services often need to verify that a user is authorized to perform an operation.

**Claim.** With the token in hand, each service can verify that the requestor is authorized, without consulting the gateway.

**Grounding.** Listed as the second benefit in the resulting context.

**In the wild.** The tradeoff is that verification duty is spread across every service, so each one must implement token validation.

</details>


## Quiz

1. What problem does the Access Token pattern solve?

   - A. How to split a monolith into services
   - B. How to communicate the identity of the requestor to the services that handle the request
   - C. How to discover the network location of a service
   - D. How to store configuration outside the code

<details><summary>Reveal answer</summary>

**B.** The pattern exists because once the API gateway authenticates a request, downstream services still need to know who made it. The reference problem is exactly: how to communicate the requestor's identity to the services that handle the request. A and C describe other patterns (decomposition, service discovery), and D describes Externalized Configuration.

</details>

2. Who authenticates the request and issues the access token?

   - A. Every service independently
   - B. The database
   - C. The API gateway
   - D. The client

<details><summary>Reveal answer</summary>

**C.** The API gateway is the single entry point; it authenticates the request and passes the token to services. Each service verifies the token rather than re-authenticating, which rules out A; B and D never authenticate or issue tokens in this pattern.

</details>

3. When one service calls another, what should it do with the access token?

   - A. Drop it and re-authenticate as itself
   - B. Include the access token in the request it makes to the other service
   - C. Replace it with the database credentials
   - D. Send it only to the API gateway

<details><summary>Reveal answer</summary>

**B.** The reference states a service can include the access token in requests it makes to other services, so the requestor identity survives the whole call chain. Dropping it (A) loses the identity; C and D are not part of the pattern.

</details>

4. What is a stated benefit of the Access Token pattern?

   - A. The requestor's identity is securely passed around the system, and services can verify authorization
   - B. The service runs in multiple environments without modification
   - C. A service knows the network location of other services
   - D. Requests never need authentication again

<details><summary>Reveal answer</summary>

**A.** Both listed benefits — identity securely passed around, and services verifying authorization — are stated in the resulting context. B is Externalized Configuration's benefit, C is service discovery, and D overstates it (authentication still happens, just once at the gateway).

</details>

