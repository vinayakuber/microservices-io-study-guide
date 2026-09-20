# Chapter 7: Circuit Breaker

> A proxy that trips after consecutive failures, fails fast during a timeout, and probes before resuming.

_Also known as: Chris Richardson · Microservice Patterns Ch. 7 · microservices.io /patterns/reliability/circuit-breaker.html_

## Flow

### Trip on consecutive failures

> **Why this matters:** A cascade starts when a caller keeps waiting on a dead service; the breaker counts failures and opens once they cross a threshold.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Client calls the proxy</b><br/>get-user-1, breaker state CLOSED, threshold 3"]:::start
  n1["<b>2. Forward the call</b><br/>remote_calls 0 becomes 1"]:::step
  n2["<b>3. Count the failure</b><br/>SVC is down, consecutive_failures 0 becomes 1"]:::step
  n3["<b>4. Second call fails too</b><br/>consecutive_failures 1 becomes 2"]:::step
  n4["<b>5. Third call hits the threshold</b><br/>consecutive_failures 2 becomes 3, at least threshold 3"]:::core
  n5["<b>6. Open the circuit</b><br/>state CLOSED becomes OPEN"]:::step
  n6["<b>7. Verdict OPEN at 00:00:02</b><br/>later attempts fail immediately for the timeout"]:::stop
  n7["<b>Below threshold</b><br/>failures stay under 3, the breaker stays CLOSED"]:::warn
  n0 -->|"1. proxy forwards the call"| n1
  n1 -->|"2. remote service is down"| n2
  n2 -->|"3. another failure"| n3
  n3 -->|"4. count climbs again"| n3
  n3 -->|"5. third failure crosses the threshold"| n4
  n4 -->|"6. trip the breaker"| n5
  n5 -->|"7. circuit open"| n6
  n2 -->|"8. count never reaches threshold"| n7
```

1. **Count consecutive failures** — The proxy increments a counter on each failed call.

2. **Cross the threshold** — When the count crosses the threshold, the breaker trips.

3. **Open the circuit** — For the timeout period, all attempts fail immediately.

```java
// PROXY SIDE — CLOSED state: a breaker trips when consecutive failures cross the threshold
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
// <- verdict : "OPEN" tripped at 00:00:02 · every later attempt fails immediately for the timeout
```

### Fail fast while open

> **Why this matters:** While open, no thread is wasted on the dead service: attempts fail immediately instead of blocking.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Request arrives while open</b><br/>get-user-2 at 00:00:10, opened_at 00:00:02"]:::start
  n1["<b>2. Check the window</b><br/>elapsed 0 becomes 8 s, under the 60 s timeout"]:::step
  n2["<b>3. Reject without calling</b><br/>attempts 0 becomes 1, SVC untouched"]:::step
  n3["<b>4. Protect the caller</b><br/>svc_calls 0 becomes 0, threads freed at once"]:::core
  n4["<b>5. Second request fails fast too</b><br/>attempts 1 becomes 2 at 00:00:30"]:::step
  n5["<b>6. Verdict FAIL_FAST twice</b><br/>the cascade is stopped"]:::stop
  n6["<b>Window already over</b><br/>elapsed at least 60 s, the breaker moves to half-open"]:::warn
  n0 -->|"1. inside the timeout"| n1
  n1 -->|"2. still within 60 s"| n2
  n2 -->|"3. never touches the dead service"| n3
  n3 -->|"4. next attempt"| n4
  n4 -->|"5. two rejections"| n5
  n1 -->|"6. timeout expired instead"| n6
```

1. **Reject without calling** — Attempts to invoke the remote service fail immediately.

2. **Protect the caller** — Threads are not consumed waiting for an unresponsive service.

3. **Stop the cascade** — The failure of one service no longer drains the services that call it.

```java
// PROXY SIDE — OPEN state: while open, every attempt fails immediately, so SVC is never touched
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
// <- verdict : "FAIL_FAST" twice (00:00:10, 00:00:30) · threads freed at once, SVC untouched
```

### Probe in half-open

