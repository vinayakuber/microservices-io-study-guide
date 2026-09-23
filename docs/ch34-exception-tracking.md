# Chapter 34: Exception Tracking

> Report all exceptions to a centralized service that aggregates, de-duplicates, and tracks them and notifies developers.

_Also known as: Chris Richardson · Microservice Patterns Ch. 34 · microservices.io /patterns/observability/exception-tracking.html_

## Flow

### Capture the exception

> **Why this matters:** A service throws an exception the moment a request fails; unless something captures the error message and the stack trace right there, the failure is invisible across a fleet of machines. Capturing at the source is what makes every later step possible.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
n0["<b>1. Request fails</b><br/>GET /orders for REQ-2001"]:::start
  n1["<b>2. Look up the customer</b><br/>returns null, req status OPEN becomes FAILED"]:::step
  n2["<b>3. Throw</b><br/>NullPointerException, customer is null"]:::warn
  n3["<b>4. Catch in the handler</b><br/>package message plus stack trace"]:::step
  n4["<b>5. Report record formed</b><br/>msg customer is null, stack SVC.doGet line 42, ts 19"]:::core
  n5["<b>6. Exception in hand</b><br/>1 captured exception"]:::stop
  n6["<b>No catch in place</b><br/>the thread dies with no record, the error is invisible"]:::warn
  n0 -->|"1. request fails"| n1
  n1 -->|"2. error thrown"| n2
  n2 -->|"3. handler catches"| n3
  n3 -->|"4. package the record"| n4
  n4 -->|"5. captured"| n5
  n2 -->|"6. no catch - invisible"| n6
```

1. **Throw on failure** — A service instance handling a request throws an exception when an error occurs.

2. **Carry message and stack trace** — The exception object holds an error message and a stack trace; both are the raw material for debugging.

3. **Catch in the handler** — The handler catches the exception and packages the message plus the stack trace into a reportable record.

```java
// ORDER SERVICE SIDE — one request throws; the handler captures the message and stack trace
// PARTIES: SVC = Order Service instance · U1 = the user making the request
// STATE (before):
//    req : { id:"REQ-2001", path:"/orders", status:"OPEN" }
//    report : {}                       // the captured exception, empty until the throw
// DEF: handle_request · CALLED BY: U1 submitting GET /orders with id REQ-2001
// -> req_id : "REQ-2001"
//    step 1 · look up the customer -> null   // req : {status:"OPEN"} -> {status:"FAILED"}
//    step 2 · throw NullPointerException("customer is null")   // err : null -> "customer is null"
//    step 3 · catch in the handler, capture message + stack trace   // report : {} -> {msg:"customer is null", stack:"SVC.doGet line 42", ts:19}
// <- exception : report = {msg:"customer is null", stack:"SVC.doGet line 42", ts:19} · 1 exception now in hand
//    alt no catch in place : the thread dies with no record -> the error is invisible to everyone
```

### Report to a centralized tracker

> **Why this matters:** One instance's log is not a place developers watch; a centralized exception tracking service is. Reporting every exception to that service is the whole point of the pattern.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
n0["<b>1. Exception caught</b><br/>report EX-1001 ready"]:::start
  n1["<b>2. Serialize the report</b><br/>into the request body"]:::step
  n2["<b>3. POST to the tracker</b><br/>POST /exceptions over HTTP"]:::step
  n3["<b>4. Tracker stores it</b><br/>tracker holds EX-1001"]:::core
  n4["<b>5. Ack returned</b><br/>tracker returns 200, SVC marks it sent"]:::step
  n5["<b>6. Reported centrally</b><br/>the exception lives in the central tracker, not just the local service"]:::stop
  n6["<b>Tracker unreachable</b><br/>SVC writes the same line to its local log file"]:::warn
  n0 -->|"1. transmit the report"| n1
  n1 -->|"2. send over HTTP"| n2
  n2 -->|"3. stored"| n3
  n3 -->|"4. ack returned"| n4
  n4 -->|"5. reported"| n5
  n2 -->|"6. unreachable - log locally"| n6
```

