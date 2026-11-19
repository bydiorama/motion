// Small films the wizard plays as thumbnails. They are ordinary films drawn by the
// real runtime, so a thumbnail shows exactly what a move or a look does, and
// `previews.test.ts` checks every one of them like any other film.
//
// They wear the page's own theme, bydiorama/ui's Graphite: Aspekta, no chroma.
import { FEELS } from '../brief/brief.ts';
import type { Feel, LibraryNarrative } from '../brief/types.ts';
import type { Film, Layer, Scene } from '../film/types.ts';
import { TRANSITIONS } from '../primitives/index.ts';

const SIZE: [number, number] = [1920, 1080];

export type Tone = 'light' | 'dark';

const film = (title: string, scenes: Scene[], tone: Tone, extra: Partial<Film> = {}): Film => ({
  motion: '0.4', title, size: SIZE, fps: 30, loop: true, ...extra,
  // The wizard page wears bydiorama/ui's Graphite; so do its thumbnails, in the page's scheme.
  theme: { ui: 'graphite', scheme: tone, ...extra.theme },
  scenes,
});
const scene = (id: string, layers: Layer[], more: Partial<Scene> = {}): Scene => ({ id, layers, ...more });

const WORDS = ['Comments', 'Cursors', 'History', 'Branches', 'Review', 'Share', 'Export', 'Search'];

/** A drawn stand-in for a picture, as a data URI: thumbnails ship no image files. */
const svg = (w: number, h: number, body: string): string =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`)}`;
/** A photograph: sky, two ridges and a sun. */
const PICTURE = svg(800, 600, '<rect width="800" height="600" fill="#B9B9B8"/><circle cx="590" cy="170" r="54" fill="#E4E4E3"/><path d="M0 600 L0 420 L210 230 L380 400 L520 300 L800 520 L800 600Z" fill="#8A8A89"/><path d="M0 600 L0 520 L300 380 L560 520 L800 440 L800 600Z" fill="#5E5E5D"/>');
/** Three sections of a page: a dark hero, a headline with cards, a block of text. */
const PAGE = [
  svg(800, 520, '<rect width="800" height="520" fill="#3B3B3A"/><rect x="200" y="200" width="400" height="44" rx="8" fill="#E4E4E3"/><rect x="290" y="270" width="220" height="24" rx="6" fill="#9C9C9B"/>'),
  svg(800, 620, '<rect width="800" height="620" fill="#F3F3F2"/><rect x="60" y="70" width="360" height="40" rx="8" fill="#3B3B3A"/><rect x="60" y="170" width="210" height="360" rx="12" fill="#C9C9C8"/><rect x="295" y="170" width="210" height="360" rx="12" fill="#B0B0AF"/><rect x="530" y="170" width="210" height="360" rx="12" fill="#C9C9C8"/>'),
  svg(800, 560, '<rect width="800" height="560" fill="#E0E0DF"/><rect x="60" y="80" width="300" height="40" rx="8" fill="#3B3B3A"/><rect x="60" y="170" width="680" height="18" rx="6" fill="#9C9C9B"/><rect x="60" y="215" width="640" height="18" rx="6" fill="#9C9C9B"/><rect x="60" y="260" width="560" height="18" rx="6" fill="#9C9C9B"/><rect x="60" y="360" width="180" height="56" rx="10" fill="#5E5E5D"/>'),
];

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
    case 'type/mask-reveal': return { id, use: slug, props: { text: text ?? 'Motion that\nfeels designed' }, style: { size: 'headline', width: 86, css: BIG } };
    case 'type/char-cascade': return { id, use: slug, props: { text: text && text.length <= 12 ? text : 'Kinetic' }, params: { from: 'center' }, style: { size: 'hero' } };
    case 'type/block-reveal': return { id, use: slug, props: { text: text ?? 'Brand.\nMotion.' }, style: { size: 'headline', width: 86, css: BIG } };
    case 'type/word-roller': return { id, use: slug, props: { before: 'Made for', words: ['teams', 'films', 'brands'] }, style: { size: 'headline', css: BIG } };
    case 'type/tracking-in': return { id, use: slug, props: { text: text ?? 'ATLAS' }, style: { size: 'hero' } };
    case 'type/shimmer': return { id, use: slug, props: { text: text ?? 'Shipped' }, style: { size: 'hero' } };
    case 'type/echo': return { id, use: slug, props: { text: text && text.length <= 12 ? text : 'Again' }, style: { size: 'hero' } };
    case 'type/scribble-highlight': return { id, use: slug, props: { text: text ?? 'Ship it today', mark: [(text ?? 'Ship it today').split(/\s+/).pop() ?? ''] }, params: { delay: 0.1 }, style: { size: 'headline', width: 86, css: BIG } };
    case 'fx/odometer': return { id, use: slug, props: { value: 12480 }, style: { size: 'hero' } };
    case 'scene/grid-wall': {
      // Plain grey tiles of mixed proportions: the move is the packing and the opening order.
      const tile = (grey: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="${grey}"/></svg>`)}`;
      const ratios = [1.3, 0.75, 1, 1.5, 0.8, 1.2, 0.7, 1.4, 1, 0.9, 1.6, 0.8];
      return { id, use: slug, props: { images: ratios.map((_, i) => tile(['#9C9C9B', '#B5B5B4', '#7A7A79'][i % 3]!)), ratios }, params: { columns: 4, width: 70, gap: 20, drift_speed: 0 } };
    }
    case 'fx/path-draw': return { id, use: slug, props: { paths: ['M10 50 C 30 10, 70 10, 90 50 S 70 90, 50 70', 'M20 80 L 80 20'], viewbox: '0 0 100 100' }, params: { width: 30, stroke: 4 } };
    case 'fx/shape-morph': return { id, use: slug, props: { shapes: ['circle', 'squircle', 'star'] }, params: { size: 34 } };
    case 'fx/grid-ripple': return { id, use: slug, params: { cols: 20, opacity: 0.8 } };
    case 'scene/logo-reveal': return { id, use: slug, props: { name: 'Atlas', tagline: text ?? '' }, style: { size: 'hero' } };
    case 'scene/bar-chart': return { id, use: slug, props: { values: [32, 48, 41, 76, 58], labels: ['A', 'B', 'C', 'D', 'E'], highlight: 'D' }, params: { width: 70, height: 62 }, style: { size: 'headline' } };
    case 'scene/line-chart': return { id, use: slug, props: { values: [12, 18, 15, 24, 22, 31, 29, 42] }, params: { width: 80, height: 60, draw: 1.4 }, style: { size: 'headline' } };
    case 'texture/gradient-drift': return { id, use: slug, params: { period: 6 } };
    case 'texture/grain': return { id, use: slug, params: { amount: 0.22 } };
    case 'texture/vignette': return { id, use: slug, screen: true, params: { strength: 1, mid: 0.7 } };
    case 'texture/beat-field': return { id, use: slug, params: { glow: 0.3, ring: 0.45, paper: 0.08 } };
    case 'ui/cursor-click': return { id, use: slug, params: { size: 4 } };
    case 'type/fill-text': return { id, use: slug, props: { text: text ?? 'Noise into signal', accent: text ? [] : ['signal'] }, style: { size: 'headline', width: 86, css: BIG } };
    case 'texture/signal-field': return { id, use: slug, params: { cols: 24, settle_at: 0.4 } };
    case 'rig/tab-stack': return { id, use: slug, props: { items: ['Monitor', 'Detect', 'Respond', 'Report'], details: ['', '', '', 'Every signal, in one place.'] }, params: { width: 80, slide_at: 0.5, slide: 1.2 } };
    case 'rig/layer-stack': return { id, use: slug, props: { items: ['Base', 'Rules', 'Parts', 'Uses'], name: 'One layer' }, params: { width: 46, gap: 150, start: 0.5, travel: 0.7 } };
    case 'rig/footage-plane': return { id, use: slug, place: { x: 50, y: 50 }, props: { src: PICTURE }, params: { width: 900, radius: 20 } };
    case 'rig/browser-window': return { id, use: slug, props: { lift: [36, 54, 28, 38] }, params: { width: 90, move: 0.9 } };
    case 'fx/slow-push': return { id, use: slug, props: { src: PICTURE }, params: { width: 1040, height: 780, radius: 24, from: 1, to: 1.16, pan_x: -6, duration: 3 } };
    case 'fx/pan-across': return { id, use: slug, props: { src: PICTURE }, params: { width: 560, height: 780, aspect: 800 / 600, from: 10, to: 90, duration: 3 } };
    case 'ui/page-scroll': return { id, use: slug, props: { srcs: PAGE, stops: [45] }, params: { width: 1000, height: 820, radius: 24, duration: 2.6, rest: 0.5, delay: 0.3 } };
    case 'scene/bento-grid': {
      const word = (s: string) => `<b style="font:700 calc(var(--m-u) * 6)/1 var(--m-font-display);color:var(--m-text-primary)">${s}</b>`;
      return { id, use: slug, props: {
        areas: 'a b c / d b e', counts: [1, 2, 2, 2, 2],
        items: [word('Atlas'), PICTURE, PAGE[1]!, word('01'), word('02'), PAGE[0]!, PICTURE, word('Go'), word('On')],
      }, params: { width: 84, hold: 1.25, swap_time: 0.5, offset: 0.2, stagger: 0 } };
    }
    case 'scene/post-carousel': return { id, use: slug, props: { slides: [PICTURE, PAGE[1]!, PAGE[0]!], handle: 'atlas' }, params: { width: 30, hold: 0.8, turn: 0.6, loop: true } };
    case 'scene/strip-cycle': return { id, use: slug, props: { images: [PICTURE, PAGE[0]!], fills: ['accent', 'inverse'] }, params: { rows: 6, hold: 0.6, shift: 0.7, stagger: 0.05, empty: 'both' } };
    case 'fx/pin-drop': return { id, use: slug, props: { points: [28, 70, 70, 55], labels: ['Found', 'Here'] }, params: { size: 28, stem: 220 } };
    default: return undefined;
  }
}

