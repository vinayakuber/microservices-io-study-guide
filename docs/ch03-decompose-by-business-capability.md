# Chapter 3: Decompose by Business Capability

> Define services corresponding to business capabilities — the things the business does in order to generate value.

_Also known as: Chris Richardson · Microservice Patterns Ch. 3 · microservices.io /patterns/decomposition/decompose-by-business-capability.html_

## Flow

### Why decomposition must be deliberate

> **Why this matters:** Microservice benefits are not automatic; they come only from a decomposition where each change touches one service — the goal of SRP and CCP.

1. **Benefits are not guaranteed** — Continuous delivery and small autonomous teams are achieved only by careful functional decomposition of the application into services.

2. **Apply the Single Responsibility Principle** — SRP defines a responsibility as a reason to change; a service should have one reason to change and implement a small set of strongly related functions.

3. **Apply the Common Closure Principle** — CCP says classes that change for the same reason belong in the same package, so a rule change touches only one service.

4. **Keep changes single-service** — Changes that affect multiple services require coordination across multiple teams, which slows development.

```java
// CHANGE SIDE — one business rule change must touch one service (CCP), not many
// PARTIES: DEV = developer · SVC_O = order service · SVC_I = inventory service · SVC_D = delivery service
// DEF: impact — the footprint of a change, i.e. which services it touches; here impact = { "SVC_O":0, "SVC_I":0, "SVC_D":0 }
// STATE (before):
//    change_impact : { "SVC_O":0, "SVC_I":0, "SVC_D":0 }
//    teams_to_coordinate : 0
// DEF: change · CALLED BY: DEV changing the tax rule
// -> rule : "tax_rule"
//    step 1 · locate the owning service : owner : "unknown" -> "SVC_O"   BECAUSE the rule is packaged with the code that changes with it (CCP)
//    step 2 · edit only that service : change_impact["SVC_O"] : 0 -> 1
//    step 3 · coordinate one team : teams_to_coordinate : 0 -> 1
// <- services_touched : 1 · teams_to_coordinate : 1
//    alt rule scattered across 3 services : services_touched : 1 -> 3 (three teams must coordinate)
```

### Business capabilities define the services

> **Why this matters:** A business capability is what the business does to generate value, and it often maps to a business object — a stable, natural service boundary.

1. **A capability generates value** — A business capability is a concept from business architecture modeling: something the business does in order to generate value.

2. **Capabilities map to business objects** — A capability often corresponds to a business object — Order Management is responsible for orders, Customer Management for customers.

3. **Capabilities form a hierarchy** — Business capabilities are often organized into a multi-level hierarchy, such as Product/Service development and Product/Service delivery.

4. **One service per capability** — Define services corresponding to business capabilities, so an online store gets product catalog, inventory, order and delivery services.

```java
// DECOMPOSITION SIDE — each business capability becomes one service
// PARTIES: ARC = architect · CAP = business-capability model
// STATE (before):
//    capabilities : { "product_catalog":{object:"Product"}, "inventory":{object:"Stock"}, "order":{object:"Order"}, "delivery":{object:"Shipment"} }
//    services : []
//    owners : {}
// DEF: decompose · CALLED BY: ARC mapping the online store's capabilities to services
// -> capability_set : ["product_catalog","inventory","order","delivery"]
//    step 1 · one service per capability : services : [] -> ["catalog","inventory","order","delivery"]
//    step 2 · attach the business object each capability manages : owners : {} -> {"catalog":"Product","inventory":"Stock","order":"Order","delivery":"Shipment"}
//    step 3 · place them under a top-level capability category : category : "none" -> "Product/Service delivery"   BECAUSE capabilities form a multi-level hierarchy
//    step 4 · a client query is served by the owning service : query "GET /products/P-1" -> served by "catalog"   BECAUSE owners maps Product -> catalog
// <- service_count : 4 · each service corresponds to one business capability · queries route to the owning service (read path)
//    alt merge delivery into order : services : 4 -> 3  (a capability group can map to one service)
```