> **Why this matters:** After the timeout the breaker lets a limited number of test requests through; their outcome decides recovery or another timeout.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Timeout expires</b><br/>60 s elapsed at 00:01:02"]:::start
  n1["<b>2. Move to half-open</b><br/>state OPEN becomes HALF-OPEN"]:::step
  n2["<b>3. Let one test request pass</b><br/>probe_count 0 becomes 1"]:::step
  n3["<b>4. SVC answers OK</b><br/>reply null becomes user-3"]:::core
  n4["<b>5. Resume normal operation</b><br/>state HALF-OPEN becomes CLOSED"]:::step
  n5["<b>6. Reset the failure counter</b><br/>consecutive_failures 3 becomes 0"]:::step
  n6["<b>7. Verdict CLOSED resumed</b><br/>normal operation restored"]:::stop
  n7["<b>Test request fails</b><br/>state HALF-OPEN becomes OPEN, the timeout begins again"]:::warn
  n0 -->|"1. window has passed"| n1
  n1 -->|"2. allow a probe"| n2
  n2 -->|"3. probe succeeds"| n3
  n3 -->|"4. recovery"| n4
  n4 -->|"5. counter clears"| n5
  n5 -->|"6. closed again"| n6
  n2 -->|"7. probe fails instead"| n7
```

1. **Timeout expires** — The breaker allows a limited number of test requests to pass through.

2. **Success resumes operation** — If those requests succeed, the breaker resumes normal operation.

3. **Failure restarts the timeout** — If there is a failure, the timeout period begins again.

```java
// PROXY SIDE — HALF-OPEN state: after the timeout, one test request is allowed through
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
//    alt test request fails : state : "HALF-OPEN" -> "OPEN"  BECAUSE the timeout period begins again
```

### Tune thresholds carefully

> **Why this matters:** Choosing timeout values is hard: too tight creates false positives, too loose hides real outages behind latency.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Request hits a slow-but-alive service</b><br/>get-user-4, avg answer 450 ms"]:::start
  n1["<b>2. Forward the call</b><br/>remote_calls 0 becomes 1"]:::step
  n2["<b>3. SVC answers at 450 ms</b><br/>reply null becomes user-4"]:::core
  n3["<b>4. Too-short timeout trips early</b><br/>200 ms fires first, verdict becomes TIMEOUT"]:::warn
  n4["<b>5. False positive</b><br/>a healthy service is marked down, failure count 0 becomes 1"]:::warn
  n5["<b>Too-long timeout</b><br/>5000 ms waits through real outages, hiding the failure"]:::warn
  n6["<b>6. The one hard dial</b><br/>no value avoids both false positives and excessive latency"]:::stop
  n0 -->|"1. proxy forwards"| n1
  n1 -->|"2. service responds slowly"| n2
  n2 -->|"3. timeout_ms 200 gives up early"| n3
  n2 -->|"4. timeout_ms 5000 waits too long"| n5
  n3 -->|"5. healthy service marked down"| n4
  n4 -->|"6. dial too tight"| n6
  n5 -->|"7. dial too loose"| n6
```

1. **False positives** — A too-short timeout trips on a healthy but slow service.

2. **Excessive latency** — A too-long timeout delays detection of a real failure.

3. **The one hard dial** — The challenge is choosing values without false positives or excessive latency.

```java
// PROXY SIDE — tuning: a too-short timeout marks a healthy but slow service as failed
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
//    alt timeout too long : 5000 ms waits through real outages  BECAUSE excessive latency hides the failure
```


## Interview Questions

### Q1

A checkout service calls a payments service that has died. Calls keep arriving, and the breaker must stop the cascade before it spreads.

**Interviewer's question:** What makes a circuit breaker trip, and what happens once it does?

**Solution:** The proxy counts consecutive failures; when the count crosses a threshold it trips, and for the timeout period all attempts fail immediately.

**System-design components:**
- Failure counter
- Threshold
- Tripped (OPEN) state
- Immediate rejection

```mermaid
flowchart LR
  C["Checkout"] --> P["breaker proxy"]
  P -->|"fails"| SVC["Payments (down)"]
  P --> O["OPEN when failures >= threshold"]
```

