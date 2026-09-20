# Chapter 43: Anti-Corruption Layer

> An anti-corruption layer that translates between a legacy monolith's domain model and a new service's domain model, preventing the legacy model from polluting the new service.

_Also known as: Chris Richardson · Microservice Patterns Ch. 43 · microservices.io /patterns/refactoring/anti-corruption-layer.html_

## Flow

### The pollution problem

> **Why this matters:** A new service has to interoperate with a legacy monolith, but the legacy model's field names, codes and shapes differ from the new service's own vocabulary. Without a boundary, the raw legacy model is copied straight in and pollutes the new service.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. New service needs legacy data</b><br/>NEW reads customer C-1042 from the monolith"]:::start
  n1["<b>2. Two models disagree</b><br/>legacy has cust_dob and status_cd, the new service has its own vocabulary"]:::warn
  n2["<b>3. The legacy model leaks in</b><br/>new_customer : empty becomes cust_id C-1042, cust_dob 1987-04-03, status_cd A"]:::warn
  n3["<b>4. The service adopts the raw code</b><br/>new_customer.status : empty becomes A, the verbatim 1-letter code"]:::stop
  n4["<b>No boundary exists</b><br/>the raw legacy record is copied straight in"]:::warn
  n0 -->|"1. fetch the legacy row"| n1
  n1 -->|"2. names and codes differ"| n2
  n2 -->|"3. copy it verbatim"| n3
  n1 -->|"4. missing boundary"| n4
  n4 -->|"5. pollution spreads"| n3
```

1. **New service needs legacy data** — The new service must read from or call the legacy monolith to do its job.

2. **Two models disagree** — The legacy model uses its own field names, status codes and date formats, which differ from the new service's vocabulary.

3. **The legacy model leaks in** — With no boundary, the raw legacy record is copied into the new service, whose code now depends on legacy names like **cust_dob** and **status_cd**.

```java
// NEW SERVICE SIDE — a new Customer service reads a record straight from the legacy monolith, with no boundary
// PARTIES: NEW = new Customer service · LEG = PostgreSQL 14 @ legacy-db-1 (customer table)
// STATE (before):
//    leg_customer : { "cust_id": "C-1042", "cust_dob": "1987-04-03", "status_cd": "A" }
//    new_customer : {}
// DEF: fetch_customer · CALLED BY: NEW when it needs customer 1042
// -> customer_id : "C-1042"
//    step 1 · SELECT the legacy row by cust_id   // leg_customer : {} -> { "cust_id": "C-1042", "cust_dob": "1987-04-03", "status_cd": "A" }
//    step 2 · copy the raw legacy row into the new service's model   // new_customer : {} -> { "cust_id": "C-1042", "cust_dob": "1987-04-03", "status_cd": "A" }
//    step 3 · adopt the legacy 1-letter code as the service's own status   // new_customer.status : "" -> "A"   BECAUSE the code is copied over verbatim
// <- output : new_customer now holds legacy names "cust_dob" and "status_cd" plus the raw code "A" — the legacy model polluted the new service

```

### The translation boundary

> **Why this matters:** The anti-corruption layer is the fix: a component that sits between the new service and the legacy monolith and translates between the two domain models, so each side keeps its own language.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Define the anti-corruption layer</b><br/>a layer between NEW and the monolith owns all translation"]:::start
  n1["<b>2. Translate on the way in</b><br/>the legacy record is converted before NEW ever sees it"]:::step
  n2["<b>3. Translate field by field</b><br/>cust_id becomes id, cust_dob becomes dateOfBirth, status_cd A becomes ACTIVE"]:::core
  n3["<b>4. Keep the new model clean</b><br/>domain : empty becomes id C-1042, dateOfBirth 1987-04-03, status ACTIVE"]:::core
  n4["<b>5. Service sees only its own model</b><br/>NEW never references legacy names"]:::stop
  n5["<b>Field left untranslated</b><br/>a skipped mapping lets a legacy name through"]:::warn
  n0 -->|"1. place the boundary"| n1
  n1 -->|"2. translate before the service"| n2
  n2 -->|"3. rename and translate values"| n3
  n3 -->|"4. hand over the clean model"| n4
  n2 -->|"5. missed a field"| n5
```

1. **Define the anti-corruption layer** — A layer that sits between the new service and the legacy monolith and owns all translation.

