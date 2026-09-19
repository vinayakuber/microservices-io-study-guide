#!/usr/bin/env node
// Strict explain-program gate — enforces CONCRETE VALUES in every annotated
// program block. A block that only restates the concept in prose, with no
// worked input/output/value, fails.
//
// Rules (per flow section that has a `program`):
//   R1  every `// ->` (input) and `// <-` (output) line must carry a concrete
//       value — a digit, a quoted literal, or an `= value`.
//   R2  every DEF block must contain at least one concrete-value line
//       (digit or quoted literal). A DEF block is the text from one `// DEF:`
//       to the next `// DEF:` (or end of program).
//   R3  the program overall must have >= 4 concrete-value lines.
//
// Run (from repo root):  node tools/explain_program_gate.js
global.CHAPTERS = [];
global.registerChapter = function (c) { CHAPTERS.push(c); };
const fs = require('fs');
for (const f of fs.readdirSync('content').filter(x => x.endsWith('.js')).sort()) {
  eval(fs.readFileSync('content/' + f, 'utf8'));
}
CHAPTERS.sort((a, b) => a.num - b.num);

const VALUE = /\d|"[^"]+"|'[^']+'/;
const failures = [];
let programs = 0;

for (const ch of CHAPTERS) {
  for (const s of (ch.flow || [])) {
    const p = s.program;
    if (!p || !String(p).trim()) continue;
    programs++;
    const L = p.split('\n');
    const probs = [];

    // R1: bare ->/<- lines
    L.forEach((l, i) => {
      if (/^\/\/ (->|<-)/.test(l) && !VALUE.test(l)) probs.push(`R1 bare ${l.trim().slice(0, 60)}`);
    });

    // R2: standalone DEF blocks without a concrete value (inline `// DEF: field`
    // signatures on a code line are exempt — they are declarations, not mechanisms)
    const defIdx = [];
    L.forEach((l, i) => { if (/\/\/ DEF:/.test(l)) defIdx.push(i); });
    for (let b = 0; b < defIdx.length; b++) {
      const start = defIdx[b];
      if (!/^\/\/ DEF:/.test(L[start])) continue;
      const end = (b + 1 < defIdx.length ? defIdx[b + 1] : L.length);
      const seg = L.slice(start, end);
      if (seg.some(l => VALUE.test(l))) continue;
      probs.push(`R2 no value in block: ${L[start].trim().slice(0, 70)}`);
    }

    // R3: overall value floor
    const valLines = L.filter(l => VALUE.test(l)).length;
    if (valLines < 4) probs.push(`R3 only ${valLines} concrete-value lines`);

    // R4: an execution trace — >= 3 value-transformation lines (a line with a
    // ` -> ` arrow carrying a concrete value), excluding the ->/<- IO markers.
    const isIO = l => /^\/\/\s*(->|<-)/.test(l);
    const transforms = L.filter(l => !isIO(l) && / -> /.test(l) && /(\d|["'=])/.test(l)).length;
    if (transforms < 3) probs.push(`R4 only ${transforms} value transformations (need a >= 3-step trace)`);

    // R5: logical derivation — when a program mentions byte-size/count units,
    // it must show at least one explicit arithmetic step (e.g. "256 MB / 4 KB
    // = 65,536") so the sizes form ONE connected chain instead of appearing
    // from nowhere (the 4 KB -> 256 MB jump defect).
    const hasSize = /\d\s*(KB|MB|GB|TB|kB|kb|mb|gb|bytes?|bits?)\b/i.test(p);
    const derivs = L.filter(l => /\/\/.*\d.*[×x*/]\s*\d/.test(l)).length;
    if (hasSize && derivs < 1) probs.push(`R5 size units present but no derivation line (sizes must chain to a seed)`);

    // R6: causal link — a size/count that CHANGES must state WHY it changes
    // (the mechanism, not just the math). E.g. "898 MB BECAUSE the merge is
    // the union of 4 files' keys". The reader must see the cause of a change.
    const causal = /(BECAUSE|because|the ratio|is the union|merges? into|causes?|since it)/.test(p);
    if (hasSize && !causal) probs.push(`R6 sizes change but no cause stated (state WHY: merge? ratio? union?)`);

    // R7: state declaration — the program must initialize its data structures/
    // rows with concrete values (`sparse_index : {"handbag" -> 0}`,
    // `kv : {}`, `wallet_balances: [A | 0.00]`) BEFORE mutating them. An id or
    // row referenced by the program must be declared as state first.
    const stateDecl = L.filter(l => /[a-zA-Z_][\w]*(\[[^\]]+\])?(\.[a-z_]+)?\s*:\s*[\[{"']/.test(l)).length;
    if (stateDecl < 1) probs.push(`R7 no state declaration (declare the data structures/rows before the program)`);

    // R8: no dangling token handle — a tok_* value received but never stored or
    // passed on (the exact "token returned but unused" defect). Citations and
    // one-time request ids are not handles and are exempt.
    const handles = p.match(/\btok_\w+/g) || [];
    const hcount = {};
    for (const h of handles) hcount[h] = (hcount[h] || 0) + 1;
    const dangling = Object.keys(hcount).filter(h => hcount[h] === 1);
    if (dangling.length) probs.push(`R8 dangling token(s): ${dangling.join(', ')} (received but never consumed)`);

    // R9: demonstrate, don't assert — a guard/idempotency/dedup claim must be
    // paired with the actual operation that performs it (INSERT ON CONFLICT /
    // duplicate-key / DO NOTHING), not just named.
    const claims = /idempoten|dedup/i.test(p);
    const ops = /INSERT|ON CONFLICT|DO NOTHING|duplicate|existing|saved|already|compare-and-set|seen|skip|contains/i.test(p);
    if (claims && !ops) probs.push(`R9 idempotency/guard claimed but not demonstrated (show the dedup/guard operation with values)`);
    // R10: distinct party ids — a single-letter id (A, B) must not be a prefix
    // of a longer id (B vs B1 = ambiguous buyer/seller).
    const sset = new Set(); let sm;
    const sre = /\[([A-Z])\]|\|\s*([A-Z])\s*\|/g;
    while ((sm = sre.exec(p))) sset.add(sm[1] || sm[2]);
    const mset = new Set(p.match(/\b[A-Z][A-Za-z0-9]*\d[A-Za-z0-9_-]*\b/g) || []);
    const amb = [...sset].filter(s => [...mset].some(x => x.startsWith(s)));
    if (amb.length) probs.push(`R10 ambiguous id(s): ${amb.join(', ')} (distinct parties need distinct ids)`);
    // R11: declared-entity closure — an account referenced in a double-entry row
    // (`| account | signed-delta |`) must have its initial balance declared.
    const acctRe = /\|\s*([a-z][a-z0-9_]*)\s*\|\s*[-+]\d/g;
    const accounts = new Set(); let am;
    while ((am = acctRe.exec(p))) accounts.add(am[1]);
    const declaredAccts = new Set();
    for (const l of L) { const dm = l.match(/^\s*\/\/\s*([a-z][a-z0-9_]*)\s*:\s*[-+]?\d/); if (dm) declaredAccts.add(dm[1]); }
    const unacct = [...accounts].filter(a => !declaredAccts.has(a));
    if (unacct.length) probs.push(`R11 undeclared account(s): ${unacct.join(', ')} (declare its initial balance)`);



    if (probs.length) failures.push({ id: ch.id, section: s.section, probs });
  }
}

for (const f of failures) {
  console.log(`${f.id} | ${f.section}`);
  for (const pr of f.probs) console.log(`    ${pr}`);
}
console.log(`\n${programs} programs checked · ${failures.length} programs with issues`);
process.exit(failures.length ? 1 : 0);
