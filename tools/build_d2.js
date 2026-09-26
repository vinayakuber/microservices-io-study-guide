#!/usr/bin/env node
// Convert the repo's mermaid concept-card + systemDesign decomposition diagrams
// into D2 sources under diagrams/d2/ (rendered to PNG by the d2 CLI).
//
// Why D2: it is the repo's established diagram format — hand-authored, with
// labelled AND numbered arrows, proper branching and per-node styling. Mermaid
// is replaced with this format everywhere it remained (concept-card zoom-ins
// and the systemDesign "comprises" trees).
//
// Usage (from repo root):
//   node tools/build_d2.js            # regenerate all .d2 sources (no render)
//   node tools/build_d2.js --render   # also render every .d2 to .png via d2
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const DO_RENDER = process.argv.includes('--render');
const D2_ROOT = path.join(ROOT, 'diagrams', 'd2');

var CHAPTERS = [];
function registerChapter(c) { CHAPTERS.push(c); }

// Load chapters at MODULE scope (not inside a function): chapters-registry.js
// declares its own `var CHAPTERS` + `registerChapter`, and direct eval at module
// top level re-declares the SAME bindings (var re-declaration is a no-op), so
// the content files push into this CHAPTERS. (Eval inside a function would
// shadow them in that function's scope and leave this array empty.)
try { eval(fs.readFileSync(path.join(ROOT, 'js/chapters-registry.js'), 'utf8')); } catch (e) {}
const CONTENT_DIR = path.join(ROOT, 'content');
if (fs.existsSync(CONTENT_DIR)) {
  for (const f of fs.readdirSync(CONTENT_DIR).filter(x => x.endsWith('.js')).sort()) {
    eval(fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8'));
  }
}
CHAPTERS.sort((a, b) => a.num - b.num);

function loadCardDiagrams() {
  const p = path.join(ROOT, 'tools', 'card-diagrams.json');
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return {}; }
}

// ---- shared helpers (kept in sync with tools/to_markdown.js) ----
function ent(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&hellip;/g, '…');
}

const CLASS_STYLE = {
  step:  { fill: '#1f6feb', stroke: '#388bfd' },
  core:  { fill: '#8250df', stroke: '#8250df' },
  warn:  { fill: '#d29922', stroke: '#d29922' },
  start: { fill: '#238636', stroke: '#2ea043' },
  stop:  { fill: '#b62324', stroke: '#da3633' },
};

