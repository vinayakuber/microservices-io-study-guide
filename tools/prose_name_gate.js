#!/usr/bin/env node
'use strict';
/*
 * prose_name_gate.js — every code-shaped NAME a walkthrough's prose uses must be
 * one the reader can look up in a listing.
 *
 * WHY THIS EXISTS: symbol_gate checks CODE. A caption, an intro line or a WHY band
 * is prose, so a name can be introduced there and exist nowhere lookupable. A
 * reader reported `lastIdx` as undefined while it was in fact present; this gate is
 * the automated form of that question, asked of every name in every caption.
 *
 * ITS OWN FIRST BUG, kept here as the warning: the first version iterated only
 * directories that had a `source.json`, so it checked 5 of 11 walkthroughs and
 * printed "5 walkthrough(s) checked · 0 findings" — passing a planted
 * `phantomCursor`. A gate that silently narrows its own input is worse than no
 * gate. It now enumerates every embed.md, prints checked-vs-total, and FAILS if
 * those differ.
 */
const fs = require('fs'), path = require('path');
const COMMON = new Set(('the and for not but its row rows one two all any out set step steps read reads value values code codes column columns block blocks run runs index segment table query data disk file files bucket buckets store sum total order group filter limit slot slots frame frames stack heap name names map size count bits bytes what when why how this that they them then than with from into only same each both every which while after before once still here there does done must will can cannot never always where their just like also more less most many much such make makes made take takes gives give hand hands holds hold note see say says left right first last next new old real full part whole entire side line lines panel panels label labels picture page book chapter reader engine system systems user users answer answers cost costs work works case cases point points way ways time times number numbers thing things kind sort sorted unsorted encoded stored written built build builds frozen immutable per via min max'
  ).split(/\s+/));

const ANIM = path.join('diagrams', 'anim');
const dirs = fs.readdirSync(ANIM).map(d => path.join(ANIM, d)).filter(d => fs.existsSync(path.join(d, 'embed.md')));
if (!dirs.length) { console.error('no embed.md found under diagrams/anim'); process.exit(2); }

// The lookupable vocabulary is the UNION of every listing in the book: a diagram's
// caption may legitimately name something the program band declares.
const declared = new Set();
let listings = 0;
for (const d of fs.readdirSync(ANIM)) {
  const f = path.join(ANIM, d, 'source.json');
  if (!fs.existsSync(f)) continue;
  listings++;
  for (const l of JSON.parse(fs.readFileSync(f, 'utf8')).src)
    for (const m of l.matchAll(/\b([A-Za-z_]\w*)\b/g)) declared.add(m[1]);
}

// DATA labels are lookupable too. `c6` is a campaign value from the book's single
// seed, shown in the rendered dictionary — it is not a code symbol, and demanding
// it appear in a program listing would be the gate misreading data as an
// identifier. The seed is the authority for what data the book contains, so its
// vocabulary joins the lookupable set.
try {
  const seed = require(path.resolve('tools', 'rle_seed.js'));
  for (const k of Object.keys(seed.DICTIONARY || {})) declared.add(k);
  for (const v of Object.values(seed.DICTIONARY || {})) declared.add(String(v));
} catch (e) { console.log('note: no tools/rle_seed.js — data labels are not in the lookupable set here'); }

let total = 0, checked = 0;
for (const dir of dirs) {
  checked++;
  const text = fs.readFileSync(path.join(dir, 'embed.md'), 'utf8');
  const used = new Set();
  for (const m of text.matchAll(/`([A-Za-z_]\w*)`/g)) used.add(m[1]);          // backticked
  for (const m of text.matchAll(/\b([a-z]+[A-Z]\w*)\b/g)) used.add(m[1]);      // camelCase
  const missing = [...used].filter(n => !declared.has(n) && !COMMON.has(n.toLowerCase()));
  if (missing.length) {
    total += missing.length;
    console.log(`FAIL ${dir}`);
    missing.forEach(n => console.log(`  \`${n}\` appears in the prose but in NO listing — the reader has nowhere to look it up`));
  } else console.log(`PASS ${dir}`);
}

console.log(`\n${checked}/${dirs.length} walkthroughs checked against ${listings} listing(s) · ${total} unlookupable name(s)`);
if (checked !== dirs.length) { console.log('A gate that narrowed its own input is a failure, not a pass.'); process.exit(1); }
process.exit(total ? 1 : 0);
