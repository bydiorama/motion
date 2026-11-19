import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveFilm } from './resolve.ts';
import { applyTune, bake } from './tune.ts';
import type { Film } from './types.ts';

const film = (scenes: unknown, extra: object = {}): Film => ({ motion: '0.4', size: [1920, 1080], fps: 60, scenes, ...extra }) as Film;
const text = (id: string, extra: object = {}) => ({ id, use: 'el/text', props: { text: 'Hello' }, ...extra });
const codes = (f: unknown) => resolveFilm(f).issues.map((i) => `${i.level}:${i.code}`);

test('scenes run in order and overlap by their hand-over', () => {
  const r = resolveFilm(film([
    { id: 'a', length: 2, layers: [], out: { use: 'transition/blur-dissolve' } },
    { id: 'b', length: 3, layers: [] },
  ]));
  assert.ok(r.timeline);
  const [a, b] = r.timeline.scenes;
  assert.deepEqual([a!.start, a!.end, b!.start, b!.end], [0, 2, 1.6, 4.6]);
  assert.equal(r.timeline.duration, 4.6);
  assert.equal(r.timeline.frames, 276);
});

test('a scene without a length lasts until its last layer ends, plus the hold', () => {
  const r = resolveFilm(film([{ id: 'a', hold: 1, layers: [
    { id: 'title', use: 'type/word-build', at: 0.5, props: { text: 'one two three' } },
  ] }]));
  // 2 gaps × 0.1 s + 0.5 s per word = 0.7 s, starting at 0.5
  assert.equal(r.timeline?.scenes[0]?.layers[0]?.end.toFixed(2), '1.20');
  assert.equal(r.timeline?.duration, 2.2);
});

test('layers are timed against each other by id', () => {
  const r = resolveFilm(film([{ id: 'a', layers: [
    text('second', { at: 'first.end + 0.25' }),
    text('first', { at: 1, enter: { move: 'rise', duration: 0.5 } }),
    text('third', { at: 'second.start - 0.1' }),
  ] }]));
  const at = Object.fromEntries(r.timeline!.scenes[0]!.layers.map((l) => [l.id, l.start]));
  assert.deepEqual(at, { second: 1.75, first: 1, third: 1.65 });
});

test('times land on whole frames, so duration × fps is a whole number', () => {
  const r = resolveFilm(film([{ id: 'a', length: 1.234, layers: [text('t', { at: 0.3333 })] }], { fps: 30 }));
  const t = r.timeline!;
  assert.ok(Number.isInteger(Math.round(t.duration * 30 * 1e6) / 1e6));
  assert.equal(t.scenes[0]!.layers[0]!.start, 10 / 30);
});

test('tokens: a film overrides them and layers refer to them', () => {
  const r = resolveFilm(film([{ id: 'a', layers: [text('t', { enter: { move: 'fade', duration: '$duration.slow' } })] }], { tokens: { duration: { slow: 1.5 } } }));
  assert.equal(r.timeline?.scenes[0]?.layers[0]?.enter?.duration, 1.5);
  assert.deepEqual(codes(film([{ id: 'a', layers: [] }], { tokens: { duraton: { slow: 1 } } })), ['error:unknown-token']);
});

test('mistakes come back with where and what to do', () => {
  const r = resolveFilm(film([{ id: 'a', layers: [
    { id: 'title', use: 'type/word-buld', props: { text: 'x' } },
    { id: 'n', use: 'fx/counter-roll', props: { value: 3, duration: 1 }, params: { durration: 1 } },
    text('late', { at: 'tittle.end' }),
  ] }]));
  const by = Object.fromEntries(r.issues.map((i) => [i.code, i]));
  assert.equal(r.ok, false);
  assert.equal(by['unknown-primitive']?.path, 'scenes.a.layers.title.use');
  assert.match(by['unknown-primitive']?.hint ?? '', /type\/word-build/);
  assert.match(by['unknown-prop']?.hint ?? '', /Move it to params/);
  assert.match(by['unknown-param']?.hint ?? '', /"duration"/);
  assert.equal(by['unknown-layer']?.path, 'scenes.a.layers.late.at');
});

test('a transition used as a layer is redirected to "out"', () => {
  const r = resolveFilm(film([{ id: 'a', layers: [{ id: 'x', use: 'transition/blur-dissolve' }] }]));
  assert.match(r.issues[0]?.hint ?? '', /"out"/);
});

