# Chapter 33: Distributed Tracing

> Assign each external request a unique id, pass it through every service, and record per-operation timing in a centralized trace store.

_Also known as: Chris Richardson · Microservice Patterns Ch. 33 (p.370) · microservices.io /patterns/observability/distributed-tracing.html_

## Flow

### Assigning the request id

> **Why this matters:** Requests span multiple services, but external monitoring only reports overall response time and invocation counts — no insight into individual operations. The first fix is to assign each external request a unique id.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. External request arrives</b><br/>GET /orders/PO-2001 hits the API gateway"]:::start
  n1["<b>2. Assign a unique request id</b><br/>trace_id = 4bf92f3577b34da6a3ce90d0e2b88a4d, once per request"]:::step
  n2["<b>3. Attach the id to the header</b><br/>header.trace_id : empty becomes 4bf92f3577b34da6a3ce90d0e2b88a4d"]:::step
  n3["<b>4. Open the root span</b><br/>span 6f9a3c1b8e2d4001, parent empty, start 100"]:::core
  n4["<b>5. Index the trace by id</b><br/>trace_registry : empty becomes one entry keyed by trace_id"]:::core
  n5["<b>6. Chassis provides the wiring</b><br/>one framework runs steps 2-4 for every service"]:::step
  n6["<b>7. Request enters the first service</b><br/>carries trace_id plus the open root span"]:::stop
  n7["<b>No id assigned</b><br/>later hops cannot be reassembled into one trace"]:::warn
  n0 -->|"1. request needs a label"| n1
  n1 -->|"2. id travels on the request"| n2
  n2 -->|"3. first unit of work opens"| n3
  n3 -->|"4. span stored under its trace"| n4
  n4 -->|"5. chassis centralizes this"| n5
  n5 -->|"6. hand off downstream"| n6
  n1 -->|"7. skipped - request untraceable"| n7
```

1. **Unique external request id** — Instrument services with code that assigns each external request a unique external request id.

2. **Carry it on the request** — The id is attached to the request as it enters the service graph.

3. **Chassis-provided** — This instrumentation might be part of the functionality provided by a Microservice Chassis framework.

```java
// API GATEWAY SIDE — each external request is assigned a unique id before entering the services
// PARTIES: GW = API gateway · SVC = first service
// DEF: trace — the entire journey of ONE external request = every span that shares one trace_id; here trace "4bf92f3577b34da6a3ce90d0e2b88a4d" = the GW->ORD->KIT->PAY chain
// DEF: span — ONE unit of work (a single service operation) with a span_id, a parent span_id and start/end times; here ("6f9a3c1b8e2d4001", parent="", start=100)
// DEF: trace_id — the id shared by every span of one trace, attached to the request header; here "4bf92f3577b34da6a3ce90d0e2b88a4d"
// DEF: root_span — the FIRST span of a trace, with parent="" (no parent); here "6f9a3c1b8e2d4001"
// STATE (before):
//    trace_registry : {}                  // trace_id -> spans
//    spans : []                           // spans recorded so far for this request
// DEF: receive_request · CALLED BY: a client HTTP request arriving at GW
// -> request : "GET /orders/PO-2001"
//    step 1 · generate the external request id   trace_id = "4bf92f3577b34da6a3ce90d0e2b88a4d"
//    step 2 · attach it to the outbound header   header.trace_id : "" -> "4bf92f3577b34da6a3ce90d0e2b88a4d"
//    step 3 · open the root span                 spans : [] -> [("6f9a3c1b8e2d4001", parent="", start=100)]
//    step 4 · index the trace by its id          trace_registry : {} -> {"4bf92f3577b34da6a3ce90d0e2b88a4d": spans}
// <- outcome : the request carries trace_id "4bf92f3577b34da6a3ce90d0e2b88a4d" into SVC · root span "6f9a3c1b8e2d4001" opened
```

### Propagating through services

> **Why this matters:** The id is useless unless every service that handles the request receives it. Each hop opens a child span naming its parent, so one request becomes a chain of spans.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Request leaves the gateway</b><br/>GW span 6f9a3c1b8e2d4001, parent empty"]:::start
  n1["<b>2. Header carries the parent span</b><br/>header.span_id : empty becomes 6f9a3c1b8e2d4001"]:::step
  n2["<b>3. ORD opens a child span</b><br/>6f9a3c1b8e2d4002, parent 6f9a3c1b8e2d4001, start 105"]:::step
  n3["<b>4. KIT opens the next child</b><br/>6f9a3c1b8e2d4003, parent 6f9a3c1b8e2d4002, start 121"]:::step
  n4["<b>5. PAY opens the final child</b><br/>6f9a3c1b8e2d4004, parent 6f9a3c1b8e2d4003, start 136"]:::step
  n5["<b>6. Four spans, one chain</b><br/>all share trace_id 4bf92f3577b34da6a3ce90d0e2b88a4d"]:::core
  n6["<b>7. Chain rebuilt from parents</b><br/>each parent id names who invoked whom"]:::stop
  n7["<b>Missing parent</b><br/>a child without a parent id breaks the chain"]:::warn
  n0 -->|"1. forward to ORD"| n1
  n1 -->|"2. ORD invoked"| n2
  n2 -->|"3. ORD calls KIT"| n3
  n3 -->|"4. KIT calls PAY"| n4
  n4 -->|"5. spans chained by parent ids"| n5
  n5 -->|"6. one trace, many operations"| n6
  n2 -->|"7. parent id lost"| n7
```

