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
