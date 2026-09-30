#!/usr/bin/env node
'use strict';
/*
 * teaching_gate.js — mechanical checks for the failure classes that have ACTUALLY
 * been caught in review. One rule per observed failure, so that failure cannot recur.
 *
 * HONEST SCOPE: this cannot prove a reader understands. Comprehension is not
 * decidable. What it does is make each PREVIOUSLY OBSERVED failure impossible to
 * ship again, and it is deliberately paired with an independent first-time-reader
 * audit (see SKILL.md §15) which is what finds the classes this file does not know
 * about yet. Every new blocker that audit finds must become a rule here.
 */
const fs = require('fs');

// T1 — a trace step must show its TEST, not just its RESULT.
//      caught: "step 3 · forward 1 -> run 1"  (what moved? by how much? on what test?)
function t1(lines) {
  const out = [];
  for (const { n, s } of lines) {
    if (!/^\s*step \d+\s*·/.test(s)) continue;
    const asksQuestion = s.includes('?');
    const bare = s.replace(/[-=]>/g, ' ');   // strip arrows FIRST: "->" contains ">"
    const hasComparison = /[<>]=?|==|\bdiv\b|\bmod\b/.test(bare);
    // a conclusion may be an arrow ("-> yes, move to run 1") OR a stated answer
    // following the question ("which block holds row 10?  10 div 4 = block 2")
    const afterQ = asksQuestion ? s.slice(s.indexOf('?') + 1) : '';
    const hasConclusion = /->|=>/.test(s) || /=\s*\S+/.test(afterQ);
    const hasNumber = /\d/.test(s);
    if (!hasNumber) out.push([n, 'T1', 'step has no concrete value', s]);
    else if (!asksQuestion && !hasComparison)
      out.push([n, 'T1', 'step states a result with no question asked and no test shown — the reader cannot tell WHY it happened', s]);
    else if (!hasConclusion)
      out.push([n, 'T1', 'step shows a test but never states the conclusion drawn from it', s]);
  }
  return out;
}

// T2 — bare directional shorthand is never self-explanatory.
//      caught: "forward 1", "advance 2" with nothing said about what moves or why.
function t2(lines) {
  const out = [];
  for (const { n, s } of lines) {
    const m = s.match(/\b(forward|advance|skip|jump)\s+\d+\b/i);
    if (m && !/[<>]=?|\?/.test(s.replace(/[-=]>/g, ' ')))
      out.push([n, 'T2', `bare shorthand "${m[0]}" — name what moves, by how much, and the test that decided it`, s]);
  }
  return out;
}

// T3 — every subscripted structure must be introduced before it is used.
function t3(lines) {
  const out = [], introduced = new Map();
  for (const { n, s } of lines) {
    for (const m of s.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\s*=\s*\[/g))
      if (!introduced.has(m[1])) introduced.set(m[1], n);
    // a DEF: line is this skill's way of introducing a thing, so every identifier
    // it names counts as introduced from that line onward
    if (/DEF:/.test(s))
      for (const m of s.matchAll(/\b([A-Za-z][A-Za-z0-9_]{1,})\b/g))
        if (!introduced.has(m[1])) introduced.set(m[1], n);
    for (const m of s.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\[/g)) {   // no space: prose like "range [0,5)" is not a subscript
      const name = m[1];
      if (['if', 'for', 'return', 'rows', 'step'].includes(name)) continue;
      if (!introduced.has(name)) out.push([n, 'T3', `"${name}[...]" is used before it is ever introduced`, s]);
    }
  }
  return out;
}

// T4 — when two index structures coexist, the reader must be told what each is
//      INDEXED BY, that the later is DERIVED from the earlier, and why both survive.
//      caught: starts vs blockRun read as two interchangeable strips of numbers.
function t4(text, lines) {
  const out = [];
  const arrays = [...new Set([...text.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\s*=\s*\[/g)].map(m => m[1]))]
    .filter(a => a.length > 1 && new RegExp(`\\b${a}\\[`).test(text));
  if (arrays.length < 2) return out;
  for (const a of arrays) {
    const introLine = lines.find(l => new RegExp(`\\b${a}\\s*=\\s*\\[`).test(l.s));
    if (introLine && !/indexed by|one entry per/i.test(introLine.s))
      out.push([introLine.n, 'T4', `"${a}" is introduced without saying what it is INDEXED BY — two arrays of small integers look interchangeable until their index domains are named`, introLine.s]);
  }
  if (!/derived from/i.test(text))
    out.push([0, 'T4', `${arrays.length} index structures coexist (${arrays.join(', ')}) but none is stated to be DERIVED from another — the reader cannot tell whether the later one replaces the earlier`, '']);
  if (!/\bboth\b|still (needed|what finishes|required)/i.test(text))
    out.push([0, 'T4', 'no line explains why the EARLIER structure is still needed once the later one exists', '']);
  return out;
}

