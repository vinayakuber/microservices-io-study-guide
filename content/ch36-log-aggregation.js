registerChapter({
  id: 'ch36',
  num: 36,
  title: 'Log Aggregation',
  pattern: 'Use a centralized logging service that aggregates logs from every service instance so they can be searched, analyzed, and alerted on.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 36 · microservices.io /patterns/observability/application-logging.html',
  part: 8,
  flow: [
    {
      section: 'Write a structured log line',
      color: 'orange',
      motivation: `Every instance already writes to its own log file, but those files are scattered across machines. A standardized format, with the request id baked in, is what lets one request be reassembled later.`,
      steps: [
        { num: 1, title: 'Write to a log file', detail: 'Each service instance writes information about what it is doing to a log file in a standardized format.' },
        { num: 2, title: 'Record the severity', detail: 'The log file contains errors, warnings, information, and debug messages.' },
        { num: 3, title: 'Tag with the request id', detail: 'Each line includes the external request id so it can be joined to the other lines of the same request.' }
      ],
      program: `// ORDER SERVICE SIDE — one request writes a structured log line tagged with its request id
// PARTIES: SVC = Order Service · U1 = the user whose request this is
// STATE (before):
//    logfile : []                     // this instance's log file, append-only
// DEF: log_request · CALLED BY: SVC handling GET /orders for one request
// -> req_id : "REQ-3001"
//    step 1 · format the line in the standard shape   // line : null -> "10:00:01 INFO order-service REQ-3001 handle /orders"
//    step 2 · append the line to the instance log file   // logfile : [] -> ["10:00:01 INFO order-service REQ-3001 handle /orders"]
//    step 3 · hand the SAME req_id to the downstream call   // forwarded_id : null -> "REQ-3001"
// <- log written : logfile has 1 line tagged "REQ-3001" · the id rides with the request to the next service
//    alt the call errors : line : null -> "10:00:02 ERROR order-service REQ-3001 customer lookup failed"`
    },
    {
      section: 'Ship logs to the centralized service',
      color: 'orange',
      motivation: `A log on a local disk cannot be searched across the fleet. Shipping every instance's lines to one centralized logging service is what turns many files into one queryable index.`,
      steps: [
        { num: 1, title: 'Point at the logging service', detail: 'Use a centralized logging service to aggregate logs from each service instance.' },
        { num: 2, title: 'Forward each line', detail: 'Each instance ships its own log lines to the centralized service as they are written.' },
        { num: 3, title: 'Index by request id', detail: 'The service indexes the lines so one request id gathers its lines from every instance.' }
      ],
      program: `// AGGREGATOR SIDE — three services ship their logs for one request into a single index
// PARTIES: SVC1 = Order Service · SVC2 = Customer Service · SVC3 = Payment Service · LOG = central logging service
// STATE (before):
//    index : {}                       // the central searchable index, empty
// DEF: ship_logs · CALLED BY: LOG collecting each instance's log file
// -> batch : 3 log lines, all tagged "REQ-3001"
//    step 1 · SVC1's line arrives -> "INFO order-service REQ-3001 handle /orders"   // index : {} -> {"REQ-3001":[1]}
//    step 2 · SVC2's line arrives -> "INFO customer-service REQ-3001 lookup customer 42"   // index["REQ-3001"] : [1] -> [1,2]
//    step 3 · SVC3's line arrives -> "INFO payment-service REQ-3001 charge 19.00"   // index["REQ-3001"] : [1,2] -> [1,2,3]
// <- aggregated : index["REQ-3001"] has 3 lines from 3 services · one key reconstructs the whole request
//    alt a second request "REQ-3002" : index : {"REQ-3001":[1,2,3]} -> {"REQ-3001":[1,2,3], "REQ-3002":[1]}`
    },
    {
      section: 'Search across instances',
      color: 'orange',
      motivation: `Understanding behavior means following one request across every service it touched. Search is the operation that turns a request id into the ordered story of that request.`,
      steps: [
        { num: 1, title: 'Query by request id', detail: 'Users search the aggregated logs, often by the external request id.' },
        { num: 2, title: 'Get hits from every instance', detail: 'A single query returns matching lines from all the services that handled the request.' },
        { num: 3, title: 'Order by time', detail: 'The lines are sorted by timestamp to reconstruct the path of the request.' }
      ],
      program: `// DEVELOPER SIDE — one query against the index returns a request's logs in time order
// PARTIES: DEV = developer searching · LOG = central logging service
// STATE (before):
//    index : { "REQ-3001": [1,2,3] }    // 3 lines: order-service, customer-service, payment-service
// DEF: search · CALLED BY: DEV typing the request id into the search UI
// -> query : "REQ-3001"
//    step 1 · match the key "REQ-3001" -> 3 hits   // hits : 0 -> 3
//    step 2 · sort the hits by timestamp   // order : "unsorted" -> "t1, t2, t3"
//    step 3 · render the 3 lines as one path   // view : null -> "order-service -> customer-service -> payment-service"
// <- result : 3 lines across 3 services, in time order · one query shows the whole request path
//    alt query "REQ-9999" : hits : 3 -> 0 -> an empty result, that request was never logged`
    },
    {
      section: 'Alert on patterns, and pay for volume',
      color: 'orange',
      motivation: `You cannot watch logs by hand; alerts fire automatically when a configured message appears. But the volume that makes the index useful is exactly what makes it expensive.`,
      steps: [
        { num: 1, title: 'Configure alerts', detail: 'Users configure alerts that are triggered when certain messages appear in the logs.' },
        { num: 2, title: 'Fire on the pattern', detail: 'When an indexed line matches a configured pattern, the alert fires.' },
        { num: 3, title: 'Provision for volume', detail: 'Handling a large volume of logs requires substantial infrastructure.' }
      ],
      program: `// LOG SERVICE SIDE — an alert fires when a configured message appears in the stream
// PARTIES: LOG = central logging service · DEV = on-call developer
// STATE (before):
//    rules : { "ERROR": {threshold:1, fired:false} }
// DEF: evaluate_alerts · CALLED BY: LOG as each new line is indexed
// -> line : "ERROR order-service REQ-3001 customer lookup failed"
//    step 1 · the configured rule "ERROR" matches this line   // match : false -> true
//    step 2 · bump the ERROR count to its threshold   // count : 0 -> 1
//    step 3 · fire the rule and notify DEV   // rules["ERROR"].fired : false -> true · alert : [] -> ["ERROR from order-service"]
// <- alert : "ERROR from order-service" delivered to DEV · 1 notification for this pattern
//    alt a plain INFO line : match : false -> false, count stays 0, no alert is raised`
    }
  ],
  interview: [
    {
      scenario: 'A request to your order service fans out to the customer service, and each writes to its own log file. Later you need to reconstruct the whole request, but the two files are on two machines with no way to join them.',
      q: 'What must each service instance write to its log file in the Log aggregation pattern, and why is the request id baked into every line?',
      solution: 'Each instance writes to a log file in a standardized format with a severity, and every line carries the external request id so the lines of one request can be joined.',
      components: ['Log file — one per instance', 'Standardized format — same shape', 'Severity — error/warning/info/debug', 'External request id — the join key'],
      diagram: `flowchart LR
  SVC1["Order Service"] -->|"INFO ... REQ-3001"| F1["logfile 1"]
  SVC2["Customer Service"] -->|"INFO ... REQ-3001"| F2["logfile 2"]
  F1 -->|"same id"| J["Join key REQ-3001"]
  F2 -->|"same id"| J`,
      code: `// ORDER SERVICE SIDE — a request crossing two services writes a line in each, all tagged with the same request id
// PARTIES: SVC1 = Order Service · SVC2 = Customer Service · U1 = the user whose request this is
// STATE (before):
//    logfile_1 : []   // SVC1's local file
//    logfile_2 : []   // SVC2's local file
// DEF: log_across_services · CALLED BY: SVC1 then SVC2 for request REQ-3001
// -> req_id : "REQ-3001"
//    step 1 · SVC1 formats its line with severity INFO   // line1 : null -> "INFO order-service REQ-3001 handle /orders"
//    step 2 · SVC1 appends, then forwards the SAME id to SVC2   // logfile_1 : [] -> ["INFO order-service REQ-3001 handle /orders"]
//    step 3 · SVC2 formats its own line with the SAME id   // line2 : null -> "INFO customer-service REQ-3001 lookup customer 42"
//    step 4 · SVC2 appends   // logfile_2 : [] -> ["INFO customer-service REQ-3001 lookup customer 42"]
// <- two lines : logfile_1 has 1 line, logfile_2 has 1 line, both tagged "REQ-3001" · one id joins two files
//    alt no shared id : line2 : null -> "INFO customer-service ??? lookup customer 42" -> the two lines can never be joined`,
      tieback: 'This is the writing stage — a standardized log line, a severity, and the external request id in every message.',
      refs: ['Write a structured log line'],
      problems: ["20-metrics-monitoring"]
    },
    {
      scenario: 'A log on a local disk cannot be searched across the fleet. You have a centralized logging service, and each instance must ship its lines there as they are written.',
      q: 'How do log lines get from each instance into the centralized service, and how does the service index them?',
      solution: 'Each instance ships its own log lines to the centralized logging service as they are written, and the service indexes the lines so one request id gathers its lines.',
      components: ['Centralized logging service', 'Log shipper — per instance', 'Request-id index', 'One key — one request'],
      diagram: `flowchart LR
  SVC["Order Service"] -->|"line1"| LOG["Central logging service"]
  SVC -->|"line2"| LOG
  SVC -->|"line3"| LOG
  LOG -->|"files under"| IDX["index by request id"]`,
      code: `// AGGREGATOR SIDE — one instance ships three lines as they are written, and the central service files them under two request ids
// PARTIES: SVC = Order Service · LOG = central logging service
// STATE (before):
//    index : {}   // the central searchable index, empty
// DEF: ship_stream · CALLED BY: LOG receiving SVC's lines in real time
// -> line1 : "INFO order-service REQ-3001 handle /orders"
//    step 1 · line1 arrives, key it by REQ-3001   // index : {} -> {"REQ-3001":[1]}
//    step 2 · line2 arrives with a NEW id REQ-3002   // index : {"REQ-3001":[1]} -> {"REQ-3001":[1], "REQ-3002":[1]}
//    step 3 · line3 arrives, same id as line1   // index["REQ-3001"] : [1] -> [1,2]
// <- aggregated : index = {"REQ-3001":[1,2], "REQ-3002":[1]} · 3 lines filed under 2 request ids
//    alt line arrives with no id : keyed under "" -> it can never be joined to its request`,
      tieback: 'This is the shipping stage — forwarding each line to the centralized service and indexing it by request id.',
      refs: ['Ship logs to the centralized service'],
      problems: ["20-metrics-monitoring"]
    },
    {
      scenario: 'A request crossed three services and you need to see the whole path. You type the request id into the search UI and expect every instance\'s lines back, in the order they happened.',
      q: 'What does a search of the aggregated logs return, and how is the request path reconstructed?',
      solution: 'A query by the external request id returns matching lines from all the services that handled it, sorted by timestamp to reconstruct the path.',
      components: ['Search UI — the query entry', 'Request-id query', 'Hit set — lines from all instances', 'Time sort — rebuilds the path'],
      diagram: `flowchart LR
  DEV["Developer"] -->|"query REQ-3001"| LOG["Central logging service"]
  LOG -->|"3 hits"| SORT["Sort by timestamp"]
  SORT -->|"ordered path"| VIEW["order -> customer -> payment"]`,
      code: `// DEVELOPER SIDE — one request-id query pulls hits from three instances and returns them in time order
// PARTIES: DEV = developer searching · LOG = central logging service
// STATE (before):
//    index : { "REQ-3001": [3,1,2] }   // 3 lines stored out of time order: payment(3), order(1), customer(2)
// DEF: search · CALLED BY: DEV typing the request id into the search UI
// -> query : "REQ-3001"
//    step 1 · match the key "REQ-3001" -> 3 hits   // hits : 0 -> 3
//    step 2 · sort the 3 hits by their timestamps   // order : [3,1,2] -> [1,2,3]
//    step 3 · reconstruct the path from the sorted lines   // view : null -> "order -> customer -> payment"
// <- result : hits = 3, order = [1,2,3] · the query returns every instance's line, in time order
//    alt query "REQ-9999" : hits : 0 -> 0 -> an empty result, that request was never logged`,
      tieback: 'This is the search stage — querying by request id and ordering the hits by timestamp to rebuild the path.',
      refs: ['Search across instances'],
      problems: ["20-metrics-monitoring"]
    },
    {
      scenario: 'You cannot watch logs by hand, so you configure an alert that fires when ERROR appears. But the volume that makes the index useful is also what makes it expensive.',
      q: 'How do alerts fire in the Log aggregation pattern, and what is the cost of a large log volume?',
      solution: 'Users configure alerts that fire when a message matches a pattern; handling a large volume of logs requires substantial infrastructure.',
      components: ['Configured alert rules', 'Pattern match on each line', 'Notification to on-call', 'Growing index volume'],
      diagram: `flowchart LR
  LOG["Central logging service"] -->|"line ERROR ..."| RULE["rule ERROR threshold 1"]
  RULE -->|"match fires"| DEV["On-call developer"]
  LOG -->|"each line adds"| VOL["index volume 400001"]`,
      code: `// LOG SERVICE SIDE — an alert fires on a configured message, and each new line adds to the volume that demands infrastructure
// PARTIES: LOG = central logging service · DEV = on-call developer
// STATE (before):
//    rules : { "ERROR": {threshold:1, fired:false} }
//    volume : 400000   // lines indexed so far today
// DEF: evaluate_alerts · CALLED BY: LOG as each new line is indexed
// -> line : "ERROR order-service REQ-3001 customer lookup failed"
//    step 1 · the configured rule "ERROR" matches this line   // match : false -> true
//    step 2 · bump the ERROR count to its threshold   // count : 0 -> 1
//    step 3 · fire the rule and notify DEV   // rules["ERROR"].fired : false -> true · alert : [] -> ["ERROR from order-service"]
//    step 4 · this line joins the growing index   // volume : 400000 -> 400001   BECAUSE every indexed line adds to the stored volume
// <- alert : "ERROR from order-service" delivered · volume : 400001 lines · one more line, one more unit of storage and search cost
//    alt a plain INFO line : match : false -> false, count stays 0, no alert raised, but volume still grows`,
      tieback: 'This is the alert-and-volume stage — firing on configured patterns and paying for the infrastructure the volume demands.',
      refs: ['Alert on patterns, and pay for volume'],
      problems: ["20-metrics-monitoring"]
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Logs scattered across machines', content: '<p><strong>Why.</strong> An application is multiple services and instances on multiple machines, and requests often span several instances.</p><p><strong>Claim.</strong> With each instance writing to its own local log file, no one place shows the whole story of an application.</p><p><strong>Grounding.</strong> Each service instance writes information about what it is doing to a log file in a standardized format.</p><p><strong>In the wild.</strong> To understand a request that crossed three services you would otherwise have to read three files on three machines.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Centralized logging service', content: '<p><strong>Why.</strong> Aggregated logs become searchable and analyzable in one place.</p><p><strong>Claim.</strong> Use a centralized logging service that aggregates logs from each service instance; users can search and analyze the logs.</p><p><strong>Grounding.</strong> Users can also configure alerts that are triggered when certain messages appear in the logs.</p><p><strong>In the wild.</strong> AWS CloudWatch is named in the reference as an example of such a service.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Volume costs infrastructure', content: '<p><strong>Why.</strong> Aggregating every line from every instance accumulates a lot of data.</p><p><strong>Claim.</strong> Handling a large volume of logs requires substantial infrastructure.</p><p><strong>Grounding.</strong> The reference lists this as the resulting issue of the pattern.</p><p><strong>In the wild.</strong> Storage, indexing, and search all scale with the number of instances writing lines.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Standardized format plus a request id', content: '<p><strong>Why.</strong> Correlation across services only works if lines can be joined.</p><p><strong>Claim.</strong> A standardized log format, with the external request id in each message, is what lets one request be reassembled.</p><p><strong>Grounding.</strong> Distributed tracing is the related pattern, and the reference says to include the external request id in each log message.</p><p><strong>In the wild.</strong> Each severity (error, warning, information, debug) shares the same shape so one query covers them all.</p>' }
    ]
  },
  quiz: [
    { "question": "What does each service instance write in the Log aggregation pattern?", "options": ["A. A shared database table", "B. A log file in a standardized format", "C. Nothing", "D. Only metrics, never text"], "answer": 2, "explanation": "Each service instance writes information about what it is doing to a log file in a standardized format. A, C, and D contradict the reference.", "conceptRef": "Logs scattered across machines" },
    { "question": "What does the centralized logging service do?", "options": ["A. Aggregates logs from each instance, and users can search and analyze them", "B. Stores logs but offers no search", "C. Sends emails to every user", "D. Replaces the service instances"], "answer": 1, "explanation": "The solution is a centralized logging service that aggregates logs from each instance; users can search and analyze the logs, and configure alerts. B, C, and D are not the described behavior.", "conceptRef": "Centralized logging service" },
    { "question": "Which related pattern helps join one request's log lines across services?", "options": ["A. Distributed tracing, by including the external request id in each log message", "B. Circuit breaker", "C. API gateway", "D. Saga"], "answer": 1, "explanation": "The related Distributed tracing pattern says to include the external request id in each log message, which is what lets lines from different services be joined. B, C, and D do not address log correlation.", "conceptRef": "Standardized format plus a request id" },
    { "question": "What issue results from aggregating a large volume of logs?", "options": ["A. Logs become free to store", "B. Handling a large volume of logs requires substantial infrastructure", "C. Logs can no longer be aggregated", "D. Services must stop logging"], "answer": 2, "explanation": "The reference lists the substantial infrastructure requirement as the resulting issue. A, C, and D are not in the reference.", "conceptRef": "Volume costs infrastructure" }
  ]
});
