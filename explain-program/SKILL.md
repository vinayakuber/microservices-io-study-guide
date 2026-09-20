---
name: explain-program
description: Exhaustively annotate and explain a program with DEF/->/<- markers, concrete live values, per-line value-change comments, and multiple possible realities. Use whenever the user asks to explain code, write a full program, trace values, or walk through how a program works step by step.
---

# Explain a Program — Exhaustive Annotated Trace

When the user asks to explain a program, write a full program, or trace how code
works, produce an **exhaustive, value-annotated walkthrough**. Nothing may be
left undefined: every class, field, method, constructor, input, output, and
value change must be annotated.

## 1. Pick ONE concrete, named scenario

Never use `foo`/`bar`/`x`/`y`. Choose a real example and trace it end to end.
Distributed-systems examples work well because there are clear actors and
messages. **Give each party a DISTINCT id and never let two parties share an
initial** — `B1` (Buyer 1) vs `B` (Seller B) is ambiguous, so name the buyer
`U1` (or a real name) and add a one-line party legend (`U1 = buyer · A = Seller
A · B = Seller B`).

Example scenario: *"Leader A sends log entries 10, 11, 12 to Follower B over a
pipelined connection; B's Singular Update Queue appends them and ACKs."*

Trace **one full cycle** with concrete values (entry 10, correlationId=0,
body="append entry 10", byte[138]). For the subsequent iterations, use `alt:`
notes instead of repeating everything.

## 2. The annotation markers (use them on EVERY method and constructor)

```java
// DEF: <what this is / where declared> · CALLED BY: <who calls it>
// -> <param1> : <its live value now>
// -> <param2> : <its live value now>
//    <line-by-line value changes>
// <- <return value>   (or "void · SIDE EFFECT: ...")
```

Rules for each marker:

- **`DEF:`** — declare where the thing lives and who invokes it. Do this for
  classes, fields, methods, AND constructors.
- **`->`** — every input parameter, one line each, with its concrete value at
  entry. For a method reading from a socket/stream, write `-> (reads from socketInputStream)`.
- **`<-`** — the return value with its concrete value. For `void`, write
  `<- void` plus the side effect. For a constructor, write `<- a <ClassName> with <fields set>`.
- **Per-line `·`** — on every executable line, show the value change:
  `field : old -> new`, `list : [] -> ["entry 10"]`, `counter : 0 -> 1`,
  `socket buffer : [] -> [0,0,0,138]`.

## 3. Multiple possible realities

Where a value can differ across runs or calls, add `alt:` notes. Show at least
three realities when the user asked for them (e.g., 1st/2nd/3rd call, or
queue-has-room vs queue-full vs shutdown).

```java
request.correlationId = correlationId.getAndIncrement();
//    counter : 0 -> 1 · request.correlationId : 0 -> 0
//    alt 2nd call: counter 1->2, stamps 1 · 3rd call: counter 2->3, stamps 2
```

## 4. Every variable must have provenance

The user's standing rule: **never write into a variable without saying how it
came to exist.** For each variable, state where it is defined/created and what
its value is. A variable that appears in a snippet but is never defined is a
bug in the explanation — catch those before the user does.

## 5. Exhaustiveness checklist (must ALL be present)

1. Every class, field, method, AND constructor annotated.
2. No referenced-but-undefined method (e.g. if you call `socketWrite(...)`,
   `processResponse(...)`, `serialize(...)`, you MUST define them).
3. Byte-level input/output for `serialize`/`deserialize` (show the byte array
   contents conceptually: header + long + string).
4. A **final `->` / `<-` table**: one row per method/constructor with its inputs
   and outputs.
5. A **call graph**: who calls whom (e.g. `Main -> sendOneWay`, `run -> handler.apply`).
6. Optionally a **moment-in-time snapshot** showing every live thread and its
   local variables simultaneously (thread | executing | live local values).
7. **The wiring is code, not prose.** Every "who calls X?" answer must trace back
   to an actual annotated code line IN the program — including the code that
   CREATES and STARTS objects/threads (e.g. the accept loop that does
   `new SocketReaderThread(conn, server).start()`). A call-graph arrow is not
   enough; if the caller itself was never written, the program is incomplete.
