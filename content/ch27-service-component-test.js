registerChapter({
  id: 'ch27',
  num: 27,
  title: 'Service Component Test',
  pattern: 'A test suite that tests a service in isolation using test doubles for any services that it invokes.',
  aka: 'Chris Richardson · Microservice Patterns Ch. · microservices.io /patterns/testing/service-component-test.html',
  part: 6,
  flow: [
    {
      section: 'A service among many services',
      color: 'orange',
      motivation: `A service rarely stands alone; it invokes other services, so verifying it behaves correctly means exercising it and its outbound calls.`,
      steps: [
        { num: 1, title: 'The context', detail: 'You have applied the microservice architecture: the application is numerous services that often invoke each other.' },
        { num: 2, title: 'The obligation', detail: 'You must write automated tests that verify a service behaves correctly.' },
        { num: 3, title: 'The dependency', detail: 'Verifying a service means observing the calls it makes to the other services it invokes.' }
      ],
      program: `// SERVICE SIDE — a service invokes other services, so automated tests must verify it behaves correctly
// PARTIES: OSVC = Order Service · KSVC = Kitchen Service (dependency)
// STATE (before):
//    order : { id:"", state:"PENDING", ticket:"" }
//    calls : []
// DEF: place_order · CALLED BY: a client of Order Service
// -> order_id : "ORD-4007"
//    step 1 · create order : order.id : "" -> "ORD-4007"  BECAUSE the service records the incoming order
//    step 2 · start cooking : order.ticket : "" -> "T-88"  BECAUSE Order Service invokes Kitchen Service to create a ticket
//    step 3 · record the call : calls : [] -> ["KitchenService.createTicket"]  BECAUSE the outbound call must be tracked for the test
// <- order : {"id":"ORD-4007","state":"PENDING","ticket":"T-88"} · calls.length : 1
//    alt another order : order.id : "ORD-4007" -> "ORD-4008"  BECAUSE a second scenario starts a fresh order`
    },
    {
      section: 'Why end-to-end tests fail you',
      color: 'orange',
      motivation: `A test that launches every service is the obvious approach and the wrong one: one flaky service takes down the whole run.`,
      steps: [
        { num: 1, title: 'Launch multiple services', detail: 'An end-to-end test starts several services at once to exercise a full flow.' },
        { num: 2, title: 'Pay for every one', detail: 'Each launched service adds setup, config, and a failure surface to the test.' },
        { num: 3, title: 'The verdict', detail: 'End-to-end testing is difficult, slow, brittle, and expensive.' }
      ],
      program: `// E2E SIDE — an end-to-end test launches multiple services, which makes it slow and brittle
// PARTIES: TST = end-to-end test · OSVC = Order Service · KSVC = Kitchen Service · DSVC = Delivery Service
// STATE (before):
//    launched : []
//    checks : 0
// DEF: run_e2e · CALLED BY: TST to verify an order flows through the system
// -> order_id : "ORD-4007"
//    step 1 · launch all : launched : [] -> ["OrderService","KitchenService","DeliveryService"]  BECAUSE the test must start every service the flow touches
//    step 2 · configure : checks : 0 -> 1  BECAUSE the test wires each service's data and config before running
//    step 3 · one flake fails all : launched : ["OrderService","KitchenService","DeliveryService"] -> ["OrderService","KitchenService","DeliveryService","FAILED:DeliveryService"]  BECAUSE one flaky service fails the whole run
// <- launched.length : 4 · result : "brittle"  BECAUSE the test depends on every service being up
//    alt isolated test : launched : ["OrderService","KitchenService","DeliveryService","FAILED:DeliveryService"] -> ["OrderService"]  BECAUSE a component test starts only the service under test`
    },
    {
      section: 'Test the service in isolation',
      color: 'orange',
      motivation: `Swap the real dependencies for test doubles and the service becomes a small, fast, dependable thing to test.`,
      steps: [
        { num: 1, title: 'Stub the dependencies', detail: 'Replace any service the service invokes with a test double that returns canned replies.' },
        { num: 2, title: 'Drive the service directly', detail: 'The test calls the service in-process, not through the network.' },
        { num: 3, title: 'Assert the behavior', detail: 'The test checks the service\'s response against the double\'s canned reply.' }
      ],
      program: `// SERVICE SIDE — test the service in isolation using test doubles for the services it invokes
// PARTIES: OSVC = Order Service (under test) · DBLE = test double for Kitchen Service
// DEF: dep — a dependency the service under test invokes = "KitchenService", stubbed by DBLE in isolation
// DEF: real — the actual production service, NOT launched here = "KitchenService", the real_dep value
// DEF: ticket — the Kitchen ticket id the double returns = "T-88"
// DEF: seen — the reply value the service observed from the double = "T-88", stored in ticket_seen
// STATE (before):
//    real_dep : "KitchenService"        // the real dependency, not launched
//    double : { createTicket:"" }
//    order : { id:"", state:"PENDING" }
//    ticket_seen : ""
// DEF: test_in_isolation · CALLED BY: the service component test
// -> order_id : "ORD-4007"
//    step 1 · stub the dependency : double.createTicket : "" -> "T-88"  BECAUSE the test double returns a fixed ticket instead of a real Kitchen Service
//    step 2 · drive the service : order.id : "" -> "ORD-4007"  BECAUSE the test calls Order Service directly, not over the network
//    step 3 · assert : ticket_seen : "" -> "T-88"  BECAUSE the service read the double's reply
// <- order : {"id":"ORD-4007","state":"PENDING"} · double.createTicket : "T-88" · real_dep not launched
//    alt double drifts : double.createTicket : "T-88" -> "T-99"  BECAUSE the double now returns a shape the real service no longer returns
//       ticket_seen : "T-88" -> "T-99"  BECAUSE the test now trusts a stale reply, hiding a production mismatch`
    },
    {
      section: 'The resulting context',
      color: 'orange',
      motivation: `Isolation buys speed and reliability, but it introduces a new risk: a test can be green while production is red.`,
      steps: [
        { num: 1, title: 'The benefit', detail: 'Testing a service in isolation is easier, faster, more reliable, and cheap.' },
        { num: 2, title: 'The drawback', detail: 'Tests might pass but the application will fail in production.' },
        { num: 3, title: 'The open issue', detail: 'How do you ensure the test doubles always correctly emulate the behavior of the invoked services?' }
      ],
      program: `// SERVICE SIDE — resulting context: isolation is cheap, but doubles can drift from the real service
// PARTIES: OSVC = Order Service · DBLE = test double · PROD = production
// DEF: test — the in-isolation component suite run = test_result "green"
// DEF: result — the verdict of one run = "green" (passing) or "red" (failing)
// STATE (before):
//    test_result : ""
//    prod_result : ""
//    drift : false
// DEF: run_suite · CALLED BY: the pipeline, then compared against production
// -> suite : "order-service-component"
//    step 1 · run in isolation : test_result : "" -> "green"  BECAUSE testing one service is fast, reliable, and cheap
//    step 2 · double is stale : drift : false -> true  BECAUSE the double still returns an old Kitchen Service reply shape
//    step 3 · deploy : prod_result : "" -> "red"  BECAUSE the real Kitchen Service changed and the test never caught it
// <- test_result : "green" · prod_result : "red"  BECAUSE tests can pass while the application fails in production
//    alt doubles stay faithful : drift : true -> false  BECAUSE the doubles are kept in sync with the invoked services' contracts
//       prod_result : "red" -> "green"  BECAUSE the test now mirrors the real behavior`
    }
  ],
  interview: [
    {
      scenario: "Order Service places an order by invoking Kitchen Service to create a ticket. The team needs an automated test that verifies the order behaves correctly, including the outbound call it makes.",
      q: "What does a service component test define, and why must it cover the calls the service makes to other services?",
      solution: "A test suite that tests a service in isolation using test doubles for any services it invokes — because verifying the service means observing the calls it makes to its dependencies.",
      components: ["Order Service (under test)", "Kitchen Service (dependency)", "test double", "outbound-call capture"],
      
      code: "// SERVICE SIDE — a service invokes other services, so automated tests must verify it behaves correctly\n// PARTIES: OSVC = Order Service · KSVC = Kitchen Service (dependency)\n// STATE (before):\n//    order : { id:\"\", state:\"PENDING\", ticket:\"\" }\n//    calls : []\n// DEF: place_order · CALLED BY: a client of Order Service\n// -> order_id : \"ORD-4007\"\n//    step 1 · create the order : order.id : \"\" -> \"ORD-4007\"  BECAUSE the service records the incoming order\n//    step 2 · start cooking : order.ticket : \"\" -> \"T-88\"  BECAUSE Order Service invokes Kitchen Service to create a ticket\n//    step 3 · record the call : calls : [] -> [\"KitchenService.createTicket\"]  BECAUSE the outbound call must be tracked for the test\n// <- order : {\"id\":\"ORD-4007\",\"state\":\"PENDING\",\"ticket\":\"T-88\"} · calls.length : 1\n//    alt another order : order.id : \"ORD-4007\" -> \"ORD-4008\"  BECAUSE a second scenario starts a fresh order",
      tieback: "This is the chapter's context: a service is never alone, so its test must cover the outbound calls it makes.",
      refs: ["A service among many services"],
      problems: ["03-framework-for-system-design-interviews"]
    },
    {
      scenario: "The team's end-to-end test launches Order, Kitchen, and Delivery services at once to exercise a full order flow. One flaky Delivery Service takes down the entire run.",
      q: "Why does the pattern reject end-to-end testing, and what is the concrete failure mode?",
      solution: "End-to-end tests launch multiple services, each adding setup, config, and a failure surface; one flaky service fails the whole run — difficult, slow, brittle, and expensive.",
      components: ["Order Service", "Kitchen Service", "Delivery Service", "end-to-end test"],
      
      code: "// E2E SIDE — an end-to-end test launches multiple services, which makes it slow and brittle\n// PARTIES: TST = end-to-end test · OSVC = Order Service · KSVC = Kitchen Service · DSVC = Delivery Service\n// STATE (before):\n//    launched : []\n//    checks : 0\n// DEF: run_e2e · CALLED BY: TST to verify an order flows through the system\n// -> order_id : \"ORD-4007\"\n//    step 1 · launch all : launched : [] -> [\"OrderService\",\"KitchenService\",\"DeliveryService\"]  BECAUSE the test must start every service the flow touches\n//    step 2 · configure : checks : 0 -> 1  BECAUSE the test wires each service's data and config before running\n//    step 3 · one flake fails all : launched : [\"OrderService\",\"KitchenService\",\"DeliveryService\"] -> [\"OrderService\",\"KitchenService\",\"DeliveryService\",\"FAILED:DeliveryService\"]  BECAUSE one flaky service fails the whole run\n// <- launched.length : 4 · result : \"brittle\"  BECAUSE the test depends on every service being up\n//    alt isolated test : launched : [\"OrderService\",\"KitchenService\",\"DeliveryService\",\"FAILED:DeliveryService\"] -> [\"OrderService\"]  BECAUSE a component test starts only the service under test",
      tieback: "This is the chapter's warning against end-to-end testing: launching every service is difficult, slow, brittle, and expensive.",
      refs: ["Why end-to-end tests fail you"],
      problems: ["03-framework-for-system-design-interviews"]
    },
    {
      scenario: "Instead of launching Kitchen Service, the team stubs it with a test double that returns a fixed ticket, and drives Order Service in-process.",
      q: "How does testing in isolation work, and what does the test actually assert?",
      solution: "Replace each invoked service with a test double returning canned replies, call the service directly in-process, and assert the service's response against the double's reply.",
      components: ["Order Service (under test)", "Kitchen Service double", "in-process call", "assertion"],
      
      code: "// SERVICE SIDE — test the service in isolation using test doubles for the services it invokes\n// PARTIES: OSVC = Order Service (under test) · DBLE = test double for Kitchen Service\n// DEF: dep — a dependency the service under test invokes; here \"KitchenService\", stubbed by DBLE in isolation\n// DEF: real — the actual production service, NOT launched here; here \"KitchenService\", the real_dep value\n// DEF: ticket — the Kitchen ticket id the double returns; here \"T-88\"\n// STATE (before):\n//    real_dep : \"KitchenService\"        // the real dependency, not launched\n//    double : { createTicket:\"\" }\n//    order : { id:\"\", state:\"PENDING\" }\n//    ticket_seen : \"\"\n// DEF: test_in_isolation · CALLED BY: the service component test\n// -> order_id : \"ORD-4007\"\n//    step 1 · stub the dependency : double.createTicket : \"\" -> \"T-88\"  BECAUSE the test double returns a fixed ticket instead of a real Kitchen Service\n//    step 2 · drive the service : order.id : \"\" -> \"ORD-4007\"  BECAUSE the test calls Order Service directly, not over the network\n//    step 3 · assert : ticket_seen : \"\" -> \"T-88\"  BECAUSE the service read the double's reply\n// <- order : {\"id\":\"ORD-4007\",\"state\":\"PENDING\"} · double.createTicket : \"T-88\" · real_dep not launched\n//    alt double drifts : double.createTicket : \"T-88\" -> \"T-99\"  BECAUSE the double now returns a shape the real service no longer returns\n//       ticket_seen : \"T-88\" -> \"T-99\"  BECAUSE the test now trusts a stale reply, hiding a production mismatch",
      tieback: "This is the chapter's solution: swap the real dependencies for test doubles and test the service in isolation.",
      refs: ["Test the service in isolation"],
      problems: ["03-framework-for-system-design-interviews"]
    },
    {
      scenario: "The isolated suite is green, but after deploy the real Kitchen Service rejects the ticket shape the double still returns. Production is red while the test says green.",
      q: "What is the resulting context of a service component test, and what open issue does it leave?",
      solution: "Testing in isolation is easier, faster, more reliable, and cheap — but tests might pass while the application fails in production; the open issue is ensuring the doubles always correctly emulate the invoked services.",
      components: ["Order Service", "test double", "production Kitchen Service", "drift detector"],
      
      code: "// SERVICE SIDE — resulting context: isolation is cheap, but doubles can drift from the real service\n// PARTIES: OSVC = Order Service · DBLE = test double · PROD = production\n// DEF: result — the verdict of one run; here \"green\" (passing) or \"red\" (failing)\n// STATE (before):\n//    test_result : \"\"\n//    prod_result : \"\"\n//    drift : false\n// DEF: run_suite · CALLED BY: the pipeline, then compared against production\n// -> suite : \"order-service-component\"\n//    step 1 · run in isolation : test_result : \"\" -> \"green\"  BECAUSE testing one service is fast, reliable, and cheap\n//    step 2 · the double is stale : drift : false -> true  BECAUSE the double still returns an old Kitchen Service reply shape\n//    step 3 · deploy : prod_result : \"\" -> \"red\"  BECAUSE the real Kitchen Service changed and the test never caught it\n// <- test_result : \"green\" · prod_result : \"red\"  BECAUSE tests can pass while the application fails in production\n//    alt doubles stay faithful : drift : true -> false  BECAUSE the doubles are kept in sync with the invoked services' contracts\n//       prod_result : \"red\" -> \"green\"  BECAUSE the test now mirrors the real behavior",
      tieback: "This is the chapter's resulting context: isolation buys speed and reliability, but a stale double can keep a suite green while production is red.",
      refs: ["The resulting context"],
      problems: ["03-framework-for-system-design-interviews"]
    }
  ],
  systemDesign: {
    question: 'Design in-process integration testing for a service. Premise: a test harness runs the Order Service in-process with its real wiring but stubbed dependencies (Kitchen Service), so behavior is tested without deploying.',
    pipeline: 'test harness → service under test (in-process) → stubbed dependencies',
    decomposition: [
      {
        box: 'test harness',
        role: 'test harness',
        parts: [
          'drives the service in-process (no network)',
          'asserts the response against the double\'s canned reply'
        ]
      },
      {
        box: 'Order Service — the service under test',
        role: 'service under test (in-process)',
        parts: [
          'real wiring: its controller and outbound call run for real',
          'in-memory database instead of the production store'
        ]
      },
      {
        box: 'Kitchen Service double',
        role: 'stubbed dependency',
        parts: [
          'returns the canned ticket "T-88"',
          'stands in for the real Kitchen Service'
        ]
      }
    ],
    
    program: `// SYSTEM DESIGN — service component test: test harness -> service under test (Order Service, in-process) -> stubbed dependency (Kitchen Service double)
// PARTIES: TST = test harness (drives the service in-process) · SVC = Order Service (service under test, real wiring) · DBLE = Kitchen Service double (stubbed dependency)
// DEF: dep — the dependency the service invokes; here "KitchenService.createTicket" stubbed by DBLE
// DEF: ticket — the canned reply the double returns; here "T-88"
// DEF: order — the service's own output; here {"id":"ORD-4007","state":"PENDING","ticket":"T-88"}
// STATE (before):
//    order : { id:"", state:"PENDING", ticket:"" }
//    double : { createTicket:"" }
//    calls : []
// DEF: run_component_test · CALLED BY: TST exercising SVC in isolation
// -> order_id : "ORD-4007"
//    step 1 · DBLE is primed with the canned ticket    double.createTicket : "" -> "T-88"
//    step 2 · TST calls SVC in-process    order.id : "" -> "ORD-4007"  BECAUSE the harness drives the service directly, not over the network
//    step 3 · SVC invokes DBLE and records the call    calls : [] -> ["KitchenService.createTicket"]
//    step 4 · SVC reads the double's reply    order.ticket : "" -> "T-88"  BECAUSE the stubbed dependency returns the fixed ticket
// <- outcome : order {"id":"ORD-4007","state":"PENDING","ticket":"T-88"} · calls 1 · the real Kitchen Service is never launched`
  },
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'A service is never alone', content: '<p><strong>Why.</strong> In a microservice architecture the application consists of numerous services, and services often invoke other services.</p><p><strong>Claim.</strong> You must write automated tests that verify that a service behaves correctly — which means covering its outbound calls.</p><p><strong>Grounding.</strong> The pattern\'s context states the services-and-dependencies shape directly.</p><p><strong>In the wild.</strong> Order Service invokes Kitchen Service, so an order\'s correct behavior depends on that call.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Service component test', content: '<p><strong>Why.</strong> Launching every service for a test is difficult, slow, brittle, and expensive.</p><p><strong>Claim.</strong> Test a service in isolation using test doubles for any services that it invokes.</p><p><strong>Grounding.</strong> Spring Cloud Contract is an open source project that supports this style of testing.</p><p><strong>In the wild.</strong> A suite stubs Kitchen Service, drives Order Service directly, and asserts the order\'s behavior.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Isolation is cheap, production is the truth', content: '<p><strong>Why.</strong> Isolation is a benefit precisely because it removes the real services, but that removal is also the risk.</p><p><strong>Claim.</strong> Testing a service in isolation is easier, faster, more reliable, and cheap — but tests might pass while the application fails in production.</p><p><strong>Grounding.</strong> The pattern lists this benefit and this drawback side by side.</p><p><strong>In the wild.</strong> A green component suite does not prove the real Kitchen Service still accepts the ticket the double returns.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Doubles must stay faithful', content: '<p><strong>Why.</strong> A test double is only as good as its imitation of the real service.</p><p><strong>Claim.</strong> The open issue is how to ensure that the test doubles always correctly emulate the behavior of the invoked services.</p><p><strong>Grounding.</strong> The pattern\'s resulting context names this as an unresolved issue.</p><p><strong>In the wild.</strong> When the double returns an old reply shape, the suite stays green while production breaks.</p>' }
    ]
  },
  quiz: [
    { "question": "What is a service component test?", "options": ["A. A test that launches every service", "B. A test suite that tests a service in isolation using test doubles for any services it invokes", "C. A load test", "D. A security audit"], "answer": 2, "explanation": "The solution is a test suite that tests a service in isolation using test doubles for any services it invokes. Launching every service is the end-to-end approach the pattern warns against, and load or security testing is unrelated.", "conceptRef": "Service component test" },
    { "question": "What is the problem with end-to-end testing, per the pattern's forces?", "options": ["A. It is too cheap", "B. It is difficult, slow, brittle, and expensive", "C. It never finds bugs", "D. It requires no services"], "answer": 2, "explanation": "The pattern states that end-to-end testing — tests that launch multiple services — is difficult, slow, brittle, and expensive. The other options invert or distort that verdict.", "conceptRef": "Why end-to-end tests fail you" },
    { "question": "What is a key drawback of service component tests?", "options": ["A. They are slower than end-to-end tests", "B. Tests might pass but the application will fail in production", "C. They need no test doubles", "D. They require a distributed transaction"], "answer": 2, "explanation": "The listed drawback is that tests might pass but the application will fail in production. Isolation is faster, not slower, and the pattern depends on test doubles rather than avoiding them.", "conceptRef": "Isolation is cheap, production is the truth" },
    { "question": "What open issue does the pattern leave unresolved?", "options": ["A. How to ensure the test doubles always correctly emulate the behavior of the invoked services", "B. How to remove all services", "C. How to avoid writing any tests", "D. How to merge services into one"], "answer": 1, "explanation": "The resulting context raises the issue of how to ensure the test doubles always correctly emulate the invoked services' behavior. The other options are not part of the pattern.", "conceptRef": "Doubles must stay faithful" }
  ]
});
