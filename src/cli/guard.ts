// The recorder's guard: what a page does between frames that makes footage judder,
// wiggle or flicker however exactly it is recorded. A camera or a glide that works
// by re-laying out the page (moving with top or left, growing with height, zooming
// with CSS zoom) moves text to whole pixels and can re-wrap a line, so it steps and
// wiggles; the Layout Instability API names every element that moved in layout. A
// block whose size flips back and forth is a line re-wrapping. And content in a
// stage scaled up with a transform snaps to whole CSS px unless it has its own layer.

/** Runs in the page before anything else. `__motionGuard()` returns what changed since the last call. */
export const GUARD = `(() => {
  const w = window;
  const ids = new WeakMap(); let nextId = 1;
  const id = (el) => { let i = ids.get(el); if (!i) { i = nextId++; ids.set(el, i); } return i; };
  const who = (el) => {
    if (!el || !el.tagName) return 'text';
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/)[0] : '';
    const txt = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 28);
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls + (txt ? ' "' + txt + '"' : '');
  };
  let shifts = [];
  try {
    const po = new PerformanceObserver((list) => { for (const e of list.getEntries()) shifts.push(e); });
    po.observe({ type: 'layout-shift', buffered: true });
    w.__motionShifts = () => { for (const e of po.takeRecords()) shifts.push(e); const s = shifts; shifts = []; return s; };
  } catch { w.__motionShifts = () => []; }
  const BLOCKS = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption,label,button,[data-motion-text],[style*="top"],[style*="left"],[style*="margin"],[style*="height"],[style*="width"]';
  // Where layout puts an element on the page: offsets ignore transforms, so only layout moves show.
  const place = (el) => { let x = 0, y = 0, e = el; while (e) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return [x, y]; };
  w.__motionGuard = () => {
    const out = { shifts: [], sizes: [], zooms: [], scaled: 0 };
    for (const e of w.__motionShifts()) for (const s of e.sources || []) {
      if (!s.node) continue;
      const a = s.previousRect, b = s.currentRect;
      out.shifts.push([who(s.node), Math.round((b.x - a.x) * 10) / 10, Math.round((b.y - a.y) * 10) / 10, Math.round(a.width), Math.round(a.height), Math.round(b.width), Math.round(b.height)]);
    }
    const blocks = document.querySelectorAll(BLOCKS);
    for (let i = 0; i < blocks.length && i < 400; i++) {
      const el = blocks[i];
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
      const [x, y] = place(el);
      out.sizes.push([id(el), who(el), el.offsetWidth, el.offsetHeight, x, y]);
    }
    for (const el of [document.documentElement, document.body, ...document.querySelectorAll('[style*="zoom"]')]) {
      if (!el) continue;
      const z = parseFloat(getComputedStyle(el).zoom || '1') || 1;
      out.zooms.push([who(el).slice(0, 60), z]);
    }
    // The largest scale a transform puts on the page's content, a few levels down.
    const walk = (el, depth) => {
      if (depth > 4) return;
      for (const c of el.children) {
        const t = getComputedStyle(c).transform;
        if (t && t !== 'none') { const m = new DOMMatrixReadOnly(t); out.scaled = Math.max(out.scaled, Math.hypot(m.a, m.b)); }
        walk(c, depth + 1);
      }
    };
    walk(document.body, 0);
    return out;
  };
})()`;

export interface GuardSample {
  /** Layout shifts this frame: who, dx, dy, and the box before and after (w, h). */
  shifts: [string, number, number, number, number, number, number][];
  /** Text blocks and elements with inline layout styles: id, who, width, height, and where layout puts them (x, y). */
  sizes: [number, string, number, number, number, number][];
  /** CSS zoom on the root, the body and anything that sets it inline. */
  zooms: [string, number][];
  /** The largest scale a transform puts on the page's content. */
  scaled: number;
}

const at = (f: number, fps: number) => `${(f / fps).toFixed(2)} s`;
const span = (a: number, b: number, fps: number) => (a === b ? `at ${at(a, fps)}` : `from ${at(a, fps)} to ${at(b, fps)}`);

