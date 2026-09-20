# Chapter 21: API Composition

> Implement a query by defining an API Composer, which invokes the services that own the data and performs an in-memory join of the results.

_Also known as: Chris Richardson · Microservice Patterns Ch. 21 · microservices.io /patterns/data/api-composition.html_

## Flow

### Why queries break across services

> **Why this matters:** Once you apply Database per Service, a query that needs data from several services can no longer run as a single SQL JOIN — the rows live in different, service-owned databases.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s0n0["<b>1. Apply Database per service</b><br/>Each service owns a private database that no other service may read…"]:::start
  s0n1["<b>2. One query now spans several owners</b><br/>A single logical result needs columns that are owned by two or more…"]:::step
  s0n2["<b>3. No shared table to JOIN</b><br/>There is no single database where one SQL statement can combine the…"]:::stop
  s0n0 --> s0n1
  s0n1 --> s0n2
```

1. **Apply Database per service** — Each service owns a private database that no other service may read or write directly.

2. **One query now spans several owners** — A single logical result needs columns that are owned by two or more services.

3. **No shared table to JOIN** — There is no single database where one SQL statement can combine the rows.

```java
// QUERY SIDE — why one logical query can no longer be a single SQL JOIN
// PARTIES: CLI = client rendering an order page · CUST = Customer Service · ORD = Order Service
// DEF: db — a service-owned database that holds only its own service's rows = a keyed store; here cust_db = {"C-77":{name:"Ada"}} and ord_db = {"O-101":{cust_id:"C-77", total:120.00}}
// STATE (before):
//    cust_db : { "C-77": {name:"Ada"} }                          // rows owned by CUST only
//    ord_db  : { "O-101": {cust_id:"C-77", total:120.00} }       // rows owned by ORD only
//    result  : {}
// DEF: get_order_with_name · CALLED BY: CLI assembling an order page
// -> order_id : "O-101"
//    step 1 · ORD.fetch(order_id)    // order_row : null -> {cust_id:"C-77", total:120.00}  BECAUSE the order row lives in ORD's own database
//    step 2 · CUST.fetch("C-77")     // cust_row  : null -> {name:"Ada"}                      BECAUSE the customer row lives in CUST's own database
//    step 3 · join the two rows in memory    // result : {} -> {"O-101":{name:"Ada", total:120.00}}
// <- result : {"O-101":{name:"Ada", total:120.00}}
//    alt pre-microservice monolith : one database held both tables -> one SQL JOIN returned this same row in a single statement
```

### Define the API Composer

> **Why this matters:** An API Composer invokes the services that own the data and performs an in-memory join of the results, so one endpoint can answer a query that spans services.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s1n0["<b>1. Introduce a composer component</b><br/>A dedicated API Composer (often the API Gateway) owns the joined qu…"]:::start
  s1n1["<b>2. Invoke the owning services</b><br/>The composer calls each service that owns a piece of the result."]:::step
  s1n2["<b>3. Join the partial results</b><br/>The composer merges the returned fragments into one response object."]:::stop
  s1n0 --> s1n1
  s1n1 --> s1n2
```

1. **Introduce a composer component** — A dedicated API Composer (often the API Gateway) owns the joined query.

2. **Invoke the owning services** — The composer calls each service that owns a piece of the result.

3. **Join the partial results** — The composer merges the returned fragments into one response object.

```java
// COMPOSER SIDE — the API Composer fans out to the services that own the data
// PARTIES: CMP = API Composer · ORD = Order Service · CUST = Customer Service · INV = Inventory Service
// STATE (before):
//    joined : {}                         // assembled result, empty before the fan-out
//    calls  : 0                           // round-trips made so far
// DEF: compose_order_details · CALLED BY: CMP answering one order query
// -> query : {"order_id":"O-101"}         // the one logical query to answer
//    step 1 · ORD.fetch("O-101")    // joined : {} -> {cust_id:"C-77", total:120.00}     · calls : 0 -> 1
//    step 2 · CUST.fetch("C-77")    // joined : {cust_id:"C-77", total:120.00} -> {cust_id:"C-77", total:120.00, name:"Ada"}    · calls : 1 -> 2
//    step 3 · INV.fetch("O-101")    // joined : {cust_id:"C-77", total:120.00, name:"Ada"} -> {cust_id:"C-77", total:120.00, name:"Ada", stock:3}    · calls : 2 -> 3
// <- output : {cust_id:"C-77", total:120.00, name:"Ada", stock:3}
//    alt INV is down : step 3 raises -> calls stays at 2 -> the joined result is missing the stock field
```

