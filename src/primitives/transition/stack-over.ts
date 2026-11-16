// transition/stack-over. See library/primitives/transition/stack-over.md.
import { num, str, type TransitionPrimitive } from '../types.ts';

const DIRS: Record<string, [number, number]> = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] };

export const stackOver: TransitionPrimitive = {
  slug: 'transition/stack-over',
  summary: 'The next scene slides over the current one, which recedes and dims beneath it.',
  duration: 0.7,
  calm: { recede: 0.97, dim: 0.4 },
  params: {
    duration: { type: 'number', default: 0.7, min: 0.4, max: 1.2, step: 0.05, unit: 's', label: 'Length of the hand-over' },
    direction: { type: 'choice', default: 'up', options: ['up', 'down', 'left', 'right'], label: 'Which way the new scene travels' },
    recede: { type: 'number', default: 0.94, min: 0.88, max: 0.98, step: 0.01, unit: 'x', label: 'Scale the old scene shrinks to' },
    dim: { type: 'number', default: 0.7, min: 0.2, max: 0.8, step: 0.05, unit: 'ratio', label: 'Brightness the old scene dims to' },
    radius: { type: 'number', default: 2, min: 0, max: 6, step: 0.5, unit: '% of width', label: 'Corner radius while moving' },
  },
  apply(from, to, k, p, ctx) {
    const ease = ctx.ease([0.4, 0, 0.1, 1]);
    const e = ease(k), [W, H] = ctx.size, [dx, dy] = DIRS[str(p.direction)] ?? DIRS.up!;
    // Corners stay round while the card travels and square off only as it lands.
    const R = (num(p.radius) / 100) * W, land = Math.min(1, Math.max(0, (k - 0.75) / 0.25));
    const r = R * (1 - land * land * (3 - 2 * land));
    to.style.transform = `translate(${(dx * (1 - e) * W).toFixed(2)}px, ${(dy * (1 - e) * H).toFixed(2)}px)`;
    // Radius by border-radius, not clip-path, so the card's shadow is not clipped away.
    to.style.borderRadius = r > 0.5 ? `${r.toFixed(1)}px` : '';
    const shade = 0.3 * Math.min(1, (1 - e) * 4);
    to.style.boxShadow = shade > 0.002 ? `${(-dx * 24).toFixed(0)}px ${(-dy * 24).toFixed(0)}px 90px rgba(0,0,0,${shade.toFixed(3)})` : '';
    from.style.transform = `scale(${(1 - (1 - num(p.recede)) * e).toFixed(4)})`;
    from.style.filter = `brightness(${(1 - (1 - num(p.dim)) * e).toFixed(3)}) blur(${(e * 2).toFixed(2)}px)`;
    from.style.clipPath = `inset(0 round ${((num(p.radius) / 100) * W * e).toFixed(1)}px)`;
  },
  clear(el) {
    el.style.transform = '';
    el.style.clipPath = '';
    el.style.boxShadow = '';
    el.style.filter = '';
    el.style.borderRadius = '';
  },
};