8. **System placement.** Every class/component must be assigned to a concrete
   machine/process. Provide a placement table (see Section 12) BELOW the call
   graph, plus one high-level sentence naming the system roles involved
   (data servers, metadata servers, config servers, leader, follower, client).

## 6. Output structure

1. One-line scenario statement.
2. The full program, class by class, annotated inline.
3. The byte-level I/O note for serialize/deserialize.
4. The `->` / `<-` table for every method.
5. The call graph.
6. The system-placement table (BELOW the call graph).

## 7. Example (the exact format, compressed)

```java
static Object deserialize(byte[] b) {
    // DEF: Codec.deserialize · CALLED BY: readResponse() and readRequest()
    // -> b : byte[120]  (the serialized ACK)
    try (var ois = new ObjectInputStream(new ByteArrayInputStream(b))) {
        //    ois : wraps b (reads from memory, no socket)
        return ois.readObject();
        // <- RequestOrResponse(correlationId=0, body="ACK append entry 10")
    } catch (Exception e) { throw new RuntimeException(e); }
}
```

## 8. Do NOT

- Skip constructors, helper methods, or "stub" methods.
- Use meaningless variable names or leave a variable's origin unexplained.
- Mix reality values without labeling (`alt:`).
- Write a "full program" that omits the I/O framing, thread loops, or the wiring
  between classes.

## 9. Standard-library constructs must be explained UNDERNEATH

When the program uses a Java library construct and the user asks "what is this /
how is it implemented", explain both **how it's used here** AND **what it is
underneath**. Annotate it with the same DEF/->/<-/value-change markers.

### `Function<T, R>` (and any functional interface / lambda)

1. Map the concrete type parameters in THIS program:
   `Function<RequestOrResponse, RequestOrResponse>` — say which class is `T`
   (input) and which is `R` (output).
2. Show the interface: it has exactly ONE abstract method (`R apply(T t)`),
   marked `@FunctionalInterface`.
3. Show the implementation forms: lambda → desugared anonymous class →
   the JVM's `invokedynamic` + `LambdaMetafactory` generating a hidden class
   whose `apply` body IS the lambda body. Also mention method references.
4. Annotate the actual call:
   `-> req : <value> · <side effects> · <- return : <value>`.

### `CompletableFuture<T>` (and thread/executor questions)

1. State plainly: **it is NOT a thread.** It is a state machine + container.
2. Show the underlying implementation:
   - `volatile Object result` (null = not done, else value/AltResult);
   - a lock-free `Completion` stack of pending callbacks;
   - `complete(value)` = `compareAndSet` + `postComplete()` (first wins);
   - `get()` = `LockSupport.park` the *calling* thread (no internal worker thread);
   - `thenAccept` runs the callback on the completing thread; `thenAcceptAsync`
     runs it on the given executor.
3. Name the REAL threads: who calls `complete()`, who calls `get()`/registers
   callbacks, and which executor runs the callback.
4. Give the full lifecycle trace with concrete values.

### General rule

Any time the user asks about `Function`, `CompletableFuture`, `ExecutorService`,
`Thread`, `ArrayBlockingQueue`, `AtomicLong`, etc., do NOT just say "it's a
helper class" — show the fields, the single method/loop, the lock/CAS/park
mechanism, and annotate every value.

## 10. Handmade, and programmatically enforced (the two non-negotiables)

**1. Handmade, not automatic.** Every line of annotation is written out by hand
for THIS specific program and THIS specific trace. Values are chosen for the
concrete scenario, not copied from a template. Never emit a generic skeleton.

**2. No undefined symbol — ever.** Any identifier that appears in the code must
have a `DEF:` (or an explicit one-line explanation of what it is). This includes,
and is not limited to:
- fields, locals, parameters, and constants;
- static handles — `VarHandle`, `AtomicReferenceFieldUpdater`,
  `MethodHandles.Lookup` — and the `findVarHandle`/`static { }` block that
  defines them;
- every library call used (`compareAndSet`, `LockSupport.park`,
  `compareAndSet` on an `AtomicLong`, `ArrayBlockingQueue.put/poll`, etc.).

A line like `RESULT.compareAndSet(this, null, value)` is **not allowed** unless
`RESULT` was defined first. This is the exact class of gap the user keeps
catching; treat it as a defect.

