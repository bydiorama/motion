import { num, str, type Primitive } from '../types.ts';

export const slot: Primitive = {
  slug: 'el/slot',
  summary: 'An empty frame the host page fills, e.g. with a rendered bydiorama/ui component.',
  props: { name: { type: 'string', required: true, label: 'Slot name the host fills' } },
  params: {
    width: { type: 'number', default: 640, min: 1, max: 4000, step: 1, unit: 'px', label: 'Width' },
    height: { type: 'number', default: 360, min: 1, max: 4000, step: 1, unit: 'px', label: 'Height' },
  },
  duration: () => 0,
  build(el, props, params, ctx) {
    const name = str(props.name);
    el.dataset.motionSlot = name;
    el.style.width = `${num(params.width)}px`;
    el.style.minHeight = `${num(params.height)}px`;
    const fill = ctx.slots[name];
    if (fill) fill(el);
    else {
      el.style.cssText += ';display:grid;place-items:center;border:2px dashed var(--m-border);border-radius:16px;font:500 24px var(--m-font-mono);color:var(--m-text-muted)';
      el.textContent = `slot: ${name}`;
    }
    return { seek() {} };
  },
};
