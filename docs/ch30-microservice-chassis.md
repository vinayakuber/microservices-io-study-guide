# Chapter 30: Microservice Chassis

> A shared framework that packages reusable build logic and cross-cutting-concern mechanisms so every new service starts production-ready instead of re-wiring setup.

_Also known as: Chris Richardson · Microservice Patterns Ch. 30 (p.379) · microservices.io /patterns/microservice-chassis.html_

## Flow

### The setup tax

> **Why this matters:** Every service must be built, tested, packaged, and given cross-cutting concerns before its business logic can start. That one-to-two-day cost is trivial for one monolith but unaffordable across tens or hundreds of services.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. The setup tax</b><br/>build, test, package before any business logic"]:::start
  n1["<b>2. Cross-cutting concerns</b><br/>security, config, logging, health, metrics, tracing"]:::step
  n2["<b>3. Microservice extras</b><br/>registration, discovery, circuit breakers"]:::step
  n3["<b>4. Six concerns, three services</b><br/>3 times 6 equals 18 wirings by hand"]:::core
  n4["<b>5. Days per service</b><br/>one to two days each, unaffordable across tens of services"]:::warn
  n5["<b>6. Chassis instead</b><br/>wire the 6 concerns once, services inherit - 6 not 18"]:::core
  n6["<b>7. Minutes per service</b><br/>new service adopts wiring instead of re-building it"]:::stop
  n0 -->|"1. build, test, package"| n1
  n1 -->|"2. add registration and breakers"| n2
  n2 -->|"3. multiply by hand"| n3
  n3 -->|"4. cost explodes"| n4
  n3 -->|"5. centralize the wiring"| n5
  n5 -->|"6. inherit instead of re-wire"| n6
```

1. **Build logic** — Builds, tests, and packages into a production-ready format such as a Docker image — in Java, Gradle or Maven plus CI config (CircleCI, GitHub Actions).

2. **Cross-cutting concerns** — Security via an Access Token, externalized configuration, logging, a health-check URL, metrics, and distributed tracing.

3. **Microservice extras** — Service registration and discovery, plus circuit breakers for partial failure, add to the per-service burden.

4. **Days per service** — Setup takes one to two days per service — affordable for a monolith, not for tens of services.

```java
// TEAM SIDE — wiring six cross-cutting concerns once per service versus once in a chassis
// PARTIES: SVC1 = Order Service · SVC2 = Customer Service · SVC3 = Kitchen Service
// DEF: chassis — the shared framework that wires the 6 cross-cutting concerns once, not per service; here chassis_wiring = { chassis: 0 }
// DEF: manual — wired by hand, one service at a time; here manual_wiring = { SVC1: 0, SVC2: 0, SVC3: 0 } = 18 wirings total
// DEF: wiring — the act of connecting a cross-cutting concern to a service; here 3 services x 6 concerns = 18 wirings
// STATE (before):
//    manual_wiring : { SVC1: 0, SVC2: 0, SVC3: 0 }       // concerns wired by hand, per service
//    chassis_wiring : { chassis: 0 }                     // concerns wired once, inside the chassis
// DEF: setup · CALLED BY: a team standing up 3 new services
// -> concern_count : 6   // = security + config + logging + health + metrics + tracing
// -> service_count : 3
//    step 1 · wire SVC1 by hand    manual_wiring.SVC1 : 0 -> 6   BECAUSE each service re-implements the 6 concerns
//    step 2 · wire SVC2 by hand    manual_wiring.SVC2 : 0 -> 6
//    step 3 · wire SVC3 by hand    manual_wiring.SVC3 : 0 -> 6
//    step 4 · total by hand = 3 services x 6 concerns = 18 wirings
// <- outcome : manual_wiring : { SVC1: 6, SVC2: 6, SVC3: 6 } = 18 wirings total
//    alt chassis : wire once -> chassis_wiring.chassis : 0 -> 6, then SVC1/SVC2/SVC3 inherit = 6 wirings, not 18
```

### What the chassis implements

> **Why this matters:** The chassis is the foundation: reusable build logic and mechanisms for cross-cutting concerns, assembled once and inherited by each service. Adopting it wires a new service in minutes instead of days.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Adopt chassis 2.4.0</b><br/>svc.build : none becomes gradle-plugin:2.4.0"]:::start
  n1["<b>2. Security inherited</b><br/>svc.security : none becomes access-token-check"]:::step
  n2["<b>3. Metrics inherited</b><br/>svc.metrics : none becomes counter:orders_created"]:::step
  n3["<b>4. Tracing inherited</b><br/>svc.tracing : none becomes trace-id-filter"]:::step
  n4["<b>5. Registration inherited</b><br/>svc.registered : false becomes true"]:::step
  n5["<b>6. Boilerplate included</b><br/>database connection pool and HTTP request code shipped"]:::core
  n6["<b>7. Service Template on top</b><br/>sample service holding code that does not belong in the chassis"]:::step
  n7["<b>8. Production-ready service</b><br/>all concerns inherited at once, no re-wiring"]:::stop
  n8["<b>9. Concern omitted</b><br/>an unwired mechanism leaves the service incomplete"]:::warn
  n0 -->|"1. build plugin added"| n1
  n1 -->|"2. access-token check"| n2
  n2 -->|"3. metrics counter"| n3
  n3 -->|"4. tracing filter"| n4
  n4 -->|"5. self-register with the registry"| n5
  n5 -->|"6. boilerplate supplied"| n6
  n6 -->|"7. template layers on top"| n7
  n0 -->|"8. a concern left unwired"| n8
```

