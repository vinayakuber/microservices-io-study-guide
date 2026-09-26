# Chapter 41: Serverless Deployment

> Use a deployment infrastructure that hides any concept of servers and runs your code, charging you for each request based on the resources consumed.

_Also known as: Chris Richardson · Microservice Patterns p.416 · microservices.io /patterns/deployment/serverless-deployment.html_

## Flow

### Package and upload the code

> **Why this matters:** Serverless removes the need to manage any low-level infrastructure — operating systems, virtual machines, containers. You hand the provider your code plus the handler name and resource limits, and it runs the code.

1. **Package the code** — Package your Node.js, Java, or Python code for the service as a ZIP file.

2. **Upload it** — Upload the ZIP to the deployment infrastructure and describe the desired performance characteristics.

3. **Name the handler and limits** — Specify the name of the function that handles events, plus the resource limits.

```java
// UPLOAD SIDE — hand the provider your code plus a handler name and resource limits, no servers to manage
// PARTIES: DEV = developer · LAMBDA = the serverless deployment infrastructure
// STATE (before):
//    function : null                    // nothing deployed yet
//    limits : {}                        // desired performance characteristics, unset
// DEF: deploy handler with memory 128 · CALLED BY: DEV uploading a ZIP
// -> code : "restaurant.zip" · -> handler : "index.handler" · -> memory : 128
//    step 1 · upload · function : null -> "restaurant"        BECAUSE the infrastructure takes your code and runs it
//    step 2 · describe · limits : {} -> {"memory":128}        // you specify resource limits, not servers
//    step 3 · register · handler : null -> "index.handler"    // the name of the function that handles events
// <- function : "restaurant"  · no OS, VM, or container is managed by anyone on your team
//    alt new version : code : "restaurant.zip" -> "restaurant-v2.zip"   BECAUSE a redeploy uploads a fresh ZIP
```

### Invoke on an event

> **Why this matters:** An AWS Lambda function is a stateless component invoked to handle events. When an event occurs, the infrastructure finds an idle instance — launching one if none exist — and invokes the handler.

1. **Find an idle instance** — Lambda finds an idle instance of your function, launching one if none are available.

2. **Invoke the handler** — The handler function is invoked with the event.

3. **Isolate under the covers** — Lambda runs enough instances for the load, using containers on EC2 instances to isolate each one — hidden from you.

```java
// INVOKE SIDE — an event fires and the infrastructure runs enough isolated instances of your function
// PARTIES: S3 = Amazon S3 @ orders-assets-bucket · LAMBDA = the deployment infrastructure · FUNC = the function instance
// STATE (before):
//    instances : {}                     // idle function instances, none yet
//    handler_runs : 0                   // how many times the handler has executed
// DEF: react to S3 object 1 · CALLED BY: LAMBDA when an object is created
// -> event : "object-created" · -> key : "photo-7.jpg"
//    step 1 · find idle instance · instances : {} -> {"i-1"}   BECAUSE Lambda finds an idle instance, launching one if none exist
//    step 2 · invoke · handler_runs : 0 -> 1                   // the handler function receives the event
//    step 3 · isolate · containers : 0 -> 1                    // under the covers a container isolates this instance
// <- handler_runs : 1  · the function handled event "object-created" for "photo-7.jpg"
//    alt no idle instance : instances : {} -> {"i-1"}  BECAUSE Lambda launches a fresh instance when none are available, which adds startup latency
```

### Route HTTP through an API gateway

> **Why this matters:** A serverless function can be invoked several ways. One of them is HTTP: a gateway transforms the HTTP request into an event object, invokes the function, and turns the result back into an HTTP response.

1. **Transform the request** — The gateway turns the HTTP request into an event object.

2. **Invoke the lambda** — The gateway invokes the lambda function with the event.

3. **Generate the response** — The gateway generates an HTTP response from the function's result.

```java
// GATEWAY SIDE — an HTTP request is transformed into an event, the function runs, and a response is generated
// PARTIES: CLIENT = the HTTP caller · GW = API Gateway · FUNC = the lambda function
// STATE (before):
//    http : {}                          // the incoming HTTP request, not yet transformed
//    response : null                    // nothing returned yet
// DEF: route GET /restaurants/42 · CALLED BY: CLIENT
// -> method : "GET" · -> path : "/restaurants/42"
//    step 1 · transform · http : {} -> {"method":"GET","path":"/restaurants/42"}  BECAUSE the gateway turns the HTTP request into an event object
//    step 2 · invoke · http : {"method":"GET","path":"/restaurants/42"} -> "handled"  // the event is passed to the lambda
//    step 3 · respond · response : null -> {"status":200}                            // the gateway builds an HTTP response from the result
// <- response : {"status":200}  · one HTTP call became one event and one reply
//    alt error path : response : null -> {"status":500}   BECAUSE the function returned an error result
```

