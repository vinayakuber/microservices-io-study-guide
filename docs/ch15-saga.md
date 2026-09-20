# Chapter 15: Saga

> Implement each business transaction that spans services as a sequence of local transactions, each updating its own database and publishing a message or event to trigger the next, with compensating transactions that undo earlier changes when a step fails.

_Also known as: Chris Richardson · Microservice Patterns Ch.15 (p.114) · microservices.io /patterns/data/saga.html_

## Flow

### Transactions that span services

> **Why this matters:** With Database per Service, Orders and Customers live in different databases owned by different services, so one local ACID transaction cannot both insert the order and check the credit limit. 2PC is not an option, so a different mechanism is needed for transactions that span services.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Database per Service</b><br/>Orders and Customers live in separate databases owned by different services"]:::start
  n1["<b>2. A transaction spans services</b><br/>creating order PO-2001, total 100.00, must check the credit limit"]:::step
  n2["<b>3. Begin local tx on ORDDB</b><br/>the broker and CSDB are not enlisted"]:::step
  n3["<b>4. Insert the order</b><br/>orders : empty becomes PO-2001 PENDING"]:::step
  n4["<b>5. Deduct credit fails</b><br/>customer_credit errors no such table, customers lives in CSDB not ORDDB"]:::warn
  n5["<b>6. Transaction aborts</b><br/>orders rolls back to empty, outcome ROLLBACK"]:::warn
  n6["<b>7. 2PC is not an option</b><br/>would enlist both databases but couples services and can block"]:::core
  n7["<b>8. A saga replaces one tx</b><br/>a sequence of local transactions with compensating steps"]:::stop
  n0 -->|"each service owns its database"| n1
  n1 -->|"the order must check credit"| n2
  n2 -->|"try a local ACID transaction"| n3
  n3 -->|"update the credit limit"| n4
  n4 -->|"no such table"| n5
  n5 -->|"local tx cannot span services"| n6
  n2 -->|"alt - enlist both databases"| n6
  n6 -->|"so use a saga"| n7
```

1. **Database per Service** — Orders and Customers each live in their own database, owned by different services.

2. **A transaction spans services** — Creating an order must also check that the total does not exceed the credit limit.

3. **No local ACID, no 2PC** — One local transaction cannot reach the database of another service, and two-phase commit is not an option.

```java
// ORDER SERVICE SIDE — a local ACID transaction cannot reach the credit data that lives in another service
// PARTIES: ORD = Order Service · ORDDB = PostgreSQL 16 @ orders-db-1 · CS = Customer Service · CSDB = PostgreSQL 16 @ customers-db-1
// DEF: credit — the customer's spending limit owned by the Customer Service = 100.00 (the order total that must not exceed it)
// STATE (before):
//    orders : {}
//    customer_credit : {}          // owned by CS in CSDB, invisible to ORDDB
// DEF: create_order · CALLED BY: CLIENT via POST /orders
// -> order_id : "PO-2001" · -> total : 100.00
//    step 1 · BEGIN a local transaction on ORDDB (the broker and CSDB are NOT enlisted)
//    step 2 · INSERT the order   // orders : {} -> {"PO-2001":"PENDING"}
//    step 3 · try to deduct credit   // customer_credit : {} -> ERROR "no such table"  BECAUSE customers lives in CSDB, not ORDDB
//    step 4 · the UPDATE fails, so the transaction aborts   // orders : {"PO-2001":"PENDING"} -> {} (rolled back)
// <- outcome : "ROLLBACK" · the one-database transaction cannot span the two services
//    alt 2PC : would enlist ORDDB and CSDB, but 2PC is not an option BECAUSE it couples the services and can block
```

### Orchestration: an orchestrator directs the steps

> **Why this matters:** Orchestration keeps the sequence in one place: an orchestrator object tells each participant which local transaction to run next, so the happy path and every failure path are explicit and one component owns the whole saga.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Client POSTs /orders</b><br/>Order Service creates the create-order saga orchestrator"]:::start
  n1["<b>2. LT1 create order PENDING</b><br/>orders : empty becomes PO-2001 PENDING"]:::step
  n2["<b>3. Send ReserveCredit</b><br/>orchestrator sends ReserveCredit saga SAGA-1 amount 100.00 to Customer Service"]:::step
  n3["<b>4. LT2 reserve credit</b><br/>reserved becomes SAGA-1, credit 500.00 becomes 400.00"]:::core
  n4["<b>5. CS replies credit_reserved</b><br/>orchestrator sends CreateTicket to Kitchen Service"]:::step
  n5["<b>6. LT3 ticket rejected</b><br/>item not available, tickets stays empty"]:::warn
  n6["<b>7. Compensate LT2</b><br/>ReleaseCredit returns the held 100.00, credit 400.00 becomes 500.00"]:::warn
  n7["<b>8. Compensate LT1</b><br/>order PENDING becomes REJECTED"]:::warn
  n8["<b>9. Outcome OrderRejected</b><br/>order REJECTED, credit fully released, no ticket created"]:::stop
  n9["<b>10. Alt success path</b><br/>KIT replies ticket_created, order PENDING becomes APPROVED, no compensation"]:::stop
  n10["<b>11. Idempotent retry guard</b><br/>a retried ReserveCredit SAGA-1 is skipped because already in reserved"]:::core
  n0 -->|"create the orchestrator"| n1
  n1 -->|"orchestrator commands CS"| n2
  n2 -->|"CS reserves credit"| n3
  n3 -->|"retried command arrives"| n10
  n10 -->|"already reserved - skip"| n3
  n3 -->|"reply credit_reserved"| n4
  n4 -->|"send CreateTicket to KIT"| n5
  n4 -->|"alt - KIT accepts"| n9
  n5 -->|"ticket_rejected - compensate"| n6
  n6 -->|"release credit"| n7
  n7 -->|"reject order"| n8
```

