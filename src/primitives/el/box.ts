import { num, str, type Primitive } from '../types.ts';

const SURFACE: Record<string, string> = {
  base: 'var(--m-bg-base)', surface: 'var(--m-bg-surface)', sunken: 'var(--m-bg-sunken)',
  accent: 'var(--m-bg-accent)', inverse: 'var(--m-bg-inverse)',
};

export const box: Primitive = {
  slug: 'el/box',
  summary: 'A plain rectangle: a card, a rule, a colour field.',
  props: { fill: { type: 'string', default: 'surface', label: 'Surface name (base, surface, sunken, accent, inverse) or a CSS colour' } },
  params: {
    width: { type: 'number', default: 480, min: 1, max: 4000, step: 1, unit: 'px', label: 'Width' },
    height: { type: 'number', default: 270, min: 1, max: 4000, step: 1, unit: 'px', label: 'Height' },
    radius: { type: 'number', default: 16, min: 0, max: 400, step: 1, unit: 'px', label: 'Corner radius' },
  },
  duration: () => 0,
  build(el, props, params) {
    const fill = str(props.fill, 'surface');
    el.style.width = `${num(params.width)}px`;
    el.style.height = `${num(params.height)}px`;
    el.style.borderRadius = `${num(params.radius)}px`;
    el.style.background = SURFACE[fill] ?? fill;
    return { seek() {} };
  },
};
