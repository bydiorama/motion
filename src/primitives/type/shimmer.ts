// type/shimmer. See library/primitives/type/shimmer.md.
import { num, str, type Primitive } from '../types.ts';

export const shimmer: Primitive = {
  slug: 'type/shimmer',
  summary: 'A band of light passes across the letters, again and again.',
  props: { text: { type: 'string', required: true, label: 'The text' } },
  params: {
    period: { type: 'number', default: 2.4, min: 1.2, max: 4, step: 0.1, unit: 's', label: 'Time between passes' },
    band: { type: 'number', default: 0.22, min: 0.1, max: 0.5, step: 0.01, unit: 'ratio', label: 'Width of the band' },
    strength: { type: 'number', default: 0.65, min: 0.3, max: 1, step: 0.05, unit: 'ratio', label: 'How dim the text is outside the band' },
  },
  // Ambient: it shines for as long as its scene. A scene a whole number of periods long loops.
  duration: () => 0,
  build(el, props, p, ctx) {
    const inner = el.ownerDocument.createElement('span');
    inner.textContent = str(props.text);
    const band = num(p.band), period = Math.max(0.2, num(p.period)), dim = 100 - Math.round(num(p.strength) * 100);
    const ease = ctx.ease('sine.inOut');
    // The text is the gradient: dimmed colour everywhere, full colour in the band.
    inner.style.cssText = 'display:inline-block;white-space:pre-line;-webkit-background-clip:text;background-clip:text;' +
      `background-image:linear-gradient(100deg, color-mix(in srgb, currentColor ${dim}%, transparent) 0%, color-mix(in srgb, currentColor ${dim}%, transparent) ${50 - band * 50}%, currentColor 50%, color-mix(in srgb, currentColor ${dim}%, transparent) ${50 + band * 50}%, color-mix(in srgb, currentColor ${dim}%, transparent) 100%);` +
      'background-size:300% 100%;background-repeat:no-repeat';
    // currentColor inside the gradient resolves against the span, so it keeps the layer's colour.
    inner.style.setProperty('-webkit-text-fill-color', 'transparent');
    el.appendChild(inner);
    return {
      seek(t) {
        // Each pass sweeps across, then rests off the text for the remainder of the period.
        const phase = (((t % period) + period) % period) / period;
        const k = ease(Math.min(1, phase / 0.7));
        inner.style.backgroundPosition = `${(100 - k * 100).toFixed(3)}% 0`;
      },
    };
  },
};
