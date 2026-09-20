# Chapter 44: Strangler Application

> A strangler application that incrementally builds a new microservice-based system around a legacy monolith, routing work to the new system as it takes over functionality.

_Also known as: Chris Richardson · Microservice Patterns Ch. 44 · microservices.io /patterns/refactoring/strangler-application.html_

## Flow

### The migration problem

> **Why this matters:** You have a working legacy monolith and want a microservice architecture, but the monolith cannot be rebuilt in one step. The answer is to migrate incrementally, building the new system gradually around the old one.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. You have a working monolith</b><br/>mono_features : catalog, orders, accounts all true"]:::start
  n1["<b>2. You want microservices</b><br/>the monolith cannot be rebuilt in a single step"]:::warn
  n2["<b>3. Incremental replacement</b><br/>new_features : empty becomes catalog true, one piece at a time"]:::step
  n3["<b>4. Cut the piece over</b><br/>mono_features.catalog : true becomes false, traffic moves to the new service"]:::core
  n4["<b>5. Monolith shrinks</b><br/>mono_features : orders, accounts remain, one feature moved"]:::stop
  n5["<b>Big-bang rewrite instead</b><br/>rebuild the whole monolith at once, high risk"]:::warn
  n0 -->|"1. legacy runs the business"| n1
  n1 -->|"2. migrate gradually"| n2
  n2 -->|"3. re-implement one feature"| n3
  n3 -->|"4. cut over that feature"| n4
  n1 -->|"5. the one-shot rewrite"| n5
```

1. **You have a working monolith** — The legacy application runs the business today and cannot simply be switched off.

2. **You want microservices** — The team wants a microservice architecture, but the monolith cannot be rebuilt in a single step.

3. **Incremental replacement** — The migration proceeds by building the new system gradually around the old one, one piece at a time.

```java
// MONOLITH SIDE — the strangler grows by moving one feature at a time out of the monolith
// PARTIES: MONO = legacy monolith · NEW = new strangler application · U1 = user
// STATE (before):
//    mono_features : { "catalog": true, "orders": true, "accounts": true }
//    new_features  : {}
// DEF: migrate · CALLED BY: the team for each feature, one at a time
// -> feature : "catalog"
//    step 1 · re-implement "catalog" as a microservice in NEW   // new_features : {} -> { "catalog": true }
//    step 2 · cut "catalog" traffic over to the new service   // mono_features.catalog : true -> false
//    step 3 · the monolith is left holding only the remaining features   // mono_features : { "catalog": true, "orders": true, "accounts": true } -> { "orders": true, "accounts": true }
// <- state : mono_features = { "orders": true, "accounts": true } · new_features = { "catalog": true } — one piece moved, not the whole monolith at once

```

### The strangler routes requests

> **Why this matters:** The strangler application fronts both the new services and the legacy monolith, deciding per request which system handles it. Functionality already migrated is served by a microservice; everything else still falls back to the monolith.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. A router fronts both systems</b><br/>route_table : /catalog NEW, /orders MONO"]:::start
  n1["<b>2. Migrated paths go to new services</b><br/>look up /catalog, matched : empty becomes NEW"]:::step
  n2["<b>3. Unmigrated paths fall back</b><br/>path /orders, matched : NEW becomes MONO, the monolith still serves it"]:::warn
  n3["<b>4. The strangler grows</b><br/>target : empty becomes NEW, /catalog served by the new service"]:::core
  n4["<b>5. Monolith never sees it</b><br/>catalog items come from NEW, unchanged paths stay on MONO"]:::stop
  n0 -->|"1. every request is decided"| n1
  n1 -->|"2. the migrated path"| n3
  n3 -->|"3. served by the new service"| n4
  n0 -->|"4. the unmigrated path falls back"| n2
  n2 -->|"5. monolith unchanged"| n4
```

1. **A router fronts both systems** — The strangler receives every request and decides which system handles it.

2. **Migrated paths go to new services** — Functionality already moved to a microservice is served by that service.

3. **Unmigrated paths fall back** — Everything else still goes to the monolith, so it keeps running as before.

