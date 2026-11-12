// type/scramble. See library/primitives/type/scramble.md.
import { rng } from '../../core/ease.ts';
import { num, str, type Primitive } from '../types.ts';

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&/+';
const STEP = 1 / 20; // glyphs change 20 times a second, whatever the frame rate

export const scramble: Primitive = {
  slug: 'type/scramble',
  summary: 'Characters cycle randomly before settling.',
  props: { text: { type: 'string', required: true, label: 'The text to settle on' } },
  params: {
    duration: { type: 'number', default: 0.8, min: 0.6, max: 1.0, step: 0.05, unit: 's', label: 'Time to settle' },
  },
  duration: (_props, p) => num(p.duration),
  build(el, props, p, ctx) {
    const chars = [...str(props.text)];
    const dur = num(p.duration);
    el.style.whiteSpace = 'pre';
    el.style.fontVariantNumeric = 'tabular-nums';
    return {
      seek(t) {
        const locked = dur <= 0 ? chars.length : Math.floor((Math.max(0, t) / dur) * chars.length + 1e-6);
        const tick = Math.floor(Math.max(0, t) / STEP);
        el.textContent = chars
          .map((c, i) => {
            if (i < locked || c === ' ') return c;
            const r = rng(ctx.seed * 7919 + tick * 131 + i);
            return GLYPHS[Math.floor(r() * GLYPHS.length)] ?? c;
          })
          .join('');
      },
    };
  },
};
