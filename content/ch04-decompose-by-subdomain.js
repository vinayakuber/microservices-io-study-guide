// Chapter 4 — Decompose by Subdomain (Part 1: Architecture)
registerChapter({
  id: 'ch04',
  num: 4,
  title: 'Decompose by Subdomain',
  pattern: 'Define services corresponding to Domain-Driven Design subdomains — distinct parts of the business, classified as core, supporting, or generic.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 4 · microservices.io /patterns/decomposition/decompose-by-subdomain.html',
  part: 1,
  flow: [
    {
      section: 'The domain and its subdomains',
      color: 'orange',
      motivation: `DDD calls the application's problem space the domain, and its parts are subdomains — the boundaries this pattern turns into services.`,
      steps: [
        { num: 1, title: 'The domain is the problem space', detail: 'DDD refers to the application\'s problem space — the business — as the domain.' },
        { num: 2, title: 'A domain has multiple subdomains', detail: 'A domain consists of multiple subdomains, and each subdomain corresponds to a different part of the business.' },
        { num: 3, title: 'Subdomains are the service boundaries', detail: 'Define services corresponding to DDD subdomains, so each part of the business becomes a service.' },
        { num: 4, title: 'An online store example', detail: 'The subdomains of an online store include product catalog, inventory management, order management and delivery management.' }
      ],
      program: `// DECOMPOSITION SIDE — the DDD domain (the business) splits into subdomains
// PARTIES: ARC = architect · DOM = the domain (the application's problem space)
// STATE (before):
//    domain : { parts: [] }
//    subdomains : []
// DEF: split · CALLED BY: ARC modeling the domain of an online store
// -> domain : "online store"
//    step 1 · split the problem space into parts : domain.parts : [] -> ["catalog","inventory","orders","delivery"]
//    step 2 · each part becomes a subdomain : subdomains : [] -> ["product catalog","inventory management","order management","delivery management"]
//    step 3 · tag each as a distinct part of the business : distinct_areas : 0 -> 4   BECAUSE each subdomain corresponds to a different part of the business
// <- subdomain_count : 4 · the domain holds multiple subdomains
//    alt a part is really two subdomains : subdomain_count : 4 -> 5 (a subdomain is found by iteration)`
    },
    {
      section: 'Classify each subdomain',
      color: 'orange',
      motivation: `Not every subdomain deserves the same investment, so DDD classifies them by business value before you build.`,
      steps: [
        { num: 1, title: 'Core subdomains', detail: 'Core subdomains are the key differentiator for the business and the most valuable part of the application.' },
        { num: 2, title: 'Supporting subdomains', detail: 'Supporting subdomains relate to what the business does but are not a differentiator; they can be implemented in-house or outsourced.' },
        { num: 3, title: 'Generic subdomains', detail: 'Generic subdomains are not specific to the business and are ideally implemented using off-the-shelf software.' },
        { num: 4, title: 'Invest where it matters', detail: 'The classification tells you where to concentrate in-house effort versus outsource or buy.' }
      ],
      program: `// CLASSIFICATION SIDE — each subdomain is core, supporting, or generic
// PARTIES: ARC = architect · BIZ = the business
// STATE (before):
//    subdomains : { "recommendations":{class:"unset"}, "accounting":{class:"unset"}, "email":{class:"unset"} }
// DEF: classify · CALLED BY: ARC rating each subdomain's value to the business
// -> subdomain : "recommendations"
//    step 1 · a differentiator is CORE : subdomains["recommendations"].class : "unset" -> "core"   BECAUSE it is the key differentiator and most valuable part
//    step 2 · related-but-not-differentiating is SUPPORTING : subdomains["accounting"].class : "unset" -> "supporting"  (in-house or outsourced)
//    step 3 · not business-specific is GENERIC : subdomains["email"].class : "unset" -> "generic"   BECAUSE it should be bought off the shelf
// <- classes : "core","supporting","generic" · investment priority: core first
//    alt every subdomain marked core : prioritize : 1 -> 3 (no differentiator is wrong — value is what matters)`
    },
    {
      section: 'Map subdomains to services',
      color: 'orange',
      motivation: `Each subdomain becomes one service, keeping the result cohesive and loosely coupled — the same forces as business-capability decomposition.`,
      steps: [
        { num: 1, title: 'One service per subdomain', detail: 'The corresponding microservice architecture has services corresponding to each subdomain.' },
        { num: 2, title: 'Cohesive services', detail: 'Each service implements a small set of strongly related functions, so services are cohesive.' },
        { num: 3, title: 'Loosely coupled services', detail: 'Each service encapsulates its implementation behind an API, so services are loosely coupled.' },
        { num: 4, title: 'Teams around business value', detail: 'Development teams are cross-functional, autonomous and organized around delivering business value rather than technical features.' }
      ],
      program: `// MAPPING SIDE — each subdomain of the online store becomes one service
// PARTIES: ARC = architect
// STATE (before):
//    subdomains : ["product catalog","inventory management","order management","delivery management"]
//    services : []
// DEF: map · CALLED BY: ARC turning subdomains into services
// -> subdomain_list : ["product catalog","inventory management","order management","delivery management"]
//    step 1 · one service per subdomain : services : [] -> ["catalog","inventory","order","delivery"]
//    step 2 · keep each service cohesive : cohesion : "unknown" -> "strong"   BECAUSE each service is one subdomain with one set of functions
//    step 3 · keep services loosely coupled : coupling : "unknown" -> "loose"   (each service owns its subdomain's model)
// <- service_count : 4 · services correspond to subdomains, not to technical layers
//    alt merge two subdomains : services : 4 -> 3  (a service may contain more than one subdomain)`
    },
    {
      section: 'Identifying the subdomains',
      color: 'orange',
      motivation: `Like business capabilities, subdomains are found by analyzing the business and its structure, starting from the org structure and the domain model.`,
      steps: [
        { num: 1, title: 'Understand the business', detail: 'Identifying subdomains requires understanding the business, its organizational structure and the different areas of expertise.' },
        { num: 2, title: 'Start from the organization structure', detail: 'Different groups within an organization might correspond to subdomains.' },
        { num: 3, title: 'Start from the domain model', detail: 'Subdomains often have a key domain object in the high-level domain model.' },
        { num: 4, title: 'Iterate', detail: 'Subdomains are best identified using an iterative process, refining boundaries over time.' }
      ],
      program: `// IDENTIFICATION SIDE — find subdomains from the org structure and the domain model
// PARTIES: ARC = architect
// DEF: domain — the business problem space DDD decomposes into subdomains; here the online store, whose key domain objects are "Order" and "Product"
// DEF: model — the high-level domain model holding the key domain objects that suggest subdomains; here { "Order":{}, "Product":{} } = 2 objects
// DEF: org — the organization structure whose groups may correspond to subdomains; here { "Catalog Team":{}, "Fulfillment Team":{} } = 2 groups
// STATE (before):
//    org_groups : { "Catalog Team":{}, "Fulfillment Team":{} }
//    domain_model : { "Order":{}, "Product":{} }
//    subdomains : []
// DEF: identify · CALLED BY: ARC deriving subdomains from two starting points
// -> group : "Fulfillment Team"
//    step 1 · an org group suggests a subdomain : subdomains : [] -> ["fulfillment"]
//    step 2 · a key domain object suggests another : domain_model["Order"].subdomain : "none" -> "order management"   BECAUSE subdomains often have a key domain object
//    step 3 · confirm the area of expertise : expertise : "none" -> "fulfillment operations"   BECAUSE areas of expertise mark distinct subdomains
// <- subdomains : ["fulfillment","order management"] · found from org structure + domain model
//    alt a subdomain is missed : subdomains : 2 -> 3 on a later pass (identification is iterative)`
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'The same decomposition question, a DDD lens', content: '<p><strong>Why.</strong> Decomposing into services is still unsolved, but now the business is modeled the way DDD describes it — as a domain of subdomains.</p><p><strong>Claim.</strong> The benefits of microservices still require careful functional decomposition; SRP and CCP still apply to the resulting services.</p><p><strong>Grounding.</strong> The context is the same as decompose-by-business-capability: small 6-10 person teams, one or more services each, benefits not automatic.</p><p><strong>In the wild.</strong> A service must stay small enough to be developed by a two-pizza team and be testable.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Services correspond to DDD subdomains', content: '<p><strong>Why.</strong> DDD calls the application\'s problem space the domain, and its parts are subdomains — natural service boundaries.</p><p><strong>Claim.</strong> Define services corresponding to DDD subdomains; a domain consists of multiple subdomains, each corresponding to a different part of the business.</p><p><strong>Grounding.</strong> The solution states each subdomain corresponds to a different part of the business.</p><p><strong>In the wild.</strong> An online store\'s subdomains include product catalog, inventory management, order management and delivery management.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Classify each subdomain: core, supporting, generic', content: '<p><strong>Why.</strong> Not every subdomain deserves the same investment, so DDD classifies them by business value.</p><p><strong>Claim.</strong> Core subdomains are the key differentiator and most valuable; supporting subdomains relate to the business but are not differentiators; generic subdomains are not business-specific and are ideally bought off the shelf.</p><p><strong>Grounding.</strong> The solution gives exactly this three-way classification.</p><p><strong>In the wild.</strong> The classification tells you where to concentrate in-house effort versus outsource or buy.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Identifying subdomains needs the business', content: '<p><strong>Why.</strong> Like capabilities, subdomains are found by understanding the business, not by reading code.</p><p><strong>Claim.</strong> Subdomains are identified by analyzing the business, its organizational structure and its areas of expertise, iteratively.</p><p><strong>Grounding.</strong> The issues section names organization structure and the high-level domain model — where subdomains often have a key domain object — as starting points.</p><p><strong>In the wild.</strong> Different groups in the organization might correspond to subdomains.</p>' }
    ]
  },
  quiz: [
    { "question": "In DDD, what is the domain?", "options": ["A. The application's database", "B. The application's problem space — the business", "C. A network of services", "D. A deployment artifact"], "answer": 2, "explanation": "DDD refers to the application's problem space — the business — as the domain. The database, network and deployment artifact are technical, not the domain.", "conceptRef": "Services correspond to DDD subdomains" },
    { "question": "Which subdomain class is the key differentiator and most valuable part of the application?", "options": ["A. Core", "B. Supporting", "C. Generic", "D. Shared library"], "answer": 1, "explanation": "Core subdomains are the key differentiator for the business and the most valuable part of the application. Supporting and generic are lower-value, and shared library is not a DDD class.", "conceptRef": "Classify each subdomain: core, supporting, generic" },
    { "question": "Which subdomain class is ideally implemented with off-the-shelf software?", "options": ["A. Core", "B. Supporting", "C. Generic", "D. In-house"], "answer": 3, "explanation": "Generic subdomains are not specific to the business and are ideally implemented using off-the-shelf software. Core and supporting are business-related (in-house or outsourced), so A, B and D are wrong.", "conceptRef": "Classify each subdomain: core, supporting, generic" },
    { "question": "Good starting points for identifying subdomains are...", "options": ["A. organization structure and the high-level domain model", "B. the API gateway and the message broker", "C. the CI pipeline and the cache", "D. the UI framework and the container runtime"], "answer": 1, "explanation": "The issues section names organization structure and the high-level domain model — where subdomains often have a key domain object — as starting points. The other options are infrastructure, not sources of subdomain boundaries.", "conceptRef": "Identifying subdomains needs the business" }
  ]
});
