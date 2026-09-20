registerChapter({
  id: 'ch44',
  num: 44,
  title: 'Strangler Application',
  pattern: 'A strangler application that incrementally builds a new microservice-based system around a legacy monolith, routing work to the new system as it takes over functionality.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 44 · microservices.io /patterns/refactoring/strangler-application.html',
  part: 10,
  flow: [
    {
      section: 'The migration problem',
      color: 'orange',
      motivation: `You have a working legacy monolith and want a microservice architecture, but the monolith cannot be rebuilt in one step. The answer is to migrate incrementally, building the new system gradually around the old one.`,
      steps: [
        { num: 1, title: 'You have a working monolith', detail: 'The legacy application runs the business today and cannot simply be switched off.' },
        { num: 2, title: 'You want microservices', detail: 'The team wants a microservice architecture, but the monolith cannot be rebuilt in a single step.' },
        { num: 3, title: 'Incremental replacement', detail: 'The migration proceeds by building the new system gradually around the old one, one piece at a time.' }
      ],
      program: `// MONOLITH SIDE — the strangler grows by moving one feature at a time out of the monolith
// PARTIES: MONO = legacy monolith · NEW = new strangler application · U1 = user
// STATE (before):
//    mono_features : { "catalog": true, "orders": true, "accounts": true }
//    new_features  : {}
// DEF: migrate · CALLED BY: the team for each feature, one at a time
// -> feature : "catalog"
//    step 1 · re-implement "catalog" as a microservice in NEW   // new_features : {} -> { "catalog": true }
//    step 2 · cut "catalog" traffic over to the new service   // mono_features.catalog : true -> false
//    step 3 · the monolith is left holding only the remaining features   // mono_features : { "catalog": true, "orders": true, "accounts": true } -> { "orders": true, "accounts": true }
// <- state : mono_features = { "orders": true, "accounts": true } · new_features = { "catalog": true } — one piece moved, not the whole monolith at once
`
    },
    {
      section: 'The strangler routes requests',
      color: 'orange',
      motivation: `The strangler application fronts both the new services and the legacy monolith, deciding per request which system handles it. Functionality already migrated is served by a microservice; everything else still falls back to the monolith.`,
      steps: [
        { num: 1, title: 'A router fronts both systems', detail: 'The strangler receives every request and decides which system handles it.' },
        { num: 2, title: 'Migrated paths go to new services', detail: 'Functionality already moved to a microservice is served by that service.' },
        { num: 3, title: 'Unmigrated paths fall back', detail: 'Everything else still goes to the monolith, so it keeps running as before.' },
        { num: 4, title: 'The strangler grows', detail: 'As more functionality is re-implemented, more paths move over, and the monolith shrinks.' }
      ],
      program: `// STRANGLER SIDE — one request is routed to a migrated microservice; an unmigrated path falls back to the monolith
// PARTIES: RTR = strangler router · NEW = new microservice · MONO = legacy monolith · U1 = user
// STATE (before):
//    route_table : { "/catalog": "NEW", "/orders": "MONO" }
// DEF: route · CALLED BY: RTR on each incoming request
// -> request : { "path": "/catalog" }
//    step 1 · look up "/catalog" in route_table   // matched : "" -> "NEW"   BECAUSE /catalog was already migrated
//    step 2 · forward the request to the matched backend   // target : "" -> "NEW"
//    step 3 · NEW serves the catalog from its own service
// <- response : "catalog items" from NEW — MONO never receives this request
//    alt path "/orders" : matched : "NEW" -> "MONO" · target : "" -> "MONO" — MONO still serves it, unchanged (fall back)
`
    },
    {
      section: 'Two kinds of service',
      color: 'orange',
      motivation: `The strangler application consists of two types of services: ones that re-implement functionality that previously lived in the monolith, and ones that add brand-new features. The new-feature services are useful because they demonstrate the value of microservices to the business.`,
      steps: [
        { num: 1, title: 'Re-implement monolith features', detail: 'Services that take over functionality that previously resided in the monolith.' },
        { num: 2, title: 'Add brand-new features', detail: 'Services that implement new features the monolith never had.' },
        { num: 3, title: 'Demonstrate the value', detail: 'The new-feature services are useful because they show the business the value of using microservices.' },
        { num: 4, title: 'Keep strangling', detail: 'The strangler keeps taking over monolith functionality piece by piece until the legacy application is no longer needed.' }
      ],
      program: `// STRANGLER SIDE — a brand-new feature lands in the new app, showing the business what microservices enable
// PARTIES: NEW = new strangler application · MONO = legacy monolith · RTR = strangler router · U1 = user
// DEF: brand — a brand-new feature with no monolith twin, added only to the new app; here "recommendations"
// DEF: route — a mapping from a request path to the system that serves it; here "/catalog" -> "NEW"
// STATE (before):
//    new_features : { "catalog": true }        // re-implemented monolith features
//    brand_new    : {}                          // features with no monolith twin
//    route_table  : { "/catalog": "NEW" }
// DEF: add_feature · CALLED BY: the team to add a feature the monolith never had
// -> feature : "recommendations"
//    step 1 · build "recommendations" as a new microservice   // brand_new : {} -> { "recommendations": true }
//    step 2 · register it in the router   // route_table : { "/catalog": "NEW" } -> { "/catalog": "NEW", "/recommendations": "NEW" }
//    step 3 · record it as owned by NEW   // new_features : { "catalog": true } -> { "catalog": true, "recommendations": true }
// <- state : NEW now serves { "catalog": true, "recommendations": true } — MONO never had a recommendations feature to cut over
`
    }
  ],
  interview: [
    {
      scenario: 'Your team wants microservices but starts with a working monolith that runs the business today. Rebuilding it in one release is impossible, so you need a path that moves one piece at a time.',
      q: 'How does the strangler application approach migrating a monolith?',
      solution: 'The migration proceeds by building the new system gradually around the old one, re-implementing one feature at a time, so the monolith keeps running while the new system takes over piece by piece.',
      components: ['Working monolith — runs the business', 'New system — built gradually', 'One feature at a time — the increment', 'Monolith shrinks — as features move'],
      diagram: `flowchart LR
  MONO["Monolith"] -->|"re-implement search"| NEW["New system"]
  NEW -->|"search served"| NEW
  MONO -->|"keeps"| REST["checkout + accounts"]`,
      code: `// MONOLITH SIDE — the strangler grows by moving one feature at a time out of the monolith
// PARTIES: MONO = legacy monolith · NEW = new strangler application · U1 = user
// STATE (before):
//    mono_features : { "search": true, "checkout": true, "accounts": true }
//    new_features  : {}
// DEF: migrate · CALLED BY: the team for each feature, one at a time
// -> feature : "search"
//    step 1 · re-implement "search" as a microservice in NEW   // new_features : {} -> { "search": true }
//    step 2 · cut "search" traffic over to the new service   // mono_features.search : true -> false
//    step 3 · the monolith keeps only the remaining features   // mono_features : { "search": true, "checkout": true, "accounts": true } -> { "checkout": true, "accounts": true }
// <- state : mono_features = { "checkout": true, "accounts": true } · new_features = { "search": true } — one piece moved, not the whole monolith at once`,
      tieback: 'This is the migration stage — building the new system gradually around the old one, one feature at a time.',
      refs: ['The migration problem'],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    },
    {
      scenario: 'The strangler now fronts both the new services and the monolith. A request arrives for a path that has not been migrated yet, and it must keep working exactly as before.',
      q: 'How does the strangler decide which system handles each request?',
      solution: 'A router fronts both systems and looks up each request\'s path in a route table; migrated paths go to new services, and unmigrated paths fall back to the monolith so it keeps running as before.',
      components: ['Router — fronts both systems', 'Route table — path to backend', 'Migrated paths — new services', 'Unmigrated paths — fall back to the monolith'],
      diagram: `flowchart LR
  RTR["Strangler router"] -->|"/search"| NEW["New search service"]
  RTR -->|"/checkout"| MONO["Monolith"]
  RTR -->|"lookup"| T["route_table"]`,
      code: `// STRANGLER SIDE — a request for an unmigrated path falls back to the monolith, unchanged
// PARTIES: RTR = strangler router · NEW = new microservice · MONO = legacy monolith · U1 = user
// STATE (before):
//    route_table : { "/search": "NEW", "/checkout": "MONO" }
// DEF: route · CALLED BY: RTR on each incoming request
// -> request : { "path": "/checkout" }
//    step 1 · look up "/checkout" in route_table   // matched : "" -> "MONO"   BECAUSE /checkout has not been migrated yet
//    step 2 · forward to the matched backend   // target : "" -> "MONO"
//    step 3 · MONO serves checkout exactly as before
// <- response : "checkout page" from MONO — NEW never receives this request
//    alt path "/search" : matched : "MONO" -> "NEW" · target : "" -> "NEW" — NEW serves it, since /search was already migrated`,
      tieback: 'This is the routing stage — the router sends migrated paths to new services and everything else to the monolith.',
      refs: ['The strangler routes requests'],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    },
    {
      scenario: 'The strangler is more than re-hosting old features. You want to add a feature the monolith never had, and use it to show the business what microservices enable.',
      q: 'What two kinds of services make up the strangler application, and why are the new-feature services useful?',
      solution: 'One kind re-implements functionality that previously lived in the monolith, and the other implements brand-new features; the new-feature services are useful because they demonstrate to the business the value of using microservices.',
      components: ['Re-implemented features — take over monolith work', 'Brand-new features — no monolith twin', 'Value demonstration — the new features\' role', 'Ongoing strangling — until the monolith retires'],
      diagram: `flowchart LR
  NEW["New system"] -->|"re-implemented"| CHECKOUT["checkout"]
  NEW -->|"brand-new"| WISH["wishlist"]
  WISH -->|"demonstrates"| VALUE["value to business"]`,
      code: `// STRANGLER SIDE — a brand-new feature lands in the new app, showing the business what microservices enable
// PARTIES: NEW = new strangler application · MONO = legacy monolith · RTR = strangler router · U1 = user
// DEF: brand — a brand-new feature with no monolith twin, added only to the new app; here "wishlist"
// DEF: route — a mapping from a request path to the system that serves it; here "/search" -> "NEW"
// STATE (before):
//    new_features : { "search": true }        // re-implemented monolith features
//    brand_new    : {}                          // features with no monolith twin
//    route_table  : { "/search": "NEW" }
// DEF: add_feature · CALLED BY: the team to add a feature the monolith never had
// -> feature : "wishlist"
//    step 1 · build "wishlist" as a new microservice   // brand_new : {} -> { "wishlist": true }
//    step 2 · register it in the router   // route_table : { "/search": "NEW" } -> { "/search": "NEW", "/wishlist": "NEW" }
//    step 3 · record it as owned by NEW   // new_features : { "search": true } -> { "search": true, "wishlist": true }
// <- state : NEW now serves { "search": true, "wishlist": true } — MONO never had a wishlist feature to cut over`,
      tieback: 'This is the two-kinds stage — re-implemented features plus brand-new ones that demonstrate microservices\' value.',
      refs: ['Two kinds of service'],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    },
    {
      scenario: 'The migration is only half done, so the monolith and the strangler are both live. Your operations team now has two systems to deploy and run for the same business.',
      q: 'What is the cost of running the strangler alongside the monolith?',
      solution: 'During the migration the monolith and the strangler both run, and both must be operated and deployed, so you pay for two systems side by side for as long as the migration takes.',
      components: ['Monolith — still live', 'Strangler — also live', 'Two deploys — per release', 'The cost lasts — until the monolith retires'],
      diagram: `flowchart LR
  RELEASE["Release"] -->|"deploy"| MONO["Monolith"]
  RELEASE -->|"deploy"| NEW["Strangler"]
  MONO -->|"until retired"| COST["two systems to run"]
  NEW --> COST`,
      code: `// OPS SIDE — one release must deploy both systems, so the migration cost is two systems side by side
// PARTIES: MONO = legacy monolith · NEW = new strangler application · OPS = operations team
// STATE (before):
//    systems : { "MONO": true }           // only the monolith was running before migration
//    deploys : 0                          // systems deployed per release
// DEF: release · CALLED BY: OPS on each change
// -> version : "r2026-09"
//    step 1 · the strangler goes live alongside the monolith   // systems : { "MONO": true } -> { "MONO": true, "NEW": true }
//    step 2 · deploy both systems this release   // deploys : 0 -> 2   BECAUSE both must be operated and deployed
//    step 3 · the double cost persists while both are live   // retired : false -> false   // the monolith is not gone yet
// <- systems : 2 live · deploys : 2 per release · you pay for two systems for as long as the migration takes
//    alt migration complete : systems : { "MONO": true, "NEW": true } -> { "NEW": true }   BECAUSE the legacy monolith is finally retired`,
      tieback: 'This is the cost stage — two systems to run side by side until the strangling finishes and the legacy monolith is retired.',
      refs: ['Two systems to run'],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    }
  ],
  systemDesign: {
    pipeline: 'legacy monolith → strangler façade/router → new microservices',
    decomposition: [
      {
        box: 'legacy monolith — the running system that still serves unmigrated paths',
        role: 'legacy monolith',
        parts: [
          'checkout + accounts — features not yet moved',
          'Serves — any path the route table still points at it'
        ]
      },
      {
        box: 'strangler façade / router — fronts both systems and decides per request',
        role: 'router',
        parts: [
          'Route by path — looks up each path in the route table',
          'Incrementally replace — moves one feature at a time'
        ]
      },
      {
        box: 'new microservices — the growing strangler application',
        role: 'new microservices',
        parts: [
          'Migrated features — catalog, search re-implemented',
          'New features — recommendations, wishlist with no monolith twin'
        ]
      }
    ],
    wiring: "flowchart LR\n  RTR[\"strangler router\"] -->|\"path /catalog\"| NEW[\"new microservices\"]\n  RTR -->|\"path /orders (fall back)\"| MONO[\"legacy monolith\"]\n  RTR -->|\"lookup\"| T[(\"route_table\")]\n  NEW -->|\"serves\"| RSP[\"catalog items\"]\n  MONO -->|\"serves\"| RSP2[\"checkout + accounts\"]",
    program: `// SYSTEM DESIGN — strangler application: legacy monolith -> strangler façade/router -> new microservices
// PARTIES: RTR = strangler router (façade: looks up each request path in the path-to-backend map) · NEW = new microservices (serve the migrated paths) · MONO = legacy monolith (serves the unmigrated paths)
// DEF: route — one mapping from a request path to the system that serves it; here "/catalog" -> "NEW"
// DEF: route_table — the full path-to-backend map the router holds; here { "/catalog":"NEW", "/orders":"MONO" }
// DEF: feature — one slice of functionality being moved out of the monolith; here "catalog"
// DEF: fallback — sending an unmigrated path to the monolith; here "/orders" -> "MONO"
// STATE (before):
//    route_table : { "/catalog":"NEW", "/orders":"MONO" }
//    migrated : {}
// DEF: route_request · CALLED BY: RTR on each incoming request
// -> request : { "path":"/catalog" }
//    step 1 · the router reads the path from the request    path : "" -> "/catalog"   BECAUSE the façade fronts both systems
//    step 2 · the router looks up "/catalog" in the route table    matched : "" -> "NEW"   // the path was already migrated
//    step 3 · the router forwards to the matched backend    target : "" -> "NEW"   // NEW serves the catalog
//    step 4 · the strangler records a migrated feature    migrated : {} -> { "catalog": true }   BECAUSE the strangler replaces the monolith one feature at a time
// <- response : "catalog items" from NEW · MONO never receives this request   BECAUSE the route table sends migrated paths to the new services
//    alt path "/orders" : matched : "NEW" -> "MONO" · target : "" -> "MONO" — the monolith still serves it, unchanged (fall back)`
  },
  concepts: {
    cards: [
      {
        tag: 'problem',
        tagLabel: 'Problem',
        title: 'Migrating the monolith',
        content: '<p><strong>Why.</strong> A team wants microservices but starts with a working legacy monolith that cannot be replaced in one move.</p><p><strong>Claim.</strong> The question the pattern answers: how do you migrate a legacy monolithic application to a microservice architecture?</p><p><strong>Grounding.</strong> This is the pattern\'s problem statement, taken verbatim.</p><p><strong>In the wild.</strong> A long-running monolith whose features are moved to services a few at a time.</p>'
      },
      {
        tag: 'solution',
        tagLabel: 'Solution',
        title: 'Strangler application',
        content: '<p><strong>Why.</strong> You cannot replace the monolith in one step, so you need a way to build the new system gradually while the old one keeps running.</p><p><strong>Claim.</strong> Modernize by incrementally developing a new (strangler) application around the legacy application; the strangler has a microservice architecture.</p><p><strong>Grounding.</strong> This is the pattern\'s solution statement, which adds that the strangler consists of two types of services: re-implemented monolith functionality, and new features.</p><p><strong>In the wild.</strong> A router that forwards migrated paths to new services and leaves the rest on the monolith.</p>'
      },
      {
        tag: 'tradeoff',
        tagLabel: 'Tradeoff',
        title: 'Two systems to run',
        content: '<p><strong>Why.</strong> During the migration the monolith and the strangler both run, and both must be operated and deployed.</p><p><strong>Claim.</strong> You pay for two systems side by side for as long as the migration takes.</p><p><strong>Grounding.</strong> The solution keeps the legacy application running while the strangler is built around it, so both are live at once.</p><p><strong>In the wild.</strong> A router that sends some paths to new services and the rest to the monolith during the same release.</p>'
      },
      {
        tag: 'tradeoff',
        tagLabel: 'Tradeoff',
        title: 'Two kinds of service',
        content: '<p><strong>Why.</strong> The strangler mixes services that replace monolith functionality with services that add brand-new features.</p><p><strong>Claim.</strong> You must manage both kinds: re-implementations and net-new features; the new-feature services are useful because they demonstrate microservices\' value to the business.</p><p><strong>Grounding.</strong> The reference names both types explicitly and calls the new-feature services particularly useful for showing business value.</p><p><strong>In the wild.</strong> A recommendations service that never existed in the monolith, shipped alongside a migrated catalog service.</p>'
      }
    ]
  },
  quiz: [
    {
      "question": "How does the strangler application migrate a monolith?",
      "options": [
        "A. Rewrite the whole monolith in one release",
        "B. Incrementally build a new application around the legacy application",
        "C. Freeze the monolith and start over from scratch",
        "D. Split the monolith's database into many databases first"
      ],
      "answer": 2,
      "explanation": "The solution is to modernize by incrementally developing a new (strangler) application around the legacy application. A, C and D are one-shot or wrong-order approaches the pattern does not prescribe.",
      "conceptRef": "Strangler application"
    },
    {
      "question": "What two types of services make up the strangler application?",
      "options": [
        "A. Services that re-implement monolith functionality, and services that implement new features",
        "B. Services that cache data, and services that log events",
        "C. Services that authenticate users, and services that bill customers",
        "D. Services that run on VMs, and services that run in containers"
      ],
      "answer": 1,
      "explanation": "The reference names exactly these two types: re-implementations of functionality that previously resided in the monolith, and services for new features. B, C and D are unrelated groupings.",
      "conceptRef": "Two kinds of service"
    },
    {
      "question": "Why are the new-feature services particularly useful?",
      "options": [
        "A. They are faster to write than re-implementations",
        "B. They demonstrate to the business the value of using microservices",
        "C. They never need to talk to the monolith",
        "D. They are the only services the router needs"
      ],
      "answer": 2,
      "explanation": "The reference says the new-feature services are particularly useful since they demonstrate to the business the value of using microservices. The other options are not stated.",
      "conceptRef": "Two kinds of service"
    },
    {
      "question": "A request arrives for a path the strangler has not yet migrated. What happens?",
      "options": [
        "A. It is dropped",
        "B. It falls back to the monolith",
        "C. It is queued until the path is migrated",
        "D. It is retried against every service"
      ],
      "answer": 2,
      "explanation": "The strangler routes migrated paths to the new services and leaves everything else on the monolith, so an unmigrated path falls back to the monolith. A, C and D describe behaviors the pattern does not have.",
      "conceptRef": "Strangler application"
    }
  ]
});
