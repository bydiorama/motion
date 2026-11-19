// What `motion review` measures, as pure functions over grey frames.
//
// A film is coherent when everything that moves together moves as one, and
// nothing changes from one frame to the next that did not mean to. Stills
// cannot show either: a line that wraps one way, then the other, looks fine in
// every single frame. So every pair of neighbouring frames is compared:
//
//   - The picture is cut into tiles, and each tile's shift from the frame before
//     is found by phase correlation, to a tenth of a pixel.
//   - The shifts are fitted to one camera move: a plane seen by a moving camera
//     (pan, zoom, turn and a little perspective). What the fit leaves over in a
//     tile is that tile moving on its own.
//   - The camera's own motion must not turn back and forth (wiggle), jump for a
//     frame and stop (jump), or stall for a frame mid-move (stall). Tiles must not
//     shake against the camera (floating).
//   - Light must not blink: a frame unlike both neighbours while they agree
//     (blip), brightness that flips up and down every frame (flicker), and fine
//     detail that crawls while the picture holds still (shimmer).
//
// All sizes in findings are in pixels of the source frame, scaled to a frame
// 1080 px on its shorter side, so thresholds mean the same at any resolution.
import { fft2 } from './fft.ts';

/** Pixels per analysis pixel are rescaled to this short side for every threshold. */
export const REFERENCE_SHORT = 1080;

export const THRESHOLDS = {
  /** A camera reversal counts when both steps are at least this (px at 1080). */
  wiggle: 1.5,
  /** A step at least this big (px at 1080) and 3× its neighbours is a candidate jump. */
  jump: 3,
  /** A tile shaking against the camera by at least this much (px at 1080), turning back and forth … */
  floating: 2,
  /** … but no more than this: a bigger local motion is something animating, not the layout giving way. */
  floatingMax: 12,
  /** Only tiles that match this well, and this unambiguously, count for floating: the same content, moved, not changed. */
  floatingPeak: 0.3, floatingClarity: 2,
  /** Reversals of one tile within half a second that make it floating. */
  floatingReversals: 4,
  /** A frame differing from both neighbours by this many levels, while they are this share as far apart. */
  blip: 2, blipShare: 0.35,
  /** Brightness flipping up and down by this many levels, frame after frame, in a tile. */
  flicker: 1.5, flickerFlips: 3,
  /** Frame-to-frame change of fine detail in still tiles, in levels, held for a quarter second. */
  shimmer: 1.2,
  /** A tile holding for a frame inside a steady move of at least judderMin px a frame (at 1080), judderBeats
   *  times within half a second apart, judders; a fault when its steps are at least `judder` px. */
  judder: 1.5, judderMin: 0.6, judderBeats: 3,
  /** A pan faster than this share of the short side a frame strobes (CRAFT §7: a fortieth). */
  strobe: 1 / 40,
} as const;

export interface TileShift {
  cx: number; cy: number; dx: number; dy: number; peak: number;
  /** The best match over the best elsewhere: near 1 is ambiguous (flat or repeating content). */
  clarity: number;
  ok: boolean;
}

/** The camera between two frames, in analysis px per frame, at the frame's centre. */
export interface CameraStep {
  tx: number; ty: number;
  /** Relative change of size: 0.01 is 1% bigger per frame. */
  zoom: number;
  /** Turn, radians per frame. */
  rot: number;
}

export interface FrameStep {
  /** Index of the later frame of the pair. */
  i: number;
  tiles: TileShift[];
  /** The fitted camera, when enough tiles had texture. */
  cam?: CameraStep;
  /** Per tile: what the fit leaves over, [rx, ry] in analysis px, or undefined when the tile was not measured. */
  residual: ([number, number] | undefined)[];
  /** Mean absolute difference of the small frames, levels. */
  diff: number;
  /** Share of tiles that found a clear match. */
  matched: number;
  /** Fine-detail change in tiles that held still: median over them, levels; undefined when none held still. */
  shimmer?: number;
}

export interface Analysis {
  w: number; h: number;
  /** Output px (at 1080 short side) per analysis px. */
  scale: number;
  tiles: { x: number; y: number; cx: number; cy: number }[];
  steps: FrameStep[];
  /** Per frame, mean brightness of each tile. */
  luma: Float32Array[];
  /** d(i-1, i+1) for each i (index i), levels: how far a frame's neighbours are from each other. */
  skip: number[];
  frames: number;
}

const TILE = 64;
/** Mean step between neighbouring pixels, in levels, below which a tile has nothing to match. */
const MIN_EDGE = 1;

