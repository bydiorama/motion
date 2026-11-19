import { test } from 'node:test';
import assert from 'node:assert/strict';
import { focusMask, lightOn, markBox, mipLevel } from './footage-plane.ts';

test('markBox holds the nearest frame that has a box', () => {
  const list: ([number, number, number, number] | null)[] = [null, null, [10, 10, 20, 20], [12, 10, 20, 20], null];
  assert.deepEqual(markBox(list, 0), [10, 10, 20, 20]);
  assert.deepEqual(markBox(list, 3), [12, 10, 20, 20]);
  assert.deepEqual(markBox(list, 4), [12, 10, 20, 20]);
  assert.deepEqual(markBox(list, 99), [12, 10, 20, 20]);
  assert.equal(markBox([null, null], 1), undefined);
  assert.equal(markBox(undefined, 0), undefined);
});

test('mipLevel picks the copy nearest the size on screen', () => {
  const w = [4000, 2000, 1000];
  assert.equal(mipLevel(w, 4000), 0);
  assert.equal(mipLevel(w, 8000), 0);
  assert.equal(mipLevel(w, 2000), 1);
  assert.equal(mipLevel(w, 500), 2);
  assert.ok(Math.abs(mipLevel(w, 2828) - 0.5) < 0.01);
  assert.equal(mipLevel([4000], 100), 0);
});

test('focusMask is clear flat and graded tilted', () => {
  assert.equal(focusMask(1000, 600, 0, 0, 500, 300, 200), 'linear-gradient(transparent, transparent)');
  const m = focusMask(1000, 600, 0, 20, 500, 300, 120); // the edges sit 171 px from the focal plane
  // Tilted about the vertical axis: the gradient runs across, clear at the focus, opaque at the edges.
  assert.match(m, /^linear-gradient\(90\.00deg/);
  assert.match(m, /rgba\(0,0,0,0\.000\) 50\.00%/);
  assert.match(m, /rgba\(0,0,0,1\.000\) 0\.00%/);
  assert.match(m, /rgba\(0,0,0,1\.000\) 100\.00%/);
  // A shallow tilt never reaches full blur at the edges.
  const soft = focusMask(1000, 600, 0, 2, 500, 300, 200);
  const edge = Number(/rgba\(0,0,0,([\d.]+)\) 0\.00%/.exec(soft)![1]);
  assert.ok(edge > 0 && edge < 1);
});

test('lightOn: flat is neutral, turning towards the light brightens', () => {
  assert.ok(Math.abs(lightOn(0, 0, 0)) < 1e-9);
  // A light from the right (0°): rotateY(+20deg) sends the right edge back, so the face turns to the light.
  const a = lightOn(0, 20, 0), b = lightOn(0, -20, 0);
  assert.ok(a > 0 && b < 0, 'turned towards the light it brightens, away it shades');
  assert.ok(Math.abs(a) < 0.5 && Math.abs(b) < 0.5);
});
