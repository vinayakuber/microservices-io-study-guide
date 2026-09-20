# Chapter 32: Audit Logging

> Record user activity in a database so support, compliance, and security can reconstruct what a user did.

_Also known as: Chris Richardson · Microservice Patterns Ch. 32 (p.377) · microservices.io /patterns/observability/audit-logging.html_

## Flow

### Recording user activity

> **Why this matters:** The pattern answers "how to understand the behavior of users and the application?" by recording user activity in a database. Each user action becomes a durable row naming who did what, and when.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
n0["<b>1. User acts</b><br/>alice performs view_order on PO-2001"]:::start
  n1["<b>2. Write one row per action</b><br/>INSERT audit row id=1, action view_order"]:::step
  n2["<b>3. Next action, next row</b><br/>INSERT id=2 create_order, then id=3 pay_order"]:::step
  n3["<b>4. Audit log accumulates</b><br/>audit_log holds 3 rows, WHO=alice, WHEN=now"]:::core
  n4["<b>5. Behavior reconstructable</b><br/>the DB records who did what and when"]:::stop
  n5["<b>Missed write</b><br/>an action with no row leaves no trace"]:::warn
  n0 -->|"1. action to record"| n1
  n1 -->|"2. next action"| n2
  n2 -->|"3. more actions"| n1
  n2 -->|"4. rows accumulate"| n3
  n3 -->|"5. reconstruct later"| n4
  n2 -->|"6. write fails - no trace"| n5
```

1. **Record in a database** — The solution is to record user activity in a database.

2. **One row per action** — Each action a user performs is written as an audit record.

3. **Widely used** — The reference notes this pattern is widely used.

```java
// ORDER SERVICE SIDE — every user action becomes one audit row in the database
// PARTIES: U1 = user alice · SVC = Order Service · DB = PostgreSQL 16 @ audit-db-1
// DEF: audit — a durable row recording who did what to which target and when; here (1,"alice","view_order","PO-2001",now)
// STATE (before):
//    audit_log : []                                 // rows: (id, user, action, target, at)
// DEF: record_activity · CALLED BY: U1 performing actions
// -> action1 : ("alice","view_order","PO-2001")
//    step 1 · INSERT audit row id=1   audit_log : [] -> [(1,"alice","view_order","PO-2001",now)]
// -> action2 : ("alice","create_order","PO-2001")
//    step 2 · INSERT audit row id=2   audit_log : [1 row] -> [(1,"alice","view_order","PO-2001",now),(2,"alice","create_order","PO-2001",now)]
// -> action3 : ("alice","pay_order","PO-2001")
//    step 3 · INSERT audit row id=3   audit_log : [2 rows] -> [(1,"alice","view_order","PO-2001",now),(2,"alice","create_order","PO-2001",now),(3,"alice","pay_order","PO-2001",now)]
// <- outcome : audit_log : 3 rows · WHO=alice, WHAT=view/create/pay, WHEN=timestamp   BECAUSE the DB now holds a record of her actions
```

### Who reads the log

> **Why this matters:** The force behind audit logging is knowing what a user recently performed — for customer support, compliance, and security. Reading the log reconstructs a user's recent behavior.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
n0["<b>1. One audit log, three questions</b><br/>SUP wants to know what alice recently did"]:::start
  n1["<b>2. Query by user</b><br/>match the rows for alice, in order"]:::step
  n2["<b>3. Answer holds the rows</b><br/>3 rows, row id=3 is the payment"]:::core
  n3["<b>4. Support asks</b><br/>did alice pay? - yes, at t3"]:::step
  n4["<b>5. Compliance asks</b><br/>who touched PO-2001?"]:::step
  n5["<b>6. Security asks</b><br/>which pay_order actions happened?"]:::step
  n6["<b>7. One log, three readers</b><br/>the same rows answer all three"]:::stop
  n7["<b>Query misses</b><br/>no match returns nothing"]:::warn
  n0 -->|"1. choose a question"| n1
  n1 -->|"2. match rows by user"| n2
  n2 -->|"3. support"| n3
  n2 -->|"4. compliance"| n4
  n2 -->|"5. security"| n5
  n3 -->|"6. merge answers"| n6
  n4 -->|"7. merge answers"| n6
  n5 -->|"8. merge answers"| n6
  n1 -->|"9. no match - empty"| n7
```

