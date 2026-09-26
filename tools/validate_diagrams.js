#!/usr/bin/env node
// Validate the diagram pipeline the docs depend on:
//   1. No mermaid fences remain anywhere under docs/ (diagrams are D2 PNGs now).
//   2. Every D2 source under diagrams/d2/ has a rendered PNG, and vice versa,
//      so the `![](...png)` references in docs never 404.
//
// D2 syntax itself is enforced by tools/build_d2.js at render time (a `.d2`
// that fails to parse fails to render, and is reported there).
//
// Usage (from repo root):  node tools/validate_diagrams.js
const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

let issues = 0;
const err = (msg) => { issues++; console.error(msg); };

// 1. no mermaid fences left in docs
const docsDir = path.join(ROOT, 'docs');
if (fs.existsSync(docsDir)) {
  for (const f of fs.readdirSync(docsDir).filter(x => x.endsWith('.md'))) {
    const md = fs.readFileSync(path.join(docsDir, f), 'utf8');
    const count = (md.match(/```mermaid/g) || []).length;
    if (count) err(`MERMAID ${f}: ${count} mermaid fence(s) remain — replace with a D2 PNG`);
  }
}

// 2. every .d2 has a .png and every .png has a .d2
const d2root = path.join(ROOT, 'diagrams', 'd2');
if (fs.existsSync(d2root)) {
  const walk = (dir, fn) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, fn);
      else fn(p);
    }
  };
  walk(d2root, (p) => {
    if (p.endsWith('.d2') && !fs.existsSync(p.replace(/\.d2$/, '.png'))) {
      err(`MISSING PNG: ${path.relative(ROOT, p)}`);
    } else if (p.endsWith('.png') && !fs.existsSync(p.replace(/\.png$/, '.d2'))) {
      err(`ORPHAN PNG: ${path.relative(ROOT, p)}`);
    }
  });
} else {
  err('diagrams/d2/ does not exist — run `node tools/build_d2.js --render`');
}

console.log(`${issues} diagram issues`);
process.exit(issues ? 1 : 0);