test('a circle of references is an error, not a hang', () => {
  assert.ok(codes(film([{ id: 'a', layers: [text('x', { at: 'y.end' }), text('y', { at: 'x.end' })] }])).includes('error:time-cycle'));
});

test('a value outside the library range is allowed but flagged', () => {
  const r = resolveFilm(film([{ id: 'a', layers: [{ id: 't', use: 'type/word-build', props: { text: 'a b' }, params: { stagger: 0.4 } }] }]));
  assert.equal(r.ok, true);
  assert.deepEqual(r.issues.map((i) => i.code), ['out-of-range']);
});

test('a layer that outlives its scene, or never appears, is reported', () => {
  assert.deepEqual(codes(film([{ id: 'a', length: 1, layers: [{ id: 'n', use: 'fx/counter-roll', at: 0.5, props: { value: 9 } }] }])), ['warning:cut-off']);
  assert.deepEqual(codes(film([{ id: 'a', length: 1, layers: [text('t', { at: 2 })] }])), ['error:never-seen']);
});

test('exits default to the end of the scene', () => {
  const r = resolveFilm(film([{ id: 'a', length: 3, layers: [text('t', { exit: { move: 'fade', duration: 0.5 } })] }]));
  assert.equal(r.timeline?.scenes[0]?.layers[0]?.exit?.start, 2.5);
});

test('tuning addresses scenes and layers by id and survives reordering', () => {
  const f = film([
    { id: 'a', length: 2, layers: [] },
    { id: 'b', layers: [{ id: 't', use: 'type/word-build', props: { text: 'x y' } }] },
  ]);
  const tune = { set: { 'scenes.b.layers.t.params.stagger': 0.12, 'scenes.a.length': 3, 'scenes.gone.length': 1, 'tokens.hold': 2 } };
  const reordered = { ...f, scenes: [...f.scenes].reverse() };
  for (const source of [f, reordered]) {
    const { film: out, orphans } = applyTune(source, tune);
    assert.deepEqual(orphans, ['scenes.gone.length']);
    assert.equal(out.scenes.find((s) => s.id === 'b')?.layers[0]?.params?.stagger, 0.12);
    assert.equal(out.scenes.find((s) => s.id === 'a')?.length, 3);
    assert.equal(out.tokens?.hold, 2);
  }
  assert.equal(f.scenes[0]?.length, 2, 'the source film is not changed');
});

test('bake writes overrides into the film and keeps orphans and notes', () => {
  const f = film([{ id: 'a', length: 2, layers: [] }]);
  const note = { id: 'n1', t: 1, text: 'slower', status: 'open' as const };
  const r = bake(f, { set: { 'scenes.a.length': 4, 'scenes.x.length': 1 }, notes: [note] });
  assert.equal(r.film.scenes[0]?.length, 4);
  assert.deepEqual(r.tune, { set: { 'scenes.x.length': 1 }, notes: [note] });
});

test('an id that starts with a digit says so, and offers a fix', () => {
  const r = resolveFilm(film([{ id: '1953-043', layers: [text('1953-043')] }]));
  const ids = r.issues.filter((i) => i.code === 'bad-id');
  assert.equal(ids.length, 2);
  assert.match(ids[0]!.message, /starts with a digit/);
  assert.equal(ids[0]!.hint, 'For example "scene-1953-043".');
  assert.equal(ids[1]!.hint, 'For example "layer-1953-043".');
  assert.doesNotMatch(ids[1]!.message, /reserved/);
});

test('a layer snapped onto the end of its scene is explained, with the last frame it can start on', () => {
  const r = resolveFilm(film([{ id: 'a', length: 7.6, layers: [text('late', { at: 7.595 })] }], { fps: 30 }));
  const issue = r.issues.find((i) => i.code === 'never-seen')!;
  assert.match(issue.message, /the moment scene "a" ends/);
  assert.match(issue.hint!, /30 fps.*7\.567 s/);
});

test('a scene camera can follow a line, and says what it can follow', () => {
  const route = { id: 'route', use: 'fx/path-draw', props: { paths: ['M0 0 L100 100'] } };
  assert.deepEqual(codes(film([{ id: 'a', follow: { layer: 'route', at: [50, 40], lag: 0.1, blend: 0.5 }, layers: [route] }])), []);
  assert.deepEqual(codes(film([{ id: 'a', follow: { layer: 'rout' }, layers: [route] }])), ['error:unknown-layer']);
  assert.deepEqual(codes(film([{ id: 'a', follow: { layer: 't', at: [120, 0] }, layers: [text('t')] }])), ['error:bad-follow', 'error:bad-value']);
});

