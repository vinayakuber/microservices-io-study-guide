# /explain-program — annotation standard

This directory is the canonical spec for the `/explain-program` annotation
standard that this repo's content must satisfy. It is kept in sync across all
three study-guide repos (microservices-io, ddia, distributed-patterns).

## Files

- **SKILL.md** — the full skill: the annotation markers (`DEF` / `->` / `<-`),
  the R1–R16 gate rules, the execution-trace standard, the placement table,
  and the self-audit.
- **definition-coverage.md** — the R12 rule note: definition *coverage*, not
  presence (declaring a container does not define the concept it holds).
- **system-design-wiring.md** — the R15 + R16 rule note: no bare black-box
  component, and the per-chapter `systemDesign` field (pipeline +
  decomposition + wiring diagram + annotated program).

## Enforcement & rendering

- `tools/explain_program_gate.js` — the mechanical gate (R1–R16); run by the
  pre-commit hook.
- `tools/to_markdown.js` — renders each chapter's `systemDesign` field as the
  `## System Design Interview` section.
- `tools/pre-commit` — blocks a commit when the gate reports any issue.
