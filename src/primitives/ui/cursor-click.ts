// ui/cursor-click. See library/primitives/ui/cursor-click.md.
import { progress } from '../../core/ease.ts';
import { num, str, type Primitive } from '../types.ts';

const ARROW = 'M2 1.5 L2 20.5 L7.2 15.6 L10.6 23.2 L14 21.7 L10.7 14.2 L17.6 14.2 Z';

const timing = (p: Record<string, unknown>) => {
  const travel = num(p.travel), press = 0.08;
  return { travel, press, at: travel + 0.06, end: travel + 0.06 + press * 2 + 0.55 };
};

export const cursorClick: Primitive = {
  slug: 'ui/cursor-click',
  summary: 'A drawn cursor moves to a target and clicks.',
  props: { label: { type: 'string', default: '', label: 'A name tag beside the cursor, for a collaborator' } },
  params: {
    from_x: { type: 'number', default: 78, min: 0, max: 100, step: 0.5, unit: '% of width', label: 'Start, across', pad: { name: 'start', axis: 'x' } },
    from_y: { type: 'number', default: 82, min: 0, max: 100, step: 0.5, unit: '% of height', label: 'Start, down', pad: { name: 'start', axis: 'y' } },
    to_x: { type: 'number', default: 50, min: 0, max: 100, step: 0.5, unit: '% of width', label: 'Target, across', pad: { name: 'target', axis: 'x' } },
    to_y: { type: 'number', default: 50, min: 0, max: 100, step: 0.5, unit: '% of height', label: 'Target, down', pad: { name: 'target', axis: 'y' } },
    travel: { type: 'number', default: 0.7, min: 0.3, max: 1.8, step: 0.05, unit: 's', label: 'Time to reach the target' },
    arc: { type: 'number', default: 0.06, min: 0, max: 0.2, step: 0.01, unit: 'ratio', label: 'Bow of the path' },
    size: { type: 'number', default: 2.4, min: 1.5, max: 4, step: 0.1, unit: '% of width', label: 'Cursor size' },
  },
  duration: (_props, p) => timing(p).end,
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const [W, H] = ctx.size, T = timing(p);
    const x0 = (num(p.from_x) / 100) * W, y0 = (num(p.from_y) / 100) * H, x1 = (num(p.to_x) / 100) * W, y1 = (num(p.to_y) / 100) * H;
    // The path bows to one side, as a hand does; the bow is a share of the distance.
    const len = Math.hypot(x1 - x0, y1 - y0), bow = num(p.arc) * len;
    const mx = (x0 + x1) / 2 - ((y1 - y0) / (len || 1)) * bow, my = (y0 + y1) / 2 + ((x1 - x0) / (len || 1)) * bow;
    const size = (num(p.size) / 100) * W;
    el.style.cssText += ';position:absolute;inset:0;max-width:none;pointer-events:none;z-index:40';
    const ring = doc.createElement('div');
    ring.style.cssText = `position:absolute;left:${x1}px;top:${y1}px;width:${size * 1.6}px;height:${size * 1.6}px;margin:${-size * 0.8}px 0 0 ${-size * 0.8}px;border-radius:50%;border:${size * 0.08}px solid var(--m-accent);opacity:0`;
    const cursor = doc.createElement('div');
    cursor.style.cssText = `position:absolute;left:0;top:0;width:${size}px;height:${size}px;transform-origin:8% 6%;filter:drop-shadow(0 ${size * 0.06}px ${size * 0.12}px rgba(0,0,0,0.28))`;
    cursor.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display:block;overflow:visible"><path d="${ARROW}" fill="var(--m-text-primary)" stroke="var(--m-bg-base)" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
    if (str(props.label)) {
      const tag = doc.createElement('span');
      tag.textContent = str(props.label);
      tag.style.cssText = `position:absolute;left:${size * 0.7}px;top:${size * 0.9}px;padding:${size * 0.12}px ${size * 0.3}px;border-radius:${size * 0.3}px;background:var(--m-bg-accent);color:var(--m-text-on-accent);font:600 ${size * 0.42}px var(--m-font-body);white-space:nowrap`;
      cursor.appendChild(tag);
    }
    el.append(ring, cursor);
    const move = ctx.ease([0.45, 0, 0.15, 1]), out = ctx.ease('expressive.out');
    return {
      seek(t) {
        const k = progress(t, 0, T.travel, move);
        const x = (1 - k) * (1 - k) * x0 + 2 * (1 - k) * k * mx + k * k * x1;
        const y = (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * my + k * k * y1;
        // Press: a quick squeeze down and back, then a ring spreads from the tip.
        const down = progress(t, T.at, T.press, (v) => v), up = progress(t, T.at + T.press, T.press * 1.5, out);
        const s = 1 - 0.14 * (down - up);
        cursor.style.transform = `translate(${(x - size * 0.08).toFixed(2)}px, ${(y - size * 0.06).toFixed(2)}px) scale(${s.toFixed(4)})`;
        cursor.style.opacity = Math.min(1, t / 0.15).toFixed(3);
        const r = progress(t, T.at + T.press, 0.55, out);
        ring.style.opacity = r > 0 ? (0.9 * (1 - r)).toFixed(3) : '0';
        ring.style.transform = `scale(${(0.3 + r * 1.1).toFixed(4)})`;
      },
    };
  },
};
