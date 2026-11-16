// Slide by slide: the same five slides first as a social carousel post, then as
// bare posters. `node bin/motion.mjs make films/post-carousel.film.mjs` writes
// post-carousel.film.json.
import { film, layer, scene } from '@bydiorama/motion/build';

const C = { ink: '#14161C', paper: '#ECE9E2', lime: '#D7F25C', blue: '#2C47D9', grey: '#B8B8B4' };

const svg = (w, h, body) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`)}`;
const PICTURE = svg(800, 1000, `<rect width="800" height="1000" fill="${C.blue}"/><circle cx="400" cy="420" r="230" fill="${C.lime}"/><rect x="170" y="640" width="460" height="230" rx="30" fill="${C.ink}"/>`);
const ROOM = svg(800, 1000, `<rect width="800" height="1000" fill="${C.grey}"/><rect x="0" y="640" width="800" height="360" fill="#8E8E8A"/><rect x="140" y="250" width="240" height="420" rx="16" fill="${C.paper}"/><rect x="420" y="360" width="240" height="310" rx="16" fill="${C.ink}"/>`);

const page = (bg, fg, inner) => `<div style="width:100%;height:100%;box-sizing:border-box;padding:7% 8%;background:${bg};color:${fg};display:flex;flex-direction:column;justify-content:space-between;font-family:var(--m-font-body)">${inner}</div>`;
const small = (s) => `<span style="font:500 0.5em/1.3 var(--m-font-body);opacity:.75">${s}</span>`;
const head = (s, size = 1.5) => `<span style="font:600 ${size}em/1.02 var(--m-font-display);letter-spacing:-0.02em">${s}</span>`;
const SLIDES = [
  page(C.lime, C.ink, `${small('Case study')}${head('Data, finally<br>in one place', 1.9)}${small('Swipe →')}`),
  `<img src="${PICTURE}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`,
  page(C.paper, C.ink, `${head('The team reduced reporting time by', 0.9)}${head('180%', 3.6)}`),
  page(C.ink, C.paper, `${head('“It replaced four tools and a weekly spreadsheet.”', 1.05)}${small('Head of operations')}`),
  `<img src="${ROOM}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`,
];

export default film({
  title: 'Post carousel', size: [1080, 1350], fps: 30, poster: 0.5,
  theme: { scheme: 'dark', accent: '#FF4D5E' },
  scenes: [
    scene('post', [
      layer('post', 'scene/post-carousel', {
        props: { slides: SLIDES, handle: 'northwind.data' },
        params: { width: 56, ratio: '4:5', chrome: 'post', hold: 1.4, turn: 0.8, angle: 72 },
      }),
    ], { intent: 'A carousel post read slide by slide, the next one always waiting beside it.', background: C.ink, layout: { padding: 0, justify: 'center' }, hold: 0.6, out: { use: 'transition/push', duration: 0.7 } }),
    scene('posters', [
      layer('posters', 'scene/post-carousel', {
        props: { slides: SLIDES },
        params: { width: 62, ratio: '4:5', chrome: 'none', hold: 1.2, turn: 0.8, angle: 66 },
      }),
    ], { intent: 'The same slides as bare posters.', background: '#1E2028', layout: { padding: 0, justify: 'center' }, hold: 1 }),
  ],
});
