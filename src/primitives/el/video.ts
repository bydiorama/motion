// el/video. Footage as one layer instead of one image layer per frame.
//
// Two ways of drawing, one timing:
//   for a render (render, check, stills) the CLI pulls the frames the film
//   needs with ffmpeg, and seek swaps one image to the exact frame;
//   in the studio and a built page a <video> element is moved to the time.
// Either way the source time at t seconds into the layer is
//   from + t × rate, wrapping between from and to when it loops.
import { frameUrl, nums, num, str, type FrameSequence, type Primitive, type PrimitiveIssue } from '../types.ts';

/** The crop as [x, y, width, height] in % of the source; the whole frame when not given. */
export function cropOf(v: unknown): [number, number, number, number] {
  const c = nums(v);
  return c.length === 4 && c[2]! > 0 && c[3]! > 0 ? [c[0]!, c[1]!, c[2]!, c[3]!] : [0, 0, 100, 100];
}

/** Source seconds at `t` seconds into the layer. Pure, so the CLI extracts exactly what seek reads. */
export function sourceTime(t: number, props: Record<string, unknown>, params: Record<string, unknown>): number {
  const from = num(props.from), to = num(props.to), rate = num(params.rate, 1);
  const run = Math.max(0, t) * rate;
  if (params.loop === true && to > from) return from + (run % (to - from));
  return to > from ? Math.min(to, from + run) : from + run;
}

