import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ISOMETRIC_LAY, project } from '../primitives/rig/layer-stack.ts';
import { iso } from './iso.ts';

const near = (a: readonly number[], b: readonly number[], eps = 1e-3) =>
  assert.ok(a.every((v, i) => Math.abs(v - b[i]!) < eps), `${a} is not ${b}`);

test('a point is seen where rig/layer-stack sees it in its isometric view', () => {
  const view = { lay: ISOMETRIC_LAY, turn: -45, cam: { rx: 0, ry: 0, rz: 0, zoom: 1, x: 0, y: 0 }, P: 0, w: 400, h: 400 };
  const points: [number, number, number][] = [[100, 0, 0], [0, 100, 0], [0, 0, 100], [-70, 40, 25]];
  for (const p of points) near(iso.point(...p), project(p, view));
});

test('the three axes are drawn the same length, x and y at 30° to the horizontal', () => {
  const axes: [number, number, number][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const lengths = axes.map((p) => { const [x, y] = iso.point(...p); return Math.hypot(x, y); });
  near(lengths, [lengths[0]!, lengths[0]!, lengths[0]!]);
  const [x, y] = iso.point(1, 0, 0);
  near([Math.atan2(-y, x) * 180 / Math.PI], [30]);
});

test('unproject finds the floor point a stage offset shows', () => {
  near(iso.unproject(...iso.point(37, -12, 20), 20), [37, -12]);
});

test('a drawing laid on a face puts its corners on the face\'s corners', () => {
  const apply = (m: string, u: number, v: number) => {
    const [a, b, c, d, e, f] = m.slice(7, -1).split(' ').map(Number) as [number, number, number, number, number, number];
    return [a * u + c * v + e, b * u + d * v + f];
  };
  for (const face of ['floor', 'front-right', 'front-left'] as const) {
    const at = [10, -20, 30] as const, m = iso.matrix(face, at);
    const q = iso.quad(face, at, 50, 40).map((p) => iso.point(...p));
    near(apply(m, 0, 0), q[0]!); near(apply(m, 50, 0), q[1]!); near(apply(m, 50, 40), q[2]!); near(apply(m, 0, 40), q[3]!);
  }
});
