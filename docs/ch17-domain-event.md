# Chapter 17: Domain Event

> Organize the business logic of a service as a collection of DDD aggregates that emit domain events when created or updated, and publish those events for other services to consume.

_Also known as: Chris Richardson · Microservice Patterns Ch.17 (p.160) · microservices.io /patterns/data/domain-event.html_

## Flow

### The need: publish when data changes

> **Why this matters:** A service often needs to publish events when it updates its data — to keep a CQRS view fresh or to participate in a choreography-based saga. Without a publish step, an update is invisible to the consumers that need it.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Data changes locally</b><br/>order.state NEW becomes PLACED, written only inside the service"]:::start
  n1["<b>2. Two consumers need the news</b><br/>a CQRS view and a choreography saga both depend on the change"]:::step
  n2["<b>3. The open question</b><br/>how does a service publish an event when it updates its data"]:::core
  n3["<b>4. A publish step is required</b><br/>the update must be emitted, not just stored"]:::stop
  n4["<b>No publish step</b><br/>view.placed_count stays 0 and saga.next_step stays none, consumers stranded"]:::warn
  n0 -->|"1. service updates its own data"| n1
  n1 -->|"2. consumers depend on the change"| n2
  n2 -->|"3. the pattern to find"| n3
  n1 -->|"4. skipped publish - consumers stranded"| n4
```

1. **Data changes silently** — A service updates its own data, but the update is local to that service.

2. **Consumers need to know** — Events may be needed to update a CQRS view or to coordinate a choreography-based saga.

3. **The open question** — How does a service publish an event when it updates its data?

```java
// ORDER SERVICE SIDE — the problem the pattern solves: data changes, but the consumers that need to know are never told
// PARTIES: SVC = Order Service (writes) · VIEW = a CQRS read model · SAGA = a choreography-based saga coordinated via events
// STATE (before):
//    order : { id:"PO-2001", state:"NEW" }
//    view : { placed_count : 0 }
//    saga : { next_step : "none" }
// DEF: place_order_without_publish · CALLED BY: SVC
// -> command : "place_order"
//    step 1 · SVC writes its own data locally   // order.state : "NEW" -> "PLACED"
//    step 2 · the CQRS view is not notified and stays stale   // view.placed_count : 0 -> 0
//    step 3 · the saga is not triggered and never advances   // saga.next_step : "none" -> "none"
// <- outcome : order.state : "PLACED" · but every consumer still sees the old state, so the service needs a way to publish events when it updates data
```

### Aggregates emit domain events

> **Why this matters:** The solution puts the event at the source of the change: DDD aggregates emit a domain event when they are created or updated, and the service publishes it so other services can consume it.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Command arrives at the aggregate</b><br/>place_order for order PO-2001"]:::start
  n1["<b>2. Aggregate changes state</b><br/>order.state NEW becomes PLACED"]:::step
  n2["<b>3. Aggregate emits the event</b><br/>events gains OrderPlaced with order_id PO-2001"]:::core
  n3["<b>4. Service publishes to the broker</b><br/>OrderPlaced delivered via the transactional outbox"]:::step
  n4["<b>5. Broker delivers to the consumer</b><br/>the CQRS view updater receives OrderPlaced"]:::step
  n5["<b>6. Consumer updates the read model</b><br/>view.order_count 0 becomes 1"]:::step
  n6["<b>7. View reflects the change</b><br/>the consumer reacts without calling the aggregate"]:::stop
  n7["<b>Event lost in transit</b><br/>view.order_count stays 0, the read model is stale"]:::warn
  n0 -->|"1. service calls the aggregate"| n1
  n1 -->|"2. state flips"| n2
  n2 -->|"3. change recorded as an event"| n3
  n3 -->|"4. publish the event"| n4
  n4 -->|"5. deliver to subscriber"| n5
  n5 -->|"6. count goes up"| n6
  n4 -->|"7. event lost - view stale"| n7
```

1. **Aggregates hold the business logic** — The business logic of a service is organized as a collection of DDD aggregates.

2. **Emit on create or update** — An aggregate emits a domain event when it is created or updated.

3. **Publish for consumers** — The service publishes the domain events so they can be consumed by other services.