1. **Point at the tracking service** — The service sends each caught exception to the centralized exception tracking service.

2. **Send message and stack trace** — The report carries the error message and the stack trace so the tracker can group and display them.

3. **Get an acknowledgement** — The service receives an acknowledgement once the tracker has stored the exception.

4. **Also log it** — Exceptions should be logged as well as reported to the tracking service, pairing this pattern with Log aggregation.

```java
// ORDER SERVICE SIDE — the captured exception is reported to the centralized tracker
// PARTIES: SVC = Order Service instance · TRK = centralized exception tracking service
// STATE (before):
//    report : { id:"EX-1001", msg:"customer is null", stack:"SVC.doGet line 42", ts:19 }
//    sent : false                      // the report has not been transmitted yet
// DEF: report_exception · CALLED BY: the handler, right after it catches, over HTTP
// -> ex_id : "EX-1001"
//    step 1 · serialize the report into the request body   // payload : {} -> {id:"EX-1001", msg:"customer is null", stack:"SVC.doGet line 42"}
//    step 2 · POST /exceptions to TRK -> TRK stores the exception   // tracker : [] -> ["EX-1001"]
//    step 3 · TRK returns 200, SVC marks it sent   // sent : false -> true
// <- ack : "EX-1001 stored" · the exception now lives in the central tracker, not just the local service
//    alt TRK unreachable : SVC still writes the same line to its local log file -> Log aggregation (ch36) keeps a copy
```

### De-duplicate and aggregate

> **Why this matters:** The same bug can throw thousands of times across many instances. If each throw becomes a separate row, the noise buries the signal; de-duplication collapses repeats into one tracked issue.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
n0["<b>1. Report arrives</b><br/>EX-1001, msg customer is null"]:::start
  n1["<b>2. Fingerprint the stack</b><br/>hash the stack trace becomes FP-77A3"]:::step
  n2["<b>3. Look up the fingerprint</b><br/>is the FP-77A3 issue already present?"]:::core
  n3["<b>4. First sighting</b><br/>not found, create the issue, count 1"]:::step
  n4["<b>5. Repeat report</b><br/>SVC2 same bug, found, count 1 becomes 2"]:::step
  n5["<b>6. One issue per bug</b><br/>issues holds FP-77A3 with count 2"]:::core
  n6["<b>7. Noise collapses</b><br/>2 exceptions deduplicated into 1 issue"]:::stop
  n7["<b>New fingerprint</b><br/>FP-1B20 not seen, a 2nd distinct issue"]:::warn
  n0 -->|"1. hash the stack"| n1
  n1 -->|"2. key on the fingerprint"| n2
  n2 -->|"3. not found"| n3
  n2 -->|"4. found"| n4
  n3 -->|"5. new issue"| n5
  n4 -->|"6. increment"| n5
  n5 -->|"7. deduplicated"| n6
  n2 -->|"8. unrelated bug"| n7
  n7 -->|"9. separate issue"| n5
