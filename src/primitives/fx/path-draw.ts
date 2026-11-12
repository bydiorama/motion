// fx/path-draw. See library/primitives/fx/path-draw.md.
import { progress } from '../../core/ease.ts';
import { staggerDelays } from '../../core/stagger.ts';
import { list, num, str, type Primitive } from '../types.ts';

const SVG = 'http://www.w3.org/2000/svg';

export const pathDraw: Primitive = {
  slug: 'fx/path-draw',
  summary: 'Lines draw themselves along their paths, then the shapes fill.',
  props: {
    paths: { type: 'string[]', required: true, label: 'SVG path data, one path per item, drawn in order' },
    viewbox: { type: 'string', default: '0 0 100 100', label: 'SVG viewBox the paths are drawn in' },
    fill: { type: 'string', default: 'none', label: 'Fill once drawn: none, accent, primary or a CSS colour' },
  },
  params: {
    draw: { type: 'number', default: 1, min: 0.4, max: 2.5, step: 0.05, unit: 's', label: 'Time to draw one path' },
    stagger: { type: 'number', default: 0.12, min: 0, max: 0.5, step: 0.01, unit: 's', label: 'Delay between paths' },
    width: { type: 'number', default: 30, min: 4, max: 100, step: 1, unit: '% of stage width', label: 'Drawing width' },
    stroke: { type: 'number', default: 2, min: 0.5, max: 12, step: 0.25, unit: 'px', label: 'Stroke weight' },
    fill_time: { type: 'number', default: 0.4, min: 0.1, max: 1, step: 0.05, unit: 's', label: 'Time for the fill to arrive' },
  },
  duration: (props, p) => {
    const n = list(props.paths).length, fill = str(props.fill, 'none') !== 'none';
    return Math.max(0, n - 1) * num(p.stagger) + num(p.draw) + (fill ? num(p.fill_time) * 0.8 : 0);
  },
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const fillName = str(props.fill, 'none');
    const fill = fillName === 'accent' ? 'var(--m-bg-accent)' : fillName === 'primary' ? 'var(--m-text-primary)' : fillName;
    const vb = str(props.viewbox, '0 0 100 100').split(/[\s,]+/).map(Number);
    const vw = vb[2] || 100, vh = vb[3] || 100;
    const w = (num(p.width) / 100) * ctx.size[0];
    const svg = doc.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', str(props.viewbox, '0 0 100 100'));
    svg.setAttribute('width', String(w)); svg.setAttribute('height', String((w * vh) / vw));
    svg.style.cssText = 'display:block;overflow:visible';
    // Stroke weight is in stage px whatever the viewBox scale.
    const stroke = num(p.stroke) * (vw / w);
    const paths = list(props.paths).map((d) => {
      const path = doc.createElementNS(SVG, 'path');
      path.setAttribute('d', d);
      path.setAttribute('pathLength', '1');
      path.setAttribute('stroke-dasharray', '1 1');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', String(stroke));
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('fill', fillName === 'none' ? 'none' : fill);
      svg.appendChild(path);
      return path;
    });
    el.appendChild(svg);
    const delays = staggerDelays(paths.length, num(p.stagger));
    const draw = num(p.draw), fillT = num(p.fill_time);
    const ease = ctx.ease('quart.inOut'), soft = ctx.ease('cubic.out');
    return {
      seek(t) {
        paths.forEach((path, i) => {
          const k = progress(t, delays[i]!, draw, ease);
          path.setAttribute('stroke-dashoffset', (1 - k).toFixed(4));
          path.style.visibility = t < delays[i]! ? 'hidden' : 'inherit';
          if (fillName !== 'none') {
            // The fill arrives over the last fifth of the draw, then the line steps back.
            const f = progress(t, delays[i]! + draw * 0.8, fillT, soft);
            path.setAttribute('fill-opacity', f.toFixed(3));
            path.setAttribute('stroke-opacity', (1 - f).toFixed(3));
          }
        });
      },
    };
  },
};