### Pay per request, with constraints

> **Why this matters:** Serverless is extremely elastic and you pay per request rather than for underutilized VMs. But it carries real constraints: few languages, stateless-only, and latency risk when load spikes and nothing is pre-provisioned.

1. **Price by duration and memory** — The cost of each invocation is a function of its duration, measured in 100 millisecond increments, and the memory consumed.

2. **Accept the constraints** — Only a few languages are supported, and only stateless applications that run in response to a request fit.

3. **Accept the latency risk** — The infrastructure can only react to load, not pre-provision it, so sudden spikes can cause high latency.

```java
// COST SIDE — you pay per request for duration and memory, and you trade away pre-provisioned capacity
// PARTIES: LAMBDA = the provider · APP = the application being served
// STATE (before):
//    bill : 0                          // accumulated cost units, zero
//    latency : 0                       // measured response time in ms
//    handler : "index.handler"         // the function invoked for each event
// DEF: bill invocation of 300 ms · CALLED BY: LAMBDA after each handler run
// -> duration_ms : 300 · -> memory : 128
//    step 1 · bucket · increments : 0 -> 3          // 300 ms / 100 ms = 3 increments  BECAUSE duration is measured in 100 ms increments
//    step 2 · price · bill : 0 -> 3                 // the cost is a function of duration and the memory consumed
//    step 3 · react · latency : 0 -> 350            // provisioning plus initialization can add latency on a spike
// <- bill : 3 units  · latency : 350 ms  · pay per request, but you cannot pre-provision capacity
//    alt steady load : latency : 350 -> 10   BECAUSE a warm idle instance is found, so no startup cost
```


## System Design Interview

> **The question:** Design deployment without managing servers. Premise: a client request goes through an API gateway into a function runtime that runs the function on demand, so capacity is provisioned per request.

**The pipeline:** client request → API gateway → function runtime → function

### client — the HTTP caller that sends the request

_Role: client_

![client — the HTTP caller that sends the request](../diagrams/d2/decomp/ch41-0.png)

### API gateway — the HTTP entry that maps requests to functions

_Role: gateway_

![API gateway — the HTTP entry that maps requests to functions](../diagrams/d2/decomp/ch41-1.png)

### function runtime — the serverless infrastructure (AWS Lambda)

_Role: function runtime_

![function runtime — the serverless infrastructure (AWS Lambda)](../diagrams/d2/decomp/ch41-2.png)

### the function — the stateless handler that runs the code

_Role: function_

![the function — the stateless handler that runs the code](../diagrams/d2/decomp/ch41-3.png)

```java
// SYSTEM DESIGN — serverless: client request -> API gateway -> function runtime -> function
// PARTIES: CLIENT = the HTTP caller (client) · GW = API Gateway (transforms HTTP into an event, builds the response) · RT = function runtime (AWS Lambda: loads the ZIP, cold-start, scales to zero) · FN = the function (index.handler running the uploaded code)
// DEF: event — the payload the runtime passes to the handler; here {"method":"GET","path":"/restaurants/42"}
// DEF: handler — the named entrypoint invoked per event; here "index.handler"
// DEF: zip — the packaged code the developer uploaded; here "restaurant.zip"
// DEF: cold_start — launching a fresh instance when none is idle; here instance "i-1" boots
// STATE (before):
//    request : {}     // the inbound HTTP request, not yet transformed
//    instances : {}   // idle function instances, none yet
// DEF: route_one_request · CALLED BY: CLIENT calling GET /restaurants/42
// -> method : "GET" · -> path : "/restaurants/42"
//    step 1 · GW transforms the HTTP request into an event    request : {} -> {"method":"GET","path":"/restaurants/42"}   BECAUSE the gateway turns HTTP into an event object
//    step 2 · RT loads the ZIP and cold-starts an instance    instances : {} -> {"i-1"}   // the runtime launches one when none are idle
//    step 3 · RT invokes the handler with the event    runs : 0 -> 1   // handler "index.handler" runs the event
//    step 4 · GW creates the response from the result    response : "" -> "200"   // the gateway returns an HTTP response
// <- response : "200" · one HTTP call became one event, one run, and one reply   BECAUSE the gateway and runtime hide every server
```

