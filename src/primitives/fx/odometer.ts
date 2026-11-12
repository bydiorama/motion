// fx/odometer. See library/primitives/fx/odometer.md.
import { clamp, progress } from '../../core/ease.ts';
import { num, str, type Primitive } from '../types.ts';

/** The digits of a value as written, with separators kept as fixed characters. */
function glyphs(value: number, decimals: number, group: boolean): string[] {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const withSep = group ? int!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : int!;
  return [...(value < 0 ? '-' : ''), ...withSep, ...(frac ? ['.', ...frac] : [])];
}

export const odometer: Primitive = {
  slug: 'fx/odometer',
  summary: 'Each digit rolls in its own column and lands on the value.',
  props: {
    value: { type: 'number', required: true, label: 'The number to land on' },
    decimals: { type: 'number', default: 0, label: 'Decimal places' },
    prefix: { type: 'string', default: '', label: 'Text before the number' },
    suffix: { type: 'string', default: '', label: 'Text after the number' },
  },
  params: {
    duration: { type: 'number', default: 1.6, min: 0.8, max: 3, step: 0.05, unit: 's', label: 'Time for the last column to land' },
    stagger: { type: 'number', default: 0.08, min: 0, max: 0.2, step: 0.01, unit: 's', label: 'Delay between columns, right to left' },
    spins: { type: 'number', default: 1, min: 0, max: 3, step: 1, unit: 'turns', label: 'Extra turns per column to its right' },
    group: { type: 'boolean', default: true, label: 'Thousands separators' },
  },
  duration: (props, p) => {
    const cols = glyphs(num(props.value), Math.max(0, Math.round(num(props.decimals))), p.group !== false).filter((g) => /\d/.test(g)).length;
    return Math.max(0, cols - 1) * num(p.stagger) + num(p.duration);
  },
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const chars = glyphs(num(props.value), Math.max(0, Math.round(num(props.decimals))), p.group !== false);
    const dur = num(p.duration), stagger = num(p.stagger), spins = Math.round(num(p.spins));
    const ease = ctx.ease('expressive.out');
    el.style.cssText += ';display:inline-flex;align-items:baseline;font-variant-numeric:tabular-nums;white-space:pre';
    const affix = (text: string) => { if (!text) return; const s = doc.createElement('span'); s.textContent = text; el.appendChild(s); };
    affix(str(props.prefix));
    const digitCount = chars.filter((c) => /\d/.test(c)).length;
    let fromRight = digitCount;
    const cols: { strip: HTMLElement; travel: number; delay: number }[] = [];
    for (const c of chars) {
      if (!/\d/.test(c)) { affix(c); continue; }
      fromRight--;
      const d = Number(c);
      // Columns further right turn more: the motion reads as one number counting up.
      const travel = d + 10 * spins * fromRight;
      const mask = doc.createElement('span');
      mask.style.cssText = 'display:inline-block;overflow:hidden;height:1.1em;line-height:1.1em;vertical-align:bottom;padding:0 0.01em';
      const strip = doc.createElement('span');
      strip.style.cssText = 'display:flex;flex-direction:column;will-change:transform';
      for (let i = 0; i <= travel; i++) {
        const g = doc.createElement('span');
        g.textContent = String(i % 10);
        g.style.cssText = 'display:block;height:1.1em;text-align:center';
        strip.appendChild(g);
      }
      mask.appendChild(strip);
      el.appendChild(mask);
      cols.push({ strip, travel, delay: fromRight * stagger });
    }
    affix(str(props.suffix));
    return {
      seek(t) {
        for (const c of cols) {
          const k = progress(t, c.delay, dur, ease);
          const pos = c.travel * k;
          c.strip.style.transform = `translateY(${(-pos * 1.1).toFixed(4)}em)`;
          // Fast columns smear a little, as they would on film.
          const speed = c.travel * (progress(t + 1 / 60, c.delay, dur, ease) - k) * 60;
          const blur = clamp(Math.abs(speed) * 0.012, 0, 0.06);
          c.strip.style.filter = blur > 0.004 ? `blur(${blur.toFixed(3)}em)` : '';
        }
      },
    };
  },
};
