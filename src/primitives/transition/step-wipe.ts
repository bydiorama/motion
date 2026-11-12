// transition/step-wipe. See library/primitives/transition/step-wipe.md.
import { clamp } from '../../core/ease.ts';
import { num, type TransitionPrimitive } from '../types.ts';

export const stepWipe: TransitionPrimitive = {
  slug: 'transition/step-wipe',
  summary: 'Stepped bars sweep across the frame.',
  duration: 0.5,
  params: {
    duration: { type: 'number', default: 0.5, min: 0.4, max: 0.7, step: 0.05, unit: 's', label: 'Length of the hand-over' },
    steps: { type: 'number', default: 6, min: 4, max: 10, step: 1, unit: 'bars', label: 'Number of bars' },
  },
  apply(_from, to, k, p, ctx) {
    const ease = ctx.ease(ctx.tokens.ease_move);
    const steps = Math.max(1, Math.round(num(p.steps)));
    const [w, h] = ctx.size;
    const lag = 0.5 / steps; // each bar starts a little after the one above it
    const bars: string[] = [];
    for (let i = 0; i < steps; i++) {
      const x = ease(clamp((k - i * lag) / (1 - (steps - 1) * lag))) * w;
      // +1 px of overlap closes the hairline between neighbouring bars.
      const y0 = (i * h) / steps, y1 = ((i + 1) * h) / steps + (i < steps - 1 ? 1 : 0);
      bars.push(`M0 ${y0}H${x}V${y1}H0Z`);
    }
    to.style.clipPath = `path('${bars.join('')}')`;
  },
  clear(el) {
    el.style.clipPath = '';
  },
};
