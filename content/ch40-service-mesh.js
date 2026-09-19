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
// PARTIES: SVC = Order Service · PROXY = its sidecar proxy · DB = the database SVC calls
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