### Forces the decomposition must satisfy

> **Why this matters:** A good decomposition keeps the architecture stable, services cohesive and loosely coupled, and each service small enough for a two-pizza team.

1. **Stable and cohesive** — The architecture must be stable, and a service should implement a small set of strongly related functions.

2. **Conform to CCP** — Things that change together should be packaged together, so each change affects only one service.

3. **Loosely coupled via an API** — Each service has an API that encapsulates its implementation, so the implementation can change without affecting clients.

4. **Small and testable** — Each service must be small enough to be developed by a two-pizza team of 6-10 people and be testable, with autonomous ownership.

```java
// SIZING SIDE — a service must fit a two-pizza team (6-10 people) and hide its implementation behind an API
// PARTIES: ORG = engineering org
// DEF: api — the interface a service exposes so clients call it without seeing its implementation; here api = { exposed: 0 }
// DEF: service — a cohesive, loosely coupled unit small enough for a 6-10 person team and testable; here service = a 7-member team
// STATE (before):
//    team : { members: 2 }
//    service_api : { exposed: 0 }
// DEF: size_check · CALLED BY: ORG validating a proposed service boundary
// -> members : 2
//    step 1 · grow the team into the 6-10 band : team.members : 2 -> 7   BECAUSE a service must be developable by a two-pizza team of 6-10 people
//    step 2 · encapsulate the implementation : service_api.exposed : 0 -> 1   BECAUSE loose coupling needs an API the client calls, not internals
//    step 3 · confirm the service is testable at its size : testable : "unknown" -> "yes"
// <- verdict : "fits" · 7 members in [6,10] · implementation hidden behind an API
//    alt team stays at 2 : verdict : "fits" -> "split the service"  (two people cannot own a too-large service)
```

### Identifying the capabilities

> **Why this matters:** You find capabilities by understanding the business — its purpose, structure, processes and expertise — starting from the org structure and the domain model.

1. **Understand the business first** — Identifying business capabilities requires understanding the organization's purpose, structure, business processes and areas of expertise.

2. **Start from the organization structure** — Different groups within an organization might correspond to business capabilities or capability groups.

3. **Start from the domain model** — Business capabilities often correspond to domain objects in the high-level domain model.

4. **Iterate** — Bounded contexts are best identified using an iterative process, refining the boundaries over time.

```java
// IDENTIFICATION SIDE — find capabilities from the org structure and the domain model
// PARTIES: ARC = architect analyzing the organization
// DEF: domain — the high-level domain model, a map of the business's key objects; here domain = { "Product":{}, "Order":{} }
// DEF: object — a domain object, a business thing a capability manages; here object = "Product"
// DEF: org — the organization structure, its groups and areas of expertise; here org = { "Merchandising":{}, "Warehouse":{}, "Customer Service":{} }
// STATE (before):
//    org_groups : { "Merchandising":{}, "Warehouse":{}, "Customer Service":{} }
//    domain_objects : { "Product":{}, "Order":{} }
//    capabilities : []
// DEF: identify · CALLED BY: ARC deriving capabilities from two starting points
// -> group : "Warehouse"
//    step 1 · map an org group to a capability : capabilities : [] -> ["inventory management"]
//    step 2 · cross-check the domain model : domain_objects["Order"].capability : "none" -> "order management"   BECAUSE capabilities often correspond to domain objects
//    step 3 · record the area of expertise : expertise : "none" -> "warehouse operations"   BECAUSE expertise marks a distinct capability area
// <- capabilities : ["inventory management","order management"] · found via org structure + domain model
//    alt a capability is missed : capabilities : 2 -> 3 on a later pass (identification is iterative)
```


## System Design Interview

> **The question:** Design a service boundary. Premise: each business capability becomes one service (catalog) owned by one autonomous team, so the service owns its data and its lifecycle end to end.

