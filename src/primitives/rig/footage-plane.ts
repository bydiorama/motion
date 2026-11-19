// rig/footage-plane. See library/primitives/rig/footage-plane.md.
//
// The traditional pipeline: a screen is recorded flat, once, then laid on a plane
// in a scene where the camera, the depth of field and the light move. The page is
// never re-laid out to move the camera, so nothing in it can wiggle or re-wrap;
// all the motion is one rigid picture under one camera, and it stays coherent.
//
// The plane reacts to the scene's camera: tilted, it falls out of focus away from
// the focus point and catches the light on one side; zoomed out, it is drawn from a
// smaller copy of the footage so fine type does not shimmer; zoomed in, from the
// full-size one, pulled large enough for the deepest zoom. Marks recorded with the
// footage (`motion record --marks`) let camera keys and taps aim at a button in it.
import { clamp } from '../../core/ease.ts';
import { sourceTime } from '../el/video.ts';
import { frameUrl, num, str, type FrameSequence, type Primitive, type PrimitiveIssue } from '../types.ts';

type Box = [number, number, number, number];

/** A still picture rather than footage: shown as it is, with no frames to pull. */
export const isPicture = (src: string): boolean => /^data:image\/|\.(png|jpe?g|webp|avif|gif|svg)(\?|#|$)/i.test(src);

/**
 * A mark's box at source frame `i`, held from the nearest frame that has one: before the element
 * appears it is framed where it first shows, after it is gone where it was last seen.
 */
export function markBox(list: readonly (Box | null)[] | undefined, i: number): Box | undefined {
  if (!list?.length) return undefined;
  const at = Math.min(list.length - 1, Math.max(0, i));
  for (let d = 0; d < list.length; d++) {
    const back = list[at - d], fwd = list[at + d];
    if (back) return back;
    if (fwd) return fwd;
  }
  return undefined;
}

/**
 * Which copy of the footage to draw: a fractional level, 0 for the largest. Each copy is half
 * the one before; the level is the one whose width is nearest what the screen shows.
 */
export function mipLevel(widths: readonly number[], shownPx: number): number {
  if (widths.length < 2 || !(shownPx > 0)) return 0;
  return clamp(Math.log2(widths[0]! / shownPx), 0, widths.length - 1);
}

/**
 * The depth-of-field mask for a w × h plane tilted by rx, ry degrees and focused at (fx, fy):
 * a linear gradient whose alpha is how far each point is from the focal plane, over `dof` px.
 * Opaque where the blurred copy shows. Flat, it is fully clear.
 */
export function focusMask(w: number, h: number, rx: number, ry: number, fx: number, fy: number, dof: number): string {
  const sx = Math.sin((ry * Math.PI) / 180), sy = Math.sin((rx * Math.PI) / 180);
  const g = Math.hypot(sx, sy);
  if (g < 1e-4 || dof <= 0) return 'linear-gradient(transparent, transparent)';
  const ux = sx / g, uy = sy / g;
  // CSS angles: 0deg points up, 90deg right.
  const angle = (Math.atan2(ux, -uy) * 180) / Math.PI;
  const L = Math.abs(w * ux) + Math.abs(h * uy);
  const tf = ((fx - w / 2) * ux + (fy - h / 2) * uy) / L + 0.5;
  const alpha = (t: number) => Math.min(1, (Math.abs(t - tf) * L * g) / dof);
  const stops: [number, number][] = [[0, alpha(0)]];
  // Where the blur reaches full strength either side of the focus.
  const reach = dof / (L * g);
  if (tf - reach > 0) stops.push([tf - reach, 1]);
  if (tf > 0 && tf < 1) stops.push([tf, 0]);
  if (tf + reach < 1) stops.push([tf + reach, 1]);
  stops.push([1, alpha(1)]);
  return `linear-gradient(${angle.toFixed(2)}deg, ${stops.map(([t, a]) => `rgba(0,0,0,${a.toFixed(3)}) ${(t * 100).toFixed(2)}%`).join(', ')})`;
}

/**
 * How much more or less light the tilted plane catches than it does flat, -1..1, for a light
 * coming from `angle` degrees on the screen (0 from the right, 90 from below) at 45° above it.
 */
export function lightOn(rx: number, ry: number, angle: number): number {
  const r = Math.PI / 180, a = angle * r, e = Math.PI / 4;
  const n = [Math.sin(ry * r), -Math.sin(rx * r) * Math.cos(ry * r), Math.cos(rx * r) * Math.cos(ry * r)];
  const l = [Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e), Math.sin(e)];
  return (n[0]! * l[0]! + n[1]! * l[1]! + n[2]! * l[2]!) - Math.sin(e);
}

