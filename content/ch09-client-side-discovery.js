registerChapter({
  id: 'ch09',
  num: 9,
  title: 'Client-Side Discovery',
  pattern: 'When making a request, the client queries the service registry for the network location of a service instance and calls that instance directly, instead of routing through a load balancer.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 9 · microservices.io /patterns/client-side-discovery.html',
  part: 3,
  flow: [
    {
      section: 'Why fixed locations no longer work',
      color: 'orange',
      motivation: `Instances under dynamic IPs and load-driven scaling cannot be reached by a fixed host and port, so clients need a lookup mechanism.`,
      steps: [
        { num: 1, title: 'From method calls to fixed endpoints', detail: 'Monoliths used language-level calls; traditional deployments used fixed, well-known hosts and ports.' },
        { num: 2, title: 'Dynamic IPs', detail: 'VMs and containers are usually assigned dynamic IP addresses.' },
        { num: 3, title: 'Varying instance counts', detail: 'An EC2 Autoscaling Group adjusts the number of instances based on load.' },
        { num: 4, title: 'A lookup is needed', detail: 'Clients need a mechanism to reach a dynamically changing set of ephemeral instances.' }
      ],
      program: `// CLIENT SIDE — a hardcoded host:port goes stale the moment instances move, motivating a lookup mechanism
// PARTIES: CLI = order-service client · SVC = order-service instances
// DEF: call — one request the client sends to the order-service = call_status "ok", which becomes "connection refused" once the endpoint goes stale
// DEF: instance — one running copy of the order-service = the VM at instance_ip "10.0.1.7"
// DEF: ip — the network address of an instance = "10.0.1.7", replaced by "10.0.1.9" when the autoscaler scales out
// STATE (before):
//    endpoint : "http://10.0.1.7:8080"
//    instance_ip : "10.0.1.7"
//    call_status : "ok"
// DEF: an autoscaling event moves the instance · CALLED BY: the EC2 Autoscaling Group
// -> scale_event : "replace 10.0.1.7 with 10.0.1.9"
//    step 1 · instance_ip : "10.0.1.7" -> "10.0.1.9"   BECAUSE the autoscaler replaced the VM
//    step 2 · endpoint : "http://10.0.1.7:8080" -> "http://10.0.1.7:8080 (stale)"   BECAUSE the client still points at the old IP
//    step 3 · call_status : "ok" -> "connection refused"   BECAUSE the client dials the dead 10.0.1.7
// <- call result : "connection refused"   (the client never learned the new location)
//    alt with discovery : CLI queries a registry -> endpoint : "http://10.0.1.7:8080 (stale)" -> "http://10.0.1.9:8080"`
    },
    {
      section: 'Resolve via the registry on every call',
      color: 'orange',
      motivation: `The core move: the client asks the registry where an instance lives, then calls that instance directly — no router in the middle.`,
      steps: [
        { num: 1, title: 'Ask the registry', detail: 'The client queries the Service Registry, which knows the locations of all instances.' },
        { num: 2, title: 'Get a location', detail: 'The registry returns the network location (host and port) of an available instance.' },
        { num: 3, title: 'Call the instance directly', detail: 'The client sends the request straight to that instance over HTTP/REST or another remote API.' },
        { num: 4, title: 'Chassis does the work', detail: 'This lookup is typically handled by a <strong>microservice chassis</strong> framework.' }
      ],
      program: `// CLIENT SIDE — resolve a logical name to a concrete instance, then call that instance directly
// PARTIES: CLI = order-service client · REG = service registry · SVC = order-service instances
// STATE (before):
//    registry : {"order-service" -> [{"host":"10.0.1.7","port":8080},{"host":"10.0.1.8","port":8080}]}
//    resolved : []
//    target : "none"
// DEF: a client wants to call order-service · CALLED BY: CLI placing an order
// -> request : "POST /orders"
//    step 1 · query the registry : CLI asks REG for "order-service"
//    step 2 · resolve : resolved : [] -> ["10.0.1.7:8080","10.0.1.8:8080"]   BECAUSE the registry returns all known instances
//    step 3 · pick one : target : "none" -> "10.0.1.7:8080"   BECAUSE the client load-balances across the returned set
// <- call : "POST http://10.0.1.7:8080/orders"   (the client calls the instance directly)
//    alt second attempt : the first instance is busy -> target : "10.0.1.7:8080" -> "10.0.1.8:8080"`
    },
    {
      section: 'Eureka and Ribbon wire it together',
      color: 'orange',
      motivation: `Spring Cloud hides the lookup: a logical name in the URL is resolved by Eureka and Ribbon into a concrete network location.`,
      steps: [
        { num: 1, title: 'Logical name, not IP', detail: 'user_registration_url is set to http://REGISTRATION-SERVICE/user — a logical service name.' },
        { num: 2, title: 'Enable the Eureka client', detail: '@EnableEurekaClient turns on the Eureka client in the chassis.' },
        { num: 3, title: 'Load-balance with Ribbon', detail: '@LoadBalanced configures the RestTemplate to use Ribbon, which queries Eureka to route requests.' },
        { num: 4, title: 'Resolve and call', detail: 'The RestTemplate resolves the logical name to a network location and calls an instance.' }
      ],
      program: `// CLIENT SIDE — the chassis (Spring Cloud) resolves a logical name via Eureka + Ribbon under the hood
// PARTIES: CLI = RegistrationServiceProxy · RBN = Ribbon (HTTP client) · EUK = Eureka (registry) · SVC = registration-service instance
// DEF: resttemplate — the Spring HTTP client whose URL host is resolved by Ribbon = restTemplate_target "unresolved", rewritten to "10.0.2.4:8080"
// DEF: target — the network location a request is routed to = "10.0.2.4:8080"
// STATE (before):
//    eureka_registry : {"registration-service" -> [{"host":"10.0.2.4","port":8080}]}
//    restTemplate_target : "unresolved"
//    instances : []
// DEF: the proxy registers a user · CALLED BY: CLI calling restTemplate.postForEntity
// -> request_url : "http://REGISTRATION-SERVICE/user"   (a logical name, not an IP)
//    step 1 · @LoadBalanced intercepts : restTemplate_target : "unresolved" -> "REGISTRATION-SERVICE"   BECAUSE the URL host is a logical service name
//    step 2 · Ribbon asks Eureka : instances : [] -> [{"host":"10.0.2.4","port":8080}]   BECAUSE Ribbon queried Eureka for "registration-service"
//    step 3 · route to the instance : restTemplate_target : "REGISTRATION-SERVICE" -> "10.0.2.4:8080"   BECAUSE Ribbon rewrites the logical name to a network location
// <- http call : "POST http://10.0.2.4:8080/user"   (the request now hits a real instance)
//    alt no instance found : Ribbon gets [] -> restTemplate_target : "REGISTRATION-SERVICE" -> "unresolved" (the call fails)`
    },
    {
      section: 'Fewer hops, but coupled to the registry',
      color: 'orange',
      motivation: `Client-side discovery wins on hops, but it couples the client to the registry and must be re-implemented in every language your clients use.`,
      steps: [
        { num: 1, title: 'Fewer moving parts', detail: 'Client-side discovery has fewer moving parts and network hops than server-side discovery.' },
        { num: 2, title: 'Coupled to the registry', detail: 'The client is coupled to the Service Registry.' },
        { num: 3, title: 'Per-language logic', detail: 'Discovery logic must be implemented per language/framework, such as Java/Scala or JavaScript/NodeJS.' },
        { num: 4, title: 'Prana for non-JVM', detail: 'Netflix Prana offers an HTTP-proxy approach to discovery for non-JVM clients.' }
      ],
      program: `// CLIENT SIDE — hop-count comparison: client-side discovery takes fewer hops and moving parts than server-side
// PARTIES: CLI = client · REG = registry · SVC = order-service instance · RTR = router (server-side only)
// STATE (before):
//    mode : "client-side"
//    hops_client_side : 0
//    hops_server_side : 0
//    parts_client_side : 0
//    parts_server_side : 0
// DEF: measure one request's cost · CALLED BY: CLI sending one request
// -> request : "POST /orders"
//    step 1 · hops_client_side : 0 -> 2   BECAUSE the client hops to REG then to SVC (two hops)
//    step 2 · hops_server_side : 0 -> 3   BECAUSE the client hops to RTR, which hops to REG then SVC (three hops)
//    step 3 · moving parts : parts_client_side : 0 -> 2, parts_server_side : 0 -> 3   BECAUSE server-side adds the router as an extra component
// <- comparison : "2 hops vs 3 hops"   (client-side wins on hops, but couples the client to the registry)
//    alt non-JVM client : Netflix Prana runs a local HTTP proxy -> the client keeps its 2-hop path without JVM discovery code`
    }
  ],
  interview: [
    {
      scenario: "An order-service client still dials a hardcoded 10.0.3.7, but the autoscaler has just replaced that VM with 10.0.3.9.",
      q: "Why do fixed host:port locations break in a microservice deployment, and what mechanism replaces them?",
      solution: "Instances get dynamic IPs and vary in count under autoscaling, so a fixed location goes stale; clients need a lookup mechanism to reach the changing set of instances.",
      components: ["Dynamic IPs", "Autoscaling group", "Stale fixed endpoint", "Lookup mechanism"],
      
      code: `// CLIENT SIDE — a hardcoded host:port goes stale the moment instances move, motivating a lookup mechanism
// PARTIES: CLI = order-service client · SVC = order-service instances
// DEF: call — one request the client sends to the order-service = call_status "ok", which becomes "connection refused" once the endpoint goes stale
// DEF: instance — one running copy of the order-service = the VM at instance_ip "10.0.3.7"
// DEF: ip — the network address of an instance = "10.0.3.7", replaced by "10.0.3.9" when the autoscaler scales out
// STATE (before):
//    endpoint : "http://10.0.3.7:8080"
//    instance_ip : "10.0.3.7"
//    call_status : "ok"
// DEF: an autoscaling event moves the instance · CALLED BY: the EC2 Autoscaling Group
// -> scale_event : "replace 10.0.3.7 with 10.0.3.9"
//    step 1 · instance_ip : "10.0.3.7" -> "10.0.3.9"   BECAUSE the autoscaler replaced the VM
//    step 2 · endpoint : "http://10.0.3.7:8080" -> "http://10.0.3.7:8080 (stale)"   BECAUSE the client still points at the old IP
//    step 3 · call_status : "ok" -> "connection refused"   BECAUSE the client dials the dead 10.0.3.7
// <- call result : "connection refused"   (the client never learned the new location)
//    alt with discovery : CLI queries a registry -> endpoint : "http://10.0.3.7:8080 (stale)" -> "http://10.0.3.9:8080"`,
      tieback: "This is exactly the dynamic-instances force that motivates client-side discovery in this chapter.",
      refs: ["Why fixed locations no longer work"],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: "An order-service client must place an order but does not know which instances are up right now.",
      q: "How does the client resolve a logical service name to a concrete instance on every call?",
      solution: "The client queries the service registry, which knows all instance locations, then calls the chosen instance directly — no router in the middle.",
      components: ["Service registry query", "Returned instance set", "Direct call to the instance"],
      
      code: `// CLIENT SIDE — resolve a logical name to a concrete instance, then call that instance directly
// PARTIES: CLI = order-service client · REG = service registry · SVC = order-service instances
// STATE (before):
//    registry : {"order-service" -> [{"host":"10.0.3.7","port":8080},{"host":"10.0.3.8","port":8080}]}
//    resolved : []
//    target : "none"
// DEF: a client wants to call order-service · CALLED BY: CLI placing an order
// -> request : "POST /orders"
//    step 1 · query the registry : CLI asks REG for "order-service"
//    step 2 · resolve : resolved : [] -> ["10.0.3.7:8080","10.0.3.8:8080"]   BECAUSE the registry returns all known instances
//    step 3 · pick one : target : "none" -> "10.0.3.7:8080"   BECAUSE the client load-balances across the returned set
// <- call : "POST http://10.0.3.7:8080/orders"   (the client calls the instance directly)
//    alt second attempt : the first instance is busy -> target : "10.0.3.7:8080" -> "10.0.3.8:8080"`,
      tieback: "This is exactly the query-the-registry-then-call-directly mechanism in this chapter.",
      refs: ["Resolve via the registry on every call"],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: "The registration proxy's configured URL is http://REGISTRATION-SERVICE/user — a logical name, not an IP — and the team wants to know how it ever reaches a real host.",
      q: "How do Eureka and Ribbon turn a logical service name into a network location?",
      solution: "@EnableEurekaClient turns on the Eureka client, and @LoadBalanced makes the RestTemplate use Ribbon, which queries Eureka and rewrites the logical name to a network location.",
      components: ["@EnableEurekaClient", "@LoadBalanced RestTemplate", "Ribbon (queries Eureka)", "Resolved network location"],
      
      code: `// CLIENT SIDE — the chassis (Spring Cloud) resolves a logical name via Eureka + Ribbon under the hood
// PARTIES: CLI = RegistrationServiceProxy · RBN = Ribbon (HTTP client) · EUK = Eureka (registry) · SVC = registration-service instance
// DEF: resttemplate — the Spring HTTP client whose URL host is resolved by Ribbon = restTemplate_target "unresolved", rewritten to "10.0.4.4:8080"
// DEF: target — the network location a request is routed to = "10.0.4.4:8080"
// STATE (before):
//    eureka_registry : {"registration-service" -> [{"host":"10.0.4.4","port":8080}]}
//    restTemplate_target : "unresolved"
//    instances : []
// DEF: the proxy registers a user · CALLED BY: CLI calling restTemplate.postForEntity
// -> request_url : "http://REGISTRATION-SERVICE/user"   (a logical name, not an IP)
//    step 1 · @LoadBalanced intercepts : restTemplate_target : "unresolved" -> "REGISTRATION-SERVICE"   BECAUSE the URL host is a logical service name
//    step 2 · Ribbon asks Eureka : instances : [] -> [{"host":"10.0.4.4","port":8080}]   BECAUSE Ribbon queried Eureka for "registration-service"
//    step 3 · route to the instance : restTemplate_target : "REGISTRATION-SERVICE" -> "10.0.4.4:8080"   BECAUSE Ribbon rewrites the logical name to a network location
// <- http call : "POST http://10.0.4.4:8080/user"   (the request now hits a real instance)
//    alt no instance found : Ribbon gets [] -> restTemplate_target : "REGISTRATION-SERVICE" -> "unresolved" (the call fails)`,
      tieback: "This is exactly the Eureka-plus-Ribbon wiring in this chapter.",
      refs: ["Eureka and Ribbon wire it together"],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: "The team weighs client-side discovery against a server-side router for the same request path.",
      q: "How do the two discovery approaches compare on hops and coupling, and what per-language cost does client-side discovery carry?",
      solution: "Client-side discovery has fewer moving parts and network hops but couples the client to the registry, and discovery logic must be re-implemented per language or framework.",
      components: ["Client-side: 2 hops", "Server-side: 3 hops", "Client coupled to registry", "Per-language discovery logic"],
      
      code: `// CLIENT SIDE — hop-count comparison: client-side discovery takes fewer hops and moving parts than server-side
// PARTIES: CLI = client · REG = registry · SVC = order-service instance · RTR = router (server-side only)
// STATE (before):
//    mode : "client-side"
//    hops_client_side : 0
//    hops_server_side : 0
//    parts_client_side : 0
//    parts_server_side : 0
// DEF: measure one request's cost · CALLED BY: CLI sending one request
// -> request : "POST /orders"
//    step 1 · hops_client_side : 0 -> 2   BECAUSE the client hops to REG then to SVC (two hops)
//    step 2 · hops_server_side : 0 -> 3   BECAUSE the client hops to RTR, which hops to REG then SVC (three hops)
//    step 3 · moving parts : parts_client_side : 0 -> 2, parts_server_side : 0 -> 3   BECAUSE server-side adds the router as an extra component
// <- comparison : "2 hops vs 3 hops"   (client-side wins on hops, but couples the client to the registry)
//    alt non-JVM client : Netflix Prana runs a local HTTP proxy -> the client keeps its 2-hop path without JVM discovery code`,
      tieback: "This is exactly the fewer-hops-versus-coupling tradeoff in this chapter.",
      refs: ["Fewer hops, but coupled to the registry"],
      problems: ["01-scale-from-zero-to-millions"]
    }
  ],
  systemDesign: {
    question: 'Design service discovery where the client picks the instance. Premise: the client queries the service registry and load-balances across service instances itself, so no server-side hop is needed.',
    pipeline: 'client → service registry → service instances (client load-balances)',
    decomposition: [
      {
        box: 'order-service client — the client',
        role: 'client',
        parts: [
          'Queries the registry for a service name',
          'Selects one instance from the returned set',
          'Load-balances across the instances'
        ]
      },
      {
        box: 'service registry (Eureka) — the store of locations',
        role: 'service registry',
        parts: [
          'Keeps the name -> instances map',
          'Returns instance locations on query'
        ]
      },
      {
        box: 'order-service instances — the targets',
        role: 'service instances',
        parts: [
          'Self-register on startup',
          'Serve the direct request'
        ]
      }
    ],
    
    program: `// SYSTEM DESIGN — client-side discovery as a pipeline: client -> service registry -> service instances (the client load-balances and calls one instance directly, no router)
// PARTIES: CLI = order-service client (queries the registry, load-balances, and calls an instance directly) · REG = service registry (Eureka) · SVC = order-service instances (self-register and serve requests)
// DEF: registry — REG's map of service name -> instances; here {"order-service" -> ["10.0.1.7:8080", "10.0.1.8:8080"]}
// DEF: list — the instances REG returns for one name; here ["10.0.1.7:8080", "10.0.1.8:8080"]
// DEF: target — the one instance location the client picks; here "10.0.1.7:8080"
// DEF: status — the outcome of the direct call; here "200 OK"
// STATE (before):
//    registry : {"order-service" -> ["10.0.1.7:8080", "10.0.1.8:8080"]}
//    list     : []
//    target   : "none"
//    status   : "none"
// DEF: resolve_and_call · CALLED BY: CLI placing an order
// -> request : "POST /orders"
//    step 1 · CLI queries REG for "order-service"    list : [] -> ["10.0.1.7:8080", "10.0.1.8:8080"]   BECAUSE REG returns every known instance for the name
//    step 2 · CLI load-balances across the set    target : "none" -> "10.0.1.7:8080"   BECAUSE the client picks one instance from the returned list
//    step 3 · CLI calls the instance directly    status : "none" -> "200 OK"   BECAUSE the request goes straight to the chosen instance, no router
// <- call : "POST http://10.0.1.7:8080/orders"   (2 hops: CLI->REG then CLI->SVC)`
  },
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Dynamic instances break fixed locations', content: '<p><strong>Why.</strong> Services call each other, but in containers and VMs the instance count and their locations change constantly, so any fixed host:port breaks.</p><p><strong>Claim.</strong> A client needs a mechanism to reach a dynamically changing set of ephemeral service instances.</p><p><strong>Grounding.</strong> Richardson\'s forces: VMs and containers get dynamic IPs, and an EC2 Autoscaling Group varies the number of instances with load.</p><p><strong>In the wild.</strong> A monolith used language-level calls; a traditional deployment used fixed well-known locations — neither survives an autoscaled container fleet.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Query the registry on every call', content: '<p><strong>Why.</strong> The client must learn the location fresh, because the location changes between requests.</p><p><strong>Claim.</strong> The client queries a Service Registry, which knows all instance locations, then calls the chosen instance directly.</p><p><strong>Grounding.</strong> Richardson\'s solution: "the client obtains the location of a service instance by querying a Service Registry," typically via a microservice chassis.</p><p><strong>In the wild.</strong> The RegistrationServiceProxy resolves http://REGISTRATION-SERVICE/user by asking Eureka and routing through Ribbon.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Fewer hops, but coupled to the registry', content: '<p><strong>Why.</strong> Going straight from client to instance removes a middleman, but it binds the client to the registry interface.</p><p><strong>Claim.</strong> Client-side discovery has fewer moving parts and network hops than server-side, yet couples the client to the registry.</p><p><strong>Grounding.</strong> Richardson lists both: a benefit ("fewer moving parts and network hops") and a drawback ("couples the client to the Service Registry").</p><p><strong>In the wild.</strong> Two hops (client to registry, client to instance) beat a router round-trip, at the price of every client knowing the registry.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'One discovery client per language', content: '<p><strong>Why.</strong> Discovery logic lives in the client, so it must be re-implemented wherever a client runs.</p><p><strong>Claim.</strong> You must implement client-side discovery for each programming language or framework, such as Java/Scala or JavaScript/NodeJS.</p><p><strong>Grounding.</strong> Richardson names the per-language cost and points to Netflix Prana as an HTTP-proxy workaround for non-JVM clients.</p><p><strong>In the wild.</strong> A JVM service uses Ribbon; a non-JVM client can use Prana to proxy to Eureka instead of porting the client.</p>' }
    ]
  },
  quiz: [
    { "question": "How does a client-side discovery client learn where a service instance lives?", "options": ["A. It asks the router or load balancer", "B. It queries the service registry and then calls the instance directly", "C. It hardcodes each instance's IP and port", "D. It asks DNS to return a port number"], "answer": 2, "explanation": "The client queries the Service Registry, which knows all instance locations, then calls the chosen instance itself. A is server-side discovery (a router), C is a fixed-location deployment, and D is not the mechanism described.", "conceptRef": "Query the registry on every call" },
    { "question": "In the example application, which value is a logical name that gets resolved by discovery?", "options": ["A. http://user-registration-url", "B. http://REGISTRATION-SERVICE/user", "C. http://eureka-host", "D. http://ribbon-client"], "answer": 2, "explanation": "The reference sets user_registration_url to http://REGISTRATION-SERVICE/user, and REGISTRATION-SERVICE is the logical service name resolved to a network location. A, C, and D are not the value used in the reference.", "conceptRef": "Eureka and Ribbon wire it together" },
    { "question": "Which two Netflix OSS components implement the example's client-side discovery?", "options": ["A. Eureka (registry) and Ribbon (HTTP client that queries it)", "B. Zuul and Hystrix", "C. Prana and Registrator", "D. ELB and an autoscaling group"], "answer": 1, "explanation": "Eureka is the Service Registry and Ribbon is the HTTP client that queries Eureka to route to an instance. B is routing/resilience, C is third-party registration, and D is server-side discovery.", "conceptRef": "Eureka and Ribbon wire it together" },
    { "question": "Which is a drawback of client-side discovery?", "options": ["A. It has more moving parts than server-side discovery", "B. It couples the client to the registry and requires discovery logic per language/framework", "C. It requires a separate router component", "D. It adds the most network hops"], "answer": 2, "explanation": "The reference lists coupling to the registry and the per-language implementation cost. A and D invert the truth (client-side has fewer parts and fewer hops), and C describes server-side discovery's router.", "conceptRef": "Fewer hops, but coupled to the registry" }
  ]
});
