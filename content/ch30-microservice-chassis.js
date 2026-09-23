registerChapter({
  id: 'ch30',
  num: 30,
  title: 'Microservice Chassis',
  pattern: 'A shared framework that packages reusable build logic and cross-cutting-concern mechanisms so every new service starts production-ready instead of re-wiring setup.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 30 (p.379) · microservices.io /patterns/microservice-chassis.html',
  part: 8,
  flow: [
    {
      section: 'The setup tax',
      color: 'orange',
      motivation: `Every service must be built, tested, packaged, and given cross-cutting concerns before its business logic can start. That one-to-two-day cost is trivial for one monolith but unaffordable across tens or hundreds of services.`,
      steps: [
        { num: 1, title: 'Build logic', detail: 'Builds, tests, and packages into a production-ready format such as a Docker image — in Java, Gradle or Maven plus CI config (CircleCI, GitHub Actions).' },
        { num: 2, title: 'Cross-cutting concerns', detail: 'Security via an Access Token, externalized configuration, logging, a health-check URL, metrics, and distributed tracing.' },
        { num: 3, title: 'Microservice extras', detail: 'Service registration and discovery, plus circuit breakers for partial failure, add to the per-service burden.' },
        { num: 4, title: 'Days per service', detail: 'Setup takes one to two days per service — affordable for a monolith, not for tens of services.' }
      ],
      program: `// TEAM SIDE — wiring six cross-cutting concerns once per service versus once in a chassis
// PARTIES: SVC1 = Order Service · SVC2 = Customer Service · SVC3 = Kitchen Service
// DEF: chassis — the shared framework that wires the 6 cross-cutting concerns once, not per service; here chassis_wiring = { chassis: 0 }
// DEF: manual — wired by hand, one service at a time; here manual_wiring = { SVC1: 0, SVC2: 0, SVC3: 0 } = 18 wirings total
// DEF: wiring — the act of connecting a cross-cutting concern to a service; here 3 services x 6 concerns = 18 wirings
// STATE (before):
//    manual_wiring : { SVC1: 0, SVC2: 0, SVC3: 0 }       // concerns wired by hand, per service
//    chassis_wiring : { chassis: 0 }                     // concerns wired once, inside the chassis
// DEF: setup · CALLED BY: a team standing up 3 new services
// -> concern_count : 6   // = security + config + logging + health + metrics + tracing
// -> service_count : 3
//    step 1 · wire SVC1 by hand    manual_wiring.SVC1 : 0 -> 6   BECAUSE each service re-implements the 6 concerns
//    step 2 · wire SVC2 by hand    manual_wiring.SVC2 : 0 -> 6
//    step 3 · wire SVC3 by hand    manual_wiring.SVC3 : 0 -> 6
//    step 4 · total by hand = 3 services x 6 concerns = 18 wirings
// <- outcome : manual_wiring : { SVC1: 6, SVC2: 6, SVC3: 6 } = 18 wirings total
//    alt chassis : wire once -> chassis_wiring.chassis : 0 -> 6, then SVC1/SVC2/SVC3 inherit = 6 wirings, not 18`
    },
    {
      section: 'What the chassis implements',
      color: 'orange',
      motivation: `The chassis is the foundation: reusable build logic and mechanisms for cross-cutting concerns, assembled once and inherited by each service. Adopting it wires a new service in minutes instead of days.`,
      steps: [
        { num: 1, title: 'Reusable build logic', detail: 'The chassis ships build plugins (for example Gradle plugins) that build, test, and package a service.' },
        { num: 2, title: 'Cross-cutting mechanisms', detail: 'It assembles and configures a collection of frameworks and libraries for security, logging, health checks, metrics, and tracing.' },
        { num: 3, title: 'Technology-specific boilerplate', detail: 'It also supplies a database connection pool and HTTP request boilerplate.' },
        { num: 4, title: 'Service Template on top', detail: 'The Service Template is a sample service that uses the chassis, holding the code and configuration that does not belong in it.' }
      ],
      program: `// ORDER SERVICE SIDE — a new service adopts the chassis and inherits the cross-cutting wiring
// PARTIES: SVC = Order Service · CHS = chassis framework 2.4.0 · REG = service registry
// STATE (before):
//    svc : { build: "none", security: "none", metrics: "none", tracing: "none", registered: false }
// DEF: adopt_chassis · CALLED BY: a developer scaffolding SVC
// -> chassis_version : "2.4.0"
//    step 1 · add the chassis Gradle plugin          svc.build : "none" -> "gradle-plugin:2.4.0"
//    step 2 · chassis wires access-token security    svc.security : "none" -> "access-token-check"
//    step 3 · chassis wires metrics                  svc.metrics : "none" -> "counter:orders_created"
//    step 4 · chassis wires tracing                  svc.tracing : "none" -> "trace-id-filter"
//    step 5 · chassis self-registers SVC with REG    svc.registered : false -> true
// <- outcome : svc : { build:"gradle-plugin:2.4.0", security:"access-token-check", metrics:"counter:orders_created", tracing:"trace-id-filter", registered:true }`
    },
    {
      section: 'Updating via version bumps',
      color: 'orange',
      motivation: `Build logic and cross-cutting concerns change over time. With a chassis, a fix is made once and reaches every service through a version bump; with a Service Template it is copy/pasted into each codebase.`,
      steps: [
        { num: 1, title: 'Release once', detail: 'Release a new version of the chassis framework containing the needed change.' },
        { num: 2, title: 'Bump each service', detail: 'Update each service to use the new chassis version.' },
        { num: 3, title: 'Everything stays current', detail: 'Dependencies, build logic, and cross-cutting logic are kept up to date together.' },
        { num: 4, title: 'Contrast: template', detail: 'A Service Template is copy/paste programming — each service must be edited individually when logic changes.' }
      ],
      program: `// TEAM SIDE — a chassis upgrade delivers one fix to every service via a version bump
// PARTIES: SVC1 = Order Service · SVC2 = Customer Service · SVC3 = Kitchen Service
// STATE (before):
//    deps : { SVC1: "chassis:2.3.0", SVC2: "chassis:2.3.0", SVC3: "chassis:2.3.0" }
// DEF: upgrade · CALLED BY: the team releasing chassis 2.4.0 (a logging fix)
// -> new_version : "2.4.0"
//    step 1 · release the chassis once at "2.4.0"
//    step 2 · SVC1 bumps its dependency     deps.SVC1 : "chassis:2.3.0" -> "chassis:2.4.0"
//    step 3 · SVC2 bumps its dependency     deps.SVC2 : "chassis:2.3.0" -> "chassis:2.4.0"
//    step 4 · SVC3 bumps its dependency     deps.SVC3 : "chassis:2.3.0" -> "chassis:2.4.0"
// <- outcome : deps : { SVC1: "chassis:2.4.0", SVC2: "chassis:2.4.0", SVC3: "chassis:2.4.0" } · the fix reaches all 3 services
//    alt service template : the fix is copied-and-pasted into 3 separate codebases, one edit per service`
    },
    {
      section: 'One chassis per language',
      color: 'orange',
      motivation: `A chassis is tied to a programming language and framework, so a second language forces a second chassis. That is the pattern's main issue: it can be an obstacle to adopting a new language or framework.`,
      steps: [
        { num: 1, title: 'Language-specific frameworks', detail: 'Java starts from Spring Boot/Spring Cloud or Dropwizard; Go starts from Gizmo, Micro, or Go kit.' },
        { num: 2, title: 'Second language, second chassis', detail: 'Each programming language/framework you want to use needs its own chassis.' },
        { num: 3, title: 'Adoption obstacle', detail: 'Building a second chassis is work, so it can block adopting a new language or framework.' }
      ],
      program: `// TEAM SIDE — a second language forces a second chassis, so upkeep doubles
// PARTIES: JVM = Java services · GO = Go services
// STATE (before):
//    chassis : { JVM: "chassis-java:2.4.0", GO: "none" }
//    chassis_count : 1
//    concerns_in_go : 0
// DEF: adopt_go · CALLED BY: the team adding its first Go service
// -> new_language : "Go"
//    step 1 · the JVM chassis cannot run Go -> build a second one   chassis_count : 1 -> 2
//    step 2 · build chassis-go on a Go framework base               chassis.GO : "none" -> "chassis-go:1.0.0"   BECAUSE Gizmo/Micro/Go kit serve Go, not Java
//    step 3 · re-implement the same concerns in Go                  concerns_in_go : 0 -> 6   BECAUSE security+config+logging+health+metrics+tracing all repeat
// <- outcome : chassis : { JVM: "chassis-java:2.4.0", GO: "chassis-go:1.0.0" } · concerns_in_go : 6 · 2 chassis to keep current
//    alt single-language : only 1 chassis to maintain, but Go adoption stays blocked`
    }
  ],
  interview: [
    {
      scenario: "The team is standing up three new services, and each one needs the same six cross-cutting concerns wired before any business logic can start. Doing it by hand costs one to two days per service.",
      q: "What is the per-service setup tax, and how does a chassis change the arithmetic?",
      solution: "Every service needs build logic and cross-cutting concerns (security, config, logging, health check, metrics, tracing) plus registration/discovery and circuit breakers; wiring them once in a chassis turns N services times 6 concerns into 6 wirings, not 6N.",
      components: ["Order Service", "Customer Service", "Kitchen Service", "shared chassis"],
      diagram: "flowchart LR\n  C[\"Chassis\"] -->|\"wires 6 concerns once\"| W[\"concern wiring\"]\n  W -->|\"wires\"| O[\"Order Service\"]\n  W -->|\"wires\"| U[\"Customer Service\"]\n  W -->|\"wires\"| K[\"Kitchen Service\"]\n  M[\"Manual: 3 x 6 = 18 wirings\"] -.->|\"vs\"| W",
      code: "// TEAM SIDE — wiring six cross-cutting concerns once per service versus once in a chassis\n// PARTIES: SVC1 = Order Service · SVC2 = Customer Service · SVC3 = Kitchen Service\n// DEF: wiring — the act of connecting a cross-cutting concern to a service; here 3 services x 6 concerns = 18 wirings\n// STATE (before):\n//    manual_wiring : { SVC1: 0, SVC2: 0, SVC3: 0 }       // concerns wired by hand, per service\n//    chassis_wiring : { chassis: 0 }                     // concerns wired once, inside the chassis\n// DEF: setup · CALLED BY: a team standing up 3 new services\n// -> concern_count : 6   // = security + config + logging + health + metrics + tracing\n// -> service_count : 3\n//    step 1 · wire SVC1 by hand    manual_wiring.SVC1 : 0 -> 6   BECAUSE each service re-implements the 6 concerns\n//    step 2 · wire SVC2 by hand    manual_wiring.SVC2 : 0 -> 6\n//    step 3 · wire SVC3 by hand    manual_wiring.SVC3 : 0 -> 6\n//    step 4 · total by hand = 3 services x 6 concerns = 18 wirings\n// <- outcome : manual_wiring : { SVC1: 6, SVC2: 6, SVC3: 6 } = 18 wirings total\n//    alt chassis : wire once -> chassis_wiring.chassis : 0 -> 6, then SVC1/SVC2/SVC3 inherit = 6 wirings, not 18",
      tieback: "This is the chapter's setup-tax problem: one or two days per service is unaffordable across many services, and the chassis centralizes the wiring.",
      refs: ["The setup tax"],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: "A developer scaffolds a new Order Service and wants it production-ready in minutes, not days — with build logic, security, metrics, and tracing already in place.",
      q: "What does the chassis implement, and what happens when a new service adopts it?",
      solution: "The chassis provides reusable build logic (e.g. Gradle plugins) and mechanisms for cross-cutting concerns; adopting it lets the service inherit the wiring instead of re-implementing it.",
      components: ["Order Service", "chassis framework 2.4.0", "Gradle plugin", "service registry"],
      diagram: "flowchart LR\n  D[\"Developer\"] -->|\"scaffolds\"| S[\"Order Service\"]\n  S -->|\"adopts\"| C[\"chassis 2.4.0\"]\n  C -->|\"wires\"| B[\"build\"]\n  C -->|\"wires\"| T[\"security / metrics / tracing\"]\n  C -->|\"registers\"| R[\"service registry\"]",
      code: "// ORDER SERVICE SIDE — a new service adopts the chassis and inherits the cross-cutting wiring\n// PARTIES: SVC = Order Service · CHS = chassis framework 2.4.0 · REG = service registry\n// STATE (before):\n//    svc : { build: \"none\", security: \"none\", metrics: \"none\", tracing: \"none\", registered: false }\n// DEF: adopt_chassis · CALLED BY: a developer scaffolding SVC\n// -> chassis_version : \"2.4.0\"\n//    step 1 · add the chassis Gradle plugin          svc.build : \"none\" -> \"gradle-plugin:2.4.0\"\n//    step 2 · chassis wires access-token security    svc.security : \"none\" -> \"access-token-check\"\n//    step 3 · chassis wires metrics                  svc.metrics : \"none\" -> \"counter:orders_created\"\n//    step 4 · chassis wires tracing                  svc.tracing : \"none\" -> \"trace-id-filter\"\n//    step 5 · chassis self-registers SVC with REG    svc.registered : false -> true\n// <- outcome : svc : { build:\"gradle-plugin:2.4.0\", security:\"access-token-check\", metrics:\"counter:orders_created\", tracing:\"trace-id-filter\", registered:true }",
      tieback: "This is the chapter's what-the-chassis-implements step: reusable build logic plus cross-cutting mechanisms, inherited on adoption.",
      refs: ["What the chassis implements"],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: "A logging vulnerability is fixed in the shared library. The team must push the fix to Order, Customer, and Kitchen services without editing each codebase by hand.",
      q: "How do services receive updates to build logic and cross-cutting concerns under the chassis pattern?",
      solution: "The team releases one new chassis version and bumps each service to it — the fix reaches every service through a version bump, versus copy/paste programming where a Service Template must be edited per service.",
      components: ["Order Service", "Customer Service", "Kitchen Service", "chassis release"],
      diagram: "flowchart LR\n  R[\"Release chassis 2.4.0\"] -->|\"bump\"| O[\"Order Service\"]\n  R -->|\"bump\"| U[\"Customer Service\"]\n  R -->|\"bump\"| K[\"Kitchen Service\"]\n  O -->|\"2.3.0 -> 2.4.0\"| V[\"fix delivered\"]",
      code: "// TEAM SIDE — a chassis upgrade delivers one fix to every service via a version bump\n// PARTIES: SVC1 = Order Service · SVC2 = Customer Service · SVC3 = Kitchen Service\n// STATE (before):\n//    deps : { SVC1: \"chassis:2.3.0\", SVC2: \"chassis:2.3.0\", SVC3: \"chassis:2.3.0\" }\n// DEF: upgrade · CALLED BY: the team releasing chassis 2.4.0 (a logging fix)\n// -> new_version : \"2.4.0\"\n//    step 1 · release the chassis once at \"2.4.0\"\n//    step 2 · SVC1 bumps its dependency     deps.SVC1 : \"chassis:2.3.0\" -> \"chassis:2.4.0\"\n//    step 3 · SVC2 bumps its dependency     deps.SVC2 : \"chassis:2.3.0\" -> \"chassis:2.4.0\"\n//    step 4 · SVC3 bumps its dependency     deps.SVC3 : \"chassis:2.3.0\" -> \"chassis:2.4.0\"\n// <- outcome : deps : { SVC1: \"chassis:2.4.0\", SVC2: \"chassis:2.4.0\", SVC3: \"chassis:2.4.0\" } · the fix reaches all 3 services\n//    alt service template : the fix is copied-and-pasted into 3 separate codebases, one edit per service",
      tieback: "This is the chapter's version-bump benefit: release once, bump each service, versus copy/paste per codebase.",
      refs: ["Updating via version bumps"],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: "The team adds its first Go service, but the chassis is a Java framework built on Spring Boot. The Go service cannot inherit it.",
      q: "What is the main issue of the Microservice Chassis pattern when a new language enters the picture?",
      solution: "A chassis is tied to a programming language and framework, so each new language needs its own chassis — building a second chassis re-implements the same concerns and can be an obstacle to adopting the new language.",
      components: ["Java chassis", "Go chassis", "Gizmo/Micro/Go kit", "second chassis"],
      diagram: "flowchart LR\n  J[\"Java services\"] -->|\"use\"| JC[\"chassis-java:2.4.0\"]\n  G[\"Go service\"] -.->|\"cannot use\"| JC\n  G -->|\"builds\"| GC[\"chassis-go:1.0.0\"]\n  GC -->|\"re-wires 6 concerns\"| X[\"duplicated work\"]",
      code: "// TEAM SIDE — a second language forces a second chassis, so upkeep doubles\n// PARTIES: JVM = Java services · GO = Go services\n// STATE (before):\n//    chassis : { JVM: \"chassis-java:2.4.0\", GO: \"none\" }\n//    chassis_count : 1\n//    concerns_in_go : 0\n// DEF: adopt_go · CALLED BY: the team adding its first Go service\n// -> new_language : \"Go\"\n//    step 1 · the JVM chassis cannot run Go, build a second one   chassis_count : 1 -> 2\n//    step 2 · build chassis-go on a Go framework base               chassis.GO : \"none\" -> \"chassis-go:1.0.0\"   BECAUSE Gizmo/Micro/Go kit serve Go, not Java\n//    step 3 · re-implement the same concerns in Go                  concerns_in_go : 0 -> 6   BECAUSE security+config+logging+health+metrics+tracing all repeat\n// <- outcome : chassis : { JVM: \"chassis-java:2.4.0\", GO: \"chassis-go:1.0.0\" } · concerns_in_go : 6 · 2 chassis to keep current\n//    alt single-language : only 1 chassis to maintain, but Go adoption stays blocked",
      tieback: "This is the chapter's one-chassis-per-language issue: adopting a new language means rebuilding the chassis and its concerns.",
      refs: ["One chassis per language"],
      problems: ["01-scale-from-zero-to-millions"]
    }
  ],
  systemDesign: {
    question: 'Design shared cross-cutting concerns. Premise: each service uses a chassis framework of shared libraries for security, logging, and metrics, so teams do not rebuild the same plumbing per service.',
    pipeline: 'service → chassis framework (libraries) → cross-cutting concerns',
    decomposition: [
      {
        box: 'Order Service — the new service',
        role: 'service',
        parts: [
          'adopts the chassis via a Gradle plugin',
          'inherits the cross-cutting wiring'
        ]
      },
      {
        box: 'chassis framework 2.4.0 — the shared libraries',
        role: 'chassis framework (libraries)',
        parts: [
          'externalized configuration + health-check URL',
          'logging, metrics (counter: orders_created), and tracing'
        ]
      },
      {
        box: 'the cross-cutting concerns',
        role: 'cross-cutting concerns',
        parts: [
          'security via an Access Token',
          'service registration/discovery + circuit breakers'
        ]
      }
    ],
    wiring: "flowchart LR\n  SVC[\"Order Service\"] -->|\"adopts\"| CHS[\"chassis framework 2.4.0\"]\n  CHS -->|\"wires\"| CFG[\"externalized config\"]\n  CHS -->|\"wires\"| LOG[\"logging + health check\"]\n  CHS -->|\"wires\"| MET[\"metrics counter: orders_created\"]\n  CHS -->|\"wires\"| TRC[\"tracing\"]\n  CHS -->|\"registers\"| REG[\"service registry\"]",
    program: `// SYSTEM DESIGN — microservice chassis: service (Order Service) -> chassis framework (shared libraries) -> cross-cutting concerns (security, config, logging, health, metrics, tracing)
// PARTIES: SVC = Order Service (adopts the chassis) · CHS = chassis framework 2.4.0 (shared libraries) · REG = service registry (registration target)
// DEF: concern — one cross-cutting capability the chassis wires; here 6 concerns = security + config + logging + health + metrics + tracing
// DEF: wiring — the act of connecting one concern to a service; here 3 services x 6 concerns = 18 wirings by hand, 6 in the chassis
// DEF: counter — a metric the chassis wires; here "counter:orders_created"
// STATE (before):
//    svc : { build:"none", security:"none", metrics:"none", registered:false }
//    wirings : 0
// DEF: adopt_chassis · CALLED BY: a developer scaffolding SVC
// -> chassis_version : "2.4.0"
//    step 1 · add the chassis Gradle plugin    svc.build : "none" -> "gradle-plugin:2.4.0"
//    step 2 · chassis injects security and metrics    svc.security : "none" -> "access-token-check" · svc.metrics : "none" -> "counter:orders_created"
//    step 3 · chassis self-registers SVC with REG    svc.registered : false -> true
//    step 4 · count the wirings done once, not per service    wirings : 0 -> 6  BECAUSE the chassis wires the 6 concerns once and every service inherits them
// <- outcome : svc { build:"gradle-plugin:2.4.0", security:"access-token-check", metrics:"counter:orders_created", registered:true } · wirings 6, not 18`
  },
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'The per-service setup tax', content: '<p><strong>Why.</strong> Every new service needs build logic and cross-cutting concerns before any business logic can start.</p><p><strong>Claim.</strong> One or two days of setup per service is fine for a monolith, but unaffordable across tens or hundreds of microservices.</p><p><strong>Grounding.</strong> The reference lists build logic (Gradle/Maven, Docker packaging, CI config) plus six cross-cutting concerns — security, externalized configuration, logging, health check, metrics, distributed tracing — and microservice extras like registration/discovery and circuit breakers.</p><p><strong>In the wild.</strong> Teams re-created this wiring by hand for every service until the chassis centralised it.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'A shared chassis framework', content: '<p><strong>Why.</strong> Every service needs the same build logic and cross-cutting mechanisms.</p><p><strong>Claim.</strong> A microservice chassis provides reusable build logic and mechanisms for cross-cutting concerns as one framework; the Service Template is a sample service built on it.</p><p><strong>Grounding.</strong> The chassis ships build plugins (Gradle plugins) and assembles frameworks for security, logging, health checks, metrics, and tracing; Java starts from Spring Boot/Spring Cloud or Dropwizard, Go from Gizmo, Micro, or Go kit.</p><p><strong>In the wild.</strong> Services depend on the chassis and inherit the wiring instead of re-implementing it.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Version bumps vs copy/paste', content: '<p><strong>Why.</strong> Build logic and cross-cutting concerns change over time.</p><p><strong>Claim.</strong> The chassis lets a team release one new version and bump each service, while a Service Template forces per-service edits — copy/paste programming.</p><p><strong>Grounding.</strong> The reference benefit: it is faster and easier to keep dependencies, build logic, and cross-cutting logic up to date by releasing a new chassis version.</p><p><strong>In the wild.</strong> The Service Template survives as a sample that holds code and configuration that does not belong in the chassis.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'One chassis per language', content: '<p><strong>Why.</strong> A chassis is tied to a programming language and framework.</p><p><strong>Claim.</strong> Adopting a new language or framework requires building a second chassis, which is an obstacle to adoption.</p><p><strong>Grounding.</strong> The reference issue: you need a microservice chassis for each programming language/framework you want to use.</p><p><strong>In the wild.</strong> A Java chassis does not run Go services, so a Go team rebuilds the same wiring.</p>' }
    ]
  },
  quiz: [
    { "question": "What is the main drawback of the Service Template approach?", "options": ["A. It requires a separate template per programming language.", "B. It is copy/paste programming — when build logic or cross-cutting concerns change, each service must be updated individually.", "C. It cannot package services into Docker images.", "D. It cannot include build logic."], "answer": 2, "explanation": "A Service Template is a source code template you copy, so a change must be repeated in every service — the copy/paste drawback the chassis avoids. Option A describes the chassis's own per-language issue, and C and D are false: templates do package services and include build logic.", "conceptRef": "Version bumps vs copy/paste" },
    { "question": "Which of these is a cross-cutting concern the reference lists?", "options": ["A. Service registration and discovery.", "B. Business rules for order validation.", "C. Database schema design.", "D. Feature flags for a UI."], "answer": 1, "explanation": "Service registration and discovery is one of the additional microservice cross-cutting concerns, alongside circuit breakers. Options B, C, and D are business or domain concerns, not cross-cutting concerns.", "conceptRef": "The per-service setup tax" },
    { "question": "How do services receive updates to build logic and cross-cutting concerns under the chassis pattern?", "options": ["A. Each service re-implements them by hand.", "B. You release a new chassis version and update each service to use it.", "C. A shared runtime patches services automatically.", "D. Changes are never needed."], "answer": 2, "explanation": "The benefit is releasing a new chassis version and bumping each service. Option A is the naive per-service approach, and C and D are not in the reference — updates are explicit version bumps, and changes do occur.", "conceptRef": "A shared chassis framework" },
    { "question": "What is one issue of the Microservice Chassis pattern?", "options": ["A. It only works for Java.", "B. It needs a chassis per programming language/framework, an obstacle to adopting a new language.", "C. It prevents the use of Gradle or Maven.", "D. It forces a monolith."], "answer": 2, "explanation": "The reference states you need a chassis for each language/framework you want to use, which can block adopting a new one. Option A is false (Go has Gizmo/Micro/Go kit), and C and D contradict the reference (Gradle/Maven are supported and the pattern is for microservices).", "conceptRef": "One chassis per language" }
  ]
});