**The pipeline:** business capability → service → autonomous team

### a business capability — e.g. product catalog

_Role: business capability_

```mermaid
flowchart TD
  R["a business capability — e.g. product catalog"]
  R -->|"comprises"| P0["something the business does to generate value"]
  R -->|"comprises"| P1["maps to a business object — Product"]
```

### the service — e.g. the catalog service

_Role: service (owns its data)_

```mermaid
flowchart TD
  R["the service — e.g. the catalog service"]
  R -->|"comprises"| P0["owns the capability business object and its data"]
  R -->|"comprises"| P1["owns its database — PostgreSQL 16 @ catalog-db-1"]
  R -->|"comprises"| P2["hides its implementation behind an API"]
```

### the autonomous team

_Role: team (owns the service)_

```mermaid
flowchart TD
  R["the autonomous team"]
  R -->|"comprises"| P0["a two-pizza team of 6-10 people"]
  R -->|"comprises"| P1["develops, tests and deploys the service alone"]
```

```java
// SYSTEM DESIGN — decompose by business capability: business capability (Product) -> service (catalog, owns its data) -> autonomous two-pizza team (owns the service)
// PARTIES: CAP = business capability (Product — what the business does to generate value) · SVC = catalog service (owns the Product data) · DB = PostgreSQL 16 @ catalog-db-1 (the catalog service's own database) · TEAM = autonomous two-pizza team (6-10 people owning the service)
// DEF: capability — something the business does to generate value; here "product catalog" manages business object "Product"
// DEF: service — a cohesive, loosely coupled unit that owns one capability and its data; here "catalog"
// DEF: product — the business object the catalog capability manages; here "P-1" = {name:"Widget"}
// STATE (before):
//    products : {}   // the Product rows the catalog service owns (in DB)
// DEF: serve_product · CALLED BY: a client query "GET /products/P-1" routed to the owning capability
// -> product_id : "P-1"
//    step 1 · CAP routes the query to the owning service    route : "unknown" -> "catalog"
//    step 2 · SVC creates the row in its own DB    products : {} -> { "P-1": {name:"Widget"} }
//    step 3 · SVC reads it back to answer    GET /products/P-1 -> { id:"P-1", name:"Widget" }
//    step 4 · TEAM ships the change alone    deploy : "lockstep" -> "single-service"   BECAUSE one team owns one service
// <- outcome : client sees "P-1" name "Widget" · one capability, one service, one team
```

## Interview Questions

### Q1

A discount rule currently lives in three services, so every change to it means coordinating three teams. The lead asks how the decomposition should have avoided this.

**Interviewer's question:** How do the Single Responsibility Principle and the Common Closure Principle guide decomposition so that one change touches one service?

**Solution:** SRP gives a service one reason to change; CCP packages code that changes for the same reason together, so a rule change stays in one service.

**System-design components:**
- SRP — one reason to change
- CCP — change together, package together
- Single-service change
- One-team coordination

```java
// CHANGE SIDE — one business rule change must touch one service (CCP), not many
// PARTIES: DEV = developer · SVC_O = order service · SVC_B = billing service · SVC_D = delivery service
// DEF: impact — the footprint of a change, i.e. which services it touches; here impact = { "SVC_O":0, "SVC_B":0, "SVC_D":0 }
// STATE (before):
//    change_impact : { "SVC_O":0, "SVC_B":0, "SVC_D":0 }
//    teams_to_coordinate : 0
// DEF: change · CALLED BY: DEV changing the discount rule
// -> rule : "discount_rule"
//    step 1 · locate the owning service : owner : "unknown" -> "SVC_O"   BECAUSE the rule is packaged with the code that changes with it (CCP)
//    step 2 · edit only that service : change_impact["SVC_O"] : 0 -> 1
//    step 3 · coordinate one team : teams_to_coordinate : 0 -> 1
// <- services_touched : 1 · teams_to_coordinate : 1
//    alt rule scattered across 3 services : services_touched : 1 -> 3 (three teams must coordinate)
```

