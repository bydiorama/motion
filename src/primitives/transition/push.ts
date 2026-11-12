// transition/push. See library/primitives/transition/push.md.
import { num, str, type TransitionPrimitive } from '../types.ts';

const DIRS: Record<string, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

export const push: TransitionPrimitive = {
  slug: 'transition/push',
  summary: 'The next scene pushes the current one out of frame, with parallax and motion blur.',
  duration: 0.7,
  params: {
    duration: { type: 'number', default: 0.7, min: 0.3, max: 1.2, step: 0.05, unit: 's', label: 'Length of the hand-over' },
    direction: { type: 'choice', default: 'left', options: ['left', 'right', 'up', 'down'], label: 'Which way the frame travels' },
    parallax: { type: 'number', default: 0.35, min: 0, max: 1, step: 0.05, unit: 'ratio', label: 'How much less the outgoing scene travels' },
    blur: { type: 'number', default: 0.5, min: 0, max: 1, step: 0.05, unit: 'ratio', label: 'Motion blur at full speed (1 = a half-frame shutter)' },
  },
  apply(from, to, k, p, ctx) {
    const ease = ctx.ease('quint.inOut');
    const [W, H] = ctx.size, [dx, dy] = DIRS[str(p.direction)] ?? DIRS.left!;
    const e = ease(k), span = dx ? W : H;
    // Speed in px per frame from the curve's slope; blur follows it along the motion only.
    const fps = ctx.tokens.fps || 30, dt = 1 / 120;
    const speed = ((ease(Math.min(1, k + dt)) - ease(Math.max(0, k - dt))) / (2 * dt)) * span / (num(p.duration) * fps);
    const blur = Math.min(40, speed * 0.5 * num(p.blur));
    const outTravel = 1 - num(p.parallax);
    to.style.transform = `translate(${(-dx * (1 - e) * W).toFixed(2)}px, ${(-dy * (1 - e) * H).toFixed(2)}px)`;
    from.style.transform = `translate(${(dx * e * W * outTravel).toFixed(2)}px, ${(dy * e * H * outTravel).toFixed(2)}px)`;
    from.style.filter = `brightness(${(1 - 0.35 * e).toFixed(3)})${blur > 0.5 ? ` blur(${(blur * 0.25).toFixed(2)}px)` : ''}`;
    to.style.filter = blur > 0.5 ? `blur(${(blur * 0.25).toFixed(2)}px)` : '';
  },
  clear(el) {
    el.style.transform = '';
    el.style.filter = '';
  },
};
