import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fft, fft2 } from './fft.ts';
import { Analyser, findings, REFERENCE_SHORT, type FindingKind } from './measure.ts';

// Synthetic footage: a blurred noise "page" sampled at sub-pixel offsets, the way a camera sees it.
const W = 360, H = 640, PW = 900, PH = 1200;
function page(seed: number): Float32Array {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const raw = new Float32Array(PW * PH).map(() => rnd() * 255);
  // Two box blurs: detail at the scale of small type, not pixel noise.
  const blur = (src: Float32Array) => {
    const out = new Float32Array(PW * PH);
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      let t = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < PW && yy < PH) { t += src[yy * PW + xx]!; n++; }
      }
      out[y * PW + x] = t / n;
    }
    return out;
  };
  return blur(blur(raw));
}
const at = (p: Float32Array, x: number, y: number) => {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, o = y0 * PW + x0;
  return (p[o]! * (1 - fx) + p[o + 1]! * fx) * (1 - fy) + (p[o + PW]! * (1 - fx) + p[o + PW + 1]! * fx) * fy;
};
/** One frame: the page seen from (ox, oy); `local` moves one patch on its own. */
function frame(p: Float32Array, ox: number, oy: number, local?: { x: number; y: number; w: number; h: number; dx: number; dy: number }): Float32Array {
  const f = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const inside = local && x >= local.x && x < local.x + local.w && y >= local.y && y < local.y + local.h;
    f[y * W + x] = at(p, 100 + x + ox + (inside ? local.dx : 0), 100 + y + oy + (inside ? local.dy : 0));
  }
  return f;
}

const P = page(11), Q = page(97);
const FPS = 60;
/** Px at 1080 per analysis px. */
const K = REFERENCE_SHORT / W;

function review(frames: Float32Array[], cuts: number[] = []) {
  const a = new Analyser(W, H, K);
  for (const f of frames) a.push(f);
  return findings(a.result(), { fps: FPS, cuts });
}
const faults = (f: ReturnType<typeof review>, kind?: FindingKind) => f.filter((x) => x.level === 'fault' && (!kind || x.kind === kind));
const pan = (n: number, step: (i: number) => number) => {
  const out: Float32Array[] = [];
  let y = 0;
  for (let i = 0; i < n; i++) { out.push(frame(P, 0, y)); y += step(i); }
  return out;
};

test('fft: a transform and its inverse give back the input', () => {
  const re = new Float64Array([1, 2, 3, 4, 0, -1, 0.5, 2]), im = new Float64Array(8);
  const r0 = Float64Array.from(re);
  fft(re, im); fft(re, im, true);
  re.forEach((v, i) => assert.ok(Math.abs(v - r0[i]!) < 1e-9));
  const g = new Float64Array(16 * 16).map((_, i) => Math.sin(i)), gi = new Float64Array(16 * 16), g0 = Float64Array.from(g);
  fft2(g, gi, 16); fft2(g, gi, 16, true);
  g.forEach((v, i) => assert.ok(Math.abs(v - g0[i]!) < 1e-9));
});

test('a smooth pan has no faults', () => {
  const f = review(pan(40, () => 0.8));
  assert.deepEqual(faults(f), []);
});

test('a camera shaking ±1 px is a wiggle', () => {
  const frames = Array.from({ length: 30 }, (_, i) => frame(P, 0, i % 2 ? 1 / K * 3 : 0));
  assert.ok(faults(review(frames), 'wiggle').length > 0);
});

test('a blank frame in a still shot is a blip', () => {
  const frames = Array.from({ length: 20 }, (_, i) => (i === 10 ? new Float32Array(W * H).fill(20) : frame(P, 0, 0)));
  const b = faults(review(frames), 'blip');
  assert.equal(b.length, 1);
  assert.equal(b[0]!.frame, 10);
});

test('a patch shaking against a panning picture is floating', () => {
  const patch = { x: 150, y: 290, w: 90, h: 90 };
  const frames = Array.from({ length: 40 }, (_, i) => frame(P, 0, i * 0.5, { ...patch, dx: i % 2 ? 0.9 : -0.9, dy: 0 }));
  const f = faults(review(frames), 'floating');
  assert.ok(f.length > 0);
  assert.ok(f.every((x) => x.at && Math.abs(x.at[0] - 54) < 20 && Math.abs(x.at[1] - 52) < 15));
});

test('a declared cut is not a jump or a blip', () => {
  const frames = Array.from({ length: 40 }, (_, i) => (i < 20 ? frame(P, 0, i * 0.5) : frame(Q, 0, i * 0.5)));
  assert.deepEqual(faults(review(frames, [20])), []);
});

test('a steady pan that skips ahead one frame is a hitch', () => {
  const f = review(pan(40, (i) => (i === 20 ? 2 : 1)));
  const h = faults(f, 'hitch');
  assert.equal(h.length, 1);
  assert.ok(Math.abs(h[0]!.frame - 21) <= 1);
});

test('a pan updating on every other frame judders, and is named as half rate', () => {
  const f = review(pan(40, (i) => (i % 2 ? 1.2 : 0)));
  const j = faults(f, 'judder');
  assert.ok(j.length > 0);
  assert.match(j[0]!.message, /half the frame rate/);
  assert.deepEqual(faults(f, 'wiggle'), []);
});

test('sub-pixel drifts are measured without locking to whole pixels', () => {
  // 0.4 px a frame: a biased estimator reads it as move, hold, move, hold.
  const f = review(pan(40, () => 0.4));
  assert.deepEqual(faults(f), []);
  assert.deepEqual(f.filter((x) => x.kind === 'judder'), []);
});