1. **Reusable build logic** — The chassis ships build plugins (for example Gradle plugins) that build, test, and package a service.

2. **Cross-cutting mechanisms** — It assembles and configures a collection of frameworks and libraries for security, logging, health checks, metrics, and tracing.

3. **Technology-specific boilerplate** — It also supplies a database connection pool and HTTP request boilerplate.

4. **Service Template on top** — The Service Template is a sample service that uses the chassis, holding the code and configuration that does not belong in it.

```java
// ORDER SERVICE SIDE — a new service adopts the chassis and inherits the cross-cutting wiring
// PARTIES: SVC = Order Service · CHS = chassis framework 2.4.0 · REG = service registry
// STATE (before):
//    svc : { build: "none", security: "none", metrics: "none", tracing: "none", registered: false }
// DEF: adopt_chassis · CALLED BY: a developer scaffolding SVC
// -> chassis_version : "2.4.0"
//    step 1 · add the chassis Gradle plugin          svc.build : "none" -> "gradle-plugin:2.4.0"
//    step 2 · chassis wires access-token security    svc.security : "none" -> "access-token-check"
//    step 3 · chassis wires metrics                  svc.metrics : "none" -> "counter:orders_created"
//    step 4 · chassis wires tracing                  svc.tracing : "none" -> "trace-id-filter"
//    step 5 · chassis self-registers SVC with REG    svc.registered : false -> true
// <- outcome : svc : { build:"gradle-plugin:2.4.0", security:"access-token-check", metrics:"counter:orders_created", tracing:"trace-id-filter", registered:true }
```

### Updating via version bumps

> **Why this matters:** Build logic and cross-cutting concerns change over time. With a chassis, a fix is made once and reaches every service through a version bump; with a Service Template it is copy/pasted into each codebase.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Release chassis once</b><br/>new version 2.4.0 carrying a logging fix"]:::start
  n1["<b>2. Bump Order Service</b><br/>deps.SVC1 : chassis:2.3.0 becomes chassis:2.4.0"]:::step
  n2["<b>3. Bump Customer Service</b><br/>deps.SVC2 : chassis:2.3.0 becomes chassis:2.4.0"]:::step
  n3["<b>4. Bump Kitchen Service</b><br/>deps.SVC3 : chassis:2.3.0 becomes chassis:2.4.0"]:::step
  n4["<b>5. Fix reaches all three</b><br/>dependencies, build logic, cross-cutting logic stay current together"]:::stop
  n5["<b>6. Service Template</b><br/>copy-and-paste the fix into each codebase, one edit per service"]:::warn
  n0 -->|"1. one release"| n1
  n1 -->|"2. version bump"| n2
  n2 -->|"3. version bump"| n3
  n3 -->|"4. all three current"| n4
  n0 -->|"5. template alternative - per-service edits"| n5
