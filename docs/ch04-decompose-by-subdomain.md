# Chapter 4: Decompose by Subdomain

> Define services corresponding to Domain-Driven Design subdomains — distinct parts of the business, classified as core, supporting, or generic.

_Also known as: Chris Richardson · Microservice Patterns Ch. 4 · microservices.io /patterns/decomposition/decompose-by-subdomain.html_

## Flow

### The domain and its subdomains

> **Why this matters:** DDD calls the application's problem space the domain, and its parts are subdomains — the boundaries this pattern turns into services.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. The domain is the problem space</b><br/>DDD calls the business the domain"]:::start
  n1["<b>2. Split the problem space into parts</b><br/>domain parts empty becomes catalog, inventory, orders, delivery"]:::core
  n2["<b>3. Each part becomes a subdomain</b><br/>subdomains empty becomes the four named subdomains"]:::step
  n3["<b>4. Tag each as distinct</b><br/>distinct_areas 0 becomes 4"]:::step
  n4["<b>5. Four subdomains</b><br/>the domain holds multiple subdomains"]:::stop
  n5["<b>A part is really two subdomains</b><br/>subdomain_count 4 becomes 5, found by iteration"]:::warn
  n0 -->|"1. split"| n1
  n1 -->|"2. name them"| n2
  n2 -->|"3. distinct areas"| n3
  n3 -->|"4. count"| n4
  n3 -->|"5. if one splits"| n5
```

1. **The domain is the problem space** — DDD refers to the application's problem space — the business — as the domain.

2. **A domain has multiple subdomains** — A domain consists of multiple subdomains, and each subdomain corresponds to a different part of the business.

3. **Subdomains are the service boundaries** — Define services corresponding to DDD subdomains, so each part of the business becomes a service.

4. **An online store example** — The subdomains of an online store include product catalog, inventory management, order management and delivery management.

```java
// DECOMPOSITION SIDE — the DDD domain (the business) splits into subdomains
// PARTIES: ARC = architect · DOM = the domain (the application's problem space)
// STATE (before):
//    domain : { parts: [] }
//    subdomains : []
// DEF: split · CALLED BY: ARC modeling the domain of an online store
// -> domain : "online store"
//    step 1 · split the problem space into parts : domain.parts : [] -> ["catalog","inventory","orders","delivery"]
//    step 2 · each part becomes a subdomain : subdomains : [] -> ["product catalog","inventory management","order management","delivery management"]
//    step 3 · tag each as a distinct part of the business : distinct_areas : 0 -> 4   BECAUSE each subdomain corresponds to a different part of the business
// <- subdomain_count : 4 · the domain holds multiple subdomains
//    alt a part is really two subdomains : subdomain_count : 4 -> 5 (a subdomain is found by iteration)
```

### Classify each subdomain

> **Why this matters:** Not every subdomain deserves the same investment, so DDD classifies them by business value before you build.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Classify by business value</b><br/>not every subdomain deserves equal effort"]:::start
  n1["<b>2. A differentiator is CORE</b><br/>recommendations unset becomes core"]:::core
  n2["<b>3. Related but not differentiating is SUPPORTING</b><br/>accounting unset becomes supporting"]:::step
  n3["<b>4. Not business-specific is GENERIC</b><br/>email unset becomes generic"]:::step
  n4["<b>5. Three classes set</b><br/>invest in core first, outsource or buy the rest"]:::stop
  n5["<b>Every subdomain marked core</b><br/>prioritize 1 becomes 3, no differentiator"]:::warn
  n0 -->|"1. rate it"| n1
  n1 -->|"2. next"| n2
  n2 -->|"3. next"| n3
  n3 -->|"4. priorities"| n4
  n1 -->|"5. if all core"| n5
```

1. **Core subdomains** — Core subdomains are the key differentiator for the business and the most valuable part of the application.

2. **Supporting subdomains** — Supporting subdomains relate to what the business does but are not a differentiator; they can be implemented in-house or outsourced.

3. **Generic subdomains** — Generic subdomains are not specific to the business and are ideally implemented using off-the-shelf software.

4. **Invest where it matters** — The classification tells you where to concentrate in-house effort versus outsource or buy.

```java
// CLASSIFICATION SIDE — each subdomain is core, supporting, or generic
// PARTIES: ARC = architect · BIZ = the business
// STATE (before):
//    subdomains : { "recommendations":{class:"unset"}, "accounting":{class:"unset"}, "email":{class:"unset"} }
// DEF: classify · CALLED BY: ARC rating each subdomain's value to the business
// -> subdomain : "recommendations"
//    step 1 · a differentiator is CORE : subdomains["recommendations"].class : "unset" -> "core"   BECAUSE it is the key differentiator and most valuable part
//    step 2 · related-but-not-differentiating is SUPPORTING : subdomains["accounting"].class : "unset" -> "supporting"  (in-house or outsourced)
//    step 3 · not business-specific is GENERIC : subdomains["email"].class : "unset" -> "generic"   BECAUSE it should be bought off the shelf
// <- classes : "core","supporting","generic" · investment priority: core first
//    alt every subdomain marked core : prioritize : 1 -> 3 (no differentiator is wrong — value is what matters)
```

