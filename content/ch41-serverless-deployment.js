registerChapter({
  id: 'ch41',
  num: 41,
  title: 'Serverless Deployment',
  pattern: 'Use a deployment infrastructure that hides any concept of servers and runs your code, charging you for each request based on the resources consumed.',
  aka: 'Chris Richardson · Microservice Patterns p.416 · microservices.io /patterns/deployment/serverless-deployment.html',
  part: 9,
  flow: [
    {
      section: 'Package and upload the code',
      color: 'orange',
      motivation: `Serverless removes the need to manage any low-level infrastructure — operating systems, virtual machines, containers. You hand the provider your code plus the handler name and resource limits, and it runs the code.`,
      steps: [
        { num: 1, title: 'Package the code', detail: 'Package your Node.js, Java, or Python code for the service as a ZIP file.' },
        { num: 2, title: 'Upload it', detail: 'Upload the ZIP to the deployment infrastructure and describe the desired performance characteristics.' },
        { num: 3, title: 'Name the handler and limits', detail: 'Specify the name of the function that handles events, plus the resource limits.' }
      ],
      program: `// UPLOAD SIDE — hand the provider your code plus a handler name and resource limits, no servers to manage
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
//    alt new version : code : "restaurant.zip" -> "restaurant-v2.zip"   BECAUSE a redeploy uploads a fresh ZIP`
    },
    {
      section: 'Invoke on an event',
      color: 'orange',
      motivation: `An AWS Lambda function is a stateless component invoked to handle events. When an event occurs, the infrastructure finds an idle instance — launching one if none exist — and invokes the handler.`,
      steps: [
        { num: 1, title: 'Find an idle instance', detail: 'Lambda finds an idle instance of your function, launching one if none are available.' },
        { num: 2, title: 'Invoke the handler', detail: 'The handler function is invoked with the event.' },
        { num: 3, title: 'Isolate under the covers', detail: 'Lambda runs enough instances for the load, using containers on EC2 instances to isolate each one — hidden from you.' }
      ],
      program: `// INVOKE SIDE — an event fires and the infrastructure runs enough isolated instances of your function
// PARTIES: S3 = object store · LAMBDA = the deployment infrastructure · FUNC = the function instance
// STATE (before):
//    instances : {}                     // idle function instances, none yet
//    handler_runs : 0                   // how many times the handler has executed
// DEF: react to S3 object 1 · CALLED BY: LAMBDA when an object is created
// -> event : "object-created" · -> key : "photo-7.jpg"
//    step 1 · find idle instance · instances : {} -> {"i-1"}   BECAUSE Lambda finds an idle instance, launching one if none exist
//    step 2 · invoke · handler_runs : 0 -> 1                   // the handler function receives the event
//    step 3 · isolate · containers : 0 -> 1                    // under the covers a container isolates this instance
// <- handler_runs : 1  · the function handled event "object-created" for "photo-7.jpg"
//    alt no idle instance : instances : {} -> {"i-1"}  BECAUSE Lambda launches a fresh instance when none are available, which adds startup latency`
    },
    {
      section: 'Route HTTP through an API gateway',
      color: 'orange',
      motivation: `A serverless function can be invoked several ways. One of them is HTTP: a gateway transforms the HTTP request into an event object, invokes the function, and turns the result back into an HTTP response.`,
      steps: [
        { num: 1, title: 'Transform the request', detail: 'The gateway turns the HTTP request into an event object.' },
        { num: 2, title: 'Invoke the lambda', detail: 'The gateway invokes the lambda function with the event.' },
        { num: 3, title: 'Generate the response', detail: 'The gateway generates an HTTP response from the function\'s result.' }
      ],
      program: `// GATEWAY SIDE — an HTTP request is transformed into an event, the function runs, and a response is generated
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
//    alt error path : response : null -> {"status":500}   BECAUSE the function returned an error result`
    },
    {
      section: 'Pay per request, with constraints',
      color: 'orange',
      motivation: `Serverless is extremely elastic and you pay per request rather than for underutilized VMs. But it carries real constraints: few languages, stateless-only, and latency risk when load spikes and nothing is pre-provisioned.`,
      steps: [
        { num: 1, title: 'Price by duration and memory', detail: 'The cost of each invocation is a function of its duration, measured in 100 millisecond increments, and the memory consumed.' },
        { num: 2, title: 'Accept the constraints', detail: 'Only a few languages are supported, and only stateless applications that run in response to a request fit.' },
        { num: 3, title: 'Accept the latency risk', detail: 'The infrastructure can only react to load, not pre-provision it, so sudden spikes can cause high latency.' }
      ],
      program: `// COST SIDE — you pay per request for duration and memory, and you trade away pre-provisioned capacity
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
//    alt steady load : latency : 350 -> 10   BECAUSE a warm idle instance is found, so no startup cost`
    }
  ],
  interview: [
    {
      scenario: 'Your team is tired of owning operating systems, VMs, and containers. You want to hand the provider your code and let it run, with no servers under your management at all.',
      q: 'What do you give the serverless infrastructure, and what does it hide?',
      solution: 'You package your Node.js, Java, or Python code as a ZIP file, upload it, and specify the name of the function that handles events plus the resource limits; the infrastructure hides any concept of servers.',
      components: ['ZIP package — the code', 'Handler name — which function handles events', 'Resource limits — the performance spec', 'Hidden servers — no OS/VM/container to manage'],
      diagram: `flowchart LR
  DEV["Developer"] -->|"upload restaurant.zip"| LAMBDA["Serverless infrastructure"]
  DEV -->|"handler index.handler"| LAMBDA
  DEV -->|"memory 128"| LAMBDA
  LAMBDA -->|"hides"| HIDDEN["no OS, VM, or container"]`,
      code: `// UPLOAD SIDE — hand the provider your code plus a handler name and resource limits, no servers to manage
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
//    alt new version : code : "restaurant.zip" -> "restaurant-v2.zip"   BECAUSE a redeploy uploads a fresh ZIP`,
      tieback: 'This is the upload stage — a ZIP plus a handler name and resource limits, with servers hidden by the infrastructure.',
      refs: ['Package and upload the code'],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: 'A new photo just landed in S3, and your function must run to process it. You have no idle instance provisioned ahead of time.',
      q: 'How does a serverless function get invoked when an event occurs?',
      solution: 'The function is a stateless component invoked to handle events; Lambda finds an idle instance, launching one if none are available, invokes the handler with the event, and isolates each instance using containers on EC2 instances under the covers.',
      components: ['Idle instance — found or launched', 'Handler — invoked with the event', 'Containers on EC2 — hidden isolation', 'Enough instances — for the load'],
      diagram: `flowchart LR
  S3["Object store"] -->|"object-created photo-7.jpg"| LAMBDA["Lambda"]
  LAMBDA -->|"find or launch"| I["instance i-1"]
  I -->|"invoke"| H["index.handler"]
  H -->|"isolated by"| C["container on EC2"]`,
      code: `// INVOKE SIDE — an event fires and the infrastructure runs enough isolated instances of your function
// PARTIES: S3 = object store · LAMBDA = the deployment infrastructure · FUNC = the function instance
// STATE (before):
//    instances : {}                     // idle function instances, none yet
//    handler_runs : 0                   // how many times the handler has executed
// DEF: react to S3 object 1 · CALLED BY: LAMBDA when an object is created
// -> event : "object-created" · -> key : "photo-7.jpg"
//    step 1 · find an idle instance   // instances : {} -> {"i-1"}   BECAUSE Lambda finds an idle instance, launching one if none exist
//    step 2 · invoke the handler   // handler_runs : 0 -> 1   // the handler function receives the event
//    step 3 · isolate   // containers : 0 -> 1   // under the covers a container isolates this instance
// <- handler_runs : 1 · the function handled event "object-created" for "photo-7.jpg"
//    alt no idle instance : instances : {} -> {"i-1"}   BECAUSE Lambda launches a fresh instance when none are available, which adds startup latency`,
      tieback: 'This is the invoke stage — finding or launching an idle instance, invoking the handler, and isolating it under the covers.',
      refs: ['Invoke on an event'],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: 'Your function must also be reachable over plain HTTP. A browser GET to /restaurants/42 should end up running the function and returning a response.',
      q: 'How does an HTTP request reach a serverless function?',
      solution: 'An API gateway transforms the HTTP request into an event object, invokes the lambda function with the event, and generates an HTTP response from the function\'s result.',
      components: ['API gateway — the HTTP entry', 'Request transform — into an event object', 'Lambda invocation — with the event', 'Response generation — from the result'],
      diagram: `flowchart LR
  CLIENT["HTTP caller"] -->|"GET /restaurants/42"| GW["API Gateway"]
  GW -->|"event object"| FUNC["Lambda function"]
  FUNC -->|"result"| GW
  GW -->|"status 200"| CLIENT`,
      code: `// GATEWAY SIDE — an HTTP request is transformed into an event, the function runs, and a response is generated
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
//    alt error path : response : null -> {"status":500}   BECAUSE the function returned an error result`,
      tieback: 'This is the gateway stage — transforming HTTP into an event, invoking the function, and turning the result back into a response.',
      refs: ['Route HTTP through an API gateway'],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: 'Serverless is extremely elastic, but you are worried about the bill and about what you are giving up. A database does not fit, and a sudden spike could stall.',
      q: 'How is serverless priced, and what constraints come with it?',
      solution: 'Cost is a function of each invocation\'s duration measured in 100 millisecond increments and the memory consumed; constraints are few supported languages, stateless request-driven applications only, and latency risk on spikes because capacity cannot be pre-provisioned.',
      components: ['Duration — 100 ms increments', 'Memory — the other cost factor', 'Few languages + stateless only — the constraints', 'Latency risk — cannot pre-provision'],
      diagram: `flowchart LR
  LAMBDA["Lambda"] -->|"duration 300 ms"| BILL["3 x 100 ms increments"]
  BILL -->|"times memory"| COST["cost 3 units"]
  LAMBDA -->|"constraints"| LIM["few langs, stateless"]
  LAMBDA -->|"spike"| LAT["high latency"]`,
      code: `// COST SIDE — you pay per request for duration and memory, and you trade away pre-provisioned capacity
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
//    alt steady load : latency : 350 -> 10   BECAUSE a warm idle instance is found, so no startup cost`,
      tieback: 'This is the cost stage — paying per request by duration and memory, within the language, state, and latency constraints.',
      refs: ['Pay per request, with constraints'],
      problems: ["01-scale-from-zero-to-millions"]
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Managing servers is undifferentiated heavy lifting', content: '<p><strong>Why.</strong> Services must be packaged and deployed, but someone must own operating systems, virtual machines, and other low-level infrastructure.</p><p><strong>Claim.</strong> That low-level infrastructure management is undifferentiated heavy lifting that distracts from the service code.</p><p><strong>Grounding.</strong> The solution says the infrastructure hides any concept of servers, and neither you nor anyone else in your organization is responsible for managing low-level infrastructure.</p><p><strong>In the wild.</strong> Teams instead focus on their code while the provider runs the underlying machines.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Hide the servers, run the code, pay per request', content: '<p><strong>Why.</strong> You want a deployment infrastructure that scales without provisioning servers yourself.</p><p><strong>Claim.</strong> Use an infrastructure that hides any concept of reserved or preallocated resources — it takes your code and runs it, and you are charged for each request based on the resources consumed.</p><p><strong>Grounding.</strong> The solution describes uploading packaged code such as a ZIP and describing the desired performance characteristics; AWS Lambda, Google Cloud Functions, and Azure Functions are named examples.</p><p><strong>In the wild.</strong> AWS Lambda has the richest feature set, packaging Node.js, Java, or Python code in a ZIP.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Elastic and pay-per-request', content: '<p><strong>Why.</strong> You do not want to provision virtual machines or containers that sit underutilized.</p><p><strong>Claim.</strong> The infrastructure is extremely elastic — it automatically scales to handle the load — and you pay for each request rather than for provisioned capacity.</p><p><strong>Grounding.</strong> The benefits section lists eliminating undifferentiated heavy lifting, automatic elasticity, and per-request payment.</p><p><strong>In the wild.</strong> A spike is absorbed by running more function instances, not by pre-provisioned servers.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Constraints: stateless, few languages, latency risk', content: '<p><strong>Why.</strong> The freedom from servers comes with limits on what you can deploy.</p><p><strong>Claim.</strong> Serverless has far more constraints than VM- or container-based infrastructure: only a few languages, only stateless request-driven applications, and a latency risk when load spikes because capacity cannot be pre-provisioned.</p><p><strong>Grounding.</strong> The drawbacks section lists the language limits, the ban on long-running stateful applications such as databases or message brokers, the limited input sources, and the high-latency risk on sudden spikes.</p><p><strong>In the wild.</strong> A database or a RabbitMQ subscriber does not fit the serverless model.</p>' }
    ]
  },
  quiz: [
    { "question": "What does the serverless deployment infrastructure hide from you?", "options": ["A. Only the networking layer", "B. Any concept of servers — physical or virtual hosts, or containers", "C. Only the database", "D. Only the logging framework"], "answer": 2, "explanation": "The infrastructure hides any concept of servers, including physical or virtual hosts and containers (B). The other options are narrower than what the pattern claims.", "conceptRef": "Hide the servers, run the code, pay per request" },
    { "question": "Which three serverless environments are named in the reference?", "options": ["A. AWS Lambda, Google Cloud Functions, and Azure Functions", "B. Kubernetes, Marathon, and ECS", "C. EC2, S3, and Kinesis", "D. CloudFoundry, Heroku, and OpenShift"], "answer": 1, "explanation": "The reference names AWS Lambda, Google Cloud Functions, and Azure Functions (A), noting AWS Lambda has the richest feature set.", "conceptRef": "Hide the servers, run the code, pay per request" },
    { "question": "How is the cost of a Lambda invocation calculated?", "options": ["A. A flat fee per function", "B. As a function of the duration, measured in 100 ms increments, and the memory consumed", "C. Only by the number of lines of code", "D. Only by the number of HTTP requests"], "answer": 2, "explanation": "Cost is a function of the invocation's duration, measured in 100 millisecond increments, and the memory consumed (B). The other options are not the stated cost model.", "conceptRef": "Constraints: stateless, few languages, latency risk" },
    { "question": "Why can serverless exhibit high latency during sudden load spikes?", "options": ["A. The infrastructure can only react to load and cannot proactively pre-provision capacity", "B. The functions are written in slow languages", "C. The ZIP upload is slow", "D. The bill is computed too slowly"], "answer": 1, "explanation": "A serverless infrastructure can only react to increases in load — you cannot proactively pre-provision capacity — so provisioning and initialization add latency on sudden spikes (A).", "conceptRef": "Constraints: stateless, few languages, latency risk" }
  ]
});
