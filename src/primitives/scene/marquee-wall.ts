// scene/marquee-wall, with fx/marquee-highlight for its emphasised item.
// See library/primitives/scene/marquee-wall.md and fx/marquee-highlight.md.
import { progress } from '../../core/ease.ts';
import { list, num, str, type Primitive } from '../types.ts';

const RATE = [1, 1.24, 0.6, 1.1, 0.9, 1.3]; // rows drift at slightly different speeds
const OFFSET = [0.1, 0.5, 0.92, 0.3, 0.7, 0.2];

export const marqueeWall: Primitive = {
  slug: 'scene/marquee-wall',
  summary: 'Rows of chips or logos scrolling sideways.',
  props: {
    items: { type: 'string[]', required: true, label: 'Chip labels' },
    highlight: { type: 'string', default: '', label: 'One label to emphasise while the others dim' },
  },
  params: {
    rows: { type: 'number', default: 5, min: 4, max: 6, step: 1, unit: 'rows', label: 'Rows' },
    speed: { type: 'number', default: 60, min: 30, max: 120, step: 5, unit: 'px/s', label: 'Scroll speed' },
    dim_opacity: { type: 'number', default: 0.5, min: 0.4, max: 0.6, step: 0.01, unit: 'ratio', label: 'Opacity of the other items once one is emphasised', from: 'fx/marquee-highlight' },
    highlight_at: { type: 'number', default: 1.5, min: 0, max: 10, step: 0.1, unit: 's', label: 'When the emphasis starts' },
  },
  // Ambient: it has no end of its own and runs for as long as its scene.
  duration: () => 0,
  build(el, props, p, ctx) {
    const items = list(props.items), rows = Math.max(1, Math.round(num(p.rows))), speed = num(p.speed);
    const highlight = str(props.highlight);
    el.style.cssText += `;width:${ctx.size[0]}px;display:flex;flex-direction:column;gap:0.55em;overflow:hidden`;
    const tracks = Array.from({ length: rows }, (_, r) => {
      const row = items.filter((_, i) => i % rows === r);
      const mine = row.length ? row : items;
      const track = document.createElement('div');
      track.style.cssText = 'display:flex;width:max-content;will-change:transform';
      const fill = (host: HTMLElement) => mine.forEach((label) => {
        const c = document.createElement('span');
        c.textContent = label;
        c.style.cssText = 'position:relative;flex:none;margin-right:0.5em;padding:0.45em 0.9em;border-radius:999px;white-space:nowrap;background:var(--m-bg-surface)';
        if (label === highlight) {
          // The accent face sits on top and fades in with --k; nothing changes size, so rows never jump.
          const face = document.createElement('span');
          face.textContent = label;
          face.setAttribute('aria-hidden', 'true');
          face.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;border-radius:inherit;background:var(--m-bg-accent);color:var(--m-text-on-accent);opacity:var(--k, 0)';
          c.appendChild(face);
          c.style.transform = 'scale(calc(1 + 0.08 * var(--k, 0)))';
          c.style.zIndex = '1';
        } else c.style.opacity = 'calc(1 - var(--dim, 0) * var(--k, 0))';
        host.appendChild(c);
      });
      // One set is measured, then repeated until it covers the stage twice over,
      // so the row can wrap without a gap.
      const unit = document.createElement('div');
      unit.style.cssText = 'display:flex;flex:none';
      fill(unit);
      track.appendChild(unit);
      el.appendChild(track);
      const width = Math.max(1, unit.getBoundingClientRect().width / stageScale(el));
      const copies = Math.ceil(ctx.size[0] / width) + 1;
      for (let i = 0; i < copies; i++) track.appendChild(unit.cloneNode(true));
      return { track, width, dir: r % 2 ? -1 : 1, rate: RATE[r % RATE.length]!, off: OFFSET[r % OFFSET.length]! };
    });
    const ease = ctx.ease(ctx.tokens.ease_move), at = num(p.highlight_at), fade = ctx.tokens.duration.slow;
    el.style.setProperty('--dim', String(highlight ? 1 - num(p.dim_opacity) : 0));
    return {
      seek(t) {
        el.style.setProperty('--k', String(highlight ? progress(t, at, fade, ease) : 0));
        for (const r of tracks) {
          const travelled = (t * speed * r.rate + r.off * r.width) % r.width;
          r.track.style.transform = `translateX(${-(r.dir > 0 ? travelled : r.width - travelled)}px)`;
        }
      },
    };
  },
};

/** The stage is drawn scaled to fit its container; measurements must be undone by that scale. */
function stageScale(el: HTMLElement): number {
  const stage = el.closest<HTMLElement>('.m-stage');
  if (!stage) return 1;
  const w = stage.getBoundingClientRect().width;
  return w > 0 && stage.offsetWidth > 0 ? w / stage.offsetWidth : 1;
}