1. **Pass the id** — Pass the external request id to all services involved in handling the request.

2. **Child spans** — Each service opens a span whose parent is the span of the previous hop.

3. **One trace, many operations** — Each service performs one or more operations — database queries, message publishes — captured as spans.

```java
// SERVICE SIDE — one request traverses 3 services, each opening a child span of the previous hop
// PARTIES: GW = API gateway · ORD = Order Service · KIT = Kitchen Service · PAY = Payment Service
// DEF: span — ONE unit of work with a span_id, a parent span_id and start/end; here ("6f9a3c1b8e2d4001", parent="", svc="GW", start=100, end=104)
// DEF: parent — a span's parent span_id (which span invoked it); here parent="6f9a3c1b8e2d4001" for a child, "" for the root_span
// DEF: header — the key-value carrier that passes trace_id and the last span_id between hops; here {trace_id:"4bf92f3577b34da6a3ce90d0e2b88a4d", span_id:""}
// STATE (before):
//    spans : [("6f9a3c1b8e2d4001", parent="", svc="GW", start=100, end=104)]
//    header : { trace_id: "4bf92f3577b34da6a3ce90d0e2b88a4d", span_id: "" }
// DEF: handle_request · CALLED BY: the request moving GW -> ORD -> KIT -> PAY
// -> trace_id : "4bf92f3577b34da6a3ce90d0e2b88a4d"
//    step 1 · GW forwards to ORD, header carries the parent span   header.span_id : "" -> "6f9a3c1b8e2d4001"
//    step 2 · ORD opens child span, forwards to KIT    spans : [1 span] -> [1 span, ("6f9a3c1b8e2d4002", parent="6f9a3c1b8e2d4001", svc="ORD", start=105, end=120)]
//    step 3 · KIT opens child span, calls PAY          spans : [2 spans] -> [2 spans, ("6f9a3c1b8e2d4003", parent="6f9a3c1b8e2d4002", svc="KIT", start=121, end=135)]
//    step 4 · PAY opens child span, replies            spans : [3 spans] -> [3 spans, ("6f9a3c1b8e2d4004", parent="6f9a3c1b8e2d4003", svc="PAY", start=136, end=150)]
// <- outcome : 4 spans chained by parent/child span ids, all carrying trace_id "4bf92f3577b34da6a3ce90d0e2b88a4d"
```

### Collecting spans in the trace store

