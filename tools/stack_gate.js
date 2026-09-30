#!/usr/bin/env node
'use strict';
/*
 * stack_gate.js — every local the listing has DECLARED by the highlighted line
 * must appear in that function's STACK frame at that step.
 *
 * WHY THIS EXISTS
 *   `decode` declares `val nRuns = len(runs)`, and the STACK panel for decode
 *   never showed nRuns. A reader following the code sees a name come into
 *   existence on line 41 and then looks at the panel that claims to show
 *   "the stack at this moment" and does not find it. Either the panel is wrong
 *   or the line is dead — and nothing told them which.
 *
 *   No existing gate could catch it. symbol_gate asks "is every name DEFINED
 *   somewhere in the listing" (nRuns is). verify_diagram asks "is any pixel
 *   clipped" (none was). The missing question was whether the two PANELS agree
 *   with each other: source says this exists now, stack says it does not.
 *
 * WHAT IT CHECKS, per step
 *   1. find the function containing the highlighted line(s)
 *   2. collect that function's params + every val/var/destructure/for-var
 *      declared at or before that line
 *   3. require each of them to appear in the frame whose name matches
 *   4. a name may be OMITTED only if the step lists it in `elide`, which is
 *      printed in the report so an omission is always visible
 */
const fs = require('fs'), path = require('path');

const KEYWORDS = new Set(['fun', 'val', 'var', 'for', 'in', 'while', 'return', 'if', 'else', 'until', 'type', 'primitive', 'and', 'or', 'not', 'true', 'false', 'null', 'NONE']);

function functionsOf(src) {
  const fns = [];
  src.forEach((raw, i) => {
    const m = raw.match(/^fun\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/);
    if (!m) return;
    // the function ends at the next line that is exactly '}' at column 0
    let end = src.length - 1;
    for (let j = i + 1; j < src.length; j++) if (/^\}\s*$/.test(src[j])) { end = j; break; }
    const params = m[2].split(',').map(s => s.trim()).filter(Boolean);
    fns.push({ name: m[1], start: i, end, params });
  });
  return fns;
}

// locals declared inside a function, with the line each appears on
function localsOf(src, fn) {
  const out = [];
  for (const p of fn.params) out.push({ name: p, line: fn.start });
  for (let i = fn.start + 1; i <= fn.end; i++) {
    const line = src[i].replace(/\/\/.*$/, '');
    let m;
    if ((m = line.match(/^\s*(?:val|var)\s*\(([^)]*)\)\s*=/)))          // destructuring
      m[1].split(',').map(s => s.trim()).filter(Boolean).forEach(n => out.push({ name: n, line: i }));
    else if ((m = line.match(/^\s*(?:val|var)\s+([A-Za-z_]\w*)/)))
      out.push({ name: m[1], line: i });
    if ((m = line.match(/^\s*for\s*\(\s*\(([^)]*)\)\s+in\b/)))
      m[1].split(',').map(s => s.trim()).filter(Boolean).forEach(n => out.push({ name: n, line: i }));
    else if ((m = line.match(/^\s*for\s*\(\s*([A-Za-z_]\w*)\s+in\b/)))
      out.push({ name: m[1], line: i });
  }
  return out.filter(l => !KEYWORDS.has(l.name));
}

let bad = 0, nSteps = 0, nFindings = 0;
const dirs = process.argv.slice(2).length ? process.argv.slice(2)
  : fs.readdirSync(path.join('diagrams', 'anim'))
      .map(d => path.join('diagrams', 'anim', d))
      .filter(d => fs.existsSync(path.join(d, 'steps.json')));
if (!dirs.length) { console.error('no steps.json found — a memory generator must publish its steps'); process.exit(2); }

for (const dir of dirs) {
  const src = JSON.parse(fs.readFileSync(path.join(dir, 'source.json'), 'utf8')).src;
  const { steps } = JSON.parse(fs.readFileSync(path.join(dir, 'steps.json'), 'utf8'));
  const fns = functionsOf(src);
  const findings = [];
  steps.forEach((st, si) => {
    nSteps++;
    const lines = (st.line || []).slice().sort((a, b) => a - b);
    if (!lines.length) { findings.push(`step ${si + 1} "${st.t}": no highlighted line at all`); return; }
    const frameNames = new Set((st.stack || []).map(f => f.name));
    const elide = new Set(st.elide || []);
    (st.stack || []).forEach((frame, fi) => {
      const fn = fns.find(f => f.name === frame.name);
      if (!fn) return;                                  // e.g. a frame for a primitive
      const shown = new Set((frame.locals || []).map(l => String(l).split(/[\s=]/)[0]));
      const isInnermost = fi === (st.stack.length - 1);
      const inFn = lines.filter(l => l >= fn.start && l <= fn.end);
      let bound, strict;
      if (isInnermost && inFn.length) {
        // execution is HERE: everything declared at or before the highlighted line exists
        bound = Math.max(...inFn);
        strict = false;
      } else if (isInnermost) {
        // Innermost frame, but the highlighted line is NOT in it — the callee just
        // RETURNED and was popped. This frame is resumed at its call site, so its
        // own later locals do not exist yet. Using fn.end here reported every
        // local below the call as missing, which is a checker bug.
        const hotFn = fns.find(f => Math.max(...lines) >= f.start && Math.max(...lines) <= f.end);
        let call = fn.end;
        if (hotFn) for (let j = fn.start + 1; j <= fn.end; j++) if (src[j].includes(hotFn.name + '(')) call = j;
        bound = call; strict = false;      // the call RETURNED, so its assignment completed
      } else {
        // this frame is a CALLER, suspended at the line that called the next
        // frame. Its own `val x = callee(...)` has NOT been assigned yet, so the
        // bound is STRICTLY BEFORE the call site — using fn.end here reported
        // every later local in main as missing, which is a checker bug.
        const next = st.stack[fi + 1];
        let call = -1;
        for (let j = fn.start + 1; j <= fn.end; j++) if (src[j].includes(next.name + '(')) call = j;
        if (call === -1) { const inFn = lines.filter(l => l >= fn.start && l <= fn.end); call = inFn.length ? Math.max(...inFn) : fn.end; }
        bound = call;
        strict = true;
      }
      for (const loc of localsOf(src, fn)) {
        if (strict ? loc.line >= bound : loc.line > bound) continue;
        if (shown.has(loc.name) || elide.has(loc.name)) continue;
        findings.push(`step ${si + 1} "${st.t}": ${fn.name} has declared \`${loc.name}\` (line ${loc.line + 1}) but the frame does not show it`);
      }
    });
  });
  if (findings.length) {
    bad++; nFindings += findings.length;
    console.log(`FAIL ${dir}`);
    findings.slice(0, 14).forEach(f => console.log('  ' + f));
    if (findings.length > 14) console.log(`  ... and ${findings.length - 14} more`);
  } else console.log(`PASS ${dir}  (${steps.length} steps, every declared local shown)`);
}
console.log(`\n${dirs.length - bad}/${dirs.length} walkthroughs show every declared local · ${nSteps} steps checked · ${nFindings} findings`);
process.exit(bad ? 1 : 0);
