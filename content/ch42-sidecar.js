registerChapter({
  id: 'ch42',
  num: 42,
  title: 'Sidecar',
  pattern: 'Implement cross-cutting concerns in a sidecar process or container that runs alongside the service instance.',
  aka: 'Chris Richardson · Microservice Patterns p.410 · microservices.io /patterns/deployment/sidecar.html',
  part: 9,
  flow: [
    {
      section: 'Colocate a sidecar with each instance',
      color: 'orange',
      motivation: `Cross-cutting concerns belong outside the service code. A sidecar process or container that runs alongside the service instance carries those concerns, so the service stays focused on business logic.`,
      steps: [
        { num: 1, title: 'Run the service instance', detail: 'The service instance runs as its own process or container.' },
        { num: 2, title: 'Run a sidecar alongside it', detail: 'A separate sidecar process or container runs alongside the service instance.' },
        { num: 3, title: 'Move concerns into the sidecar', detail: 'The sidecar implements the cross-cutting concerns instead of the service.' }
      ],
      program: `// COLOCATE SIDE — run a sidecar process alongside each service instance so concerns live outside the service
// PARTIES: POD = the deployment unit (one host) · SVC = Order Service instance · SIDE = the sidecar
// STATE (before):
//    processes : {}                     // processes in this pod, none yet
//    concerns : []                      // cross-cutting concerns, not yet attached
// DEF: start 2 processes (service + sidecar) · CALLED BY: POD at deploy time
// -> service : "order-service" · -> sidecar : "order-sidecar"
//    step 1 · start SVC · processes : {} -> {"order-service"}   BECAUSE the service instance runs as its own process
//    step 2 · start SIDE · processes : {"order-service"} -> {"order-service","order-sidecar"}  // the sidecar runs ALONGSIDE the service
//    step 3 · attach concerns · concerns : [] -> ["tracing","metrics"]   // the sidecar carries cross-cutting concerns, not the service
// <- processes : 2  · concerns : 2  · the service and sidecar share one host
//    alt container form : sidecar : "order-sidecar" -> "order-sidecar-container"  BECAUSE a sidecar can be a container instead of a process`
    },
    {
      section: 'Intercept outbound traffic',
      color: 'orange',
      motivation: `The sidecar sits between the service and its outbound traffic, so it can act on every call that leaves. This is where a concern such as distributed tracing attaches a unique id.`,
      steps: [
        { num: 1, title: 'Sit in the traffic path', detail: 'The sidecar stands between the service and its outbound calls.' },
        { num: 2, title: 'Intercept the request', detail: 'The sidecar sees each outbound request before it leaves.' },
        { num: 3, title: 'Apply the concern', detail: 'The sidecar stamps the request with a trace id and forwards it.' }
      ],
      program: `// OUTBOUND SIDE — the sidecar mediates every call leaving the service, attaching a trace id
// PARTIES: SVC = Order Service · SIDE = its sidecar · DB = PostgreSQL 16 @ orders-db-1
// STATE (before):
//    request : {}                       // the outbound call before interception
//    trace_id : null                    // no id assigned yet
// DEF: mediate call 1 to DB · CALLED BY: SVC sending a query
// -> call : "SELECT * FROM orders" · -> target : "db:5432"
//    step 1 · intercept · request : {} -> {"call":"SELECT * FROM orders"}  BECAUSE the sidecar sits between the service and its outbound traffic
//    step 2 · trace · trace_id : null -> "trc-77c1"                        // the sidecar stamps a unique id for distributed tracing
//    step 3 · forward · sent : 0 -> 1                                      // the stamped call leaves for the DB
// <- call : "SELECT * FROM orders" sent to db:5432 · trace_id "trc-77c1"
//    alt reply path : reply : 0 -> 1   BECAUSE the same sidecar also mediates the inbound reply`
    },
    {
      section: 'Intercept inbound traffic',
      color: 'orange',
      motivation: `Inbound traffic passes through the sidecar too. A monitoring service can ping the sidecar for health, and the sidecar records metrics — observability without touching the service.`,
      steps: [
        { num: 1, title: 'Own the health URL', detail: 'The sidecar answers the health-check URL that a monitoring service pings.' },
        { num: 2, title: 'Count the requests', detail: 'The sidecar records metrics about the requests it mediates.' },
        { num: 3, title: 'Report to the monitor', detail: 'The measurements are emitted so operators can see what the service is doing.' }
      ],
      program: `// INBOUND SIDE — a monitor pings the sidecar, which answers for the service without touching its code
// PARTIES: MON = monitoring service · SIDE = the sidecar · SVC = Order Service
// STATE (before):
//    health : {}                        // health endpoint state, unknown
//    metric : 0                         // request counter, zero
// DEF: ping health URL every 10 s · CALLED BY: MON
// -> health_url : "/health"
//    step 1 · answer · health : {} -> {"status":"UP"}   BECAUSE the sidecar owns the health-check URL the monitor pings
//    step 2 · count · metric : 0 -> 1                   // the sidecar records one measured request
//    step 3 · report · samples : 0 -> 1                 // the metric is emitted to the monitor
// <- health : "UP"  · metric : 1  · observability handled by the sidecar, service code unchanged
//    alt DOWN : health : {"status":"UP"} -> {"status":"DOWN"}   BECAUSE the service process failed behind the sidecar`
    },
    {
      section: 'Sidecars form a service mesh',
      color: 'orange',
      motivation: `A single sidecar handles one instance. When every instance has a sidecar, the set of sidecars collectively mediates all in and out traffic — which is how a service mesh is often implemented.`,
      steps: [
        { num: 1, title: 'Give every instance a sidecar', detail: 'Each service instance gets its own sidecar.' },
        { num: 2, title: 'Route hop to hop', detail: 'One sidecar forwards to the next, which hands the call to the next service.' },
        { num: 3, title: 'Mediate all traffic', detail: 'Together the sidecars mediate all communication in and out of every service.' }
      ],
      program: `// MESH SIDE — when every instance has a sidecar, the set of sidecars mediates all traffic: a service mesh
// PARTIES: SIDEA = sidecar of Order Service · SIDEB = sidecar of Customer Service · SVCB = Customer Service
// STATE (before):
//    sidecars : {}                      // sidecars deployed across the system, none yet
//    hops : 0                           // mediated service-to-service hops
// DEF: make call 1 from A to B · CALLED BY: Order Service calling Customer Service
// -> next : "customer-service"
//    step 1 · deploy sidecars · sidecars : {} -> {"a","b"}   BECAUSE each service instance gets its own sidecar
//    step 2 · route · hops : 0 -> 1                          // SIDEA forwards to SIDEB, which hands it to SVCB
//    step 3 · form mesh · mediated : 0 -> 1                  // the sidecars collectively mediate all in/out communication
// <- hops : 1  · a mesh is often implemented using the sidecar pattern
//    alt one sidecar only : sidecars : {"a","b"} -> {"a"}   BECAUSE without sidecars on every service, traffic is not fully mediated`
    }
  ],
  interview: [
    {
      scenario: 'Your order service is polluted with configuration, logging, health-check, metrics, and tracing code that has nothing to do with orders. You want the business logic clean and the concerns moved somewhere else.',
      q: 'Where does the Sidecar pattern put cross-cutting concerns, and where does the sidecar run?',
      solution: 'A sidecar process or container runs alongside the service instance and implements the cross-cutting concerns instead of the service, so the service stays focused on business logic.',
      components: ['Service instance — its own process', 'Sidecar — a separate process or container', 'Shared host — they run alongside', 'Cross-cutting concerns — moved into the sidecar'],
      diagram: `flowchart LR
  POD["Deployment unit"] -->|"start"| SVC["order-service"]
  POD -->|"start alongside"| SIDE["order-sidecar"]
  SIDE -->|"carries"| CC["tracing + metrics"]
  SVC -->|"stays on"| BIZ["business logic"]`,
      code: `// COLOCATE SIDE — run a sidecar process alongside each service instance so concerns live outside the service
// PARTIES: POD = the deployment unit (one host) · SVC = Order Service instance · SIDE = the sidecar
// STATE (before):
//    processes : {}                     // processes in this pod, none yet
//    concerns : []                      // cross-cutting concerns, not yet attached
// DEF: start 2 processes (service + sidecar) · CALLED BY: POD at deploy time
// -> service : "order-service" · -> sidecar : "order-sidecar"
//    step 1 · start the service   // processes : {} -> {"order-service"}   BECAUSE the service instance runs as its own process
//    step 2 · start the sidecar   // processes : {"order-service"} -> {"order-service","order-sidecar"}   // the sidecar runs ALONGSIDE the service
//    step 3 · attach the concerns   // concerns : [] -> ["tracing","metrics"]   // the sidecar carries cross-cutting concerns, not the service
// <- processes : 2 · concerns : 2 · the service and sidecar share one host
//    alt container form : sidecar : "order-sidecar" -> "order-sidecar-container"   BECAUSE a sidecar can be a container instead of a process`,
      tieback: 'This is the colocation stage — running a sidecar alongside each instance and moving the concerns into it.',
      refs: ['Colocate a sidecar with each instance'],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: 'You need every outbound call from the order service to carry a trace id for distributed tracing, but you cannot modify the service to add it.',
      q: 'How does the sidecar act on outbound traffic?',
      solution: 'The sidecar sits between the service and its outbound calls, sees each outbound request before it leaves, stamps it with a trace id, and forwards it.',
      components: ['Traffic path — sidecar in the middle', 'Outbound request — intercepted', 'Trace id — stamped on the call', 'Forward — the call leaves'],
      diagram: `flowchart LR
  SVC["Order Service"] -->|"SELECT * FROM orders"| SIDE["Sidecar"]
  SIDE -->|"stamps trc-77c1"| DB["db:5432"]
  SIDE -->|"attaches"| ID["trace id"]`,
      code: `// OUTBOUND SIDE — the sidecar mediates every call leaving the service, attaching a trace id
// PARTIES: SVC = Order Service · SIDE = its sidecar · DB = PostgreSQL 16 @ orders-db-1
// STATE (before):
//    request : {}                       // the outbound call before interception
//    trace_id : null                    // no id assigned yet
// DEF: mediate call 1 to DB · CALLED BY: SVC sending a query
// -> call : "SELECT * FROM orders" · -> target : "db:5432"
//    step 1 · intercept   // request : {} -> {"call":"SELECT * FROM orders"}   BECAUSE the sidecar sits between the service and its outbound traffic
//    step 2 · stamp the trace id   // trace_id : null -> "trc-77c1"   // the sidecar stamps a unique id for distributed tracing
//    step 3 · forward   // sent : 0 -> 1   // the stamped call leaves for the DB
// <- call : "SELECT * FROM orders" sent to db:5432 · trace_id "trc-77c1"
//    alt reply path : reply : 0 -> 1   BECAUSE the same sidecar also mediates the inbound reply`,
      tieback: 'This is the outbound stage — the sidecar intercepts each outgoing call and stamps it with a trace id before forwarding.',
      refs: ['Intercept outbound traffic'],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: 'Your monitoring service pings /health on the order service, but you want the health answer and the metrics to come from the sidecar, not from service code.',
      q: 'How does the sidecar handle inbound traffic for observability?',
      solution: 'The sidecar answers the health-check URL the monitoring service pings, records metrics about the requests it mediates, and emits the measurements to the monitor.',
      components: ['Health URL — owned by the sidecar', 'Monitoring service — pings it', 'Request metrics — recorded by the sidecar', 'Emission — to the monitor'],
      diagram: `flowchart LR
  MON["Monitoring service"] -->|"GET /health"| SIDE["Sidecar"]
  SIDE -->|"status UP"| MON
  SIDE -->|"metric 1"| MON
  SVC["Order Service"] --- SIDE`,
      code: `// INBOUND SIDE — a monitor pings the sidecar, which answers for the service without touching its code
// PARTIES: MON = monitoring service · SIDE = the sidecar · SVC = Order Service
// STATE (before):
//    health : {}                        // health endpoint state, unknown
//    metric : 0                         // request counter, zero
// DEF: ping health URL every 10 s · CALLED BY: MON
// -> health_url : "/health"
//    step 1 · answer the ping   // health : {} -> {"status":"UP"}   BECAUSE the sidecar owns the health-check URL the monitor pings
//    step 2 · count the request   // metric : 0 -> 1   // the sidecar records one measured request
//    step 3 · report   // samples : 0 -> 1   // the metric is emitted to the monitor
// <- health : "UP" · metric : 1 · observability handled by the sidecar, service code unchanged
//    alt DOWN : health : {"status":"UP"} -> {"status":"DOWN"}   BECAUSE the service process failed behind the sidecar`,
      tieback: 'This is the inbound stage — the sidecar answers health pings and records and reports metrics without touching the service.',
      refs: ['Intercept inbound traffic'],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: 'One sidecar only handles one instance. You want every instance covered so that, together, the sidecars mediate all traffic in and out of every service.',
      q: 'What do the sidecars collectively form, and how is the hop between services mediated?',
      solution: 'When every instance gets its own sidecar, one sidecar forwards to the next, which hands the call to the next service, and together the sidecars mediate all communication — a service mesh.',
      components: ['One sidecar per instance', 'Hop-to-hop forwarding', 'All traffic mediated', 'A service mesh — the collective result'],
      diagram: `flowchart LR
  SIDEA["Sidecar A"] -->|"forward"| SIDEB["Sidecar B"]
  SIDEB -->|"hands off"| SVCB["Customer Service"]
  SIDEA -->|"together"| MESH["service mesh"]
  SIDEB --> MESH`,
      code: `// MESH SIDE — when every instance has a sidecar, the set of sidecars mediates all traffic: a service mesh
// PARTIES: SIDEA = sidecar of Order Service · SIDEB = sidecar of Customer Service · SVCB = Customer Service
// STATE (before):
//    sidecars : {}                      // sidecars deployed across the system, none yet
//    hops : 0                           // mediated service-to-service hops
// DEF: make call 1 from A to B · CALLED BY: Order Service calling Customer Service
// -> next : "customer-service"
//    step 1 · deploy the sidecars   // sidecars : {} -> {"a","b"}   BECAUSE each service instance gets its own sidecar
//    step 2 · route hop to hop   // hops : 0 -> 1   // SIDEA forwards to SIDEB, which hands it to SVCB
//    step 3 · form the mesh   // mediated : 0 -> 1   // the sidecars collectively mediate all in/out communication
// <- hops : 1 · a mesh is often implemented using the sidecar pattern
//    alt one sidecar only : sidecars : {"a","b"} -> {"a"}   BECAUSE without sidecars on every service, traffic is not fully mediated`,
      tieback: 'This is the mesh stage — every instance\'s sidecar collectively mediates all traffic, forming a service mesh.',
      refs: ['Sidecars form a service mesh'],
      problems: ["01-scale-from-zero-to-millions"]
    }
  ],
  systemDesign: {
    pipeline: 'application container → sidecar container → shared resources',
    decomposition: [
      {
        box: 'application container — the Order Service that owns the business logic',
        role: 'application container',
        parts: [
          'Order Service — runs the business code',
          'Sends calls — outbound traffic passes through the sidecar'
        ]
      },
      {
        box: 'sidecar container — the concern-carrying twin',
        role: 'sidecar container',
        parts: [
          'Proxy — intercepts outbound traffic and stamps a trace id',
          'Log-shipper — forwards the logs from the shared volume',
          'Config-reloader — watches and reloads config',
          'Shares the pod — mounts the same volume and network namespace'
        ]
      },
      {
        box: 'shared resources — what both containers share',
        role: 'shared resources',
        parts: [
          'Network namespace — one IP for app and sidecar',
          'Volume — shared-logs mounted by both'
        ]
      }
    ],
    wiring: "flowchart LR\n  POD[\"Kubernetes pod\"] -->|\"starts\"| APP[\"application container order-service\"]\n  POD -->|\"starts alongside\"| SIDE[\"sidecar container order-sidecar\"]\n  APP -->|\"SELECT * FROM orders\"| SIDE\n  SIDE -->|\"stamps trc-77c1\"| DB[(\"PostgreSQL 16 @ orders-db-1\")]\n  APP -->|\"mounts\"| VOL[(\"volume shared-logs\")]\n  SIDE -->|\"mounts\"| VOL\n  APP -->|\"shares\"| NS[\"network namespace pod-net-7\"]\n  SIDE -->|\"shares\"| NS",
    program: `// SYSTEM DESIGN — sidecar: application container -> sidecar container -> shared resources
// PARTIES: APP = application container (Order Service "order-service") · SIDE = sidecar container (proxy/log-shipper/config-reloader "order-sidecar") · SHARED = shared resources (the pod network namespace + the volume both containers mount)
// DEF: sidecar — the container that carries the cross-cutting concerns alongside the app; here "order-sidecar"
// DEF: concern — one cross-cutting job moved out of the service; here "tracing"
// DEF: namespace — the shared network both containers live in; here "pod-net-7"
// DEF: volume — the shared disk both containers mount; here "shared-logs"
// STATE (before):
//    containers : {}     // containers started in the pod, none yet
//    concerns : []       // cross-cutting concerns, not yet attached
// DEF: colocate_sidecar · CALLED BY: the pod at deploy time
// -> service : "order-service" · -> sidecar : "order-sidecar"
//    step 1 · the pod starts the app container    containers : {} -> {"order-service"}   BECAUSE the service runs as its own container
//    step 2 · the pod starts the sidecar container    containers : {"order-service"} -> {"order-service","order-sidecar"}   // the sidecar runs alongside, sharing the pod
//    step 3 · the sidecar attaches the concerns    concerns : [] -> ["tracing","metrics"]   // the app reads none of this; SIDE records it
//    step 4 · both mount the shared volume and share the namespace    mounts : 0 -> 2   // volume "shared-logs" and net "pod-net-7"
// <- containers : 2 in the pod · the sidecar reads the shared volume "shared-logs" and writes its own metrics   BECAUSE a sidecar shares the host, network, and volume with the service`
  },
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Cross-cutting concerns pollute service code', content: '<p><strong>Why.</strong> In a system of services, every instance must handle the same non-business concerns.</p><p><strong>Claim.</strong> Writing configuration, logging, health checks, metrics, and tracing into each service duplicates code and drags every service away from its business logic.</p><p><strong>Grounding.</strong> The sidecar pattern exists to implement cross-cutting concerns, which the service mesh chapter enumerates as externalized configuration, logging, health checks, metrics, and distributed tracing.</p><p><strong>In the wild.</strong> The sidecar is the mechanism that moves those concerns out of the service.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'A sidecar alongside each instance', content: '<p><strong>Why.</strong> The concern code should live somewhere that is not the service.</p><p><strong>Claim.</strong> Implement cross-cutting concerns in a sidecar process or container that runs alongside the service instance.</p><p><strong>Grounding.</strong> The solution states the sidecar runs alongside the service instance, so the two share a host and the sidecar can act on the service\'s traffic.</p><p><strong>In the wild.</strong> The same sidecar answers health pings, attaches trace ids, and records metrics for its service.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Concerns out of the code, at the cost of another process', content: '<p><strong>Why.</strong> You want observability and configuration without rewriting them per service.</p><p><strong>Claim.</strong> The sidecar centralizes cross-cutting concerns, but you now deploy and operate a second process or container per instance.</p><p><strong>Grounding.</strong> The solution says the sidecar is a separate process or container, so it is an extra runtime component alongside the service.</p><p><strong>In the wild.</strong> Teams accept the extra component because it keeps the service code clean and language-agnostic.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Sidecars are the building blocks of a mesh', content: '<p><strong>Why.</strong> One sidecar per instance scales naturally across a whole system.</p><p><strong>Claim.</strong> When every instance has a sidecar, the sidecars collectively mediate all communication in and out of each service — a service mesh.</p><p><strong>Grounding.</strong> The service mesh chapter notes a mesh is often implemented using the sidecar pattern, and the mesh mediates all traffic in and out.</p><p><strong>In the wild.</strong> A full mesh is often just the sidecar pattern applied consistently to every instance.</p>' }
    ]
  },
  quiz: [
    { "question": "What is the solution of the Sidecar pattern?", "options": ["A. Run all services in one process", "B. Implement cross-cutting concerns in a sidecar process or container running alongside the service instance", "C. Package services as VMs", "D. Use a serverless platform"], "answer": 2, "explanation": "The solution is to implement cross-cutting concerns in a sidecar process or container that runs alongside the service instance (B). The other options describe different patterns.", "conceptRef": "A sidecar alongside each instance" },
    { "question": "Where does the sidecar run relative to the service instance?", "options": ["A. In a separate data center", "B. Alongside the service instance, sharing its host", "C. Only in the cloud provider's control plane", "D. Inside the service's own JVM"], "answer": 2, "explanation": "The sidecar is a process or container that runs alongside the service instance (B), so it shares the host and can act on the service's traffic.", "conceptRef": "A sidecar alongside each instance" },
    { "question": "Which larger pattern is often implemented using sidecars?", "options": ["A. The service mesh", "B. The saga", "C. CQRS", "D. API composition"], "answer": 1, "explanation": "A service mesh is often implemented using the sidecar pattern (A). Saga, CQRS, and API composition are unrelated patterns.", "conceptRef": "Sidecars are the building blocks of a mesh" },
    { "question": "What kinds of concerns does the sidecar implement?", "options": ["A. Cross-cutting concerns such as configuration, logging, health checks, metrics, and tracing", "B. Business rules for order placement", "C. Database schema migrations", "D. UI rendering"], "answer": 1, "explanation": "The sidecar implements cross-cutting concerns (A), such as the configuration, logging, health checks, metrics, and tracing listed in the service mesh chapter. The other options are business or unrelated responsibilities.", "conceptRef": "Cross-cutting concerns pollute service code" }
  ]
});
