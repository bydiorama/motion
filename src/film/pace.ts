// Pace: the rhythm of a resolved film, measured. Pure, like resolve: it reads the
// timeline (scenes, hand-overs, enters, exits and the cues primitives report) and
// says where the film rushes, drags or stumbles.
//
// What it checks, and why (docs/CRAFT.md, "Rhythm"):
//  - A hand-over is a moment between sections, never a section of its own: at most a
//    third of the shorter scene it joins, and each scene keeps time alone, free of any
//    hand-over, at least twice as long as its hand-overs.
//  - Like moves take like time: every hand-over one length, every change one length.
//    A film whose swaps take 0.6 s here and 1 s there feels fast, then slow.
//  - Rests between changes are even and long enough to see a picture (1 s or more).
//  - Most of a film is held, not moving: about a third moving reads as calm and alive.
//  - With a tempo: scene changes land on the first beat of a bar, other moves on the
//    beat or half-beat, and lengths are whole half-beats; a loop is whole bars.
import { beatLength, offGrid, type Tempo } from './tempo.ts';
import type { Issue, ResolvedScene, Timeline } from './types.ts';

export type MoveKind = 'hand-over' | 'change' | 'enter' | 'exit' | 'run';

export interface PaceMove {
  kind: MoveKind;
  /** Scene the move belongs to; a hand-over belongs to the scene it leaves. */
  scene: string;
  layer?: string;
  /** Primitive or transition slug. */
  use: string;
  /** Film time, seconds. */
  start: number;
  length: number;
  /** Changes that share a lane rest between each other. */
  lane?: string;
  /** Share of the frame a change changes, 0–1. */
  share?: number;
}

export interface ScenePace {
  id: string;
  start: number;
  end: number;
  length: number;
  /** Hand-over in from the scene before, and out to the next, in seconds. */
  in: number;
  out: number;
  /** Time with no hand-over on screen. */
  alone: number;
  /** Share of the scene's time something is moving, 0–1. */
  moving: number;
  changes: number;
  /** How much of the frame changes a second: each change counts by the share of the frame it changes. */
  rate: number;
  /** Shortest and longest rest between changes in this scene, seconds. */
  rest?: [number, number];
}

export interface Pace {
  duration: number;
  tempo?: Tempo & { beat: number; barLength: number };
  moves: PaceMove[];
  scenes: ScenePace[];
  /** Share of the film something is moving, 0–1. */
  moving: number;
  issues: Issue[];
}

/** The numbers the checks use. CRAFT.md "Rhythm" explains each. */
export const PACE = {
  /** A hand-over is at most this share of the shorter scene it joins (a quarter reads best). */
  handoverShare: 1 / 3,
  handoverIdeal: 1 / 4,
  /** A scene's time alone is at least this many times its longest hand-over. */
  aloneTimes: 2,
  /** Like moves may differ by at most this ratio, longest to shortest. */
  spread: 1.35,
  /** Rests between changes may differ by at most this ratio. */
  restSpread: 1.6,
  /** Shortest rest that lets a picture be seen, seconds. */
  minRest: 1,
  /** Share of the film in motion: below reads as stalled, above as restless. */
  moving: [0.2, 0.6] as const,
  /** Inside a scene that changes pictures, a hand-over is at most this share of one picture's time (rest + change). */
  shotShare: 1 / 2,
  /** Changes per second may differ by at most this ratio from scene to scene. */
  density: 2,
};

const fmt = (s: number) => `${s.toFixed(2)} s`;

/** Merged length of a set of intervals, clipped to [a, b]. */
function covered(spans: readonly (readonly [number, number])[], a: number, b: number): number {
  const xs = spans.map(([s, e]) => [Math.max(a, s), Math.min(b, e)] as const).filter(([s, e]) => e > s).sort((p, q) => p[0] - q[0]);
  let total = 0, cs = -Infinity, ce = -Infinity;
  for (const [s, e] of xs) {
    if (s > ce) { if (ce > cs) total += ce - cs; cs = s; ce = e; } else ce = Math.max(ce, e);
  }
  if (ce > cs) total += ce - cs;
  return total;
}

