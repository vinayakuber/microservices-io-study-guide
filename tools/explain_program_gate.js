#!/usr/bin/env node
// Strict explain-program gate — enforces CONCRETE VALUES in every annotated
// program block. A block that only restates the concept in prose, with no
// worked input/output/value, fails.
//
// Rules (per flow section that has a `program`):
//   R1  every `// ->` (input) and `// <-` (output) line must carry a concrete
//       value — a digit, a quoted literal, or an `= value`.
//   R2  every DEF block must contain at least one concrete-value line
//       (digit or quoted literal). A DEF block is the text from one `// DEF:`
//       to the next `// DEF:` (or end of program).
//   R3  the program overall must have >= 4 concrete-value lines.
//   R15 every PARTIES symbol must be DEFINED as a system component, not a bare
//       black box. A value that names only a box ("instance", "node", "unit",
//       "server process", "component") with no role noun, engine, @instance, or
//       parenthetical is a tautology — it names the container, not the concept
//       (the "what is Zipkin / where does RabbitMQ sit" gap).
//   R16 (chapter-level) every chapter with a program must carry a systemDesign
//       section that names the pipeline roles (writer→transport→collector→
//       aggregator→reader, or the chapter's declared equivalent), decomposes
//       each major component into its internals, and draws the wiring as a
//       mermaid diagram + an annotated program. Naming a component is not
//       defining it; defining it is not wiring it.
//   R17 (chapter-level) every chapter with a systemDesign section must OPEN it
//       with the interview question being solved — the problem, the use case,
//       and the premise. A pipeline without a question is a solution looking
//       for a problem.
//   R18 (diagram-level, enforced by tools/validate_mermaid.js) every mermaid
//       arrow must carry a label naming the relationship — shape + connection
//       + MEANING. A bare `A --> B` shows the boxes and the line but never says
//       why they connect; the label is the "1000 words" the diagram conveys.
//   R14 (chapter-level) every chapter with a program must cover BOTH a write
//       path (data created/stored) AND a read path (data queried/served back).
//       A write-only chapter hides how its store is consumed; a read-only
//       chapter hides how its store was populated.
//
// Run (from repo root):  node tools/explain_program_gate.js
global.CHAPTERS = [];
global.registerChapter = function (c) { CHAPTERS.push(c); };
const fs = require('fs');
for (const f of fs.readdirSync('content').filter(x => x.endsWith('.js')).sort()) {
  eval(fs.readFileSync('content/' + f, 'utf8'));
}
CHAPTERS.sort((a, b) => a.num - b.num);

const VALUE = /\d|"[^"]+"|'[^']+'/;
// R14 signal sets — a WRITE verb creates/stores data; a READ verb queries or
// serves it back to a consumer. Chapter-level, so a chapter may satisfy the
// two halves in different blocks.
const WRITE = /(stores?|stored|writes?|written|persists?|lands?|opens?\b|insert|publishes?|reports?|appends?|records?\b|saves?|creates?|created|mints?|injects?|ships?|produces?)/i;
const READ = /(quer(y|ies|ied)|search(es|ing)?|reads?\b|looks?\s*up|lookup|fetch(es|ing)?|select|reassembles?|reconstructs?|retrieves?|displays?|serves?|served|\bgets?\b|\breturns?\b|consumer|consumes?)/i;
// R15 signal sets — a role noun (writer/broker/collector/aggregator/...) or a
// human/org noun is a definition; a bare box word is a tautology. Engine names
// are the datastore engines only (R13's DB_ENGINES) — middleware/system names
// like zipkin/kafka/rabbitmq are NOT engines and must still name a role.
const ROLE_NUN = /(service|broker|queue|bus\b|registry|collector|transport|gateway|router|proxy|relay|tailer|sidecar|breaker|index|store|storage|database|warehouse|aggregator|reader|consumer|operator|writer|producer|publisher|reporter|monolith|pipeline|function|engine|orchestrator|coordinator|client|application|\bapi\b|mesh|scheduler|executor|leader|follower|master|slave|replica|balancer|registrar|cluster|log|monitor)/i;
const HUMAN = /(architect|developer|team|user|customer|analyst|engineer|business)/i;
const failures = [];
let programs = 0;