1. **Create the saga orchestrator** — The Order Service receives POST /orders and creates the Create Order saga orchestrator.

2. **Create the order PENDING** — The orchestrator creates the Order in the PENDING state.

3. **Send the Reserve Credit command** — The orchestrator sends a Reserve Credit command to the Customer Service.

4. **Reserve credit and reply** — The Customer Service attempts to reserve credit and sends back a reply indicating the outcome.

5. **Approve, reject, or compensate** — The orchestrator approves or rejects the Order; on failure it runs compensating transactions that undo earlier steps.

```java
// ORDER SERVICE SIDE — an orchestrated create-order saga across three services, with a failure and full compensation
// PARTIES: CLIENT = the user · ORD = Order Service (runs the orchestrator) · CS = Customer Service · KIT = Kitchen Service
// DEF: credit — the customer's available balance a saga step reserves and releases = { "CUST-7" : 500.00 }
// STATE (before):
//    orders : {}
//    customer_credit : { "CUST-7" : 500.00 }     // available credit, owned by Customer Service
//    reserved : {}                               // sagas CS has already reserved for (idempotency guard)
//    tickets : {}                                // owned by Kitchen Service
// DEF: create-order saga orchestrator · created by ORD when CLIENT POSTs /orders
// -> order_id : "PO-2001" · -> customer_id : "CUST-7" · -> total : 100.00
//    step 1 · LT1 on ORD : create the order   // orders : {} -> {"PO-2001":"PENDING"}
//    step 2 · send ReserveCredit(saga="SAGA-1", amount=100.00) to CS
//    step 3 · LT2 on CS : if "SAGA-1" already in reserved -> skip (idempotent retry); else reserve   // reserved : {} -> {"SAGA-1"} · customer_credit : {"CUST-7":500.00} -> {"CUST-7":400.00}  BECAUSE 100.00 of the 500.00 is held
//    step 4 · CS replies "credit_reserved" -> orchestrator sends CreateTicket(order_id="PO-2001") to KIT
//    step 5 · LT3 on KIT : the ticket is rejected BECAUSE the item is not available   // tickets : {} -> {} (nothing created)
//    step 6 · KIT replies "ticket_rejected" -> the orchestrator runs the COMPENSATING transactions
//    step 7 · COMPENSATE LT2 : ReleaseCredit(saga="SAGA-1", amount=100.00) to CS   // customer_credit : {"CUST-7":400.00} -> {"CUST-7":500.00}  BECAUSE the held 100.00 is returned
//    step 8 · COMPENSATE LT1 : reject the order   // orders : {"PO-2001":"PENDING"} -> {"PO-2001":"REJECTED"}
// <- outcome : "OrderRejected" · order REJECTED, credit fully released, no ticket created
//    alt success : KIT replies "ticket_created" -> orders : {"PO-2001":"PENDING"} -> {"PO-2001":"APPROVED"} (no compensation)
//       -> a retried ReserveCredit(saga="SAGA-1") is skipped BECAUSE "SAGA-1" is already in reserved (ON CONFLICT / already-seen guard)
```

