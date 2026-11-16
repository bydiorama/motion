// rig/browser-window. See library/primitives/rig/browser-window.md.
//
// A page in a browser window that pulls back from frontal into perspective,
// then lifts one part of itself off the page towards the camera. The lifted part
// is the page's own picture, cropped: the same image (or the same drawn page)
// painted twice, so nothing is retyped and nothing is out of step. Its shadow
// grows with its height, and the page darkens beneath it. After the move the
// window keeps turning slowly, so the hold is never dead still.
import { clamp } from '../../core/ease.ts';
import { nums, num, str, type Primitive } from '../types.ts';

const hairline = (pct: number) => `color-mix(in srgb, var(--m-text-primary) ${pct}%, transparent)`;

/** A placeholder page drawn from the theme, for films without a screenshot. All in % of the screen. */
function paintSkeleton(box: HTMLElement, radius: number) {
  const doc = box.ownerDocument;
  const add = (css: string) => { const d = doc.createElement('div'); d.style.cssText = `position:absolute;${css}`; box.appendChild(d); return d; };
  box.style.background = 'var(--m-bg-base)';
  const bar = (x: number, y: number, w: number, h: number, a: number, r = 999) => add(`left:${x}%;top:${y}%;width:${w}%;height:${h}%;border-radius:${r}px;background:${hairline(a)}`);
  // nav
  bar(5, 6, 9, 3.6, 34);
  [52, 61, 70].forEach((x) => bar(x, 7, 6, 2, 18));
  add('left:82%;top:5.4%;width:13%;height:5%;border-radius:999px;background:var(--m-bg-inverse)');
  // headline, two lines and a sub line
  bar(22, 22, 56, 6.4, 30);
  bar(30, 31.5, 40, 6.4, 30);
  bar(33, 42, 34, 2.4, 14);
  // three cards: the middle one carries the accent
  [[6, 'var(--m-bg-surface)'], [36, 'color-mix(in srgb, var(--m-accent) 22%, var(--m-bg-surface))'], [66, 'var(--m-bg-surface)']].forEach(([x, bg]) => {
    const c = add(`left:${x}%;top:54%;width:28%;height:38%;border-radius:${radius}px;background:${bg};box-shadow:inset 0 0 0 1px ${hairline(8)}`);
    const inner = (y: number, w: number, a: number) => { const d = doc.createElement('div'); d.style.cssText = `position:absolute;left:9%;top:${y}%;width:${w}%;height:6%;border-radius:999px;background:${hairline(a)}`; c.appendChild(d); };
    inner(64, 70, 30);
    inner(76, 46, 16);
    const dot = doc.createElement('div');
    dot.style.cssText = `position:absolute;left:9%;top:12%;width:14%;aspect-ratio:1;border-radius:50%;background:${x === 36 ? 'var(--m-accent)' : hairline(20)}`;
    c.appendChild(dot);
  });
}