```java
// ORDER SERVICE SIDE — an aggregate emits a domain event when it changes, and a consumer reacts to it
// PARTIES: AG = Order aggregate (in Order Service) · BRK = message broker · CSVC = the consuming service (a CQRS view updater)
// STATE (before):
//    order : { id:"PO-2001", state:"NEW" }
//    events : []            // domain events the aggregate has emitted
//    view : { order_count : 0 }   // a CQRS read model owned by the consumer
// DEF: place_order · CALLED BY: the service on the aggregate
// -> command : "place_order"
//    step 1 · aggregate changes state   // order.state : "NEW" -> "PLACED"
//    step 2 · aggregate emits an event   // events : [] -> [{type:"OrderPlaced", order_id:"PO-2001"}]
//    step 3 · service publishes "OrderPlaced" to BRK (via transactional outbox, same database transaction)
// <- output : event "OrderPlaced" { order_id:"PO-2001" } published
// DEF: consume · CALLED BY: the consumer's event handler when BRK delivers "OrderPlaced"
// -> event : { type:"OrderPlaced", order_id:"PO-2001" }
//    step 1 · handler updates the read model   // view : { order_count : 0 } -> { order_count : 1 }  BECAUSE one more order was placed
// <- outcome : view.order_count : 1 · the CQRS view now reflects the aggregate's change, without the consumer calling the aggregate
```

### Publish atomically with the data change

> **Why this matters:** Publishing must not lose the event or emit it for a change that rolled back. Because a service cannot enlist both its database and the broker in one distributed transaction, it uses the Transactional Outbox to write the event in the same transaction as the data.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. No distributed transaction</b><br/>one transaction cannot span the database and the broker"]:::start
  n1["<b>2. Begin one local transaction</b><br/>the broker is not enlisted"]:::step
  n2["<b>3. Update the data</b><br/>order.state NEW becomes PLACED"]:::step
  n3["<b>4. Write the event to the outbox</b><br/>outbox gains OrderPlaced for PO-2001, same transaction"]:::core
  n4["<b>5. Commit both or neither</b><br/>event cannot be lost, nor published for a rolled-back change"]:::step
  n5["<b>6. Relay polls the outbox</b><br/>sent false becomes true, then forwards to the broker"]:::step
  n6["<b>7. Event reaches the broker</b><br/>atomic with the data change"]:::stop
  n7["<b>Rollback path</b><br/>the transaction aborts and both rows vanish together"]:::warn
  n0 -->|"1. split write is impossible"| n1
  n1 -->|"2. single local transaction"| n2
  n2 -->|"3. change the row"| n3
  n3 -->|"4. event stored alongside"| n4
  n4 -->|"5. commit"| n5
  n5 -->|"6. relay forwards"| n6
  n4 -->|"7. rollback - event discarded with the change"| n7
```

1. **No distributed transaction** — A service cannot span one transaction across its database and the message broker.

2. **Write the event in-transaction** — The Transactional Outbox stores the event in the same local transaction as the data update.

3. **Relay publishes later** — A separate process publishes the outbox rows to the broker after the commit.

```java
// ORDER SERVICE SIDE — publishing reliably: the event is written to the outbox in the SAME transaction as the data change
// PARTIES: SVC = Order Service · DB = PostgreSQL 16 @ orders-db-1 · BRK = the message broker
// STATE (before):
//    order : { id:"PO-2001", state:"NEW" }
//    outbox : []
// DEF: place_order_and_publish · CALLED BY: SVC
// -> command : "place_order"
//    step 1 · begin one local transaction on DB (the broker is NOT enlisted — no distributed transaction)
//    step 2 · update the data   // order.state : "NEW" -> "PLACED"
//    step 3 · write the event to the outbox in the same transaction   // outbox : [] -> [{event:"OrderPlaced", order_id:"PO-2001"}]
//    step 4 · COMMIT -> both rows durable or neither, so the event cannot be lost or published for a rolled-back change
//    step 5 · a relay later polls the outbox and marks the row sent   // outbox : [{event:"OrderPlaced",sent:false}] -> [{event:"OrderPlaced",sent:true}]
// <- outcome : event "OrderPlaced" published to BRK, atomically coupled to the data update
```


## System Design Interview

**The pipeline:** aggregate (publisher) → event broker (transport) → subscriber/consumer

### Order aggregate (in Order Service) — the publisher

_Role: aggregate/publisher_

```mermaid
flowchart TD
  R["Order aggregate (in Order Service) — the publisher"]
  R --> P0["change state — flips order state &quot;NEW&quot; -&gt; &quot;PLACED&quot;"]
  R --> P1["emit DomainEvent — produces &quot;OrderPlaced&quot; { order_id:&quot;PO-2001&quot; }"]
  R --> P2["Transactional Outbox — writes the event row in the same DB transaction"]
  R --> P3["Relay — polls the outbox after commit and publishes to the broker"]
