#!/usr/bin/env node
'use strict';
/*
 * html_gate.js — every raw HTML tag in generated markdown must have well-formed
 * attributes.
 *
 * WHY THIS EXISTS
 *   A step was titled `"c1" fills 9 rows and still gets one code`. The embed
 *   writer interpolated it straight into an attribute:
 *       <img src="..." alt="Step 6: "c1" fills 9 rows..." width="1040">
 *   The second `"` CLOSES alt, so the rest is garbage, the tag never parses, and
 *   GitHub prints the raw text where the image should be. Every geometry and
 *   pixel check passed — the SVG was perfect. What was broken was the HTML
 *   pointing at it, which nothing looked at.
 *
 * WHAT IT CHECKS
 *   For every tag, tokenise the attribute region strictly. It must consume
 *   entirely as a sequence of `name`, `name="..."`, `name='...'` or `name=bare`.
 *   Anything left over means a quote or a bracket leaked in from interpolated
 *   content. Also: an <img> must have non-empty src and alt.
 *
 * The rule for authors: NEVER interpolate content into an attribute without
 * escaping it. Titles, captions and headings all legitimately contain quotes.
 */
const fs = require('fs'), path = require('path');

const ATTR = /^\s+[A-Za-z_:][-\w:.]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'`=<>]+))?/;

