// transition/fly-past. See library/primitives/transition/fly-past.md.
//
// The outgoing scene comes apart: each of its layers flies towards the camera
// and past it, front layer first, tumbling away from the centre of the frame and
// going out of focus as it nears the lens. The next scene is already beneath
// them and settles from a touch closer as they clear.
//
// It moves the outgoing scene's layers, not the scene: the engine writes every
// layer's own pose earlier in the same frame, and this adds the flight in front
// of it. Nothing is left behind, because the engine writes the pose afresh on
// every frame.
import { clamp } from '../../core/ease.ts';
import { num, type TransitionPrimitive } from '../types.ts';

/** What the hand-over changes on the outgoing scene, to put back afterwards. */
const saved = new WeakMap<HTMLElement, { zIndex: string; background: string }>();

export const flyPast: TransitionPrimitive = {
  slug: 'transition/fly-past',
  summary: 'The layers of a scene fly out past the camera, front first, revealing the next beneath.',
  duration: 1.1,
  params: {
    duration: { type: 'number', default: 1.1, min: 0.6, max: 1.8, step: 0.05, unit: 's', label: 'Length of the hand-over' },
    spread: { type: 'number', default: 0.35, min: 0, max: 0.6, step: 0.01, unit: 'ratio', label: 'Share of the time between the first layer leaving and the last' },
    tumble: { type: 'number', default: 50, min: 0, max: 80, step: 1, unit: 'deg', label: 'How far each layer turns away as it passes' },
    defocus: { type: 'number', default: 4, min: 0, max: 10, step: 0.5, unit: 'px', label: 'Blur as a layer reaches the lens' },
    settle: { type: 'number', default: 0.05, min: 0, max: 0.12, step: 0.005, unit: 'ratio', label: 'How much closer the next scene starts' },
  },
  apply(from, to, k, p, ctx) {
    const [W, H] = ctx.size, P = Math.max(W, H) * 1.6;
    const frame = from.getBoundingClientRect();
    const unit = frame.width > 0 ? frame.width / W : 1;
    const layers = [...from.querySelectorAll<HTMLElement>(':scope > .m-cam > .m-layer')].filter((l) => l.style.visibility !== 'hidden');
    const n = layers.length, spread = num(p.spread), each = 1 - spread;
    layers.forEach((layer, idx) => {
      // Front first: the last layer drawn is nearest the camera.
      const order = n - 1 - idx;
      const t0 = n > 1 ? (order / (n - 1)) * spread : 0;
      const f = clamp((k - t0) / each), e = f ** 2.3;
      if (f <= 0) return;
      // Away from the centre of the frame, through the layer's own centre.
      const r = layer.getBoundingClientRect();
      let ex = ((r.left + r.width / 2 - frame.left) / unit - W / 2) / (W / 2);
      let ey = ((r.top + r.height / 2 - frame.top) / unit - H / 2) / (H / 2);
      const len = Math.hypot(ex, ey);
      // A layer dead centre leaves upwards and slightly across, so it still clears the frame.
      if (len < 0.15) { ex = 0.12; ey = -1; } else { ex /= len; ey /= len; }
      const travel = Math.max(W, H) * 0.9 * e, z = P * 0.82 * e, tumble = num(p.tumble);
      const fly = `perspective(${P}px) translate3d(${(ex * travel).toFixed(2)}px, ${(ey * travel).toFixed(2)}px, ${z.toFixed(2)}px) `
        + `rotateX(${(-ey * tumble * e).toFixed(3)}deg) rotateY(${(ex * tumble * e).toFixed(3)}deg) rotate(${((idx % 2 ? 12 : -12) * e).toFixed(3)}deg)`;
      layer.style.transform = `${fly} ${layer.style.transform}`;
      layer.style.opacity = String((Number(layer.style.opacity || 1)) * (1 - ctx.ease('smooth')(clamp((f - 0.7) / 0.3))));
      const blur = num(p.defocus) * e * e;
      if (blur > 0.05) layer.style.filter = `${layer.style.filter} blur(${blur.toFixed(2)}px)`.trim();
    });
    // Beneath: in quickly, settling from a touch closer as the layers clear.
    const s = ctx.ease('expo.out')(clamp(k / 0.85));
    to.style.transformOrigin = '50% 50%';
    to.style.transform = `scale(${(1 + num(p.settle) * (1 - s)).toFixed(4)})`;
    to.style.opacity = String(ctx.ease('smooth')(clamp(k / 0.45)));
    // The outgoing scene is lifted over the next one, and its own ground goes, so
    // its layers fly over the next scene while it shows through between them.
    if (!saved.has(from)) saved.set(from, { zIndex: from.style.zIndex, background: from.style.background });
    from.style.zIndex = String((Number(to.style.zIndex) || 0) + 1);
    from.style.background = 'transparent';
  },
  clear(el) {
    el.style.transform = '';
    el.style.transformOrigin = '';
    el.style.opacity = '';
    const was = saved.get(el);
    if (was) {
      el.style.zIndex = was.zIndex;
      el.style.background = was.background;
      saved.delete(el);
    }
  },
};