_This is exactly SRP and CCP applied to service decomposition in this chapter._

_Covers:_ Why decomposition must be deliberate

_From the 28 problems:_ 01-scale-from-zero-to-millions · 03-framework-for-system-design-interviews

### Q2

The team needs stable service boundaries for an online store. Order Management owns orders, Customer Management owns customers — the architect wants the rule that turns these into services.

**Interviewer's question:** What is a business capability, how does it map to a business object, and how does that produce one service per capability?

**Solution:** A business capability is something the business does to generate value; it often corresponds to a business object, and each capability becomes a service.

**System-design components:**
- Business capability — generates value
- Business object — Product, Order, Stock
- Capability hierarchy — multi-level
- One service per capability

```java
// DECOMPOSITION SIDE — each business capability becomes one service
// PARTIES: ARC = architect · CAP = business-capability model
// STATE (before):
//    capabilities : { "catalog":{object:"Product"}, "inventory":{object:"Stock"}, "order":{object:"Order"}, "billing":{object:"Invoice"} }
//    services : []
//    owners : {}
// DEF: decompose · CALLED BY: ARC mapping the online store's capabilities to services
// -> capability_set : ["catalog","inventory","order","billing"]
//    step 1 · one service per capability : services : [] -> ["catalog","inventory","order","billing"]
//    step 2 · attach the business object each capability manages : owners : {} -> {"catalog":"Product","inventory":"Stock","order":"Order","billing":"Invoice"}
//    step 3 · place them under a top-level category : category : "none" -> "Product/Service delivery"   BECAUSE capabilities form a multi-level hierarchy
// <- service_count : 4 · each service corresponds to one business capability
//    alt merge billing into order : services : 4 -> 3  (a capability group can map to one service)
```

_This is exactly the business-capability definition and its mapping to business objects and services._

_Covers:_ Business capabilities define the services

_From the 28 problems:_ 01-scale-from-zero-to-millions · 03-framework-for-system-design-interviews

### Q3

A proposed service is owned by two people and exposes its database schema to callers. The architect flags it against the pattern's forces.

**Interviewer's question:** What four forces must a decomposition satisfy, and why do a 6-10 person team and an API matter?

**Solution:** The architecture must be stable, cohesive, loosely coupled via an API, and small enough for a two-pizza team to test and own.

**System-design components:**
- Stable + cohesive services
- CCP conformity
- API-encapsulated implementation
- Two-pizza team (6-10)

```java
// SIZING SIDE — a service must fit a two-pizza team (6-10 people) and hide its implementation behind an API
// PARTIES: ORG = engineering org
// DEF: api — the interface a service exposes so clients call it without seeing its implementation; here api = { exposed: 0 }
// DEF: service — a cohesive, loosely coupled unit small enough for a 6-10 person team and testable; here service = an 8-member team
// STATE (before):
//    team : { members: 2 }
//    service_api : { exposed: 0 }
// DEF: size_check · CALLED BY: ORG validating a proposed service boundary
// -> members : 2
//    step 1 · grow the team into the 6-10 band : team.members : 2 -> 8   BECAUSE a service must be developable by a two-pizza team of 6-10 people
//    step 2 · encapsulate the implementation : service_api.exposed : 0 -> 1   BECAUSE loose coupling needs an API the client calls, not internals
//    step 3 · confirm the service is testable at its size : testable : "unknown" -> "yes"
// <- verdict : "fits" · 8 members in [6,10] · implementation hidden behind an API
//    alt team stays at 2 : verdict : "fits" -> "split the service"  (two people cannot own a too-large service)
```

_This is exactly the four forces — stable, cohesive, loosely coupled, two-pizza — in this chapter._

_Covers:_ Forces the decomposition must satisfy

