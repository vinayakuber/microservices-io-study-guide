registerChapter({
  id: 'ch31',
  num: 31,
  title: 'Application Metrics',
  pattern: 'Instrument a service to gather statistics about its operations and aggregate them in a centralized metrics service for reporting and alerting.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 31 (p.373) · microservices.io /patterns/observability/application-metrics.html',
  part: 8,
  flow: [
    {
      section: 'Instrumenting an operation',
      color: 'orange',
      motivation: `The pattern's answer to "how do we understand application behavior and troubleshoot problems?" is to instrument a service to gather statistics about individual operations. A counter increments on each completed operation with minimal runtime overhead.`,
      steps: [
        { num: 1, title: 'Gather statistics', detail: 'Instrument the service to collect statistics about individual operations.' },
        { num: 2, title: 'Count completions', detail: 'A counter increments each time an operation such as create_order completes.' },
        { num: 3, title: 'Minimal overhead', detail: 'The force is that any solution must have minimal runtime overhead — an in-memory counter add is cheap.' }
      ],
      program: `// ORDER SERVICE SIDE — a counter gathers statistics about one operation, with minimal overhead
// PARTIES: SVC = Order Service · MS = metrics service (Prometheus)
// STATE (before):
//    counters : { orders_created: 0 }
// DEF: create_order · CALLED BY: client requests arriving at SVC
// -> request1 : "PO-2001"
//    step 1 · handle request1, increment the counter    counters.orders_created : 0 -> 1   BECAUSE one create_order completed
// -> request2 : "PO-2002"
//    step 2 · handle request2, increment                counters.orders_created : 1 -> 2
// -> request3 : "PO-2003"
//    step 3 · handle request3, increment                counters.orders_created : 2 -> 3
// <- outcome : counters : { orders_created: 3 } · the increment is one in-memory add per call, not a per-request network hop`
    },
    {
      section: 'Aggregating: push and pull',
      color: 'orange',
      motivation: `Individual counters are useful only when aggregated in a centralized metrics service that provides reporting and alerting. The reference describes two aggregation models: push and pull.`,
      steps: [
        { num: 1, title: 'Central metrics service', detail: 'Aggregate metrics in a centralized metrics service that provides reporting and alerting.' },
        { num: 2, title: 'Push model', detail: 'The service pushes metrics to the metrics service.' },
        { num: 3, title: 'Pull model', detail: 'The metrics service pulls (scrapes) metrics from the service.' },
        { num: 4, title: 'Aggregation services', detail: 'Prometheus and AWS CloudWatch are the listed metrics aggregation services.' }
      ],
      program: `// AGGREGATION SIDE — the central metrics service receives two values via push or via pull
// PARTIES: SVC = Order Service · MS = metrics service
// STATE (before):
//    MS.view : { orders_created: 0, request_ms_sum: 0 }
// DEF: aggregate · CALLED BY: MS reporting and alerting on the values
// -> counter : 3 · -> sum : 123                // = 3 create_order calls, 3 x 41 ms = 123 ms
//    step 1 (push) · SVC POSTs {"orders_created":3} to MS      MS.view.orders_created : 0 -> 3
//    step 2 (push) · SVC POSTs {"request_ms_sum":123} to MS    MS.view.request_ms_sum : 0 -> 123
//    step 3 (push) · MS now has both values to report and alert on
// <- outcome : MS.view : { orders_created: 3, request_ms_sum: 123 } · push = the service pushes metrics to the metrics service
//    alt pull : MS GETs /metrics -> body "orders_created 3 request_ms_sum 123" -> MS.view : {0,0} -> {3,123}   BECAUSE the metrics service pulls the metric from the service`
    },
    {
      section: 'What it costs',
      color: 'orange',
      motivation: `Metrics give deep insight, but they are not free: the metric code is intertwined with business logic, making it more complicated, and aggregating metrics can require significant infrastructure.`,
      steps: [
        { num: 1, title: 'Deep insight', detail: 'The benefit is deep insight into application behavior.' },
        { num: 2, title: 'Intertwined code', detail: 'The drawback is that metrics code is intertwined with business logic, making it more complicated.' },
        { num: 3, title: 'A histogram inline', detail: 'A histogram observes each request duration from inside the business method.' },
        { num: 4, title: 'Infrastructure', detail: 'Aggregating metrics can require significant infrastructure.' }
      ],
      program: `// ORDER SERVICE SIDE — the histogram increment sits inline in business logic, tangling the code
// PARTIES: SVC = Order Service
// STATE (before):
//    hist : { request_ms: [] }
// DEF: create_order · CALLED BY: three client requests
// -> request1 : "PO-2004" · started_at : 100 · ended_at : 141
//    step 1 · save order, then observe : hist.request_ms : [] -> [41]          BECAUSE 141 - 100 = 41 ms
// -> request2 : "PO-2005" · started_at : 200 · ended_at : 237
//    step 2 · save order, then observe : hist.request_ms : [41] -> [41,37]     BECAUSE 237 - 200 = 37 ms
// -> request3 : "PO-2006" · started_at : 300 · ended_at : 348
//    step 3 · save order, then observe : hist.request_ms : [41,37] -> [41,37,48]   BECAUSE 348 - 300 = 48 ms
// <- outcome : hist : { request_ms: [41,37,48] } · three observe() calls are woven between the save() calls`
    }
  ],
  interview: [
    {
      scenario: "The team cannot tell how many orders are being created, because the service is a black box beyond its request totals. They instrument create_order with a counter.",
      q: "What is the Application Metrics solution, and why must the instrumentation have minimal runtime overhead?",
      solution: "Instrument the service to gather statistics about individual operations — a counter increments on each completed operation — and the increment must be cheap because the force is minimal runtime overhead.",
      components: ["Order Service", "counter (orders_created)", "metrics service", "create_order operation"],
      diagram: "flowchart LR\n  C[\"Client\"] -->|\"POST orders\"| S[\"Order Service\"]\n  S -->|\"increment\"| N[\"counter: orders_created\"]\n  N -->|\"0 -> 3\"| M[\"central metrics service\"]",
      code: "// ORDER SERVICE SIDE — a counter gathers statistics about one operation, with minimal overhead\n// PARTIES: SVC = Order Service · MS = metrics service (Prometheus)\n// STATE (before):\n//    counters : { orders_created: 0 }\n// DEF: create_order · CALLED BY: client requests arriving at SVC\n// -> request1 : \"PO-2001\"\n//    step 1 · handle request1, increment the counter    counters.orders_created : 0 -> 1   BECAUSE one create_order completed\n// -> request2 : \"PO-2002\"\n//    step 2 · handle request2, increment                counters.orders_created : 1 -> 2\n// -> request3 : \"PO-2003\"\n//    step 3 · handle request3, increment                counters.orders_created : 2 -> 3\n// <- outcome : counters : { orders_created: 3 } · the increment is one in-memory add per call, not a per-request network hop",
      tieback: "This is the chapter's instrument-an-operation step: a counter gathers per-operation statistics at minimal overhead.",
      refs: ["Instrumenting an operation"],
      problems: ["20-metrics-monitoring"]
    },
    {
      scenario: "The counters on each service are only useful once collected somewhere central. The team is choosing between having the service push or the metrics service pull.",
      q: "Which two aggregation models does the pattern describe, and what lands in the central service?",
      solution: "Push — the service pushes metrics to the metrics service — and pull — the metrics service pulls (scrapes) metrics from the service. Either way the central service holds the values for reporting and alerting.",
      components: ["Order Service", "central metrics service", "push model", "pull model"],
      diagram: "flowchart LR\n  S[\"Order Service\"] -->|\"push: POST metrics\"| M[\"metrics service\"]\n  M -->|\"pull: GET /metrics\"| S\n  M -->|\"reports + alerts\"| R[\"dashboards\"]",
      code: "// AGGREGATION SIDE — the central metrics service receives two values via push or via pull\n// PARTIES: SVC = Order Service · MS = metrics service\n// STATE (before):\n//    MS.view : { orders_created: 0, request_ms_sum: 0 }\n// DEF: aggregate · CALLED BY: MS reporting and alerting on the values\n// -> counter : 3 · -> sum : 123                // = 3 create_order calls, 3 x 41 ms = 123 ms\n//    step 1 (push) · SVC POSTs {\"orders_created\":3} to MS      MS.view.orders_created : 0 -> 3\n//    step 2 (push) · SVC POSTs {\"request_ms_sum\":123} to MS    MS.view.request_ms_sum : 0 -> 123\n//    step 3 (push) · MS now has both values to report and alert on\n// <- outcome : MS.view : { orders_created: 3, request_ms_sum: 123 } · push = the service pushes metrics to the metrics service\n//    alt pull : MS GETs /metrics -> body \"orders_created 3 request_ms_sum 123\" -> MS.view : {0,0} -> {3,123}   BECAUSE the metrics service pulls the metric from the service",
      tieback: "This is the chapter's push-and-pull aggregation step: the central service turns per-service counters into reporting and alerting.",
      refs: ["Aggregating: push and pull"],
      problems: ["20-metrics-monitoring"]
    },
    {
      scenario: "A code review finds observe() calls for the request-duration histogram woven between the save() calls inside the business method, making the flow hard to read.",
      q: "What does it cost to instrument with metrics, beyond the runtime overhead?",
      solution: "The drawback is that metrics code is intertwined with business logic, making the business logic more complicated — the histogram increment sits inline in the business method.",
      components: ["Order Service", "histogram (request_ms)", "observe() calls", "save() calls"],
      diagram: "flowchart LR\n  B[\"create_order method\"] -->|\"save()\"| S[\"business logic\"]\n  B -->|\"observe()\"| H[\"histogram\"]\n  H -.->|\"intertwined with\"| S",
      code: "// ORDER SERVICE SIDE — the histogram increment sits inline in business logic, tangling the code\n// PARTIES: SVC = Order Service\n// STATE (before):\n//    hist : { request_ms: [] }\n// DEF: create_order · CALLED BY: three client requests\n// -> request1 : \"PO-2004\" · started_at : 100 · ended_at : 141\n//    step 1 · save order, then observe : hist.request_ms : [] -> [41]          BECAUSE 141 - 100 = 41 ms\n// -> request2 : \"PO-2005\" · started_at : 200 · ended_at : 237\n//    step 2 · save order, then observe : hist.request_ms : [41] -> [41,37]     BECAUSE 237 - 200 = 37 ms\n// -> request3 : \"PO-2006\" · started_at : 300 · ended_at : 348\n//    step 3 · save order, then observe : hist.request_ms : [41,37] -> [41,37,48]   BECAUSE 348 - 300 = 48 ms\n// <- outcome : hist : { request_ms: [41,37,48] } · three observe() calls are woven between the save() calls",
      tieback: "This is the chapter's intertwined-code drawback: observe() and save() sit side by side, complicating the business logic.",
      refs: ["What it costs"],
      problems: ["20-metrics-monitoring"]
    },
    {
      scenario: "The metrics service must hold many series and run somewhere, and the team wants to know what that costs before committing to Prometheus.",
      q: "What infrastructure does aggregating metrics require, and how does it trade against the per-request overhead?",
      solution: "Aggregating metrics can require significant infrastructure — running a central metrics service such as Prometheus or AWS CloudWatch — even though the per-request overhead stays low.",
      components: ["central metrics service", "Prometheus / AWS CloudWatch", "many time series"],
      diagram: "flowchart LR\n  S[\"Services\"] -->|\"push/pull\"| M[\"central metrics service\"]\n  M -->|\"holds\"| T[\"many series\"]\n  M -->|\"adds ops cost\"| C[\"infrastructure\"]\n  S -.->|\"per-request stays cheap\"| X[\"in-memory add\"]",
      code: "// METRICS SERVICE SIDE — the central service holds many series, so aggregation costs real infrastructure\n// PARTIES: SVC = Order Service · MS = metrics service (Prometheus)\n// STATE (before):\n//    series : {}                              // time series MS holds, keyed by metric name\n//    series_count : 0\n//    per_request_cost : \"in-memory add\"       // what each increment costs in the service\n// DEF: scrape · CALLED BY: MS pulling metrics from SVC on an interval\n// -> interval_seconds : 15\n//    step 1 · MS scrapes /metrics    series : {} -> {\"orders_created\":3,\"request_ms\":[41,37,48]}\n//    step 2 · MS counts the series it now stores    series_count : 0 -> 2  BECAUSE orders_created and request_ms each become a stored series\n//    step 3 · the per-request cost stays cheap    per_request_cost : \"in-memory add\" -> \"in-memory add\"  BECAUSE the overhead is in the service's counter, not the scrape\n// <- series_count : 2 · the central service runs as extra infrastructure, while each request still costs one in-memory add\n//    alt no central service : counters stay on individual services -> no dashboard, no alerting, and each service's numbers die with its process",
      tieback: "This is the chapter's aggregation-infrastructure issue: the central metrics service is operational cost, even though per-request overhead is minimal.",
      refs: ["Aggregating: push and pull", "What it costs"],
      problems: ["20-metrics-monitoring"]
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Understanding behavior', content: '<p><strong>Why.</strong> In a microservice architecture it is hard to understand what an application is doing or troubleshoot problems.</p><p><strong>Claim.</strong> The problem is: how to understand the behavior of an application and troubleshoot problems.</p><p><strong>Grounding.</strong> The reference states the applied context is the Microservice architecture pattern, and the force is that any solution must have minimal runtime overhead.</p><p><strong>In the wild.</strong> Without instrumentation, services are a black box beyond their request totals.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Instrument and aggregate', content: '<p><strong>Why.</strong> Individual operations are invisible unless measured.</p><p><strong>Claim.</strong> Instrument a service to gather statistics about individual operations and aggregate them in a centralized metrics service that provides reporting and alerting.</p><p><strong>Grounding.</strong> Two aggregation models: push (the service pushes metrics to the metrics service) and pull (the metrics service pulls metrics from the service). Libraries: Coda Hale/Yammer Java Metrics Library and Prometheus client libraries; services: Prometheus and AWS CloudWatch.</p><p><strong>In the wild.</strong> A counter and a histogram feed the central service, which turns them into dashboards and alerts.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Intertwined code', content: '<p><strong>Why.</strong> Instrumentation is written inside the methods it measures.</p><p><strong>Claim.</strong> Metrics code is intertwined with business logic, making the business logic more complicated.</p><p><strong>Grounding.</strong> The reference lists this as the pattern\'s drawback.</p><p><strong>In the wild.</strong> observe() and save() calls sit side by side, so reading the business flow means reading past metric lines.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Aggregation infrastructure', content: '<p><strong>Why.</strong> A centralized metrics service has to run somewhere and hold many series.</p><p><strong>Claim.</strong> Aggregating metrics can require significant infrastructure.</p><p><strong>Grounding.</strong> The reference lists this as one of the pattern\'s issues.</p><p><strong>In the wild.</strong> Running Prometheus or AWS CloudWatch adds operational cost even though per-request overhead stays low.</p>' }
    ]
  },
  quiz: [
    { "question": "What is the solution of the Application metrics pattern?", "options": ["A. Instrument a service to gather statistics about individual operations and aggregate them in a centralized metrics service.", "B. Store every request as a database row.", "C. Attach a unique id to each request.", "D. Wrap services in a chassis framework."], "answer": 1, "explanation": "The reference solution is to instrument a service to gather statistics about individual operations and aggregate them centrally for reporting and alerting. Option B is audit logging, C is distributed tracing, and D is the microservice chassis — all different patterns.", "conceptRef": "Instrument and aggregate" },
    { "question": "Which two aggregation models does the pattern describe?", "options": ["A. push and pull.", "B. push and poll.", "C. sync and async.", "D. batch and stream."], "answer": 1, "explanation": "The reference names exactly two models: push (the service pushes metrics to the metrics service) and pull (the metrics service pulls metrics from the service). The other pairs are not in the reference.", "conceptRef": "Instrument and aggregate" },
    { "question": "What is a drawback of application metrics?", "options": ["A. It has high runtime overhead.", "B. Metrics code is intertwined with business logic, making it more complicated.", "C. It cannot alert.", "D. It removes all insight."], "answer": 2, "explanation": "The reference drawback is that metrics code is intertwined with business logic. Option A contradicts the minimal-overhead force, and C and D are false — reporting and alerting are the point of the pattern.", "conceptRef": "Intertwined code" },
    { "question": "Which of these is listed as an instrumentation library or aggregation service?", "options": ["A. Prometheus client libraries / Prometheus.", "B. Spring Cloud Sleuth.", "C. Zipkin.", "D. RabbitMQ."], "answer": 1, "explanation": "The reference lists Coda Hale/Yammer Java Metrics Library and Prometheus client libraries as instrumentation libraries, and Prometheus and AWS CloudWatch as aggregation services. Options B, C, and D belong to distributed tracing, not metrics.", "conceptRef": "Instrument and aggregate" }
  ]
});
