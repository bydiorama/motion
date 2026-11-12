// texture/grain. See library/primitives/texture/grain.md.
import { num, type Primitive } from '../types.ts';

const SVG = 'http://www.w3.org/2000/svg';
let count = 0;

export const grain: Primitive = {
  slug: 'texture/grain',
  summary: 'Fine film grain over the frame, changing a set number of times a second.',
  props: {},
  params: {
    amount: { type: 'number', default: 0.08, min: 0.02, max: 0.25, step: 0.01, unit: 'ratio', label: 'Strength' },
    rate: { type: 'number', default: 12, min: 0, max: 24, step: 1, unit: 'per s', label: 'Changes per second (0 holds still)' },
    size: { type: 'number', default: 1, min: 0.5, max: 3, step: 0.1, unit: 'x', label: 'Grain size' },
  },
  // Ambient: it lies over the frame for as long as its scene.
  duration: () => 0,
  build(el, _props, p, ctx) {
    const doc = el.ownerDocument;
    const [W, H] = ctx.size, size = num(p.size), rate = num(p.rate);
    el.style.cssText += ';position:absolute;inset:0;max-width:none;pointer-events:none;z-index:50';
    const svg = doc.createElementNS(SVG, 'svg');
    svg.setAttribute('width', String(W)); svg.setAttribute('height', String(H));
    svg.style.cssText = `position:absolute;inset:0;opacity:${num(p.amount)};mix-blend-mode:overlay`;
    const id = `m-grain-${++count}`;
    const filter = doc.createElementNS(SVG, 'filter');
    filter.setAttribute('id', id);
    filter.setAttribute('x', '0'); filter.setAttribute('y', '0'); filter.setAttribute('width', '100%'); filter.setAttribute('height', '100%');
    const noise = doc.createElementNS(SVG, 'feTurbulence');
    noise.setAttribute('type', 'fractalNoise');
    noise.setAttribute('baseFrequency', String((0.9 / size) * (W / 1920)));
    noise.setAttribute('numOctaves', '2');
    noise.setAttribute('stitchTiles', 'stitch');
    const mono = doc.createElementNS(SVG, 'feColorMatrix');
    mono.setAttribute('type', 'saturate');
    mono.setAttribute('values', '0');
    filter.append(noise, mono);
    const rect = doc.createElementNS(SVG, 'rect');
    rect.setAttribute('width', '100%'); rect.setAttribute('height', '100%');
    rect.setAttribute('filter', `url(#${id})`);
    svg.append(filter, rect);
    el.appendChild(svg);
    return {
      seek(t) {
        // The seed is a function of time, so the same frame always has the same grain.
        const step = rate > 0 ? Math.floor(t * rate + 1e-6) : 0;
        noise.setAttribute('seed', String(ctx.seed * 1000 + step));
      },
    };
  },
};
