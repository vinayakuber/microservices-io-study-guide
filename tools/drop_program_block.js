#!/usr/bin/env node
'use strict';
/*
 * drop_program_block.js — delete the `program:` property of a NAMED flow section,
 * and register its walkthroughs.
 *
 * WHY THIS EXISTS: deleting by scanning forward for a marker prefix destroyed the
 * WRONG section. Section 2's block began `// QUERY ENGINE SIDE` rather than
 * `// DATA SERVER SIDE`, so the scan skipped over it and deleted section 3's
 * content instead — the positional-edit failure class, again. This addresses the
 * section BY NAME, verifies it has a program block before touching anything, and
 * verifies the file still parses and still has every other section afterwards.
 *
 * usage: drop_program_block.js <content-file> <section title> [walkthrough...]
 */
const fs = require('fs');
const [file, title, ...walks] = process.argv.slice(2);
if (!file || !title) { console.error('usage: drop_program_block.js <file> <section title> [walkthrough...]'); process.exit(2); }

const load = (src) => { const C = []; global.registerChapter = (c) => C.push(c); eval(src); return C; };
const before = load(fs.readFileSync(file, 'utf8'));
const secBefore = before.flatMap(c => c.flow || []);
const target = secBefore.find(s => s.section === title);
if (!target) { console.error(`FATAL: no flow section titled ${JSON.stringify(title)} in ${file}`); process.exit(2); }
if (!target.program) { console.error(`FATAL: section ${JSON.stringify(title)} has no program block to drop`); process.exit(2); }

let s = fs.readFileSync(file, 'utf8');
// Bound the search to THIS section: from its own `section:` line to the next one.
const anchor = s.indexOf(`section: ${JSON.stringify(title).replace(/"/g, "'")}`) !== -1
  ? s.indexOf(`section: ${JSON.stringify(title).replace(/"/g, "'")}`)
  : s.indexOf(`section: \`${title}\``);
if (anchor === -1) { console.error(`FATAL: could not locate the section literal for ${JSON.stringify(title)}`); process.exit(2); }
const nextAnchor = (() => { const i = s.indexOf('section:', anchor + 8); return i === -1 ? s.length : i; })();
const pi = s.indexOf('program: `', anchor);
if (pi === -1 || pi > nextAnchor) { console.error('FATAL: the program block is not inside this section — refusing to guess'); process.exit(2); }
const lineStart = s.lastIndexOf('\n', pi) + 1;
const pj = s.indexOf('`', pi + 'program: `'.length);
let end = pj + 1;
while (end < s.length && (s[end] === ',' || s[end] === '\n')) end++;
const removed = end - lineStart;
s = s.slice(0, lineStart) + s.slice(end);

if (walks.length) {
  const a = s.slice(anchor - 200, anchor + 400).includes('walkthroughs:')
    ? null
    : s.indexOf('\n', s.indexOf('section:', Math.max(0, anchor - 300)));
  const at = s.indexOf('\n', s.indexOf(title, Math.max(0, anchor - 300))) + 1;
  s = s.slice(0, at) + `      walkthroughs: [${walks.map(w => `'${w}'`).join(', ')}],\n` + s.slice(at);
}

// Verify BEFORE writing: the file must still parse, keep every section, and lose
// exactly the one program block we meant to remove.
const after = load(s);
const secAfter = after.flatMap(c => c.flow || []);
const errs = [];
if (secAfter.length !== secBefore.length) errs.push(`section count changed: ${secBefore.length} -> ${secAfter.length}`);
for (const b of secBefore) {
  const a = secAfter.find(x => x.section === b.section);
  if (!a) { errs.push(`section vanished: ${b.section}`); continue; }
  if (b.section === title) {
    if (a.program) errs.push(`the target section still has a program block`);
  } else if (!!a.program !== !!b.program) {
    errs.push(`COLLATERAL DAMAGE: section ${JSON.stringify(b.section)} lost its program block`);
  }
  if ((a.steps || []).length !== (b.steps || []).length) errs.push(`section ${JSON.stringify(b.section)} lost steps`);
}
if (walks.length) {
  const a = secAfter.find(x => x.section === title);
  if ((a.walkthroughs || []).join() !== walks.join()) errs.push(`walkthroughs not registered: got ${JSON.stringify(a.walkthroughs)}`);
}
if (errs.length) { console.error('REFUSING TO WRITE:\n  ' + errs.join('\n  ')); process.exit(1); }

fs.writeFileSync(file, s);
console.log(`dropped ${removed} chars from ${JSON.stringify(title)}${walks.length ? `; registered ${walks.join(', ')}` : ''}`);
console.log(`  verified: ${secAfter.length} sections intact, no collateral damage`);
