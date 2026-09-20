registerChapter({
  id: 'ch23',
  num: 23,
  title: 'API Gateway',
  pattern: 'Implement an API gateway that is the single entry point for all clients, proxying some requests and fanning others out to multiple services.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 23 · microservices.io /patterns/apigateway.html',
  part: 5,
  flow: [
    {
      section: 'Why clients cannot chase fine-grained APIs',
      color: 'orange',
      motivation: `Microservices expose fine-grained APIs, so one page needs data from many services — and a slow mobile network can only afford a few round-trips.`,
      steps: [
        { num: 1, title: 'One page spans many services', detail: 'Product details data is spread over Product Info, Pricing, Order, Inventory, Review, and more.' },
        { num: 2, title: 'Clients must call each service', detail: 'A client needing the details of one product must fetch data from numerous services.' },
        { num: 3, title: 'Mobile can only afford a few calls', detail: 'A mobile network is much slower, so the client should make few round-trips.' }
      ],
      program: `// CLIENT SIDE — before a gateway, one client talks to many services directly
// PARTIES: MOB = mobile client · PROD = Product Info Service · PRI = Pricing Service · INV = Inventory Service · REV = Review Service
// STATE (before):
//    page : {}                              // the product page the client assembles
//    roundtrips : 0                          // network calls made so far
// DEF: render_product_page · CALLED BY: MOB displaying one product
// -> product : "P-9"                         // the product the client must display
//    step 1 · call PROD    // page : {} -> {title:"POJOs in Action", author:"Chris Richardson"}  · roundtrips : 0 -> 1
//    step 2 · call PRI     // page : {title:"POJOs in Action", author:"Chris Richardson"} -> {title:"POJOs in Action", author:"Chris Richardson", price:39.99}  · roundtrips : 1 -> 2
//    step 3 · call INV     // page : {title:"POJOs in Action", author:"Chris Richardson", price:39.99} -> {title:"POJOs in Action", author:"Chris Richardson", price:39.99, stock:3}  · roundtrips : 2 -> 3
//    step 4 · call REV     // page : {title:"POJOs in Action", author:"Chris Richardson", price:39.99, stock:3} -> {title:"POJOs in Action", author:"Chris Richardson", price:39.99, stock:3, reviews:12}  · roundtrips : 3 -> 4
// <- page : {title:"POJOs in Action", author:"Chris Richardson", price:39.99, stock:3, reviews:12}  · 4 round-trips over a slow mobile network
//    alt the client is on a LAN : 4 round-trips are cheap -> a server-side web app can afford them, the mobile client cannot`
    },
    {
      section: 'Proxy a request to one service',
      color: 'orange',
      motivation: `The gateway handles a request in two ways: some are simply proxied or routed to the appropriate service, while others fan out.`,
      steps: [
        { num: 1, title: 'The client hits the single entry point', detail: 'Every client sends its request to the API gateway, not to individual services.' },
        { num: 2, title: 'The gateway routes to the right service', detail: 'For a simple request, the gateway proxies it to the appropriate service.' },
        { num: 3, title: 'The response returns through the gateway', detail: 'The client receives the answer without learning the service instance or location.' }
      ],
      program: `// GATEWAY SIDE — a simple request is proxied straight to one service
// PARTIES: CLI = client · GW = API Gateway · PROD = Product Info Service
// DEF: route — a path-to-service mapping the gateway proxies on = one entry of route_table; here route_table maps "/products" -> "PROD"
// STATE (before):
//    route_table : {"/products" : "PROD"}      // the gateway's route map
//    response : null
// DEF: route_request · CALLED BY: GW handling one request
// -> request : "GET /products/P-9"             // the client sends one request to the gateway
//    step 1 · match the path    // path : null -> "/products"  BECAUSE the gateway looks the URL up in its route table
//    step 2 · forward to the service    // target : null -> "PROD"  BECAUSE route_table maps "/products" to the Product Info Service
//    step 3 · return the response    // response : null -> {title:"POJOs in Action", author:"Chris Richardson"}
// <- response : {title:"POJOs in Action", author:"Chris Richardson"}  · the client never learned PROD's host or port
//    alt the route table changes : "/products" now maps to "PROD-v2" -> the client keeps sending to the gateway unchanged`
    },
    {
      section: 'Fan out to many services',
      color: 'orange',
      motivation: `For a page that needs several services, the gateway fans out to multiple services and returns one composed response, cutting the client down to a single round-trip.`,
      steps: [
        { num: 1, title: 'One request enters the gateway', detail: 'The client sends a single request for the whole page.' },
        { num: 2, title: 'The gateway fans out', detail: 'The gateway calls the several services that own pieces of the page.' },
        { num: 3, title: 'The gateway composes and returns', detail: 'It merges the partial results and sends one response back to the client.' }
      ],
      program: `// GATEWAY SIDE — a page request is handled by fanning out to multiple services
// PARTIES: CLI = client · GW = API Gateway · PROD = Product Info Service · PRI = Pricing Service · REV = Review Service
// STATE (before):
//    response : {}                              // the composed response the gateway builds
// DEF: compose_product_details · CALLED BY: GW answering one page request
// -> request : "GET /product/P-9"               // the client sends one request, not four
//    step 1 · call PROD    // response : {} -> {title:"POJOs in Action", author:"Chris Richardson"}
//    step 2 · call PRI     // response : {title:"POJOs in Action", author:"Chris Richardson"} -> {title:"POJOs in Action", author:"Chris Richardson", price:39.99}
//    step 3 · call REV     // response : {title:"POJOs in Action", author:"Chris Richardson", price:39.99} -> {title:"POJOs in Action", author:"Chris Richardson", price:39.99, reviews:12}
// <- response : {title:"POJOs in Action", author:"Chris Richardson", price:39.99, reviews:12}  · one round-trip for the client
//    alt one service call fails : the gateway's circuit breaker opens -> the gateway returns a partial page instead of hanging`
    },
    {
      section: 'The costs and variations',
      color: 'orange',
      motivation: `The gateway adds a network hop and is another moving part, but it also insulates clients from partitioning and instance locations — and can expose a different API per client.`,
      steps: [
        { num: 1, title: 'An extra hop, usually insignificant', detail: 'Every request passes through the gateway, adding one more network leg.' },
        { num: 2, title: 'A different API per client', detail: 'Rather than one-size-fits-all, the gateway can expose an API suited to each client.' },
        { num: 3, title: 'A Backends for frontends variation', detail: 'A separate gateway per client type is the Backends for frontends variation.' }
      ],
      program: `// GATEWAY SIDE — the gateway adds one network hop, a small and usually insignificant cost
// PARTIES: CLI = client · GW = API Gateway · PROD = Product Info Service
// STATE (before):
//    hops : []                                // network legs recorded so far
//    latency_ms : 0                            // total time tallied
// DEF: measure_hop · CALLED BY: GW tallying one request's latency
// -> request : "GET /product/P-9"
//    step 1 · CLI to GW    // hops : [] -> ["CLI->GW"]  · latency_ms : 0 -> 12
//    step 2 · GW to PROD   // hops : ["CLI->GW"] -> ["CLI->GW","GW->PROD"]  · latency_ms : 12 -> 24
//    step 3 · back to CLI  // hops : ["CLI->GW","GW->PROD"] -> ["CLI->GW","GW->PROD","GW->CLI"]  · latency_ms : 24 -> 36
// <- latency_ms : 36 over 3 hops  · the extra gateway hop added 12 ms, insignificant for most applications
//    alt no gateway existed : the client calls PROD directly in 24 ms -> but it must then locate and call every other service itself`
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Clients cannot chase fine-grained APIs', content: '<p><strong>Why.</strong> Microservices give fine-grained APIs, so one page needs data from many services.</p><p><strong>Claim.</strong> A client needing the details of a product must fetch data from numerous services, over a network whose speed differs per client type.</p><p><strong>Grounding.</strong> The reference problem — how clients access the individual services — with the forces of granularity mismatch, different clients needing different data, and differing network performance.</p><p><strong>In the wild.</strong> A product details page spread over Product Info, Pricing, Order, Inventory, and Review services.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'The API gateway', content: '<p><strong>Why.</strong> Clients need one entry point and an API matched to their needs.</p><p><strong>Claim.</strong> An API gateway is the single entry point for all clients; it proxies simple requests and fans others out to multiple services, and may expose a different API for each client.</p><p><strong>Grounding.</strong> This is the reference solution, including the Netflix client-specific adapter example.</p><p><strong>In the wild.</strong> Netflix runs an API gateway with client-specific adapter code.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Fewer round-trips, one more hop', content: '<p><strong>Why.</strong> The gateway fans out internally, so the client makes one round-trip instead of many.</p><p><strong>Claim.</strong> It reduces the number of requests and round-trips — essential for mobile — but adds one network hop through the gateway.</p><p><strong>Grounding.</strong> Both are in the reference: the round-trip benefit, and the drawback of increased response time from the extra hop, called insignificant for most applications.</p><p><strong>In the wild.</strong> A mobile client retrieves data from multiple services in a single round-trip.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Yet another moving part', content: '<p><strong>Why.</strong> The gateway sits in front of every request, so it must be built, deployed, and managed.</p><p><strong>Claim.</strong> It insulates clients from partitioning and instance locations, but at the cost of increased complexity.</p><p><strong>Grounding.</strong> The reference benefits — insulating clients from partitioning and from locating instances — balanced against the drawback of increased complexity.</p><p><strong>In the wild.</strong> The gateway often also authenticates users, uses a Circuit Breaker to invoke services, and implements API Composition.</p>' }
    ]
  },
  quiz: [
    { "question": "How does an API gateway handle requests?", "options": ["A. Only by proxying every request to one fixed service", "B. By proxying simple requests and fanning others out to multiple services", "C. Only by fanning out to every service on every request", "D. By storing a copy of every service's database"], "answer": 2, "explanation": "The reference says the gateway handles requests in two ways: some are simply proxied or routed to the appropriate service, and others are handled by fanning out to multiple services. A and C each name only one way, and D is not part of the gateway's job.", "conceptRef": "The API gateway" },
    { "question": "Which is a force the API gateway addresses?", "options": ["A. The granularity of microservice APIs differs from what a client needs", "B. Services cannot communicate with each other", "C. Databases cannot be partitioned", "D. Clients never need to authenticate"], "answer": 1, "explanation": "A listed force is that microservices provide fine-grained APIs while clients need coarser data, so a client must interact with multiple services. The other options are not forces named in the reference.", "conceptRef": "Clients cannot chase fine-grained APIs" },
    { "question": "Which is a stated benefit of the API gateway?", "options": ["A. It eliminates all network latency", "B. It reduces the number of requests and round-trips", "C. It removes the need for service discovery", "D. It guarantees a single database for all services"], "answer": 2, "explanation": "The reference lists reducing requests and round-trips as a benefit — a client can retrieve data from multiple services in a single round-trip. It does not eliminate latency (it adds a hop), does not remove service discovery (it must use it), and does not unify databases.", "conceptRef": "Fewer round-trips, one more hop" },
    { "question": "What is a stated drawback of the API gateway?", "options": ["A. It forces every client to use the same API", "B. It cannot implement security", "C. Increased complexity and increased response time from an extra hop", "D. It requires a message broker"], "answer": 3, "explanation": "The reference drawbacks are increased complexity and increased response time from the additional network hop. The gateway can expose a different API per client and may implement security, ruling out A and B; a broker is not required.", "conceptRef": "Yet another moving part" }
  ]
});