### Choreography: events trigger the next step

> **Why this matters:** Choreography distributes the sequence: each local transaction publishes a domain event that triggers the next service's local transaction, so there is no central coordinator to maintain.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. POST /orders</b><br/>total 100.00, no central orchestrator"]:::start
  n1["<b>2. LT1 create order PENDING</b><br/>orders : empty becomes PO-2001 PENDING"]:::step
  n2["<b>3. Publish OrderCreated</b><br/>the event triggers the next local transaction in CS"]:::step
  n3["<b>4. CS handler reserves credit</b><br/>credit 500.00 becomes 400.00, 100.00 reserved"]:::core
  n4["<b>5. Publish CreditReserved</b><br/>credit_events : empty becomes CreditReserved"]:::step
  n5["<b>6. ORD handler approves</b><br/>orders PENDING becomes APPROVED"]:::step
  n6["<b>7. Order approved</b><br/>each event is the trigger for the next step"]:::stop
  n7["<b>8. Failure mid-chain</b><br/>a failed step needs a compensating event, no coordinator tracks the whole saga"]:::warn
  n0 -->|"start the handler chain"| n1
  n1 -->|"emit OrderCreated"| n2
  n2 -->|"event reaches CS"| n3
  n3 -->|"emit CreditReserved"| n4
  n3 -->|"credit check fails"| n7
  n4 -->|"event reaches ORD"| n5
  n5 -->|"order approved"| n6
```

1. **Create the order PENDING** — The Order Service receives POST /orders and creates an Order in the PENDING state.

2. **Emit Order Created** — It emits an Order Created event.

3. **Reserve credit on the event** — The Customer Service event handler attempts to reserve credit.

4. **Emit the outcome** — It emits an event indicating the outcome.

5. **Approve or reject** — The Order Service event handler either approves or rejects the Order.

```java
// ORDER SERVICE SIDE — choreography: each local transaction publishes a domain event that triggers the next local transaction
// PARTIES: ORD = Order Service · CS = Customer Service · BRK = the events travelling between them
// DEF: credit — the customer's available balance a saga step reserves = { "CUST-7" : 500.00 }
// DEF: event — a domain message a service publishes to trigger the next local transaction = "OrderCreated"
// STATE (before):
//    orders : {}
//    customer_credit : { "CUST-7" : 500.00 }
//    credit_events : []
// DEF: choreographed handler chain · one event carries the saga forward, no orchestrator
// -> POST /orders : total = 100.00
//    step 1 · LT1 on ORD : create the order   // orders : {} -> {"PO-2001":"PENDING"}
//    step 2 · ORD publishes "OrderCreated"   // the event triggers the next local transaction in CS
//    step 3 · CS handler receives "OrderCreated" and reserves credit   // customer_credit : {"CUST-7":500.00} -> {"CUST-7":400.00}  BECAUSE 100.00 is reserved
//    step 4 · CS publishes "CreditReserved"   // credit_events : [] -> ["CreditReserved"]
//    step 5 · ORD handler receives "CreditReserved" and approves   // orders : {"PO-2001":"PENDING"} -> {"PO-2001":"APPROVED"}
// <- outcome : order "PO-2001" APPROVED · no central coordinator — each event is the trigger for the next step
```

### Resulting context: compensation, isolation, reliability

> **Why this matters:** A saga has no automatic rollback and no ACID isolation, and a service cannot enlist both its database and the message broker in one distributed transaction. Knowing the trade-offs lets you design compensating transactions and a reliable outcome signal to the client.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. POST returns id while saga runs</b><br/>orders PO-2001 status PENDING"]:::start
  n1["<b>2. No automatic rollback</b><br/>developer designs compensating transactions that undo earlier changes"]:::warn
  n2["<b>3. No isolation</b><br/>concurrent sagas cause anomalies, countermeasures are needed"]:::warn
  n3["<b>4. Atomic update and publish</b><br/>service uses Transactional Outbox to commit state and event together"]:::core
  n4["<b>5. Poll one, GET /orders</b><br/>poll_count : 0 becomes 1"]:::step
  n5["<b>6. Status PENDING</b><br/>the saga has not finished, credit not yet reserved"]:::step
  n6["<b>7. Background saga completes</b><br/>credit reserved then approved, status becomes APPROVED"]:::core
  n7["<b>8. Poll two, GET again</b><br/>poll_count : 1 becomes 2"]:::step
  n8["<b>9. Status APPROVED</b><br/>the client learns the outcome"]:::stop
  n9["<b>Alt outcome signals</b><br/>reply only when complete, or push OrderApproved over a websocket or webhook"]:::warn
  n0 -->|"three resulting forces first"| n1
  n1 -->|"design undo steps"| n2
  n2 -->|"add countermeasures"| n3
  n3 -->|"outbox gives atomic publish"| n4
  n4 -->|"first poll"| n5
  n5 -->|"still PENDING - poll again"| n4
  n5 -->|"saga completes in background"| n6
  n6 -->|"status now APPROVED"| n7
  n7 -->|"second poll"| n8
  n0 -->|"alt - wait for reply or webhook"| n9
```