## Interview Questions

### Q1

Your team is tired of owning operating systems, VMs, and containers. You want to hand the provider your code and let it run, with no servers under your management at all.

**Interviewer's question:** What do you give the serverless infrastructure, and what does it hide?

**Solution:** You package your Node.js, Java, or Python code as a ZIP file, upload it, and specify the name of the function that handles events plus the resource limits; the infrastructure hides any concept of servers.

**System-design components:**
- ZIP package — the code
- Handler name — which function handles events
- Resource limits — the performance spec
- Hidden servers — no OS/VM/container to manage

```java
// UPLOAD SIDE — hand the provider your code plus a handler name and resource limits, no servers to manage
// PARTIES: DEV = developer · LAMBDA = the serverless deployment infrastructure
// STATE (before):
//    function : null                    // nothing deployed yet
//    limits : {}                        // desired performance characteristics, unset
// DEF: deploy handler with memory 128 · CALLED BY: DEV uploading a ZIP
// -> code : "restaurant.zip" · -> handler : "index.handler" · -> memory : 128
//    step 1 · upload the ZIP   // function : null -> "restaurant"   BECAUSE the infrastructure takes your code and runs it
//    step 2 · describe the limits   // limits : {} -> {"memory":128}   // you specify resource limits, not servers
//    step 3 · register the handler   // handler : null -> "index.handler"   // the name of the function that handles events
// <- function : "restaurant" · no OS, VM, or container is managed by anyone on your team
//    alt new version : code : "restaurant.zip" -> "restaurant-v2.zip"   BECAUSE a redeploy uploads a fresh ZIP
```

_This is the upload stage — a ZIP plus a handler name and resource limits, with servers hidden by the infrastructure._

_Covers:_ Package and upload the code

_From the 28 problems:_ 01-scale-from-zero-to-millions

### Q2

A new photo just landed in S3, and your function must run to process it. You have no idle instance provisioned ahead of time.

**Interviewer's question:** How does a serverless function get invoked when an event occurs?

**Solution:** The function is a stateless component invoked to handle events; Lambda finds an idle instance, launching one if none are available, invokes the handler with the event, and isolates each instance using containers on EC2 instances under the covers.

**System-design components:**
- Idle instance — found or launched
- Handler — invoked with the event
- Containers on EC2 — hidden isolation
- Enough instances — for the load

```java
// INVOKE SIDE — an event fires and the infrastructure runs enough isolated instances of your function
// PARTIES: S3 = Amazon S3 @ orders-assets-bucket · LAMBDA = the deployment infrastructure · FUNC = the function instance
// STATE (before):
//    instances : {}                     // idle function instances, none yet
//    handler_runs : 0                   // how many times the handler has executed
// DEF: react to S3 object 1 · CALLED BY: LAMBDA when an object is created
// -> event : "object-created" · -> key : "photo-7.jpg"
//    step 1 · find an idle instance   // instances : {} -> {"i-1"}   BECAUSE Lambda finds an idle instance, launching one if none exist
//    step 2 · invoke the handler   // handler_runs : 0 -> 1   // the handler function receives the event
//    step 3 · isolate   // containers : 0 -> 1   // under the covers a container isolates this instance
// <- handler_runs : 1 · the function handled event "object-created" for "photo-7.jpg"
//    alt no idle instance : instances : {} -> {"i-1"}   BECAUSE Lambda launches a fresh instance when none are available, which adds startup latency
```

_This is the invoke stage — finding or launching an idle instance, invoking the handler, and isolating it under the covers._

_Covers:_ Invoke on an event

_From the 28 problems:_ 01-scale-from-zero-to-millions

### Q3

Your function must also be reachable over plain HTTP. A browser GET to /restaurants/42 should end up running the function and returning a response.

**Interviewer's question:** How does an HTTP request reach a serverless function?

**Solution:** An API gateway transforms the HTTP request into an event object, invokes the lambda function with the event, and generates an HTTP response from the function's result.

**System-design components:**
- API gateway — the HTTP entry
- Request transform — into an event object
- Lambda invocation — with the event
- Response generation — from the result

