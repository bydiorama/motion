// texture/vignette. See library/primitives/texture/vignette.md.
import { num, type Primitive } from '../types.ts';

export const vignette: Primitive = {
  slug: 'texture/vignette',
  summary: 'The frame darkens towards its edges, holding the eye on the middle. Fixed to the screen.',
  props: { color: { type: 'string', default: '#000000', label: 'CSS colour the edges darken to' } },
  params: {
    inner: { type: 'number', default: 48, min: 0, max: 90, step: 1, unit: '%', label: 'Where the darkening starts, from the centre to the corner' },
    outer: { type: 'number', default: 82, min: 10, max: 100, step: 1, unit: '%', label: 'Where it reaches its middle strength' },
    strength: { type: 'number', default: 0.85, min: 0, max: 1, step: 0.05, unit: 'ratio', label: 'Opacity at the corners' },
    mid: { type: 'number', default: 0.55, min: 0, max: 1, step: 0.05, unit: 'ratio', label: 'Opacity at `outer`' },
    center_x: { type: 'number', default: 50, min: 0, max: 100, step: 1, unit: '%', label: 'Centre, across' },
    center_y: { type: 'number', default: 46, min: 0, max: 100, step: 1, unit: '%', label: 'Centre, down: a little above the middle reads as level' },
  },
  // Ambient: there for as long as the scene.
  duration: () => 0,
  build(el, props, p) {
    const c = String(props.color ?? '#000000');
    const at = (k: number) => `color-mix(in srgb, ${c} ${Math.round(k * 100)}%, transparent)`;
    el.style.cssText += `;position:absolute;inset:0;max-width:none;pointer-events:none;background:radial-gradient(farthest-corner at ${num(p.center_x)}% ${num(p.center_y)}%, transparent ${num(p.inner)}%, ${at(num(p.mid))} ${Math.max(num(p.inner) + 1, num(p.outer))}%, ${at(num(p.strength))} 100%)`;
    return { seek() {} };
  },
};
