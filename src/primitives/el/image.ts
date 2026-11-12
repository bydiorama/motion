import { num, str, type Primitive } from '../types.ts';

export const image: Primitive = {
  slug: 'el/image',
  summary: 'A picture. The path is relative to the film file.',
  props: {
    src: { type: 'string', required: true, label: 'Image path or URL' },
    alt: { type: 'string', default: '', label: 'Description of the picture' },
  },
  params: {
    width: { type: 'number', default: 640, min: 1, max: 4000, step: 1, unit: 'px', label: 'Width' },
    radius: { type: 'number', default: 16, min: 0, max: 400, step: 1, unit: 'px', label: 'Corner radius' },
  },
  duration: () => 0,
  build(el, props, params) {
    const img = document.createElement('img');
    img.src = str(props.src);
    img.alt = str(props.alt);
    img.decoding = 'sync';
    img.style.cssText = `display:block;width:${num(params.width)}px;height:auto;border-radius:${num(params.radius)}px`;
    el.appendChild(img);
    return { seek() {} };
  },
};