4. **The strangler grows** — As more functionality is re-implemented, more paths move over, and the monolith shrinks.

```java
// STRANGLER SIDE — one request is routed to a migrated microservice; an unmigrated path falls back to the monolith
// PARTIES: RTR = strangler router · NEW = new microservice · MONO = legacy monolith · U1 = user
// STATE (before):
//    route_table : { "/catalog": "NEW", "/orders": "MONO" }
// DEF: route · CALLED BY: RTR on each incoming request
// -> request : { "path": "/catalog" }
//    step 1 · look up "/catalog" in route_table   // matched : "" -> "NEW"   BECAUSE /catalog was already migrated
//    step 2 · forward the request to the matched backend   // target : "" -> "NEW"
//    step 3 · NEW serves the catalog from its own service
// <- response : "catalog items" from NEW — MONO never receives this request
//    alt path "/orders" : matched : "NEW" -> "MONO" · target : "" -> "MONO" — MONO still serves it, unchanged (fall back)

```

### Two kinds of service

> **Why this matters:** The strangler application consists of two types of services: ones that re-implement functionality that previously lived in the monolith, and ones that add brand-new features. The new-feature services are useful because they demonstrate the value of microservices to the business.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Re-implement monolith features</b><br/>new_features : catalog true, taken over from the monolith"]:::start
  n1["<b>2. Add brand-new features</b><br/>brand_new : empty becomes recommendations true, no monolith twin"]:::step
  n2["<b>3. Demonstrate the value</b><br/>route_table : /catalog NEW becomes /catalog NEW, /recommendations NEW"]:::core
  n3["<b>4. Keep strangling</b><br/>new_features : catalog, recommendations, the monolith keeps shrinking"]:::stop
  n4["<b>Feature already in the monolith</b><br/>it must be re-implemented and cut over, not just added"]:::warn
  n0 -->|"1. take over old features"| n1
  n1 -->|"2. ship net-new features"| n2
  n2 -->|"3. show the business the value"| n3
  n1 -->|"4. feature has a monolith twin"| n4
```

1. **Re-implement monolith features** — Services that take over functionality that previously resided in the monolith.

2. **Add brand-new features** — Services that implement new features the monolith never had.

3. **Demonstrate the value** — The new-feature services are useful because they show the business the value of using microservices.

4. **Keep strangling** — The strangler keeps taking over monolith functionality piece by piece until the legacy application is no longer needed.

```java
// STRANGLER SIDE — a brand-new feature lands in the new app, showing the business what microservices enable
// PARTIES: NEW = new strangler application · MONO = legacy monolith · RTR = strangler router · U1 = user
// DEF: brand — a brand-new feature with no monolith twin, added only to the new app; here "recommendations"
// DEF: route — a mapping from a request path to the system that serves it; here "/catalog" -> "NEW"
// STATE (before):
//    new_features : { "catalog": true }        // re-implemented monolith features
//    brand_new    : {}                          // features with no monolith twin
//    route_table  : { "/catalog": "NEW" }
// DEF: add_feature · CALLED BY: the team to add a feature the monolith never had
// -> feature : "recommendations"
//    step 1 · build "recommendations" as a new microservice   // brand_new : {} -> { "recommendations": true }
//    step 2 · register it in the router   // route_table : { "/catalog": "NEW" } -> { "/catalog": "NEW", "/recommendations": "NEW" }
//    step 3 · record it as owned by NEW   // new_features : { "catalog": true } -> { "catalog": true, "recommendations": true }
// <- state : NEW now serves { "catalog": true, "recommendations": true } — MONO never had a recommendations feature to cut over

```


## Interview Questions

### Q1

Your team wants microservices but starts with a working monolith that runs the business today. Rebuilding it in one release is impossible, so you need a path that moves one piece at a time.

**Interviewer's question:** How does the strangler application approach migrating a monolith?

**Solution:** The migration proceeds by building the new system gradually around the old one, re-implementing one feature at a time, so the monolith keeps running while the new system takes over piece by piece.

**System-design components:**
- Working monolith — runs the business
- New system — built gradually
- One feature at a time — the increment
- Monolith shrinks — as features move

```mermaid
flowchart LR
  MONO["Monolith"] -->|"re-implement search"| NEW["New system"]
  NEW -->|"search served"| NEW
  MONO -->|"keeps"| REST["checkout + accounts"]
