registerChapter({
  id: 'ch28',
  num: 28,
  title: 'Access Token',
  pattern: 'The API gateway authenticates each request and passes an access token that securely identifies the requestor to every service that handles the request.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 28 · microservices.io /patterns/security/access-token.html',
  part: 7,
  flow: [
    {
      section: 'Authenticate at the gateway',
      color: 'orange',
      motivation: `The API gateway is the single entry point for every client request. If each downstream service re-authenticated the same requestor, the cost and the attack surface would multiply; authenticating once at the gateway and minting a portable token buys a single, trusted identity statement for the whole system.`,
      steps: [
        { num: 1, title: 'Client reaches the single entry point', detail: 'The client sends its request, with credentials, to the API gateway — the one entry point for all client requests.' },
        { num: 2, title: 'The gateway authenticates the request', detail: 'The gateway authenticates the request, confirming who the requestor is.' },
        { num: 3, title: 'The gateway issues an access token', detail: 'The gateway mints an access token, e.g. a JSON Web Token, that securely identifies the requestor to ride along with later requests.' }
      ],
      program: `// API GATEWAY SIDE — authenticate the requestor once and mint a token that carries their identity
// PARTIES: CL = client app · GW = API Gateway (single entry point) · SVC = order service
// DEF: auth — confirming WHO the requestor is, once, at the gateway; here gw_auth = {"alice":"verified"}
// STATE (before):
//    gw_auth : {}                         // identities GW has verified this session
//    payload : ""                         // the identity claim GW will sign into the token
//    token : ""                           // the access token GW will hand back
// DEF: authenticate · CALLED BY: CL posting credentials to the login route
// -> credentials : {"user":"alice","password":"hunter2"}
//    step 1 · GW verifies the credentials    // gw_auth : {} -> {"alice":"verified"}
//    step 2 · GW builds the identity claim    // payload : "" -> {"sub":"alice"}
//    step 3 · GW signs the claim into a JSON Web Token    // token : "" -> "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbGljZSJ9.sig"  BECAUSE the signature lets any service verify the identity without re-authenticating
// <- token : "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbGljZSJ9.sig" returned to CL for every later request
//    alt unknown user : gw_auth : {} -> {"alice":"unknown"} · token : "" -> ""  BECAUSE there is no verified identity to sign, so no token is issued`
    },
    {
      section: 'Verify identity and authorization at the service',
      color: 'orange',
      motivation: `A token only helps if services can trust it. Each service must be able to confirm who made the request and that they are allowed to perform the operation, without a round-trip back to the gateway.`,
      steps: [
        { num: 1, title: 'The gateway forwards the token', detail: 'The gateway passes the access token in each request it forwards to a service.' },
        { num: 2, title: 'The service verifies the requestor', detail: 'The receiving service checks the token to learn the identity of the requestor.' },
        { num: 3, title: 'The service checks authorization', detail: 'The service verifies that the requestor is authorized to perform the requested operation.' }
      ],
      program: `// ORDER SERVICE SIDE — verify the requestor identity and authorization straight from the token
// PARTIES: GW = API Gateway · SVC = order service · CL = client app
// DEF: allowed — whether the requestor may perform the operation; here "alice" is allowed = verdict "authorized"
// DEF: role — the category of actor a requestor belongs to; here role = "customer" from allowed_roles {"alice":"customer"}
// STATE (before):
//    allowed_roles : {"alice":"customer"}    // roles that may act on orders
//    requestor : ""                          // identity read out of the token
//    verdict : "pending"                     // the authorization decision, not yet made
// DEF: handle_order · CALLED BY: GW forwarding a request that carries the token
// -> token : "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbGljZSJ9.sig" · -> operation : "place_order"
//    step 1 · SVC verifies the token signature    // verdict : "pending" -> "authentic"
//    step 2 · SVC reads the identity from the token claims    // requestor : "" -> "alice"
//    step 3 · SVC checks the role against the operation    // verdict : "authentic" -> "authorized"  BECAUSE allowed_roles maps "alice" to "customer", which may place an order
// <- verdict : "authorized" — SVC proceeds with "place_order"
//    alt invalid signature : verdict : "pending" -> "rejected" — SVC refuses the request`
    },
    {
      section: 'Propagate the token across service calls',
      color: 'orange',
      motivation: `Requests are not one hop; a service often invokes other services to satisfy a request. Passing the same token onward keeps the requestor's identity intact across the entire call chain, so no service has to re-establish it.`,
      steps: [
        { num: 1, title: 'A service receives the token', detail: 'An intermediate service receives a request that carries the access token.' },
        { num: 2, title: 'It includes the token downstream', detail: 'When that service invokes another service, it includes the same access token in the request.' },
        { num: 3, title: 'The next service verifies from the same token', detail: 'The downstream service verifies identity and authorization from that token, with no fresh authentication.' }
      ],
      program: `// PAYMENT SERVICE SIDE — a service includes the token when it calls another service
// PARTIES: SVC = order service · PAY = payment service · CL = client app
// DEF: verdict — the authorization decision a service reaches about a request; here pay_verdict = "pending" then "authorized"
// STATE (before):
//    incoming : ""                     // token SVC received on its own request
//    forwarded : ""                    // token SVC sends onward to PAY
//    pay_verdict : "pending"           // PAY's authorization decision
// DEF: invoke_payment · CALLED BY: SVC needing to charge the customer's card
// -> token : "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbGljZSJ9.sig"
//    step 1 · SVC stores the token it received    // incoming : "" -> "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbGljZSJ9.sig"
//    step 2 · SVC attaches the same token to its call to PAY    // forwarded : "" -> "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbGljZSJ9.sig"
//    step 3 · PAY verifies the token and authorizes the charge    // pay_verdict : "pending" -> "authorized"  BECAUSE the token still identifies "alice", whose role permits the charge
// <- pay_verdict : "authorized" — the charge is processed for "alice"`
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Communicating the requestor identity', content: '<p><strong>Why.</strong> The API gateway authenticates a request and forwards it to numerous services, which may in turn invoke other services.</p><p><strong>Claim.</strong> Each service needs to know who made the request without re-authenticating on every hop.</p><p><strong>Grounding.</strong> The reference problem: how to communicate the identity of the requestor to the services that handle the request.</p><p><strong>In the wild.</strong> Without a shared credential, every service duplicates authentication logic and each hop needs its own proof of identity.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Pass an access token with each request', content: '<p><strong>Why.</strong> The gateway can authenticate once and stamp the requestor identity into a portable, signed credential.</p><p><strong>Claim.</strong> The API gateway passes an access token (e.g. a JSON Web Token) that securely identifies the requestor in each request; a service may include it in requests to other services.</p><p><strong>Grounding.</strong> This is the reference solution, nearly verbatim.</p><p><strong>In the wild.</strong> JSON Web Token is the canonical format; the reference points to JWT usage examples and supporting libraries.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Identity now flows with every request', content: '<p><strong>Why.</strong> The token has to reach every service in the call chain to be useful.</p><p><strong>Claim.</strong> The benefit is that the identity of the requestor is securely passed around the system.</p><p><strong>Grounding.</strong> Listed as the first benefit in the resulting context.</p><p><strong>In the wild.</strong> The cost is that each forwarded request must carry the token, so the credential travels on every hop.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Authorization is distributed to the services', content: '<p><strong>Why.</strong> Services often need to verify that a user is authorized to perform an operation.</p><p><strong>Claim.</strong> With the token in hand, each service can verify that the requestor is authorized, without consulting the gateway.</p><p><strong>Grounding.</strong> Listed as the second benefit in the resulting context.</p><p><strong>In the wild.</strong> The tradeoff is that verification duty is spread across every service, so each one must implement token validation.</p>' }
    ]
  },
  quiz: [
    { "question": "What problem does the Access Token pattern solve?", "options": ["A. How to split a monolith into services", "B. How to communicate the identity of the requestor to the services that handle the request", "C. How to discover the network location of a service", "D. How to store configuration outside the code"], "answer": 2, "explanation": "The pattern exists because once the API gateway authenticates a request, downstream services still need to know who made it. The reference problem is exactly: how to communicate the requestor's identity to the services that handle the request. A and C describe other patterns (decomposition, service discovery), and D describes Externalized Configuration.", "conceptRef": "Communicating the requestor identity" },
    { "question": "Who authenticates the request and issues the access token?", "options": ["A. Every service independently", "B. The database", "C. The API gateway", "D. The client"], "answer": 3, "explanation": "The API gateway is the single entry point; it authenticates the request and passes the token to services. Each service verifies the token rather than re-authenticating, which rules out A; B and D never authenticate or issue tokens in this pattern.", "conceptRef": "Pass an access token with each request" },
    { "question": "When one service calls another, what should it do with the access token?", "options": ["A. Drop it and re-authenticate as itself", "B. Include the access token in the request it makes to the other service", "C. Replace it with the database credentials", "D. Send it only to the API gateway"], "answer": 2, "explanation": "The reference states a service can include the access token in requests it makes to other services, so the requestor identity survives the whole call chain. Dropping it (A) loses the identity; C and D are not part of the pattern.", "conceptRef": "Identity now flows with every request" },
    { "question": "What is a stated benefit of the Access Token pattern?", "options": ["A. The requestor's identity is securely passed around the system, and services can verify authorization", "B. The service runs in multiple environments without modification", "C. A service knows the network location of other services", "D. Requests never need authentication again"], "answer": 1, "explanation": "Both listed benefits — identity securely passed around, and services verifying authorization — are stated in the resulting context. B is Externalized Configuration's benefit, C is service discovery, and D overstates it (authentication still happens, just once at the gateway).", "conceptRef": "Authorization is distributed to the services" }
  ]
});
