// Panels a transition draws over both scenes, such as a colour that covers the cut.
// They live in the stage, are created on first use and removed by `clearOverlays`.

export function overlay(scene: HTMLElement, key: string, count = 1): HTMLElement[] {
  const stage = scene.parentElement;
  if (!stage) return [];
  const out: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    let el = stage.querySelector<HTMLElement>(`:scope > [data-m-overlay="${key}-${i}"]`);
    if (!el) {
      el = scene.ownerDocument.createElement('div');
      el.dataset.mOverlay = `${key}-${i}`;
      el.style.cssText = `position:absolute;inset:0;z-index:${1000 + i};pointer-events:none;will-change:transform,clip-path`;
      stage.appendChild(el);
    }
    out.push(el);
  }
  return out;
}

export function clearOverlays(scene: HTMLElement, key: string) {
  scene.parentElement?.querySelectorAll(`:scope > [data-m-overlay^="${key}-"]`).forEach((el) => el.remove());
}

/** A surface name or a CSS colour, as a background. */
export const fillOf = (v: string): string =>
  ['base', 'surface', 'sunken', 'accent', 'inverse'].includes(v) ? `var(--m-bg-${v})` : v;