**3. Programmatic self-audit — run it before finishing.** At the end of every
explanation, mechanically verify completeness and print the result:

1. Collect every identifier / `DEF`-able symbol that was referenced.
2. Assert each one has a `DEF:` (or an inline "what this is" line).
3. Assert every method AND constructor has `->` (inputs) and `<-` (output).
4. Assert every class in the program appears in the placement table (Section 12).
5. Assert every Mermaid diagram PARSES (run `mermaid.parse` on each; a broken
   diagram is a defect). **Always quote node labels** — unquoted `[` `]` `(` `)`
   inside a label breaks the Mermaid parser (e.g. write `Median["sorted[n/2]"]`,
   never `Median[sorted[n/2]]`). **Escape a literal `"` inside a label as
   `#quot;` — never `&quot;`** (GitHub HTML-decodes code fences before Mermaid
   sees them, so `&quot;` becomes a literal `"` and breaks the quoted label;
   `#quot;` has no `&` and survives, then Mermaid renders it back to `"`).
6. Print an audit line, e.g.:
   `AUDIT PASS: 14 methods, 27 symbols, 0 undefined, 9/9 classes placed, 7/7 diagrams parse`
7. If any check fails, rewrite until the audit passes. Do not present an
   explanation with a failing audit.

The audit is the enforcement mechanism: it turns "nothing should be left
unattended" from a wish into a check that is reported to the user.

## 11. Worked example — the "undefined method / handle" gap (and how to handle it)

**The gap class:** writing a call like `postComplete();` or
`RESULT.compareAndSet(this, null, value)` in an explanation WITHOUT first
defining `postComplete` or `RESULT`. This is the exact defect the user
repeatedly catches. Treat every such call as a pending definition.

**The rule:** before the FIRST use of any method, field, or handle, give its
full definition with `DEF/->/<-/value-change`. When the user asks "what is X?",
answer with the complete definition — **including its prerequisites** (the
`VarHandle` it CASes on, the `Completion` node type it walks, the `static { }`
block that binds the handle).

**Concrete "before" (defective — never ship this):**

```java
boolean complete(T value) {
    if (RESULT.compareAndSet(this, null, value)) {  // <- RESULT is UNDEFINED
        postComplete();                              // <- postComplete is UNDEFINED
        return true;
    }
    return false;
}
```

**Concrete "after" (correct) — define the prerequisites first, then the method:**

```java
// Prerequisites — the two VarHandles, defined ONCE:
private volatile Object result = null;      // DEF: field · null = not done
private volatile Completion stack = null;   // DEF: field · callback stack

private static final VarHandle RESULT;      // DEF: handle bound to `result`
private static final VarHandle STACK;       // DEF: handle bound to `stack`
static {
    RESULT = MethodHandles.lookup().findVarHandle(CompletableFuture.class, "result", Object.class);
    STACK  = MethodHandles.lookup().findVarHandle(CompletableFuture.class, "stack",  Completion.class);
}

final void postComplete() {
    // DEF: CompletableFuture.postComplete · CALLED BY: complete() after the CAS
    // -> (none)
    //    pop the callback stack; run each callback inline (executor==null)
    //    or on its executor (executor!=null)
    // <- void · SIDE EFFECT: every callback is run or scheduled
}
```

Then close the loop with the full traced chain:

```
complete(value)
   └─ RESULT.compareAndSet(...)   // result : null -> ACK(id=0)
   └─ postComplete()              // stack : [cb1] -> null; cb1 scheduled on writerPool
        └─ writerPool thread -> conn.socketWrite(ACK)
```

**How the audit enforces it:** in the defective "before", `RESULT` and
`postComplete` appear as referenced symbols with no `DEF` → the Section 10
self-audit reports `AUDIT FAIL: 2 undefined symbols (RESULT, postComplete)` →
rewrite until the audit passes. Never present the explanation in that state.

## 12. System placement — which component lives on which machine

AFTER the call graph, add a **placement table** that assigns every class/component
to a concrete process, a system role, AND a tier term. Format:

| Component (class) | Process / machine | System role | Role term |
|---|---|---|---|
| ... | ... | ... | ... |

Rules:
1. **Every class in the program appears in at least one row.** If a class is in
   the program but missing from the placement table, the audit fails.
