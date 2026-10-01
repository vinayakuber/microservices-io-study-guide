'use strict';
/*
 * diagramkit.js — the DIAGRAM-band engine, factored out after four hand-written
 * diagram generators. Same purpose as memkit.js for the PROGRAM band: the shell
 * is where the typed-canvas, unescaped-attribute and collided-label defects kept
 * coming back, so it lives in one place that is already correct.
 *
 * WHAT EVERY CALLER GETS FOR FREE
 *   - canvas H DERIVED from the panel and caption geometry (R50) — never typed
 *   - every label MEASURED and registered, so a collision is a build failure (R26/R27)
 *   - alt / aria-label ESCAPED via svgkit.attr (R56)
 *   - static fallback = exactly frame 1 (R39)
 *   - embed.md with WHY / WHEN / DIAGRAM headings in contract order
 *   - geometry validated per frame before a byte is written
 *
 * A caller supplies: the panel painters (as `draw()` per step), the step titles
 * and captions, and the WHY/WHEN prose. It never touches sizes or escaping.
 */
const fs = require('fs'), path = require('path');
const { Canvas, animate, attr } = require('./svgkit.js');

const C = { ink: '#1b2430', line: '#5b6b7f', faint: '#c6d0db', dim: '#8a97a6', paper: '#ffffff',
  hot: '#e11d48', hotFill: '#ffe4e6', good: '#16a34a', goodFill: '#f0fdf4',
  cold: '#eef2f7', panel: '#f8fafc', blue: '#2563eb', blueFill: '#eff6ff',
  warn: '#ea580c', warnFill: '#fff7ed' };

/**
 * @param {object} spec
 *   W        {number}  canvas width
 *   panelH   {number}  height of the single content panel
 *   title    {string}  top-left heading
 *   subtitle {string}  one line under it (the seed, usually)
 *   seedLine {string}  top-right, the seed in short form
 *   steps    {object[]} { t, cap, draw(ctx) }  — draw returns an SVG string
 *   name, out
 */
function makeCtx(cv, P, W, H, measuring) {
  return {
    cv, C, P, W, H,
    panel(t, band, fill) {
      // During the MEASURING pass the panel's own background is skipped: it is the
      // thing being sized, so registering it would measure the probe height and
      // size the panel to 4000px. Its title still registers, since that sits above
      // the panel and must be inside the canvas.
      return (measuring ? '' : cv.rect(band, P.main.x, P.main.y, P.main.w, P.main.h, { fill: fill || C.panel, stroke: C.faint })) +
             cv.text(P.main.x + 10, P.main.y - 8, t, { size: 12, weight: 700, mono: false, fill: C.line, band: band + 'h' });
    },
    // a row of cells, optionally with an index label above each
    cells(band, x0, y, vals, o = {}) {
      const { cw = 62, ch = 26, hotSet = null, fill = C.paper, edge = C.faint, size = 12, ids = false,
              idLabel = (i) => String(i), ellipsis = false, hotFill = C.goodFill, hotEdge = C.good } = o;
      let s = '';
      vals.forEach((v, i) => {
        const on = hotSet && hotSet.has(i);
        s += cv.rect(`${band}c${i}`, x0 + i * cw, y, cw - 4, ch,
          { fill: on ? hotFill : fill, stroke: on ? hotEdge : edge, rx: 3, sw: on ? 2 : 1 });
        s += cv.text(x0 + i * cw + (cw - 4) / 2, y + ch - 8, String(v),
          { size, anchor: 'middle', weight: on ? 700 : 400, fill: on ? hotEdge : C.ink, band: `${band}v${i}` });
        if (ids) s += cv.text(x0 + i * cw + (cw - 4) / 2, y - 6, idLabel(i), { size: 10, anchor: 'middle', fill: C.dim, band: `${band}i${i}` });
      });
      if (ellipsis) s += cv.text(x0 + vals.length * cw + 4, y + ch - 8, '…', { size: 14, fill: C.dim, band: band + 'ell' });
      return s;
    },
    // key -> value rows
    mapRows(band, x0, y, pairs, o = {}) {
      const { hot = -1, w = 200, label = '', rh = 30 } = o;
      let s = label ? cv.text(x0, y - 8, label, { size: 11, weight: 700, mono: false, fill: C.line, band: band + 'l' }) : '';
      pairs.forEach(([k, v], i) => {
        const yy = y + i * rh, on = hot === i;
        s += cv.rect(`${band}r${i}`, x0, yy, w, rh - 4, { fill: on ? C.goodFill : C.paper, stroke: on ? C.good : C.faint, rx: 3, sw: on ? 2 : 1 });
        s += cv.text(x0 + 12, yy + rh - 12, `${k}`, { size: 12, weight: on ? 700 : 400, band: `${band}k${i}` });
        s += cv.text(x0 + w - 12, yy + rh - 12, `${v}`, { size: 12, anchor: 'end', weight: on ? 700 : 400, fill: on ? C.good : C.ink, band: `${band}v${i}` });
      });
      return s;
    },
    // a callout box whose height fits its (measured) lines
    note(band, x0, y, w, lines, col, fill) {
      // Each line is MEASURED and wrapped to the box, and the box is sized to the
      // wrapped result. Previously a long line ran straight out of its own note and
      // the author found out from a validator failure two steps later.
      const flat = [];
      lines.forEach((l, i) => cv.wrap(l, w - 28, 12, false).forEach(w2 => flat.push({ t: w2, head: i === 0 })));
      let s = cv.rect(band, x0, y, w, 22 + flat.length * 20, { fill, stroke: col, sw: 2 });
      flat.forEach((l, i) => { s += cv.text(x0 + 14, y + 20 + i * 20, l.t, { size: 12, mono: false, weight: 700, fill: l.head ? C.ink : col, band: `${band}t${i}` }); });
      return s;
    },
    // horizontal proportional bar, for costs
    bar(band, x0, y, label, value, max, o = {}) {
      const { col = C.hot, fill = C.hotFill, unit = '', maxPx = 760, show = true } = o;
      let s = cv.text(x0, y - 6, label, { size: 12, weight: 600, mono: false, band: band + 'l' });
      const wpx = Math.max(8, Math.round(maxPx * value / max));
      s += cv.rect(band, x0, y + 4, wpx, 26, { fill, stroke: col, sw: 2 });
      if (show) s += cv.text(x0 + wpx + 10, y + 22, `${value.toLocaleString()}${unit}`, { size: 12, weight: 700, fill: col, band: band + 'v' });
      return s;
    },
    line(x0, y, text, o = {}) { return cv.text(x0, y, text, Object.assign({ size: 12, mono: false, band: 'ln' + y + (o.band || '') }, o)); },
  };
}