1. **No automatic rollback** — A developer must design compensating transactions that explicitly undo earlier changes.

2. **No isolation** — Concurrent sagas can cause data anomalies, so countermeasures that implement isolation are needed.

3. **Atomic update and publish** — A service must atomically update its database and publish its message, using patterns such as the Transactional Outbox.

4. **Tell the client the outcome** — A synchronous initiator learns the result by waiting, by polling GET /orders/{id}, or by an event such as a webhook.

```java
// ORDER SERVICE SIDE — how a synchronous client learns the outcome of an asynchronous saga
// PARTIES: CLIENT = the user · ORD = Order Service
// STATE (before):
//    orders : { "PO-2001" : { status : "PENDING" } }
//    poll_count : 0
// DEF: client outcome for order "PO-2001" · the POST returned the id while the saga was still running
// -> GET /orders/PO-2001 : poll #1
//    step 1 · first poll   // poll_count : 0 -> 1  BECAUSE the client issued its first status query
//    step 2 · ORD returns status "PENDING"   // the saga has not finished — credit not yet reserved
//    step 3 · in the background the saga completes: credit reserved, then approved   // orders : {"PO-2001":{status:"PENDING"}} -> {"PO-2001":{status:"APPROVED"}}
// -> GET /orders/PO-2001 : poll #2
//    step 4 · second poll   // poll_count : 1 -> 2  BECAUSE the client polls again
//    step 5 · ORD returns status "APPROVED"
// <- outcome : "APPROVED" · alt = reply only when the saga completes, or push "OrderApproved" over a websocket/webhook instead of polling
```


## System Design Interview

**The pipeline:** orchestrator → participant services → event/message broker

### saga orchestrator — the orchestrator

_Role: orchestrator_

```mermaid
flowchart TD
  R["saga orchestrator — the orchestrator"]
  R --> P0["Orders each participant to act"]
  R --> P1["Tracks the saga state"]
  R --> P2["Triggers compensations on failure"]
```

### order service — the participant

_Role: participant service_

```mermaid
flowchart TD
  R["order service — the participant"]
  R --> P0["Executes its step"]
  R --> P1["Publishes its outcome event"]
```

### customer service — the participant

_Role: participant service_

```mermaid
flowchart TD
  R["customer service — the participant"]
  R --> P0["Reserves credit for the order"]
  R --> P1["Publishes CreditReserved"]
```

### event / message broker (RabbitMQ) — the broker

_Role: broker_

```mermaid
flowchart TD
  R["event / message broker (RabbitMQ) — the broker"]
  R --> P0["Carries step results back to the orchestrator"]
```

```mermaid
flowchart LR
  ORCH["saga orchestrator"] -->|"reserve credit 100.00"| CS["customer service"]
  CS -->|"CreditReserved"| BRK[("message broker RabbitMQ")]
  BRK -->|"step outcome"| ORCH
  ORCH -->|"create ticket"| KIT["kitchen service"]
  ORD["order service"] -->|"OrderCreated"| ORCH
```