```

1. **Release once** — Release a new version of the chassis framework containing the needed change.

2. **Bump each service** — Update each service to use the new chassis version.

3. **Everything stays current** — Dependencies, build logic, and cross-cutting logic are kept up to date together.

4. **Contrast: template** — A Service Template is copy/paste programming — each service must be edited individually when logic changes.

```java
// TEAM SIDE — a chassis upgrade delivers one fix to every service via a version bump
// PARTIES: SVC1 = Order Service · SVC2 = Customer Service · SVC3 = Kitchen Service
// STATE (before):
//    deps : { SVC1: "chassis:2.3.0", SVC2: "chassis:2.3.0", SVC3: "chassis:2.3.0" }
// DEF: upgrade · CALLED BY: the team releasing chassis 2.4.0 (a logging fix)
// -> new_version : "2.4.0"
//    step 1 · release the chassis once at "2.4.0"
//    step 2 · SVC1 bumps its dependency     deps.SVC1 : "chassis:2.3.0" -> "chassis:2.4.0"
//    step 3 · SVC2 bumps its dependency     deps.SVC2 : "chassis:2.3.0" -> "chassis:2.4.0"
//    step 4 · SVC3 bumps its dependency     deps.SVC3 : "chassis:2.3.0" -> "chassis:2.4.0"
// <- outcome : deps : { SVC1: "chassis:2.4.0", SVC2: "chassis:2.4.0", SVC3: "chassis:2.4.0" } · the fix reaches all 3 services
//    alt service template : the fix is copied-and-pasted into 3 separate codebases, one edit per service
```

### One chassis per language

> **Why this matters:** A chassis is tied to a programming language and framework, so a second language forces a second chassis. That is the pattern's main issue: it can be an obstacle to adopting a new language or framework.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Chassis is language-bound</b><br/>Java starts from Spring Boot, Spring Cloud, or Dropwizard"]:::start
  n1["<b>2. Java chassis in place</b><br/>chassis.JVM = chassis-java:2.4.0"]:::core
  n2["<b>3. Team adds a Go service</b><br/>the JVM chassis cannot run Go"]:::warn
  n3["<b>4. Build a second chassis</b><br/>chassis_count : 1 becomes 2, chassis-go:1.0.0 on Gizmo, Micro, or Go kit"]:::step
  n4["<b>5. Re-implement six concerns</b><br/>concerns_in_go : 0 becomes 6"]:::core
  n5["<b>6. Two chassis to maintain</b><br/>upkeep doubles"]:::stop
  n6["<b>7. Adoption obstacle</b><br/>building a second chassis can block a new language"]:::warn
  n7["<b>8. Stay single-language</b><br/>one chassis, but Go adoption stays blocked"]:::stop
  n0 -->|"1. framework-specific base"| n1
  n1 -->|"2. team wants Go"| n2
  n2 -->|"3. JVM chassis cannot serve Go"| n3
  n3 -->|"4. repeat security, config, logging, health, metrics, tracing"| n4
  n4 -->|"5. double the upkeep"| n5
  n5 -->|"6. the main issue of the pattern"| n6
  n1 -->|"7. stay single-language - Go blocked"| n7
```

1. **Language-specific frameworks** — Java starts from Spring Boot/Spring Cloud or Dropwizard; Go starts from Gizmo, Micro, or Go kit.

2. **Second language, second chassis** — Each programming language/framework you want to use needs its own chassis.

3. **Adoption obstacle** — Building a second chassis is work, so it can block adopting a new language or framework.

```java
// TEAM SIDE — a second language forces a second chassis, so upkeep doubles
// PARTIES: JVM = Java services · GO = Go services
// STATE (before):
//    chassis : { JVM: "chassis-java:2.4.0", GO: "none" }
//    chassis_count : 1
//    concerns_in_go : 0
// DEF: adopt_go · CALLED BY: the team adding its first Go service
// -> new_language : "Go"
//    step 1 · the JVM chassis cannot run Go -> build a second one   chassis_count : 1 -> 2
//    step 2 · build chassis-go on a Go framework base               chassis.GO : "none" -> "chassis-go:1.0.0"   BECAUSE Gizmo/Micro/Go kit serve Go, not Java
//    step 3 · re-implement the same concerns in Go                  concerns_in_go : 0 -> 6   BECAUSE security+config+logging+health+metrics+tracing all repeat
// <- outcome : chassis : { JVM: "chassis-java:2.4.0", GO: "chassis-go:1.0.0" } · concerns_in_go : 6 · 2 chassis to keep current
//    alt single-language : only 1 chassis to maintain, but Go adoption stays blocked
```


## System Design Interview

**The pipeline:** service → chassis framework (libraries) → cross-cutting concerns

