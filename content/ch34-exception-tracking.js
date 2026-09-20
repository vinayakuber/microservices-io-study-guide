registerChapter({
  id: 'ch34',
  num: 34,
  title: 'Exception Tracking',
  pattern: 'Report all exceptions to a centralized service that aggregates, de-duplicates, and tracks them and notifies developers.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 34 · microservices.io /patterns/observability/exception-tracking.html',
  part: 8,
  flow: [
    {
      section: 'Capture the exception',
      color: 'orange',
      motivation: `A service throws an exception the moment a request fails; unless something captures the error message and the stack trace right there, the failure is invisible across a fleet of machines. Capturing at the source is what makes every later step possible.`,
      steps: [
        { num: 1, title: 'Throw on failure', detail: 'A service instance handling a request throws an exception when an error occurs.' },
        { num: 2, title: 'Carry message and stack trace', detail: 'The exception object holds an error message and a stack trace; both are the raw material for debugging.' },
        { num: 3, title: 'Catch in the handler', detail: 'The handler catches the exception and packages the message plus the stack trace into a reportable record.' }
      ],
      program: `// ORDER SERVICE SIDE — one request throws; the handler captures the message and stack trace
// PARTIES: SVC = Order Service instance · U1 = the user making the request
// STATE (before):
//    req : { id:"REQ-2001", path:"/orders", status:"OPEN" }
//    report : {}                       // the captured exception, empty until the throw
// DEF: handle_request · CALLED BY: U1 submitting GET /orders with id REQ-2001
// -> req_id : "REQ-2001"
//    step 1 · look up the customer -> null   // req : {status:"OPEN"} -> {status:"FAILED"}
//    step 2 · throw NullPointerException("customer is null")   // err : null -> "customer is null"
//    step 3 · catch in the handler, capture message + stack trace   // report : {} -> {msg:"customer is null", stack:"SVC.doGet line 42", ts:19}
// <- exception : report = {msg:"customer is null", stack:"SVC.doGet line 42", ts:19} · 1 exception now in hand
//    alt no catch in place : the thread dies with no record -> the error is invisible to everyone`
    },
    {
      section: 'Report to a centralized tracker',
      color: 'orange',
      motivation: `One instance's log is not a place developers watch; a centralized exception tracking service is. Reporting every exception to that service is the whole point of the pattern.`,
      steps: [
        { num: 1, title: 'Point at the tracking service', detail: 'The service sends each caught exception to the centralized exception tracking service.' },
        { num: 2, title: 'Send message and stack trace', detail: 'The report carries the error message and the stack trace so the tracker can group and display them.' },
        { num: 3, title: 'Get an acknowledgement', detail: 'The service receives an acknowledgement once the tracker has stored the exception.' },
        { num: 4, title: 'Also log it', detail: 'Exceptions should be logged as well as reported to the tracking service, pairing this pattern with Log aggregation.' }
      ],
      program: `// ORDER SERVICE SIDE — the captured exception is reported to the centralized tracker
// PARTIES: SVC = Order Service instance · TRK = centralized exception tracking service
// STATE (before):
//    report : { id:"EX-1001", msg:"customer is null", stack:"SVC.doGet line 42", ts:19 }
//    sent : false                      // the report has not been transmitted yet
// DEF: report_exception · CALLED BY: the handler, right after it catches, over HTTP
// -> ex_id : "EX-1001"
//    step 1 · serialize the report into the request body   // payload : {} -> {id:"EX-1001", msg:"customer is null", stack:"SVC.doGet line 42"}
//    step 2 · POST /exceptions to TRK -> TRK stores the exception   // tracker : [] -> ["EX-1001"]
//    step 3 · TRK returns 200, SVC marks it sent   // sent : false -> true
// <- ack : "EX-1001 stored" · the exception now lives in the central tracker, not just the local service
//    alt TRK unreachable : SVC still writes the same line to its local log file -> Log aggregation (ch36) keeps a copy`
    },
    {
      section: 'De-duplicate and aggregate',
      color: 'orange',
      motivation: `The same bug can throw thousands of times across many instances. If each throw becomes a separate row, the noise buries the signal; de-duplication collapses repeats into one tracked issue.`,
      steps: [
        { num: 1, title: 'Fingerprint by stack trace', detail: 'The tracker keys each exception on a fingerprint of its stack trace.' },
        { num: 2, title: 'Create the issue on first sight', detail: 'The first report with a new fingerprint creates a new tracked issue.' },
        { num: 3, title: 'Increment on repeat', detail: 'Later reports with the same fingerprint are folded into the existing issue instead of creating a new one.' },
        { num: 4, title: 'Track resolution state', detail: 'The issue records its state so developers can track it from open to resolved.' }
      ],
      program: `// TRACKER SIDE — two instances of the same bug collapse into a single tracked issue
// PARTIES: SVC1 = Order Service instance 1 · SVC2 = Order Service instance 2 · TRK = exception tracking service
// STATE (before):
//    issues : {}                     // fingerprint -> issue map, the tracker's store, empty
// DEF: ingest · CALLED BY: TRK for each reported exception, keyed on the stack-trace hash
// -> ex1 : { id:"EX-1001", msg:"customer is null", fp:"FP-77A3" }
//    step 1 · hash the stack trace into a fingerprint   // fp : null -> "FP-77A3"
//    step 2 · look up issues["FP-77A3"] -> not found, so create the issue   // issues : {} -> {"FP-77A3":{count:1}}
//    step 3 · later SVC2 reports the same bug, fp "FP-77A3" -> seen, so increment   // issues["FP-77A3"].count : 1 -> 2
// <- aggregate : issues = {"FP-77A3": {count:2, msg:"customer is null"}} · 2 exceptions deduplicated into 1 issue
//    alt a new fingerprint "FP-1B20" : issues : {"FP-77A3":{count:2}} -> {"FP-77A3":{count:2}, "FP-1B20":{count:1}} · a 2nd distinct issue`
    },
    {
      section: 'Notify developers and resolve',
      color: 'orange',
      motivation: `Aggregation alone does not fix anything; a human has to investigate and close the issue. Notifying developers and recording resolution turns a pile of exceptions into a fixed product.`,
      steps: [
        { num: 1, title: 'Notify on the issue', detail: 'The tracking service notifies developers when an issue needs attention.' },
        { num: 2, title: 'Investigate', detail: 'A developer reads the error message and the stack trace to find the underlying cause.' },
        { num: 3, title: 'Resolve the underlying issue', detail: 'The developer fixes the cause and marks the issue resolved.' }
      ],
      program: `// TRACKER SIDE — a crossing issue notifies a developer, who investigates and resolves it
// PARTIES: TRK = exception tracking service · DEV = the developer on call
// STATE (before):
//    issue : { fp:"FP-77A3", count:2, msg:"customer is null", state:"OPEN" }
//    alert : []                        // notifications sent, none yet
// DEF: notify_and_resolve · CALLED BY: TRK when an issue's count crosses the threshold 1
// -> issue_fp : "FP-77A3"
//    step 1 · count 2 crosses threshold 1 -> notify DEV   // alert : [] -> ["FP-77A3 -> DEV"]
//    step 2 · DEV investigates, finds the null-customer path, commits a fix   // fix : null -> "commit-9f2c"
//    step 3 · DEV marks the issue resolved   // issue.state : "OPEN" -> "RESOLVED"
// <- resolution : issue.state = "RESOLVED" · the underlying issue is closed, not just the symptom logged
//    alt the bug reappears : a new report with fp "FP-77A3" -> count : 2 -> 3 and state : "RESOLVED" -> "OPEN"`
    }
  ],
  interview: [
    {
      scenario: 'Your order service runs as many instances across many machines, and one instance starts failing whenever it looks up a customer that is missing from the database. You need the message and the stack trace captured at the moment of the throw, not reconstructed later.',
      q: 'Walk me through the first stage of Exception tracking — what does a service instance throw, and what exactly does the handler capture from it?',
      solution: 'The handler catches the exception and packages its error message plus the stack trace into a reportable record at the source, before anything is lost.',
      components: ['Order Service instance — throws and catches', 'Exception object — error message + stack trace', 'Handler catch block — packages the record', 'Report record — msg + stack + timestamp'],
      diagram: `flowchart LR
  U1["User calls GET /orders REQ-7001"] -->|"throws"| E["Exception: customer is null"]
  E -->|"caught"| H["Handler catch block"]
  H -->|"packages"| R["Report msg + stack + ts"]`,
      code: `// ORDER SERVICE SIDE — one request throws, and the handler captures the message plus stack trace before the thread dies
// PARTIES: SVC = Order Service instance · U1 = the user calling the service · DB = PostgreSQL 16 @ orders-db-1 (the table returns no row)
// STATE (before):
//    req : { id:"REQ-7001", path:"/orders", status:"OPEN" }
//    report : {}
// DEF: handle_request · CALLED BY: U1 submitting GET /orders with id REQ-7001
// -> req_id : "REQ-7001"
//    step 1 · query the customer row for REQ-7001 -> none   // lookup : "pending" -> null   BECAUSE DB holds no row for REQ-7001
//    step 2 · throw NullPointerException("customer is null")   // err : null -> "customer is null"
//    step 3 · catch in the handler, capture message + stack trace   // report : {} -> {msg:"customer is null", stack:"SVC.doGet line 42", ts:19}
// <- captured : report = {msg:"customer is null", stack:"SVC.doGet line 42", ts:19} · 1 exception now held for reporting
//    alt no catch block : the thread dies, report stays {} -> the failure is invisible to every later step`,
      tieback: 'This is the capture stage of Exception tracking — the throw, the message-plus-stack-trace, and the handler that packages them.',
      refs: ['Capture the exception'],
      problems: ["20-metrics-monitoring"]
    },
    {
      scenario: 'A single instance\'s log file is not where your developers look, so you stand up a centralized exception tracking service. Every caught exception must reach it without slowing down the request path it is observing.',
      q: 'How does a service report a captured exception to the centralized tracker, and why is the exception also written to the local log?',
      solution: 'The service POSTs the message plus stack trace to the tracking service, receives an acknowledgement, and also writes the same line to its local log so Log aggregation keeps a copy.',
      components: ['Order Service — the sender', 'Exception tracking service — the receiver', 'HTTP POST /exceptions — the transport', 'Local log file — the secondary copy'],
      diagram: `flowchart LR
  SVC["Order Service"] -->|"POST /exceptions"| TRK["Exception tracking service"]
  TRK -->|"200 stored"| SVC
  SVC -->|"also writes"| LOG["Local log file"]`,
      code: `// ORDER SERVICE SIDE — the captured exception is POSTed to the centralized tracker and also written to the local log
// PARTIES: SVC = Order Service instance · TRK = exception tracking service
// STATE (before):
//    report : { id:"EX-7001", msg:"customer is null", stack:"SVC.doGet line 42", ts:19 }
//    sent : false
//    logfile : []
// DEF: report_exception · CALLED BY: the handler right after it catches, over HTTP
// -> ex_id : "EX-7001"
//    step 1 · serialize the report into a request body   // payload : {} -> {id:"EX-7001", msg:"customer is null", stack:"SVC.doGet line 42"}
//    step 2 · POST /exceptions to TRK -> stored   // tracker_store : [] -> ["EX-7001"]
//    step 3 · TRK returns 200, SVC marks it sent   // sent : false -> true
//    step 4 · also write the line to the local log   // logfile : [] -> ["EX-7001 customer is null"]
// <- ack : "EX-7001 stored" · the exception now lives in the central tracker AND the local log
//    alt TRK unreachable : POST fails, sent stays false, but logfile still gains the line -> Log aggregation keeps a copy`,
      tieback: 'This is the report stage — pointing the service at the centralized tracker, sending the message plus stack trace, and acknowledging it.',
      refs: ['Report to a centralized tracker'],
      problems: ["20-metrics-monitoring"]
    },
    {
      scenario: 'The same null-customer bug is firing across hundreds of instances, and if every throw becomes its own row, the noise buries the signal. Your tracker must collapse all the repeats into a single issue.',
      q: 'How does the centralized tracker de-duplicate exceptions — what is the key it fingerprints on, and what happens on the first sighting versus a repeat?',
      solution: 'The tracker fingerprints each exception by its stack trace, creates a tracked issue on the first sighting, and increments the same issue on every later report with the same fingerprint.',
      components: ['Stack-trace fingerprint — the dedup key', 'Issue store — fingerprint to count map', 'First sighting — creates the issue', 'Repeat — increments the count'],
      diagram: `flowchart LR
  SVC1["Instance 1 report"] -->|"fp FP-77A3"| TRK["Tracker issues map"]
  SVC2["Instance 2 report"] -->|"fp FP-77A3"| TRK
  TRK -->|"create then increment"| I["Issue FP-77A3 count 2"]`,
      code: `// TRACKER SIDE — two instances of the same bug collapse into one tracked issue keyed on the stack-trace fingerprint
// PARTIES: SVC1 = Order Service instance 1 · SVC2 = Order Service instance 2 · TRK = exception tracking service
// STATE (before):
//    issues : {}   // fingerprint -> issue map, the tracker's store, empty
// DEF: ingest · CALLED BY: TRK for each reported exception, keyed on the stack-trace hash
// -> ex1 : { id:"EX-7001", msg:"customer is null", fp:"FP-77A3" }
//    step 1 · hash the stack trace into a fingerprint   // fp : null -> "FP-77A3"
//    step 2 · look up issues["FP-77A3"] -> not found, so create the issue   // issues : {} -> {"FP-77A3":{count:1, state:"OPEN"}}
//    step 3 · later SVC2 reports the SAME bug with fp "FP-77A3" -> seen, so increment   // issues["FP-77A3"].count : 1 -> 2
// <- aggregate : issues = {"FP-77A3":{count:2, state:"OPEN"}} · 2 exceptions deduplicated into 1 issue
//    alt a new fingerprint "FP-1B20" : issues : {"FP-77A3":{count:2}} -> {"FP-77A3":{count:2}, "FP-1B20":{count:1}} · a 2nd distinct issue`,
      tieback: 'This is the de-duplication and aggregation stage — fingerprinting by stack trace, creating on first sight, and incrementing on repeat.',
      refs: ['De-duplicate and aggregate'],
      problems: ["20-metrics-monitoring"]
    },
    {
      scenario: 'An aggregated issue is still not fixed until a human sees it. Your tracker should wake someone when an issue crosses a threshold, and record when the underlying bug is actually closed.',
      q: 'After aggregation, how does Exception tracking turn a pile of exceptions into a fixed product — what notifies the developer and what marks the issue resolved?',
      solution: 'The tracker notifies a developer when an issue needs attention; the developer investigates the message and stack trace, fixes the underlying cause, and marks the issue resolved.',
      components: ['Threshold crossing — triggers the notify', 'Notification — to the on-call developer', 'Investigation — reads msg + stack trace', 'Resolution state — OPEN to RESOLVED'],
      diagram: `flowchart LR
  TRK["Tracker issue count 2"] -->|"crosses threshold 1"| DEV["On-call developer"]
  DEV -->|"commits fix"| FIX["commit-9f2c"]
  FIX -->|"marks"| RES["state RESOLVED"]`,
      code: `// TRACKER SIDE — an issue whose count crosses the threshold notifies the developer, who fixes and resolves it
// PARTIES: TRK = exception tracking service · DEV = the on-call developer
// STATE (before):
//    issue : { fp:"FP-77A3", count:2, state:"OPEN" }
//    alert : []
// DEF: notify_and_resolve · CALLED BY: TRK when an issue's count crosses the threshold 1
// -> issue_fp : "FP-77A3"
//    step 1 · count 2 crosses threshold 1 -> notify DEV   // alert : [] -> ["FP-77A3 -> DEV"]
//    step 2 · DEV reads the message and stack, finds the null-customer path, commits a fix   // fix : null -> "commit-9f2c"
//    step 3 · DEV marks the issue resolved   // issue.state : "OPEN" -> "RESOLVED"
// <- resolution : issue.state = "RESOLVED" · the underlying bug is closed, not just the symptom logged
//    alt the bug reappears : a new report with fp "FP-77A3" -> count : 2 -> 3 and state : "RESOLVED" -> "OPEN"`,
      tieback: 'This is the final stage — notifying developers, investigating, and resolving the underlying issue.',
      refs: ['Notify developers and resolve'],
      problems: ["20-metrics-monitoring"]
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Scattered exceptions with no view', content: '<p><strong>Why.</strong> A microservice application is many services and instances on many machines, and errors occur while handling requests.</p><p><strong>Claim.</strong> Without a shared place for them, the exceptions those errors throw cannot be seen or tracked as a whole.</p><p><strong>Grounding.</strong> Each failing instance throws an exception carrying an error message and a stack trace, but nothing aggregates them.</p><p><strong>In the wild.</strong> The context is an application of multiple services and instances running on multiple machines, so exceptions are thrown in many places at once.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Centralized exception tracking service', content: '<p><strong>Why.</strong> Developers need one place to see every exception and follow each one to resolution.</p><p><strong>Claim.</strong> Report all exceptions to a centralized exception tracking service that aggregates and tracks them and notifies developers.</p><p><strong>Grounding.</strong> The service de-duplicates and records exceptions so developers can investigate and resolve the underlying issue.</p><p><strong>In the wild.</strong> Exceptions are logged as well as reported to the tracking service, pairing this pattern with Log aggregation.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'One more service to run', content: '<p><strong>Why.</strong> A central tracker is a distinct piece of software that must be provisioned and operated.</p><p><strong>Claim.</strong> The exception tracking service is additional infrastructure.</p><p><strong>Grounding.</strong> The reference lists this as the stated drawback of the pattern.</p><p><strong>In the wild.</strong> You trade a self-contained service for the ability to view exceptions and track their resolution.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Overhead must stay minimal', content: '<p><strong>Why.</strong> Reporting must not slow down the request path it is observing.</p><p><strong>Claim.</strong> Any solution should have minimal runtime overhead.</p><p><strong>Grounding.</strong> This is a stated force: exceptions are de-duplicated, recorded, investigated, and resolved, all without taxing the hot path.</p><p><strong>In the wild.</strong> The pattern reports a lightweight record (message plus stack trace) rather than heavy state, so a service keeps handling requests.</p>' }
    ]
  },
  quiz: [
    { "question": "What does the Exception tracking pattern report to a centralized service?", "options": ["A. Every successful response a service sends", "B. All exceptions, carrying an error message and a stack trace", "C. Only HTTP 500 responses", "D. The size of each log file"], "answer": 2, "explanation": "A service instance throws an exception that contains an error message and a stack trace, and the pattern reports all exceptions to the centralized tracking service. A and C are wrong because the pattern reports exceptions, not normal responses or status codes. D is wrong because log-file size is not part of the pattern.", "conceptRef": "Centralized exception tracking service" },
    { "question": "What must happen to exceptions after they reach the tracker?", "options": ["A. They are de-duplicated, recorded, investigated, and the underlying issue resolved", "B. They are encrypted and archived permanently", "C. They are replayed to end users", "D. They are deleted after one day"], "answer": 1, "explanation": "The reference states exceptions must be de-duplicated, recorded, investigated by developers, and the underlying issue resolved. B, C, and D describe actions the pattern does not require.", "conceptRef": "Centralized exception tracking service" },
    { "question": "Which is a stated drawback of Exception tracking?", "options": ["A. It raises runtime overhead on every request", "B. The exception tracking service is additional infrastructure", "C. It removes stack traces from errors", "D. It forces a monolithic deployment"], "answer": 2, "explanation": "The reference lists the additional infrastructure as the drawback. A is wrong because the pattern demands minimal runtime overhead. C and D are not in the reference.", "conceptRef": "One more service to run" },
    { "question": "How should Exception tracking relate to logging?", "options": ["A. Exceptions replace all logging", "B. Exceptions should be logged as well as reported to a tracking service", "C. Exceptions must never be logged", "D. Only stack traces are logged, never messages"], "answer": 2, "explanation": "The related Log aggregation pattern states exceptions should be logged as well as reported to a tracking service. A, C, and D contradict that guidance.", "conceptRef": "Centralized exception tracking service" }
  ]
});
