// The framing camera: keys that say "put this point of the world at that point
// of the screen, this big, tilted so", solved every frame. Moving x, y and scale
// on their own lets the target drift off its mark mid-move, because a zoom about
// the stage centre carries everything else with it; solving the translation from
// the zoom each frame keeps the framed point exactly on its anchor through the
// whole move. Zoom travels in log space, so 1 → 2 feels like 2 → 4 and a dive
// from 1 to 16 has an even pace. Tilt turns about the anchor, so it never swings
// the target away either.
/** An ease: progress 0..1 to eased progress. */
export type Ease = (x: number) => number;

/** A camera key with its target already found in the world (camera space, untransformed px). */
export interface FrameKey {
  /** Seconds from the scene start. */
  t: number;
  /** The world point to frame, px. */
  target: readonly [number, number];
  /** Size: 2 shows the world twice as big. */
  zoom: number;
  /** Where on the screen the target sits, px. */
  anchor: readonly [number, number];
  /** Degrees about x and y, turned about the anchor. */
  tilt: readonly [number, number];
  /** Degrees in the screen plane. */
  rotate: number;
  /** Shapes the move arriving at this key. */
  ease: Ease;
  /** On the last key: zoom per second, linear, from the key to the end of the scene, so the shot never comes to rest. */
  drift: number;
}

export interface FramePose {
  /** Translation of the world, px, applied about the stage centre (as the .m-cam transform). */
  x: number; y: number; scale: number; rotate: number;
  rotateX: number; rotateY: number;
  /** The tilt's pivot on the screen, px. */
  pivot: [number, number];
}

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Where the camera is at time t, for keys sorted by time, on a stage of the given size. */
export function frameAt(keys: readonly FrameKey[], t: number, size: readonly [number, number]): FramePose {
  if (!keys.length) throw new Error('frameAt needs at least one key');
  let a = keys[0]!, b = a, p = 0;
  if (t > a.t) {
    let i = 1;
    while (i < keys.length && keys[i]!.t < t) i++;
    if (i >= keys.length) { a = b = keys[keys.length - 1]!; p = 0; }
    else { a = keys[i - 1]!; b = keys[i]!; const span = b.t - a.t; p = span <= 0 ? 1 : b.ease((t - a.t) / span); }
  }
  // A drift runs on from the last key to the end of the scene.
  const drift = a === b && t > a.t ? 1 + a.drift * (t - a.t) : 1;
  const zoom = Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), p)) * Math.max(0.01, drift);
  const target: [number, number] = [lerp(a.target[0], b.target[0], p), lerp(a.target[1], b.target[1], p)];
  const anchor: [number, number] = [lerp(a.anchor[0], b.anchor[0], p), lerp(a.anchor[1], b.anchor[1], p)];
  const rotate = lerp(a.rotate, b.rotate, p);
  return {
    ...place(target, anchor, zoom, rotate, size),
    scale: zoom, rotate,
    rotateX: lerp(a.tilt[0], b.tilt[0], p), rotateY: lerp(a.tilt[1], b.tilt[1], p),
    pivot: [anchor[0] - size[0] / 2, anchor[1] - size[1] / 2],
  };
}

/**
 * The translation that puts world point P at screen point A when the world turns by `rotate`
 * degrees and scales by `zoom` about the stage centre C: A − C − R·S·(P − C).
 */
export function place(P: readonly [number, number], A: readonly [number, number], zoom: number, rotate: number, size: readonly [number, number]): { x: number; y: number } {
  const C = [size[0] / 2, size[1] / 2] as const, r = (rotate * Math.PI) / 180;
  const dx = P[0] - C[0], dy = P[1] - C[1];
  return {
    x: A[0] - C[0] - zoom * (Math.cos(r) * dx - Math.sin(r) * dy),
    y: A[1] - C[1] - zoom * (Math.sin(r) * dx + Math.cos(r) * dy),
  };
}

/** Where a world point lands on the screen under a pose without tilt: the inverse check of `place`. */
export function onScreen(P: readonly [number, number], pose: FramePose, size: readonly [number, number]): [number, number] {
  const C = [size[0] / 2, size[1] / 2] as const, r = (pose.rotate * Math.PI) / 180;
  const dx = P[0] - C[0], dy = P[1] - C[1];
  return [C[0] + pose.x + pose.scale * (Math.cos(r) * dx - Math.sin(r) * dy), C[1] + pose.y + pose.scale * (Math.sin(r) * dx + Math.cos(r) * dy)];
}

/**
 * The camera's speed at time t, as px per second at the screen's edge: how far the frame's
 * content travels, pan and zoom together. For motion blur, and for the review of a plan.
 */
export function frameSpeed(keys: readonly FrameKey[], t: number, size: readonly [number, number], dt = 1 / 120): { pan: [number, number]; zoom: number } {
  const a = frameAt(keys, t - dt / 2, size), b = frameAt(keys, t + dt / 2, size);
  return { pan: [(b.x - a.x) / dt, (b.y - a.y) / dt], zoom: Math.log(b.scale / a.scale) / dt };
}
