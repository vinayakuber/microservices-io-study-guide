# Chapter 19: Event Sourcing

> Persist a business entity as a sequence of state-changing events and rebuild its current state by replaying them.

_Also known as: Chris Richardson · Microservice Patterns · microservices.io /patterns/data/event-sourcing.html_

## Flow

### Persist state as a sequence of events

> **Why this matters:** A command that must update the database and publish an event cannot do both atomically with 2PC, yet letting them drift corrupts the data. Appending one event makes the state change and its publishable event the same single write.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Append, do not update in place</b><br/>each change adds an event instead of rewriting a row"]:::start
  n1["<b>2. Build the event from the command</b><br/>E1 OrderCreated with customer C-100 total 125.00"]:::step
  n2["<b>3. Append to the event store</b><br/>events gains E1, one atomic write"]:::core
  n3["<b>4. Apply to in-memory state</b><br/>orderState CREATED, customerId C-100"]:::step
  n4["<b>5. Next command appends E2</b><br/>OrderApproved C-100, state CREATED becomes APPROVED"]:::step
  n5["<b>6. History is the source of truth</b><br/>no current-state row anywhere"]:::stop
  n6["<b>In-place update instead</b><br/>rewriting a row loses the publishable event"]:::warn
  n0 -->|"1. change becomes an event"| n1
  n1 -->|"2. command folded to an event"| n2
  n2 -->|"3. apply to memory"| n3
  n2 -->|"4. next change appends again"| n2
  n3 -->|"5. E1 then E2 build the history"| n4
  n4 -->|"6. the store holds events only"| n5
  n0 -->|"7. avoided - update in place loses the event"| n6
```

1. **Append, do not update in place** — Instead of rewriting a current-state row, each change appends a new event to the list of events for that entity.

2. **Store the events in an event store** — A database of events with an API for adding and retrieving the events of an entity.

3. **Rely on the single-write atomicity** — Saving one event is one operation, so it is inherently atomic — no 2PC with the broker.

```java
// EVENT SOURCING SIDE — the store holds events, not current state; each change is one atomic append
// PARTIES: SVC = Order Service · ES = Event Store · CS = CustomerService (subscriber)
// STATE (before):
//    events : []                        // the Order's event list — its full history, empty before creation
//    state : { orderState:null, customerId:null }
// DEF: create order · CALLED BY: SVC processing a CreateOrderCommand
// -> customerId : "C-100" · -> orderTotal : 125.00
//    step 1 · build the event : E1 = OrderCreatedEvent("C-100", 125.00)   // the command becomes an event
//    step 2 · append to the store : events : [] -> [E1:OrderCreated("C-100",125.00)]   BECAUSE saving an event is a single operation, inherently atomic
//    step 3 · apply to memory : state.orderState : null -> "CREATED" · state.customerId : null -> "C-100"
// <- event : E1:OrderCreated("C-100",125.00) · delivered to every subscriber, including CS
//
// DEF: approve order · CALLED BY: SVC processing an ApproveOrderCommand
// -> customerId : "C-100"
//    step 1 · build : E2 = OrderApprovedEvent("C-100")
//    step 2 · append : events : [E1:OrderCreated("C-100",125.00)] -> [E1:OrderCreated("C-100",125.00), E2:OrderApproved("C-100")]
//    step 3 · apply : state.orderState : "CREATED" -> "APPROVED"
// <- event : E2:OrderApproved("C-100") · delivered to every subscriber
```

### Rebuild current state by replaying events

> **Why this matters:** Because the store holds history instead of a ready-to-read row, the application must fold the events back into current state. Replay order is the write order, so the reconstructed state is deterministic.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Read the full event list</b><br/>E1 OrderCreated C-100 and E2 OrderApproved C-100"]:::start
  n1["<b>2. Apply events in order</b><br/>fold each event through its apply method"]:::step
  n2["<b>3. E1 sets state and id</b><br/>orderState CREATED, customerId C-100"]:::core
  n3["<b>4. E2 advances state</b><br/>orderState CREATED becomes APPROVED"]:::core
  n4["<b>5. Last fold is current state</b><br/>rebuilt from 2 events, no current-state table"]:::stop
  n5["<b>Reordered replay</b><br/>E2 before E1 leaves orderState CREATED"]:::warn
  n0 -->|"1. retrieve the history"| n1
  n1 -->|"2. next event folds in"| n1
  n1 -->|"3. E1 sets state and id"| n2
  n2 -->|"4. E2 advances state"| n3
  n3 -->|"5. last fold is current state"| n4
  n1 -->|"6. wrong order - wrong state"| n5
```