2. **Translate on the way in** — The layer converts the legacy model into the new service's model before the service ever sees it.

3. **Translate field by field** — Each legacy field is mapped onto the new service's field: rename the field, and translate its value where the two models disagree.

4. **Keep the new model clean** — The service only ever receives its own model and never references legacy names.

```java
// ACL SIDE — the anti-corruption layer translates a legacy record into the new service's own model
// PARTIES: NEW = new Customer service · ACL = anti-corruption layer · LEG = PostgreSQL 14 @ legacy-db-1 (legacy monolith customer table)
// STATE (before):
//    legacy : { "cust_id": "C-1042", "cust_dob": "1987-04-03", "status_cd": "A" }
//    domain : {}                              // the new service's model, empty before translation
// DEF: translate · CALLED BY: NEW when it needs a customer in its own vocabulary
// -> legacy : { "cust_id": "C-1042", "cust_dob": "1987-04-03", "status_cd": "A" }
//    step 1 · map cust_id to id unchanged   // domain.id : "" -> "C-1042"   BECAUSE the identifier is already clean
//    step 2 · rename cust_dob to dateOfBirth   // domain.dateOfBirth : "" -> "1987-04-03"
//    step 3 · translate the 1-letter code to a word   // domain.status : "" -> "ACTIVE"   BECAUSE legacy code "A" means active
// <- output : domain = { "id": "C-1042", "dateOfBirth": "1987-04-03", "status": "ACTIVE" } — the service sees only its own model

```

### Containing the legacy model

> **Why this matters:** Because the translation lives in one place, the legacy vocabulary stays inside the anti-corruption layer. A change to the legacy model is absorbed at the boundary instead of rippling into the new service.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. One translation point</b><br/>the ACL is the only code that knows the legacy vocabulary"]:::start
  n1["<b>2. Legacy changes stop here</b><br/>mapping.status_cd : A becomes 1, only the mapping table is updated"]:::core
  n2["<b>3. The new service stays clean</b><br/>read_status : empty becomes ACTIVE, the rename is confined to the ACL"]:::stop
  n3["<b>Change bypasses the layer</b><br/>a direct read of the legacy DB reintroduces the pollution"]:::warn
  n0 -->|"1. a single translation point"| n1
  n1 -->|"2. retranslate through the table"| n2
  n0 -->|"3. bypass the layer"| n3
```

1. **One translation point** — The anti-corruption layer is the only code that knows the legacy model's vocabulary.

2. **Legacy changes stop here** — When the monolith changes a code, only the layer's mapping is updated.

3. **The new service stays clean** — The service's model never absorbs the legacy names or codes.

```java
// ACL SIDE — the legacy monolith renames its active-status code; the change stops inside the ACL
// PARTIES: NEW = new Customer service · ACL = anti-corruption layer · LEG = PostgreSQL 14 @ legacy-db-1 (legacy monolith customer table)
// STATE (before):
//    mapping : { "status_cd": "A" }           // the ACL's translation table: legacy code -> word
//    domain  : { "id": "C-1042", "status": "ACTIVE" }
// DEF: absorb_change · CALLED BY: ACL when LEG changes its active code
// -> legacy_code : "A"
//    step 1 · LEG starts writing "1" for active   // mapping.status_cd : "A" -> "1"
//    step 2 · the ACL retranslates through the updated table   // translated : "" -> "ACTIVE"   BECAUSE the mapping table owns the code, not the service
//    step 3 · the service reads its own model and sees the word   // read_status : "" -> "ACTIVE"
// <- output : domain.status stays "ACTIVE" while the legacy code is now "1" — the rename is confined to the ACL

```


## System Design Interview

**The pipeline:** subsystem → ACL (adapter + translator) → legacy monolith

### new Customer service — the subsystem that keeps its own clean model

_Role: subsystem_

```mermaid
flowchart TD
  R["new Customer service — the subsystem that keeps its own clean model"]
  R --> P0["Domain model — id, dateOfBirth, status"]
  R --> P1["Consumer — reads only what the ACL hands it"]
```

### anti-corruption layer — the translation boundary

_Role: ACL (adapter + translator)_

```mermaid
flowchart TD
  R["anti-corruption layer — the translation boundary"]
  R --> P0["Adapter — calls the legacy API / table"]
  R --> P1["Translator — maps legacy names and codes to the modern model"]