export const footagePlane: Primitive = {
  slug: 'rig/footage-plane',
  summary: 'Footage of a screen on a plane the camera moves over, with depth of field, light and marks to aim at.',
  props: {
    src: { type: 'string', required: true, label: 'Video recorded flat (motion record), or a still picture of a screen' },
    from: { type: 'number', default: 0, label: 'Source time the plane opens on, in seconds' },
    to: { type: 'number', default: 0, label: 'Source time it ends on; 0 plays on until the scene ends' },
    marks: { type: 'string', default: '', label: 'The marks file motion record --marks wrote, for camera keys ("plane#mark") and taps to aim at' },
    focus: { type: 'string', default: '', label: 'The mark the lens focuses on; the middle of the picture when empty' },
  },
  params: {
    width: { type: 'number', default: 1080, min: 100, max: 8000, step: 1, unit: 'px', label: 'Width of the plane on the stage at zoom 1' },
    radius: { type: 'number', default: 0, min: 0, max: 200, step: 1, unit: 'px', label: 'Corner radius' },
    rate: { type: 'number', default: 1, min: 0.1, max: 4, step: 0.05, unit: '×', label: 'Playback speed' },
    loop: { type: 'boolean', default: false, label: 'Wrap from "to" back to "from" until the scene ends' },
    aperture: { type: 'number', default: 6, min: 0, max: 24, step: 0.5, unit: 'px', label: 'Blur where the tilted plane is furthest out of focus (0: all sharp)' },
    depth: { type: 'number', default: 260, min: 40, max: 2000, step: 10, unit: 'px', label: 'Depth from the focal plane at which the blur is full' },
    light: { type: 'number', default: 235, min: 0, max: 360, step: 5, unit: 'deg', label: 'Where the light comes from, on the screen (0 right, 90 below, 270 above)' },
    shade: { type: 'number', default: 0.5, min: 0, max: 1, step: 0.05, unit: 'ratio', label: 'How much the tilt lights and darkens the plane' },
    sheen: { type: 'number', default: 0.06, min: 0, max: 0.3, step: 0.01, unit: 'opacity', label: 'A soft band of reflected light that slides as the plane turns' },
    shadow: { type: 'number', default: 0.35, min: 0, max: 1, step: 0.05, unit: 'opacity', label: 'The plane\'s shadow on what is behind it' },
  },
  // Footage plays for as long as the scene; its own motion is not a move.
  cues: () => [],
  duration: (props, p) => {
    const from = num(props.from), to = num(props.to);
    return p.loop === true || !(to > from) ? 0 : (to - from) / num(p.rate, 1);
  },
  check(props, p) {
    const out: PrimitiveIssue[] = [];
    const from = num(props.from), to = num(props.to);
    if (from < 0) out.push({ path: 'props.from', message: 'from is a source time in seconds, zero or more.' });
    if (to !== 0 && to <= from) out.push({ path: 'props.to', message: `to (${to} s) must come after from (${from} s).` });
    if (p.loop === true && !(to > from)) out.push({ path: 'params.loop', message: 'A loop needs both ends: set props.to after props.from.' });
    if (str(props.focus) && !str(props.marks)) out.push({ path: 'props.focus', message: 'focus names a mark, so the plane needs its marks file.', hint: 'Record with motion record --marks and set props.marks.' });
    return out;
  },
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const W = num(p.width), radius = num(p.radius);
    const levels: FrameSequence[] = ctx.frames ? [ctx.frames, ...(ctx.mips ?? [])] : [];
    const marks = ctx.frames?.marks;
    const aspect = ctx.frames ? ctx.frames.height / ctx.frames.width : marks ? marks.size[1] / marks.size[0] : 16 / 9;
    const H = W * aspect;
    el.style.cssText += ';max-width:none';
    const plane = doc.createElement('div');
    plane.style.cssText = `position:relative;width:${W}px;height:${H}px;border-radius:${radius}px;overflow:hidden;background:#000`;
    el.appendChild(plane);
    el.style.borderRadius = `${radius}px`;
    const fill = 'position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:fill';

    // The picture: a stack of copies, the nearest one to the size on screen on top of the next larger.
    let request = 0, waiting: Promise<void> = Promise.resolve();
    const imgs = levels.map(() => {
      const img = doc.createElement('img');
      img.decoding = 'sync'; img.alt = ''; img.style.cssText = `${fill};opacity:0`;
      plane.appendChild(img);
      return img;
    });
    const load = (img: HTMLImageElement, url: string) => {
      if (img.getAttribute('src') === url) return;
      img.src = url;
      const id = ++request;
      waiting = Promise.all([waiting, img.decode().catch(() => {
        if (id !== request || (img.complete && img.naturalWidth > 0)) return;
        return new Promise<void>((resolve, reject) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => reject(new Error(`Footage frame did not load: ${url}`)), { once: true });
        });
      })]).then(() => undefined);
    };
    // A still picture is shown as it is.
    if (!levels.length && isPicture(str(props.src))) {
      const img = doc.createElement('img');
      img.decoding = 'sync'; img.alt = ''; img.src = str(props.src);
      img.style.cssText = fill;
      plane.appendChild(img);
    }
    // Without pulled frames (the studio), a video element plays the footage.
    let vid: HTMLVideoElement | undefined;
    if (!levels.length && !isPicture(str(props.src))) {
      vid = doc.createElement('video');
      vid.muted = true; vid.playsInline = true; vid.preload = 'auto'; vid.src = str(props.src);
      vid.style.cssText = fill;
      plane.appendChild(vid);
    }
    // Depth of field: a blurred copy, from a small copy of the footage, shown where the plane is out of focus.
    const blurred = levels.length ? doc.createElement('img') : undefined;
    if (blurred) {
      blurred.decoding = 'sync'; blurred.alt = '';
      blurred.style.cssText = `${fill};opacity:0;filter:blur(${num(p.aperture)}px);transform:scale(1.02)`;
      plane.appendChild(blurred);
    }
    // Light: a wash that lights or shades the whole plane with its tilt, and a sliding sheen.
    const wash = doc.createElement('div');
    wash.style.cssText = `${fill};pointer-events:none`;
    const sheen = doc.createElement('div');
    sheen.style.cssText = `${fill};pointer-events:none;mix-blend-mode:screen`;
    plane.append(wash, sheen);

    const fps = marks?.fps ?? 60, k = marks ? W / marks.size[0] : 1;
    const markAt = (name: string, t: number): Box | undefined => {
      // A mark is named by its selector; "send" finds "#send" and "card" finds ".card".
      const list = marks?.marks[name] ?? marks?.marks[`#${name}`] ?? marks?.marks[`.${name}`];
      const b = markBox(list, Math.round(sourceTime(t, props, p) * fps));
      return b ? [b[0] * k, b[1] * k, b[2] * k, b[3] * k] : undefined;
    };
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const aperture = num(p.aperture), dof = num(p.depth), shade = num(p.shade), shine = num(p.sheen), shadow = num(p.shadow), lightAt = num(p.light);
    const focus = str(props.focus);
    const widths = levels.map((l) => l.width);

    return {
      seek(t) {
        const cam = ctx.cameraPose?.() ?? { scale: 1, rotateX: 0, rotateY: 0 };
        const s = sourceTime(t, props, p);
        if (levels.length) {
          // The copy nearest the size on screen, cross-faded into the next larger one.
          const lv = mipLevel(widths, W * cam.scale * dpr), lo = Math.floor(lv), hi = Math.min(levels.length - 1, lo + 1), f = lv - lo;
          imgs.forEach((img, i) => {
            const on = i === lo || (i === hi && f > 0.001);
            img.style.opacity = !on ? '0' : i === lo ? '1' : f.toFixed(3);
            img.style.zIndex = i === hi && i !== lo ? '1' : '0';
            if (on) { const seq = levels[i]!; load(img, frameUrl(seq, Math.round((s - seq.start) * seq.rate + 1e-6))); }
          });
          if (blurred) {
            const tilt = Math.hypot(cam.rotateX, cam.rotateY);
            if (aperture > 0 && tilt > 0.05) {
              const seq = levels[Math.min(levels.length - 1, hi + 1)]!;
              load(blurred, frameUrl(seq, Math.round((s - seq.start) * seq.rate + 1e-6)));
              const fb = focus ? markAt(focus, t) : undefined;
              const [fx, fy] = fb ? [fb[0] + fb[2] / 2, fb[1] + fb[3] / 2] : [W / 2, H / 2];
              const mask = focusMask(W, H, cam.rotateX, cam.rotateY, fx, fy, dof);
              blurred.style.maskImage = mask;
              blurred.style.opacity = '1';
              blurred.style.zIndex = '2';
            } else blurred.style.opacity = '0';
          }
        } else if (vid && Math.abs(vid.currentTime - s) > 0.5 / ctx.fps) vid.currentTime = s;
        // The light: brighter turned towards it, darker turned away, and a band that slides with the turn.
        const lit = lightOn(cam.rotateX, cam.rotateY, lightAt) * shade * 2;
        wash.style.background = lit >= 0 ? `rgba(255,255,255,${clamp(lit * 0.5).toFixed(3)})` : `rgba(0,0,0,${clamp(-lit).toFixed(3)})`;
        wash.style.zIndex = '3';
        const slide = 50 + cam.rotateY * 3 - cam.rotateX * 3;
        sheen.style.background = shine > 0
          ? `linear-gradient(${(lightAt + 90).toFixed(0)}deg, transparent ${(slide - 22).toFixed(1)}%, rgba(255,255,255,${shine}) ${slide.toFixed(1)}%, transparent ${(slide + 22).toFixed(1)}%)`
          : '';
        sheen.style.zIndex = '4';
        // The shadow grows as the plane lifts away from what is behind it.
        const tilt = Math.hypot(cam.rotateX, cam.rotateY);
        plane.style.boxShadow = shadow > 0 ? `0 ${(10 + tilt * 1.6).toFixed(1)}px ${(30 + tilt * 3).toFixed(1)}px rgba(0,0,0,${shadow})` : '';
        plane.style.overflow = 'hidden';
      },
      pending: () => waiting,
      markAt,
    };
  },
};
