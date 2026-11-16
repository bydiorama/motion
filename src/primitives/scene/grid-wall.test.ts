import assert from 'node:assert/strict';
import { test } from 'node:test';
import { staggerByDistance } from '../../core/stagger.ts';
import { masonry, wallDelays } from './grid-wall.ts';

test('masonry puts each picture under the shortest column', () => {
  // Columns 100 px wide with a 10 px gap. A tall first picture sends the next two
  // to the second column; the fourth goes back under the first, now the shorter.
  const { cards, height } = masonry([0.5, 1, 1, 2], 2, 210, 10);
  assert.deepEqual(cards.map((c) => [c.x, c.y, c.h]), [[0, 0, 200], [110, 0, 100], [110, 110, 100], [0, 210, 50]]);
  assert.equal(height, 260);
});

test('equal proportions make a regular grid', () => {
  const { cards } = masonry([1, 1, 1, 1, 1, 1], 3, 320, 10);
  assert.deepEqual(cards.map((c) => [c.x, c.y]), [[0, 0], [110, 0], [220, 0], [0, 110], [110, 110], [220, 110]]);
});

test('the nearest cards open first, equal distances together', () => {
  assert.deepEqual(staggerByDistance([[0, 0], [10, 0], [20, 0], [30, 0]], [15, 0]), [1, 0, 0, 1]);
  const { cards } = masonry([1, 1, 1, 1, 1, 1, 1, 1, 1], 3, 300, 0);
  const d = wallDelays(cards, [150, 150], 0.1);
  // Centre first, then the four edges, then the four corners; the last starts at 8 × 0.1 s.
  assert.equal(d[4], 0);
  assert.deepEqual([d[1], d[3], d[5], d[7]].map((v) => v!.toFixed(2)), ['0.40', '0.40', '0.40', '0.40']);
  assert.ok(Math.abs(Math.max(...d) - 0.8) < 1e-9);
});
