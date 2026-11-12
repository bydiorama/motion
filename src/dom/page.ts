// The page contract. A page that calls startPage exposes
//
//   window.ready     a promise: fonts loaded, images decoded, frame 0 drawn
//   window.duration  seconds; duration × fps is a whole number
//   window.fps
//   window.seek(t)   draws the exact frame at t, in any order
//   window.audit(t)  where every layer sits at t
//
// and, opened with #render, draws at the film's own pixel size with no controls.
// This is the same contract bydiorama/ui's ui-video-render skill reads, so its
// renderer and this library's own `motion render` accept the same page.
import type { Film, Tune } from '../film/types.ts';
import { mount, type LayerBox, type Mounted, type MountOptions } from './mount.ts';

declare global {
  interface Window {
    ready: Promise<boolean>;
    duration: number;
    fps: number;
    seek: (t: number) => void;
    audit: (t: number) => LayerBox[];
    motion: Mounted;
  }
}

export interface PageOptions extends Pick<MountOptions, 'slots'> {
  film: Film;
  tune?: Tune;
  host: HTMLElement;
  /** Called once the film is mounted and it is not a render: where a player or the studio attaches. */
  onInteractive?: (mounted: Mounted) => void;
}

export const isRender = (): boolean => location.hash === '#render';

export function startPage(options: PageOptions): Promise<Mounted> {
  const render = isRender();
  if (render) document.documentElement.classList.add('render');
  const result = (async () => {
    // Fonts first: primitives measure text when they build.
    await document.fonts.ready;
    const mounted = mount(options.host, options.film, {
      ...(options.tune ? { tune: options.tune } : {}), ...(options.slots ? { slots: options.slots } : {}), fixed: render,
    });
    window.motion = mounted;
    window.duration = mounted.duration;
    window.fps = mounted.fps;
    window.seek = mounted.seek;
    window.audit = mounted.audit;
    await mounted.ready;
    mounted.seek(0);
    if (!render) options.onInteractive?.(mounted);
    return mounted;
  })();
  window.ready = result.then(() => true);
  return result;
}

export interface Player { play(): void; pause(): void; toggle(): void; seek(t: number): void; readonly time: number; readonly playing: boolean; onTick(fn: (t: number) => void): void }

/**
 * Plays a mounted film on the page clock. Under reduced motion it does not start
 * on its own and rests on the poster frame.
 */
export function createPlayer(mounted: Mounted, opts: { autoplay?: boolean } = {}): Player {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const poster = mounted.film.poster ?? mounted.duration;
  let time = reduced ? poster : 0, playing = false, last = 0, raf = 0;
  const listeners: ((t: number) => void)[] = [];
  const draw = () => { mounted.seek(time); for (const fn of listeners) fn(time); };
  const frame = (now: number) => {
    if (!playing) return;
    time += (now - last) / 1000;
    last = now;
    if (time >= mounted.duration) {
      if (mounted.film.loop === false) { time = mounted.duration; playing = false; } else time %= mounted.duration;
    }
    draw();
    if (playing) raf = requestAnimationFrame(frame);
  };
  const player: Player = {
    play() { if (playing) return; if (time >= mounted.duration) time = 0; playing = true; last = performance.now(); raf = requestAnimationFrame(frame); draw(); },
    pause() { playing = false; cancelAnimationFrame(raf); draw(); },
    toggle() { if (playing) player.pause(); else player.play(); },
    seek(t) { time = Math.min(mounted.duration, Math.max(0, t)); draw(); },
    get time() { return time; },
    get playing() { return playing; },
    onTick(fn) { listeners.push(fn); },
  };
  draw();
  if (opts.autoplay !== false && !reduced) player.play();
  return player;
}
