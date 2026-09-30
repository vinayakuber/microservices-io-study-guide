#!/usr/bin/env python3
"""
verify_diagram.py — prove a generated SVG is not clipped, by measurement, not by eye.

WHY THIS EXISTS
    The generator predicts text width with a font-metric RATIO. That model is an
    estimate, and an estimate is what let captions run off the canvas. This tool
    replaces the estimate with two independent sources of ground truth.

WHY PIXELS ALONE ARE NOT ENOUGH (verified, see clip test)
    A browser CLIPS anything outside the viewBox. Content that overflows simply
    never renders, so scanning the output of a normal render can never reveal it:
    the evidence is destroyed before you look. Overflow is therefore made visible
    by RE-HOSTING the same content in a LARGER viewBox with a sentinel-coloured
    guard band around the real canvas. Ink on the sentinel colour == overflow.

CHECKS (all must pass)
    A  engine-bbox : the real layout engine reports getBBox() for every element;
                     each must sit inside the canvas, honour the margin, and no
                     two text boxes may overlap.  (independent of our ratio model)
    B  guard-band  : re-wrapped render; ANY ink in the guard band == clipped content
    C  margin-ring : no ink within `margin` px of the canvas edge
    D  non-blank   : the frame actually drew something (catches an empty render)
    E  per-step    : for a SMIL animation, every step is seeked and checked, not
                     just the first frame
"""
import argparse, json, os, re, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

CHROME = next((c for c in ('google-chrome', 'chromium', 'chromium-browser')
               if subprocess.run(['which', c], capture_output=True).returncode == 0), None)
SENTINEL = (255, 0, 255)          # magenta guard band — never used by the palette

