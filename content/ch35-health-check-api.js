registerChapter({
  id: 'ch35',
  num: 35,
  title: 'Health Check API',
  pattern: 'A service exposes a health check endpoint that a monitoring service, registry, or load balancer periodically calls to detect whether an instance can handle requests.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 35 · microservices.io /patterns/observability/health-check-api.html',
  part: 8,
  flow: [
    {
      section: 'Expose a health check endpoint',
      color: 'orange',
      motivation: `A service instance can be running yet unable to handle requests; without an endpoint that reports its health, nothing outside the instance can tell the difference. Exposing /health is the entry point for both alerting and routing.`,
      steps: [
        { num: 1, title: 'Add the endpoint', detail: 'The service exposes a health check API endpoint such as HTTP /health.' },
        { num: 2, title: 'Return the health', detail: 'The endpoint returns the health of the service as its result.' },
        { num: 3, title: 'Run it on every poll', detail: 'A health check client invokes the endpoint to check the health of the instance.' }
      ],
      program: `// ORDER SERVICE SIDE — the /health handler reports whether its database dependency is up
// PARTIES: SVC = Order Service instance · DB = its database · MON = monitoring service
// STATE (before):
//    health : { db:"UNKNOWN", status:null }
// DEF: health_check · CALLED BY: MON polling GET /health every 30 s
// -> req : "GET /health"
//    step 1 · probe the DB connection pool -> open   // health.db : "UNKNOWN" -> "UP"
//    step 2 · combine all checks into one verdict   // health.status : null -> "UP"
//    step 3 · respond with the verdict as the body   // body : {} -> {"status":"UP"}
// <- health : {"db":"UP", "status":"UP"} · MON now marks the instance healthy
//    alt DB pool exhausted : probe -> closed, health.db : "UNKNOWN" -> "DOWN", status : null -> "DOWN", body : {"status":"DOWN"}`
    },
    {
      section: 'Check the things that can fail',
      color: 'orange',
      motivation: `Health is not a boolean the process knows on its own; it is the result of probing real dependencies. A handler that checks connections, the host, and application logic can actually detect the running-but-broken state.`,
      steps: [
        { num: 1, title: 'Check infrastructure connections', detail: 'The handler checks the status of the connections to the infrastructure services the instance uses.' },
        { num: 2, title: 'Check the host', detail: 'The handler checks the status of the host, such as disk space.' },
        { num: 3, title: 'Run application-specific logic', detail: 'The handler runs application-specific checks on top of the generic ones.' }
      ],
      program: `// ORDER SERVICE SIDE — one handler runs three checks: infra connections, host disk, app logic
// PARTIES: SVC = Order Service instance · DB = its database · HOST = the machine it runs on
// STATE (before):
//    checks : { db:"UNKNOWN", disk:"UNKNOWN", app:"UNKNOWN" }
// DEF: run_checks · CALLED BY: the /health handler on each poll
// -> poll : 1 incoming GET /health
//    step 1 · check the status of connections to infrastructure services -> open   // checks.db : "UNKNOWN" -> "UP"
//    step 2 · check the host's disk space -> 12 free, above the 1 floor   // checks.disk : "UNKNOWN" -> "UP"
//    step 3 · run application-specific logic -> passes   // checks.app : "UNKNOWN" -> "UP"
// <- result : checks = {"db":"UP","disk":"UP","app":"UP"} · healthy only if all 3 are UP
//    alt one check fails : checks.db : "UP" -> "DOWN" -> the whole instance reports DOWN`
    },
    {
      section: 'Invoke it periodically',
      color: 'orange',
      motivation: `A single health check is a snapshot; failures happen between snapshots. A client that polls on a fixed interval catches transitions from healthy to unhealthy over time.`,
      steps: [
        { num: 1, title: 'Choose a client', detail: 'A monitoring service, service registry, or load balancer acts as the health check client.' },
        { num: 2, title: 'Poll on an interval', detail: 'The client periodically invokes the endpoint on each instance.' },
        { num: 3, title: 'Compare with the previous result', detail: 'The client notices when an instance flips from UP to DOWN.' }
      ],
      program: `// MONITORING SERVICE SIDE — a health-check client polls every instance on a fixed interval
// PARTIES: MON = monitoring service · SVC1 = instance 1 · SVC2 = instance 2
// STATE (before):
//    seen : { "SVC1":"UP", "SVC2":"UP" }        // health recorded on the last tick
// DEF: poll_loop · CALLED BY: MON's scheduler, every 30 s
// -> tick : 2
//    step 1 · GET /health on SVC1 -> "UP"   // seen["SVC1"] : "UP" -> "UP" (no change)
//    step 2 · GET /health on SVC2 -> "DOWN"   // seen["SVC2"] : "UP" -> "DOWN"
//    step 3 · count the healthy instances   // healthy : 2 -> 1   BECAUSE SVC2 flipped to DOWN
// <- observation : seen = {"SVC1":"UP","SVC2":"DOWN"} · MON raises an alert and SVC2 is pulled from routing
//    alt both UP this tick : healthy : 1 -> 2 -> no alert, routing unchanged`
    },
    {
      section: 'Route and alert on the result',
      color: 'orange',
      motivation: `The value of a health check is what you do with the answer: keep traffic off broken instances and wake a human. Routing and alerting are the two actions that consume the endpoint's verdict.`,
      steps: [
        { num: 1, title: 'Stop routing to failed instances', detail: 'The load balancer or service registry does not route requests to a failed instance.' },
        { num: 2, title: 'Generate an alert', detail: 'The monitoring system generates an alert when a service instance fails.' },
        { num: 3, title: 'Recover into the pool', detail: 'When the instance reports healthy again, it returns to routing.' }
      ],
      program: `// LOAD BALANCER SIDE — routing drops the failed instance and monitoring raises an alert
// PARTIES: LB = load balancer · REG = service registry · SVC1 = healthy instance · SVC2 = failed instance
// STATE (before):
//    pool : { "SVC1":"UP", "SVC2":"DOWN" }       // the routing pool with per-instance health
// DEF: route_and_alert · CALLED BY: LB after a health check reports SVC2 DOWN
// -> health : "SVC2 DOWN"
//    step 1 · LB removes SVC2 from its routing table   // pool : {"SVC1":"UP","SVC2":"DOWN"} -> {"SVC1":"UP"}
//    step 2 · the next request is routed only to a working instance   // target : null -> "SVC1"
//    step 3 · REG drops SVC2 and MON raises an alert   // alert : null -> "SVC2 DOWN at tick 2"
// <- outcome : pool = {"SVC1":"UP"} · requests route only to working instances, and an alert is generated
//    alt SVC2 recovers : health "SVC2 UP" -> pool : {"SVC1":"UP"} -> {"SVC1":"UP","SVC2":"UP"}`
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Running but unable to serve', content: '<p><strong>Why.</strong> A service instance can be incapable of handling requests yet still be running, for example when it has run out of database connections.</p><p><strong>Claim.</strong> Being alive is not the same as being healthy, so a process check alone is not enough to detect the failure.</p><p><strong>Grounding.</strong> The pattern exists to answer how to detect that a running service instance is unable to handle requests.</p><p><strong>In the wild.</strong> When this state is missed, a monitoring system fails to alert and a load balancer keeps routing to the broken instance.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Health check API endpoint', content: '<p><strong>Why.</strong> The instance itself must report whether it can serve, via something a client can poll.</p><p><strong>Claim.</strong> A service has a health check API endpoint such as HTTP /health that returns the health of the service.</p><p><strong>Grounding.</strong> The handler checks infrastructure connections, host status such as disk space, and application-specific logic; a client periodically invokes the endpoint.</p><p><strong>In the wild.</strong> Spring Boot Actuator provides a /health endpoint customized through HealthIndicator beans whose health() method returns a Health value.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'May miss a failure', content: '<p><strong>Why.</strong> A health check is a point-in-time sample, not a guarantee.</p><p><strong>Claim.</strong> The health check might not be sufficiently comprehensive, or the instance might fail between health checks.</p><p><strong>Grounding.</strong> The reference lists this as the drawback: requests might still be routed to a failed service instance.</p><p><strong>In the wild.</strong> A load balancer can send traffic to an instance that was healthy one second ago and is broken now.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'One endpoint, three consumers', content: '<p><strong>Why.</strong> The same /health answer drives different decisions in different systems.</p><p><strong>Claim.</strong> A health check client can be a monitoring service, a service registry, or a load balancer, each acting on the answer differently.</p><p><strong>Grounding.</strong> The reference names all three as the client that periodically invokes the endpoint.</p><p><strong>In the wild.</strong> A monitoring service raises an alert, a service registry drops the instance, and a load balancer stops routing to it.</p>' }
    ]
  },
  quiz: [
    { "question": "What problem does the Health Check API pattern address?", "options": ["A. A service instance can be running yet unable to handle requests", "B. Services crash too often at startup", "C. Databases are too slow to query", "D. Load balancers are too expensive"], "answer": 1, "explanation": "The context is a service instance that is still running but incapable of handling requests, for example because it ran out of database connections. B, C, and D are not the problem described.", "conceptRef": "Running but unable to serve" },
    { "question": "Which checks does the /health handler perform?", "options": ["A. Only CPU temperature and fan speed", "B. Connections to infrastructure services, host status such as disk space, and application-specific logic", "C. Only the number of open database connections", "D. Only memory usage"], "answer": 2, "explanation": "The reference lists the status of connections to infrastructure services, the status of the host such as disk space, and application-specific logic. A, C, and D are too narrow or not in the reference.", "conceptRef": "Health check API endpoint" },
    { "question": "Who periodically invokes the health check endpoint?", "options": ["A. The end user of the application", "B. A health check client such as a monitoring service, service registry, or load balancer", "C. The database server", "D. Only a developer running it by hand"], "answer": 2, "explanation": "The reference names a monitoring service, service registry, or load balancer as the client that periodically invokes the endpoint. A, C, and D are not the clients described.", "conceptRef": "One endpoint, three consumers" },
    { "question": "What is the stated drawback of the Health Check API?", "options": ["A. It requires a second database for every service", "B. The check may not be sufficiently comprehensive, or the instance may fail between checks, so requests can still be routed to a failed instance", "C. It removes the service registry from the architecture", "D. It uses two-phase commit for every check"], "answer": 2, "explanation": "The reference lists both gaps: the check might not be comprehensive, and an instance might fail between health checks. A, C, and D are not in the reference.", "conceptRef": "May miss a failure" }
  ]
});
