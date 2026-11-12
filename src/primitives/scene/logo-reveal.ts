// scene/logo-reveal. See library/primitives/scene/logo-reveal.md.
import { progress } from '../../core/ease.ts';
import { pointsPath, shapePoints } from '../../core/shapes.ts';
import { num, str, type Primitive } from '../types.ts';

const SVG = 'http://www.w3.org/2000/svg';

const timing = (p: Record<string, unknown>, hasName: boolean, hasTag: boolean) => {
  const arrive = num(p.arrive), slide = hasName ? num(p.slide) : 0;
  const nameAt = arrive + 0.15;
  const tagAt = nameAt + slide * 0.7;
  return { arrive, slide, nameAt, tagAt, end: hasTag ? tagAt + 0.7 : nameAt + slide };
};

export const logoReveal: Primitive = {
  slug: 'scene/logo-reveal',
  summary: 'The mark lands, then moves aside as the name slides out from behind it.',
  props: {
    name: { type: 'string', default: '', label: 'Wordmark text. Left out, the mark lands alone' },
    tagline: { type: 'string', default: '', label: 'One short line under the lockup' },
    mark_path: { type: 'string', default: '', label: 'SVG path data of the mark. Left out, a shape is used' },
    mark_viewbox: { type: 'string', default: '0 0 100 100', label: 'viewBox of mark_path' },
    mark_shape: { type: 'string', default: 'squircle', label: 'Shape used when there is no mark_path' },
  },
  params: {
    mode: { type: 'choice', default: 'pop', options: ['pop', 'draw', 'iris'], label: 'How the mark arrives' },
    arrive: { type: 'number', default: 0.8, min: 0.5, max: 1.6, step: 0.05, unit: 's', label: 'Time for the mark to land' },
    slide: { type: 'number', default: 0.8, min: 0.5, max: 1.2, step: 0.05, unit: 's', label: 'Time for the name to slide out' },
    mark_size: { type: 'number', default: 1.1, min: 0.6, max: 2, step: 0.05, unit: 'em', label: 'Mark height, relative to the name' },
    gap: { type: 'number', default: 0.35, min: 0.1, max: 1, step: 0.05, unit: 'em', label: 'Gap between mark and name' },
  },
  duration: (props, p) => timing(p, !!str(props.name), !!str(props.tagline)).end,
  build(el, props, p, ctx) {
    const doc = el.ownerDocument;
    const name = str(props.name), tagline = str(props.tagline), mode = str(p.mode);
    const T = timing(p, !!name, !!tagline);
    el.style.cssText += ';display:flex;flex-direction:column;align-items:center';
    const lockup = doc.createElement('div');
    lockup.style.cssText = `display:flex;align-items:center;gap:${num(p.gap)}em;white-space:nowrap`;
    // The mark: a given path, or a shape from the library's set.
    const mh = num(p.mark_size);
    const svg = doc.createElementNS(SVG, 'svg');
    const own = str(props.mark_path);
    svg.setAttribute('viewBox', own ? str(props.mark_viewbox, '0 0 100 100') : '-1 -1 2 2');
    svg.style.cssText = `display:block;height:${mh}em;width:${mh}em;overflow:visible;position:relative;z-index:1;flex:none`;
    const mark = doc.createElementNS(SVG, 'path');
    mark.setAttribute('d', own || pointsPath(shapePoints(str(props.mark_shape, 'squircle'), 160, ctx.seed), 0, 0, 1));
    mark.setAttribute('fill', 'var(--m-bg-accent)');
    mark.setAttribute('pathLength', '1');
    mark.setAttribute('stroke-dasharray', '1 1');
    mark.setAttribute('stroke', 'var(--m-bg-accent)');
    mark.setAttribute('stroke-width', own ? '2' : '0.05');
    mark.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(mark);
    lockup.appendChild(svg);
    let word: HTMLElement | undefined, wordBox: HTMLElement | undefined;
    if (name) {
      wordBox = doc.createElement('span');
      wordBox.style.cssText = 'display:block;overflow:hidden;padding:0.12em 0.04em;margin:-0.12em -0.04em';
      word = doc.createElement('span');
      word.textContent = name;
      word.style.cssText = 'display:block';
      wordBox.appendChild(word);
      lockup.appendChild(wordBox);
    }
    el.appendChild(lockup);
    let tag: HTMLElement | undefined;
    if (tagline) {
      tag = doc.createElement('div');
      tag.textContent = tagline;
      tag.style.cssText = 'font-size:0.32em;font-weight:450;letter-spacing:0.01em;color:var(--m-text-muted);margin-top:0.9em';
      el.appendChild(tag);
    }
    // How far the mark sits right of its final place while it lands alone, in px.
    const shift = word ? (lockup.offsetWidth - svg.getBoundingClientRect().width / scaleOf(el)) / 2 : 0;
    const pop = ctx.ease({ spring: { duration: 0.55, bounce: 0.32 } }), glide = ctx.ease('quint.inOut'), out = ctx.ease('expressive.out');
    return {
      seek(t) {
        const a = progress(t, 0, T.arrive, mode === 'pop' ? pop : out);
        if (mode === 'pop') {
          svg.style.transform = `scale(${Math.max(0, a).toFixed(4)}) rotate(${((1 - a) * -30).toFixed(3)}deg)`;
          mark.setAttribute('stroke-dashoffset', '0');
          mark.setAttribute('fill-opacity', '1');
        } else if (mode === 'draw') {
          const d = progress(t, 0, T.arrive * 0.8, glide), f = progress(t, T.arrive * 0.65, T.arrive * 0.35, out);
          mark.setAttribute('stroke-dashoffset', (1 - d).toFixed(4));
          mark.setAttribute('fill-opacity', f.toFixed(3));
          svg.style.transform = '';
        } else {
          // iris: the mark opens from a point at its centre
          svg.style.clipPath = a >= 1 ? '' : `circle(${(a * 75).toFixed(3)}% at 50% 50%)`;
          svg.style.transform = `scale(${(1.25 - 0.25 * a).toFixed(4)})`;
          mark.setAttribute('stroke-dashoffset', '0');
        }
        const s = progress(t, T.nameAt, T.slide, glide);
        const markX = shift * (1 - s);
        lockup.style.transform = markX === 0 ? '' : `translateX(${markX.toFixed(2)}px)`;
        if (word && wordBox) {
          // The name comes out from behind the mark: it travels with a clip at its left edge.
          const nk = progress(t, T.nameAt, T.slide, out);
          word.style.transform = nk >= 1 ? '' : `translateX(${(-(1 - nk) * 105).toFixed(3)}%)`;
          wordBox.style.visibility = t < T.nameAt ? 'hidden' : 'inherit';
        }
        if (tag) {
          const k = progress(t, T.tagAt, 0.7, out);
          tag.style.opacity = k.toFixed(3);
          tag.style.transform = k >= 1 ? '' : `translateY(${((1 - k) * 0.6).toFixed(3)}em)`;
        }
      },
    };
  },
};

function scaleOf(el: HTMLElement): number {
  const stage = el.closest<HTMLElement>('.m-stage');
  if (!stage || !stage.offsetWidth) return 1;
  return stage.getBoundingClientRect().width / stage.offsetWidth;
}
