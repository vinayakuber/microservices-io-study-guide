#!/usr/bin/env node
'use strict';
/* check_embeds.js — every walkthrough a chapter declares must actually appear in
 * its generated doc, with one <img> per frame plus the animation. Regenerating
 * docs once silently dropped 28 images and the failure was invisible; this makes
 * that state fail the build. */
const fs = require('fs'), path = require('path');
var CHAPTERS = []; function registerChapter(c) { CHAPTERS.push(c); }
eval(fs.readFileSync('js/chapters-registry.js', 'utf8'));
for (const f of fs.readdirSync('content').filter(x => x.endsWith('.js')).sort())
  eval(fs.readFileSync(path.join('content', f), 'utf8'));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
let bad = 0, n = 0;
for (const ch of CHAPTERS) {
  // Walkthroughs are declared PER FLOW SECTION now (a chapter-level list could
  // not say which section a walkthrough belonged under, which is how ch02's RLE
  // walkthrough ended up inside the segment section).
  const declared = (ch.flow || []).flatMap(sec => sec.walkthroughs || []);
  if (!declared.length) continue;
  const doc = path.join('docs', `ch${String(ch.num).padStart(2, '0')}-${slug(ch.title)}.md`);
  if (!fs.existsSync(doc)) { console.log(`FAIL ch${ch.num}: ${doc} missing`); bad++; continue; }
  const text = fs.readFileSync(doc, 'utf8');
  for (const dir of declared) {
    n++;
    const frames = fs.readdirSync(path.join('diagrams', 'anim', dir, 'frames')).filter(f => f.endsWith('.svg'));
    const want = frames.length + 1;                       // frames + the animation
    const got = (text.match(new RegExp(`<img[^>]*${dir}/`, 'g')) || []).length;
    if (got < want) { console.log(`FAIL ${dir}: doc shows ${got} images, expected ${want} (${frames.length} frames + 1 animation)`); bad++; }
    else console.log(`PASS ${dir}: ${got} images present (${frames.length} frames + 1 animation)`);
  }
}
console.log(`\n${n - bad}/${n} walkthroughs embedded`);
process.exit(bad ? 1 : 0);
