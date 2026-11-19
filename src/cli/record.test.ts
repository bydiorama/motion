import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clockSteps } from './record.ts';

test('clockSteps puts frame i at round(i × 1000 / fps) on the virtual clock', () => {
  for (const fps of [24, 25, 30, 50, 60]) {
    const steps = clockSteps(fps * 3, fps);
    let t = 0;
    steps.forEach((s, i) => {
      t += s;
      assert.equal(t, Math.round((i * 1000) / fps), `${fps} fps, frame ${i}`);
    });
  }
});

test('clockSteps starts on the first frame and never drifts', () => {
  const steps = clockSteps(600, 60);
  assert.equal(steps[0], 0);
  assert.ok(steps.slice(1).every((s) => s === 16 || s === 17));
  // Ten seconds of 60 fps end exactly on 9 983 ms (frame 599), not a frame off.
  assert.equal(steps.reduce((a, b) => a + b, 0), 9983);
});

test('FRAMES runs each requestAnimationFrame callback once per frame, at the frame time', async () => {
  const { FRAMES } = await import('./record.ts');
  const w: Record<string, any> = {};
  new Function('window', 'performance', 'setTimeout', FRAMES)(w, { now: () => 1000 }, setTimeout);
  const seen: number[] = [];
  const tick = (t: number) => { seen.push(t); w.requestAnimationFrame(tick); };
  w.requestAnimationFrame(tick);
  const gone = w.requestAnimationFrame(() => seen.push(-1));
  w.cancelAnimationFrame(gone);
  w.__motionFrame(); w.__motionFrame(); w.__motionFrame();
  // A callback that asks again waits for the next frame: one call a frame, never two.
  assert.deepEqual(seen, [1000, 1000, 1000]);
});