function checkTags(text, label, errs) {
  // only real tags: <name ...> or <name/>. Markdown prose with < is left alone.
  for (const m of text.matchAll(/<([A-Za-z][-\w]*)((?:[^<>]|"[^"]*"|'[^']*')*?)\s*\/?>/g)) {
    let rest = m[2];
    while (rest.length) {
      const a = rest.match(ATTR);
      if (!a) break;
      rest = rest.slice(a[0].length);
    }
    if (rest.trim().length) {
      const line = text.slice(0, m.index).split('\n').length;
      errs.push(`${label}:${line}: <${m[1]}> has a malformed attribute region — unconsumed: ${JSON.stringify(rest.trim().slice(0, 60))}`);
      errs.push(`${label}:${line}:   the tag as written: ${JSON.stringify(m[0].slice(0, 110))}`);
      errs.push(`${label}:${line}:   almost always an unescaped " from interpolated content; escape it as &quot;`);
    }
  }
  // an <img> that the browser parses but that carries no src/alt is still broken
  for (const m of text.matchAll(/<img\b([^>]*)>/g)) {
    const line = text.slice(0, m.index).split('\n').length;
    if (!/\bsrc\s*=\s*["'][^"']+["']/.test(m[1])) errs.push(`${label}:${line}: <img> has no usable src`);
    if (!/\balt\s*=\s*["'][^"']*["']/.test(m[1]))  errs.push(`${label}:${line}: <img> has no alt attribute`);
  }
}

// ---------------------------------------------------------------------------
// The same defect class in every OTHER context where generated text meets
// syntax. "Look for more such misinterpretations" — these are the contexts
// where an interpolated title/caption can change the meaning of the markup.
// ---------------------------------------------------------------------------
function checkMarkdown(text, label, errs) {
  const lines = text.split('\n');
  let inFence = false;
  lines.forEach((ln, i) => {
    const at = `${label}:${i + 1}`;
    if (/^\s*```/.test(ln)) { inFence = !inFence; return; }
    if (inFence) return;                                  // code blocks are literal

    // B. a raw `<` followed by a letter is parsed as a TAG by the HTML parser,
    //    so prose like "if code <seg.min" silently disappears from the page.
    for (const m of ln.matchAll(/<\/?[A-Za-z]/g)) {
      const tag = ln.slice(m.index).match(/^<\/?([A-Za-z][-\w]*)/);
      const KNOWN = new Set(['img', 'details', 'summary', 'sub', 'sup', 'b', 'i', 'br', 'a', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span', 'kbd', 'p', 'strong', 'em', 'svg']);
      if (tag && !KNOWN.has(tag[1].toLowerCase()))
        errs.push(`${at}: "<${tag[1]}" will be parsed as an HTML tag and vanish — write &lt; instead :: ${ln.trim().slice(0, 90)}`);
    }

    // C. a `|` inside a table cell that is not escaped adds a phantom column,
    //    which silently shifts every value one cell to the left.
    if (/^\s*\|/.test(ln) && !/^\s*\|\s*-{2,}/.test(ln)) {
      const cells = ln.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/);
      const inCode = (c) => (c.match(/`/g) || []).length >= 2;
      cells.forEach(c => { if (/(?<!\\)\|/.test(c) && !inCode(c)) errs.push(`${at}: unescaped | inside a table cell — escape as \\| :: ${c.trim().slice(0, 60)}`); });
    }

    // D. an odd number of backticks leaves inline code open to end of block,
    //    swallowing the rest of the sentence into a code span.
    const ticks = (ln.match(/`/g) || []).length;
    if (ticks % 2 === 1) errs.push(`${at}: odd number of backticks (${ticks}) — inline code is left open :: ${ln.trim().slice(0, 90)}`);

    // E. a `]` inside markdown image/link alt text closes it early.
    for (const m of ln.matchAll(/!\[([^\]]*)\]/g))
      if (/[\[\]]/.test(m[1])) errs.push(`${at}: bracket inside markdown image alt text closes it early :: ${m[1].slice(0, 60)}`);
  });
}

// SVG is XML: an unescaped " inside an attribute is malformed there too, and
// browsers are lenient enough that a pixel check still passes on the result.
function checkSvgAttrs(file, errs) {
  const head = fs.readFileSync(file, 'utf8').slice(0, 2000);
  const m = head.match(/<svg\b([^>]*)>/);
  if (!m) { errs.push(`${file}: no <svg> root element`); return; }
  let rest = m[1];
  while (rest.length) { const a = rest.match(ATTR); if (!a) break; rest = rest.slice(a[0].length); }
  if (rest.trim().length)
    errs.push(`${file}: <svg> root has a malformed attribute region — unconsumed: ${JSON.stringify(rest.trim().slice(0, 70))}`);
}

const files = process.argv.slice(2).length ? process.argv.slice(2)
  : fs.readdirSync(path.join('diagrams', 'anim')).map(d => path.join('diagrams', 'anim', d, 'embed.md')).filter(fs.existsSync)
      .concat(fs.readdirSync('docs').filter(f => f.endsWith('.md')).map(f => path.join('docs', f)));
if (!files.length) { console.error('no markdown found to check'); process.exit(2); }

let bad = 0, nTags = 0;
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  nTags += (text.match(/<[A-Za-z][-\w]*/g) || []).length;
  const errs = [];
  checkTags(text, f, errs);
  checkMarkdown(text, f, errs);
  if (errs.length) { bad++; console.log(`FAIL ${f}`); errs.slice(0, 12).forEach(e => console.log('  ' + e)); if (errs.length > 12) console.log(`  ... and ${errs.length - 12} more lines`); }
  else console.log(`PASS ${f}`);
}
// every generated SVG's root attributes
let svgBad = 0, nSvg = 0;
const svgErrs = [];
for (const d of fs.readdirSync(path.join('diagrams', 'anim'))) {
  const dir = path.join('diagrams', 'anim', d);
  for (const f of [path.join(dir, `${d}.svg`)].concat(
        fs.existsSync(path.join(dir, 'frames')) ? fs.readdirSync(path.join(dir, 'frames')).map(x => path.join(dir, 'frames', x)) : [])) {
    if (!f.endsWith('.svg') || !fs.existsSync(f)) continue;
    nSvg++;
    const before = svgErrs.length;
    checkSvgAttrs(f, svgErrs);
    if (svgErrs.length > before) svgBad++;
  }
}
if (svgErrs.length) { console.log(`FAIL svg roots`); svgErrs.slice(0, 8).forEach(e => console.log('  ' + e)); if (svgErrs.length > 8) console.log(`  ... and ${svgErrs.length - 8} more`); }
else console.log(`PASS svg roots  (${nSvg} files)`);

console.log(`\n${files.length - bad}/${files.length} markdown files well-formed · ${nTags} tags · ${nSvg - svgBad}/${nSvg} svg roots well-formed`);
process.exit(bad || svgBad ? 1 : 0);
