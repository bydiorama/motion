// type/mask-reveal. See library/primitives/type/mask-reveal.md.
import { progress } from '../../core/ease.ts';
import { STAGGER_FROM, staggerDelays, staggerSpan } from '../../core/stagger.ts';
import { countHardLines, countWords, splitText } from '../split.ts';
import { list, num, str, type Primitive } from '../types.ts';

const span = (props: Record<string, unknown>, p: Record<string, unknown>, seed: number) => {
  const text = str(props.text);
  if (p.unit === 'word') return staggerSpan(countWords(text), str(p.from), seed);
  // Lines are only known once laid out; "\n" lines are counted, and one more step
  // is kept for a line that wraps.
  return staggerSpan(countHardLines(text), str(p.from), seed) + (countHardLines(text) > 1 || countWords(text) > 3 ? 1 : 0);
};

export const maskReveal: Primitive = {
  slug: 'type/mask-reveal',
  summary: 'Lines or words slide up from under an edge, one after another.',
  props: {
    text: { type: 'string', required: true, label: 'The text. Use \\n to set the line breaks yourself.' },
    accent: { type: 'string[]', default: [], label: 'Words set in the accent colour' },
  },
  params: {
    unit: { type: 'choice', default: 'line', options: ['line', 'word'], label: 'What rises together' },
    stagger: { type: 'number', default: 0.08, min: 0.04, max: 0.16, step: 0.005, unit: 's', label: 'Delay between units' },
    duration: { type: 'number', default: 0.9, min: 0.5, max: 1.4, step: 0.05, unit: 's', label: 'Time per unit' },
    tilt: { type: 'number', default: 0, min: 0, max: 8, step: 0.5, unit: 'deg', label: 'Tilt that settles as it rises' },
    from: { type: 'choice', default: 'start', options: STAGGER_FROM, label: 'Which unit goes first' },
    ease: { type: 'ease', default: 'expressive.out', label: 'Curve of each rise' },
  },
  duration: (props, p, ctx) => span(props, p, ctx.seed) * num(p.stagger) + num(p.duration),
  build(el, props, p, ctx) {
    const byWord = p.unit === 'word';
    const split = splitText(el, str(props.text), { mask: byWord ? 'word' : 'line', accent: list(props.accent) });
    const units = byWord ? split.words : split.lines;
    // Measured lines can outnumber "\n" lines; the stagger shrinks so the reveal
    // still ends when the timeline says it does.
    const steps = staggerSpan(units.length, str(p.from), ctx.seed);
    const budget = span(props, p, ctx.seed);
    const stagger = steps > budget && steps > 0 ? (num(p.stagger) * budget) / steps : num(p.stagger);
    const delays = staggerDelays(units.length, stagger, str(p.from), ctx.seed);
    const ease = ctx.ease(p.ease as never), dur = num(p.duration), tilt = num(p.tilt);
    for (const u of units) {
      u.style.transformOrigin = '0% 100%';
      u.style.willChange = 'transform';
    }
    return {
      seek(t) {
        units.forEach((u, i) => {
          const k = progress(t, delays[i]!, dur, ease);
          const off = 1 - k;
          u.style.transform = off === 0 ? '' : `translateY(${(off * 110).toFixed(3)}%) rotate(${(off * tilt).toFixed(3)}deg)`;
        });
      },
    };
  },
};
