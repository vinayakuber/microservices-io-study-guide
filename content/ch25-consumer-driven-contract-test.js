registerChapter({
  id: 'ch25',
  num: 25,
  title: 'Consumer-Driven Contract Test',
  pattern: 'Verify that a service meets the expectations of its clients.',
  aka: 'Chris Richardson · Microservice Patterns Ch. · microservices.io /patterns/testing/consumer-driven-contract-test.html',
  part: 6,
  flow: [
    {
      section: 'Agreement between two services',
      color: 'orange',
      motivation: `Every interaction between a pair of services is an agreement; without a test pinning it down, either side can drift and break the other silently.`,
      steps: [
        { num: 1, title: 'Name the relationship', detail: 'Each interacting pair is a <strong>consumer-provider</strong> relationship: API Gateway is a consumer, Order Service is a provider.' },
        { num: 2, title: 'Agree on channel and shape', detail: 'Services must agree on the event message structure and channel, the REST endpoints, or the command and reply formats.' },
        { num: 3, title: 'Enumerate the REST shape', detail: 'A contract test verifies the HTTP method and path, headers, request body, and the response status, headers, and body.' }
      ],
      program: `// PROVIDER SIDE — the GET /orders/{orderId} contract test verifies the API shape, not business logic
// PARTIES: GW = API Gateway (consumer) · SVC = Order Service (provider) · TST = contract test
// STATE (before):
//    shape : { method:"", path:"", headers:{}, status:0, body:{} }
// DEF: expect_order_endpoint · CALLED BY: GW team encoding what OrderServiceProxy needs
// -> order_id : "ORD-4007"
//    step 1 · expected method+path : shape.method : "" -> "GET" · shape.path : "" -> "/orders/{orderId}"  BECAUSE OrderServiceProxy calls GET /orders/{orderId}
//    step 2 · expected headers : shape.headers : {} -> {"Accept":"application/json"}  BECAUSE the proxy sends Accept and reads JSON
//    step 3 · expected status : shape.status : 0 -> 200  BECAUSE the proxy needs a success code to parse the body
//    step 4 · expected body : shape.body : {} -> {"orderId":"ORD-4007","state":"CREATED"}  BECAUSE the proxy reads the order's JSON from the reply
// <- contract : {"method":"GET","path":"/orders/ORD-4007","headers":{"Accept":"application/json"},"status":200,"body":{"orderId":"ORD-4007","state":"CREATED"}}
//    alt provider deviates : SVC answers 404  BECAUSE the provider changed the endpoint -> the suite fails with "expected 200, got 404"`
    },
    {
      section: 'Consumers publish their expectations',
      color: 'orange',
      motivation: `Confidence in a dependency comes from the consumer spelling out what it needs, not from hoping the provider guesses it.`,
      steps: [
        { num: 1, title: 'The consumer team writes the suite', detail: 'The team that develops the consumer writes a contract test suite for the aspects of the API it uses.' },
        { num: 2, title: 'Contribute it to the provider', detail: 'The suite is added to the provider\'s test suite, for example via a pull request.' },
        { num: 3, title: 'Every consumer contributes', detail: 'Each service that invokes Order Service contributes its own suite, so the provider sees every consumer\'s expectations.' }
      ],
      program: `// PROVIDER SIDE — each consumer team contributes its own suite to Order Service's test suite
// PARTIES: GW = API Gateway team · OH = Order History Service team · SVC = Order Service (provider)
// STATE (before):
//    suites : []                         // the provider's collection of contributed suites, empty
//    test_count : 0
// DEF: contribute_suite · CALLED BY: GW team opening a pull request
// -> contributor : "GW" · -> suite_name : "gateway-orders"
//    step 1 · author tests : test_count : 0 -> 1  BECAUSE the gateway suite needs one test for GET /orders/{orderId}
//    step 2 · merge PR : suites : [] -> [{"owner":"GW","name":"gateway-orders","tests":1}]  BECAUSE the suite is added to the provider's test suite via pull request
// <- suites : 1 entry · owner : "GW" · test_count : 1
//
// DEF: contribute_suite · CALLED BY: OH team, a second consumer, via another pull request
// -> contributor : "OH" · -> suite_name : "history-events"
//    step 1 · author tests : test_count : 1 -> 2  BECAUSE Order History adds a suite that checks the published events
//    step 2 · merge PR : suites : [{"owner":"GW","name":"gateway-orders","tests":1}] -> [{"owner":"GW","name":"gateway-orders","tests":1},{"owner":"OH","name":"history-events","tests":1}]  BECAUSE the second suite tests the event aspects relevant to this consumer
// <- suites : 2 entries · owners : ["GW"] -> ["GW","OH"]`
    },
    {
      section: 'The provider pipeline verifies everyone',
      color: 'orange',
      motivation: `The provider's deployment pipeline runs all contributed suites, so a breaking change is caught before it ships to any consumer.`,
      steps: [
        { num: 1, title: 'Run the suites in the pipeline', detail: 'The contributed test suites are executed by the deployment pipeline for Order Service.' },
        { num: 2, title: 'Compare expected versus actual', detail: 'Each test checks that the actual response matches the consumer\'s expected status, headers, and body.' },
        { num: 3, title: 'A failure means a breaking change', detail: 'When a consumer contract test fails, the producer team must fix the API or talk to the consumer team.' }
      ],
      program: `// PROVIDER SIDE — the deployment pipeline compares the consumer's expected response against the actual
// PARTIES: SVC = Order Service (provider) · GW = API Gateway (consumer) · PIPE = deployment pipeline
// STATE (before):
//    expected : { status:200, body:{"orderId":"ORD-4007","state":"CREATED"} }
//    actual : { status:0, body:{} }
//    matches : 0
// DEF: verify_one_request · CALLED BY: PIPE running the gateway-orders suite
// -> order_id : "ORD-4007"
//    step 1 · invoke provider : actual.status : 0 -> 200  BECAUSE SVC serves GET /orders/ORD-4007
//    step 2 · read body : actual.body : {} -> {"orderId":"ORD-4007","state":"CREATED"}  BECAUSE SVC returns the order's JSON
//    step 3 · compare status : matches : 0 -> 1  BECAUSE actual.status 200 equals expected.status 200
//    step 4 · compare body : matches : 1 -> 2  BECAUSE actual.body equals expected.body, so both checks hold
// <- verdict : "pass"  BECAUSE matches equals 2 (status and body both agree)
//    alt provider breaks the API : SVC drops GET /orders/{orderId}
//       actual.status : 200 -> 404  BECAUSE the endpoint was removed or renamed
//       verdict : "pass" -> "fail"  BECAUSE 404 does not equal expected.status 200
//       PIPE fails the suite -> the producer team must fix the API or talk to the consumer team`
    },
    {
      section: 'Testing by example',
      color: 'orange',
      motivation: `Instead of exhaustively testing every input, a contract is defined by a small set of examples of the messages exchanged in one interaction.`,
      steps: [
        { num: 1, title: 'Define contracts as examples', detail: 'The interaction between a consumer and a provider is defined by a set of examples, known as contracts.' },
        { num: 2, title: 'One interaction, two messages', detail: 'Each contract consists of the example messages exchanged during one interaction: the request and the reply.' },
        { num: 3, title: 'They are mock controller tests', detail: 'Consumer contract tests for a REST API are mock controller tests, not full business-logic tests.' }
      ],
      program: `// PROVIDER SIDE — testing by example: a contract is the pair of example messages for ONE interaction
// PARTIES: GW = API Gateway (consumer) · SVC = Order Service (provider)
// STATE (before):
//    contract : { request:{}, reply:{} }
//    kind : ""
// DEF: define_contract · CALLED BY: GW team, using testing by example
// -> order_id : "ORD-4007"
//    step 1 · example request : contract.request : {} -> {"method":"GET","path":"/orders/ORD-4007","headers":{"Accept":"application/json"}}  BECAUSE the example request is one message of the interaction
//    step 2 · example reply : contract.reply : {} -> {"status":200,"body":{"orderId":"ORD-4007","state":"CREATED"}}  BECAUSE the example reply is the second message of the interaction
//    step 3 · identify the test style : kind : "" -> "mock-controller"  BECAUSE consumer contract tests for a REST API are mock controller tests
// <- contract : {"request":{"method":"GET","path":"/orders/ORD-4007"},"reply":{"status":200,"body":{"orderId":"ORD-4007","state":"CREATED"}}}
//    alt another example : order_id : "ORD-4007" -> "ORD-4008"  BECAUSE each contract is one example; a second contract covers a second order`
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Two services, one implicit agreement', content: '<p><strong>Why.</strong> Every interaction between a pair of services is an agreement — an event message structure and channel, a REST endpoint, or a command and reply format — but nothing pins that agreement down.</p><p><strong>Claim.</strong> You need confidence that the services you consume have stable APIs, and that you do not unintentionally break your own API.</p><p><strong>Grounding.</strong> Order Service and Order History Service must agree on event structure and channel; the API gateway and the services must agree on REST endpoints.</p><p><strong>In the wild.</strong> A change to GET /orders/{orderId} that breaks the API Gateway\'s OrderServiceProxy is a broken contract.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Consumer-driven contract test', content: '<p><strong>Why.</strong> Running both services and invoking an end-to-end flow is slow and drags in transitive dependencies, so it cannot pin down low-level IPC cheaply.</p><p><strong>Claim.</strong> Verify that a service meets the expectations of its clients: each consumer team writes a contract test suite and adds it to the provider\'s test suite via a pull request.</p><p><strong>Grounding.</strong> The API Gateway team contributes a suite; Order History Service contributes another; each covers only the aspects of Order Service\'s API that consumer uses.</p><p><strong>In the wild.</strong> Order Service\'s deployment pipeline runs every contributed suite and flags a failure as a breaking change.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Shape, not business logic', content: '<p><strong>Why.</strong> A contract test is deliberately shallow, so it cannot be a substitute for unit testing.</p><p><strong>Claim.</strong> It verifies the HTTP method and path, headers, request body, and the response status, headers, and body — the shape, not the provider\'s business logic.</p><p><strong>Grounding.</strong> Thoroughly testing business logic is the job of unit tests; consumer contract tests for a REST API are in fact mock controller tests.</p><p><strong>In the wild.</strong> A suite that asserts a 200 and a matching JSON body catches an API break without executing the order\'s domain rules.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'One suite per consumer', content: '<p><strong>Why.</strong> Different consumers depend on different parts of one provider, so a single generic test cannot represent them all.</p><p><strong>Claim.</strong> Every team that develops a service consuming Order Service\'s API contributes its own suite for the aspects it uses.</p><p><strong>Grounding.</strong> Order History Service\'s suite verifies that Order Service publishes the expected events, while the gateway\'s suite verifies the REST endpoint.</p><p><strong>In the wild.</strong> When any one suite fails, the producer team must fix the API or talk to that consumer team.</p>' }
    ]
  },
  quiz: [
    { "question": "What does a consumer-driven contract test verify about a REST endpoint?", "options": ["A. That the provider's business logic is fully correct", "B. The method, path, headers, request body, and the response status, headers, and body", "C. That the database is transactional", "D. That the message broker is reachable"], "answer": 2, "explanation": "A contract test verifies the shape of the API (method, path, headers, body, and response status/headers/body). It does not thoroughly test business logic — that is the job of unit tests — and it says nothing about the database or the broker.", "conceptRef": "Shape, not business logic" },
    { "question": "Who writes a consumer-driven contract test suite, and where does it run?", "options": ["A. The provider team writes it and runs it locally", "B. The consumer team writes it and adds it to the provider's suite, which the provider's deployment pipeline runs", "C. An external auditor", "D. The operations team in production"], "answer": 2, "explanation": "The team that develops the consumer writes the suite and contributes it (for example via a pull request) to the provider's test suite; those suites are executed by the provider's deployment pipeline. The other options misplace authorship or the run location.", "conceptRef": "Consumer-driven contract test" },
    { "question": "When a consumer contract test fails, what does it tell the producer team?", "options": ["A. Nothing meaningful", "B. They have made a breaking change to the API and must fix it or talk to the consumer team", "C. The database is down", "D. The network is slow"], "answer": 2, "explanation": "A failing consumer contract test signals a breaking change to the API; the producer team must either fix the API or talk to the consumer team. It is not a signal about infrastructure such as the database or network.", "conceptRef": "One suite per consumer" },
    { "question": "How are the interactions in consumer-driven contract testing specified?", "options": ["A. By fuzzing random inputs", "B. By testing by example — contracts made of the example messages exchanged during one interaction", "C. By a manual checklist", "D. By replaying production logs"], "answer": 2, "explanation": "The pattern typically uses testing by example: the interaction between a consumer and provider is defined by examples called contracts, each consisting of the example messages exchanged during one interaction. Fuzzing, checklists, and log replay are not the mechanism.", "conceptRef": "Testing by example" }
  ]
});
