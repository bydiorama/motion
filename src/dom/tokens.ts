// The bridge to bydiorama/ui. A page that loads a ui theme exposes its motion
// tokens as custom properties; a film reads them here, so `ui.out` in a film is
// the theme's own curve and `$ui.duration.base` is the theme's own duration.
import type { Bezier } from '../core/ease.ts';
import type { TokenOverrides } from '../tokens.ts';

const EASES = { 'ui.default': '--ui-ease-default', 'ui.in': '--ui-ease-in', 'ui.out': '--ui-ease-out', 'ui.spring': '--ui-ease-spring' } as const;
const DURATIONS = { fast: '--ui-duration-fast', base: '--ui-duration-base', slow: '--ui-duration-slow', enter: '--ui-duration-enter' } as const;

export function parseBezier(value: string): Bezier | undefined {
  const m = /cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(value);
  if (!m) return undefined;
  const n = m.slice(1, 5).map(Number);
  return n.every(Number.isFinite) ? [n[0]!, n[1]!, n[2]!, n[3]!] : undefined;
}

/** CSS time (`200ms`, `0.2s`) in seconds. */
export function parseTime(value: string): number | undefined {
  const m = /^\s*([\d.]+)(ms|s)\s*$/.exec(value);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? (m[2] === 'ms' ? n / 1000 : n) : undefined;
}

export interface UiTokens { ease: Record<string, Bezier>; tokens: TokenOverrides }

export function readUiTokens(el: Element): UiTokens {
  const css = getComputedStyle(el);
  const ease: Record<string, Bezier> = {};
  for (const [name, prop] of Object.entries(EASES)) {
    const b = parseBezier(css.getPropertyValue(prop));
    if (b) ease[name] = b;
  }
  // Under reduced motion a ui theme collapses its durations to 1 ms. A film is
  // not an interface: it shows its poster frame instead (see page.ts), and keeps
  // real timings so the poster is drawn correctly. Collapsed values are skipped.
  const duration: Record<string, number> = {};
  for (const [name, prop] of Object.entries(DURATIONS)) {
    const s = parseTime(css.getPropertyValue(prop));
    if (s !== undefined && s > 0.002) duration[name] = s;
  }
  const stagger = parseTime(css.getPropertyValue('--ui-stagger-step'));
  const ui = { ...(Object.keys(duration).length ? { duration } : {}), ...(stagger !== undefined ? { stagger } : {}) };
  return { ease, tokens: Object.keys(ui).length ? ({ ui } as TokenOverrides) : {} };
}
