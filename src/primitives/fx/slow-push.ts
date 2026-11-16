// fx/slow-push. See library/primitives/fx/slow-push.md.
import { clamp } from '../../core/ease.ts';
import { num, str, type Primitive } from '../types.ts';

/** Scale and offset (share of the frame) of the picture at progress k. The picture always covers its frame. */
export function pushAt(k: number, p: { from: number; to: number; pan_x: number; pan_y: number }): { scale: number; x: number; y: number } {
  const u = clamp(k);
  const scale = Math.max(1, p.from + (p.to - p.from) * u);
  // The pan runs from one side of centre to the other, and never past what the scale leaves spare.
  const spare = (scale - 1) / 2;
  const shift = (pan: number) => clamp((pan / 100) * (u - 0.5), -spare, spare);
  return { scale, x: shift(p.pan_x), y: shift(p.pan_y) };
}

export const slowPush: Primitive = {
  slug: 'fx/slow-push',
  summary: 'A still picture in a fixed frame slowly pushes in, pulls out or pans while it is held.',
  props: {
    src: { type: 'string', required: true, label: 'Image path or URL' },
    alt: { type: 'string', default: '', label: 'Description of the picture' },
  },
  params: {
    width: { type: 'number', default: 640, min: 1, max: 4000, step: 1, unit: 'px', label: 'Frame width' },
    height: { type: 'number', default: 800, min: 1, max: 4000, step: 1, unit: 'px', label: 'Frame height' },
    radius: { type: 'number', default: 16, min: 0, max: 400, step: 1, unit: 'px', label: 'Corner radius' },
    from: { type: 'number', default: 1.08, min: 1, max: 1.6, step: 0.01, unit: '×', label: 'Scale at the start' },
    to: { type: 'number', default: 1, min: 1, max: 1.6, step: 0.01, unit: '×', label: 'Scale at the end' },
    pan_x: { type: 'number', default: 0, min: -30, max: 30, step: 0.5, unit: '% of frame', label: 'Sideways travel over the move', pad: { name: 'pan', axis: 'x' } },
    pan_y: { type: 'number', default: 0, min: -30, max: 30, step: 0.5, unit: '% of frame', label: 'Vertical travel over the move', pad: { name: 'pan', axis: 'y' } },
    duration: { type: 'number', default: 4, min: 0.5, max: 30, step: 0.1, unit: 's', label: 'Length of the move' },
    ease: { type: 'ease', default: 'linear', label: 'Curve of the move; linear reads as drift' },
  },
  duration: (_props, p) => num(p.duration, 4),
  build(el, props, p, ctx) {
    const img = el.ownerDocument.createElement('img');
    img.src = str(props.src);
    img.alt = str(props.alt);
    img.decoding = 'sync';
    el.style.cssText += `;width:${num(p.width)}px;height:${num(p.height)}px;border-radius:${num(p.radius)}px;overflow:hidden`;
    img.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;will-change:transform';
    el.appendChild(img);
    const ease = ctx.ease(p.ease as never), d = num(p.duration, 4);
    const q = { from: num(p.from, 1.08), to: num(p.to, 1), pan_x: num(p.pan_x), pan_y: num(p.pan_y) };
    return {
      seek(t) {
        const s = pushAt(ease(clamp(t / d)), q);
        img.style.transform = `translate(${(s.x * 100).toFixed(4)}%, ${(s.y * 100).toFixed(4)}%) scale(${s.scale.toFixed(5)})`;
      },
    };
  },
};