```java
// GATEWAY SIDE — an HTTP request is transformed into an event, the function runs, and a response is generated
// PARTIES: CLIENT = the HTTP caller · GW = API Gateway · FUNC = the lambda function
// STATE (before):
//    http : {}                          // the incoming HTTP request, not yet transformed
//    response : null                    // nothing returned yet
// DEF: route GET /restaurants/42 · CALLED BY: CLIENT
// -> method : "GET" · -> path : "/restaurants/42"
//    step 1 · transform the request   // http : {} -> {"method":"GET","path":"/restaurants/42"}   BECAUSE the gateway turns the HTTP request into an event object
//    step 2 · invoke the lambda   // http : {"method":"GET","path":"/restaurants/42"} -> "handled"   // the event is passed to the lambda
//    step 3 · respond   // response : null -> {"status":200}   // the gateway builds an HTTP response from the result
// <- response : {"status":200} · one HTTP call became one event and one reply
//    alt error path : response : null -> {"status":500}   BECAUSE the function returned an error result
```

_This is the gateway stage — transforming HTTP into an event, invoking the function, and turning the result back into a response._

_Covers:_ Route HTTP through an API gateway

_From the 28 problems:_ 01-scale-from-zero-to-millions

### Q4

Serverless is extremely elastic, but you are worried about the bill and about what you are giving up. A database does not fit, and a sudden spike could stall.

**Interviewer's question:** How is serverless priced, and what constraints come with it?

**Solution:** Cost is a function of each invocation's duration measured in 100 millisecond increments and the memory consumed; constraints are few supported languages, stateless request-driven applications only, and latency risk on spikes because capacity cannot be pre-provisioned.

**System-design components:**
- Duration — 100 ms increments
- Memory — the other cost factor
- Few languages + stateless only — the constraints
- Latency risk — cannot pre-provision

```java
// COST SIDE — you pay per request for duration and memory, and you trade away pre-provisioned capacity
// PARTIES: LAMBDA = the provider · APP = the application being served
// STATE (before):
//    bill : 0                          // accumulated cost units, zero
//    latency : 0                       // measured response time in ms
//    handler : "index.handler"         // the function invoked for each event
// DEF: bill invocation of 300 ms · CALLED BY: LAMBDA after each handler run
// -> duration_ms : 300 · -> memory : 128
//    step 1 · bucket the duration   // increments : 0 -> 3   // 300 ms / 100 ms = 3 increments   BECAUSE duration is measured in 100 ms increments
//    step 2 · price the invocation   // bill : 0 -> 3   // the cost is a function of duration and the memory consumed
//    step 3 · react to the spike   // latency : 0 -> 350   // provisioning plus initialization can add latency on a spike
// <- bill : 3 units · latency : 350 ms · pay per request, but you cannot pre-provision capacity
//    alt steady load : latency : 350 -> 10   BECAUSE a warm idle instance is found, so no startup cost
```

_This is the cost stage — paying per request by duration and memory, within the language, state, and latency constraints._

_Covers:_ Pay per request, with constraints

_From the 28 problems:_ 01-scale-from-zero-to-millions

## Key Concepts

### The Problem

**Managing servers is undifferentiated heavy lifting.** That low-level infrastructure management is undifferentiated heavy lifting that distracts from the service code.


### The Solution

Use an infrastructure that hides any concept of reserved or preallocated resources — it takes your code and runs it, and you are charged for each request based on the resources consumed.

```java
// UPLOAD SIDE — hand the provider your code plus a handler name and resource limits, no servers to manage
// PARTIES: DEV = developer · LAMBDA = the serverless deployment infrastructure
// STATE (before):
//    function : null                    // nothing deployed yet
//    limits : {}                        // desired performance characteristics, unset
// DEF: deploy handler with memory 128 · CALLED BY: DEV uploading a ZIP
// -> code : "restaurant.zip" · -> handler : "index.handler" · -> memory : 128
//    step 1 · upload the ZIP   // function : null -> "restaurant"   BECAUSE the infrastructure takes your code and runs it
//    step 2 · describe the limits   // limits : {} -> {"memory":128}   // you specify resource limits, not servers
//    step 3 · register the handler   // handler : null -> "index.handler"   // the name of the function that handles events
// <- function : "restaurant" · no OS, VM, or container is managed by anyone on your team
//    alt new version : code : "restaurant.zip" -> "restaurant-v2.zip"   BECAUSE a redeploy uploads a fresh ZIP
```


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| Hide the servers, run the code, pay per request | Use an infrastructure that hides any concept of reserved or preallocated resources — it takes your code and runs it, and you are charged for each request based on the resources consumed. | AWS Lambda has the richest feature set, packaging Node.js, Java, or Python code in a ZIP. |
| Elastic and pay-per-request | The infrastructure is extremely elastic — it automatically scales to handle the load — and you pay for each request rather than for provisioned capacity. | A spike is absorbed by running more function instances, not by pre-provisioned servers. |
| Constraints: stateless, few languages, latency risk | Serverless has far more constraints than VM- or container-based infrastructure: only a few languages, only stateless request-driven applications, and a latency risk when load spikes because capacity cannot be pre-provisioned. | A database or a RabbitMQ subscriber does not fit the serverless model. |