export function movesOf(t: Timeline): PaceMove[] {
  const out: PaceMove[] = [];
  t.scenes.forEach((s, i) => {
    const next = t.scenes[i + 1];
    if (s.out && next && s.out.duration > 0) out.push({ kind: 'hand-over', scene: s.id, use: s.out.use, start: next.start, length: s.out.duration });
    // A scene is seen from the middle of the hand-over in to the middle of the one out:
    // a change wholly outside that window is never on screen and does not count.
    const prev = t.scenes[i - 1];
    const from = s.start + (prev?.out ? prev.out.duration / 2 : 0);
    const to = s.start + s.length - (s.out && next ? s.out.duration / 2 : 0);
    const seen = (start: number, length: number) => start < to - 1e-6 && start + length > from + 1e-6;
    for (const l of s.layers) {
      const at = s.start + l.start;
      if (l.enter && l.enter.duration > 0) out.push({ kind: 'enter', scene: s.id, layer: l.id, use: l.use, start: s.start + l.enter.start, length: l.enter.duration });
      if (l.exit && l.exit.duration > 0) out.push({ kind: 'exit', scene: s.id, layer: l.id, use: l.use, start: s.start + l.exit.start, length: l.exit.duration });
      if (l.cues) {
        for (const c of l.cues) if (seen(at + c.at, c.length)) out.push({ kind: 'change', scene: s.id, layer: l.id, use: l.use, start: at + c.at, length: c.length, lane: `${s.id}/${l.id}/${c.lane ?? 0}`, ...(c.share !== undefined ? { share: c.share } : {}) });
      } else if (l.duration > 0) out.push({ kind: 'run', scene: s.id, layer: l.id, use: l.use, start: at, length: Math.min(l.duration, s.length - l.start) });
    }
  });
  return out.sort((a, b) => a.start - b.start);
}

/** Rests between consecutive changes in each lane: [lane, rest, the change after it]. */
function restsOf(moves: readonly PaceMove[]): { lane: string; rest: number; after: PaceMove }[] {
  const lanes = new Map<string, PaceMove[]>();
  for (const m of moves) if (m.kind === 'change' && m.lane) lanes.set(m.lane, [...(lanes.get(m.lane) ?? []), m]);
  const out: { lane: string; rest: number; after: PaceMove }[] = [];
  for (const [lane, ms] of lanes) {
    ms.sort((a, b) => a.start - b.start);
    for (let k = 1; k < ms.length; k++) out.push({ lane, rest: ms[k]!.start - (ms[k - 1]!.start + ms[k - 1]!.length), after: ms[k]! });
  }
  return out;
}

/**
 * The moves that count towards time in motion. Tiles of a wall that change on their
 * own clocks read as one living surface, each tile resting in turn, so a layer with
 * several lanes counts as its busiest lane only.
 */
function motionSpans(moves: readonly PaceMove[]): [number, number][] {
  const lanesOf = new Map<string, Map<string, number>>();
  for (const m of moves) {
    if (m.kind !== 'change' || !m.lane) continue;
    const key = `${m.scene}/${m.layer}`, lanes = lanesOf.get(key) ?? new Map<string, number>();
    lanes.set(m.lane, (lanes.get(m.lane) ?? 0) + m.length);
    lanesOf.set(key, lanes);
  }
  const keep = new Set([...lanesOf.values()].map((lanes) => [...lanes].sort((a, b) => b[1] - a[1])[0]![0]));
  return moves.filter((m) => m.kind !== 'change' || !m.lane || keep.has(m.lane)).map((m) => [m.start, m.start + m.length]);
}

const spreadOf = (xs: readonly number[]) => (xs.length < 2 ? 1 : Math.max(...xs) / Math.max(1e-6, Math.min(...xs)));
/** Lengths grouped by what made them, for a message: "scene/bento-grid 0.60 s, scene/strip-cycle 1.03 s". */
function byUse(ms: readonly PaceMove[]): string {
  const m = new Map<string, Set<string>>();
  for (const x of ms) m.set(x.use, (m.get(x.use) ?? new Set()).add(x.length.toFixed(2)));
  return [...m].map(([use, ls]) => `${use} ${[...ls].sort().join('/')} s`).join(', ');
}

