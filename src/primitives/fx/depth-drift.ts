// fx/depth-drift. See library/primitives/fx/depth-drift.md.
import { rng } from '../../core/ease.ts';
import { list, num, type Primitive } from '../types.ts';

export const depthDrift: Primitive = {
  slug: 'fx/depth-drift',
  summary: 'A floating collage on several depth planes.',
  props: { items: { type: 'string[]', required: true, label: 'Labels of the floating pieces' } },
  params: {
    planes: { type: 'number', default: 3, min: 2, max: 3, step: 1, unit: 'planes', label: 'Depth planes' },
    speed: { type: 'number', default: 20, min: 10, max: 30, step: 1, unit: 'px/s', label: 'Drift speed of the nearest plane' },
  },
  // Ambient backdrop: it drifts for as long as its scene.
  duration: () => 0,
  build(el, props, p, ctx) {
    const [W, H] = ctx.size, u = W / 100;
    const planes = Math.max(1, Math.round(num(p.planes))), speed = num(p.speed);
    const random = rng(ctx.seed * 101 + 7);
    const fade = ctx.ease(ctx.tokens.ease_enter), each = ctx.tokens.duration.base, stagger = ctx.tokens.stagger.base;
    el.style.cssText += ';position:absolute;inset:0;max-width:none;pointer-events:none';
    const items = list(props.items).map((label, i, all) => {
      // Pieces sit on a ring around the middle, so the centre stays free for text.
      const angle = ((i + random() * 0.6) / all.length) * Math.PI * 2;
      const reach = 0.3 + random() * 0.14;
      const x = W / 2 + Math.cos(angle) * W * reach, y = H / 2 + Math.sin(angle) * H * (reach + 0.04);
      const plane = i % planes, depth = planes === 1 ? 1 : 1 - plane / planes; // 1 = nearest
      const n = document.createElement('span');
      n.textContent = label;
      n.style.cssText = `position:absolute;left:0;top:0;padding:${0.7 * u}px ${1.4 * u}px;border-radius:999px;white-space:nowrap;background:var(--m-bg-surface);` +
        `font:500 ${1.4 * u}px var(--m-font-mono);color:var(--m-text-primary)${plane === 0 && planes > 1 ? `;filter:blur(${0.06 * u}px)` : ''}`;
      el.appendChild(n);
      return { n, x, y, depth, delay: i * stagger };
    });
    return {
      seek(t) {
        for (const it of items) {
          // Near pieces are larger and faster; far ones smaller and slower.
          const dx = (t - 2) * speed * it.depth;
          it.n.style.transform = `translate(${it.x + dx}px, ${it.y}px) translate(-50%, -50%) scale(${0.72 + it.depth * 0.42})`;
          it.n.style.opacity = String(fade(Math.min(1, Math.max(0, (t - it.delay) / each))) * (0.35 + it.depth * 0.5));
        }
      },
    };
  },
};
