// transition/blur-dissolve. See library/primitives/transition/blur-dissolve.md.
import { clamp } from '../../core/ease.ts';
import { num, type TransitionPrimitive } from '../types.ts';

export const blurDissolve: TransitionPrimitive = {
  slug: 'transition/blur-dissolve',
  summary: 'One scene blurs out while the next blurs in.',
  duration: 0.4,
  params: {
    duration: { type: 'number', default: 0.4, min: 0.3, max: 0.6, step: 0.05, unit: 's', label: 'Length of the hand-over' },
    blur: { type: 'number', default: 20, min: 12, max: 30, step: 1, unit: 'px', label: 'Blur at the midpoint' },
    overlap: { type: 'number', default: 0.5, min: 0.3, max: 0.7, step: 0.05, unit: 'ratio', label: 'Share of the time both scenes are visible' },
  },
  apply(from, to, k, p, ctx) {
    const ease = ctx.ease(ctx.tokens.ease_move);
    const span = 0.5 + num(p.overlap) / 2; // each scene's fade takes this share of the hand-over
    const out = ease(clamp(k / span)), inn = ease(clamp((k - (1 - span)) / span));
    const blur = num(p.blur);
    from.style.opacity = String(1 - out);
    from.style.filter = out > 0 ? `blur(${out * blur}px)` : '';
    to.style.opacity = String(inn);
    to.style.filter = inn < 1 ? `blur(${(1 - inn) * blur}px)` : '';
  },
  clear(el) {
    el.style.opacity = '';
    el.style.filter = '';
  },
};
