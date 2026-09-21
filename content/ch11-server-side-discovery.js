registerChapter({
  id: 'ch11',
  num: 11,
  title: 'Server-Side Discovery',
  pattern: 'The client makes a request to a router at a well-known location, which queries the service registry and forwards the request to an available service instance.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 11 · microservices.io /patterns/server-side-discovery.html',
  part: 3,
  flow: [
    {
      section: 'A router hides the instances',
      color: 'orange',
      motivation: `Instead of teaching every client the registry, the application teaches it one well-known router address that hides the changing instances.`,
      steps: [
        { num: 1, title: 'Call the router', detail: 'The client makes a request via a router (load balancer) at a well-known location.' },
        { num: 2, title: 'Router queries the registry', detail: 'The router queries a service registry, which might be built into the router.' },
        { num: 3, title: 'Forward to an instance', detail: 'The router forwards the request to an available service instance.' },
        { num: 4, title: 'Client stays simple', detail: 'The client never performs discovery — it just calls the router.' }
      ],
      program: `// ROUTER SIDE — the client calls a well-known router, which consults the registry and forwards to an instance
// PARTIES: CLI = client · RTR = router (load balancer) · REG = service registry · SVC = order-service instance
// DEF: router — the load balancer the client calls at a well-known address = RTR, which forwards to router_target "10.0.1.7:8080"
// DEF: target — the instance location the router forwards to = "10.0.1.7:8080"
// STATE (before):
//    registry : {"order-service" -> [{"host":"10.0.1.7","port":8080},{"host":"10.0.1.8","port":8080}]}
//    lookup : []
//    router_target : "unset"
//    forwarded : "none"
// DEF: a client sends a request · CALLED BY: CLI calling the router's well-known address
// -> request : "POST http://router.example.com/orders"
//    step 0 · the instances write these rows at startup : registry["order-service"] : [] -> [{"host":"10.0.1.7","port":8080},{"host":"10.0.1.8","port":8080}]   BECAUSE each instance writes its own row on boot (self-registration)
//    step 1 · RTR queries REG : lookup : [] -> ["10.0.1.7:8080","10.0.1.8:8080"]   BECAUSE the router asks the registry for available instances
//    step 2 · RTR picks one : router_target : "unset" -> "10.0.1.7:8080"
//    step 3 · RTR forwards : forwarded : "none" -> "10.0.1.7:8080"   BECAUSE the router relays the request to the chosen instance
// <- forwarded call : "POST http://10.0.1.7:8080/orders"   (the client never resolved the instance itself)`
    },
    {
      section: 'ELB: router and registry in one',
      color: 'orange',
      motivation: `AWS ELB collapses the router and the registry into one managed component, which is why it is the canonical example.`,
      steps: [
        { num: 1, title: 'ELB as router', detail: 'A client makes HTTP(s) requests or TCP connections to the ELB, which load-balances across EC2 instances.' },
        { num: 2, title: 'ELB as registry', detail: 'The ELB also functions as a Service Registry.' },
        { num: 3, title: 'External or internal', detail: 'An ELB can load-balance Internet traffic or, in a VPC, internal traffic.' },
        { num: 4, title: 'Two ways to register', detail: 'EC2 instances are registered with the ELB explicitly via an API call, or automatically via an autoscaling group.' }
      ],
      program: `// ELB SIDE — the load balancer is also the registry; instances register explicitly or via an autoscaling group
// PARTIES: CLI = client · ELB = Elastic Load Balancer (router + registry) · EC2 = service instances
// DEF: target — one EC2 instance the ELB load-balances across = elb_targets hosts "10.0.3.1" and "10.0.3.2"
// STATE (before):
//    elb_targets : {"order-service" -> [{"id":"i-abc","host":"10.0.3.1"},{"id":"i-def","host":"10.0.3.2"}]}
// DEF: an autoscaling group adds an instance · CALLED BY: the ASG scaling out
// -> scale_out : {"id":"i-ghi","host":"10.0.3.3"}
//    step 1 · ASG registers with ELB : elb_targets["order-service"] : [{"id":"i-abc","host":"10.0.3.1"},{"id":"i-def","host":"10.0.3.2"}] -> [{"id":"i-abc","host":"10.0.3.1"},{"id":"i-def","host":"10.0.3.2"},{"id":"i-ghi","host":"10.0.3.3"}]
//    step 2 · target count : 2 -> 3   BECAUSE the autoscaling group registered the new EC2 instance
// <- load-balanced set : ["10.0.3.1","10.0.3.2","10.0.3.3"]   (ELB now spreads traffic across 3 instances)
//    alt explicit API call : an operator calls the ELB register-target API -> target count : 3 -> 3 (the same i-ghi is already present)`
    },
    {
      section: 'Cluster proxies on every host',
      color: 'orange',
      motivation: `In a cluster, the router moves onto each host as a local proxy, so a client only ever dials a local port.`,
      steps: [
        { num: 1, title: 'A proxy on each host', detail: 'Kubernetes and Marathon run a proxy on each host that acts as a server-side discovery router.' },
        { num: 2, title: 'Connect to the local port', detail: 'The client connects to the local proxy using the port assigned to that service.' },
        { num: 3, title: 'Proxy forwards', detail: 'The proxy forwards the request to a service instance running somewhere in the cluster.' }
      ],
      program: `// CLUSTER SIDE — each host runs a proxy; the client connects to the local proxy's port and it forwards into the cluster
// PARTIES: CLI = client on a host · PRX = per-host proxy (server-side router) · SVC = service instance in the cluster
// DEF: cluster — the set of hosts whose services the proxy reaches = cluster_map mapping order-service to "port 8080"
// DEF: proxy — the per-host router the client dials at a local port = PRX, which forwards to proxy_target "10.0.4.9:8080"
// DEF: target — the instance location the proxy forwards to = "10.0.4.9:8080"
// STATE (before):
//    cluster_map : {"order-service" -> "port 8080"}
//    proxy_target : "unset"
//    selected : []
//    forwarded : "none"
// DEF: a client calls a service · CALLED BY: CLI connecting to the local proxy
// -> connect : "localhost:8080"   (the port assigned to order-service)
//    step 1 · proxy resolves the port : proxy_target : "unset" -> "order-service"   BECAUSE port 8080 is assigned to order-service in the cluster
//    step 2 · proxy finds an instance : selected : [] -> ["10.0.4.9:8080"]   BECAUSE the proxy looks up the cluster for order-service
//    step 3 · proxy forwards : forwarded : "none" -> "10.0.4.9:8080"   BECAUSE it relays the request to that instance
// <- forwarded call : "POST http://10.0.4.9:8080/orders"   (the client only ever spoke to localhost:8080)
//    alt another host : its local proxy forwards the same port to a different pod 10.0.4.12`
    },
    {
      section: 'Costs: extra hops, protocols, replication',
      color: 'orange',
      motivation: `The price of a simpler client is an extra hop and an extra component that must be replicated and must speak the right protocols.`,
      steps: [
        { num: 1, title: 'Extra hop', detail: 'More network hops are required than with client-side discovery.' },
        { num: 2, title: 'Install and configure', detail: 'Unless part of the cloud, the router is another component to install and configure.' },
        { num: 3, title: 'Replicate it', detail: 'The router must be replicated for availability and capacity.' },
        { num: 4, title: 'Protocol support', detail: 'The router must support the needed protocols (HTTP, gRPC, Thrift) unless it is a TCP-based router.' }
      ],
      program: `// ROUTER SIDE — server-side discovery adds a network hop and a component that must be replicated and protocol-fit
// PARTIES: CLI = client · RTR = router · REG = registry · SVC = order-service instance
// STATE (before):
//    hops : 0
//    router_replicas : 1
//    supported : ["http"]
// DEF: measure one request's cost · CALLED BY: CLI sending a request through the router
// -> request : "POST /orders"
//    step 1 · hops : 0 -> 3   BECAUSE the path is CLI -> RTR -> REG -> SVC, one more hop than client-side discovery's 2
//    step 2 · replicate the router : router_replicas : 1 -> 2   BECAUSE the router must be replicated for availability and capacity
//    step 3 · protocol check : supported : ["http"] -> ["http","tcp"]   BECAUSE the router must speak the clients' protocols unless it is a TCP-based router
// <- cost summary : "3 hops, 2 replicas, protocols [http, tcp]"   (more moving parts than client-side)`
    }
  ],
  interview: [
    {
      scenario: "A client must call order-service but has no discovery logic. The application teaches it one well-known router address instead of the registry.",
      q: "How does a router hide the changing set of instances from the client?",
      solution: "The client calls a router (load balancer) at a well-known location; the router queries the registry and forwards the request to an available instance, so the client never performs discovery.",
      components: ["Well-known router address", "Registry query by the router", "Forward to an instance", "Discovery-free client"],
      diagram: `flowchart LR
  C["client"] -->|"well-known address"| R["router"]
  R --> REG["registry"]
  REG -->|"instances"| R
  R -->|"forward"| SVC["order-service instance"]`,
      code: `// ROUTER SIDE — the client calls a well-known router, which consults the registry and forwards to an instance
// PARTIES: CLI = client · RTR = router (load balancer) · REG = service registry · SVC = order-service instance
// DEF: router — the load balancer the client calls at a well-known address = RTR, which forwards to router_target "10.0.3.7:8080"
// DEF: target — the instance location the router forwards to = "10.0.3.7:8080"
// STATE (before):
//    registry : {"order-service" -> [{"host":"10.0.3.7","port":8080},{"host":"10.0.3.8","port":8080}]}
//    lookup : []
//    router_target : "unset"
//    forwarded : "none"
// DEF: a client sends a request · CALLED BY: CLI calling the router's well-known address
// -> request : "POST http://router.example.com/orders"
//    step 1 · RTR queries REG : lookup : [] -> ["10.0.3.7:8080","10.0.3.8:8080"]   BECAUSE the router asks the registry for available instances
//    step 2 · RTR picks one : router_target : "unset" -> "10.0.3.7:8080"
//    step 3 · RTR forwards : forwarded : "none" -> "10.0.3.7:8080"   BECAUSE the router relays the request to the chosen instance
// <- forwarded call : "POST http://10.0.3.7:8080/orders"   (the client never resolved the instance itself)`,
      tieback: "This is exactly the router-hides-the-instances mechanism in this chapter.",
      refs: ["A router hides the instances"],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: "The team runs on AWS and wants a single managed component to act as both the load balancer and the registry for order-service.",
      q: "How does an ELB collapse the router and the registry into one, and how do instances get registered?",
      solution: "The ELB load-balances traffic (router) and also functions as the registry; instances are registered explicitly via an API call or automatically via an autoscaling group.",
      components: ["ELB as router", "ELB as registry", "Explicit API registration", "Autoscaling-group registration"],
      diagram: `flowchart LR
  C["client"] --> ELB["ELB (router + registry)"]
  ELB --> I1["i-abc"]
  ELB --> I2["i-def"]
  ASG["autoscaling group"] -->|"register i-ghi"| ELB`,
      code: `// ELB SIDE — the load balancer is also the registry; instances register explicitly or via an autoscaling group
// PARTIES: CLI = client · ELB = Elastic Load Balancer (router + registry) · EC2 = service instances
// DEF: target — one EC2 instance the ELB load-balances across = elb_targets hosts "10.0.5.1" and "10.0.5.2"
// STATE (before):
//    elb_targets : {"order-service" -> [{"id":"i-abc","host":"10.0.5.1"},{"id":"i-def","host":"10.0.5.2"}]}
// DEF: an autoscaling group adds an instance · CALLED BY: the ASG scaling out
// -> scale_out : {"id":"i-ghi","host":"10.0.5.3"}
//    step 1 · ASG registers with ELB : elb_targets["order-service"] : [{"id":"i-abc","host":"10.0.5.1"},{"id":"i-def","host":"10.0.5.2"}] -> [{"id":"i-abc","host":"10.0.5.1"},{"id":"i-def","host":"10.0.5.2"},{"id":"i-ghi","host":"10.0.5.3"}]
//    step 2 · target count : 2 -> 3   BECAUSE the autoscaling group registered the new EC2 instance
// <- load-balanced set : ["10.0.5.1","10.0.5.2","10.0.5.3"]   (ELB now spreads traffic across 3 instances)
//    alt explicit API call : an operator calls the ELB register-target API -> target count : 3 -> 3 (the same i-ghi is already present)`,
      tieback: "This is exactly the ELB-as-router-and-registry behavior in this chapter.",
      refs: ["ELB: router and registry in one"],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: "The team runs a cluster where a proxy lives on every host, so a client only ever dials a local port.",
      q: "How do cluster proxies on every host implement server-side discovery?",
      solution: "Each host runs a proxy; the client connects to the local proxy's port for the service, and the proxy forwards the request to an instance somewhere in the cluster.",
      components: ["Per-host proxy", "Local port per service", "Proxy forwarding into the cluster"],
      diagram: `flowchart LR
  C["client"] -->|"localhost:8080"| PRX["host proxy"]
  PRX -->|"forward"| SVC["order-service pod 10.0.6.9"]`,
      code: `// CLUSTER SIDE — each host runs a proxy; the client connects to the local proxy's port and it forwards into the cluster
// PARTIES: CLI = client on a host · PRX = per-host proxy (server-side router) · SVC = service instance in the cluster
// DEF: cluster — the set of hosts whose services the proxy reaches = cluster_map mapping order-service to "port 8080"
// DEF: proxy — the per-host router the client dials at a local port = PRX, which forwards to proxy_target "10.0.6.9:8080"
// DEF: target — the instance location the proxy forwards to = "10.0.6.9:8080"
// STATE (before):
//    cluster_map : {"order-service" -> "port 8080"}
//    proxy_target : "unset"
//    selected : []
//    forwarded : "none"
// DEF: a client calls a service · CALLED BY: CLI connecting to the local proxy
// -> connect : "localhost:8080"   (the port assigned to order-service)
//    step 1 · proxy resolves the port : proxy_target : "unset" -> "order-service"   BECAUSE port 8080 is assigned to order-service in the cluster
//    step 2 · proxy finds an instance : selected : [] -> ["10.0.6.9:8080"]   BECAUSE the proxy looks up the cluster for order-service
//    step 3 · proxy forwards : forwarded : "none" -> "10.0.6.9:8080"   BECAUSE it relays the request to that instance
// <- forwarded call : "POST http://10.0.6.9:8080/orders"   (the client only ever spoke to localhost:8080)
//    alt another host : its local proxy forwards the same port to a different pod 10.0.6.12`,
      tieback: "This is exactly the cluster-proxy form of server-side discovery in this chapter.",
      refs: ["Cluster proxies on every host"],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: "The team chose server-side discovery and now accounts for its costs before shipping.",
      q: "What are the costs of server-side discovery compared to client-side?",
      solution: "More network hops than client-side discovery, plus a router that must be installed, configured, replicated for availability and capacity, and made to support the needed protocols.",
      components: ["Extra network hop", "Install/configure the router", "Replicate the router", "Protocol support (HTTP, gRPC, Thrift)"],
      diagram: `flowchart LR
  C["client"] -->|"hop 1"| R["router"]
  R -->|"hop 2"| REG["registry"]
  R -->|"hop 3"| SVC["instance"]
  R --> REP["replicas + protocols"]`,
      code: `// ROUTER SIDE — server-side discovery adds a network hop and a component that must be replicated and protocol-fit
// PARTIES: CLI = client · RTR = router · REG = registry · SVC = order-service instance
// STATE (before):
//    hops : 0
//    router_replicas : 1
//    supported : ["http"]
// DEF: measure one request's cost · CALLED BY: CLI sending a request through the router
// -> request : "POST /orders"
//    step 1 · hops : 0 -> 3   BECAUSE the path is CLI -> RTR -> REG -> SVC, one more hop than client-side discovery's 2
//    step 2 · replicate the router : router_replicas : 1 -> 3   BECAUSE the router must be replicated for availability and capacity
//    step 3 · protocol check : supported : ["http"] -> ["http","grpc","thrift"]   BECAUSE the router must speak the clients' protocols
// <- cost summary : "3 hops, 3 replicas, protocols [http, grpc, thrift]"   (more moving parts than client-side)
//    alt cloud-managed : an ELB absorbs install/configure/replicate -> the operator burden falls to the cloud provider`,
      tieback: "This is exactly the extra-hop and replication/protocol costs in this chapter.",
      refs: ["Costs: extra hops, protocols, replication"],
      problems: ["01-scale-from-zero-to-millions"]
    }
  ],
  systemDesign: {
    question: 'Design service discovery behind a router. Premise: the client calls a router or load balancer, which queries the service registry and forwards to a live instance, so the client stays simple.',
    pipeline: 'client → router / load balancer → service registry → service instances',
    decomposition: [
      {
        box: 'client — calls only the router',
        role: 'client',
        parts: [
          'Dials the router at a well-known address',
          'Never performs discovery itself'
        ]
      },
      {
        box: 'router / load balancer — the router',
        role: 'router / load balancer',
        parts: [
          'Queries the registry for available instances',
          'Picks one instance',
          'Forwards the request to it'
        ]
      },
      {
        box: 'service registry (Eureka) — the registry',
        role: 'registry',
        parts: [
          'Holds the name -> instances map',
          'Returns instance locations on query'
        ]
      },
      {
        box: 'order-service instances — the instances',
        role: 'service instances',
        parts: [
          'Self-register on startup',
          'Serve the forwarded request'
        ]
      }
    ],
    wiring: "flowchart LR\n  CLI[\"client\"] -->|\"well-known address\"| RTR[\"router / load balancer\"]\n  RTR -->|\"query order-service\"| REG[(\"service registry Eureka\")]\n  REG -->|\"10.0.1.7:8080, 10.0.1.8:8080\"| RTR\n  RTR -->|\"forward\"| SVC[\"order-service instance 10.0.1.7:8080\"]",
    program: `// SYSTEM DESIGN — server-side discovery as a pipeline: client -> router/load balancer -> service registry -> service instances (the client never discovers)
// PARTIES: CLI = client (calls only the router) · RTR = router (load balancer that queries the registry and forwards) · REG = service registry (Eureka) · SVC = order-service instances
// DEF: registry — REG's map of service name -> instances; here {"order-service" -> ["10.0.1.7:8080", "10.0.1.8:8080"]}
// DEF: list — the instances REG returns; here ["10.0.1.7:8080", "10.0.1.8:8080"]
// DEF: target — the instance the router forwards to; here "10.0.1.7:8080"
// DEF: status — the forwarded call's result; here "200 OK"
// STATE (before):
//    registry : {"order-service" -> ["10.0.1.7:8080", "10.0.1.8:8080"]}
//    list     : []
//    target   : "unset"
//    status   : "none"
// DEF: forward_request · CALLED BY: CLI calling the router's well-known address
// -> request : "POST http://router.example.com/orders"
//    step 1 · RTR queries REG for "order-service"    list : [] -> ["10.0.1.7:8080", "10.0.1.8:8080"]   BECAUSE the router asks the registry for available instances
//    step 2 · RTR picks an instance    target : "unset" -> "10.0.1.7:8080"   BECAUSE the router load-balances across the returned set
//    step 3 · RTR forwards to the instance    status : "none" -> "200 OK"   BECAUSE the router relays the request to the chosen instance
// <- forwarded call : "POST http://10.0.1.7:8080/orders"   (the client never resolved an instance itself)`
  },
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'The client cannot track instances', content: '<p><strong>Why.</strong> Instances appear and disappear under dynamic IPs, so a client that must pick an instance directly cannot keep up.</p><p><strong>Claim.</strong> The client needs a stable, well-known address to call, behind which the changing set of instances is hidden.</p><p><strong>Grounding.</strong> Richardson\'s context mirrors client-side discovery: dynamic IPs and load-varying instance counts break fixed locations.</p><p><strong>In the wild.</strong> Rather than teaching every client the registry, the application teaches it one router address.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'A router in front of the registry', content: '<p><strong>Why.</strong> A well-known middleman can absorb the lookup and forwarding that would otherwise live in each client.</p><p><strong>Claim.</strong> The client calls a router (load balancer) at a well-known location; the router queries a registry and forwards to an available instance.</p><p><strong>Grounding.</strong> Richardson\'s solution: the router "queries a service registry, which might be built into the router, and forwards the request."</p><p><strong>In the wild.</strong> AWS ELB acts as both router and registry; Kubernetes and Marathon run a proxy on each host for the same purpose.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Simpler client, extra hops', content: '<p><strong>Why.</strong> Moving discovery to the router simplifies the client but lengthens the request path.</p><p><strong>Claim.</strong> The client code is simpler because it just calls the router, but more network hops are required than with client-side discovery.</p><p><strong>Grounding.</strong> Richardson lists both: simpler client code, and "more network hops are required than when using Client Side Discovery."</p><p><strong>In the wild.</strong> Client to router to instance (via the registry) is one hop longer than client to registry to instance.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'A router to replicate and protocol-fit', content: '<p><strong>Why.</strong> The router is now on the request path, so it must scale and speak the right protocols.</p><p><strong>Claim.</strong> Unless it is part of the cloud, the router must be installed and configured, replicated for availability and capacity, and it must support the needed protocols (HTTP, gRPC, Thrift) unless it is a TCP-based router.</p><p><strong>Grounding.</strong> Richardson lists these as drawbacks of server-side discovery.</p><p><strong>In the wild.</strong> A cloud-managed ELB removes the operational cost; a self-run router restores it, including the replication burden.</p>' }
    ]
  },
  quiz: [
    { "question": "How does a client reach an instance in server-side discovery?", "options": ["A. It queries the registry and calls the instance directly", "B. It calls a router at a well-known location, which forwards to an instance", "C. It broadcasts to every instance", "D. It hardcodes each host and port"], "answer": 2, "explanation": "The client makes a request via a router at a well-known location; the router queries the registry and forwards to an available instance. A is client-side discovery, and C and D are not the pattern.", "conceptRef": "A router in front of the registry" },
    { "question": "In the AWS example, what two roles does the ELB play?", "options": ["A. Router (load balancer) and service registry", "B. Database and message broker", "C. Sidecar and third-party registrar", "D. API gateway and backend-for-frontend"], "answer": 1, "explanation": "The ELB load-balances traffic (router) and also functions as a Service Registry. B, C, and D are unrelated roles.", "conceptRef": "ELB: router and registry in one" },
    { "question": "How do EC2 instances get registered with the ELB?", "options": ["A. Only by editing a config file", "B. Explicitly via an API call, or automatically as part of an autoscaling group", "C. Only by the client at request time", "D. The ELB never registers instances"], "answer": 2, "explanation": "The reference says EC2 instances are registered either explicitly via an API call or automatically as part of an autoscaling group. A, C, and D contradict this.", "conceptRef": "ELB: router and registry in one" },
    { "question": "Which is a drawback of server-side discovery?", "options": ["A. The client code is simpler", "B. More network hops than client-side discovery, and the router must be installed, configured, and replicated", "C. The client is coupled to the registry", "D. It cannot handle TCP traffic"], "answer": 2, "explanation": "The reference lists extra network hops and the install/configure/replicate burden as drawbacks. A is a benefit, C is client-side discovery's drawback, and D is false because a TCP-based router can handle TCP.", "conceptRef": "Costs: extra hops, protocols, replication" }
  ]
});
