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
// PARTIES: U1 = user alice · SVC = Order Service · DB = audit database
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
// PARTIES: SUP = support agent · DB = audit database
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
// PARTIES: SVC = Order Service · ES = event store
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
