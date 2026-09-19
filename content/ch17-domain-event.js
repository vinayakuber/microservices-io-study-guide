registerChapter({
  id: 'ch17',
  num: 17,
  title: 'Domain Event',
  pattern: 'Organize the business logic of a service as a collection of DDD aggregates that emit domain events when created or updated, and publish those events for other services to consume.',
  aka: 'Chris Richardson · Microservice Patterns Ch.17 (p.160) · microservices.io /patterns/data/domain-event.html',
  part: 4,
  flow: [
    {
      section: 'The need: publish when data changes',
      color: 'orange',
      motivation: `A service often needs to publish events when it updates its data — to keep a CQRS view fresh or to participate in a choreography-based saga. Without a publish step, an update is invisible to the consumers that need it.`,
      steps: [
        { num: 1, title: 'Data changes silently', detail: 'A service updates its own data, but the update is local to that service.' },
        { num: 2, title: 'Consumers need to know', detail: 'Events may be needed to update a CQRS view or to coordinate a choreography-based saga.' },
        { num: 3, title: 'The open question', detail: 'How does a service publish an event when it updates its data?' }
      ],
      program: `// ORDER SERVICE SIDE — the problem the pattern solves: data changes, but the consumers that need to know are never told
// PARTIES: SVC = Order Service (writes) · VIEW = a CQRS read model · SAGA = a choreography-based saga coordinated via events
// STATE (before):
//    order : { id:"PO-2001", state:"NEW" }
//    view : { placed_count : 0 }
//    saga : { next_step : "none" }
// DEF: place_order_without_publish · CALLED BY: SVC
// -> command : "place_order"
//    step 1 · SVC writes its own data locally   // order.state : "NEW" -> "PLACED"
//    step 2 · the CQRS view is not notified and stays stale   // view.placed_count : 0 -> 0
//    step 3 · the saga is not triggered and never advances   // saga.next_step : "none" -> "none"
// <- outcome : order.state : "PLACED" · but every consumer still sees the old state, so the service needs a way to publish events when it updates data`
    },
    {
      section: 'Aggregates emit domain events',
      color: 'orange',
      motivation: `The solution puts the event at the source of the change: DDD aggregates emit a domain event when they are created or updated, and the service publishes it so other services can consume it.`,
      steps: [
        { num: 1, title: 'Aggregates hold the business logic', detail: 'The business logic of a service is organized as a collection of DDD aggregates.' },
        { num: 2, title: 'Emit on create or update', detail: 'An aggregate emits a domain event when it is created or updated.' },
        { num: 3, title: 'Publish for consumers', detail: 'The service publishes the domain events so they can be consumed by other services.' }
      ],
      program: `// ORDER SERVICE SIDE — an aggregate emits a domain event when it changes, and a consumer reacts to it
// PARTIES: AG = Order aggregate (in Order Service) · BRK = message broker · CSVC = the consuming service (a CQRS view updater)
// STATE (before):
//    order : { id:"PO-2001", state:"NEW" }
//    events : []            // domain events the aggregate has emitted
//    view : { order_count : 0 }   // a CQRS read model owned by the consumer
// DEF: place_order · CALLED BY: the service on the aggregate
// -> command : "place_order"
//    step 1 · aggregate changes state   // order.state : "NEW" -> "PLACED"
//    step 2 · aggregate emits an event   // events : [] -> [{type:"OrderPlaced", order_id:"PO-2001"}]
//    step 3 · service publishes "OrderPlaced" to BRK (via transactional outbox, same database transaction)
// <- output : event "OrderPlaced" { order_id:"PO-2001" } published
// DEF: consume · CALLED BY: the consumer's event handler when BRK delivers "OrderPlaced"
// -> event : { type:"OrderPlaced", order_id:"PO-2001" }
//    step 1 · handler updates the read model   // view : { order_count : 0 } -> { order_count : 1 }  BECAUSE one more order was placed
// <- outcome : view.order_count : 1 · the CQRS view now reflects the aggregate's change, without the consumer calling the aggregate`
    },
    {
      section: 'Publish atomically with the data change',
      color: 'orange',
      motivation: `Publishing must not lose the event or emit it for a change that rolled back. Because a service cannot enlist both its database and the broker in one distributed transaction, it uses the Transactional Outbox to write the event in the same transaction as the data.`,
      steps: [
        { num: 1, title: 'No distributed transaction', detail: 'A service cannot span one transaction across its database and the message broker.' },
        { num: 2, title: 'Write the event in-transaction', detail: 'The Transactional Outbox stores the event in the same local transaction as the data update.' },
        { num: 3, title: 'Relay publishes later', detail: 'A separate process publishes the outbox rows to the broker after the commit.' }
      ],
      program: `// ORDER SERVICE SIDE — publishing reliably: the event is written to the outbox in the SAME transaction as the data change
// PARTIES: SVC = Order Service · DB = its database · BRK = the message broker
// STATE (before):
//    order : { id:"PO-2001", state:"NEW" }
//    outbox : []
// DEF: place_order_and_publish · CALLED BY: SVC
// -> command : "place_order"
//    step 1 · begin one local transaction on DB (the broker is NOT enlisted — no distributed transaction)
//    step 2 · update the data   // order.state : "NEW" -> "PLACED"
//    step 3 · write the event to the outbox in the same transaction   // outbox : [] -> [{event:"OrderPlaced", order_id:"PO-2001"}]
//    step 4 · COMMIT -> both rows durable or neither, so the event cannot be lost or published for a rolled-back change
//    step 5 · a relay later polls the outbox and marks the row sent   // outbox : [{event:"OrderPlaced",sent:false}] -> [{event:"OrderPlaced",sent:true}]
// <- outcome : event "OrderPlaced" published to BRK, atomically coupled to the data update`
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'A service changes data, but others need to know', content: '<p><strong>Why.</strong> A service often needs to publish events when it updates its data.</p><p><strong>Claim.</strong> Those events might be needed to update a CQRS view, or to let the service participate in a choreography-based saga that uses events for coordination.</p><p><strong>Grounding.</strong> Without a publish step, an update stays local and the consumers never learn of it.</p><p><strong>In the wild.</strong> A placed order that a read model must count, or a saga step that the next service must run.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Aggregates emit events on create or update', content: '<p><strong>Why.</strong> The aggregate is the unit that changes, so it is the natural place to record the change.</p><p><strong>Claim.</strong> Organize the business logic of a service as a collection of DDD aggregates that emit domain events when they are created or updated.</p><p><strong>Grounding.</strong> The service publishes these domain events so that they can be consumed by other services.</p><p><strong>In the wild.</strong> The Order aggregate emits OrderPlaced, and the service publishes it.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Events are asynchronous and eventually consistent', content: '<p><strong>Why.</strong> A consumer reacts to a published event later, not inside the write.</p><p><strong>Claim.</strong> The read side catches up asynchronously, so a CQRS view is briefly stale after the event is emitted.</p><p><strong>Grounding.</strong> The event is published so other services can consume it — consumption is decoupled from the update.</p><p><strong>In the wild.</strong> A view updated by a consumer shows the new count only after the event is delivered.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Publishing must be atomic with the change', content: '<p><strong>Why.</strong> An event emitted for a rolled-back change is a lie, and a lost event breaks the consumers.</p><p><strong>Claim.</strong> A service cannot enlist both its database and the broker in one distributed transaction, so it must use the Transactional Outbox to publish events as part of the database transaction.</p><p><strong>Grounding.</strong> Event sourcing is sometimes used instead to publish domain events.</p><p><strong>In the wild.</strong> The outbox row is written in the same transaction as the order update, then relayed to the broker.</p>' }
    ]
  },
  quiz: [
    { "question": "When does a service need to publish events?", "options": ["A. Only when it shuts down", "B. When it updates its data", "C. Only during deployment", "D. When it has no consumers"], "answer": 2, "explanation": "A service often needs to publish events when it updates its data, for example to update a CQRS view or coordinate a saga. The other options are not the trigger for publishing.", "conceptRef": "A service changes data, but others need to know" },
    { "question": "What emits the domain events?", "options": ["A. DDD aggregates, when they are created or updated", "B. The message broker", "C. The API gateway", "D. The database schema"], "answer": 1, "explanation": "DDD aggregates emit domain events when they are created or updated; the service then publishes them. The broker only carries the events, and the gateway and schema do not emit domain events.", "conceptRef": "Aggregates emit events on create or update" },
    { "question": "Which patterns create the need for the Domain Event pattern?", "options": ["A. Saga and CQRS", "B. Service mesh and sidecar", "C. Health check and audit logging", "D. Circuit breaker and access token"], "answer": 1, "explanation": "The Saga and CQRS patterns create the need for domain events: CQRS needs events to update views, and a choreography-based saga uses events for coordination. The others do not require domain events.", "conceptRef": "A service changes data, but others need to know" },
    { "question": "Which pattern publishes events as part of a database transaction?", "options": ["A. Transactional Outbox", "B. Client-side discovery", "C. Self-registration", "D. Serverless deployment"], "answer": 1, "explanation": "The Transactional Outbox pattern publishes events as part of the database transaction, so the event and the data change commit or roll back together. The others are unrelated to event publishing.", "conceptRef": "Publishing must be atomic with the change" }
  ]
});
