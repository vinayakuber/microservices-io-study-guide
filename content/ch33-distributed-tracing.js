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
      program: `// API GATEWAY SIDE — each external request is assigned a unique id before entering the services
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
// <- outcome : the request carries trace_id "4bf92f3577b34da6a3ce90d0e2b88a4d" into SVC · root span "6f9a3c1b8e2d4001" opened`
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
      program: `// SERVICE SIDE — one request traverses 3 services, each opening a child span of the previous hop
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
// <- outcome : 4 spans chained by parent/child span ids, all carrying trace_id "4bf92f3577b34da6a3ce90d0e2b88a4d"`
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
      program: `// TRACE STORE SIDE — the spans from all 4 hops land in one centralized trace server (Zipkin)
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
// <- outcome : trace_store : 4 spans for trace "4bf92f3577b34da6a3ce90d0e2b88a4d" · ZIP derives latency = end - start: 104-100=4, 120-105=15, 135-121=14, 150-136=14`
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
      program: `// OPERATOR SIDE — the request id links a request's scattered log lines so one search reassembles it
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
//    alt infra cost : at scale N requests x M spans = N x M records -> needs real storage infrastructure`
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Totals hide operations', content: '<p><strong>Why.</strong> A request spans multiple services, each performing one or more operations such as database queries or publishing messages.</p><p><strong>Claim.</strong> External monitoring only reports overall response time and number of invocations, with no insight into individual operations, and log entries for a request are scattered across numerous logs.</p><p><strong>Grounding.</strong> These are the reference forces, along with minimal runtime overhead.</p><p><strong>In the wild.</strong> A slow request looks fine in aggregate until its individual operations are traced.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Assign, pass, include, record', content: '<p><strong>Why.</strong> An unlabeled request cannot be reassembled across services.</p><p><strong>Claim.</strong> Instrument services to assign each external request a unique id, pass it to all involved services, include it in all log messages, and record operation start and end times in a centralized service.</p><p><strong>Grounding.</strong> These are the four instrumentation steps from the reference; the instrumentation might be part of a Microservice Chassis.</p><p><strong>In the wild.</strong> Spring Cloud Sleuth instruments Spring components and delivers traces to a Zipkin server.</p>' },
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
