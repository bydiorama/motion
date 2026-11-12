// Small films the wizard plays as thumbnails. They are ordinary films drawn by the
// real runtime, so a thumbnail shows exactly what a move or a look does, and
// `previews.test.ts` checks every one of them like any other film.
//
// They are drawn in a quiet monochrome that matches the page.
import { FEELS } from '../brief/brief.ts';
import type { Feel, LibraryNarrative } from '../brief/types.ts';
import type { Film, Layer, Scene } from '../film/types.ts';

const SIZE: [number, number] = [1920, 1080];
const SANS = 'Aspekta, "Helvetica Neue", Helvetica, Arial, sans-serif';

export type Tone = 'light' | 'dark';

/** The page's own greys, so thumbnails sit quietly in the wizard. */
export function mono(tone: Tone): Record<string, string> {
  const dark = tone === 'dark';
  return {
    '--m-bg-base': dark ? '#2B2B2B' : '#FBFBFA',
    '--m-bg-surface': dark ? '#383838' : '#ECECEB',
    '--m-bg-sunken': dark ? '#232323' : '#E6E6E5',
    '--m-bg-accent': dark ? '#D4D4D3' : '#3B3B3A',
    '--m-bg-inverse': dark ? '#F3F3F2' : '#1E1E1E',
    '--m-text-primary': dark ? '#EDEDEC' : '#1E1E1E',
    '--m-text-secondary': dark ? '#C9C9C8' : '#3B3B3A',
    '--m-text-muted': dark ? '#9A9A99' : '#7A7A79',
    '--m-text-inverse': dark ? '#1E1E1E' : '#F3F3F2',
    '--m-text-on-accent': dark ? '#1E1E1E' : '#FFFFFF',
    '--m-accent': dark ? '#8C8C8B' : '#9C9C9B',
    '--m-border': dark ? '#4A4A4A' : '#D3D3D2',
    '--m-font-display': SANS,
    '--m-font-body': SANS,
  };
}

const film = (title: string, scenes: Scene[], tone: Tone, extra: Partial<Film> = {}): Film => ({
  motion: '0.4', title, size: SIZE, fps: 30, loop: true, ...extra,
  theme: { ...extra.theme, vars: { ...mono(tone), ...extra.theme?.vars } },
  scenes,
});
const scene = (id: string, layers: Layer[], more: Partial<Scene> = {}): Scene => ({ id, layers, ...more });

const WORDS = ['Comments', 'Cursors', 'History', 'Branches', 'Review', 'Share', 'Export', 'Search'];

/** Text big enough to read in a thumbnail a few hundred pixels wide. */
const BIG = { 'font-size': 'calc(var(--m-u) * 7.4)', 'line-height': '1.05' };

/**
 * The main layer that shows a move by itself, or undefined when the runtime cannot
 * draw it. Text moves show `text` when given, e.g. what a beat says.
 */
export function moveLayer(slug: string, id = 'move', text?: string): Layer | undefined {
  switch (slug) {
    case 'type/word-build': return { id, use: slug, props: { text: text ?? 'Edit together, live', accent: text ? [] : ['live'] }, style: { size: 'headline', width: 86, css: BIG } };
    case 'type/typed-title': return { id, use: slug, props: { text: text ?? 'Atlas' }, style: text ? { size: 'headline', width: 86, css: BIG } : { size: 'hero' } };
    case 'type/scramble': return { id, use: slug, props: { text: text ?? 'Launch day' }, style: { size: 'headline', width: 86, css: BIG } };
    case 'fx/counter-roll': return { id, use: slug, props: { value: 98, suffix: '%' }, style: { size: 'hero' } };
    case 'fx/stagger-fill': return { id, use: slug, props: { items: WORDS.slice(0, 6) }, style: { size: 'title', width: 80 } };
    case 'fx/depth-drift': return { id, use: slug, props: { items: WORDS } , style: { size: 'title' } };
    case 'scene/marquee-wall': return { id, use: slug, props: { items: [...WORDS, ...WORDS], highlight: 'Review' }, params: { highlight_at: 1.2 }, style: { size: 'title' } };
    case 'rig/orbit-ring': return { id, use: slug, props: { items: WORDS.slice(0, 6) } };
    case 'texture/halftone-field': return { id, use: slug, params: { cell: 20, reach: 1 } };
    default: return undefined;
  }
}

/** A thumbnail film for one drawable move or transition. */
export function movePreview(slug: string, tone: Tone): Film | undefined {
  if (slug.startsWith('transition/')) {
    return film(slug, [
      scene('before', [{ id: 'a', use: 'el/text', props: { text: 'Before' }, style: { size: 'hero' } }], { length: 1.4, background: 'base', out: { use: slug } }),
      scene('after', [{ id: 'b', use: 'el/text', props: { text: 'After' }, style: { size: 'hero' } }], { length: 1.6, background: 'inverse' }),
    ], tone);
  }
  const layer = moveLayer(slug);
  if (!layer) return undefined;
  const full = slug === 'scene/marquee-wall' || slug === 'texture/halftone-field';
  return film(slug, [scene('only', [layer], {
    hold: 1.2, background: slug === 'rig/orbit-ring' ? 'sunken' : 'base',
    ...(full ? { length: 3.5, layout: { padding: 0, justify: 'center' } } : {}),
  })], tone);
}

/** The same small sequence at each feel, so the difference is only timing. */
export function feelPreview(feel: Feel, tone: Tone): Film {
  return film(feel, [scene('feel', [
    { id: 'line', use: 'type/word-build', props: { text: 'Every move, on time' }, style: { size: 'headline' } },
    { id: 'chips', use: 'fx/stagger-fill', at: 'line.end - 0.2', props: { items: ['One', 'Two', 'Three', 'Four'] }, style: { size: 'title' } },
  ], { hold: '$hold_end' })], tone, { tokens: FEELS[feel].tokens as NonNullable<Film['tokens']> });
}

/**
 * A video type as an animatic: one short scene per beat, in proportion to its
 * share, showing the beat's move when the runtime can draw it and its words
 * when it cannot.
 */
export function typePreview(n: LibraryNarrative, tone: Tone, seconds = 7): Film {
  const scenes = n.beats.map((b, i) => {
    const drawable = b.primitives.map((p) => moveLayer(p, 'beat', b.content)).find(Boolean);
    const label: Layer = { id: 'label', use: 'el/text', props: { text: `${i + 1}/${n.beats.length}  ${b.name}` }, place: { x: 5, y: 8, anchor: 'top-left' },
      style: { size: 'title', color: 'muted', css: { 'font-size': 'calc(var(--m-u) * 4.4)' } } };
    const body: Layer = drawable ?? { id: 'beat', use: 'el/text', props: { text: b.content }, style: { size: 'headline', width: 86, css: BIG }, enter: { move: 'rise', amount: 40 } };
    const length = Math.max(0.6, Math.round((b.share / 100) * seconds * 10) / 10);
    return scene(`b${i + 1}`, [label, body], { length, background: i % 2 ? 'sunken' : 'base' });
  });
  return film(n.slug, scenes, tone);
}
