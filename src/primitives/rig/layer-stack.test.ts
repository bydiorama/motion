import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ISOMETRIC_LAY, lifts as raw, project, stackEnd, type StackTiming } from './layer-stack.ts';

// Times are sums of decimals, so a landed plane can sit a rounding error off the base.
const lifts = (n: number, t: number, s: StackTiming) => raw(n, t, s).map((v) => Number(v.toFixed(9)));

const close: StackTiming = { order: 'close', start: 1, travel: 1, stagger: 0.2, apart: 1 };

test('closing starts apart and ends with every plane on the base', () => {
  assert.deepEqual(lifts(4, 0, close), [0, 1, 1, 1]);
  assert.deepEqual(lifts(4, stackEnd(4, close), close), [0, 0, 0, 0]);
  assert.equal(stackEnd(4, close), 1 + 1 + 2 * 0.2);
});

test('the lowest plane lands first and planes never pass each other', () => {
  for (let t = 0; t <= 3; t += 0.05) {
    const l = lifts(5, t, close);
    for (let i = 2; i < l.length; i++) assert.ok(l[i]! >= l[i - 1]!, `plane ${i} is below plane ${i - 1} at ${t}`);
  }
  const mid = lifts(4, 1.5, close);
  assert.ok(mid[1]! < mid[2]! && mid[2]! < mid[3]!);
});

test('opening lifts the top plane first', () => {
  const open: StackTiming = { ...close, order: 'open' };
  assert.deepEqual(lifts(4, 0, open), [0, 0, 0, 0]);
  const mid = lifts(4, 1.5, open);
  assert.ok(mid[3]! > mid[2]! && mid[2]! > mid[1]!);
  assert.deepEqual(lifts(4, stackEnd(4, open), open), [0, 1, 1, 1]);
});

test('open-close holds apart, then comes back to one', () => {
  const both: StackTiming = { ...close, order: 'open-close', start: 0 };
  const one = 1 + 2 * 0.2;
  assert.deepEqual(lifts(4, one + 0.5, both), [0, 1, 1, 1]);
  assert.deepEqual(lifts(4, stackEnd(4, both), both), [0, 0, 0, 0]);
  assert.equal(stackEnd(4, both), 2 * one + 1);
});

test('a point is seen where the planes\' lay and turn put it', () => {
  const cam = { rx: 0, ry: 0, rz: 0, zoom: 1, x: 0, y: 0 };
  const near = (a: [number, number], b: [number, number]) => assert.ok(Math.abs(a[0] - b[0]) < 1e-3 && Math.abs(a[1] - b[1]) < 1e-3, `${a} is not ${b}`);
  // Through a very long lens, lying back 60°: depth is halved on screen, height counts for sin 60°.
  const flat = { lay: 60, turn: 0, cam, P: 1e9, w: 400, h: 400 };
  near(project([100, 0, 0], flat), [100, 0]);
  near(project([0, 100, 0], flat), [0, 50]);
  near(project([0, 0, 100], flat), [0, -100 * Math.sin(Math.PI / 3)]);
  // Turned a quarter, what was across is now depth.
  near(project([100, 0, 0], { ...flat, turn: 90 }), [0, 50]);
});

test('a parallel lens draws a square isometric: diagonals 1 to √3, depth changing nothing', () => {
  const cam = { rx: 0, ry: 0, rz: 0, zoom: 1, x: 0, y: 0 };
  const iso = { lay: ISOMETRIC_LAY, turn: -45, cam, P: 0, w: 400, h: 400 };
  const [rx] = project([200, 200, 0], iso), [, fy] = project([-200, 200, 0], iso);
  assert.ok(Math.abs(rx / fy - Math.sqrt(3)) < 1e-3, `${rx / fy}`);
  // The same corner one plane up is straight above it.
  const up = project([200, 200, 100], iso), down = project([200, 200, 0], iso);
  assert.ok(Math.abs(up[0] - down[0]) < 1e-9 && up[1] < down[1]);
});
