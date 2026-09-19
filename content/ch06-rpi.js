registerChapter({
  id: 'ch06',
  num: 6,
  title: 'Remote Procedure Invocation',
  pattern: 'Synchronous inter-service communication where a client uses a request/reply-based protocol to invoke a service.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 6 · microservices.io /patterns/communication-style/rpi.html',
  part: 2,
  flow: [
    {
      section: 'Invoke over request/reply',
      color: 'orange',
      motivation: `RPI is the familiar synchronous call: the client sends a request and waits for a reply, with no broker in between.`,
      steps: [
        { num: 1, title: 'Send a request', detail: 'The client uses a request/reply protocol (REST, gRPC, or Apache Thrift) to call a service.' },
        { num: 2, title: 'Wait for the reply', detail: 'The client blocks until the reply arrives, then carries on.' },
        { num: 3, title: 'Map the response', detail: 'A 200 OK yields the new id; RegistrationServiceProxy returns <strong>Right(id)</strong>.' }
      ],
      program: `// CLIENT SIDE — RPI: the client POSTs a request and waits for a reply, with no broker in between
// PARTIES: CLIENT = Registration Service · SVC = User Registration service (remote)
// STATE (before):
//    request : null
//    status : "PENDING"
//    verdict : "UNSET"
//    result : null
//    url : "http://user-reg:8080/register"
// DEF: registerUser · CALLED BY: a new user signing up (RestTemplate.postForEntity)
// -> email : "ada@example.com" · -> password : "s3cret"
//    step 1 · CLIENT POSTs the request to SVC  : request : null -> { email: "ada@example.com", password: "s3cret" }
//    step 2 · SVC creates the user and answers : status : "PENDING" -> 200
//    step 3 · CLIENT reads the status code     : verdict : "UNSET" -> "OK"
//    step 4 · CLIENT returns the new id        : result : null -> "user-9"
// <- reply : "user-9" (Right) · one request, one prompt reply over HTTP`
    },
    {
      section: 'Map errors to typed results',
      color: 'orange',
      motivation: `A failed or duplicate call must become a typed result, not an unhandled exception.`,
      steps: [
        { num: 1, title: 'Catch the status', detail: 'The proxy inspects the HTTP status code of the response.' },
        { num: 2, title: 'Map 200 to success', detail: 'An <strong>HttpStatus.OK</strong> returns Right(id).' },
        { num: 3, title: 'Map CONFLICT to an error', detail: 'An HttpClientErrorException with CONFLICT becomes <strong>Left(DuplicateRegistrationError)</strong>.' }
      ],
      program: `// CLIENT SIDE — RPI error path: a duplicate sign-up maps a 409 CONFLICT to a typed error
// PARTIES: CLIENT = Registration Service · SVC = User Registration service (remote)
// STATE (before):
//    request : null
//    status : "PENDING"
//    verdict : "UNSET"
//    result : null
//    url : "http://user-reg:8080/register"
// DEF: registerUser_duplicate · CALLED BY: the same email signing up twice
// -> email : "ada@example.com" · -> password : "s3cret"
//    step 1 · CLIENT POSTs the request again    : request : null -> { email: "ada@example.com" }
//    step 2 · SVC finds the email already taken : status : "PENDING" -> 409
//    step 3 · CLIENT matches the 409            : verdict : "UNSET" -> "CONFLICT"
//    step 4 · CLIENT returns the typed error    : result : null -> "DuplicateRegistrationError"
// <- reply : "DuplicateRegistrationError" (Left) · the 409 becomes a domain error
//    alt SVC down : no reply at all  BECAUSE client and service must both be available for the whole call`
    },
    {
      section: 'The availability price',
      color: 'orange',
      motivation: `Because both client and service must be up for the whole interaction, RPI reduces availability and blocks threads.`,
      steps: [
        { num: 1, title: 'Both sides must be available', detail: 'Client and service must be available for the duration of the interaction.' },
        { num: 2, title: 'Threads wait', detail: 'The caller thread is held while it waits for the reply.' },
        { num: 3, title: 'Only request/reply', detail: 'RPI usually cannot express notifications, publish/subscribe, or async response.' }
      ],
      program: `// CLIENT SIDE — RPI availability: client and service must both be available for the whole call
// PARTIES: CLIENT = Registration Service · SVC = User Registration service (unresponsive)
// STATE (before):
//    thread : "FREE"
//    elapsed_ms : 0
//    timeout_ms : 800
//    verdict : "UNSET"
// DEF: registerUser_unavailable · CALLED BY: a sign-up while SVC is unresponsive
// -> request : { email: "ada@example.com" }
//    step 1 · CLIENT blocks its thread on the call : thread : "FREE" -> "WAITING"
//    step 2 · SVC is down, so no reply arrives     : elapsed_ms : 0 -> 800
//    step 3 · the timer expires and the call fails : verdict : "UNSET" -> "TIMEOUT"
//    step 4 · the thread is released               : thread : "WAITING" -> "FREE"
// <- reply : "TIMEOUT" after 800 ms · 800 ms of the caller thread spent waiting
//    alt SVC slow but alive : the reply arrives late  BECAUSE there is no broker to buffer the work`
    },
    {
      section: 'Discovery and resilience wiring',
      color: 'orange',
      motivation: `A client must find a service instance and guard the call: discovery resolves the location, a circuit breaker contains failure.`,
      steps: [
        { num: 1, title: 'Discover the instance', detail: 'The client needs to discover locations of service instances, via client-side or server-side discovery.' },
        { num: 2, title: 'Resolve the URL from config', detail: 'Externalized configuration supplies the network location (the <strong>user_registration_url</strong>).' },
        { num: 3, title: 'Guard with a circuit breaker', detail: 'A client typically uses a Circuit Breaker to improve reliability (the <strong>@HystrixCommand</strong> wrapper).' }
      ],
      program: `// CLIENT SIDE — RPI wiring: discover an instance, resolve its URL, then invoke behind a breaker
// PARTIES: CLIENT = Registration Service · DISC = service registry · SVC = User Registration instance
// STATE (before):
//    registry : { "user-registration": "10.0.0.7:8080" }
//    lookup : null
//    location : null
//    url : null
//    request : null
// DEF: resolve_and_call · CALLED BY: CLIENT before its first call
// -> service_name : "user-registration"
//    step 1 · CLIENT asks DISC for an instance   : lookup : null -> "user-registration"
//    step 2 · DISC returns a network location    : location : null -> "10.0.0.7:8080"
//    step 3 · CLIENT builds the URL              : url : null -> "http://10.0.0.7:8080/register"
//    step 4 · CLIENT invokes SVC behind a breaker : request : null -> { email: "ada@example.com" }
// <- reply : "user-9" · the URL came from discovery, the call rides behind a circuit breaker
//    alt breaker open : the call fails fast without touching SVC  BECAUSE a client typically uses a Circuit Breaker`
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Synchronous coupling', content: '<p><strong>Why.</strong> When a call is synchronous, both ends must be alive for the whole interaction, so a slow or dead callee stalls the caller.</p><p><strong>Claim.</strong> Synchronous communication results in tight runtime coupling between client and service.</p><p><strong>Grounding.</strong> The reference lists it as a force: both the client and service must be available for the duration of the request.</p><p><strong>In the wild.</strong> A registration call that blocks until the user service answers, holding the caller thread the entire time.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Request/reply invocation', content: '<p><strong>Why.</strong> Sometimes a service genuinely needs an immediate answer from another service.</p><p><strong>Claim.</strong> The client uses a request/reply-based protocol to make requests to a service, via REST, gRPC, or Apache Thrift.</p><p><strong>Grounding.</strong> The solution: use RPI; the client uses a request/reply protocol; the examples are REST, gRPC, and Apache Thrift.</p><p><strong>In the wild.</strong> RegistrationServiceProxy POSTs a RegistrationBackendRequest and returns the new id on a 200 OK.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Simple, familiar, no broker', content: '<p><strong>Why.</strong> A system is easier to run when there is no intermediate component to operate.</p><p><strong>Claim.</strong> RPI is simple and familiar, request/reply is easy, and the system is simpler because there is no intermediate broker.</p><p><strong>Grounding.</strong> The resulting context lists simplicity, easy request/reply, and no broker as benefits.</p><p><strong>In the wild.</strong> A two-service system where a plain REST call needs no queue, topic, or broker to keep alive.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Only request/reply, reduced availability', content: '<p><strong>Why.</strong> Synchrony is a restriction, not just a style choice.</p><p><strong>Claim.</strong> RPI usually only supports request/reply, and availability is reduced because client and service must be available for the whole interaction.</p><p><strong>Grounding.</strong> The resulting context lists the pattern restriction and reduced availability as drawbacks.</p><p><strong>In the wild.</strong> A caller cannot send a fire-and-forget notification through an RPI-only API.</p>' }
    ]
  },
  quiz: [
    { "question": "What protocol does an RPI client use to call a service?", "options": ["A. A request/reply-based protocol", "B. A fire-and-forget protocol", "C. A publish/subscribe protocol", "D. A shared-memory protocol"], "answer": 1, "explanation": "RPI is defined by a request/reply-based protocol. Fire-and-forget (B) and publish/subscribe (C) are messaging styles, and shared memory (D) is not inter-process communication.", "conceptRef": "Request/reply invocation" },
    { "question": "Which is NOT an RPI technology named in the reference?", "options": ["A. REST", "B. gRPC", "C. Apache Thrift", "D. Apache Kafka"], "answer": 4, "explanation": "Kafka is a message broker, not an RPI mechanism. REST (A), gRPC (B), and Apache Thrift (C) are the RPI examples.", "conceptRef": "Request/reply invocation" },
    { "question": "Which is a benefit of RPI?", "options": ["A. It supports publish/subscribe", "B. It is simple, familiar, and needs no broker", "C. It buffers messages while the consumer is down", "D. It decouples sender from consumer"], "answer": 2, "explanation": "RPI is simple, familiar, and broker-free. Options A, C, and D are messaging benefits, not RPI benefits.", "conceptRef": "Simple, familiar, no broker" },
    { "question": "Which is a drawback of RPI?", "options": ["A. The broker must be highly available", "B. Client and service must both be available for the whole interaction", "C. It cannot use REST", "D. It requires Kafka"], "answer": 2, "explanation": "RPI reduces availability because both sides must be up for the duration. Options A and D are messaging broker concerns, and C is false since REST is an RPI example.", "conceptRef": "Only request/reply, reduced availability" }
  ]
});
