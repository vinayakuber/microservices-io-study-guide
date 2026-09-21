registerChapter({
  id: 'ch33',
  num: 33,
  title: 'Distributed Tracing',
  pattern: 'Assign each external request a unique id, pass it through every service, and record per-operation timing in a centralized trace store.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 33 (p.370) · microservices.io /patterns/observability/distributed-tracing.html',
  part: 8,
  flow: [
    {
      section: 'Assigning the request id',
      color: 'orange',
      motivation: `Requests span multiple services, but external monitoring only reports overall response time and invocation counts — no insight into individual operations. The first fix is to assign each external request a unique id.`,
      steps: [
        { num: 1, title: 'Unique external request id', detail: 'Instrument services with code that assigns each external request a unique external request id.' },
        { num: 2, title: 'Carry it on the request', detail: 'The id is attached to the request as it enters the service graph.' },
        { num: 3, title: 'Chassis-provided', detail: 'This instrumentation might be part of the functionality provided by a Microservice Chassis framework.' }
      ],
      program: `// API GATEWAY SIDE — the gateway mints the ids, opens the root span, and hands the context to the first service
// PARTIES: GW = API gateway (mints the ids) · SVC = first service process · BRK = RabbitMQ broker (async span transport to the collector) · ZIP = Zipkin distributed tracing system (collector + storage + query UI)
// DEF: trace_id — 128 random bits encoded as 32 hex chars, one per external request; here "4bf92f3577b34da6a3ce90d0e2b88a4d"
// DEF: span_id — 64 random bits encoded as 16 hex chars, one per operation; here "6f9a3c1b8e2d4001"
// DEF: span — one unit of work {span_id, parent, name, start, end}; here ("6f9a3c1b8e2d4001", parent="", name="GET /orders/PO-2001", start=100, end=104)
// DEF: header — the outbound key-value carrier {trace_id, span_id}; here { trace_id:"4bf92f3577b34da6a3ce90d0e2b88a4d", span_id:"6f9a3c1b8e2d4001" }
// DEF: traceparent — the wire form of the header = "00-<trace_id>-<span_id>-01"; here "00-4bf92f3577b34da6a3ce90d0e2b88a4d-6f9a3c1b8e2d4001-01"
// STATE (before):
//    spans  : []                                // spans opened so far for this request
//    header : { trace_id: "", span_id: "" }     // the outbound context, empty before GW fills it
// DEF: receive_request · CALLED BY: the client HTTP request arriving at GW
// -> request : "GET /orders/PO-2001"
//    step 1 · GW mints the ids    trace_id = 128 random bits -> 32 hex chars = "4bf92f3577b34da6a3ce90d0e2b88a4d" · span_id = 64 random bits -> 16 hex chars = "6f9a3c1b8e2d4001"
//    step 2 · GW opens the root span    spans : [] -> [("6f9a3c1b8e2d4001", parent="", name="GET /orders/PO-2001", start=100)]
//    step 3 · GW fills the header    header : { trace_id:"", span_id:"" } -> { trace_id:"4bf92f3577b34da6a3ce90d0e2b88a4d", span_id:"6f9a3c1b8e2d4001" }   // wire form "00-4bf9...-6f9a...-01"
//    step 4 · GW reports the span    span : open -> on BRK queue "zipkin" · ZIP collector consumes it and the storage stores it (start=100, end=104)
// <- outcome : SVC receives traceparent "00-4bf92f3577b34da6a3ce90d0e2b88a4d-6f9a3c1b8e2d4001-01" · ZIP storage holds the root span (GW keeps no registry)
//    alt B3 header : "X-B3-TraceId: 4bf92f3577b34da6a3ce90d0e2b88a4d" + "X-B3-SpanId: 6f9a3c1b8e2d4001" (same ids, different header names)`
    },
    {
      section: 'Propagating through services',
      color: 'orange',
      motivation: `The id is useless unless every service that handles the request receives it. Each hop opens a child span naming its parent, so one request becomes a chain of spans.`,
      steps: [
        { num: 1, title: 'Pass the id', detail: 'Pass the external request id to all services involved in handling the request.' },
        { num: 2, title: 'Child spans', detail: 'Each service opens a span whose parent is the span of the previous hop.' },
        { num: 3, title: 'One trace, many operations', detail: 'Each service performs one or more operations — database queries, message publishes — captured as spans.' }
      ],
      program: `// SERVICE SIDE — each service reads the inbound header, opens a child span of the previous hop, and forwards the updated header
// PARTIES: GW = API gateway process · ORD = Order Service process · KIT = Kitchen Service process · PAY = Payment Service process
// DEF: span — one unit of work {span_id, parent, name, start, end}; here ("6f9a3c1b8e2d4002", parent="6f9a3c1b8e2d4001", name="GET /orders/PO-2001", start=105, end=120)
// DEF: parent — a span's parent span_id (which hop invoked it); here "6f9a3c1b8e2d4001" for a child, "" for the root
// DEF: header — the in-memory carrier {trace_id, span_id} read from and written to the wire; here { trace_id:"4bf92f3577b34da6a3ce90d0e2b88a4d", span_id:"6f9a3c1b8e2d4001" }
// DEF: traceparent — the wire form "00-<trace_id>-<span_id>-01"; here "00-4bf92f3577b34da6a3ce90d0e2b88a4d-6f9a3c1b8e2d4001-01"
// STATE (before):
//    spans  : [("6f9a3c1b8e2d4001", parent="", name="GET /orders/PO-2001", start=100, end=104)]
//    header : { trace_id: "4bf92f3577b34da6a3ce90d0e2b88a4d", span_id: "6f9a3c1b8e2d4001" }   // what the inbound request carried
// DEF: handle_request · CALLED BY: the request moving GW -> ORD -> KIT -> PAY
// -> trace_id : "4bf92f3577b34da6a3ce90d0e2b88a4d"
//    step 1 · ORD reads the inbound header    parent : "" -> "6f9a3c1b8e2d4001"  (the span id of the hop that invoked it)
//    step 2 · ORD mints a child id    span_id = 64 random bits -> 16 hex chars = "6f9a3c1b8e2d4002"  (trace_id stays the SAME across all hops)
//    step 3 · ORD opens the child span    spans : [1 span] -> [1 span, ("6f9a3c1b8e2d4002", parent="6f9a3c1b8e2d4001", start=105, end=120)]
//    step 4 · ORD forwards the updated header    header : { span_id:"6f9a3c1b8e2d4001" } -> { span_id:"6f9a3c1b8e2d4002" }   // wire form "00-...-6f9a3c1b8e2d4002-01"
//    step 5 · KIT and PAY repeat steps 1-4    spans : [2 spans] -> [2 spans, ("6f9a3c1b8e2d4003", parent="6f9a3c1b8e2d4002", start=121, end=135)] -> [3 spans, ("6f9a3c1b8e2d4004", parent="6f9a3c1b8e2d4003", start=136, end=150)]
// <- outcome : 4 spans chained by parent ids, all carrying trace_id "4bf92f3577b34da6a3ce90d0e2b88a4d" · each hop's span reported to ZIP`
    },
    {
      section: 'Collecting spans in the trace store',
      color: 'orange',
      motivation: `Spans must be recorded in a centralized service so the whole request can be reconstructed. The reference example delivers traces to a Zipkin server via RabbitMQ, where Zipkin gathers and displays them.`,
      steps: [
        { num: 1, title: 'Record in a central service', detail: 'Record information about requests and operations — for example start time and end time — in a centralized service.' },
        { num: 2, title: 'Sleuth and Zipkin', detail: 'Spring Cloud Sleuth instruments components and delivers trace information to a Zipkin server.' },
        { num: 3, title: 'Deliver via RabbitMQ', detail: 'RabbitMQ is used to deliver traces to Zipkin; the Zipkin server is a Spring Boot app with @EnableZipkinStreamServer.' },
        { num: 4, title: 'Latency from times', detail: 'Start and end times per span let Zipkin derive per-operation latency.' }
      ],
      program: `// TRACE STORE SIDE — the system pipeline: writer (each instrumented service) -> transport (RabbitMQ) -> collector (Zipkin collector) -> aggregator (trace store = MySQL 8 @ zipkin-db-1) -> reader (Zipkin query UI + operator); latency = end - start
// PARTIES: GW = gateway process (writer) · ORD = Order Service process (writer) · BRK = RabbitMQ broker (async span transport: decouples writers from the collector, buffers under load) · ZIP = Zipkin distributed tracing system = collector (ingests spans from BRK) + storage — the trace store (MySQL 8 @ zipkin-db-1, the aggregator) + query UI (serves timelines to OP) · OP = operator (reader)
// DEF: trace — the set of all spans sharing one trace_id; here trace "4bf92f3577b34da6a3ce90d0e2b88a4d" = 4 spans
// DEF: span — one unit of work {span_id, parent, start, end}; here ("6f9a3c1b8e2d4001", parent="", start=100, end=104)
// DEF: latency — how long one span took = end - start; here 104 - 100 = 4
// DEF: writer — the instrumented service that finishes an operation and REPORTS its span; here GW reports ("6f9a3c1b8e2d4001", start=100, end=104), ORD/KIT/PAY report theirs
// DEF: collector — the Zipkin sub-service that CONSUMES spans off the RabbitMQ queue "zipkin" and writes them into the trace store; here it ingests 4 spans
// DEF: aggregator — the trace store itself (MySQL 8 @ zipkin-db-1) that gathers spans by trace_id; here {"4bf92f3577b34da6a3ce90d0e2b88a4d" : 4 spans}
// DEF: reader — the Zipkin query UI the operator uses to pull one trace back as a timeline; here OP asks for "4bf92f3577b34da6a3ce90d0e2b88a4d" and gets 4 spans
// DEF: timeline — the spans of one trace ordered by parent+start; here [GW@100-104, ORD@105-120, KIT@121-135, PAY@136-150]
// STATE (before):
//    trace_store : {}   // trace_id -> spans, kept by the aggregator (ZIP storage)
//    timeline    : []   // the ordered spans served back on a read
// DEF: collect_spans · CALLED BY: each writer finishing its operation
// -> trace_id : "4bf92f3577b34da6a3ce90d0e2b88a4d" · -> span1 : ("6f9a3c1b8e2d4001", parent="", start=100, end=104)
//    step 1 · writer GW reports span1 to BRK queue "zipkin"    span1 : ("6f9a3c1b8e2d4001", 100, 104) -> on the wire to BRK (transport hop 1)
//    step 2 · collector consumes span1 off BRK and writes it    trace_store : {} -> {"4bf92f3577b34da6a3ce90d0e2b88a4d" : [("6f9a3c1b8e2d4001", parent="", start=100, end=104)]}
//    step 3 · ORD span via BRK -> collector -> store    trace_store : {"4bf92f3577b34da6a3ce90d0e2b88a4d" : 1 span} -> {"4bf92f3577b34da6a3ce90d0e2b88a4d" : [("6f9a3c1b8e2d4001", start=100, end=104), ("6f9a3c1b8e2d4002", parent="6f9a3c1b8e2d4001", start=105, end=120)]}
//    step 4 · KIT span via BRK -> collector -> store    trace_store : {"4bf92f3577b34da6a3ce90d0e2b88a4d" : 2 spans} -> {"4bf92f3577b34da6a3ce90d0e2b88a4d" : [2 spans, ("6f9a3c1b8e2d4003", parent="6f9a3c1b8e2d4002", start=121, end=135)]}
//    step 5 · PAY span via BRK -> collector -> store    trace_store : {"4bf92f3577b34da6a3ce90d0e2b88a4d" : 3 spans} -> {"4bf92f3577b34da6a3ce90d0e2b88a4d" : [3 spans, ("6f9a3c1b8e2d4004", parent="6f9a3c1b8e2d4003", start=136, end=150)]}
//    step 6 · reader OP queries the ZIP query UI for the trace id    trace_store : {"4bf92f3577b34da6a3ce90d0e2b88a4d" : 4 spans} -> returns the 4 spans (read, nothing written)
//    step 7 · ZIP query UI orders them by parent+start    timeline : [] -> [GW@100-104, ORD@105-120, KIT@121-135, PAY@136-150]
// <- outcome : OP sees the timeline for trace "4bf92f3577b34da6a3ce90d0e2b88a4d" · slow hop = KIT (135 - 121 = 14 ms)   BECAUSE the writer's spans travel BRK -> collector -> store, and the reader pulls them back ordered by parent+start`
    },
    {
      section: 'Searching logs by request id',
      color: 'orange',
      motivation: `Because the request id is included in every log message, a developer can search aggregated logs for it and see how one request was handled — but aggregating and storing traces can require significant infrastructure.`,
      steps: [
        { num: 1, title: 'Include id in logs', detail: 'Include the external request id in all log messages, per the instrumentation.' },
        { num: 2, title: 'Search aggregated logs', detail: 'The benefit is searching across aggregated logs for the external request id to see how an individual request was handled.' },
        { num: 3, title: 'Find the slow hop', detail: 'Ordering the matched lines by time exposes the sources of latency.' },
        { num: 4, title: 'Infrastructure cost', detail: 'The issue is that aggregating and storing traces can require significant infrastructure.' }
      ],
      program: `// OPERATOR SIDE — the trace id is printed into every log line, so one search reassembles a request across machines
// PARTIES: OP = operator (reader) · LOGS = log-aggregation index (Elasticsearch 8 @ logs-es-1) · ZIP = Zipkin distributed tracing system (collector + storage + query UI)
// DEF: trace_id — the id printed in every log line of one request; here "4bf92f3577b34da6a3ce90d0e2b88a4d"
// DEF: match — one stored log line that satisfies the search; here 3 lines for one trace_id
// STATE (before):
//    log_index : []   // every stored log line, tagged with its trace id (kept by LOGS)
//    matches   : []   // what a search returns
// DEF: search · CALLED BY: OP debugging one slow request
// -> trace_id : "4bf92f3577b34da6a3ce90d0e2b88a4d"
//    step 1 · each service logs with the id inline   log_index : [] -> ["[4bf92f3577b34da6a3ce90d0e2b88a4d] ORD line", "[4bf92f3577b34da6a3ce90d0e2b88a4d] KIT line", "[4bf92f3577b34da6a3ce90d0e2b88a4d] PAY line"]
//    step 2 · OP queries the index for the id   matches : [] -> [ORD line, KIT line, PAY line]
//    step 3 · OP orders the 3 lines by timestamp   matches : [3 lines] -> [ORD@105, KIT@121, PAY@136]
// <- outcome : matches = 3 lines for one id · slow hop = KIT (135 - 121 = 14 ms)   BECAUSE the id links log lines on 3 different machines
//    alt infra cost : at scale N requests x M spans = N x M records -> needs real storage infrastructure`
    }
  ],
  interview: [
    {
      scenario: "External monitoring reports only overall response time and invocation counts, so a slow request looks fine in aggregate. The team instruments the gateway to label each external request before it enters the services.",
      q: "What is the first thing distributed tracing instrumentation does for each external request, and what is the id's relationship to the first span?",
      solution: "It assigns each external request a unique external request id, attaches it to the request, and opens the root span — the first span of the trace, with no parent.",
      components: ["API gateway", "trace_id", "root span", "Zipkin", "operator read-back"],
      diagram: "flowchart LR\n  C[\"Client\"] -->|\"GET /orders/PO-2001\"| G[\"API gateway\"]\n  G -->|\"mint trace_id 128 bits = 32 hex\"| T[\"trace_id 4bf92f3577b34da6a3ce90d0e2b88a4d\"]\n  G -->|\"open root span, parent empty\"| S[\"root span 6f9a3c1b8e2d4001\"]\n  G -->|\"fill header\"| H[\"traceparent 00-4bf92f3577b34da6a3ce90d0e2b88a4d-6f9a3c1b8e2d4001-01\"]\n  S -->|\"writer reports via RabbitMQ\"| Z[\"Zipkin: collector + store + query\"]\n  H --> Z\n  Z -->|\"operator queries trace_id\"| R[\"4 spans by parent+start\"]\n  R -->|\"timeline\"| O[\"operator: slow hop KIT 14 ms\"]",
      code: "// API GATEWAY SIDE — the gateway mints the ids, opens the root span, and hands the context to the first service\n// PARTIES: GW = API gateway (mints the ids) · SVC = first service process · BRK = RabbitMQ broker (async span transport to the collector) · ZIP = Zipkin distributed tracing system (collector + storage + query UI)\n// DEF: trace_id — 128 random bits encoded as 32 hex chars, one per external request; here \"4bf92f3577b34da6a3ce90d0e2b88a4d\"\n// DEF: span_id — 64 random bits encoded as 16 hex chars, one per operation; here \"6f9a3c1b8e2d4001\"\n// DEF: span — one unit of work {span_id, parent, name, start, end}; here (\"6f9a3c1b8e2d4001\", parent=\"\", name=\"GET /orders/PO-2001\", start=100, end=104)\n// DEF: header — the outbound key-value carrier {trace_id, span_id}; here { trace_id:\"4bf92f3577b34da6a3ce90d0e2b88a4d\", span_id:\"6f9a3c1b8e2d4001\" }\n// DEF: traceparent — the wire form of the header = \"00-<trace_id>-<span_id>-01\"; here \"00-4bf92f3577b34da6a3ce90d0e2b88a4d-6f9a3c1b8e2d4001-01\"\n// STATE (before):\n//    spans  : []                                // spans opened so far for this request\n//    header : { trace_id: \"\", span_id: \"\" }     // the outbound context, empty before GW fills it\n// DEF: receive_request · CALLED BY: the client HTTP request arriving at GW\n// -> request : \"GET /orders/PO-2001\"\n//    step 1 · GW mints the ids    trace_id = 128 random bits -> 32 hex chars = \"4bf92f3577b34da6a3ce90d0e2b88a4d\" · span_id = 64 random bits -> 16 hex chars = \"6f9a3c1b8e2d4001\"\n//    step 2 · GW opens the root span    spans : [] -> [(\"6f9a3c1b8e2d4001\", parent=\"\", name=\"GET /orders/PO-2001\", start=100)]\n//    step 3 · GW fills the header    header : { trace_id:\"\", span_id:\"\" } -> { trace_id:\"4bf92f3577b34da6a3ce90d0e2b88a4d\", span_id:\"6f9a3c1b8e2d4001\" }   // wire form \"00-4bf9...-6f9a...-01\"\n//    step 4 · GW reports the span    span : open -> on BRK queue \"zipkin\" · ZIP collector consumes it and the storage stores it (start=100, end=104)\n// <- outcome : SVC receives traceparent \"00-4bf92f3577b34da6a3ce90d0e2b88a4d-6f9a3c1b8e2d4001-01\" · ZIP storage holds the root span (GW keeps no registry)\n//    alt B3 header : \"X-B3-TraceId: 4bf92f3577b34da6a3ce90d0e2b88a4d\" + \"X-B3-SpanId: 6f9a3c1b8e2d4001\" (same ids, different header names)",
      tieback: "This is the chapter's assign-the-request-id step: a unique id plus the root span begin the trace.",
      refs: ["Assigning the request id"],
      problems: ["20-metrics-monitoring"]
    },
    {
      scenario: "One request travels GW to Order Service to Kitchen Service to Payment Service. Each hop must keep the trace intact so the whole journey can be reconstructed.",
      q: "How does the request id propagate through services, and how do the spans relate to one another?",
      solution: "Each service passes the id onward, and each hop opens a child span whose parent is the previous hop's span, chaining one request into a sequence of spans.",
      components: ["API gateway", "Order Service", "Kitchen Service", "Payment Service"],
      diagram: "flowchart LR\n  G[\"GW\"] -->|\"span 6f9a...001\"| O[\"Order Service\"]\n  O -->|\"child 6f9a...002\"| K[\"Kitchen Service\"]\n  K -->|\"child 6f9a...003\"| P[\"Payment Service\"]\n  P -->|\"child 6f9a...004\"| E[\"replies\"]",
      code: "// SERVICE SIDE — each service reads the inbound header, opens a child span of the previous hop, and forwards the updated header\n// PARTIES: GW = API gateway process · ORD = Order Service process · KIT = Kitchen Service process · PAY = Payment Service process\n// DEF: span — one unit of work {span_id, parent, name, start, end}; here (\"6f9a3c1b8e2d4002\", parent=\"6f9a3c1b8e2d4001\", name=\"GET /orders/PO-2001\", start=105, end=120)\n// DEF: parent — a span's parent span_id (which hop invoked it); here \"6f9a3c1b8e2d4001\" for a child, \"\" for the root\n// DEF: header — the in-memory carrier {trace_id, span_id} read from and written to the wire; here { trace_id:\"4bf92f3577b34da6a3ce90d0e2b88a4d\", span_id:\"6f9a3c1b8e2d4001\" }\n// DEF: traceparent — the wire form \"00-<trace_id>-<span_id>-01\"; here \"00-4bf92f3577b34da6a3ce90d0e2b88a4d-6f9a3c1b8e2d4001-01\"\n// STATE (before):\n//    spans  : [(\"6f9a3c1b8e2d4001\", parent=\"\", name=\"GET /orders/PO-2001\", start=100, end=104)]\n//    header : { trace_id: \"4bf92f3577b34da6a3ce90d0e2b88a4d\", span_id: \"6f9a3c1b8e2d4001\" }   // what the inbound request carried\n// DEF: handle_request · CALLED BY: the request moving GW -> ORD -> KIT -> PAY\n// -> trace_id : \"4bf92f3577b34da6a3ce90d0e2b88a4d\"\n//    step 1 · ORD reads the inbound header    parent : \"\" -> \"6f9a3c1b8e2d4001\"  (the span id of the hop that invoked it)\n//    step 2 · ORD mints a child id    span_id = 64 random bits -> 16 hex chars = \"6f9a3c1b8e2d4002\"  (trace_id stays the SAME across all hops)\n//    step 3 · ORD opens the child span    spans : [1 span] -> [1 span, (\"6f9a3c1b8e2d4002\", parent=\"6f9a3c1b8e2d4001\", start=105, end=120)]\n//    step 4 · ORD forwards the updated header    header : { span_id:\"6f9a3c1b8e2d4001\" } -> { span_id:\"6f9a3c1b8e2d4002\" }   // wire form \"00-...-6f9a3c1b8e2d4002-01\"\n//    step 5 · KIT and PAY repeat steps 1-4    spans : [2 spans] -> [2 spans, (\"6f9a3c1b8e2d4003\", parent=\"6f9a3c1b8e2d4002\", start=121, end=135)] -> [3 spans, (\"6f9a3c1b8e2d4004\", parent=\"6f9a3c1b8e2d4003\", start=136, end=150)]\n// <- outcome : 4 spans chained by parent ids, all carrying trace_id \"4bf92f3577b34da6a3ce90d0e2b88a4d\" · each hop's span reported to ZIP",
      tieback: "This is the chapter's propagate-through-services step: each hop opens a child span of the previous one, forming the trace chain.",
      refs: ["Propagating through services"],
      problems: ["20-metrics-monitoring"]
    },
    {
      scenario: "The four spans from GW, Order, Kitchen, and Payment must land in one place where the whole request can be reconstructed with per-operation timing.",
      q: "How are spans recorded centrally — walking the writer, collector, and aggregator — and how is per-operation latency derived?",
      solution: "The instrumented services are the writers: each reports its finished span to RabbitMQ, the async transport that decouples them from the backend and buffers under load. The Zipkin collector consumes those spans off the queue and writes them into the trace store (the aggregator, MySQL 8), where the query UI serves the operator a timeline. Zipkin derives each operation's latency as end minus start.",
      components: ["writers (instrumented GW/Order/Kitchen/Payment)", "RabbitMQ broker (transport)", "Zipkin collector", "trace store MySQL 8 (aggregator)", "Zipkin query UI (reader)"],
      diagram: "flowchart LR\n  W[\"Writers: GW, Order, Kitchen, Payment\"] -->|\"report spans\"| T[\"RabbitMQ transport\"]\n  T -->|\"collector consumes\"| C[\"Zipkin collector\"]\n  C -->|\"writes spans\"| A[\"trace store MySQL 8 aggregator\"]\n  A -->|\"query trace_id\"| Q[\"Zipkin query UI reader\"]\n  Q -->|\"timeline\"| O[\"operator: 4 spans ordered, slow hop KIT 14 ms\"]",
      code: "// TRACE STORE SIDE — the system pipeline: writer (each instrumented service) -> transport (RabbitMQ) -> collector (Zipkin collector) -> aggregator (trace store = MySQL 8 @ zipkin-db-1) -> reader (Zipkin query UI + operator); latency = end - start\n// PARTIES: GW = gateway process (writer) · ORD = Order Service process (writer) · BRK = RabbitMQ broker (async span transport: decouples writers from the collector, buffers under load) · ZIP = Zipkin distributed tracing system = collector (ingests spans from BRK) + storage — the trace store (MySQL 8 @ zipkin-db-1, the aggregator) + query UI (serves timelines to OP) · OP = operator (reader)\n// DEF: trace — the set of all spans sharing one trace_id; here trace \"4bf92f3577b34da6a3ce90d0e2b88a4d\" = 4 spans\n// DEF: span — one unit of work {span_id, parent, start, end}; here (\"6f9a3c1b8e2d4001\", parent=\"\", start=100, end=104)\n// DEF: latency — how long one span took = end - start; here 104 - 100 = 4\n// DEF: writer — the instrumented service that finishes an operation and REPORTS its span; here GW reports (\"6f9a3c1b8e2d4001\", start=100, end=104), ORD/KIT/PAY report theirs\n// DEF: collector — the Zipkin sub-service that CONSUMES spans off the RabbitMQ queue \"zipkin\" and writes them into the trace store; here it ingests 4 spans\n// DEF: aggregator — the trace store itself (MySQL 8 @ zipkin-db-1) that gathers spans by trace_id; here {\"4bf92f3577b34da6a3ce90d0e2b88a4d\" : 4 spans}\n// DEF: reader — the Zipkin query UI the operator uses to pull one trace back as a timeline; here OP asks for \"4bf92f3577b34da6a3ce90d0e2b88a4d\" and gets 4 spans\n// DEF: timeline — the spans of one trace ordered by parent+start; here [GW@100-104, ORD@105-120, KIT@121-135, PAY@136-150]\n// STATE (before):\n//    trace_store : {}   // trace_id -> spans, kept by the aggregator (ZIP storage)\n//    timeline    : []   // the ordered spans served back on a read\n// DEF: collect_spans · CALLED BY: each writer finishing its operation\n// -> trace_id : \"4bf92f3577b34da6a3ce90d0e2b88a4d\" · -> span1 : (\"6f9a3c1b8e2d4001\", parent=\"\", start=100, end=104)\n//    step 1 · writer GW reports span1 to BRK queue \"zipkin\"    span1 : (\"6f9a3c1b8e2d4001\", 100, 104) -> on the wire to BRK (transport hop 1)\n//    step 2 · collector consumes span1 off BRK and writes it    trace_store : {} -> {\"4bf92f3577b34da6a3ce90d0e2b88a4d\" : [(\"6f9a3c1b8e2d4001\", parent=\"\", start=100, end=104)]}\n//    step 3 · ORD span via BRK -> collector -> store    trace_store : {\"4bf92f3577b34da6a3ce90d0e2b88a4d\" : 1 span} -> {\"4bf92f3577b34da6a3ce90d0e2b88a4d\" : [(\"6f9a3c1b8e2d4001\", start=100, end=104), (\"6f9a3c1b8e2d4002\", parent=\"6f9a3c1b8e2d4001\", start=105, end=120)]}\n//    step 4 · KIT span via BRK -> collector -> store    trace_store : {\"4bf92f3577b34da6a3ce90d0e2b88a4d\" : 2 spans} -> {\"4bf92f3577b34da6a3ce90d0e2b88a4d\" : [2 spans, (\"6f9a3c1b8e2d4003\", parent=\"6f9a3c1b8e2d4002\", start=121, end=135)]}\n//    step 5 · PAY span via BRK -> collector -> store    trace_store : {\"4bf92f3577b34da6a3ce90d0e2b88a4d\" : 3 spans} -> {\"4bf92f3577b34da6a3ce90d0e2b88a4d\" : [3 spans, (\"6f9a3c1b8e2d4004\", parent=\"6f9a3c1b8e2d4003\", start=136, end=150)]}\n//    step 6 · reader OP queries the ZIP query UI for the trace id    trace_store : {\"4bf92f3577b34da6a3ce90d0e2b88a4d\" : 4 spans} -> returns the 4 spans (read, nothing written)\n//    step 7 · ZIP query UI orders them by parent+start    timeline : [] -> [GW@100-104, ORD@105-120, KIT@121-135, PAY@136-150]\n// <- outcome : OP sees the timeline for trace \"4bf92f3577b34da6a3ce90d0e2b88a4d\" · slow hop = KIT (135 - 121 = 14 ms)   BECAUSE the writer's spans travel BRK -> collector -> store, and the reader pulls them back ordered by parent+start",
      tieback: "This is the chapter's collect-spans-in-the-trace-store step: Zipkin gathers spans via RabbitMQ and derives per-operation latency.",
      refs: ["Collecting spans in the trace store"],
      problems: ["20-metrics-monitoring"]
    },
    {
      scenario: "An operator debugging one slow order needs to see every log line for it across three machines, ordered by time, to find the slow hop.",
      q: "What benefit does distributed tracing provide for debugging, and how does the request id enable it?",
      solution: "Because the request id is included in every log message, a developer can search aggregated logs for the id to see how one request was handled — ordering the matched lines by time exposes the sources of latency.",
      components: ["operator", "log-aggregation index", "trace_id", "ordered matches"],
      diagram: "flowchart LR\n  O[\"Operator\"] -->|\"search trace_id\"| I[\"log index\"]\n  I -->|\"3 lines\"| M[\"ORD@105, KIT@121, PAY@136\"]\n  M -->|\"order by time\"| S[\"slow hop: KIT 14 ms\"]",
      code: "// OPERATOR SIDE — the trace id is printed into every log line, so one search reassembles a request across machines\n// PARTIES: OP = operator (reader) · LOGS = log-aggregation index (Elasticsearch 8 @ logs-es-1) · ZIP = Zipkin distributed tracing system (collector + storage + query UI)\n// DEF: trace_id — the id printed in every log line of one request; here \"4bf92f3577b34da6a3ce90d0e2b88a4d\"\n// DEF: match — one stored log line that satisfies the search; here 3 lines for one trace_id\n// STATE (before):\n//    log_index : []   // every stored log line, tagged with its trace id (kept by LOGS)\n//    matches   : []   // what a search returns\n// DEF: search · CALLED BY: OP debugging one slow request\n// -> trace_id : \"4bf92f3577b34da6a3ce90d0e2b88a4d\"\n//    step 1 · each service logs with the id inline   log_index : [] -> [\"[4bf92f3577b34da6a3ce90d0e2b88a4d] ORD line\", \"[4bf92f3577b34da6a3ce90d0e2b88a4d] KIT line\", \"[4bf92f3577b34da6a3ce90d0e2b88a4d] PAY line\"]\n//    step 2 · OP queries the index for the id   matches : [] -> [ORD line, KIT line, PAY line]\n//    step 3 · OP orders the 3 lines by timestamp   matches : [3 lines] -> [ORD@105, KIT@121, PAY@136]\n// <- outcome : matches = 3 lines for one id · slow hop = KIT (135 - 121 = 14 ms)   BECAUSE the id links log lines on 3 different machines\n//    alt infra cost : at scale N requests x M spans = N x M records -> needs real storage infrastructure",
      tieback: "This is the chapter's search-logs-by-request-id benefit, paired with its infrastructure-cost issue.",
      refs: ["Searching logs by request id"],
      problems: ["20-metrics-monitoring"]
    }
  ],
  systemDesign: {
    question: 'Design request tracing across services. Premise: each service\'s Tracer emits spans through a Reporter and Sender over RabbitMQ to a Zipkin collector, so one request\'s path across services is reassembled.',
    pipeline: 'writer → transport → collector → aggregator/store → reader',
    decomposition: [
      {
        box: 'each service process (GW, Order, Kitchen, Payment) — the writer',
        role: 'writer',
        parts: [
          'Tracer — mints trace/span ids, propagates B3/W3C headers',
          'Reporter — batches finished spans',
          'Sender — transport adapter: HTTP / Kafka / RabbitMQ'
        ]
      },
      {
        box: 'RabbitMQ broker — the transport',
        role: 'transport',
        parts: [
          'queue "zipkin" — the span channel',
          'decouples writers from the collector, buffers under load'
        ]
      },
      {
        box: 'Zipkin server (one central process, NOT per-host) — collector + aggregator + reader',
        role: 'collector + aggregator/store + reader',
        parts: [
          'Collector — ingests spans (HTTP POST /api/v2/spans, or Kafka/RabbitMQ)',
          'Storage — MySQL 8 @ zipkin-db-1, Cassandra, or Elasticsearch (the trace store)',
          'Query API — REST: fetch a trace by id',
          'UI — Zipkin Lens (the timeline browser)'
        ]
      },
      {
        box: 'operator — the reader',
        role: 'reader',
        parts: [
          'queries a trace id',
          'reads the timeline, finds the slow hop'
        ]
      }
    ],
    wiring: "flowchart LR\n  subgraph APP[\"writer: each service process\"]\n    TR[\"Tracer — mints ids, propagates headers\"] --> RP[\"Reporter — batches spans\"] --> SD[\"Sender — HTTP/Kafka/RabbitMQ\"]\n  end\n  SD -->|\"publish span\"| BRK[\"transport: RabbitMQ (queue zipkin)\"]\n  BRK -->|\"consume\"| CL[\"collector: Zipkin collector\"]\n  CL -->|\"write\"| ST[(\"aggregator: trace store MySQL 8 @ zipkin-db-1\")]\n  ST -->|\"query trace_id\"| QU[\"reader: Zipkin query UI (Lens)\"]\n  QU -->|\"timeline\"| OP[\"operator\"]",
    program: `// SYSTEM DESIGN — tracing as a pipeline: writer (in-process Tracer -> Reporter -> Sender) -> transport (RabbitMQ) -> collector (Zipkin collector) -> aggregator (trace store MySQL 8 @ zipkin-db-1) -> reader (Zipkin query UI + operator)
// PARTIES: APP = each service process (writer; internals Tracer -> Reporter -> Sender) · BRK = RabbitMQ broker (transport: queue "zipkin") · ZIP = Zipkin server (collector + storage + query UI) · OP = operator (reader)
// DEF: tracer — (in-process, inside APP) mints the trace_id/span ids and propagates B3/W3C headers; here mints trace_id "4bf92f3577b34da6a3ce90d0e2b88a4d"
// DEF: reporter — (in-process, inside APP) batches finished spans; here batches span ("6f9a3c1b8e2d4001", parent="", start=100, end=104)
// DEF: sender — (in-process, inside APP) the transport adapter (HTTP / Kafka / RabbitMQ); here the RabbitMQ sender publishes to queue "zipkin"
// DEF: queue — the RabbitMQ channel "zipkin" that carries spans from the senders to the collector; here it carries 4 spans
// DEF: trace — the set of all spans sharing one trace_id; here trace "4bf92f3577b34da6a3ce90d0e2b88a4d" = 4 spans
// DEF: collector — (inside ZIP) ingests spans off BRK (HTTP POST /api/v2/spans or the queue consumer); here consumes 4 spans
// DEF: aggregator — (inside ZIP) the trace store = MySQL 8 @ zipkin-db-1 gathering spans by trace_id; here {"4bf92f3577b34da6a3ce90d0e2b88a4d" : 4 spans}
// DEF: reader — (inside ZIP) Query API GET /api/v2/traces/<traceId> + Lens UI serving OP; here returns 4 spans as a timeline
// STATE (before):
//    zipkin_queue : []   // BRK queue "zipkin" (transport)
//    trace_store  : {}   // inside ZIP storage (aggregator)
// DEF: trace_one_request · CALLED BY: one external request finishing across GW -> ORD -> KIT -> PAY
// -> trace_id : "4bf92f3577b34da6a3ce90d0e2b88a4d"
//    step 1 · GW tracer mints the ids    trace_id = 128 random bits -> 32 hex chars = "4bf92f3577b34da6a3ce90d0e2b88a4d"
//    step 2 · GW reporter batches the finished span    span : ("6f9a3c1b8e2d4001", parent="", start=100, end=104) -> queued
//    step 3 · GW sender publishes to BRK    zipkin_queue : [] -> [span 6f9a3c1b8e2d4001]
//    step 4 · ZIP collector consumes and writes    trace_store : {} -> {"4bf92f3577b34da6a3ce90d0e2b88a4d" : [span 6f9a3c1b8e2d4001]}
//    step 5 · ORD/KIT/PAY repeat steps 1-4    trace_store : {1 span} -> {4 spans: 6f9a3c1b8e2d4001..04}   BECAUSE each of the 4 services is its own writer with its own Tracer -> Reporter -> Sender
//    step 6 · OP queries ZIP Query API    GET /api/v2/traces/4bf92f3577b34da6a3ce90d0e2b88a4d -> the 4 spans (read, nothing written)
//    step 7 · ZIP Lens UI orders by parent+start    timeline : [] -> [GW@100-104, ORD@105-120, KIT@121-135, PAY@136-150]
// <- outcome : OP sees the timeline · slow hop = KIT (135 - 121 = 14 ms)   BECAUSE each writer's in-process Tracer -> Reporter -> Sender ships spans over BRK (transport) to ZIP's collector -> storage (aggregator), and ZIP's query UI serves them back (reader)`
  },
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Totals hide operations', content: '<p><strong>Why.</strong> A request spans multiple services, each performing one or more operations such as database queries or publishing messages.</p><p><strong>Claim.</strong> External monitoring only reports overall response time and number of invocations, with no insight into individual operations, and log entries for a request are scattered across numerous logs.</p><p><strong>Grounding.</strong> These are the reference forces, along with minimal runtime overhead.</p><p><strong>In the wild.</strong> A slow request looks fine in aggregate until its individual operations are traced.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Assign, pass, include, record', content: '<p><strong>Why.</strong> An unlabeled request cannot be reassembled across services.</p><p><strong>Claim.</strong> Instrument services to assign each external request a unique id, pass it to all involved services, include it in all log messages, and record operation start and end times in a centralized service.</p><p><strong>Grounding.</strong> These are the four instrumentation steps from the reference; the instrumentation might be part of a Microservice Chassis.</p><p><strong>In the wild.</strong> Spring Cloud Sleuth instruments Spring components and delivers traces to a Zipkin server.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Writer → Collector → Aggregator → Reader', content: '<p><strong>Why.</strong> A span is useless unless the whole system path is connected: who produces it, how it travels, where it concentrates, and who reads it back.</p><p><strong>Claim.</strong> The tracing pipeline has four system roles wired in order — the writer (each instrumented service reports its finished span), the transport (RabbitMQ decouples writers from the backend and buffers under load), the collector (the Zipkin collector consumes spans off the queue), and the aggregator (the trace store, MySQL 8) — with the reader (Zipkin query UI) serving the operator a timeline.</p><p><strong>Grounding.</strong> This is the system-design wiring behind the reference\'s "deliver traces to Zipkin via RabbitMQ": Zipkin is a distributed tracing system made of a collector, storage, and a query UI, and RabbitMQ is the async transport in front of it, not part of Zipkin.</p><p><strong>In the wild.</strong> The same writer → transport → collector → aggregator → reader shape reappears in log shipping and metrics pipelines, so it is the interview\'s system-design anchor.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Trace storage infrastructure', content: '<p><strong>Why.</strong> Every span and trace has to be stored and indexed somewhere.</p><p><strong>Claim.</strong> Aggregating and storing traces can require significant infrastructure.</p><p><strong>Grounding.</strong> The reference lists this as the pattern\'s issue.</p><p><strong>In the wild.</strong> A Zipkin server plus RabbitMQ delivery is extra operational surface for the visibility gained.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Sampling vs overhead', content: '<p><strong>Why.</strong> Instrumenting every request costs runtime overhead and storage.</p><p><strong>Claim.</strong> The solution must have minimal runtime overhead, so tracing samples requests — and sampling less trades completeness for less overhead.</p><p><strong>Grounding.</strong> The reference force demands minimal overhead, and the example sets SPRING_SLEUTH_SAMPLER_PERCENTAGE: 1 to sample all requests.</p><p><strong>In the wild.</strong> Sampling every request gives full traces; sampling a fraction is cheaper but can miss a slow request.</p>' }
    ]
  },
  quiz: [
    { "question": "What does distributed tracing instrumentation do first for each external request?", "options": ["A. Assigns a unique external request id.", "B. Stores the request body.", "C. Aggregates the request into a metric.", "D. Blocks the request for sampling."], "answer": 1, "explanation": "The first solution step is to assign each external request a unique external request id. Option C is application metrics, and B and D are not in the reference.", "conceptRef": "Assign, pass, include, record" },
    { "question": "Why is external monitoring insufficient for troubleshooting?", "options": ["A. It only reports overall response time and invocation counts, with no insight into individual operations.", "B. It costs too much.", "C. It requires a database.", "D. It cannot measure latency."], "answer": 1, "explanation": "The reference force states external monitoring tells you only overall response time and number of invocations, with no insight into individual operations. Options B, C, and D are not the stated force.", "conceptRef": "Totals hide operations" },
    { "question": "Which benefit does distributed tracing provide?", "options": ["A. It shows how an individual request is handled by searching aggregated logs for its external request id.", "B. It removes the need for services.", "C. It guarantees low latency.", "D. It replaces metrics."], "answer": 1, "explanation": "The reference benefit is that developers can see how an individual request is handled by searching across aggregated logs for its external request id. The other options are not stated benefits.", "conceptRef": "Assign, pass, include, record" },
    { "question": "What is an issue of distributed tracing?", "options": ["A. It only works in Java.", "B. Aggregating and storing traces can require significant infrastructure.", "C. It cannot use a message broker.", "D. It makes logs smaller."], "answer": 2, "explanation": "The reference issue is that aggregating and storing traces can require significant infrastructure. Option C is false (RabbitMQ delivers traces to Zipkin), and A and D are not in the reference.", "conceptRef": "Trace storage infrastructure" }
  ]
});
