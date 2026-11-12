// fx/counter-roll. See library/primitives/fx/counter-roll.md.
import { progress } from '../../core/ease.ts';
import { num, str, type Primitive } from '../types.ts';

export const counterRoll: Primitive = {
  slug: 'fx/counter-roll',
  summary: 'A number rolls up to its value.',
  props: {
    value: { type: 'number', required: true, label: 'The number to land on' },
    from: { type: 'number', default: 0, label: 'The number to start from' },
    decimals: { type: 'number', default: 0, label: 'Decimal places' },
    prefix: { type: 'string', default: '', label: 'Text before the number' },
    suffix: { type: 'string', default: '', label: 'Text after the number' },
  },
  params: {
    duration: { type: 'number', default: 1.0, min: 0.6, max: 1.5, step: 0.05, unit: 's', label: 'Time to roll' },
  },
  duration: (_props, p) => num(p.duration),
  build(el, props, p, ctx) {
    const ease = ctx.ease(ctx.tokens.ease_enter);
    const to = num(props.value), from = num(props.from), decimals = Math.max(0, Math.round(num(props.decimals)));
    const dur = num(p.duration);
    el.style.fontVariantNumeric = 'tabular-nums';
    el.style.whiteSpace = 'pre';
    return {
      seek(t) {
        // At and after the end the exact value is written, never an eased near-miss.
        const v = t >= dur ? to : from + (to - from) * progress(t, 0, dur, ease);
        el.textContent = `${str(props.prefix)}${v.toFixed(decimals)}${str(props.suffix)}`;
      },
    };
  },
};
