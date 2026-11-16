// A bento loop: seven tiles on one grid, each cycling its own content a phase
// apart. The wordmark holds; every other tile swaps with its own move.
// `node bin/motion.mjs make films/bento-reel.film.mjs` writes bento-reel.film.json.
import { film, layer, scene } from '@bydiorama/motion/build';

const C = { ink: '#231F1B', cream: '#EFE8DC', clay: '#C8553D', sage: '#8AA38B', ochre: '#D9A441', sky: '#A9C6D9', plum: '#5B3A4A' };

/** An abstract picture as a data URI, so the film ships no image files. */
const svg = (w, h, body) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`)}`;
const arches = (bg, a, b) => svg(800, 800, `<rect width="800" height="800" fill="${bg}"/><path d="M120 800V420a170 170 0 0 1 340 0v380Z" fill="${a}"/><path d="M400 800V520a140 140 0 0 1 280 0v280Z" fill="${b}"/><circle cx="600" cy="220" r="80" fill="${C.cream}"/>`);
const stack = (bg, a, b) => svg(800, 800, `<rect width="800" height="800" fill="${bg}"/><rect x="180" y="470" width="440" height="180" rx="24" fill="${a}"/><rect x="250" y="300" width="300" height="170" rx="24" fill="${b}"/><circle cx="400" cy="210" r="90" fill="${a}"/>`);
const hills = (bg, a, b) => svg(800, 800, `<rect width="800" height="800" fill="${bg}"/><circle cx="560" cy="250" r="110" fill="${b}"/><path d="M0 800V560c160-120 300-120 460 0s260 80 340 30v210Z" fill="${a}"/>`);

const box = (bg, fg, inner, extra = '') => `<div style="width:100%;height:100%;box-sizing:border-box;padding:28px 32px;background:${bg};color:${fg};display:flex;flex-direction:column;justify-content:space-between;${extra}">${inner}</div>`;
const label = (s) => `<span style="font:500 26px/1.2 var(--m-font-body);opacity:.85">${s}</span>`;
const big = (s, size = 64) => `<span style="font:600 ${size}px/0.95 var(--m-font-display);letter-spacing:-0.02em">${s}</span>`;
const poster = (bg, fg, kicker, title, pic) => `<div style="position:relative;width:100%;height:100%;background:${bg};color:${fg}"><img src="${pic}" style="position:absolute;left:24px;right:24px;top:24px;height:58%;width:calc(100% - 48px);object-fit:cover;border-radius:10px"><div style="position:absolute;left:30px;right:30px;bottom:28px">${label(kicker)}<div style="margin-top:10px">${big(title, 46)}</div></div></div>`;
const note = (bg, who, text) => `<div style="width:100%;height:100%;display:grid;place-items:center;background:${C.ink}"><div style="width:88%;box-sizing:border-box;padding:26px 28px;border-radius:16px;background:${bg};color:${C.ink};display:flex;gap:16px;align-items:center"><i style="flex:none;width:52px;height:52px;border-radius:12px;background:${C.ink};opacity:.85"></i><div><div style="font:600 22px/1.2 var(--m-font-body);opacity:.6">${who}</div><div style="font:500 30px/1.25 var(--m-font-body)">${text}</div></div></div></div>`;

export default film({
  title: 'Bento reel', size: [1920, 1080], fps: 30, loop: true, poster: 0,
  theme: { scheme: 'dark', accent: C.clay, vars: { '--m-bg-sunken': '#15120F', '--m-bg-surface': C.cream } },
  scenes: [
    scene('bento', [
      layer('grid', 'scene/bento-grid', {
        props: {
          areas: 'a b b c / d b b e / d f g e',
          counts: [1, 3, 3, 3, 3, 3, 3],
          items: [
            // a: the wordmark holds.
            box(C.sky, C.cream, `${label('Spring set')}${big('ferro', 120)}`, 'justify-content:space-between'),
            // b: the hero, three pictures.
            arches(C.clay, C.cream, C.ochre), stack(C.sage, C.ink, C.cream), hills(C.plum, C.ochre, C.sky),
            // c: posters.
            poster(C.ochre, C.ink, 'No. 01', 'Made slowly', arches(C.ink, C.clay, C.cream)),
            poster(C.cream, C.ink, 'No. 02', 'Fired twice', hills(C.sage, C.ink, C.ochre)),
            poster(C.ink, C.cream, 'No. 03', 'Kept for years', stack(C.clay, C.cream, C.ochre)),
            // d: numbers.
            box(C.cream, C.ink, `${label('Pieces this season')}${big('48', 150)}`),
            box(C.sage, C.ink, `${label('Glazes')}${big('12', 150)}`),
            box(C.ochre, C.ink, `${label('Studios')}${big('3', 150)}`),
            // e: a stack of messages.
            note(C.cream, 'Studio', 'The kiln is cooling.'), note(C.sky, 'Orders', 'Twelve new this morning.'), note(C.ochre, 'Ana', 'The blue came out right.'),
            // f: words.
            box(C.plum, C.cream, `${label('Material')}${big('Stoneware', 44)}`), box(C.plum, C.cream, `${label('Finish')}${big('Satin', 44)}`), box(C.plum, C.cream, `${label('Care')}${big('By hand', 44)}`),
            // g: colour.
            box(C.clay, C.cream, `${label('Clay')}${big('#C8553D', 36)}`), box(C.sage, C.ink, `${label('Sage')}${big('#8AA38B', 36)}`), box(C.ochre, C.ink, `${label('Ochre')}${big('#D9A441', 36)}`),
          ],
          swaps: ['fade', 'flip', 'slide-left', 'fade', 'stack', 'slide-up', 'slide-up'],
        },
        params: { width: 94, gap: 14, hold: 1.6, swap_time: 0.7, offset: 0.3, stagger: 0 },
      }),
    ], { intent: 'A brand shown as one living grid: each tile cycles its own content, a phase apart.', background: '#15120F', layout: { padding: 0, justify: 'center' }, hold: 0 }),
  ],
});