> **Why this matters:** Spans must be recorded in a centralized service so the whole request can be reconstructed. The reference example delivers traces to a Zipkin server via RabbitMQ, where Zipkin gathers and displays them.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Each service finishes its operation</b><br/>GW span done at end 104"]:::start
  n1["<b>2. Sleuth instruments delivery</b><br/>Spring Cloud Sleuth hands spans to the broker"]:::step
  n2["<b>3. RabbitMQ carries the spans</b><br/>broker delivers each span to Zipkin"]:::step
  n3["<b>4. Zipkin appends to the trace</b><br/>trace_store : empty becomes one entry per trace_id"]:::core
  n4["<b>5. All four spans collected</b><br/>4 spans under trace_id 4bf92f3577b34da6a3ce90d0e2b88a4d"]:::core
  n5["<b>6. Derive latency = end - start</b><br/>104-100=4, 120-105=15, 135-121=14, 150-136=14 ms"]:::step
  n6["<b>7. Trace reconstructable</b><br/>Zipkin displays the full request timeline"]:::stop
  n7["<b>Lost span in transit</b><br/>broker drops a span - the trace is incomplete"]:::warn
  n0 -->|"1. span ready"| n1
  n1 -->|"2. deliver via broker"| n2
  n2 -->|"3. arrives at Zipkin"| n3
  n3 -->|"4. next span arrives"| n3
  n3 -->|"5. all spans in"| n4
  n4 -->|"6. subtract times"| n5
  n5 -->|"7. reconstruct the request"| n6
  n2 -->|"8. broker fails"| n7
```

1. **Record in a central service** — Record information about requests and operations — for example start time and end time — in a centralized service.

2. **Sleuth and Zipkin** — Spring Cloud Sleuth instruments components and delivers trace information to a Zipkin server.

3. **Deliver via RabbitMQ** — RabbitMQ is used to deliver traces to Zipkin; the Zipkin server is a Spring Boot app with @EnableZipkinStreamServer.

4. **Latency from times** — Start and end times per span let Zipkin derive per-operation latency.

```java
// TRACE STORE SIDE — the spans from all 4 hops land in one centralized trace server (Zipkin)
// PARTIES: GW = gateway · ORD = Order Service · ZIP = Zipkin server · BRK = RabbitMQ broker
// DEF: trace — the set of all spans sharing one trace_id; here trace "4bf92f3577b34da6a3ce90d0e2b88a4d" = 4 spans
// DEF: span — ONE unit of work with span_id, parent, start and end; here ("6f9a3c1b8e2d4001",parent="",start=100,end=104)
// DEF: latency — how long one span took = end - start; here 104-100 = 4 ms
// STATE (before):
//    trace_store : {}                        // trace_id -> spans, as ZIP holds them
// DEF: collect_spans · CALLED BY: each service finishing its operation
//    step 1 · GW span arrives via BRK    trace_store : {} -> {"4bf92f3577b34da6a3ce90d0e2b88a4d":[("6f9a3c1b8e2d4001",parent="",start=100,end=104)]}
//    step 2 · ORD span arrives via BRK   trace_store : {"4bf9...":[1 span]} -> {"4bf9...":[("6f9a3c1b8e2d4001",start=100,end=104),("6f9a3c1b8e2d4002",parent="6f9a3c1b8e2d4001",start=105,end=120)]}
//    step 3 · KIT span arrives via BRK   trace_store : {"4bf9...":[2 spans]} -> {"4bf9...":[2 spans, ("6f9a3c1b8e2d4003",parent="6f9a3c1b8e2d4002",start=121,end=135)]}
//    step 4 · PAY span arrives via BRK   trace_store : {"4bf9...":[3 spans]} -> {"4bf9...":[3 spans, ("6f9a3c1b8e2d4004",parent="6f9a3c1b8e2d4003",start=136,end=150)]}
// <- outcome : trace_store : 4 spans for trace "4bf92f3577b34da6a3ce90d0e2b88a4d" · ZIP derives latency = end - start: 104-100=4, 120-105=15, 135-121=14, 150-136=14
```

### Searching logs by request id

> **Why this matters:** Because the request id is included in every log message, a developer can search aggregated logs for it and see how one request was handled — but aggregating and storing traces can require significant infrastructure.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Each service logs with the trace id</b><br/>log_index : empty becomes 3 lines tagged 4bf92f3577b34da6a3ce90d0e2b88a4d"]:::start
  n1["<b>2. Operator queries the index</b><br/>search trace_id 4bf92f3577b34da6a3ce90d0e2b88a4d"]:::step
  n2["<b>3. Matches reassemble the request</b><br/>matches : empty becomes ORD line, KIT line, PAY line"]:::step
  n3["<b>4. Order the lines by timestamp</b><br/>ORD at 105, KIT at 121, PAY at 136"]:::step
  n4["<b>5. Slow hop exposed</b><br/>KIT took 135-121 = 14 ms"]:::core
  n5["<b>6. One search, many machines</b><br/>the id links logs on 3 different machines"]:::stop
  n6["<b>Infrastructure cost</b><br/>N requests times M spans = N times M stored records"]:::warn
  n0 -->|"1. logs carry the id"| n1
  n1 -->|"2. query the index"| n2
  n2 -->|"3. matched lines"| n3
  n3 -->|"4. sort by time"| n4
  n4 -->|"5. latency per hop"| n5
  n3 -->|"6. at scale - storage grows"| n6
```

