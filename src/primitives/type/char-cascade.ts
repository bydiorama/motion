// type/char-cascade. See library/primitives/type/char-cascade.md.
import { progress } from '../../core/ease.ts';
import { STAGGER_FROM, staggerDelays, staggerSpan } from '../../core/stagger.ts';
import { countChars, splitText } from '../split.ts';
import { list, num, str, type Primitive } from '../types.ts';

export const charCascade: Primitive = {
  slug: 'type/char-cascade',
  summary: 'Letters arrive one by one: rising, turning, growing or coming into focus.',
  props: {
    text: { type: 'string', required: true, label: 'The text' },
    accent: { type: 'string[]', default: [], label: 'Words set in the accent colour' },
  },
  params: {
    stagger: { type: 'number', default: 0.03, min: 0.015, max: 0.06, step: 0.005, unit: 's', label: 'Delay between letters' },
    char_duration: { type: 'number', default: 0.6, min: 0.3, max: 1, step: 0.05, unit: 's', label: 'Time per letter' },
    from: { type: 'choice', default: 'start', options: STAGGER_FROM, label: 'Which letter goes first' },
    rise: { type: 'number', default: 0.6, min: -1, max: 1.2, step: 0.05, unit: 'em', label: 'Rise (negative drops in)' },
    rotate: { type: 'number', default: 0, min: -90, max: 90, step: 1, unit: 'deg', label: 'Turn that settles' },
    scale: { type: 'number', default: 1, min: 0, max: 1.6, step: 0.05, unit: 'x', label: 'Start scale' },
    blur: { type: 'number', default: 8, min: 0, max: 24, step: 1, unit: 'px', label: 'Start blur' },
  },
  duration: (props, p, ctx) => staggerSpan(countChars(str(props.text)), str(p.from), ctx.seed) * num(p.stagger) + num(p.char_duration),
  build(el, props, p, ctx) {
    const { chars } = splitText(el, str(props.text), { chars: true, accent: list(props.accent) });
    const delays = staggerDelays(chars.length, num(p.stagger), str(p.from), ctx.seed);
    // The token ease, which a lively film may make springy; opacity always leads.
    const ease = ctx.ease(ctx.tokens.ease_enter);
    const dur = num(p.char_duration), rise = num(p.rise), rot = num(p.rotate), s0 = num(p.scale), blur = num(p.blur);
    for (const c of chars) c.style.transformOrigin = '50% 70%';
    return {
      seek(t) {
        chars.forEach((c, i) => {
          const k = progress(t, delays[i]!, dur, ease);
          const fade = Math.min(1, Math.max(0, (t - delays[i]!) / (dur * 0.45)));
          const off = 1 - k;
          c.style.opacity = fade >= 1 ? '' : String(fade);
          c.style.transform = off === 0 ? '' : `translateY(${(off * rise).toFixed(4)}em) rotate(${(off * rot).toFixed(3)}deg) scale(${(s0 + (1 - s0) * k).toFixed(4)})`;
          const b = Math.max(0, off) * blur;
          c.style.filter = b > 0.05 ? `blur(${b.toFixed(2)}px)` : '';
        });
      },
    };
  },
};