// Escape Markdown metacharacters so prose descriptions stay literal inside |md.
function mdEsc(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/([*_`[\]])/g, '\\$1')
    .replace(/#/g, '\\#');
}

// Split an HTML mermaid label "<b>1. Title</b><br/>description" into parts.
// Some sources have a stray/unclosed <b>; strip any residual tag so it can't
// leak into the |md label (D2's CommonMark rejects unclosed inline HTML).
function stripTags(s) { return String(s).replace(/<[^>]+>/g, ''); }
function splitHtmlLabel(raw) {
  const s = ent(raw || '').replace(/#quot;/g, '"').replace(/<br\s*\/?>/gi, '\n');
  const m = s.match(/<b>(.*?)<\/b>([\s\S]*)/i);
  if (m) return { title: stripTags(m[1]).trim(), desc: stripTags(m[2]).replace(/^\n+/, '').trim() };
  const mu = s.match(/<b>([\s\S]*)$/i); // leading <b> with no closing tag
  if (mu) return { title: stripTags(mu[1]).trim(), desc: '' };
  return { title: '', desc: stripTags(s).trim() };
}

function shapeFromPrefix(prefix) {
  if (prefix.includes('[(')) return 'cylinder';   // [("...")]
  if (prefix.includes('((')) return 'doublecircle'; // (("..."))
  if (prefix.includes('([')) return 'stadium';    // (["..."])
  if (prefix.includes('{')) return 'diamond';     // {"..."}
  if (prefix.includes('(')) return 'round';       // ("...")
  return 'rect';                                   // ["..."]
}

function d2Shape(shape) {
  if (shape === 'cylinder') return 'shape: cylinder';
  if (shape === 'diamond') return 'shape: diamond';
  if (shape === 'doublecircle') return 'shape: circle';
  return 'shape: rectangle'; // rect/stadium/round
}
function d2Radius(shape) {
  return (shape === 'stadium' || shape === 'round') ? '8' : '6';
}

// ---- mermaid parser (flowchart TD subset used by these repos) ----
function parseMermaid(src) {
  const nodes = [];               // {id, label, shape, cls, container}
  const edges = [];               // {from, to, label, type}
  const containers = new Map();   // id -> {name, parent}
  const classAssign = {};         // id -> cls (from `class A,B step`)
  let stack = [];                 // open subgraph ids

  const EDGE_RE = /([A-Za-z_][A-Za-z0-9_]*)\s*(-\.->|==>|--[ox]|-->|---)\s*(?:\|"([^"]*)"\|)?\s*([A-Za-z_][A-Za-z0-9_]*)/g;

  for (const raw of String(src).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^(flowchart|graph)\b/.test(line)) continue;
    if (/^classDef\b/.test(line)) continue;
    if (/^direction\b/.test(line)) {
      if (stack.length) {
        const c = containers.get(stack[stack.length - 1]);
        if (c) c.direction = /LR/i.test(line) ? 'right' : 'down';
      }
      continue;
    }
    const sg = line.match(/^subgraph\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\["([^"]*)"\])?/);
    if (sg) {
      containers.set(sg[1], { name: ent(sg[2] || sg[1]), parent: stack.length ? stack[stack.length - 1] : null, direction: 'down' });
      stack.push(sg[1]);
      continue;
    }
    if (/^end\s*$/.test(line)) { stack.pop(); continue; }
    const cl = line.match(/^class\s+([^:]+?)\s+(\w+)\s*$/);
    if (cl) {
      for (const id of cl[1].split(',')) classAssign[id.trim()] = cl[2];
      continue;
    }
    if (/-->|-\.->|==>|--[ox]|---/.test(line)) {
      EDGE_RE.lastIndex = 0;
      let m;
      while ((m = EDGE_RE.exec(line))) {
        edges.push({ from: m[1], to: m[4], label: m[3] || '', type: m[2] });
      }
      continue;
    }
    const nm = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(.*)$/);
    if (!nm) continue;
    const id = nm[1], rest = nm[2];
    const q = rest.indexOf('"');
    if (q < 0) continue;
    const before = rest.slice(0, q);
    const lab = rest.slice(q).match(/"([^"]*)"/); // from the OPENING quote
    if (!lab) continue;
    const clsM = rest.match(/:::\s*(\w+)\s*$/);
    nodes.push({
      id, label: lab[1], shape: shapeFromPrefix(before),
      cls: clsM ? clsM[1] : null,
      container: stack.length ? stack[stack.length - 1] : null,
    });
  }
  for (const n of nodes) if (!n.cls && classAssign[n.id]) n.cls = classAssign[n.id];
  return { nodes, edges, containers };
}

// Full D2 id for a node (container-prefixed when nested inside a subgraph).
function fullId(id, nodePath, containers) {
  return nodePath[id] || id;
}

function d2NodeBlock(n) {
  const style = CLASS_STYLE[n.cls] || CLASS_STYLE.step;
  const { title, desc } = splitHtmlLabel(n.label);
  const lines = [];
  lines.push(`${n.id}: {`);
  const labelParts = [];
  if (title) labelParts.push(`**${mdEsc(title)}**`);
  if (desc) labelParts.push(mdEsc(desc));
  lines.push('  label: |md');
  if (labelParts.length === 1) {
    lines.push(`    ${labelParts[0]}`);
  } else {
    lines.push(`    ${labelParts[0]}`);
    lines.push('');
    lines.push(`    ${labelParts[1]}`);
  }
  lines.push('  |');
  lines.push(`  ${d2Shape(n.shape)}`);
  lines.push('  style: {');
  lines.push(`    fill: "${style.fill}"`);
  lines.push(`    stroke: "${style.stroke}"`);
  lines.push('    font-color: "#FFFFFF"');
  lines.push(`    border-radius: ${d2Radius(n.shape)}`);
  lines.push('    font-size: 16');
  lines.push('  }');
  lines.push('}');
  return lines.join('\n');
}

function mermaidToD2(src) {
  const { nodes, edges, containers } = parseMermaid(src);
  // node id -> full D2 path
  const nodePath = {};
  for (const n of nodes) {
    if (n.container) {
      const c = containers.get(n.container);
      nodePath[n.id] = (c && c.parent ? c.parent + '.' : '') + n.container + '.' + n.id;
    } else {
      nodePath[n.id] = n.id;
    }
  }
  const lines = ['direction: down', ''];
  const emitted = new Set();

  // emit top-level containers with their nested nodes
  for (const [cid, c] of containers) {
    if (c.parent) continue; // depth 1 only in practice
    lines.push(`${cid}: {`);
    lines.push(`  label: ${JSON.stringify(c.name)}`);
    if (c.direction && c.direction !== 'down') lines.push(`  direction: ${c.direction}`);
    for (const n of nodes) {
      if (n.container === cid) { lines.push(indent(d2NodeBlock(n), '  ')); emitted.add(n.id); }
    }
    lines.push('}');
    lines.push('');
  }
  // top-level nodes (not inside any subgraph)
  for (const n of nodes) {
    if (n.container || emitted.has(n.id)) continue;
    lines.push(d2NodeBlock(n));
    lines.push('');
  }
  // edges
  const edgeLines = [];
  for (const e of edges) {
    const from = fullId(e.from, nodePath, containers);
    const to = fullId(e.to, nodePath, containers);
    let line = `${from} -> ${to}`;
    if (e.label) line += `: ${JSON.stringify(ent(e.label))}`;
    if (e.type === '-.->') line += ' { style: { stroke-dash: 5 } }';
    else if (e.type === '==>') line += ' { style: { stroke-width: 3 } }';
    edgeLines.push(line);
  }
  lines.push(...edgeLines);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

function indent(s, pad) { return s.split('\n').map(l => pad + l).join('\n'); }

// systemDesign pipeline -> D2 (the full flow: every stage connected, numbered
// arrows). The pipeline string is the source of truth for stage order; each
// stage's parenthetical becomes a subtitle, and each arrow is labelled with the
// source stage's description so the diagram covers the whole system, not just
// one box "comprising" its parts.
function splitPipeline(s) {
  s = String(s || '').replace(/→/g, '->');
  const out = [];
  let cur = '', depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    if (c === '-' && s[i + 1] === '>' && depth === 0) { out.push(cur.trim()); cur = ''; i++; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

function stageParts(stage) {
  const m = String(stage).match(/^(.*?)\s*\((.*)\)$/);
  if (m) return { name: m[1].trim(), sub: m[2].trim() };
  return { name: String(stage).trim(), sub: '' };
}

function pipelineToD2(sd) {
  const stages = splitPipeline(sd.pipeline);
  if (!stages.length) return null;
  const lines = ['direction: down', ''];
  const START = { fill: '#238636', stroke: '#2ea043' };
  const STEP = { fill: '#1f6feb', stroke: '#388bfd' };
  const STOP = { fill: '#8250df', stroke: '#8250df' };
  stages.forEach((stage, i) => {
    const { name, sub } = stageParts(stage);
    const style = i === 0 ? START : (i === stages.length - 1 ? STOP : STEP);
    lines.push(`S${i}: {`);
    lines.push('  label: |md');
    lines.push(`    **${mdEsc(ent(name))}**`);
    if (sub) {
      lines.push('');
      lines.push(`    ${mdEsc(ent(sub))}`);
    }
    lines.push('  |');
    lines.push('  shape: rectangle');
    lines.push('  style: {');
    lines.push(`    fill: "${style.fill}"`);
    lines.push(`    stroke: "${style.stroke}"`);
    lines.push('    font-color: "#FFFFFF"');
    lines.push('    border-radius: 6');
    lines.push('    font-size: 16');
    lines.push('  }');
    lines.push('}');
    lines.push('');
  });
  for (let i = 0; i < stages.length - 1; i++) {
    const { name, sub } = stageParts(stages[i]);
    // Use the parenthetical as the label unless it is itself a nested flow
    // (e.g. "presentation -> business logic -> data access"), where the stage
    // name reads cleaner on the arrow.
    const label = (sub && !/->|→/.test(sub)) ? sub : name;
    lines.push(`S${i} -> S${i + 1}: ${JSON.stringify(`${i + 1}. ${ent(label)}`)}`);
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

function chSlug(num) { return `ch${String(num).padStart(2, '0')}`; }

function main() {
  const cardDiagrams = loadCardDiagrams();
  const files = []; // {relDir, name, d2}

  // Regenerate only what is derived from content. decomp/ is rebuilt every run;
  // card/ is now a committed static source (card-diagrams.json is gone), so it
  // is cleared only when that JSON is present again.
  fs.rmSync(path.join(D2_ROOT, 'decomp'), { recursive: true, force: true });
  if (Object.keys(cardDiagrams).length) {
    fs.rmSync(path.join(D2_ROOT, 'card'), { recursive: true, force: true });
  }

  for (const ch of CHAPTERS) {
    const num = chSlug(ch.num);
    // concept cards
    const cards = (ch.concepts && ch.concepts.cards) || [];
    cards.forEach((c, ci) => {
      const title = ent(c.title);
      const ck = `${num}::${title}`;
      if (!cardDiagrams[ck]) return;
      files.push({ dir: 'card', name: `${num}-${ci}`, d2: mermaidToD2(cardDiagrams[ck]) });
    });
    // systemDesign: one full-pipeline diagram per chapter
    const sd = ch.systemDesign;
    if (sd) {
      const d2 = pipelineToD2(sd);
      if (d2) files.push({ dir: 'decomp', name: `${num}-0`, d2 });
    }
  }

  for (const f of files) {
    const dir = path.join(D2_ROOT, f.dir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, f.name + '.d2'), f.d2);
  }

  let renderErrors = 0;
  if (DO_RENDER) {
    // Render EVERY .d2 under diagrams/d2/ (card diagrams are committed sources,
    // decomp diagrams are regenerated above), so re-running keeps PNGs current.
    const todo = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.d2')) todo.push(p);
      }
    };
    if (fs.existsSync(D2_ROOT)) walk(D2_ROOT);
    for (const src of todo) {
      const out = src.replace(/\.d2$/, '.png');
      try {
        execFileSync('d2', [src, out, '--theme', '0', '--scale', '1', '--pad', '24'], { stdio: 'pipe' });
      } catch (e) {
        renderErrors++;
        console.error(`RENDER FAIL ${path.relative(ROOT, src)}: ${String(e.stderr || e.message).split('\n')[0]}`);
      }
    }
  }

  console.log(`Wrote ${files.length} D2 sources${DO_RENDER ? `, rendered ${files.length - renderErrors}/${files.length}` : ''} (errors: ${renderErrors})`);
}

main();