test('a calm film starts transitions from their quiet presets; values the film sets still win', () => {
  const scenes = (params: object) => [
    { id: 'a', length: 3, layers: [], out: { use: 'transition/camera-travel', params } },
    { id: 'b', length: 3, layers: [] },
  ];
  const calm = resolveFilm(film(scenes({ tilt: 8 }), { tokens: { transitions: 'calm' } }));
  assert.deepEqual(calm.issues, []);
  const p = calm.timeline!.scenes[0]!.out!.params;
  assert.deepEqual([p.pull, p.tilt, p.gap], [0.04, 8, 0]);
  const standard = resolveFilm(film(scenes({}))).timeline!.scenes[0]!.out!.params;
  assert.deepEqual([standard.pull, standard.tilt, standard.gap], [0.32, 14, 0.18]);
  assert.deepEqual(codes(film(scenes({}), { tokens: { transitions: 'quiet' } })), ['error:bad-value']);
});

test('every calm preset sits inside its params\' ranges', async () => {
  const { TRANSITIONS } = await import('../primitives/index.ts');
  for (const t of Object.values(TRANSITIONS)) {
    for (const [k, v] of Object.entries(t.calm ?? {})) {
      const spec = t.params[k];
      assert.ok(spec, `${t.slug}: calm sets unknown param ${k}`);
      if (typeof v === 'number') assert.ok(v >= spec.min! && v <= spec.max!, `${t.slug}.${k} = ${v} is outside ${spec.min}–${spec.max}`);
    }
  }
});

test('theme.ui names one of the bundled bydiorama/ui themes', async () => {
  const { UI_THEMES } = await import('../dom/ui-themes.css.ts');
  const { UI_THEME_NAMES } = await import('./types.ts');
  const one = [{ id: 'a', length: 1, layers: [] }];
  for (const ui of UI_THEME_NAMES) {
    assert.deepEqual(codes(film(one, { theme: { ui } })), [], ui);
    assert.match(UI_THEMES[ui], new RegExp(`\\.m-stage\\[data-ui-theme="${ui}"\\]`), `${ui} is scoped to its stage`);
    assert.match(UI_THEMES[ui], /--ui-font-display/, `${ui} sets the type`);
  }
  const bad = resolveFilm(film(one, { theme: { ui: 'neon' } })).issues;
  assert.deepEqual(bad.map((i) => `${i.code}:${i.path}`), ['bad-value:theme.ui']);
});

test('an artboard takes a design size, a fit and an alignment; px placement is checked', () => {
  const sc = (extra: object, place: object = { x: 103, y: 327, anchor: 'top-left', unit: 'px' }) =>
    codes(film([{ id: 'a', length: 2, ...extra, layers: [{ id: 'b', use: 'el/box', place }] }]));
  assert.deepEqual(sc({ artboard: { width: 1920, height: 1080, fit: 'height', align: [0, 50] } }), []);
  assert.ok(sc({ artboard: { width: 0, height: 1080 } }).includes('error:bad-value'));
  assert.ok(sc({ artboard: { width: 1920, height: 1080, fit: 'stretch' } }).includes('error:bad-value'));
  assert.ok(sc({ artboard: { width: 1920, height: 1080, align: [50] } }).includes('error:bad-value'));
  assert.ok(sc({ artboard: { width: 1920, height: 1080, scale: 2 } }).some((c) => c.endsWith('unknown-key')));
  assert.ok(sc({}, { x: 1, y: 1, unit: 'em' }).includes('error:bad-value'));
  // px without an artboard are the stage's own: allowed.
  assert.deepEqual(sc({}), []);
});

test('parallax takes a depth, or a depth and a home time; it needs a camera that travels', () => {
  const moving = { tracks: { x: [[0, 0], [2, -400]] } };
  const sc = (parallax: unknown, extra: object = moving) =>
    codes(film([{ id: 'a', length: 2, ...extra, layers: [{ id: 'b', use: 'el/box', parallax }] }]));
  assert.deepEqual(sc(1.3), []);
  assert.deepEqual(sc({ depth: 0.5, home: 0 }), []);
  assert.ok(sc(-1).includes('error:bad-value'));
  assert.ok(sc({ depth: 2, at: 1 }).some((c) => c.endsWith('unknown-key')));
  assert.ok(sc(1.3, {}).includes('warning:unused'));
  // Home defaults to the scene's end: the frame the camera arrives at.
  const r = resolveFilm(film([{ id: 'a', length: 2, ...moving, layers: [{ id: 'b', use: 'el/box', parallax: 1.5 }] }]));
  assert.deepEqual(r.timeline?.scenes[0]?.layers[0]?.parallax, { depth: 1.5, home: 2 });
});