```

1. **Fingerprint by stack trace** — The tracker keys each exception on a fingerprint of its stack trace.

2. **Create the issue on first sight** — The first report with a new fingerprint creates a new tracked issue.

3. **Increment on repeat** — Later reports with the same fingerprint are folded into the existing issue instead of creating a new one.

4. **Track resolution state** — The issue records its state so developers can track it from open to resolved.

```java
// TRACKER SIDE — two instances of the same bug collapse into a single tracked issue
// PARTIES: SVC1 = Order Service instance 1 · SVC2 = Order Service instance 2 · TRK = exception tracking service
// STATE (before):
//    issues : {}                     // fingerprint -> issue map, the tracker's store, empty
// DEF: ingest · CALLED BY: TRK for each reported exception, keyed on the stack-trace hash
// -> ex1 : { id:"EX-1001", msg:"customer is null", fp:"FP-77A3" }
//    step 1 · hash the stack trace into a fingerprint   // fp : null -> "FP-77A3"
//    step 2 · look up issues["FP-77A3"] -> not found, so create the issue   // issues : {} -> {"FP-77A3":{count:1}}
//    step 3 · later SVC2 reports the same bug, fp "FP-77A3" -> seen, so increment   // issues["FP-77A3"].count : 1 -> 2
// <- aggregate : issues = {"FP-77A3": {count:2, msg:"customer is null"}} · 2 exceptions deduplicated into 1 issue
//    alt a new fingerprint "FP-1B20" : issues : {"FP-77A3":{count:2}} -> {"FP-77A3":{count:2}, "FP-1B20":{count:1}} · a 2nd distinct issue
```

### Notify developers and resolve

> **Why this matters:** Aggregation alone does not fix anything; a human has to investigate and close the issue. Notifying developers and recording resolution turns a pile of exceptions into a fixed product.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
n0["<b>1. Issue crosses threshold</b><br/>FP-77A3 count 2, state OPEN, threshold 1"]:::start
  n1["<b>2. Notify the developer</b><br/>alert FP-77A3 goes to DEV"]:::step
  n2["<b>3. Investigate</b><br/>DEV finds the null-customer path"]:::step
  n3["<b>4. Fix the cause</b><br/>commit 9f2c lands"]:::step
  n4["<b>5. Mark resolved</b><br/>state OPEN becomes RESOLVED"]:::core
  n5["<b>6. Issue closed</b><br/>the cause is fixed, not just the symptom"]:::stop
  n6["<b>Bug reappears</b><br/>new report, count 2 becomes 3, state RESOLVED becomes OPEN"]:::warn
  n0 -->|"1. threshold crossed"| n1
  n1 -->|"2. developer reads the trace"| n2
  n2 -->|"3. root cause found"| n3
  n3 -->|"4. fix committed"| n4
  n4 -->|"5. closed"| n5
  n5 -->|"6. later report"| n6
  n6 -->|"7. reopens and re-notifies"| n1
```

1. **Notify on the issue** — The tracking service notifies developers when an issue needs attention.

2. **Investigate** — A developer reads the error message and the stack trace to find the underlying cause.

3. **Resolve the underlying issue** — The developer fixes the cause and marks the issue resolved.

```java
// TRACKER SIDE — a crossing issue notifies a developer, who investigates and resolves it
// PARTIES: TRK = exception tracking service · DEV = the developer on call
// STATE (before):
//    issue : { fp:"FP-77A3", count:2, msg:"customer is null", state:"OPEN" }
//    alert : []                        // notifications sent, none yet
// DEF: notify_and_resolve · CALLED BY: TRK when an issue's count crosses the threshold 1
// -> issue_fp : "FP-77A3"
//    step 1 · count 2 crosses threshold 1 -> notify DEV   // alert : [] -> ["FP-77A3 -> DEV"]
//    step 2 · DEV investigates, finds the null-customer path, commits a fix   // fix : null -> "commit-9f2c"
//    step 3 · DEV marks the issue resolved   // issue.state : "OPEN" -> "RESOLVED"
// <- resolution : issue.state = "RESOLVED" · the underlying issue is closed, not just the symptom logged
//    alt the bug reappears : a new report with fp "FP-77A3" -> count : 2 -> 3 and state : "RESOLVED" -> "OPEN"
```


## System Design Interview

> **The question:** Design error visibility for services. Premise: a service reports exceptions to a tracker that collects, dedups, and aggregates them, and a developer reads the grouped stack traces.

**The pipeline:** service → exception tracker (collect/dedup/aggregate) → developer reader

### Order Service — the thrower

_Role: service (source)_

```mermaid
flowchart TD
  R["Order Service — the thrower"]
  R -->|"comprises"| P0["throws the exception EX-1001 with msg #quot;customer is null#quot;"]
  R -->|"comprises"| P1["reports the stack trace SVC.doGet line 42"]
```

### Exception tracking service — collect, dedup, aggregate

_Role: exception tracker_