1. **Three readers** — Customer support, compliance, and security all want to know what actions a user recently performed.

2. **Reconstruct behavior** — Querying the log by user returns that user's actions in order.

3. **Answer questions** — The same rows can answer "what did alice do" or "who touched PO-2001".

```java
// SUPPORT SIDE — reading the audit log reconstructs what one user did, for support/compliance/security
// PARTIES: SUP = support agent · DB = PostgreSQL 16 @ audit-db-1
// DEF: audit — a durable row recording who did what to which target and when, read back to reconstruct a user's actions; here (1,"alice","view_order","PO-2001",t1)
// STATE (before):
//    audit_log : [(1,"alice","view_order","PO-2001",t1),(2,"alice","create_order","PO-2001",t2),(3,"alice","pay_order","PO-2001",t3)]
//    answer : []                                // the reconstruction SUP builds
// DEF: recent_actions · CALLED BY: SUP investigating "did alice pay?"
// -> user : "alice"
//    step 1 · match row id=1    answer : [] -> [(1,"alice","view_order","PO-2001",t1)]
//    step 2 · match row id=2    answer : [(1,"alice","view_order","PO-2001",t1)] -> [(1,"alice","view_order","PO-2001",t1),(2,"alice","create_order","PO-2001",t2)]
//    step 3 · match row id=3    answer : [(1,"alice","view_order","PO-2001",t1),(2,"alice","create_order","PO-2001",t2)] -> [(1,"alice","view_order","PO-2001",t1),(2,"alice","create_order","PO-2001",t2),(3,"alice","pay_order","PO-2001",t3)]
// <- outcome : answer : 3 rows · row id=3 is the payment -> SUP confirms "yes, alice paid at t3"
//    alt compliance : query "target=PO-2001" to learn who touched it · alt security: query "action=pay_order"
```

### Auditing and event sourcing

> **Why this matters:** Audit logging is not free: the auditing code is intertwined with the business logic, making it more complicated. The related pattern Event Sourcing offers a reliable way to implement auditing.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
n0["<b>1. Request arrives</b><br/>create_order for PO-2001"]:::start
  n1["<b>2. Save, then audit</b><br/>save the order, then call audit - row 1"]:::step
  n2["<b>3. Publish, then audit</b><br/>publish, then call audit - row 2"]:::step
  n3["<b>4. Inline audit path</b><br/>inline_audit holds 2 hand-written rows"]:::core
  n4["<b>5. Drawback - intertwined</b><br/>audit calls sit between business statements"]:::warn
  n5["<b>6. Event sourcing path</b><br/>append 2 domain events OrderCreated, OrderPublished"]:::core
  n6["<b>7. Event log IS the audit trail</b><br/>audit becomes a read of event_log, no audit calls"]:::stop
  n7["<b>Missed audit call</b><br/>an action is left unrecorded"]:::warn
  n0 -->|"1. method runs"| n1
  n1 -->|"2. second audit call"| n2
  n2 -->|"3. inline approach"| n3
  n3 -->|"4. drawback - intertwined"| n4
  n2 -->|"5. event sourcing instead"| n5
  n5 -->|"6. reliable audit"| n6
  n1 -->|"7. missed call - unrecorded"| n7