### Order Service — the new service

_Role: service_

```mermaid
flowchart TD
  R["Order Service — the new service"]
  R --> P0["adopts the chassis via a Gradle plugin"]
  R --> P1["inherits the cross-cutting wiring"]
```

### chassis framework 2.4.0 — the shared libraries

_Role: chassis framework (libraries)_

```mermaid
flowchart TD
  R["chassis framework 2.4.0 — the shared libraries"]
  R --> P0["externalized configuration + health-check URL"]
  R --> P1["logging, metrics (counter: orders_created), and tracing"]
```

### the cross-cutting concerns

_Role: cross-cutting concerns_

```mermaid
flowchart TD
  R["the cross-cutting concerns"]
  R --> P0["security via an Access Token"]
  R --> P1["service registration/discovery + circuit breakers"]
```

```mermaid
flowchart LR
  SVC["Order Service"] -->|"adopts"| CHS["chassis framework 2.4.0"]
  CHS -->|"wires"| CFG["externalized config"]
  CHS -->|"wires"| LOG["logging + health check"]
  CHS -->|"wires"| MET["metrics counter: orders_created"]
  CHS -->|"wires"| TRC["tracing"]
  CHS -->|"registers"| REG["service registry"]
```

```java
// SYSTEM DESIGN — microservice chassis: service (Order Service) -> chassis framework (shared libraries) -> cross-cutting concerns (security, config, logging, health, metrics, tracing)
// PARTIES: SVC = Order Service (adopts the chassis) · CHS = chassis framework 2.4.0 (shared libraries) · REG = service registry (registration target)
// DEF: concern — one cross-cutting capability the chassis wires; here 6 concerns = security + config + logging + health + metrics + tracing
// DEF: wiring — the act of connecting one concern to a service; here 3 services x 6 concerns = 18 wirings by hand, 6 in the chassis
// DEF: counter — a metric the chassis wires; here "counter:orders_created"
// STATE (before):
//    svc : { build:"none", security:"none", metrics:"none", registered:false }
//    wirings : 0
// DEF: adopt_chassis · CALLED BY: a developer scaffolding SVC
// -> chassis_version : "2.4.0"
//    step 1 · add the chassis Gradle plugin    svc.build : "none" -> "gradle-plugin:2.4.0"
//    step 2 · chassis injects security and metrics    svc.security : "none" -> "access-token-check" · svc.metrics : "none" -> "counter:orders_created"
//    step 3 · chassis self-registers SVC with REG    svc.registered : false -> true
//    step 4 · count the wirings done once, not per service    wirings : 0 -> 6  BECAUSE the chassis wires the 6 concerns once and every service inherits them
// <- outcome : svc { build:"gradle-plugin:2.4.0", security:"access-token-check", metrics:"counter:orders_created", registered:true } · wirings 6, not 18
```

## Interview Questions

### Q1

The team is standing up three new services, and each one needs the same six cross-cutting concerns wired before any business logic can start. Doing it by hand costs one to two days per service.

**Interviewer's question:** What is the per-service setup tax, and how does a chassis change the arithmetic?

**Solution:** Every service needs build logic and cross-cutting concerns (security, config, logging, health check, metrics, tracing) plus registration/discovery and circuit breakers; wiring them once in a chassis turns N services times 6 concerns into 6 wirings, not 6N.

**System-design components:**
- Order Service
- Customer Service
- Kitchen Service
- shared chassis

```mermaid
flowchart LR
  C["Chassis"] -->|"wires 6 concerns once"| W["concern wiring"]
  W --> O["Order Service"]
  W --> U["Customer Service"]
  W --> K["Kitchen Service"]
  M["Manual: 3 x 6 = 18 wirings"] -.->|"vs"| W
```