```java
// SYSTEM DESIGN — saga (orchestrated) as a pipeline: orchestrator -> participant services -> event/message broker (each step executes + records state, compensations on failure)
// PARTIES: ORCH = saga orchestrator (orders steps, tracks state, compensates) · ORD = order service (participant) · CS = customer service (participant) · KIT = kitchen service (participant) · BRK = message broker (RabbitMQ)
// DEF: orders — ORD's datastore; here PostgreSQL 16 @ orders-db-1, row ("PO-77", "PENDING")
// DEF: customers — CS's datastore; here PostgreSQL 16 @ customers-db-1, row ("CUST-7", credit 500.00)
// DEF: events — the emitted event stream; here [ "OrderCreated", "CreditReserved", "ticket_created" ]
// DEF: state — the saga's state; here "NEW" -> "COMPLETED"
// STATE (before):
//    orders    : [ ("PO-77", "PENDING") ]
//    customers : [ ("CUST-7", credit 500.00) ]
//    events    : []
//    state     : "NEW"
// DEF: run_saga · CALLED BY: ORCH receiving "OrderCreated" for PO-77
// -> command : "reserve credit 100.00 for CUST-7"
//    step 1 · ORCH orders CS to reserve credit    customers : [("CUST-7", credit 500.00)] -> [("CUST-7", credit 400.00)]   BECAUSE CS debits 100.00 for the reservation
//    step 2 · CS publishes CreditReserved    events : [] -> [ "OrderCreated", "CreditReserved" ]   BECAUSE the participant publishes its outcome back to the orchestrator
//    step 3 · ORCH orders KIT to create the ticket    events : ["OrderCreated","CreditReserved"] -> ["OrderCreated","CreditReserved","ticket_created"]   BECAUSE the next participant acts on the reserved credit
//    step 4 · saga completes    state : "NEW" -> "COMPLETED"   BECAUSE every step succeeded with no compensation needed
// <- outcome : state "COMPLETED" for saga SAGA-1 · credit debited 100.00 from CUST-7
```

## Interview Questions

### Q1

Your Orders and Customers live in different databases owned by different services. Creating an order must also check that the total does not exceed the customer's credit limit, but one local ACID transaction cannot reach the other service's database.

**Interviewer's question:** Why does a business transaction span multiple services, and why cannot a local ACID transaction or 2PC solve it?

**Solution:** Database per Service splits the data, so no single local transaction can touch both databases; 2PC is rejected because it couples services and can block, so you need the Saga.

**System-design components:**
- Orders database — owned by Order Service
- Customers database — owned by Customer Service
- Credit limit — the data the order write must check
- 2PC — rejected for coupling and blocking

```mermaid
flowchart LR
  ORD["Order Service"] -->|INSERT order| ORDDB[("Orders DB")]
  ORD -->|check credit| CSDB[("Customers DB")]
  CSDB -.->|no such table| X["Local tx cannot span"]
```

```java
// ORDER SERVICE SIDE — a local ACID transaction cannot reach the credit data that lives in another service
// PARTIES: ORD = Order Service · ORDDB = PostgreSQL 16 @ orders-db-1 · CS = Customer Service · CSDB = PostgreSQL 16 @ customers-db-1
// DEF: credit — the customer's spending limit owned by the Customer Service = 100.00 (the order total that must not exceed it)
// STATE (before):
//    orders : {}
//    customer_credit : {}   // owned by CS in CSDB, invisible to ORDDB
// DEF: create_order · CALLED BY: CLIENT via POST /orders
// -> order_id : "PO-77" · -> total : 120.00
//    step 1 · BEGIN a local transaction on ORDDB (the broker and CSDB are NOT enlisted)
//    step 2 · INSERT the order : orders : {} -> {"PO-77":"PENDING"}
//    step 3 · try to deduct credit : customer_credit : {} -> ERROR "no such table"   BECAUSE customers lives in CSDB, not ORDDB
//    step 4 · the UPDATE fails, so the transaction aborts : orders : {"PO-77":"PENDING"} -> {} (rolled back)
// <- outcome : "ROLLBACK" · the one-database transaction cannot span the two services
//    alt 2PC : would enlist ORDDB and CSDB, but 2PC is not an option BECAUSE it couples the services and can block
```

_This is the Saga's motivation — a transaction that spans services needs a sequence of local transactions, not 2PC._

_Covers:_ Transactions that span services

_From the 28 problems:_ 26-payment-system · 22-hotel-reservation · 19-distributed-message-queue

### Q2

Your create-order flow must reserve credit in Customer Service and create a ticket in Kitchen Service, and when the kitchen rejects an item the credit reservation must be undone. You want one component to own the whole sequence.

**Interviewer's question:** How does orchestration-based saga coordination direct each step, and what happens when a step fails?

**Solution:** An orchestrator object tells each participant which local transaction to run; when a step fails, it runs compensating transactions that undo the earlier steps.

