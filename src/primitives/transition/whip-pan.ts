// transition/whip-pan. See library/primitives/transition/whip-pan.md.
//
// A camera whip: the frame gathers for an instant, then tears away with a smear
// along the pan only, and brakes hard on the next scene. Peak speed is at the
// seam between the two, so the seam is never seen.
import { clamp } from '../../core/ease.ts';
import { directionalBlur, streak } from '../blur.ts';
import { num, str, type TransitionPrimitive } from '../types.ts';

const DIRS: Record<string, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

export const whipPan: TransitionPrimitive = {
  slug: 'transition/whip-pan',
  summary: 'The camera whips to the next scene with a streak along the pan only, then brakes.',
  duration: 0.5,
  params: {
    duration: { type: 'number', default: 0.5, min: 0.3, max: 0.9, step: 0.05, unit: 's', label: 'Length of the hand-over' },
    direction: { type: 'choice', default: 'left', options: ['left', 'right', 'up', 'down'], label: 'Which way the frame travels' },
    anticipation: { type: 'number', default: 0.03, min: 0, max: 0.08, step: 0.005, unit: 'of the frame', label: 'How far it pulls back before it goes' },
    shutter: { type: 'number', default: 0.5, min: 0, max: 1, step: 0.05, unit: 'ratio', label: 'Motion blur: share of a frame the whip smears over' },
  },
  apply(from, to, k, p, ctx) {
    const [W, H] = ctx.size, [dx, dy] = DIRS[str(p.direction)] ?? DIRS.left!;
    const span = dx ? W : H;
    const back = num(p.anticipation) * span;
    // One camera: the two scenes lie side by side and the frame pans from one to
    // the other, so there is never a gap between them. It gathers first (a sine
    // bump against the pan), then whips on a sharp in-out: nearly all the travel
    // happens in the middle third, at a speed the eye cannot follow.
    const whip = ctx.ease('expo.inOut');
    const camAt = (q: number) => (q < 0.3 ? -back * Math.sin(Math.PI * clamp(q / 0.3)) : 0) + span * whip(clamp((q - 0.12) / 0.88));
    // Speed in px per frame, from the positions half a frame either side.
    const h = 0.5 / (ctx.fps || 30) / num(p.duration);
    const v = camAt(clamp(k + h)) - camAt(clamp(k - h));
    const c = camAt(k);
    from.style.transform = `translate(${(dx * c).toFixed(2)}px, ${(dy * c).toFixed(2)}px)`;
    to.style.transform = `translate(${(dx * (c - span)).toFixed(2)}px, ${(dy * (c - span)).toFixed(2)}px)`;
    const sOut = streak(v, num(p.shutter)), sIn = sOut;
    from.style.filter = directionalBlur(from, dx ? sOut : 0, dy ? sOut : 0, 90);
    to.style.filter = directionalBlur(to, dx ? sIn : 0, dy ? sIn : 0, 90);
  },
  clear(el) {
    el.style.transform = '';
    el.style.filter = '';
  },
};
