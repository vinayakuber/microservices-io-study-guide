'use strict';
/*
 * svgkit.js — the geometry contract, factored out so every generated diagram
 * obeys the same rules (see explain-program SKILL.md R26/R27).
 *
 *   - ONE fixed canvas; nothing may be placed outside it.
 *   - Every coordinate is an INTEGER; a non-integer throws where it is computed.
 *   - Text is MEASURED and registered like a rect, because SVG has no layout
 *     engine and an unmeasured string silently runs off the canvas.
 *   - validate() checks ACROSS bands: rect/rect never overlap; a label fully
 *     INSIDE a box is fine but one crossing its edge is a defect; text/text
 *     never collide; nothing leaves the canvas.
 */
const RATIO = { mono: 0.602, sans: 0.58 };   // UPPER-bound em advance per char
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// esc() is for element TEXT. An ATTRIBUTE value must also escape the quote
// characters, or an interpolated title containing `"c1"` closes the attribute
// early and the whole tag stops parsing — in SVG and in HTML alike.
const attr = (s) => esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function Canvas(W, H) {
  const boxes = [], overflow = [];
  const textW = (s, size, mono) => Math.ceil(String(s).length * size * (mono ? RATIO.mono : RATIO.sans));

  const rect = (band, x, y, w, h, o = {}) => {
    if (![x, y, w, h].every(Number.isInteger)) throw new Error(`non-integer geometry in ${band}: ${[x, y, w, h]}`);
    boxes.push({ band, x, y, w, h });
    const { fill = '#fff', stroke = '#5b6b7f', sw = 1, rx = 4, dash = null } = o;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  };

  const text = (x, y, s, o = {}) => {
    // An EMPTY label is always a mistake: it renders nothing, and the rendered
    // <text> node reports a 0x0 bbox that the pixel checker reads as breaking the
    // canvas margin. Fail where it is written rather than 200 lines downstream.
    if (String(s).trim() === '')
      throw new Error(`empty text at (${x},${y}) band=${o.band || '?'} — omit the call instead of drawing a blank label`);
    // SVG collapses runs of whitespace by default, which silently flattens the
    // indentation of a code listing. `preserve` keeps it.
    const { size = 12, fill = '#1b2430', anchor = 'start', weight = 400, mono = true, band = 'text', preserve = false } = o;
    const ff = mono ? 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace' : 'system-ui,-apple-system,Segoe UI,sans-serif';
    const w = textW(s, size, mono);
    const x0 = anchor === 'middle' ? Math.round(x - w / 2) : anchor === 'end' ? Math.round(x - w) : Math.round(x);
    boxes.push({ band: 'txt:' + band, x: x0, y: Math.round(y - size * 0.82), w, h: Math.round(size * 1.18), kind: 'text', s: String(s) });
    return `<text x="${x}" y="${y}" font-family="${ff}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${preserve ? ' xml:space="preserve"' : ''}>${esc(s)}</text>`;
  };

  const wrap = (str, maxPx, size, mono) => {
    const out = []; let cur = '';
    for (const word of String(str).split(' ')) {
      const cand = cur ? cur + ' ' + word : word;
      if (textW(cand, size, mono) <= maxPx || !cur) cur = cand; else { out.push(cur); cur = word; }
    }
    if (cur) out.push(cur);
    return out;
  };

  const textBlock = (cx, yTop, str, o = {}) => {
    const { size = 12, lh = 17, maxLines = 4, maxPx = W - 80, mono = false, fill = '#5b6b7f', band = 'cap' } = o;
    const lines = wrap(str, maxPx, size, mono);
    if (lines.length > maxLines) overflow.push(`caption needs ${lines.length} lines (max ${maxLines}): "${String(str).slice(0, 60)}..."`);
    return lines.slice(0, maxLines).map((ln, i) =>
      text(cx, yTop + i * lh, ln, { size, fill, mono, anchor: 'middle', band: band + i })).join('');
  };

  function validate(label) {
    const errs = [];
    const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const inside = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
    for (const b of boxes)
      if (b.x < 0 || b.y < 0 || b.x + b.w > W || b.y + b.h > H)
        errs.push(`${label}: ${b.kind === 'text' ? 'text' : 'box'} ${b.band} [${b.x},${b.y},${b.w},${b.h}] escapes the ${W}x${H} canvas${b.s ? ` :: "${b.s.slice(0, 40)}"` : ''}`);
    const rects = boxes.filter(b => b.kind !== 'text'), texts = boxes.filter(b => b.kind === 'text');
    // A panel CONTAINING a child box is intentional nesting; two boxes that
    // merely straddle each other is the defect. Same rule as labels-in-boxes.
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (hit(a, b) && !inside(a, b) && !inside(b, a))
        errs.push(`${label}: rect/rect straddle ${a.band}[${a.x},${a.y},${a.w},${a.h}] vs ${b.band}[${b.x},${b.y},${b.w},${b.h}]`);
    }
    for (const t of texts) for (const r of rects)
      if (hit(t, r) && !inside(t, r)) errs.push(`${label}: text crosses the edge of ${r.band} — "${(t.s || '').slice(0, 40)}"`);
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++)
      if (hit(texts[i], texts[j])) errs.push(`${label}: text/text overlap "${(texts[i].s || '').slice(0, 28)}" vs "${(texts[j].s || '').slice(0, 28)}"`);
    for (const m of overflow) errs.push(`${label}: ${m}`);
    return errs;
  }

  // The lowest point anything registered reaches. Lets a caller SIZE a panel to
  // what was actually drawn in it, instead of typing a height and discovering it
  // was wrong when the validator fails.
  const contentBottom = () => boxes.reduce((m, b) => Math.max(m, b.y + b.h), 0);

  return { W, H, rect, text, textBlock, wrap, textW, validate, contentBottom,
           reset() { boxes.length = 0; overflow.length = 0; },
           head: (label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${attr(label)}"><rect width="${W}" height="${H}" fill="#ffffff"/>` };
}

// Build a SMIL step animation: each step's group appears for its slice, loops forever.
function animate(cv, steps, stepSecs, render) {
  const TOTAL = +(steps.length * stepSecs).toFixed(2);
  let out = cv.head('animated walkthrough'), errs = [];
  steps.forEach((s, i) => {
    cv.reset();
    const body = render(s, i);
    errs = errs.concat(cv.validate(`anim ${i}`));
    const t0 = +(i * stepSecs / TOTAL).toFixed(6), t1 = +((i + 1) * stepSecs / TOTAL).toFixed(6);
    const last = i === steps.length - 1;
    // STATIC FALLBACK: the FIRST step carries no opacity attribute, so it is
    // visible by default. Any renderer that drops <animate> (a sanitiser, a
    // thumbnailer, a static viewer) then shows exactly frame 1 instead of a
    // blank canvas — and, critically, instead of compositing every step on top
    // of one another, which is what makes text appear to cross its panel.
    const kt = i === 0 ? `0;${t1};${t1};1`
             : last    ? `0;${t0};${t0};1`
             :           `0;${t0};${t0};${t1};${t1};1`;
    const vals = i === 0 ? `1;1;0;0` : last ? `0;0;1;1` : `0;0;1;1;0;0`;
    const base = i === 0 ? '' : ' opacity="0"';
    out += `<g${base}><animate attributeName="opacity" dur="${TOTAL}s" repeatCount="indefinite" calcMode="discrete" values="${vals}" keyTimes="${kt}"/>${body}</g>`;
  });
  return { svg: out + '</svg>', errs, total: TOTAL };
}

module.exports = { Canvas, animate, esc, attr };
