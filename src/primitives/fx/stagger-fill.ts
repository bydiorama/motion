// fx/stagger-fill. See library/primitives/fx/stagger-fill.md.
import { progress } from '../../core/ease.ts';
import { list, num, type Primitive } from '../types.ts';

export const staggerFill: Primitive = {
  slug: 'fx/stagger-fill',
  summary: 'Items appear one after another.',
  props: { items: { type: 'string[]', required: true, label: 'The items, in reading order' } },
  params: {
    stagger: { type: 'number', default: 0.04, min: 0.02, max: 0.06, step: 0.005, unit: 's', label: 'Delay between items' },
  },
  duration: (props, p, ctx) => Math.max(0, list(props.items).length - 1) * num(p.stagger) + ctx.tokens.duration.base,
  build(el, props, p, ctx) {
    const ease = ctx.ease(ctx.tokens.ease_enter);
    const each = ctx.tokens.duration.base, stagger = num(p.stagger);
    el.style.cssText += ';display:flex;flex-wrap:wrap;justify-content:center;gap:0.5em';
    const chips = list(props.items).map((label) => {
      const c = document.createElement('span');
      c.textContent = label;
      c.style.cssText = 'padding:0.45em 0.9em;border-radius:999px;background:var(--m-bg-surface);white-space:nowrap;will-change:transform,opacity';
      el.appendChild(c);
      return c;
    });
    return {
      seek(t) {
        chips.forEach((c, i) => {
          const k = progress(t, i * stagger, each, ease);
          c.style.opacity = String(k);
          c.style.transform = `scale(${0.9 + 0.1 * k})`;
        });
      },
    };
  },
};