```mermaid
flowchart TD
  R["Exception tracking service — collect, dedup, aggregate"]
  R -->|"comprises"| P0["normalizes each throw into a fingerprint"]
  R -->|"comprises"| P1["PostgreSQL 16 @ exc-db-1 — folds repeats by fingerprint and bumps the count"]
```

### Developer — the reader

_Role: reader_

```mermaid
flowchart TD
  R["Developer — the reader"]
  R -->|"comprises"| P0["sees one deduplicated issue, not a flood"]
  R -->|"comprises"| P1["triages the issue FP-77A3 against a threshold of 1"]
```

```mermaid
flowchart LR
  SVC["Order Service"] -->|"throw EX-1001"| TRK["Exception tracking service"]
  TRK -->|"fold into fingerprint FP-77A3"| DB["PostgreSQL 16 @ exc-db-1"]
  DB -->|"issue count 2"| DEV["Developer reader"]
```

```java
// SYSTEM DESIGN — exception tracking: service -> exception tracker (collect/dedup/aggregate) -> developer reader
// PARTIES: SVC = Order Service (source service) · TRK = exception tracking service (collector + dedup aggregator) · DB = PostgreSQL 16 @ exc-db-1 (the exception store) · DEV = developer (reader)
// DEF: exception — one thrown error; here EX-1001 "customer is null" from stack SVC.doGet line 42
// DEF: fingerprint — a normalized signature that groups repeats; here "FP-77A3"
// DEF: issue — one distinct fingerprint with its count; here "FP-77A3" count 2
// STATE (before):
//    issues : {}        // the store holds no fingerprint yet
//    reported : 0       // nothing triaged yet
// DEF: track · CALLED BY: SVC throwing, TRK folding, DEV reading
// -> exception_id : "EX-1001"
//    step 1 · SVC throws, TRK normalizes the stack   // fingerprint : "" -> "FP-77A3"   BECAUSE msg "customer is null" and stack SVC.doGet line 42 hash to one signature
//    step 2 · TRK folds the repeat into the store   // issues : {} -> { "FP-77A3": { count:2 } }   BECAUSE EX-7001 was already seen with the same fingerprint, so dedup bumps the count to 2
//    step 3 · TRK reports the issue to the developer   // reported : 0 -> 1   BECAUSE count 2 crosses the threshold of 1
// <- outcome : issues["FP-77A3"].count = 2 · DEV sees one deduplicated issue  BECAUSE the tracker folded EX-1001 and EX-7001 into the same fingerprint
```

## Interview Questions

### Q1

Your order service runs as many instances across many machines, and one instance starts failing whenever it looks up a customer that is missing from the database. You need the message and the stack trace captured at the moment of the throw, not reconstructed later.

**Interviewer's question:** Walk me through the first stage of Exception tracking — what does a service instance throw, and what exactly does the handler capture from it?

**Solution:** The handler catches the exception and packages its error message plus the stack trace into a reportable record at the source, before anything is lost.

**System-design components:**
- Order Service instance — throws and catches
- Exception object — error message + stack trace
- Handler catch block — packages the record
- Report record — msg + stack + timestamp

```mermaid
flowchart LR
  U1["User calls GET /orders REQ-7001"] -->|"throws"| E["Exception: customer is null"]
  E -->|"caught"| H["Handler catch block"]
  H -->|"packages"| R["Report msg + stack + ts"]
```

```java
// ORDER SERVICE SIDE — one request throws, and the handler captures the message plus stack trace before the thread dies
// PARTIES: SVC = Order Service instance · U1 = the user calling the service · DB = PostgreSQL 16 @ orders-db-1 (the table returns no row)
// STATE (before):
//    req : { id:"REQ-7001", path:"/orders", status:"OPEN" }
//    report : {}
// DEF: handle_request · CALLED BY: U1 submitting GET /orders with id REQ-7001
// -> req_id : "REQ-7001"
//    step 1 · query the customer row for REQ-7001 -> none   // lookup : "pending" -> null   BECAUSE DB holds no row for REQ-7001
//    step 2 · throw NullPointerException("customer is null")   // err : null -> "customer is null"
//    step 3 · catch in the handler, capture message + stack trace   // report : {} -> {msg:"customer is null", stack:"SVC.doGet line 42", ts:19}
// <- captured : report = {msg:"customer is null", stack:"SVC.doGet line 42", ts:19} · 1 exception now held for reporting
//    alt no catch block : the thread dies, report stays {} -> the failure is invisible to every later step
```

