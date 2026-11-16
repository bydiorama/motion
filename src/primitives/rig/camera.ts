// The camera shared by the 3D rigs (rig/browser-window, rig/tab-stack).
//
// An orbit camera around the rig: it looks at a point (pan), stands further back
// or closer (zoom, as perspective-correct distance), and turns (tilt about the
// vertical axis, pitch about the horizontal one, roll about the view). A path
// says how it moves between square-on and that pose over time; a slow drift
// keeps it alive once it has arrived.
//
// Every rig that uses it takes the same params with the same names, so a person
// learns the dials once and an agent writes them the same way everywhere.
import { clamp, lerp } from '../../core/ease.ts';
import { num, str, type ParamSpec } from '../types.ts';

export const CAMERA_PATHS = ['in', 'out', 'in-out', 'hold'] as const;
export type CameraPath = (typeof CAMERA_PATHS)[number];

export interface CameraDefaults {
  tilt: number;
  pitch: number;
  roll: number;
  zoom: number;
  path: CameraPath;
  move: number;
}

/** The camera's params, with a rig's own defaults. Tilt and pitch share one pad, and so do the two pan axes. */
export function cameraParams(d: CameraDefaults): Record<string, ParamSpec> {
  return {
    path: { type: 'choice', default: d.path, options: CAMERA_PATHS, label: 'Camera path: in turns from square-on to the pose, out from the pose to square-on, in-out goes and comes back, hold stays in the pose' },
    tilt: { type: 'number', default: d.tilt, min: -40, max: 40, step: 1, unit: 'deg, negative faces left', label: 'Turn', pad: { name: 'angle', axis: 'x' } },
    pitch: { type: 'number', default: d.pitch, min: -15, max: 30, step: 1, unit: 'deg', label: 'Lean', pad: { name: 'angle', axis: 'y' } },
    roll: { type: 'number', default: d.roll, min: -12, max: 12, step: 0.5, unit: 'deg', label: 'Camera roll' },
    zoom: { type: 'number', default: d.zoom, min: 0.5, max: 1.8, step: 0.01, unit: 'x', label: 'Camera zoom in the pose (below 1 stands back)' },
    pan_x: { type: 'number', default: 0, min: -50, max: 50, step: 0.5, unit: '% of the rig', label: 'Across', pad: { name: 'look', axis: 'x' } },
    pan_y: { type: 'number', default: 0, min: -50, max: 50, step: 0.5, unit: '% of the rig', label: 'Down', pad: { name: 'look', axis: 'y' } },
    move: { type: 'number', default: d.move, min: 0.4, max: 3, step: 0.05, unit: 's', label: 'Time the camera takes for each move' },
    hold: { type: 'number', default: 1, min: 0, max: 6, step: 0.05, unit: 's', label: 'For in-out: time in the pose before it comes back' },
    ease: { type: 'ease', default: 'cubic.inOut', label: 'Curve of each camera move' },
    drift: { type: 'number', default: 1.2, min: 0, max: 4, step: 0.1, unit: 'deg/s', label: 'Slow drift once the camera has arrived' },
  };
}

export interface CameraPose {
  /** Degrees. */
  rx: number; ry: number; rz: number;
  /** Apparent scale: 1 is square-on at rest. */
  zoom: number;
  /** Point looked at, as a share of the rig's width and height from its centre. */
  x: number; y: number;
}

/** When the camera stops moving, in seconds from the start. */
export function cameraEnd(p: Record<string, unknown>): number {
  const path = str(p.path) as CameraPath, move = num(p.move);
  return path === 'hold' ? 0 : path === 'in-out' ? 2 * move + num(p.hold) : move;
}

/** How far into the pose the camera is at time t: 0 square-on, 1 in the pose. */
export function cameraWeight(t: number, p: Record<string, unknown>, ease: (x: number) => number): number {
  const path = str(p.path) as CameraPath, move = Math.max(0.01, num(p.move));
  if (path === 'hold') return 1;
  if (path === 'out') return 1 - ease(clamp(t / move));
  if (path === 'in-out') {
    if (t < move) return ease(clamp(t / move));
    if (t < move + num(p.hold)) return 1;
    return 1 - ease(clamp((t - move - num(p.hold)) / move));
  }
  return ease(clamp(t / move));
}

/** The camera at time t. */
export function cameraAt(t: number, p: Record<string, unknown>, ease: (x: number) => number): CameraPose {
  const w = cameraWeight(t, p, ease);
  const tilt = num(p.tilt), pitch = num(p.pitch);
  const pose: CameraPose = {
    rx: pitch * w, ry: tilt * w, rz: num(p.roll) * w,
    zoom: lerp(1, num(p.zoom), w), x: (num(p.pan_x) / 100) * w, y: (num(p.pan_y) / 100) * w,
  };
  // Two clocks: once the camera has arrived, a slow linear drift under the hold.
  // In a pose it relaxes back towards square-on (never more than half way);
  // square-on it creeps in a little.
  const after = Math.max(0, t - cameraEnd(p)), drift = num(p.drift);
  if (after > 0 && drift > 0) {
    if (w > 0.5) {
      pose.ry -= Math.sign(tilt) * Math.min(Math.abs(tilt) * 0.5, drift * after);
      pose.rx -= Math.sign(pitch) * Math.min(Math.abs(pitch) * 0.5, drift * 0.4 * after);
    } else pose.zoom *= 1 + Math.min(0.06, 0.015 * drift * after);
  }
  return pose;
}

/**
 * The transform for the rig's world, inside an element with `perspective: P`.
 * Zoom is a distance along z, so it keeps the perspective true; the rig turns
 * about the point it looks at, so that point stays in the middle of the frame.
 */
export function cameraTransform(c: CameraPose, P: number, w: number, h: number): string {
  const dz = P * (1 - 1 / Math.max(0.05, c.zoom));
  return `translateZ(${dz.toFixed(2)}px) rotateX(${c.rx.toFixed(3)}deg) rotateY(${c.ry.toFixed(3)}deg) rotateZ(${c.rz.toFixed(3)}deg) translate(${(-c.x * w).toFixed(2)}px, ${(-c.y * h).toFixed(2)}px)`;
}