```

1. **Intertwined code** — The drawback is that auditing code is intertwined with the business logic, making it more complicated.

2. **Inline audit calls** — audit() calls sit between business statements inside a method.

3. **Event sourcing alternative** — Event Sourcing is a reliable way to implement auditing — the event log itself is the audit trail.

```java
// ORDER SERVICE SIDE — audit code interleaves with business logic; event sourcing makes auditing implicit
// PARTIES: SVC = Order Service · ES = EventStoreDB 24 @ orders-events-1
// DEF: audit — a hand-written row recording what happened, appended by an explicit audit() call; here (1,"create_order","PO-2001")
// DEF: event — a domain fact appended to the event store that doubles as the audit record; here (1,"OrderCreated")
// DEF: inline — audit code that sits between business statements inside one method; here the 2 audit() calls inside create_order
// STATE (before):
//    inline_audit : []                 // hand-written audit rows
//    event_log : []                    // event-sourced alternative: events ARE the audit record
// DEF: create_order · CALLED BY: a client request
// -> order_id : "PO-2001"
//    step 1 · save the order, then call audit()     inline_audit : [] -> [(1,"create_order","PO-2001")]
//    step 2 · publish, then call audit()            inline_audit : [1 row] -> [(1,"create_order","PO-2001"),(2,"order_published","PO-2001")]
//    step 3 · the 2 audit() calls sit between business statements -> the method is harder to read
// <- outcome : inline_audit : 2 rows · business logic more complicated   BECAUSE the auditing code is intertwined with it
//    alt event sourcing : append 2 domain events   event_log : [] -> [(1,"OrderCreated"),(2,"OrderPublished")] · the audit is a read of event_log, no audit() calls
```


## Interview Questions

### Q1

A user named alice views, creates, and pays for order PO-2001. The team needs a durable record of her actions so support can reconstruct what she did later.

**Interviewer's question:** What is the Audit Logging solution, and what does one record capture?

**Solution:** Record user activity in a database: each action a user performs is written as an audit row naming who did what to which target and when.

**System-design components:**
- User (alice)
- Order Service
- audit database
- audit row (id, user, action, target, at)

```mermaid
flowchart LR
  U["alice"] -->|"view/create/pay"| S["Order Service"]
  S -->|"INSERT row"| D["audit database"]
  D -->|"3 rows"| L["audit_log"]
```

```java
// ORDER SERVICE SIDE — every user action becomes one audit row in the database
// PARTIES: U1 = user alice · SVC = Order Service · DB = PostgreSQL 16 @ audit-db-1
// DEF: audit — a durable row recording who did what to which target and when; here (1,"alice","view_order","PO-2001",now)
// STATE (before):
//    audit_log : []                                  // rows: (id, user, action, target, at)
// DEF: record_activity · CALLED BY: U1 performing actions
// -> action1 : ("alice","view_order","PO-2001")
//    step 1 · INSERT audit row id=1   audit_log : [] -> [(1,"alice","view_order","PO-2001",now)]
// -> action2 : ("alice","create_order","PO-2001")
//    step 2 · INSERT audit row id=2   audit_log : [1 row] -> [(1,"alice","view_order","PO-2001",now),(2,"alice","create_order","PO-2001",now)]
// -> action3 : ("alice","pay_order","PO-2001")
//    step 3 · INSERT audit row id=3   audit_log : [2 rows] -> [(1,"alice","view_order","PO-2001",now),(2,"alice","create_order","PO-2001",now),(3,"alice","pay_order","PO-2001",now)]
// <- outcome : audit_log : 3 rows · WHO=alice, WHAT=view/create/pay, WHEN=timestamp   BECAUSE the DB now holds a record of her actions
```

_This is the chapter's record-user-activity step: every action becomes a durable row with who, what, and when._

_Covers:_ Recording user activity

_From the 28 problems:_ 20-metrics-monitoring · 26-payment-system

### Q2

A support agent must answer whether alice paid for PO-2001, a compliance auditor needs to know who touched the order, and security wants every payment action.

**Interviewer's question:** Who reads the audit log, and how does a query reconstruct a user's behavior?

**Solution:** Customer support, compliance, and security read the log; querying by user returns that user's actions in order, and the same rows answer "what did alice do" or "who touched PO-2001".

**System-design components:**
- Support agent
- compliance auditor
- security team
- audit database

```mermaid
flowchart LR
  S["Support"] -->|"query user=alice"| D["audit database"]
  C["Compliance"] -->|"query target=PO-2001"| D
  K["Security"] -->|"query action=pay_order"| D
  D -->|"ordered rows"| R["reconstruction"]
