# Authoring brief — Microservice Patterns study-guide content

You are authoring ONE chapter of the study guide as a JavaScript content file.
Read this whole brief before writing anything. Then read your chapter's
`reference/chNN-<slug>.txt`, and write `content/chNN-<slug>.js`.

The source of truth is **Chris Richardson's "Microservice Patterns"** as captured
in the reference text (microservices.io scrape, or a book-page extraction for the
4 book-only patterns). **Do NOT invent mechanisms or facts that are not in the
reference.** You may restate, order, and make the mechanism concrete, but the
pattern, its context/problem/forces/solution/result must match the reference.

## 1. Output file contract (exact shape)

Write ONE file `content/chNN-<slug>.js` whose top level is a single call:

```js
registerChapter({
  id: 'ch14',
  num: 14,
  title: 'Transactional Outbox',
  pattern: '<one-sentence summary of what the pattern IS>',
  aka: 'Chris Richardson · Microservice Patterns Ch. · microservices.io /patterns/...',
  part: 4,
  flow: [
    {
      section: '<section heading>',
      color: 'orange',
      motivation: `ONE or two sentences: WHY this section matters — what breaks without it, and what it buys.`,
      steps: [
        { num: 1, title: '<step title>', detail: '<one or two sentences>' },
        { num: 2, title: '<step title>', detail: '<one or two sentences>' },
        { num: 3, title: '<step title>', detail: '<one or two sentences>' }
      ],
      program: `...the annotated trace — see section 2...`
    },
    ... 3 to 4 sections total ...
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: '<title>', content: '<p><strong>Why.</strong> ...</p><p><strong>Claim.</strong> ...</p><p><strong>Grounding.</strong> ...</p><p><strong>In the wild.</strong> ...</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: '<title>', content: '...' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: '<title>', content: '...' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: '<title>', content: '...' }
    ]
  },
  quiz: [
    { "question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": 2, "explanation": "...", "conceptRef": "..." },
    ... 4 questions total ...
  ]
});
```

Quoting rules (STRICT — a syntax error fails the whole repo):

- `id`, `num`, `title`, `pattern`, `aka` → **single quotes**. Escape apostrophes as `\'`
  (e.g. `title: 'Consumer-Driven Contract Test'` needs none, but `'The Database\'s Log'` does).
- `part` → the integer book part (1–10), per the registry comment.
- `motivation` and `program` → **backtick template literals**. Never put a backtick inside
  the `program` text. Never put an unescaped backtick in `motivation`.
- `steps[].title` and `steps[].detail` → **single quotes**; escape `\'`. `detail` may
  contain `<strong>`/`</strong>` (they are rendered as bold).
- `concepts[].cards[].title` and `.content` → **single quotes**; `content` is a single
  HTML string (escape `\'`). Structure each card as 4 paragraphs: `<strong>Why.</strong>`,
  `<strong>Claim.</strong>`, `<strong>Grounding.</strong>`, `<strong>In the wild.</strong>`.
- `quiz` array → **JSON style (double quotes)** for `question`, `options`, `explanation`,
  `conceptRef`. Apostrophes inside double quotes are fine unescaped. `answer` is the
  1-based index of the correct option (2 = B). `options` are 4 strings "A. …", "B. …", etc.

### Per-chapter depth (do not under- or over-deliver)

- **flow**: 3–4 sections. Each section: 3–5 steps + one `program` block.
- **concepts.cards**: exactly 4 cards. Use tags: one `problem`, one `solution`, two
  `tradeoff` (adjust to the pattern; every card needs a `tagLabel` matching its role).
- **quiz**: exactly 4 questions, 4 options each, `answer` correct, `explanation` that
  also says why the wrong options are wrong.

## 2. The `program` block — the hard part (R1–R11 gate)

This is the single most important deliverable. It is **NOT a definition list**. It is a
**simulated execution trace**: initialize concrete data structures with concrete values,
push ONE concrete input through, show the state changing at each step, emit the concrete
output. Every term is defined at first use WITH its concrete instance.

Template (start every block from this skeleton):

```
// <SIDE> SIDE — <ONE scenario, one seed>
// DEF: <seed/participant> — <what it is> = <concrete value> · <source/reason>
// -> <input> : <concrete value>
//    step 1 · <operation> : <value> -> <value>   BECAUSE <mechanism>
//    step 2 · <operation> : <value> -> <value>
//    step 3 · <operation> : <value> -> <value>
// <- <output> : <concrete value>
//    alt <variant> : <different concrete outcome>
```

Use `// ` comment lines for the trace. One or two bare executable lines (e.g.
`outbox = insert(order_id, event);`) are fine to anchor it, but the value changes live in
the `//` annotations. Each `->` line is an input carrying a value; each `<-` line is an
output carrying a value; every value CHANGE uses the `: old -> new` form.

### The 11 gate rules (your block must satisfy ALL of them)

- **R1** — every `// ->` and `// <-` line carries a concrete value (digit, `"quoted"`,
  or `= value`). No bare labels.
- **R2** — every standalone `// DEF:` block (from one `// DEF:` to the next) contains at
  least one concrete value (digit or quoted literal).
- **R3** — the block has ≥ 4 lines with a concrete value.
- **R4** — the block has ≥ 3 lines of the form `x : old -> new` (a ` -> ` arrow carrying
  a value) that are NOT the `// ->`/`// <-` IO markers. These are the value transformations.