_This is the capture stage of Exception tracking — the throw, the message-plus-stack-trace, and the handler that packages them._

_Covers:_ Capture the exception

_From the 28 problems:_ 20-metrics-monitoring

### Q2

A single instance's log file is not where your developers look, so you stand up a centralized exception tracking service. Every caught exception must reach it without slowing down the request path it is observing.

**Interviewer's question:** How does a service report a captured exception to the centralized tracker, and why is the exception also written to the local log?

**Solution:** The service POSTs the message plus stack trace to the tracking service, receives an acknowledgement, and also writes the same line to its local log so Log aggregation keeps a copy.

**System-design components:**
- Order Service — the sender
- Exception tracking service — the receiver
- HTTP POST /exceptions — the transport
- Local log file — the secondary copy

```mermaid
flowchart LR
  SVC["Order Service"] -->|"POST /exceptions"| TRK["Exception tracking service"]
  TRK -->|"200 stored"| SVC
  SVC -->|"also writes"| LOG["Local log file"]
```

```java
// ORDER SERVICE SIDE — the captured exception is POSTed to the centralized tracker and also written to the local log
// PARTIES: SVC = Order Service instance · TRK = exception tracking service
// STATE (before):
//    report : { id:"EX-7001", msg:"customer is null", stack:"SVC.doGet line 42", ts:19 }
//    sent : false
//    logfile : []
// DEF: report_exception · CALLED BY: the handler right after it catches, over HTTP
// -> ex_id : "EX-7001"
//    step 1 · serialize the report into a request body   // payload : {} -> {id:"EX-7001", msg:"customer is null", stack:"SVC.doGet line 42"}
//    step 2 · POST /exceptions to TRK -> stored   // tracker_store : [] -> ["EX-7001"]
//    step 3 · TRK returns 200, SVC marks it sent   // sent : false -> true
//    step 4 · also write the line to the local log   // logfile : [] -> ["EX-7001 customer is null"]
// <- ack : "EX-7001 stored" · the exception now lives in the central tracker AND the local log
//    alt TRK unreachable : POST fails, sent stays false, but logfile still gains the line -> Log aggregation keeps a copy
```

_This is the report stage — pointing the service at the centralized tracker, sending the message plus stack trace, and acknowledging it._

_Covers:_ Report to a centralized tracker

_From the 28 problems:_ 20-metrics-monitoring

### Q3

The same null-customer bug is firing across hundreds of instances, and if every throw becomes its own row, the noise buries the signal. Your tracker must collapse all the repeats into a single issue.

**Interviewer's question:** How does the centralized tracker de-duplicate exceptions — what is the key it fingerprints on, and what happens on the first sighting versus a repeat?

**Solution:** The tracker fingerprints each exception by its stack trace, creates a tracked issue on the first sighting, and increments the same issue on every later report with the same fingerprint.

**System-design components:**
- Stack-trace fingerprint — the dedup key
- Issue store — fingerprint to count map
- First sighting — creates the issue
- Repeat — increments the count

```mermaid
flowchart LR
  SVC1["Instance 1 report"] -->|"fp FP-77A3"| TRK["Tracker issues map"]
  SVC2["Instance 2 report"] -->|"fp FP-77A3"| TRK
  TRK -->|"create then increment"| I["Issue FP-77A3 count 2"]
```