function hann(n: number): Float64Array {
  const w = new Float64Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    w[y * n + x] = (0.5 - 0.5 * Math.cos((2 * Math.PI * (x + 0.5)) / n)) * (0.5 - 0.5 * Math.cos((2 * Math.PI * (y + 0.5)) / n));
  }
  return w;
}

/** Tile spectra of one frame, windowed with the mean removed; null for a flat tile. */
function spectra(f: Float32Array, w: number, tiles: Analysis['tiles'], win: Float64Array) {
  return tiles.map((t) => {
    const re = new Float64Array(TILE * TILE), im = new Float64Array(TILE * TILE);
    // Texture is edges, not spread: a smooth gradient (a vignette, a glow) has spread but nothing
    // to lock onto, and a tile of it matches "no motion" whatever the picture does.
    let sum = 0, edge = 0;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const o = (t.y + y) * w + t.x + x, v = f[o]!;
      sum += v;
      if (x + 1 < TILE) edge += Math.abs(f[o + 1]! - v);
      if (y + 1 < TILE) edge += Math.abs(f[o + w]! - v);
    }
    const n = TILE * TILE, mean = sum / n;
    if (edge / (2 * (TILE - 1) * TILE) < MIN_EDGE) return null;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) re[y * TILE + x] = (f[(t.y + y) * w + t.x + x]! - mean) * win[y * TILE + x]!;
    fft2(re, im, TILE);
    return { re, im };
  });
}

/** One tile's spectrum, taken at (x, y); null when flat or outside the frame. */
function tileSpectrum(f: Float32Array, w: number, h: number, x0: number, y0: number, win: Float64Array) {
  if (x0 < 0 || y0 < 0 || x0 + TILE > w || y0 + TILE > h) return null;
  return spectra(f, w, [{ x: x0, y: y0, cx: 0, cy: 0 }], win)[0] ?? null;
}

/** How far tile content moved from a to b, by phase correlation, with a sub-pixel peak. */
export function correlate(a: { re: Float64Array; im: Float64Array }, b: { re: Float64Array; im: Float64Array }): { dx: number; dy: number; peak: number; clarity: number } {
  const N = TILE, n = N * N, cr = new Float64Array(n), ci = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    // b × conj(a), normalised: the peak of its inverse sits at the shift from a to b.
    const r = b.re[k]! * a.re[k]! + b.im[k]! * a.im[k]!, i = b.im[k]! * a.re[k]! - b.re[k]! * a.im[k]!;
    const m = Math.hypot(r, i) + 1e-12;
    cr[k] = r / m; ci[k] = i / m;
  }
  const first = peakOf(cr, ci, 0, 0);
  // Sub-pixel estimates lean toward whole pixels ("pixel locking"), so a steady 0.4 px drift reads
  // as move, hold, move: a judder that is not there. Undo the estimate in the spectrum and measure
  // what is left near zero, where the estimate is unbiased.
  const second = peakOf(cr, ci, first.dx, first.dy);
  return { dx: first.dx + second.dx, dy: first.dy + second.dy, peak: first.peak, clarity: first.clarity };
}

/** The peak of the inverse of a normalised cross-power spectrum, after taking out a shift of (sx, sy). */
function peakOf(cr: Float64Array, ci: Float64Array, sx: number, sy: number) {
  const N = TILE, n = N * N, re = new Float64Array(n), im = new Float64Array(n);
  for (let v = 0; v < N; v++) for (let u = 0; u < N; u++) {
    const k = v * N + u, fu = u > N / 2 ? u - N : u, fv = v > N / 2 ? v - N : v;
    const ang = (2 * Math.PI * (fu * sx + fv * sy)) / N, c = Math.cos(ang), s = Math.sin(ang);
    re[k] = cr[k]! * c - ci[k]! * s; im[k] = cr[k]! * s + ci[k]! * c;
  }
  fft2(re, im, N, true);
  let best = -Infinity, at = 0;
  for (let k = 0; k < n; k++) if (re[k]! > best) { best = re[k]!; at = k; }
  const px = at % N, py = Math.floor(at / N);
  // The runner-up, away from the peak (wrapping): how sure the match is.
  let second = 1e-9;
  for (let k = 0; k < n; k++) {
    const ddx = Math.abs((k % N) - px), ddy = Math.abs(Math.floor(k / N) - py);
    if (Math.min(ddx, N - ddx) <= 2 && Math.min(ddy, N - ddy) <= 2) continue;
    if (re[k]! > second) second = re[k]!;
  }
  const at2 = (x: number, y: number) => re[((y + N) % N) * N + ((x + N) % N)]!;
  // Foroosh et al. 2002: for a phase-correlation peak, the shift is the larger neighbour's share.
  const sub = (l: number, c: number, r: number) => (Math.max(l, r) <= 0 ? 0 : r > l ? r / (r + c) : -l / (l + c));
  const fx = px + sub(at2(px - 1, py), best, at2(px + 1, py)), fy = py + sub(at2(px, py - 1), best, at2(px, py + 1));
  return { dx: fx > N / 2 ? fx - N : fx, dy: fy > N / 2 ? fy - N : fy, peak: best, clarity: best / second };
}

