// transition/camera-travel. See library/primitives/transition/camera-travel.md.
//
// Both scenes are sheets in one world, the next one beside the current one
// (below it, by default). Only the camera moves: it pulls back, tilts and
// travels from one sheet to the other, then settles square on the new one.
// Two layers animated separately read as two unrelated moves; one camera reads
// as one place.
import { clamp } from '../../core/ease.ts';
import { directionalBlur, streak } from '../blur.ts';
import { num, str, type Ctx, type TransitionPrimitive } from '../types.ts';

const DIRS: Record<string, [number, number]> = { down: [0, 1], up: [0, -1], right: [1, 0], left: [-1, 0] };

interface Cam { travel: number; scale: number; tilt: number; edge: number }

/** The camera at progress k: how far it has travelled (0–1), how far back it stands, how far it leans. */
function camera(k: number, p: Record<string, unknown>, ctx: Ctx): Cam {
  const travel = ctx.ease('smooth')(k);
  // A bump that leaves and arrives with zero speed: sin² of the progress.
  const bump = Math.sin(Math.PI * clamp(k)) ** 2;
  return { travel, scale: 1 - num(p.pull) * bump, tilt: num(p.tilt) * bump, edge: bump };
}

export const cameraTravel: TransitionPrimitive = {
  slug: 'transition/camera-travel',
  summary: 'The camera pulls back and travels to the next scene, laid beside this one in one world.',
  duration: 1.4,
  calm: { pull: 0.04, tilt: 5, gap: 0, shutter: 0.3 },
  params: {
    duration: { type: 'number', default: 1.4, min: 0.8, max: 2.4, step: 0.05, unit: 's', label: 'Length of the hand-over' },
    direction: { type: 'choice', default: 'down', options: ['down', 'up', 'right', 'left'], label: 'Where the next scene lies' },
    pull: { type: 'number', default: 0.32, min: 0, max: 0.6, step: 0.01, unit: 'ratio', label: 'How far the camera pulls back on the way' },
    tilt: { type: 'number', default: 14, min: 0, max: 30, step: 1, unit: 'deg', label: 'How far the world leans while it travels' },
    gap: { type: 'number', default: 0.18, min: 0, max: 0.6, step: 0.01, unit: 'of the frame', label: 'Space between the two scenes' },
    shutter: { type: 'number', default: 0.5, min: 0, max: 1, step: 0.05, unit: 'ratio', label: 'Motion blur: share of a frame the move smears over' },
  },
  apply(from, to, k, p, ctx) {
    const [W, H] = ctx.size;
    const [dx, dy] = DIRS[str(p.direction)] ?? DIRS.down!;
    const span = (dy ? H : W) * (1 + num(p.gap));
    const P = Math.max(W, H) * 2.2;
    const pose = (c: Cam, at: number) => {
      const off = (at - c.travel) * span;
      // Lean along the travel: a vertical move tips the world back on X, a sideways one turns it on Y.
      const lean = dy ? `rotateX(${(dy * c.tilt).toFixed(3)}deg) rotateZ(${(-0.12 * c.tilt).toFixed(3)}deg)` : `rotateY(${(-dx * c.tilt).toFixed(3)}deg) rotateZ(${(0.12 * c.tilt).toFixed(3)}deg)`;
      return `perspective(${P}px) scale(${c.scale.toFixed(5)}) ${lean} translate(${(dx * off).toFixed(2)}px, ${(dy * off).toFixed(2)}px)`;
    };
    const c = camera(k, p, ctx);
    from.style.transform = pose(c, 0);
    to.style.transform = pose(c, 1);
    // Sheets get an edge only while the camera is back: corners, a hairline and a shadow.
    for (const el of [from, to]) {
      el.style.transformOrigin = '50% 50%';
      el.style.borderRadius = `${(Math.min(W, H) * 0.03 * c.edge).toFixed(2)}px`;
      el.style.boxShadow = c.edge > 0.01
        ? `0 0 0 1px rgba(255,255,255,${(0.08 * c.edge).toFixed(3)}), 0 ${(60 * c.edge).toFixed(1)}px ${(120 * c.edge).toFixed(1)}px rgba(0,0,0,${(0.5 * c.edge).toFixed(3)})`
        : '';
    }
    // Motion blur from the camera's speed on screen, along the travel only.
    const h = 0.5 / ctx.fps / num(p.duration);
    const a = camera(clamp(k - h), p, ctx), b = camera(clamp(k + h), p, ctx);
    const speed = (b.travel - a.travel) * span * c.scale;
    const s = streak(speed, num(p.shutter));
    from.style.filter = directionalBlur(from, dx ? s : 0, dy ? s : 0);
    to.style.filter = directionalBlur(to, dx ? s : 0, dy ? s : 0);
  },
  clear(el) {
    el.style.transform = '';
    el.style.transformOrigin = '';
    el.style.borderRadius = '';
    el.style.boxShadow = '';
    el.style.filter = '';
  },
};