```java
// TRACKER SIDE — two instances of the same bug collapse into one tracked issue keyed on the stack-trace fingerprint
// PARTIES: SVC1 = Order Service instance 1 · SVC2 = Order Service instance 2 · TRK = exception tracking service
// STATE (before):
//    issues : {}   // fingerprint -> issue map, the tracker's store, empty
// DEF: ingest · CALLED BY: TRK for each reported exception, keyed on the stack-trace hash
// -> ex1 : { id:"EX-7001", msg:"customer is null", fp:"FP-77A3" }
//    step 1 · hash the stack trace into a fingerprint   // fp : null -> "FP-77A3"
//    step 2 · look up issues["FP-77A3"] -> not found, so create the issue   // issues : {} -> {"FP-77A3":{count:1, state:"OPEN"}}
//    step 3 · later SVC2 reports the SAME bug with fp "FP-77A3" -> seen, so increment   // issues["FP-77A3"].count : 1 -> 2
// <- aggregate : issues = {"FP-77A3":{count:2, state:"OPEN"}} · 2 exceptions deduplicated into 1 issue
//    alt a new fingerprint "FP-1B20" : issues : {"FP-77A3":{count:2}} -> {"FP-77A3":{count:2}, "FP-1B20":{count:1}} · a 2nd distinct issue
```

_This is the de-duplication and aggregation stage — fingerprinting by stack trace, creating on first sight, and incrementing on repeat._

_Covers:_ De-duplicate and aggregate

_From the 28 problems:_ 20-metrics-monitoring

### Q4

An aggregated issue is still not fixed until a human sees it. Your tracker should wake someone when an issue crosses a threshold, and record when the underlying bug is actually closed.

**Interviewer's question:** After aggregation, how does Exception tracking turn a pile of exceptions into a fixed product — what notifies the developer and what marks the issue resolved?

**Solution:** The tracker notifies a developer when an issue needs attention; the developer investigates the message and stack trace, fixes the underlying cause, and marks the issue resolved.

**System-design components:**
- Threshold crossing — triggers the notify
- Notification — to the on-call developer
- Investigation — reads msg + stack trace
- Resolution state — OPEN to RESOLVED

```mermaid
flowchart LR
  TRK["Tracker issue count 2"] -->|"crosses threshold 1"| DEV["On-call developer"]
  DEV -->|"commits fix"| FIX["commit-9f2c"]
  FIX -->|"marks"| RES["state RESOLVED"]
```

```java
// TRACKER SIDE — an issue whose count crosses the threshold notifies the developer, who fixes and resolves it
// PARTIES: TRK = exception tracking service · DEV = the on-call developer
// STATE (before):
//    issue : { fp:"FP-77A3", count:2, state:"OPEN" }
//    alert : []
// DEF: notify_and_resolve · CALLED BY: TRK when an issue's count crosses the threshold 1
// -> issue_fp : "FP-77A3"
//    step 1 · count 2 crosses threshold 1 -> notify DEV   // alert : [] -> ["FP-77A3 -> DEV"]
//    step 2 · DEV reads the message and stack, finds the null-customer path, commits a fix   // fix : null -> "commit-9f2c"
//    step 3 · DEV marks the issue resolved   // issue.state : "OPEN" -> "RESOLVED"
// <- resolution : issue.state = "RESOLVED" · the underlying bug is closed, not just the symptom logged
//    alt the bug reappears : a new report with fp "FP-77A3" -> count : 2 -> 3 and state : "RESOLVED" -> "OPEN"
```

_This is the final stage — notifying developers, investigating, and resolving the underlying issue._

_Covers:_ Notify developers and resolve

_From the 28 problems:_ 20-metrics-monitoring

## Key Concepts

### The Problem

**Scattered exceptions with no view.** Without a shared place for them, the exceptions those errors throw cannot be seen or tracked as a whole.


### The Solution

Report all exceptions to a centralized exception tracking service that aggregates and tracks them and notifies developers.

