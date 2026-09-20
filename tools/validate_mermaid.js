#!/usr/bin/env node
// Validate every mermaid block this repo emits, before it reaches git.
//
// Two layers:
//   1. STRUCTURAL (always on, no deps): flags a literal `"` that is NOT a label
//      delimiter (i.e. not preceded by `[`/`(`/`|` and not followed by `]`/`)`/`|`).
//      This is the exact bug where a part/text containing `"` breaks a quoted
//      label — GitHub HTML-decodes the fence before mermaid sees it, so the
//      only safe escape for a quote inside a label is mermaid's `#quot;` (no `&`).
//   2. FULL PARSE (when jsdom + js/mermaid.min.js are available): runs
//      mermaid.parse on every block TWICE — once raw, once after a single-pass
//      HTML-entity decode (simulating GitHub's textContent). Both must parse.
//      If jsdom cannot be resolved the full pass is skipped (structural only).
//
// Usage (from repo root):  node tools/validate_mermaid.js
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
var CHAPTERS = [];
function registerChapter(c) { CHAPTERS.push(c); }

function loadContent() {
  try { eval(fs.readFileSync(path.join(ROOT, 'js/chapters-registry.js'), 'utf8')); } catch (e) {}
  const dir = path.join(ROOT, 'content');
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.js')).sort()) {
      eval(fs.readFileSync(path.join(dir, f), 'utf8'));
    }
  }
  CHAPTERS.sort((a, b) => a.num - b.num);
}

function mmEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '#quot;');
}

function htmlDecode(s) {
  return String(s).replace(/&(quot|amp|lt|gt|#39|apos|nbsp);/g, (m, e) => ({
    quot: '"', amp: '&', lt: '<', gt: '>', '#39': "'", apos: "'", nbsp: ' '
  }[e]));
}

function collectBlocks() {
  const blocks = [];
  const push = (src, label) => { if (src && String(src).trim()) blocks.push({ src: String(src), label }); };

  for (const ch of CHAPTERS) {
    const sd = ch.systemDesign;
    if (sd) {
      if (sd.wiring) push(sd.wiring, `${ch.id} systemDesign.wiring`);
      for (const d of (Array.isArray(sd.decomposition) ? sd.decomposition : [])) {
        // recompute the tree exactly as tools/to_markdown.js renders it
        let t = 'flowchart TD\n  R["' + mmEsc(d.box) + '"]\n';
        (Array.isArray(d.parts) ? d.parts : []).forEach((p, i) => { t += `  R --> P${i}["${mmEsc(p)}"]\n`; });
        push(t, `${ch.id} decomposition: ${d.box}`);
      }
    }
    for (const iq of (ch.interview || [])) {
      if (iq.diagram) push(iq.diagram, `${ch.id} interview diagram`);
    }
  }

  // authored raw mermaid sources
  for (const fn of ['section-diagrams.json', 'card-diagrams.json']) {
    const p = path.join(ROOT, 'tools', fn);
    if (!fs.existsSync(p)) continue;
    let j; try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { continue; }
    for (const k of Object.keys(j)) push(j[k], `${fn}: ${k}`);
  }

  // the exact fenced text GitHub will render
  const docsDir = path.join(ROOT, 'docs');
  if (fs.existsSync(docsDir)) {
    for (const f of fs.readdirSync(docsDir).filter(x => x.endsWith('.md'))) {
      const md = fs.readFileSync(path.join(docsDir, f), 'utf8');
      const re = /```mermaid\n([\s\S]*?)```/g;
      let m, i = 0;
      while ((m = re.exec(md))) push(m[1], `${f} fence #${++i}`);
    }
  }
  return blocks;
}

function structuralIssues(src) {
  // Track only quoted labels that OPEN with [" / (" / [(" / |" and CLOSE with
  // "] / ") / "|. A bare quoted string used as an edge label ("-. "text" .->")
  // is valid and therefore ignored; a literal " inside a bracketed label is the
  // bug (GitHub HTML-decodes the fence, so only mermaid's #quot; is safe there).
  const issues = [];
  src.split('\n').forEach((line, i) => {
    let state = 'outside';
    let col = 0;
    while (col < line.length) {
      const c = line[col];
      if (state === 'outside') {
        if (c === '[' || c === '(' || c === '|') {
          let j = col + 1;
          if (c === '[' && line[j] === '(') j++; // cylinder [("...")]
          if (line[j] === '"') { state = 'inlabel'; col = j + 1; continue; }
        }
        col++;
      } else { // inside a bracketed quoted label
        if (c === '"') {
          const next = col + 1 < line.length ? line[col + 1] : '';
          if (next === ']' || next === ')' || next === '|') { state = 'outside'; col++; }
          else { issues.push(`  line ${i + 1}: internal " at col ${col + 1} — ${line.trim().slice(0, 70)}`); col++; }
        } else {
          col++;
        }
      }
    }
    if (state === 'inlabel') {
      issues.push(`  line ${i + 1}: unterminated quoted label — ${line.trim().slice(0, 70)}`);
    }
  });
  return issues;
}

async function fullParseSetup() {
  let JSDOM;
  const candidates = [
    process.env.MERMAID_JSDOM,
    '/tmp/mermaid-validate/node_modules/jsdom',
    'jsdom'
  ].filter(Boolean);
  let via = '';
  for (const c of candidates) {
    try { ({ JSDOM } = require(c)); via = c; break; } catch (e) {}
  }
  if (!JSDOM) return { available: false, reason: 'jsdom not resolvable (set MERMAID_JSDOM to its path)' };

  const mermaidJs = path.join(ROOT, 'js/mermaid.min.js');
  if (!fs.existsSync(mermaidJs)) return { available: false, reason: 'js/mermaid.min.js missing' };

  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.navigator = dom.window.navigator;
  for (const k of ['Element', 'Node', 'NodeFilter', 'DocumentFragment', 'HTMLTemplateElement', 'NamedNodeMap', 'DOMParser', 'XMLSerializer', 'HTMLElement', 'SVGElement']) {
    globalThis[k] = dom.window[k];
  }
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = () => {};
  globalThis.cancelAnimationFrame = () => {};
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};

  const vm = require('vm');
  vm.runInThisContext(fs.readFileSync(mermaidJs, 'utf8'), { filename: 'mermaid.min.js' });
  const mermaid = globalThis.mermaid;
  if (!mermaid || typeof mermaid.parse !== 'function') {
    return { available: false, reason: 'mermaid.parse unavailable after load' };
  }
  return { available: true, mermaid, via };
}

(async () => {
  loadContent();
  const blocks = collectBlocks();
  let issues = 0;

  for (const b of blocks) {
    const iss = structuralIssues(b.src);
    if (iss.length) {
      issues += iss.length;
      console.log(`STRUCT ${b.label}:\n${iss.join('\n')}`);
    }
  }

  const fp = await fullParseSetup();
  if (fp.available) {
    for (const b of blocks) {
      for (const [variant, src] of [['raw', b.src], ['html-decoded', htmlDecode(b.src)]]) {
        try {
          await fp.mermaid.parse(src);
        } catch (e) {
          issues++;
          console.log(`PARSE ${b.label} [${variant}]: ${String(e.message || e).split('\n').slice(0, 2).join(' | ')}`);
        }
      }
    }
    console.log(`full parse via ${fp.via} (${blocks.length * 2} checks)`);
  } else {
    console.log(`full parse SKIPPED (${fp.reason}) — structural checks only`);
  }

  console.log(`${blocks.length} mermaid blocks · ${issues} issues`);
  process.exit(issues ? 1 : 0);
})();