for (const ch of CHAPTERS) {
  const sections = (ch.flow || []).slice();
  if (ch.systemDesign && ch.systemDesign.program) sections.push({ section: 'System Design Interview', program: ch.systemDesign.program });
  for (const s of sections) {
    const p = s.program;
    if (!p || !String(p).trim()) continue;
    programs++;
    const L = p.split('\n');
    const probs = [];

    // R1: bare ->/<- lines
    L.forEach((l, i) => {
      if (/^\/\/ (->|<-)/.test(l) && !VALUE.test(l)) probs.push(`R1 bare ${l.trim().slice(0, 60)}`);
    });

    // R2: standalone DEF blocks without a concrete value (inline `// DEF: field`
    // signatures on a code line are exempt — they are declarations, not mechanisms)
    const defIdx = [];
    L.forEach((l, i) => { if (/\/\/ DEF:/.test(l)) defIdx.push(i); });
    for (let b = 0; b < defIdx.length; b++) {
      const start = defIdx[b];
      if (!/^\/\/ DEF:/.test(L[start])) continue;
      const end = (b + 1 < defIdx.length ? defIdx[b + 1] : L.length);
      const seg = L.slice(start, end);
      if (seg.some(l => VALUE.test(l))) continue;
      probs.push(`R2 no value in block: ${L[start].trim().slice(0, 70)}`);
    }

    // R3: overall value floor
    const valLines = L.filter(l => VALUE.test(l)).length;
    if (valLines < 4) probs.push(`R3 only ${valLines} concrete-value lines`);

    // R4: an execution trace — >= 3 value-transformation lines (a line with a
    // ` -> ` arrow carrying a concrete value), excluding the ->/<- IO markers.
    const isIO = l => /^\/\/\s*(->|<-)/.test(l);
    const transforms = L.filter(l => !isIO(l) && / -> /.test(l) && /(\d|["'=])/.test(l)).length;
    if (transforms < 3) probs.push(`R4 only ${transforms} value transformations (need a >= 3-step trace)`);

    // R5: logical derivation — when a program mentions byte-size/count units,
    // it must show at least one explicit arithmetic step (e.g. "256 MB / 4 KB
    // = 65,536") so the sizes form ONE connected chain instead of appearing
    // from nowhere (the 4 KB -> 256 MB jump defect).
    const hasSize = /\d\s*(KB|MB|GB|TB|kB|kb|mb|gb|bytes?|bits?)\b/i.test(p);
    const derivs = L.filter(l => /\/\/.*\d.*[×x*/]\s*\d/.test(l)).length;
    if (hasSize && derivs < 1) probs.push(`R5 size units present but no derivation line (sizes must chain to a seed)`);

    // R6: causal link — a size/count that CHANGES must state WHY it changes
    // (the mechanism, not just the math). E.g. "898 MB BECAUSE the merge is
    // the union of 4 files' keys". The reader must see the cause of a change.
    const causal = /(BECAUSE|because|the ratio|is the union|merges? into|causes?|since it)/.test(p);
    if (hasSize && !causal) probs.push(`R6 sizes change but no cause stated (state WHY: merge? ratio? union?)`);

    // R7: state declaration — the program must initialize its data structures/
    // rows with concrete values (`sparse_index : {"handbag" -> 0}`,
    // `kv : {}`, `wallet_balances: [A | 0.00]`) BEFORE mutating them. An id or
    // row referenced by the program must be declared as state first.
    const stateDecl = L.filter(l => /[a-zA-Z_][\w]*(\[[^\]]+\])?(\.[a-z_]+)?\s*:\s*[\[{"']/.test(l)).length;
    if (stateDecl < 1) probs.push(`R7 no state declaration (declare the data structures/rows before the program)`);

    // R8: no dangling token handle — a tok_* value received but never stored or
    // passed on (the exact "token returned but unused" defect). Citations and
    // one-time request ids are not handles and are exempt.
    const handles = p.match(/\btok_\w+/g) || [];
    const hcount = {};
    for (const h of handles) hcount[h] = (hcount[h] || 0) + 1;
    const dangling = Object.keys(hcount).filter(h => hcount[h] === 1);
    if (dangling.length) probs.push(`R8 dangling token(s): ${dangling.join(', ')} (received but never consumed)`);

    // R9: demonstrate, don't assert — a guard/idempotency/dedup claim must be
    // paired with the actual operation that performs it (INSERT ON CONFLICT /
    // duplicate-key / DO NOTHING), not just named.
    const claims = /idempoten|dedup/i.test(p);
    const ops = /INSERT|ON CONFLICT|DO NOTHING|duplicate|existing|saved|already|compare-and-set|seen|skip|contains/i.test(p);
    if (claims && !ops) probs.push(`R9 idempotency/guard claimed but not demonstrated (show the dedup/guard operation with values)`);
    // R10: distinct party ids — a single-letter id (A, B) must not be a prefix
    // of a longer id (B vs B1 = ambiguous buyer/seller).
    const sset = new Set(); let sm;
    const sre = /\[([A-Z])\]|\|\s*([A-Z])\s*\|/g;
    while ((sm = sre.exec(p))) sset.add(sm[1] || sm[2]);
    const mset = new Set(p.match(/\b[A-Z][A-Za-z0-9]*\d[A-Za-z0-9_-]*\b/g) || []);
    const amb = [...sset].filter(s => [...mset].some(x => x.startsWith(s)));
    if (amb.length) probs.push(`R10 ambiguous id(s): ${amb.join(', ')} (distinct parties need distinct ids)`);
    // R11: declared-entity closure — an account referenced in a double-entry row
    // (`| account | signed-delta |`) must have its initial balance declared.
    const acctRe = /\|\s*([a-z][a-z0-9_]*)\s*\|\s*[-+]\d/g;
    const accounts = new Set(); let am;
    while ((am = acctRe.exec(p))) accounts.add(am[1]);
    const declaredAccts = new Set();
    for (const l of L) { const dm = l.match(/^\s*\/\/\s*([a-z][a-z0-9_]*)\s*:\s*[-+]?\d/); if (dm) declaredAccts.add(dm[1]); }
    const unacct = [...accounts].filter(a => !declaredAccts.has(a));
    if (unacct.length) probs.push(`R11 undeclared account(s): ${unacct.join(', ')} (declare its initial balance)`);

    // R12: container != concept — declaring a data structure is not defining the
    // concept it holds. `trace_registry : {}` and `spans : []` do not define
    // `trace` or `span`; every non-generic stem and singular of each STATE-declared
    // structure must itself be defined (a `// DEF:` / `->` / STATE / PARTIES name).
    const GENERIC12 = new Set('registry store table list map set log index cache id ids value values name names key keys count total depth bound size entries entry record records line lines flag flags field fields pool state box boxes status address process class bus plus success analysis basis axis alias'.split(' '));
    const declared12 = new Set();
    const containers12 = new Set();
    L.forEach((l) => {
      let m;
      if ((m = l.match(/\/\/\s*DEF:\s*([A-Za-z_][A-Za-z0-9_]*)/))) declared12.add(m[1]);
      if ((m = l.match(/\/\/\s*->\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/))) declared12.add(m[1]);
      if ((m = l.match(/^\s*\/\/\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*[\[{"']/))) { declared12.add(m[1]); containers12.add(m[1]); }
      const pl = l.match(/^\/\/\s*PARTIES:\s*(.*)$/);
      if (pl) (pl[1].match(/[A-Z][A-Za-z0-9_]*/g) || []).forEach(x => declared12.add(x));
    });
    // R12 compares concepts case-insensitively (a `gw` container IS the `GW`
    // party) and recognizes the true singular of a plural stem — `responses` ->
    // `response`, `processes` -> `process`, `chassis` -> `chassis` — not the
    // mangled `respon`/`proces`/`chassi` a naive suffix strip produces.
    const generic12lc = new Set([...GENERIC12].map(x => x.toLowerCase()));
    const declared12lc = new Set([...declared12].map(x => x.toLowerCase()));
    const pluralForms = (p) => {
      const c = new Set([p]);
      for (const v of [p.replace(/ies$/, 'y'), p.replace(/ches$/, 'ch'), p.replace(/shes$/, 'sh'),
        p.replace(/xes$/, 'x'), p.replace(/zes$/, 'z'), p.replace(/sses$/, 'ss'),
        p.replace(/ses$/, 's'), p.replace(/es$/, ''), p.replace(/s$/, '')]) {
        if (v && v.length >= 2 && v !== p) { c.add(v); c.add(v + 'e'); }
      }
      return [...c];
    };
    const un12 = new Set();
    for (const c of containers12) {
      for (const p of c.toLowerCase().split('_').filter(Boolean)) {
        if (p.length < 2 || generic12lc.has(p)) continue;
        const forms = pluralForms(p);
        if (forms.some(f => generic12lc.has(f) || declared12lc.has(f))) continue;
        // report the most natural singular: `ies` -> `y` (entities -> entity),
        // else drop a bare trailing `s` (responses -> response)
        const stem = (p.length > 4 && p.endsWith('ies')) ? p.slice(0, -3) + 'y'
          : (p.length > 2 && p.endsWith('s')) ? p.slice(0, -1) : p;
        if (stem.length >= 2) un12.add(stem);
      }
    }
    if (un12.size) probs.push(`R12 undefined concept(s): ${[...un12].sort().join(', ')} (define each at first use with a concrete value)`);

    // R13: concrete datastore placement — a database/store symbol declared in a
    // PARTIES line must name its concrete engine AND instance, never a bare
    // "its database" / "database server" / "relational database". Naming the
    // symbol is not defining it; the reader must know WHICH database and WHERE
    // it lives (PostgreSQL 16 @ orders-db-1), including that the business table
    // and the outbox table share the ONE instance that makes a COMMIT atomic.
    const DB_ENGINES = /\b(postgres(ql)?|mysql|mariadb|oracle|sql ?server|sqlite|cassandra|scylladb|dynamodb|mongodb|couchbase|couchdb|redis|hbase|cockroachdb|bigtable|spanner|elasticsearch|rocksdb|leveldb|eventstoredb|s3)\b/i;
    const DS_NAMES = /^(DB|SQLDB|NOSQL|VDB|RDB|WDB|AUDITDB|ORDDB|CSDB|ES|EVS|STORE|LEG|DB1|DB2|S3)$/i;
    L.filter(l => /^\/\/\s*PARTIES:/.test(l)).forEach(pl => {
      const body = pl.replace(/^\/\/\s*PARTIES:\s*/, '');
      for (const b of body.split('·').map(s => s.trim())) {
        const m = b.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (!m) continue;
        const name = m[1], value = m[2];
        const isDatastore = DS_NAMES.test(name) || /\b(database|datastore|store|table)\b/i.test(value);
        if (!isDatastore) continue;
        const hasEngine = DB_ENGINES.test(value);
        const hasInstance = /@\s*[\w][\w.-]*|\binstance\b|\b[a-z][a-z0-9-]*-db\b|\bdb-\d+\b/i.test(value);
        if (!hasEngine || !hasInstance) {
          probs.push(`R13 datastore '${name}' not concrete ("${value}") — name the engine AND instance (e.g. PostgreSQL 16 @ orders-db-1)`);
        }
      }
    });

    // R15: no bare black-box component — a PARTIES symbol defined as only a box
    // ("instance", "node", "server process", "component") with no role noun, no
    // engine, no @instance, no parenthetical, is a tautology. It names the
    // container, not the concept; the reader must know WHAT the component is and
    // WHERE it sits in the writer -> transport -> aggregator -> reader pipeline.
    const tautology = (v) => {
      if (HUMAN.test(v) || DB_ENGINES.test(v) || /@\s*\w/.test(v)) return false;
      if (ROLE_NUN.test(v)) return false;
      if (/\([^)]/.test(v)) return false;
      const s = v.replace(/\b(a|an|the)\b/gi, '').trim();
      return /^[\w .-]* (server|process|component)$/i.test(s) || /^(instance|instances|node|nodes|unit|box|thing)s?$/i.test(s);
    };
    L.filter(l => /^\/\/\s*PARTIES:/.test(l)).forEach(pl => {
      const body = pl.replace(/^\/\/\s*PARTIES:\s*/, '');
      for (const b of body.split('·').map(s => s.trim())) {
        const m = b.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (m && tautology(m[2])) probs.push(`R15 black-box component '${m[1]}' ("${m[2]}") — name its role/engine/instance, not just a box`);
      }
    });

    if (probs.length) failures.push({ id: ch.id, section: s.section, probs });
  }

  // R14: read + write path coverage — a chapter must show data being written
  // (created/stored) AND read back (queried/served). Enforces "both paths in
  // every chapter": a write-only chapter hides how its store is consumed; a
  // read-only chapter hides how its store was populated.
  const rwBlocks = sections.filter(s => s.program && String(s.program).trim());
  if (rwBlocks.length) {
    let hasWrite = false, hasRead = false;
    for (const b of rwBlocks) {
      const p = String(b.program);
      if (WRITE.test(p)) hasWrite = true;
      if (READ.test(p)) hasRead = true;
    }
    const r14 = [];
    if (!hasWrite) r14.push('R14 no write path (no block creates/stores: mint/open/insert/publish/store)');
    if (!hasRead) r14.push('R14 no read path (no block queries/serves back: query/search/read/return)');
    if (r14.length) failures.push({ id: ch.id, section: '(whole chapter)', probs: r14 });
  }

  // R16: system-design decomposition (chapter-level) — a chapter with a program
  // must carry a systemDesign section that names the pipeline roles, decomposes
  // each major component into its internals, draws the wiring as a mermaid
  // diagram, and annotates the wiring with the explain-program markers. Naming
  // a component is not defining it; defining it is not wiring it.
  if ((ch.flow || []).some(s => s.program && String(s.program).trim())) {
    const sd = ch.systemDesign;
    const r16 = [];
    if (!sd) {
      r16.push('R16 missing systemDesign section (decompose components + draw the wiring)');
    } else {
      if (!sd.pipeline) r16.push('R16 systemDesign.pipeline missing (name the writer→transport→collector→aggregator→reader roles)');
      const dec = Array.isArray(sd.decomposition) ? sd.decomposition : [];
      if (!dec.length || !dec.some(d => Array.isArray(d.parts) && d.parts.length >= 2)) r16.push('R16 no component decomposition into internals (>=2 parts)');
      const w = String(sd.wiring || '');
      if (!/(flowchart|graph)\b/i.test(w) || !/-->|---/.test(w)) r16.push('R16 no wiring mermaid diagram (a connected flowchart)');
      if (!sd.program || !String(sd.program).trim()) r16.push('R16 systemDesign.program missing (annotate the wiring)');
    }
    if (r16.length) failures.push({ id: ch.id, section: '(system design)', probs: r16 });
  }

  // R17: the System Design Interview section must OPEN with the question being
  // solved (the problem, the use case, and the premise). A pipeline that jumps
  // straight to the boxes never says what we are trying to solve.
  if (ch.systemDesign) {
    const q = String(ch.systemDesign.question || '').trim();
    if (q.length < 40) failures.push({ id: ch.id, section: '(system design)', probs: ['R17 systemDesign.question missing or too short (state the problem, use case, and premise being solved)'] });
  }
}

for (const f of failures) {
  console.log(`${f.id} | ${f.section}`);
  for (const pr of f.probs) console.log(`    ${pr}`);
}
console.log(`\n${programs} programs checked · ${failures.length} programs with issues`);
process.exit(failures.length ? 1 : 0);