/** Solve A x = b for a small dense system (Gaussian elimination with pivoting); null when singular. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length, M = A.map((r, i) => [...r, b[i]!]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r;
    if (Math.abs(M[p]![c]!) < 1e-12) return null;
    [M[c], M[p]] = [M[p]!, M[c]!];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]! / M[c]![c]!;
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  return M.map((r, i) => r[n]! / r[i]!);
}

/**
 * The camera move that best explains the tile shifts: a plane under a moving
 * camera, to first order (pan, zoom, turn, shear and perspective: the eight
 * terms of a linearised homography). `R` normalises positions. Weighted by each
 * tile's match strength; returns the camera, a predictor and each tile's leftover.
 */
export function fitCamera(t: { cx: number; cy: number; dx: number; dy: number; weight: number }[], R: number): Fit | null {
  const full = t.length >= 7;
  // Unknowns: full model [a0 a1 a2 b0 b1 b2 c1 c2]; similarity [tx ty s r].
  const terms = (cx: number, cy: number): [number[], number[]] => {
    const x = cx / R, y = cy / R;
    return full ? [[1, x, y, 0, 0, 0, x * x, x * y], [0, 0, 0, 1, x, y, x * y, y * y]] : [[1, 0, x, -y], [0, 1, y, x]];
  };
  const n = full ? 8 : 4;
  const A = Array.from({ length: n }, () => new Array<number>(n).fill(0)), b = new Array<number>(n).fill(0);
  for (const s of t) {
    const [ex, ey] = terms(s.cx, s.cy);
    for (const [row, v] of [[ex, s.dx], [ey, s.dy]] as [number[], number][]) {
      for (let i = 0; i < n; i++) { b[i]! += s.weight * row[i]! * v; for (let j = 0; j < n; j++) A[i]![j]! += s.weight * row[i]! * row[j]!; }
    }
  }
  const p = solve(A, b);
  if (!p) return null;
  const dot = (row: number[]) => row.reduce((s, x, i) => s + x * p[i]!, 0);
  const predict = (cx: number, cy: number): [number, number] => { const [ex, ey] = terms(cx, cy); return [dot(ex), dot(ey)]; };
  const cam: CameraStep = full
    ? { tx: p[0]!, ty: p[3]!, zoom: (p[1]! + p[5]!) / 2 / R, rot: (p[4]! - p[2]!) / 2 / R }
    : { tx: p[0]!, ty: p[1]!, zoom: p[2]! / R, rot: p[3]! / R };
  return { cam, predict, residual: t.map((s): [number, number] => { const [vx, vy] = predict(s.cx, s.cy); return [s.dx - vx, s.dy - vy]; }) };
}

export interface Fit { cam: CameraStep; predict: (cx: number, cy: number) => [number, number]; residual: [number, number][] }

/** Fits, then refits without tiles that clearly move on their own (an element entering, text streaming). */
function robustFit(tiles: TileShift[], R: number, last?: { predict: (cx: number, cy: number) => [number, number] }) {
  const ok = tiles.map((t) => ({ ...t, weight: t.peak })).filter((t) => t.ok);
  // Seed with the largest group that moves alike: a picture can hold two planes (the world under
  // the camera, and a frame or vignette fixed to the screen), and a fit across both is neither.
  // When two groups are near the same size (a panel gliding while the page holds), keep the one that
  // carries on the last frame's motion, so the fit does not swap between them frame by frame.
  const groups = ok.map((c) => ok.filter((t) => Math.hypot(t.dx - c.dx, t.dy - c.dy) <= Math.max(1.5, 0.15 * Math.hypot(c.dx, c.dy))));
  const size = Math.max(0, ...groups.map((g) => g.length));
  const off = (g: typeof ok) => (last ? g.reduce((s, t) => { const [vx, vy] = last.predict(t.cx, t.cy); return s + Math.hypot(t.dx - vx, t.dy - vy); }, 0) / g.length : 0);
  let best: typeof ok = [];
  for (const g of groups) if (g.length >= 0.75 * size && (!best.length || off(g) < off(best) - 0.5 || (Math.abs(off(g) - off(best)) <= 0.5 && g.length > best.length))) best = g;
  // No camera when no group holds half the tiles: the picture is changing, not moving, and a fit would invent a move.
  if (best.length < Math.max(4, ok.length / 2)) return undefined;
  let use = best;
  let fit = fitCamera(use, R);
  // Grow the seed to every tile the seed's model explains, so zoom and perspective are fitted across the frame.
  if (fit) {
    const f0 = fit;
    const grown = ok.filter((t) => { const [vx, vy] = f0.predict(t.cx, t.cy); return Math.hypot(t.dx - vx, t.dy - vy) <= Math.max(1, 0.1 * Math.hypot(vx, vy)); });
    if (grown.length >= use.length) { use = grown; fit = fitCamera(use, R) ?? fit; }
  }
  for (let pass = 0; pass < 2 && fit; pass++) {
    const mags = fit.residual.map(([x, y]) => Math.hypot(x, y)), sorted = [...mags].sort((a, b) => a - b);
    const cut = Math.max(0.6, 3 * sorted[Math.floor(sorted.length / 2)]!);
    const keep = use.filter((_, i) => mags[i]! <= cut);
    if (keep.length === use.length || keep.length < 4) break;
    use = keep;
    fit = fitCamera(use, R) ?? fit;
  }
  if (!fit) return undefined;
  // Leftovers for every measured tile against the final fit, kept or not.
  const f = fit;
  return { cam: f.cam, predict: (cx: number, cy: number) => f.predict(cx, cy), residual: tiles.map((t): [number, number] | undefined => { if (!t.ok) return undefined; const [vx, vy] = f.predict(t.cx, t.cy); return [t.dx - vx, t.dy - vy]; }) };
}

