import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCatalog } from '../catalog.ts';
import { readLibrary } from '../cli/library.ts';
import { beats, checkAnswers, writeBrief } from './brief.ts';
import type { Answers } from './types.ts';

const ctx = { catalog: buildCatalog(), library: readLibrary() };
const answers: Answers = {
  type: 'narrative/feature-announcement', style: 'style/clean-explainer', feel: 'crisp',
  subject: 'Live collaboration', message: 'Edit together, without conflicts', intent: 'Try it today',
  duration: 20, formats: ['1:1', '16:9'], target: 'agent', moves: ['rig/orbit-ring'],
};

test('the same answers always give the same brief', () => {
  assert.equal(writeBrief(answers, ctx), writeBrief(structuredClone(answers), ctx));
});

test('beats fill the length exactly, in order', () => {
  const n = ctx.library.narratives.find((x) => x.slug === answers.type)!;
  const b = beats(n, 20);
  assert.equal(b.length, n.beats.length);
  assert.equal(b[0]!.start, 0);
  assert.equal(b.at(-1)!.end, 20);
  for (let i = 1; i < b.length; i++) assert.equal(b[i]!.start, b[i - 1]!.end);
});

test('the brief keeps drawable and library-only moves apart, and honours the look', () => {
  const text = writeBrief(answers, ctx);
  const [drawable, rest] = text.split('In the library but not drawable yet');
  assert.match(drawable!, /`type\/word-build`/);
  assert.match(drawable!, /`rig\/orbit-ring`/, 'a move the person picked is in');
  assert.match(rest!, /`scene\/zoomed-ui`/, 'a suggested move the runtime lacks is listed as not drawable');
  assert.doesNotMatch(drawable!, /`transition\/torn-edge`/, 'the look avoids it');
  assert.match(text, /16:9 \(1920×1080\), 1:1 \(1080×1080\)/, 'formats in a fixed order');
});

test('a chat brief asks for JSON back; an agent brief names the commands', () => {
  assert.match(writeBrief({ ...answers, target: 'chat' }, ctx), /one JSON code block/);
  assert.match(writeBrief(answers, ctx), /motion\.mjs validate/);
});

test('answers that point at nothing are reported, not guessed', () => {
  const problems = checkAnswers({ ...answers, style: 'style/nope', formats: [], message: ' ' }, ctx);
  assert.equal(problems.length, 3);
  assert.throws(() => writeBrief({ ...answers, type: 'narrative/nope' }, ctx), /Unknown video type/);
});

test('the starter film in the brief is a valid film', async () => {
  const { resolveFilm } = await import('../film/resolve.ts');
  for (const target of ['agent', 'chat'] as const) {
    const text = writeBrief({ ...answers, target, accent: '#2440F0', scheme: 'dark' }, ctx);
    const json = /## The film[\s\S]*?```json\n([\s\S]*?)\n```/.exec(text)![1]!;
    const res = resolveFilm(JSON.parse(json));
    assert.deepEqual(res.issues.filter((i) => i.level === 'error'), []);
  }
});