### The in-memory join

> **Why this matters:** The join is the pattern's core mechanism: fragments arrive keyed by a shared id, and the composer merges them in memory rather than in SQL.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s2n0["<b>1. Fragment by a shared key</b><br/>Each partial result is keyed by the same id, e.g. the order id."]:::start
  s2n1["<b>2. Merge rows in memory</b><br/>The composer combines fragments with matching keys into one row."]:::step
  s2n2["<b>3. Emit the assembled response</b><br/>The joined object is returned as if one query had produced it."]:::stop
  s2n0 --> s2n1
  s2n1 --> s2n2
```

1. **Fragment by a shared key** — Each partial result is keyed by the same id, e.g. the order id.

2. **Merge rows in memory** — The composer combines fragments with matching keys into one row.

3. **Emit the assembled response** — The joined object is returned as if one query had produced it.

```java
// COMPOSER SIDE — the in-memory join merges fragments on the shared key
// PARTIES: CMP = API Composer · ORD = Order Service · CUST = Customer Service
// DEF: row — one fragment/record returned by a service, keyed by the shared id = one element of ord_rows or cust_rows; here the order row {"O-101":{total:120.00}} and the customer row {"C-77":{name:"Ada"}}
// STATE (before):
//    ord_rows  : [{"O-101":{total:120.00}}, {"O-102":{total:80.00}}]        // fetched from ORD
//    cust_rows : [{"C-77":{name:"Ada"}}]                                     // fetched from CUST
//    joined    : []
//    matched   : null
// DEF: join_fragments · CALLED BY: CMP merging two partial results
// -> key : "O-101"                                    // the shared id the join matches on
//    step 1 · match ord_rows[0]    // matched : null -> {"O-101":{total:120.00}}
//    step 2 · attach name by id    // matched : {"O-101":{total:120.00}} -> {"O-101":{total:120.00, name:"Ada"}}
//    step 3 · append to joined    // joined : [] -> [{"O-101":{total:120.00, name:"Ada"}}]
// <- joined : [{"O-101":{total:120.00, name:"Ada"}}]
//    alt the key "O-102" has no matching cust row : matched : {"O-102":{total:80.00}} -> {"O-102":{total:80.00, name:null}}  BECAUSE the composer cannot invent a name it was never given
```

### When it stops being simple

> **Why this matters:** The tradeoff is efficiency: some queries force an in-memory join of large datasets, which is exactly the case where API composition breaks down.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s3n0["<b>1. Recognize the large-dataset case</b><br/>Some queries pull big result sets from several services before join…"]:::start
  s3n1["<b>2. The join happens in the composer's memory</b><br/>All fragments must be loaded into memory to be combined."]:::step
  s3n2["<b>3. Prefer CQRS for those queries</b><br/>When the join is too large or too hot, CQRS is the alternative solu…"]:::stop
  s3n0 --> s3n1
  s3n1 --> s3n2
```

1. **Recognize the large-dataset case** — Some queries pull big result sets from several services before joining.

2. **The join happens in the composer's memory** — All fragments must be loaded into memory to be combined.

3. **Prefer CQRS for those queries** — When the join is too large or too hot, CQRS is the alternative solution.

```java
// COMPOSER SIDE — the tradeoff: joining a large dataset in memory gets inefficient
// PARTIES: CMP = API Composer · ORD = Order Service · CUST = Customer Service
// DEF: row — one order or customer record pulled from a service = one element of ord_rows; here ORD.fetch_all("last 30 days") returns 900000 order rows
// STATE (before):
//    ord_rows  : []                         // order rows pulled from ORD
//    cust_rows : []                         // customer rows pulled from CUST
//    joined    : []                         // the assembled result
// DEF: join_large_dataset · CALLED BY: CMP answering a full-history query
// -> scope : "last 30 days"                 // the query asks for the whole set, not one row
//    step 1 · ORD.fetch_all(scope)    // ord_rows  : [] -> [900000 rows]  BECAUSE the query selects the full history rather than one id
//    step 2 · CUST.fetch_all()        // cust_rows : [] -> [120000 rows]  BECAUSE every referenced customer must also be pulled
//    step 3 · join in CMP memory      // joined    : [] -> [900000 rows]  BECAUSE all 900000 order rows are combined in the composer's RAM
// <- joined : [900000 rows] · CMP materializes 900000 rows in memory at once
//    alt the query targets one order : ORD.fetch_all returns 1 row -> CMP joins 1 row -> the in-memory cost is negligible
```


