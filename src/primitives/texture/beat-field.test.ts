import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beatLight } from './beat-field.ts';

const P = { decay: 3.2, ring: 0.22, reach: 620, life: 0.95 };

test('beat-field: the light peaks and the ring starts on every beat, at any tempo', () => {
  for (const beats of [0, 1, 7, 128]) {
    const l = beatLight(beats, P);
    assert.equal(l.breathe, 1);
    assert.equal(l.ringR, 60);
    assert.equal(l.ringA, 0.22);
  }
  // Just before a beat the breath has died away and the ring has gone.
  const late = beatLight(2.999, P);
  assert.ok(late.breathe < 0.65);
  assert.equal(late.ringA, 0);
  // The phase is the film's: the same film time at the same tempo is the same light.
  const a = beatLight(3.4, P), b = beatLight(10.4, P);
  for (const k of ['breathe', 'ringR', 'ringA'] as const) assert.ok(Math.abs(a[k] - b[k]) < 1e-9, k);
});