```

### message broker — the transport

_Role: broker/transport_

```mermaid
flowchart TD
  R["message broker — the transport"]
  R --> P0["carries &quot;OrderPlaced&quot; from the publisher to every subscriber"]
  R --> P1["decouples the aggregate from the consumers"]
```

### CQRS view updater — the subscriber/consumer

_Role: subscriber/consumer_

```mermaid
flowchart TD
  R["CQRS view updater — the subscriber/consumer"]
  R --> P0["consume — receives &quot;OrderPlaced&quot; off the broker"]
  R --> P1["react — updates its read model order_count 0 -&gt; 1"]
```

```mermaid
flowchart LR
  AG["Order aggregate (publisher)"] -->|"emit OrderPlaced"| OB[("Transactional outbox (PostgreSQL 16 @ orders-db-1)")]
  OB -->|"relay publishes after commit"| BRK["message broker (transport)"]
  BRK -->|"deliver"| SUB["subscriber: CQRS view updater"]
  SUB -->|"order_count 0 -> 1"| V[("read model")]
```

```java
// SYSTEM DESIGN — domain event as a pipeline: aggregate (publisher) -> event broker (transport) -> subscriber (consumer)
// PARTIES: AG = Order aggregate (publisher, inside Order Service) · DB = PostgreSQL 16 @ orders-db-1 (holds the outbox table) · BRK = message broker (event transport) · SUB = CQRS view updater (subscriber/consumer)
// DEF: DomainEvent — the fact the aggregate emits when created or updated; here {type:"OrderPlaced", order_id:"PO-2001"}
// DEF: outbox — the table the event is written to in the SAME transaction as the data change; here row {event:"OrderPlaced", order_id:"PO-2001", sent:false}
// DEF: relay — the publisher process that polls the outbox after commit and publishes unsent rows; here it sends row "OrderPlaced"
// DEF: view — the subscriber's read model it updates per event; here {order_count:0}
// STATE (before):
//    order  : { id:"PO-2001", state:"NEW" }
//    outbox : []
//    view   : { order_count : 0 }
// DEF: place_order_and_publish · CALLED BY: AG handling command "place_order"
// -> command : "place_order"
//    step 1 · AG changes state    order : { id:"PO-2001", state:"NEW" } -> { id:"PO-2001", state:"PLACED" }
//    step 2 · AG emits the event and DB writes the outbox row in the SAME transaction    outbox : [] -> [{event:"OrderPlaced", order_id:"PO-2001", sent:false}]
//    step 3 · COMMIT makes both durable, then the relay publishes    outbox : [{sent:false}] -> [{sent:true}]  BECAUSE the relay polls the outbox and ships the row to BRK
//    step 4 · SUB consumes the event and reacts    view : { order_count : 0 } -> { order_count : 1 }  BECAUSE one more order was placed
// <- outcome : BRK delivered "OrderPlaced" { order_id:"PO-2001" } and SUB's view now reads order_count 1  BECAUSE the publisher wrote the outbox row atomically with the data change and the relay shipped it to the broker
```

## Interview Questions

### Q1

Your order service updates an order, but the CQRS read model still shows the old count and a choreography-based saga never advances. The update is invisible outside the service.

**Interviewer's question:** When does a service need to publish events, and what breaks if it does not?

**Solution:** A service needs to publish events when it updates its data — to keep a CQRS view fresh or to advance a choreography-based saga; without the publish step, consumers stay stale.

**System-design components:**
- Order write — local only
- CQRS view — needs the event to update
- Choreography saga — needs the event to advance
- Publish step — missing without the pattern

```mermaid
flowchart LR
  SVC["Order Service"] -->|state NEW to PLACED| DB[("Own data")]
  DB -.->|no event| VIEW["CQRS view stays stale"]
  DB -.->|no event| SAGA["Saga never advances"]