```java
// PROXY SIDE — CLOSED state: a breaker trips when consecutive failures cross the threshold
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
// <- verdict : "OPEN" tripped at 00:00:03 · every later attempt fails immediately for the timeout
```

_This is exactly the trip-on-consecutive-failures mechanism in this chapter._

_Covers:_ Trip on consecutive failures

_From the 28 problems:_ 01-scale-from-zero-to-millions · 03-framework-for-system-design-interviews

### Q2

The payments service is down and the breaker has tripped. New checkout requests keep arriving within the timeout window.

**Interviewer's question:** While the breaker is open, what happens to incoming attempts, and why does it stop the cascade?

**Solution:** Attempts fail immediately without calling the service, so threads are not consumed waiting, and the failure of one service no longer drains its callers.

**System-design components:**
- Open breaker
- Fail-fast rejection
- Protected caller threads

```mermaid
flowchart LR
  C["Checkout"] --> P["breaker (OPEN)"]
  P -. "fail fast" .-> C
  P -. "never calls" .- SVC["Payments (down)"]
```

```java
// PROXY SIDE — OPEN state: while open, every attempt fails immediately, so SVC is never touched
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
// <- verdict : "FAIL_FAST" twice (00:00:10, 00:00:30) · threads freed at once, SVC untouched
```

_This is exactly the fail-fast-while-open behavior in this chapter._

_Covers:_ Fail fast while open

_From the 28 problems:_ 01-scale-from-zero-to-millions · 03-framework-for-system-design-interviews

### Q3

The payments service has recovered, but the breaker is still open. The timeout is about to expire and the team watches the first request after it.

**Interviewer's question:** What does the breaker do in the half-open state, and how do the probe's outcomes decide recovery or re-trip?

**Solution:** After the timeout it lets a limited number of test requests through; success resumes normal operation, and a failure restarts the timeout period.

**System-design components:**
- Timeout expiry
- Limited test requests
- Resume on success
- Re-trip on failure

```mermaid
flowchart LR
  O["OPEN"] -->|"timeout expires"| H["HALF-OPEN"]
  H -->|"probe succeeds"| C["CLOSED"]
  H -->|"probe fails"| O
```

```java
// PROXY SIDE — HALF-OPEN state: after the timeout, one test request is allowed through
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
//    alt test request fails : state : "HALF-OPEN" -> "OPEN"  BECAUSE the timeout period begins again
```

_This is exactly the half-open probe and its two outcomes in this chapter._

_Covers:_ Probe in half-open

_From the 28 problems:_ 01-scale-from-zero-to-millions · 03-framework-for-system-design-interviews

### Q4

The team sets a 250 ms timeout, but the payments service reliably answers in about 600 ms even when healthy.

**Interviewer's question:** What is the one hard dial in a circuit breaker, and what are the two failure modes of tuning it wrong?

**Solution:** Choosing timeout values is the challenge: too short creates false positives on a healthy but slow service, and too long hides real outages behind latency.

**System-design components:**
- Timeout threshold
- False positives
- Excessive latency

```mermaid
flowchart LR
  T["timeout 250ms"] --> FP["false positive (healthy 600ms marked down)"]
  T2["timeout 5000ms"] --> EL["excessive latency (real outage hidden)"]
```

```java
// PROXY SIDE — tuning: a too-short timeout marks a healthy but slow service as failed
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
//    alt timeout too long : 5000 ms waits through real outages  BECAUSE excessive latency hides the failure
```

_This is exactly the threshold-tuning tradeoff in this chapter._

_Covers:_ Tune thresholds carefully

_From the 28 problems:_ 01-scale-from-zero-to-millions · 03-framework-for-system-design-interviews

## Key Concepts

### The Problem

**Cascading failure.** Threads are consumed while waiting for an unresponsive service, causing resource exhaustion that cascades failure across the application.


### The Solution

The client invokes a remote service through a proxy that trips after a threshold of consecutive failures, fails fast for a timeout, then lets test requests through.