1. **Read the full event list** — The application retrieves the full sequence of events for the aggregate.

2. **Apply each event in order** — An apply() method per event type folds it into state — OrderCreated sets CREATED and the customer id.

3. **Stop at the last event** — The final folded value is the current state, with no separate current-state table.

```java
// EVENT SOURCING SIDE — current state is never stored; it is re-derived by folding every event in order
// PARTIES: SVC = Order Service · ES = Event Store
// STATE (before):
//    events : [E1:OrderCreated("C-100",125.00), E2:OrderApproved("C-100")]
//    state : { orderState:null, customerId:null }      // empty before replay
// DEF: replay · CALLED BY: SVC loading the Order — reads the event list and applies each event in sequence
// -> entityId : "PO-100"
//    step 1 · apply E1 sets state : state.orderState : null -> "CREATED"
//    step 2 · apply E1 copies id : state.customerId : null -> "C-100"   BECAUSE apply(OrderCreatedEvent) sets state and copies the customer id
//    step 3 · apply E2 : state.orderState : "CREATED" -> "APPROVED"   BECAUSE apply(OrderApprovedEvent) sets state to APPROVED
// <- state : { orderState:"APPROVED", customerId:"C-100" } · replayed from 2 events
//    alt wrong order : replaying E2 before E1 would leave orderState "CREATED", so event order must be preserved
```

### Shorten replay with snapshots

> **Why this matters:** Entities such as a Customer accumulate many events, so replaying everything is wasteful. A periodic snapshot of current state means only the events since that snapshot need to be folded.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Save a periodic snapshot</b><br/>current state stored as of event 3, balance 100.00"]:::start
  n1["<b>2. Load the newest snapshot</b><br/>start from balance 100.00, not empty"]:::step
  n2["<b>3. Replay only events after it</b><br/>fold E4 Debit 25.00"]:::core
  n3["<b>4. Fold the tail</b><br/>balance 100.00 becomes 75.00"]:::step
  n4["<b>5. Count the replay</b><br/>replayed 4 becomes 1"]:::step
  n5["<b>6. Rebuild is shorter</b><br/>one event instead of four"]:::stop
  n6["<b>Stale snapshot</b><br/>events before the snapshot never replayed, snapshot must stay current"]:::warn
  n0 -->|"1. capture state as of seq 3"| n1
  n1 -->|"2. load from the snapshot"| n2
  n2 -->|"3. only the tail events"| n3
  n3 -->|"4. fold the debit"| n4
  n4 -->|"5. fewer events to fold"| n5
  n0 -->|"6. snapshot lags - replay drifts"| n6