```

```java
// MONOLITH SIDE — the strangler grows by moving one feature at a time out of the monolith
// PARTIES: MONO = legacy monolith · NEW = new strangler application · U1 = user
// STATE (before):
//    mono_features : { "search": true, "checkout": true, "accounts": true }
//    new_features  : {}
// DEF: migrate · CALLED BY: the team for each feature, one at a time
// -> feature : "search"
//    step 1 · re-implement "search" as a microservice in NEW   // new_features : {} -> { "search": true }
//    step 2 · cut "search" traffic over to the new service   // mono_features.search : true -> false
//    step 3 · the monolith keeps only the remaining features   // mono_features : { "search": true, "checkout": true, "accounts": true } -> { "checkout": true, "accounts": true }
// <- state : mono_features = { "checkout": true, "accounts": true } · new_features = { "search": true } — one piece moved, not the whole monolith at once
```

_This is the migration stage — building the new system gradually around the old one, one feature at a time._

_Covers:_ The migration problem

_From the 28 problems:_ 01-scale-from-zero-to-millions · 03-framework-for-system-design-interviews

### Q2

The strangler now fronts both the new services and the monolith. A request arrives for a path that has not been migrated yet, and it must keep working exactly as before.

**Interviewer's question:** How does the strangler decide which system handles each request?

**Solution:** A router fronts both systems and looks up each request's path in a route table; migrated paths go to new services, and unmigrated paths fall back to the monolith so it keeps running as before.

**System-design components:**
- Router — fronts both systems
- Route table — path to backend
- Migrated paths — new services
- Unmigrated paths — fall back to the monolith

```mermaid
flowchart LR
  RTR["Strangler router"] -->|"/search"| NEW["New search service"]
  RTR -->|"/checkout"| MONO["Monolith"]
  RTR -->|"lookup"| T["route_table"]
```

```java
// STRANGLER SIDE — a request for an unmigrated path falls back to the monolith, unchanged
// PARTIES: RTR = strangler router · NEW = new microservice · MONO = legacy monolith · U1 = user
// STATE (before):
//    route_table : { "/search": "NEW", "/checkout": "MONO" }
// DEF: route · CALLED BY: RTR on each incoming request
// -> request : { "path": "/checkout" }
//    step 1 · look up "/checkout" in route_table   // matched : "" -> "MONO"   BECAUSE /checkout has not been migrated yet
//    step 2 · forward to the matched backend   // target : "" -> "MONO"
//    step 3 · MONO serves checkout exactly as before
// <- response : "checkout page" from MONO — NEW never receives this request
//    alt path "/search" : matched : "MONO" -> "NEW" · target : "" -> "NEW" — NEW serves it, since /search was already migrated
```

_This is the routing stage — the router sends migrated paths to new services and everything else to the monolith._

_Covers:_ The strangler routes requests

_From the 28 problems:_ 01-scale-from-zero-to-millions · 03-framework-for-system-design-interviews

### Q3

The strangler is more than re-hosting old features. You want to add a feature the monolith never had, and use it to show the business what microservices enable.

**Interviewer's question:** What two kinds of services make up the strangler application, and why are the new-feature services useful?

**Solution:** One kind re-implements functionality that previously lived in the monolith, and the other implements brand-new features; the new-feature services are useful because they demonstrate to the business the value of using microservices.

**System-design components:**
- Re-implemented features — take over monolith work
- Brand-new features — no monolith twin
- Value demonstration — the new features' role
- Ongoing strangling — until the monolith retires

```mermaid
flowchart LR
  NEW["New system"] -->|"re-implemented"| CHECKOUT["checkout"]
  NEW -->|"brand-new"| WISH["wishlist"]
  WISH -->|"demonstrates"| VALUE["value to business"]