```java
// TEAM SIDE — wiring six cross-cutting concerns once per service versus once in a chassis
// PARTIES: SVC1 = Order Service · SVC2 = Customer Service · SVC3 = Kitchen Service
// DEF: wiring — the act of connecting a cross-cutting concern to a service; here 3 services x 6 concerns = 18 wirings
// STATE (before):
//    manual_wiring : { SVC1: 0, SVC2: 0, SVC3: 0 }       // concerns wired by hand, per service
//    chassis_wiring : { chassis: 0 }                     // concerns wired once, inside the chassis
// DEF: setup · CALLED BY: a team standing up 3 new services
// -> concern_count : 6   // = security + config + logging + health + metrics + tracing
// -> service_count : 3
//    step 1 · wire SVC1 by hand    manual_wiring.SVC1 : 0 -> 6   BECAUSE each service re-implements the 6 concerns
//    step 2 · wire SVC2 by hand    manual_wiring.SVC2 : 0 -> 6
//    step 3 · wire SVC3 by hand    manual_wiring.SVC3 : 0 -> 6
//    step 4 · total by hand = 3 services x 6 concerns = 18 wirings
// <- outcome : manual_wiring : { SVC1: 6, SVC2: 6, SVC3: 6 } = 18 wirings total
//    alt chassis : wire once -> chassis_wiring.chassis : 0 -> 6, then SVC1/SVC2/SVC3 inherit = 6 wirings, not 18
```

_This is the chapter's setup-tax problem: one or two days per service is unaffordable across many services, and the chassis centralizes the wiring._

_Covers:_ The setup tax

_From the 28 problems:_ 01-scale-from-zero-to-millions

### Q2

A developer scaffolds a new Order Service and wants it production-ready in minutes, not days — with build logic, security, metrics, and tracing already in place.

**Interviewer's question:** What does the chassis implement, and what happens when a new service adopts it?

**Solution:** The chassis provides reusable build logic (e.g. Gradle plugins) and mechanisms for cross-cutting concerns; adopting it lets the service inherit the wiring instead of re-implementing it.

**System-design components:**
- Order Service
- chassis framework 2.4.0
- Gradle plugin
- service registry

```mermaid
flowchart LR
  D["Developer"] -->|"scaffolds"| S["Order Service"]
  S -->|"adopts"| C["chassis 2.4.0"]
  C -->|"wires"| B["build"]
  C -->|"wires"| T["security / metrics / tracing"]
  C -->|"registers"| R["service registry"]
```

```java
// ORDER SERVICE SIDE — a new service adopts the chassis and inherits the cross-cutting wiring
// PARTIES: SVC = Order Service · CHS = chassis framework 2.4.0 · REG = service registry
// STATE (before):
//    svc : { build: "none", security: "none", metrics: "none", tracing: "none", registered: false }
// DEF: adopt_chassis · CALLED BY: a developer scaffolding SVC
// -> chassis_version : "2.4.0"
//    step 1 · add the chassis Gradle plugin          svc.build : "none" -> "gradle-plugin:2.4.0"
//    step 2 · chassis wires access-token security    svc.security : "none" -> "access-token-check"
//    step 3 · chassis wires metrics                  svc.metrics : "none" -> "counter:orders_created"
//    step 4 · chassis wires tracing                  svc.tracing : "none" -> "trace-id-filter"
//    step 5 · chassis self-registers SVC with REG    svc.registered : false -> true
// <- outcome : svc : { build:"gradle-plugin:2.4.0", security:"access-token-check", metrics:"counter:orders_created", tracing:"trace-id-filter", registered:true }
```

_This is the chapter's what-the-chassis-implements step: reusable build logic plus cross-cutting mechanisms, inherited on adoption._

_Covers:_ What the chassis implements

_From the 28 problems:_ 01-scale-from-zero-to-millions

### Q3

A logging vulnerability is fixed in the shared library. The team must push the fix to Order, Customer, and Kitchen services without editing each codebase by hand.

**Interviewer's question:** How do services receive updates to build logic and cross-cutting concerns under the chassis pattern?

**Solution:** The team releases one new chassis version and bumps each service to it — the fix reaches every service through a version bump, versus copy/paste programming where a Service Template must be edited per service.

**System-design components:**
- Order Service
- Customer Service
- Kitchen Service
- chassis release

```mermaid
flowchart LR
  R["Release chassis 2.4.0"] -->|"bump"| O["Order Service"]
  R -->|"bump"| U["Customer Service"]
  R -->|"bump"| K["Kitchen Service"]
  O -->|"2.3.0 -> 2.4.0"| V["fix delivered"]
```

