import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clipFor, placedRoom } from './mount.ts';

test('a mask leaves room above and below the line, and opens its sides', () => {
  // Entering from below: the window's bottom is pulled back by the travel, its top is padded.
  const entering = clipFor({ clip: [0, 0, 0, 0], yShare: 1 });
  assert.match(entering, /^inset\(calc\(-1 \* var\(--m-mask-pad, 0\.3em\)\) -100% calc\(\(100\.000% \+ 2\.0000 \* var\(--m-mask-pad, 0\.3em\)\) - var\(--m-mask-pad, 0\.3em\)\) -100%\)$/);
  // Leaving through the top: mirrored.
  const leaving = clipFor({ clip: [0, 0, 0, 0], yShare: -0.5 });
  assert.ok(leaving.startsWith('inset(calc((50.000% + 1.0000 * '), leaving);
  assert.ok(leaving.includes(') -100% calc(-1 * '), leaving);
});

test('at rest nothing is clipped, so the end of a mask cannot jump', () => {
  assert.equal(clipFor({ clip: [0, 0, 0, 0], yShare: 0 }), '');
});

test('wipes still clip at the box edge', () => {
  assert.equal(clipFor({ clip: [0.25, 0, 0, 0], yShare: 0 }), 'inset(25.000% 0.000% 0.000% 0.000%)');
});

test('a placed layer may be as wide as its anchor leaves room for', () => {
  assert.equal(placedRoom({ x: 50 }), 100);
  assert.equal(placedRoom({ x: 30 }), 60);
  assert.equal(placedRoom({ x: 10, anchor: 'top-left' }), 90);
  assert.equal(placedRoom({ x: 70, anchor: 'right' }), 70);
  assert.equal(placedRoom({ x: 98, anchor: 'left' }), 20);
});
