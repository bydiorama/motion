// Edge fade, for the studio's plain DOM. The ui component is React; this
// is the same band with the same behaviour, ported rather than reinvented:
//   registry/ui/fade/fade.tsx         the band, its sides, depths, grounds, and the
//                                     scroll-linked strength with its scrollbar inset
//   registry/lib/fade-ramp/fade-ramp.ts  the perceptual ramp, both tables verbatim
//   registry/hooks/use-scroll-edges      scrollDistances()
// Copyright (c) 2026 Diorama (bydiorama), MIT. When ui changes the ramp, copy the
// tables again; its own tests re-derive them, these are not re-derived here.
//
// What it is: an aria-hidden span pinned to one edge of a scroll container's
// positioned parent, painting the container's own ground from transparent to
// solid. While content runs past that edge it shows; over the last band-depth of
// scroll it eases out, so the last lines arrive rather than pop. It never takes the
// pointer, and nothing interactive may sit under its solid end.

export type FadeSide = 'top' | 'bottom' | 'left' | 'right';
export type FadeSize = 'sm' | 'md' | 'lg';
export type FadeGround = 'base' | 'surface' | 'elevated' | 'sunken' | 'affix';

/** Alpha of the ground at t = i/16, from the content side (0) to the pinned edge (1). */
const LIGHT = [0, 0.007, 0.021, 0.045, 0.082, 0.138, 0.213, 0.306, 0.415, 0.531, 0.644, 0.748, 0.834, 0.901, 0.949, 0.981, 1];
/** The same profile, perceptually matched for light ink on a dark ground. */
const DARK = [0, 0.01, 0.028, 0.06, 0.108, 0.177, 0.267, 0.373, 0.488, 0.604, 0.71, 0.801, 0.873, 0.926, 0.963, 0.986, 1];

const SIDE = {
  top: { place: { left: '0', right: '0', top: '0' }, axis: 'block', toward: 'to top' },
  bottom: { place: { left: '0', right: '0', bottom: '0' }, axis: 'block', toward: 'to bottom' },
  left: { place: { top: '0', bottom: '0', left: '0' }, axis: 'inline', toward: 'to left' },
  right: { place: { top: '0', bottom: '0', right: '0' }, axis: 'inline', toward: 'to right' },
} as const;
const DEPTH: Record<FadeSize, string> = { sm: 'var(--ui-space-xl)', md: 'var(--ui-space-3xl)', lg: 'calc(var(--ui-space-4xl) * 1.5)' };
const GROUND: Record<FadeGround, string> = {
  base: 'var(--ui-bg-base)', surface: 'var(--ui-bg-surface)', elevated: 'var(--ui-bg-elevated)', sunken: 'var(--ui-bg-sunken)', affix: 'var(--ui-bg-affix)',
};

const pct = (n: number) => `${+(n * 100).toFixed(1)}%`;
function paintRamp(direction: string, ground: string): string {
  const at = (a: number) => `color-mix(in srgb, ${ground} ${pct(a)}, transparent)`;
  const stops = LIGHT.map((l, i) => {
    const d = DARK[i] ?? l;
    return `${l === d ? at(l) : `light-dark(${at(l)}, ${at(d)})`} ${+((i / 16) * 100).toFixed(2)}%`;
  });
  return `linear-gradient(${direction}, ${stops.join(', ')})`;
}

function scrollDistances(n: HTMLElement): Record<FadeSide, number> {
  const rtl = getComputedStyle(n).direction === 'rtl';
  const fromStart = Math.abs(n.scrollLeft), max = n.scrollWidth - n.clientWidth;
  const c = (x: number) => Math.max(0, x);
  return {
    top: c(n.scrollTop),
    bottom: c(n.scrollHeight - n.clientHeight - n.scrollTop),
    left: c(rtl ? max - fromStart : fromStart),
    right: c(rtl ? fromStart : max - fromStart),
  };
}

/** Hermite smoothstep: the strength eases in and out, no corner at either end. */
const ease = (p: number) => p * p * (3 - 2 * p);

