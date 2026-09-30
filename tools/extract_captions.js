#!/usr/bin/env node
'use strict';
/* extract_captions.js — one LOGICAL caption per line, for the teaching gate.
 * Captions are wrapped into several <text> lines for layout; feeding those
 * fragments to the gate splits sentences from their evidence and produces false
 * "unverifiable claim" hits. The reader reads the whole caption, so that is the
 * unit the gate must see. */
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
const strip = (s) => s.replace(/<[^>]*>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const out = [];
for (const f of fs.readdirSync(dir).filter(x => /^step-\d+\.svg$/.test(x)).sort()) {
  const svg = fs.readFileSync(path.join(dir, f), 'utf8');
  const parts = [...svg.matchAll(/<text[^>]*text-anchor="middle"[^>]*fill="#5b6b7f"[^>]*>([\s\S]*?)<\/text>|<text[^>]*fill="#5b6b7f"[^>]*text-anchor="middle"[^>]*>([\s\S]*?)<\/text>/g)].map(m => strip(m[1] !== undefined ? m[1] : m[2]));
  if (parts.length) out.push(parts.join(' ').replace(/\s+/g, ' ').trim());
}
process.stdout.write(out.join('\n') + '\n');