1. **Include id in logs** — Include the external request id in all log messages, per the instrumentation.

2. **Search aggregated logs** — The benefit is searching across aggregated logs for the external request id to see how an individual request was handled.

3. **Find the slow hop** — Ordering the matched lines by time exposes the sources of latency.

4. **Infrastructure cost** — The issue is that aggregating and storing traces can require significant infrastructure.

```java
// OPERATOR SIDE — the request id links a request's scattered log lines so one search reassembles it
// PARTIES: OP = operator · LOGS = log-aggregation index · ZIP = Zipkin trace server
// DEF: trace_id — the id shared by every log line of one request; here "4bf92f3577b34da6a3ce90d0e2b88a4d"
// DEF: match — one stored log line that satisfies the search; here 3 lines for one trace_id
// STATE (before):
//    log_index : []                       // every stored log line, tagged with its trace id
//    matches : []                         // what a search returns
// DEF: search · CALLED BY: OP debugging one slow request
// -> trace_id : "4bf92f3577b34da6a3ce90d0e2b88a4d"
//    step 1 · each service logs with the trace id inline   log_index : [] -> [3 lines tagged "4bf92f3577b34da6a3ce90d0e2b88a4d"]
//    step 2 · OP queries the index for the id               matches : [] -> [ORD line, KIT line, PAY line]
//    step 3 · OP orders the 3 lines by timestamp            matches : [3 lines] -> [ORD@105, KIT@121, PAY@136]
// <- outcome : matches : 3 lines for one id · the slow hop is KIT (135-121=14 ms)   BECAUSE the id links logs on 3 different machines
//    alt infra cost : at scale N requests x M spans = N x M records -> needs real storage infrastructure
```


## Interview Questions

### Q1

External monitoring reports only overall response time and invocation counts, so a slow request looks fine in aggregate. The team instruments the gateway to label each external request before it enters the services.

**Interviewer's question:** What is the first thing distributed tracing instrumentation does for each external request, and what is the id's relationship to the first span?

**Solution:** It assigns each external request a unique external request id, attaches it to the request, and opens the root span — the first span of the trace, with no parent.

**System-design components:**
- API gateway
- trace_id
- root span
- trace registry

```mermaid
flowchart LR
  C["Client"] -->|"GET /orders/PO-2001"| G["API gateway"]
  G -->|"assign trace_id"| T["4bf92f3577..."]
  G -->|"open root span"| S["6f9a3c1b8e2d4001 (parent empty)"]
  T --> R["trace_registry"]
  S --> R
```

```java
// API GATEWAY SIDE — each external request is assigned a unique id before entering the services
// PARTIES: GW = API gateway · SVC = first service
// DEF: trace_id — the id shared by every span of one trace, attached to the request header; here "4bf92f3577b34da6a3ce90d0e2b88a4d"
// DEF: root_span — the FIRST span of a trace, with parent="" (no parent); here "6f9a3c1b8e2d4001"
// STATE (before):
//    trace_registry : {}                  // trace_id -> spans
//    spans : []                           // spans recorded so far for this request
// DEF: receive_request · CALLED BY: a client HTTP request arriving at GW
// -> request : "GET /orders/PO-2001"
//    step 1 · generate the external request id   trace_id = "4bf92f3577b34da6a3ce90d0e2b88a4d"
//    step 2 · attach it to the outbound header   header.trace_id : "" -> "4bf92f3577b34da6a3ce90d0e2b88a4d"
//    step 3 · open the root span                 spans : [] -> [("6f9a3c1b8e2d4001", parent="", start=100)]
//    step 4 · index the trace by its id          trace_registry : {} -> {"4bf92f3577b34da6a3ce90d0e2b88a4d": spans}
// <- outcome : the request carries trace_id "4bf92f3577b34da6a3ce90d0e2b88a4d" into SVC · root span "6f9a3c1b8e2d4001" opened
```