```

### legacy monolith — the old system being shielded

_Role: legacy monolith_

```mermaid
flowchart TD
  R["legacy monolith — the old system being shielded"]
  R --> P0["customer table — cust_id, cust_dob, status_cd on PostgreSQL 14 @ legacy-db-1"]
  R --> P1["Legacy codes — status_cd &quot;A&quot; for active"]
```

```mermaid
flowchart LR
  NEW["new Customer service"] -->|"needs customer C-1042"| ACL["anti-corruption layer"]
  ACL -->|"adapter reads"| LEG[("PostgreSQL 14 @ legacy-db-1")]
  LEG -->|"cust_id, cust_dob, status_cd"| ACL
  ACL -->|"translator maps A -> ACTIVE"| NEW
  NEW -->|"stores"| DM["domain: id, dateOfBirth, status"]
```

```java
// SYSTEM DESIGN — anti-corruption layer: new subsystem -> ACL (adapter + translator) -> legacy monolith
// PARTIES: NEW = new Customer service (the clean subsystem) · ACL = anti-corruption layer (adapter that calls the legacy API + translator that maps the legacy model to the modern model) · LEG = PostgreSQL 14 @ legacy-db-1 (legacy monolith customer table)
// DEF: adapter — the ACL half that calls the legacy API/table; here SELECT of customer "C-1042"
// DEF: translator — the ACL half that maps legacy names to the new model; here "cust_dob" -> "dateOfBirth"
// DEF: domain — the new service own model; here { "id":"C-1042", "dateOfBirth":"1987-04-03", "status":"ACTIVE" }
// DEF: legacy — the monolith model; here { "cust_id":"C-1042", "cust_dob":"1987-04-03", "status_cd":"A" }
// STATE (before):
//    legacy : {}     // the monolith record, fetched by the adapter
//    domain : {}     // the new model, empty before translation
// DEF: translate · CALLED BY: NEW when it needs customer 1042 in its own vocabulary
// -> customer_id : "C-1042"
//    step 1 · the adapter reads the legacy row    legacy : {} -> { "cust_id":"C-1042", "cust_dob":"1987-04-03", "status_cd":"A" }   // SELECT from PostgreSQL 14 @ legacy-db-1
//    step 2 · the translator renames cust_dob    domain.dateOfBirth : "" -> "1987-04-03"   BECAUSE the legacy field is mapped to the modern name
//    step 3 · the translator maps the code to a word    domain.status : "" -> "ACTIVE"   // legacy code "A" means active
//    step 4 · the adapter returns the clean model    domain : {} -> { "id":"C-1042", "dateOfBirth":"1987-04-03", "status":"ACTIVE" }   // NEW stores only its own model
// <- output : domain = { "id":"C-1042", "dateOfBirth":"1987-04-03", "status":"ACTIVE" } · the service reads no legacy name   BECAUSE the ACL translates before NEW sees it
```

## Interview Questions

### Q1

Your new Customer service reads a row straight from the legacy monolith. The record arrives with legacy names and a raw one-letter code, and your service starts storing those names as its own.

**Interviewer's question:** What happens when a new service copies the legacy model directly, with no boundary?

**Solution:** The raw legacy record is copied into the new service's domain model, and the service's code comes to depend on legacy names and codes, so the legacy model pollutes the new service.

**System-design components:**
- Legacy record — with legacy names
- Direct copy — no translation
- Legacy codes — adopted verbatim
- Pollution — the new model leaks in

```mermaid
flowchart LR
  LEG["Legacy monolith"] -->|"cust_dob, status_cd"| NEW["New Customer service"]
  NEW -->|"stores raw"| M["new_customer"]
  M -->|"polluted"| P["legacy names leak in"]
