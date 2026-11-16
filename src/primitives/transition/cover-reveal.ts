// transition/cover-reveal. See library/primitives/transition/cover-reveal.md.
import { clamp } from '../../core/ease.ts';
import { list, num, str, type TransitionPrimitive } from '../types.ts';
import { clearOverlays, fillOf, overlay } from './overlay.ts';

const KEY = 'cover';

export const coverReveal: TransitionPrimitive = {
  slug: 'transition/cover-reveal',
  summary: 'Colour panels sweep across and cover the cut, then sweep on to uncover the next scene.',
  duration: 1,
  calm: { lag: 0.06 },
  params: {
    duration: { type: 'number', default: 1, min: 0.6, max: 1.6, step: 0.05, unit: 's', label: 'Length of the hand-over' },
    direction: { type: 'choice', default: 'up', options: ['up', 'down', 'left', 'right'], label: 'Which way the panels travel' },
    panels: { type: 'number', default: 2, min: 1, max: 3, step: 1, unit: 'panels', label: 'Panels, one behind the other' },
    lag: { type: 'number', default: 0.12, min: 0, max: 0.3, step: 0.01, unit: 'ratio', label: 'How far each panel trails the one before' },
  },
  apply(from, to, k, p, ctx) {
    const n = Math.max(1, Math.round(num(p.panels))), lag = num(p.lag);
    const colours = ['accent', 'inverse', 'surface'];
    const panels = overlay(from, KEY, n);
    const ease = ctx.ease('quart.inOut');
    const dir = str(p.direction);
    // Each panel covers in the first half of its window and uncovers in the second.
    // The cut happens under the last panel, when it covers the whole frame.
    const win = 1 - lag * (n - 1);
    panels.forEach((el, i) => {
      el.style.background = fillOf(list([colours[(n - 1 - i) % colours.length]])[0]!);
      const local = clamp((k - i * lag) / win);
      const cover = ease(clamp(local * 2)), uncover = ease(clamp(local * 2 - 1));
      // Two edges: the leading one comes in, the trailing one follows it out.
      const lead = cover * 100, trail = uncover * 100;
      const inset = dir === 'up' ? `${100 - lead}% 0 ${trail}% 0`
        : dir === 'down' ? `${trail}% 0 ${100 - lead}% 0`
          : dir === 'left' ? `0 ${trail}% 0 ${100 - lead}%`
            : `0 ${100 - lead}% 0 ${trail}%`;
      el.style.clipPath = `inset(${inset})`;
      el.style.visibility = local <= 0 || local >= 1 ? 'hidden' : 'visible';
    });
    // The incoming scene is hidden until the last panel covers the frame.
    const lastMid = (n - 1) * lag + win / 2;
    to.style.opacity = k >= lastMid ? '1' : '0';
    from.style.opacity = k >= lastMid ? '0' : '1';
    // A slight push-in on the outgoing scene, settling on the incoming one.
    const settle = ease(clamp((k - lastMid) / (1 - lastMid)));
    to.style.transform = k >= lastMid ? `scale(${(1.04 - 0.04 * settle).toFixed(4)})` : '';
  },
  clear(el) {
    clearOverlays(el, KEY);
    el.style.transform = '';
    el.style.opacity = '';
  },
};
