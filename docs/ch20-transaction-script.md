# Chapter 20: Transaction Script

> Organize the business logic as a collection of procedural transaction scripts, one for each type of request.

_Also known as: Chris Richardson · Microservice Patterns Ch.5 · microservices.io /patterns/decomposition/transaction-script.html_

## Flow

### One procedural method per request type

> **Why this matters:** When the logic is simple, an object model is overkill; a plain method per request is easier to read and write. The script pulls the request's data into an object and hands it to the database.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s0n0["<b>1. Map each request to a method</b><br/>A service class exposes one method per system operation — createOrd…"]:::start
  s0n1["<b>2. Build a pure data object</b><br/>The script fills an Order (orderId, orderLineItems) that has no beh…"]:::step
  s0n2["<b>3. Reach the database through a DAO</b><br/>OrderDao exposes save(Order) and findOrderById(), keeping SQL out o…"]:::stop
  s0n0 --> s0n1
  s0n1 --> s0n2
```

1. **Map each request to a method** — A service class exposes one method per system operation — createOrder(), reviseOrder(), cancelOrder().

2. **Build a pure data object** — The script fills an Order (orderId, orderLineItems) that has no behavior.

3. **Reach the database through a DAO** — OrderDao exposes save(Order) and findOrderById(), keeping SQL out of the script.

```java
// TRANSACTION SCRIPT SIDE — one procedural method per request; the script moves data, it does not own it
// PARTIES: SVC = OrderService (holds the scripts, no state) · DAO = OrderDao (data access) · DB = the database
// STATE (before):
//    orders : {}                        // the data store, empty — Order is a pure data object
// DEF: createOrder · CALLED BY: the presentation tier issuing a POST /orders request
// -> orderId : "PO-100" · -> lineItems : [{sku:"S1", qty:2, unit:25.00}]
//    step 1 · allocate the data object : order : null -> { orderId:null, lineItems:[] }   BECAUSE the script builds an Order (pure data) from the request
//    step 2 · fill from the request : order.orderId : null -> "PO-100" · order.lineItems : [] -> [{sku:"S1",qty:2,unit:25.00}]
//    step 3 · hand off to the DAO : DAO.save(order)     // save(Order) is data access, not business logic
//    step 4 · persist : orders : {} -> { "PO-100": { orderId:"PO-100", lineItems:[{sku:"S1",qty:2,unit:25.00}] } }
// <- order : { orderId:"PO-100", lineItems:[{sku:"S1",qty:2,unit:25.00}] } · saved to DB
```

### Keep behavior and state in separate classes

> **Why this matters:** The signature of the pattern is that the classes implementing behavior are separate from those storing state. That split is what makes the style read like plain procedural C, for better and for worse.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s1n0["<b>1. Service classes hold the scripts</b><br/>OrderService has methods and no meaningful state."]:::start
  s1n1["<b>2. Data classes hold the state</b><br/>Order holds orderId and orderLineItems and little or no behavior."]:::step
  s1n2["<b>3. The script does all mutation</b><br/>A change to a field is written by the script, never by the data obj…"]:::stop
  s1n0 --> s1n1
  s1n1 --> s1n2
```

1. **Service classes hold the scripts** — OrderService has methods and no meaningful state.

2. **Data classes hold the state** — Order holds orderId and orderLineItems and little or no behavior.

3. **The script does all mutation** — A change to a field is written by the script, never by the data object itself.

```java
// TRANSACTION SCRIPT SIDE — the script mutates a data object; the object never mutates itself
// PARTIES: SVC = OrderService (behavior, stateless) · DAO = OrderDao (find + save) · DB = the database
// STATE (before):
//    orders : { "PO-100": { orderId:"PO-100", lineItems:[{sku:"S1",qty:2,unit:25.00}] } }
// DEF: reviseOrder · CALLED BY: the presentation tier issuing a revise request
// -> orderId : "PO-100" · -> newQty : 5
//    step 1 · load : order : null -> { orderId:"PO-100", lineItems:[{sku:"S1",qty:2,unit:25.00}] }   BECAUSE DAO.findOrderById returns the stored data object
//    step 2 · the SCRIPT mutates a field : order.lineItems[0].qty : 2 -> 5   BECAUSE the change is written by the script, not by the Order
//    step 3 · persist : orders : { "PO-100": {...,qty:2,...} } -> { "PO-100": {...,qty:5,...} }   BECAUSE DAO.save writes the object back
// <- order : { orderId:"PO-100", lineItems:[{sku:"S1",qty:5,unit:25.00}] }
```

### Use scripts for simple logic only

> **Why this matters:** The procedural style is seductive because you skip class design, and that is fine while the rules are few. The same method that reads cleanly for simple logic becomes a nightmare as the rules multiply.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s2n0["<b>1. Accept the style when logic is simple</b><br/>Do not be ashamed of procedural code where it is appropriate."]:::start
  s2n1["<b>2. Watch for sprawl</b><br/>Each new rule is another branch inside the same script, so it grows…"]:::step
  s2n2["<b>3. Switch when complexity arrives</b><br/>For complex logic, move to the Domain model before the script becom…"]:::stop
  s2n0 --> s2n1
  s2n1 --> s2n2
