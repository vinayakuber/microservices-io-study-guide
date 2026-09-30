#!/usr/bin/env node
'use strict';
/*
 * callable_gate.js — every callable in a listing must be SHOWN, not just named.
 *
 * WHY THIS EXISTS
 *   `lastIdx` was declared as `fun lastIdx(starts, row) { ... }` and never
 *   demonstrated: no worked call, and no step of the walkthrough ever stepped
 *   inside it. The reader is told a function exists, sees it invoked, and is left
 *   to simulate it in their head. R41 required a worked example for `// primitive:`
 *   declarations only, so a real `fun` slipped straight past it — the rule was
 *   attached to the SYNTAX rather than to the reader's need.
 *
 * THE RULE
 *   For every callable the listing declares — `fun name(...)` or `// primitive: name`
 *   — at least ONE of these must hold:
 *     (a) a WORKED EXAMPLE appears in the listing: a line containing
 *         `name(<args>) = <result>`, with concrete values on both sides; or
 *     (b) the walkthrough TRACES it: some step highlights a line strictly inside
 *         its body, so the reader watches it run.
 *   `main` is exempt: it is the entry point, and the whole walkthrough is its trace.
 *
 * Neither (a) nor (b) means the reader has to guess what the call returns. That
 * is the defect.
 */
const fs = require('fs'), path = require('path');

const dirs = process.argv.slice(2).length ? process.argv.slice(2)
  : fs.readdirSync(path.join('diagrams', 'anim'))
      .map(d => path.join('diagrams', 'anim', d))
      .filter(d => fs.existsSync(path.join(d, 'source.json')));
if (!dirs.length) { console.error('no source.json found'); process.exit(2); }

let bad = 0, nCall = 0, nFind = 0;
for (const dir of dirs) {
  const src = JSON.parse(fs.readFileSync(path.join(dir, 'source.json'), 'utf8')).src;
  const stepsFile = path.join(dir, 'steps.json');
  const steps = fs.existsSync(stepsFile) ? JSON.parse(fs.readFileSync(stepsFile, 'utf8')).steps : [];
  const hot = new Set(steps.flatMap(s => s.line || []));

  // declarations
  const callables = [];
  src.forEach((raw, i) => {
    let m;
    if ((m = raw.match(/^fun\s+([A-Za-z_]\w*)\s*\(/))) {
      let end = src.length - 1;
      for (let j = i + 1; j < src.length; j++) if (/^\}\s*$/.test(src[j])) { end = j; break; }
      callables.push({ name: m[1], kind: 'fun', line: i, end });
    } else if ((m = raw.match(/^\s*\/\/\s*primitive:\s*([A-Za-z_]\w*)/))) {
      // A primitive declared WITHOUT being called anywhere is a value sentinel
      // (e.g. NONE), not a callable — there is no call to work an example for.
      // symbol_gate already requires it to be declared before use.
      const called = src.some((l, j) => j !== i && new RegExp(`\\b${m[1]}\\s*\\(`).test(l.replace(/^\s*\/\/.*$/, '')));
      if (called) callables.push({ name: m[1], kind: 'primitive', line: i, end: i });
    }
  });

  const findings = [];
  for (const c of callables) {
    if (c.name === 'main') continue;
    nCall++;
    // (a) a worked example: name(...) = <concrete>  or  name(...) -> <concrete>
    // Does the declaration take parameters? A zero-arg call's worked example
    // legitimately has empty parens — requiring args rejected `readColumn() = [...]`,
    // which is a checker bug, not a missing example.
    const decl = src[c.line];
    const dm = decl.match(new RegExp(`\\b${c.name}\\s*\\(([^)]*)\\)`));
    const takesArgs = !!(dm && dm[1].trim().length);
    const example = src.some((l, j) => {
      // the declaration line itself is not a demonstration of the declaration
      // BALANCE the parens. `[^)]*` stopped at the first `)`, which for a nested
      // example call like field(readBlock(store, 0), "campaign") = 41 is the INNER
      // one — so a perfectly good worked call was reported as missing.
      const re = new RegExp(`\\b${c.name}\\s*\\(`, 'g');
      let m;
      while ((m = re.exec(l)) !== null) {
        let i = m.index + m[0].length, depth = 1;
        while (i < l.length && depth > 0) { if (l[i] === '(') depth++; else if (l[i] === ')') depth--; i++; }
        if (depth !== 0) continue;
        const args = l.slice(m.index + m[0].length, i - 1).trim();
        const after = l.slice(i).match(/^\s*(?:=|->)\s*(\S+)/);
        if (!after) continue;
        const res = after[1].trim();
        if (takesArgs && !args.length) continue;
        // a concrete result: a number, quoted string, list/map, boolean or sentinel
        if (/^(?:[\d"'\[\{(]|true\b|false\b|NONE\b|-\d)/.test(res)) return true;
      }
      return false;
    });
    // (b) traced: a step highlights a line strictly inside the body
    const traced = c.kind === 'fun' && [...hot].some(l => l > c.line && l <= c.end);
    if (!example && !traced)
      findings.push(`${c.kind} \`${c.name}\` (line ${c.line + 1}) is neither shown by a worked call nor stepped into by any step — the reader must simulate it`);
  }
  if (findings.length) { bad++; nFind += findings.length; console.log(`FAIL ${dir}`); findings.forEach(f => console.log('  ' + f)); }
  else console.log(`PASS ${dir}  (${callables.length} callables, each exampled or traced)`);
}
console.log(`\n${dirs.length - bad}/${dirs.length} listings show every callable · ${nCall} callables checked · ${nFind} findings`);
process.exit(bad ? 1 : 0);
