#!/usr/bin/env node
'use strict';
/*
 * check_band_honesty.js — a band may not name an artifact it does not have.
 *
 * WHY THIS EXISTS
 *   The same block was reported "converted to WHY -> WHEN -> DIAGRAM -> PROGRAM"
 *   twenty times and was still wrong every time. Root cause: check_block_shape.js
 *   is invoked on diagrams/anim/<w>/embed.md — files the GENERATORS write. It
 *   never read content/*.js, which is where flow-section program blocks actually
 *   live and where docs/ is generated from. So the loop was:
 *       generate a new section beside the block -> gate reads the new section
 *       -> PASS -> report "ALL GATES PASS" -> the block is untouched.
 *   A gate aimed at your own output cannot fail. This one is aimed at the source.
 *
 * WHAT IT ENFORCES
 *   A program block whose text contains a `DIAGRAM —` banner claims there is a
 *   diagram. A `PROGRAM —` banner claims there is a runnable program with its
 *   memory shown. Prose under either banner is a label lying about its content:
 *   the reader is told "DIAGRAM" and shown a paragraph. So:
 *     - `DIAGRAM —` banner  => the section must declare a rendered walkthrough
 *                              (diagrams/anim/<name>/, name NOT ending -memory)
 *     - `PROGRAM —` banner  => the section must declare a memory walkthrough
 *                              (name ending -memory: stack + heap per step)
 *   A section that has BOTH a rendered walkthrough AND a `program:` block repeating
 *   the same band as prose is a DUPLICATE — the reader gets two versions of one
 *   concept. The block is the copy and must be deleted.
 *   A band with no artifact yet must be listed in BANDS_PENDING.txt. That keeps
 *   the debt COUNTED and VISIBLE instead of silently passing. A stale entry — one
 *   whose artifact now exists — also fails, so the ledger can only shrink.
 */
const fs = require('fs'), path = require('path');
var CHAPTERS = []; function registerChapter(c) { CHAPTERS.push(c); }
eval(fs.readFileSync('js/chapters-registry.js', 'utf8'));
for (const f of fs.readdirSync('content').filter(x => x.endsWith('.js')).sort())
  eval(fs.readFileSync(path.join('content', f), 'utf8'));

const LEDGER = 'BANDS_PENDING.txt';
const pending = new Set(
  (fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, 'utf8') : '')
    .split('\n').map(l => l.replace(/#.*$/, '').trim()).filter(Boolean)
);
const seen = new Set();
const rendered = (name) => fs.existsSync(path.join('diagrams', 'anim', name, 'frames'));

// Enumerate EVERY node carrying a `program` string, wherever it lives. The gate
// used to walk `ch.flow` only, and 11 chapter-level `systemDesign` blocks — one
// per chapter — were therefore invisible to it: 22 bands that named artifacts
// they did not have and were never counted. That is the third time a gate's SCOPE
// was narrower than the content it was supposed to cover (R47), so this walks the
// chapter object generically instead of naming the containers it knows about.
function bandNodes(ch) {
  // A CONCEPT is a thing that owes the reader a DIAGRAM and a PROGRAM. Enumerate
  // concepts, NOT program blocks:
  //   (a) every flow section, always — a section with no program block still owes
  //       both bands, and keying on `program` made COMPLETED concepts vanish from
  //       the count the moment their duplicate prose was deleted (olap read 0/78
  //       when 10 bands were in fact satisfied);
  //   (b) every chapter-level object carrying a `program` or `walkthroughs` — this
  //       is how the 11 `systemDesign` blocks, invisible to the earlier `ch.flow`-only
  //       walk, come into scope and stay in scope after their prose is dropped.
  const out = (ch.flow || []).map((s, i) => ({ node: s, label: s.section || `flow[${i}]` }));
  for (const k of Object.keys(ch)) {
    if (k === 'flow') continue;
    const v = ch[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && (typeof v.program === 'string' || v.walkthroughs))
      out.push({ node: v, label: k });
  }
  return out;
}

let lies = 0, stale = 0, debts = 0, dupes = 0, bands = 0;
const seenKeys = new Set();
for (const ch of CHAPTERS) {
  for (const { node: sec, label } of bandNodes(ch)) {
    const ws = (sec.walkthroughs || []).filter(rendered);
    const has = {
      DIAGRAM: ws.some(w => !/-memory$/.test(w)),
      PROGRAM: ws.some(w => /-memory$/.test(w)),
    };
    for (const band of ['DIAGRAM', 'PROGRAM']) {
      bands++;
      const key = `ch${String(ch.num).padStart(2, '0')}|${label}|${band}`;
      seenKeys.add(key);
      const claimsInBlock = sec.program && new RegExp(`^//\\s*${band}\\s+—`, 'm').test(sec.program);
      if (has[band] && claimsInBlock) {
        console.log(`DUPLICATE ${key}`);
        console.log(`  the rendered walkthrough(s) ${ws.join(', ')} already cover this band, AND the`);
        console.log(`  block still carries its own "${band} —" prose. Delete the block: it is the copy.`);
        dupes++;
        continue;
      }
      if (has[band]) {
        if (pending.has(key)) { console.log(`STALE  ${key}  — artifact exists; remove this line from ${LEDGER}`); stale++; }
        else console.log(`PASS   ${key}  -> ${ws.join(', ')}`);
      } else if (pending.has(key)) {
        debts++;
      } else {
        console.log(`LIE    ${key}  — no rendered ${band.toLowerCase()} for this concept, and not in ${LEDGER}`);
        lies++;
      }
    }
  }
}
for (const k of pending) if (!seenKeys.has(k)) { console.log(`STALE  ${k}  — no such section in content/; remove it from ${LEDGER}`); stale++; }

const real = bands - debts - lies - dupes;
console.log(`\n${real}/${bands} bands have a rendered artifact · ${debts} tracked as pending in ${LEDGER}`);
if (lies || stale || dupes) console.log(`${lies} untracked · ${stale} stale · ${dupes} DUPLICATE (prose block repeating a rendered section)`);
process.exit(lies || stale || dupes ? 1 : 0);