```

1. **Accept the style when logic is simple** — Do not be ashamed of procedural code where it is appropriate.

2. **Watch for sprawl** — Each new rule is another branch inside the same script, so it grows with the logic.

3. **Switch when complexity arrives** — For complex logic, move to the Domain model before the script becomes unmaintainable.

```java
// TRANSACTION SCRIPT SIDE — simple logic reads top-to-bottom; the same method sprawls when the rules multiply
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
//    alt complex rules : each extra rule adds another if-block to the SAME method, so the script grows with the logic
```


## Key Concepts

### The Problem

**Complex logic sprawls when behavior and state are split.** The procedural Transaction script style tends not to be a good way to implement complex business logic — scripts grow continually, just as a monolith keeps growing.


### The Solution

Organize business logic as a collection of procedural transaction scripts, one for each type of request, each located in a service class and reaching the database through data access objects.


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| One procedural script per request type | Organize business logic as a collection of procedural transaction scripts, one for each type of request, each located in a service class and reaching the database through data access objects. | A POST /orders request maps directly to OrderService.createOrder(). |
| Behavior classes and state classes stay separate | The scripts sit in stateless service classes, while the data objects such as Order are pure data with little or no behavior. | Order has orderId and orderLineItems but no methods; OrderService has methods but no fields. |
| Right for simple logic, wrong for complex | Use a script when business logic is simple; when it becomes complex, switch to the Domain model — but do not be ashamed of procedural code where it is appropriate. | Teams script trivial CRUD requests and reserve an object model for the parts of the domain with real rules. |


### Tradeoffs & When

- The scripts sit in stateless service classes, while the data objects such as Order are pure data with little or no behavior.
- Use a script when business logic is simple; when it becomes complex, switch to the Domain model — but do not be ashamed of procedural code where it is appropriate.


<details><summary>All concepts (index)</summary>

### Problem: Complex logic sprawls when behavior and state are split

**Why.** Separating the classes that implement behavior from those that store state means every rule lives in a script far from the data it changes.

**Claim.** The procedural Transaction script style tends not to be a good way to implement complex business logic — scripts grow continually, just as a monolith keeps growing.

**Grounding.** The book lists this as the pattern's central drawback after noting the approach uses few of the capabilities of an OOP language.

**In the wild.** An OrderService holding create, revise and cancel scripts absorbs every edge case, so each new rule means editing a shared method.
### Solution: One procedural script per request type

**Why.** A method per request keeps the happy path linear and obvious when the logic is simple.

**Claim.** Organize business logic as a collection of procedural transaction scripts, one for each type of request, each located in a service class and reaching the database through data access objects.

**Grounding.** The pattern definition, plus the Figure 5.2 example: OrderService exposes createOrder(), reviseOrder() and cancelOrder(); OrderDao exposes save(Order) and findOrderById(); Order is pure data.

**In the wild.** A POST /orders request maps directly to OrderService.createOrder().
### Tradeoff: Behavior classes and state classes stay separate

**Why.** The design deliberately keeps data dumb, so it is quick to write and easy to follow.

**Claim.** The scripts sit in stateless service classes, while the data objects such as Order are pure data with little or no behavior.

**Grounding.** The book calls this separation an important characteristic of the approach, and says the style reads like C or another non-OOP language.

**In the wild.** Order has orderId and orderLineItems but no methods; OrderService has methods but no fields.
### Tradeoff: Right for simple logic, wrong for complex

**Why.** The procedural style is seductive because you can code without carefully organizing classes.

**Claim.** Use a script when business logic is simple; when it becomes complex, switch to the Domain model — but do not be ashamed of procedural code where it is appropriate.

**Grounding.** The book recommends the script when the object-oriented approach is overkill and says simple logic is exactly that situation.

**In the wild.** Teams script trivial CRUD requests and reserve an object model for the parts of the domain with real rules.

</details>


## Quiz

1. The Transaction script pattern organizes business logic as what?

   - A. An object model of classes with state and behavior
   - B. A collection of procedural transaction scripts, one per request type
   - C. A sequence of state-changing events
   - D. A set of database stored procedures

<details><summary>Reveal answer</summary>

**B.** The pattern is one procedural script per type of request; A is the Domain model, C is Event sourcing, and D is not what the book describes.

</details>

2. Which classes implement the behavior in a transaction-script design?

   - A. The data objects (Order)
   - B. The DAOs (OrderDao)
   - C. The service classes (OrderService)
   - D. The presentation tier

<details><summary>Reveal answer</summary>

**C.** Scripts live in service classes such as OrderService; the Order data object has little or no behavior, and OrderDao only reads and writes the database.

</details>

3. In the Transaction script pattern, the Order data object is what?

   - A. Pure data with little or no behavior
   - B. The class that enforces invariants
   - C. A behavior-only class
   - D. The database row itself

<details><summary>Reveal answer</summary>

**A.** Order holds orderId and orderLineItems but no meaningful methods; it is a data object, which is why the script must do all the work.

</details>

4. For which kind of logic is the Transaction script the appropriate choice?

   - A. Complex business logic
   - B. Logic needing an audit log
   - C. Logic needing temporal queries
   - D. Simple business logic

<details><summary>Reveal answer</summary>

**D.** The book says the procedural script fits simple logic and that complex logic is where it becomes a maintenance nightmare, so A is backwards; B and C point at other patterns.

</details>

