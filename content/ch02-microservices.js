// Chapter 2 — Microservice Architecture (Part 1: Architecture)
registerChapter({
  id: 'ch02',
  num: 2,
  title: 'Microservice Architecture',
  pattern: 'Structure the application as a set of two or more independently deployable, loosely coupled services, each owning one or more subdomains.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 2 · microservices.io /patterns/microservices.html',
  part: 1,
  flow: [
    {
      section: 'Services group subdomains',
      color: 'orange',
      motivation: `The microservice pattern turns the same subdomains into independently deployable services, with one rule about how subdomains may be shared.`,
      steps: [
        { num: 1, title: 'Two or more services', detail: 'Structure the application as a set of two or more independently deployable, loosely coupled components, a.k.a. services.' },
        { num: 2, title: 'Each service owns one or more subdomains', detail: 'A service consists of one or more subdomains, and each subdomain is part of a single service.' },
        { num: 3, title: 'Shared libraries are the exception', detail: 'A shared-library subdomain is the one subdomain that may be used by multiple services.' },
        { num: 4, title: 'Ownership follows the subdomains', detail: 'A service is owned by the team (or teams) that owns its non-library subdomains.' }
      ],
      program: `// DESIGN SIDE — assign each subdomain to exactly one service (shared library excepted)
// PARTIES: ARC = architect applying the microservice pattern
// STATE (before):
//    subdomains : { "ProductCatalog":{type:"business"}, "Inventory":{type:"business"}, "Order":{type:"business"}, "Delivery":{type:"business"}, "CommonLib":{type:"library"} }
//    services : []
// DEF: decompose · CALLED BY: ARC grouping subdomains into services
// -> subdomain_list : ["ProductCatalog","Inventory","Order","Delivery","CommonLib"]
//    step 1 · create a service per business subdomain : services : [] -> ["catalog","inventory","order","delivery"]
//    step 2 · place each subdomain in exactly one service : placement : "unassigned" -> "one-to-one"
//    step 3 · share the library across services : CommonLib.owners : 0 -> 4   BECAUSE a shared-library subdomain is the one allowed exception used by multiple services
// <- service_count : 4 · each non-library subdomain belongs to a single service
//    alt merge two subdomains into one service : services : 4 -> 3  (a service may hold more than one subdomain)`
    },
    {
      section: 'Independent deployability',
      color: 'orange',
      motivation: `Independence is the whole point: each service gets its own repository and pipeline so teams ship without waiting on each other.`,
      steps: [
        { num: 1, title: 'Own source code repository', detail: 'To be independently deployable, each service typically has its own source code repository.' },
        { num: 2, title: 'Own deployment pipeline', detail: 'Each service also has its own deployment pipeline, which builds, tests and deploys the service.' },
        { num: 3, title: 'Teams ship independently', detail: 'A team can develop, test and deploy its service independently of other teams.' },
        { num: 4, title: 'Fast per-service feedback', detail: 'Each service is fast to test since it is relatively small, and can be deployed independently.' }
      ],
      program: `// DEPLOY SIDE — two services ship independently through their own pipelines
// PARTIES: TO = Team Orders · TI = Team Inventory · P1 = order pipeline · P2 = inventory pipeline
// DEF: built — the services compiled in this release by their own pipeline; here built = ["order"]
// DEF: service — an independently deployable, loosely coupled component with its own repository and pipeline; here service "order" = "v1.0"
// STATE (before):
//    repos : { "order": {pipeline:"P1", tests:12}, "inventory": {pipeline:"P2", tests:8} }
//    deployed : { "order": "v1.0", "inventory": "v1.0" }
//    built_services : []
//    tests_run : 20
// DEF: release · CALLED BY: TO shipping order v1.1 while TI is mid-change
// -> change : "order v1.1"
//    step 1 · build only the order service : built_services : [] -> ["order"]
//    step 2 · run only order tests : tests_run : 20 -> 12   BECAUSE each service has its own pipeline and its own tests
//    step 3 · deploy order alone : deployed["order"] : "v1.0" -> "v1.1"
//    step 4 · inventory pipeline never runs (its service is unchanged)
// <- release : "order v1.1 live" · TO did not wait for TI
//    alt a single shared pipeline : both services rebuild -> tests_run : 12 -> 20 (lockstep)`
    },
    {
      section: 'Distributed operations',
      color: 'orange',
      motivation: `Some system operations are local to one service, but the ones that span services must be rebuilt from local transactions because each service has its own database.`,
      steps: [
        { num: 1, title: 'Local vs distributed operations', detail: 'Some system operations are local to a single service, while others are distributed across multiple services.' },
        { num: 2, title: 'Each service has its own database', detail: 'Loose coupling requires each service to have its own database, so a single ACID transaction cannot span services.' },
        { num: 3, title: 'A distributed operation is a saga', detail: 'A distributed command is implemented as a saga: a series of local transactions.' },
        { num: 4, title: 'The API gateway is the entry point', detail: 'An API gateway is typically the application\'s entry point, and it uses the service collaboration patterns for distributed operations.' }
      ],
      program: `// ORDER SIDE — a distributed command spans three services as a saga of local transactions
// PARTIES: API = API gateway · OSV = order service · ISV = inventory service · CSV = credit service
// DEF: local — a transaction confined to one service and its own database, with no cross-service commit; here local txn "T1" = {service:"order", state:"NEW"}
// DEF: txn — a transaction, the atomic unit of work each service runs against its own database; here txn = "T1"
// STATE (before):
//    local_txns : { "T1": {service:"order", state:"NEW"}, "T2": {service:"inventory", state:"NEW"}, "T3": {service:"credit", state:"NEW"} }
// DEF: placeOrder · CALLED BY: API routing a client request to the order service
// -> order_id : "PO-2001" · -> amount : 40
//    step 1 · local txn in OSV : local_txns["T1"].state : "NEW" -> "DONE"  (creates the order)
//    step 2 · local txn in CSV : local_txns["T3"].state : "NEW" -> "DONE"  (reserves credit)
//    step 3 · local txn in ISV : local_txns["T2"].state : "NEW" -> "DONE"  (reserves stock)
//    step 4 · each service commits against its OWN database — no single ACID commit
// <- saga : "PO-2001" completed via 3 local transactions (eventually consistent, not ACID)
//    alt step 3 fails : compensating transactions undo T1 and T3 -> local_txns["T1"].state : "DONE" -> "UNDONE"`
    },
    {
      section: 'The collaboration patterns and known uses',
      color: 'orange',
      motivation: `Four patterns rebuild a distributed operation from local pieces, and the big web properties show them at scale.`,
      steps: [
        { num: 1, title: 'Saga', detail: 'Saga implements a distributed command as a series of local transactions.' },
        { num: 2, title: 'Command-side replica', detail: 'Command-side replica replicates read-only data to the service that implements a command.' },
        { num: 3, title: 'API composition and CQRS', detail: 'API composition and CQRS each implement a distributed query as a series of local queries.' },
        { num: 4, title: 'Transaction Outbox ties it together', detail: 'Saga, Command-side replica and CQRS use asynchronous messaging, and typically need the Transaction Outbox pattern to atomically update entities and send a message.' }
      ],
      program: `// GATEWAY SIDE — one distributed query becomes a series of local queries (API composition)
// PARTIES: GW = API gateway · SVC1..SVC6 = six backend services, each with its own DB
// STATE (before):
//    responses : []
//    fanout : 6
//    delivered : 0
// DEF: getHomeFeed · CALLED BY: a client device requesting its feed
// -> device : "smart-tv-8001" · -> api_call : 1
//    step 1 · fan out the query : pending_calls : 0 -> 6   BECAUSE each API call fans out to an average of six backend services
//    step 2 · each service queries its OWN database : responses : [] -> ["feed","recs","meta","subs","ads","profile"]
//    step 3 · compose the six results : composed : "none" -> "6-merged"
//    step 4 · deliver one page : delivered : 0 -> 1
// <- page : 1 response assembled from 6 local queries (no shared database)
//    alt a service is down : responses : 6 -> 5 (a partial page — availability trades off)`
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Distributed operations replace local ones', content: '<p><strong>Why.</strong> Splitting the application into services means some operations now span multiple services instead of running locally in one component.</p><p><strong>Claim.</strong> Some distributed operations are complex and hard to troubleshoot, potentially inefficient, and may need eventually consistent (non-ACID) transaction management.</p><p><strong>Grounding.</strong> The resulting-context drawbacks name complex, inefficient interactions and the need for non-ACID transactions because loose coupling requires each service to have its own database.</p><p><strong>In the wild.</strong> Amazon.com\'s website application calls 100-150 services to build a single web page.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Independently deployable, loosely coupled services', content: '<p><strong>Why.</strong> Independent deployability is what lets small teams ship fast, so each service needs its own repository and pipeline.</p><p><strong>Claim.</strong> Structure the application as a set of two or more independently deployable, loosely coupled services; each service owns one or more subdomains and typically has its own source repository and its own build, test and deploy pipeline.</p><p><strong>Grounding.</strong> The solution states each subdomain is part of a single service except shared-library subdomains, and an API gateway is typically the entry point.</p><p><strong>In the wild.</strong> Netflix, Amazon and eBay each evolved from a monolith into a service-oriented architecture of many backend services.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'A database per service forces sagas', content: '<p><strong>Why.</strong> Loose coupling requires each service to have its own database, so a single ACID transaction can no longer span services.</p><p><strong>Claim.</strong> Distributed operations must be implemented as a series of local transactions, which is why the service collaboration patterns exist.</p><p><strong>Grounding.</strong> The Saga, Command-side replica and CQRS patterns use asynchronous messaging and typically need the Transaction Outbox pattern to atomically update entities and send a message.</p><p><strong>In the wild.</strong> These patterns trade a single ACID commit for eventual consistency across services.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Four collaboration patterns rebuild the operation', content: '<p><strong>Why.</strong> A distributed operation still has to run somewhere, so the monolith\'s single operation is rebuilt from local pieces.</p><p><strong>Claim.</strong> Saga implements a distributed command as a series of local transactions; Command-side replica replicates read-only data to the command service; API composition and CQRS implement a distributed query as a series of local queries.</p><p><strong>Grounding.</strong> The issues section lists exactly these four service collaboration patterns.</p><p><strong>In the wild.</strong> The choice between them is a core design challenge when defining a good service architecture.</p>' }
    ]
  },
  quiz: [
    { "question": "What does the microservice architecture structure the application as?", "options": ["A. A single deployable component with one database", "B. A set of two or more independently deployable, loosely coupled services", "C. A shared library used by one service", "D. A load balancer with one instance"], "answer": 2, "explanation": "The solution is a set of two or more independently deployable, loosely coupled services. A single component with one database is the monolith (A); C and D are not the pattern either.", "conceptRef": "Independently deployable, loosely coupled services" },
    { "question": "Which subdomain is allowed to be used by multiple services?", "options": ["A. A core subdomain", "B. A generic subdomain", "C. A shared-library subdomain", "D. A supporting subdomain"], "answer": 3, "explanation": "Each subdomain is part of a single service except shared-library subdomains, which may be used by multiple services. Core, generic and supporting are a different (DDD) classification, not the sharing rule.", "conceptRef": "Independently deployable, loosely coupled services" },
    { "question": "Which service collaboration pattern implements a distributed query as a series of local queries?", "options": ["A. Saga", "B. API composition", "C. Command-side replica", "D. Transaction Outbox"], "answer": 2, "explanation": "API composition (and CQRS) implement a distributed query as a series of local queries. Saga implements a distributed command; Command-side replica replicates read-only data; Transaction Outbox atomically publishes messages — so A, C and D are wrong.", "conceptRef": "Four collaboration patterns rebuild the operation" },
    { "question": "On average, how many backend calls does each Netflix API call fan out to?", "options": ["A. One", "B. Two", "C. Six", "D. One hundred"], "answer": 3, "explanation": "Netflix handles over a billion calls a day to its streaming API from over 800 device types, and each API call fans out to an average of six backend calls.", "conceptRef": "Distributed operations replace local ones" }
  ]
});