```

1. **Save a snapshot of current state** — Periodically persist the current state of the entity as of some event.

2. **Load the newest snapshot** — To reconstruct, find the most recent snapshot instead of starting empty.

3. **Replay only the later events** — Fold the events since the snapshot, so there are fewer events to replay.

```java
// EVENT SOURCING SIDE — a snapshot shortens replay: load the newest snapshot, then fold only the events after it
// PARTIES: SVC = Customer Service · ES = Event Store
// STATE (before):
//    snapshot : { balance:100.00, seq:3 }      // Customer's state saved at event 3
//    events : [E1:Created, E2:Credit+50.00, E3:Credit+50.00, E4:Debit-25.00]
// DEF: load · CALLED BY: SVC reading the Customer — finds the most recent snapshot, then only the events since it
// -> entityId : "C-100"
//    step 1 · start from the snapshot : state.balance : null -> 100.00   BECAUSE the snapshot already folded E1..E3
//    step 2 · replay only E4 : state.balance : 100.00 -> 75.00   BECAUSE Debit-25.00 subtracts from the snapshot balance
//    step 3 · count the replay : replayed : 4 -> 1   BECAUSE only the events after seq 3 need folding
// <- state : { balance:75.00 } · rebuilt from 1 event instead of 4
```

### Let the event store deliver to subscribers

> **Why this matters:** The reliable-publish problem dissolves because the store itself behaves like a message broker: a subscriber receives each saved event, so publishing is a by-product of persisting.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Subscribe to entity events</b><br/>CustomerService registers reserveCredit on OrderCreated"]:::start
  n1["<b>2. Store delivers on save</b><br/>saving an event hands it to each subscriber"]:::step
  n2["<b>3. Handler reads the payload</b><br/>customerId C-100, orderTotal 125.00"]:::step
  n3["<b>4. Update own aggregate</b><br/>balance 200.00 becomes 75.00, reserve PO-100 125.00"]:::core
  n4["<b>5. Publishing is a by-product</b><br/>the store behaves like a broker, no outbox needed"]:::step
  n5["<b>6. Subscriber state follows the event</b><br/>Customer updated from the Order event"]:::stop
  n6["<b>Subscriber misses the event</b><br/>no delivery, no reservation, credit never reserved"]:::warn
  n0 -->|"1. handler registered"| n1
  n1 -->|"2. event delivered on save"| n2
  n2 -->|"3. unpack the event"| n3
  n3 -->|"4. own state updated"| n4
  n4 -->|"5. no separate publisher"| n5
  n1 -->|"6. delivery missed - no reservation"| n6
```

1. **Subscribe to entity events** — A service registers a handler such as CustomerService.reserveCredit on OrderCreatedEvent.

2. **Receive the event on save** — When a service saves an event, the store delivers it to every interested subscriber.

3. **Update the subscriber state** — The handler reads the event payload and updates its own aggregate, reserving credit for the order.

```java
// EVENT SOURCING SIDE — the event store doubles as a broker, so a subscriber reacts to another service's events
// PARTIES: SVC = CustomerService (subscriber) · ES = Event Store (delivers like a broker)
// STATE (before):
//    reserved : {}                       // credit the Customer has reserved per order, empty
//    balance : 200.00
// DEF: reserveCredit · CALLED BY: ES delivering an OrderCreatedEvent to the subscribed CustomerService
// -> event : OrderCreatedEvent("C-100", 125.00) · -> orderId : "PO-100"
//    step 1 · read the payload : customerId : null -> "C-100" · orderTotal : null -> 125.00   BECAUSE the handler unpacks the event it received
//    step 2 · reserve credit : balance : 200.00 -> 75.00   BECAUSE reserveCredit subtracts the order total 125.00 from the 200.00 available
//    step 3 · record the reservation : reserved : {} -> { "PO-100":125.00 }
// <- state : { balance:75.00, reserved:{"PO-100":125.00} } · the Customer's own state updated from the Order's event
```


## Key Concepts

### The Problem

**Updating the database and publishing events is not atomic.** Without a distributed transaction the two cannot be made reliable: a message sent mid-transaction may not commit, and a message sent after commit may never be sent if the service crashes first.


### The Solution

Event sourcing persists a business entity (an Order or a Customer) as a sequence of state-changing events; whenever state changes a new event is appended, and current state is rebuilt by replaying them.


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| Persist state as a sequence of events | Event sourcing persists a business entity (an Order or a Customer) as a sequence of state-changing events; whenever state changes a new event is appended, and current state is rebuilt by replaying them. | The Eventuate Customers and Orders example stores each Order as a sequence of events rather than a row in an ORDERS table. |
| Replay is expensive and queries become hard | The event store is difficult to query because typical queries must reconstruct state, which is complex and inefficient — so reads are moved to CQRS, and the system must handle eventually consistent data. | A read of a Customer means replaying its events unless a snapshot shortens the work. |
| A new programming style with real benefits | Event sourcing is an unfamiliar style with a learning curve, but it reliably publishes events on every state change, avoids object-relational impedance mismatch, gives a 100% reliable audit log, and enables temporal queries of state at any point in time. | Event-sourced services exchange events loosely, which the book says eases migration from a monolith to microservices. |


