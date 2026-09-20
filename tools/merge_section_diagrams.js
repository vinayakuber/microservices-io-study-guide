#!/usr/bin/env node
// Merge authored diagram fragments (tools/_diagram_fragments/*.json) into
// tools/section-diagrams.json, keyed `chNN::Section Title` -> mermaid source.
// Run AFTER every fragment batch is written:  node tools/merge_section_diagrams.js
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '_diagram_fragments');
const OUT = path.join(__dirname, 'section-diagrams.json');

let merged = {};
try { merged = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { merged = {}; }

let total = 0;
if (fs.existsSync(DIR)) {
  for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.json')).sort()) {
    const frag = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    for (const [k, v] of Object.entries(frag)) {
      if (!/^ch\d\d::/.test(k)) { console.error(`BAD KEY in ${f}: ${k}`); process.exit(1); }
      if (!String(v).trim().startsWith('flowchart')) { console.error(`BAD VALUE in ${f}: ${k} (must start with "flowchart")`); process.exit(1); }
      if (merged[k] !== undefined) console.warn(`OVERWRITE ${k} (also in ${f})`);
      merged[k] = v;
      total++;
    }
  }
}

fs.writeFileSync(OUT, JSON.stringify(merged, null, 2) + '\n');
console.log(`section-diagrams.json: ${Object.keys(merged).length} diagrams (${total} merged this run)`);
