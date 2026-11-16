// rig/layer-stack. See library/primitives/rig/layer-stack.md.
//
// Named planes lie flat and float one above the other, seen from above at an
// angle, each with a label that always faces the camera. They close onto the
// lowest plane one after another (or open from it), so several things are seen
// to become one. The base never moves: the stack grows upward from it and comes
// back down to it, which leaves the closed layer low in the rig, ready for
// whatever the next scene stands on it. Seen by the rigs' shared camera
// (./camera.ts), on top of the stack's own lay and turn.
import { clamp } from '../../core/ease.ts';
import { list, num, str, type Primitive } from '../types.ts';
import { cameraAt, cameraEnd, cameraParams, cameraTransform, type CameraPose } from './camera.ts';

const hairline = (pct: number) => `color-mix(in srgb, var(--m-text-primary) ${pct}%, transparent)`;
const smooth = (x: number) => { const k = clamp(x); return k * k * (3 - 2 * k); };
const rad = (deg: number) => (deg * Math.PI) / 180;

export const ORDERS = ['close', 'open', 'open-close'] as const;
export const LOOKS = ['solid', 'wire'] as const;
/** The lay at which a square lying flat is drawn isometric: its diagonals in the ratio 1 to √3. */
export const ISOMETRIC_LAY = 54.7356;
export type Order = (typeof ORDERS)[number];

export interface StackTiming { order: Order; start: number; travel: number; stagger: number; apart: number }

/** When the last plane has landed (or, for `open`, lifted), in seconds. */
export function stackEnd(n: number, s: StackTiming): number {
  const one = s.travel + Math.max(0, n - 2) * s.stagger;
  return s.start + (s.order === 'open-close' ? 2 * one + s.apart : one);
}

/**
 * How far each of `n` planes is lifted off the base at time t: 0 lying on it,
 * 1 at its full height. Plane 0 is the base and never moves. Closing, the
 * lowest plane lands first; opening, the top one lifts first. A higher plane
 * is never less open than the one below it, so planes cannot pass each other.
 */
export function lifts(n: number, t: number, s: StackTiming, ease: (x: number) => number = (x) => x): number[] {
  const travel = Math.max(0.01, s.travel);
  const opening = (from: number) => Array.from({ length: n }, (_, i) => (i === 0 ? 0 : ease(clamp((t - from - (n - 1 - i) * s.stagger) / travel))));
  const closing = (from: number) => Array.from({ length: n }, (_, i) => (i === 0 ? 0 : 1 - ease(clamp((t - from - (i - 1) * s.stagger) / travel))));
  if (s.order === 'open') return opening(s.start);
  if (s.order === 'close') return closing(s.start);
  const shut = s.start + travel + Math.max(0, n - 2) * s.stagger + s.apart;
  return t < shut ? opening(s.start) : closing(shut);
}

export interface View { lay: number; turn: number; cam: CameraPose; P: number; w: number; h: number }

/**
 * Where a point of the stack is seen, in px from the middle of the rig. The point
 * is given from the middle of a plane, z along the planes' normal. It follows the
 * same chain the browser applies: the planes' turn and lay, then the camera's pan,
 * roll, tilt, pitch and distance, then the lens.
 */
export function project([x, y, z]: readonly [number, number, number], v: View): [number, number] {
  const rot = (a: number, b: number, deg: number): [number, number] => {
    const r = rad(deg), c = Math.cos(r), s = Math.sin(r);
    return [a * c - b * s, a * s + b * c];
  };
  [x, y] = rot(x, y, v.turn);
  [y, z] = rot(y, z, v.lay);
  x -= v.cam.x * v.w; y -= v.cam.y * v.h;
  [x, y] = rot(x, y, v.cam.rz);
  [z, x] = rot(z, x, v.cam.ry);
  [y, z] = rot(y, z, v.cam.rx);
  // Zoom is a distance, so a parallel lens has none.
  if (v.P > 0) z += v.P * (1 - 1 / Math.max(0.05, v.cam.zoom));
  // P 0 is a parallel lens: depth changes nothing.
  const k = v.P > 0 ? v.P / Math.max(1, v.P - z) : 1;
  return [x * k, y * k];
}

const timing = (p: Record<string, unknown>): StackTiming => ({
  order: (ORDERS as readonly string[]).includes(str(p.order)) ? (str(p.order) as Order) : 'close',
  start: num(p.start), travel: num(p.travel), stagger: num(p.stagger), apart: num(p.apart),
});