// T5 — the example must DISCRIMINATE the right model from a plausible wrong one.
//      caught by the first-reader audit: codes were 0,1,2,3,4 so run i held value i,
//      making blockRun identical to "the code at each block's first row". A reader
//      holding the wrong model got the right answer every time and was never corrected.
function t5(text, lines) {
  const out = [];
  const pairs = [...text.matchAll(/\br(\d+):\s*\((-?\d+),\s*(-?\d+)\)/g)]
    .map(m => ({ i: +m[1], v: +m[2], len: +m[3] }));
  if (pairs.length >= 2 && pairs.every(p => p.v === p.i))
    out.push([0, 'T5', 'every entry\'s VALUE equals its own INDEX, so the example cannot tell a correct model from the wrong one — a reader who thinks the structure stores indices gets the right answer every time', '']);
  if (pairs.length >= 2 && pairs.every(p => p.v === p.len))
    out.push([0, 'T5', 'every pair has value == length, so the two fields are indistinguishable on screen', '']);
  const arrays = {};
  for (const { n, s: ln } of lines)
    for (const m of ln.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\s*=\s*\[([^\]]*)\]/g)) {
      const nums = m[2].split(',').map(t => t.trim()).filter(t => /^-?\d+$/.test(t));
      if (nums.length >= 2 && !arrays[m[1]]) arrays[m[1]] = { n, seq: nums.join(',') };
    }
  const names = Object.keys(arrays);
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++)
      if (arrays[names[i]].seq === arrays[names[j]].seq)
        out.push([arrays[names[j]].n, 'T5',
          `"${names[i]}" and "${names[j]}" are different concepts shown as the SAME numerals [${arrays[names[i]].seq}] — nothing on screen can distinguish them`, '']);
  return out;
}

// T7 — a WORKED example whose numbers coincide decides nothing.
//      caught by audit 3: "the last starts entry <= 8 is starts[0] = 0, so
//      blockRun[2] = 0" — the entry's value (0) and its index (0) are the same,
//      so the reader cannot tell which one is stored. A second, non-degenerate
//      case is required (starts[2] = 16 -> blockRun[5] = 2 stores the INDEX 2).
function t7(text) {
  const out = [];
  const worked = [...text.matchAll(/starts\[(\d+)\]\s*=\s*(\d+)[^.]*?blockRun\[\d+\]\s*=\s*(\d+)/g)]
    .map(m => ({ i: +m[1], val: +m[2], stored: +m[3] }));
  if (worked.length && worked.every(w => w.val === w.stored))
    out.push([0, 'T7', 'every worked case has the entry VALUE equal to the stored result, so nothing shows which of the two is being stored — add a case where they differ', '']);
  return out;
}

// T11 — say WHEN the structure is built, and from what. Caught by the reader:
//       "are we sorting based on campaign during insert time only?" Every artifact
//       showed the finished, sorted, immutable segment and none showed the
//       lifecycle that produces it — so a reader reasonably assumes it is
//       maintained per row, per insert. Name the moment (seal/build/write time),
//       the input it consumes, and that it is immutable afterwards.
function t11(text) {
  const BUILT = /\b(index|sorted|encoded|segment|posting list|dictionary)\b/i;
  const WHEN = /\bat (write|build|seal|index|ingest|insert|query) time\b|\bwhen (the|that) (buffer|segment) is (sealed|full|flushed)\b|\bonce per segment\b|\bsealed\b|\bat seal\b/i;
  return (BUILT.test(text) && !WHEN.test(text))
    ? [[0, 'T11', 'the material describes a built structure but never says WHEN it is built or from what — a reader will assume it is maintained per insert', '']]
    : [];
}

