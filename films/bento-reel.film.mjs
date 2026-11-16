// A bento loop: seven tiles on one grid, each cycling its own content a phase
// apart. The wordmark holds; every other tile swaps with its own move.
//
// Placeholders wear bydiorama/ui (theme zero): Aspekta, the ui colour roles and
// radii, and no colour of their own, so a different `theme.ui` or `accent`
// restyles every tile. `node bin/motion.mjs make films/bento-reel.film.mjs`
// writes bento-reel.film.json.
import { film, layer, scene } from '@bydiorama/motion/build';

// ui colour roles. Inline SVG reads them through style, never through fill="".
const R = {
  page: 'var(--m-bg-base)', card: 'var(--m-bg-surface)', well: 'var(--m-bg-sunken)',
  accent: 'var(--m-bg-accent)', subtle: 'var(--ui-bg-accent-subtle)', ink: 'var(--m-bg-inverse)',
  text: 'var(--m-text-primary)', muted: 'var(--m-text-muted)', onInk: 'var(--m-text-inverse)', onAccent: 'var(--m-text-on-accent)', line: 'var(--m-border)',
};

/** An abstract picture drawn in ui roles, covering its tile. */
const art = (ground, body) => `<svg viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%;display:block"><rect width="800" height="800" style="fill:${ground}"/>${body}</svg>`;
const f = (c) => `style="fill:${c}"`;
const ARCHES = art(R.accent, `<path d="M120 800V430a170 170 0 0 1 340 0v370Z" ${f(R.ink)}/><path d="M400 800V530a140 140 0 0 1 280 0v270Z" ${f(R.card)}/><circle cx="610" cy="220" r="78" ${f(R.page)}/>`);
const BLOCKS = art(R.subtle, `<rect x="170" y="480" width="460" height="180" rx="32" ${f(R.ink)}/><rect x="250" y="300" width="300" height="180" rx="32" ${f(R.card)}/><circle cx="400" cy="200" r="90" ${f(R.accent)}/>`);
const HILLS = art(R.ink, `<circle cx="560" cy="260" r="110" ${f(R.accent)}/><path d="M0 800V570c160-120 300-120 460 0s260 80 340 30v200Z" ${f(R.well)}/>`);

const type = (size, color = 'inherit') => `font:500 ${size}px/1 var(--m-font-display);letter-spacing:-0.02em;color:${color}`;
const label = (s, color = R.muted) => `<span style="font:500 28px/1.3 var(--m-font-body);color:${color}">${s}</span>`;
/** A tile of text: a label above, a figure or a word below. */
const panel = (ground, fg, top, bottom, size) => `<div style="width:100%;height:100%;box-sizing:border-box;padding:32px 36px;background:${ground};color:${fg};display:flex;flex-direction:column;justify-content:space-between">${top}<span style="${type(size, fg)}">${bottom}</span></div>`;
const poster = (kicker, title, pic) => `<div style="position:relative;width:100%;height:100%;background:${R.card}">${pic.replace('position:absolute;inset:0;width:100%;height:100%', 'position:absolute;left:20px;top:20px;width:calc(100% - 40px);height:58%;border-radius:var(--ui-radius-md)')}<div style="position:absolute;left:30px;right:30px;bottom:26px;display:flex;flex-direction:column;gap:10px">${label(kicker)}<span style="${type(44, R.text)}">${title}</span></div></div>`;
/** A notification card in ui's own manner: a hairline, no shadow. */
const toast = (who, text) => `<div style="width:100%;height:100%;display:grid;place-items:center;background:${R.well}"><div style="width:86%;box-sizing:border-box;padding:24px 26px;border-radius:var(--ui-radius-lg);background:${R.page};box-shadow:inset 0 0 0 1px ${R.line};display:flex;gap:18px;align-items:center"><i style="flex:none;width:52px;height:52px;border-radius:999px;background:${R.accent}"></i><div style="display:flex;flex-direction:column;gap:4px">${label(who)}<span style="font:500 30px/1.25 var(--m-font-body);color:${R.text}">${text}</span></div></div></div>`;

export default film({
  title: 'Bento reel', size: [1920, 1080], fps: 30, loop: true, poster: 0,
  theme: { ui: 'zero', scheme: 'light', vars: { '--m-card-radius': 'var(--ui-radius-xl)' } },
  scenes: [
    scene('bento', [
      layer('grid', 'scene/bento-grid', {
        props: {
          areas: 'a b b c / d b b e / d f g e',
          counts: [1, 3, 3, 3, 3, 3, 3],
          items: [
            // a: the wordmark holds.
            panel(R.accent, R.onAccent, label('Spring set', R.onAccent), 'ferro', 124),
            // b: the hero, three pictures.
            ARCHES, BLOCKS, HILLS,
            // c: posters.
            poster('No. 01', 'Made slowly', HILLS), poster('No. 02', 'Fired twice', ARCHES), poster('No. 03', 'Kept for years', BLOCKS),
            // d: numbers.
            panel(R.card, R.text, label('Pieces this season'), '48', 160),
            panel(R.ink, R.onInk, label('Glazes', R.onInk), '12', 160),
            panel(R.subtle, R.text, label('Studios'), '3', 160),
            // e: a stack of messages.
            toast('Studio', 'The kiln is cooling.'), toast('Orders', 'Twelve new this morning.'), toast('Ana', 'The blue came out right.'),
            // f: words.
            panel(R.well, R.text, label('Material'), 'Stoneware', 46), panel(R.well, R.text, label('Finish'), 'Satin', 46), panel(R.well, R.text, label('Care'), 'By hand', 46),
            // g: the palette, named by role.
            panel(R.accent, R.onAccent, label('Accent', R.onAccent), 'Brand blue', 40), panel(R.ink, R.onInk, label('Inverse', R.onInk), 'Warm ink', 40), panel(R.card, R.text, label('Surface'), 'Stone', 40),
          ],
          swaps: ['fade', 'flip', 'slide-left', 'fade', 'stack', 'slide-up', 'slide-up'],
        },
        params: { width: 94, gap: 16, hold: 1.6, swap_time: 0.7, offset: 0.3, stagger: 0 },
      }),
    ], { intent: 'A brand shown as one living grid: each tile cycles its own content, a phase apart.', background: 'base', layout: { padding: 0, justify: 'center' }, hold: 0 }),
  ],
});
