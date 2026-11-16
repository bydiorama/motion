// fx/pin-drop. See library/primitives/fx/pin-drop.md.
//
// Places light up one after another: a marker lands on each with a little
// overshoot over a soft glow, a ripple spreads from it, then a stem grows out of
// the marker and carries its label up into a card. All ripples share one phase,
// so they are the same size at every instant and pulse together, however many
// there are; markers are drawn at one size, never scaled by where they sit.
import { clamp, lerp } from '../../core/ease.ts';
import { list, nums, num, type Primitive } from '../types.ts';

const backOut = (p: number) => 1 + 2.4 * (p - 1) ** 3 + 1.4 * (p - 1) ** 2;
const count = (props: Record<string, unknown>) => Math.floor(nums(props.points).length / 2);

export const pinDrop: Primitive = {
  slug: 'fx/pin-drop',
  summary: 'Markers land on places one by one, ripple together, and raise their labels on stems.',
  props: {
    points: { type: 'number[]', required: true, label: 'Places as x, y pairs in % of the stage: [x1, y1, x2, y2, …]' },
    labels: { type: 'string[]', default: [], label: 'A short label for each place, in the same order. Left out, no card' },
  },
  params: {
    stagger: { type: 'number', default: 0.28, min: 0.1, max: 0.6, step: 0.01, unit: 's', label: 'Delay between places' },
    stem: { type: 'number', default: 120, min: 0, max: 260, step: 5, unit: 'px', label: 'How high each card stands over its marker' },
    size: { type: 'number', default: 16, min: 8, max: 32, step: 1, unit: 'px', label: 'Marker size' },
    ripple: { type: 'number', default: 1.3, min: 0.8, max: 2.4, step: 0.05, unit: 's', label: 'Time between ripples' },
    glow: { type: 'number', default: 1, min: 0, max: 2, step: 0.05, unit: 'ratio', label: 'Strength of the glow under each marker' },
  },
  duration: (props, p) => Math.max(0, count(props) - 1) * num(p.stagger) + 0.95,
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const [W, H] = ctx.size, u = W / 1080;
    el.style.cssText += ';position:absolute;inset:0;max-width:none;pointer-events:none';
    const pts = nums(props.points), labels = list(props.labels);
    const size = num(p.size) * u, glow = num(p.glow), stemH = num(p.stem) * u;
    const add = (parent: HTMLElement, css: string) => { const d = doc.createElement('div'); d.style.cssText = css; parent.appendChild(d); return d; };
    const marks = Array.from({ length: count(props) }, (_, i) => {
      const x = (pts[i * 2]! / 100) * W, y = (pts[i * 2 + 1]! / 100) * H;
      const at = `position:absolute;left:${x}px;top:${y}px;`;
      const halo = add(el, `${at}width:${size * 6}px;height:${size * 6}px;translate:-50% -50%;border-radius:50%;`
        + `background:radial-gradient(closest-side,color-mix(in srgb,var(--m-accent) ${Math.round(42 * Math.min(1, glow))}%,transparent),color-mix(in srgb,var(--m-accent) ${Math.round(12 * glow)}%,transparent) 45%,transparent)`);
      const ring = add(el, `${at}width:${size * 2.5}px;height:${size * 2.5}px;translate:-50% -50%;border-radius:50%;border:${1.5 * u}px solid var(--m-accent);`
        + `box-shadow:0 0 ${12 * u}px color-mix(in srgb,var(--m-accent) 45%,transparent)`);
      const stem = add(el, `${at}width:${1.5 * u}px;translate:-50% 0;transform-origin:50% 100%;background:linear-gradient(color-mix(in srgb,var(--m-accent) 95%,transparent),color-mix(in srgb,var(--m-accent) 25%,transparent))`);
      // The marker: an accent dot ringed in the ground colour, so it reads on any map.
      const dot = add(el, `${at}width:${size}px;height:${size}px;translate:-50% -50%;border-radius:50%;background:var(--m-accent);`
        + `box-shadow:0 0 0 ${3 * u}px var(--m-bg-base),0 0 ${6 * u}px ${2 * u}px rgba(0,0,0,.5)`);
      const text = labels[i] ?? '';
      const card = text ? add(el, `${at}translate:-50% -100%;transform-origin:50% 100%;display:flex;align-items:center;gap:${10 * u}px;white-space:nowrap;`
        + `padding:${12 * u}px ${16 * u}px;border-radius:${10 * u}px;background:color-mix(in srgb,var(--m-bg-surface) 82%,transparent);`
        + `box-shadow:0 0 0 1px color-mix(in srgb,var(--m-text-primary) 9%,transparent),0 ${30 * u}px ${60 * u}px rgba(0,0,0,.45);`
        + `font:var(--ui-weight-medium,500) calc(var(--m-u)*1.6)/1.25 var(--m-font-body);color:var(--m-text-primary)`) : undefined;
      if (card) {
        add(card, `flex:none;width:${size * 0.7}px;height:${size * 0.7}px;border-radius:50%;background:var(--m-accent)`);
        const label = doc.createElement('span');
        label.textContent = text;
        card.appendChild(label);
      }
      return { y, halo, ring, stem, dot, card };
    });
    const stagger = num(p.stagger), period = num(p.ripple), expo = ctx.ease('expo.out'), smooth = ctx.ease('smooth');
    return {
      seek(t) {
        // One phase for every ripple.
        const phase = (Math.max(0, t) / period) % 1;
        marks.forEach((m, i) => {
          const t0 = i * stagger;
          const land = clamp((t - t0) / 0.42);
          const on = clamp((t - t0) / 0.14);
          const grow = expo(clamp((t - t0 - 0.14) / 0.81));
          m.dot.style.opacity = on.toFixed(3);
          m.dot.style.scale = String(Math.max(0, land < 1 ? backOut(land) : 1).toFixed(4));
          m.halo.style.opacity = on.toFixed(3);
          m.halo.style.scale = lerp(0.5, 1, expo(land)).toFixed(4);
          m.ring.style.opacity = ((1 - phase) ** 1.4 * clamp((t - t0 - 0.1) / 0.3)).toFixed(3);
          m.ring.style.scale = (0.3 + phase * 1.25).toFixed(4);
          if (!m.card) { m.stem.style.height = '0px'; return; }
          // The stem grows from just above the marker to the card's lower edge.
          const lift = stemH * lerp(0.3, 1, grow), gapBelow = size * 0.5 + 5 * u;
          const len = Math.max(0, lift - gapBelow);
          m.stem.style.top = `${m.y - lift}px`;
          m.stem.style.height = `${len}px`;
          const a = smooth(clamp((t - t0 - 0.2) / 0.35));
          m.stem.style.opacity = a.toFixed(3);
          m.card.style.top = `${m.y - lift}px`;
          m.card.style.scale = lerp(0.84, 1, grow).toFixed(4);
          m.card.style.opacity = a.toFixed(3);
        });
      },
    };
  },
};
