// texture/halftone-field. See library/primitives/texture/halftone-field.md.
import { progress } from '../../core/ease.ts';
import { num, str, type Primitive } from '../types.ts';

export const halftoneField: Primitive = {
  slug: 'texture/halftone-field',
  summary: 'Squares or dots sized by a gradient.',
  props: { edge: { type: 'string', default: 'top', label: 'Edge the field grows from: top or bottom' } },
  params: {
    cell: { type: 'number', default: 12, min: 8, max: 20, step: 1, unit: 'px', label: 'Cell size' },
    grow: { type: 'number', default: 1.6, min: 0, max: 4, step: 0.1, unit: 's', label: 'Time to grow in' },
    reach: { type: 'number', default: 0.6, min: 0.2, max: 1, step: 0.02, unit: 'ratio', label: 'How far into the frame it reaches' },
    strength: { type: 'number', default: 1, min: 0, max: 1, step: 0.05, unit: 'ratio', label: 'Opacity' },
  },
  duration: (_props, p) => num(p.grow),
  build(el, props, p, ctx) {
    const ease = ctx.ease(ctx.tokens.ease_enter);
    // The entry counts cells on a 1080-wide master; scale them with the stage.
    const cell = num(p.cell) * (ctx.size[0] / 1080) * 1.6, grow = num(p.grow), reach = num(p.reach);
    el.style.cssText += ';position:absolute;inset:0;max-width:none;pointer-events:none';
    // Accent colour plus one grey, on two offset grids. Drawn on a child, so the
    // layer's own enter, exit and tracks stay free to move it.
    const field = document.createElement('div');
    field.style.cssText = `position:absolute;inset:0;opacity:${num(p.strength)};` +
      `background-image:radial-gradient(circle, var(--m-accent) ${cell * 0.13}px, transparent ${cell * 0.15}px),radial-gradient(circle, var(--m-text-muted) ${cell * 0.08}px, transparent ${cell * 0.1}px);` +
      `background-size:${cell}px ${cell}px;background-position:0 0, ${cell / 2}px ${cell / 2}px${str(props.edge) === 'bottom' ? ';transform:scaleY(-1)' : ''}`;
    el.appendChild(field);
    return {
      seek(t) {
        const k = progress(t, 0, grow, ease) * reach;
        const mask = `radial-gradient(ellipse 62% 52% at 50% -6%, #000 0%, transparent ${k * 100}%)`;
        field.style.maskImage = mask;
        field.style.setProperty('-webkit-mask-image', mask);
      },
    };
  },
};