- **R5** — if the block mentions a size/count unit (`KB|MB|GB|TB|bytes|bits|…`), it must
  contain ≥ 1 explicit arithmetic derivation line, e.g. `= 256 MB / 4 KB = 65,536 blocks`.
  Avoid mentioning byte units you won't derive; if you use them, chain them to a seed.
- **R6** — if a size/count CHANGES, state WHY with a causal connective: `BECAUSE`,
  `the ratio`, `is the union`, `merges into`, `causes`, or `since it`.
- **R7** — declare the data structures/rows as state before mutating them. At least one
  line of the form `identifier : <concrete collection/literal>` (e.g.
  `//    orders : {}`, `//    account : 0.00`, `//    outbox : []`). Prefer a full
  `STATE (before)` block listing the rows.
- **R8** — no dangling `tok_*` handle. If a token appears, it must appear ≥ 2 times
  (received AND stored/passed). Simplest: avoid `tok_` entirely; use concrete ids like
  `msg_id = "MSG-1"`.
- **R9** — if the block claims idempotency/dedup (the words `idempoten`/`dedup` appear),
  it must also show the actual operation (`INSERT`, `ON CONFLICT`, `DO NOTHING`,
  `duplicate`, `existing`, `saved`, `already`, `compare-and-set`, `seen`, `skip`,
  `contains`). Demonstrate the guard with values, do not assert it.
- **R10** — distinct party ids. A single-letter id (`[A]`, `| B |`) must NOT be a prefix
  of a longer id (`A1`). Use unambiguous ids: `[SVC]`, `[DB]`, `[BRK]`, or numbered
  `[U1]`, `[U2]` (and never mix `U` with `U1`). In double-entry rows use lowercase
  account names (`| order_service | +100 |`).
- **R11** — declared-entity closure. Any account name in a double-entry row
  (`| account | signed-delta |`, e.g. `| buyer | -10 |`) must have its initial balance
  declared somewhere in the block as `// buyer : 100` (or similar). If the pattern has no
  double-entry accounting, R11 simply won't trigger — but declare every entity you mutate
  anyway (good practice and satisfies R7).

### Numerical consistency: ONE seed, everything derived

Pick ONE concrete scenario and ONE seed value; derive every other number from it with the
arithmetic shown. Do NOT pick unrelated illustration numbers. If the pattern has no natural
size math (e.g. "circuit breaker"), still pick one concrete stateful scenario (one request,
one failure count) and thread its values through the whole trace. Every change names its
cause.

### Party legend requirement

When the block involves >1 party (service, DB, broker, client), give each a DISTINCT id and
add a one-line legend at the top, e.g.:

```
// PARTIES: SVC = Order Service · DB = its database · BRK = message broker · U1 = user
```

## 3. Worked exemplar (this is the bar — not optional)

```java
// ORDER SERVICE SIDE — publish an event atomically with a business write, without 2PC
// PARTIES: SVC = Order Service · DB = its database · BRK = message broker
// STATE (before):
//    orders : { "PO-2001": {status:"PENDING"} }
//    outbox : []                         // the transactional outbox table, empty
// DEF: create_order · CALLED BY: U1 placing an order
// -> order_id : "PO-2001" · -> total : 100.00
//    step 1 · begin local transaction T1 on DB (NO 2PC — the broker is not enlisted)
//    step 2 · INSERT INTO orders (id,status) VALUES ("PO-2001","PENDING")     // orders : {} -> {"PO-2001":{...}}
//    step 3 · INSERT INTO outbox (id, event) VALUES (1, "order_created")      // outbox : [] -> [(1,"order_created")]
//    step 4 · COMMIT T1  -> both rows durable or neither (atomic)  BECAUSE the outbox row is written IN the same local transaction
// <- side effect : outbox : [] -> [(1,"order_created")] · BRK untouched (0 messages sent yet)
//
// DEF: relay · CALLED BY: a separate polling process, every 100 ms
// -> poll : SELECT * FROM outbox WHERE sent=false     // returns [(1,"order_created")]
//    step 1 · publish (1,"order_created") to BRK topic "orders"
//    step 2 · UPDATE outbox SET sent=true WHERE id=1   // outbox : [(1,"order_created",sent=false)] -> [(1,"order_created",sent=true)]
// <- message : "order_created" delivered to BRK · crash window = step 1..2 -> at-least-once
//    alt crash after step 1, before step 2 : relay restarts, re-publishes the SAME id 1 -> duplicate
//       -> consumers must be idempotent: INSERT ... ON CONFLICT DO NOTHING on a processed-msg table
```

Count the checks: R1 (`-> order_id : "PO-2001"`, `<- message : ...` carry values) · R2
(every DEF has a value) · R3 (many value lines) · R4 (`orders : {} -> {...}`,
`outbox : [] -> [...]`, `sent=false -> true`) · R7 (`//    orders : {...}`, `//    outbox : []`) ·
R8 (no tok_) · R9 (`idempotent` + `ON CONFLICT DO NOTHING`) · R10 (no single-letter ids) ·
R11 (no `| acct | ±n |` rows, so n/a). This is the quality bar.

## 4. Before you finish — self-audit

1. Run through R1–R11 mentally against every `program` block (count the R4 transformations).
2. Confirm the file has NO raw backtick inside `program`, no unescaped `'` in single-quoted
   strings, and the `quiz` uses double quotes.
3. Confirm every fact/mechanism traces to the reference text (no invented patterns).
4. Confirm 3–4 flow sections, 4 concept cards, 4 quiz questions.

Write the file and report: the chapter number, the flow sections you wrote, and a one-line
"self-audit: R1–R11 pass" note per program block.
