// rig/orbit-ring, combined with texture/depth-fade as its entry asks.
// See library/primitives/rig/orbit-ring.md and texture/depth-fade.md.
import { list, num, type Primitive } from '../types.ts';

const LOOKS = ['inverse', 'plain', 'accent', 'tint'] as const;

export const orbitRing: Primitive = {
  slug: 'rig/orbit-ring',
  summary: 'Tiles on a tilted ring that rotates forever.',
  props: { items: { type: 'string[]', default: [], label: 'Tile labels. Repeated to fill the ring; empty tiles when left out.' } },
  params: {
    tiles: { type: 'number', default: 12, min: 8, max: 16, step: 1, unit: 'tiles', label: 'Tiles' },
    tilt_x: { type: 'number', default: 25, min: 15, max: 35, step: 1, unit: 'deg', label: 'Pitch', pad: { name: 'tilt', axis: 'y' } },
    tilt_z: { type: 'number', default: -20, min: -30, max: -10, step: 1, unit: 'deg', label: 'Roll', pad: { name: 'tilt', axis: 'x' } },
    period: { type: 'number', default: 15, min: 12, max: 18, step: 0.5, unit: 's', label: 'Time for one turn' },
    min_opacity: { type: 'number', default: 0.4, min: 0.3, max: 0.6, step: 0.01, unit: 'ratio', label: 'Opacity of tiles facing away', from: 'texture/depth-fade' },
    radius: { type: 'number', default: 24, min: 14, max: 34, step: 0.5, unit: '% of stage width', label: 'Ring radius' },
    tile: { type: 'number', default: 11, min: 6, max: 16, step: 0.5, unit: '% of stage width', label: 'Tile size' },
  },
  // Ambient: it turns for as long as its scene. A scene `period` seconds long loops without a seam.
  duration: () => 0,
  build(el, props, p, ctx) {
    const [W] = ctx.size, u = W / 100;
    const count = Math.max(1, Math.round(num(p.tiles))), labels = list(props.items);
    const radius = num(p.radius) * u, size = num(p.tile) * u, floor = num(p.min_opacity);
    const period = Math.max(0.1, num(p.period));
    // The layer is a full-stage camera; the ring hangs in the middle of it.
    el.style.cssText += `;position:absolute;inset:0;max-width:none;perspective:${120 * u}px;perspective-origin:50% 42%`;
    const ring = document.createElement('div');
    ring.style.cssText = `position:absolute;left:50%;top:47%;width:0;height:0;transform-style:preserve-3d;transform:rotateX(${-num(p.tilt_x)}deg) rotateZ(${num(p.tilt_z)}deg)`;
    const tiles = Array.from({ length: count }, (_, i) => {
      const t = document.createElement('div');
      const label = labels.length ? labels[i % labels.length]! : '';
      const look = LOOKS[i % LOOKS.length]!;
      const long = [...label].length > 3;
      const colours = look === 'inverse' ? 'background:var(--m-bg-inverse);color:var(--m-text-inverse)'
        : look === 'accent' ? 'background:var(--m-bg-accent);color:var(--m-text-on-accent)'
          : look === 'tint' ? 'background:color-mix(in srgb, var(--m-bg-accent) 24%, var(--m-bg-base));color:var(--m-accent)'
            : 'background:var(--m-bg-surface);color:var(--m-text-primary)';
      t.textContent = label;
      t.style.cssText = `position:absolute;left:${-size / 2}px;top:${-size / 2}px;width:${size}px;height:${size}px;border-radius:${size * 0.12}px;display:grid;place-items:center;overflow:hidden;` +
        `font:${long ? `500 ${size * 0.14}px var(--m-font-mono)` : `600 ${size * 0.4}px var(--m-font-display)`};letter-spacing:${long ? '0' : '-0.03em'};${colours}`;
      ring.appendChild(t);
      return t;
    });
    el.appendChild(ring);
    return {
      seek(t) {
        const turn = (t / period) * 360;
        tiles.forEach((tile, i) => {
          const angle = (i * 360) / count + turn;
          // 1 when the tile faces the camera, 0 when it faces away.
          const facing = (Math.cos((angle * Math.PI) / 180) + 1) / 2;
          tile.style.transform = `rotateY(${angle}deg) translateZ(${radius}px)`;
          tile.style.opacity = String(floor + (1 - floor) * facing);
          tile.style.filter = facing < 0.999 ? `saturate(${0.35 + 0.65 * facing})` : '';
        });
      },
    };
  },
};