function buildDiagramWalkthrough(spec) {
  // AUTO GEOMETRY (the default). `panelH` may be omitted: the kit renders every
  // step once against a generous canvas, asks how far down anything actually
  // reached, and sizes the panel to that. Typing a panel height meant every new
  // step risked a collision that was then fixed by nudging a coordinate — which is
  // how the same class of defect kept coming back. Nothing is nudged now.
  if (spec.panelH === undefined || spec.panelH === 'auto') {
    const probe = measurePanelHeight(spec);
    spec = Object.assign({}, spec, { panelH: probe });
  }
  const { W, panelH, title, subtitle, seedLine, steps: STEPS, name, out: OUTDIR } = spec;
  const CAP_LINES = spec.capLines || 4, CAP_LH = 17;
  const PAN_Y = spec.panY || 104;
  // DERIVED, never typed: the panel bottom sets the step label, which sets the
  // caption block, which sets the canvas bottom.
  const Y = { title: 34, sub: 58, step: PAN_Y + panelH + 40, cap: PAN_Y + panelH + 72 };
  const H = Y.cap + CAP_LINES * CAP_LH + 6;
  const cv = Canvas(W, H);
  const P = { main: { x: 24, y: PAN_Y, w: W - 48, h: panelH } };

  // ---- painters every diagram needs, measured and registered ---------------
  const ctx = makeCtx(cv, P, W, H);

  // HEADER PLACEMENT is measured, not assumed. A long title and a long seed line
  // on the same row collide, and every caller would have to check by hand — so
  // the kit checks: if they do not both fit, the seed drops to the subtitle row,
  // and if it still does not fit there it goes on a row of its own.
  const titleW = cv.textW(title, 15, false), seedW = cv.textW(seedLine, 11, true);
  const subW = cv.textW(subtitle, 12, false);
  const sameRow = titleW + 24 + seedW <= W - 48;
  const subRow = !sameRow && (subW + 24 + seedW <= W - 48);
  if (!sameRow && !subRow) Y.sub += 0, Y.seedOwn = Y.sub + 20;
  const header = () => {
    let h = cv.text(24, Y.title, title, { size: 15, weight: 700, mono: false, band: 'title' })
          + cv.text(24, Y.sub, subtitle, { size: 12, mono: false, fill: C.dim, band: 'sub' });
    if (sameRow)      h += cv.text(W - 24, Y.title, seedLine, { size: 11, anchor: 'end', fill: C.dim, band: 'seed' });
    else if (subRow)  h += cv.text(W - 24, Y.sub, seedLine, { size: 11, anchor: 'end', fill: C.dim, band: 'seed' });
    else              h += cv.text(24, Y.seedOwn, seedLine, { size: 11, fill: C.dim, band: 'seed' });
    return h;
  };
  const render = (s, i) =>
      header()
    + s.draw(ctx)
    + cv.text(W / 2, Y.step, `Step ${i + 1}/${STEPS.length} — ${s.t}`, { size: 15, weight: 700, mono: false, anchor: 'middle', band: 'steplbl' })
    + cv.textBlock(W / 2, Y.cap, s.cap, { maxLines: CAP_LINES, maxPx: W - 120 });

  return { ctx, W, H,
    emit() {
      if (!STEPS.length) throw new Error(`[${name}] no steps — a walkthrough with zero steps is not a walkthrough`);
      fs.mkdirSync(path.join(OUTDIR, 'frames'), { recursive: true });
      let errs = [];
      STEPS.forEach((s, i) => {
        cv.reset();
        const body = render(s, i);
        errs = errs.concat(cv.validate(`frame ${i + 1}`));
        fs.writeFileSync(path.join(OUTDIR, 'frames', `step-${String(i + 1).padStart(2, '0')}.svg`), cv.head(s.t) + body + '</svg>');
      });
      const a = animate(cv, STEPS, spec.stepSecs || 5.0, render);
      errs = errs.concat(a.errs);
      fs.writeFileSync(path.join(OUTDIR, `${name}.svg`), a.svg);
      if (errs.length) { console.error('GEOMETRY FAIL:\n' + errs.slice(0, 10).join('\n')); process.exit(1); }
      return { total: a.total, W, H, steps: STEPS.length };
    },
    // WHY / WHEN / DIAGRAM, in contract order, with every attribute escaped
    embed(o) {
      const rel = `../diagrams/anim/${name}`;
      const md = [`<!-- ${name}:begin — generated by tools/${o.gen}; do not hand-edit -->`, '',
        `#### ${o.whyHeading}`, '', ...o.why, '',
        `#### ${o.whenHeading}`, '', ...o.when, '',
        `#### ${o.diagramHeading}`, '',
        `The animation loops through all ${STEPS.length} steps. Expand any step to study it on its own.`, '',
        `<img src="${rel}/${name}.svg" alt="${attr(o.diagramHeading)}, ${STEPS.length} animated steps" width="${Math.min(W, 1040)}">`, ''];
      STEPS.forEach((s, i) => {
        md.push('<details>');
        md.push(`<summary><b>Step ${i + 1} of ${STEPS.length}</b> — ${s.t}</summary>`);
        md.push('');
        md.push(`<img src="${rel}/frames/step-${String(i + 1).padStart(2, '0')}.svg" alt="Step ${attr(i + 1)}: ${attr(s.t)}" width="${Math.min(W, 1040)}">`);
        md.push('');
        md.push(s.cap);
        md.push('');
        md.push('</details>');
      });
      md.push('', `<sub>${o.sub}</sub>`, '', `<!-- ${name}:end -->`);
      fs.writeFileSync(path.join(OUTDIR, 'embed.md'), md.join('\n') + '\n');
    } };
}
// Render every step against a deliberately oversized panel, and report how far
// down the lowest drawn thing reached. Pure measurement: nothing is written.
function measurePanelHeight(spec) {
  const PROBE_H = 4000, PAN_Y = spec.panY || 104;
  let deepest = 0;
  for (const st of (spec.steps || [])) {
    const cv = Canvas(spec.W, PROBE_H + 400);
    const ctx = makeCtx(cv, { main: { x: 24, y: PAN_Y, w: spec.W - 48, h: PROBE_H } }, spec.W, PROBE_H + 400, true);
    // NEVER swallow a painter error here. A silent catch produces an INCOMPLETE
    // measurement — the panel is then sized to whatever was drawn before the
    // throw, and the validator fails later pointing at a symptom. A skip must not
    // look like a measurement.
    try { st.draw(ctx); }
    catch (e) { throw new Error(`[${spec.name}] step "${st.t}" threw while measuring: ${e.message}`); }
    deepest = Math.max(deepest, cv.contentBottom());
  }
  // +18 bottom padding inside the panel; never smaller than a readable minimum
  return Math.max(160, Math.ceil(deepest - PAN_Y + 18));
}

module.exports = { buildDiagramWalkthrough, C };