2. **Name the process concretely**, e.g. `Leader node (data server A)`,
   `Follower node (data server B)`, `Core leader (metadata server C1)`,
   `Client (browser/app)`, `Config server`.
3. **One high-level sentence above the table** states the systems involved and
   their roles — explicitly say which machines are data servers, which are
   metadata servers, which are config servers, and which are clients. If a
   system type is NOT present (e.g. no metadata server in this program), say so.
4. **Tag every row with its tier term** in the `Role term` column, using ONE
   consistent vocabulary:
   - metadata / config / core servers → `leader` or `followers` (chosen by Raft/Paxos);
   - data servers → `master` or `slave` (replication / task ownership);
   - a data server talking to the core → `client` (it may be a master or slave);
   - a component present on ALL core nodes → `leader + followers`.
   Never use `leader` for a data server or `master` for a core node. The two
   tiers are terminologically separate: **leader/follower for metadata,
   master/slave for data.**

Example (leader/follower replication):

> Data servers A and B hold the application data; this program has no
> metadata/config servers.

| Component | Process / machine | System role |
|---|---|---|
| `LeaderMain` | Leader node — data server A | data server (replication leader) |
| `PipelinedConnection`, `ResponseThread` | Leader node — data server A | transport + ACK reader on the data server |
| `FollowerBootstrap` | Follower node — data server B | data server (follower) |
| `FollowerServer`, `SingularUpdateQueue`, `ClientConnection`, `SocketReaderThread` | Follower node — data server B | receiver logic on the data server |

And if the Consistent Core / metadata server IS involved, the table must show
which classes run on the 3–5 metadata servers vs which run on the data servers,
e.g.:

| Component | Process / machine | System role |
|---|---|---|
| `ConsistentCoreClient`, `WatchClient` | data server (client) | data server — client of the core |
| `CoreServer`, `ReplicatedLog`, `LeaseTracker`, `KeyToConnection` | metadata server (core leader/follower) | metadata server — the 3–5 node core |

The audit's placement check: **every class in the program must appear in the
placement table**, and the high-level sentence must name the system roles.

## 13. Concept / study-guide blocks: an execution trace, never a definition list

When the "program" is annotated pseudocode for a CONCEPT — a data structure,
algorithm, or protocol, e.g. a study-guide `/explain-program` block — the same
rules apply with one extra hard constraint:

**A block that only names concepts is a defect.** A sequence of `// DEF: x ·
CALLED BY: y` lines plus a few `->`/`<-` markers is a *definition list*, not an
explanation. The reader learns the names but never sees the mechanism run, and
terms get *mentioned* without ever being *defined* ("sparse index" with no
definition). This is the exact failure the user catches, over and over.

Root cause (recurred across an entire corpus): the exemplars were themselves
definition lists, the prompt asked for "DEF/->/<- markers" rather than a
simulated run, and the gate checked that *some* value exists somewhere rather
than that a value *flows* through the steps. All three must be fixed.

### The execution-trace standard (every concept block MUST)

1. **Simulate one real run** — initialize the concrete data structures with
   concrete values, push ONE concrete input through them, show the state at
   each step, emit the concrete output.
2. **Define every term at first use, with its concrete instance.** Never write
   `sparse index` without saying what it is AND what it holds right now:
   `// DEF: sparse index — an in-memory map of the FIRST key of each block ->
   that block's offset; here {"handbag"->0, "handsome"->4096}`.
3. **Every `DEF:` carries inline concrete values** (numbers/quoted). A DEF with
   no value is a name, not a definition.
4. **Number the execution** with `step 1 ·`, `step 2 ·`, … and show the value
   changing on each step (`//    bits : [0,0,0] -> [0,0,1]`).
5. **`->` = concrete input, `<-` = concrete output**, both carrying values.
6. **Show interconnections** — each step names which structure it reads/writes.
7. **Demonstrate, don't assert.** When a line names a mechanism — "the PK is
   the idempotency guard", "the unique constraint dedups", "the nonce ties the
   webhook back" — show the ACTUAL operation that performs it, with concrete
   values. `INSERT ... ON CONFLICT (order_id) DO NOTHING` → the 2nd INSERT hits
   the existing key and returns the row unchanged. The reader must see the
   guard WORK (the operation, the key collision, the concrete no-op), not just
   be told it exists. An assertion with no demonstrated mechanism is a gap.

