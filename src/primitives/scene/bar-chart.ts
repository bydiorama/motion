// scene/bar-chart. See library/primitives/scene/bar-chart.md.
import { progress } from '../../core/ease.ts';
import { staggerDelays } from '../../core/stagger.ts';
import { list, num, nums, str, type Primitive } from '../types.ts';

const fmt = (v: number, decimals: number) => v.toFixed(decimals);

export const barChart: Primitive = {
  slug: 'scene/bar-chart',
  summary: 'Bars grow from the baseline one after another, each value counting up with it.',
  props: {
    values: { type: 'number[]', required: true, label: 'Bar values' },
    labels: { type: 'string[]', default: [], label: 'Bar labels, in the same order' },
    highlight: { type: 'string', default: '', label: 'Label of the one bar set in the accent' },
    suffix: { type: 'string', default: '', label: 'Text after each value, e.g. %' },
    decimals: { type: 'number', default: 0, label: 'Decimal places' },
  },
  params: {
    grow: { type: 'number', default: 0.9, min: 0.5, max: 1.4, step: 0.05, unit: 's', label: 'Time for one bar to grow' },
    stagger: { type: 'number', default: 0.07, min: 0.03, max: 0.15, step: 0.005, unit: 's', label: 'Delay between bars' },
    orientation: { type: 'choice', default: 'vertical', options: ['vertical', 'horizontal'], label: 'Bars stand or lie' },
    width: { type: 'number', default: 64, min: 30, max: 90, step: 1, unit: '% of stage width', label: 'Chart width' },
    height: { type: 'number', default: 46, min: 20, max: 75, step: 1, unit: '% of stage height', label: 'Chart height' },
  },
  // The baseline draws first (0.4 s), then the bars.
  duration: (props, p) => 0.4 + Math.max(0, nums(props.values).length - 1) * num(p.stagger) + num(p.grow),
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const values = nums(props.values), labels = list(props.labels), hi = str(props.highlight);
    const decimals = Math.max(0, Math.round(num(props.decimals))), suffix = str(props.suffix);
    const [W, H] = ctx.size, cw = (num(p.width) / 100) * W, ch = (num(p.height) / 100) * H;
    const horizontal = p.orientation === 'horizontal';
    const max = Math.max(...values.map(Math.abs), 1e-9);
    const n = values.length, gapShare = 0.32;
    el.style.cssText += `;position:relative;width:${cw}px;height:${ch}px;font-variant-numeric:tabular-nums`;
    const base = doc.createElement('div');
    base.style.cssText = `position:absolute;background:var(--m-border);${horizontal ? `left:0;top:0;bottom:0;width:2px;transform-origin:50% 0` : `left:0;right:0;bottom:0;height:2px;transform-origin:0 50%`}`;
    el.appendChild(base);
    const bars = values.map((v, i) => {
      const slot = (horizontal ? ch : cw) / n, thick = slot * (1 - gapShare), pos = i * slot + (slot * gapShare) / 2;
      const isHi = hi !== '' && labels[i] === hi;
      const bar = doc.createElement('div');
      const colour = hi === '' || isHi ? 'var(--m-bg-accent)' : 'color-mix(in srgb, var(--m-text-primary) 18%, var(--m-bg-base))';
      bar.style.cssText = horizontal
        ? `position:absolute;left:2px;top:${pos}px;height:${thick}px;width:${(Math.abs(v) / max) * (cw - 160)}px;transform-origin:0 50%;border-radius:0 ${thick * 0.12}px ${thick * 0.12}px 0;background:${colour}`
        : `position:absolute;bottom:2px;left:${pos}px;width:${thick}px;height:${(Math.abs(v) / max) * (ch - 70)}px;transform-origin:50% 100%;border-radius:${thick * 0.1}px ${thick * 0.1}px 0 0;background:${colour}`;
      const value = doc.createElement('div');
      value.style.cssText = horizontal
        ? `position:absolute;top:${pos + thick / 2}px;transform:translateY(-50%);font-size:0.62em;font-weight:600;white-space:nowrap`
        : `position:absolute;left:${pos + thick / 2}px;width:${slot}px;margin-left:${-slot / 2}px;text-align:center;font-size:0.62em;font-weight:600;white-space:nowrap`;
      if (isHi) value.style.color = 'var(--m-accent)';
      const label = doc.createElement('div');
      label.textContent = labels[i] ?? '';
      label.style.cssText = horizontal
        ? `position:absolute;right:calc(100% + 0.8em);top:${pos + thick / 2}px;transform:translateY(-50%);font-size:0.5em;color:var(--m-text-muted);white-space:nowrap`
        : `position:absolute;top:calc(100% + 0.7em);left:${pos}px;width:${thick}px;text-align:center;font-size:0.5em;color:var(--m-text-muted);white-space:nowrap`;
      el.append(bar, value, label);
      const full = horizontal ? parseFloat(bar.style.width) : parseFloat(bar.style.height);
      return { bar, value, label, v, full };
    });
    const delays = staggerDelays(n, num(p.stagger));
    const grow = num(p.grow), ease = ctx.ease('quint.out'), line = ctx.ease('quart.inOut');
    return {
      seek(t) {
        const b = progress(t, 0, 0.5, line);
        base.style.transform = horizontal ? `scaleY(${b})` : `scaleX(${b})`;
        bars.forEach((x, i) => {
          const k = progress(t, 0.4 + delays[i]!, grow, ease);
          x.bar.style.transform = horizontal ? `scaleX(${k})` : `scaleY(${k})`;
          // The value rides the top of its bar, on the same curve, and lands exactly.
          const shown = t >= 0.4 + delays[i]! + grow ? x.v : x.v * k;
          x.value.textContent = `${fmt(shown, decimals)}${suffix}`;
          const fade = Math.min(1, Math.max(0, (t - 0.4 - delays[i]!) / 0.25));
          x.value.style.opacity = fade.toFixed(3);
          if (horizontal) x.value.style.left = `${2 + x.full * k + 12}px`;
          else x.value.style.bottom = `${2 + x.full * k + 10}px`;
          x.label.style.opacity = Math.min(1, Math.max(0, (t - delays[i]! * 0.5) / 0.4)).toFixed(3);
        });
      },
    };
  },
};