```

```java
// NEW SERVICE SIDE — a new Customer service reads a record straight from the legacy monolith, with no boundary
// PARTIES: NEW = new Customer service · LEG = PostgreSQL 14 @ legacy-db-1 (customer table)
// STATE (before):
//    leg_customer : { "cust_id": "C-3157", "cust_dob": "1999-06-14", "status_cd": "A" }
//    new_customer : {}
// DEF: fetch_customer · CALLED BY: NEW when it needs customer 3157
// -> customer_id : "C-3157"
//    step 1 · SELECT the legacy row by cust_id   // leg_customer : {} -> { "cust_id": "C-3157", "cust_dob": "1999-06-14", "status_cd": "A" }
//    step 2 · copy the raw legacy row into the new model   // new_customer : {} -> { "cust_id": "C-3157", "cust_dob": "1999-06-14", "status_cd": "A" }
//    step 3 · adopt the 1-letter code as its own status   // new_customer.status : "" -> "A"   BECAUSE the code is copied over verbatim
// <- output : new_customer now holds legacy names "cust_dob" and "status_cd" plus the raw code "A" — the legacy model polluted the new service
```

_This is the pollution problem — copying the legacy record verbatim so its names and codes leak into the new model._

_Covers:_ The pollution problem

_From the 28 problems:_ 01-scale-from-zero-to-millions · 03-framework-for-system-design-interviews

### Q2

You decide the new Customer service must only ever see its own vocabulary: id, dateOfBirth, and a readable status. Someone has to convert the legacy record before the service sees it.

**Interviewer's question:** What does the anti-corruption layer do to a legacy record?

**Solution:** A layer sits between the new service and the legacy monolith and translates the legacy model into the new service's model field by field, renaming fields and translating values where the two models disagree.

**System-design components:**
- Anti-corruption layer — the boundary
- Field rename — cust_dob to dateOfBirth
- Value translation — code to word
- Clean model — only the new vocabulary

```mermaid
flowchart LR
  LEG["Legacy monolith"] -->|"cust_id, cust_dob, status_cd"| ACL["Anti-corruption layer"]
  ACL -->|"id, dateOfBirth, status"| NEW["New Customer service"]
  ACL -->|"A -> ACTIVE"| MAP["translation"]
```

```java
// ACL SIDE — the anti-corruption layer translates a legacy record into the new service's own model
// PARTIES: NEW = new Customer service · ACL = anti-corruption layer · LEG = PostgreSQL 14 @ legacy-db-1 (legacy monolith customer table)
// STATE (before):
//    legacy : { "cust_id": "C-3157", "cust_dob": "1999-06-14", "status_cd": "A" }
//    domain : {}                              // the new service's model, empty before translation
// DEF: translate · CALLED BY: NEW when it needs a customer in its own vocabulary
// -> legacy : { "cust_id": "C-3157", "cust_dob": "1999-06-14", "status_cd": "A" }
//    step 1 · map cust_id to id unchanged   // domain.id : "" -> "C-3157"   BECAUSE the identifier is already clean
//    step 2 · rename cust_dob to dateOfBirth   // domain.dateOfBirth : "" -> "1999-06-14"
//    step 3 · translate the 1-letter code to a word   // domain.status : "" -> "ACTIVE"   BECAUSE legacy code "A" means active
// <- output : domain = { "id": "C-3157", "dateOfBirth": "1999-06-14", "status": "ACTIVE" } — the service sees only its own model
```

_This is the translation stage — renaming fields and translating values so each side keeps its own language._

_Covers:_ The translation boundary

_From the 28 problems:_ 01-scale-from-zero-to-millions · 03-framework-for-system-design-interviews

### Q3

The monolith team announces they are renaming status_cd and switching its value from "A" to "1". Without a boundary, that change would ripple into your new service.

**Interviewer's question:** Why does a change to the legacy model stop inside the anti-corruption layer?

**Solution:** Because the translation lives in one place, the legacy vocabulary stays inside the layer; when the monolith changes a code, only the layer's mapping is updated, and the new service keeps seeing its own unchanged model.

**System-design components:**
- One translation point — the ACL
- Legacy change — a rename plus a new code
- Mapping update — only in the layer
- Unchanged domain — the service is untouched

```mermaid
flowchart LR
  LEG["Legacy monolith"] -->|"stat_code '1'"| ACL["Anti-corruption layer"]
  ACL -->|"mapping updated"| MAP["status_cd -> stat_code, A -> 1"]
  MAP -->|"still yields"| NEW["New service status ACTIVE"]