**System-design components:**
- Saga orchestrator — owns the sequence
- Local transactions — one per participant service
- Compensating transactions — undo earlier steps
- Replies — each participant reports its outcome

```mermaid
flowchart LR
  ORD["Orchestrator"] -->|create PENDING| ORDDB[("Order")]
  ORD -->|ReserveCredit| CS["Customer Service"]
  CS -->|credit_reserved| ORD
  ORD -->|CreateTicket| KIT["Kitchen Service"]
  KIT -->|ticket_rejected| ORD
  ORD -->|ReleaseCredit| CS
```

```java
// ORDER SERVICE SIDE — an orchestrated create-order saga across three services, with a failure and full compensation
// PARTIES: CLIENT = the user · ORD = Order Service (runs the orchestrator) · CS = Customer Service · KIT = Kitchen Service
// DEF: credit — the customer's available balance a saga step reserves and releases = { "CUST-7" : 500.00 }
// STATE (before):
//    orders : {}
//    customer_credit : { "CUST-7" : 500.00 }
//    reserved : {}
//    tickets : {}
// DEF: create-order saga orchestrator (saga id "SAGA-9") · created by ORD when CLIENT POSTs /orders
// -> order_id : "PO-77" · -> customer_id : "CUST-7" · -> total : 100.00
//    step 1 · LT1 on ORD : create the order : orders : {} -> {"PO-77":"PENDING"}
//    step 2 · send ReserveCredit(saga="SAGA-9", amount=100.00) to CS
//    step 3 · LT2 on CS : reserve : reserved : {} -> {"SAGA-9"} · customer_credit : {"CUST-7":500.00} -> {"CUST-7":400.00}   BECAUSE 100.00 of the 500.00 is held
//    step 4 · CS replies "credit_reserved" -> orchestrator sends CreateTicket(order_id="PO-77") to KIT
//    step 5 · LT3 on KIT : the ticket is rejected BECAUSE the item is not available : tickets : {} -> {} (nothing created)
//    step 6 · KIT replies "ticket_rejected" -> the orchestrator runs the COMPENSATING transactions
//    step 7 · COMPENSATE LT2 : ReleaseCredit(saga="SAGA-9", amount=100.00) to CS : customer_credit : {"CUST-7":400.00} -> {"CUST-7":500.00}   BECAUSE the held 100.00 is returned
//    step 8 · COMPENSATE LT1 : reject the order : orders : {"PO-77":"PENDING"} -> {"PO-77":"REJECTED"}
// <- outcome : "OrderRejected" · order REJECTED, credit fully released, no ticket created
//    alt success : KIT replies "ticket_created" -> orders : {"PO-77":"PENDING"} -> {"PO-77":"APPROVED"} (no compensation)
```

_This is orchestration-based saga — one orchestrator directs each local transaction and its compensating step._

_Covers:_ Orchestration: an orchestrator directs the steps

_From the 28 problems:_ 26-payment-system · 22-hotel-reservation · 19-distributed-message-queue

### Q3

You would rather not maintain a central coordinator. Each service should react to events published by the previous step and move the saga forward on its own.

**Interviewer's question:** How does choreography-based saga coordination advance the transaction without a central orchestrator?

**Solution:** Each local transaction publishes a domain event that triggers the next service's local transaction, so the events themselves carry the saga forward.

**System-design components:**
- OrderCreated event — triggers credit reservation
- CreditReserved event — triggers order approval
- Local transactions — one per event handler
- No orchestrator — the events are the coordination

```mermaid
flowchart LR
  ORD["Order Service"] -->|OrderCreated| CS["Customer Service"]
  CS -->|CreditReserved| ORD
  ORD -->|approve| ORDDB[("Order APPROVED")]
```

