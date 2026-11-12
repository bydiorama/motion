// Plays preview films as thumbnails. A film is mounted only once its card is on
// screen and shows a still of its finished layout. Only the selected card plays,
// from the start, driven by one shared frame loop at the film rate. Under reduced
// motion nothing plays.
import { mount, type Mounted } from '../dom/mount.ts';
import type { Film } from '../film/types.ts';
import type { Tone } from './previews.ts';

interface Live { el: HTMLElement; host: HTMLElement; owner: HTMLElement; make: (tone: Tone) => Film; m?: Mounted; visible: boolean; playing: boolean; start: number }

const live = new Set<Live>();
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const tone = (): Tone => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
/** A short rest on the last frame before the loop starts again. */
const REST = 0.8;
let raf = 0, last = 0;

const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver((entries) => {
  for (const e of entries) {
    const t = [...live].find((x) => x.el === e.target);
    if (!t) continue;
    t.visible = e.isIntersecting;
    if (t.visible && !t.m) start(t);
  }
  loop();
}, { rootMargin: '120px' });

function start(t: Live) {
  try {
    t.m = mount(t.host, t.make(tone()));
    t.start = performance.now();
    t.playing = false;
    still(t);
  } catch {
    // A thumbnail that cannot be drawn stays an empty tile; the card still works.
    t.el.dataset.broken = '';
  }
}

/** The finished layout: the poster frame when the film names one, else the last frame. */
const still = (t: Live) => { if (t.m) t.m.seek(t.m.film.poster ?? t.m.duration); };
const selected = (t: Live) => t.owner.getAttribute('aria-pressed') === 'true';

function loop() { if (!raf) raf = requestAnimationFrame(tick); }

function tick(now: number) {
  raf = 0;
  for (const t of live) {
    if (!t.el.isConnected) { t.m?.destroy(); observer?.unobserve(t.el); live.delete(t); continue; }
  }
  if (!live.size) return;
  // Films run at 30 fps; drawing faster only costs battery.
  let busy = false;
  if (now - last >= 1000 / 31) {
    last = now;
    for (const t of live) {
      if (!t.m || !t.visible) continue;
      const play = selected(t) && !reduced();
      if (play !== t.playing) { t.playing = play; t.start = now; if (!play) still(t); }
      if (!play) continue;
      busy = true;
      const d = t.m.duration;
      t.m.seek(Math.min(d, ((now - t.start) / 1000) % (d + REST)));
    }
  } else busy = true;
  // Nothing selected is playing: stop until a card is picked or scrolled into view.
  if (busy) loop();
}

/** Call after changing which card is selected, so its thumbnail starts. */
export const wake = () => loop();

/** A thumbnail element. `make` builds the film for the page's light or dark tone; it plays while `owner` is pressed. */
export function thumb(make: (tone: Tone) => Film, owner?: HTMLElement): HTMLElement {
  const el = document.createElement('span');
  el.className = 'mw-thumb';
  el.setAttribute('aria-hidden', 'true');
  const host = document.createElement('span');
  host.className = 'mw-thumb-host';
  el.append(host);
  const t: Live = { el, host, owner: owner ?? el, make, visible: false, playing: false, start: 0 };
  live.add(t);
  if (observer) queueMicrotask(() => observer.observe(el));
  else queueMicrotask(() => { t.visible = true; start(t); loop(); });
  return el;
}