Gold exemplar (this is the bar — not optional):

```java
// DEF: SSTable — an immutable file on disk whose keys are SORTED, split into fixed 4 KB blocks
//    block 0 @0 = "handbag,42|handball,7|handbook,12|handiwork,55" · block 1 @4096 = "handsome,3|handy,9"
// DEF: sparse index — in-memory map: FIRST key of each block -> block's offset (1 per block, not 1 per key)
// -> sparse_index : {"handbag" -> 0, "handsome" -> 4096}
// DEF: lookup · CALLED BY: GET("handiwork")
// -> key : "handiwork"
//    step 1 · binary-search sorted index keys : "handbag" <= "handiwork" < "handsome" -> block 0
//    step 2 · seek to offset 0, scan block 0 in sorted order
//    step 3 · "handbag,42" -> "handball,7" -> "handbook,12" -> "handiwork,55"
// <- value : 55 at offset 34 (3 comparisons + one 4 KB block read, NOT a full scan)
```

### The mechanical gate (run it; a failing block is not done)

- **R1** — every `// ->` / `// <-` line carries a concrete value (number,
  "quoted", or `= value`). A bare label is a defect.
- **R2** — every standalone `// DEF:` block contains a concrete value.
- **R3** — the block has >= 4 concrete-value lines.
- **R4** — the block has >= 3 value-transformation lines: a ` -> ` arrow
  carrying a concrete value on a NON-input/output line (`//    x : old -> new`).
  This is the check that forces the *how*, not just the *what*.
- **R5** derivation · **R6** causality · **R7** state · **R8** no dangling
  handle · **R9** demonstrate-don't-assert — described in the sections below.
- **R10** — distinct party ids: a single-letter id (`A`, `B`) must never be a
  prefix of a longer id (`B` the seller vs `B1` the buyer is ambiguous). Give
  each party a distinct, prefix-free id and a one-line party legend.
- **R11** — declared-entity closure: every account/entity a mutation references
  (in `| account | signed-delta |` rows) must be declared with its initial
  value, and its full `old -> new` shown — a debit like `buyer_escrow -30.00`
  must be paired with `buyer_escrow : 0.00 -> -30.00` and a `buyer_escrow :
  0.00` state line. A delta with no from-state is a gap.
- **R12** — container ≠ concept: declaring a data structure is not defining the
  concept it holds (`spans : []` does not define *span*); define every
  non-generic stem at first use with a concrete value.
- **R13** — concrete datastore placement: a database/store named in a PARTIES
  line must name its engine AND instance (PostgreSQL 16 @ orders-db-1), because
  e.g. the outbox INSERT must share the one instance whose COMMIT it rides.
- **R14** — read + write path coverage (chapter-level): a chapter with a program
  must show data being WRITTEN (created/stored) AND READ back (queried/served).
  A write-only chapter hides how its store is consumed; a read-only chapter
  hides how its store was populated.
- **R15** — no bare black-box component: a PARTIES symbol must be DEFINED as a
  system component, not just a box. A value that names only a container
  (`instance`, `node`, `unit`, `server process`, `component`) with no role noun
  (writer/broker/collector/aggregator/reader), no engine, no `@instance`, no
  parenthetical is a tautology — it names the box, not the concept. This is the
  exact "what is Zipkin / where does RabbitMQ sit" gap.
- **R16** — system-design decomposition (chapter-level): every chapter with a
  program must carry a `systemDesign` section that (1) names the pipeline roles
  (`pipeline`), (2) decomposes each major component into its internals
  (`decomposition[].parts`, ≥2 parts), (3) draws the wiring as a connected
  mermaid `flowchart` (`wiring`), and (4) annotates the wiring with the
  explain-program markers (`program`). Naming a component is not defining it;
  defining it is not wiring it.

### Read + write path: every chapter covers both directions

A chapter that explains a data lifecycle must trace BOTH halves, not just one.
A write-only explanation shows spans/rows/events being created and stored but
never answers "how does anyone read this back?"; a read-only explanation shows
a query/search but never "how did this store get populated?".

