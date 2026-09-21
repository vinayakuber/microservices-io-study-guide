registerChapter({
  id: 'ch05',
  num: 5,
  title: 'Messaging',
  pattern: 'Asynchronous inter-service communication where services exchange messages over messaging channels.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 5 · microservices.io /patterns/communication-style/messaging.html',
  part: 2,
  flow: [
    {
      section: 'Publish over a messaging channel',
      color: 'orange',
      motivation: `Synchronous calls tie the caller to the callee; sending an event over a channel decouples the two so the sender never waits.`,
      steps: [
        { num: 1, title: 'Exchange messages over channels', detail: 'A sender writes a message to a channel and a consumer reads it later; the two never run at the same instant.' },
        { num: 2, title: 'Publish the domain event', detail: 'OrderService publishes an <strong>Order Created</strong> event when it creates an Order, as in the FTGO example.' },
        { num: 3, title: 'Send and forget', detail: 'A notification expects no reply and none is sent, so the sender returns immediately.' }
      ],
      program: `// ORDER SERVICE SIDE — publish an Order Created event to a channel; the consumer reads it later
// PARTIES: SVC = Order Service · BRK = message broker · CON = Kitchen consumer
// STATE (before):
//    orders : {}
//    channel : []
//    kitchen : {}
// DEF: create_order · CALLED BY: U1 placing an order (FTGO OrderService)
// -> order_id : "PO-2001" · -> event : "OrderCreated"
//    step 1 · SVC writes the order locally      : orders : {} -> { "PO-2001": { status: "CREATED" } }
//    step 2 · SVC publishes the event to BRK    : channel : [] -> [ "OrderCreated(PO-2001)" ]
//    step 3 · SVC returns immediately           : reply : "NONE"  BECAUSE a notification sends no reply
// <- event : "OrderCreated(PO-2001)" sits in the channel, waiting for CON
//
// DEF: consume · CALLED BY: CON polling BRK whenever it is ready
// -> poll : channel = [ "OrderCreated(PO-2001)" ]
//    step 1 · CON receives the message          : channel : [ "OrderCreated(PO-2001)" ] -> []
//    step 2 · CON starts cooking the order      : kitchen : {} -> { "PO-2001": "COOKING" }
// <- message : "OrderCreated(PO-2001)" consumed · SVC and CON never run at the same instant`
    },
    {
      section: 'Request/response style',
      color: 'orange',
      motivation: `Sometimes a caller needs an answer now; the request/response style sends a request and expects a prompt reply.`,
      steps: [
        { num: 1, title: 'Send a request message', detail: 'A service sends a request to a recipient and waits for a reply.' },
        { num: 2, title: 'Correlate the reply', detail: 'A <strong>reply-to</strong> channel and a correlation id tie the reply back to its request.' },
        { num: 3, title: 'Expect a prompt reply', detail: 'The reply is expected promptly, unlike the eventual reply of request/asynchronous response.' }
      ],
      program: `// CONSUMER SERVICE SIDE — request/response: send a request, expect a prompt reply over a channel
// PARTIES: CLIENT = Consumer · BRK = message broker · SVC = Provider service
// DEF: channel — a named conduit through which messages flow from sender to receiver; here the reply_to channel "reply_channel" carried "REQ-77:42.50"
// DEF: reply — the answer the provider returns to the caller over the reply channel; here "42.50" for request "REQ-77"
// STATE (before):
//    request_channel : []
//    reply_channel : []
// DEF: request_price · CALLED BY: CLIENT needing a price now
// -> request : { id: "REQ-77", reply_to: "reply_channel", body: "get price" }
//    step 1 · CLIENT sends the request to BRK   : request_channel : [] -> [ "REQ-77:get price" ]
//    step 2 · SVC receives and processes it     : request_channel : [ "REQ-77:get price" ] -> []
//    step 3 · SVC replies on the reply channel  : reply_channel : [] -> [ "REQ-77:42.50" ]
//    step 4 · CLIENT reads its reply            : reply_channel : [ "REQ-77:42.50" ] -> []
// <- reply : "42.50" delivered to CLIENT · id "REQ-77" matches the request
//    alt no reply : CLIENT keeps waiting  BECAUSE both sides must be available for the duration`
    },
    {
      section: 'Publish/subscribe style',
      color: 'orange',
      motivation: `One event often matters to several services; publish/subscribe fans a message out to zero or more recipients.`,
      steps: [
        { num: 1, title: 'Publish to a topic', detail: 'A publisher writes a message to a topic and knows nothing of its recipients.' },
        { num: 2, title: 'Broker fans out', detail: 'The broker delivers a copy to each subscriber.' },
        { num: 3, title: 'Zero or more recipients', detail: 'With no subscribers the message goes nowhere; with several, each gets a copy.' }
      ],
      program: `// BROKER SIDE — publish/subscribe: one publisher, two subscribers (zero or more recipients)
// PARTIES: PUB = Order Service · BRK = message broker · SUB1 = Billing · SUB2 = Kitchen
// DEF: inbox — a per-subscriber mailbox the broker delivers one copy into; here inbox_billing and inbox_kitchen each receive "OrderCreated(PO-2001)"
// STATE (before):
//    topic : { "orders": [] }
//    inbox_billing : []
//    inbox_kitchen : []
// DEF: publish_order_created · CALLED BY: PUB after an order is created
// -> event : "OrderCreated(PO-2001)"
//    step 1 · PUB publishes once to the topic   : topic["orders"] : [] -> [ "OrderCreated(PO-2001)" ]
//    step 2 · BRK fans out to the first reader  : inbox_billing : [] -> [ "OrderCreated(PO-2001)" ]
//    step 3 · BRK copies to the second reader   : inbox_kitchen : [] -> [ "OrderCreated(PO-2001)" ]
//    step 4 · the topic drains after fan-out    : topic["orders"] : [ "OrderCreated(PO-2001)" ] -> []
// <- delivery : 2 copies of "OrderCreated(PO-2001)" · zero subscribers would mean 0 copies
//    alt reader down : BRK holds its copy  BECAUSE the broker buffers per subscriber`
    },
    {
      section: 'Availability through buffering',
      color: 'orange',
      motivation: `The broker holds messages until a consumer can process them, buying availability at the cost of running a broker.`,
      steps: [
        { num: 1, title: 'Buffer while the consumer is down', detail: 'The broker keeps messages queued until the consumer is able to process them.' },
        { num: 2, title: 'Loose runtime coupling', detail: 'The sender is decoupled from the consumer, so neither blocks the other.' },
        { num: 3, title: 'Pay the broker tax', detail: 'A broker adds complexity and must itself be highly available; request/reply over messaging is more complex.' },
        { num: 4, title: 'Compose with outbox, saga, CQRS', detail: 'The Transactional Outbox sends messages inside a database transaction; Saga and CQRS build on messaging.' }
      ],
      program: `// BROKER SIDE — buffering buys availability: consumer down, broker holds the queue until it returns
// PARTIES: BRK = message broker · SVC = Order Service (publisher) · CON = Consumer
// STATE (before):
//    queue : []
//    con_status : "UP"
// DEF: publish_while_down · CALLED BY: SVC publishing 5 orders while CON is down
// -> count : 5
//    step 1 · CON goes down                     : con_status : "UP" -> "DOWN"
//    step 2 · SVC publishes order 1             : queue : [] -> [ 1 ]
//    step 3 · SVC publishes orders 2 to 5       : queue : [ 1 ] -> [ 1, 2, 3, 4, 5 ]
//    step 4 · SVC is not blocked                BECAUSE the broker buffers messages until the consumer can process them
// <- queue : [ 1, 2, 3, 4, 5 ] held while con_status stays "DOWN"
//
// DEF: drain_on_reconnect · CALLED BY: CON reconnecting
// -> reconnect : "true"
//    step 1 · CON comes back up                 : con_status : "DOWN" -> "UP"
//    step 2 · CON drains the queue              : queue : [ 1, 2, 3, 4, 5 ] -> []
// <- delivery : 5 messages delivered after reconnect · availability bought with the cost of running a broker`
    }
  ],
  interview: [
    {
      scenario: "A customer cancels an order. The Order Service must tell downstream services without waiting for any of them to act.",
      q: "How does the notification style of messaging let a service announce an event and return immediately?",
      solution: "A notification is a message that expects no reply, so the sender publishes it to a channel and returns at once; a consumer reads it later.",
      components: ["Sender service", "Message channel", "Consumer (reads later)", "No reply expected"],
      diagram: `flowchart LR
  SVC["Order Service"] --> BRK["channel"]
  BRK --> CON["Refund consumer"]
  SVC -. "returns immediately" .-> SVC`,
      code: `// ORDER SERVICE SIDE — publish an OrderCancelled event to a channel; the consumer reads it later
// PARTIES: SVC = Order Service · BRK = message broker · CON = Refund consumer
// STATE (before):
//    orders : {}
//    channel : []
//    refunds : {}
// DEF: cancel_order · CALLED BY: U1 cancelling an order (a notification expects no reply)
// -> order_id : "PO-7703" · -> event : "OrderCancelled"
//    step 1 · SVC marks the order cancelled locally : orders : {} -> { "PO-7703": { status: "CANCELLED" } }
//    step 2 · SVC publishes the event to BRK : channel : [] -> [ "OrderCancelled(PO-7703)" ]
//    step 3 · SVC returns immediately : reply : "NONE"   BECAUSE a notification sends no reply
// <- event : "OrderCancelled(PO-7703)" sits in the channel, waiting for CON
//
// DEF: consume · CALLED BY: CON polling BRK whenever it is ready
// -> poll : channel = [ "OrderCancelled(PO-7703)" ]
//    step 1 · CON receives the message : channel : [ "OrderCancelled(PO-7703)" ] -> []
//    step 2 · CON starts the refund : refunds : {} -> { "PO-7703": "REFUNDING" }
// <- message : "OrderCancelled(PO-7703)" consumed · SVC and CON never run at the same instant`,
      tieback: "This is exactly the send-and-forget notification style over a messaging channel in this chapter.",
      refs: ["Publish over a messaging channel"],
      problems: ["19-distributed-message-queue", "10-notification-system"]
    },
    {
      scenario: "A checkout flow needs the current item availability before it quotes a price, so a fire-and-forget message is not enough.",
      q: "How does the request/response style get a prompt answer over a channel, and how is the reply matched to its request?",
      solution: "The sender sends a request with a reply-to channel and a correlation id, and the provider replies on that channel, so the reply is matched to the request.",
      components: ["Request message", "Reply-to channel", "Correlation id", "Prompt reply"],
      diagram: `flowchart LR
  C["Checkout"] --> RQ["request channel"]
  RQ --> P["Inventory service"]
  P --> RP["reply-to channel"]
  RP --> C`,
      code: `// CONSUMER SERVICE SIDE — request/response: send a request, expect a prompt reply over a channel
// PARTIES: CLIENT = Checkout · BRK = message broker · SVC = Inventory service
// DEF: channel — a named conduit through which messages flow; here the reply_to channel "reply_channel" carried "REQ-91:yes 18.75"
// DEF: reply — the answer the provider returns over the reply channel; here "yes 18.75" for request "REQ-91"
// STATE (before):
//    request_channel : []
//    reply_channel : []
// DEF: check_availability · CALLED BY: CLIENT needing availability now
// -> request : { id: "REQ-91", reply_to: "reply_channel", body: "check availability" }
//    step 1 · CLIENT sends the request to BRK : request_channel : [] -> [ "REQ-91:check availability" ]
//    step 2 · SVC receives and processes it : request_channel : [ "REQ-91:check availability" ] -> []
//    step 3 · SVC replies on the reply channel : reply_channel : [] -> [ "REQ-91:yes 18.75" ]
//    step 4 · CLIENT reads its reply : reply_channel : [ "REQ-91:yes 18.75" ] -> []
// <- reply : "yes 18.75" delivered to CLIENT · id "REQ-91" matches the request
//    alt no reply : CLIENT keeps waiting  BECAUSE both sides must be available for the duration`,
      tieback: "This is exactly the request/response style with its reply-to channel and correlation id in this chapter.",
      refs: ["Request/response style"],
      problems: ["19-distributed-message-queue", "10-notification-system"]
    },
    {
      scenario: "A payment succeeds, and three services — billing, shipping, and loyalty — all need to react, without the payment service knowing any of them.",
      q: "How does the publish/subscribe style fan one event out to several recipients?",
      solution: "A publisher writes a message to a topic and knows nothing of its recipients; the broker delivers a copy to each subscriber (zero or more).",
      components: ["Publisher", "Topic", "Broker fan-out", "Multiple subscribers"],
      diagram: `flowchart LR
  PUB["Payment service"] --> TOP["topic: payments"]
  TOP --> B["Billing"]
  TOP --> S["Shipping"]
  TOP --> L["Loyalty"]`,
      code: `// BROKER SIDE — publish/subscribe: one publisher, three subscribers (zero or more recipients)
// PARTIES: PUB = Payment service · BRK = message broker · SUB1 = Billing · SUB2 = Shipping · SUB3 = Loyalty
// DEF: inbox — a per-subscriber mailbox the broker delivers one copy into; here inbox_billing, inbox_shipping, and inbox_loyalty each receive "PaymentProcessed(PAY-311)"
// STATE (before):
//    topic : { "payments": [] }
//    inbox_billing : []
//    inbox_shipping : []
//    inbox_loyalty : []
// DEF: publish_payment_processed · CALLED BY: PUB after a payment is captured
// -> event : "PaymentProcessed(PAY-311)"
//    step 1 · PUB publishes once to the topic : topic["payments"] : [] -> [ "PaymentProcessed(PAY-311)" ]
//    step 2 · BRK fans out to the first subscriber : inbox_billing : [] -> [ "PaymentProcessed(PAY-311)" ]
//    step 3 · BRK copies to the second subscriber : inbox_shipping : [] -> [ "PaymentProcessed(PAY-311)" ]
//    step 4 · BRK copies to the third subscriber : inbox_loyalty : [] -> [ "PaymentProcessed(PAY-311)" ]
//    step 5 · the topic drains after fan-out : topic["payments"] : [ "PaymentProcessed(PAY-311)" ] -> []
// <- delivery : 3 copies of "PaymentProcessed(PAY-311)" · zero subscribers would mean 0 copies
//    alt a subscriber is down : BRK holds its copy  BECAUSE the broker buffers per subscriber`,
      tieback: "This is exactly the publish/subscribe fan-out with zero-or-more recipients in this chapter.",
      refs: ["Publish/subscribe style"],
      problems: ["19-distributed-message-queue", "10-notification-system"]
    },
    {
      scenario: "The notification consumer is down for maintenance, but orders keep arriving. The team wants to know what happens to those messages.",
      q: "How does messaging buy availability through buffering, and what does that buffering cost?",
      solution: "The broker keeps messages queued until the consumer can process them, decoupling sender from consumer, at the cost of running a highly available broker.",
      components: ["Message broker buffer", "Down consumer", "Loose runtime coupling", "Broker complexity"],
      diagram: `flowchart LR
  SVC["Order Service"] --> Q["broker queue"]
  Q -. "held while down" .-> CON["Consumer (DOWN)"]
  Q --> R["replays on reconnect"]`,
      code: `// BROKER SIDE — buffering buys availability: consumer down, broker holds the queue until it returns
// PARTIES: BRK = message broker · SVC = Order Service (publisher) · CON = Consumer
// STATE (before):
//    queue : []
//    con_status : "UP"
// DEF: publish_while_down · CALLED BY: SVC publishing 12 orders while CON is down
// -> count : 12
//    step 1 · CON goes down : con_status : "UP" -> "DOWN"
//    step 2 · SVC publishes order 1 : queue : [] -> [ 1 ]
//    step 3 · SVC publishes orders 2 to 12 : queue : [ 1 ] -> [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 ]
//    step 4 · SVC is not blocked   BECAUSE the broker buffers messages until the consumer can process them
// <- queue : [ 1 .. 12 ] held while con_status stays "DOWN"
//
// DEF: drain_on_reconnect · CALLED BY: CON reconnecting
// -> reconnect : "true"
//    step 1 · CON comes back up : con_status : "DOWN" -> "UP"
//    step 2 · CON drains the queue : queue : [ 1 .. 12 ] -> []
// <- delivery : 12 messages delivered after reconnect · availability bought with the cost of running a broker`,
      tieback: "This is exactly the buffering-for-availability benefit and the broker tax in this chapter.",
      refs: ["Availability through buffering"],
      problems: ["19-distributed-message-queue", "10-notification-system"]
    }
  ],
  systemDesign: {
    question: 'Design asynchronous communication between services. Premise: a sender builds a message and sends it through a RabbitMQ channel, and a receiver consumes it, so the two services never block on each other.',
    pipeline: 'sender/producer → message channel (broker) → receiver/consumer',
    decomposition: [
      {
        box: 'the sender — e.g. Order Service',
        role: 'writer (producer)',
        parts: [
          'builds the message — OrderCreated(PO-2001)',
          'sends it to the channel and returns at once'
        ]
      },
      {
        box: 'the message channel — the broker',
        role: 'transport',
        parts: [
          'RabbitMQ broker holding the queue',
          'buffers messages until the consumer is ready'
        ]
      },
      {
        box: 'the receiver — e.g. Kitchen consumer',
        role: 'reader (consumer)',
        parts: [
          'subscribes to the channel',
          'handles each message — starts cooking'
        ]
      }
    ],
    wiring: "flowchart LR\n  PUB[\"sender: Order Service\"] -->|\"publish message\"| BRK[\"transport: RabbitMQ queue orders\"]\n  BRK -->|\"deliver copy\"| CON[\"receiver: Kitchen consumer\"]",
    program: `// SYSTEM DESIGN — messaging as a pipeline: sender/producer (builds the message, sends it) -> transport (RabbitMQ channel) -> receiver/consumer (subscribes, handles the message)
// PARTIES: PUB = Order Service (producer/writer: builds the message and publishes it) · BRK = RabbitMQ broker (transport: the message channel) · CON = Kitchen consumer (reader: subscribes and handles messages)
// DEF: message — the payload a sender writes to a channel; here "OrderCreated(PO-2001)"
// DEF: channel — the named conduit through which messages flow from sender to receiver; here the RabbitMQ queue "orders"
// DEF: inbox — a consumer's subscription mailbox the broker delivers one copy into; here "kitchen_inbox"
// STATE (before):
//    channel : []   // the RabbitMQ queue "orders" (transport)
//    inbox   : []   // CON's subscription mailbox
// DEF: publish_consume · CALLED BY: PUB after creating order "PO-2001"
// -> order_id : "PO-2001" · -> event : "OrderCreated"
//    step 1 · PUB builds the message    message : "none" -> "OrderCreated(PO-2001)"
//    step 2 · PUB publishes to the channel    channel : [] -> [ "OrderCreated(PO-2001)" ]
//    step 3 · BRK delivers a copy to CON's inbox    inbox : [] -> [ "OrderCreated(PO-2001)" ]
//    step 4 · CON consumes and handles it    kitchen : {} -> { "PO-2001": "COOKING" }   BECAUSE the receiver reads the channel and handles the message
// <- outcome : CON handled "OrderCreated(PO-2001)" · PUB returned at once, no reply   BECAUSE sender and receiver never run at the same instant`
  },
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Tight runtime coupling', content: '<p><strong>Why.</strong> Synchronous calls force the caller and the callee to be alive for the whole request, so one slow or dead service stalls every service that calls it.</p><p><strong>Claim.</strong> Synchronous communication results in tight runtime coupling.</p><p><strong>Grounding.</strong> The reference lists it as a force: both the client and service must be available for the duration of the request.</p><p><strong>In the wild.</strong> A REST call chain where an outage in the last hop blocks the first hop and cascades upstream.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Messaging over channels', content: '<p><strong>Why.</strong> The sender should hand off work without waiting for the receiver.</p><p><strong>Claim.</strong> Services communicate by exchanging messages over messaging channels, asynchronously.</p><p><strong>Grounding.</strong> The solution: use asynchronous messaging; services exchange messages over channels, as with Kafka or RabbitMQ.</p><p><strong>In the wild.</strong> FTGO OrderService publishes an Order Created event when it creates an Order.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Loose coupling and availability', content: '<p><strong>Why.</strong> Asynchrony should buy resilience, not just style.</p><p><strong>Claim.</strong> Messaging decouples the sender from the consumer and improves availability because the broker buffers messages until the consumer can process them.</p><p><strong>Grounding.</strong> The resulting context lists loose runtime coupling and improved availability as benefits.</p><p><strong>In the wild.</strong> A consumer that is down misses nothing: the broker holds the queue and delivers when it returns.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Broker complexity', content: '<p><strong>Why.</strong> A buffer in the middle is a new system to run.</p><p><strong>Claim.</strong> Messaging adds the complexity of a message broker, which must itself be highly available, and request/reply over messaging is more complex.</p><p><strong>Grounding.</strong> The resulting context lists broker complexity as a drawback and more-complex request/reply as an issue.</p><p><strong>In the wild.</strong> A broker outage now takes down every pair of services that communicate through it.</p>' }
    ]
  },
  quiz: [
    { "question": "How do services communicate in the Messaging pattern?", "options": ["A. Synchronous HTTP calls between services", "B. By exchanging messages over messaging channels", "C. By writing to a shared database", "D. By remote procedure invocation"], "answer": 2, "explanation": "Messaging is asynchronous: services exchange messages over channels. Synchronous HTTP (A) and RPI (D) are the RPI pattern, and a shared database (C) is not an inter-process protocol.", "conceptRef": "Messaging over channels" },
    { "question": "Which style expects a reply promptly?", "options": ["A. Notifications", "B. Publish/subscribe", "C. Request/response", "D. Request/asynchronous response"], "answer": 3, "explanation": "Request/response expects a prompt reply. Request/asynchronous response (D) expects the reply only eventually; notifications (A) expect no reply at all; publish/subscribe (B) sends to zero or more recipients.", "conceptRef": "Messaging over channels" },
    { "question": "Why does messaging improve availability?", "options": ["A. The broker buffers messages until the consumer can process them", "B. The client and service must both be available", "C. It removes the need for a broker", "D. It only supports request/reply"], "answer": 1, "explanation": "The broker holds messages while the consumer is down. Options B and D describe RPI drawbacks, and C contradicts messaging, which requires a broker.", "conceptRef": "Loose coupling and availability" },
    { "question": "Which related pattern sends messages as part of a database transaction?", "options": ["A. Saga", "B. CQRS", "C. Transactional Outbox", "D. Domain-specific protocol"], "answer": 3, "explanation": "The Transactional Outbox sends messages inside a database transaction. Saga (A) and CQRS (B) use messaging but are not the transactional-send mechanism; the Domain-specific protocol (D) is an alternative to messaging.", "conceptRef": "Messaging over channels" }
  ]
});
