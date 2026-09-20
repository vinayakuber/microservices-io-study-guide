# R15 + R16 — System-design wiring

The `/explain-program` gate (byte-identical `tools/explain_program_gate.js` across all three study-guide repos) enforces system-design wiring at two levels, both added 2026-09-20.

**R15 — no bare black-box component.** A `PARTIES:` value that names only a box (`instance`, `node`, `unit`, `server process`, `component`) with no role noun, datastore engine, `@instance`, or parenthetical is a tautology — naming a component is not defining it. Calibrated so middleware names (zipkin/kafka/rabbitmq) are NOT engines (they still need a role noun); only R13's datastore-engine list exempts.

**R16 — systemDesign field on every chapter with a program.** The chapter-level rule R15 missed: each chapter must carry a top-level `systemDesign` object with (1) `pipeline` — the role chain, canonical `writer → transport → collector → aggregator/store → reader` for data-path chapters, else the chapter's own real roles; (2) `decomposition` — ≥1 box with ≥2 named internals/parts; (3) `wiring` — a connected `flowchart LR` mermaid diagram with an edge; (4) `program` — an annotated trace passing R1–R15. `tools/to_markdown.js` renders it as a `## System Design Interview` section.

**Why:** R1–R14 check *within* blocks (values, sizes, read/write verbs, engines); R15 checks a component is *defined*; R16 forces *decomposition + wiring + annotated program* so the "what is Zipkin / where does RabbitMQ sit" question is answered in every chapter, not just ch33.

**How to apply:** never force the five-role pipeline onto a non-data-path chapter — use its real roles (circuit breaker = caller→breaker proxy→downstream; replication = client→leader→log→followers→reader). The wiring diagram's boxes must match the PARTIES in the program. Rollout completed 2026-09-20: MSP 44 chapters (207/0), DDIA 13 (77/0), PDS 30 (174/0), all committed+pushed. Related: [[explain-program-definition-coverage]] (R12, container ≠ concept).
