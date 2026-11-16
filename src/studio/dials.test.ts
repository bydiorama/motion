import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { springSpan } from '../core/ease.ts';
import type { Film } from '../film/types.ts';
import { buildPanel, fromTransitionDial, overridesFrom, SEP, toTransitionDial, type Panel } from './dials.ts';

const film = JSON.parse(readFileSync(new URL('../../films/showcase.film.json', import.meta.url), 'utf8')) as Film;
const path = (...keys: string[]) => keys.join(SEP);

/** DialKit hands values back nested by folder; rebuild that shape from a panel. */
function nested(panel: Panel, changes: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [p, v] of [...panel.values, ...Object.entries(changes)]) {
    const keys = p.split(SEP);
    let cur = out;
    for (const k of keys.slice(0, -1)) cur = (cur[k] ??= {}) as Record<string, unknown>;
    cur[keys.at(-1)!] = v;
  }
  return out;
}

test('a panel left alone writes no overrides', () => {
  const panel = buildPanel(film)!;
  assert.deepEqual(overridesFrom(nested(panel), panel, panel, {}), {});
});

test('dials write only what changed, addressed by id', () => {
  const panel = buildPanel(film)!;
  const values = nested(panel, {
    [path('look', 'dark')]: true,
    [path('ring', 'orbit', 'tilt')]: { x: 30, y: -10 },
    [path('ring', 'orbit', 'period')]: 12,
  });
  assert.deepEqual(overridesFrom(values, panel, panel, {}), {
    'theme.scheme': 'dark',
    'scenes.ring.layers.orbit.params.tilt_z': 30,
    'scenes.ring.layers.orbit.params.tilt_x': -10,
    'scenes.ring.layers.orbit.params.period': 12,
  });
});

test('moving a dial back to the film value drops its override; unmanaged paths are kept', () => {
  const panel = buildPanel(film)!;
  const existing = { 'scenes.ring.layers.orbit.params.period': 12, 'scenes.ring.length': 6 };
  const out = overridesFrom(nested(panel), panel, panel, existing);
  assert.equal(out['scenes.ring.layers.orbit.params.period'], undefined);
  // The ring's length dial sits at the film's length, so its override goes too.
  assert.equal(out['scenes.ring.length'], undefined);
  const kept = overridesFrom(nested(panel), panel, panel, { 'notes.elsewhere': 1 });
  assert.equal(kept['notes.elsewhere'], 1);
});

test('transition dials round-trip eases and springs', () => {
  const eased = fromTransitionDial(toTransitionDial([0.2, 0, 0, 1], 0.5));
  assert.deepEqual(eased, { duration: 0.5, ease: [0.2, 0, 0, 1] });
  const sprung = fromTransitionDial(toTransitionDial({ spring: { duration: 0.4, bounce: 0.3 } }, 0));
  assert.deepEqual(sprung.ease, { spring: { duration: 0.4, bounce: 0.3 } });
  assert.ok(Math.abs(sprung.duration - springSpan({ duration: 0.4, bounce: 0.3 })) < 1e-6);
});

test('camera rigs get a path dropdown, an angle pad and a look pad', () => {
  const rig = { motion: '0.5', size: [1080, 1350], scenes: [{ id: 'tabs', layers: [{ id: 'stack', use: 'rig/tab-stack', props: { items: ['One', 'Two', 'Three'] } }] }] } as unknown as Film;
  const panel = buildPanel(rig)!;
  const keys = [...panel.values.keys()].filter((k) => k.includes(`stack${SEP}`)).map((k) => k.split(SEP).at(-1));
  for (const k of ['path', 'angle', 'look', 'ease', 'zoom', 'roll']) assert.ok(keys.includes(k), `${k} dial`);
  const at = [...panel.values.keys()].find((k) => k.endsWith(`${SEP}path`))!;
  assert.deepEqual(overridesFrom(nested(panel, { [at]: 'in-out' }), panel, panel, {}), { 'scenes.tabs.layers.stack.params.path': 'in-out' });
  const angle = [...panel.values.keys()].find((k) => k.endsWith(`${SEP}angle`))!;
  assert.deepEqual(overridesFrom(nested(panel, { [angle]: { x: 10, y: 5 } }), panel, panel, {}), {
    'scenes.tabs.layers.stack.params.tilt': 10, 'scenes.tabs.layers.stack.params.pitch': 5,
  });
});
