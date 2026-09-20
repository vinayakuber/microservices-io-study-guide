registerChapter({
  id: 'ch15',
  num: 15,
  title: 'Saga',
  pattern: 'Implement each business transaction that spans services as a sequence of local transactions, each updating its own database and publishing a message or event to trigger the next, with compensating transactions that undo earlier changes when a step fails.',
  aka: 'Chris Richardson · Microservice Patterns Ch.15 (p.114) · microservices.io /patterns/data/saga.html',
  part: 4,
  flow: [
    {
      section: 'Transactions that span services',
      color: 'orange',
      motivation: `With Database per Service, Orders and Customers live in different databases owned by different services, so one local ACID transaction cannot both insert the order and check the credit limit. 2PC is not an option, so a different mechanism is needed for transactions that span services.`,
      steps: [
        { num: 1, title: 'Database per Service', detail: 'Orders and Customers each live in their own database, owned by different services.' },
        { num: 2, title: 'A transaction spans services', detail: 'Creating an order must also check that the total does not exceed the credit limit.' },
        { num: 3, title: 'No local ACID, no 2PC', detail: 'One local transaction cannot reach the database of another service, and two-phase commit is not an option.' }
      ],
      program: `// ORDER SERVICE SIDE — a local ACID transaction cannot reach the credit data that lives in another service
// PARTIES: ORD = Order Service · ORDDB = PostgreSQL 16 @ orders-db-1 · CS = Customer Service · CSDB = PostgreSQL 16 @ customers-db-1
// DEF: credit — the customer's spending limit owned by the Customer Service = 100.00 (the order total that must not exceed it)
// STATE (before):
//    orders : {}
//    customer_credit : {}          // owned by CS in CSDB, invisible to ORDDB
// DEF: create_order · CALLED BY: CLIENT via POST /orders
// -> order_id : "PO-2001" · -> total : 100.00
//    step 1 · BEGIN a local transaction on ORDDB (the broker and CSDB are NOT enlisted)
//    step 2 · INSERT the order   // orders : {} -> {"PO-2001":"PENDING"}
//    step 3 · try to deduct credit   // customer_credit : {} -> ERROR "no such table"  BECAUSE customers lives in CSDB, not ORDDB
//    step 4 · the UPDATE fails, so the transaction aborts   // orders : {"PO-2001":"PENDING"} -> {} (rolled back)
// <- outcome : "ROLLBACK" · the one-database transaction cannot span the two services
//    alt 2PC : would enlist ORDDB and CSDB, but 2PC is not an option BECAUSE it couples the services and can block`
    },
    {
      section: 'Orchestration: an orchestrator directs the steps',
      color: 'orange',
      motivation: `Orchestration keeps the sequence in one place: an orchestrator object tells each participant which local transaction to run next, so the happy path and every failure path are explicit and one component owns the whole saga.`,
      steps: [
        { num: 1, title: 'Create the saga orchestrator', detail: 'The Order Service receives POST /orders and creates the Create Order saga orchestrator.' },
        { num: 2, title: 'Create the order PENDING', detail: 'The orchestrator creates the Order in the PENDING state.' },
        { num: 3, title: 'Send the Reserve Credit command', detail: 'The orchestrator sends a Reserve Credit command to the Customer Service.' },
        { num: 4, title: 'Reserve credit and reply', detail: 'The Customer Service attempts to reserve credit and sends back a reply indicating the outcome.' },
        { num: 5, title: 'Approve, reject, or compensate', detail: 'The orchestrator approves or rejects the Order; on failure it runs compensating transactions that undo earlier steps.' }
      ],
      program: `// ORDER SERVICE SIDE — an orchestrated create-order saga across three services, with a failure and full compensation
// PARTIES: CLIENT = the user · ORD = Order Service (runs the orchestrator) · CS = Customer Service · KIT = Kitchen Service
// DEF: credit — the customer's available balance a saga step reserves and releases = { "CUST-7" : 500.00 }
// STATE (before):
//    orders : {}
//    customer_credit : { "CUST-7" : 500.00 }     // available credit, owned by Customer Service
//    reserved : {}                               // sagas CS has already reserved for (idempotency guard)
//    tickets : {}                                // owned by Kitchen Service
// DEF: create-order saga orchestrator · created by ORD when CLIENT POSTs /orders
// -> order_id : "PO-2001" · -> customer_id : "CUST-7" · -> total : 100.00
//    step 1 · LT1 on ORD : create the order   // orders : {} -> {"PO-2001":"PENDING"}
//    step 2 · send ReserveCredit(saga="SAGA-1", amount=100.00) to CS
//    step 3 · LT2 on CS : if "SAGA-1" already in reserved -> skip (idempotent retry); else reserve   // reserved : {} -> {"SAGA-1"} · customer_credit : {"CUST-7":500.00} -> {"CUST-7":400.00}  BECAUSE 100.00 of the 500.00 is held
//    step 4 · CS replies "credit_reserved" -> orchestrator sends CreateTicket(order_id="PO-2001") to KIT
//    step 5 · LT3 on KIT : the ticket is rejected BECAUSE the item is not available   // tickets : {} -> {} (nothing created)
//    step 6 · KIT replies "ticket_rejected" -> the orchestrator runs the COMPENSATING transactions
//    step 7 · COMPENSATE LT2 : ReleaseCredit(saga="SAGA-1", amount=100.00) to CS   // customer_credit : {"CUST-7":400.00} -> {"CUST-7":500.00}  BECAUSE the held 100.00 is returned
//    step 8 · COMPENSATE LT1 : reject the order   // orders : {"PO-2001":"PENDING"} -> {"PO-2001":"REJECTED"}
// <- outcome : "OrderRejected" · order REJECTED, credit fully released, no ticket created
//    alt success : KIT replies "ticket_created" -> orders : {"PO-2001":"PENDING"} -> {"PO-2001":"APPROVED"} (no compensation)
//       -> a retried ReserveCredit(saga="SAGA-1") is skipped BECAUSE "SAGA-1" is already in reserved (ON CONFLICT / already-seen guard)`
    },
    {
      section: 'Choreography: events trigger the next step',
      color: 'orange',
      motivation: `Choreography distributes the sequence: each local transaction publishes a domain event that triggers the next service's local transaction, so there is no central coordinator to maintain.`,
      steps: [
        { num: 1, title: 'Create the order PENDING', detail: 'The Order Service receives POST /orders and creates an Order in the PENDING state.' },
        { num: 2, title: 'Emit Order Created', detail: 'It emits an Order Created event.' },
        { num: 3, title: 'Reserve credit on the event', detail: 'The Customer Service event handler attempts to reserve credit.' },
        { num: 4, title: 'Emit the outcome', detail: 'It emits an event indicating the outcome.' },
        { num: 5, title: 'Approve or reject', detail: 'The Order Service event handler either approves or rejects the Order.' }
      ],
      program: `// ORDER SERVICE SIDE — choreography: each local transaction publishes a domain event that triggers the next local transaction
// PARTIES: ORD = Order Service · CS = Customer Service · BRK = the events travelling between them
// DEF: credit — the customer's available balance a saga step reserves = { "CUST-7" : 500.00 }
// DEF: event — a domain message a service publishes to trigger the next local transaction = "OrderCreated"
// STATE (before):
//    orders : {}
//    customer_credit : { "CUST-7" : 500.00 }
//    credit_events : []
// DEF: choreographed handler chain · one event carries the saga forward, no orchestrator
// -> POST /orders : total = 100.00
//    step 1 · LT1 on ORD : create the order   // orders : {} -> {"PO-2001":"PENDING"}
//    step 2 · ORD publishes "OrderCreated"   // the event triggers the next local transaction in CS
//    step 3 · CS handler receives "OrderCreated" and reserves credit   // customer_credit : {"CUST-7":500.00} -> {"CUST-7":400.00}  BECAUSE 100.00 is reserved
//    step 4 · CS publishes "CreditReserved"   // credit_events : [] -> ["CreditReserved"]
//    step 5 · ORD handler receives "CreditReserved" and approves   // orders : {"PO-2001":"PENDING"} -> {"PO-2001":"APPROVED"}
// <- outcome : order "PO-2001" APPROVED · no central coordinator — each event is the trigger for the next step`
    },
    {
      section: 'Resulting context: compensation, isolation, reliability',
      color: 'orange',
      motivation: `A saga has no automatic rollback and no ACID isolation, and a service cannot enlist both its database and the message broker in one distributed transaction. Knowing the trade-offs lets you design compensating transactions and a reliable outcome signal to the client.`,
      steps: [
        { num: 1, title: 'No automatic rollback', detail: 'A developer must design compensating transactions that explicitly undo earlier changes.' },
        { num: 2, title: 'No isolation', detail: 'Concurrent sagas can cause data anomalies, so countermeasures that implement isolation are needed.' },
        { num: 3, title: 'Atomic update and publish', detail: 'A service must atomically update its database and publish its message, using patterns such as the Transactional Outbox.' },
        { num: 4, title: 'Tell the client the outcome', detail: 'A synchronous initiator learns the result by waiting, by polling GET /orders/{id}, or by an event such as a webhook.' }
      ],
      program: `// ORDER SERVICE SIDE — how a synchronous client learns the outcome of an asynchronous saga
// PARTIES: CLIENT = the user · ORD = Order Service
// STATE (before):
//    orders : { "PO-2001" : { status : "PENDING" } }
//    poll_count : 0
// DEF: client outcome for order "PO-2001" · the POST returned the id while the saga was still running
// -> GET /orders/PO-2001 : poll #1
//    step 1 · first poll   // poll_count : 0 -> 1  BECAUSE the client issued its first status query
//    step 2 · ORD returns status "PENDING"   // the saga has not finished — credit not yet reserved
//    step 3 · in the background the saga completes: credit reserved, then approved   // orders : {"PO-2001":{status:"PENDING"}} -> {"PO-2001":{status:"APPROVED"}}
// -> GET /orders/PO-2001 : poll #2
//    step 4 · second poll   // poll_count : 1 -> 2  BECAUSE the client polls again
//    step 5 · ORD returns status "APPROVED"
// <- outcome : "APPROVED" · alt = reply only when the saga completes, or push "OrderApproved" over a websocket/webhook instead of polling`
    }
  ],
  interview: [
    {
      scenario: "Your Orders and Customers live in different databases owned by different services. Creating an order must also check that the total does not exceed the customer's credit limit, but one local ACID transaction cannot reach the other service's database.",
      q: "Why does a business transaction span multiple services, and why cannot a local ACID transaction or 2PC solve it?",
      solution: "Database per Service splits the data, so no single local transaction can touch both databases; 2PC is rejected because it couples services and can block, so you need the Saga.",
      components: [
        "Orders database — owned by Order Service",
        "Customers database — owned by Customer Service",
        "Credit limit — the data the order write must check",
        "2PC — rejected for coupling and blocking"
      ],
      diagram: `flowchart LR
  ORD["Order Service"] -->|INSERT order| ORDDB[("Orders DB")]
  ORD -->|check credit| CSDB[("Customers DB")]
  CSDB -.->|no such table| X["Local tx cannot span"]`,
      code: `// ORDER SERVICE SIDE — a local ACID transaction cannot reach the credit data that lives in another service
// PARTIES: ORD = Order Service · ORDDB = PostgreSQL 16 @ orders-db-1 · CS = Customer Service · CSDB = PostgreSQL 16 @ customers-db-1
// DEF: credit — the customer's spending limit owned by the Customer Service = 100.00 (the order total that must not exceed it)
// STATE (before):
//    orders : {}
//    customer_credit : {}   // owned by CS in CSDB, invisible to ORDDB
// DEF: create_order · CALLED BY: CLIENT via POST /orders
// -> order_id : "PO-77" · -> total : 120.00
//    step 1 · BEGIN a local transaction on ORDDB (the broker and CSDB are NOT enlisted)
//    step 2 · INSERT the order : orders : {} -> {"PO-77":"PENDING"}
//    step 3 · try to deduct credit : customer_credit : {} -> ERROR "no such table"   BECAUSE customers lives in CSDB, not ORDDB
//    step 4 · the UPDATE fails, so the transaction aborts : orders : {"PO-77":"PENDING"} -> {} (rolled back)
// <- outcome : "ROLLBACK" · the one-database transaction cannot span the two services
//    alt 2PC : would enlist ORDDB and CSDB, but 2PC is not an option BECAUSE it couples the services and can block`,
      tieback: "This is the Saga's motivation — a transaction that spans services needs a sequence of local transactions, not 2PC.",
      refs: ["Transactions that span services"],
      problems: ["26-payment-system", "22-hotel-reservation", "19-distributed-message-queue"]
    },
    {
      scenario: "Your create-order flow must reserve credit in Customer Service and create a ticket in Kitchen Service, and when the kitchen rejects an item the credit reservation must be undone. You want one component to own the whole sequence.",
      q: "How does orchestration-based saga coordination direct each step, and what happens when a step fails?",
      solution: "An orchestrator object tells each participant which local transaction to run; when a step fails, it runs compensating transactions that undo the earlier steps.",
      components: [
        "Saga orchestrator — owns the sequence",
        "Local transactions — one per participant service",
        "Compensating transactions — undo earlier steps",
        "Replies — each participant reports its outcome"
      ],
      diagram: `flowchart LR
  ORD["Orchestrator"] -->|create PENDING| ORDDB[("Order")]
  ORD -->|ReserveCredit| CS["Customer Service"]
  CS -->|credit_reserved| ORD
  ORD -->|CreateTicket| KIT["Kitchen Service"]
  KIT -->|ticket_rejected| ORD
  ORD -->|ReleaseCredit| CS`,
      code: `// ORDER SERVICE SIDE — an orchestrated create-order saga across three services, with a failure and full compensation
// PARTIES: CLIENT = the user · ORD = Order Service (runs the orchestrator) · CS = Customer Service · KIT = Kitchen Service
// DEF: credit — the customer's available balance a saga step reserves and releases = { "CUST-7" : 500.00 }
// STATE (before):
//    orders : {}
//    customer_credit : { "CUST-7" : 500.00 }
//    reserved : {}
//    tickets : {}
// DEF: create-order saga orchestrator (saga id "SAGA-9") · created by ORD when CLIENT POSTs /orders
// -> order_id : "PO-77" · -> customer_id : "CUST-7" · -> total : 100.00
//    step 1 · LT1 on ORD : create the order : orders : {} -> {"PO-77":"PENDING"}
//    step 2 · send ReserveCredit(saga="SAGA-9", amount=100.00) to CS
//    step 3 · LT2 on CS : reserve : reserved : {} -> {"SAGA-9"} · customer_credit : {"CUST-7":500.00} -> {"CUST-7":400.00}   BECAUSE 100.00 of the 500.00 is held
//    step 4 · CS replies "credit_reserved" -> orchestrator sends CreateTicket(order_id="PO-77") to KIT
//    step 5 · LT3 on KIT : the ticket is rejected BECAUSE the item is not available : tickets : {} -> {} (nothing created)
//    step 6 · KIT replies "ticket_rejected" -> the orchestrator runs the COMPENSATING transactions
//    step 7 · COMPENSATE LT2 : ReleaseCredit(saga="SAGA-9", amount=100.00) to CS : customer_credit : {"CUST-7":400.00} -> {"CUST-7":500.00}   BECAUSE the held 100.00 is returned
//    step 8 · COMPENSATE LT1 : reject the order : orders : {"PO-77":"PENDING"} -> {"PO-77":"REJECTED"}
// <- outcome : "OrderRejected" · order REJECTED, credit fully released, no ticket created
//    alt success : KIT replies "ticket_created" -> orders : {"PO-77":"PENDING"} -> {"PO-77":"APPROVED"} (no compensation)`,
      tieback: "This is orchestration-based saga — one orchestrator directs each local transaction and its compensating step.",
      refs: ["Orchestration: an orchestrator directs the steps"],
      problems: ["26-payment-system", "22-hotel-reservation", "19-distributed-message-queue"]
    },
    {
      scenario: "You would rather not maintain a central coordinator. Each service should react to events published by the previous step and move the saga forward on its own.",
      q: "How does choreography-based saga coordination advance the transaction without a central orchestrator?",
      solution: "Each local transaction publishes a domain event that triggers the next service's local transaction, so the events themselves carry the saga forward.",
      components: [
        "OrderCreated event — triggers credit reservation",
        "CreditReserved event — triggers order approval",
        "Local transactions — one per event handler",
        "No orchestrator — the events are the coordination"
      ],
      diagram: `flowchart LR
  ORD["Order Service"] -->|OrderCreated| CS["Customer Service"]
  CS -->|CreditReserved| ORD
  ORD -->|approve| ORDDB[("Order APPROVED")]`,
      code: `// ORDER SERVICE SIDE — choreography: each local transaction publishes a domain event that triggers the next local transaction
// PARTIES: ORD = Order Service · CS = Customer Service · BRK = the events travelling between them
// DEF: credit — the customer's available balance a saga step reserves = { "CUST-7" : 500.00 }
// STATE (before):
//    orders : {}
//    customer_credit : { "CUST-7" : 500.00 }
//    credit_events : []
// DEF: choreographed handler chain · one event carries the saga forward, no orchestrator
// -> POST /orders : total = 100.00
//    step 1 · LT1 on ORD : create the order : orders : {} -> {"PO-77":"PENDING"}
//    step 2 · ORD publishes "OrderCreated" : the event triggers the next local transaction in CS
//    step 3 · CS handler receives "OrderCreated" and reserves credit : customer_credit : {"CUST-7":500.00} -> {"CUST-7":400.00}   BECAUSE 100.00 is reserved
//    step 4 · CS publishes "CreditReserved" : credit_events : [] -> ["CreditReserved"]
//    step 5 · ORD handler receives "CreditReserved" and approves : orders : {"PO-77":"PENDING"} -> {"PO-77":"APPROVED"}
// <- outcome : order "PO-77" APPROVED · no central coordinator — each event is the trigger for the next step`,
      tieback: "This is choreography-based saga — each published event triggers the next service's local transaction.",
      refs: ["Choreography: events trigger the next step"],
      problems: ["26-payment-system", "22-hotel-reservation", "19-distributed-message-queue"]
    },
    {
      scenario: "Two sagas run at once for the same customer: saga A reserves 100.00 of credit but has not committed, and saga B reads the balance and acts on what it sees. You want to know what can go wrong.",
      q: "Why does a saga lack ACID isolation, and what anomaly can concurrent sagas cause?",
      solution: "A saga has no transaction manager holding locks across services, so intermediate states are visible; a second saga can read a balance that a first saga has reserved but not yet committed, so you need countermeasures.",
      components: [
        "Saga A — reserves credit mid-flight",
        "Saga B — reads the balance concurrently",
        "Visible intermediate state — the reserved amount",
        "Countermeasures — implement isolation"
      ],
      diagram: `flowchart LR
  A["Saga A reserves 100.00"] -->|balance now 400.00| DB[("Customer credit")]
  B["Saga B reads balance"] -->|sees 400.00| DB
  B -->|reserves against uncommitted state| RISK["Anomaly"]`,
      code: `// CUSTOMER SERVICE SIDE — no ACID isolation: a second saga reads a balance a first saga reserved but has not committed
// PARTIES: A = saga A · B = saga B · CS = Customer Service
// DEF: balance — the customer's credit balance both sagas touch = 500.00
// STATE (before):
//    balance : 500.00
//    reserved_by_A : {}
//    reserved_by_B : {}
// DEF: saga_A_reserve · CALLED BY: saga A reserving credit for order "PO-77"
// -> amount : 100.00
//    step 1 · A holds credit mid-saga : balance : 500.00 -> 400.00   BECAUSE A reserves 100.00 but has not committed
//    step 2 · A records the hold : reserved_by_A : {} -> { "PO-77" : 100.00 }
// <- state : balance 400.00 · the intermediate state is visible before A commits
// DEF: saga_B_reserve · CALLED BY: saga B reserving credit for order "PO-88"
// -> amount : 300.00
//    step 1 · B reads the balance : seen : "none" -> 400.00   BECAUSE B observes A's uncommitted reservation
//    step 2 · B reserves against it : balance : 400.00 -> 100.00   BECAUSE B subtracts its own 300.00 from the 400.00 it saw
// <- outcome : balance 100.00 · B acted on a state A had not committed — an anomaly the saga's missing isolation allows`,
      tieback: "This is the Saga's isolation tradeoff — no ACID isolation means concurrent sagas can observe each other's uncommitted state.",
      refs: ["Resulting context: compensation, isolation, reliability"],
      problems: ["26-payment-system", "22-hotel-reservation", "19-distributed-message-queue"]
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'A transaction spans multiple services', content: '<p><strong>Why.</strong> Database per Service gives each service its own database, but a business transaction like creating an order also checks a credit limit that lives in another service.</p><p><strong>Claim.</strong> You need a mechanism to implement transactions that span multiple services, because a local ACID transaction cannot reach across databases and 2PC is not an option.</p><p><strong>Grounding.</strong> Orders and Customers are in different databases owned by different services, so the application cannot simply use a local ACID transaction.</p><p><strong>In the wild.</strong> An e-commerce store where a new order must not exceed the credit limit of the customer.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'A sequence of local transactions with compensation', content: '<p><strong>Why.</strong> Each step is a local transaction that only touches one database, so it stays ACID and simple.</p><p><strong>Claim.</strong> Implement each business transaction that spans services as a saga: a sequence of local transactions, each updating its database and publishing a message or event to trigger the next.</p><p><strong>Grounding.</strong> If a local transaction fails because it violates a business rule, the saga executes compensating transactions that undo the changes made by the preceding local transactions.</p><p><strong>In the wild.</strong> Choreography (events trigger the next service) or orchestration (an orchestrator tells participants what to do).</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'No automatic rollback', content: '<p><strong>Why.</strong> There is no ACID transaction manager to undo a partially completed saga.</p><p><strong>Claim.</strong> A developer must design compensating transactions that explicitly undo changes made earlier in the saga, rather than relying on automatic rollback.</p><p><strong>Grounding.</strong> Each step that commits must have a matching undo step, like releasing credit that was reserved.</p><p><strong>In the wild.</strong> A rejected order releases its reserved credit and marks the order rejected.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'No ACID isolation', content: '<p><strong>Why.</strong> Multiple sagas and transactions run concurrently, so their intermediate states are visible to each other.</p><p><strong>Claim.</strong> The lack of isolation means concurrent execution can cause data anomalies, so a saga developer must typically use countermeasures, design techniques that implement isolation.</p><p><strong>Grounding.</strong> Careful analysis is needed to select and correctly implement the countermeasures.</p><p><strong>In the wild.</strong> A second saga may read a credit balance that a first saga has reserved but not yet committed.</p>' }
    ]
  },
  quiz: [
    { "question": "What is a saga?", "options": ["A. A distributed transaction that uses two-phase commit across services", "B. A sequence of local transactions, each updating its own database and publishing a message or event to trigger the next", "C. A single database transaction that locks every table it touches", "D. A message broker that guarantees exactly-once delivery"], "answer": 2, "explanation": "A saga is a sequence of local transactions, each updating its own database and publishing a message or event to trigger the next. A is wrong because 2PC is explicitly not an option. C is wrong because a saga spans multiple databases and cannot be one local transaction. D is wrong because a saga is not a broker.", "conceptRef": "A sequence of local transactions with compensation" },
    { "question": "In an orchestration-based saga, who tells the participants what local transactions to execute?", "options": ["A. Each service, by watching for events", "B. A message broker routing table", "C. An orchestrator object", "D. A database trigger"], "answer": 3, "explanation": "An orchestrator object tells the participants what local transactions to execute. A describes choreography, not orchestration. B and D are not how a saga is coordinated.", "conceptRef": "A sequence of local transactions with compensation" },
    { "question": "What happens when a local transaction fails because it violates a business rule?", "options": ["A. The saga restarts from the first step", "B. The saga executes a series of compensating transactions that undo the preceding local transactions", "C. The saga retries the same transaction forever", "D. The database rolls back all services automatically"], "answer": 2, "explanation": "The saga executes compensating transactions that undo the changes made by the preceding local transactions. A and C are wrong because a saga does not restart or retry forever. D is wrong because there is no automatic rollback across services.", "conceptRef": "No automatic rollback" },
    { "question": "Which of these is a drawback of the saga pattern?", "options": ["A. It requires two-phase commit", "B. It cannot span more than two services", "C. Lack of automatic rollback and lack of isolation", "D. It prevents concurrent execution of transactions"], "answer": 3, "explanation": "The drawbacks are lack of automatic rollback (compensating transactions must be designed) and lack of isolation (countermeasures are needed). A is wrong because 2PC is not an option. B is wrong because a saga can span many services. D is wrong because sagas run concurrently.", "conceptRef": "No ACID isolation" }
  ]
});
