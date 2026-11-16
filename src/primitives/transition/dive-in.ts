// transition/dive-in. See library/primitives/transition/dive-in.md.
import { clamp } from '../../core/ease.ts';
import { num, str, type TransitionPrimitive } from '../types.ts';

export const diveIn: TransitionPrimitive = {
  slug: 'transition/dive-in',
  summary: 'The camera pushes into a point until it fills the frame.',
  duration: 0.5,
  params: {
    duration: { type: 'number', default: 0.5, min: 0.4, max: 1.2, step: 0.05, unit: 's', label: 'Length of the hand-over' },
    scale_to: { type: 'number', default: 8, min: 3, max: 12, step: 0.5, unit: 'x', label: 'How far the camera pushes in' },
    x: { type: 'number', default: 50, min: 0, max: 100, step: 1, unit: '% of width', label: 'Point to dive into, across', pad: { name: 'point', axis: 'x' } },
    y: { type: 'number', default: 50, min: 0, max: 100, step: 1, unit: '% of height', label: 'Point to dive into, down', pad: { name: 'point', axis: 'y' } },
    pace: { type: 'choice', default: 'accelerate', options: ['accelerate', 'glide'], label: 'accelerate hits the cut at speed; glide eases in and out and arrives at rest' },
  },
  apply(from, to, k, p, ctx) {
    const [W, H] = ctx.size, cx = (num(p.x) / 100) * W, cy = (num(p.y) / 100) * H;
    from.style.transformOrigin = `${cx}px ${cy}px`;
    to.style.transformOrigin = `${cx}px ${cy}px`;
    if (str(p.pace) === 'glide') {
      // One eased push that arrives at rest: the zoom is geometric, so its speed
      // on screen is even; blur only while it moves, none at either end; the next
      // scene is already at its own size when it shows, so it does not land.
      const e = ctx.ease('sine.inOut')(k);
      const zoom = Math.pow(num(p.scale_to), e);
      const blur = 7 * Math.sin(Math.PI * k);
      from.style.transform = `scale(${zoom.toFixed(4)})`;
      from.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '';
      from.style.opacity = String(1 - ctx.ease('smooth')(clamp((k - 0.55) / 0.35)));
      to.style.transform = `scale(${(1.12 - 0.12 * ctx.ease('expo.out')(clamp((k - 0.5) / 0.5))).toFixed(4)})`;
      to.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '';
      to.style.opacity = String(ctx.ease('smooth')(clamp((k - 0.5) / 0.35)));
      return;
    }
    const accel = ctx.ease('expo.in'), land = ctx.ease('expo.out');
    // The push accelerates into the cut at the middle; the next scene lands out of a slight over-zoom.
    const a = accel(clamp(k / 0.55)), b = land(clamp((k - 0.45) / 0.55));
    const zoom = 1 + (num(p.scale_to) - 1) * a;
    from.style.transform = `scale(${zoom.toFixed(4)})`;
    from.style.filter = a > 0.02 ? `blur(${(a * 14).toFixed(2)}px)` : '';
    from.style.opacity = String(1 - clamp((k - 0.4) / 0.15));
    to.style.transform = `scale(${(1.35 - 0.35 * b).toFixed(4)})`;
    to.style.filter = b < 0.98 ? `blur(${((1 - b) * 12).toFixed(2)}px)` : '';
    to.style.opacity = String(clamp((k - 0.45) / 0.12));
  },
  clear(el) {
    el.style.transform = '';
    el.style.transformOrigin = '';
    el.style.filter = '';
    el.style.opacity = '';
  },
};
