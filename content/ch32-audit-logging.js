registerChapter({
  id: 'ch32',
  num: 32,
  title: 'Audit Logging',
  pattern: 'Record user activity in a database so support, compliance, and security can reconstruct what a user did.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 32 (p.377) · microservices.io /patterns/observability/audit-logging.html',
  part: 8,
  flow: [
    {
      section: 'Recording user activity',
      color: 'orange',
      motivation: `The pattern answers "how to understand the behavior of users and the application?" by recording user activity in a database. Each user action becomes a durable row naming who did what, and when.`,
      steps: [
        { num: 1, title: 'Record in a database', detail: 'The solution is to record user activity in a database.' },
        { num: 2, title: 'One row per action', detail: 'Each action a user performs is written as an audit record.' },
        { num: 3, title: 'Widely used', detail: 'The reference notes this pattern is widely used.' }
      ],
      program: `// ORDER SERVICE SIDE — every user action becomes one audit row in the database
// PARTIES: U1 = user alice · SVC = Order Service · DB = PostgreSQL 16 @ audit-db-1
// DEF: audit — a durable row recording who did what to which target and when; here (1,"alice","view_order","PO-2001",now)
// STATE (before):
//    audit_log : []                                 // rows: (id, user, action, target, at)
// DEF: record_activity · CALLED BY: U1 performing actions
// -> action1 : ("alice","view_order","PO-2001")
//    step 1 · INSERT audit row id=1   audit_log : [] -> [(1,"alice","view_order","PO-2001",now)]
// -> action2 : ("alice","create_order","PO-2001")
//    step 2 · INSERT audit row id=2   audit_log : [1 row] -> [(1,"alice","view_order","PO-2001",now),(2,"alice","create_order","PO-2001",now)]
// -> action3 : ("alice","pay_order","PO-2001")
//    step 3 · INSERT audit row id=3   audit_log : [2 rows] -> [(1,"alice","view_order","PO-2001",now),(2,"alice","create_order","PO-2001",now),(3,"alice","pay_order","PO-2001",now)]
// <- outcome : audit_log : 3 rows · WHO=alice, WHAT=view/create/pay, WHEN=timestamp   BECAUSE the DB now holds a record of her actions`
    },
    {
      section: 'Who reads the log',
      color: 'orange',
      motivation: `The force behind audit logging is knowing what a user recently performed — for customer support, compliance, and security. Reading the log reconstructs a user's recent behavior.`,
      steps: [
        { num: 1, title: 'Three readers', detail: 'Customer support, compliance, and security all want to know what actions a user recently performed.' },
        { num: 2, title: 'Reconstruct behavior', detail: 'Querying the log by user returns that user\'s actions in order.' },
        { num: 3, title: 'Answer questions', detail: 'The same rows can answer "what did alice do" or "who touched PO-2001".' }
      ],
      program: `// SUPPORT SIDE — reading the audit log reconstructs what one user did, for support/compliance/security
// PARTIES: SUP = support agent · DB = PostgreSQL 16 @ audit-db-1
// DEF: audit — a durable row recording who did what to which target and when, read back to reconstruct a user's actions; here (1,"alice","view_order","PO-2001",t1)
// STATE (before):
//    audit_log : [(1,"alice","view_order","PO-2001",t1),(2,"alice","create_order","PO-2001",t2),(3,"alice","pay_order","PO-2001",t3)]
//    answer : []                                // the reconstruction SUP builds
// DEF: recent_actions · CALLED BY: SUP investigating "did alice pay?"
// -> user : "alice"
//    step 1 · match row id=1    answer : [] -> [(1,"alice","view_order","PO-2001",t1)]
//    step 2 · match row id=2    answer : [(1,"alice","view_order","PO-2001",t1)] -> [(1,"alice","view_order","PO-2001",t1),(2,"alice","create_order","PO-2001",t2)]
//    step 3 · match row id=3    answer : [(1,"alice","view_order","PO-2001",t1),(2,"alice","create_order","PO-2001",t2)] -> [(1,"alice","view_order","PO-2001",t1),(2,"alice","create_order","PO-2001",t2),(3,"alice","pay_order","PO-2001",t3)]
// <- outcome : answer : 3 rows · row id=3 is the payment -> SUP confirms "yes, alice paid at t3"
//    alt compliance : query "target=PO-2001" to learn who touched it · alt security: query "action=pay_order"`
    },
    {
      section: 'Auditing and event sourcing',
      color: 'orange',
      motivation: `Audit logging is not free: the auditing code is intertwined with the business logic, making it more complicated. The related pattern Event Sourcing offers a reliable way to implement auditing.`,
      steps: [
        { num: 1, title: 'Intertwined code', detail: 'The drawback is that auditing code is intertwined with the business logic, making it more complicated.' },
        { num: 2, title: 'Inline audit calls', detail: 'audit() calls sit between business statements inside a method.' },
        { num: 3, title: 'Event sourcing alternative', detail: 'Event Sourcing is a reliable way to implement auditing — the event log itself is the audit trail.' }
      ],
      program: `// ORDER SERVICE SIDE — audit code interleaves with business logic; event sourcing makes auditing implicit
// PARTIES: SVC = Order Service · ES = EventStoreDB 24 @ orders-events-1
// DEF: audit — a hand-written row recording what happened, appended by an explicit audit() call; here (1,"create_order","PO-2001")
// DEF: event — a domain fact appended to the event store that doubles as the audit record; here (1,"OrderCreated")
// DEF: inline — audit code that sits between business statements inside one method; here the 2 audit() calls inside create_order
// STATE (before):
//    inline_audit : []                 // hand-written audit rows
//    event_log : []                    // event-sourced alternative: events ARE the audit record
// DEF: create_order · CALLED BY: a client request
// -> order_id : "PO-2001"
//    step 1 · save the order, then call audit()     inline_audit : [] -> [(1,"create_order","PO-2001")]
//    step 2 · publish, then call audit()            inline_audit : [1 row] -> [(1,"create_order","PO-2001"),(2,"order_published","PO-2001")]
//    step 3 · the 2 audit() calls sit between business statements -> the method is harder to read
// <- outcome : inline_audit : 2 rows · business logic more complicated   BECAUSE the auditing code is intertwined with it
//    alt event sourcing : append 2 domain events   event_log : [] -> [(1,"OrderCreated"),(2,"OrderPublished")] · the audit is a read of event_log, no audit() calls`
    }
  ],
  interview: [
    {
      scenario: "A user named alice views, creates, and pays for order PO-2001. The team needs a durable record of her actions so support can reconstruct what she did later.",
      q: "What is the Audit Logging solution, and what does one record capture?",
      solution: "Record user activity in a database: each action a user performs is written as an audit row naming who did what to which target and when.",
      components: ["User (alice)", "Order Service", "audit database", "audit row (id, user, action, target, at)"],
      diagram: "flowchart LR\n  U[\"alice\"] -->|\"view/create/pay\"| S[\"Order Service\"]\n  S -->|\"INSERT row\"| D[\"audit database\"]\n  D -->|\"3 rows\"| L[\"audit_log\"]",
      code: "// ORDER SERVICE SIDE — every user action becomes one audit row in the database\n// PARTIES: U1 = user alice · SVC = Order Service · DB = PostgreSQL 16 @ audit-db-1\n// DEF: audit — a durable row recording who did what to which target and when; here (1,\"alice\",\"view_order\",\"PO-2001\",now)\n// STATE (before):\n//    audit_log : []                                  // rows: (id, user, action, target, at)\n// DEF: record_activity · CALLED BY: U1 performing actions\n// -> action1 : (\"alice\",\"view_order\",\"PO-2001\")\n//    step 1 · INSERT audit row id=1   audit_log : [] -> [(1,\"alice\",\"view_order\",\"PO-2001\",now)]\n// -> action2 : (\"alice\",\"create_order\",\"PO-2001\")\n//    step 2 · INSERT audit row id=2   audit_log : [1 row] -> [(1,\"alice\",\"view_order\",\"PO-2001\",now),(2,\"alice\",\"create_order\",\"PO-2001\",now)]\n// -> action3 : (\"alice\",\"pay_order\",\"PO-2001\")\n//    step 3 · INSERT audit row id=3   audit_log : [2 rows] -> [(1,\"alice\",\"view_order\",\"PO-2001\",now),(2,\"alice\",\"create_order\",\"PO-2001\",now),(3,\"alice\",\"pay_order\",\"PO-2001\",now)]\n// <- outcome : audit_log : 3 rows · WHO=alice, WHAT=view/create/pay, WHEN=timestamp   BECAUSE the DB now holds a record of her actions",
      tieback: "This is the chapter's record-user-activity step: every action becomes a durable row with who, what, and when.",
      refs: ["Recording user activity"],
      problems: ["20-metrics-monitoring", "26-payment-system"]
    },
    {
      scenario: "A support agent must answer whether alice paid for PO-2001, a compliance auditor needs to know who touched the order, and security wants every payment action.",
      q: "Who reads the audit log, and how does a query reconstruct a user's behavior?",
      solution: "Customer support, compliance, and security read the log; querying by user returns that user's actions in order, and the same rows answer \"what did alice do\" or \"who touched PO-2001\".",
      components: ["Support agent", "compliance auditor", "security team", "audit database"],
      diagram: "flowchart LR\n  S[\"Support\"] -->|\"query user=alice\"| D[\"audit database\"]\n  C[\"Compliance\"] -->|\"query target=PO-2001\"| D\n  K[\"Security\"] -->|\"query action=pay_order\"| D\n  D -->|\"ordered rows\"| R[\"reconstruction\"]",
      code: "// SUPPORT SIDE — reading the audit log reconstructs what one user did, for support/compliance/security\n// PARTIES: SUP = support agent · DB = PostgreSQL 16 @ audit-db-1\n// STATE (before):\n//    audit_log : [(1,\"alice\",\"view_order\",\"PO-2001\",t1),(2,\"alice\",\"create_order\",\"PO-2001\",t2),(3,\"alice\",\"pay_order\",\"PO-2001\",t3)]\n//    answer : []                                   // the reconstruction SUP builds\n// DEF: recent_actions · CALLED BY: SUP investigating \"did alice pay?\"\n// -> user : \"alice\"\n//    step 1 · match row id=1    answer : [] -> [(1,\"alice\",\"view_order\",\"PO-2001\",t1)]\n//    step 2 · match row id=2    answer : [(1,\"alice\",\"view_order\",\"PO-2001\",t1)] -> [(1,\"alice\",\"view_order\",\"PO-2001\",t1),(2,\"alice\",\"create_order\",\"PO-2001\",t2)]\n//    step 3 · match row id=3    answer : [(1,\"alice\",\"view_order\",\"PO-2001\",t1),(2,\"alice\",\"create_order\",\"PO-2001\",t2)] -> [(1,\"alice\",\"view_order\",\"PO-2001\",t1),(2,\"alice\",\"create_order\",\"PO-2001\",t2),(3,\"alice\",\"pay_order\",\"PO-2001\",t3)]\n// <- outcome : answer : 3 rows · row id=3 is the payment -> SUP confirms \"yes, alice paid at t3\"\n//    alt compliance : query \"target=PO-2001\" to learn who touched it · alt security : query \"action=pay_order\"",
      tieback: "This is the chapter's who-reads-the-log step: support, compliance, and security reconstruct a user's recent behavior from the same rows.",
      refs: ["Who reads the log"],
      problems: ["20-metrics-monitoring", "26-payment-system"]
    },
    {
      scenario: "The audit() calls are scattered between business statements inside create_order, and the method is getting hard to read.",
      q: "What is the main drawback of audit logging, and where does the audit code sit?",
      solution: "The auditing code is intertwined with the business logic, making it more complicated — audit() calls sit between business statements inside a method.",
      components: ["Order Service", "audit() calls", "business statements", "inline audit rows"],
      diagram: "flowchart LR\n  M[\"create_order\"] -->|\"save()\"| B[\"business\"]\n  M -->|\"audit()\"| A[\"inline_audit\"]\n  A -.->|\"intertwined\"| B",
      code: "// ORDER SERVICE SIDE — audit code interleaves with business logic, making the method harder to read\n// PARTIES: SVC = Order Service\n// DEF: inline — audit code that sits between business statements inside one method; here the 2 audit() calls inside create_order\n// STATE (before):\n//    inline_audit : []                 // hand-written audit rows\n// DEF: create_order · CALLED BY: a client request\n// -> order_id : \"PO-2001\"\n//    step 1 · save the order, then call audit()     inline_audit : [] -> [(1,\"create_order\",\"PO-2001\")]\n//    step 2 · publish, then call audit()            inline_audit : [1 row] -> [(1,\"create_order\",\"PO-2001\"),(2,\"order_published\",\"PO-2001\")]\n//    step 3 · the 2 audit() calls sit between business statements -> the method is harder to read\n// <- outcome : inline_audit : 2 rows · business logic more complicated   BECAUSE the auditing code is intertwined with it",
      tieback: "This is the chapter's intertwined-code drawback: audit() calls between business statements complicate the flow.",
      refs: ["Auditing and event sourcing"],
      problems: ["20-metrics-monitoring", "26-payment-system"]
    },
    {
      scenario: "The team is tired of hand-writing audit() calls that can drift from what actually happened. They consider making the audit implicit.",
      q: "Which related pattern is described as a reliable way to implement auditing, and why?",
      solution: "Event Sourcing: the event log itself is the audit trail, so appending domain events removes the explicit audit() calls.",
      components: ["Order Service", "event store", "domain events", "implicit audit trail"],
      diagram: "flowchart LR\n  S[\"Order Service\"] -->|\"append event\"| E[\"event store\"]\n  E -->|\"OrderCreated, OrderPublished\"| L[\"event_log\"]\n  L -->|\"is the audit trail\"| A[\"audit read\"]",
      code: "// ORDER SERVICE SIDE — event sourcing makes auditing implicit: the event log itself is the audit trail\n// PARTIES: SVC = Order Service · ES = EventStoreDB 24 @ orders-events-1\n// DEF: event — a domain fact appended to the event store that doubles as the audit record; here (1,\"OrderCreated\")\n// STATE (before):\n//    event_log : []                    // event-sourced alternative: events ARE the audit record\n//    audit_calls : 0                   // explicit audit() calls the service writes\n// DEF: create_order · CALLED BY: a client request\n// -> order_id : \"PO-2001\"\n//    step 1 · append the creation event    event_log : [] -> [(1,\"OrderCreated\")]  BECAUSE the domain event is the fact of creation\n//    step 2 · append the publication event    event_log : [1 row] -> [(1,\"OrderCreated\"),(2,\"OrderPublished\")]  BECAUSE publishing is itself a domain fact\n//    step 3 · no audit() call needed    audit_calls : 0 -> 0  BECAUSE the audit is a read of event_log, not a separate write\n// <- outcome : event_log : 2 rows · audit_calls : 0 · the audit trail is the event log itself\n//    alt hand-written audit : 2 explicit audit() calls between business statements -> the method is harder to read and the audit can drift",
      tieback: "This is the chapter's event-sourcing alternative: the event log itself is the audit trail, removing the intertwined audit() calls.",
      refs: ["Auditing and event sourcing"],
      problems: ["20-metrics-monitoring", "26-payment-system"]
    }
  ],
  systemDesign: {
    question: 'Design an audit trail for business operations. Premise: the Order Service writes the business change and the audit record to the same database, and an aggregator reads them, so who-did-what is durable and queryable.',
    pipeline: 'service → audit log (store) → log aggregator → reader',
    decomposition: [
      {
        box: 'Order Service — the writer',
        role: 'service (business op + audit record)',
        parts: [
          'performs the business op (view/create/pay order)',
          'writes one audit row per action'
        ]
      },
      {
        box: 'audit log store',
        role: 'audit log (store)',
        parts: [
          'PostgreSQL 16 @ audit-db-1',
          'holds rows (id, user, action, target, at)'
        ]
      },
      {
        box: 'log aggregator',
        role: 'log aggregator',
        parts: [
          'collects audit rows across services',
          'indexes them for query'
        ]
      },
      {
        box: 'reader (auditor queries)',
        role: 'reader',
        parts: [
          'support/compliance/security query the log',
          'reconstructs what a user did'
        ]
      }
    ],
    wiring: "flowchart LR\n  SVC[\"Order Service\"] -->|\"INSERT audit row\"| LOG[(\"audit log store: PostgreSQL 16 @ audit-db-1\")]\n  LOG -->|\"shipped\"| AGG[\"log aggregator\"]\n  AGG -->|\"indexed\"| IDX[(\"aggregated index\")]\n  IDX -->|\"query user=alice\"| RDR[\"reader: support/compliance/security\"]",
    program: `// SYSTEM DESIGN — audit logging pipeline: service (Order Service, business op + audit record) -> audit log (PostgreSQL 16 @ audit-db-1) -> log aggregator -> reader (support/compliance/security)
// PARTIES: SVC = Order Service (writer, business op + audit record) · DB = PostgreSQL 16 @ audit-db-1 (audit log store) · AGG = log aggregator (collects and indexes audit rows) · RDR = support agent (reader)
// DEF: audit — a durable row recording who did what to which target and when; here (1,"alice","view_order","PO-2001",t1)
// DEF: action — one user action to record; here "view_order", "create_order", "pay_order"
// DEF: answer — the reconstruction a reader builds from the rows; here 3 rows for "alice"
// STATE (before):
//    audit_log : []      // rows: (id, user, action, target, at), kept by DB
//    answer : []
// DEF: record_and_reconstruct · CALLED BY: alice acting on PO-2001, then a reader querying
// -> action1 : ("alice","view_order","PO-2001")
//    step 1 · SVC INSERTs the view row    audit_log : [] -> [(1,"alice","view_order","PO-2001",t1)]
//    step 2 · SVC INSERTs the create and pay rows    audit_log : [(1,"alice","view_order","PO-2001",t1)] -> [(1,"alice","view_order","PO-2001",t1),(2,"alice","create_order","PO-2001",t2),(3,"alice","pay_order","PO-2001",t3)]
//    step 3 · AGG collects and indexes the rows    audit_log : [(1,"alice","view_order","PO-2001",t1),(2,"alice","create_order","PO-2001",t2),(3,"alice","pay_order","PO-2001",t3)] -> [(1,"alice","view_order","PO-2001",t1),(2,"alice","create_order","PO-2001",t2),(3,"alice","pay_order","PO-2001",t3)]
//    step 4 · RDR queries user "alice"    answer : [] -> [(1,"alice","view_order","PO-2001",t1),(2,"alice","create_order","PO-2001",t2),(3,"alice","pay_order","PO-2001",t3)]
// <- outcome : answer 3 rows · row id=3 is the payment, so the support agent confirms "alice paid at t3"  BECAUSE the writer INSERTed rows, the aggregator indexed them, and the reader queried them back`
  },
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Who did what', content: '<p><strong>Why.</strong> After the fact, you need to know what a user has been doing.</p><p><strong>Claim.</strong> The problem is how to understand the behavior of users and the application, and troubleshoot problems.</p><p><strong>Grounding.</strong> The reference force: it is useful to know what actions a user recently performed — for customer support, compliance, and security.</p><p><strong>In the wild.</strong> A support agent needs to reconstruct a user\'s recent actions to answer a complaint.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Record user activity', content: '<p><strong>Why.</strong> Without a durable record, user actions are lost as soon as they happen.</p><p><strong>Claim.</strong> Record user activity in a database, giving a record of user actions.</p><p><strong>Grounding.</strong> The reference solution is exactly that — record user activity in a database — and notes the pattern is widely used.</p><p><strong>In the wild.</strong> Each action becomes a row with who, what, and when.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Intertwined code', content: '<p><strong>Why.</strong> The audit write happens inside the business method it records.</p><p><strong>Claim.</strong> The auditing code is intertwined with the business logic, which makes the business logic more complicated.</p><p><strong>Grounding.</strong> The reference lists this as the pattern\'s drawback.</p><p><strong>In the wild.</strong> audit() calls sit between business statements, so the flow is harder to read.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Event sourcing alternative', content: '<p><strong>Why.</strong> A separate audit call is extra work that can drift from what actually happened.</p><p><strong>Claim.</strong> Event Sourcing is a reliable way to implement auditing — the event log itself is the audit trail.</p><p><strong>Grounding.</strong> The reference lists Event Sourcing as the related pattern for reliable auditing.</p><p><strong>In the wild.</strong> Adopting event sourcing removes the audit() calls but is a larger architectural commitment.</p>' }
    ]
  },
  quiz: [
    { "question": "What is the solution of the Audit logging pattern?", "options": ["A. Record user activity in a database.", "B. Log every HTTP status code.", "C. Sample a fraction of requests.", "D. Store metrics in a time-series database."], "answer": 1, "explanation": "The reference solution is to record user activity in a database. Option D is application metrics, and B and C are not the audit logging solution.", "conceptRef": "Record user activity" },
    { "question": "Which forces motivate knowing a user's recent actions?", "options": ["A. Load balancing and scaling.", "B. Customer support, compliance, and security.", "C. Reducing build time.", "D. Service discovery."], "answer": 2, "explanation": "The reference force names customer support, compliance, and security as the readers who need to know what a user recently performed. The other options are unrelated concerns.", "conceptRef": "Who did what" },
    { "question": "What is the main drawback of audit logging?", "options": ["A. It is unreliable.", "B. The auditing code is intertwined with the business logic, making it more complicated.", "C. It cannot be stored in a database.", "D. It removes all user actions."], "answer": 2, "explanation": "The reference drawback is that auditing code is intertwined with business logic, making it more complicated. Options A, C, and D are false — the pattern records to a database and provides a record, not removes one.", "conceptRef": "Intertwined code" },
    { "question": "Which related pattern is described as a reliable way to implement auditing?", "options": ["A. Event Sourcing.", "B. CQRS.", "C. API composition.", "D. Circuit breaker."], "answer": 1, "explanation": "The reference states Event Sourcing is a reliable way to implement auditing, because the event log itself is the audit trail. The other patterns are not tied to auditing in the reference.", "conceptRef": "Event sourcing alternative" }
  ]
});
