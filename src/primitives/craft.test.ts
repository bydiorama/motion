import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveFilm } from '../film/resolve.ts';
import type { Film } from '../film/types.ts';
import { streak } from './blur.ts';
import { PRIMITIVES, TRANSITIONS } from './index.ts';
import { hash } from './texture/signal-field.ts';
import { fillLevel, fillShares } from './type/fill-text.ts';

test('a streak is the deviation of a box as long as the shutter is open', () => {
  // 60 px per frame through a half-frame shutter leaves a 30 px box: 30 / √12.
  assert.equal(streak(60, 0.5).toFixed(3), (30 / Math.sqrt(12)).toFixed(3));
  assert.equal(streak(-60, 0.5), streak(60, 0.5));
  assert.equal(streak(60, 0), 0);
});

test('fill-text: words wait dim, pass the mid stop, end full', () => {
  assert.equal(fillLevel(0, 0.35), 0.35);
  assert.equal(fillLevel(1, 0.35), 1);
  assert.ok(Math.abs(fillLevel(0.5, 0.35) - (0.35 + 0.65 * 0.55)) < 1e-9);
  for (let k = 0; k < 1; k += 0.05) assert.ok(fillLevel(k + 0.05, 0.35) >= fillLevel(k, 0.35), 'never dims back');
});

test('fill-text: words fill in reading order, all done at the end', () => {
  assert.deepEqual(fillShares(4, 0, 1), [0, 0, 0, 0]);
  assert.deepEqual(fillShares(4, 1, 1), [1, 1, 1, 1]);
  const mid = fillShares(4, 0.5, 1.5);
  for (let i = 1; i < mid.length; i++) assert.ok(mid[i]! <= mid[i - 1]!, 'an earlier word is never behind a later one');
  // soft 1: strictly one word after another, so at most one word is part-way.
  const one = fillShares(5, 0.37, 1);
  assert.ok(one.filter((v) => v > 0 && v < 1).length <= 1);
});

test('signal-field hash is deterministic and in [0, 1)', () => {
  for (let i = 0; i < 200; i++) {
    const v = hash(i, i * 7);
    assert.equal(v, hash(i, i * 7));
    assert.ok(v >= 0 && v < 1);
  }
});

test('the new primitives and transitions are registered and resolve in a film', () => {
  for (const slug of ['type/fill-text', 'texture/signal-field', 'rig/browser-window', 'fx/pin-drop']) assert.ok(PRIMITIVES[slug], slug);
  for (const slug of ['transition/camera-travel', 'transition/whip-pan', 'transition/signal-wipe', 'transition/fly-past']) assert.ok(TRANSITIONS[slug], slug);
  const film = {
    motion: '0.5', size: [1080, 1350], fps: 60,
    scenes: [
      { id: 'a', layers: [{ id: 'f', use: 'texture/signal-field' }, { id: 'l', use: 'type/fill-text', props: { text: 'One two three' } }], out: { use: 'transition/camera-travel' } },
      { id: 'b', layers: [{ id: 'w', use: 'rig/browser-window', props: { lift: [36, 54, 28, 38] } }], out: { use: 'transition/whip-pan' } },
      { id: 'c', layers: [{ id: 'p', use: 'fx/pin-drop', props: { points: [20, 30, 60, 70], labels: ['One', 'Two'] } }], out: { use: 'transition/signal-wipe' } },
      { id: 'd', length: 2, layers: [{ id: 't', use: 'el/text', props: { text: 'Hi' }, motionBlur: true }], out: { use: 'transition/fly-past' } },
      { id: 'e', layers: [], length: 2 },
    ],
  } as unknown as Film;
  const r = resolveFilm(film);
  assert.deepEqual(r.issues.filter((i) => i.level === 'error'), []);
  // The browser window waits for its lift: 80% of the move plus 0.8 s.
  assert.equal(r.timeline?.scenes[1]?.layers[0]?.duration.toFixed(2), '1.60');
  // Two places, 0.28 s apart, each 0.95 s to raise its card.
  assert.equal(r.timeline?.scenes[2]?.layers[0]?.duration.toFixed(2), '1.23');
});

test('motionBlur is true or a shutter between 0 and 1', () => {
  const film = (motionBlur: unknown) => ({ motion: '0.5', size: [100, 100], scenes: [{ id: 'a', layers: [{ id: 't', use: 'el/text', props: { text: 'x' }, motionBlur }] }] }) as unknown as Film;
  assert.ok(!resolveFilm(film(0.5)).issues.some((i) => i.code === 'bad-value'));
  assert.ok(!resolveFilm(film(true)).issues.some((i) => i.code === 'bad-value'));
  assert.ok(resolveFilm(film(2)).issues.some((i) => i.code === 'bad-value' && i.path.endsWith('motionBlur')));
  assert.ok(resolveFilm(film('yes')).issues.some((i) => i.code === 'bad-value'));
});

test('camera paths: in, out, in-out and hold reach their poses and come back', async () => {
  const { cameraAt, cameraEnd, cameraWeight } = await import('./rig/camera.ts');
  const lin = (x: number) => x;
  const p = (path: string) => ({ path, tilt: -20, pitch: 10, roll: -2, zoom: 0.8, pan_x: 10, pan_y: 0, move: 1, hold: 0.5, drift: 0 });
  assert.equal(cameraWeight(0, p('in'), lin), 0);
  assert.equal(cameraWeight(1, p('in'), lin), 1);
  assert.equal(cameraWeight(0, p('out'), lin), 1);
  assert.equal(cameraWeight(1, p('out'), lin), 0);
  assert.equal(cameraWeight(1.2, p('in-out'), lin), 1);
  assert.equal(cameraWeight(2.5, p('in-out'), lin), 0);
  assert.equal(cameraWeight(0, p('hold'), lin), 1);
  assert.deepEqual([cameraEnd(p('in')), cameraEnd(p('in-out')), cameraEnd(p('hold'))], [1, 2.5, 0]);
  const pose = cameraAt(1, p('in'), lin);
  assert.deepEqual([pose.ry, pose.rx, pose.rz, pose.zoom, pose.x], [-20, 10, -2, 0.8, 0.1]);
  // Drift relaxes the pose towards square-on, never more than half way.
  const drifted = cameraAt(30, { ...p('in'), drift: 2 }, lin);
  assert.equal(drifted.ry, -10);
});

test('tab-stack: one tab of openness is shared between neighbours', async () => {
  const { openness, openRange } = await import('./rig/tab-stack.ts');
  for (const c of [0, 0.3, 1.5, 2.99, 4]) assert.ok(Math.abs(openness(5, c).reduce((a, b) => a + b, 0) - 1) < 1e-9, `at ${c}`);
  assert.deepEqual(openRange({ items: ['a', 'b', 'c'] }), [0, 2]);
  assert.deepEqual(openRange({ items: ['a', 'b', 'c'], from: 3, to: 1 }), [2, 0]);
});
