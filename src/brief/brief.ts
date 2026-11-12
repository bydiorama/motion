// The brief: a wizard's answers turned into a prompt an assistant can act on.
//
// It is a pure function of the answers, the catalog and the library. No dates,
// no randomness, a fixed order everywhere, so the same answers always give the
// same text, and a brief can be regenerated, diffed and reviewed like code.
import type { Catalog } from '../catalog.ts';
import type { Answers, Feel, Format, Library, LibraryNarrative, LibraryStyle } from './types.ts';

export const FORMATS: Record<Format, { size: [number, number]; label: string }> = {
  '16:9': { size: [1920, 1080], label: 'Landscape' },
  '1:1': { size: [1080, 1080], label: 'Square' },
  '4:5': { size: [1080, 1350], label: 'Portrait' },
  '9:16': { size: [1080, 1920], label: 'Vertical' },
};

/** How a feel changes the film's timing tokens. Crisp is the library default. */
export const FEELS: Record<Feel, { label: string; summary: string; tokens: Record<string, unknown> }> = {
  calm: {
    label: 'Calm', summary: 'Slow, soft arrivals and long holds. Lets the message breathe.',
    tokens: { duration: { base: 0.8, slow: 1.2 }, stagger: { base: 0.12 }, ease_enter: 'sine.out', hold: 1 },
  },
  crisp: {
    label: 'Crisp', summary: 'Fast arrivals that settle precisely. The library default.',
    tokens: { duration: { base: 0.5, slow: 0.8 }, stagger: { base: 0.08 }, ease_enter: 'expo.out', hold: 0.6 },
  },
  lively: {
    label: 'Lively', summary: 'Quick, springy, a little overshoot. For social and launches.',
    tokens: { duration: { base: 0.4, slow: 0.6 }, stagger: { base: 0.05 }, ease_enter: { spring: { duration: 0.4, bounce: 0.3 } }, hold: 0.4 },
  },
};

