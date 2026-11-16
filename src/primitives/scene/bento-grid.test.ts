import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bentoGrid, dealItems, firstSwaps, swapAt, tilesOf } from './bento-grid.ts';
import { placeOf, postCarousel, rowAt } from './post-carousel.ts';
import { DEFAULT_TOKENS } from '../../tokens.ts';

const ctx = { tokens: DEFAULT_TOKENS, seed: 1, size: [1920, 1080] as [number, number] };

test('bento-grid: named areas become tiles in reading order, each one rectangle', () => {
  const { tiles, cols, rows } = tilesOf('a b b c / d b b e / d f g e');
  assert.deepEqual([cols, rows], [4, 3]);
  assert.deepEqual(tiles.map((t) => `${t.name}:${t.col},${t.row},${t.cols}x${t.rows}`), ['a:0,0,1x1', 'b:1,0,2x2', 'c:3,0,1x1', 'd:0,1,1x2', 'e:3,1,1x2', 'f:1,2,1x1', 'g:2,2,1x1']);
  assert.ok(tilesOf('a b / b a').problem, 'a name split in two is not a rectangle');
  assert.ok(tilesOf('a b c / d e').problem, 'rows of different lengths');
  assert.equal(tilesOf('a a\nb c').tiles.length, 3, 'new lines split rows too');
});

test('bento-grid: items go to tiles by counts, or dealt in turn', () => {
  assert.deepEqual(dealItems(5, 3, [1, 3, 1]), [[0], [1, 2, 3], [4]]);
  assert.deepEqual(dealItems(6, 3, []), [[0, 3], [1, 4], [2, 5]]);
});

test('bento-grid: every first swap falls inside the first hold, a phase apart', () => {
  const s = firstSwaps(4, 0, 1.6, 0.3);
  assert.deepEqual(s.map((v) => Number(v.toFixed(6))), [0.7, 1, 1.3, 1.6]);
  for (const v of firstSwaps(9, 0, 1.6, 0.5)) assert.ok(v > 0 && v <= 1.6 + 1e-9);
});

test('bento-grid: a tile ends on the frame it began on after one round of the largest count', () => {
  const hold = 1.6, swap = 0.7, P = hold + swap;
  for (const a of firstSwaps(5, 0, hold, 0.3)) {
    for (const n of [1, 2, 4]) {
      const start = swapAt(0, a, n, hold, swap), end = swapAt(4 * P, a, n, hold, swap);
      assert.deepEqual([start.from, start.to, start.k], [0, 0, 1]);
      assert.deepEqual([end.from, end.to, end.k], [0, 0, 1], `n ${n}, a ${a}`);
      assert.ok(Math.abs(start.age - end.age) < 1e-9, 'pictures drift the same at both ends');
    }
  }
  // Mid-swap: from one item to the next, half way.
  const mid = swapAt(1 + 0.35, 1, 3, hold, swap);
  assert.deepEqual([mid.from, mid.to], [0, 1]);
  assert.ok(Math.abs(mid.k - 0.5) < 1e-9);
});

test('bento-grid: duration is one round of the largest count; check finds bad areas and counts', () => {
  const props = { areas: 'a b / c b', items: ['1', '2', '3', '4', '5'], counts: [1, 2, 2] };
  assert.equal(bentoGrid.duration(props, { hold: 1.6, swap_time: 0.4, stagger: 0 }, ctx), 4);
  assert.deepEqual(bentoGrid.check!(props, {}, ctx), []);
  assert.ok(bentoGrid.check!({ ...props, counts: [1, 2] }, {}, ctx).some((i) => i.path === 'props.counts'));
  assert.ok(bentoGrid.check!({ ...props, counts: [1, 3, 1] , items: ['1', '2', '3', '4', '5'] }, {}, ctx).length === 0);
  assert.ok(bentoGrid.check!({ areas: 'a b / c b', items: ['1', '2', '3', '4', '5', '6'], counts: [1, 2, 3] }, {}, ctx).some((i) => /loop/.test(i.message)));
  assert.ok(bentoGrid.check!({ ...props, swaps: ['spin'] }, {}, ctx).some((i) => i.path === 'props.swaps[0]'));
  assert.ok(bentoGrid.check!({ areas: 'a b / b a', items: ['1'] }, {}, ctx)[0]?.path === 'props.areas');
});

test('post-carousel: the row steps slide by slide and a loop comes back to the first', () => {
  const hold = 1, turn = 0.5;
  assert.equal(rowAt(0.5, 4, hold, turn, false), 0);
  assert.equal(rowAt(1.25, 4, hold, turn, false), 0.5);
  assert.equal(rowAt(2, 4, hold, turn, false), 1);
  assert.equal(rowAt(99, 4, hold, turn, false), 3, 'holds on the last slide');
  assert.equal(rowAt(4 * 1.5, 4, hold, turn, true), 4, 'a loop ends a whole turn on, where it began');
  // Around a loop the first slide waits on the right of the last.
  assert.equal(placeOf(0, 3, 4, true), 1);
  assert.equal(placeOf(3, 0, 4, true), -1);
  assert.equal(placeOf(0, 3, 4, false), -3);
  assert.equal(postCarousel.duration({ slides: ['a', 'b', 'c'] }, { hold: 1, turn: 0.5 }, ctx), 4);
  assert.equal(postCarousel.duration({ slides: ['a', 'b', 'c'] }, { hold: 1, turn: 0.5, loop: true }, ctx), 4.5);
  assert.ok(postCarousel.check!({ slides: ['a', 'b'] }, { loop: true }, ctx).some((i) => i.path === 'params.loop'));
});
