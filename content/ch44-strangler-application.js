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