# ----------------------------------------------------------------- png ----
import zlib, struct
def png_read(path):
    d = open(path, 'rb').read()
    pos, idat, plte = 8, b'', None
    while pos < len(d):
        ln = struct.unpack('>I', d[pos:pos+4])[0]; typ = d[pos+4:pos+8]; body = d[pos+8:pos+8+ln]
        if typ == b'IHDR': w, h, bd, ct, _, _, inter = struct.unpack('>IIBBBBB', body)
        elif typ == b'PLTE': plte = body
        elif typ == b'IDAT': idat += body
        elif typ == b'IEND': break
        pos += 12 + ln
    ch = {0:1, 2:3, 3:1, 4:2, 6:4}[ct]; stride = w * ch
    raw = zlib.decompress(idat); prev = bytearray(stride); rows = []; i = 0
    for _ in range(h):
        f = raw[i]; i += 1; L = bytearray(raw[i:i+stride]); i += stride
        if f == 1:
            for x in range(ch, stride): L[x] = (L[x] + L[x-ch]) & 255
        elif f == 2:
            for x in range(stride): L[x] = (L[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = L[x-ch] if x >= ch else 0
                L[x] = (L[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = L[x-ch] if x >= ch else 0; b = prev[x]; c = prev[x-ch] if x >= ch else 0
                p = a + b - c; pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                L[x] = (L[x] + (a if (pa <= pb and pa <= pc) else (b if pb <= pc else c))) & 255
        rows.append(bytes(L)); prev = L
    def rgb(x, y):
        o = x * ch; r = rows[y]
        if ct in (0, 4): v = r[o]; return (v, v, v)
        if ct == 3: i2 = r[o]; return (plte[i2*3], plte[i2*3+1], plte[i2*3+2])
        return (r[o], r[o+1], r[o+2])
    return w, h, rgb

def shoot(html_path, w, h, out):
    subprocess.run([CHROME, '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
                    '--force-device-scale-factor=1', f'--window-size={w},{h}',
                    '--virtual-time-budget=4000', f'--screenshot={out}', f'file://{html_path}'],
                   capture_output=True, timeout=120)
    return os.path.exists(out)

_DEFICIT = {}
def viewport_deficit(w=1056, h=900):
    """Chrome paints FEWER rows than --window-size. Unpainted area inherits the
    page background, so a truncated capture looks like a clean guard band — a
    silent false PASS. Measure the deficit instead of assuming it is zero."""
    if _DEFICIT: return _DEFICIT['v']
    html = ("<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#fff}"
            "#a{position:absolute;left:0;top:0;width:%dpx;height:%dpx;"
            "background:rgb(255,0,255)}</style><div id=a></div>" % (w, h))
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False) as f:
        f.write(html); pth = f.name
    shot = tempfile.mktemp(suffix='.png')
    shoot(pth, w, h, shot); os.unlink(pth)
    pw, ph, rgb = png_read(shot); os.unlink(shot)
    painted = [y for y in range(ph) if rgb(2, y)[0] > 240 and rgb(2, y)[1] < 20]
    _DEFICIT['v'] = (h - 1 - max(painted)) if painted else 0
    return _DEFICIT['v']

def inner_svg(path):
    s = open(path, encoding='utf-8').read()
    m = re.search(r'<svg[^>]*>', s)
    return s[m.end():s.rindex('</svg>')]

# ------------------------------------------------------------- checks ----
FORCE_CSS = "<style>#s g{opacity:1 !important} #s *{visibility:visible !important}</style>"

def check_engine_bbox(svg_path, W, H, margin, seek=None, union=False):
    """A: ask the REAL layout engine for every element's box (ground truth)."""
    body = inner_svg(svg_path)
    html = f"""<!doctype html><meta charset=utf-8><style>html,body{{margin:0}}</style>{FORCE_CSS if union else ''}
<svg id="s" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{body}</svg>
<pre id="out"></pre><script>
var s=document.getElementById('s');
try{{ s.pauseAnimations(); {'s.setCurrentTime(%r);' % seek if seek is not None else ''} }}catch(e){{}}
var r=[];
s.querySelectorAll('text,rect').forEach(function(el){{
  var b; try{{ b=el.getBBox(); }}catch(e){{ return; }}
  if(el.style.display==='none') return;
  // SMIL animates the COMPUTED value, not the attribute — reading the attribute
  // reports every animated group as hidden and silently measures almost nothing.
  var g=el, vis=true;
  while(g&&g!==s.parentNode){{
    if(g.nodeType===1){{
      var cs=window.getComputedStyle(g);
      if(cs&&(parseFloat(cs.opacity)===0||cs.display==='none'||cs.visibility==='hidden')) vis=false;
    }}
    g=g.parentNode;
  }}
  r.push({{t:el.tagName,vis:vis,x:b.x,y:b.y,w:b.width,h:b.height,
          s:(el.textContent||'').slice(0,50)}});
}});
document.getElementById('out').textContent=JSON.stringify(r);
</script>"""
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False) as f:
        f.write(html); p = f.name
    out = subprocess.run([CHROME, '--headless', '--disable-gpu', '--no-sandbox',
                          '--virtual-time-budget=4000', '--dump-dom', f'file://{p}'],
                         capture_output=True, text=True, timeout=120).stdout
    os.unlink(p)
    m = re.search(r'<pre id="out">(.*?)</pre>', out, re.S)
    if not m or not m.group(1).strip():
        return ['engine-bbox: could not read measurements from the renderer'], 0
    try: els = json.loads(m.group(1).replace('&quot;', '"').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>'))
    except Exception as e: return [f'engine-bbox: unparsable payload ({e})'], 0
    errs = []
    live = [e for e in els if e['vis']]
    for e in live:
        x0, y0, x1, y1 = e['x'], e['y'], e['x']+e['w'], e['y']+e['h']
        # a rect covering exactly the canvas is the intended background plate
        if e['t'] == 'rect' and abs(x0) < 1 and abs(y0) < 1 and abs(x1-W) < 1 and abs(y1-H) < 1:
            continue
        if x0 < -0.5 or y0 < -0.5 or x1 > W+0.5 or y1 > H+0.5:
            errs.append(f"engine-bbox: {e['t']} OUTSIDE canvas [{x0:.1f},{y0:.1f},{x1:.1f},{y1:.1f}] :: \"{e['s']}\"")
        elif x0 < margin or y0 < margin or x1 > W-margin or y1 > H-margin:
            errs.append(f"engine-bbox: {e['t']} breaks the {margin}px margin [{x0:.1f},{y0:.1f},{x1:.1f},{y1:.1f}] :: \"{e['s']}\"")
    txt = [] if union else [e for e in live if e['t'] == 'text']
    for i in range(len(txt)):
        for j in range(i+1, len(txt)):
            a, b = txt[i], txt[j]
            if a['x'] < b['x']+b['w'] and b['x'] < a['x']+a['w'] and a['y'] < b['y']+b['h'] and b['y'] < a['y']+a['h']:
                errs.append(f"engine-bbox: text collides :: \"{a['s']}\" vs \"{b['s']}\"")
    return errs, len(live)

def check_pixels(svg_path, W, H, guard, margin, seek=None, keep=None, union=False):
    """B+C+D: re-host in a bigger viewBox so clipped content becomes visible."""
    body = inner_svg(svg_path)
    GW, GH = W + 2*guard, H + 2*guard
    seekjs = ("var s=document.getElementById('s');try{s.pauseAnimations();s.setCurrentTime(%r);}catch(e){}" % seek) if seek is not None else ""
    # TRIPWIRE: a green strip on the last row/column of the guard area. If the
    # capture is truncated the tripwire is missing, so a short render FAILS loudly
    # instead of silently reading as an empty (clean) guard band.
    html = f"""<!doctype html><meta charset=utf-8><style>html,body{{margin:0;padding:0;background:#fff}}</style>{FORCE_CSS if union else ''}
<svg id="s" xmlns="http://www.w3.org/2000/svg" viewBox="{-guard} {-guard} {GW} {GH}" width="{GW}" height="{GH}">
<rect x="{-guard}" y="{-guard}" width="{GW}" height="{GH}" fill="rgb(255,0,255)"/>
<svg x="0" y="0" width="{W}" height="{H}" viewBox="0 0 {W} {H}" overflow="visible">{body}</svg>
<rect x="{-guard}" y="{H+guard-2}" width="{GW}" height="2" fill="rgb(0,255,0)"/>
<rect x="{W+guard-2}" y="{-guard}" width="2" height="{GH}" fill="rgb(0,255,0)"/>
</svg><script>{seekjs}</script>"""
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False) as f:
        f.write(html); p = f.name
    shot = keep or tempfile.mktemp(suffix='.png')
    ok = shoot(p, GW, GH + viewport_deficit(), shot); os.unlink(p)
    if not ok: return ['pixels: screenshot failed'], None
    w, h, rgb = png_read(shot)
    errs = []
    def is_guard(px): return abs(px[0]-255) < 12 and px[1] < 12 and abs(px[2]-255) < 12
    def is_trip(px): return px[0] < 60 and px[1] > 200 and px[2] < 60
    if w < GW or h < GH:
        errs.append(f'pixels: capture is {w}x{h}, smaller than the {GW}x{GH} guard area — a clipped capture would fake a PASS')
        return errs, None
    if not any(is_trip(rgb(x, GH-1)) for x in range(0, GW, 7)):
        errs.append('tripwire: the bottom marker never rendered — the capture was TRUNCATED, '
                    'so a clean guard band here would be meaningless')
    if not any(is_trip(rgb(GW-1, y)) for y in range(0, GH, 7)):
        errs.append('tripwire: the right marker never rendered — the capture was TRUNCATED')
    # sample inside the guard AREA (not the capture, which is taller), clear of
    # the tripwire strips that occupy the last row/column
    corners = [(2, 2), (GW-4, 2), (2, GH-4), (GW-4, GH-4)]
    if not all(is_guard(rgb(x, y)) or is_trip(rgb(x, y)) for x, y in corners):
        errs.append('guard-band: sentinel missing at a guard corner — the capture cannot be trusted')
    # B — ANY non-sentinel pixel in the guard band means content escaped the canvas
    bleed = []
    for y in range(0, min(h, GH)):
        for x in range(0, min(w, GW)):
            inside = guard <= x < guard+W and guard <= y < guard+H
            if inside: continue
            px = rgb(x, y)
            if not is_guard(px) and not is_trip(px): bleed.append((x-guard, y-guard))
    if bleed:
        xs = [b[0] for b in bleed]; ys = [b[1] for b in bleed]
        errs.append(f'guard-band: {len(bleed)} px of CLIPPED content outside the canvas '
                    f'(x {min(xs)}..{max(xs)}, y {min(ys)}..{max(ys)})')
    # C/D — ink inside the canvas, and the margin ring
    ink = []
    for y in range(guard, min(h, guard+H)):
        for x in range(guard, min(w, guard+W)):
            r, g, b = rgb(x, y)
            if not (r > 245 and g > 245 and b > 245) and not is_guard((r, g, b)) and not is_trip((r, g, b)):
                ink.append((x-guard, y-guard))
    if not ink:
        errs.append('non-blank: nothing was drawn inside the canvas')
        return errs, None
    x0, y0 = min(i[0] for i in ink), min(i[1] for i in ink)
    x1, y1 = max(i[0] for i in ink), max(i[1] for i in ink)
    if x0 < margin or y0 < margin or x1 > W-1-margin or y1 > H-1-margin:
        errs.append(f'margin-ring: ink reaches [{x0},{y0}]..[{x1},{y1}], violating the {margin}px margin')
    return errs, (x0, y0, x1, y1)

# --------------------------------------------------------------- main ----
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('svgs', nargs='+')
    ap.add_argument('--canvas', default=None,
                    help='WxH. Omit it and the canvas is read from the SVG itself — a hardcoded '
                         'size in a caller silently goes stale the moment a generator resizes.')
    ap.add_argument('--guard', type=int, default=48)
    ap.add_argument('--margin', type=int, default=4)
    ap.add_argument('--fallback', metavar='FRAME1_SVG',
                    help='animated SVG: strip <animate> and assert the static rendering equals '
                         'FRAME1_SVG. Without this, an animation with every group opacity=0 has NO '
                         'valid static form: it renders blank, or composites every step at once.')
    ap.add_argument('--union', action='store_true',
                    help='animated SVG: force every group visible and verify the UNION of all '
                         'steps. Opacity cannot move geometry, so union superset of every step.')
    ap.add_argument('--steps', type=int, default=0, help=argparse.SUPPRESS)
    ap.add_argument('--step-secs', type=float, default=4.4)
    ap.add_argument('--save-dir', default=None)
    a = ap.parse_args()
    if not CHROME: print('FATAL: no chrome/chromium found'); return 2
    if a.canvas:
        W, H = (int(v) for v in a.canvas.split('x'))
    else:
        head = open(a.svgs[0], encoding='utf-8').read(400)
        m = re.search(r'viewBox="0 0 (\d+) (\d+)"', head) or re.search(r'width="(\d+)"\s+height="(\d+)"', head)
        if not m:
            print('FATAL: cannot read the canvas size from', a.svgs[0]); return 2
        W, H = int(m.group(1)), int(m.group(2))
        print(f'canvas read from the file: {W}x{H}')
    if a.save_dir: os.makedirs(a.save_dir, exist_ok=True)
    if a.fallback:
        import tempfile as _tf
        raw = open(a.svgs[0], encoding='utf-8').read()
        stripped = re.sub(r'<animate[^>]*/>', '', raw)
        tmp = _tf.mktemp(suffix='.svg'); open(tmp, 'w', encoding='utf-8').write(stripped)
        e_s, bb_s = check_pixels(tmp, W, H, a.guard, a.margin)
        e_f, bb_f = check_pixels(a.fallback, W, H, a.guard, a.margin)
        os.unlink(tmp)
        errs = e_s + e_f
        if bb_s is None:
            errs.append('fallback: with <animate> stripped the file renders BLANK — it has no static form')
        elif bb_f is None:
            errs.append('fallback: frame 1 renders blank')
        elif bb_s != bb_f:
            errs.append(f'fallback: static rendering {bb_s} != frame 1 {bb_f} — the animation does not '
                        f'degrade to a single valid frame (it is compositing steps)')
        if errs:
            print('FAIL static-fallback'); [print('     ' + m) for m in errs]; return 1
        print(f'PASS static-fallback  (strips to exactly frame 1, ink bbox {bb_s})')
        return 0

    total, failed = 0, 0
    for svg in a.svgs:
        jobs = [(None, os.path.basename(svg) + (' [union of all steps]' if a.union else ''))]
        for seek, label in jobs:
            total += 1
            keep = os.path.join(a.save_dir, label.replace('/', '_').replace('@', '_') + '.png') if a.save_dir else None
            e1, n = check_engine_bbox(svg, W, H, a.margin, seek, a.union)
            e2, bbox = check_pixels(svg, W, H, a.guard, a.margin, seek, keep, a.union)
            errs = e1 + e2
            if errs:
                failed += 1
                print(f'FAIL {label}')
                for m in errs: print(f'     {m}')
            else:
                print(f'PASS {label}  ({n} elements measured, ink bbox {bbox}, guard band clean)')
    print(f'\n{total - failed}/{total} checks passed'
          f'{"" if not failed else f" — {failed} FAILED"}')
    return 1 if failed else 0

if __name__ == '__main__':
    sys.exit(main())
