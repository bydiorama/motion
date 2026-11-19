import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frameAt, onScreen, type FrameKey } from './frame.ts';

const SIZE = [1920, 1080] as const;
const linear = (x: number) => x;
const key = (t: number, o: Partial<FrameKey> = {}): FrameKey => ({ t, target: [960, 540], zoom: 1, anchor: [960, 540], tilt: [0, 0], rotate: 0, ease: linear, drift: 0, ...o });
const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('the framed point stays on its anchor through a dive, a turn and a slide of the anchor', () => {
  const P: [number, number] = [1500, 300];
  const keys = [key(0, { target: P, zoom: 1, anchor: [400, 700] }), key(2, { target: P, zoom: 16, anchor: [1200, 300], rotate: 12, ease: (x) => x * x * (3 - 2 * x) })];
  for (let t = 0; t <= 2; t += 0.05) {
    const pose = frameAt(keys, t, SIZE), [x, y] = onScreen(P, pose, SIZE);
    const p = keys[1]!.ease(t / 2);
    near(x, 400 + (1200 - 400) * p, 1e-6);
    near(y, 700 + (300 - 700) * p, 1e-6);
  }
});

test('zoom travels in log space: halfway from 1 to 16 is 4', () => {
  near(frameAt([key(0, { zoom: 1 }), key(1, { zoom: 16 })], 0.5, SIZE).scale, 4);
  near(frameAt([key(0, { zoom: 0.5 }), key(1, { zoom: 2 })], 0.5, SIZE).scale, 1);
});

test('before the first key the camera holds it; after the last it holds or drifts', () => {
  const keys = [key(1, { zoom: 2 }), key(2, { zoom: 3, drift: 0.1 })];
  near(frameAt(keys, 0, SIZE).scale, 2);
  near(frameAt(keys, 2, SIZE).scale, 3);
  near(frameAt(keys, 4, SIZE).scale, 3 * 1.2);
});

test('a move between two targets carries the framed point from one to the other', () => {
  const keys = [key(0, { target: [100, 100], zoom: 2 }), key(1, { target: [900, 500], zoom: 2 })];
  const pose = frameAt(keys, 0.5, SIZE), [x, y] = onScreen([500, 300], pose, SIZE);
  near(x, 960); near(y, 540);
});

test('the tilt turns about the anchor', () => {
  const pose = frameAt([key(0, { anchor: [300, 200], tilt: [10, -20] })], 0, SIZE);
  assert.deepEqual(pose.pivot, [300 - 960, 200 - 540]);
  assert.deepEqual([pose.rotateX, pose.rotateY], [10, -20]);
});