### Tradeoffs & When

- The event store is difficult to query because typical queries must reconstruct state, which is complex and inefficient — so reads are moved to CQRS, and the system must handle eventually consistent data.
- Event sourcing is an unfamiliar style with a learning curve, but it reliably publishes events on every state change, avoids object-relational impedance mismatch, gives a 100% reliable audit log, and enables temporal queries of state at any point in time.


<details><summary>All concepts (index)</summary>

### Problem: Updating the database and publishing events is not atomic

**Why.** A service command must update or delete aggregates in the database and send messages to a broker at the same time, or data and messages drift apart.

**Claim.** Without a distributed transaction the two cannot be made reliable: a message sent mid-transaction may not commit, and a message sent after commit may never be sent if the service crashes first.

**Grounding.** The pattern rules out 2PC because the database or broker may not support it, and coupling the service to both is undesirable.

**In the wild.** A saga participant or a service publishing a domain event faces exactly this database-plus-message atomicity problem.
### Solution: Persist state as a sequence of events

**Why.** Appending one event is a single operation, so the state change and the publishable event are the same write and cannot diverge.

**Claim.** Event sourcing persists a business entity (an Order or a Customer) as a sequence of state-changing events; whenever state changes a new event is appended, and current state is rebuilt by replaying them.

**Grounding.** Events live in an event store that adds and retrieves an entity's events and also delivers them to subscribers like a message broker.

**In the wild.** The Eventuate Customers and Orders example stores each Order as a sequence of events rather than a row in an ORDERS table.
### Tradeoff: Replay is expensive and queries become hard

**Why.** The store holds history, not a ready-to-read current state, so answering a question means folding events first.

**Claim.** The event store is difficult to query because typical queries must reconstruct state, which is complex and inefficient — so reads are moved to CQRS, and the system must handle eventually consistent data.

**Grounding.** The resulting context lists the difficult-to-query store as a drawback that forces CQRS and eventual consistency.

**In the wild.** A read of a Customer means replaying its events unless a snapshot shortens the work.
### Tradeoff: A new programming style with real benefits

**Why.** The team trades a familiar pattern for capabilities that are hard to get any other way.

**Claim.** Event sourcing is an unfamiliar style with a learning curve, but it reliably publishes events on every state change, avoids object-relational impedance mismatch, gives a 100% reliable audit log, and enables temporal queries of state at any point in time.

**Grounding.** The resulting context enumerates the learning curve as a drawback and the audit-log and temporal-query abilities as benefits.

**In the wild.** Event-sourced services exchange events loosely, which the book says eases migration from a monolith to microservices.

</details>


## Quiz

1. Event sourcing persists an entity's state as what?

   - A. A single current-state row
   - B. A sequence of state-changing events
   - C. A snapshot only
   - D. A set of database triggers

<details><summary>Reveal answer</summary>

**B.** The pattern stores a business entity as a sequence of events, appending a new one each time state changes; A is the traditional approach it replaces, and C is only an optimization layered on top.

</details>

2. Why is saving an event inherently atomic?

   - A. It uses a 2PC distributed transaction
   - B. It enlists the message broker in the transaction
   - C. It applies a compensating saga
   - D. Saving a single event is a single operation

<details><summary>Reveal answer</summary>

**D.** One append is one write, so the state change and its publishable event cannot split; A and B describe the 2PC approach the pattern explicitly rejects.

</details>

3. How does an application reconstruct an entity's current state?

   - A. By querying the latest row
   - B. By reading only the newest snapshot
   - C. By replaying the sequence of events
   - D. By asking the message broker

<details><summary>Reveal answer</summary>

**C.** Current state is rebuilt by folding the events in order; a snapshot only reduces how many events must be replayed, so B is incomplete.

</details>

4. What does the event store also behave like?

   - A. A message broker
   - B. A cache
   - C. A load balancer
   - D. A relational view

<details><summary>Reveal answer</summary>

**A.** The store delivers each saved event to interested subscribers, so it plays the broker's role in publishing events on state change.

</details>