### Tradeoffs & When

- The infrastructure is extremely elastic — it automatically scales to handle the load — and you pay for each request rather than for provisioned capacity.
- Serverless has far more constraints than VM- or container-based infrastructure: only a few languages, only stateless request-driven applications, and a latency risk when load spikes because capacity cannot be pre-provisioned.


<details><summary>All concepts (index)</summary>

### Problem: Managing servers is undifferentiated heavy lifting

**Why.** Services must be packaged and deployed, but someone must own operating systems, virtual machines, and other low-level infrastructure.

**Claim.** That low-level infrastructure management is undifferentiated heavy lifting that distracts from the service code.

**Grounding.** The solution says the infrastructure hides any concept of servers, and neither you nor anyone else in your organization is responsible for managing low-level infrastructure.

**In the wild.** Teams instead focus on their code while the provider runs the underlying machines.
### Solution: Hide the servers, run the code, pay per request

**Why.** You want a deployment infrastructure that scales without provisioning servers yourself.

**Claim.** Use an infrastructure that hides any concept of reserved or preallocated resources — it takes your code and runs it, and you are charged for each request based on the resources consumed.

**Grounding.** The solution describes uploading packaged code such as a ZIP and describing the desired performance characteristics; AWS Lambda, Google Cloud Functions, and Azure Functions are named examples.

**In the wild.** AWS Lambda has the richest feature set, packaging Node.js, Java, or Python code in a ZIP.
### Tradeoff: Elastic and pay-per-request

**Why.** You do not want to provision virtual machines or containers that sit underutilized.

**Claim.** The infrastructure is extremely elastic — it automatically scales to handle the load — and you pay for each request rather than for provisioned capacity.

**Grounding.** The benefits section lists eliminating undifferentiated heavy lifting, automatic elasticity, and per-request payment.

**In the wild.** A spike is absorbed by running more function instances, not by pre-provisioned servers.
### Tradeoff: Constraints: stateless, few languages, latency risk

**Why.** The freedom from servers comes with limits on what you can deploy.

**Claim.** Serverless has far more constraints than VM- or container-based infrastructure: only a few languages, only stateless request-driven applications, and a latency risk when load spikes because capacity cannot be pre-provisioned.

**Grounding.** The drawbacks section lists the language limits, the ban on long-running stateful applications such as databases or message brokers, the limited input sources, and the high-latency risk on sudden spikes.

**In the wild.** A database or a RabbitMQ subscriber does not fit the serverless model.

</details>


## Quiz

1. What does the serverless deployment infrastructure hide from you?

   - A. Only the networking layer
   - B. Any concept of servers — physical or virtual hosts, or containers
   - C. Only the database
   - D. Only the logging framework

<details><summary>Reveal answer</summary>

**B.** The infrastructure hides any concept of servers, including physical or virtual hosts and containers (B). The other options are narrower than what the pattern claims.

</details>

2. Which three serverless environments are named in the reference?

   - A. AWS Lambda, Google Cloud Functions, and Azure Functions
   - B. Kubernetes, Marathon, and ECS
   - C. EC2, S3, and Kinesis
   - D. CloudFoundry, Heroku, and OpenShift

<details><summary>Reveal answer</summary>

**A.** The reference names AWS Lambda, Google Cloud Functions, and Azure Functions (A), noting AWS Lambda has the richest feature set.

</details>

3. How is the cost of a Lambda invocation calculated?

   - A. A flat fee per function
   - B. As a function of the duration, measured in 100 ms increments, and the memory consumed
   - C. Only by the number of lines of code
   - D. Only by the number of HTTP requests

<details><summary>Reveal answer</summary>

**B.** Cost is a function of the invocation's duration, measured in 100 millisecond increments, and the memory consumed (B). The other options are not the stated cost model.

</details>

4. Why can serverless exhibit high latency during sudden load spikes?

   - A. The infrastructure can only react to load and cannot proactively pre-provision capacity
   - B. The functions are written in slow languages
   - C. The ZIP upload is slow
   - D. The bill is computed too slowly

<details><summary>Reveal answer</summary>

**A.** A serverless infrastructure can only react to increases in load — you cannot proactively pre-provision capacity — so provisioning and initialization add latency on sudden spikes (A).

</details>

