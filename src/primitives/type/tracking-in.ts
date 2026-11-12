// type/tracking-in. See library/primitives/type/tracking-in.md.
import { progress } from '../../core/ease.ts';
import { num, str, type Primitive } from '../types.ts';

export const trackingIn: Primitive = {
  slug: 'type/tracking-in',
  summary: 'Wide-spaced letters close up to their set spacing while coming into focus.',
  props: { text: { type: 'string', required: true, label: 'The title' } },
  params: {
    duration: { type: 'number', default: 1.6, min: 0.8, max: 3, step: 0.1, unit: 's', label: 'Time to close up' },
    spread: { type: 'number', default: 0.5, min: 0.1, max: 1.2, step: 0.05, unit: 'em', label: 'Extra spacing at the start' },
    blur: { type: 'number', default: 12, min: 0, max: 30, step: 1, unit: 'px', label: 'Start blur' },
  },
  duration: (_props, p) => num(p.duration),
  build(el, props, p, ctx) {
    const ease = ctx.ease('expressive.out');
    const dur = num(p.duration), spread = num(p.spread), blur = num(p.blur);
    const inner = el.ownerDocument.createElement('span');
    inner.textContent = str(props.text);
    inner.style.cssText = 'display:inline-block;white-space:pre-line';
    el.appendChild(inner);
    // Spacing is added after the last letter too; a matching negative margin keeps the line centred.
    const base = parseFloat(getComputedStyle(el).letterSpacing) || 0;
    const size = parseFloat(getComputedStyle(el).fontSize) || 16;
    return {
      seek(t) {
        const k = progress(t, 0, dur, ease);
        const fade = Math.min(1, t / (dur * 0.5));
        const extra = (1 - k) * spread;
        inner.style.letterSpacing = `${(base / size + extra).toFixed(4)}em`;
        inner.style.marginRight = `${(-extra).toFixed(4)}em`;
        inner.style.opacity = fade >= 1 ? '' : String(Math.max(0, fade));
        const b = (1 - k) * blur;
        inner.style.filter = b > 0.05 ? `blur(${b.toFixed(2)}px)` : '';
      },
    };
  },
};
