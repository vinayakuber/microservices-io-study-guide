registerChapter({
  id: 'ch26',
  num: 26,
  title: 'Consumer-Side Contract Test',
  pattern: 'Verify that the client of a service can communicate with the service.',
  aka: 'Chris Richardson · Microservice Patterns Ch. · microservices.io /patterns/testing/consumer-side-contract-test.html',
  part: 6,
  flow: [
    {
      section: 'The client\'s half of the contract',
      color: 'orange',
      motivation: `Every contract has two sides; this pattern puts the client under test and asks whether it can still talk to the service it depends on.`,
      steps: [
        { num: 1, title: 'The client is the subject', detail: 'The client is the service\'s caller — the side that forms requests and reads replies — and it is what the test verifies.' },
        { num: 2, title: 'Communicate means two directions', detail: 'Communication means sending a well-formed request and consuming the service\'s reply, so the test checks both.' },
        { num: 3, title: 'Contrast with consumer-driven', detail: 'The consumer-driven test checks the <strong>provider</strong> meets expectations; the consumer-side test checks the <strong>client</strong> can talk.' }
      ],
      program: `// CLIENT SIDE — verify the client can communicate with the service (the client's half of the contract)
// PARTIES: CLI = OrderServiceProxy (the client) · SVC = Order Service (the service) · TST = the client-side test
// STATE (before):
//    request : { method:"", path:"", headers:{} }
//    response : { status:0, body:{} }
// DEF: call_get_order · CALLED BY: TST exercising the client against the service contract
// -> order_id : "ORD-4007"
//    step 1 · form request : request.method : "" -> "GET" · request.path : "" -> "/orders/ORD-4007"  BECAUSE the client must send the service's expected method and path
//    step 2 · send and receive : response.status : 0 -> 200  BECAUSE the service answers the well-formed request
//    step 3 · parse body : response.body : {} -> {"orderId":"ORD-4007","state":"CREATED"}  BECAUSE the client reads the order's JSON from the reply
// <- verdict : "pass" · response.status : 200  BECAUSE the client sent a valid request and consumed the reply
//    alt client cannot communicate : response.status : 200 -> 500  BECAUSE the client sent a malformed path
//       verdict : "pass" -> "fail"  BECAUSE the client no longer reaches the service's contract`
    },
    {
      section: 'Forming the outgoing request',
      color: 'orange',
      motivation: `The first half of "can communicate" is the request: the client must send the method, path, and headers the service expects, or nothing downstream works.`,
      steps: [
        { num: 1, title: 'Method', detail: 'The client must use the HTTP method the service\'s contract specifies, such as GET.' },
        { num: 2, title: 'Path', detail: 'The client must substitute the concrete id into the path template, such as /orders/{orderId}.' },
        { num: 3, title: 'Headers', detail: 'The client must advertise the format it can read, such as an Accept header.' }
      ],
      program: `// CLIENT SIDE — the outgoing request: the client must form the service's expected method, path, and headers
// PARTIES: CLI = OrderServiceProxy · SVC = Order Service
// STATE (before):
//    outbound : { method:"", path:"", headers:{} }
//    verdict : ""
// DEF: build_request · CALLED BY: the client-side test
// -> order_id : "ORD-4007" · -> accept : "application/json"
//    step 1 · method : outbound.method : "" -> "GET"  BECAUSE the contract says GET /orders/{orderId}
//    step 2 · path : outbound.path : "" -> "/orders/ORD-4007"  BECAUSE the client substitutes the order id into the path template
//    step 3 · headers : outbound.headers : {} -> {"Accept":"application/json"}  BECAUSE the client advertises the format it can read
// <- outbound : {"method":"GET","path":"/orders/ORD-4007","headers":{"Accept":"application/json"}}
//    alt wrong path : outbound.path : "/orders/ORD-4007" -> "/order/ORD-4007"  BECAUSE a client typo drops the plural
//       verdict : "pass" -> "fail"  BECAUSE the service expects /orders, not /order`
    },
    {
      section: 'Consuming the incoming response',
      color: 'orange',
      motivation: `The second half is the reply: the client must read the status, headers, and body correctly, or it will misparse a healthy service.`,
      steps: [
        { num: 1, title: 'Read the status', detail: 'The client must confirm the call succeeded before trying to parse anything.' },
        { num: 2, title: 'Read the headers', detail: 'The client must check the content type so it decodes the body the right way.' },
        { num: 3, title: 'Decode the body', detail: 'The client must turn the reply body into its own fields, such as orderId and state.' }
      ],
      program: `// CLIENT SIDE — the incoming response: the client must read the service's status, headers, and body correctly
// PARTIES: CLI = OrderServiceProxy · SVC = Order Service
// STATE (before):
//    received : { status:0, headers:{}, body:{} }
//    parsed : { orderId:"", state:"" }
// DEF: consume_response · CALLED BY: the client-side test after the call returns
// -> raw_reply : {"status":200,"headers":{"Content-Type":"application/json"},"body":{"orderId":"ORD-4007","state":"CREATED"}}
//    step 1 · read status : received.status : 0 -> 200  BECAUSE the client confirms the call succeeded before parsing
//    step 2 · read headers : received.headers : {} -> {"Content-Type":"application/json"}  BECAUSE the client checks the body is JSON before decoding
//    step 3 · decode body : parsed.orderId : "" -> "ORD-4007" · parsed.state : "" -> "CREATED"  BECAUSE the client decodes the JSON body into its own fields
// <- parsed : {"orderId":"ORD-4007","state":"CREATED"} · received.status : 200
//    alt unexpected body : received.body : {} -> {"error":"not found"}  BECAUSE the service returned an error shape instead
//       parsed.orderId : "ORD-4007" -> ""  BECAUSE an error body carries no orderId to decode`
    },
    {
      section: 'The client is the thing under test',
      color: 'orange',
      motivation: `Placing the test on the client side means a client regression is caught where it is written, before it ships to every service it calls.`,
      steps: [
        { num: 1, title: 'Assert on the client\'s own behavior', detail: 'The test checks what the client sends and what it reads, not the provider\'s internals.' },
        { num: 2, title: 'Both assertions must hold', detail: 'A passing test means the request assertion and the response assertion both succeeded.' },
        { num: 3, title: 'A wrong path fails fast', detail: 'If the client forms the wrong path, it cannot reach the service\'s endpoint and the test fails.' }
      ],
      program: `// CLIENT SIDE — the client is the subject under test, not the provider
// PARTIES: CLI = OrderServiceProxy (subject) · SVC = Order Service (the service it talks to)
// DEF: behavior — the client's observable actions = what it sends ("GET /orders/ORD-4007") and reads ("orderId,state"), held in cli_behavior
// STATE (before):
//    cli_behavior : { sends:"", reads:"" }
//    checks : 0
//    failures : 0
// DEF: assert_client_can_talk · CALLED BY: the consumer-side test
// -> order_id : "ORD-4007"
//    step 1 · check outgoing : cli_behavior.sends : "" -> "GET /orders/ORD-4007"  BECAUSE the test asserts the client forms the correct request
//    step 2 · check incoming : cli_behavior.reads : "" -> "orderId,state"  BECAUSE the test asserts the client parses the reply's fields
//    step 3 · tally : checks : 0 -> 2  BECAUSE both the request and the response assertions pass
// <- failures : 0  BECAUSE the client can communicate with the service
//    alt client cannot talk : cli_behavior.sends : "GET /orders/ORD-4007" -> "GET /order/ORD-4007"  BECAUSE the client used the wrong path
//       failures : 0 -> 1  BECAUSE the wrong path means the client cannot reach the service's endpoint`
    }
  ],
  interview: [
    {
      scenario: "Order Service changed its endpoint, and the OrderServiceProxy stopped talking to it. The team wants a test whose subject is the client itself — not the provider — asking whether the proxy can still communicate.",
      q: "What does a consumer-side contract test verify, and which two directions of communication does \"can communicate\" cover?",
      solution: "It verifies that the client of a service can communicate with the service: the client sends a well-formed request and consumes the service's reply.",
      components: ["OrderServiceProxy (client)", "Order Service", "client-side test", "request + reply assertions"],
      diagram: "flowchart LR\n  T[\"Client-side test\"] -->|\"asserts\"| S[\"sends GET /orders/ORD-4007\"]\n  T -->|\"asserts\"| R[\"reads status + JSON body\"]\n  T -->|\"subjects\"| C[\"OrderServiceProxy\"]",
      code: "// CLIENT SIDE — verify the client can communicate with the service (the client's half of the contract)\n// PARTIES: CLI = OrderServiceProxy (the client) · SVC = Order Service (the service) · TST = the client-side test\n// STATE (before):\n//    request : { method:\"\", path:\"\", headers:{} }\n//    response : { status:0, body:{} }\n// DEF: call_get_order · CALLED BY: TST exercising the client against the service contract\n// -> order_id : \"ORD-4007\"\n//    step 1 · form the request : request.method : \"\" -> \"GET\" · request.path : \"\" -> \"/orders/ORD-4007\"  BECAUSE the client must send the service's expected method and path\n//    step 2 · send and receive : response.status : 0 -> 200  BECAUSE the service answers the well-formed request\n//    step 3 · parse the body : response.body : {} -> {\"orderId\":\"ORD-4007\",\"state\":\"CREATED\"}  BECAUSE the client reads the order's JSON from the reply\n// <- verdict : \"pass\" · response.status : 200  BECAUSE the client sent a valid request and consumed the reply\n//    alt client cannot communicate : response.status : 200 -> 500  BECAUSE the client sent a malformed path\n//       verdict : \"pass\" -> \"fail\"  BECAUSE the client no longer reaches the service's contract",
      tieback: "This is the chapter's core statement: the client is the thing under test, and communicating means both sending and reading.",
      refs: ["The client's half of the contract"],
      problems: ["03-framework-for-system-design-interviews"]
    },
    {
      scenario: "A developer typos the path template in OrderServiceProxy, changing /orders to /order. The request leaves the client but never reaches a valid endpoint.",
      q: "What three pieces must the client get right in its outgoing request, and how does a wrong path fail the test?",
      solution: "The client must send the method, substitute the concrete id into the path template, and advertise the headers it needs; a wrong path means the request misses the service's endpoint and the test fails.",
      components: ["OrderServiceProxy", "Order Service", "method/path/headers builder"],
      diagram: "flowchart LR\n  C[\"OrderServiceProxy\"] -->|\"method GET\"| R[\"outbound request\"]\n  C -->|\"path /orders/ORD-4007\"| R\n  C -->|\"Accept header\"| R\n  R -->|\"hits endpoint\"| S[\"Order Service\"]",
      code: "// CLIENT SIDE — the outgoing request: the client must form the service's expected method, path, and headers\n// PARTIES: CLI = OrderServiceProxy · SVC = Order Service\n// STATE (before):\n//    outbound : { method:\"\", path:\"\", headers:{} }\n//    verdict : \"\"\n// DEF: build_request · CALLED BY: the client-side test\n// -> order_id : \"ORD-4007\" · -> accept : \"application/json\"\n//    step 1 · method : outbound.method : \"\" -> \"GET\"  BECAUSE the contract says GET /orders/{orderId}\n//    step 2 · path : outbound.path : \"\" -> \"/orders/ORD-4007\"  BECAUSE the client substitutes the order id into the path template\n//    step 3 · headers : outbound.headers : {} -> {\"Accept\":\"application/json\"}  BECAUSE the client advertises the format it can read\n// <- outbound : {\"method\":\"GET\",\"path\":\"/orders/ORD-4007\",\"headers\":{\"Accept\":\"application/json\"}}\n//    alt wrong path : outbound.path : \"/orders/ORD-4007\" -> \"/order/ORD-4007\"  BECAUSE a client typo drops the plural\n//       verdict : \"pass\" -> \"fail\"  BECAUSE the service expects /orders, not /order",
      tieback: "This is the chapter's first half of \"can communicate\": forming the outgoing request correctly.",
      refs: ["Forming the outgoing request"],
      problems: ["03-framework-for-system-design-interviews"]
    },
    {
      scenario: "The service now returns a Content-Type header and a JSON body, and the proxy must decode them into its own fields. A client that misparses a healthy reply is still broken.",
      q: "What must the client do with the incoming response, in order?",
      solution: "The client confirms the status is a success, checks the content-type header, then decodes the body into its own fields such as orderId and state.",
      components: ["OrderServiceProxy", "Order Service", "status check", "header check", "body decoder"],
      diagram: "flowchart LR\n  S[\"Order Service\"] -->|\"200 + JSON body\"| C[\"OrderServiceProxy\"]\n  C -->|\"read status\"| A[\"received.status\"]\n  C -->|\"read Content-Type\"| B[\"received.headers\"]\n  C -->|\"decode\"| D[\"parsed: orderId, state\"]",
      code: "// CLIENT SIDE — the incoming response: the client must read the service's status, headers, and body correctly\n// PARTIES: CLI = OrderServiceProxy · SVC = Order Service\n// STATE (before):\n//    received : { status:0, headers:{}, body:{} }\n//    parsed : { orderId:\"\", state:\"\" }\n// DEF: consume_response · CALLED BY: the client-side test after the call returns\n// -> raw_reply : {\"status\":200,\"headers\":{\"Content-Type\":\"application/json\"},\"body\":{\"orderId\":\"ORD-4007\",\"state\":\"CREATED\"}}\n//    step 1 · read the status : received.status : 0 -> 200  BECAUSE the client confirms the call succeeded before parsing\n//    step 2 · read the headers : received.headers : {} -> {\"Content-Type\":\"application/json\"}  BECAUSE the client checks the body is JSON before decoding\n//    step 3 · decode the body : parsed.orderId : \"\" -> \"ORD-4007\" · parsed.state : \"\" -> \"CREATED\"  BECAUSE the client decodes the JSON body into its own fields\n// <- parsed : {\"orderId\":\"ORD-4007\",\"state\":\"CREATED\"} · received.status : 200\n//    alt unexpected body : received.body : {} -> {\"error\":\"not found\"}  BECAUSE the service returned an error shape instead\n//       parsed.orderId : \"ORD-4007\" -> \"\"  BECAUSE an error body carries no orderId to decode",
      tieback: "This is the chapter's second half of \"can communicate\": consuming the incoming response correctly.",
      refs: ["Consuming the incoming response"],
      problems: ["03-framework-for-system-design-interviews"]
    },
    {
      scenario: "The team debates where to put the test: on the provider (consumer-driven) or on the client (consumer-side). They need the test to catch a client regression the moment it is written.",
      q: "Which side is the subject under test in a consumer-side contract test, and how does it relate to the consumer-driven contract test?",
      solution: "The client is the subject: the test asserts what the client sends and what it reads, and both assertions must hold; it complements the consumer-driven test, which checks the provider meets expectations.",
      components: ["OrderServiceProxy (subject)", "Order Service", "request assertion", "response assertion"],
      diagram: "flowchart LR\n  T[\"Consumer-side test\"] -->|\"checks sends\"| S[\"GET /orders/ORD-4007\"]\n  T -->|\"checks reads\"| R[\"orderId, state\"]\n  T -.->|\"complements\"| D[\"consumer-driven (provider side)\"]",
      code: "// CLIENT SIDE — the client is the subject under test, not the provider\n// PARTIES: CLI = OrderServiceProxy (subject) · SVC = Order Service (the service it talks to)\n// DEF: behavior — the client's observable actions; here what it sends (\"GET /orders/ORD-4007\") and reads (\"orderId,state\"), held in cli_behavior\n// STATE (before):\n//    cli_behavior : { sends:\"\", reads:\"\" }\n//    checks : 0\n//    failures : 0\n// DEF: assert_client_can_talk · CALLED BY: the consumer-side test\n// -> order_id : \"ORD-4007\"\n//    step 1 · check outgoing : cli_behavior.sends : \"\" -> \"GET /orders/ORD-4007\"  BECAUSE the test asserts the client forms the correct request\n//    step 2 · check incoming : cli_behavior.reads : \"\" -> \"orderId,state\"  BECAUSE the test asserts the client parses the reply's fields\n//    step 3 · tally : checks : 0 -> 2  BECAUSE both the request and the response assertions pass\n// <- failures : 0  BECAUSE the client can communicate with the service\n//    alt client cannot talk : cli_behavior.sends : \"GET /orders/ORD-4007\" -> \"GET /order/ORD-4007\"  BECAUSE the client used the wrong path\n//       failures : 0 -> 1  BECAUSE the wrong path means the client cannot reach the service's endpoint",
      tieback: "This is the chapter's framing: the client is the subject, and the two assertions together prove it can communicate.",
      refs: ["The client is the thing under test", "The client's half of the contract"],
      problems: ["03-framework-for-system-design-interviews"]
    }
  ],
  systemDesign: {
    pipeline: 'consumer → mock provider (contract) → provider service',
    decomposition: [
      {
        box: 'OrderServiceProxy — the consumer under test',
        role: 'consumer (test)',
        parts: [
          'builds the request: GET /orders/ORD-4007 + Accept header',
          'parses the reply into orderId and state'
        ]
      },
      {
        box: 'mock provider stub',
        role: 'mock provider (contract)',
        parts: [
          'returns the canned reply: status 200 + JSON body',
          'stands in for the real Order Service during the test'
        ]
      },
      {
        box: 'Order Service — the real provider',
        role: 'provider service',
        parts: [
          'owns the real contract: GET /orders/{orderId}',
          'answers the well-formed request in production'
        ]
      }
    ],
    wiring: "flowchart LR\n  CLI[\"OrderServiceProxy (consumer under test)\"] -->|\"sends GET /orders/ORD-4007\"| STUB[\"mock provider stub (contract)\"]\n  STUB -->|\"canned reply 200 + JSON body\"| CLI\n  CLI -->|\"same request in production\"| SVC[\"Order Service (real provider)\"]",
    program: `// SYSTEM DESIGN — consumer-side contract test: consumer (OrderServiceProxy) -> mock provider (contract stub) -> provider service (real Order Service)
// PARTIES: CLI = OrderServiceProxy (consumer under test) · STUB = mock provider stub (contract double) · SVC = Order Service (the real provider service)
// DEF: contract — the shape the client must speak; here GET /orders/ORD-4007 answered with status 200 and body {"orderId":"ORD-4007","state":"CREATED"}
// DEF: request — the outbound message the client forms; here {"method":"GET","path":"/orders/ORD-4007","headers":{"Accept":"application/json"}}
// DEF: reply — the incoming message the client parses; here {"status":200,"body":{"orderId":"ORD-4007","state":"CREATED"}}
// STATE (before):
//    request : { method:"", path:"", headers:{} }
//    reply : { status:0, body:{} }
//    verdict : ""
// DEF: exercise_client · CALLED BY: the client-side test driving CLI against STUB
// -> order_id : "ORD-4007"
//    step 1 · CLI forms the request    request : { method:"", path:"" } -> { method:"GET", path:"/orders/ORD-4007" }
//    step 2 · STUB returns the canned reply    reply : { status:0, body:{} } -> { status:200, body:{"orderId":"ORD-4007","state":"CREATED"} }
//    step 3 · CLI parses the reply    verdict : "" -> "pass"  BECAUSE the client read status 200 and decoded orderId and state
// <- outcome : verdict "pass" · the client can communicate  BECAUSE it sent a well-formed request and consumed the stub's reply, which mirrors SVC's real contract`
  },
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'The client\'s half goes unverified', content: '<p><strong>Why.</strong> A service can change, and a client can regress, without anyone noticing that the two no longer fit together.</p><p><strong>Claim.</strong> You need an automated check that the client of a service can still communicate with that service.</p><p><strong>Grounding.</strong> The pattern\'s own statement names the client as the thing under test, not the service.</p><p><strong>In the wild.</strong> An OrderServiceProxy that builds the wrong path silently stops talking to Order Service.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Consumer-side contract test', content: '<p><strong>Why.</strong> Communication is the client\'s own responsibility, so it deserves its own test.</p><p><strong>Claim.</strong> Verify that the client of a service can communicate with the service.</p><p><strong>Grounding.</strong> The test exercises the client\'s outgoing request and its parsing of the incoming reply.</p><p><strong>In the wild.</strong> A consumer-side suite asserts the proxy sends GET /orders/{orderId} and decodes the returned order.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Verifies the client, not the provider', content: '<p><strong>Why.</strong> Passing this test proves only that the client speaks the contract; it says nothing about whether the provider behaves correctly.</p><p><strong>Claim.</strong> This pattern checks the client\'s side, while the consumer-driven contract test checks the provider\'s side.</p><p><strong>Grounding.</strong> The two pattern statements are complementary: the provider meets expectations, and the client can communicate.</p><p><strong>In the wild.</strong> A client that sends a well-formed request still fails if the service returns a 404.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Send and read, nothing in between', content: '<p><strong>Why.</strong> "Communicate" is concrete, so the test targets two moments and nothing else.</p><p><strong>Claim.</strong> The test verifies the client forms the expected request (method, path, headers, body) and consumes the expected response (status, headers, body).</p><p><strong>Grounding.</strong> Those are the same shape fields a REST contract carries on the consumer-provider relationship.</p><p><strong>In the wild.</strong> A miss on the path or a misparse of the body is caught, while deeper business logic is left to other tests.</p>' }
    ]
  },
  quiz: [
    { "question": "What does a consumer-side contract test verify?", "options": ["A. That the provider meets every client's expectations", "B. That the client of a service can communicate with the service", "C. That the database is consistent", "D. That messages are encrypted"], "answer": 2, "explanation": "The pattern statement is: verify that the client of a service can communicate with the service. Verifying the provider meets expectations is the consumer-driven test, and the other options are unrelated.", "conceptRef": "Consumer-side contract test" },
    { "question": "Which side is the subject under test in a consumer-side contract test?", "options": ["A. The provider", "B. The client", "C. The message broker", "D. The network"], "answer": 2, "explanation": "The name and the pattern statement both point at the client as the subject under test. The provider is the subject of the consumer-driven test instead, and the broker or network are not the subject.", "conceptRef": "Verifies the client, not the provider" },
    { "question": "What two directions of communication does \"can communicate\" concretely cover?", "options": ["A. Sending a well-formed request and consuming the reply", "B. Reading and writing the database", "C. Encrypting and decrypting", "D. Logging and tracing"], "answer": 1, "explanation": "Communicating with a service means the client forms the outgoing request and consumes the incoming response — status, headers, and body. Database, encryption, and observability concerns are not what this pattern verifies.", "conceptRef": "Send and read, nothing in between" },
    { "question": "How does a consumer-side contract test relate to a consumer-driven contract test?", "options": ["A. They are the same thing", "B. Consumer-side checks the client can talk; consumer-driven checks the provider meets clients' expectations", "C. The consumer-side test replaces the provider", "D. The consumer-driven test only tests the client"], "answer": 2, "explanation": "They are complementary halves: consumer-driven verifies the provider against consumers' expectations, while consumer-side verifies the client can communicate. They are not identical, and neither replaces the provider.", "conceptRef": "The client's half of the contract" }
  ]
});
