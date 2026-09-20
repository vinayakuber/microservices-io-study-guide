registerChapter({
  id: 'ch07',
  num: 7,
  title: 'Circuit Breaker',
  pattern: 'A proxy that trips after consecutive failures, fails fast during a timeout, and probes before resuming.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 7 · microservices.io /patterns/reliability/circuit-breaker.html',
  part: 2,
  flow: [
    {
      section: 'Trip on consecutive failures',
      color: 'orange',
      motivation: `A cascade starts when a caller keeps waiting on a dead service; the breaker counts failures and opens once they cross a threshold.`,
      steps: [
        { num: 1, title: 'Count consecutive failures', detail: 'The proxy increments a counter on each failed call.' },
        { num: 2, title: 'Cross the threshold', detail: 'When the count crosses the threshold, the breaker trips.' },
        { num: 3, title: 'Open the circuit', detail: 'For the timeout period, all attempts fail immediately.' }
      ],
      program: `// PROXY SIDE — CLOSED state: a breaker trips when consecutive failures cross the threshold
// PARTIES: CLIENT = caller thread · PROXY = circuit breaker · SVC = remote service (down)
// STATE (before):
//    breaker : { state: "CLOSED", consecutive_failures: 0, threshold: 3, timeout_s: 60 }
//    remote_calls : 0
// DEF: forward · CALLED BY: CLIENT, three requests in a row at 00:00:00, 00:00:01, 00:00:02
// -> request : "get-user-1"
//    step 1 · PROXY forwards the call to SVC    : remote_calls : 0 -> 1
//    step 2 · SVC is down; a failure is counted : consecutive_failures : 0 -> 1
//    step 3 · the second call fails             : consecutive_failures : 1 -> 2
//    step 4 · the third call hits the threshold : consecutive_failures : 2 -> 3  BECAUSE 3 >= threshold 3
//    step 5 · PROXY opens the circuit           : state : "CLOSED" -> "OPEN"
// <- verdict : "OPEN" tripped at 00:00:02 · every later attempt fails immediately for the timeout`
    },
    {
      section: 'Fail fast while open',
      color: 'orange',
      motivation: `While open, no thread is wasted on the dead service: attempts fail immediately instead of blocking.`,
      steps: [
        { num: 1, title: 'Reject without calling', detail: 'Attempts to invoke the remote service fail immediately.' },
        { num: 2, title: 'Protect the caller', detail: 'Threads are not consumed waiting for an unresponsive service.' },
        { num: 3, title: 'Stop the cascade', detail: 'The failure of one service no longer drains the services that call it.' }
      ],
      program: `// PROXY SIDE — OPEN state: while open, every attempt fails immediately, so SVC is never touched
// PARTIES: CLIENT = caller thread · PROXY = circuit breaker · SVC = remote service (down)
// STATE (before):
//    breaker : { state: "OPEN", timeout_s: 60, opened_at: "00:00:02" }
//    attempts : 0
//    svc_calls : 0
//    elapsed : 0
// DEF: reject · CALLED BY: CLIENT, requests arriving at 00:00:10 and 00:00:30 inside the 60 s window
// -> request : "get-user-2" at 00:00:10
//    step 1 · PROXY sees the window is not over : elapsed : 0 -> 8  BECAUSE 00:00:10 - 00:00:02 = 8 s < 60 s
//    step 2 · PROXY rejects without touching SVC : attempts : 0 -> 1
//    step 3 · a second request also fails fast   : attempts : 1 -> 2
//    step 4 · SVC received nothing               : svc_calls : 0 -> 0  BECAUSE the breaker short-circuits
// <- verdict : "FAIL_FAST" twice (00:00:10, 00:00:30) · threads freed at once, SVC untouched`
    },
    {
      section: 'Probe in half-open',
      color: 'orange',
      motivation: `After the timeout the breaker lets a limited number of test requests through; their outcome decides recovery or another timeout.`,
      steps: [
        { num: 1, title: 'Timeout expires', detail: 'The breaker allows a limited number of test requests to pass through.' },
        { num: 2, title: 'Success resumes operation', detail: 'If those requests succeed, the breaker resumes normal operation.' },
        { num: 3, title: 'Failure restarts the timeout', detail: 'If there is a failure, the timeout period begins again.' }
      ],
      program: `// PROXY SIDE — HALF-OPEN state: after the timeout, one test request is allowed through
// PARTIES: CLIENT = caller thread · PROXY = circuit breaker · SVC = remote service (recovered)
// STATE (before):
//    breaker : { state: "OPEN", consecutive_failures: 3, timeout_s: 60, opened_at: "00:00:02", probe_count: 0 }
//    reply : null
// DEF: probe · CALLED BY: CLIENT, the first request after the timeout, at 00:01:02
// -> request : "get-user-3" at 00:01:02
//    step 1 · the timeout has expired           : state : "OPEN" -> "HALF-OPEN"  BECAUSE 00:01:02 - 00:00:02 = 60 s >= 60 s
//    step 2 · PROXY lets the test request pass  : probe_count : 0 -> 1
//    step 3 · SVC answers OK this time          : reply : null -> "user-3"
//    step 4 · success resumes normal operation  : state : "HALF-OPEN" -> "CLOSED"
//    step 5 · the failure counter resets        : consecutive_failures : 3 -> 0
// <- verdict : "CLOSED" resumed at 00:01:02 · normal operation restored
//    alt test request fails : state : "HALF-OPEN" -> "OPEN"  BECAUSE the timeout period begins again`
    },
    {
      section: 'Tune thresholds carefully',
      color: 'orange',
      motivation: `Choosing timeout values is hard: too tight creates false positives, too loose hides real outages behind latency.`,
      steps: [
        { num: 1, title: 'False positives', detail: 'A too-short timeout trips on a healthy but slow service.' },
        { num: 2, title: 'Excessive latency', detail: 'A too-long timeout delays detection of a real failure.' },
        { num: 3, title: 'The one hard dial', detail: 'The challenge is choosing values without false positives or excessive latency.' }
      ],
      program: `// PROXY SIDE — tuning: a too-short timeout marks a healthy but slow service as failed
// PARTIES: CLIENT = caller thread · PROXY = circuit breaker · SVC = remote service (slow but alive)
// STATE (before):
//    breaker : { state: "CLOSED", consecutive_failures: 0, threshold: 3, timeout_ms: 200 }
//    remote_calls : 0
//    verdict : "UNSET"
//    reply : null
//    avg_latency_ms : 450
// DEF: call · CALLED BY: CLIENT, a request against a service that answers in about 450 ms
// -> request : "get-user-4"
//    step 1 · PROXY forwards the call          : remote_calls : 0 -> 1
//    step 2 · SVC is alive but needs 450 ms     : reply : null -> "user-4" at 450 ms
//    step 3 · PROXY gave up at 200 ms           : verdict : "UNSET" -> "TIMEOUT"  BECAUSE 450 ms > timeout_ms 200
//    step 4 · the timeout counts as a failure   : consecutive_failures : 0 -> 1
// <- verdict : "TIMEOUT" recorded as a failure · a healthy service is marked down, a false positive
//    alt timeout too long : 5000 ms waits through real outages  BECAUSE excessive latency hides the failure`
    }
  ],
  interview: [
    {
      scenario: "A checkout service calls a payments service that has died. Calls keep arriving, and the breaker must stop the cascade before it spreads.",
      q: "What makes a circuit breaker trip, and what happens once it does?",
      solution: "The proxy counts consecutive failures; when the count crosses a threshold it trips, and for the timeout period all attempts fail immediately.",
      components: ["Failure counter", "Threshold", "Tripped (OPEN) state", "Immediate rejection"],
      diagram: `flowchart LR
  C["Checkout"] --> P["breaker proxy"]
  P -->|"fails"| SVC["Payments (down)"]
  P --> O["OPEN when failures >= threshold"]`,
      code: `// PROXY SIDE — CLOSED state: a breaker trips when consecutive failures cross the threshold
// PARTIES: CLIENT = caller thread · PROXY = circuit breaker · SVC = remote service (down)
// STATE (before):
//    breaker : { state: "CLOSED", consecutive_failures: 0, threshold: 4, timeout_s: 60 }
//    remote_calls : 0
// DEF: forward · CALLED BY: CLIENT, four requests in a row at 00:00:00, 00:00:01, 00:00:02, 00:00:03
// -> request : "charge-card-1"
//    step 1 · PROXY forwards the call to SVC : remote_calls : 0 -> 1
//    step 2 · SVC is down; a failure is counted : consecutive_failures : 0 -> 1
//    step 3 · the second call fails : consecutive_failures : 1 -> 2
//    step 4 · the third call fails : consecutive_failures : 2 -> 3
//    step 5 · the fourth call hits the threshold : consecutive_failures : 3 -> 4  BECAUSE 4 >= threshold 4
//    step 6 · PROXY opens the circuit : state : "CLOSED" -> "OPEN"
// <- verdict : "OPEN" tripped at 00:00:03 · every later attempt fails immediately for the timeout`,
      tieback: "This is exactly the trip-on-consecutive-failures mechanism in this chapter.",
      refs: ["Trip on consecutive failures"],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    },
    {
      scenario: "The payments service is down and the breaker has tripped. New checkout requests keep arriving within the timeout window.",
      q: "While the breaker is open, what happens to incoming attempts, and why does it stop the cascade?",
      solution: "Attempts fail immediately without calling the service, so threads are not consumed waiting, and the failure of one service no longer drains its callers.",
      components: ["Open breaker", "Fail-fast rejection", "Protected caller threads"],
      diagram: `flowchart LR
  C["Checkout"] --> P["breaker (OPEN)"]
  P -. "fail fast" .-> C
  P -. "never calls" .- SVC["Payments (down)"]`,
      code: `// PROXY SIDE — OPEN state: while open, every attempt fails immediately, so SVC is never touched
// PARTIES: CLIENT = caller thread · PROXY = circuit breaker · SVC = remote service (down)
// STATE (before):
//    breaker : { state: "OPEN", timeout_s: 60, opened_at: "00:00:03" }
//    attempts : 0
//    svc_calls : 0
//    elapsed : 0
// DEF: reject · CALLED BY: CLIENT, requests arriving at 00:00:10 and 00:00:30 inside the 60 s window
// -> request : "charge-card-2" at 00:00:10
//    step 1 · PROXY sees the window is not over : elapsed : 0 -> 7  BECAUSE 00:00:10 - 00:00:03 = 7 s < 60 s
//    step 2 · PROXY rejects without touching SVC : attempts : 0 -> 1
//    step 3 · a second request also fails fast : attempts : 1 -> 2
//    step 4 · SVC received nothing : svc_calls : 0 -> 0  BECAUSE the breaker short-circuits
// <- verdict : "FAIL_FAST" twice (00:00:10, 00:00:30) · threads freed at once, SVC untouched`,
      tieback: "This is exactly the fail-fast-while-open behavior in this chapter.",
      refs: ["Fail fast while open"],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    },
    {
      scenario: "The payments service has recovered, but the breaker is still open. The timeout is about to expire and the team watches the first request after it.",
      q: "What does the breaker do in the half-open state, and how do the probe's outcomes decide recovery or re-trip?",
      solution: "After the timeout it lets a limited number of test requests through; success resumes normal operation, and a failure restarts the timeout period.",
      components: ["Timeout expiry", "Limited test requests", "Resume on success", "Re-trip on failure"],
      diagram: `flowchart LR
  O["OPEN"] -->|"timeout expires"| H["HALF-OPEN"]
  H -->|"probe succeeds"| C["CLOSED"]
  H -->|"probe fails"| O`,
      code: `// PROXY SIDE — HALF-OPEN state: after the timeout, one test request is allowed through
// PARTIES: CLIENT = caller thread · PROXY = circuit breaker · SVC = remote service (recovered)
// STATE (before):
//    breaker : { state: "OPEN", consecutive_failures: 4, timeout_s: 60, opened_at: "00:00:03", probe_count: 0 }
//    reply : null
// DEF: probe · CALLED BY: CLIENT, the first request after the timeout, at 00:01:03
// -> request : "charge-card-3" at 00:01:03
//    step 1 · the timeout has expired : state : "OPEN" -> "HALF-OPEN"  BECAUSE 00:01:03 - 00:00:03 = 60 s >= 60 s
//    step 2 · PROXY lets the test request pass : probe_count : 0 -> 1
//    step 3 · SVC answers OK this time : reply : null -> "approved"
//    step 4 · success resumes normal operation : state : "HALF-OPEN" -> "CLOSED"
//    step 5 · the failure counter resets : consecutive_failures : 4 -> 0
// <- verdict : "CLOSED" resumed at 00:01:03 · normal operation restored
//    alt test request fails : state : "HALF-OPEN" -> "OPEN"  BECAUSE the timeout period begins again`,
      tieback: "This is exactly the half-open probe and its two outcomes in this chapter.",
      refs: ["Probe in half-open"],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    },
    {
      scenario: "The team sets a 250 ms timeout, but the payments service reliably answers in about 600 ms even when healthy.",
      q: "What is the one hard dial in a circuit breaker, and what are the two failure modes of tuning it wrong?",
      solution: "Choosing timeout values is the challenge: too short creates false positives on a healthy but slow service, and too long hides real outages behind latency.",
      components: ["Timeout threshold", "False positives", "Excessive latency"],
      diagram: `flowchart LR
  T["timeout 250ms"] --> FP["false positive (healthy 600ms marked down)"]
  T2["timeout 5000ms"] --> EL["excessive latency (real outage hidden)"]`,
      code: `// PROXY SIDE — tuning: a too-short timeout marks a healthy but slow service as failed
// PARTIES: CLIENT = caller thread · PROXY = circuit breaker · SVC = remote service (slow but alive)
// STATE (before):
//    breaker : { state: "CLOSED", consecutive_failures: 0, threshold: 4, timeout_ms: 250 }
//    remote_calls : 0
//    verdict : "UNSET"
//    reply : null
//    avg_latency_ms : 600
// DEF: call · CALLED BY: CLIENT, a request against a service that answers in about 600 ms
// -> request : "charge-card-4"
//    step 1 · PROXY forwards the call : remote_calls : 0 -> 1
//    step 2 · SVC is alive but needs 600 ms : reply : null -> "approved" at 600 ms
//    step 3 · PROXY gave up at 250 ms : verdict : "UNSET" -> "TIMEOUT"  BECAUSE 600 ms > timeout_ms 250
//    step 4 · the timeout counts as a failure : consecutive_failures : 0 -> 1
// <- verdict : "TIMEOUT" recorded as a failure · a healthy service is marked down, a false positive
//    alt timeout too long : 5000 ms waits through real outages  BECAUSE excessive latency hides the failure`,
      tieback: "This is exactly the threshold-tuning tradeoff in this chapter.",
      refs: ["Tune thresholds carefully"],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Cascading failure', content: '<p><strong>Why.</strong> A slow or dead service makes callers wait, and waiting callers burn their own capacity.</p><p><strong>Claim.</strong> Threads are consumed while waiting for an unresponsive service, causing resource exhaustion that cascades failure across the application.</p><p><strong>Grounding.</strong> The context warns that precious resources such as threads are consumed, leading to resource exhaustion and cascading failure.</p><p><strong>In the wild.</strong> One dead checkout service saturates every upstream service that calls it, taking the whole site down.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Breaker proxy', content: '<p><strong>Why.</strong> The caller should stop hitting a service that is already failing.</p><p><strong>Claim.</strong> The client invokes a remote service through a proxy that trips after a threshold of consecutive failures, fails fast for a timeout, then lets test requests through.</p><p><strong>Grounding.</strong> The solution: a proxy like an electrical breaker; the threshold trips it, the timeout fails fast, and test requests resume or re-trip.</p><p><strong>In the wild.</strong> Netflix Hystrix implements it; @EnableCircuitBreaker and @HystrixCommand wire it on RegistrationServiceProxy.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Services absorb downstream failure', content: '<p><strong>Why.</strong> A contained failure should not spread.</p><p><strong>Claim.</strong> The breaker lets services handle the failure of the services they invoke, instead of propagating it.</p><p><strong>Grounding.</strong> The resulting context lists this as the benefit.</p><p><strong>In the wild.</strong> An API Gateway and a server-side discovery router both use the breaker to invoke services safely.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Threshold tuning', content: '<p><strong>Why.</strong> The breaker has one dial, and it is hard to set.</p><p><strong>Claim.</strong> It is challenging to choose timeout values without creating false positives or introducing excessive latency.</p><p><strong>Grounding.</strong> The resulting context names this as the issue.</p><p><strong>In the wild.</strong> A 200 ms timeout trips on a healthy service that answers in 450 ms, marking it down for no reason.</p>' }
    ]
  },
  quiz: [
    { "question": "What happens when consecutive failures cross the threshold?", "options": ["A. The breaker trips and all attempts fail immediately for a timeout", "B. The remote service is restarted", "C. Requests are retried without limit", "D. The client switches to messaging"], "answer": 1, "explanation": "Crossing the threshold trips the breaker, and for the timeout period all attempts fail immediately. The other options are not part of the pattern.", "conceptRef": "Breaker proxy" },
    { "question": "After the timeout expires, the breaker does what?", "options": ["A. Allows a limited number of test requests through", "B. Stays open permanently", "C. Immediately floods the service with all traffic", "D. Deletes the failed service"], "answer": 1, "explanation": "A limited number of test requests are allowed; success resumes normal operation, failure restarts the timeout. Options B, C, and D are wrong.", "conceptRef": "Breaker proxy" },
    { "question": "What resource is consumed while a caller waits on an unresponsive service?", "options": ["A. Threads", "B. Disk space", "C. Network ports only", "D. No resource at all"], "answer": 1, "explanation": "Threads are the precious resource consumed while waiting, which can lead to resource exhaustion. Disk (B) and ports (C) are not the stated resource, and D is false.", "conceptRef": "Cascading failure" },
    { "question": "What is the main challenge in using a circuit breaker?", "options": ["A. Choosing timeout values without false positives or excessive latency", "B. Finding a message broker", "C. It cannot wrap REST calls", "D. It stops all failures from happening"], "answer": 1, "explanation": "Tuning timeout values is the stated issue: too tight causes false positives, too loose adds latency. Options B and C are false, and D overstates what the breaker does.", "conceptRef": "Threshold tuning" }
  ]
});