export interface FadeOptions {
  side?: FadeSide;
  size?: FadeSize;
  /** The container's own ground. A fade in the wrong ground reads as a smudge. */
  ground?: FadeGround;
  /**
   * Keep this far in from the container's edges (px), for a container that draws
   * its own outline or corners: the band stays inside them. Not part of ui's Fade,
   * which leaves the container's box to the caller.
   */
  inset?: number;
  /**
   * A pinned header inside the scroller (a selector). A top fade hangs under it,
   * where content disappears, instead of veiling the header itself.
   */
  under?: string;
}

/**
 * Pins a fade to one edge of `scroller`. The band goes right after it in the DOM,
 * so the scroller's parent must be positioned and clip. Returns the band.
 */
export function fade(scroller: HTMLElement, options: FadeOptions = {}): HTMLSpanElement {
  const { side = 'bottom', size = 'md', ground = 'surface', inset = 0, under } = options;
  const at = SIDE[side];
  const band = document.createElement('span');
  band.className = 'ui-fade';
  band.setAttribute('aria-hidden', 'true');
  Object.assign(band.dataset, { slot: 'fade', side, size, ground, scrollLinked: 'true' });
  const s = band.style;
  s.cssText = 'position:absolute;pointer-events:none;z-index:1;transition:opacity var(--ui-duration-fast) var(--ui-ease-out);opacity:var(--ui-fade-band-strength)';
  for (const [k, v] of Object.entries(at.place)) s.setProperty(k, inset ? `${inset}px` : v);
  s.setProperty(at.axis === 'block' ? 'height' : 'width', 'var(--ui-fade-band-depth)');
  s.setProperty('--ui-fade-band-depth', DEPTH[size]);
  // Hidden until the first measure, so a fade never shows at an edge the content sits flush against.
  s.setProperty('--ui-fade-band-strength', '0');
  s.backgroundImage = paintRamp(at.toward, GROUND[ground]);
  scroller.after(band);

  const sync = () => {
    const depth = at.axis === 'block' ? band.offsetHeight : band.offsetWidth;
    const distance = scrollDistances(scroller)[side];
    const progress = depth > 0 ? Math.min(1, Math.max(0, distance - 1) / depth) : 0;
    s.setProperty('--ui-fade-band-strength', String(+ease(progress).toFixed(3)));

    // Keep off a classic scrollbar: inset the cross axis by whatever lies between
    // the scroller's padding box and its border box on that side. Overlay
    // scrollbars measure zero and change nothing.
    const parent = band.offsetParent;
    if (!(parent instanceof HTMLElement)) return;
    const cs = getComputedStyle(scroller), outer = scroller.getBoundingClientRect(), box = parent.getBoundingClientRect();
    const innerLeft = outer.left + scroller.clientLeft, innerRight = innerLeft + scroller.clientWidth;
    const innerBottom = outer.top + scroller.clientTop + scroller.clientHeight;
    const padLeft = box.left + parent.clientLeft, padRight = padLeft + parent.clientWidth, padBottom = box.top + parent.clientTop + parent.clientHeight;
    const px = (n: number) => `${Math.round(Math.max(n, inset) * 100) / 100}px`;
    const pinned = side === 'top' && under ? scroller.querySelector(under) : null;
    if (pinned) s.top = px(pinned.getBoundingClientRect().bottom - (box.top + parent.clientTop));
    if (at.axis === 'block') {
      const barLeft = scroller.clientLeft - parseFloat(cs.borderLeftWidth) > 0.5;
      const barRight = outer.right - parseFloat(cs.borderRightWidth) - innerRight > 0.5;
      s.left = px(barLeft ? innerLeft - padLeft : 0);
      s.right = px(barRight ? padRight - innerRight : 0);
    } else {
      const barBottom = outer.bottom - parseFloat(cs.borderBottomWidth) - innerBottom > 0.5;
      s.bottom = px(barBottom ? padBottom - innerBottom : 0);
    }
  };

  // Scroll, a resize of the scroller or of anything in it, and new content all
  // move the edge. Batched to one measure per frame.
  let queued = false;
  const queue = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; sync(); }); };
  scroller.addEventListener('scroll', queue, { passive: true });
  const resize = new ResizeObserver(queue);
  const watch = () => { resize.disconnect(); resize.observe(scroller); for (const c of scroller.children) resize.observe(c); };
  watch();
  new MutationObserver((records) => { if (records.some((r) => r.target === scroller)) watch(); queue(); }).observe(scroller, { childList: true, subtree: true });
  queue();
  return band;
}
