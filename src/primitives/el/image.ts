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
    height: { type: 'number', default: 0, min: 0, max: 4000, step: 1, unit: 'px', label: 'Height; 0 keeps the picture\'s own proportions, otherwise it is cropped to fill' },
    radius: { type: 'number', default: 16, min: 0, max: 400, step: 1, unit: 'px', label: 'Corner radius' },
    frame: { type: 'number', default: 0, min: 0, max: 24, step: 0.5, unit: 'px', label: 'Ring drawn inside the edge, in the border colour (--m-frame to change it)' },
    bevel: { type: 'number', default: 0, min: 0, max: 1, step: 0.05, unit: 'strength', label: 'A light top edge and a dark bottom edge, as on a printed card' },
  },
  duration: () => 0,
  build(el, props, params) {
    const doc = el.ownerDocument;
    const radius = `${num(params.radius)}px`;
    const img = doc.createElement('img');
    img.src = str(props.src);
    img.alt = str(props.alt);
    img.decoding = 'sync';
    const h = num(params.height);
    img.style.cssText = `display:block;width:${num(params.width)}px;height:${h > 0 ? `${h}px` : 'auto'};object-fit:cover;border-radius:${radius}`;
    el.appendChild(img);
    // The layer's own box takes the radius too, so a shadow, outline or ring
    // set on it with style.css follows the picture's corners.
    el.style.borderRadius = radius;
    const frame = num(params.frame), bevel = num(params.bevel);
    if (frame > 0 || bevel > 0) {
      const ring = doc.createElement('div');
      const shadows = [
        frame > 0 ? `inset 0 0 0 ${frame}px var(--m-frame, var(--m-border))` : '',
        bevel > 0 ? `inset 0 1px 0 rgb(255 255 255 / ${(0.55 * bevel).toFixed(3)}), inset 0 -1px 0 rgb(0 0 0 / ${(0.35 * bevel).toFixed(3)})` : '',
      ].filter(Boolean).join(', ');
      ring.style.cssText = `position:absolute;inset:0;border-radius:${radius};box-shadow:${shadows};pointer-events:none`;
      // The ring is positioned against the layer, which is relative or absolute already.
      el.appendChild(ring);
    }
    return { seek() {} };
  },
};