export function pace(t: Timeline): Pace {
  const issues: Issue[] = [];
  const warn = (path: string, code: string, message: string, hint?: string) => issues.push({ level: 'warning', code, path, message, ...(hint ? { hint } : {}) });
  const moves = movesOf(t);
  const beat = t.tempo ? beatLength(t.tempo) : undefined;
  const tempo = t.tempo && beat ? { ...t.tempo, beat, barLength: beat * t.tempo.bar } : undefined;
  const inBeats = (s: number) => (beat ? ` (${+(s / beat).toFixed(2)} beats)` : '');

  // ---- scenes, and hand-overs against the scenes they join -------------------------
  const scenes: ScenePace[] = t.scenes.map((s, i) => {
    const before = t.scenes[i - 1];
    const inn = before?.out?.duration ?? 0, out = i < t.scenes.length - 1 ? s.out?.duration ?? 0 : 0;
    const own = moves.filter((m) => m.scene === s.id || (m.kind === 'hand-over' && before && m.scene === before.id));
    const rests = restsOf(own.filter((m) => m.kind === 'change' && m.scene === s.id)).map((r) => r.rest);
    return {
      id: s.id, start: s.start, end: s.end, length: s.length, in: inn, out, alone: Math.max(0, s.length - inn - out),
      moving: s.length > 0 ? covered(motionSpans(own), s.start, s.end) / s.length : 0,
      changes: own.filter((m) => m.kind === 'change' && m.scene === s.id).length,
      rate: s.length > 0 ? own.filter((m) => m.kind === 'change' && m.scene === s.id).reduce((a, m) => a + (m.share ?? 1), 0) / s.length : 0,
      ...(rests.length ? { rest: [Math.min(...rests), Math.max(...rests)] as [number, number] } : {}),
    };
  });
  t.scenes.forEach((s, i) => {
    const next = t.scenes[i + 1];
    if (!s.out || !next || s.out.duration <= 0) return;
    const d = s.out.duration, shorter = Math.min(s.length, next.length);
    if (d > shorter * PACE.handoverShare + 1e-6) {
      warn(`scenes.${s.id}.out.duration`, 'handover-long',
        `The hand-over from "${s.id}" to "${next.id}" takes ${fmt(d)}${inBeats(d)}, ${Math.round((d / shorter) * 100)}% of the shorter scene (${fmt(shorter)}). It reads as a section of its own.`,
        `Keep a hand-over within a quarter of the shorter scene (${fmt(shorter * PACE.handoverIdeal)} here), or give the scenes more time.`);
    }
  });
  for (const sc of scenes) {
    const longest = Math.max(sc.in, sc.out);
    if (longest > 0 && sc.alone < PACE.aloneTimes * longest - 1e-6) {
      warn(`scenes.${sc.id}`, 'handover-crowds',
        `Scene "${sc.id}" is on screen alone for only ${fmt(sc.alone)}${inBeats(sc.alone)}: its hand-overs take ${fmt(sc.in)} in and ${fmt(sc.out)} out. The transitions outweigh the section.`,
        `Give it at least ${fmt(PACE.aloneTimes * longest)} alone (${fmt(PACE.aloneTimes * longest + sc.in + sc.out)} in all), or shorten its hand-overs.`);
    }
  }

  // A scene that changes pictures is felt picture by picture, not as a whole: a
  // hand-over as long as one picture's time on screen reads as one more section.
  const median = (xs: number[]) => { const v = [...xs].sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) / 2)]! : 0; };
  const shotOf = new Map<string, number>();
  for (const s of t.scenes) {
    const own = moves.filter((m) => m.kind === 'change' && m.scene === s.id);
    const rests = restsOf(own).map((r) => r.rest);
    if (rests.length) shotOf.set(s.id, median(rests) + median(own.map((m) => m.length)));
  }
  t.scenes.forEach((s, i) => {
    const next = t.scenes[i + 1];
    if (!s.out || !next || s.out.duration <= 0) return;
    const shots = [s.id, next.id].filter((id) => shotOf.has(id)).map((id) => [id, shotOf.get(id)!] as const);
    if (!shots.length) return;
    const [id, shot] = shots.sort((a, b) => a[1] - b[1])[0]!;
    if (s.out.duration > shot * PACE.shotShare + 1e-6) {
      warn(`scenes.${s.id}.out.duration`, 'handover-vs-picture',
        `The hand-over from "${s.id}" to "${next.id}" takes ${fmt(s.out.duration)}${inBeats(s.out.duration)}, as long as ${Math.round((s.out.duration / shot) * 100)}% of one picture's time in "${id}" (${fmt(shot)}, rest and change). It is felt as one more picture, not as a seam.`,
        `Keep it within half a picture's time (${fmt(shot * PACE.shotShare)}): one beat, where a picture is held for two or more.`);
    }
  });
  const rates = scenes.filter((sc) => sc.changes > 0).map((sc) => [sc.id, sc.rate] as const);
  if (rates.length > 1) {
    const lo = rates.reduce((a, b) => (b[1] < a[1] ? b : a)), hi = rates.reduce((a, b) => (b[1] > a[1] ? b : a));
    if (hi[1] > lo[1] * PACE.density) {
      warn(`scenes.${hi[0]}`, 'uneven-density',
        `Scene "${hi[0]}" changes ${Math.round(hi[1] * 100)}% of the frame a second, "${lo[0]}" ${Math.round(lo[1] * 100)}%: the film lurches between busy and slow.`,
        'Keep the rate of change within twice from scene to scene. A change counts by how much of the frame it changes: a tile a fifth of the frame counts a fifth. Swap fewer tiles at once, or rest the busier scene longer.');
    }
  }

  // ---- like moves take like time -------------------------------------------------
  const handovers = moves.filter((m) => m.kind === 'hand-over');
  if (spreadOf(handovers.map((m) => m.length)) > PACE.spread) {
    warn('scenes', 'uneven-handovers', `Hand-overs take different times: ${byUse(handovers)}. The film speeds up and slows down at its seams.`,
      'Give every hand-over one length, one or two beats; save a longer one for a single turn of the story at most.');
  }
  const changes = moves.filter((m) => m.kind === 'change');
  if (spreadOf(changes.map((m) => m.length)) > PACE.spread) {
    warn('scenes', 'uneven-changes', `Changes inside scenes take different times: ${byUse(changes)}. Some feel rushed, others slow.`,
      'Give every swap, turn and shift one length (a beat, or two), whichever primitive draws it.');
  }
  const rests = restsOf(moves);
  const short = rests.filter((r) => r.rest < PACE.minRest - 1e-6);
  if (short.length) {
    const r = short[0]!;
    warn(`scenes.${r.after.scene}.layers.${r.after.layer}`, 'short-rest',
      `A picture rests only ${fmt(r.rest)} between changes in "${r.after.layer}"${short.length > 1 ? ` (${short.length} times in the film)` : ''}: too short to be seen.`,
      `Rest at least ${fmt(PACE.minRest)} (two beats or more) between changes.`);
  }
  if (spreadOf(rests.map((r) => r.rest)) > PACE.restSpread) {
    const xs = rests.map((r) => r.rest);
    warn('scenes', 'uneven-rests', `Rests between changes run from ${fmt(Math.min(...xs))} to ${fmt(Math.max(...xs))}. The rhythm stumbles.`,
      'Rest the same time between every change in the film; let only the opening and closing holds differ.');
  }
  const moving = t.duration > 0 ? covered(motionSpans(moves), 0, t.duration) / t.duration : 0;
  if (moves.length && moving > PACE.moving[1]) {
    warn('scenes', 'restless', `Something moves ${Math.round(moving * 100)}% of the time. With so little held, nothing reads.`,
      'Aim for about a third in motion: longer rests, fewer parts changing at once, or changes that share a moment instead of following each other.');
  } else if (moves.length && moving < PACE.moving[0]) {
    warn('scenes', 'stalled', `Only ${Math.round(moving * 100)}% of the film is in motion; the rest waits.`, 'Shorten the holds, or keep a slow drift under them.');
  }

  // ---- the grid --------------------------------------------------------------------
  if (tempo) {
    const tol = 1 / t.fps + 1e-6, half = tempo.beat / 2;
    const where = (s: number) => {
      const b = s / tempo.beat;
      return `bar ${Math.floor(b / tempo.bar) + 1}, beat ${+((b % tempo.bar) + 1).toFixed(2)}`;
    };
    t.scenes.forEach((s, i) => {
      if (i === 0) return;
      const prev = t.scenes[i - 1]!;
      const d = prev.out?.duration ?? 0, cut = s.start + d / 2;
      if (offGrid(cut, tempo.barLength) > tol) {
        warn(prev.out ? `scenes.${prev.id}.out` : `scenes.${prev.id}`, 'off-grid',
          `The cut into "${s.id}" lands at ${fmt(cut)}, ${where(cut)}. Scene changes land on the first beat of a bar.`,
          `${d ? 'The cut is the middle of the hand-over. ' : ''}Make "${prev.id}" a whole number of bars from the last cut.`);
      }
    });
    const bySceneOff = new Map<string, PaceMove[]>();
    for (const m of moves) {
      if (m.kind === 'hand-over') {
        if (offGrid(m.length, half) > tol) bySceneOff.set(m.scene, [...(bySceneOff.get(m.scene) ?? []), m]);
        continue;
      }
      const off = offGrid(m.start, half) > tol || (m.kind !== 'run' && offGrid(m.length, half) > tol);
      if (off) bySceneOff.set(m.scene, [...(bySceneOff.get(m.scene) ?? []), m]);
    }
    for (const [scene, ms] of bySceneOff) {
      const eg = ms.slice(0, 3).map((m) => `${m.layer ?? m.use} ${m.kind} at ${fmt(m.start)} for ${fmt(m.length)}`).join('; ');
      warn(`scenes.${scene}`, 'off-beat', `${ms.length} move(s) in "${scene}" start or end off the half-beat (${fmt(half)}): ${eg}.`,
        'Write their times and lengths in beats ("1b", "0.5b") so they land on the pulse.');
    }
    if (t.loop && offGrid(t.duration, tempo.barLength) > tol) {
      warn('scenes', 'loop-bars', `The loop is ${fmt(t.duration)}, ${+(t.duration / tempo.barLength).toFixed(2)} bars: it restarts mid-bar, so the pulse jumps at the seam.`,
        `Make it a whole number of bars (${tempo.barLength.toFixed(2)} s each).`);
    }
  }

  return { duration: t.duration, ...(tempo ? { tempo } : {}), moves, scenes, moving, issues };
}