// T12 — state the BOUNDARY of the benefit. Caught by the same reader: "can I
//       randomly query on another value?" The material said sorting makes the
//       lookup cheap and never said which queries do NOT get that path, or what
//       serves them instead — an unbounded benefit reads as a universal one.
function t12(text) {
  const CLAIMS = /\bwithout scanning\b|\bone (contiguous )?range\b|\binstead of a (walk|scan)\b|\bfixed number of steps\b/i;
  const LIMIT = /\bnot sorted\b|\bdoes not help\b|\bfalls? back\b|\bany other column\b|\bonly the sort\b|\bdoes not (cover|answer)\b|\bcannot\b/i;
  return (CLAIMS.test(text) && !LIMIT.test(text))
    ? [[0, 'T12', 'the material claims a fast path but never says which queries do NOT get it, or what serves them instead — state the boundary or the benefit reads as universal', '']]
    : [];
}

// T10 — the INSTANCE must come before the ABSTRACTION. Caught by the reader,
//       who called the first attempt "one of the worst explanations": it opened
//       with a comparison table of "two different directions" before showing a
//       single row of data, named a `clicks` column whose values never appeared,
//       and used a range like [0, 9) that was never derived. A reader cannot
//       check a generalisation they have not yet seen an example of. Show the
//       data, run the real request on that data with real numbers, and only then
//       name the pattern.
function t10(text) {
  const out = [];
  const dataBlock = (() => {
    const re = /```[\s\S]*?```/g; let m;
    while ((m = re.exec(text))) if ((m[0].match(/\d/g) || []).length >= 6) return m.index;
    return -1;
  })();
  const absTable = text.search(/\n\|[^\n]*\|[^\n]*\n\|\s*-{2,}/);
  const absPhrase = text.search(/\btwo (different )?(directions|kinds|types|ways|structures)\b/i);
  const abstraction = [absTable, absPhrase].filter(i => i !== -1).sort((a, b) => a - b)[0];
  if (abstraction === undefined) return out;
  if (dataBlock === -1)
    out.push([0, 'T10', 'the material generalises (a comparison table, or "two directions") but never shows the concrete data those categories are about', '']);
  else if (abstraction < dataBlock)
    out.push([0, 'T10', 'the abstraction appears BEFORE any concrete data: show the rows and run the request on them first, then name the pattern', '']);
  return out;
}

// T9 — the material must show the REQUEST it serves before it shows mechanism.
//      caught by the reader: the walkthrough opened at "which code is at row 23?"
//      — but nobody ever asks that. It is an INTERNAL question. Without the real
//      request above it (SELECT sum(clicks) ... WHERE campaign = 41) the reader
//      cannot tell what is being queried, why positions matter, or what the
//      mechanism contributes. Require a user-level request BEFORE the first step.
function t9(text) {
  const out = [];
  const req = text.search(/\bSELECT\b|\bGET\s+\/|\bcurl\b|\bapi\.[a-z]/i);
  const firstStep = text.search(/\b(step 1|Step 1 of)\b/i);
  if (firstStep === -1) return out;                    // not a stepped artifact
  if (req === -1)
    out.push([0, 'T9', 'no user-level request anywhere: the material teaches a mechanism without ever showing the query it serves, so the reader cannot tell what is actually being asked', '']);
  else if (req > firstStep)
    out.push([0, 'T9', 'the user-level request appears AFTER the first step: state the real query first, then show which part of answering it this mechanism is', '']);
  return out;
}

