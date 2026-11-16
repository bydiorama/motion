// el/frames: footage as one layer. A numbered run of stills plays as film: the
// frame on screen is a pure function of the layer's time, so footage scrubs,
// repeats and renders like everything else. (A <video> seeks to the nearest
// decoded frame, which is not always the same one twice.)
import { clamp } from '../../core/ease.ts';
import { num, str, type Primitive } from '../types.ts';

/** `shot/f%03d.jpg` with n = 7 is `shot/f007.jpg`. `%d` is the bare number. */
export const frameSrc = (pattern: string, n: number): string =>
  pattern.replace(/%(?:0(\d+))?d/, (_, pad?: string) => String(n).padStart(pad ? Number(pad) : 0, '0'));

/**
 * Index of the frame on screen t seconds into the layer. Holds the first frame through `delay` and the
 * last after the run. With `last` before `first` the run plays backwards.
 */
export function frameAt(t: number, p: { first: number; last: number; fps: number; rate: number; delay: number }): number {
  const played = Math.floor(Math.max(0, t - p.delay) * p.rate * p.fps + 1e-6);
  const count = Math.abs(p.last - p.first);
  return p.first + Math.sign(p.last - p.first) * clamp(played, 0, count);
}

const read = (p: Record<string, unknown>) => ({
  first: Math.round(num(p.first)), last: Math.round(num(p.last)), fps: num(p.fps, 24), rate: num(p.rate, 1), delay: num(p.delay),
});

export const frames: Primitive = {
  slug: 'el/frames',
  summary: 'Footage as a numbered run of stills, played at its own frame rate. Holds its first and last frame.',
  props: {
    src: { type: 'string', required: true, label: 'Path pattern with the frame number, e.g. footage/shot/f%03d.jpg' },
    alt: { type: 'string', default: '', label: 'Description of the footage' },
  },
  params: {
    first: { type: 'number', default: 0, min: 0, max: 100000, step: 1, unit: 'frame', label: 'First frame played' },
    last: { type: 'number', default: 23, min: 0, max: 100000, step: 1, unit: 'frame', label: 'Last frame played, then held. Before the first frame, the run plays backwards' },
    fps: { type: 'number', default: 24, min: 1, max: 120, step: 1, unit: 'fps', label: 'Frame rate the footage was shot at' },
    rate: { type: 'number', default: 1, min: 0.1, max: 4, step: 0.01, unit: '×', label: 'Playback speed' },
    delay: { type: 'number', default: 0, min: 0, max: 30, step: 0.05, unit: 's', label: 'Time held on the first frame before it plays' },
    width: { type: 'number', default: 640, min: 1, max: 4000, step: 1, unit: 'px', label: 'Width' },
    radius: { type: 'number', default: 0, min: 0, max: 400, step: 1, unit: 'px', label: 'Corner radius' },
  },
  duration: (_props, params) => {
    const p = read(params);
    return p.delay + (Math.abs(p.last - p.first) + 1) / p.fps / p.rate;
  },
  build(el, props, params) {
    const doc = el.ownerDocument, p = read(params), pattern = str(props.src);
    // Every frame sits in the same grid cell; only the current one is shown.
    el.style.cssText += `;display:grid;width:${num(params.width)}px;border-radius:${num(params.radius)}px;overflow:hidden`;
    const imgs: HTMLImageElement[] = [];
    const lo = Math.min(p.first, p.last), hi = Math.max(p.first, p.last);
    for (let n = lo; n <= hi; n++) {
      const img = doc.createElement('img');
      img.src = frameSrc(pattern, n);
      img.alt = n === p.first ? str(props.alt) : '';
      img.decoding = 'sync';
      img.style.cssText = 'grid-area:1/1;display:block;width:100%;height:auto;visibility:hidden';
      el.appendChild(img);
      imgs.push(img);
    }
    let shown = -1;
    return {
      seek(t) {
        const i = frameAt(t, p) - lo;
        if (i === shown) return;
        if (shown >= 0) imgs[shown]!.style.visibility = 'hidden';
        imgs[i]!.style.visibility = 'inherit';
        shown = i;
      },
    };
  },
};
