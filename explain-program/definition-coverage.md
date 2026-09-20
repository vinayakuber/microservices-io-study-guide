# R12 — Definition coverage (container ≠ concept)

The recurring defect class the user keeps catching in `/explain-program` output is **definition-coverage, not presence**. Declaring a container (`trace_registry : {}`, `spans : []`) does NOT define the concept it holds (`trace`, `span`, `trace_id`, `parent`). A gate that only checks that DEF blocks *that exist* carry a value (R2, existential) can never catch a term that is *used but never defined*. That is the exact gap behind "you mentioned trace/span but never said what they are".

**Why:** the exemplars were themselves definition lists, and the gate asked "does some value exist somewhere" rather than "is every term the program names actually grounded". Presence-checks pass; coverage-checks fail.

**How to apply:** when the user asks "what rule is missing and how could you miss it", do all three: (a) name the exact rule, (b) own how it slipped through (presence vs coverage), (c) add a *mechanical* check that makes it unrepeatable, then fix the whole corpus and re-run the gate. For explain-program that check is R12 in `microservices-io-study-guide/tools/explain_program_gate.js`: singularize every STATE-declared container stem and require a DEF/->/STATE/PARTIES definition; the singularizer must recognize true singulars (response/process/chassis, not respon/proces/chassi) and match case-insensitively (`gw` == `GW` party).