_This is the chapter's assign-the-request-id step: a unique id plus the root span begin the trace._

_Covers:_ Assigning the request id

_From the 28 problems:_ 20-metrics-monitoring

### Q2

One request travels GW to Order Service to Kitchen Service to Payment Service. Each hop must keep the trace intact so the whole journey can be reconstructed.

**Interviewer's question:** How does the request id propagate through services, and how do the spans relate to one another?

**Solution:** Each service passes the id onward, and each hop opens a child span whose parent is the previous hop's span, chaining one request into a sequence of spans.

**System-design components:**
- API gateway
- Order Service
- Kitchen Service
- Payment Service

```mermaid
flowchart LR
  G["GW"] -->|"span 6f9a...001"| O["Order Service"]
  O -->|"child 6f9a...002"| K["Kitchen Service"]
  K -->|"child 6f9a...003"| P["Payment Service"]
  P -->|"child 6f9a...004"| E["replies"]
```

```java
// SERVICE SIDE — one request traverses 3 services, each opening a child span of the previous hop
// PARTIES: GW = API gateway · ORD = Order Service · KIT = Kitchen Service · PAY = Payment Service
// DEF: parent — a span's parent span_id (which span invoked it); here parent="6f9a3c1b8e2d4001" for a child, "" for the root_span
// STATE (before):
//    spans : [("6f9a3c1b8e2d4001", parent="", svc="GW", start=100, end=104)]
//    header : { trace_id: "4bf92f3577b34da6a3ce90d0e2b88a4d", span_id: "" }
// DEF: handle_request · CALLED BY: the request moving GW -> ORD -> KIT -> PAY
// -> trace_id : "4bf92f3577b34da6a3ce90d0e2b88a4d"
//    step 1 · GW forwards to ORD, header carries the parent span   header.span_id : "" -> "6f9a3c1b8e2d4001"
//    step 2 · ORD opens child span, forwards to KIT    spans : [1 span] -> [1 span, ("6f9a3c1b8e2d4002", parent="6f9a3c1b8e2d4001", svc="ORD", start=105, end=120)]
//    step 3 · KIT opens child span, calls PAY          spans : [2 spans] -> [2 spans, ("6f9a3c1b8e2d4003", parent="6f9a3c1b8e2d4002", svc="KIT", start=121, end=135)]
//    step 4 · PAY opens child span, replies            spans : [3 spans] -> [3 spans, ("6f9a3c1b8e2d4004", parent="6f9a3c1b8e2d4003", svc="PAY", start=136, end=150)]
// <- outcome : 4 spans chained by parent/child span ids, all carrying trace_id "4bf92f3577b34da6a3ce90d0e2b88a4d"
```

_This is the chapter's propagate-through-services step: each hop opens a child span of the previous one, forming the trace chain._

_Covers:_ Propagating through services

_From the 28 problems:_ 20-metrics-monitoring

### Q3

The four spans from GW, Order, Kitchen, and Payment must land in one place where the whole request can be reconstructed with per-operation timing.

**Interviewer's question:** How are spans recorded centrally, and how is per-operation latency derived?

**Solution:** Spans are recorded in a centralized trace store — Spring Cloud Sleuth delivers them to a Zipkin server, via RabbitMQ — and Zipkin derives each operation's latency as end minus start.

**System-design components:**
- Gateway/Order/Kitchen/Payment spans
- RabbitMQ broker
- Zipkin server
- latency derivation

```mermaid
flowchart LR
  S["Services"] -->|"spans"| B["RabbitMQ"]
  B -->|"deliver"| Z["Zipkin server"]
  Z -->|"end - start"| L["per-span latency"]
  L -->|"4 spans"| T["one trace"]
```

