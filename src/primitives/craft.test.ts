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

test('el/frames: the frame on screen is a pure function of time, held at both ends', async () => {
  const { frameAt, frameSrc, frames } = await import('./el/frames.ts');
  assert.equal(frameSrc('shot/f%03d.jpg', 7), 'shot/f007.jpg');
  assert.equal(frameSrc('shot/%d.png', 12), 'shot/12.png');
  const p = { first: 10, last: 33, fps: 24, rate: 1, delay: 0.5 };
  assert.equal(frameAt(0, p), 10);
  assert.equal(frameAt(0.49, p), 10, 'holds the first frame through the delay');
  assert.equal(frameAt(0.5 + 1 / 24, p), 11);
  assert.equal(frameAt(0.5 + 0.5, p), 22);
  assert.equal(frameAt(99, p), 33, 'holds the last frame');
  assert.equal(frameAt(1, { ...p, delay: 0, rate: 0.5 }), 22, 'half speed shows half as many frames');
  // Backwards: from frame 33 down to 10, held at 10.
  const back = { first: 33, last: 10, fps: 24, rate: 2, delay: 0 };
  assert.deepEqual([frameAt(0, back), frameAt(0.25, back), frameAt(9, back)], [33, 21, 10]);
  assert.equal(frames.duration({}, back, { tokens: {} as never, seed: 1, size: [100, 100] }), 0.5);
  // 24 frames at 24 fps after half a second: the run is over at 1.5 s.
  assert.equal(frames.duration({}, p, { tokens: {} as never, seed: 1, size: [100, 100] }), 1.5);
});

test('ui/page-scroll: travels leg by leg, rests at each stop, longer legs take longer', async () => {
  const { scrollAt, legTimes } = await import('./ui/page-scroll.ts');
  const lin = (x: number) => x;
  // Legs of 20 and 80: the second is four times as long and takes twice the time.
  assert.deepEqual(legTimes([0, 20, 100], 3).map((v) => Number(v.toFixed(6))), [1, 2]);
  assert.deepEqual(legTimes([0, 50, 100], 3), [1.5, 1.5]);
  const p = { from: 0, to: 100, stops: [20], duration: 3.4, rest: 0.4, delay: 1 };
  assert.equal(scrollAt(0.5, p, lin), 0, 'waits through the delay');
  assert.equal(Number(scrollAt(1.5, p, lin).toFixed(6)), 10, 'half of the first leg');
  assert.equal(scrollAt(2.2, p, lin), 20, 'rests at the stop');
  assert.equal(Number(scrollAt(3.4, p, lin).toFixed(6)), 60, 'half of the second leg');
  assert.equal(scrollAt(9, p, lin), 100);
  for (let t = 0; t < 5; t += 0.05) assert.ok(scrollAt(t + 0.05, p, lin) >= scrollAt(t, p, lin), 'never scrolls back');
  // No stops: one leg over the whole duration.
  assert.equal(scrollAt(1, { from: 10, to: 30, stops: [], duration: 2, rest: 0.4, delay: 0 }, lin), 20);
});

test('fx/slow-push: the picture always covers its frame', async () => {
  const { pushAt } = await import('./fx/slow-push.ts');
  const p = { from: 1.02, to: 1.14, pan_x: 0, pan_y: -30 };
  for (let k = 0; k <= 1; k += 0.1) {
    const s = pushAt(k, p);
    assert.ok(s.scale >= 1);
    assert.ok(Math.abs(s.y) <= (s.scale - 1) / 2 + 1e-9, `no edge shows at ${k}`);
  }
  assert.deepEqual(pushAt(0.5, { from: 1.1, to: 1.1, pan_x: 10, pan_y: 10 }), { scale: 1.1, x: 0, y: 0 });
});