```

```java
// STRANGLER SIDE — a brand-new feature lands in the new app, showing the business what microservices enable
// PARTIES: NEW = new strangler application · MONO = legacy monolith · RTR = strangler router · U1 = user
// DEF: brand — a brand-new feature with no monolith twin, added only to the new app; here "wishlist"
// DEF: route — a mapping from a request path to the system that serves it; here "/search" -> "NEW"
// STATE (before):
//    new_features : { "search": true }        // re-implemented monolith features
//    brand_new    : {}                          // features with no monolith twin
//    route_table  : { "/search": "NEW" }
// DEF: add_feature · CALLED BY: the team to add a feature the monolith never had
// -> feature : "wishlist"
//    step 1 · build "wishlist" as a new microservice   // brand_new : {} -> { "wishlist": true }
//    step 2 · register it in the router   // route_table : { "/search": "NEW" } -> { "/search": "NEW", "/wishlist": "NEW" }
//    step 3 · record it as owned by NEW   // new_features : { "search": true } -> { "search": true, "wishlist": true }
// <- state : NEW now serves { "search": true, "wishlist": true } — MONO never had a wishlist feature to cut over
```

_This is the two-kinds stage — re-implemented features plus brand-new ones that demonstrate microservices' value._

_Covers:_ Two kinds of service

_From the 28 problems:_ 01-scale-from-zero-to-millions · 03-framework-for-system-design-interviews

### Q4

The migration is only half done, so the monolith and the strangler are both live. Your operations team now has two systems to deploy and run for the same business.

**Interviewer's question:** What is the cost of running the strangler alongside the monolith?

**Solution:** During the migration the monolith and the strangler both run, and both must be operated and deployed, so you pay for two systems side by side for as long as the migration takes.

**System-design components:**
- Monolith — still live
- Strangler — also live
- Two deploys — per release
- The cost lasts — until the monolith retires

```mermaid
flowchart LR
  RELEASE["Release"] -->|"deploy"| MONO["Monolith"]
  RELEASE -->|"deploy"| NEW["Strangler"]
  MONO -->|"until retired"| COST["two systems to run"]
  NEW --> COST
```

```java
// OPS SIDE — one release must deploy both systems, so the migration cost is two systems side by side
// PARTIES: MONO = legacy monolith · NEW = new strangler application · OPS = operations team
// STATE (before):
//    systems : { "MONO": true }           // only the monolith was running before migration
//    deploys : 0                          // systems deployed per release
// DEF: release · CALLED BY: OPS on each change
// -> version : "r2026-09"
//    step 1 · the strangler goes live alongside the monolith   // systems : { "MONO": true } -> { "MONO": true, "NEW": true }
//    step 2 · deploy both systems this release   // deploys : 0 -> 2   BECAUSE both must be operated and deployed
//    step 3 · the double cost persists while both are live   // retired : false -> false   // the monolith is not gone yet
// <- systems : 2 live · deploys : 2 per release · you pay for two systems for as long as the migration takes
//    alt migration complete : systems : { "MONO": true, "NEW": true } -> { "NEW": true }   BECAUSE the legacy monolith is finally retired
```

_This is the cost stage — two systems to run side by side until the strangling finishes and the legacy monolith is retired._

_Covers:_ Two systems to run

_From the 28 problems:_ 01-scale-from-zero-to-millions · 03-framework-for-system-design-interviews

## Key Concepts

### The Problem

**Migrating the monolith.** The question the pattern answers: how do you migrate a legacy monolithic application to a microservice architecture?


### The Solution

Modernize by incrementally developing a new (strangler) application around the legacy application; the strangler has a microservice architecture.

```mermaid
flowchart LR
  MONO["Monolith"] -->|"re-implement search"| NEW["New system"]
  NEW -->|"search served"| NEW
  MONO -->|"keeps"| REST["checkout + accounts"]