```java
// TRACE STORE SIDE — the spans from all 4 hops land in one centralized trace server (Zipkin)
// PARTIES: GW = gateway · ORD = Order Service · ZIP = Zipkin server · BRK = RabbitMQ broker
// DEF: latency — how long one span took = end - start; here 104-100 = 4 ms
// STATE (before):
//    trace_store : {}                        // trace_id -> spans, as ZIP holds them
// DEF: collect_spans · CALLED BY: each service finishing its operation
// -> trace_id : "4bf92f3577b34da6a3ce90d0e2b88a4d" · -> span1 : ("6f9a3c1b8e2d4001", parent="", start=100, end=104)
//    step 1 · GW span arrives via BRK    trace_store : {} -> {"4bf92f3577b34da6a3ce90d0e2b88a4d":[("6f9a3c1b8e2d4001",parent="",start=100,end=104)]}
//    step 2 · ORD span arrives via BRK   trace_store : {"4bf9...":[1 span]} -> {"4bf9...":[("6f9a3c1b8e2d4001",start=100,end=104),("6f9a3c1b8e2d4002",parent="6f9a3c1b8e2d4001",start=105,end=120)]}
//    step 3 · KIT span arrives via BRK   trace_store : {"4bf9...":[2 spans]} -> {"4bf9...":[2 spans, ("6f9a3c1b8e2d4003",parent="6f9a3c1b8e2d4002",start=121,end=135)]}
//    step 4 · PAY span arrives via BRK   trace_store : {"4bf9...":[3 spans]} -> {"4bf9...":[3 spans, ("6f9a3c1b8e2d4004",parent="6f9a3c1b8e2d4003",start=136,end=150)]}
// <- outcome : trace_store : 4 spans for trace "4bf92f3577b34da6a3ce90d0e2b88a4d" · ZIP derives latency = end - start: 104-100=4, 120-105=15, 135-121=14, 150-136=14
```

_This is the chapter's collect-spans-in-the-trace-store step: Zipkin gathers spans via RabbitMQ and derives per-operation latency._

_Covers:_ Collecting spans in the trace store

_From the 28 problems:_ 20-metrics-monitoring

### Q4

An operator debugging one slow order needs to see every log line for it across three machines, ordered by time, to find the slow hop.

**Interviewer's question:** What benefit does distributed tracing provide for debugging, and how does the request id enable it?

**Solution:** Because the request id is included in every log message, a developer can search aggregated logs for the id to see how one request was handled — ordering the matched lines by time exposes the sources of latency.

**System-design components:**
- operator
- log-aggregation index
- trace_id
- ordered matches

```mermaid
flowchart LR
  O["Operator"] -->|"search trace_id"| I["log index"]
  I -->|"3 lines"| M["ORD@105, KIT@121, PAY@136"]
  M -->|"order by time"| S["slow hop: KIT 14 ms"]
```

```java
// OPERATOR SIDE — the request id links a request's scattered log lines so one search reassembles it
// PARTIES: OP = operator · LOGS = log-aggregation index · ZIP = Zipkin trace server
// DEF: match — one stored log line that satisfies the search; here 3 lines for one trace_id
// STATE (before):
//    log_index : []                       // every stored log line, tagged with its trace id
//    matches : []                         // what a search returns
// DEF: search · CALLED BY: OP debugging one slow request
// -> trace_id : "4bf92f3577b34da6a3ce90d0e2b88a4d"
//    step 1 · each service logs with the trace id inline   log_index : [] -> [3 lines tagged "4bf92f3577b34da6a3ce90d0e2b88a4d"]
//    step 2 · OP queries the index for the id               matches : [] -> [ORD line, KIT line, PAY line]
//    step 3 · OP orders the 3 lines by timestamp            matches : [3 lines] -> [ORD@105, KIT@121, PAY@136]
// <- outcome : matches : 3 lines for one id · the slow hop is KIT (135-121=14 ms)   BECAUSE the id links logs on 3 different machines
//    alt infra cost : at scale N requests x M spans = N x M records -> needs real storage infrastructure
```

_This is the chapter's search-logs-by-request-id benefit, paired with its infrastructure-cost issue._

_Covers:_ Searching logs by request id

_From the 28 problems:_ 20-metrics-monitoring

## Key Concepts

### The Problem

**Totals hide operations.** External monitoring only reports overall response time and number of invocations, with no insight into individual operations, and log entries for a request are scattered across numerous logs.


### The Solution

Instrument services to assign each external request a unique id, pass it to all involved services, include it in all log messages, and record operation start and end times in a centralized service.

