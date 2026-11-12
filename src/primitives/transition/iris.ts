// transition/iris. See library/primitives/transition/iris.md.
import { num, str, type TransitionPrimitive } from '../types.ts';

export const iris: TransitionPrimitive = {
  slug: 'transition/iris',
  summary: 'The next scene opens from a point in a growing circle.',
  duration: 0.8,
  params: {
    duration: { type: 'number', default: 0.8, min: 0.4, max: 1.4, step: 0.05, unit: 's', label: 'Length of the hand-over' },
    x: { type: 'number', default: 50, min: 0, max: 100, step: 1, unit: '% of width', label: 'Centre, across', pad: { name: 'centre', axis: 'x' } },
    y: { type: 'number', default: 50, min: 0, max: 100, step: 1, unit: '% of height', label: 'Centre, down', pad: { name: 'centre', axis: 'y' } },
    shape: { type: 'choice', default: 'circle', options: ['circle', 'rounded'], label: 'Opening shape' },
    push_in: { type: 'number', default: 0.06, min: 0, max: 0.2, step: 0.01, unit: 'ratio', label: 'How much the outgoing scene pushes in' },
  },
  apply(from, to, k, p, ctx) {
    const ease = ctx.ease('expressive.inOut');
    const [W, H] = ctx.size, cx = (num(p.x) / 100) * W, cy = (num(p.y) / 100) * H;
    const e = ease(k);
    // Large enough to reach the farthest corner from the centre.
    const reach = Math.max(Math.hypot(cx, cy), Math.hypot(W - cx, cy), Math.hypot(cx, H - cy), Math.hypot(W - cx, H - cy));
    const r = e * reach * 1.02;
    if (str(p.shape) === 'rounded') {
      const hw = r * 0.9, hh = r * 0.9;
      to.style.clipPath = `inset(${(cy - hh).toFixed(1)}px ${(W - cx - hw).toFixed(1)}px ${(H - cy - hh).toFixed(1)}px ${(cx - hw).toFixed(1)}px round ${(r * 0.25).toFixed(1)}px)`;
    } else to.style.clipPath = `circle(${r.toFixed(2)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px)`;
    to.style.transform = `scale(${(1.08 - 0.08 * e).toFixed(4)})`;
    to.style.transformOrigin = `${cx}px ${cy}px`;
    from.style.transform = `scale(${(1 + num(p.push_in) * e).toFixed(4)})`;
    from.style.transformOrigin = `${cx}px ${cy}px`;
  },
  clear(el) {
    el.style.clipPath = '';
    el.style.transform = '';
    el.style.transformOrigin = '';
  },
};
