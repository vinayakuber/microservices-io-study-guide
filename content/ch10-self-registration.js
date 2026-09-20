registerChapter({
  id: 'ch10',
  num: 10,
  title: 'Self-Registration',
  pattern: 'A service instance registers itself with the service registry on startup, periodically renews its registration, and unregisters itself on shutdown.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 10 · microservices.io /patterns/self-registration.html',
  part: 3,
  flow: [
    {
      section: 'The instance registers itself',
      color: 'orange',
      motivation: `The instance is the best source of its own location, so it can register its host and IP itself and make itself discoverable.`,
      steps: [
        { num: 1, title: 'Register on startup', detail: 'The instance registers its host and IP address with the registry and makes itself available.' },
        { num: 2, title: 'Renew periodically', detail: 'The client typically renews its registration so the registry knows it is still alive.' },
        { num: 3, title: 'Unregister on shutdown', detail: 'The instance unregisters itself from the registry on shutdown.' },
        { num: 4, title: 'Chassis handles it', detail: 'This is typically handled by a <strong>microservice chassis</strong> framework.' }
      ],
      program: `// SERVICE SIDE — the instance registers its own host and IP on startup and unregisters on shutdown
// PARTIES: SVC = order-service instance · REG = service registry
// DEF: self — the instance's own registration state = self_state "DOWN", flipped to "AVAILABLE" after it registers
// STATE (before):
//    registry : {"order-service" -> []}
//    self_state : "DOWN"
// DEF: the service boots · CALLED BY: SVC startup on host 10.0.1.7
// -> boot : {"host":"10.0.1.7","ip":"10.0.1.7","port":8080}
//    step 1 · SVC registers itself : registry["order-service"] : [] -> [{"host":"10.0.1.7","ip":"10.0.1.7","port":8080}]
//    step 2 · SVC marks itself available : self_state : "DOWN" -> "AVAILABLE"
// <- registry row : "order-service" -> [{"host":"10.0.1.7","ip":"10.0.1.7","port":8080}]   (now discoverable)
//    alt shutdown : SVC unregisters itself -> registry["order-service"] : [{"host":"10.0.1.7","ip":"10.0.1.7","port":8080}] -> []`
    },
    {
      section: 'Renewal keeps the entry alive',
      color: 'orange',
      motivation: `Because instances die without notice, a lease that must be renewed is what lets the registry tell alive from dead.`,
      steps: [
        { num: 1, title: 'Heartbeat timer', detail: 'The instance renews its registration before the lease expires.' },
        { num: 2, title: 'Registry stays fresh', detail: 'The registry keeps the entry alive for as long as renewals arrive.' },
        { num: 3, title: 'Crash detection', detail: 'If renewals stop, the registry drops the entry and stops routing to the dead instance.' },
        { num: 4, title: 'Eureka in the example', detail: 'The @EnableEurekaClient annotation registers the instance with the Eureka registry.' }
      ],
      program: `// SERVICE SIDE — the instance periodically renews its registration so the registry knows it is still alive
// PARTIES: SVC = order-service instance · REG = service registry
// STATE (before):
//    registry : {"order-service" -> [{"host":"10.0.1.7","port":8080,"ttl":30}]}
//    renew_count : 0
// DEF: the lease approaches expiry · CALLED BY: SVC heartbeat timer every 30s
// -> renew : "heartbeat"   (sent before the ttl lapses)
//    step 1 · SVC renews : renew_count : 0 -> 1   BECAUSE the timer fired
//    step 2 · REG extends the entry : registry["order-service"] : [{"host":"10.0.1.7","port":8080,"ttl":30}] -> [{"host":"10.0.1.7","port":8080,"ttl":60}]
// <- registry row : "order-service" -> [{"host":"10.0.1.7","port":8080,"ttl":60}]   (the lease was pushed out)
//    alt missed renewal : no heartbeat arrives -> REG evicts the entry when ttl : 60 -> 0`
    },
    {
      section: 'A richer state model, with a blind spot',
      color: 'orange',
      motivation: `Self-registration gives a richer state model than UP/DOWN, but it fails exactly when an instance is too broken to notice it should leave.`,
      steps: [
        { num: 1, title: 'Knows its own state', detail: 'The instance can model more than UP/DOWN, such as STARTING or AVAILABLE.' },
        { num: 2, title: 'Steer traffic away', detail: 'The instance can rewrite its registry entry to reflect its current state.' },
        { num: 3, title: 'The blind spot', detail: 'A running but broken instance often cannot unregister itself.' },
        { num: 4, title: 'Still coupled', detail: 'Self-registration couples the service to the registry and is re-implemented per language.' }
      ],
      program: `// SERVICE SIDE — self-registration knows its own state, but a broken instance often lacks the self-awareness to leave
// PARTIES: SVC = order-service instance · REG = service registry
// DEF: routed — the traffic the registry directs at this instance = traffic_routed "all", steered to "none" once it marks itself STARTING
// DEF: self — the instance's own modeled state = self_state "AVAILABLE" becoming "STARTING" on degradation
// DEF: traffic — the requests callers send to the instance = "all", steered to "none" while STARTING
// STATE (before):
//    registry : {"order-service" -> [{"host":"10.0.1.7","port":8080,"state":"AVAILABLE"}]}
//    self_state : "AVAILABLE"
//    traffic_routed : "all"
// DEF: the instance degrades internally · CALLED BY: a dependency that stops responding
// -> degrade : "dependency timeout"
//    step 1 · SVC models its own state : self_state : "AVAILABLE" -> "STARTING"   BECAUSE the instance knows a state model richer than UP/DOWN
//    step 2 · SVC rewrites its entry : registry["order-service"] : [{"host":"10.0.1.7","port":8080,"state":"AVAILABLE"}] -> [{"host":"10.0.1.7","port":8080,"state":"STARTING"}]
//    step 3 · traffic steered away : traffic_routed : "all" -> "none"   BECAUSE callers skip STARTING instances
// <- registry row : "order-service" -> [{"host":"10.0.1.7","port":8080,"state":"STARTING"}]
//    alt no self-awareness : SVC runs but cannot handle requests -> it never unregisters itself, the stale entry stays`
    }
  ],
  interview: [
    {
      scenario: "An order-service instance boots at 10.0.3.7 and must become discoverable without any external process acting for it.",
      q: "Who registers the instance in self-registration, and what does the instance record?",
      solution: "The service instance registers itself on startup, recording its own host and IP, and unregisters itself on shutdown — typically handled by a microservice chassis.",
      components: ["Instance self-registration", "Host and IP address", "Microservice chassis"],
      diagram: `flowchart LR
  SVC["order-service 10.0.3.7"] -->|"register self"| REG["service registry"]
  SVC -->|"unregister on shutdown"| REG`,
      code: `// SERVICE SIDE — the instance registers its own host and IP on startup and unregisters on shutdown
// PARTIES: SVC = order-service instance · REG = service registry
// DEF: self — the instance's own registration state = self_state "DOWN", flipped to "AVAILABLE" after it registers
// STATE (before):
//    registry : {"order-service" -> []}
//    self_state : "DOWN"
// DEF: the service boots · CALLED BY: SVC startup on host 10.0.3.7
// -> boot : {"host":"10.0.3.7","ip":"10.0.3.7","port":8080}
//    step 1 · SVC registers itself : registry["order-service"] : [] -> [{"host":"10.0.3.7","ip":"10.0.3.7","port":8080}]
//    step 2 · SVC marks itself available : self_state : "DOWN" -> "AVAILABLE"
// <- registry row : "order-service" -> [{"host":"10.0.3.7","ip":"10.0.3.7","port":8080}]   (now discoverable)
//    alt shutdown : SVC unregisters itself -> registry["order-service"] : [{"host":"10.0.3.7","ip":"10.0.3.7","port":8080}] -> []`,
      tieback: "This is exactly the instance-registers-itself mechanism in this chapter.",
      refs: ["The instance registers itself"],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: "An order-service instance has a lease on its registry entry, and its heartbeat timer must keep it alive before the lease lapses.",
      q: "Why does self-registration require periodic renewal, and what happens when renewals stop?",
      solution: "The instance renews its registration so the registry knows it is still alive; if renewals stop, the registry drops the entry and stops routing to the dead instance.",
      components: ["Heartbeat timer", "Lease (ttl)", "Registry eviction on missed renewal"],
      diagram: `flowchart LR
  SVC["order-service"] -->|"heartbeat"| REG["registry"]
  REG -->|"ttl extended"| SVC
  SVC -. "missed renewal -> evict" .-> REG`,
      code: `// SERVICE SIDE — the instance periodically renews its registration so the registry knows it is still alive
// PARTIES: SVC = order-service instance · REG = service registry
// STATE (before):
//    registry : {"order-service" -> [{"host":"10.0.3.7","port":8080,"ttl":45}]}
//    renew_count : 0
// DEF: the lease approaches expiry · CALLED BY: SVC heartbeat timer every 45s
// -> renew : "heartbeat"   (sent before the ttl lapses)
//    step 1 · SVC renews : renew_count : 0 -> 1   BECAUSE the timer fired
//    step 2 · REG extends the entry : registry["order-service"] : [{"host":"10.0.3.7","port":8080,"ttl":45}] -> [{"host":"10.0.3.7","port":8080,"ttl":90}]
// <- registry row : "order-service" -> [{"host":"10.0.3.7","port":8080,"ttl":90}]   (the lease was pushed out)
//    alt missed renewal : no heartbeat arrives -> REG evicts the entry when ttl : 90 -> 0`,
      tieback: "This is exactly the renewal-keeps-the-entry-alive mechanism in this chapter.",
      refs: ["Renewal keeps the entry alive"],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: "An instance is starting up and wants to keep traffic away until it is truly ready — something a bare UP/DOWN flag cannot express.",
      q: "What richer state model does self-registration enable, and how does it steer traffic?",
      solution: "Because the instance knows its own state, it can model more than UP/DOWN — such as STARTING or AVAILABLE — and rewrite its registry entry to steer traffic away.",
      components: ["Richer state model (STARTING/AVAILABLE)", "Self-state rewrite", "Traffic steering"],
      diagram: `flowchart LR
  SVC["instance"] -->|"state STARTING"| REG["registry"]
  REG -->|"skip STARTING"| T["traffic steered away"]
  SVC -->|"state AVAILABLE"| REG`,
      code: `// SERVICE SIDE — self-registration knows its own state: the instance walks STARTING to AVAILABLE, richer than UP/DOWN
// PARTIES: SVC = order-service instance · REG = service registry
// DEF: self — the instance's own modeled state = self_state "STARTING", becoming "AVAILABLE" once it is ready
// DEF: traffic — the requests callers send to the instance = "none" while STARTING, "all" once AVAILABLE
// STATE (before):
//    registry : {"order-service" -> [{"host":"10.0.3.7","port":8080,"state":"STARTING"}]}
//    self_state : "STARTING"
//    traffic_routed : "none"
// DEF: the instance finishes warming up · CALLED BY: SVC completing its startup sequence
// -> ready : "true"
//    step 1 · SVC models its own state : self_state : "STARTING" -> "AVAILABLE"   BECAUSE the instance knows a state model richer than UP/DOWN
//    step 2 · SVC rewrites its entry : registry["order-service"] : [{"host":"10.0.3.7","port":8080,"state":"STARTING"}] -> [{"host":"10.0.3.7","port":8080,"state":"AVAILABLE"}]
//    step 3 · traffic steered back : traffic_routed : "none" -> "all"   BECAUSE callers now accept AVAILABLE instances
// <- registry row : "order-service" -> [{"host":"10.0.3.7","port":8080,"state":"AVAILABLE"}]
//    alt degraded : SVC marks itself STARTING again -> traffic_routed : "all" -> "none" (steers traffic away)`,
      tieback: "This is exactly the richer-state-model benefit of self-registration in this chapter.",
      refs: ["A richer state model, with a blind spot"],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: "The team's services are written in Java and Go, and both must register themselves with the same registry.",
      q: "What is the blind spot of self-registration, and what does its coupling cost in a polyglot system?",
      solution: "A running-but-broken instance often lacks the self-awareness to unregister itself, and self-registration couples the service to the registry and must be re-implemented per language.",
      components: ["Lack of self-awareness", "Coupling to the registry", "Per-language registration logic"],
      diagram: `flowchart LR
  J["Java service"] -->|"register logic"| REG["registry"]
  G["Go service"] -->|"register logic (re-implemented)"| REG
  BROKEN["broken instance"] -. "cannot unregister itself" .-> REG`,
      code: `// SERVICE SIDE — self-registration couples the service to the registry and is re-implemented per language
// PARTIES: SVC = order-service instance · REG = service registry
// STATE (before):
//    registry : {"order-service" -> []}
//    languages : {"java":false, "go":false}
//    coupled : "false"
// DEF: the second service in Go must register too · CALLED BY: the Go order-service starting up
// -> language : "go"
//    step 1 · register in Java : languages["java"] : false -> true   BECAUSE the Java instance already implemented registration against REG
//    step 2 · re-implement in Go : languages["go"] : false -> true   BECAUSE discovery logic must be written per language/framework
//    step 3 · the service is coupled to the registry : coupled : "false" -> "true"   BECAUSE each service now calls REG directly
// <- cost : registration logic exists in 2 languages · both services coupled to the registry
//    alt broken instance : SVC runs but cannot handle requests -> it never unregisters itself, the stale entry stays`,
      tieback: "This is exactly the lack-of-self-awareness and coupling drawbacks in this chapter.",
      refs: ["A richer state model, with a blind spot"],
      problems: ["01-scale-from-zero-to-millions"]
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'The registry must know who is alive', content: '<p><strong>Why.</strong> Discovery only works if the registry has an accurate, current list of instances, and that list changes every time an instance starts, stops, crashes, or degrades.</p><p><strong>Claim.</strong> Instances must be registered on startup, unregistered on shutdown, and removed when they crash or can no longer handle requests.</p><p><strong>Grounding.</strong> Richardson\'s three forces for registration apply to self-registration too: startup, shutdown, crash, and running-but-incapable instances.</p><p><strong>In the wild.</strong> A stale entry means a client-side or server-side lookup can route a request to an instance that will never answer.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'The instance registers itself', content: '<p><strong>Why.</strong> Nobody knows an instance\'s own host and IP better than the instance, so it can register those details directly.</p><p><strong>Claim.</strong> On startup the instance registers its host and IP, periodically renews the registration, and unregisters on shutdown.</p><p><strong>Grounding.</strong> Richardson\'s solution: the instance "registers itself (host and IP address)" and "must typically periodically renew its registration."</p><p><strong>In the wild.</strong> A Spring Boot service annotated with @EnableEurekaClient registers itself with the Eureka registry.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'A richer state model', content: '<p><strong>Why.</strong> An instance that registers itself can express more about itself than a foreign observer can see from outside.</p><p><strong>Claim.</strong> Because the instance knows its own state, it can implement a state model richer than UP/DOWN, such as STARTING or AVAILABLE.</p><p><strong>Grounding.</strong> Richardson gives this as the benefit of self-registration over a third-party registrar.</p><p><strong>In the wild.</strong> An instance can mark itself STARTING and steer traffic away before it is ready, something a superficial RUNNING/NOT RUNNING check cannot express.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Lacking self-awareness', content: '<p><strong>Why.</strong> The same introspection that gives a rich state model fails exactly when the instance is unhealthy enough to need removing.</p><p><strong>Claim.</strong> An instance that is running but unable to handle requests often lacks the self-awareness to unregister itself.</p><p><strong>Grounding.</strong> Richardson lists this as a drawback, alongside coupling the service to the registry and re-implementing logic per language.</p><p><strong>In the wild.</strong> A hung thread or exhausted pool leaves the process alive, so the instance stays registered and keeps receiving doomed requests.</p>' }
    ]
  },
  quiz: [
    { "question": "In self-registration, who registers the instance with the registry?", "options": ["A. A third-party registrar process", "B. The service instance itself, on startup", "C. The router that fronts the registry", "D. The registry polls the network for instances"], "answer": 2, "explanation": "The instance is responsible for registering itself, with its host and IP, on startup. A is the third-party alternative, C is server-side discovery, and D is not how registration works.", "conceptRef": "The instance registers itself" },
    { "question": "Why must the instance periodically renew its registration?", "options": ["A. To change its IP address", "B. So the registry knows it is still alive", "C. To re-encode its hostname", "D. To increment its port number"], "answer": 2, "explanation": "The reference says the client must typically renew its registration so the registry knows it is still alive; a missed renewal means the entry is dropped. A, C, and D are not the purpose of renewal.", "conceptRef": "Renewal keeps the entry alive" },
    { "question": "What benefit does self-registration offer?", "options": ["A. It removes the need for a service registry", "B. It lets the instance model its own state as more than UP/DOWN, such as STARTING or AVAILABLE", "C. It avoids coupling the service to the registry", "D. It requires no chassis framework"], "answer": 2, "explanation": "Because the instance knows its own state, it can implement a richer state model than UP/DOWN. A is false (a registry is still required), C inverts the coupling drawback, and D is false because this is typically handled by a chassis.", "conceptRef": "A richer state model" },
    { "question": "What is a drawback of self-registration?", "options": ["A. A running-but-broken instance often lacks the self-awareness to unregister itself", "B. It is always handled by a separate sidecar", "C. It cannot use Eureka", "D. It requires a third-party registrar"], "answer": 1, "explanation": "The reference lists the lack of self-awareness as a drawback, alongside coupling to the registry and per-language logic. B and D describe third-party registration, and C is false because the example uses Eureka.", "conceptRef": "Lacking self-awareness" }
  ]
});