export const browserWindow: Primitive = {
  slug: 'rig/browser-window',
  summary: 'A page in a browser window turns into perspective, then lifts one of its parts.',
  props: {
    src: { type: 'string', default: '', label: 'Screenshot of the page (path or URL). Left out, a placeholder page is drawn' },
    url: { type: 'string', default: 'example.com', label: 'Address shown in the bar' },
    lift: { type: 'number[]', default: [], label: 'Part to lift: [x, y, width, height] in % of the page' },
  },
  params: {
    width: { type: 'number', default: 80, min: 40, max: 100, step: 1, unit: '% of stage width', label: 'Width of the window' },
    aspect: { type: 'number', default: 0.625, min: 0.4, max: 1.4, step: 0.005, unit: 'height / width', label: 'Shape of the page' },
    tilt: { type: 'number', default: -24, min: -40, max: 40, step: 1, unit: 'deg', label: 'Turn once in perspective (negative faces left)' },
    pitch: { type: 'number', default: 10, min: 0, max: 25, step: 1, unit: 'deg', label: 'Lean back once in perspective' },
    move: { type: 'number', default: 1.0, min: 0.4, max: 2.4, step: 0.05, unit: 's', label: 'Time to turn into perspective' },
    lift: { type: 'number', default: 140, min: 0, max: 320, step: 5, unit: 'px', label: 'How far the part rises off the page' },
    drift: { type: 'number', default: 1.2, min: 0, max: 4, step: 0.1, unit: 'deg/s', label: 'Slow turn back towards frontal after the move' },
  },
  // The move, then the lift, which starts at 80% of the move and takes 0.8 s.
  duration: (props, p) => (nums(props.lift).length === 4 && num(p.lift) > 0 ? Math.max(num(p.move), num(p.move) * 0.8 + 0.8) : num(p.move)),
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const [W] = ctx.size, u = W / 1080;
    const winW = (num(p.width) / 100) * W, barH = Math.round(40 * u * (winW / (W * 0.8))), pageH = winW * num(p.aspect);
    const winH = pageH + barH, R = 16 * u, P = winW * 2.2;
    const src = str(props.src);

    const wrap = doc.createElement('div');
    wrap.style.cssText = `position:relative;width:${winW}px;height:${winH}px;perspective:${P}px`;
    const win = doc.createElement('div');
    win.style.cssText = 'position:absolute;inset:0;transform-style:preserve-3d;transform-origin:50% 50%';
    const body = doc.createElement('div');
    body.style.cssText = `position:absolute;inset:0;overflow:hidden;border-radius:${R}px;background:var(--m-bg-sunken);`
      + `box-shadow:0 0 0 1px ${hairline(9)},0 ${60 * u}px ${120 * u}px rgba(0,0,0,.55),0 ${20 * u}px ${40 * u}px rgba(0,0,0,.35)`;
    // The bar: three lights and the address.
    const bar = doc.createElement('div');
    bar.style.cssText = `position:absolute;left:0;top:0;right:0;height:${barH}px;display:flex;align-items:center;gap:${8 * u}px;padding:0 ${16 * u}px;`
      + `background:var(--m-bg-surface);border-bottom:1px solid ${hairline(6)}`;
    for (let i = 0; i < 3; i++) {
      const dot = doc.createElement('i');
      dot.style.cssText = `display:block;width:${11 * u}px;height:${11 * u}px;border-radius:50%;background:${hairline(16)}`;
      bar.appendChild(dot);
    }
    const address = doc.createElement('b');
    address.textContent = str(props.url);
    address.style.cssText = `position:absolute;left:50%;top:50%;translate:-50% -50%;height:${barH * 0.55}px;min-width:${winW * 0.28}px;padding:0 ${12 * u}px;`
      + `border-radius:${6 * u}px;background:${hairline(7)};color:var(--m-text-muted);font:500 ${barH * 0.3}px/${barH * 0.55}px var(--m-font-body);text-align:center;letter-spacing:0.01em;white-space:nowrap`;
    bar.appendChild(address);
    const paint = (box: HTMLElement) => {
      if (src) {
        const img = doc.createElement('img');
        img.src = src;
        img.alt = '';
        img.decoding = 'sync';
        img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top';
        box.appendChild(img);
      } else paintSkeleton(box, 12 * u);
    };
    const page = doc.createElement('div');
    page.style.cssText = `position:absolute;left:0;top:${barH}px;width:${winW}px;height:${pageH}px;overflow:hidden`;
    paint(page);
    // A soft sheen across the glass and a highlight on its top edge.
    const sheen = doc.createElement('div');
    sheen.style.cssText = `position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(135deg,rgba(255,255,255,.06),transparent 38%);box-shadow:inset 0 1px 0 rgba(255,255,255,.1)`;
    body.append(bar, page);

    // The lifted part: the page again, cropped to the rect and pushed along z.
    const rect = nums(props.lift);
    let lift: { box: HTMLElement; dim: HTMLElement } | undefined;
    if (rect.length === 4) {
      const [lx, ly, lw, lh] = [rect[0]! / 100 * winW, rect[1]! / 100 * pageH, rect[2]! / 100 * winW, rect[3]! / 100 * pageH];
      const dim = doc.createElement('div');
      // Beneath the part, the page darkens softly: the lifted part's own shadow on it.
      dim.style.cssText = `position:absolute;left:${lx}px;top:${ly + barH}px;width:${lw}px;height:${lh}px;border-radius:${12 * u}px;background:#000;opacity:0;filter:blur(${14 * u}px)`;
      body.appendChild(dim);
      const box = doc.createElement('div');
      box.style.cssText = `position:absolute;left:${lx}px;top:${ly + barH}px;width:${lw}px;height:${lh}px;overflow:hidden;border-radius:${12 * u}px;transform-origin:50% 50%;visibility:hidden`;
      const copy = doc.createElement('div');
      copy.style.cssText = `position:absolute;left:${-lx}px;top:${-ly}px;width:${winW}px;height:${pageH}px`;
      paint(copy);
      box.appendChild(copy);
      lift = { box, dim };
    }
    body.appendChild(sheen);
    win.appendChild(body);
    if (lift) win.appendChild(lift.box);
    wrap.appendChild(win);
    el.appendChild(wrap);

    const ease = ctx.ease('cubic.inOut'), rise = ctx.ease('expo.out');
    const move = Math.max(0.01, num(p.move)), tilt = num(p.tilt), pitch = num(p.pitch), drift = num(p.drift);
    const depth = winW * 0.18, liftZ = num(p.lift) * u, liftAt = move * 0.8;
    return {
      seek(t) {
        const e = ease(clamp(t / move));
        // Two clocks: the eased turn, then a slow linear relaxation under the hold.
        const after = Math.max(0, t - move), sign = Math.sign(tilt) || 1;
        const ry = tilt * e - sign * Math.min(Math.abs(tilt) * 0.5, drift * after);
        const rx = pitch * e - Math.min(pitch * 0.5, drift * 0.4 * after);
        const rz = -0.1 * tilt * e;
        win.style.transform = `translateZ(${(-depth * e).toFixed(2)}px) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) rotateZ(${rz.toFixed(3)}deg)`;
        if (!lift) return;
        const k = rise(clamp((t - liftAt) / 0.8));
        const z = liftZ * k, sh = clamp(z / (140 * u));
        lift.box.style.visibility = k > 0 ? 'inherit' : 'hidden';
        lift.box.style.transform = `translateZ(${z.toFixed(2)}px) scale(${(1 + 0.04 * k).toFixed(4)})`;
        // The shadow grows with the height: flush, it casts nothing.
        lift.box.style.boxShadow = `0 0 0 1px rgba(255,255,255,${(0.08 * sh).toFixed(3)}),0 ${40 * u * sh}px ${90 * u * sh}px rgba(0,0,0,${(0.6 * sh).toFixed(3)}),0 ${12 * u * sh}px ${28 * u * sh}px rgba(0,0,0,${(0.35 * sh).toFixed(3)})`;
        lift.dim.style.opacity = (0.3 * k).toFixed(3);
      },
    };
  },
};