```mermaid
flowchart LR
  C["Client"] -->|"GET /orders/PO-2001"| G["API gateway"]
  G -->|"assign trace_id"| T["4bf92f3577..."]
  G -->|"open root span"| S["6f9a3c1b8e2d4001 (parent empty)"]
  T --> R["trace_registry"]
  S --> R
```


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| Assign, pass, include, record | Instrument services to assign each external request a unique id, pass it to all involved services, include it in all log messages, and record operation start and end times in a centralized service. | Spring Cloud Sleuth instruments Spring components and delivers traces to a Zipkin server. |
| Trace storage infrastructure | Aggregating and storing traces can require significant infrastructure. | A Zipkin server plus RabbitMQ delivery is extra operational surface for the visibility gained. |
| Sampling vs overhead | The solution must have minimal runtime overhead, so tracing samples requests — and sampling less trades completeness for less overhead. | Sampling every request gives full traces; sampling a fraction is cheaper but can miss a slow request. |


### Tradeoffs & When

- Aggregating and storing traces can require significant infrastructure.
- The solution must have minimal runtime overhead, so tracing samples requests — and sampling less trades completeness for less overhead.


<details><summary>All concepts (index)</summary>

### Problem: Totals hide operations

**Why.** A request spans multiple services, each performing one or more operations such as database queries or publishing messages.

**Claim.** External monitoring only reports overall response time and number of invocations, with no insight into individual operations, and log entries for a request are scattered across numerous logs.

**Grounding.** These are the reference forces, along with minimal runtime overhead.

**In the wild.** A slow request looks fine in aggregate until its individual operations are traced.
### Solution: Assign, pass, include, record

**Why.** An unlabeled request cannot be reassembled across services.

**Claim.** Instrument services to assign each external request a unique id, pass it to all involved services, include it in all log messages, and record operation start and end times in a centralized service.

**Grounding.** These are the four instrumentation steps from the reference; the instrumentation might be part of a Microservice Chassis.

**In the wild.** Spring Cloud Sleuth instruments Spring components and delivers traces to a Zipkin server.
### Tradeoff: Trace storage infrastructure

**Why.** Every span and trace has to be stored and indexed somewhere.

**Claim.** Aggregating and storing traces can require significant infrastructure.

**Grounding.** The reference lists this as the pattern's issue.

**In the wild.** A Zipkin server plus RabbitMQ delivery is extra operational surface for the visibility gained.
### Tradeoff: Sampling vs overhead

**Why.** Instrumenting every request costs runtime overhead and storage.

**Claim.** The solution must have minimal runtime overhead, so tracing samples requests — and sampling less trades completeness for less overhead.

**Grounding.** The reference force demands minimal overhead, and the example sets SPRING_SLEUTH_SAMPLER_PERCENTAGE: 1 to sample all requests.

**In the wild.** Sampling every request gives full traces; sampling a fraction is cheaper but can miss a slow request.

</details>


## Quiz

1. What does distributed tracing instrumentation do first for each external request?

   - A. Assigns a unique external request id.
   - B. Stores the request body.
   - C. Aggregates the request into a metric.
   - D. Blocks the request for sampling.

<details><summary>Reveal answer</summary>

**A.** The first solution step is to assign each external request a unique external request id. Option C is application metrics, and B and D are not in the reference.

</details>

2. Why is external monitoring insufficient for troubleshooting?

   - A. It only reports overall response time and invocation counts, with no insight into individual operations.
   - B. It costs too much.
   - C. It requires a database.
   - D. It cannot measure latency.

<details><summary>Reveal answer</summary>

**A.** The reference force states external monitoring tells you only overall response time and number of invocations, with no insight into individual operations. Options B, C, and D are not the stated force.

</details>

3. Which benefit does distributed tracing provide?

   - A. It shows how an individual request is handled by searching aggregated logs for its external request id.
   - B. It removes the need for services.
   - C. It guarantees low latency.
   - D. It replaces metrics.

<details><summary>Reveal answer</summary>

**A.** The reference benefit is that developers can see how an individual request is handled by searching across aggregated logs for its external request id. The other options are not stated benefits.

</details>

4. What is an issue of distributed tracing?

   - A. It only works in Java.
   - B. Aggregating and storing traces can require significant infrastructure.
   - C. It cannot use a message broker.
   - D. It makes logs smaller.

<details><summary>Reveal answer</summary>

**B.** The reference issue is that aggregating and storing traces can require significant infrastructure. Option C is false (RabbitMQ delivers traces to Zipkin), and A and D are not in the reference.

</details>