```

```java
// SUPPORT SIDE — reading the audit log reconstructs what one user did, for support/compliance/security
// PARTIES: SUP = support agent · DB = PostgreSQL 16 @ audit-db-1
// STATE (before):
//    audit_log : [(1,"alice","view_order","PO-2001",t1),(2,"alice","create_order","PO-2001",t2),(3,"alice","pay_order","PO-2001",t3)]
//    answer : []                                   // the reconstruction SUP builds
// DEF: recent_actions · CALLED BY: SUP investigating "did alice pay?"
// -> user : "alice"
//    step 1 · match row id=1    answer : [] -> [(1,"alice","view_order","PO-2001",t1)]
//    step 2 · match row id=2    answer : [(1,"alice","view_order","PO-2001",t1)] -> [(1,"alice","view_order","PO-2001",t1),(2,"alice","create_order","PO-2001",t2)]
//    step 3 · match row id=3    answer : [(1,"alice","view_order","PO-2001",t1),(2,"alice","create_order","PO-2001",t2)] -> [(1,"alice","view_order","PO-2001",t1),(2,"alice","create_order","PO-2001",t2),(3,"alice","pay_order","PO-2001",t3)]
// <- outcome : answer : 3 rows · row id=3 is the payment -> SUP confirms "yes, alice paid at t3"
//    alt compliance : query "target=PO-2001" to learn who touched it · alt security : query "action=pay_order"
```

_This is the chapter's who-reads-the-log step: support, compliance, and security reconstruct a user's recent behavior from the same rows._

_Covers:_ Who reads the log

_From the 28 problems:_ 20-metrics-monitoring · 26-payment-system

### Q3

The audit() calls are scattered between business statements inside create_order, and the method is getting hard to read.

**Interviewer's question:** What is the main drawback of audit logging, and where does the audit code sit?

**Solution:** The auditing code is intertwined with the business logic, making it more complicated — audit() calls sit between business statements inside a method.

**System-design components:**
- Order Service
- audit() calls
- business statements
- inline audit rows

```mermaid
flowchart LR
  M["create_order"] -->|"save()"| B["business"]
  M -->|"audit()"| A["inline_audit"]
  A -.->|"intertwined"| B
```

```java
// ORDER SERVICE SIDE — audit code interleaves with business logic, making the method harder to read
// PARTIES: SVC = Order Service
// DEF: inline — audit code that sits between business statements inside one method; here the 2 audit() calls inside create_order
// STATE (before):
//    inline_audit : []                 // hand-written audit rows
// DEF: create_order · CALLED BY: a client request
// -> order_id : "PO-2001"
//    step 1 · save the order, then call audit()     inline_audit : [] -> [(1,"create_order","PO-2001")]
//    step 2 · publish, then call audit()            inline_audit : [1 row] -> [(1,"create_order","PO-2001"),(2,"order_published","PO-2001")]
//    step 3 · the 2 audit() calls sit between business statements -> the method is harder to read
// <- outcome : inline_audit : 2 rows · business logic more complicated   BECAUSE the auditing code is intertwined with it
```

_This is the chapter's intertwined-code drawback: audit() calls between business statements complicate the flow._

_Covers:_ Auditing and event sourcing

_From the 28 problems:_ 20-metrics-monitoring · 26-payment-system

### Q4

The team is tired of hand-writing audit() calls that can drift from what actually happened. They consider making the audit implicit.

**Interviewer's question:** Which related pattern is described as a reliable way to implement auditing, and why?

**Solution:** Event Sourcing: the event log itself is the audit trail, so appending domain events removes the explicit audit() calls.

**System-design components:**
- Order Service
- event store
- domain events
- implicit audit trail

```mermaid
flowchart LR
  S["Order Service"] -->|"append event"| E["event store"]
  E -->|"OrderCreated, OrderPublished"| L["event_log"]
  L -->|"is the audit trail"| A["audit read"]
```

```java
// ORDER SERVICE SIDE — event sourcing makes auditing implicit: the event log itself is the audit trail
// PARTIES: SVC = Order Service · ES = EventStoreDB 24 @ orders-events-1
// DEF: event — a domain fact appended to the event store that doubles as the audit record; here (1,"OrderCreated")
// STATE (before):
//    event_log : []                    // event-sourced alternative: events ARE the audit record
//    audit_calls : 0                   // explicit audit() calls the service writes
// DEF: create_order · CALLED BY: a client request
// -> order_id : "PO-2001"
//    step 1 · append the creation event    event_log : [] -> [(1,"OrderCreated")]  BECAUSE the domain event is the fact of creation
//    step 2 · append the publication event    event_log : [1 row] -> [(1,"OrderCreated"),(2,"OrderPublished")]  BECAUSE publishing is itself a domain fact
//    step 3 · no audit() call needed    audit_calls : 0 -> 0  BECAUSE the audit is a read of event_log, not a separate write
// <- outcome : event_log : 2 rows · audit_calls : 0 · the audit trail is the event log itself
//    alt hand-written audit : 2 explicit audit() calls between business statements -> the method is harder to read and the audit can drift
```

_This is the chapter's event-sourcing alternative: the event log itself is the audit trail, removing the intertwined audit() calls._

_Covers:_ Auditing and event sourcing

_From the 28 problems:_ 20-metrics-monitoring · 26-payment-system

## Key Concepts

### The Problem

**Who did what.** The problem is how to understand the behavior of users and the application, and troubleshoot problems.


### The Solution

Record user activity in a database, giving a record of user actions.

```mermaid
flowchart LR
  U["alice"] -->|"view/create/pay"| S["Order Service"]
  S -->|"INSERT row"| D["audit database"]
  D -->|"3 rows"| L["audit_log"]
