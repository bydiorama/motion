// type/fill-text. See library/primitives/type/fill-text.md.
//
// The whole line is there from the first frame, dim, and fills word by word in
// reading order: dim, then mid, then full. Nothing moves. The first frame is
// already a readable thumbnail, and the fill tells the eye where to read.
import { clamp } from '../../core/ease.ts';
import { splitText } from '../split.ts';
import { list, num, str, type Primitive } from '../types.ts';

/**
 * Opacity of a word `k` of the way through its fill (0–1): through the dim, mid
 * and full stops, linearly between them. Mid sits a little past halfway, so a
 * word reads as filled before it is quite done.
 */
export function fillLevel(k: number, dim: number): number {
  const mid = dim + (1 - dim) * 0.55, x = clamp(k);
  return x < 0.5 ? dim + (mid - dim) * x * 2 : mid + (1 - mid) * (x - 0.5) * 2;
}

/**
 * How far each of `n` words is through its fill when the whole fill is `e` of
 * the way through. `soft` is how many words fill at once: 1 fills them strictly
 * one after another, 3 lets each overlap the next two.
 */
export function fillShares(n: number, e: number, soft: number): number[] {
  const s = Math.max(1, soft), g = clamp(e) * (n - 1 + s);
  return Array.from({ length: n }, (_, i) => clamp((g - i) / s));
}

export const fillText: Primitive = {
  slug: 'type/fill-text',
  summary: 'The whole line is there, dim; each word fills to full in reading order.',
  props: {
    text: { type: 'string', required: true, label: 'The text. Use \\n to set the line breaks yourself.' },
    accent: { type: 'string[]', default: [], label: 'Words that fill to the accent colour' },
  },
  params: {
    duration: { type: 'number', default: 1.7, min: 0.4, max: 4, step: 0.05, unit: 's', label: 'Time for the whole fill' },
    dim: { type: 'number', default: 0.35, min: 0.15, max: 0.6, step: 0.01, unit: 'opacity', label: 'How dim the words wait' },
    soft: { type: 'number', default: 1.5, min: 1, max: 4, step: 0.1, unit: 'words', label: 'How many words fill at once' },
    ease: { type: 'ease', default: 'smooth', label: 'Pace of the fill along the line' },
  },
  duration: (_props, p) => num(p.duration),
  build(el, props, p, ctx) {
    const { words } = splitText(el, str(props.text), { accent: list(props.accent) });
    const ease = ctx.ease(p.ease as never), dur = Math.max(0.001, num(p.duration)), dim = num(p.dim), soft = num(p.soft);
    return {
      seek(t) {
        const shares = fillShares(words.length, ease(clamp(t / dur)), soft);
        words.forEach((w, i) => {
          const a = fillLevel(shares[i]!, dim);
          w.style.opacity = a >= 1 ? '' : a.toFixed(4);
        });
      },
    };
  },
};
