// fx/shape-morph. See library/primitives/fx/shape-morph.md.
import { progress } from '../../core/ease.ts';
import { lerpPoints, pointsPath, shapePoints, SHAPES } from '../../core/shapes.ts';
import { list, num, str, type Primitive } from '../types.ts';

const SVG = 'http://www.w3.org/2000/svg';
const FILL: Record<string, string> = { accent: 'var(--m-bg-accent)', primary: 'var(--m-text-primary)', surface: 'var(--m-bg-surface)', inverse: 'var(--m-bg-inverse)' };

export const shapeMorph: Primitive = {
  slug: 'fx/shape-morph',
  summary: 'One shape grows in, then turns into the next, and the next.',
  props: {
    shapes: { type: 'string[]', default: ['circle', 'squircle', 'star'], label: `Shapes in order: ${SHAPES.join(', ')}` },
    fill: { type: 'string', default: 'accent', label: 'accent, primary, surface, inverse, outline or a CSS colour' },
  },
  params: {
    hold: { type: 'number', default: 0.6, min: 0.2, max: 2, step: 0.05, unit: 's', label: 'Time each shape holds' },
    morph: { type: 'number', default: 0.7, min: 0.4, max: 1.2, step: 0.05, unit: 's', label: 'Time to turn into the next' },
    size: { type: 'number', default: 22, min: 6, max: 60, step: 0.5, unit: '% of stage width', label: 'Size' },
    turn: { type: 'number', default: 90, min: 0, max: 180, step: 5, unit: 'deg', label: 'Rotation per morph' },
  },
  duration: (props, p) => {
    const n = Math.max(1, list(props.shapes).length);
    return 0.6 + (n - 1) * (num(p.hold) + num(p.morph));
  },
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const names = list(props.shapes).length ? list(props.shapes) : ['circle'];
    const shapes = names.map((n) => shapePoints(n, 160, ctx.seed));
    const W = ctx.size[0], size = (num(p.size) / 100) * W, r = size / 2;
    const hold = num(p.hold), morph = num(p.morph), turn = num(p.turn);
    const fill = str(props.fill, 'accent');
    const svg = doc.createElementNS(SVG, 'svg');
    svg.setAttribute('width', String(size * 1.3)); svg.setAttribute('height', String(size * 1.3));
    svg.setAttribute('viewBox', `${-size * 0.65} ${-size * 0.65} ${size * 1.3} ${size * 1.3}`);
    svg.style.cssText = 'display:block;overflow:visible';
    const path = doc.createElementNS(SVG, 'path');
    if (fill === 'outline') {
      path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', String(Math.max(2, size * 0.02)));
    } else path.setAttribute('fill', FILL[fill] ?? fill);
    svg.appendChild(path);
    el.appendChild(svg);
    const grow = ctx.ease({ spring: { duration: 0.6, bounce: 0.3 } }), move = ctx.ease('quint.inOut');
    return {
      seek(t) {
        // Grow in over 0.6 s, then alternate: hold, morph.
        const g = progress(t, 0, 0.6, grow);
        const after = Math.max(0, t - 0.6), cycle = hold + morph;
        let i = Math.min(names.length - 1, Math.floor(after / cycle));
        let k = 0;
        if (i < names.length - 1) k = progress(after - i * cycle, hold, morph, move);
        else i = names.length - 1;
        const next = Math.min(names.length - 1, i + 1);
        const pts = lerpPoints(shapes[i]!, shapes[next]!, k);
        path.setAttribute('d', pointsPath(pts, 0, 0, r * Math.max(0, g)));
        path.setAttribute('transform', `rotate(${((i + k) * turn).toFixed(3)})`);
      },
    };
  },
};
