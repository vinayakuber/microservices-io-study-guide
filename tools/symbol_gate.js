#!/usr/bin/env node
'use strict';
/*
 * symbol_gate.js — every identifier a program listing USES must be DEFINED in
 * that listing, before first use. Fails the build otherwise.
 *
 * WHY: the explain-program skill's oldest non-negotiable is "no undefined symbol
 * — ever", and the listing still shipped with nRows, nRuns, lastIdx and Index
 * used but never declared. Reading for it does not work; the teaching gate only
 * inspected SUBSCRIPTED names in trace prose, so bare identifiers and calls were
 * invisible to it. This checks the listing itself, deterministically.
 *
 * Definition forms recognised:
 *   type Name { a, b }            defines Name, a, b
 *   fun name(p, q) {              defines name, p, q
 *   val x = / var x =             defines x
 *   val (a, b) = / var (a, b) =   defines a, b
 *   for (x in ...)                defines x
 *   for ((a, b) in ...)           defines a, b
 *   // primitive: name — ...      declares an assumed primitive EXPLICITLY,
 *                                 so nothing is ever silently assumed
 */
const fs = require('fs'), path = require('path');

const KEYWORDS = new Set(['type', 'fun', 'val', 'var', 'while', 'for', 'in', 'until',
  'return', 'if', 'else', 'and', 'or', 'not', 'true', 'false', 'null', 'primitive']);
const METHODS = new Set(['append', 'length', 'value']);   // fields/methods declared by `type`

function check(file) {
  const src = JSON.parse(fs.readFileSync(file, 'utf8')).src;
  const defined = new Map();      // name -> line it was defined on
  const errs = [];

  // pass 1 — collect definitions with the line they appear on
  src.forEach((raw, i) => {
    // A primitive declaration may name SEVERAL things at once:
    //   // primitive: rowStore / colStore / buf / segment — the four inputs
    // Capturing only the first name declared one of four and reported the rest as
    // undefined — a checker limitation, not a content defect. Names are taken up to
    // the em-dash that begins the description.
    const primitive = raw.match(/^\s*\/\/\s*primitive:\s*([^—\n]+)/);
    if (primitive) {
      for (const m of primitive[1].matchAll(/([A-Za-z_]\w*)/g))
        if (!defined.has(m[1])) defined.set(m[1], i);
      return;
    }
    const line = raw.replace(/\/\/.*$/, '');
    let m;
    if ((m = line.match(/^\s*type\s+([A-Za-z_]\w*)/))) if (!defined.has(m[1])) defined.set(m[1], i);
    if ((m = line.match(/^\s*type\s+\w+\s*\{([^}]*)\}/)))
      m[1].split(',').map(t => t.trim()).filter(Boolean).forEach(f => { if (!defined.has(f)) defined.set(f, i); });
    if ((m = line.match(/^\s*fun\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/))) {
      if (!defined.has(m[1])) defined.set(m[1], i);
      m[2].split(',').map(t => t.trim()).filter(Boolean).forEach(pn => { if (!defined.has(pn)) defined.set(pn, i); });
    }
    for (const mm of line.matchAll(/\b(?:val|var)\s*\(([^)]*)\)\s*=/g))
      mm[1].split(',').map(t => t.trim()).filter(Boolean).forEach(v => { if (!defined.has(v)) defined.set(v, i); });
    for (const mm of line.matchAll(/\b(?:val|var)\s+([A-Za-z_]\w*)\s*=/g))
      if (!defined.has(mm[1])) defined.set(mm[1], i);
    for (const mm of line.matchAll(/\bfor\s*\(\s*\(([^)]*)\)\s*in\b/g))
      mm[1].split(',').map(t => t.trim()).filter(Boolean).forEach(v => { if (!defined.has(v)) defined.set(v, i); });
    for (const mm of line.matchAll(/\bfor\s*\(\s*([A-Za-z_]\w*)\s+in\b/g))
      if (!defined.has(mm[1])) defined.set(mm[1], i);
  });

  // pass 2 — every used identifier must be defined, at or before its use
  src.forEach((raw, i) => {
    if (/^\s*\/\//.test(raw)) return;
    // Strip comments AND string literals. A quoted literal is DATA, not an
    // identifier: `countEqual(codes, dict, "c1")` was reported as using an
    // undefined symbol c1. The two earlier listings happened to contain no
    // string literals, which is the only reason this never fired before.
    const line = raw.replace(/\/\/.*$/, '').replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
    for (const mm of line.matchAll(/\b([A-Za-z_]\w*)\b/g)) {
      const name = mm[1];
      if (KEYWORDS.has(name) || METHODS.has(name)) continue;
      if (/^\d/.test(name)) continue;
      if (!defined.has(name)) { errs.push(`line ${i + 1}: "${name}" is used but never defined anywhere in the listing  ::  ${raw.trim()}`); continue; }
      if (defined.get(name) > i) errs.push(`line ${i + 1}: "${name}" is used before its definition on line ${defined.get(name) + 1}  ::  ${raw.trim()}`);
    }
  });
  return { errs, nDefined: defined.size, nLines: src.length };
}

const files = process.argv.slice(2).length ? process.argv.slice(2)
  : fs.readdirSync(path.join('diagrams', 'anim'))
      .map(d => path.join('diagrams', 'anim', d, 'source.json')).filter(fs.existsSync);
if (!files.length) { console.error('no source.json found — a generator must publish its listing'); process.exit(2); }
let bad = 0;
for (const f of files) {
  const { errs, nDefined, nLines } = check(f);
  // A listing from which ZERO symbols were extracted has not been checked — it has
  // been skipped. Prose blocks are entirely `//` comments, so this gate walked 39
  // of them and reported "39/39 listings have every symbol defined" while
  // extracting nothing at all. That is R53 (an empty input must FAIL, never pass)
  // reappearing in a different guise: not an empty FILE, but an empty EXTRACTION.
  if (nLines > 4 && nDefined === 0) {
    console.log(`FAIL ${f}`);
    console.log(`  NOTHING EXTRACTED: ${nLines} lines, 0 symbols. This gate checks CODE; a block that is`);
    console.log(`  entirely comment prose cannot be symbol-checked at all, so passing it is a lie.`);
    console.log(`  Such a block must be replaced by a generated listing, not patched.`);
    bad++; continue;
  }
  const seen = new Set(); const uniq = errs.filter(e => { const k = e.split('::')[0]; if (seen.has(k)) return false; seen.add(k); return true; });
  if (uniq.length) { bad++; console.log(`FAIL ${f}`); uniq.slice(0, 12).forEach(e => console.log('  ' + e)); }
  else console.log(`PASS ${f}  (${nLines} lines, ${nDefined} symbols, 0 undefined)`);
}
console.log(`\n${files.length - bad}/${files.length} listings have every symbol defined`);
process.exit(bad ? 1 : 0);
