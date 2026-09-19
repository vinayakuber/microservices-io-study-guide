// Chapter 3 — Decompose by Business Capability (Part 1: Architecture)
registerChapter({
  id: 'ch03',
  num: 3,
  title: 'Decompose by Business Capability',
  pattern: 'Define services corresponding to business capabilities — the things the business does in order to generate value.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 3 · microservices.io /patterns/decomposition/decompose-by-business-capability.html',
  part: 1,
  flow: [
    {
      section: 'Why decomposition must be deliberate',
      color: 'orange',
      motivation: `Microservice benefits are not automatic; they come only from a decomposition where each change touches one service — the goal of SRP and CCP.`,
      steps: [
        { num: 1, title: 'Benefits are not guaranteed', detail: 'Continuous delivery and small autonomous teams are achieved only by careful functional decomposition of the application into services.' },
        { num: 2, title: 'Apply the Single Responsibility Principle', detail: 'SRP defines a responsibility as a reason to change; a service should have one reason to change and implement a small set of strongly related functions.' },
        { num: 3, title: 'Apply the Common Closure Principle', detail: 'CCP says classes that change for the same reason belong in the same package, so a rule change touches only one service.' },
        { num: 4, title: 'Keep changes single-service', detail: 'Changes that affect multiple services require coordination across multiple teams, which slows development.' }
      ],
      program: `// CHANGE SIDE — one business rule change must touch one service (CCP), not many
// PARTIES: DEV = developer · SVC_O = order service · SVC_I = inventory service · SVC_D = delivery service
// STATE (before):
//    change_impact : { "SVC_O":0, "SVC_I":0, "SVC_D":0 }
//    teams_to_coordinate : 0
// DEF: change · CALLED BY: DEV changing the tax rule
// -> rule : "tax_rule"
//    step 1 · locate the owning service : owner : "unknown" -> "SVC_O"   BECAUSE the rule is packaged with the code that changes with it (CCP)
//    step 2 · edit only that service : change_impact["SVC_O"] : 0 -> 1
//    step 3 · coordinate one team : teams_to_coordinate : 0 -> 1
// <- services_touched : 1 · teams_to_coordinate : 1
//    alt rule scattered across 3 services : services_touched : 1 -> 3 (three teams must coordinate)`
    },
    {
      section: 'Business capabilities define the services',
      color: 'orange',
      motivation: `A business capability is what the business does to generate value, and it often maps to a business object — a stable, natural service boundary.`,
      steps: [
        { num: 1, title: 'A capability generates value', detail: 'A business capability is a concept from business architecture modeling: something the business does in order to generate value.' },
        { num: 2, title: 'Capabilities map to business objects', detail: 'A capability often corresponds to a business object — Order Management is responsible for orders, Customer Management for customers.' },
        { num: 3, title: 'Capabilities form a hierarchy', detail: 'Business capabilities are often organized into a multi-level hierarchy, such as Product/Service development and Product/Service delivery.' },
        { num: 4, title: 'One service per capability', detail: 'Define services corresponding to business capabilities, so an online store gets product catalog, inventory, order and delivery services.' }
      ],
      program: `// DECOMPOSITION SIDE — each business capability becomes one service
// PARTIES: ARC = architect · CAP = business-capability model
// STATE (before):
//    capabilities : { "product_catalog":{object:"Product"}, "inventory":{object:"Stock"}, "order":{object:"Order"}, "delivery":{object:"Shipment"} }
//    services : []
//    owners : {}
// DEF: decompose · CALLED BY: ARC mapping the online store's capabilities to services
// -> capability_set : ["product_catalog","inventory","order","delivery"]
//    step 1 · one service per capability : services : [] -> ["catalog","inventory","order","delivery"]
//    step 2 · attach the business object each capability manages : owners : {} -> {"catalog":"Product","inventory":"Stock","order":"Order","delivery":"Shipment"}
//    step 3 · place them under a top-level capability category : category : "none" -> "Product/Service delivery"   BECAUSE capabilities form a multi-level hierarchy
// <- service_count : 4 · each service corresponds to one business capability
//    alt merge delivery into order : services : 4 -> 3  (a capability group can map to one service)`
    },
    {
      section: 'Forces the decomposition must satisfy',
      color: 'orange',
      motivation: `A good decomposition keeps the architecture stable, services cohesive and loosely coupled, and each service small enough for a two-pizza team.`,
      steps: [
        { num: 1, title: 'Stable and cohesive', detail: 'The architecture must be stable, and a service should implement a small set of strongly related functions.' },
        { num: 2, title: 'Conform to CCP', detail: 'Things that change together should be packaged together, so each change affects only one service.' },
        { num: 3, title: 'Loosely coupled via an API', detail: 'Each service has an API that encapsulates its implementation, so the implementation can change without affecting clients.' },
        { num: 4, title: 'Small and testable', detail: 'Each service must be small enough to be developed by a two-pizza team of 6-10 people and be testable, with autonomous ownership.' }
      ],
      program: `// SIZING SIDE — a service must fit a two-pizza team (6-10 people) and hide its implementation behind an API
// PARTIES: ORG = engineering org
// STATE (before):
//    team : { members: 2 }
//    service_api : { exposed: 0 }
// DEF: size_check · CALLED BY: ORG validating a proposed service boundary
// -> members : 2
//    step 1 · grow the team into the 6-10 band : team.members : 2 -> 7   BECAUSE a service must be developable by a two-pizza team of 6-10 people
//    step 2 · encapsulate the implementation : service_api.exposed : 0 -> 1   BECAUSE loose coupling needs an API the client calls, not internals
//    step 3 · confirm the service is testable at its size : testable : "unknown" -> "yes"
// <- verdict : "fits" · 7 members in [6,10] · implementation hidden behind an API
//    alt team stays at 2 : verdict : "fits" -> "split the service"  (two people cannot own a too-large service)`
    },
    {
      section: 'Identifying the capabilities',
      color: 'orange',
      motivation: `You find capabilities by understanding the business — its purpose, structure, processes and expertise — starting from the org structure and the domain model.`,
      steps: [
        { num: 1, title: 'Understand the business first', detail: 'Identifying business capabilities requires understanding the organization\'s purpose, structure, business processes and areas of expertise.' },
        { num: 2, title: 'Start from the organization structure', detail: 'Different groups within an organization might correspond to business capabilities or capability groups.' },
        { num: 3, title: 'Start from the domain model', detail: 'Business capabilities often correspond to domain objects in the high-level domain model.' },
        { num: 4, title: 'Iterate', detail: 'Bounded contexts are best identified using an iterative process, refining the boundaries over time.' }
      ],
      program: `// IDENTIFICATION SIDE — find capabilities from the org structure and the domain model
// PARTIES: ARC = architect analyzing the organization
// STATE (before):
//    org_groups : { "Merchandising":{}, "Warehouse":{}, "Customer Service":{} }
//    domain_objects : { "Product":{}, "Order":{} }
//    capabilities : []
// DEF: identify · CALLED BY: ARC deriving capabilities from two starting points
// -> group : "Warehouse"
//    step 1 · map an org group to a capability : capabilities : [] -> ["inventory management"]
//    step 2 · cross-check the domain model : domain_objects["Order"].capability : "none" -> "order management"   BECAUSE capabilities often correspond to domain objects
//    step 3 · record the area of expertise : expertise : "none" -> "warehouse operations"   BECAUSE expertise marks a distinct capability area
// <- capabilities : ["inventory management","order management"] · found via org structure + domain model
//    alt a capability is missed : capabilities : 2 -> 3 on a later pass (identification is iterative)`
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Microservice benefits are not automatic', content: '<p><strong>Why.</strong> You get faster delivery only if you decompose the application into the right services; the benefits are not guaranteed by adopting microservices.</p><p><strong>Claim.</strong> Careful functional decomposition into cohesive services is what actually enables independent deployment and small autonomous teams.</p><p><strong>Grounding.</strong> The context states the two benefits are achieved only by careful functional decomposition, and applies SRP and CCP to service design.</p><p><strong>In the wild.</strong> A change that touches several services forces coordination across several teams, which slows development.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Services correspond to business capabilities', content: '<p><strong>Why.</strong> A business capability is a stable, value-generating unit of the business, so it makes a stable boundary for a service.</p><p><strong>Claim.</strong> Define services corresponding to business capabilities; a capability often corresponds to a business object — Order Management is responsible for orders, Customer Management for customers.</p><p><strong>Grounding.</strong> The solution defines a business capability as something a business does to generate value, drawn from business architecture modeling.</p><p><strong>In the wild.</strong> An online store decomposes into product catalog, inventory, order and delivery management, each becoming a service.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Capabilities form a multi-level hierarchy', content: '<p><strong>Why.</strong> Capabilities are not flat; they are organized into a hierarchy, so the depth you pick determines service size.</p><p><strong>Claim.</strong> An enterprise application has top-level categories such as Product/Service development, Product/Service delivery and Demand generation, with finer capabilities nested beneath them.</p><p><strong>Grounding.</strong> The solution states business capabilities are often organized into a multi-level hierarchy.</p><p><strong>In the wild.</strong> Choosing too coarse a level merges capabilities; too fine a level fragments them.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Identifying capabilities takes business understanding', content: '<p><strong>Why.</strong> You cannot derive capabilities from code alone; you must understand what the business does.</p><p><strong>Claim.</strong> Capabilities are identified by analyzing the organization\'s purpose, structure, business processes and areas of expertise, using an iterative process.</p><p><strong>Grounding.</strong> The issues section lists organization structure and the high-level domain model as starting points, and notes capabilities often correspond to domain objects.</p><p><strong>In the wild.</strong> Different groups within an organization might correspond to capabilities or capability groups.</p>' }
    ]
  },
  quiz: [
    { "question": "What is a business capability?", "options": ["A. A technical layer such as the database", "B. Something the business does in order to generate value", "C. A two-pizza team of 6-10 people", "D. A deployment pipeline"], "answer": 2, "explanation": "A business capability is a concept from business architecture modeling: something the business does in order to generate value. The other options are engineering artifacts, not capabilities.", "conceptRef": "Services correspond to business capabilities" },
    { "question": "Applying the Single Responsibility Principle to a service means it should...", "options": ["A. have one reason to change and implement a small set of strongly related functions", "B. share one database with every other service", "C. be deployed by every team", "D. expose no API"], "answer": 1, "explanation": "SRP defines a responsibility as a reason to change; a service should have only one reason to change and be cohesive. Sharing a database, cross-team deployment and hiding the API all contradict the pattern's forces.", "conceptRef": "Microservice benefits are not automatic" },
    { "question": "The Common Closure Principle states that...", "options": ["A. classes that change for the same reason should be in the same package", "B. every service must have its own database", "C. teams must be collocated", "D. changes must be deployed weekly"], "answer": 1, "explanation": "CCP states that classes that change for the same reason should be in the same package, so each change touches only one service. The other options are not part of CCP.", "conceptRef": "Microservice benefits are not automatic" },
    { "question": "Good starting points for identifying business capabilities are...", "options": ["A. the network topology and the load balancer", "B. the organization structure and the high-level domain model", "C. the CI pipeline and the merge queue", "D. the frontend framework and the database vendor"], "answer": 2, "explanation": "The issues section names organization structure and the high-level domain model as starting points. The other options describe infrastructure, not sources of business capability boundaries.", "conceptRef": "Identifying capabilities takes business understanding" }
  ]
});