test('wipe and slide travel at any angle; other moves keep their own direction', () => {
  const enter = (e: unknown) => resolveFilm(film([{ id: 'a', length: 2, layers: [{ id: 'b', use: 'el/box', enter: e }] }]));
  const w = enter({ move: 'wipe', angle: 30, amount: 80 });
  assert.equal(w.issues.length, 0);
  assert.deepEqual([w.timeline?.scenes[0]?.layers[0]?.enter?.angle, w.timeline?.scenes[0]?.layers[0]?.enter?.amount], [30, 80]);
  assert.equal(enter('slide').timeline?.scenes[0]?.layers[0]?.enter?.angle, 0);
  assert.deepEqual(enter({ move: 'rise', angle: 30 }).issues.map((i) => `${i.level}:${i.code}`), ['warning:unused']);
  assert.ok(enter({ move: 'wipe', angle: 'up' }).issues.some((i) => i.code === 'bad-value'));
});

test('camera keys fill in from the key before, in seconds, and aim at layers by id', () => {
  const r = resolveFilm(film([{ id: 'a', length: 4, layers: [text('title'), text('send')], camera: [
    { at: 0, frame: 'title', zoom: 1.2 },
    { at: '2b', frame: 'send', zoom: 3, anchor: [40, 60], ease: 'punch' },
    { at: 3, tilt: [8, -12], drift: 0.02 },
  ] }], { tempo: { bpm: 120 } }));
  const cam = r.timeline!.scenes[0]!.camera!;
  assert.deepEqual(cam.map((k) => k.t), [0, 1, 3]);
  assert.equal(cam[2]!.frame, 'send');
  assert.equal(cam[2]!.zoom, 3);
  assert.deepEqual(cam[2]!.anchor, [40, 60]);
  assert.equal(cam[2]!.drift, 0.02);
  assert.equal(cam[0]!.anchor[0], 50);
});

test('the framing camera and x, y or scale tracks cannot both drive a scene', () => {
  assert.ok(codes(film([{ id: 'a', layers: [text('t')], camera: [{ at: 0, frame: 't' }], tracks: { scale: [[0, 1], [1, 2]] } }])).includes('error:bad-camera'));
  assert.ok(codes(film([{ id: 'a', layers: [text('t')], camera: [{ at: 0, frame: 'tt' }] }])).includes('error:unknown-layer'));
  assert.ok(codes(film([{ id: 'a', layers: [text('t')], camera: [{ at: 1, frame: 't' }, { at: 0.5 }] }])).includes('error:bad-order'));
  assert.ok(!codes(film([{ id: 'a', layers: [text('t')], camera: [{ at: 0, frame: 't' }], tracks: { rotate: [[0, 0], [1, 2]] } }])).some((c) => c.startsWith('error')));
});

test('taps resolve to scene seconds with the layer their ring is drawn around', () => {
  const r = resolveFilm(film([{ id: 'a', length: 4, layers: [
    text('card'),
    text('send', { at: 0.5, taps: [2, { at: 3, ring: 'card' }, { at: 1, ring: false }] }),
  ] }]));
  assert.deepEqual(r.timeline!.scenes[0]!.layers[1]!.taps, [{ t: 1, ring: null }, { t: 2, ring: 'send' }, { t: 3, ring: 'card' }]);
  assert.ok(codes(film([{ id: 'a', length: 2, layers: [text('send', { taps: [{ at: 1, ring: 'crad' }] })] }])).includes('error:unknown-layer'));
  assert.ok(codes(film([{ id: 'a', length: 3, layers: [text('send', { at: 1, taps: [0.5] })] }])).includes('warning:tap-hidden'));
});

test('pop-check arrives on the bounce and fades in over its first part', () => {
  const r = resolveFilm(film([{ id: 'a', length: 2, layers: [text('ok', { enter: 'pop-check' })] }]));
  const e = r.timeline!.scenes[0]!.layers[0]!.enter!;
  assert.equal(e.move, 'pop-check');
  assert.equal(e.ease, 'bounce.out');
  assert.equal(e.amount, 0.65);
});