```java
// ORDER SERVICE SIDE — choreography: each local transaction publishes a domain event that triggers the next local transaction
// PARTIES: ORD = Order Service · CS = Customer Service · BRK = the events travelling between them
// DEF: credit — the customer's available balance a saga step reserves = { "CUST-7" : 500.00 }
// STATE (before):
//    orders : {}
//    customer_credit : { "CUST-7" : 500.00 }
//    credit_events : []
// DEF: choreographed handler chain · one event carries the saga forward, no orchestrator
// -> POST /orders : total = 100.00
//    step 1 · LT1 on ORD : create the order : orders : {} -> {"PO-77":"PENDING"}
//    step 2 · ORD publishes "OrderCreated" : the event triggers the next local transaction in CS
//    step 3 · CS handler receives "OrderCreated" and reserves credit : customer_credit : {"CUST-7":500.00} -> {"CUST-7":400.00}   BECAUSE 100.00 is reserved
//    step 4 · CS publishes "CreditReserved" : credit_events : [] -> ["CreditReserved"]
//    step 5 · ORD handler receives "CreditReserved" and approves : orders : {"PO-77":"PENDING"} -> {"PO-77":"APPROVED"}
// <- outcome : order "PO-77" APPROVED · no central coordinator — each event is the trigger for the next step
```

_This is choreography-based saga — each published event triggers the next service's local transaction._

_Covers:_ Choreography: events trigger the next step

_From the 28 problems:_ 26-payment-system · 22-hotel-reservation · 19-distributed-message-queue

### Q4

Two sagas run at once for the same customer: saga A reserves 100.00 of credit but has not committed, and saga B reads the balance and acts on what it sees. You want to know what can go wrong.

**Interviewer's question:** Why does a saga lack ACID isolation, and what anomaly can concurrent sagas cause?

**Solution:** A saga has no transaction manager holding locks across services, so intermediate states are visible; a second saga can read a balance that a first saga has reserved but not yet committed, so you need countermeasures.

**System-design components:**
- Saga A — reserves credit mid-flight
- Saga B — reads the balance concurrently
- Visible intermediate state — the reserved amount
- Countermeasures — implement isolation

```mermaid
flowchart LR
  A["Saga A reserves 100.00"] -->|balance now 400.00| DB[("Customer credit")]
  B["Saga B reads balance"] -->|sees 400.00| DB
  B -->|reserves against uncommitted state| RISK["Anomaly"]
```

```java
// CUSTOMER SERVICE SIDE — no ACID isolation: a second saga reads a balance a first saga reserved but has not committed
// PARTIES: A = saga A · B = saga B · CS = Customer Service
// DEF: balance — the customer's credit balance both sagas touch = 500.00
// STATE (before):
//    balance : 500.00
//    reserved_by_A : {}
//    reserved_by_B : {}
// DEF: saga_A_reserve · CALLED BY: saga A reserving credit for order "PO-77"
// -> amount : 100.00
//    step 1 · A holds credit mid-saga : balance : 500.00 -> 400.00   BECAUSE A reserves 100.00 but has not committed
//    step 2 · A records the hold : reserved_by_A : {} -> { "PO-77" : 100.00 }
// <- state : balance 400.00 · the intermediate state is visible before A commits
// DEF: saga_B_reserve · CALLED BY: saga B reserving credit for order "PO-88"
// -> amount : 300.00
//    step 1 · B reads the balance : seen : "none" -> 400.00   BECAUSE B observes A's uncommitted reservation
//    step 2 · B reserves against it : balance : 400.00 -> 100.00   BECAUSE B subtracts its own 300.00 from the 400.00 it saw
// <- outcome : balance 100.00 · B acted on a state A had not committed — an anomaly the saga's missing isolation allows
```

_This is the Saga's isolation tradeoff — no ACID isolation means concurrent sagas can observe each other's uncommitted state._

_Covers:_ Resulting context: compensation, isolation, reliability

_From the 28 problems:_ 26-payment-system · 22-hotel-reservation · 19-distributed-message-queue

## Key Concepts

### The Problem

**A transaction spans multiple services.** You need a mechanism to implement transactions that span multiple services, because a local ACID transaction cannot reach across databases and 2PC is not an option.


### The Solution

Implement each business transaction that spans services as a saga: a sequence of local transactions, each updating its database and publishing a message or event to trigger the next.

```mermaid
flowchart LR
  ORD["Order Service"] -->|INSERT order| ORDDB[("Orders DB")]
  ORD -->|check credit| CSDB[("Customers DB")]
  CSDB -.->|no such table| X["Local tx cannot span"]
```


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| A sequence of local transactions with compensation | Implement each business transaction that spans services as a saga: a sequence of local transactions, each updating its database and publishing a message or event to trigger the next. | Choreography (events trigger the next service) or orchestration (an orchestrator tells participants what to do). |
| No automatic rollback | A developer must design compensating transactions that explicitly undo changes made earlier in the saga, rather than relying on automatic rollback. | A rejected order releases its reserved credit and marks the order rejected. |
| No ACID isolation | The lack of isolation means concurrent execution can cause data anomalies, so a saga developer must typically use countermeasures, design techniques that implement isolation. | A second saga may read a credit balance that a first saga has reserved but not yet committed. |