```

```java
// ORDER SERVICE SIDE — the problem the pattern solves: data changes, but the consumers that need to know are never told
// PARTIES: SVC = Order Service (writes) · VIEW = a CQRS read model · SAGA = a choreography-based saga coordinated via events
// STATE (before):
//    order : { id:"PO-77", state:"NEW" }
//    view : { placed_count : 0 }
//    saga : { next_step : "none" }
// DEF: place_order_without_publish · CALLED BY: SVC
// -> command : "place_order"
//    step 1 · SVC writes its own data locally : order.state : "NEW" -> "PLACED"
//    step 2 · the CQRS view is not notified and stays stale : view.placed_count : 0 -> 0
//    step 3 · the saga is not triggered and never advances : saga.next_step : "none" -> "none"
// <- outcome : order.state : "PLACED" · but every consumer still sees the old state, so the service needs a way to publish events when it updates data
```

_This is the Domain Event's motivation — an update without a publish step leaves CQRS views and sagas stale._

_Covers:_ The need: publish when data changes

_From the 28 problems:_ 19-distributed-message-queue · 26-payment-system

### Q2

You want a read model to count placed orders and a saga to react, and you want the event to come from the very object that changed.

**Interviewer's question:** What emits a domain event, and how does a consumer react to it?

**Solution:** A DDD aggregate emits a domain event when it is created or updated; the service publishes it, and a subscribing consumer handles it to update its own state.

**System-design components:**
- Order aggregate — emits OrderPlaced
- Service — publishes the event
- Broker — carries the event
- Consumer handler — updates the read model

```mermaid
flowchart LR
  AG["Order aggregate"] -->|state NEW to PLACED| EVT["OrderPlaced"]
  EVT -->|publish| BRK[("Broker")]
  BRK -->|deliver| CNS["Consumer handler"]
  CNS -->|order_count 0 to 1| VIEW[("Read model")]
```

```java
// ORDER SERVICE SIDE — an aggregate emits a domain event when it changes, and a consumer reacts to it
// PARTIES: AG = Order aggregate (in Order Service) · BRK = message broker · CSVC = the consuming service (a CQRS view updater)
// STATE (before):
//    order : { id:"PO-77", state:"NEW" }
//    events : []
//    view : { order_count : 0 }
// DEF: place_order · CALLED BY: the service on the aggregate
// -> command : "place_order"
//    step 1 · aggregate changes state : order.state : "NEW" -> "PLACED"
//    step 2 · aggregate emits an event : events : [] -> [{type:"OrderPlaced", order_id:"PO-77"}]
//    step 3 · service publishes "OrderPlaced" to BRK (via transactional outbox, same database transaction)
// <- output : event "OrderPlaced" { order_id:"PO-77" } published
// DEF: consume · CALLED BY: the consumer's event handler when BRK delivers "OrderPlaced"
// -> event : { type:"OrderPlaced", order_id:"PO-77" }
//    step 1 · handler updates the read model : view : { order_count : 0 } -> { order_count : 1 }   BECAUSE one more order was placed
// <- outcome : view.order_count : 1 · the CQRS view now reflects the aggregate's change, without the consumer calling the aggregate
```

_This is the Domain Event — aggregates emit events on create or update, and consumers react to them._

_Covers:_ Aggregates emit domain events

_From the 28 problems:_ 19-distributed-message-queue · 26-payment-system

### Q3

Your service updates an order and publishes OrderPlaced, but you are worried the event could be lost if the service crashes after the write, or emitted for a change that rolled back.

**Interviewer's question:** How does the Domain Event pattern publish the event atomically with the data change?

**Solution:** The service writes the event to an outbox in the same local transaction as the data update, so commit makes both durable; a relay publishes the outbox rows afterward.

**System-design components:**
- Local transaction — one commit for data and event
- Outbox row — the event stored in-transaction
- Relay — publishes after commit
- Broker — receives the event

```mermaid
flowchart LR
  SVC["Order Service"] -->|UPDATE order| DB[("Database")]
  SVC -->|INSERT outbox row| DB
  DB -->|COMMIT both| OK["Event durable with data"]
  OK -->|relay| BRK[("Broker")]