```


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| Record user activity | Record user activity in a database, giving a record of user actions. | Each action becomes a row with who, what, and when. |
| Intertwined code | The auditing code is intertwined with the business logic, which makes the business logic more complicated. | audit() calls sit between business statements, so the flow is harder to read. |
| Event sourcing alternative | Event Sourcing is a reliable way to implement auditing — the event log itself is the audit trail. | Adopting event sourcing removes the audit() calls but is a larger architectural commitment. |


### Tradeoffs & When

- The auditing code is intertwined with the business logic, which makes the business logic more complicated.
- Event Sourcing is a reliable way to implement auditing — the event log itself is the audit trail.


<details><summary>All concepts (index)</summary>

### Problem: Who did what

**Why.** After the fact, you need to know what a user has been doing.

**Claim.** The problem is how to understand the behavior of users and the application, and troubleshoot problems.

**Grounding.** The reference force: it is useful to know what actions a user recently performed — for customer support, compliance, and security.

**In the wild.** A support agent needs to reconstruct a user's recent actions to answer a complaint.
### Solution: Record user activity

**Why.** Without a durable record, user actions are lost as soon as they happen.

**Claim.** Record user activity in a database, giving a record of user actions.

**Grounding.** The reference solution is exactly that — record user activity in a database — and notes the pattern is widely used.

**In the wild.** Each action becomes a row with who, what, and when.
### Tradeoff: Intertwined code

**Why.** The audit write happens inside the business method it records.

**Claim.** The auditing code is intertwined with the business logic, which makes the business logic more complicated.

**Grounding.** The reference lists this as the pattern's drawback.

**In the wild.** audit() calls sit between business statements, so the flow is harder to read.
### Tradeoff: Event sourcing alternative

**Why.** A separate audit call is extra work that can drift from what actually happened.

**Claim.** Event Sourcing is a reliable way to implement auditing — the event log itself is the audit trail.

**Grounding.** The reference lists Event Sourcing as the related pattern for reliable auditing.

**In the wild.** Adopting event sourcing removes the audit() calls but is a larger architectural commitment.

</details>


## Quiz

1. What is the solution of the Audit logging pattern?

   - A. Record user activity in a database.
   - B. Log every HTTP status code.
   - C. Sample a fraction of requests.
   - D. Store metrics in a time-series database.

<details><summary>Reveal answer</summary>

**A.** The reference solution is to record user activity in a database. Option D is application metrics, and B and C are not the audit logging solution.

</details>

2. Which forces motivate knowing a user's recent actions?

   - A. Load balancing and scaling.
   - B. Customer support, compliance, and security.
   - C. Reducing build time.
   - D. Service discovery.

<details><summary>Reveal answer</summary>

**B.** The reference force names customer support, compliance, and security as the readers who need to know what a user recently performed. The other options are unrelated concerns.

</details>

3. What is the main drawback of audit logging?

   - A. It is unreliable.
   - B. The auditing code is intertwined with the business logic, making it more complicated.
   - C. It cannot be stored in a database.
   - D. It removes all user actions.

<details><summary>Reveal answer</summary>

**B.** The reference drawback is that auditing code is intertwined with business logic, making it more complicated. Options A, C, and D are false — the pattern records to a database and provides a record, not removes one.

</details>

4. Which related pattern is described as a reliable way to implement auditing?

   - A. Event Sourcing.
   - B. CQRS.
   - C. API composition.
   - D. Circuit breaker.

<details><summary>Reveal answer</summary>

**A.** The reference states Event Sourcing is a reliable way to implement auditing, because the event log itself is the audit trail. The other patterns are not tied to auditing in the reference.

</details>

