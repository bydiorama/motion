// Directional motion blur. CSS blur() is round, but a moving thing only smears
// along its path. An SVG Gaussian takes a separate deviation across and down, so
// a whip blurs sideways and a vertical camera move blurs vertically, never both.
//
// One filter per element, kept in a zero-size <svg> inside the stage. The filter
// region is grown with the deviation, so a long streak is not cut at the box.
const SVG = 'http://www.w3.org/2000/svg';
const filters = new WeakMap<Element, { id: string; filter: SVGFilterElement; blur: SVGFEGaussianBlurElement }>();
let count = 0;

/**
 * Gaussian deviation, in px, of the streak left by something moving `speed` px
 * per frame, seen through a shutter open for `shutter` of a frame (0.5 is the
 * 180° film shutter). A streak of length L is a box, whose deviation is L/√12.
 */
export const streak = (speed: number, shutter: number): number => (Math.abs(speed) * Math.max(0, shutter)) / Math.sqrt(12);

/** Below this deviation the smear is invisible, so no filter is set. */
export const MIN_BLUR = 0.25;

/**
 * A CSS `filter` value that smears `el` by deviations `sx` across and `sy` down
 * (px), or '' when both are too small to see. Combine it with other filters by
 * joining with a space.
 */
export function directionalBlur(el: HTMLElement, sx: number, sy: number, max = 48): string {
  const x = Math.min(max, Math.abs(sx)), y = Math.min(max, Math.abs(sy));
  if (x < MIN_BLUR && y < MIN_BLUR) return '';
  let f = filters.get(el);
  if (!f) {
    const doc = el.ownerDocument;
    const host = el.closest('.m-stage') ?? doc.body;
    let svg = host.querySelector<SVGSVGElement>(':scope > svg.m-filters');
    if (!svg) {
      svg = doc.createElementNS(SVG, 'svg') as SVGSVGElement;
      svg.setAttribute('class', 'm-filters');
      svg.setAttribute('aria-hidden', 'true');
      // Not display: none, which switches the filters off in some engines.
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
      host.appendChild(svg);
    }
    const id = `m-dblur-${++count}`;
    const filter = doc.createElementNS(SVG, 'filter') as SVGFilterElement;
    filter.setAttribute('id', id);
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const blur = doc.createElementNS(SVG, 'feGaussianBlur') as SVGFEGaussianBlurElement;
    filter.appendChild(blur);
    svg.appendChild(filter);
    f = { id, filter, blur };
    filters.set(el, f);
  }
  // Three deviations each side hold the whole tail of the Gaussian.
  const w = Math.max(1, el.offsetWidth), h = Math.max(1, el.offsetHeight);
  const mx = (3 * x) / w, my = (3 * y) / h;
  f.filter.setAttribute('x', (-mx).toFixed(4));
  f.filter.setAttribute('y', (-my).toFixed(4));
  f.filter.setAttribute('width', (1 + 2 * mx).toFixed(4));
  f.filter.setAttribute('height', (1 + 2 * my).toFixed(4));
  f.blur.setAttribute('stdDeviation', `${x.toFixed(2)} ${y.toFixed(2)}`);
  return `url(#${f.id})`;
}
