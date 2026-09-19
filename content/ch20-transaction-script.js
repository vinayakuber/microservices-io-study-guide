registerChapter({
  id: 'ch20',
  num: 20,
  title: 'Transaction Script',
  pattern: 'Organize the business logic as a collection of procedural transaction scripts, one for each type of request.',
  aka: 'Chris Richardson · Microservice Patterns Ch.5 · microservices.io /patterns/decomposition/transaction-script.html',
  part: 4,
  flow: [
    {
      section: 'One procedural method per request type',
      color: 'orange',
      motivation: `When the logic is simple, an object model is overkill; a plain method per request is easier to read and write. The script pulls the request's data into an object and hands it to the database.`,
      steps: [
        { num: 1, title: 'Map each request to a method', detail: 'A service class exposes one method per system operation — createOrder(), reviseOrder(), cancelOrder().' },
        { num: 2, title: 'Build a pure data object', detail: 'The script fills an Order (orderId, orderLineItems) that has no behavior.' },
        { num: 3, title: 'Reach the database through a DAO', detail: 'OrderDao exposes save(Order) and findOrderById(), keeping SQL out of the script.' }
      ],
      program: `// TRANSACTION SCRIPT SIDE — one procedural method per request; the script moves data, it does not own it
// PARTIES: SVC = OrderService (holds the scripts, no state) · DAO = OrderDao (data access) · DB = the database
// STATE (before):
//    orders : {}                        // the data store, empty — Order is a pure data object
// DEF: createOrder · CALLED BY: the presentation tier issuing a POST /orders request
// -> orderId : "PO-100" · -> lineItems : [{sku:"S1", qty:2, unit:25.00}]
//    step 1 · allocate the data object : order : null -> { orderId:null, lineItems:[] }   BECAUSE the script builds an Order (pure data) from the request
//    step 2 · fill from the request : order.orderId : null -> "PO-100" · order.lineItems : [] -> [{sku:"S1",qty:2,unit:25.00}]
//    step 3 · hand off to the DAO : DAO.save(order)     // save(Order) is data access, not business logic
//    step 4 · persist : orders : {} -> { "PO-100": { orderId:"PO-100", lineItems:[{sku:"S1",qty:2,unit:25.00}] } }
// <- order : { orderId:"PO-100", lineItems:[{sku:"S1",qty:2,unit:25.00}] } · saved to DB`
    },
    {
      section: 'Keep behavior and state in separate classes',
      color: 'orange',
      motivation: `The signature of the pattern is that the classes implementing behavior are separate from those storing state. That split is what makes the style read like plain procedural C, for better and for worse.`,
      steps: [
        { num: 1, title: 'Service classes hold the scripts', detail: 'OrderService has methods and no meaningful state.' },
        { num: 2, title: 'Data classes hold the state', detail: 'Order holds orderId and orderLineItems and little or no behavior.' },
        { num: 3, title: 'The script does all mutation', detail: 'A change to a field is written by the script, never by the data object itself.' }
      ],
      program: `// TRANSACTION SCRIPT SIDE — the script mutates a data object; the object never mutates itself
// PARTIES: SVC = OrderService (behavior, stateless) · DAO = OrderDao (find + save) · DB = the database
// STATE (before):
//    orders : { "PO-100": { orderId:"PO-100", lineItems:[{sku:"S1",qty:2,unit:25.00}] } }
// DEF: reviseOrder · CALLED BY: the presentation tier issuing a revise request
// -> orderId : "PO-100" · -> newQty : 5
//    step 1 · load : order : null -> { orderId:"PO-100", lineItems:[{sku:"S1",qty:2,unit:25.00}] }   BECAUSE DAO.findOrderById returns the stored data object
//    step 2 · the SCRIPT mutates a field : order.lineItems[0].qty : 2 -> 5   BECAUSE the change is written by the script, not by the Order
//    step 3 · persist : orders : { "PO-100": {...,qty:2,...} } -> { "PO-100": {...,qty:5,...} }   BECAUSE DAO.save writes the object back
// <- order : { orderId:"PO-100", lineItems:[{sku:"S1",qty:5,unit:25.00}] }`
    },
    {
      section: 'Use scripts for simple logic only',
      color: 'orange',
      motivation: `The procedural style is seductive because you skip class design, and that is fine while the rules are few. The same method that reads cleanly for simple logic becomes a nightmare as the rules multiply.`,
      steps: [
        { num: 1, title: 'Accept the style when logic is simple', detail: 'Do not be ashamed of procedural code where it is appropriate.' },
        { num: 2, title: 'Watch for sprawl', detail: 'Each new rule is another branch inside the same script, so it grows with the logic.' },
        { num: 3, title: 'Switch when complexity arrives', detail: 'For complex logic, move to the Domain model before the script becomes unmaintainable.' }
      ],
      program: `// TRANSACTION SCRIPT SIDE — simple logic reads top-to-bottom; the same method sprawls when the rules multiply
// PARTIES: SVC = OrderService (the script) · DAO = OrderDao (data access)
// STATE (before):
//    orders : { "PO-100": { orderId:"PO-100", status:"CREATED", lineItems:[{sku:"S1",qty:2,unit:25.00}] } }
// DEF: cancelOrder · CALLED BY: the presentation tier issuing a cancel request
// -> orderId : "PO-100"
//    step 1 · load : order : null -> { orderId:"PO-100", status:"CREATED", lineItems:[{sku:"S1",qty:2,unit:25.00}] }
//    step 2 · evaluate the rule : cancellable : false -> true   BECAUSE status "CREATED" is cancellable
//    step 3 · set the field : order.status : "CREATED" -> "CANCELLED"
//    step 4 · persist : orders : { "PO-100": {...,status:"CREATED",...} } -> { "PO-100": {...,status:"CANCELLED",...} }   BECAUSE DAO.save writes it back
// <- order : { orderId:"PO-100", status:"CANCELLED", lineItems:[{sku:"S1",qty:2,unit:25.00}] }
//    alt complex rules : each extra rule adds another if-block to the SAME method, so the script grows with the logic`
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Complex logic sprawls when behavior and state are split', content: '<p><strong>Why.</strong> Separating the classes that implement behavior from those that store state means every rule lives in a script far from the data it changes.</p><p><strong>Claim.</strong> The procedural Transaction script style tends not to be a good way to implement complex business logic — scripts grow continually, just as a monolith keeps growing.</p><p><strong>Grounding.</strong> The book lists this as the pattern\'s central drawback after noting the approach uses few of the capabilities of an OOP language.</p><p><strong>In the wild.</strong> An OrderService holding create, revise and cancel scripts absorbs every edge case, so each new rule means editing a shared method.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'One procedural script per request type', content: '<p><strong>Why.</strong> A method per request keeps the happy path linear and obvious when the logic is simple.</p><p><strong>Claim.</strong> Organize business logic as a collection of procedural transaction scripts, one for each type of request, each located in a service class and reaching the database through data access objects.</p><p><strong>Grounding.</strong> The pattern definition, plus the Figure 5.2 example: OrderService exposes createOrder(), reviseOrder() and cancelOrder(); OrderDao exposes save(Order) and findOrderById(); Order is pure data.</p><p><strong>In the wild.</strong> A POST /orders request maps directly to OrderService.createOrder().</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Behavior classes and state classes stay separate', content: '<p><strong>Why.</strong> The design deliberately keeps data dumb, so it is quick to write and easy to follow.</p><p><strong>Claim.</strong> The scripts sit in stateless service classes, while the data objects such as Order are pure data with little or no behavior.</p><p><strong>Grounding.</strong> The book calls this separation an important characteristic of the approach, and says the style reads like C or another non-OOP language.</p><p><strong>In the wild.</strong> Order has orderId and orderLineItems but no methods; OrderService has methods but no fields.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Right for simple logic, wrong for complex', content: '<p><strong>Why.</strong> The procedural style is seductive because you can code without carefully organizing classes.</p><p><strong>Claim.</strong> Use a script when business logic is simple; when it becomes complex, switch to the Domain model — but do not be ashamed of procedural code where it is appropriate.</p><p><strong>Grounding.</strong> The book recommends the script when the object-oriented approach is overkill and says simple logic is exactly that situation.</p><p><strong>In the wild.</strong> Teams script trivial CRUD requests and reserve an object model for the parts of the domain with real rules.</p>' }
    ]
  },
  quiz: [
    { "question": "The Transaction script pattern organizes business logic as what?", "options": ["A. An object model of classes with state and behavior", "B. A collection of procedural transaction scripts, one per request type", "C. A sequence of state-changing events", "D. A set of database stored procedures"], "answer": 2, "explanation": "The pattern is one procedural script per type of request; A is the Domain model, C is Event sourcing, and D is not what the book describes.", "conceptRef": "One procedural script per request type" },
    { "question": "Which classes implement the behavior in a transaction-script design?", "options": ["A. The data objects (Order)", "B. The DAOs (OrderDao)", "C. The service classes (OrderService)", "D. The presentation tier"], "answer": 3, "explanation": "Scripts live in service classes such as OrderService; the Order data object has little or no behavior, and OrderDao only reads and writes the database.", "conceptRef": "Behavior classes and state classes stay separate" },
    { "question": "In the Transaction script pattern, the Order data object is what?", "options": ["A. Pure data with little or no behavior", "B. The class that enforces invariants", "C. A behavior-only class", "D. The database row itself"], "answer": 1, "explanation": "Order holds orderId and orderLineItems but no meaningful methods; it is a data object, which is why the script must do all the work.", "conceptRef": "Behavior classes and state classes stay separate" },
    { "question": "For which kind of logic is the Transaction script the appropriate choice?", "options": ["A. Complex business logic", "B. Logic needing an audit log", "C. Logic needing temporal queries", "D. Simple business logic"], "answer": 4, "explanation": "The book says the procedural script fits simple logic and that complex logic is where it becomes a maintenance nightmare, so A is backwards; B and C point at other patterns.", "conceptRef": "Right for simple logic, wrong for complex" }
  ]
});