export const video: Primitive = {
  slug: 'el/video',
  summary: 'Footage. Plays a stretch of a video file; the path is relative to the film file.',
  props: {
    src: { type: 'string', required: true, label: 'Video path or URL' },
    from: { type: 'number', default: 0, label: 'Source time the layer opens on, in seconds' },
    to: { type: 'number', default: 0, label: 'Source time it ends on, in seconds; 0 plays on until the scene ends' },
    crop: { type: 'number[]', default: [], label: 'Part of the picture to show: [x, y, width, height] in % of the source' },
    continues: { type: 'string', default: '', label: 'Open on the frame after another video layer ends, as "scene.layer": a seamless loop through footage' },
  },
  params: {
    rate: { type: 'number', default: 1, min: 0.1, max: 4, step: 0.05, unit: '×', label: 'Playback speed' },
    loop: { type: 'boolean', default: false, label: 'Wrap from "to" back to "from" until the scene ends' },
    width: { type: 'number', default: 1280, min: 1, max: 8000, step: 1, unit: 'px', label: 'Width' },
    height: { type: 'number', default: 0, min: 0, max: 8000, step: 1, unit: 'px', label: 'Height; 0 keeps the shot\'s proportions' },
    radius: { type: 'number', default: 0, min: 0, max: 400, step: 1, unit: 'px', label: 'Corner radius' },
  },
  // Without an end the footage plays for as long as the scene: the scene's length or hold sets it.
  duration: (props, p) => {
    const from = num(props.from), to = num(props.to);
    return p.loop === true || !(to > from) ? 0 : (to - from) / num(p.rate, 1);
  },
  check(props, p) {
    const out: PrimitiveIssue[] = [];
    const from = num(props.from), to = num(props.to);
    if (from < 0) out.push({ path: 'props.from', message: 'from is a source time in seconds, zero or more.' });
    if (to !== 0 && to <= from) out.push({ path: 'props.to', message: `to (${to} s) must come after from (${from} s).`, hint: 'Leave it at 0 to play on until the scene ends.' });
    if (p.loop === true && !(to > from)) out.push({ path: 'params.loop', message: 'A loop needs both ends: set props.to after props.from.' });
    const c = nums(props.crop);
    if (c.length && (c.length !== 4 || c[2]! <= 0 || c[3]! <= 0 || c[0]! < 0 || c[1]! < 0 || c[0]! + c[2]! > 100.001 || c[1]! + c[3]! > 100.001)) {
      out.push({ path: 'props.crop', message: 'crop is [x, y, width, height] in % of the source, inside 0–100.', hint: 'For the middle half: [25, 25, 50, 50].' });
    }
    const cont = str(props.continues);
    if (cont && !/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(cont)) out.push({ path: 'props.continues', message: 'continues names a video layer as "scene.layer".' });
    if (cont && num(props.from) !== 0) {
      out.push({ path: 'props.from', message: 'from is worked out from "continues"; the value given is ignored.', hint: 'Remove from, or remove continues.' });
    }
    return out;
  },
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const [cx, cy, cw, ch] = cropOf(props.crop);
    const width = num(p.width), height = num(p.height), radius = num(p.radius);
    // The frame is a window; the picture inside it is scaled so the crop fills it.
    const frame = doc.createElement('div');
    frame.style.cssText = `position:relative;overflow:hidden;width:${width}px;border-radius:${radius}px;${height > 0 ? `height:${height}px` : 'aspect-ratio:16 / 9'}`;
    el.style.borderRadius = `${radius}px`;
    const inner = doc.createElement('div');
    inner.style.cssText = `position:absolute;left:${(-cx / cw) * 100}%;top:${(-cy / ch) * 100}%;width:${(100 / cw) * 100}%;height:${(100 / ch) * 100}%`;
    frame.appendChild(inner);
    el.appendChild(frame);
    const media = 'object-fit:fill;display:block;width:100%;height:100%';
    // Once the source size is known: with no height the window takes the crop's
    // own proportions; with both sides given, the crop is scaled about its
    // centre to fill the window without being stretched.
    const shape = (w: number, h: number) => {
      if (!(w > 0 && h > 0)) return;
      if (height <= 0) { frame.style.aspectRatio = `${(w * cw).toFixed(3)} / ${(h * ch).toFixed(3)}`; return; }
      const ratio = ((w * cw) / (h * ch)) / (width / height);
      inner.style.transformOrigin = `${cx + cw / 2}% ${cy + ch / 2}%`;
      inner.style.transform = `scale(${Math.max(1, ratio).toFixed(5)}, ${Math.max(1, 1 / ratio).toFixed(5)})`;
    };

    const frames: FrameSequence | undefined = ctx.frames;
    if (frames) {
      const img = doc.createElement('img');
      img.decoding = 'sync';
      img.alt = '';
      img.style.cssText = media;
      img.src = frameUrl(frames, 0);
      inner.appendChild(img);
      shape(frames.width, frames.height);
      let shown = 0, request = 0, waiting: Promise<void> = Promise.resolve();
      // Decoding a frame fails when a later seek swaps the image first; only the
      // latest request counts, and only a frame that truly did not load is an error.
      const loaded = (id: number, url: string): Promise<void> => img.decode().catch(() => {
        if (id !== request || (img.complete && img.naturalWidth > 0)) return;
        return new Promise<void>((resolve, reject) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => (id === request ? reject(new Error(`Video frame did not load: ${url}`)) : resolve()), { once: true });
        });
      });
      return {
        seek(t) {
          const n = Math.round((sourceTime(t, props, p) - frames.start) * frames.rate + 1e-6);
          const clamped = Math.min(frames.count - 1, Math.max(0, n));
          if (clamped === shown) return;
          shown = clamped;
          const url = frameUrl(frames, clamped);
          img.src = url;
          waiting = loaded(++request, url);
        },
        pending: () => waiting,
      };
    }

    const vid = doc.createElement('video');
    vid.muted = true;
    vid.playsInline = true;
    vid.preload = 'auto';
    vid.src = str(props.src);
    vid.style.cssText = media;
    inner.appendChild(vid);
    vid.addEventListener('loadedmetadata', () => shape(vid.videoWidth, vid.videoHeight));
    // A render without extracted frames waits for every seek; the studio lets the
    // video play while the playhead moves at real speed, and seeks only on a jump.
    const render = () => doc.documentElement.classList.contains('render');
    const rate = num(p.rate, 1);
    let waiting: Promise<void> = Promise.resolve(), lastT = -1, lastWall = 0, idle: ReturnType<typeof setTimeout> | undefined;
    const seekTo = (s: number) => {
      if (Math.abs(vid.currentTime - s) < 0.5 / ctx.fps) return;
      waiting = new Promise<void>((resolve) => {
        const done = () => { vid.removeEventListener('seeked', done); resolve(); };
        vid.addEventListener('seeked', done);
        vid.currentTime = s;
      });
    };
    return {
      seek(t) {
        const s = sourceTime(t, props, p);
        if (render()) { seekTo(s); return; }
        const now = performance.now(), dt = t - lastT, wall = (now - lastWall) / 1000;
        lastT = t; lastWall = now;
        const playing = dt > 0 && dt < 0.25 && Math.abs(dt - wall) < 0.1;
        if (playing) {
          if (Math.abs(vid.currentTime - s) > 0.2) vid.currentTime = s;
          vid.playbackRate = rate;
          if (vid.paused) void vid.play().catch(() => undefined);
          clearTimeout(idle);
          idle = setTimeout(() => vid.pause(), 120);
        } else {
          vid.pause();
          seekTo(s);
        }
      },
      pending: () => waiting,
    };
  },
};
