// Isometric drawing for film scripts.
//
// A parallel isometric view is affine: a point in the world lands on stage by a
// fixed linear map, and a move in the world is the same move on stage wherever it
// happens. So an isometric scene can be drawn once as flat SVG and animated with
// ordinary x and y tracks, and a flat drawing can be laid onto any face of it
// with one SVG matrix. The view is the one rig/layer-stack draws with `lay` at
// ISOMETRIC_LAY, `turn` -45 and `lens` 0, so pieces drawn here line up with it.
//
//   import { iso } from '@bydiorama/motion/build';
//   const [x, y] = iso.point(120, 0, 40);            // px from the world's origin on stage
//   `<g transform="${iso.matrix('floor', [-60, -60, 0])}">…</g>`  // a drawing lying on the floor
//
// World axes: x runs to the back right, y to the front right, z up. Units are
// stage px measured along the axis before the view foreshortens them.
const LAY = (54.7356 * Math.PI) / 180;
const C = Math.SQRT1_2, S = Math.SQRT1_2 * Math.cos(LAY), V = Math.sin(LAY);

export type Vec3 = readonly [number, number, number];
/**
 * A face a flat drawing can lie on. Its u runs right in the drawing and v down.
 *  floor: u along x, v along y (any height).
 *  front-right: an upright face looking to the front right; u along x, v down.
 *  front-left: an upright face looking to the front left; u along y, v down.
 */
export type IsoFace = 'floor' | 'front-right' | 'front-left';

const AXES: Record<IsoFace, [[number, number], [number, number]]> = {
  floor: [[C, -S], [C, S]],
  'front-right': [[C, -S], [0, V]],
  'front-left': [[C, S], [0, V]],
};

const f = (n: number) => Number(n.toFixed(3));

/** Where a world point is seen, in px from the world's origin on stage. */
function point(x: number, y: number, z = 0): [number, number] {
  return [(x + y) * C, (y - x) * S - z * V];
}

/** The world point on the floor at height z that is seen at stage offset [sx, sy]. */
function unproject(sx: number, sy: number, z = 0): [number, number] {
  const sum = sx / C, diff = (sy + z * V) / S;
  return [(sum - diff) / 2, (sum + diff) / 2];
}

/**
 * An SVG transform that lays a flat drawing onto a face, its top-left corner at
 * the world point `at`. `origin` is where the world's origin is in the SVG.
 */
function matrix(face: IsoFace, at: Vec3, origin: readonly [number, number] = [0, 0]): string {
  const [[a, b], [c, d]] = AXES[face];
  const [e, g] = point(...at);
  const k = (n: number) => Number(n.toFixed(6));
  return `matrix(${k(a)} ${k(b)} ${k(c)} ${k(d)} ${f(e + origin[0])} ${f(g + origin[1])})`;
}

/** SVG path data through world points, in stage px from `origin`. */
function path(points: readonly Vec3[], close = false, origin: readonly [number, number] = [0, 0]): string {
  return points.map((p, i) => {
    const [x, y] = point(...p);
    return `${i ? 'L' : 'M'}${f(x + origin[0])} ${f(y + origin[1])}`;
  }).join('') + (close ? 'Z' : '');
}

/** The corners of a rectangle on a face, from its top-left corner `at`, `w` along u and `h` along v. */
function quad(face: IsoFace, at: Vec3, w: number, h: number): Vec3[] {
  const [x, y, z] = at;
  if (face === 'floor') return [[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z]];
  if (face === 'front-right') return [[x, y, z], [x + w, y, z], [x + w, y, z - h], [x, y, z - h]];
  return [[x, y, z], [x, y + w, z], [x, y + w, z - h], [x, y, z - h]];
}

/**
 * Dots on every crossing of an isometric floor grid of `cell` px, as an SVG of
 * `w` × `h` with the world's origin at `origin` on a dot.
 */
function lattice(w: number, h: number, cell: number, origin: readonly [number, number], dot: { r?: number; color?: string } = {}): string {
  const pw = 2 * cell * C, ph = 2 * cell * S, r = dot.r ?? 1.6, color = dot.color ?? 'currentColor';
  const ox = ((origin[0] % pw) + pw) % pw, oy = ((origin[1] % ph) + ph) % ph;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><defs>`
    + `<pattern id="iso-lattice" patternUnits="userSpaceOnUse" width="${f(pw)}" height="${f(ph)}" x="${f(ox)}" y="${f(oy)}">`
    + [[0, 0], [pw, 0], [0, ph], [pw, ph], [pw / 2, ph / 2]].map(([x, y]) => `<circle cx="${f(x!)}" cy="${f(y!)}" r="${r}" fill="${color}"/>`).join('')
    + `</pattern></defs><rect width="${w}" height="${h}" fill="url(#iso-lattice)"/></svg>`;
}

export const iso = { point, unproject, matrix, path, quad, lattice, C, S, V } as const;
