// type/echo. See library/primitives/type/echo.md.
import { progress } from '../../core/ease.ts';
import { num, str, type Primitive } from '../types.ts';

export const echo: Primitive = {
  slug: 'type/echo',
  summary: 'Copies of a headline trail behind it.',
  props: { text: { type: 'string', required: true, label: 'The headline' } },
  params: {
    copies: { type: 'number', default: 4, min: 3, max: 6, step: 1, unit: 'copies', label: 'Outlined copies' },
    lag: { type: 'number', default: 0.06, min: 0.03, max: 0.12, step: 0.005, unit: 's', label: 'Delay between copies' },
    distance: { type: 'number', default: 1.2, min: 0.4, max: 3, step: 0.1, unit: 'em', label: 'How far below they start' },
    settle: { type: 'number', default: 0, min: 0, max: 0.6, step: 0.02, unit: 'em', label: 'Gap between copies at rest (0 hides them under the headline)' },
  },
  duration: (_props, p, ctx) => Math.round(num(p.copies)) * num(p.lag) + ctx.tokens.duration.slow + 0.4,
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const n = Math.max(1, Math.round(num(p.copies))), lag = num(p.lag), dist = num(p.distance), settle = num(p.settle);
    const dur = ctx.tokens.duration.slow + 0.4, ease = ctx.ease('expressive.out');
    el.style.display = 'grid';
    const make = (outline: boolean) => {
      const s = doc.createElement('span');
      s.textContent = str(props.text);
      s.style.cssText = 'grid-area:1/1;white-space:pre-line';
      if (outline) {
        s.style.color = 'transparent';
        s.style.setProperty('-webkit-text-stroke', '0.018em currentColor');
        s.setAttribute('aria-hidden', 'true');
      }
      return s;
    };
    // Copies are drawn first, so the headline sits on top of them.
    const copies = Array.from({ length: n }, () => make(true)).reverse();
    copies.forEach((c) => el.appendChild(c));
    copies.reverse();
    const head = make(false);
    el.appendChild(head);
    return {
      seek(t) {
        const kh = progress(t, n * lag, dur, ease);
        head.style.transform = kh >= 1 ? '' : `translateY(${((1 - kh) * dist).toFixed(4)}em)`;
        head.style.opacity = String(Math.min(1, Math.max(0, (t - n * lag) / (dur * 0.3))));
        copies.forEach((c, i) => {
          // The copy furthest back leaves first and ends furthest down.
          const order = n - 1 - i;
          const k = progress(t, order * lag, dur, ease);
          const rest = (i + 1) * settle;
          c.style.transform = `translateY(${(rest + (1 - k) * dist).toFixed(4)}em)`;
          const fade = Math.min(1, Math.max(0, (t - order * lag) / (dur * 0.25)));
          const depth = 1 - (i + 1) / (n + 1);
          // With no gap at rest, copies vanish under the headline once it lands.
          const hide = settle === 0 ? 1 - progress(t, n * lag + dur * 0.6, dur * 0.4, (x) => x) : 1;
          c.style.opacity = (fade * depth * hide).toFixed(3);
        });
      },
    };
  },
};