/** One row per scene, one cell per beat (or quarter second): ≈ hand-over, █ change, ▒ other move, · still. */
export function rhythmChart(t: Timeline, p: Pace): string[] {
  const cell = p.tempo ? p.tempo.beat : 0.25, per = p.tempo ? p.tempo.bar : 4;
  const cells = Math.ceil(t.duration / cell - 1e-6);
  const width = Math.max(...t.scenes.map((s) => s.id.length), 5);
  const row = (s: ResolvedScene, i: number) => {
    const before = t.scenes[i - 1];
    let out = '';
    for (let c = 0; c < cells; c++) {
      if (c % per === 0) out += '|';
      const mid = (c + 0.5) * cell;
      const on = (m: PaceMove) => mid >= m.start && mid < m.start + m.length;
      if (mid < s.start || mid >= s.end) { out += ' '; continue; }
      const ms = p.moves.filter(on);
      if (ms.some((m) => m.kind === 'hand-over' && (m.scene === s.id || m.scene === before?.id))) out += '≈';
      else if (ms.some((m) => m.scene === s.id && m.kind === 'change')) out += '█';
      else if (ms.some((m) => m.scene === s.id)) out += '▒';
      else out += '·';
    }
    return `${s.id.padEnd(width)} ${out}|`;
  };
  return t.scenes.map(row);
}