```

```java
// ACL SIDE — the legacy monolith renames its status field and changes its code; the change stops inside the ACL
// PARTIES: NEW = new Customer service · ACL = anti-corruption layer · LEG = PostgreSQL 14 @ legacy-db-1 (legacy monolith customer table)
// STATE (before):
//    mapping : { "status_cd": "A" }           // the ACL's translation table: legacy field -> code
//    domain  : { "id": "C-3157", "status": "ACTIVE" }
// DEF: absorb_change · CALLED BY: ACL when LEG renames its status field and value
// -> legacy_field : "stat_code" · -> legacy_code : "1"
//    step 1 · LEG starts writing "stat_code" with value "1" for active   // mapping.status_cd : "A" -> "1"   // the table keys the NEW field name to the NEW code
//    step 2 · the ACL retranslates through the updated table   // translated : "" -> "ACTIVE"   BECAUSE the mapping table owns the code, not the service
//    step 3 · the service reads its own model and sees the word   // read_status : "" -> "ACTIVE"
// <- output : domain.status stays "ACTIVE" while the legacy field is now "stat_code" = "1" — the rename is confined to the ACL
```

_This is the containment stage — the legacy vocabulary and its changes are absorbed at the single translation point._

_Covers:_ Containing the legacy model

_From the 28 problems:_ 01-scale-from-zero-to-millions · 03-framework-for-system-design-interviews

### Q4

The anti-corruption layer works only if every interaction with the legacy system goes through it. A shortcut — reading the legacy database directly — would undo the whole boundary.

**Interviewer's question:** What happens when a call bypasses the anti-corruption layer?

**Solution:** Any call that bypasses the layer reintroduces the pollution it was meant to stop, because the legacy model reaches the new service again; the layer only works if every interaction goes through it.

**System-design components:**
- The layer — the only sanctioned path
- A bypass — a direct legacy read
- Pollution — the legacy model returns
- Discipline — every call through the layer

```mermaid
flowchart LR
  DEV["Developer"] -->|"bypasses"| DB["Legacy DB direct"]
  DB -->|"raw row"| NEW["New service"]
  NEW -->|"polluted again"| P["legacy names leak in"]
  DEV -->|"should use"| ACL["Anti-corruption layer"]
```

```java
// BOUNDARY SIDE — one direct read that skips the layer reintroduces the exact pollution the layer stops
// PARTIES: NEW = new Customer service · ACL = anti-corruption layer · LEG = PostgreSQL 14 @ legacy-db-1 (legacy monolith customer table)
// STATE (before):
//    domain : { "id": "C-3157", "dateOfBirth": "1999-06-14", "status": "ACTIVE" }
//    bypass_count : 0                      // how many reads skipped the layer
// DEF: read_direct · CALLED BY: NEW reading the legacy table without the ACL
// -> customer_id : "C-3157"
//    step 1 · query the legacy table directly   // raw : {} -> { "cust_dob": "1999-06-14", "status_cd": "A" }   BECAUSE the read skipped the translation layer
//    step 2 · the raw names land in the new model   // domain : { "id": "C-3157", ... } -> { "cust_dob": "1999-06-14", "status_cd": "A" }   // pollution returns
//    step 3 · count the bypass   // bypass_count : 0 -> 1   // one more call that reintroduced the legacy model
// <- output : domain holds "cust_dob" and "status_cd" again · the layer solved nothing because it was bypassed
//    alt through the layer : raw : {"cust_dob":"1999-06-14","status_cd":"A"} -> {"dateOfBirth":"1999-06-14","status":"ACTIVE"}   BECAUSE the ACL translates before the service sees it
```

_This is the discipline stage — the layer only prevents pollution when every interaction with the legacy system goes through it._

_Covers:_ Boundary discipline

_From the 28 problems:_ 01-scale-from-zero-to-millions · 03-framework-for-system-design-interviews

## Key Concepts

### The Problem

**Legacy model pollution.** If the legacy model is copied in directly, its field names, status codes and shapes leak into the new service's domain model, and the new service ends up speaking the old system's language.


### The Solution

Define an anti-corruption layer that translates between the two domain models, so the legacy model is converted into the new service's model at the boundary.

```mermaid
flowchart LR
  LEG["Legacy monolith"] -->|"cust_dob, status_cd"| NEW["New Customer service"]
  NEW -->|"stores raw"| M["new_customer"]
  M -->|"polluted"| P["legacy names leak in"]