function smallFrame(f: Float32Array, w: number, h: number, k = 4): Float32Array {
  const sw = Math.floor(w / k), sh = Math.floor(h / k), out = new Float32Array(sw * sh);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    let s = 0;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) s += f[(y * k + j) * w + x * k + i]!;
    out[y * sw + x] = s / (k * k);
  }
  return out;
}

const meanAbs = (a: Float32Array, b: Float32Array) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i]! - b[i]!); return s / a.length; };

/** Fine detail of a tile: the tile minus its 3 × 3 average. */
function detail(f: Float32Array, w: number, t: { x: number; y: number }): Float32Array {
  const out = new Float32Array((TILE - 2) * (TILE - 2));
  for (let y = 1; y < TILE - 1; y++) for (let x = 1; x < TILE - 1; x++) {
    let s = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += f[(t.y + y + j) * w + t.x + x + i]!;
    out[(y - 1) * (TILE - 2) + x - 1] = f[(t.y + y) * w + t.x + x]! - s / 9;
  }
  return out;
}

/**
 * Takes frames one at a time (grey, w × h, levels 0–255) and keeps only what
 * the findings need, so a long film never sits in memory whole.
 */
export class Analyser {
  readonly tiles: Analysis['tiles'];
  private win = hann(TILE);
  private prev?: { spec: ReturnType<typeof spectra>; small: Float32Array; detail: (Float32Array | null)[] };
  private before: Float32Array | undefined;
  private lastFit: { predict: (cx: number, cy: number) => [number, number] } | undefined;
  private steps: FrameStep[] = [];
  private luma: Float32Array[] = [];
  private skip: number[] = [0];
  private n = 0;
  private R: number;
  readonly w: number;
  readonly h: number;
  readonly scale: number;