```mermaid
flowchart LR
  U1["User calls GET /orders REQ-7001"] -->|"throws"| E["Exception: customer is null"]
  E -->|"caught"| H["Handler catch block"]
  H -->|"packages"| R["Report msg + stack + ts"]
```


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| Centralized exception tracking service | Report all exceptions to a centralized exception tracking service that aggregates and tracks them and notifies developers. | Exceptions are logged as well as reported to the tracking service, pairing this pattern with Log aggregation. |
| One more service to run | The exception tracking service is additional infrastructure. | You trade a self-contained service for the ability to view exceptions and track their resolution. |
| Overhead must stay minimal | Any solution should have minimal runtime overhead. | The pattern reports a lightweight record (message plus stack trace) rather than heavy state, so a service keeps handling requests. |


### Tradeoffs & When

- The exception tracking service is additional infrastructure.
- Any solution should have minimal runtime overhead.


<details><summary>All concepts (index)</summary>

### Problem: Scattered exceptions with no view

**Why.** A microservice application is many services and instances on many machines, and errors occur while handling requests.

**Claim.** Without a shared place for them, the exceptions those errors throw cannot be seen or tracked as a whole.

**Grounding.** Each failing instance throws an exception carrying an error message and a stack trace, but nothing aggregates them.

**In the wild.** The context is an application of multiple services and instances running on multiple machines, so exceptions are thrown in many places at once.
### Solution: Centralized exception tracking service

**Why.** Developers need one place to see every exception and follow each one to resolution.

**Claim.** Report all exceptions to a centralized exception tracking service that aggregates and tracks them and notifies developers.

**Grounding.** The service de-duplicates and records exceptions so developers can investigate and resolve the underlying issue.

**In the wild.** Exceptions are logged as well as reported to the tracking service, pairing this pattern with Log aggregation.
### Tradeoff: One more service to run

**Why.** A central tracker is a distinct piece of software that must be provisioned and operated.

**Claim.** The exception tracking service is additional infrastructure.

**Grounding.** The reference lists this as the stated drawback of the pattern.

**In the wild.** You trade a self-contained service for the ability to view exceptions and track their resolution.
### Tradeoff: Overhead must stay minimal

**Why.** Reporting must not slow down the request path it is observing.

**Claim.** Any solution should have minimal runtime overhead.

**Grounding.** This is a stated force: exceptions are de-duplicated, recorded, investigated, and resolved, all without taxing the hot path.

**In the wild.** The pattern reports a lightweight record (message plus stack trace) rather than heavy state, so a service keeps handling requests.

</details>


## Quiz

1. What does the Exception tracking pattern report to a centralized service?

   - A. Every successful response a service sends
   - B. All exceptions, carrying an error message and a stack trace
   - C. Only HTTP 500 responses
   - D. The size of each log file

<details><summary>Reveal answer</summary>

**B.** A service instance throws an exception that contains an error message and a stack trace, and the pattern reports all exceptions to the centralized tracking service. A and C are wrong because the pattern reports exceptions, not normal responses or status codes. D is wrong because log-file size is not part of the pattern.

</details>

2. What must happen to exceptions after they reach the tracker?

   - A. They are de-duplicated, recorded, investigated, and the underlying issue resolved
   - B. They are encrypted and archived permanently
   - C. They are replayed to end users
   - D. They are deleted after one day

<details><summary>Reveal answer</summary>

**A.** The reference states exceptions must be de-duplicated, recorded, investigated by developers, and the underlying issue resolved. B, C, and D describe actions the pattern does not require.

</details>

3. Which is a stated drawback of Exception tracking?

   - A. It raises runtime overhead on every request
   - B. The exception tracking service is additional infrastructure
   - C. It removes stack traces from errors
   - D. It forces a monolithic deployment

<details><summary>Reveal answer</summary>

**B.** The reference lists the additional infrastructure as the drawback. A is wrong because the pattern demands minimal runtime overhead. C and D are not in the reference.

</details>

4. How should Exception tracking relate to logging?

   - A. Exceptions replace all logging
   - B. Exceptions should be logged as well as reported to a tracking service
   - C. Exceptions must never be logged
   - D. Only stack traces are logged, never messages

<details><summary>Reveal answer</summary>

**B.** The related Log aggregation pattern states exceptions should be logged as well as reported to a tracking service. A, C, and D contradict that guidance.

</details>