### Map subdomains to services

> **Why this matters:** Each subdomain becomes one service, keeping the result cohesive and loosely coupled — the same forces as business-capability decomposition.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. One service per subdomain</b><br/>services correspond to each subdomain"]:::start
  n1["<b>2. Build the four services</b><br/>services empty becomes catalog, inventory, order, delivery"]:::step
  n2["<b>3. Keep each service cohesive</b><br/>cohesion unknown becomes strong"]:::core
  n3["<b>4. Keep services loosely coupled</b><br/>coupling unknown becomes loose"]:::step
  n4["<b>5. Four services</b><br/>mapped to subdomains, not technical layers"]:::stop
  n5["<b>Merge two subdomains</b><br/>services 4 becomes 3, one may hold more"]:::warn
  n0 -->|"1. build"| n1
  n1 -->|"2. cohesion"| n2
  n2 -->|"3. coupling"| n3
  n3 -->|"4. count"| n4
  n2 -->|"5. or merge"| n5
```

1. **One service per subdomain** — The corresponding microservice architecture has services corresponding to each subdomain.

2. **Cohesive services** — Each service implements a small set of strongly related functions, so services are cohesive.

3. **Loosely coupled services** — Each service encapsulates its implementation behind an API, so services are loosely coupled.

4. **Teams around business value** — Development teams are cross-functional, autonomous and organized around delivering business value rather than technical features.

```java
// MAPPING SIDE — each subdomain of the online store becomes one service
// PARTIES: ARC = architect
// STATE (before):
//    subdomains : ["product catalog","inventory management","order management","delivery management"]
//    services : []
// DEF: map · CALLED BY: ARC turning subdomains into services
// -> subdomain_list : ["product catalog","inventory management","order management","delivery management"]
//    step 1 · one service per subdomain : services : [] -> ["catalog","inventory","order","delivery"]
//    step 2 · keep each service cohesive : cohesion : "unknown" -> "strong"   BECAUSE each service is one subdomain with one set of functions
//    step 3 · keep services loosely coupled : coupling : "unknown" -> "loose"   (each service owns its subdomain's model)
// <- service_count : 4 · services correspond to subdomains, not to technical layers
//    alt merge two subdomains : services : 4 -> 3  (a service may contain more than one subdomain)
```

### Identifying the subdomains

> **Why this matters:** Like business capabilities, subdomains are found by analyzing the business and its structure, starting from the org structure and the domain model.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Understand the business</b><br/>its structure and areas of expertise"]:::start
  n1["<b>2. Start from the organization structure</b><br/>groups may be subdomains"]:::step
  n2["<b>3. Start from the domain model</b><br/>subdomains often have a key domain object"]:::step
  n3["<b>4. An org group suggests one</b><br/>Fulfillment Team becomes fulfillment"]:::core
  n4["<b>5. A domain object suggests another</b><br/>Order becomes order management"]:::step
  n5["<b>6. Confirm the expertise</b><br/>expertise none becomes fulfillment operations"]:::step
  n6["<b>7. Two subdomains found</b><br/>from org structure and domain model"]:::stop
  n7["<b>A subdomain is missed</b><br/>2 becomes 3 on a later pass, iterative"]:::warn
  n0 -->|"1. org structure"| n1
  n1 -->|"2. domain model"| n2
  n2 -->|"3. group"| n3
  n3 -->|"4. object"| n4
  n4 -->|"5. expertise"| n5
  n5 -->|"6. found"| n6
  n5 -->|"7. iterate"| n7
```

1. **Understand the business** — Identifying subdomains requires understanding the business, its organizational structure and the different areas of expertise.

2. **Start from the organization structure** — Different groups within an organization might correspond to subdomains.

3. **Start from the domain model** — Subdomains often have a key domain object in the high-level domain model.

4. **Iterate** — Subdomains are best identified using an iterative process, refining boundaries over time.

```java
// IDENTIFICATION SIDE — find subdomains from the org structure and the domain model
// PARTIES: ARC = architect
// DEF: domain — the business problem space DDD decomposes into subdomains; here the online store, whose key domain objects are "Order" and "Product"
// DEF: model — the high-level domain model holding the key domain objects that suggest subdomains; here { "Order":{}, "Product":{} } = 2 objects
// DEF: org — the organization structure whose groups may correspond to subdomains; here { "Catalog Team":{}, "Fulfillment Team":{} } = 2 groups
// STATE (before):
//    org_groups : { "Catalog Team":{}, "Fulfillment Team":{} }
//    domain_model : { "Order":{}, "Product":{} }
//    subdomains : []
// DEF: identify · CALLED BY: ARC deriving subdomains from two starting points
// -> group : "Fulfillment Team"
//    step 1 · an org group suggests a subdomain : subdomains : [] -> ["fulfillment"]
//    step 2 · a key domain object suggests another : domain_model["Order"].subdomain : "none" -> "order management"   BECAUSE subdomains often have a key domain object
//    step 3 · confirm the area of expertise : expertise : "none" -> "fulfillment operations"   BECAUSE areas of expertise mark distinct subdomains
// <- subdomains : ["fulfillment","order management"] · found from org structure + domain model
//    alt a subdomain is missed : subdomains : 2 -> 3 on a later pass (identification is iterative)
```


