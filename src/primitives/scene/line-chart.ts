// scene/line-chart. See library/primitives/scene/line-chart.md.
import { progress } from '../../core/ease.ts';
import { list, num, nums, str, type Primitive } from '../types.ts';

const SVG = 'http://www.w3.org/2000/svg';

export const lineChart: Primitive = {
  slug: 'scene/line-chart',
  summary: 'A line draws left to right behind a leading dot, the area fills, the last value lands.',
  props: {
    values: { type: 'number[]', required: true, label: 'Values, left to right' },
    labels: { type: 'string[]', default: [], label: 'Labels under the first and last points (two items), or one per point' },
    suffix: { type: 'string', default: '', label: 'Text after the end value' },
    decimals: { type: 'number', default: 0, label: 'Decimal places of the end value' },
  },
  params: {
    draw: { type: 'number', default: 2, min: 1.2, max: 3.5, step: 0.1, unit: 's', label: 'Time to draw the line' },
    width: { type: 'number', default: 70, min: 30, max: 90, step: 1, unit: '% of stage width', label: 'Chart width' },
    height: { type: 'number', default: 44, min: 20, max: 75, step: 1, unit: '% of stage height', label: 'Chart height' },
    area: { type: 'boolean', default: true, label: 'Fill under the line' },
    grid: { type: 'number', default: 4, min: 0, max: 8, step: 1, unit: 'lines', label: 'Guide lines' },
  },
  // Guides (0.5 s), then the line, then the area and the end value (0.5 s).
  duration: (_props, p) => 0.4 + num(p.draw) + 0.6,
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const values = nums(props.values), labels = list(props.labels);
    const [W, H] = ctx.size, cw = (num(p.width) / 100) * W, ch = (num(p.height) / 100) * H;
    const lo = Math.min(...values, 0), hi = Math.max(...values, 1e-9);
    const pad = ch * 0.08;
    const pts = values.map((v, i) => [values.length > 1 ? (i / (values.length - 1)) * cw : cw / 2, pad + (1 - (v - lo) / (hi - lo || 1)) * (ch - pad * 2)] as const);
    el.style.cssText += `;position:relative;width:${cw}px;height:${ch}px`;
    const svg = doc.createElementNS(SVG, 'svg');
    svg.setAttribute('width', String(cw)); svg.setAttribute('height', String(ch));
    svg.style.cssText = 'position:absolute;inset:0;overflow:visible';
    const gridCount = Math.round(num(p.grid));
    const guides = Array.from({ length: gridCount }, (_, i) => {
      const g = doc.createElementNS(SVG, 'line');
      const y = (ch * (i + 1)) / (gridCount + 1);
      g.setAttribute('x1', '0'); g.setAttribute('x2', String(cw)); g.setAttribute('y1', String(y)); g.setAttribute('y2', String(y));
      g.setAttribute('stroke', 'var(--m-border)'); g.setAttribute('stroke-width', '1.5'); g.setAttribute('stroke-dasharray', '4 8');
      svg.appendChild(g);
      return g;
    });
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join('');
    const area = doc.createElementNS(SVG, 'path');
    area.setAttribute('d', `${d}L${cw},${ch}L0,${ch}Z`);
    area.setAttribute('fill', 'color-mix(in srgb, var(--m-bg-accent) 16%, transparent)');
    const line = doc.createElementNS(SVG, 'path');
    line.setAttribute('d', d);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', 'var(--m-bg-accent)');
    line.setAttribute('stroke-width', String(Math.max(3, W * 0.0028)));
    line.setAttribute('stroke-linejoin', 'round');
    line.setAttribute('stroke-linecap', 'round');
    const dot = doc.createElementNS(SVG, 'circle');
    dot.setAttribute('r', String(W * 0.0055));
    dot.setAttribute('fill', 'var(--m-bg-accent)');
    const halo = doc.createElementNS(SVG, 'circle');
    halo.setAttribute('fill', 'color-mix(in srgb, var(--m-bg-accent) 25%, transparent)');
    if (p.area !== false) svg.appendChild(area);
    svg.append(line, halo, dot);
    el.appendChild(svg);
    const end = doc.createElement('div');
    const last = pts[pts.length - 1] ?? [0, 0];
    end.textContent = `${(values[values.length - 1] ?? 0).toFixed(Math.max(0, Math.round(num(props.decimals))))}${str(props.suffix)}`;
    end.style.cssText = `position:absolute;left:${last[0]}px;top:${last[1]}px;transform:translate(-50%, -150%);font-weight:650;color:var(--m-accent);white-space:nowrap;font-variant-numeric:tabular-nums`;
    el.appendChild(end);
    const labelEls = labels.map((text, i) => {
      const l = doc.createElement('div');
      const x = labels.length === 2 && values.length > 2 ? (i === 0 ? 0 : cw) : pts[i]?.[0] ?? 0;
      l.textContent = text;
      l.style.cssText = `position:absolute;top:calc(100% + 0.6em);left:${x}px;transform:translateX(-50%);font-size:0.5em;color:var(--m-text-muted);white-space:nowrap`;
      el.appendChild(l);
      return { l, x };
    });
    // The reveal advances at a steady speed in x, so the line reads as time passing.
    const xs = pts.map((q) => q[0]);
    const at = (x: number): readonly [number, number] => {
      if (pts.length < 2) return pts[0] ?? [0, 0];
      let i = 1;
      while (i < pts.length - 1 && xs[i]! < x) i++;
      const a = pts[i - 1]!, b = pts[i]!, k = b[0] === a[0] ? 1 : Math.min(1, Math.max(0, (x - a[0]) / (b[0] - a[0])));
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    };
    const drawT = num(p.draw), ease = ctx.ease('sine.inOut'), out = ctx.ease('expressive.out');
    return {
      seek(t) {
        guides.forEach((g, i) => g.setAttribute('opacity', progress(t, i * 0.05, 0.4, out).toFixed(3)));
        const k = progress(t, 0.4, drawT, ease), x = k * cw;
        line.style.clipPath = k >= 1 ? '' : `inset(-20px ${(cw - x).toFixed(2)}px -20px -20px)`;
        const [px, py] = at(x);
        const live = t >= 0.4;
        dot.setAttribute('cx', px.toFixed(2)); dot.setAttribute('cy', py.toFixed(2));
        dot.setAttribute('opacity', live ? '1' : '0');
        // A soft halo pulses once as the dot lands.
        const pulse = progress(t, 0.4 + drawT, 0.6, out);
        halo.setAttribute('cx', px.toFixed(2)); halo.setAttribute('cy', py.toFixed(2));
        halo.setAttribute('r', (W * 0.0055 * (1 + 2.6 * pulse)).toFixed(2));
        halo.setAttribute('opacity', (pulse > 0 ? 1 - pulse : 0).toFixed(3));
        const a = progress(t, 0.4 + drawT * 0.6, 0.6 + drawT * 0.4, out);
        area.setAttribute('opacity', a.toFixed(3));
        area.style.clipPath = `inset(0 ${(cw - x).toFixed(2)}px 0 0)`;
        const e = progress(t, 0.4 + drawT - 0.1, 0.5, out);
        end.style.opacity = e.toFixed(3);
        end.style.transform = `translate(-50%, ${(-150 + (1 - e) * 40).toFixed(2)}%)`;
        for (const { l, x: lx } of labelEls) l.style.opacity = Math.min(1, Math.max(0, (x - lx + cw * 0.08) / (cw * 0.08))).toFixed(3);
      },
    };
  },
};
