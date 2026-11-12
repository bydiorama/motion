// fx/grid-ripple. See library/primitives/fx/grid-ripple.md.
import { progress } from '../../core/ease.ts';
import { STAGGER_FROM, staggerDelays, staggerSpan } from '../../core/stagger.ts';
import { num, str, type Primitive } from '../types.ts';

const grid = (p: Record<string, unknown>, size: [number, number]): [number, number] => {
  const cols = Math.max(2, Math.round(num(p.cols)));
  return [cols, Math.max(2, Math.round((cols * size[1]) / size[0]))];
};

export const gridRipple: Primitive = {
  slug: 'fx/grid-ripple',
  summary: 'A field of dots or tiles appears in a wave from one point, then keeps breathing.',
  props: { cell: { type: 'string', default: 'dot', label: 'dot, square or plus' } },
  params: {
    cols: { type: 'number', default: 24, min: 8, max: 48, step: 1, unit: 'columns', label: 'Columns (rows follow the frame)' },
    stagger: { type: 'number', default: 0.05, min: 0.02, max: 0.1, step: 0.005, unit: 's', label: 'Delay per cell of distance' },
    from: { type: 'choice', default: 'center', options: STAGGER_FROM, label: 'Where the wave starts' },
    size: { type: 'number', default: 0.22, min: 0.05, max: 0.9, step: 0.01, unit: 'ratio of cell', label: 'Mark size' },
    pulse: { type: 'number', default: 0.35, min: 0, max: 1, step: 0.05, unit: 'ratio', label: 'How much the field keeps breathing afterwards' },
    opacity: { type: 'number', default: 0.5, min: 0.1, max: 1, step: 0.05, unit: 'ratio', label: 'Opacity' },
  },
  duration: (_props, p, ctx) => staggerSpan(grid(p, ctx.size)[0] * grid(p, ctx.size)[1], str(p.from), ctx.seed, grid(p, ctx.size)) * num(p.stagger) + 0.6,
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const [W, H] = ctx.size, [cols, rows] = grid(p, ctx.size);
    const cw = W / cols, chh = H / rows, n = cols * rows;
    const kind = str(props.cell, 'dot'), mark = num(p.size) * Math.min(cw, chh);
    const delays = staggerDelays(n, num(p.stagger), str(p.from), ctx.seed, [cols, rows]);
    const span = Math.max(...delays, 0.001);
    // Drawn on a child: the layer's own opacity belongs to its enter, exit and tracks.
    el.style.cssText += ';position:absolute;inset:0;max-width:none;pointer-events:none';
    const field = doc.createElement('div');
    field.style.cssText = `position:absolute;inset:0;opacity:${num(p.opacity)}`;
    el.appendChild(field);
    const cells = Array.from({ length: n }, (_, i) => {
      const c = doc.createElement('div');
      const x = (i % cols) * cw + cw / 2, y = Math.floor(i / cols) * chh + chh / 2;
      const shape = kind === 'square' ? `border-radius:${mark * 0.12}px;background:currentColor`
        : kind === 'plus' ? `background:linear-gradient(currentColor,currentColor) center/100% 18% no-repeat,linear-gradient(currentColor,currentColor) center/18% 100% no-repeat`
          : 'border-radius:50%;background:currentColor';
      c.style.cssText = `position:absolute;left:${x - mark / 2}px;top:${y - mark / 2}px;width:${mark}px;height:${mark}px;${shape}`;
      field.appendChild(c);
      return c;
    });
    const pop = ctx.ease({ spring: { duration: 0.45, bounce: 0.25 } });
    const pulse = num(p.pulse), period = Math.max(1.2, span * 1.6);
    return {
      seek(t) {
        cells.forEach((c, i) => {
          const k = progress(t, delays[i]!, 0.6, pop);
          // After it lands, the same wave keeps travelling outward as a slow swell.
          const swell = t > delays[i]! + 0.6 ? Math.sin(((t - delays[i]!) / period) * Math.PI * 2) * 0.5 * pulse : 0;
          const s = Math.max(0, k * (1 + swell * 0.6));
          c.style.transform = `scale(${s.toFixed(4)})`;
          c.style.opacity = Math.min(1, Math.max(0, (t - delays[i]!) / 0.2) * (1 - pulse * 0.3 + swell * 0.6)).toFixed(3);
        });
      },
    };
  },
};
