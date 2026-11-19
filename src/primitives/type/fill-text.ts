// type/fill-text. See library/primitives/type/fill-text.md.
//
// The whole line is there from the first frame, dim, and fills word by word in
// reading order: dim, then mid, then full. Nothing moves. The first frame is
// already a readable thumbnail, and the fill tells the eye where to read.
//
// With `dim` at 0 it streams instead: words arrive one after another out of a soft
// focus, the way a model's answer comes in, but every word has its place from the
// first frame, so the line never re-wraps or re-centres as it grows. A word in
// braces, {1}, is a badge (a citation, a count) that pops in on its turn.
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
    dim: { type: 'number', default: 0.35, min: 0, max: 0.6, step: 0.01, unit: 'opacity', label: 'How dim the words wait (0: unseen, so the text streams in)' },
    blur: { type: 'number', default: 0, min: 0, max: 6, step: 0.1, unit: 'px', label: 'Soft focus a word fills out of' },
    rise: { type: 'number', default: 0, min: 0, max: 12, step: 0.5, unit: 'px', label: 'How far a word rises as it fills' },
    word_ease: { type: 'ease', default: 'linear', label: 'Pace of each word\'s own fill' },
    soft: { type: 'number', default: 1.5, min: 1, max: 8, step: 0.1, unit: 'words', label: 'How many words fill at once' },
    ease: { type: 'ease', default: 'smooth', label: 'Pace of the fill along the line' },
  },
  duration: (_props, p) => num(p.duration),
  build(el, props, p, ctx) {
    const { words } = splitText(el, str(props.text), { accent: list(props.accent) });
    const badge = words.map((w) => {
      const m = /^\{(.+)\}([^\p{L}\p{N}]*)$/u.exec(w.textContent ?? '');
      if (!m) return false;
      w.textContent = m[1]!;
      w.style.cssText += ';padding:0 0.38em;margin:0 0.05em;border-radius:999px;font-size:0.62em;line-height:1.55;vertical-align:0.18em;font-weight:600;' +
        'color:var(--m-accent);background:color-mix(in srgb, var(--m-accent) 16%, transparent)';
      return true;
    });
    const ease = ctx.ease(p.ease as never), each = ctx.ease(p.word_ease as never), pop = ctx.ease('bounce.out');
    const dur = Math.max(0.001, num(p.duration)), dim = num(p.dim), soft = num(p.soft), blur = num(p.blur), rise = num(p.rise);
    return {
      seek(t) {
        const shares = fillShares(words.length, ease(clamp(t / dur)), soft);
        words.forEach((w, i) => {
          const k = each(shares[i]!);
          if (badge[i]) {
            // A badge pops on its turn: from half size, past its mark and back.
            const a = clamp(k * 3);
            w.style.opacity = a >= 1 ? '' : a.toFixed(4);
            w.style.transform = k >= 1 ? '' : `scale(${(0.5 + 0.5 * pop(k)).toFixed(4)})`;
            return;
          }
          const a = fillLevel(k, dim);
          w.style.opacity = a >= 1 ? '' : a.toFixed(4);
          w.style.filter = blur > 0 && k < 1 ? `blur(${((1 - k) * blur).toFixed(3)}px)` : '';
          w.style.transform = rise > 0 && k < 1 ? `translateY(${((1 - k) * rise).toFixed(3)}px)` : '';
        });
      },
    };
  },
};
