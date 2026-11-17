import assert from 'node:assert/strict';
import { test } from 'node:test';
import { holdsOf, stripClock, sideOf, statesOf, stripAt, stripTiming } from './strip-cycle.ts';

const linear = (x: number) => x;

test('empty ground can open and close the cycle', () => {
  assert.deepEqual(statesOf(2, 'none'), [0, 1]);
  assert.deepEqual(statesOf(2, 'start'), [null, 0, 1]);
  assert.deepEqual(statesOf(2, 'both'), [null, 0, 1, null]);
});

test('every state holds, changes run between them, the last state holds to the end', () => {
  const t = stripTiming(3, 1, 0.5);
  assert.deepEqual(t.changes, [1, 2.5]);
  assert.equal(t.duration, 4);
});

test('a change lasts exactly its shift: the stagger is spread inside it', () => {
  const down = stripClock(8, 1, 0.05, 'down');
  assert.ok(Math.abs(down.travel + Math.max(...down.delays) - 1) < 1e-9);
  assert.ok(Math.abs(down.travel - (1 - 7 * 0.05)) < 1e-9);
  // From the centre, the two middle strips go together: half the steps.
  assert.ok(Math.abs(stripClock(8, 1, 0.05, 'center').travel - (1 - 3 * 0.05)) < 1e-9);
  // A stagger too wide for the change is scaled down, so every strip still travels 40% of it.
  const tight = stripClock(8, 0.5, 0.1, 'down');
  assert.ok(Math.abs(tight.travel - 0.2) < 1e-9);
  assert.ok(Math.abs(Math.max(...tight.delays) - 0.3) < 1e-9);
});

test('every change is a cue of one shift, so the pace check can read the rhythm', async () => {
  const { stripCycle } = await import('./strip-cycle.ts');
  const cues = stripCycle.cues!({ images: ['a', 'b'] }, { empty: 'both', hold: 1, ground_hold: 0.5, shift: 0.5 }, { tokens: {} as never, seed: 1, size: [100, 100] });
  assert.deepEqual(cues, [{ at: 0.5, length: 0.5 }, { at: 2, length: 0.5 }, { at: 3.5, length: 0.5 }]);
});

test('strips change one after another and land on the next state', () => {
  const timing = stripTiming(2, 1, 0.7);
  const delays = [0, 0.1, 0.2];
  assert.deepEqual(stripAt(0.5, timing, delays, 0, 0.5, linear), { from: 0, to: 0, u: 0 });
  // At 1.15 s the first strip is 30% across, the second 10%, the third not yet moving.
  assert.ok(Math.abs(stripAt(1.15, timing, delays, 0, 0.5, linear).u - 0.3) < 1e-9);
  assert.ok(Math.abs(stripAt(1.15, timing, delays, 1, 0.5, linear).u - 0.1) < 1e-9);
  assert.deepEqual(stripAt(1.15, timing, delays, 2, 0.5, linear), { from: 0, to: 0, u: 0 });
  assert.deepEqual(stripAt(1.7, timing, delays, 2, 0.5, linear), { from: 1, to: 1, u: 0 });
});

test('weave turns neighbours and every change, so no strip repeats a side', () => {
  assert.deepEqual([0, 1, 2].map((r) => sideOf('alternate', r, 0)), [1, -1, 1]);
  assert.deepEqual([0, 1, 2].map((r) => sideOf('alternate', r, 1)), [1, -1, 1]);
  assert.deepEqual([0, 1, 2].map((r) => sideOf('weave', r, 1)), [-1, 1, -1]);
  // Strips run the way the direction says: left enters from the right edge, like the bands of a band sweep.
  assert.equal(sideOf('left', 3, 2), 1);
  assert.equal(sideOf('right', 3, 2), -1);
});

test('the bare ground can hold for its own time, so a loop breathes on it briefly', () => {
  const states = statesOf(2, 'both');
  assert.deepEqual(holdsOf(states, 1.2, 0.5), [0.5, 1.2, 1.2, 0.5]);
  assert.deepEqual(holdsOf(states, 1.2, 0), [1.2, 1.2, 1.2, 1.2]);
  const t = stripTiming(4, holdsOf(states, 1, 0.5), 0.5);
  assert.deepEqual(t.changes, [0.5, 2, 3.5]);
  assert.equal(t.duration, 4.5);
});