```java
// TEAM SIDE — a chassis upgrade delivers one fix to every service via a version bump
// PARTIES: SVC1 = Order Service · SVC2 = Customer Service · SVC3 = Kitchen Service
// STATE (before):
//    deps : { SVC1: "chassis:2.3.0", SVC2: "chassis:2.3.0", SVC3: "chassis:2.3.0" }
// DEF: upgrade · CALLED BY: the team releasing chassis 2.4.0 (a logging fix)
// -> new_version : "2.4.0"
//    step 1 · release the chassis once at "2.4.0"
//    step 2 · SVC1 bumps its dependency     deps.SVC1 : "chassis:2.3.0" -> "chassis:2.4.0"
//    step 3 · SVC2 bumps its dependency     deps.SVC2 : "chassis:2.3.0" -> "chassis:2.4.0"
//    step 4 · SVC3 bumps its dependency     deps.SVC3 : "chassis:2.3.0" -> "chassis:2.4.0"
// <- outcome : deps : { SVC1: "chassis:2.4.0", SVC2: "chassis:2.4.0", SVC3: "chassis:2.4.0" } · the fix reaches all 3 services
//    alt service template : the fix is copied-and-pasted into 3 separate codebases, one edit per service
```

_This is the chapter's version-bump benefit: release once, bump each service, versus copy/paste per codebase._

_Covers:_ Updating via version bumps

_From the 28 problems:_ 01-scale-from-zero-to-millions

### Q4

The team adds its first Go service, but the chassis is a Java framework built on Spring Boot. The Go service cannot inherit it.

**Interviewer's question:** What is the main issue of the Microservice Chassis pattern when a new language enters the picture?

**Solution:** A chassis is tied to a programming language and framework, so each new language needs its own chassis — building a second chassis re-implements the same concerns and can be an obstacle to adopting the new language.

**System-design components:**
- Java chassis
- Go chassis
- Gizmo/Micro/Go kit
- second chassis

```mermaid
flowchart LR
  J["Java services"] -->|"use"| JC["chassis-java:2.4.0"]
  G["Go service"] -.->|"cannot use"| JC
  G -->|"builds"| GC["chassis-go:1.0.0"]
  GC -->|"re-wires 6 concerns"| X["duplicated work"]
```

```java
// TEAM SIDE — a second language forces a second chassis, so upkeep doubles
// PARTIES: JVM = Java services · GO = Go services
// STATE (before):
//    chassis : { JVM: "chassis-java:2.4.0", GO: "none" }
//    chassis_count : 1
//    concerns_in_go : 0
// DEF: adopt_go · CALLED BY: the team adding its first Go service
// -> new_language : "Go"
//    step 1 · the JVM chassis cannot run Go, build a second one   chassis_count : 1 -> 2
//    step 2 · build chassis-go on a Go framework base               chassis.GO : "none" -> "chassis-go:1.0.0"   BECAUSE Gizmo/Micro/Go kit serve Go, not Java
//    step 3 · re-implement the same concerns in Go                  concerns_in_go : 0 -> 6   BECAUSE security+config+logging+health+metrics+tracing all repeat
// <- outcome : chassis : { JVM: "chassis-java:2.4.0", GO: "chassis-go:1.0.0" } · concerns_in_go : 6 · 2 chassis to keep current
//    alt single-language : only 1 chassis to maintain, but Go adoption stays blocked
```

_This is the chapter's one-chassis-per-language issue: adopting a new language means rebuilding the chassis and its concerns._

_Covers:_ One chassis per language

_From the 28 problems:_ 01-scale-from-zero-to-millions

## Key Concepts

### The Problem

**The per-service setup tax.** One or two days of setup per service is fine for a monolith, but unaffordable across tens or hundreds of microservices.


### The Solution

A microservice chassis provides reusable build logic and mechanisms for cross-cutting concerns as one framework; the Service Template is a sample service built on it.

```mermaid
flowchart LR
  C["Chassis"] -->|"wires 6 concerns once"| W["concern wiring"]
  W --> O["Order Service"]
  W --> U["Customer Service"]
  W --> K["Kitchen Service"]
  M["Manual: 3 x 6 = 18 wirings"] -.->|"vs"| W
```


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| A shared chassis framework | A microservice chassis provides reusable build logic and mechanisms for cross-cutting concerns as one framework; the Service Template is a sample service built on it. | Services depend on the chassis and inherit the wiring instead of re-implementing it. |
| Version bumps vs copy/paste | The chassis lets a team release one new version and bump each service, while a Service Template forces per-service edits — copy/paste programming. | The Service Template survives as a sample that holds code and configuration that does not belong in the chassis. |
| One chassis per language | Adopting a new language or framework requires building a second chassis, which is an obstacle to adoption. | A Java chassis does not run Go services, so a Go team rebuilds the same wiring. |