## Key Concepts

### The Problem

**The same decomposition question, a DDD lens.** The benefits of microservices still require careful functional decomposition; SRP and CCP still apply to the resulting services.


### The Solution

Define services corresponding to DDD subdomains; a domain consists of multiple subdomains, each corresponding to a different part of the business.


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| Services correspond to DDD subdomains | Define services corresponding to DDD subdomains; a domain consists of multiple subdomains, each corresponding to a different part of the business. | An online store's subdomains include product catalog, inventory management, order management and delivery management. |
| Classify each subdomain: core, supporting, generic | Core subdomains are the key differentiator and most valuable; supporting subdomains relate to the business but are not differentiators; generic subdomains are not business-specific and are ideally bought off the shelf. | The classification tells you where to concentrate in-house effort versus outsource or buy. |
| Identifying subdomains needs the business | Subdomains are identified by analyzing the business, its organizational structure and its areas of expertise, iteratively. | Different groups in the organization might correspond to subdomains. |


### Tradeoffs & When

- Core subdomains are the key differentiator and most valuable; supporting subdomains relate to the business but are not differentiators; generic subdomains are not business-specific and are ideally bought off the shelf.
- Subdomains are identified by analyzing the business, its organizational structure and its areas of expertise, iteratively.


<details><summary>All concepts (index)</summary>

### Problem: The same decomposition question, a DDD lens

**Why.** Decomposing into services is still unsolved, but now the business is modeled the way DDD describes it — as a domain of subdomains.

**Claim.** The benefits of microservices still require careful functional decomposition; SRP and CCP still apply to the resulting services.

**Grounding.** The context is the same as decompose-by-business-capability: small 6-10 person teams, one or more services each, benefits not automatic.

**In the wild.** A service must stay small enough to be developed by a two-pizza team and be testable.
### Solution: Services correspond to DDD subdomains

**Why.** DDD calls the application's problem space the domain, and its parts are subdomains — natural service boundaries.

**Claim.** Define services corresponding to DDD subdomains; a domain consists of multiple subdomains, each corresponding to a different part of the business.

**Grounding.** The solution states each subdomain corresponds to a different part of the business.

**In the wild.** An online store's subdomains include product catalog, inventory management, order management and delivery management.
### Tradeoff: Classify each subdomain: core, supporting, generic

**Why.** Not every subdomain deserves the same investment, so DDD classifies them by business value.

**Claim.** Core subdomains are the key differentiator and most valuable; supporting subdomains relate to the business but are not differentiators; generic subdomains are not business-specific and are ideally bought off the shelf.

**Grounding.** The solution gives exactly this three-way classification.

**In the wild.** The classification tells you where to concentrate in-house effort versus outsource or buy.
### Tradeoff: Identifying subdomains needs the business

**Why.** Like capabilities, subdomains are found by understanding the business, not by reading code.

**Claim.** Subdomains are identified by analyzing the business, its organizational structure and its areas of expertise, iteratively.

**Grounding.** The issues section names organization structure and the high-level domain model — where subdomains often have a key domain object — as starting points.

**In the wild.** Different groups in the organization might correspond to subdomains.

</details>


## Quiz

1. In DDD, what is the domain?

   - A. The application's database
   - B. The application's problem space — the business
   - C. A network of services
   - D. A deployment artifact

<details><summary>Reveal answer</summary>

**B.** DDD refers to the application's problem space — the business — as the domain. The database, network and deployment artifact are technical, not the domain.

</details>

2. Which subdomain class is the key differentiator and most valuable part of the application?

   - A. Core
   - B. Supporting
   - C. Generic
   - D. Shared library

<details><summary>Reveal answer</summary>

**A.** Core subdomains are the key differentiator for the business and the most valuable part of the application. Supporting and generic are lower-value, and shared library is not a DDD class.

</details>

3. Which subdomain class is ideally implemented with off-the-shelf software?

   - A. Core
   - B. Supporting
   - C. Generic
   - D. In-house

<details><summary>Reveal answer</summary>

**C.** Generic subdomains are not specific to the business and are ideally implemented using off-the-shelf software. Core and supporting are business-related (in-house or outsourced), so A, B and D are wrong.

</details>

4. Good starting points for identifying subdomains are...

   - A. organization structure and the high-level domain model
   - B. the API gateway and the message broker
   - C. the CI pipeline and the cache
   - D. the UI framework and the container runtime

<details><summary>Reveal answer</summary>

**A.** The issues section names organization structure and the high-level domain model — where subdomains often have a key domain object — as starting points. The other options are infrastructure, not sources of subdomain boundaries.

</details>

