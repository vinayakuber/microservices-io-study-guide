# Microservice Patterns Study Guide

Study guide for **"Microservice Patterns"** by Chris Richardson (Manning, 2018) and its official companion site, [microservices.io](https://microservices.io) — all 44 patterns, in book order.

> **Read on GitHub / mobile:** [docs/README.md](docs/README.md) — all 44 patterns as Markdown, with flows, annotated `explain-program` traces (gate-checked R1–R11), key concepts, and tap-to-reveal quizzes.

This is the third knowledge base in the series, alongside the [DDIA study guide](https://github.com/vinayakuber/ddia-study-guide) and the [Distributed Patterns study guide](https://github.com/vinayakuber/distributed-patterns-study-guide).

## Sources (strict)

1. **Microservice Patterns** — Chris Richardson, Manning, 2018.
2. **microservices.io** — the official companion site (the canonical text for each pattern).

## Repository layout

- `content/chNN-*.js` — the source of truth for each pattern (flow sections, annotated program traces, concepts, quiz).
- `docs/chNN-*.md` — GitHub-rendered Markdown (generated from `content/` by `node tools/to_markdown.js`).
- `reference/chNN-*.txt` — the extracted source text for each pattern.
- `CHAPTER_INDEX.md` — the 44-pattern catalog with book page numbers and microservices.io URLs.

## The explain-program gate (R1–R11)

Every annotated program block must be a real execution trace with concrete values:

- **R1** — every `// ->` / `// <-` line carries a concrete value.
- **R2** — every `// DEF:` block contains a concrete value.
- **R3** — ≥ 4 concrete-value lines per block.
- **R4** — ≥ 3 value-transformation lines (`x : old -> new`).
- **R5** — size/count units must chain to a seed with explicit arithmetic.
- **R6** — a value that changes must state WHY (`BECAUSE`).
- **R7** — data structures/rows are declared as state before mutation.
- **R8** — no dangling `tok_*` handle (received but never consumed).
- **R9** — idempotency/guard claims must be demonstrated, not asserted.
- **R10** — distinct party ids (no single-letter prefix ambiguity).
- **R11** — declared-entity closure (an account in a double-entry row has its balance declared).

Run it: `node tools/explain_program_gate.js`. A pre-commit hook refuses commits that fail.

## Quick start

```bash
node tools/explain_program_gate.js   # gate check (R1-R11)
node tools/to_markdown.js "Microservice Patterns Study Guide"   # regenerate docs/
```