```


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| Anti-corruption layer | Define an anti-corruption layer that translates between the two domain models, so the legacy model is converted into the new service's model at the boundary. | A layer that maps legacy cust_id, cust_dob and status_cd onto the new service's id, dateOfBirth and status. |
| Extra translation code | You trade the pollution risk for a permanent translation component that must be maintained for as long as the two models coexist. | A mapping table that grows one entry per legacy field until the monolith is retired. |
| Boundary discipline | Any call that bypasses the anti-corruption layer reintroduces the pollution it was meant to stop. | A team that agrees never to read the legacy database directly, only through the layer. |


### Tradeoffs & When

- You trade the pollution risk for a permanent translation component that must be maintained for as long as the two models coexist.
- Any call that bypasses the anti-corruption layer reintroduces the pollution it was meant to stop.


<details><summary>All concepts (index)</summary>

### Problem: Legacy model pollution

**Why.** A new service almost always has to interoperate with the legacy monolith, reading its data or calling its APIs.

**Claim.** If the legacy model is copied in directly, its field names, status codes and shapes leak into the new service's domain model, and the new service ends up speaking the old system's language.

**Grounding.** This is the pattern's problem statement: prevent a legacy monolith's domain model from polluting the domain model of a new service.

**In the wild.** A new customer service that imports legacy cust_dob and status_cd fields instead of its own dateOfBirth and status.
### Solution: Anti-corruption layer

**Why.** Translation has to live somewhere, and that somewhere must be a dedicated boundary rather than scattered mapping code inside the new service.

**Claim.** Define an anti-corruption layer that translates between the two domain models, so the legacy model is converted into the new service's model at the boundary.

**Grounding.** This is the pattern's solution statement: define an anti-corruption layer, which translates between the two domain models.

**In the wild.** A layer that maps legacy cust_id, cust_dob and status_cd onto the new service's id, dateOfBirth and status.
### Tradeoff: Extra translation code

**Why.** The layer is code you must write and keep in sync as either model changes.

**Claim.** You trade the pollution risk for a permanent translation component that must be maintained for as long as the two models coexist.

**Grounding.** The solution introduces a layer, and every legacy field the new service touches needs a mapping, so the cost grows with the number of translated fields.

**In the wild.** A mapping table that grows one entry per legacy field until the monolith is retired.
### Tradeoff: Boundary discipline

**Why.** The layer only works if every interaction with the legacy system goes through it.

**Claim.** Any call that bypasses the anti-corruption layer reintroduces the pollution it was meant to stop.

**Grounding.** The pattern's whole point is to prevent pollution, so a bypassed layer solves nothing: the legacy model reaches the new service again.

**In the wild.** A team that agrees never to read the legacy database directly, only through the layer.

</details>


## Quiz

1. What is the anti-corruption layer's job?

   - A. To speed up calls between a new service and the legacy monolith
   - B. To translate between two domain models
   - C. To replace the legacy monolith's database
   - D. To route requests to the nearest service instance

<details><summary>Reveal answer</summary>

**B.** The solution statement is to define a layer that translates between the two domain models. A and D describe unrelated concerns, and C is wrong because the layer translates models; it does not replace the database.

</details>

2. Which problem does the anti-corruption layer solve?

   - A. A legacy monolith's domain model polluting a new service's domain model
   - B. A service discovering where other services are located
   - C. A database running out of storage
   - D. A service failing under high load

<details><summary>Reveal answer</summary>

**A.** The problem statement is exactly how to prevent a legacy monolith's domain model from polluting a new service's domain model. B, C and D belong to different patterns entirely.

</details>

3. After you apply the pattern, where should the legacy vocabulary (field names and codes) live?

   - A. Spread across the new service's code
   - B. In the anti-corruption layer only
   - C. Nowhere, it is deleted from the monolith
   - D. In the user's browser

<details><summary>Reveal answer</summary>

**B.** The layer is the single translation point, so the legacy names and codes are confined there and the new service only sees its own model. A is the pollution the pattern prevents, C is wrong because the monolith keeps its own model, and D is irrelevant.

</details>

4. A legacy record has cust_id = 'C-1042', cust_dob = '1987-04-03', and status_cd = 'A'. Which is a correct translation into the new service's model?

   - A. id = 'C-1042', dateOfBirth = '1987-04-03', status = 'A'
   - B. id = 'C-1042', dateOfBirth = '1987-04-03', status = 'ACTIVE'
   - C. cust_id = 'C-1042', cust_dob = '1987-04-03', status_cd = 'A'
   - D. id = 'C-1042', dateOfBirth = 'ACTIVE', status = '1987-04-03'

<details><summary>Reveal answer</summary>

**B.** The layer maps the legacy code 'A' to the word 'ACTIVE' and renames the fields, so B is right. A keeps the raw code, C is the untranslated legacy record, and D swaps the field values.

</details>