export const layerStack: Primitive = {
  slug: 'rig/layer-stack',
  summary: 'Named planes float one above the other, then close onto the lowest and become one layer.',
  props: {
    items: { type: 'string[]', required: true, label: 'Plane names, from the base up' },
    faces: { type: 'string[]', default: [], label: 'A picture for each plane, in the same order (paths relative to the film)' },
    name: { type: 'string', default: '', label: 'What the closed stack is called' },
  },
  params: {
    width: { type: 'number', default: 42, min: 15, max: 90, step: 1, unit: '% of stage width', label: 'Width of a plane' },
    aspect: { type: 'number', default: 1, min: 0.4, max: 1.6, step: 0.01, unit: 'depth ÷ width', label: 'Proportions of a plane' },
    gap: { type: 'number', default: 120, min: 20, max: 320, step: 1, unit: 'px', label: 'Space between planes when apart' },
    lay: { type: 'number', default: 60, min: 0, max: 80, step: 1, unit: 'deg', label: 'How far the planes lie back (0 faces the camera)' },
    turn: { type: 'number', default: -45, min: -90, max: 90, step: 1, unit: 'deg', label: 'Turn of the planes about their own axis' },
    spin: { type: 'number', default: 1.2, min: -8, max: 8, step: 0.1, unit: 'deg/s', label: 'Slow turn that never stops' },
    order: { type: 'choice', default: 'close', options: ORDERS, label: 'Close starts apart and ends as one, open the reverse, open-close does both' },
    start: { type: 'number', default: 1.4, min: 0, max: 10, step: 0.05, unit: 's', label: 'When the planes start to move' },
    travel: { type: 'number', default: 0.9, min: 0.3, max: 3, step: 0.05, unit: 's', label: 'Time one plane takes to land or lift' },
    stagger: { type: 'number', default: 0.14, min: 0, max: 0.6, step: 0.01, unit: 's', label: 'Delay between one plane and the next' },
    apart: { type: 'number', default: 1.2, min: 0, max: 6, step: 0.05, unit: 's', label: 'For open-close: time held apart' },
    radius: { type: 'number', default: 28, min: 0, max: 120, step: 1, unit: 'px', label: 'Corner radius of a plane' },
    lens: { type: 'number', default: 4, min: 0, max: 12, step: 0.5, unit: '× the rig', label: 'Length of the lens; 0 is parallel, as in an isometric drawing' },
    look: { type: 'choice', default: 'solid', options: LOOKS, label: 'Solid surfaces with shadows, or a wire drawing with guides and numbered labels' },
    ...cameraParams({ path: 'hold', tilt: 0, pitch: 0, roll: 0, zoom: 1, move: 1.6 }),
  },
  duration: (props, p) => {
    const n = list(props.items).length, s = timing(p);
    // The ring that marks the planes becoming one runs on for 0.9 s after the last landing.
    return Math.max(cameraEnd(p), stackEnd(n, s) + (s.order === 'open' ? 0 : 0.9));
  },
  check(props) {
    const n = list(props.items).length, f = list(props.faces).length;
    const issues = [];
    if (n < 2) issues.push({ path: 'props.items', message: 'A stack needs at least two planes.', hint: 'Name two to seven planes, from the base up.' });
    if (f > 0 && f !== n) issues.push({ path: 'props.faces', message: `There are ${f} faces for ${n} planes.`, hint: 'Give one picture per plane, or none.' });
    return issues;
  },
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const [W] = ctx.size, u = W / 1080;
    const items = list(props.items), faces = list(props.faces), n = items.length;
    const s = timing(p);
    const w = (num(p.width) / 100) * W, h = w * num(p.aspect), gap = num(p.gap) * u, R = num(p.radius) * u;
    const lay = num(p.lay), turn0 = num(p.turn), spin = num(p.spin);
    // The box the layer takes on stage: the planes' footprint as seen, plus the height of the open stack.
    const a0 = rad(turn0), cl = Math.cos(rad(lay)), sl = Math.sin(rad(lay));
    const bw = Math.abs(w * Math.cos(a0)) + Math.abs(h * Math.sin(a0));
    const bh = (Math.abs(w * Math.sin(a0)) + Math.abs(h * Math.cos(a0))) * cl + (n - 1) * gap * sl;
    // A long lens keeps planes near parallel, so the stack reads as a diagram, not a room; at 0 they are parallel.
    const P = Math.max(bw, bh) * num(p.lens);
    const wire = str(p.look) === 'wire';
    const z0 = -((n - 1) * gap) / 2;

    const wrap = doc.createElement('div');
    wrap.style.cssText = `position:relative;width:${bw}px;height:${bh}px;perspective:${P > 0 ? `${P}px` : 'none'}`;
    const world = doc.createElement('div');
    world.style.cssText = `position:absolute;left:${(bw - w) / 2}px;top:${(bh - h) / 2}px;width:${w}px;height:${h}px;transform-style:preserve-3d;transform-origin:50% 50%`;
    const turner = doc.createElement('div');
    turner.style.cssText = 'position:absolute;inset:0;transform-style:preserve-3d;transform-origin:50% 50%';
    world.appendChild(turner);

    // Labels are not in the 3D world: a quad that faces the camera cuts through the plane
    // it marks and loses half of itself to it. They sit on a flat sheet over the rig, at
    // the point where their corner is seen.
    const overlay = doc.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0';
    const font = 'var(--m-font-body)';
    const label = (text: string, color: string, mark: string, index = '') => {
      const l = doc.createElement('div');
      l.style.cssText = `position:absolute;left:0;top:0;transform-origin:0 0;display:flex;align-items:center;gap:${12 * u}px;white-space:nowrap;`
        + (wire ? `font:500 ${21 * u}px/1 var(--m-font-mono);letter-spacing:0.06em;text-transform:uppercase;color:${color}`
          : `font:500 ${27 * u}px/1 ${font};letter-spacing:-0.01em;color:${color}`);
      const dot = doc.createElement('i');
      dot.style.cssText = `display:block;flex:none;width:${9 * u}px;height:${9 * u}px;border-radius:50%;background:${mark};margin-left:${-4.5 * u}px`;
      const stem = doc.createElement('i');
      stem.style.cssText = wire
        ? `display:block;flex:none;width:${44 * u}px;height:0;border-top:${1.5 * u}px dotted ${hairline(45)}`
        : `display:block;flex:none;width:${34 * u}px;height:${1.5 * u}px;background:${hairline(22)}`;
      const span = doc.createElement('span');
      span.textContent = text;
      l.append(dot, stem);
      if (index) {
        const no = doc.createElement('span');
        no.textContent = index;
        no.style.color = hairline(45);
        l.appendChild(no);
      }
      l.appendChild(span);
      // Centre the row on the corner it marks.
      const inner = doc.createElement('div');
      inner.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0';
      l.style.transform = 'translateY(-50%)';
      inner.appendChild(l);
      overlay.appendChild(inner);
      return inner;
    };

    // The ring that leaves the base when the planes have become one.
    const ring = doc.createElement('div');
    ring.style.cssText = `position:absolute;inset:0;border-radius:${R}px;box-shadow:0 0 0 ${2 * u}px var(--m-accent);visibility:hidden`;
    turner.appendChild(ring);

    const planes = items.map((title, i) => {
      const plane = doc.createElement('div');
      plane.style.cssText = `position:absolute;inset:0;border-radius:${R}px;overflow:hidden;`
        + `background:color-mix(in srgb, var(${wire ? '--m-bg-base' : '--m-bg-surface'}) ${wire ? 86 : 92}%, transparent)`;
      if (faces[i]) {
        const img = doc.createElement('img');
        img.src = faces[i]!;
        img.alt = title;
        img.decoding = 'sync';
        img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block';
        plane.appendChild(img);
      }
      // The look the top plane takes once everything lies on the base: the accent, lit.
      const lit = doc.createElement('div');
      lit.style.cssText = `position:absolute;inset:0;border-radius:inherit;background:color-mix(in srgb, var(--m-accent) ${wire ? 20 : 16}%, transparent);`
        + `box-shadow:inset 0 0 0 ${2 * u}px var(--m-accent)${wire ? '' : `, inset 0 0 ${90 * u}px color-mix(in srgb, var(--m-accent) 30%, transparent)`};opacity:0`;
      plane.appendChild(lit);
      turner.appendChild(plane);
      return { plane, lit, tag: label(title, 'var(--m-text-secondary)', hairline(wire ? 80 : 55), wire ? String(i + 1).padStart(2, '0') : '') };
    });
    const nameTag = str(props.name) ? label(str(props.name), 'var(--m-text-primary)', 'var(--m-accent)') : null;
    if (nameTag) (nameTag.firstElementChild as HTMLElement).style.fontWeight = '600';

    // Wire look: dotted guides join the corners of the base to the corners of the top plane.
    const NS = 'http://www.w3.org/2000/svg';
    const guides = wire ? [0, 1, 2].map(() => {
      const svg = overlay.querySelector('svg') ?? overlay.insertBefore(doc.createElementNS(NS, 'svg'), overlay.firstChild);
      svg.setAttribute('width', String(bw)); svg.setAttribute('height', String(bh));
      (svg as SVGElement).style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
      const line = doc.createElementNS(NS, 'line');
      line.setAttribute('stroke', hairline(55));
      line.setAttribute('stroke-width', String(1.5 * u));
      line.setAttribute('stroke-dasharray', `${1.5 * u} ${7 * u}`);
      line.setAttribute('stroke-linecap', 'round');
      svg.appendChild(line);
      return line;
    }) : [];
    wrap.append(world, overlay);
    el.appendChild(wrap);

    const camEase = ctx.ease(p.ease as never), move = ctx.ease('quint.inOut'), out = ctx.ease('expo.out');
    const landed = stackEnd(n, s);
    return {
      seek(t) {
        const cam = cameraAt(t, p, camEase);
        world.style.transform = cameraTransform(cam, P, w, h);
        const turn = turn0 + spin * t;
        turner.style.transform = `rotateX(${lay.toFixed(3)}deg) rotateZ(${turn.toFixed(3)}deg)`;
        const at = (x: number, y: number, z: number): [number, number] => {
          const [sx, sy] = project([x - w / 2, y - h / 2, z], { lay, turn, cam, P, w, h });
          return [bw / 2 + sx, bh / 2 + sy];
        };
        const seen = (x: number, y: number, z: number) => { const [sx, sy] = at(x, y, z); return `translate(${sx.toFixed(2)}px, ${sy.toFixed(2)}px)`; };
        // They hang on the corner that is furthest right on screen.
        const a = rad(turn), c = Math.cos(a), sn = Math.sin(a);
        let cx = w, cy = h, best = -Infinity;
        for (const [x, y] of [[0, 0], [w, 0], [w, h], [0, h]] as const) {
          const sx = (x - w / 2) * c - (y - h / 2) * sn;
          if (sx > best) { best = sx; cx = x; cy = y; }
        }
        const lift = lifts(n, t, s, move);
        const top = lift[n - 1] ?? 0, closed = 1 - top;
        planes.forEach((pl, i) => {
          const k = lift[i]!, z = z0 + i * gap * k;
          pl.plane.style.transform = `translateZ(${z.toFixed(2)}px)`;
          // A plane's shadow grows with its height above the one below; lying flush it casts nothing.
          const above = i === 0 ? 1 : clamp((k * i - (lift[i - 1] ?? 0) * (i - 1)));
          pl.plane.style.boxShadow = wire
            ? `inset 0 0 0 ${1.5 * u}px ${hairline(i === 0 ? 85 : 62)}`
            : `0 0 0 ${1.5 * u}px ${hairline(i === 0 ? 14 : 10 + 8 * above)},0 0 ${70 * u * above}px rgba(0,0,0,${(0.38 * above).toFixed(3)})`;
          // A plane lying on another is that plane: it is gone by the time it lands.
          pl.plane.style.opacity = i === 0 || i === n - 1 ? '1' : smooth(k / 0.25).toFixed(3);
          pl.lit.style.opacity = i === n - 1 ? smooth((closed - 0.55) / 0.45).toFixed(3) : '0';
          pl.tag.style.transform = seen(cx, cy, z);
          pl.tag.style.opacity = (i === 0 ? smooth(top / 0.3) : smooth((k - 0.15) / 0.35)).toFixed(3);
        });
        if (nameTag) {
          nameTag.style.transform = seen(cx, cy, z0);
          nameTag.style.opacity = smooth((closed - 0.7) / 0.3).toFixed(3);
        }
        if (guides.length) {
          // Every corner but the furthest one, which the planes hide.
          const corners = ([[0, 0], [w, 0], [w, h], [0, h]] as const).map(([x, y]) => ({ a: at(x, y, z0), b: at(x, y, z0 + (n - 1) * gap * top) }));
          const back = corners.reduce((m, c, i) => (c.a[1] < corners[m]!.a[1] ? i : m), 0);
          corners.filter((_, i) => i !== back).forEach((c, i) => {
            const g = guides[i]!;
            g.setAttribute('x1', c.a[0].toFixed(2)); g.setAttribute('y1', c.a[1].toFixed(2));
            g.setAttribute('x2', c.b[0].toFixed(2)); g.setAttribute('y2', c.b[1].toFixed(2));
            g.setAttribute('opacity', smooth(top / 0.3).toFixed(3));
          });
        }
        // One ring, once, from the base outward.
        const r = s.order === 'open' ? 0 : clamp((t - landed + 0.12) / 0.9);
        ring.style.visibility = r > 0 && r < 1 ? 'inherit' : 'hidden';
        ring.style.transform = `translateZ(${z0.toFixed(2)}px) scale(${(1 + 0.32 * out(r)).toFixed(4)})`;
        ring.style.opacity = ((1 - r) * (1 - r) * 0.9).toFixed(3);
      },
    };
  },
};
