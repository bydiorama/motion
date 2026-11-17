import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileTime, volumeOf } from './soundtrack.ts';

test('the film at time t plays the file from its start point on', () => {
  assert.equal(fileTime({ from: 51.18 }, 0), 51.18);
  assert.equal(fileTime({ from: 51.18 }, 2), 53.18);
  assert.equal(fileTime({}, 3), 3);
});

test('a level in dB becomes an element volume, never above 1', () => {
  assert.equal(volumeOf(0), 1);
  assert.ok(Math.abs(volumeOf(-6) - 0.501) < 0.001);
  assert.equal(volumeOf(6), 1);
});
