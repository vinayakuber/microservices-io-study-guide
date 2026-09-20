// Chapter 1 — Monolithic Architecture (Part 1: Architecture)
registerChapter({
  id: 'ch01',
  num: 1,
  title: 'Monolithic Architecture',
  pattern: 'Structure the application as a single deployable/executable component that uses a single database and contains all subdomains, so every operation is local.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 1 · microservices.io /patterns/monolithic.html',
  part: 1,
  flow: [
    {
      section: 'Subdomains and operations',
      color: 'orange',
      motivation: `The unit being organized is the subdomain — a slice of business functionality — and the behavior is a set of operations that mutate and query business entities.`,
      steps: [
        { num: 1, title: 'A subdomain is business functionality', detail: 'A subdomain is an implementable model of a slice of business functionality, a.k.a. a business capability.' },
        { num: 2, title: 'Business logic is entities plus adapters', detail: 'It consists of business logic — business entities (DDD aggregates) that implement business rules — plus adapters that communicate with the outside world.' },
        { num: 3, title: 'Operations are the behavior', detail: 'The subdomains implement the application\'s behavior, a set of system operations that mutate and query business entities.' },
        { num: 4, title: 'Operations arrive three ways', detail: 'An operation is invoked by a synchronous or asynchronous client request, by an event from another application or service, or by the passing of time.' }
      ],
      program: `// ORDER SIDE — one operation runs entirely inside ONE component (no network hops)
// PARTIES: CLI = customer client · APP = the monolith · DB = PostgreSQL 16 @ monolith-db-1
// DEF: entity — a business entity (a DDD aggregate) that implements business rules and holds state; here order entity "PO-2001" = {status:"DRAFT"}
// DEF: inventory — the Inventory subdomain's stock, keyed by SKU; here inventory entity "SKU-77" = {qty:5}
// DEF: order — the Order subdomain's data, keyed by purchase-order id; here order "PO-2001" = {status:"DRAFT"}
// STATE (before):
//    order_entities : { "PO-2001": {status:"DRAFT"} }
//    inventory_entities : { "SKU-77": {qty:5} }
// DEF: placeOrder · CALLED BY: CLI sending a synchronous request to APP
// -> order_id : "PO-2001" · -> sku : "SKU-77" · -> qty : 2
//    step 1 · reserve stock : inventory_entities["SKU-77"].qty : 5 -> 3   BECAUSE the operation mutates the Inventory subdomain's entity
//    step 2 · mark the order : order_entities["PO-2001"].status : "DRAFT" -> "CONFIRMED"
//    step 3 · record the credit check : credit_check : "none" -> "approved"   BECAUSE the Credit subdomain runs in the same process
// <- order_status : "CONFIRMED" · 0 network hops (all subdomains share one component)`
    },
    {
      section: 'The five dark energy forces',
      color: 'orange',
      motivation: `Five forces push the architecture toward many small components; they are the reasons a monolith eventually hurts.`,
      steps: [
        { num: 1, title: 'Simple components', detail: 'Simple components consisting of few subdomains are easier to understand and maintain than complex components.' },
        { num: 2, title: 'Team autonomy', detail: 'A team needs to develop, test and deploy its software independently of other teams.' },
        { num: 3, title: 'Fast deployment pipeline', detail: 'Fast feedback and high deployment frequency require components that are fast to build and test.' },
        { num: 4, title: 'Support multiple technology stacks', detail: 'Subdomains are sometimes implemented in a variety of technologies, and developers need to evolve the stack.' },
        { num: 5, title: 'Segregate by characteristics', detail: 'Subdomains may need different resource, availability and security characteristics, so they should be segregable.' }
      ],
      program: `// PIPELINE SIDE — one team's change rebuilds the ONE shared component
// PARTIES: TA = Team Orders · TBL = Team Billing · CI = the single pipeline
// STATE (before):
//    component : { subdomains: ["Orders","Billing"], artifact: "app.war" }
//    tests_run : 20
//    instances : 4
//    instances_restarted : 0
// DEF: change · CALLED BY: TA committing a one-line fix in the Orders subdomain
// -> commit : "fix tax rounding in Orders"
//    step 1 · rebuild the whole artifact : build_scope : "Orders only" -> "Orders + Billing (entire WAR)"
//    step 2 · rerun every subdomain's tests : tests_run : 20 -> 200   BECAUSE one artifact means every subdomain retests
//    step 3 · redeploy all instances : instances_restarted : 0 -> 4   BECAUSE a single WAR replaces every instance, including Billing's traffic
// <- release : "app.war" shipped · both teams' code goes out together
//    alt TBL has a broken test : TA's fix is blocked -> team autonomy lost`
    },
    {
      section: 'The five dark matter forces',
      color: 'orange',
      motivation: `Five opposing forces pull the architecture toward few components and local interactions; the monolith wins on every one of them.`,
      steps: [
        { num: 1, title: 'Simple interactions', detail: 'An operation that is local to a component, or a few simple interactions, is easier to understand and troubleshoot than a distributed one.' },
        { num: 2, title: 'Efficient interactions', detail: 'A distributed operation with many network round trips and large data transfers can be too inefficient.' },
        { num: 3, title: 'Prefer ACID over BASE', detail: 'It is easier to implement an operation as an ACID transaction than as an eventually consistent saga.' },
        { num: 4, title: 'Minimize runtime coupling', detail: 'Less runtime coupling maximizes availability and reduces the latency of an operation.' },
        { num: 5, title: 'Minimize design-time coupling', detail: 'Less design-time coupling reduces lockstep changes across services, which improves productivity.' }
      ],
      program: `// DATABASE SIDE — one operation spanning two subdomains stays ACID in ONE database
// PARTIES: APP = the monolith · DB = PostgreSQL 16 @ monolith-db-1
// DEF: credit — the Credit subdomain's ledger, keyed by customer id; here credit entity "CUST-9" = {used:100}
// DEF: entity — a business entity (a DDD aggregate) that implements business rules and holds state; here order entity "PO-2001" = {status:"DRAFT", total:0}
// DEF: order — the Order subdomain's rows, keyed by purchase-order id; here order "PO-2001" = {status:"DRAFT", total:0}
// STATE (before):
//    order_entities : { "PO-2001": {status:"DRAFT", total:0} }
//    credit_entities : { "CUST-9": {used:100} }
// DEF: placeOrder · CALLED BY: APP, invoked synchronously
// -> order_id : "PO-2001" · -> customer : "CUST-9" · -> amount : 40
//    step 1 · BEGIN local transaction T1 on DB (a single transaction, not a saga)
//    step 2 · write the order : order_entities["PO-2001"].status : "DRAFT" -> "PLACED"
//    step 3 · record the total : order_entities["PO-2001"].total : 0 -> 40
//    step 4 · consume credit : credit_entities["CUST-9"].used : 100 -> 140   BECAUSE both subdomains' rows live in the one database
//    step 5 · COMMIT T1 -> both writes durable together (atomic)
// <- result : "COMMITTED" · no eventual consistency, no distributed transaction
//    alt credit limit exceeded : ROLLBACK T1 -> total back to 0 and used back to 100 (all-or-nothing)`
    },
    {
      section: 'The monolith solution and its containment',
      color: 'orange',
      motivation: `The single component resolves the dark matter forces but risks the dark energy ones; the craft is containing those risks as the app grows.`,
      steps: [
        { num: 1, title: 'Single component, single database', detail: 'Structure the application as one deployable/executable component using a single database, containing all subdomains.' },
        { num: 2, title: 'All operations are local', detail: 'Because there is a single component, interactions are local, efficient and typically ACID.' },
        { num: 3, title: 'Drawbacks grow with size', detail: 'The drawbacks — complexity, less team autonomy, a slow pipeline, one stack, no segregation — worsen as the app and team count grow.' },
        { num: 4, title: 'Contain with a modular monolith', detail: 'Organize subdomains into vertical slices of presentation, business and persistence logic, and speed up the pipeline.' }
      ],
      program: `// BUILD SIDE — a modular monolith localizes a change to one vertical slice
// PARTIES: DEV = a developer in Team Orders · CI = build tool with incremental builds
// DEF: rebuilt — the modules recompiled in this build because only their files changed; here rebuilt = ["orders"]
// STATE (before):
//    modules : { "orders": {changed:false}, "billing": {changed:false} }
//    rebuilt_modules : []
//    skipped_modules : 0
//    tests_run : 200
// DEF: change · CALLED BY: DEV editing one file in the orders slice
// -> file : "orders/pricing.kt"
//    step 1 · detect the dirty module : modules["orders"].changed : false -> true
//    step 2 · incremental build : rebuilt_modules : [] -> ["orders"]   BECAUSE only the orders module changed
//    step 3 · skip the clean module : skipped_modules : 0 -> 1
//    step 4 · run only orders tests : tests_run : 200 -> 20   BECAUSE billing was not recompiled
// <- build : "orders" rebuilt · billing skipped
//    alt layered (non-modular) monolith : rebuild ALL slices -> tests_run : 20 -> 200 (back to full)`
    }
  ],
  interview: [
    {
      scenario: "You run an online store as a single Rails app backed by one Postgres database. A 'place order' operation must reserve stock, reserve credit, and mark the order — and if any one step fails, nothing may be left half-applied.",
      q: "How does the monolithic architecture keep a multi-subdomain operation atomic, and why is no distributed transaction or saga needed?",
      solution: "Because every subdomain lives in one component and one database, the whole operation runs as a single local ACID transaction — no network hops, no saga.",
      components: ["Single deployable component — every subdomain in one process", "Single database — one transaction spans all subdomains", "Local operation — no network round trips", "ACID commit — all writes durable together, or none"],
      diagram: `flowchart LR
  P["placeOrder(PO-5002)"] --> T1["BEGIN T1"]
  T1 --> O["write order row"]
  T1 --> C["reserve credit"]
  O --> CM["COMMIT T1"]
  C --> CM`,
      code: `// DATABASE SIDE — one operation spanning Orders + Credit stays a single ACID transaction in one database
// PARTIES: APP = the monolith · DB = PostgreSQL 16 @ monolith-db-1
// DEF: credit — the Credit subdomain's ledger, keyed by customer id; here credit entity "CUST-9" = {used:100}
// DEF: order — the Order subdomain's row, keyed by purchase-order id; here order "PO-5002" = {status:"DRAFT", total:0}
// STATE (before):
//    order_entities : { "PO-5002": {status:"DRAFT", total:0} }
//    credit_entities : { "CUST-9": {used:100} }
// DEF: placeOrder · CALLED BY: APP handling a synchronous client request
// -> order_id : "PO-5002" · -> customer : "CUST-9" · -> amount : 60
//    step 1 · BEGIN local transaction T1 on DB   (a single transaction, not a saga)
//    step 2 · write the order : order_entities["PO-5002"].status : "DRAFT" -> "PLACED"
//    step 3 · record the total : order_entities["PO-5002"].total : 0 -> 60
//    step 4 · consume credit : credit_entities["CUST-9"].used : 100 -> 160   BECAUSE both subdomains' rows live in the one database
//    step 5 · COMMIT T1   -> both writes durable together (atomic)
// <- result : "COMMITTED" · 0 network hops, no eventual consistency
//    alt credit limit exceeded : ROLLBACK T1 -> total back to 0, used back to 100 (all-or-nothing)`,
      tieback: "This is exactly the single-component, single-database solution and its all-local, ACID operations in this chapter.",
      refs: ["Subdomains and operations", "The monolith solution and its containment"],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    },
    {
      scenario: "Your monolith now has five subdomains and six teams. Team Orders commits a one-line tax fix, and the CI pipeline rebuilds the entire WAR and reruns every subdomain's tests, so a billing bug blocks the release.",
      q: "Which of the five dark energy forces is the pipeline hitting, and why does a single shared artifact cost team autonomy and a fast deployment pipeline?",
      solution: "A single shared artifact forces a full rebuild, full test, and full redeploy for every change — the dark energy forces the monolith cannot fully satisfy.",
      components: ["One shared artifact — the single app.war", "One pipeline — builds and tests every subdomain", "Full redeploy — every instance replaced together", "Six teams — blocked on each other's changes"],
      diagram: `flowchart LR
  C["tax fix in Orders"] --> B["rebuild whole WAR"]
  B --> T["rerun 200 tests"]
  T --> D["redeploy 4 instances"]
  D --> X["Billing change ships too"]`,
      code: `// PIPELINE SIDE — one team's one-line change rebuilds the single shared artifact for everyone
// PARTIES: TA = Team Orders · TBL = Team Billing · CI = the one pipeline
// STATE (before):
//    artifact : { subdomains: ["Orders","Billing"], file: "app.war" }
//    tests_run : 20
//    instances : 4
//    restarted : 0
// DEF: change · CALLED BY: TA committing a one-line fix in Orders
// -> commit : "fix tax rounding in Orders"
//    step 1 · rebuild the whole WAR : build_scope : "Orders only" -> "Orders + Billing"
//    step 2 · rerun every subdomain's tests : tests_run : 20 -> 200   BECAUSE one artifact means every subdomain retests
//    step 3 · redeploy all instances : restarted : 0 -> 4   BECAUSE a single WAR replaces every instance, Billing's traffic included
// <- release : "app.war" shipped · both teams' code goes out together
//    alt TBL has a broken test : TA's fix is blocked -> team autonomy is lost`,
      tieback: "This is exactly the dark energy forces — slow pipeline and lost team autonomy — in this chapter.",
      refs: ["The five dark energy forces", "The monolith solution and its containment"],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    },
    {
      scenario: "An architect weighs splitting the monolith into services. A skeptical reviewer asks what the monolith actually wins, given that most operations span two subdomains.",
      q: "Which five dark matter forces favor keeping one component, and how does the monolith satisfy each for a typical two-subdomain operation?",
      solution: "Simple and efficient local interactions, ACID over BASE, and minimal runtime and design-time coupling — the monolith wins on all five.",
      components: ["Simple interactions — one local call", "Efficient interactions — zero network round trips", "ACID transaction — no saga", "Low runtime + design-time coupling"],
      diagram: `flowchart LR
  OP["placeOrder + reserveCredit"] --> L["local, 0 hops"]
  OP --> A["one ACID txn"]
  OP --> NC["no cross-service coupling"]`,
      code: `// OPERATION SIDE — the five dark-matter forces keep one operation local, efficient, and ACID
// PARTIES: APP = the monolith · DB = PostgreSQL 16 @ monolith-db-1
// DEF: credit — the Credit subdomain's ledger; here credit entity "CUST-9" = {used:100}
// DEF: order — the Order subdomain's row; here order "PO-5002" = {total:0}
// STATE (before):
//    order_entities : { "PO-5002": {total:0} }
//    credit_entities : { "CUST-9": {used:100} }
//    local_ops : 0
// DEF: placeOrder · CALLED BY: APP running an operation across Order + Credit
// -> order_id : "PO-5002" · -> customer : "CUST-9" · -> amount : 30
//    step 1 · write the order in-process : order_entities["PO-5002"].total : 0 -> 30
//    step 2 · reserve credit in the same transaction : credit_entities["CUST-9"].used : 100 -> 130   BECAUSE both subdomains share one database
//    step 3 · the operation stays local : local_ops : 0 -> 1   BECAUSE no request leaves the process (0 network hops)
// <- result : "COMMITTED" in 0 hops · simple, efficient, ACID — every dark-matter force satisfied
//    alt microservices : local_ops : 1 -> 0, and the same operation becomes 2 network hops + an eventual saga`,
      tieback: "This is exactly the five dark matter forces that pull the architecture toward one component.",
      refs: ["The five dark matter forces"],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    },
    {
      scenario: "The monolith is getting painful to build, but the team is not ready to rewrite it as microservices. The lead asks how to contain the damage without splitting into services.",
      q: "What is a modular monolith, and how do vertical slices plus an incremental build contain the drawbacks of the monolith?",
      solution: "Organize subdomains into vertical slices of presentation, business, and persistence logic, and speed the pipeline with incremental builds.",
      components: ["Vertical slice — presentation + business + persistence per subdomain", "Incremental build — rebuild only changed slices", "Parallelized build + test steps", "Automated merge queue"],
      diagram: `flowchart LR
  E["edit orders/persistence"] --> S["orders slice"]
  S -->|rebuild| IB["incremental build"]
  BL["billing slice"] -.skip.-> IB`,
      code: `// SLICE SIDE — a modular monolith packages each subdomain as a vertical slice, containing the change
// PARTIES: DEV = a developer · CI = the build tool
// DEF: slice — a vertical cut through presentation, business and persistence for one subdomain; here slice "orders" = {layers: 0}
// STATE (before):
//    slices : { "orders": {layers: 0}, "billing": {layers: 0} }
//    changed_slices : []
//    tests_run : 200
// DEF: change · CALLED BY: DEV editing the orders persistence layer
// -> file : "orders/persistence/order-repo.kt"
//    step 1 · assign the file to its slice : slices["orders"].layers : 0 -> 3   BECAUSE a slice owns presentation + business + persistence
//    step 2 · mark only that slice dirty : changed_slices : [] -> ["orders"]
//    step 3 · rebuild just the slice : tests_run : 200 -> 20   BECAUSE billing's slice is untouched
// <- build : "orders" slice rebuilt · the change is contained to one vertical slice
//    alt no slices : every layer of every subdomain rebuilds -> tests_run : 20 -> 200`,
      tieback: "This is exactly the modular monolith — vertical slices plus incremental builds — in this chapter.",
      refs: ["The monolith solution and its containment"],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'All subdomains in one component', content: '<p><strong>Why.</strong> The monolithic architecture puts every subdomain into one deployable component, so no single team can evolve its slice in isolation.</p><p><strong>Claim.</strong> The single component resolves the five dark matter forces — interactions stay local and efficient, ACID is easy, and there is no runtime or design-time coupling between components.</p><p><strong>Grounding.</strong> The pattern\'s solution specifies a single deployable/executable component using a single database; all operations are local because there is a single component.</p><p><strong>In the wild.</strong> Netflix, Amazon.com and eBay each began as monoliths, and most web applications before 2012 were built this way.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Single component + single database', content: '<p><strong>Why.</strong> Keeping all subdomains in one process and one database makes every operation a local call with no network round trips.</p><p><strong>Claim.</strong> Structure the application as a single deployable/executable component that uses a single database and contains all of the application\'s subdomains.</p><p><strong>Grounding.</strong> A Java web application ships as a single WAR file on a container such as Tomcat; a Rails application is a single directory hierarchy deployed via Phusion Passenger on Apache/Nginx or JRuby on Tomcat.</p><p><strong>In the wild.</strong> You can run multiple instances behind a load balancer to scale and improve availability.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'The dark energy forces come back', content: '<p><strong>Why.</strong> As the application grows in size and in number of teams, the monolith\'s drawbacks become more severe.</p><p><strong>Claim.</strong> A monolith is harder to understand and maintain, gives teams less autonomy, slows the deployment pipeline, locks in a single technology stack, and cannot segregate subdomains by their characteristics.</p><p><strong>Grounding.</strong> The resulting-context drawbacks are that all teams share one code base and must coordinate, and one large application must be built and tested together.</p><p><strong>In the wild.</strong> The deployment pipeline is potentially slow since there is a single large application that needs to be built and tested.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'A modular monolith contains the damage', content: '<p><strong>Why.</strong> The key challenge is minimizing the drawbacks rather than eliminating the monolith outright.</p><p><strong>Claim.</strong> You can increase maintainability and team autonomy by organizing subdomains into vertical slices (presentation, business and persistence logic) and accelerate the pipeline with an automated merge queue, incremental builds, and parallelized build and test steps.</p><p><strong>Grounding.</strong> The issues section lists modularizing the monolith and applying physical design principles to reduce build-time coupling.</p><p><strong>In the wild.</strong> These mitigations reduce, but do not remove, the dark energy forces; the microservice architecture is the alternative pattern that addresses the limitations.</p>' }
    ]
  },
  quiz: [
    { "question": "What is a subdomain in this pattern?", "options": ["A. A deployable component that runs on Tomcat", "B. An implementable model of a slice of business functionality", "C. A load balancer in front of the monolith", "D. A message broker that delivers events"], "answer": 2, "explanation": "A subdomain is an implementable model of a slice of business functionality, a.k.a. a business capability — the unit the architecture organizes, not a deployment artifact or infrastructure (so A, C and D are wrong).", "conceptRef": "All subdomains in one component" },
    { "question": "Which force is one of the five dark ENERGY forces?", "options": ["A. Simple interactions", "B. Efficient interactions", "C. Team autonomy", "D. Prefer ACID over BASE"], "answer": 3, "explanation": "The five dark energy forces — simple components, team autonomy, fast deployment pipeline, multiple technology stacks, segregate by characteristics — push toward many components. Simple interactions, efficient interactions and ACID are dark matter forces that pull toward one component.", "conceptRef": "The dark energy forces come back" },
    { "question": "How are operations implemented in the monolithic solution?", "options": ["A. As distributed sagas across services", "B. As local operations, since there is a single component", "C. Via an API gateway", "D. As eventually consistent transactions"], "answer": 2, "explanation": "Since there is a single component, all operations are local — no distributed transactions, API gateway or eventual consistency is needed inside the monolith, which is why A, C and D are wrong.", "conceptRef": "Single component + single database" },
    { "question": "What happens to the monolith's drawbacks as the application grows?", "options": ["A. They disappear because operations stay local", "B. They become more severe as size and team count increase", "C. They only affect the deployment pipeline", "D. They are solved by running more instances"], "answer": 2, "explanation": "The drawbacks (complexity, less team autonomy, slow pipeline, single stack, no segregation) become more severe as the application grows in size and complexity and the number of teams increases; running more instances only scales, it does not fix these.", "conceptRef": "A modular monolith contains the damage" }
  ]
});
