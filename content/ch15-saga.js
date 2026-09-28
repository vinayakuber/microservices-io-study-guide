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
// GOAL (what this is FOR): show why a single local transaction cannot complete a business flow that touches two services' data.
//    THE NAIVE WAY (why we build anything at all): try to do the whole flow in one ACID transaction, deducting credit that
//    lives in another database; the transaction cannot see that data, so the UPDATE fails and the whole transaction aborts.
// PARTIES: ORD = Order Service · ORDDB = PostgreSQL 16 @ orders-db-1 · CS = Customer Service · CSDB = PostgreSQL 16 @ customers-db-1
// DEF: credit — the customer's spending limit owned by the Customer Service = 100.00 (the order total that must not exceed it)
// STATE (before):
//    orders : {}
//    customer_credit : {}          // owned by CS in CSDB, invisible to ORDDB
//    WHY customer_credit is out of reach: it lives in CSDB, and ORDDB's local transaction can only see ORDDB; so the
//    deduction hits "no such table" and the whole transaction rolls back — one database cannot span the two services.
// DEF: create_order · CALLED BY: CLIENT via POST /orders
// -> order_id : "PO-2001" · -> total : 100.00
//    step 1 · BEGIN a local transaction on ORDDB (the broker and CSDB are NOT enlisted)
//    -> input  : tx = "none" (order_id = "PO-2001", total = 100.00)
//    <- output : tx = "open"   BECAUSE ORD begins a local transaction on ORDDB only
//    step 2 · INSERT the order   // orders : {} -> {"PO-2001":"PENDING"}
//    -> input  : orders = {}
//    <- output : orders = {"PO-2001":"PENDING"}   BECAUSE the INSERT writes the order into ORDDB
//    step 3 · try to deduct credit   // customer_credit : {} -> ERROR "no such table"  BECAUSE customers lives in CSDB, not ORDDB
//    -> input  : customer_credit = {} (total = 100.00)
//    <- output : customer_credit = ERROR "no such table"   BECAUSE customers lives in CSDB, not ORDDB
//    step 4 · the UPDATE fails, so the transaction aborts   // orders : {"PO-2001":"PENDING"} -> {} (rolled back)
//    -> input  : orders = {"PO-2001":"PENDING"}
//    <- output : orders = {} (rolled back)   BECAUSE the UPDATE failed and the transaction aborts
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
// GOAL (what this is FOR): drive a multi-service flow from one orchestrator that knows every forward step and every compensating step, so a failure in the middle unwinds cleanly.
//    THE NAIVE WAY (why we build anything at all): let each service guess the next step and hope the failure path is
//    consistent; a failure mid-flow leaves half the state changed with no owner to undo it. We replace that with an orchestrator that owns the sequence and compensates in reverse.
// PARTIES: CLIENT = the user · ORD = Order Service (runs the orchestrator) · CS = Customer Service · KIT = Kitchen Service
// DEF: credit — the customer's available balance a saga step reserves and releases = { "CUST-7" : 500.00 }
// STATE (before):
//    orders : {}
//    customer_credit : { "CUST-7" : 500.00 }     // available credit, owned by Customer Service
//    reserved : {}                               // sagas CS has already reserved for (idempotency guard)
//    WHY reserved exists: without it, a retried ReserveCredit would deduct the credit twice; with it, each saga id is
//    recorded once, so a repeated command for the same saga is skipped and the reservation happens exactly once.
//    tickets : {}                                // owned by Kitchen Service
// DEF: create-order saga orchestrator · created by ORD when CLIENT POSTs /orders
// -> order_id : "PO-2001" · -> customer_id : "CUST-7" · -> total : 100.00
// BUILD PHASE · run once per saga
//    step 1 · LT1 on ORD : create the order   // orders : {} -> {"PO-2001":"PENDING"}
//    -> input  : orders = {}
//    <- output : orders = {"PO-2001":"PENDING"}   BECAUSE LT1 on ORD creates the order in the PENDING state
//    step 2 · send ReserveCredit(saga="SAGA-1", amount=100.00) to CS
//    -> input  : out_msg = "none"
//    <- output : out_msg = "ReserveCredit(saga=SAGA-1, amount=100.00) -> CS"   BECAUSE the orchestrator sends the command to Customer Service
//    step 3 · LT2 on CS : if "SAGA-1" already in reserved -> skip (idempotent retry); else reserve   // reserved : {} -> {"SAGA-1"} · customer_credit : {"CUST-7":500.00} -> {"CUST-7":400.00}  BECAUSE 100.00 of the 500.00 is held
//    -> input  : reserved = {} (customer_credit = {"CUST-7":500.00}, saga = "SAGA-1")
//    <- output : reserved = {"SAGA-1"} · customer_credit = {"CUST-7":400.00}   BECAUSE 100.00 of the 500.00 is held
//    step 4 · CS replies "credit_reserved" -> orchestrator sends CreateTicket(order_id="PO-2001") to KIT
//    -> input  : reply = "none" (credit_reserved = true)
//    <- output : reply = "credit_reserved" · out_msg = "CreateTicket(order_id=PO-2001) -> KIT"   BECAUSE the orchestrator advances on the reply
//    step 5 · LT3 on KIT : the ticket is rejected BECAUSE the item is not available   // tickets : {} -> {} (nothing created)
//    -> input  : tickets = {} (order_id = "PO-2001")
//    <- output : tickets = {} (nothing created)   BECAUSE the item is not available
// QUERY PHASE · per failure
//    step 6 · KIT replies "ticket_rejected" -> the orchestrator runs the COMPENSATING transactions
//    -> input  : reply = "none" (ticket_rejected = true)
//    <- output : reply = "ticket_rejected"   BECAUSE Kitchen Service reports the rejection
//    step 7 · COMPENSATE LT2 : ReleaseCredit(saga="SAGA-1", amount=100.00) to CS   // customer_credit : {"CUST-7":400.00} -> {"CUST-7":500.00}  BECAUSE the held 100.00 is returned
//    -> input  : customer_credit = {"CUST-7":400.00} (amount = 100.00)
//    <- output : customer_credit = {"CUST-7":500.00}   BECAUSE the held 100.00 is returned
//    step 8 · COMPENSATE LT1 : reject the order   // orders : {"PO-2001":"PENDING"} -> {"PO-2001":"REJECTED"}
//    -> input  : orders = {"PO-2001":"PENDING"}
//    <- output : orders = {"PO-2001":"REJECTED"}   BECAUSE the orchestrator rejects the order to compensate
// TRACE (one run, order "PO-2001", ticket rejected):
//    phase  | orders                     | customer_credit          | reserved   | tickets
//    build  | {"PO-2001":"PENDING"}      | {"CUST-7":400.00}        | {"SAGA-1"} | {}
//    query  | {"PO-2001":"REJECTED"}     | {"CUST-7":500.00}        | {"SAGA-1"} | {}
// CORRECTNESS (compensation invariant): every forward local transaction has a compensating transaction that undoes it
//    in reverse order (release credit, then reject the order), so on any failure the saga returns each participant to its pre-saga state.
// VARIANTS (when to pick which):
//    orchestration                -> one orchestrator owns the sequence, n forward steps + m compensation steps, no extra state   (use when you want explicit failure paths)   <- THIS ONE
//    choreography                 -> events trigger the next step, no coordinator, n forward steps                             (use when the sequence is simple and stable)
//    idempotent saga steps        -> each step guarded by the saga id in a seen-set, one check per retry                          (use when commands may be retried)
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
// GOAL (what this is FOR): advance a saga with no central coordinator, by making each step's event the trigger for the next step.
//    THE NAIVE WAY (why we build anything at all): keep an orchestrator that sends commands and tracks who has done what;
//    that state is a component to maintain. We replace the coordinator with a chain where each local transaction publishes the event that names the next step.
// PARTIES: ORD = Order Service · CS = Customer Service · BRK = the events travelling between them
// DEF: credit — the customer's available balance a saga step reserves = { "CUST-7" : 500.00 }
// DEF: event — a domain message a service publishes to trigger the next local transaction = "OrderCreated"
// STATE (before):
//    orders : {}
//    customer_credit : { "CUST-7" : 500.00 }
//    credit_events : []
//    WHY credit_events exists: without it, each service would have to remember whom to notify and the chain would have no
//    visible thread; with it, each published event is the trigger for the next local transaction, so the saga advances on its own.
// DEF: choreographed handler chain · one event carries the saga forward, no orchestrator
// -> POST /orders : total = 100.00
// BUILD PHASE · run once per local transaction
//    step 1 · LT1 on ORD : create the order   // orders : {} -> {"PO-2001":"PENDING"}
//    -> input  : orders = {}
//    <- output : orders = {"PO-2001":"PENDING"}   BECAUSE LT1 on ORD creates the order in the PENDING state
//    step 2 · ORD publishes "OrderCreated"   // the event triggers the next local transaction in CS
//    -> input  : event = "none"
//    <- output : event = "OrderCreated"   BECAUSE ORD publishes the event that triggers the next local transaction in CS
// QUERY PHASE · per event handler
//    step 3 · CS handler receives "OrderCreated" and reserves credit   // customer_credit : {"CUST-7":500.00} -> {"CUST-7":400.00}  BECAUSE 100.00 is reserved
//    -> input  : customer_credit = {"CUST-7":500.00} (event = "OrderCreated")
//    <- output : customer_credit = {"CUST-7":400.00}   BECAUSE 100.00 is reserved
//    step 4 · CS publishes "CreditReserved"   // credit_events : [] -> ["CreditReserved"]
//    -> input  : credit_events = []
//    <- output : credit_events = ["CreditReserved"]   BECAUSE CS publishes the outcome event
//    step 5 · ORD handler receives "CreditReserved" and approves   // orders : {"PO-2001":"PENDING"} -> {"PO-2001":"APPROVED"}
//    -> input  : orders = {"PO-2001":"PENDING"} (event = "CreditReserved")
//    <- output : orders = {"PO-2001":"APPROVED"}   BECAUSE ORD approves the order on the CreditReserved event
// TRACE (one run, order "PO-2001"):
//    phase  | orders                  | customer_credit          | credit_events
//    build  | {"PO-2001":"PENDING"}   | {"CUST-7":500.00}        | []
//    query  | {"PO-2001":"APPROVED"}  | {"CUST-7":400.00}        | ["CreditReserved"]
// CORRECTNESS (event-chain invariant): each local transaction publishes exactly one event that names the next step, so
//    "OrderCreated" triggers the reserve and "CreditReserved" triggers the approve — the chain advances with no central coordinator.
// VARIANTS (when to pick which):
//    choreography              -> events trigger the next local transaction, one write per event, no extra space   (use when the sequence is simple and stable)   <- THIS ONE
//    orchestration             -> one orchestrator sends commands and handles failures, n forward steps + m compensation steps   (use when failure paths get complex)
//    event with saga id        -> tag every event with the saga id, one tag per event                              (use when many sagas interleave)
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
// GOAL (what this is FOR): give a synchronous caller the saga's final answer without blocking the saga on the caller.
//    THE NAIVE WAY (why we build anything at all): hold the HTTP connection open until the saga finishes; the caller ties
//    up a thread for the whole saga. We replace that wait with a status the client polls until the saga is done.
// PARTIES: CLIENT = the user · ORD = Order Service
// STATE (before):
//    orders : { "PO-2001" : { status : "PENDING" } }
//    poll_count : 0
//    WHY poll_count exists: without it, "how many times has the client asked?" is untracked and the trace cannot show the
//    two polls; with it, each GET is one increment, so the first poll sees PENDING and the second sees APPROVED.
// DEF: client outcome for order "PO-2001" · the POST returned the id while the saga was still running
// -> GET /orders/PO-2001 : poll #1
//    step 1 · first poll   // poll_count : 0 -> 1  BECAUSE the client issued its first status query
//    -> input  : poll_count = 0 (request = "GET /orders/PO-2001")
//    <- output : poll_count = 1   BECAUSE the client issued its first status query
//    step 2 · ORD returns status "PENDING"   // the saga has not finished — credit not yet reserved
//    -> input  : orders = {"PO-2001":{"status":"PENDING"}}
//    <- output : status = "PENDING"   BECAUSE the saga has not finished — credit not yet reserved
//    step 3 · in the background the saga completes: credit reserved, then approved   // orders : {"PO-2001":{status:"PENDING"}} -> {"PO-2001":{status:"APPROVED"}}
//    -> input  : orders = {"PO-2001":{"status":"PENDING"}} (credit reserved, then approved)
//    <- output : orders = {"PO-2001":{"status":"APPROVED"}}   BECAUSE the saga completes its remaining steps in the background
// -> GET /orders/PO-2001 : poll #2
//    step 4 · second poll   // poll_count : 1 -> 2  BECAUSE the client polls again
//    -> input  : poll_count = 1 (request = "GET /orders/PO-2001")
//    <- output : poll_count = 2   BECAUSE the client polls again
//    step 5 · ORD returns status "APPROVED"
//    -> input  : orders = {"PO-2001":{"status":"APPROVED"}}
//    <- output : status = "APPROVED"   BECAUSE the saga has completed
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
  systemDesign: {
    question: 'Design a transaction that spans services. Premise: an orchestrator drives each participant service through the broker, and every step that fails is compensated, so the business flow is eventually consistent.',
    pipeline: 'orchestrator → participant services → event/message broker',
    decomposition: [
      {
        box: 'saga orchestrator — the orchestrator',
        role: 'orchestrator',
        parts: [
          'Orders each participant to act',
          'Tracks the saga state',
          'Triggers compensations on failure'
        ]
      },
      {
        box: 'order service — the participant',
        role: 'participant service',
        parts: [
          'Executes its step',
          'Publishes its outcome event'
        ]
      },
      {
        box: 'customer service — the participant',
        role: 'participant service',
        parts: [
          'Reserves credit for the order',
          'Publishes CreditReserved'
        ]
      },
      {
        box: 'event / message broker (RabbitMQ) — the broker',
        role: 'broker',
        parts: [
          'Carries step results back to the orchestrator'
        ]
      }
    ],
    
    program: `// SYSTEM DESIGN — saga (orchestrated) as a pipeline: orchestrator -> participant services -> event/message broker (each step executes + records state, compensations on failure)
// GOAL (what this is FOR): complete a business flow that spans services as a sequence of local transactions, with one owner that advances the state and compensates on failure.
//    THE NAIVE WAY (why we build anything at all): span the services with one ACID transaction or a 2PC; a transaction
//    cannot see another database, and 2PC couples and can block. We replace that with an orchestrator that orders each step and compensates the ones already done.
// PARTIES: ORCH = saga orchestrator (orders steps, tracks state, compensates) · ORD = order service (participant) · CS = customer service (participant) · KIT = kitchen service (participant) · BRK = message broker (RabbitMQ)
// DEF: orders — ORD's datastore; here PostgreSQL 16 @ orders-db-1, row ("PO-77", "PENDING")
// DEF: customers — CS's datastore; here PostgreSQL 16 @ customers-db-1, row ("CUST-7", credit 500.00)
// DEF: events — the emitted event stream; here [ "OrderCreated", "CreditReserved", "ticket_created" ]
// DEF: state — the saga's state; here "NEW" -> "COMPLETED"
// STATE (before):
//    orders    : [ ("PO-77", "PENDING") ]
//    customers : [ ("CUST-7", credit 500.00) ]
//    events    : []
//    WHY events exists: without it, each participant's outcome is spoken once and lost, and the orchestrator cannot tell
//    which step finished; with it, every outcome is an appended event, so the saga's progress is a stream the orchestrator reads.
//    state     : "NEW"
//    WHY state exists: without it, "how far has this saga gotten?" has no single answer and a compensation decision is a
//    guess; with it, one field advances NEW -> COMPLETED, so the orchestrator knows exactly which step is next.
// DEF: run_saga · CALLED BY: ORCH receiving "OrderCreated" for PO-77
// -> command : "reserve credit 100.00 for CUST-7"
// BUILD PHASE · run once per saga
//    step 1 · ORCH orders CS to reserve credit    customers : [("CUST-7", credit 500.00)] -> [("CUST-7", credit 400.00)]   BECAUSE CS debits 100.00 for the reservation
//    -> input  : customers = [("CUST-7", credit 500.00)] (command = "reserve credit 100.00 for CUST-7")
//    <- output : customers = [("CUST-7", credit 400.00)]   BECAUSE CS debits 100.00 for the reservation
// QUERY PHASE · per participant step
//    step 2 · CS publishes CreditReserved    events : [] -> [ "OrderCreated", "CreditReserved" ]   BECAUSE the participant publishes its outcome back to the orchestrator
//    -> input  : events = []
//    <- output : events = [ "OrderCreated", "CreditReserved" ]   BECAUSE the participant publishes its outcome back to the orchestrator
//    step 3 · ORCH orders KIT to create the ticket    events : ["OrderCreated","CreditReserved"] -> ["OrderCreated","CreditReserved","ticket_created"]   BECAUSE the next participant acts on the reserved credit
//    -> input  : events = ["OrderCreated","CreditReserved"] (command = "CreateTicket")
//    <- output : events = ["OrderCreated","CreditReserved","ticket_created"]   BECAUSE the next participant acts on the reserved credit
//    step 4 · saga completes    state : "NEW" -> "COMPLETED"   BECAUSE every step succeeded with no compensation needed
//    -> input  : state = "NEW"
//    <- output : state = "COMPLETED"   BECAUSE every step succeeded with no compensation needed
// TRACE (one run, saga SAGA-1):
//    phase  | customers                    | events                                             | state
//    build  | [("CUST-7", credit 500.00)]  | []                                                 | "NEW"
//    query  | [("CUST-7", credit 400.00)]  | ["OrderCreated","CreditReserved","ticket_created"] | "COMPLETED"
// CORRECTNESS (saga-state invariant): the orchestrator advances state from "NEW" to "COMPLETED" only after each participant
//    publishes its outcome, and any failed step triggers compensation instead — so the saga never completes with an un-compensated failure.
// VARIANTS (when to pick which):
//    orchestrated saga       -> one orchestrator orders steps and compensates, n forward steps + m compensation steps, one saga state   (use for explicit failure paths)   <- THIS ONE
//    choreographed saga      -> events alone advance the saga, no orchestrator, n forward steps                                  (use when the flow is simple and stable)
//    saga with outbox        -> each step writes its event via a transactional outbox, one event write per step                            (use when a step must not lose its event)
// <- outcome : state "COMPLETED" for saga SAGA-1 · credit debited 100.00 from CUST-7`
  },
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
