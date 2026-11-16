// rig/tab-stack. See library/primitives/rig/tab-stack.md.
//
// A list of tabs, stacked as stairs in depth: each tab stands a step nearer the
// camera than the one before it. The open state slides through the list as one
// continuous move: each tab's openness is its distance from the slide's
// position, so exactly one tab's worth of height is shared between neighbours
// at any instant and the list keeps its length. Each tab cross-fades between its
// closed and open look instead of switching in one frame. The tab that ends open
// pops a step further forward. Seen by the rigs' shared camera (./camera.ts).
import { clamp, lerp } from '../../core/ease.ts';
import { list, num, type Primitive } from '../types.ts';
import { cameraAt, cameraEnd, cameraParams, cameraTransform } from './camera.ts';

const hairline = (pct: number) => `color-mix(in srgb, var(--m-text-primary) ${pct}%, transparent)`;
const sine = (x: number) => (1 - Math.cos(Math.PI * clamp(x))) / 2;

/** Tab indices (0-based) open at the start and at the end. `to` 0 means the last tab. */
export function openRange(props: Record<string, unknown>): [number, number] {
  const n = list(props.items).length, last = Math.max(0, n - 1);
  const pick = (v: unknown, fallback: number) => (typeof v === 'number' && v >= 1 ? Math.min(last, Math.round(v) - 1) : fallback);
  return [pick(props.from, 0), pick(props.to, last)];
}

/**
 * How open each of `n` tabs is (0–1) when the slide is at position `c`
 * (0 = the first tab fully open). The shares always add up to one.
 */
export function openness(n: number, c: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.max(0, 1 - Math.abs(c - i)));
}