/** Moves that fill the stage and loop, so their thumbnails get a set length and no padding. */
const FULL_STAGE = new Set(['scene/marquee-wall', 'scene/bento-grid', 'texture/halftone-field', 'texture/gradient-drift', 'texture/grain', 'texture/vignette', 'texture/beat-field', 'fx/grid-ripple', 'ui/cursor-click', 'texture/signal-field', 'fx/pin-drop', 'scene/strip-cycle']);

const handover = (slug: string): number => { const d = TRANSITIONS[slug]?.duration; return typeof d === 'number' ? d : 0.8; };

/** A thumbnail film for one drawable move or transition. */
export function movePreview(slug: string, tone: Tone): Film | undefined {
  if (slug.startsWith('transition/')) {
    return film(slug, [
      // Long hand-overs get a longer first scene, so the hand-over still fits inside it.
      scene('before', [{ id: 'a', use: 'el/text', props: { text: 'Before' }, style: { size: 'hero' } }], { length: Math.max(1.4, handover(slug) + 0.6), background: 'base', out: { use: slug } }),
      scene('after', [{ id: 'b', use: 'el/text', props: { text: 'After' }, style: { size: 'hero' } }], { length: 1.6, background: 'inverse' }),
    ], tone);
  }
  const layer = moveLayer(slug);
  if (!layer) return undefined;
  const full = FULL_STAGE.has(slug);
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
