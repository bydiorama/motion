// texture/gradient-drift. See library/primitives/texture/gradient-drift.md.
import { rng } from '../../core/ease.ts';
import { list, num, type Primitive } from '../types.ts';

const DEFAULTS = [
  'var(--m-bg-accent)',
  'color-mix(in oklab, var(--m-bg-accent) 55%, var(--m-bg-base))',
  'color-mix(in oklab, var(--m-bg-accent) 60%, #FFFFFF)',
  'color-mix(in oklab, var(--m-bg-accent) 70%, #000000)',
];

export const gradientDrift: Primitive = {
  slug: 'texture/gradient-drift',
  summary: 'Soft fields of colour drift and blend behind the content, looping without a seam.',
  props: { colors: { type: 'string[]', default: [], label: 'CSS colours of the fields. Left out, shades of the accent' } },
  params: {
    period: { type: 'number', default: 12, min: 6, max: 24, step: 0.5, unit: 's', label: 'Time for one full loop' },
    fields: { type: 'number', default: 4, min: 2, max: 6, step: 1, unit: 'fields', label: 'Colour fields' },
    softness: { type: 'number', default: 14, min: 6, max: 24, step: 0.5, unit: '% of stage width', label: 'Blur' },
    reach: { type: 'number', default: 0.18, min: 0.05, max: 0.35, step: 0.01, unit: 'ratio', label: 'How far the fields wander' },
    strength: { type: 'number', default: 0.85, min: 0.2, max: 1, step: 0.05, unit: 'ratio', label: 'Opacity' },
  },
  // Ambient. A scene one period long loops without a seam.
  duration: () => 0,
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const [W, H] = ctx.size;
    const colours = list(props.colors).length ? list(props.colors) : DEFAULTS;
    const n = Math.max(1, Math.round(num(p.fields))), period = Math.max(1, num(p.period)), reach = num(p.reach);
    const r = rng(ctx.seed * 389 + 3);
    el.style.cssText += ';position:absolute;inset:0;max-width:none;pointer-events:none;overflow:hidden';
    const field = doc.createElement('div');
    // One blur over the whole field is cheaper and smoother than a blur per blob.
    field.style.cssText = `position:absolute;inset:-10%;filter:blur(${(num(p.softness) / 100) * W}px) saturate(1.15);opacity:${num(p.strength)}`;
    el.appendChild(field);
    const blobs = Array.from({ length: n }, (_, i) => {
      const b = doc.createElement('div');
      const size = (0.45 + r() * 0.35) * W;
      b.style.cssText = `position:absolute;left:0;top:0;width:${size}px;height:${size * (0.7 + r() * 0.4)}px;border-radius:50%;background:${colours[i % colours.length]}`;
      field.appendChild(b);
      // Each field circles its home on a whole number of turns per loop, so the loop closes.
      return {
        b, size, hx: (0.15 + r() * 0.9) * W, hy: (0.1 + r() * 0.95) * H,
        fx: 1 + Math.floor(r() * 2), fy: 1 + Math.floor(r() * 2), ph: r() * Math.PI * 2, rot: (r() - 0.5) * 2,
      };
    });
    return {
      seek(t) {
        const a = (t / period) * Math.PI * 2;
        for (const o of blobs) {
          const x = o.hx + Math.cos(a * o.fx + o.ph) * reach * W - o.size / 2;
          const y = o.hy + Math.sin(a * o.fy + o.ph * 1.3) * reach * H - o.size / 2;
          o.b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(Math.sin(a + o.ph) * 30 * o.rot).toFixed(2)}deg)`;
        }
      },
    };
  },
};
