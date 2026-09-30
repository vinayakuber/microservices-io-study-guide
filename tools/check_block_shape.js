#!/usr/bin/env node
'use strict';
/*
 * check_block_shape.js — a walkthrough block must have the same four parts, in
 * the same order, and none of them empty.
 *
 * WHY: the ch02 block shipped with "#### Visual walkthrough" as the FIRST
 * heading and nothing under it — the explanation sat below it. Anyone following
 * that anchor landed on an empty section. Heading order is part of the contract,
 * not a matter of taste, and an empty section is a defect no prose gate sees.
 *
 * THE CONTRACT
 *   1. WHY      — the origin: the data, the real request, walked on that data
 *   2. WHEN     — the lifecycle (when it is built) and the scope (what it misses)
 *   3. DIAGRAM  — the visual walkthrough, animation + one still per step
 *   4. PROGRAM  — the same thing as running code, stack and heap per step
 * Part 4 may live in its own file; parts 1-3 must be present and in order.
 */
const fs = require('fs'), path = require('path');
const PARTS = [
  { key: 'WHY',     re: /^####\s.*\b(why|what this|why this)\b/i },
  { key: 'WHEN',    re: /^####\s.*\b(when|lifecycle|built|does not help)\b/i },
  { key: 'DIAGRAM', re: /^####\s.*\b(visual walkthrough|walkthrough)\b/i },
  { key: 'PROGRAM', re: /^####\s.*\b(running program|stack and heap)\b/i },
];
let bad = 0, n = 0;
for (const f of process.argv.slice(2)) {
  n++;
  const text = fs.readFileSync(f, 'utf8');
  const heads = [...text.matchAll(/^####\s.*$/gm)].map(m => ({ t: m[0], i: m.index }));
  const found = {};
  for (const p of PARTS) { const h = heads.find(h => p.re.test(h.t)); if (h) found[p.key] = h; }
  const errs = [];
  // every present section must have a body
  for (const h of heads) {
    const next = heads.find(x => x.i > h.i);
    const body = text.slice(h.i + h.t.length, next ? next.i : text.length).trim();
    if (body.length < 40) errs.push(`empty section: "${h.t.trim()}" has no body — an anchor pointing here shows nothing`);
  }
  // order
  const present = PARTS.filter(p => found[p.key]);
  for (let i = 1; i < present.length; i++)
    if (found[present[i].key].i < found[present[i - 1].key].i)
      errs.push(`out of order: ${present[i].key} appears before ${present[i - 1].key} — the contract is WHY, WHEN, DIAGRAM, PROGRAM`);
  // required parts for a diagram file
  if (found.DIAGRAM) for (const k of ['WHY', 'WHEN'])
    if (!found[k]) errs.push(`missing ${k}: a walkthrough must be preceded by ${k === 'WHY' ? 'the origin (data + the real request)' : 'the lifecycle and scope'}`);
  if (errs.length) { bad++; console.log(`FAIL ${f}`); errs.forEach(e => console.log('  ' + e)); }
  else console.log(`PASS ${f}  (${present.map(p => p.key).join(' -> ')})`);
}
console.log(`\n${n - bad}/${n} blocks match the shape contract`);
process.exit(bad ? 1 : 0);