_From the 28 problems:_ 01-scale-from-zero-to-millions · 03-framework-for-system-design-interviews

### Q4

The team has the code but not the boundaries; the architect proposes starting from the org chart and the domain model.

**Interviewer's question:** What two starting points help identify business capabilities, and why is the process iterative?

**Solution:** Start from the organization structure and the high-level domain model, then refine the boundaries iteratively.

**System-design components:**
- Organization structure
- High-level domain model
- Areas of expertise
- Iterative refinement

```java
// IDENTIFICATION SIDE — find capabilities from the org structure and the domain model
// PARTIES: ARC = architect analyzing the organization
// DEF: domain — the high-level domain model, a map of the business's key objects; here domain = { "Product":{}, "Order":{} }
// DEF: org — the organization structure, its groups and areas of expertise; here org = { "Merchandising":{}, "Warehouse":{}, "Support":{} }
// STATE (before):
//    org_groups : { "Merchandising":{}, "Warehouse":{}, "Support":{} }
//    domain_objects : { "Product":{}, "Order":{} }
//    capabilities : []
// DEF: identify · CALLED BY: ARC deriving capabilities from two starting points
// -> group : "Warehouse"
//    step 1 · map an org group to a capability : capabilities : [] -> ["inventory management"]
//    step 2 · cross-check the domain model : domain_objects["Order"].capability : "none" -> "order management"   BECAUSE capabilities often correspond to domain objects
//    step 3 · record the area of expertise : expertise : "none" -> "warehouse operations"   BECAUSE expertise marks a distinct capability area
// <- capabilities : ["inventory management","order management"] · found via org structure + domain model
//    alt a capability is missed : capabilities : 2 -> 3 on a later pass (identification is iterative)
```

_This is exactly the two starting points and the iterative identification process in this chapter._

_Covers:_ Identifying the capabilities

_From the 28 problems:_ 01-scale-from-zero-to-millions · 03-framework-for-system-design-interviews

## Key Concepts

### The Problem

**Microservice benefits are not automatic.** Careful functional decomposition into cohesive services is what actually enables independent deployment and small autonomous teams.


### The Solution

Define services corresponding to business capabilities; a capability often corresponds to a business object — Order Management is responsible for orders, Customer Management for customers.

```java
// CHANGE SIDE — one business rule change must touch one service (CCP), not many
// PARTIES: DEV = developer · SVC_O = order service · SVC_B = billing service · SVC_D = delivery service
// DEF: impact — the footprint of a change, i.e. which services it touches; here impact = { "SVC_O":0, "SVC_B":0, "SVC_D":0 }
// STATE (before):
//    change_impact : { "SVC_O":0, "SVC_B":0, "SVC_D":0 }
//    teams_to_coordinate : 0
// DEF: change · CALLED BY: DEV changing the discount rule
// -> rule : "discount_rule"
//    step 1 · locate the owning service : owner : "unknown" -> "SVC_O"   BECAUSE the rule is packaged with the code that changes with it (CCP)
//    step 2 · edit only that service : change_impact["SVC_O"] : 0 -> 1
//    step 3 · coordinate one team : teams_to_coordinate : 0 -> 1
// <- services_touched : 1 · teams_to_coordinate : 1
//    alt rule scattered across 3 services : services_touched : 1 -> 3 (three teams must coordinate)
```


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| Services correspond to business capabilities | Define services corresponding to business capabilities; a capability often corresponds to a business object — Order Management is responsible for orders, Customer Management for customers. | An online store decomposes into product catalog, inventory, order and delivery management, each becoming a service. |
| Capabilities form a multi-level hierarchy | An enterprise application has top-level categories such as Product/Service development, Product/Service delivery and Demand generation, with finer capabilities nested beneath them. | Choosing too coarse a level merges capabilities; too fine a level fragments them. |
| Identifying capabilities takes business understanding | Capabilities are identified by analyzing the organization's purpose, structure, business processes and areas of expertise, using an iterative process. | Different groups within an organization might correspond to capabilities or capability groups. |


