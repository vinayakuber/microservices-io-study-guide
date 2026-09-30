#!/usr/bin/env node
'use strict';
/* extract_program_block.js — print one program block, bounded by its TEMPLATE.
 *
 * Every caller used to slice from a start marker to a line of the block's own
 * CONTENT ("derivation : runs"). A rewrite dropped that line and the slice went
 * empty — verify_all failed loudly, but the pre-commit hook PASSED, because an
 * empty file gives a prose gate nothing to complain about. A silent skip is
 * worse than a failure, so this exits non-zero when the block is too small. */
const fs = require('fs');
const [file, marker, minLen] = [process.argv[2], process.argv[3], +(process.argv[4] || 800)];
const c = fs.readFileSync(file, 'utf8');
const i = c.indexOf(marker);
if (i === -1) { console.error(`FATAL: marker not found in ${file}: ${marker}`); process.exit(2); }
const end = c.indexOf('`', i);
const text = c.slice(i, end === -1 ? undefined : end);
if (text.length < minLen) {
  console.error(`FATAL: extracted only ${text.length} chars (min ${minLen}) from ${file} — ` +
                'an empty extraction makes every prose gate pass vacuously.');
  process.exit(2);
}
process.stdout.write(text);