```


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| Strangler application | Modernize by incrementally developing a new (strangler) application around the legacy application; the strangler has a microservice architecture. | A router that forwards migrated paths to new services and leaves the rest on the monolith. |
| Two systems to run | You pay for two systems side by side for as long as the migration takes. | A router that sends some paths to new services and the rest to the monolith during the same release. |
| Two kinds of service | You must manage both kinds: re-implementations and net-new features; the new-feature services are useful because they demonstrate microservices' value to the business. | A recommendations service that never existed in the monolith, shipped alongside a migrated catalog service. |


### Tradeoffs & When

- You pay for two systems side by side for as long as the migration takes.
- You must manage both kinds: re-implementations and net-new features; the new-feature services are useful because they demonstrate microservices' value to the business.


<details><summary>All concepts (index)</summary>

### Problem: Migrating the monolith

**Why.** A team wants microservices but starts with a working legacy monolith that cannot be replaced in one move.

**Claim.** The question the pattern answers: how do you migrate a legacy monolithic application to a microservice architecture?

**Grounding.** This is the pattern's problem statement, taken verbatim.

**In the wild.** A long-running monolith whose features are moved to services a few at a time.
### Solution: Strangler application

**Why.** You cannot replace the monolith in one step, so you need a way to build the new system gradually while the old one keeps running.

**Claim.** Modernize by incrementally developing a new (strangler) application around the legacy application; the strangler has a microservice architecture.

**Grounding.** This is the pattern's solution statement, which adds that the strangler consists of two types of services: re-implemented monolith functionality, and new features.

**In the wild.** A router that forwards migrated paths to new services and leaves the rest on the monolith.
### Tradeoff: Two systems to run

**Why.** During the migration the monolith and the strangler both run, and both must be operated and deployed.

**Claim.** You pay for two systems side by side for as long as the migration takes.

**Grounding.** The solution keeps the legacy application running while the strangler is built around it, so both are live at once.

**In the wild.** A router that sends some paths to new services and the rest to the monolith during the same release.
### Tradeoff: Two kinds of service

**Why.** The strangler mixes services that replace monolith functionality with services that add brand-new features.

**Claim.** You must manage both kinds: re-implementations and net-new features; the new-feature services are useful because they demonstrate microservices' value to the business.

**Grounding.** The reference names both types explicitly and calls the new-feature services particularly useful for showing business value.

**In the wild.** A recommendations service that never existed in the monolith, shipped alongside a migrated catalog service.

</details>


## Quiz

1. How does the strangler application migrate a monolith?

   - A. Rewrite the whole monolith in one release
   - B. Incrementally build a new application around the legacy application
   - C. Freeze the monolith and start over from scratch
   - D. Split the monolith's database into many databases first

<details><summary>Reveal answer</summary>

**B.** The solution is to modernize by incrementally developing a new (strangler) application around the legacy application. A, C and D are one-shot or wrong-order approaches the pattern does not prescribe.

</details>

2. What two types of services make up the strangler application?

   - A. Services that re-implement monolith functionality, and services that implement new features
   - B. Services that cache data, and services that log events
   - C. Services that authenticate users, and services that bill customers
   - D. Services that run on VMs, and services that run in containers

<details><summary>Reveal answer</summary>

**A.** The reference names exactly these two types: re-implementations of functionality that previously resided in the monolith, and services for new features. B, C and D are unrelated groupings.

</details>

3. Why are the new-feature services particularly useful?

   - A. They are faster to write than re-implementations
   - B. They demonstrate to the business the value of using microservices
   - C. They never need to talk to the monolith
   - D. They are the only services the router needs

<details><summary>Reveal answer</summary>

**B.** The reference says the new-feature services are particularly useful since they demonstrate to the business the value of using microservices. The other options are not stated.

</details>

4. A request arrives for a path the strangler has not yet migrated. What happens?

   - A. It is dropped
   - B. It falls back to the monolith
   - C. It is queued until the path is migrated
   - D. It is retried against every service

<details><summary>Reveal answer</summary>

**B.** The strangler routes migrated paths to the new services and leaves everything else on the monolith, so an unmigrated path falls back to the monolith. A, C and D describe behaviors the pattern does not have.

</details>