### Tradeoffs & When

- The chassis lets a team release one new version and bump each service, while a Service Template forces per-service edits — copy/paste programming.
- Adopting a new language or framework requires building a second chassis, which is an obstacle to adoption.


<details><summary>All concepts (index)</summary>

### Problem: The per-service setup tax

**Why.** Every new service needs build logic and cross-cutting concerns before any business logic can start.

**Claim.** One or two days of setup per service is fine for a monolith, but unaffordable across tens or hundreds of microservices.

**Grounding.** The reference lists build logic (Gradle/Maven, Docker packaging, CI config) plus six cross-cutting concerns — security, externalized configuration, logging, health check, metrics, distributed tracing — and microservice extras like registration/discovery and circuit breakers.

**In the wild.** Teams re-created this wiring by hand for every service until the chassis centralised it.
### Solution: A shared chassis framework

**Why.** Every service needs the same build logic and cross-cutting mechanisms.

**Claim.** A microservice chassis provides reusable build logic and mechanisms for cross-cutting concerns as one framework; the Service Template is a sample service built on it.

**Grounding.** The chassis ships build plugins (Gradle plugins) and assembles frameworks for security, logging, health checks, metrics, and tracing; Java starts from Spring Boot/Spring Cloud or Dropwizard, Go from Gizmo, Micro, or Go kit.

**In the wild.** Services depend on the chassis and inherit the wiring instead of re-implementing it.
### Tradeoff: Version bumps vs copy/paste

**Why.** Build logic and cross-cutting concerns change over time.

**Claim.** The chassis lets a team release one new version and bump each service, while a Service Template forces per-service edits — copy/paste programming.

**Grounding.** The reference benefit: it is faster and easier to keep dependencies, build logic, and cross-cutting logic up to date by releasing a new chassis version.

**In the wild.** The Service Template survives as a sample that holds code and configuration that does not belong in the chassis.
### Tradeoff: One chassis per language

**Why.** A chassis is tied to a programming language and framework.

**Claim.** Adopting a new language or framework requires building a second chassis, which is an obstacle to adoption.

**Grounding.** The reference issue: you need a microservice chassis for each programming language/framework you want to use.

**In the wild.** A Java chassis does not run Go services, so a Go team rebuilds the same wiring.

</details>


## Quiz

1. What is the main drawback of the Service Template approach?

   - A. It requires a separate template per programming language.
   - B. It is copy/paste programming — when build logic or cross-cutting concerns change, each service must be updated individually.
   - C. It cannot package services into Docker images.
   - D. It cannot include build logic.

<details><summary>Reveal answer</summary>

**B.** A Service Template is a source code template you copy, so a change must be repeated in every service — the copy/paste drawback the chassis avoids. Option A describes the chassis's own per-language issue, and C and D are false: templates do package services and include build logic.

</details>

2. Which of these is a cross-cutting concern the reference lists?

   - A. Service registration and discovery.
   - B. Business rules for order validation.
   - C. Database schema design.
   - D. Feature flags for a UI.

<details><summary>Reveal answer</summary>

**A.** Service registration and discovery is one of the additional microservice cross-cutting concerns, alongside circuit breakers. Options B, C, and D are business or domain concerns, not cross-cutting concerns.

</details>

3. How do services receive updates to build logic and cross-cutting concerns under the chassis pattern?

   - A. Each service re-implements them by hand.
   - B. You release a new chassis version and update each service to use it.
   - C. A shared runtime patches services automatically.
   - D. Changes are never needed.

<details><summary>Reveal answer</summary>

**B.** The benefit is releasing a new chassis version and bumping each service. Option A is the naive per-service approach, and C and D are not in the reference — updates are explicit version bumps, and changes do occur.

</details>

4. What is one issue of the Microservice Chassis pattern?

   - A. It only works for Java.
   - B. It needs a chassis per programming language/framework, an obstacle to adopting a new language.
   - C. It prevents the use of Gradle or Maven.
   - D. It forces a monolith.

<details><summary>Reveal answer</summary>

**B.** The reference states you need a chassis for each language/framework you want to use, which can block adopting a new one. Option A is false (Go has Gizmo/Micro/Go kit), and C and D contradict the reference (Gradle/Maven are supported and the pattern is for microservices).

</details>