export const tabStack: Primitive = {
  slug: 'rig/tab-stack',
  summary: 'Tabs stacked as stairs in depth; the open tab slides through them, then pops forward.',
  props: {
    items: { type: 'string[]', required: true, label: 'Tab titles, in order' },
    details: { type: 'string[]', default: [], label: 'What each tab shows when open, in the same order' },
    from: { type: 'number', default: 1, label: 'Tab open at the start (1 is the first)' },
    to: { type: 'number', default: 0, label: 'Tab open at the end (0 is the last)' },
  },
  params: {
    width: { type: 'number', default: 64, min: 30, max: 100, step: 1, unit: '% of stage width', label: 'Width of the stack' },
    stack: { type: 'number', default: 34, min: 0, max: 90, step: 1, unit: 'px', label: 'Height of each step towards the camera' },
    slide_at: { type: 'number', default: 0.9, min: 0, max: 6, step: 0.05, unit: 's', label: 'When the open tab starts to slide' },
    slide: { type: 'number', default: 1.6, min: 0.3, max: 5, step: 0.05, unit: 's', label: 'Time for the open tab to slide from first to last' },
    pop: { type: 'number', default: 46, min: 0, max: 140, step: 1, unit: 'px', label: 'How far the tab that ends open pops forward' },
    ...cameraParams({ path: 'out', tilt: -19, pitch: 13, roll: -1.5, zoom: 0.9, move: 1.6 }),
  },
  duration: (props, p) => {
    const [a, b] = openRange(props);
    return Math.max(cameraEnd(p), a === b ? 0 : num(p.slide_at) + num(p.slide) + (num(p.pop) > 0 ? 0.7 : 0));
  },
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const [W] = ctx.size, u = W / 1080;
    const items = list(props.items), details = list(props.details), n = items.length;
    const [from, to] = openRange(props);
    const w = (num(p.width) / 100) * W, pad = 18 * u, gap = 12 * u;
    const Hc = 78 * u, Ho = Hc + 118 * u, R = 14 * u;
    const H = n * Hc + (n > 0 ? Ho - Hc : 0) + Math.max(0, n - 1) * gap + 2 * pad;
    const P = Math.max(w, H) * 2.4;

    const wrap = doc.createElement('div');
    wrap.style.cssText = `position:relative;width:${w}px;height:${H}px;perspective:${P}px;text-align:left`;
    const world = doc.createElement('div');
    world.style.cssText = 'position:absolute;inset:0;transform-style:preserve-3d;transform-origin:50% 50%';
    // The ground the stairs stand on.
    const ground = doc.createElement('div');
    ground.style.cssText = `position:absolute;inset:0;border-radius:${R + pad}px;background:var(--m-bg-sunken);`
      + `box-shadow:0 0 0 1px ${hairline(9)},0 ${60 * u}px ${120 * u}px rgba(0,0,0,.55)`;
    world.appendChild(ground);

    const font = 'var(--m-font-body)';
    const tabs = items.map((title, i) => {
      const card = doc.createElement('div');
      card.style.cssText = `position:absolute;left:${pad}px;width:${w - 2 * pad}px;overflow:hidden;border-radius:${R}px;background:var(--m-bg-surface)`;
      // Both looks share one title row, so a cross-fade only changes colour and detail, never position.
      const row = (color: string, mark: string) => {
        const r = doc.createElement('div');
        r.style.cssText = `position:absolute;left:0;right:0;top:0;height:${Hc}px;display:flex;align-items:center;gap:${12 * u}px;padding:0 ${24 * u}px;`
          + `font:500 ${26 * u}px/1.2 ${font};color:${color};white-space:nowrap`;
        const dot = doc.createElement('i');
        dot.style.cssText = `display:block;flex:none;width:${10 * u}px;height:${10 * u}px;border-radius:50%;background:${mark}`;
        const label = doc.createElement('span');
        label.textContent = title;
        label.style.flex = '1';
        r.append(dot, label);
        return r;
      };
      // Closed look: the title, quiet, with a plus.
      const shut = row('var(--m-text-muted)', hairline(22));
      const plus = doc.createElement('span');
      plus.textContent = '+';
      plus.style.cssText = `font-size:${28 * u}px;color:${hairline(40)}`;
      shut.appendChild(plus);
      // Open look: a tinted card, the accent mark, the detail, and a bar that fills while it is open.
      const open = doc.createElement('div');
      open.style.cssText = `position:absolute;inset:0;background:color-mix(in srgb, var(--m-accent) 9%, var(--m-bg-surface));`
        + `box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--m-accent) 28%, transparent);border-radius:inherit`;
      const head = row('var(--m-text-primary)', 'var(--m-accent)');
      (head.firstElementChild as HTMLElement).style.boxShadow = `0 0 ${10 * u}px color-mix(in srgb, var(--m-accent) 60%, transparent)`;
      const body = doc.createElement('p');
      body.textContent = details[i] ?? '';
      body.style.cssText = `position:absolute;left:${46 * u}px;right:${40 * u}px;top:${Hc - 14 * u}px;margin:0;font:400 ${21 * u}px/1.42 ${font};color:var(--m-text-secondary)`;
      const bar = doc.createElement('div');
      bar.style.cssText = `position:absolute;left:${24 * u}px;right:${24 * u}px;bottom:${16 * u}px;height:${2 * u}px;border-radius:9px;background:${hairline(10)};overflow:hidden`;
      const fill = doc.createElement('div');
      fill.style.cssText = 'height:100%;width:100%;background:var(--m-accent);transform-origin:0 50%';
      bar.appendChild(fill);
      open.append(head, body, bar);
      card.append(shut, open);
      world.appendChild(card);
      return { card, open, fill };
    });
    wrap.appendChild(world);
    el.appendChild(wrap);

    const ease = ctx.ease(p.ease as never), pop = ctx.ease('expo.out');
    const stack = num(p.stack) * u, popZ = num(p.pop) * u, slideAt = num(p.slide_at), slide = Math.max(0.01, num(p.slide));
    return {
      seek(t) {
        world.style.transform = cameraTransform(cameraAt(t, p, ease), P, w, H);
        // A sine ease: its top speed is 1.57× the average, so the middle tabs are not rushed.
        const s = sine((t - slideAt) / slide);
        const c = from === to ? from : lerp(from, to, s);
        const open = openness(n, c);
        const popped = from === to ? 0 : pop(clamp((t - slideAt - slide) / 0.7));
        let y = pad;
        tabs.forEach((tab, i) => {
          const a = open[i]!;
          const h = lerp(Hc, Ho, a);
          // Stairs: each tab a step nearer than the one before; the last open one pops.
          const z = stack * (i + 1) + (i === to ? popZ * popped : 0);
          tab.card.style.top = `${y.toFixed(2)}px`;
          tab.card.style.height = `${h.toFixed(2)}px`;
          tab.card.style.transform = `translateZ(${z.toFixed(2)}px)`;
          // Its shadow grows with its height above the step below.
          const sh = clamp((stack + (i === to ? popZ * popped : 0)) / (60 * u));
          tab.card.style.boxShadow = `0 0 0 1px ${hairline(8)},0 ${18 * u * sh}px ${40 * u * sh}px rgba(0,0,0,${(0.45 * sh).toFixed(3)})`;
          // Never a switch in one frame: the open look fades in over the first fifth of the opening.
          const mix = clamp(a / 0.2);
          tab.open.style.opacity = (mix * mix * (3 - 2 * mix)).toFixed(3);
          tab.open.style.visibility = a > 0 ? 'inherit' : 'hidden';
          tab.fill.style.transform = `scaleX(${a.toFixed(4)})`;
          y += h + gap;
        });
      },
    };
  },
};
