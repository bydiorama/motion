import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pressAt, ringAt, PRESS_DEPTH, PRESS_DOWN, PRESS_UP, RING_LIFE, RING_OPACITY } from './tap.ts';

test('a press is fully down at the tap and home again after it', () => {
  assert.equal(pressAt([1], 1 - PRESS_DOWN - 0.01), 1);
  assert.ok(Math.abs(pressAt([1], 1) - (1 - PRESS_DEPTH)) < 1e-9);
  assert.ok(Math.abs(pressAt([1], 1 - PRESS_DOWN / 2) - (1 - PRESS_DEPTH / 2)) < 1e-9);
  assert.equal(pressAt([1], 1 + PRESS_UP + 0.01), 1);
  // Back up past rest before it settles.
  const peak = Math.max(...Array.from({ length: 50 }, (_, i) => pressAt([1], 1 + (i / 50) * PRESS_UP)));
  assert.ok(peak > 1.002 && peak < 1.01);
});

test('a ring leaves from the tap and is gone after its life', () => {
  assert.equal(ringAt([1], 0.99), undefined);
  assert.deepEqual(ringAt([1], 1), { grow: 0, opacity: RING_OPACITY });
  assert.equal(ringAt([1], 1 + RING_LIFE + 0.01), undefined);
  // A second tap takes over the ring.
  assert.ok(Math.abs(ringAt([1, 1.2], 1.25)!.opacity - RING_OPACITY * (1 - 0.05 / RING_LIFE)) < 1e-9);
});