- **Write path** — data created/stored: mint the id, open the span, INSERT the
  outbox row, publish the event, `store : {} -> {k: v}`.
- **Read path** — stored data queried/served back to a consumer: operator
  queries Zipkin by trace_id, the relay SELECTs the outbox, a query serves the
  materialized view, `matches : [] -> [line, line]`.

For distributed tracing, the write path is mint → open → inject → report →
store; the read path is operator → query Zipkin by trace_id → reassemble the
spans by parent+start → timeline → find the slow hop. A trace-store block that
stops at "4 spans collected" hides the read; finish it with the query-back.

Gate **R14** enforces the mechanical floor: a chapter with a program must
contain at least one write signal (mint/open/insert/publish/store) and at least
one read signal (query/search/read/return). The semantic half — that the SAME
store that is written is the one read back — is the author's responsibility:
after writing the block, walk the round trip once and make sure the written
data is served back to a named consumer.

### System-design wiring: every component defined AND connected

This is the **centerpiece of every chapter** — the System Design Interview view.
R14 covers *within* a block; the system-design layer covers *between* the
blocks. Every chapter must answer, at the system level, how its components are
**exhaustively connected** — not just complete, not just adjacent. Naming a
component is not defining it, and defining it is not wiring it; all three must
hold. The decomposition is drawn as a tree (ASCII or Mermaid — Mermaid is
preferred so it renders on GitHub), and then the SAME paths are re-described in
program notation: DEF/->/<- markers, concrete values, and the concrete instance
each component is (`@ zipkin-db-1`, queue `"zipkin"`).

The one pipeline every data-system chapter traces is:

```
writer  ->  transport  ->  collector  ->  aggregator/store  ->  reader
```

- **Writer** — the process that produces/emits the data (each instrumented
  service reporting its span, the producer publishing an event).
- **Transport** — the hop that decouples writers from the collector and buffers
  under load (RabbitMQ, Kafka). It is a distinct component, NOT part of the
  aggregator.
- **Collector** — the process that ingests from the transport (Zipkin's
  collector consuming spans off the queue).
- **Aggregator/store** — where the data is accumulated and persisted, named as
  engine AND instance (MySQL 8 @ zipkin-db-1 = the trace store).
- **Reader** — the consumer that pulls data back out (Zipkin query UI serving a
  timeline to an operator).

Four obligations, per named component:

1. **Define WHAT it is** — never `ZIP = Zipkin server process` (a bare box). Say
   `ZIP = Zipkin distributed tracing system = collector (ingests spans from BRK)
   + storage — the trace store (MySQL 8 @ zipkin-db-1) + query UI (serves
   timelines to OP)`.
2. **Assign WHERE it sits** — which pipeline role (writer/transport/collector/
   aggregator/reader), and which machine/instance (`@ zipkin-db-1`).
3. **Wire it in** — show the value crossing the boundary: `span : open -> on the
   wire to BRK (transport hop 1)` then `trace_store : {} -> {...}`. A component
   named but never touched by a value flow is a prop, not a participant.
4. **Draw the connection** — the flow diagram and the interview-question diagram
   must show the SAME pipeline (Writers → RabbitMQ transport → Zipkin collector
   → trace store MySQL 8 aggregator → Zipkin query UI reader → operator), so the
   system-level wiring is the answer to "how are these connected?", not prose.
5. **Decompose the internals** — a box is not enough even when named. Open each
   major component and list its internal subcomponents, each with its role. The
   two canonical Zipkin decompositions:
   - the server: `Zipkin server (one central process, NOT per-host)` →
     `Collector — ingests spans` · `Storage — MySQL 8 @ zipkin-db-1 / Cassandra /
     Elasticsearch` · `Query API — GET /api/v2/traces/<id>` · `UI — Zipkin Lens`;
   - the writer: `each service process` → `Tracer — mints ids, propagates B3/W3C
     headers` → `Reporter — batches finished spans` → `Sender — HTTP / Kafka /
     RabbitMQ`.
   The interview answer to "what IS Zipkin?" is the first tree; the answer to
   "where does RabbitMQ sit?" is that the Sender (in-process, in each service)
   publishes to the broker, which the Collector consumes — there is NO per-host
   agent/daemon in core Zipkin.