// T8 — a CLAIM must be checkable from what is shown. Caught in review:
//      "From here the column at 0x100 is never touched again — that is what the
//      index bought." Never touched by whom? For this query or ever? Bought
//      compared to what? An absolute word (never/always/only/nothing/cannot)
//      asserts something the reader cannot verify unless the same sentence says
//      WHERE to look — a line number, a named symbol, or a count.
//      Note this fires on CAPTIONS and prose, which T1 never inspected: T1 only
//      looks at lines beginning "step N ·", so free prose made unchecked claims.
function t8(lines) {
  // Narrow, on purpose. "blockRun only reaches the run a block begins in" is
  // precise and gives its reason in the same breath; flagging every "only" buries
  // the real defect. What actually misleads is a payoff asserted with no agent
  // and no comparison — "the column is never touched again — that is what the
  // index bought": touched by WHOM, and bought against WHAT alternative?
  const CLAIM = /that is what .{0,40}\b(bought|buys|gives|gets|wins)\b|the whole point\b|\bnever (touched|used|read|needed|looked at)\b|\bno longer needed\b|\bnothing (else )?(happens|changes|is written)\b/i;
  // An anchor is not "contains a digit" — decorative numbers like 0x100 are
  // everywhere. It must POINT somewhere the reader can look: a line reference, an
  // instruction to check or count, a named panel, or an explicit n-of-m contrast.
  const ANCHOR = /\blines?\s+\d+|\bcheck\b|\bcount\b|\bappears on\b|\blook at\b|\bpanel\b|\brow says\b|\bshows\b|\b\d+\s+of\s+the\s+\d+\b/i;
  const out = [];
  for (const { n, s: ln } of lines) {
    if (/^\s*(\/\/)?\s*(step|query step) \d+/.test(ln)) continue;   // T1 owns those
    const m = ln.match(CLAIM);
    if (m && !ANCHOR.test(ln))
      out.push([n, 'T8', `payoff asserted with no agent and no comparison ("${m[0].trim()}") and nothing in the caption says where to check it — name WHO does not touch it, and what the alternative would cost`, ln.trim()]);
  }
  return out;
}

// T6 — a rule that reads arr[i+1] must say what happens at the LAST element.
//      caught by the audit: "run i owns [starts[i], starts[i+1])" left the final run
//      unbounded, so a sixth of the column could not be decoded by the stated rule.
function t6(text) {
  const out = [];
  if (/\[\s*[ik]\s*\+\s*1\s*\]/.test(text) && !/sentinel|last (run|entry|element|row)/i.test(text))
    out.push([0, 'T6', 'a rule indexes [i+1] but the material never says what bounds the LAST element — every query in the final run is undefined', '']);
  return out;
}

const unesc = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');

const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').replace('--only=', '')
  .split(',').filter(Boolean).map(x => x.toUpperCase());
const EXCEPT = (process.argv.find(a => a.startsWith('--except=')) || '').replace('--except=', '')
  .split(',').filter(Boolean).map(x => x.toUpperCase());
const files = process.argv.slice(2).filter(a => !a.startsWith('--only=') && !a.startsWith('--except='));
if (!files.length) { console.error('usage: teaching_gate.js <file...>'); process.exit(2); }
let bad = 0, checked = 0;
// An EMPTY (or near-empty) input must FAIL, never PASS. Every T-check is "is
// there a defect in this text?", so no text means no defects means PASS — which
// is how a broken extraction reported "1/1 files pass the teaching gate" while
// checking nothing at all. A gate that cannot tell "clean" from "absent" is not
// a gate. Override per file with --min=N when a genuinely tiny file is intended.
const MIN = +((process.argv.find(a => a.startsWith('--min=')) || '--min=200').replace('--min=', ''));
for (const f of files) {
  const text = unesc(fs.readFileSync(f, 'utf8'));
  if (text.trim().length < MIN) {
    console.log(`FAIL ${f}`);
    console.log(`  EMPTY INPUT: ${text.trim().length} chars (minimum ${MIN}). Nothing was checked.`);
    console.log(`  An empty file passes every check vacuously, so this is reported as a FAILURE, not a pass.`);
    console.log(`  Usually means the upstream extraction broke — fix that, do not lower --min.`);
    bad++; checked++;
    continue;
  }
  const lines = text.split('\n').map((s, i) => ({ n: i + 1, s }));
  let findings = [...t1(lines), ...t2(lines), ...t3(lines), ...t4(text, lines), ...t5(text, lines), ...t6(text), ...t7(text), ...t8(lines), ...t9(text), ...t10(text), ...t11(text), ...t12(text)];
  if (ONLY.length) findings = findings.filter(f => ONLY.includes(f[1]));
  if (EXCEPT.length) findings = findings.filter(f => !EXCEPT.includes(f[1]));
  checked++;
  if (findings.length) {
    bad++;
    console.log(`FAIL ${f}`);
    for (const [n, rule, why, s] of findings)
      console.log(`  ${rule} line ${n}: ${why}${s ? `\n       "${s.trim().slice(0, 96)}"` : ''}`);
  } else console.log(`PASS ${f}`);
}
console.log(`\n${checked - bad}/${checked} files pass the teaching gate`);
process.exit(bad ? 1 : 0);