  constructor(w: number, h: number, scale: number) {
    this.w = w; this.h = h; this.scale = scale;
    const cols = Math.max(1, Math.floor(w / (TILE * 1.25))), rows = Math.max(1, Math.floor(h / (TILE * 1.25)));
    this.tiles = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = Math.round(((c + 0.5) * w) / cols - TILE / 2), y = Math.round(((r + 0.5) * h) / rows - TILE / 2);
      this.tiles.push({ x, y, cx: x + TILE / 2 - w / 2, cy: y + TILE / 2 - h / 2 });
    }
    this.R = Math.max(w, h) / 2;
  }

  push(f: Float32Array): void {
    const spec = spectra(f, this.w, this.tiles, this.win), small = smallFrame(f, this.w, this.h);
    const luma = new Float32Array(this.tiles.length);
    this.tiles.forEach((t, k) => { let s = 0; for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) s += f[(t.y + y) * this.w + t.x + x]!; luma[k] = s / (TILE * TILE); });
    this.luma.push(luma);
    const det = this.tiles.map((t) => detail(f, this.w, t));
    if (this.prev) {
      const p = this.prev;
      // A fast move carries content past what one tile can see; look where the last step says it went.
      const last = this.lastFit;
      const tiles: TileShift[] = this.tiles.map((t, k) => {
        const a = p.spec[k];
        const [px, py] = last ? last.predict(t.cx, t.cy).map(Math.round) as [number, number] : [0, 0];
        const far = Math.hypot(px, py) >= 6;
        const b = far ? tileSpectrum(f, this.w, this.h, t.x + px, t.y + py, this.win) : spec[k];
        if (!a || !b) return { cx: t.cx, cy: t.cy, dx: 0, dy: 0, peak: 0, clarity: 0, ok: false };
        const c = correlate(a, b);
        return { cx: t.cx, cy: t.cy, ...c, dx: c.dx + (far ? px : 0), dy: c.dy + (far ? py : 0), ok: c.peak >= 0.12 };
      });
      const fit = robustFit(tiles, this.R, this.lastFit);
      this.lastFit = fit ? { predict: fit.predict } : undefined;
      const still = tiles.map((t, k) => (t.ok && Math.hypot(t.dx, t.dy) < 0.2 ? meanAbs(det[k]!, p.detail[k]!) : -1)).filter((x) => x >= 0).sort((a, b) => a - b);
      this.steps.push({
        i: this.n, tiles, ...(fit ? { cam: fit.cam } : {}), residual: fit ? fit.residual : tiles.map(() => undefined),
        diff: meanAbs(small, p.small), matched: tiles.filter((t) => t.ok).length / Math.max(1, tiles.filter((t, k) => p.spec[k] && spec[k] && t).length),
        ...(still.length ? { shimmer: still[Math.floor(still.length / 2)]! } : {}),
      });
      if (this.before) this.skip.push(meanAbs(small, this.before));
    }
    this.before = this.prev?.small;
    this.prev = { spec, small, detail: det };
    this.n++;
  }

  result(): Analysis {
    return { w: this.w, h: this.h, scale: this.scale, tiles: this.tiles, steps: this.steps, luma: this.luma, skip: [...this.skip, 0], frames: this.n };
  }
}

export type FindingKind = 'wiggle' | 'judder' | 'jump' | 'hitch' | 'stall' | 'floating' | 'blip' | 'flicker' | 'shimmer' | 'impact' | 'strobe';

export interface Finding {
  kind: FindingKind;
  /** Frame and time of the first frame involved. */
  frame: number; t: number;
  /** Last frame involved (for runs). */
  to: number;
  /** Size in px at 1080 (motion) or levels of 255 (light). */
  size: number;
  /** Where in the frame, as % from the top-left, when it is local. */
  at?: [number, number];
  message: string;
  /** Faults fail a review; notes are reported. */
  level: 'fault' | 'note';
}

export interface FindOptions {
  fps: number;
  /** Frames at which a cut lands (the first frame of the new shot). Steps into them are not judged. */
  cuts?: number[];
  /** Frame spans of hand-overs (transitions), not judged for motion. */
  spans?: [number, number][];
}

/** The camera's motion at a frame as one vector in output px: pan plus the zoom and turn seen at the frame's edge. */
function camVec(c: CameraStep, a: Analysis): [number, number, number, number] {
  const edge = (Math.min(a.w, a.h) / 2) * a.scale;
  return [c.tx * a.scale, c.ty * a.scale, c.zoom * edge, c.rot * edge];
}

/** Cuts the video shows on its own: most tiles lose their match and the picture changes a lot. */
export function detectCuts(a: Analysis): number[] {
  return a.steps.filter((s) => s.matched < 0.3 && s.diff >= 8).map((s) => s.i);
}