Every chapter carries this in a dedicated `systemDesign` field:

```js
systemDesign: {
  pipeline: 'writer → transport → collector → aggregator/store → reader',
  decomposition: [
    { box: 'each service process — the writer', role: 'writer',
      parts: ['Tracer — ...', 'Reporter — ...', 'Sender — ...'] },
    { box: 'RabbitMQ broker — the transport', role: 'transport',
      parts: ['queue "zipkin"', 'buffers under load'] },
    { box: 'Zipkin server (one central process, NOT per-host)', role: 'collector + aggregator/store + reader',
      parts: ['Collector — ...', 'Storage — MySQL 8 @ zipkin-db-1 ...', 'Query API — ...', 'UI — ...'] },
    { box: 'operator — the reader', role: 'reader', parts: ['queries a trace id', 'finds the slow hop'] }
  ],
  wiring: 'flowchart LR ...',   // the connected pipeline mermaid diagram
  program: `// SYSTEM DESIGN — ...`  // annotated trace of one item crossing every hop
}
```

Gate **R15** enforces the mechanical floor: a PARTIES value that names only a
box (`instance`, `node`, `server process`, `component`) with no role noun,
engine, `@instance`, or parenthetical is flagged as a black-box tautology. Gate
**R16** enforces the system-design floor: a chapter with a program must have a
`systemDesign` section with a `pipeline` line, at least one component decomposed
into ≥2 internals, a connected mermaid `wiring` diagram, and an annotated
`program`. The semantic half — that every named component is actually *wired* by
a value flow into the writer→collector→aggregator→reader pipeline, and that the
roles are the chapter's real roles (not a forced five for a concept with no
transport) — is the author's responsibility: after writing the chapter, walk one
item end to end and name each hop it crosses. If an item never crosses the
transport or is never read back, the wiring is incomplete.

### Numerical consistency: one seed, everything derived

A block must tell ONE consistent story with its numbers. Every size/count is
either a declared seed (with its source) or derived from a prior value with the
arithmetic shown. A block that says `4 KB block` in one line and `256 MB file`
in the next, with no derivation between them, is a defect — the reader cannot
see how the system scales from one to the other. Show the chain explicitly:
`a freshly flushed SSTable = 256 MB = 65,536 blocks x 4 KB (256 MB / 4 KB =
65,536)`, then reuse those numbers downstream (`4 x 256 MB -> ~898 MB`, `L0 =
256 MB -> L1 = 2,560 MB -> L2 = 25,600 MB`). Do NOT pick each number as an
independent illustration; pick one seed and derive the rest from it.

Gate **R5** enforces the mechanical part: a size-bearing block must contain at
least one explicit `= a × b` / `= a / b` derivation. The semantic part — that
the WHOLE block uses one seed and every magnitude follows from it — is the
author's responsibility; walk the size/count chain once before shipping and
make sure no number jumps units without a `=` — and when a derivation CHANGES
units (count→bytes, KB→MB, s→min), show the conversion factor explicitly
(`315_360_000_000 entries/year · at ~1 byte/entry = ~315 GB`), never
`entries = GB` with the multiplier hidden. Verify every arithmetic step
manually: percents, negative signs, exponents (`2^53`), ranges (`0–999`),
modular math (`(17+9) mod 21 = 5`), and thousand separators all break naive
auto-checkers, so the author must confirm each `=` computes.

### Causality: every change must state WHY it changes

A size/count that *changes* must name its cause, not just its math. "4×256 MB →
898 MB" without a reason is incomplete; "…→ 898 MB **BECAUSE** the merge is the
union of 4 files' keys, minus ~12% dropped overwrites/tombstones" is complete.
Same for levels: "L1 = 2,560 MB **BECAUSE** each level holds 10× the previous
(level-size ratio = 10)". Gate **R6** checks the mechanical proxy (a
size-bearing block must contain a causal connective: `BECAUSE`, `the ratio`,
`is the union`, `merges into`, `causes`, `since it`).

### The connected-trace template (start every concept block from this)

```
// DATA SERVER SIDE — <ONE scenario, one seed>
// DEF: <seed> — <what it is> = <value> · <source/reason>
//    <why this seed>
//
// DEF: <step 1> · CALLED BY: <caller>
// -> <input> : <value>   (comes from <seed / prior step>)
//    step 1 · <mechanism> : <before> -> <after>   BECAUSE <cause>
//    <derived> = <seed/prior> x|/ <factor>   (<why this factor>)
// <- <output> : <value>   (feeds <step 2>)
//
// DEF: <step 2> · CALLED BY: <...>
// -> <input> : <step 1's output>
//    step 2 · ...   BECAUSE <cause>
// <- <output> : <value>   (feeds <step 3>)
//
// <- FINAL : <value> — the full chain: seed -> step1 -> step2 -> ...
```

The three connective rules, applied on every block:
1. **Provenance** — every `->` input is labeled with where it came from (the
   seed or the previous step's `<-` output); AND every produced value is shown
   being consumed/stored — a value that appears and is never used again is a
   **dangling link** (e.g. a token that is received but never written to a row
   or passed on). Each input must also show its correlation key (e.g. the
   nonce that ties a token and a webhook back to the same row).
2. **Derivation** — every size/count after the seed is written `= prior ×/÷
   factor`, with the factor's reason.
3. **Causality** — every change (`old -> new`) carries `BECAUSE <mechanism>`.

A block that satisfies provenance + derivation + causality cannot have a value
"appear from nowhere" and cannot have a change whose reason is unexplained.

### The stateful-trace template (declare the state, then mutate named rows)

When the program reads/writes **tables or named data structures**, the state is
part of the explanation — an identifier like `EV-1001` that is not grounded in a
declared row is a defect (the reader cannot see the table it belongs to). The
fixed order is:

```
// SCENARIO — one end-to-end story, established UP FRONT (who, what, one seed)
// SCHEMA   — the tables/structures: columns, types, PK, FK (—> = foreign key)
//   payment_events(event_id TEXT PK, buyer_id TEXT, amount DECIMAL(10,2), status ENUM(...))
//   payment_orders(order_id TEXT PK, event_id TEXT —> payment_events.event_id, ...)
//   relationship : 1 payment_event —< N payment_orders · ...
// STATE (before) — the concrete rows/values, so every id is grounded
//   payment_events : [EV-1001 | B1 | 49.99 | NOT_STARTED]
//   wallet_balances: [A | 0.00] · [B | 0.00]
//
// PROGRAM — the trace; every mutation names table[row].column
//    step 1 · payment_orders[PO-2001].status : NOT_STARTED -> SUCCESS   BECAUSE ...
//    step 2 · ledger_entries += [1 | PO-2001 | buyer_escrow | -30.00]
//
// STATE (after) — the changed rows
//   payment_orders[PO-2001].status = SUCCESS · wallet_balances[A] = 30.00
```

Enforcement (gate **R7**): a program that references a row/record id must
declare its schema/state (a `SCHEMA`/`STATE` block, or the equivalent
`structure = {concrete values}` declaration) BEFORE the first mutation, and
each `old -> new` mutation must name `table[row].column` (or
`structure.field`). Establish the whole end-to-end scenario in the SCENARIO
line first — never introduce it mid-trace.

**Provenance, derivation and causality STILL hold inside this template** — it
adds state on top of them, it does not replace them. Every `table[row].column
: old -> new` mutation still carries `BECAUSE <cause>` (R6); every size/count
is still derived `= prior ×/÷ factor` (R5); every input is still labeled with
its origin, and every term is defined at first use (R1/R2). The four rules
together — provenance, derivation, causality, state — are the complete bar;
check all four on every block.

### Formatting pitfalls (all observed in production; all must be handled)

- Source blocks are JS template literals, so the program text must contain NO
  raw backtick and NO `${`. A markdown `` `code` `` inside a program must be
  written as a quoted literal (`"from"`) instead.
- Key/title strings mix single-quoted JS (`section: '…'`) and double-quoted JSON
  (`"section": "…"`), and titles encode dashes as `&mdash;`/`&ndash;`/`—`/`--`
  and apostrophes as `\'`. When matching, try all quote variants, escape/unescape
  apostrophes, and entity-decode before comparing against rendered headings.
- Consecutive `DEF:` lines each need their own inline value — do not open a
  value-less DEF and "define it" on the next line; fold the definition into the
  first DEF with its concrete params.