```mermaid
flowchart LR
  C["Checkout"] --> P["breaker proxy"]
  P -->|"fails"| SVC["Payments (down)"]
  P --> O["OPEN when failures >= threshold"]
```


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| Breaker proxy | The client invokes a remote service through a proxy that trips after a threshold of consecutive failures, fails fast for a timeout, then lets test requests through. | Netflix Hystrix implements it; @EnableCircuitBreaker and @HystrixCommand wire it on RegistrationServiceProxy. |
| Services absorb downstream failure | The breaker lets services handle the failure of the services they invoke, instead of propagating it. | An API Gateway and a server-side discovery router both use the breaker to invoke services safely. |
| Threshold tuning | It is challenging to choose timeout values without creating false positives or introducing excessive latency. | A 200 ms timeout trips on a healthy service that answers in 450 ms, marking it down for no reason. |


### Tradeoffs & When

- The breaker lets services handle the failure of the services they invoke, instead of propagating it.
- It is challenging to choose timeout values without creating false positives or introducing excessive latency.


<details><summary>All concepts (index)</summary>

### Problem: Cascading failure

**Why.** A slow or dead service makes callers wait, and waiting callers burn their own capacity.

**Claim.** Threads are consumed while waiting for an unresponsive service, causing resource exhaustion that cascades failure across the application.

**Grounding.** The context warns that precious resources such as threads are consumed, leading to resource exhaustion and cascading failure.

**In the wild.** One dead checkout service saturates every upstream service that calls it, taking the whole site down.
### Solution: Breaker proxy

**Why.** The caller should stop hitting a service that is already failing.

**Claim.** The client invokes a remote service through a proxy that trips after a threshold of consecutive failures, fails fast for a timeout, then lets test requests through.

**Grounding.** The solution: a proxy like an electrical breaker; the threshold trips it, the timeout fails fast, and test requests resume or re-trip.

**In the wild.** Netflix Hystrix implements it; @EnableCircuitBreaker and @HystrixCommand wire it on RegistrationServiceProxy.
### Tradeoff: Services absorb downstream failure

**Why.** A contained failure should not spread.

**Claim.** The breaker lets services handle the failure of the services they invoke, instead of propagating it.

**Grounding.** The resulting context lists this as the benefit.

**In the wild.** An API Gateway and a server-side discovery router both use the breaker to invoke services safely.
### Tradeoff: Threshold tuning

**Why.** The breaker has one dial, and it is hard to set.

**Claim.** It is challenging to choose timeout values without creating false positives or introducing excessive latency.

**Grounding.** The resulting context names this as the issue.

**In the wild.** A 200 ms timeout trips on a healthy service that answers in 450 ms, marking it down for no reason.

</details>


## Quiz

1. What happens when consecutive failures cross the threshold?

   - A. The breaker trips and all attempts fail immediately for a timeout
   - B. The remote service is restarted
   - C. Requests are retried without limit
   - D. The client switches to messaging

<details><summary>Reveal answer</summary>

**A.** Crossing the threshold trips the breaker, and for the timeout period all attempts fail immediately. The other options are not part of the pattern.

</details>

2. After the timeout expires, the breaker does what?

   - A. Allows a limited number of test requests through
   - B. Stays open permanently
   - C. Immediately floods the service with all traffic
   - D. Deletes the failed service

<details><summary>Reveal answer</summary>

**A.** A limited number of test requests are allowed; success resumes normal operation, failure restarts the timeout. Options B, C, and D are wrong.

</details>

3. What resource is consumed while a caller waits on an unresponsive service?

   - A. Threads
   - B. Disk space
   - C. Network ports only
   - D. No resource at all

<details><summary>Reveal answer</summary>

**A.** Threads are the precious resource consumed while waiting, which can lead to resource exhaustion. Disk (B) and ports (C) are not the stated resource, and D is false.

</details>

4. What is the main challenge in using a circuit breaker?

   - A. Choosing timeout values without false positives or excessive latency
   - B. Finding a message broker
   - C. It cannot wrap REST calls
   - D. It stops all failures from happening

<details><summary>Reveal answer</summary>

**A.** Tuning timeout values is the stated issue: too tight causes false positives, too loose adds latency. Options B and C are false, and D overstates what the breaker does.

</details>