```

```java
// ORDER SERVICE SIDE — publishing reliably: the event is written to the outbox in the SAME transaction as the data change
// PARTIES: SVC = Order Service · DB = PostgreSQL 16 @ orders-db-1 · BRK = the message broker
// STATE (before):
//    order : { id:"PO-77", state:"NEW" }
//    outbox : []
// DEF: place_order_and_publish · CALLED BY: SVC
// -> command : "place_order"
//    step 1 · begin one local transaction on DB (the broker is NOT enlisted — no distributed transaction)
//    step 2 · update the data : order.state : "NEW" -> "PLACED"
//    step 3 · write the event to the outbox in the same transaction : outbox : [] -> [{event:"OrderPlaced", order_id:"PO-77"}]
//    step 4 · COMMIT -> both rows durable or neither, so the event cannot be lost or published for a rolled-back change
//    step 5 · a relay later polls the outbox and marks the row sent : outbox : [{event:"OrderPlaced",sent:false}] -> [{event:"OrderPlaced",sent:true}]
// <- outcome : event "OrderPlaced" published to BRK, atomically coupled to the data update
```

_This is the Domain Event's atomicity — the Transactional Outbox couples the event to the data change._

_Covers:_ Publish atomically with the data change

_From the 28 problems:_ 19-distributed-message-queue · 26-payment-system

### Q4

A user places an order and immediately reloads the order-count page, but the count still shows the old number for a moment before jumping.

**Interviewer's question:** Why are domain-event-driven consumers eventually consistent, and what does the read side see in the window?

**Solution:** The consumer reacts asynchronously after the event is delivered, so a CQRS view is briefly stale until the handler updates it.

**System-design components:**
- OrderPlaced event — published at commit
- Broker delivery — asynchronous
- Consumer handler — updates the view later
- Read side — briefly stale

```mermaid
flowchart LR
  WRITE["Order placed"] -->|OrderPlaced| BRK[("Broker")]
  BRK -->|delayed delivery| CNS["Consumer"]
  CNS -->|count 0 to 1| VIEW[("Read model")]
  VIEW -.->|stale until delivered| READER["Reader sees old count"]
```

```java
// CONSUMER SIDE — the read model catches up asynchronously, so it is briefly stale after the event is emitted
// PARTIES: SVC = Order Service · BRK = message broker · CNS = view-updating consumer
// STATE (before):
//    order : { id:"PO-77", state:"NEW" }
//    view : { order_count : 0 }
//    delivered : false
// DEF: place_order · CALLED BY: SVC at t=0ms
// -> command : "place_order"
//    step 1 · write commits and the event is published : order.state : "NEW" -> "PLACED" · event "OrderPlaced" queued
//    step 2 · the event has not reached CNS yet : delivered : false -> false   BECAUSE delivery is asynchronous, not inside the write
// <- state : view.order_count still 0 · a reader querying now sees the old count
// DEF: handle_event · CALLED BY: CNS when BRK delivers "OrderPlaced" at t=120ms
// -> event : { type:"OrderPlaced", order_id:"PO-77" }
//    step 1 · the handler updates the view : view : { order_count : 0 } -> { order_count : 1 }
//    step 2 · the view catches up : delivered : false -> true
// <- outcome : view.order_count : 1 · the read side was 120ms behind the write side
```

_This is the Domain Event's eventual-consistency tradeoff — consumers update their state after the event arrives, not during the write._

_Covers:_ The need: publish when data changes

_From the 28 problems:_ 19-distributed-message-queue · 26-payment-system

## Key Concepts

### The Problem

**A service changes data, but others need to know.** Those events might be needed to update a CQRS view, or to let the service participate in a choreography-based saga that uses events for coordination.


### The Solution

Organize the business logic of a service as a collection of DDD aggregates that emit domain events when they are created or updated.

```mermaid
flowchart LR
  SVC["Order Service"] -->|state NEW to PLACED| DB[("Own data")]
  DB -.->|no event| VIEW["CQRS view stays stale"]
  DB -.->|no event| SAGA["Saga never advances"]
