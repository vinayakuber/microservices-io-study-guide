registerChapter({
  id: 'ch40',
  num: 40,
  title: 'Service Mesh',
  pattern: 'Use a service mesh that mediates all communication in and out of each service to handle cross-cutting concerns.',
  aka: 'Chris Richardson · Microservice Patterns p.380 · microservices.io /patterns/deployment/service-mesh.html',
  part: 9,
  flow: [
    {
      section: 'Mediate all traffic through the mesh',
      color: 'orange',
      motivation: `Every service has cross-cutting concerns to implement, and repeating them in each service is error-prone. A mesh that mediates all communication in and out moves those concerns out of the service code.`,
      steps: [
        { num: 1, title: 'Sit between the service and the network', detail: 'The mesh mediates every call in and out of each service.' },
        { num: 2, title: 'Intercept the outbound call', detail: 'A proxy attached to the service sees each request before it leaves.' },
        { num: 3, title: 'Apply the concern at the proxy', detail: 'Cross-cutting behavior is applied on the traffic, not inside the service.' }
      ],
      program: `// MESH SIDE — a proxy intercepts every call out of a service, mediating all communication
// PARTIES: SVC = Order Service · PROXY = its sidecar proxy · DB = PostgreSQL 16 @ orders-db-1
// STATE (before):
//    request : {}                       // the outbound call, not yet intercepted
//    trace_id : null                    // no distributed-tracing id yet
// DEF: intercept outbound call 1 to DB · CALLED BY: SVC sending a query
// -> call : "SELECT * FROM orders" · -> target : "db:5432"
//    step 1 · intercept · request : {} -> {"call":"SELECT * FROM orders","to":"db:5432"}  BECAUSE the mesh mediates ALL traffic in and out
//    step 2 · trace · trace_id : null -> "trc-9f2a"                                        // the proxy assigns a unique id to the request
//    step 3 · forward · sent : 0 -> 1                                                      // the proxy forwards the traced call to the DB
// <- call : "SELECT * FROM orders" delivered to db:5432 · trace_id "trc-9f2a" attached
//    alt inbound reply : reply : 0 -> 1   BECAUSE the same proxy also mediates the response back into SVC`
    },
    {
      section: 'Distributed tracing across services',
      color: 'orange',
      motivation: `When one external request fans out across services, you need to reconstruct the whole chain. The mesh instruments services with a unique identifier that is passed between them.`,
      steps: [
        { num: 1, title: 'Assign a unique id', detail: 'The proxy gives each external request a unique identifier.' },
        { num: 2, title: 'Pass the id between services', detail: 'The same id travels with the request from one service to the next.' },
        { num: 3, title: 'Record a span per hop', detail: 'Each service hop records a span against the shared id so the chain is reconstructable.' }
      ],
      program: `// MESH SIDE — one unique id travels with the request across services so a call chain can be traced
// PARTIES: U1 = a user request · PROXY = sidecar of Order Service · SVCB = Customer Service
// DEF: trace — the whole chain of spans that share one trace_id for a single request; here trace_id "trc-9f2a" = the order-service -> customer-service chain
// STATE (before):
//    trace_id : "trc-9f2a"              // id assigned at the first proxy
//    hops : []                          // services the request has passed through
// DEF: propagate id trc-9f2a to next hop · CALLED BY: Order Service calling Customer Service
// -> next : "customer-service"
//    step 1 · carry · hops : [] -> ["order-service"]   BECAUSE the proxy passes the SAME unique id between services
//    step 2 · forward · hops : ["order-service"] -> ["order-service","customer-service"]  // the id rides to the next service
//    step 3 · record · spans : 0 -> 1                    // each hop records a span against the shared id
// <- trace_id : "trc-9f2a"  · spans : 1  · the whole chain is reconstructable from one id
//    alt untraced call : trace_id : "trc-9f2a" -> null   BECAUSE a call that bypasses the mesh carries no id`
    },
    {
      section: 'Health checks and metrics',
      color: 'orange',
      motivation: `Operators need to know whether a service is up and how it is performing. The mesh exposes a health URL and records metrics without changing the service.`,
      steps: [
        { num: 1, title: 'Expose a health URL', detail: 'The proxy provides a URL a monitoring service can ping to determine the health of the application.' },
        { num: 2, title: 'Record metrics', detail: 'The proxy measures what the application is doing and how it is performing.' },
        { num: 3, title: 'Report the measurements', detail: 'The measurements are emitted to the monitoring service.' }
      ],
      program: `// MESH SIDE — a health URL and per-request metrics, both handled at the proxy without touching service code
// PARTIES: MON = monitoring service · PROXY = the sidecar proxy · SVC = Order Service
// STATE (before):
//    health : {}                        // health endpoint state, unknown
//    metric : 0                         // measured counter, zero
// DEF: ping health URL every 10 s · CALLED BY: MON
// -> health_url : "/health"
//    step 1 · ping · health : {} -> {"status":"UP"}   BECAUSE the proxy exposes a URL the monitor can ping
//    step 2 · measure · metric : 0 -> 1               // the proxy counts one successful request
//    step 3 · report · samples : 0 -> 1               // the measurement is emitted to the monitor
// <- health : "UP"  · metric : 1  · insight into what the service is doing, with no code change
//    alt DOWN : health : {"status":"UP"} -> {"status":"DOWN"}   BECAUSE the service process failed, so the ping reports DOWN`
    },
    {
      section: 'Configuration and logging, plus the chassis link',
      color: 'orange',
      motivation: `Credentials, network locations, and logging configuration are cross-cutting too. The mesh externalizes configuration and configures logging once, and it overlaps with two related patterns.`,
      steps: [
        { num: 1, title: 'Externalize configuration', detail: 'Credentials and network locations of external services such as databases and message brokers are supplied outside the service.' },
        { num: 2, title: 'Configure logging', detail: 'A logging framework such as log4j or logback is configured once, not per service.' },
        { num: 3, title: 'Relate to chassis and sidecar', detail: 'The microservice chassis is another way to implement some concerns, and a mesh is often implemented with the sidecar pattern.' }
      ],
      program: `// MESH SIDE — credentials and network locations are injected by the mesh, and logging is configured once
// PARTIES: PROXY = sidecar proxy · SVC = Order Service · BRK = message broker
// STATE (before):
//    config : {}                        // externalized config, not yet loaded
//    logger : null                      // logging framework, not yet configured
// DEF: inject config with 3 entries · CALLED BY: PROXY at startup
// -> env : "prod"
//    step 1 · load config · config : {} -> {"db":"db:5432","broker":"brk:9092","secret":"s3cr3t"}  BECAUSE credentials and external locations are externalized
//    step 2 · configure logging · logger : null -> "logback"                                        // the proxy configures the logging framework once
//    step 3 · hand to SVC · injected : 0 -> 1                                                       // the service reads config from the proxy, not from code
// <- config : 3 entries  · logger : "logback"  · cross-cutting concerns live outside the service
//    alt no mesh : injected : 1 -> 0   BECAUSE without a mesh each service must implement these concerns itself`
    }
  ],
  interview: [
    {
      scenario: 'Every service in your fleet duplicates the same cross-cutting behavior — logging, metrics, tracing — and each implementation has drifted from the others. You want those concerns out of the service code entirely.',
      q: 'How does the Service mesh pattern move cross-cutting concerns out of each service?',
      solution: 'A mesh that mediates all communication in and out of each service lets a proxy attached to the service intercept each outbound call and apply the concern on the traffic instead of inside the service.',
      components: ['Mesh — mediates all traffic', 'Sidecar proxy — per service', 'Outbound interception — sees each call', 'Concern applied on traffic — not in code'],
      diagram: `flowchart LR
  SVC["Order Service"] -->|"SELECT * FROM orders"| PROXY["Sidecar proxy"]
  PROXY -->|"traced call"| DB["db:5432"]
  PROXY -->|"attaches"| ID["trace id"]`,
      code: `// MESH SIDE — a proxy intercepts every call out of a service, mediating all communication
// PARTIES: SVC = Order Service · PROXY = its sidecar proxy · DB = PostgreSQL 16 @ orders-db-1
// STATE (before):
//    request : {}                       // the outbound call, not yet intercepted
//    trace_id : null                    // no distributed-tracing id yet
// DEF: intercept outbound call 1 to DB · CALLED BY: SVC sending a query
// -> call : "SELECT * FROM orders" · -> target : "db:5432"
//    step 1 · intercept   // request : {} -> {"call":"SELECT * FROM orders","to":"db:5432"}   BECAUSE the mesh mediates ALL traffic in and out
//    step 2 · trace   // trace_id : null -> "trc-9f2a"   // the proxy assigns a unique id to the request
//    step 3 · forward   // sent : 0 -> 1   // the proxy forwards the traced call to the DB
// <- call : "SELECT * FROM orders" delivered to db:5432 · trace_id "trc-9f2a" attached
//    alt inbound reply : reply : 0 -> 1   BECAUSE the same proxy also mediates the response back into SVC`,
      tieback: 'This is the mediation stage — intercepting every call in and out and applying the concern at the proxy.',
      refs: ['Mediate all traffic through the mesh'],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    },
    {
      scenario: 'A single external request fans out across four services and you need to reconstruct the whole chain later. Each service logs locally, so nothing ties the pieces together.',
      q: 'How does the mesh enable distributed tracing across services?',
      solution: 'The proxy gives each external request a unique identifier that is passed between services, and each service hop records a span against the shared id so the chain is reconstructable.',
      components: ['Unique identifier — assigned by the proxy', 'Shared id — passed between services', 'Span per hop — recorded against the id', 'Reconstructable chain — the goal'],
      diagram: `flowchart LR
  P1["Proxy A"] -->|"id trc-9f2a"| SVCB["Customer Service"]
  SVCB -->|"same id"| P2["Proxy B"]
  P2 -->|"records span"| CHAIN["chain: order -> customer"]`,
      code: `// MESH SIDE — one unique id travels with the request across services so a call chain can be traced
// PARTIES: U1 = a user request · PROXY = sidecar of Order Service · SVCB = Customer Service
// DEF: trace — the whole chain of spans that share one trace_id for a single request; here trace_id "trc-9f2a" = the order-service -> customer-service chain
// STATE (before):
//    trace_id : "trc-9f2a"              // id assigned at the first proxy
//    hops : []                          // services the request has passed through
// DEF: propagate id trc-9f2a to next hop · CALLED BY: Order Service calling Customer Service
// -> next : "customer-service"
//    step 1 · carry the id   // hops : [] -> ["order-service"]   BECAUSE the proxy passes the SAME unique id between services
//    step 2 · forward   // hops : ["order-service"] -> ["order-service","customer-service"]   // the id rides to the next service
//    step 3 · record a span   // spans : 0 -> 1   // each hop records a span against the shared id
// <- trace_id : "trc-9f2a" · spans : 1 · the whole chain is reconstructable from one id
//    alt untraced call : trace_id : "trc-9f2a" -> null   BECAUSE a call that bypasses the mesh carries no id`,
      tieback: 'This is the tracing stage — assigning one id, passing it between services, and recording a span per hop.',
      refs: ['Distributed tracing across services'],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    },
    {
      scenario: 'Your operators need to know whether the order service is up and how it is performing, but you cannot change the service to add monitoring code.',
      q: 'How does the mesh expose health and metrics without changing the service?',
      solution: 'The proxy exposes a health URL a monitoring service can ping to determine the health of the application, and it records metrics about what the application is doing and reports them.',
      components: ['Health URL — exposed by the proxy', 'Monitoring service — pings it', 'Metrics — recorded by the proxy', 'Report — emitted to the monitor'],
      diagram: `flowchart LR
  MON["Monitoring service"] -->|"GET /health every 10 s"| PROXY["Sidecar proxy"]
  PROXY -->|"status UP"| MON
  PROXY -->|"metric 1"| MON
  SVC["Order Service"] --- PROXY`,
      code: `// MESH SIDE — a health URL and per-request metrics, both handled at the proxy without touching service code
// PARTIES: MON = monitoring service · PROXY = the sidecar proxy · SVC = Order Service
// STATE (before):
//    health : {}                        // health endpoint state, unknown
//    metric : 0                         // measured counter, zero
// DEF: ping health URL every 10 s · CALLED BY: MON
// -> health_url : "/health"
//    step 1 · answer the ping   // health : {} -> {"status":"UP"}   BECAUSE the proxy exposes a URL the monitor can ping
//    step 2 · measure   // metric : 0 -> 1   // the proxy counts one successful request
//    step 3 · report   // samples : 0 -> 1   // the measurement is emitted to the monitor
// <- health : "UP" · metric : 1 · insight into what the service is doing, with no code change
//    alt DOWN : health : {"status":"UP"} -> {"status":"DOWN"}   BECAUSE the service process failed, so the ping reports DOWN`,
      tieback: 'This is the observability stage — a health URL and metrics emitted by the proxy with no service change.',
      refs: ['Health checks and metrics'],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    },
    {
      scenario: 'Credentials, database locations, and logging setup are cross-cutting too, and today each service hardcodes them. You want them externalized once, and you want to know how the mesh relates to two other patterns.',
      q: 'What does the mesh externalize, and which two patterns does the reference relate it to?',
      solution: 'The mesh supplies credentials and network locations of external services outside the service and configures a logging framework such as log4j or logback once; it relates to the microservice chassis and is often implemented with the sidecar pattern.',
      components: ['Externalized configuration — credentials and locations', 'Logging framework — configured once', 'Microservice chassis — an alternative', 'Sidecar — the usual implementation'],
      diagram: `flowchart LR
  PROXY["Sidecar proxy"] -->|"injects"| CFG["db:5432, brk:9092, secret"]
  PROXY -->|"configures once"| LOG["logback"]
  CFG -->|"supplied"| SVC["Order Service"]
  LOG -->|"overlaps"| CH["Chassis + Sidecar"]`,
      code: `// MESH SIDE — credentials and network locations are injected by the mesh, and logging is configured once
// PARTIES: PROXY = sidecar proxy · SVC = Order Service · BRK = message broker
// STATE (before):
//    config : {}                        // externalized config, not yet loaded
//    logger : null                      // logging framework, not yet configured
// DEF: inject config with 3 entries · CALLED BY: PROXY at startup
// -> env : "prod"
//    step 1 · load the config   // config : {} -> {"db":"db:5432","broker":"brk:9092","secret":"s3cr3t"}   BECAUSE credentials and external locations are externalized
//    step 2 · configure logging   // logger : null -> "logback"   // the proxy configures the logging framework once
//    step 3 · hand to the service   // injected : 0 -> 1   // the service reads config from the proxy, not from code
// <- config : 3 entries · logger : "logback" · cross-cutting concerns live outside the service
//    alt no mesh : injected : 1 -> 0   BECAUSE without a mesh each service must implement these concerns itself`,
      tieback: 'This is the configuration stage — externalizing credentials and locations, configuring logging once, and linking to the chassis and sidecar.',
      refs: ['Configuration and logging, plus the chassis link'],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    }
  ],
  systemDesign: {
    pipeline: 'service → sidecar proxy (data plane) → control plane',
    decomposition: [
      {
        box: 'Order Service — the business service whose traffic the mesh mediates',
        role: 'service',
        parts: [
          'Application code — sends queries and receives replies',
          'Traffic — every in/out call is routed through the sidecar proxy'
        ]
      },
      {
        box: 'sidecar proxy — the per-service data plane',
        role: 'data plane',
        parts: [
          'Interceptor — sees each call before it leaves the service',
          'mTLS — encrypts service-to-service traffic with a distributed cert',
          'Retry / circuit-breaker — retries and trips circuits on failures',
          'Metrics — counts requests and answers health pings'
        ]
      },
      {
        box: 'control plane — the mesh brain that pushes policy to every proxy',
        role: 'control plane',
        parts: [
          'Route config — distributes route rules to the proxies',
          'Cert distribution — hands each proxy its mTLS identity'
        ]
      }
    ],
    wiring: "flowchart LR\n  SVC[\"Order Service\"] -->|\"SELECT * FROM orders\"| PX[\"sidecar proxy (data plane)\"]\n  PX -->|\"mTLS + route lookup\"| DB[(\"PostgreSQL 16 @ orders-db-1\")]\n  CP[\"control plane\"] -->|\"pushes route config\"| PX\n  CP -->|\"distributes cert cert-7f21\"| PX\n  PX -->|\"reports metrics\"| MON[\"monitoring service\"]",
    program: `// SYSTEM DESIGN — service mesh: service -> sidecar proxy (data plane) -> control plane
// PARTIES: SVC = Order Service (business service) · PROXY = sidecar proxy (data plane: intercepts traffic, mTLS, retries/circuit-break, metrics) · CP = control plane (route-config distributor + certificate authority) · DB = PostgreSQL 16 @ orders-db-1 (the proxied backend)
// DEF: route — one control-plane rule mapping a target host to its backend; here "db:5432" -> "orders-db-1"
// DEF: trace — one shared id stamped on a request so its hops can be reassembled; here "trc-9f2a"
// DEF: cert — the mTLS identity the control plane distributes to each proxy; here "cert-7f21"
// DEF: mTLS — mutual TLS the proxy applies to service-to-service calls; here cert "cert-7f21"
// STATE (before):
//    request : {}                                 // the outbound call, not yet seen by the proxy
//    route_table : { "db:5432": "orders-db-1" }    // routes pushed by the control plane
// DEF: mediate_one_call · CALLED BY: the Order Service sending a query
// -> call : "SELECT * FROM orders" · -> target : "db:5432"
//    step 1 · the proxy intercepts the call    request : {} -> {"call":"SELECT * FROM orders","to":"db:5432"}   BECAUSE the mesh mediates ALL traffic in and out
//    step 2 · the proxy records the trace id    trace_id : "" -> "trc-9f2a"   // the data plane stamps a unique id
//    step 3 · the proxy reads the route and applies mTLS    sent : 0 -> 1   // cert "cert-7f21" encrypts the hop to the route "orders-db-1"
//    step 4 · the control plane pushes fresh routes    route_table : { "db:5432":"orders-db-1" } -> { "db:5432":"orders-db-1", "brk:9092":"broker-1" }   BECAUSE CP distributes config
// <- call : "SELECT * FROM orders" delivered to "db:5432" · trace_id "trc-9f2a"   BECAUSE the sidecar sits between the service and the network, and the response is routed back to SVC`
  },
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Five cross-cutting concerns per service', content: '<p><strong>Why.</strong> In a set of microservices, every service must implement the same non-business concerns over and over.</p><p><strong>Claim.</strong> The pattern lists them: externalized configuration (credentials and network locations of databases and message brokers), logging, health checks, metrics, and distributed tracing.</p><p><strong>Grounding.</strong> The problem statement enumerates these concerns, including instrumenting services with a unique identifier passed between services for distributed tracing.</p><p><strong>In the wild.</strong> Implementing each concern in every service leads to duplicated, drifting code across the system.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'A mesh that mediates all traffic', content: '<p><strong>Why.</strong> If all traffic passes through one layer, that layer can carry every cross-cutting concern.</p><p><strong>Claim.</strong> Use a service mesh that mediates all communication in and out of each service.</p><p><strong>Grounding.</strong> The solution states the mesh mediates all in and out communication, so concerns are applied to the traffic rather than written in each service.</p><p><strong>In the wild.</strong> The same proxy that routes a request also attaches its trace id, records metrics, and answers health pings.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Concerns move out of the service code', content: '<p><strong>Why.</strong> Business code should stay focused, and concern code should not be duplicated per service.</p><p><strong>Claim.</strong> The mesh centralizes concerns, so services no longer each implement configuration, logging, health checks, metrics, and tracing.</p><p><strong>Grounding.</strong> The concerns named in the problem are exactly the ones the mesh takes over by mediating all traffic.</p><p><strong>In the wild.</strong> A service can change language or framework and keep identical observability behavior.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Overlaps with chassis and sidecar', content: '<p><strong>Why.</strong> There is more than one place to put cross-cutting concerns, and the patterns overlap.</p><p><strong>Claim.</strong> The microservice chassis pattern is another way to implement some concerns, and a service mesh is often implemented using the sidecar pattern.</p><p><strong>Grounding.</strong> The related-patterns section names both links directly.</p><p><strong>In the wild.</strong> Teams choose a chassis for in-process concerns and a mesh for traffic-level concerns, often combining them.</p>' }
    ]
  },
  quiz: [
    { "question": "What is the solution of the Service mesh pattern?", "options": ["A. Package each service as a container", "B. Use a mesh that mediates all communication in and out of each service", "C. Deploy services as VMs", "D. Use a message broker for all calls"], "answer": 2, "explanation": "The solution is a service mesh that mediates all communication in and out of each service (B). The other options are unrelated deployment or communication choices.", "conceptRef": "A mesh that mediates all traffic" },
    { "question": "Which of these is listed as a cross-cutting concern the mesh addresses?", "options": ["A. Distributed tracing with a unique identifier passed between services", "B. Database sharding", "C. Event sourcing", "D. API composition"], "answer": 1, "explanation": "Distributed tracing — instrumenting services with a unique identifier passed between services — is one of the listed concerns (A). Sharding, event sourcing, and API composition are not in the mesh's concern list.", "conceptRef": "Five cross-cutting concerns per service" },
    { "question": "Which two patterns does the reference relate the service mesh to?", "options": ["A. Saga and CQRS", "B. Microservice chassis and Sidecar", "C. API gateway and BFF", "D. Outbox and event sourcing"], "answer": 2, "explanation": "The related-patterns section says the microservice chassis is another way to implement some concerns, and a service mesh is often implemented using the sidecar pattern (B).", "conceptRef": "Overlaps with chassis and sidecar" },
    { "question": "What does externalized configuration in the mesh include?", "options": ["A. Credentials and network locations of external services such as databases and message brokers", "B. Only the CPU and memory limits", "C. Only the logging framework", "D. Only the container image tag"], "answer": 1, "explanation": "Externalized configuration includes credentials and network locations of external services such as databases and message brokers (A). CPU and memory limits, logging, and image tags are not what this concern covers.", "conceptRef": "Five cross-cutting concerns per service" }
  ]
});