### Tradeoffs & When

- A developer must design compensating transactions that explicitly undo changes made earlier in the saga, rather than relying on automatic rollback.
- The lack of isolation means concurrent execution can cause data anomalies, so a saga developer must typically use countermeasures, design techniques that implement isolation.


<details><summary>All concepts (index)</summary>

### Problem: A transaction spans multiple services

**Why.** Database per Service gives each service its own database, but a business transaction like creating an order also checks a credit limit that lives in another service.

**Claim.** You need a mechanism to implement transactions that span multiple services, because a local ACID transaction cannot reach across databases and 2PC is not an option.

**Grounding.** Orders and Customers are in different databases owned by different services, so the application cannot simply use a local ACID transaction.

**In the wild.** An e-commerce store where a new order must not exceed the credit limit of the customer.
### Solution: A sequence of local transactions with compensation

**Why.** Each step is a local transaction that only touches one database, so it stays ACID and simple.

**Claim.** Implement each business transaction that spans services as a saga: a sequence of local transactions, each updating its database and publishing a message or event to trigger the next.

**Grounding.** If a local transaction fails because it violates a business rule, the saga executes compensating transactions that undo the changes made by the preceding local transactions.

**In the wild.** Choreography (events trigger the next service) or orchestration (an orchestrator tells participants what to do).
### Tradeoff: No automatic rollback

**Why.** There is no ACID transaction manager to undo a partially completed saga.

**Claim.** A developer must design compensating transactions that explicitly undo changes made earlier in the saga, rather than relying on automatic rollback.

**Grounding.** Each step that commits must have a matching undo step, like releasing credit that was reserved.

**In the wild.** A rejected order releases its reserved credit and marks the order rejected.
### Tradeoff: No ACID isolation

**Why.** Multiple sagas and transactions run concurrently, so their intermediate states are visible to each other.

**Claim.** The lack of isolation means concurrent execution can cause data anomalies, so a saga developer must typically use countermeasures, design techniques that implement isolation.

**Grounding.** Careful analysis is needed to select and correctly implement the countermeasures.

**In the wild.** A second saga may read a credit balance that a first saga has reserved but not yet committed.

</details>


## Quiz

1. What is a saga?

   - A. A distributed transaction that uses two-phase commit across services
   - B. A sequence of local transactions, each updating its own database and publishing a message or event to trigger the next
   - C. A single database transaction that locks every table it touches
   - D. A message broker that guarantees exactly-once delivery

<details><summary>Reveal answer</summary>

**B.** A saga is a sequence of local transactions, each updating its own database and publishing a message or event to trigger the next. A is wrong because 2PC is explicitly not an option. C is wrong because a saga spans multiple databases and cannot be one local transaction. D is wrong because a saga is not a broker.

</details>

2. In an orchestration-based saga, who tells the participants what local transactions to execute?

   - A. Each service, by watching for events
   - B. A message broker routing table
   - C. An orchestrator object
   - D. A database trigger

<details><summary>Reveal answer</summary>

**C.** An orchestrator object tells the participants what local transactions to execute. A describes choreography, not orchestration. B and D are not how a saga is coordinated.

</details>

3. What happens when a local transaction fails because it violates a business rule?

   - A. The saga restarts from the first step
   - B. The saga executes a series of compensating transactions that undo the preceding local transactions
   - C. The saga retries the same transaction forever
   - D. The database rolls back all services automatically

<details><summary>Reveal answer</summary>

**B.** The saga executes compensating transactions that undo the changes made by the preceding local transactions. A and C are wrong because a saga does not restart or retry forever. D is wrong because there is no automatic rollback across services.

</details>

4. Which of these is a drawback of the saga pattern?

   - A. It requires two-phase commit
   - B. It cannot span more than two services
   - C. Lack of automatic rollback and lack of isolation
   - D. It prevents concurrent execution of transactions

<details><summary>Reveal answer</summary>

**C.** The drawbacks are lack of automatic rollback (compensating transactions must be designed) and lack of isolation (countermeasures are needed). A is wrong because 2PC is not an option. B is wrong because a saga can span many services. D is wrong because sagas run concurrently.

</details>