/** What the guard saw, as lines for the recorder's report, each starting `guard:`. */
export function guardFindings(frames: readonly GuardSample[], fps: number): string[] {
  const out: string[] = [];
  // Layout shifts, one line per element, with the frames and the largest step.
  const moved = new Map<string, { first: number; last: number; n: number; step: number }>();
  frames.forEach((f, i) => {
    if (i === 0) return; // The first frame is the page arriving.
    for (const [who, dx, dy] of f.shifts) {
      const m = moved.get(who) ?? { first: i, last: i, n: 0, step: 0 };
      m.last = i; m.n++; m.step = Math.max(m.step, Math.hypot(dx, dy));
      moved.set(who, m);
    }
  });
  // Layout positions that change between frames: a move by top, left, margin or a growing
  // neighbour. The API above ignores moves under 3 px, which is exactly a slow glide.
  const last = new Map<number, [number, number]>();
  frames.forEach((f, i) => {
    const zoomChanged = i > 0 && f.zooms.some(([who, z]) => frames[i - 1]!.zooms.find((x) => x[0] === who)?.[1] !== z);
    for (const [id, who, , , x, y] of f.sizes) {
      const was = last.get(id);
      last.set(id, [x, y]);
      if (!was || zoomChanged || (was[0] === x && was[1] === y)) continue;
      const m = moved.get(who) ?? { first: i, last: i, n: 0, step: 0 };
      m.last = i; m.n++; m.step = Math.max(m.step, Math.hypot(x - was[0], y - was[1]));
      moved.set(who, m);
    }
  });
  for (const [who, m] of moved) {
    out.push(`guard: ${who} moved in layout on ${m.n} frame(s) ${span(m.first, m.last, fps)}, up to ${m.step.toFixed(1)} px a frame. ` +
      'Layout moves land on whole pixels and can re-wrap text, so they step and wiggle. Move it with a transform, or measure both layouts and glide between them.');
  }
  // A block whose size goes A → B and back to A within 10 frames: a line re-wrapping and back.
  const sizes = new Map<number, { who: string; seen: [number, string][] }>();
  frames.forEach((f, i) => {
    for (const [id, who, w, h] of f.sizes) {
      const s = sizes.get(id) ?? { who, seen: [] };
      const key = `${w}×${h}`;
      if (s.seen[s.seen.length - 1]?.[1] !== key) s.seen.push([i, key]);
      sizes.set(id, s);
    }
  });
  for (const { who, seen } of sizes.values()) {
    for (let k = 2; k < seen.length; k++) {
      if (seen[k]![1] === seen[k - 2]![1] && seen[k]![0] - seen[k - 1]![0] <= 10) {
        out.push(`guard: ${who} changed size ${seen[k - 2]![1]} → ${seen[k - 1]![1]} → ${seen[k]![1]} ${span(seen[k - 2]![0], seen[k]![0], fps)}: a line re-wrapping and back. Lay it out once at its final size and move it with transforms.`);
        break;
      }
    }
  }
  // CSS zoom that changes between frames re-lays out the whole page each frame.
  const zooms = new Map<string, number>();
  const zoomed = new Map<string, { first: number; last: number; lo: number; hi: number }>();
  frames.forEach((f, i) => {
    for (const [who, z] of f.zooms) {
      const was = zooms.get(who);
      zooms.set(who, z);
      if (was === undefined || Math.abs(was - z) < 1e-4) continue;
      const m = zoomed.get(who) ?? { first: i, last: i, lo: Math.min(was, z), hi: Math.max(was, z) };
      m.last = i; m.lo = Math.min(m.lo, z); m.hi = Math.max(m.hi, z);
      zoomed.set(who, m);
    }
  });
  for (const [who, m] of zoomed) {
    out.push(`guard: CSS zoom on ${who} changes ${span(m.first, m.last, fps)} (${m.lo.toFixed(2)}–${m.hi.toFixed(2)}): every frame re-lays out the page, so text re-wraps and steps. Zoom with a transform on a page laid out once.`);
  }
  // A stage scaled up: content moving inside it without its own layer snaps to whole CSS px.
  const scaled = Math.max(0, ...frames.map((f) => f.scaled));
  if (scaled >= 1.5) {
    out.push(`guard: content sits in a stage scaled ${scaled.toFixed(1)}×. Anything that moves inside it without its own compositor layer snaps to whole CSS px, ${scaled.toFixed(1)} px on screen, so slow moves judder. ` +
      'Give moving parts will-change: transform, or lay the page out at its final size. Run motion review on the footage to see whether it does.');
  }
  return out;
}

/** Runs in the page: where each selector's first element sits, without its own transform, in device px. */
export const MARKS = `((selectors, scale) => {
  const out = {};
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (!el) { out[sel] = null; continue; }
    const st = el.style, was = [st.transform, st.translate, st.scale, st.rotate, st.transition];
    st.transition = 'none'; st.transform = 'none'; st.translate = 'none'; st.scale = 'none'; st.rotate = 'none';
    const r = el.getBoundingClientRect();
    [st.transform, st.translate, st.scale, st.rotate, st.transition] = was;
    out[sel] = r.width || r.height ? [r.left * scale, r.top * scale, r.width * scale, r.height * scale].map((v) => Math.round(v * 10) / 10) : null;
  }
  return out;
})`;

/** A recording's marks: per selector, its box in footage px on every frame (null where it is not on the page). */
export interface Marks {
  fps: number;
  /** The footage's size in px. */
  size: [number, number];
  marks: Record<string, ([number, number, number, number] | null)[]>;
}