const title = (slug: string) => {
  const name = slug.split('/').pop() ?? slug;
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');
};
const fps = 60;
/** Seconds, snapped to whole frames and printed without float noise. */
const sec = (n: number) => `${Number((Math.round(n * fps) / fps).toFixed(2))} s`;
const lines = (text: string | undefined) => (text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

export interface Beat { name: string; start: number; end: number; content: string; moves: string[] }

/** The narrative's beats laid over the chosen length. The last beat takes the rounding. */
export function beats(narrative: LibraryNarrative, duration: number): Beat[] {
  let at = 0;
  return narrative.beats.map((b, i, all) => {
    const end = i === all.length - 1 ? duration : at + Math.round((duration * b.share) / 100 * 10) / 10;
    const beat = { name: b.name, start: at, end, content: b.content, moves: b.primitives };
    at = end;
    return beat;
  });
}

export interface BriefContext { catalog: Catalog; library: Library }

/** Answers that point at nothing, before a brief is written. Empty when they are fine. */
export function checkAnswers(a: Answers, { library }: BriefContext): string[] {
  const problems: string[] = [];
  const narrative = library.narratives.find((n) => n.slug === a.type);
  if (!narrative) problems.push(`Unknown video type "${a.type}". Known: ${library.narratives.map((n) => n.slug).join(', ')}`);
  if (!library.styles.some((s) => s.slug === a.style)) problems.push(`Unknown look "${a.style}". Known: ${library.styles.map((s) => s.slug).join(', ')}`);
  if (!(a.feel in FEELS)) problems.push(`Unknown feel "${a.feel}". Known: ${Object.keys(FEELS).join(', ')}`);
  if (!a.formats.length) problems.push('Pick at least one format.');
  for (const f of a.formats) if (!(f in FORMATS)) problems.push(`Unknown format "${f}". Known: ${Object.keys(FORMATS).join(', ')}`);
  if (!a.subject.trim()) problems.push('Say what the video is about.');
  if (!a.message.trim()) problems.push('Say the one thing a viewer should remember.');
  if (!(a.duration > 0)) problems.push('The length must be a number of seconds.');
  return problems;
}

export function writeBrief(a: Answers, ctx: BriefContext): string {
  const problems = checkAnswers(a, ctx);
  if (problems.length) throw new Error(problems.join('\n'));
  const { catalog, library } = ctx;
  const narrative = library.narratives.find((n) => n.slug === a.type)!;
  const style = library.styles.find((s) => s.slug === a.style) as LibraryStyle;
  const feel = FEELS[a.feel];
  const runtime = new Map([...catalog.primitives, ...catalog.transitions].map((p) => [p.slug, p]));
  const entry = new Map(library.primitives.map((p) => [p.slug, p]));
  const formats = [...a.formats].sort((x, y) => Object.keys(FORMATS).indexOf(x) - Object.keys(FORMATS).indexOf(y));
  const [w, h] = FORMATS[formats[0]!].size;
  const story = beats(narrative, a.duration);

  // Moves: what the story and the look suggest, plus what the person picked, in a stable order.
  const wanted = [...new Set([...story.flatMap((b) => b.moves), ...style.uses, ...(a.moves ?? [])])].filter((s) => !style.avoids.includes(s));
  const drawable = wanted.filter((s) => runtime.has(s)).sort();
  const missing = wanted.filter((s) => !runtime.has(s)).sort();
  const describe = (slug: string) => {
    const p = runtime.get(slug)!;
    const params = Object.entries(p.params as Record<string, { default: unknown; min?: number; max?: number; unit?: string }>)
      .map(([k, s]) => `${k} ${JSON.stringify(s.default)}${s.min !== undefined ? ` (${s.min}–${s.max}${s.unit ? ` ${s.unit}` : ''})` : ''}`);
    const props = 'props' in p ? Object.keys(p.props as Record<string, unknown>) : [];
    return `- \`${slug}\`: ${p.summary}${props.length ? ` Props: ${props.join(', ')}.` : ''}${params.length ? ` Params: ${params.join(', ')}.` : ''}`;
  };

  const tokens = { beat: style.beat ?? catalog.tokens.beat, ...feel.tokens };
  const theme = { ...(a.scheme ? { scheme: a.scheme } : {}), ...(a.accent ? { accent: a.accent } : {}) };
  const sizeNote = formats.length > 1
    ? `Make the ${formats[0]} film first. Then make one film per other format (${formats.slice(1).map((f) => `${f} at ${FORMATS[f].size.join('×')}`).join(', ')}) with the same scenes, re-laid for the frame, not cropped.`
    : '';
  const outOfRange = a.duration < narrative.duration.min || a.duration > narrative.duration.max;

  const out: string[] = [];
  const push = (...l: string[]) => out.push(...l);
  push(`# Motion brief: ${a.subject.trim()}`, '');
  push(a.target === 'agent'
    ? 'You are directing a short motion video with the bydiorama motion library, in its repository. You write the film as JSON; the runtime draws, checks and renders it. A person will tune it afterwards in the studio and leave notes for you.'
    : 'You are directing a short motion video for the bydiorama motion library. You cannot run it: write the film as JSON exactly as described below, and the person will paste it into the library to preview, tune and render it.', '');

  push('## The video', '');
  push(`- Type: ${title(narrative.slug)}. ${narrative.summary}`);
  push(`- Look: ${title(style.slug)}. ${style.summary}${style.character ? ` ${style.character}` : ''}`);
  push(`- Feel: ${feel.label}. ${feel.summary}`);
  push(`- Length: ${sec(a.duration)} at ${fps} fps.${outOfRange ? ` This type usually runs ${narrative.duration.min}–${narrative.duration.max} s, so compress or stretch the beats to fit.` : ''}`);
  push(`- Formats: ${formats.map((f) => `${f} (${FORMATS[f].size.join('×')})`).join(', ')}.${sizeNote ? ` ${sizeNote}` : ''}`);
  if (Object.keys(theme).length) push(`- Brand: ${[a.scheme ? `${a.scheme} scheme` : '', a.accent ? `accent ${a.accent}` : ''].filter(Boolean).join(', ')}. Use the accent once per scene at most.`);
  push('');

  push('## What it says', '');
  push(`- About: ${a.subject.trim()}`, `- Remember: ${a.message.trim()}`);
  if (a.intent.trim()) push(`- Afterwards the viewer should: ${a.intent.trim()}`);
  if (a.audience?.trim()) push(`- Audience: ${a.audience.trim()}`);
  const content = lines(a.content);
  if (content.length) push('- Use this content, word for word where it is quoted:', ...content.map((l) => `  - ${l}`));
  if (a.avoid?.trim()) push(`- Avoid: ${a.avoid.trim()}`);
  push('- Every word on screen must be short enough to read twice in the time it stays.', '');

  push('## Story', '', '| # | Beat | Time | What happens | Suggested moves |', '|---|---|---|---|---|');
  story.forEach((b, i) => push(`| ${i + 1} | ${b.name} | ${sec(b.start)}–${sec(b.end)} | ${b.content} | ${b.moves.map((m) => `\`${m}\``).join(', ') || '–'} |`));
  push('', 'One scene per beat is a good start; merge beats that are shorter than 1.5 s. Scenes hand over with a transition (`out`), and the overlap counts toward both.', '');

  push('## Moves', '', 'Drawable now (use these slugs in `use`):', '');
  push(...drawable.map(describe));
  const basics = [...runtime.keys()].filter((s) => s.startsWith('el/')).sort();
  push(`- Plain elements for anything else: ${basics.map((s) => `\`${s}\``).join(', ')}.`);
  if (missing.length) {
    push('', 'In the library but not drawable yet. Get the effect from the moves above, or say which one you would need:', '');
    push(...missing.map((s) => `- \`${s}\`: ${entry.get(s)?.summary ?? 'no entry yet'}`));
  }
  if (style.avoids.length) push('', `Do not use: ${style.avoids.map((s) => `\`${s}\``).join(', ')}.`);
  push('');

  push('## Timing', '', 'Put these in the film\'s `tokens` and refer to them (`"$duration.base"`) instead of writing numbers:', '', '```json', JSON.stringify(tokens, null, 2), '```', '');

  push('## The film', '');
  const skeleton = {
    motion: catalog.motion, title: a.subject.trim(), size: [w, h], fps, narrative: narrative.slug, style: style.slug,
    ...(Object.keys(theme).length ? { theme } : {}),
    tokens,
    scenes: story.slice(0, 2).map((b, i) => ({
      id: b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `scene-${i + 1}`,
      intent: b.content,
      layers: [{ id: 'title', use: drawable.find((s) => s.startsWith('type/')) ?? 'el/text', props: { text: i === 0 ? a.message.trim() : '…' }, style: { size: i === 0 ? 'headline' : 'title' } }],
      ...(i === 0 ? { out: { use: drawable.find((s) => s.startsWith('transition/')) ?? 'transition/blur-dissolve' } } : {}),
    })),
  };
  push('Start from this shape and complete every beat:', '', '```json', JSON.stringify(skeleton, null, 2), '```', '');
  push('Rules: ids are lowercase with dashes. `props` hold content, `params` hold motion. A layer starts at `at` (seconds, or relative such as `"title.end + 0.2"`). Moves are `enter`/`exit`: `fade`, `rise`, `drop`, `scale`, `blur`, `slide-left`, `slide-right`. Text sizes: `hero`, `headline`, `title`, `body`, `caption`.');
  push('');

  push('## How to deliver', '');
  if (a.target === 'agent') {
    push(
      '1. Read `catalog.json` (every prop, param, ease and token) and `library.json` (styles and narratives). Use the motion-film skill if it is installed.',
      `2. Write \`films/<name>.film.json\`. Run \`node bin/motion.mjs validate films/<name>.film.json\` and fix every error; the hints name the fix.`,
      '3. Run `node bin/motion.mjs stills films/<name>.film.json` and look at the contact sheet. Fix text that collides, leaves the frame or cannot be read.',
      '4. Run `node bin/motion.mjs check films/<name>.film.json`. It must say the frames repeat exactly.',
      '5. Tell the person to open the studio: `node bin/motion.mjs preview films/<name>.film.json`. Never edit the `.tune.json` file; read its notes with `node bin/motion.mjs notes` and answer them in the film.',
    );
  } else {
    push(
      '1. Reply with the complete film as one JSON code block, and nothing else in the block.',
      '2. Under it, list any beat you could not draw with the moves above and what you would need.',
      '3. The person saves it as `films/<name>.film.json` and runs `node bin/motion.mjs validate` on it. If they paste errors back, fix exactly those and return the whole film again.',
    );
  }
  push('', '## Done when', '', '- Every beat above is on screen, in order, inside the length.', '- The message is readable for at least 1.5 s.', '- Only drawable moves are used, with params inside their ranges.', '- Nothing leaves the frame by accident, and the last frame can hold as a poster.', '');
  return out.join('\n');
}
