// transition/curtain. See library/primitives/transition/curtain.md.
import { clamp } from '../../core/ease.ts';
import { num, str, type TransitionPrimitive } from '../types.ts';
import { clearOverlays, fillOf, overlay } from './overlay.ts';

const KEY = 'curtain';

export const curtain: TransitionPrimitive = {
  slug: 'transition/curtain',
  summary: 'Two panels part or close.',
  duration: 0.8,
  params: {
    duration: { type: 'number', default: 0.8, min: 0.5, max: 1.4, step: 0.05, unit: 's', label: 'Length of the hand-over' },
    axis: { type: 'choice', default: 'vertical', options: ['vertical', 'horizontal'], label: 'Panels meet along a vertical or a horizontal line' },
    fill: { type: 'choice', default: 'inverse', options: ['inverse', 'accent', 'surface', 'base'], label: 'Panel colour' },
  },
  apply(from, to, k, p, ctx) {
    const [a, b] = overlay(from, KEY, 2);
    if (!a || !b) return;
    const ease = ctx.ease('quint.inOut');
    // Close over the outgoing scene, cut while closed, then part on the incoming one.
    const close = ease(clamp(k / 0.46)), open = ease(clamp((k - 0.54) / 0.46));
    const half = (close - open) * 50;
    const vertical = str(p.axis) !== 'horizontal';
    for (const el of [a, b]) el.style.background = fillOf(str(p.fill, 'inverse'));
    a.style.clipPath = vertical ? `inset(0 ${100 - half}% 0 0)` : `inset(0 0 ${100 - half}% 0)`;
    b.style.clipPath = vertical ? `inset(0 0 0 ${100 - half}%)` : `inset(${100 - half}% 0 0 0)`;
    const shut = k >= 0.5;
    from.style.opacity = shut ? '0' : '1';
    to.style.opacity = shut ? '1' : '0';
    // The incoming scene settles from a touch closer as the panels part.
    to.style.transform = shut ? `scale(${(1.05 - 0.05 * open).toFixed(4)})` : '';
    void num;
  },
  clear(el) {
    clearOverlays(el, KEY);
    el.style.opacity = '';
    el.style.transform = '';
  },
};