### Tradeoffs & When

- An enterprise application has top-level categories such as Product/Service development, Product/Service delivery and Demand generation, with finer capabilities nested beneath them.
- Capabilities are identified by analyzing the organization's purpose, structure, business processes and areas of expertise, using an iterative process.


<details><summary>All concepts (index)</summary>

### Problem: Microservice benefits are not automatic

**Why.** You get faster delivery only if you decompose the application into the right services; the benefits are not guaranteed by adopting microservices.

**Claim.** Careful functional decomposition into cohesive services is what actually enables independent deployment and small autonomous teams.

**Grounding.** The context states the two benefits are achieved only by careful functional decomposition, and applies SRP and CCP to service design.

**In the wild.** A change that touches several services forces coordination across several teams, which slows development.
### Solution: Services correspond to business capabilities

**Why.** A business capability is a stable, value-generating unit of the business, so it makes a stable boundary for a service.

**Claim.** Define services corresponding to business capabilities; a capability often corresponds to a business object — Order Management is responsible for orders, Customer Management for customers.

**Grounding.** The solution defines a business capability as something a business does to generate value, drawn from business architecture modeling.

**In the wild.** An online store decomposes into product catalog, inventory, order and delivery management, each becoming a service.
### Tradeoff: Capabilities form a multi-level hierarchy

**Why.** Capabilities are not flat; they are organized into a hierarchy, so the depth you pick determines service size.

**Claim.** An enterprise application has top-level categories such as Product/Service development, Product/Service delivery and Demand generation, with finer capabilities nested beneath them.

**Grounding.** The solution states business capabilities are often organized into a multi-level hierarchy.

**In the wild.** Choosing too coarse a level merges capabilities; too fine a level fragments them.
### Tradeoff: Identifying capabilities takes business understanding

**Why.** You cannot derive capabilities from code alone; you must understand what the business does.

**Claim.** Capabilities are identified by analyzing the organization's purpose, structure, business processes and areas of expertise, using an iterative process.

**Grounding.** The issues section lists organization structure and the high-level domain model as starting points, and notes capabilities often correspond to domain objects.

**In the wild.** Different groups within an organization might correspond to capabilities or capability groups.

</details>


## Quiz

1. What is a business capability?

   - A. A technical layer such as the database
   - B. Something the business does in order to generate value
   - C. A two-pizza team of 6-10 people
   - D. A deployment pipeline

<details><summary>Reveal answer</summary>

**B.** A business capability is a concept from business architecture modeling: something the business does in order to generate value. The other options are engineering artifacts, not capabilities.

</details>

2. Applying the Single Responsibility Principle to a service means it should...

   - A. have one reason to change and implement a small set of strongly related functions
   - B. share one database with every other service
   - C. be deployed by every team
   - D. expose no API

<details><summary>Reveal answer</summary>

**A.** SRP defines a responsibility as a reason to change; a service should have only one reason to change and be cohesive. Sharing a database, cross-team deployment and hiding the API all contradict the pattern's forces.

</details>

3. The Common Closure Principle states that...

   - A. classes that change for the same reason should be in the same package
   - B. every service must have its own database
   - C. teams must be collocated
   - D. changes must be deployed weekly

<details><summary>Reveal answer</summary>

**A.** CCP states that classes that change for the same reason should be in the same package, so each change touches only one service. The other options are not part of CCP.

</details>

4. Good starting points for identifying business capabilities are...

   - A. the network topology and the load balancer
   - B. the organization structure and the high-level domain model
   - C. the CI pipeline and the merge queue
   - D. the frontend framework and the database vendor

<details><summary>Reveal answer</summary>

**B.** The issues section names organization structure and the high-level domain model as starting points. The other options describe infrastructure, not sources of business capability boundaries.

</details>