```


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| Aggregates emit events on create or update | Organize the business logic of a service as a collection of DDD aggregates that emit domain events when they are created or updated. | The Order aggregate emits OrderPlaced, and the service publishes it. |
| Events are asynchronous and eventually consistent | The read side catches up asynchronously, so a CQRS view is briefly stale after the event is emitted. | A view updated by a consumer shows the new count only after the event is delivered. |
| Publishing must be atomic with the change | A service cannot enlist both its database and the broker in one distributed transaction, so it must use the Transactional Outbox to publish events as part of the database transaction. | The outbox row is written in the same transaction as the order update, then relayed to the broker. |


### Tradeoffs & When

- The read side catches up asynchronously, so a CQRS view is briefly stale after the event is emitted.
- A service cannot enlist both its database and the broker in one distributed transaction, so it must use the Transactional Outbox to publish events as part of the database transaction.


<details><summary>All concepts (index)</summary>

### Problem: A service changes data, but others need to know

**Why.** A service often needs to publish events when it updates its data.

**Claim.** Those events might be needed to update a CQRS view, or to let the service participate in a choreography-based saga that uses events for coordination.

**Grounding.** Without a publish step, an update stays local and the consumers never learn of it.

**In the wild.** A placed order that a read model must count, or a saga step that the next service must run.
### Solution: Aggregates emit events on create or update

**Why.** The aggregate is the unit that changes, so it is the natural place to record the change.

**Claim.** Organize the business logic of a service as a collection of DDD aggregates that emit domain events when they are created or updated.

**Grounding.** The service publishes these domain events so that they can be consumed by other services.

**In the wild.** The Order aggregate emits OrderPlaced, and the service publishes it.
### Tradeoff: Events are asynchronous and eventually consistent

**Why.** A consumer reacts to a published event later, not inside the write.

**Claim.** The read side catches up asynchronously, so a CQRS view is briefly stale after the event is emitted.

**Grounding.** The event is published so other services can consume it — consumption is decoupled from the update.

**In the wild.** A view updated by a consumer shows the new count only after the event is delivered.
### Tradeoff: Publishing must be atomic with the change

**Why.** An event emitted for a rolled-back change is a lie, and a lost event breaks the consumers.

**Claim.** A service cannot enlist both its database and the broker in one distributed transaction, so it must use the Transactional Outbox to publish events as part of the database transaction.

**Grounding.** Event sourcing is sometimes used instead to publish domain events.

**In the wild.** The outbox row is written in the same transaction as the order update, then relayed to the broker.

</details>


## Quiz

1. When does a service need to publish events?

   - A. Only when it shuts down
   - B. When it updates its data
   - C. Only during deployment
   - D. When it has no consumers

<details><summary>Reveal answer</summary>

**B.** A service often needs to publish events when it updates its data, for example to update a CQRS view or coordinate a saga. The other options are not the trigger for publishing.

</details>

2. What emits the domain events?

   - A. DDD aggregates, when they are created or updated
   - B. The message broker
   - C. The API gateway
   - D. The database schema

<details><summary>Reveal answer</summary>

**A.** DDD aggregates emit domain events when they are created or updated; the service then publishes them. The broker only carries the events, and the gateway and schema do not emit domain events.

</details>

3. Which patterns create the need for the Domain Event pattern?

   - A. Saga and CQRS
   - B. Service mesh and sidecar
   - C. Health check and audit logging
   - D. Circuit breaker and access token

<details><summary>Reveal answer</summary>

**A.** The Saga and CQRS patterns create the need for domain events: CQRS needs events to update views, and a choreography-based saga uses events for coordination. The others do not require domain events.

</details>

4. Which pattern publishes events as part of a database transaction?

   - A. Transactional Outbox
   - B. Client-side discovery
   - C. Self-registration
   - D. Serverless deployment

<details><summary>Reveal answer</summary>

**A.** The Transactional Outbox pattern publishes events as part of the database transaction, so the event and the data change commit or roll back together. The others are unrelated to event publishing.

</details>