export function describePace(t: Timeline, p: Pace): string {
  const lines: string[] = [];
  const b = (s: number) => (p.tempo ? `${+(s / p.tempo.beat).toFixed(2)}b` : '');
  if (p.tempo) lines.push(`tempo ${p.tempo.bpm} bpm, ${p.tempo.bar} beats a bar: beat ${fmt(p.tempo.beat)}, bar ${fmt(p.tempo.barLength)}; film ${fmt(p.duration)} = ${+(p.duration / p.tempo.barLength).toFixed(2)} bars`);
  else lines.push(`no tempo: film ${fmt(p.duration)}. Add "tempo": {"bpm": …} to count it in beats.`);
  lines.push(`moving ${Math.round(p.moving * 100)}% of the time`, '');
  lines.push(`${'scene'.padEnd(14)} ${'length'.padStart(8)} ${'in'.padStart(6)} ${'out'.padStart(6)} ${'alone'.padStart(7)} ${'moving'.padStart(7)} changes ${'frame/s'.padStart(7)}  rests`);
  for (const s of p.scenes) {
    lines.push(`${s.id.padEnd(14)} ${s.length.toFixed(2).padStart(8)} ${s.in.toFixed(2).padStart(6)} ${s.out.toFixed(2).padStart(6)} ${s.alone.toFixed(2).padStart(7)} ${`${Math.round(s.moving * 100)}%`.padStart(7)} ${String(s.changes).padStart(7)} ${`${Math.round(s.rate * 100)}%`.padStart(7)}  ${s.rest ? `${s.rest[0].toFixed(2)}–${s.rest[1].toFixed(2)} s` : ''}`);
  }
  const kinds: [MoveKind, string][] = [['hand-over', 'hand-overs'], ['change', 'changes'], ['enter', 'enters'], ['exit', 'exits']];
  lines.push('');
  for (const [k, label] of kinds) {
    const ms = p.moves.filter((m) => m.kind === k);
    if (!ms.length) continue;
    const lens = [...new Set(ms.map((m) => `${m.length.toFixed(2)} s${p.tempo ? ` ${b(m.length)}` : ''}`))];
    lines.push(`${label.padEnd(11)} ${ms.length} × ${lens.join(', ')}`);
  }
  lines.push('', `rhythm (one cell per ${p.tempo ? 'beat' : '0.25 s'}, | every ${p.tempo ? 'bar' : 'second'}; ≈ hand-over, █ change, ▒ other move, · still)`);
  lines.push(...rhythmChart(t, p));
  return lines.join('\n');
}
