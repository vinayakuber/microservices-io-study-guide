registerChapter({
  id: 'ch19',
  num: 19,
  title: 'Event Sourcing',
  pattern: 'Persist a business entity as a sequence of state-changing events and rebuild its current state by replaying them.',
  aka: 'Chris Richardson · Microservice Patterns · microservices.io /patterns/data/event-sourcing.html',
  part: 4,
  flow: [
    {
      section: 'Persist state as a sequence of events',
      color: 'orange',
      motivation: `A command that must update the database and publish an event cannot do both atomically with 2PC, yet letting them drift corrupts the data. Appending one event makes the state change and its publishable event the same single write.`,
      steps: [
        { num: 1, title: 'Append, do not update in place', detail: 'Instead of rewriting a current-state row, each change appends a new event to the list of events for that entity.' },
        { num: 2, title: 'Store the events in an event store', detail: 'A database of events with an API for adding and retrieving the events of an entity.' },
        { num: 3, title: 'Rely on the single-write atomicity', detail: 'Saving one event is one operation, so it is inherently atomic — no 2PC with the broker.' }
      ],
      program: `// EVENT SOURCING SIDE — the store holds events, not current state; each change is one atomic append
// PARTIES: SVC = Order Service · ES = EventStoreDB 24 @ orders-events-1 · CS = CustomerService (subscriber)
// STATE (before):
//    events : []                        // the Order's event list — its full history, empty before creation
//    state : { orderState:null, customerId:null }
// DEF: create order · CALLED BY: SVC processing a CreateOrderCommand
// -> customerId : "C-100" · -> orderTotal : 125.00
//    step 1 · build the event : E1 = OrderCreatedEvent("C-100", 125.00)   // the command becomes an event
//    step 2 · append to the store : events : [] -> [E1:OrderCreated("C-100",125.00)]   BECAUSE saving an event is a single operation, inherently atomic
//    step 3 · apply to memory : state.orderState : null -> "CREATED" · state.customerId : null -> "C-100"
// <- event : E1:OrderCreated("C-100",125.00) · delivered to every subscriber, including CS
//
// DEF: approve order · CALLED BY: SVC processing an ApproveOrderCommand
// -> customerId : "C-100"
//    step 1 · build : E2 = OrderApprovedEvent("C-100")
//    step 2 · append : events : [E1:OrderCreated("C-100",125.00)] -> [E1:OrderCreated("C-100",125.00), E2:OrderApproved("C-100")]
//    step 3 · apply : state.orderState : "CREATED" -> "APPROVED"
// <- event : E2:OrderApproved("C-100") · delivered to every subscriber`
    },
    {
      section: 'Rebuild current state by replaying events',
      color: 'orange',
      motivation: `Because the store holds history instead of a ready-to-read row, the application must fold the events back into current state. Replay order is the write order, so the reconstructed state is deterministic.`,
      steps: [
        { num: 1, title: 'Read the full event list', detail: 'The application retrieves the full sequence of events for the aggregate.' },
        { num: 2, title: 'Apply each event in order', detail: 'An apply() method per event type folds it into state — OrderCreated sets CREATED and the customer id.' },
        { num: 3, title: 'Stop at the last event', detail: 'The final folded value is the current state, with no separate current-state table.' }
      ],
      program: `// EVENT SOURCING SIDE — current state is never stored; it is re-derived by folding every event in order
// PARTIES: SVC = Order Service · ES = EventStoreDB 24 @ orders-events-1
// STATE (before):
//    events : [E1:OrderCreated("C-100",125.00), E2:OrderApproved("C-100")]
//    state : { orderState:null, customerId:null }      // empty before replay
// DEF: replay · CALLED BY: SVC loading the Order — reads the event list and applies each event in sequence
// -> entityId : "PO-100"
//    step 1 · apply E1 sets state : state.orderState : null -> "CREATED"
//    step 2 · apply E1 copies id : state.customerId : null -> "C-100"   BECAUSE apply(OrderCreatedEvent) sets state and copies the customer id
//    step 3 · apply E2 : state.orderState : "CREATED" -> "APPROVED"   BECAUSE apply(OrderApprovedEvent) sets state to APPROVED
// <- state : { orderState:"APPROVED", customerId:"C-100" } · replayed from 2 events
//    alt wrong order : replaying E2 before E1 would leave orderState "CREATED", so event order must be preserved`
    },
    {
      section: 'Shorten replay with snapshots',
      color: 'orange',
      motivation: `Entities such as a Customer accumulate many events, so replaying everything is wasteful. A periodic snapshot of current state means only the events since that snapshot need to be folded.`,
      steps: [
        { num: 1, title: 'Save a snapshot of current state', detail: 'Periodically persist the current state of the entity as of some event.' },
        { num: 2, title: 'Load the newest snapshot', detail: 'To reconstruct, find the most recent snapshot instead of starting empty.' },
        { num: 3, title: 'Replay only the later events', detail: 'Fold the events since the snapshot, so there are fewer events to replay.' }
      ],
      program: `// EVENT SOURCING SIDE — a snapshot shortens replay: load the newest snapshot, then fold only the events after it
// PARTIES: SVC = Customer Service · ES = EventStoreDB 24 @ orders-events-1
// STATE (before):
//    snapshot : { balance:100.00, seq:3 }      // Customer's state saved at event 3
//    events : [E1:Created, E2:Credit+50.00, E3:Credit+50.00, E4:Debit-25.00]
// DEF: load · CALLED BY: SVC reading the Customer — finds the most recent snapshot, then only the events since it
// -> entityId : "C-100"
//    step 1 · start from the snapshot : state.balance : null -> 100.00   BECAUSE the snapshot already folded E1..E3
//    step 2 · replay only E4 : state.balance : 100.00 -> 75.00   BECAUSE Debit-25.00 subtracts from the snapshot balance
//    step 3 · count the replay : replayed : 4 -> 1   BECAUSE only the events after seq 3 need folding
// <- state : { balance:75.00 } · rebuilt from 1 event instead of 4`
    },
    {
      section: 'Let the event store deliver to subscribers',
      color: 'orange',
      motivation: `The reliable-publish problem dissolves because the store itself behaves like a message broker: a subscriber receives each saved event, so publishing is a by-product of persisting.`,
      steps: [
        { num: 1, title: 'Subscribe to entity events', detail: 'A service registers a handler such as CustomerService.reserveCredit on OrderCreatedEvent.' },
        { num: 2, title: 'Receive the event on save', detail: 'When a service saves an event, the store delivers it to every interested subscriber.' },
        { num: 3, title: 'Update the subscriber state', detail: 'The handler reads the event payload and updates its own aggregate, reserving credit for the order.' }
      ],
      program: `// EVENT SOURCING SIDE — the event store doubles as a broker, so a subscriber reacts to another service's events
// PARTIES: SVC = CustomerService (subscriber) · ES = EventStoreDB 24 @ orders-events-1 (delivers like a broker)
// STATE (before):
//    reserved : {}                       // credit the Customer has reserved per order, empty
//    balance : 200.00
// DEF: reserveCredit · CALLED BY: ES delivering an OrderCreatedEvent to the subscribed CustomerService
// -> event : OrderCreatedEvent("C-100", 125.00) · -> orderId : "PO-100"
//    step 1 · read the payload : customerId : null -> "C-100" · orderTotal : null -> 125.00   BECAUSE the handler unpacks the event it received
//    step 2 · reserve credit : balance : 200.00 -> 75.00   BECAUSE reserveCredit subtracts the order total 125.00 from the 200.00 available
//    step 3 · record the reservation : reserved : {} -> { "PO-100":125.00 }
// <- state : { balance:75.00, reserved:{"PO-100":125.00} } · the Customer's own state updated from the Order's event`
    }
  ],
  interview: [
    {
      scenario: "Your order state is stored as the current row only, so you cannot answer how the order got to APPROVED or rebuild it later. You want the full history persisted.",
      q: "How does event sourcing persist state, and what does an event record look like?",
      solution: "Instead of storing current state, the service stores the sequence of events that changed it; each event is a record of a state change.",
      components: [
        "Event store — holds events",
        "Event record — one state change",
        "OrderCreated — first event",
        "OrderApproved — a later event"
      ],
      
      code: `// ORDER SERVICE SIDE — persist state as a sequence of events instead of the current row
// PARTIES: SVC = Order Service · STORE = EventStoreDB 24 @ orders-events-1
// STATE (before):
//    events : []
//    current_state : {}   // nothing stored as a row
// DEF: append_event · CALLED BY: SVC on each state change
// -> event : { order_id:"C-55", type:"OrderCreated", total:125.00 }
//    step 1 · append the first event : events : [] -> [{ seq:1, order_id:"C-55", type:"OrderCreated", total:125.00 }]
//    step 2 · append the next event after approval : events : [{seq:1}] -> [{seq:1},{ seq:2, order_id:"C-55", type:"OrderApproved" }]
//    step 3 · state is derived by replaying events : current_state : {} -> { status:"APPROVED", total:125.00 }   BECAUSE E1 then E2 rebuild it
// <- outcome : events : [E1 OrderCreated(125.00), E2 OrderApproved] · the full history is stored, not just the current APPROVED state`,
      tieback: "This is Event Sourcing — persist the state-changing events themselves as the source of truth.",
      refs: ["Persist state as a sequence of events"],
      problems: ["26-payment-system", "28-stock-exchange"]
    },
    {
      scenario: "You have an event store full of order events, and you need the current state of order C-55 to serve a read request.",
      q: "How does replaying events rebuild the current state of an aggregate?",
      solution: "The service reads the aggregate's events in order and applies each one, accumulating the current state as it goes.",
      components: [
        "Event store — the source of events",
        "Order aggregate — the object being rebuilt",
        "apply — folds each event into state",
        "Replay — reads events in order"
      ],
      
      code: `// ORDER SERVICE SIDE — rebuild current state by replaying the aggregate's events in order
// PARTIES: SVC = Order Service · STORE = EventStoreDB 24 @ orders-events-1 · AGG = the Order aggregate being rebuilt
// STATE (before):
//    events : [{ seq:1, order_id:"C-55", type:"OrderCreated", total:125.00 }, { seq:2, order_id:"C-55", type:"OrderApproved" }]
//    order : { state:"none" }
// DEF: replay · CALLED BY: SVC to load order "C-55"
// -> order_id : "C-55"
//    step 1 · read the events in sequence : loaded : "none" -> [E1, E2]
//    step 2 · apply E1 : order : { state:"none" } -> { state:"CREATED", total:125.00 }
//    step 3 · apply E2 : order : { state:"CREATED" } -> { state:"APPROVED", total:125.00 }
// <- outcome : order : { state:"APPROVED", total:125.00 } · current state rebuilt from E1 then E2`,
      tieback: "This is Event Sourcing replay — apply each event in order to rebuild the aggregate's current state.",
      refs: ["Rebuild current state by replaying events"],
      problems: ["26-payment-system", "28-stock-exchange"]
    },
    {
      scenario: "Replaying a million events to load an account balance is too slow. You want to load most of the state and replay only the tail.",
      q: "How does a snapshot shorten replay, and how is the balance rebuilt from it?",
      solution: "The service stores a snapshot of the aggregate's state up to a sequence number, then replays only the events after that snapshot.",
      components: [
        "Snapshot — state at sequence 3",
        "Events after the snapshot — the tail",
        "Replay — only the tail",
        "Current state — snapshot plus tail"
      ],
      
      code: `// ACCOUNT SERVICE SIDE — shorten replay with a snapshot: load the snapshot, replay only the events after it
// PARTIES: SVC = Account Service · STORE = EventStoreDB 24 @ orders-events-1 · ACC = the Account aggregate
// STATE (before):
//    snapshot : { seq:3, balance:100.00 }
//    events_after : [{ seq:4, type:"Debit", amount:25.00 }]
//    account : { balance:"none" }
// DEF: load · CALLED BY: SVC to read the balance
// -> account_id : "ACC-9"
//    step 1 · load the snapshot : account : { balance:"none" } -> { balance:100.00, seq:3 }
//    step 2 · replay only the tail : replayed : 0 -> 1   BECAUSE only E4 is after the snapshot
//    step 3 · apply E4 : account.balance : 100.00 -> 75.00   BECAUSE 100.00 - 25.00 = 75.00
// <- outcome : account : { balance:75.00, seq:4 } · rebuilt by replaying 1 event instead of 4`,
      tieback: "This is Event Sourcing with snapshots — the snapshot avoids replaying the full history, leaving only the tail.",
      refs: ["Shorten replay with snapshots"],
      problems: ["26-payment-system", "28-stock-exchange"]
    },
    {
      scenario: "A customer service wants to track reservations the moment an order reserves credit, without rebuilding any order from its events. You want the event store to push new events out.",
      q: "How does an event store deliver events to subscribers, and what does the subscriber build?",
      solution: "The event store publishes each new event as it is persisted, and subscribers react to build their own state or trigger workflows.",
      components: [
        "Event store — persists and publishes",
        "Subscriber — reacts to new events",
        "OrderPlaced event — a change to deliver",
        "reserved map — built by the subscriber"
      ],
      
      code: `// ACCOUNT SERVICE SIDE — the event store delivers new events to subscribers, who build their own state
// PARTIES: STORE = EventStoreDB 24 @ orders-events-1 · SUB = the subscriber in Account Service · BAL = the account balance
// STATE (before):
//    balance : 200.00
//    reserved : {}
// DEF: persist_and_publish · CALLED BY: STORE when the order aggregate appends an event
// -> event : { type:"OrderPlaced", order_id:"PO-77", total:125.00 }
//    step 1 · the store persists the event : persisted : "none" -> { seq:7, type:"OrderPlaced", order_id:"PO-77" }
//    step 2 · the store delivers it to SUB : delivered : "none" -> "OrderPlaced"
//    step 3 · SUB reserves credit from the balance : balance : 200.00 -> 75.00   BECAUSE 200.00 - 125.00 = 75.00
//    step 4 · SUB records the reservation : reserved : {} -> { "PO-77" : 125.00 }
// <- outcome : balance : 75.00 · reserved : { "PO-77" : 125.00 } · the subscriber reacted without replaying the order`,
      tieback: "This is Event Sourcing letting the store deliver to subscribers — new events are pushed so subscribers build their own state.",
      refs: ["Let the event store deliver to subscribers"],
      problems: ["26-payment-system", "28-stock-exchange"]
    }
  ],
  systemDesign: {
    question: 'Design a system where the event log is the source of truth. Premise: a command appends an event to the event store; a projector folds events into a read model that queries answer, so state is always reconstructable.',
    pipeline: 'command → event store (append) → projector/event handler → read model → query',
    decomposition: [
      {
        box: 'Order Service command side — appends events',
        role: 'command side / event store',
        parts: [
          'append — one atomic write per state change',
          'event store — EventStoreDB 24 @ orders-events-1',
          'delivers each saved event to subscribers like a broker'
        ]
      },
      {
        box: 'projector / event handler',
        role: 'projector/event handler',
        parts: [
          'consume — receives each saved event',
          'fold — apply() of each event into the read model'
        ]
      },
      {
        box: 'read model database',
        role: 'read model DB',
        parts: [
          'PostgreSQL 16 @ orders-view-1',
          'holds the precomputed current state the projector folded'
        ]
      },
      {
        box: 'query side',
        role: 'query side',
        parts: [
          'reads the current state directly',
          'no replay at query time'
        ]
      }
    ],
    
    program: `// SYSTEM DESIGN — event sourcing as a pipeline: command -> event store (append) -> projector/event handler -> read model -> query
// PARTIES: CMD = Order Service command side (writer) · ES = EventStoreDB 24 @ orders-events-1 (append-only event store) · PH = projector/event handler (consumer) · RM = read model database (PostgreSQL 16 @ orders-view-1) · QR = query side (reader)
// DEF: event — one state-changing fact appended to the store; here E2 = OrderApprovedEvent("C-100")
// DEF: view — the read model the projector folds events into; here { orderState:"APPROVED", customerId:"C-100" }
// DEF: fold — apply() of one event onto the view; here E1 sets "CREATED", E2 sets "APPROVED"
// STATE (before):
//    events : [ E1:OrderCreated("C-100",125.00) ]
//    view   : { orderState:"CREATED", customerId:"C-100" }
// DEF: approve_order · CALLED BY: CMD processing command "approve_order"
// -> command : "approve_order"
//    step 1 · CMD appends E2    events : [ E1:OrderCreated("C-100",125.00) ] -> [ E1:OrderCreated("C-100",125.00), E2:OrderApproved("C-100") ]  BECAUSE one append is one atomic write
//    step 2 · ES delivers E2 to PH    delivered : "none" -> "E2:OrderApproved"
//    step 3 · PH folds E2 into the view    view : { orderState:"CREATED", customerId:"C-100" } -> { orderState:"APPROVED", customerId:"C-100" }
//    step 4 · QR reads the current state    read : "none" -> { orderState:"APPROVED", customerId:"C-100" }  (query, no replay)
// <- outcome : QR returns orderState "APPROVED"  BECAUSE CMD wrote E2 to the event store, ES delivered it, PH folded it into the view, and QR read the view back`
  },
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Updating the database and publishing events is not atomic', content: '<p><strong>Why.</strong> A service command must update or delete aggregates in the database and send messages to a broker at the same time, or data and messages drift apart.</p><p><strong>Claim.</strong> Without a distributed transaction the two cannot be made reliable: a message sent mid-transaction may not commit, and a message sent after commit may never be sent if the service crashes first.</p><p><strong>Grounding.</strong> The pattern rules out 2PC because the database or broker may not support it, and coupling the service to both is undesirable.</p><p><strong>In the wild.</strong> A saga participant or a service publishing a domain event faces exactly this database-plus-message atomicity problem.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Persist state as a sequence of events', content: '<p><strong>Why.</strong> Appending one event is a single operation, so the state change and the publishable event are the same write and cannot diverge.</p><p><strong>Claim.</strong> Event sourcing persists a business entity (an Order or a Customer) as a sequence of state-changing events; whenever state changes a new event is appended, and current state is rebuilt by replaying them.</p><p><strong>Grounding.</strong> Events live in an event store that adds and retrieves an entity\'s events and also delivers them to subscribers like a message broker.</p><p><strong>In the wild.</strong> The Eventuate Customers and Orders example stores each Order as a sequence of events rather than a row in an ORDERS table.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Replay is expensive and queries become hard', content: '<p><strong>Why.</strong> The store holds history, not a ready-to-read current state, so answering a question means folding events first.</p><p><strong>Claim.</strong> The event store is difficult to query because typical queries must reconstruct state, which is complex and inefficient — so reads are moved to CQRS, and the system must handle eventually consistent data.</p><p><strong>Grounding.</strong> The resulting context lists the difficult-to-query store as a drawback that forces CQRS and eventual consistency.</p><p><strong>In the wild.</strong> A read of a Customer means replaying its events unless a snapshot shortens the work.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'A new programming style with real benefits', content: '<p><strong>Why.</strong> The team trades a familiar pattern for capabilities that are hard to get any other way.</p><p><strong>Claim.</strong> Event sourcing is an unfamiliar style with a learning curve, but it reliably publishes events on every state change, avoids object-relational impedance mismatch, gives a 100% reliable audit log, and enables temporal queries of state at any point in time.</p><p><strong>Grounding.</strong> The resulting context enumerates the learning curve as a drawback and the audit-log and temporal-query abilities as benefits.</p><p><strong>In the wild.</strong> Event-sourced services exchange events loosely, which the book says eases migration from a monolith to microservices.</p>' }
    ]
  },
  quiz: [
    { "question": "Event sourcing persists an entity's state as what?", "options": ["A. A single current-state row", "B. A sequence of state-changing events", "C. A snapshot only", "D. A set of database triggers"], "answer": 2, "explanation": "The pattern stores a business entity as a sequence of events, appending a new one each time state changes; A is the traditional approach it replaces, and C is only an optimization layered on top.", "conceptRef": "Persist state as a sequence of events" },
    { "question": "Why is saving an event inherently atomic?", "options": ["A. It uses a 2PC distributed transaction", "B. It enlists the message broker in the transaction", "C. It applies a compensating saga", "D. Saving a single event is a single operation"], "answer": 4, "explanation": "One append is one write, so the state change and its publishable event cannot split; A and B describe the 2PC approach the pattern explicitly rejects.", "conceptRef": "Updating the database and publishing events is not atomic" },
    { "question": "How does an application reconstruct an entity's current state?", "options": ["A. By querying the latest row", "B. By reading only the newest snapshot", "C. By replaying the sequence of events", "D. By asking the message broker"], "answer": 3, "explanation": "Current state is rebuilt by folding the events in order; a snapshot only reduces how many events must be replayed, so B is incomplete.", "conceptRef": "Persist state as a sequence of events" },
    { "question": "What does the event store also behave like?", "options": ["A. A message broker", "B. A cache", "C. A load balancer", "D. A relational view"], "answer": 1, "explanation": "The store delivers each saved event to interested subscribers, so it plays the broker's role in publishing events on state change.", "conceptRef": "Persist state as a sequence of events" }
  ]
});
