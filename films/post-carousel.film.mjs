// Slide by slide: the same five slides first as a social carousel post, then as
// bare posters.
//
// Placeholders wear bydiorama/ui (theme zero, dark): Aspekta, the ui colour
// roles and radii, and no colour of their own, so a different `theme.ui` or
// `accent` restyles every slide. `node bin/motion.mjs make
// films/post-carousel.film.mjs` writes post-carousel.film.json.
import { film, layer, scene } from '@bydiorama/motion/build';

// ui colour roles. Inline SVG reads them through style, never through fill="".
const R = {
  page: 'var(--m-bg-base)', card: 'var(--m-bg-surface)', well: 'var(--m-bg-sunken)',
  accent: 'var(--m-bg-accent)', subtle: 'var(--ui-bg-accent-subtle)', ink: 'var(--m-bg-inverse)',
  text: 'var(--m-text-primary)', muted: 'var(--m-text-muted)', onInk: 'var(--m-text-inverse)', onAccent: 'var(--m-text-on-accent)',
};

const art = (ground, body) => `<svg viewBox="0 0 800 1000" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%;display:block"><rect width="800" height="1000" style="fill:${ground}"/>${body}</svg>`;
const f = (c) => `style="fill:${c}"`;
const ORB = art(R.card, `<circle cx="400" cy="420" r="230" ${f(R.accent)}/><rect x="170" y="650" width="460" height="220" rx="44" ${f(R.ink)}/>`);
const ROOM = art(R.well, `<rect y="660" width="800" height="340" ${f(R.card)}/><rect x="140" y="250" width="240" height="430" rx="28" ${f(R.ink)}/><rect x="420" y="370" width="240" height="310" rx="28" ${f(R.accent)}/>`);

const page = (ground, fg, inner) => `<div style="width:100%;height:100%;box-sizing:border-box;padding:8%;background:${ground};color:${fg};display:flex;flex-direction:column;justify-content:space-between;font-family:var(--m-font-body)">${inner}</div>`;
const small = (s) => `<span style="font:500 0.42em/1.3 var(--m-font-body);opacity:.72">${s}</span>`;
const head = (s, size = 1.5) => `<span style="font:500 ${size}em/1.02 var(--m-font-display);letter-spacing:-0.02em">${s}</span>`;
const SLIDES = [
  page(R.accent, R.onAccent, `${small('Case study')}${head('Data, finally<br>in one place', 1.7)}${small('Swipe →')}`),
  ORB,
  page(R.ink, R.onInk, `${head('The team reduced reporting time by', 0.95)}${head('180%', 3.4)}`),
  page(R.card, R.text, `${head('<span style="color:var(--m-accent)">“</span>It replaced four tools and a weekly spreadsheet.”', 0.98)}${small('Head of operations')}`),
  ROOM,
];

export default film({
  title: 'Post carousel', size: [1080, 1350], fps: 30, poster: 0.5,
  theme: { ui: 'zero', scheme: 'dark' },
  scenes: [
    scene('post', [
      layer('post', 'scene/post-carousel', {
        props: { slides: SLIDES, handle: 'northwind.data' },
        params: { width: 56, ratio: '4:5', chrome: 'post', hold: 1.4, turn: 0.8, angle: 72 },
      }),
    ], { intent: 'A carousel post read slide by slide, the next one always waiting beside it.', background: 'base', layout: { padding: 0, justify: 'center' }, hold: 0.6, out: { use: 'transition/push', duration: 0.7 } }),
    scene('posters', [
      layer('posters', 'scene/post-carousel', {
        props: { slides: SLIDES },
        params: { width: 62, ratio: '4:5', chrome: 'none', hold: 1.2, turn: 0.8, angle: 66 },
      }),
    ], { intent: 'The same slides as bare posters.', background: 'sunken', layout: { padding: 0, justify: 'center' }, hold: 1 }),
  ],
});