## Key Concepts

### The Problem

**Cross-service joins break.** Any query that needs data from several services is no longer straightforward to implement.


### The Solution

An API Composer invokes the services that own the data and performs an in-memory join of the results.


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| The API Composer | An API Composer invokes the services that own the data and performs an in-memory join of the results. | An API Gateway often does API composition, per the reference example. |
| Simple to build | It is a simple way to query data in a microservice architecture. | A gateway that fans out to a few services for a single page is quick to implement. |
| Inefficient at scale | Some queries result in inefficient, in-memory joins of large datasets. | A query over a full order history joined with customer data — the alternative for such queries is CQRS. |


### Tradeoffs & When

- It is a simple way to query data in a microservice architecture.
- Some queries result in inefficient, in-memory joins of large datasets.


<details><summary>All concepts (index)</summary>

### Problem: Cross-service joins break

**Why.** The Database per Service pattern gives each service its own private data, so there is no single database left to query.

**Claim.** Any query that needs data from several services is no longer straightforward to implement.

**Grounding.** The reference context: after applying the Microservices architecture and Database per Service, it is no longer straightforward to implement queries that join data from multiple services.

**In the wild.** A product or order detail page whose columns are split across Product, Pricing, Inventory, and Review services.
### Solution: The API Composer

**Why.** To answer a multi-service query you need one component that owns the assembled result.

**Claim.** An API Composer invokes the services that own the data and performs an in-memory join of the results.

**Grounding.** This is the reference solution, verbatim: define an API Composer that invokes the owning services and joins the results in memory.

**In the wild.** An API Gateway often does API composition, per the reference example.
### Tradeoff: Simple to build

**Why.** The pattern needs no new infrastructure, only a small orchestrating component.

**Claim.** It is a simple way to query data in a microservice architecture.

**Grounding.** The reference lists simplicity as the pattern's first benefit.

**In the wild.** A gateway that fans out to a few services for a single page is quick to implement.
### Tradeoff: Inefficient at scale

**Why.** The join happens in the composer's memory, so the whole dataset must be loaded there.

**Claim.** Some queries result in inefficient, in-memory joins of large datasets.

**Grounding.** This is the reference drawback, stated as the pattern's only listed drawback.

**In the wild.** A query over a full order history joined with customer data — the alternative for such queries is CQRS.

</details>


## Quiz

1. What is the core mechanism of the API Composition pattern?

   - A. Replicating every service's data into a shared warehouse
   - B. An API Composer that invokes the owning services and joins the results in memory
   - C. A single SQL query that reaches across service databases
   - D. Replacing queries with command messages

<details><summary>Reveal answer</summary>

**B.** The pattern defines an API Composer that calls the services owning the data and performs an in-memory join. A shared warehouse is CQRS-adjacent, not API composition; a cross-database SQL JOIN is impossible under Database per Service; and commands are not queries.

</details>

2. Which pattern creates the need for API composition?

   - A. API Gateway
   - B. Saga
   - C. Database per Service
   - D. Event sourcing

<details><summary>Reveal answer</summary>

**C.** Database per Service scatters the data across service-owned databases, which is what makes joined queries hard. The API Gateway is a common place where composition runs, Saga manages transactions, and Event sourcing is a persistence style — none of these is the cause named in the reference.

</details>

3. What is the pattern's main drawback?

   - A. It requires a new database
   - B. It adds a network hop
   - C. Inefficient in-memory joins of large datasets
   - D. It breaks distributed transactions

<details><summary>Reveal answer</summary>

**C.** The reference drawback is that some queries would result in inefficient, in-memory joins of large datasets. The other options describe other patterns or concerns not listed for API composition.

</details>

4. Which pattern is listed as an alternative solution to API composition?

   - A. CQRS
   - B. Saga
   - C. Transactional outbox
   - D. Domain event

<details><summary>Reveal answer</summary>

**A.** The reference names CQRS as the alternative solution to API composition. Saga and Transactional outbox concern transactions, and Domain event is about publishing events, not querying.

</details>

