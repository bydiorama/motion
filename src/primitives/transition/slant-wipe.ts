// transition/slant-wipe. See library/primitives/transition/slant-wipe.md.
import { num, str, type TransitionPrimitive } from '../types.ts';

export const slantWipe: TransitionPrimitive = {
  slug: 'transition/slant-wipe',
  summary: 'A slanted edge cuts across the frame, uncovering the next scene; the old one drifts back.',
  duration: 0.6,
  params: {
    duration: { type: 'number', default: 0.6, min: 0.4, max: 0.9, step: 0.05, unit: 's', label: 'Length of the hand-over' },
    slant: { type: 'number', default: 20, min: 0, max: 40, step: 1, unit: '% of width', label: 'Slant of the edge' },
    direction: { type: 'choice', default: 'left', options: ['left', 'right'], label: 'Which way the edge travels' },
    drift: { type: 'number', default: 8, min: 0, max: 15, step: 1, unit: '% of width', label: 'How far the old scene drifts' },
  },
  apply(from, to, k, p, ctx) {
    const ease = ctx.ease([0.77, 0, 0.175, 1]);
    const e = ease(k), s = num(p.slant), left = str(p.direction) !== 'right';
    // The edge starts past one side and ends past the other, so no corner lingers.
    const travel = 100 + s;
    const top = left ? 100 - e * travel : e * travel - s, bottom = top + s;
    to.style.clipPath = left
      ? `polygon(${top}% 0, 100% 0, 100% 100%, ${bottom}% 100%)`
      : `polygon(0 0, ${top + s}% 0, ${bottom - s}% 100%, 0 100%)`;
    from.style.transform = `translateX(${((left ? -1 : 1) * num(p.drift) * e).toFixed(3)}%)`;
    void ctx;
  },
  clear(el) {
    el.style.clipPath = '';
    el.style.transform = '';
  },
};