export function findings(a: Analysis, o: FindOptions): Finding[] {
  const out: Finding[] = [];
  const fps = o.fps, T = THRESHOLDS;
  const cuts = new Set([...(o.cuts ?? []), ...detectCuts(a)]);
  const exempt = (i: number) => [...cuts].some((c) => i >= c - 1 && i <= c + 1) || (o.spans ?? []).some(([s, e]) => i >= s && i <= e);
  const time = (i: number) => Number((i / fps).toFixed(3));
  const v = a.steps.map((s) => (s.cam ? camVec(s.cam, a) : undefined));
  const mag = (x?: number[]) => (x ? Math.hypot(...x) : 0);

  // Judder: content that holds for a frame in the middle of a steady move, again and again. Holds
  // every other frame are an animation updating at half the frame rate; holds every few frames
  // are motion snapping to whole pixels inside a scaled layer. Judged per tile, before the camera,
  // because a fit across a picture half of which judders swings between the halves.
  const judder: [number, number][] = [];
  const shift = (k: number, t: number) => { const m = a.steps[k]?.tiles[t]; return m && m.ok && m.clarity >= T.floatingClarity ? Math.hypot(m.dx, m.dy) : undefined; };
  a.tiles.forEach((tile, t) => {
    const holds: number[] = [];
    let moved = 0;
    for (let k = 1; k + 1 < a.steps.length; k++) {
      const c = shift(k, t), p = shift(k - 1, t), n = shift(k + 1, t), i = a.steps[k]!.i;
      if (c === undefined || p === undefined || n === undefined || exempt(i) || exempt(i - 1) || exempt(i + 1)) continue;
      const near = [];
      for (let j = k - 4; j <= k + 4; j++) { const x = shift(j, t); if (x !== undefined) near.push(x); }
      if (near.length < 7) continue;
      const mean = near.reduce((x, y) => x + y, 0) / near.length;
      if (mean * a.scale < T.judderMin || c >= 0.3 * mean || p < 0.6 * mean || n < 0.6 * mean) continue;
      holds.push(k); moved = Math.max(moved, mean);
    }
    for (const run of runs(holds, Math.round(fps * 0.5))) {
      if (run.length < T.judderBeats) continue;
      const i0 = a.steps[run[0]!]!.i - 1, i1 = a.steps[run[run.length - 1]!]!.i + 1;
      const steps = run.map((k) => Math.max(shift(k - 1, t)!, shift(k + 1, t)!)).sort((x, y) => x - y);
      const size = steps[Math.floor(steps.length / 2)]! * a.scale;
      const gaps = run.slice(1).map((k, j) => k - run[j]!), half = gaps.filter((g) => g === 2).length >= 0.6 * gaps.length;
      const same = judder.find(([s0, e0]) => i0 <= e0 + 2 && i1 >= s0 - 2);
      if (same) { same[0] = Math.min(same[0], i0); same[1] = Math.max(same[1], i1); continue; }
      judder.push([i0, i1]);
      out.push({ kind: 'judder', frame: i0, t: time(i0), to: i1, size: r1(size), at: pct(a, tile), level: size >= T.judder ? 'fault' : 'note',
        message: half
          ? `Part of the picture moves on one frame and holds on the next (steps of ${r1(size)} px): it updates at half the frame rate. Drive it from the frame clock.`
          : `Part of the picture moves in uneven steps, holding a frame ${run.length} times (steps of ${r1(size)} px): motion snapping to whole pixels, usually inside a scaled-up layer. Give the moving element its own layer (will-change: transform), or lay the page out at the final size instead of scaling it up.` });
    }
  });
  // The camera fit swings between a juddering part and a steady one, so camera wiggles and stalls
  // near a judder are its echo, not a second fault.
  const near = Math.round(fps * 0.15);
  const juddering = (i: number) => judder.some(([s, e]) => i >= s - near && i <= e + near);

  // Wiggle: a component of the camera's motion turns back while both steps are big.
  // A move that reverses on purpose eases through zero, so its steps beside the turn are small.
  const rev: number[] = [];
  for (let k = 1; k < v.length; k++) {
    const p = v[k - 1], c = v[k];
    if (!p || !c || exempt(a.steps[k]!.i) || exempt(a.steps[k - 1]!.i) || juddering(a.steps[k]!.i)) continue;
    for (let d = 0; d < 4; d++) if (p[d]! * c[d]! < 0 && Math.abs(p[d]!) >= T.wiggle && Math.abs(c[d]!) >= T.wiggle) { rev.push(k); break; }
  }
  for (const run of runs(rev, Math.round(fps * 0.3))) {
    const size = Math.max(...run.map((k) => Math.max(...v[k]!.map(Math.abs))));
    out.push({ kind: 'wiggle', frame: a.steps[run[0]!]!.i, t: time(a.steps[run[0]!]!.i), to: a.steps[run[run.length - 1]!]!.i, size: r1(size), level: 'fault',
      message: `The camera turns back and forth ${run.length} time(s) (steps up to ${r1(size)} px).` });
  }

  // Jumps, impacts and stalls.
  for (let k = 0; k < v.length; k++) {
    const c = v[k], i = a.steps[k]!.i;
    if (!c || exempt(i)) continue;
    const m = mag(c);
    // Judge a step only against measured neighbours: three before, three after.
    const before = v.slice(Math.max(0, k - 4), k).filter(Boolean), after = v.slice(k + 1, k + 5).filter(Boolean);
    if (before.length < 3 || after.length < 3 || !v[k + 1] || !v[k + 2] || !v[k + 3]) continue;
    const nb = [...before, ...after].map(mag).sort((x, y) => x - y);
    const med = nb.length ? nb[Math.floor(nb.length / 2)]! : 0;
    const prevMag = Math.max(mag(v[k - 1]), mag(v[k - 2]));
    if (m >= T.jump && m >= 3 * Math.max(med, 0.5) && m >= 2 * prevMag) {
      // Carried on: the next frames keep moving the same way, as a punch eases out. A jump moves once and stops.
      const unit = c.map((x) => x / m);
      const carried = v.slice(k + 1, k + 4).reduce((s, n) => s + (n ? Math.max(0, n.reduce((d, x, j) => d + x * unit[j]!, 0)) : 0), 0);
      if (carried >= m) out.push({ kind: 'impact', frame: i, t: time(i), to: i, size: r1(m), level: 'note', message: `A move starts at full speed (${r1(m)} px in one frame): a punch, if meant.` });
      else out.push({ kind: 'jump', frame: i, t: time(i), to: i, size: r1(m), level: 'fault', message: `The picture jumps ${r1(m)} px in one frame and stops.` });
    }
    // Hitch: a steady move that skips ahead one frame (a dropped frame, or a clock that ticked twice).
    else if (!juddering(i)) {
      const near = [v[k - 2], v[k - 1], v[k + 1], v[k + 2]];
      if (near.every(Boolean) && ![i - 2, i - 1, i + 1, i + 2].some(exempt)) {
        const ms = near.map(mag), lo = Math.min(...ms), hi = Math.max(...ms), mean = ms.reduce((x, y) => x + y, 0) / 4;
        const along = near.reduce((d, x) => d + x!.reduce((e, y, j) => e + y * c[j]!, 0), 0) / 4 / Math.max(m, 1e-9);
        if (mean >= 0.5 && hi <= 1.5 * lo && m >= 1.7 * mean && m - mean >= 0.8 && along >= 0.8 * mean)
          out.push({ kind: 'hitch', frame: i, t: time(i), to: i, size: r1(m - mean), level: 'fault',
            message: `A steady move of ${r1(mean)} px a frame skips ahead ${r1(m - mean)} px in one frame: a dropped frame, or a clock that ticked twice.` });
      }
    }
    const p = v[k - 1], n = v[k + 1];
    if (p && n && !exempt(i - 1) && !exempt(i + 1) && !juddering(i)) {
      const lo = Math.min(mag(p), mag(n));
      if (lo >= 2 && m < 0.25 * lo) out.push({ kind: 'stall', frame: i, t: time(i), to: i, size: r1(lo), level: 'fault', message: `The camera stops for one frame in the middle of a move (${r1(lo)} px steps either side): a repeated frame.` });
    }
  }

  // Strobe: a pan too fast to read as motion, or too fast to measure at all.
  const limit = T.strobe * REFERENCE_SHORT;
  const fast = a.steps.map((s, k) => {
    if (exempt(s.i)) return -1;
    if (v[k]) return Math.hypot(v[k]![0], v[k]![1]) > limit ? k : -1;
    // Unmeasured between two fast frames: faster than the tiles can follow.
    const p = v[k - 1], n = v[k + 1];
    return p && n && Math.hypot(p[0], p[1]) > limit && Math.hypot(n[0], n[1]) > limit ? k : -1;
  }).filter((k) => k >= 0);
  for (const run of runs(fast, 2)) {
    const sp = Math.max(...run.map((k) => (v[k] ? Math.hypot(v[k]![0], v[k]![1]) : 0)));
    const i0 = a.steps[run[0]!]!.i, i1 = a.steps[run[run.length - 1]!]!.i;
    out.push({ kind: 'strobe', frame: i0, t: time(i0), to: i1, size: r1(sp), level: 'note',
      message: `The picture pans ${sp ? `${r1(sp)} px` : 'too fast to measure'} a frame, over the ${Math.round(limit)} px that reads as motion: it strobes. Slow it, or blur it along the move.` });
  }

  // Floating: one tile shaking against the camera fit.
  const thr = T.floating / a.scale, max = T.floatingMax / a.scale, win = Math.round(fps * 0.5);
  const firm = (k: number, t: number) => { const s = a.steps[k]!, r = s.residual[t]; const m = s.tiles[t]!; return r && m.peak >= T.floatingPeak && m.clarity >= T.floatingClarity && Math.hypot(...r) <= max ? r : undefined; };
  a.tiles.forEach((tile, t) => {
    const flips: number[] = [];
    for (let k = 1; k < a.steps.length; k++) {
      const p = firm(k - 1, t), c = firm(k, t), i = a.steps[k]!.i;
      if (!p || !c || exempt(i) || exempt(i - 1)) continue;
      for (let d = 0; d < 2; d++) if (p[d]! * c[d]! < 0 && Math.abs(p[d]!) >= thr && Math.abs(c[d]!) >= thr) { flips.push(k); break; }
    }
    for (const run of runs(flips, win)) {
      if (run.length < T.floatingReversals) continue;
      const size = Math.max(...run.map((k) => Math.max(...a.steps[k]!.residual[t]!.map(Math.abs)))) * a.scale;
      const i0 = a.steps[run[0]!]!.i, i1 = a.steps[run[run.length - 1]!]!.i;
      out.push({ kind: 'floating', frame: i0, t: time(i0), to: i1, size: r1(size), at: pct(a, tile), level: 'fault',
        message: `Part of the picture shakes against the rest: ${run.length} reversals of up to ${r1(size)} px.` });
    }
  });

  // Blips: a frame unlike both neighbours, while they are like each other. Several close together
  // are one finding: the picture flipping between two states.
  const blips: { i: number; lo: number }[] = [];
  for (let k = 0; k + 1 < a.steps.length; k++) {
    const i = a.steps[k]!.i, dPrev = a.steps[k]!.diff, dNext = a.steps[k + 1]!.diff, across = a.skip[i] ?? 0;
    const lo = Math.min(dPrev, dNext);
    // A camera that goes there and back explains such a frame: that is a wiggle, reported above.
    const moved = v[k] && v[k + 1] && mag(v[k]) >= T.wiggle && mag(v[k + 1]) >= T.wiggle;
    if (lo >= T.blip && across < T.blipShare * lo && !moved) blips.push({ i, lo });
  }
  for (const run of runs(blips.map((b) => b.i), Math.round(fps * 0.3))) {
    const lo = Math.max(...blips.filter((b) => run.includes(b.i)).map((b) => b.lo)), i0 = run[0]!, i1 = run[run.length - 1]!;
    out.push({ kind: 'blip', frame: i0, t: time(i0), to: i1, size: r1(lo), level: 'fault',
      message: run.length === 1
        ? `One frame differs from both its neighbours by ${r1(lo)} levels while they agree: a blank, late or stray frame.`
        : `${run.length} frames each differ from both neighbours (up to ${r1(lo)} levels) while the neighbours agree: the picture flips between two states.` });
  }

  // Flicker: a tile's brightness flipping up and down, frame after frame.
  a.tiles.forEach((tile, t) => {
    let flips = 0, start = -1;
    for (let i = 2; i < a.luma.length; i++) {
      const d1 = a.luma[i - 1]![t]! - a.luma[i - 2]![t]!, d2 = a.luma[i]![t]! - a.luma[i - 1]![t]!;
      const flip = d1 * d2 < 0 && Math.abs(d1) >= T.flicker && Math.abs(d2) >= T.flicker && !exempt(i) && !exempt(i - 1);
      if (flip) { if (!flips) start = i - 2; flips++; }
      else {
        if (flips >= T.flickerFlips) out.push({ kind: 'flicker', frame: start, t: time(start), to: i - 1, size: T.flicker, at: pct(a, tile), level: 'note', message: `Brightness flips up and down ${flips} frames running.` });
        flips = 0;
      }
    }
  });

  // Shimmer: fine detail crawling where the picture holds still, for at least a quarter second.
  const sh = a.steps.map((s) => (s.shimmer !== undefined && !exempt(s.i) ? s.shimmer : 0));
  const hot = sh.map((x, k) => (x >= T.shimmer ? k : -1)).filter((k) => k >= 0);
  for (const run of runs(hot, 2)) {
    if (run.length < fps / 4) continue;
    const size = Math.max(...run.map((k) => sh[k]!));
    out.push({ kind: 'shimmer', frame: a.steps[run[0]!]!.i, t: time(a.steps[run[0]!]!.i), to: a.steps[run[run.length - 1]!]!.i, size: r1(size), level: 'note', message: `Fine detail changes by ${r1(size)} levels a frame while the picture holds still: compression noise or aliasing.` });
  }
  return out.sort((x, y) => x.frame - y.frame);
}

/** Summary numbers for the report: how still the still parts are. */
export function shimmerLevel(a: Analysis): { median: number; p95: number } {
  const s = a.steps.map((x) => x.shimmer).filter((x): x is number => x !== undefined).sort((x, y) => x - y);
  if (!s.length) return { median: 0, p95: 0 };
  return { median: r2(s[Math.floor(s.length / 2)]!), p95: r2(s[Math.floor(s.length * 0.95)]!) };
}

/** Groups sorted indices into runs where neighbours are at most `gap` apart. */
export function runs(xs: number[], gap: number): number[][] {
  const out: number[][] = [];
  for (const x of xs) {
    const last = out[out.length - 1];
    if (last && x - last[last.length - 1]! <= gap) last.push(x); else out.push([x]);
  }
  return out;
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const pct = (a: Analysis, t: { x: number; y: number }): [number, number] => [Math.round(((t.x + TILE / 2) / a.w) * 100), Math.round(((t.y + TILE / 2) / a.h) * 100)];
