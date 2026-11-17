// A finished layout, taken apart and assembled on screen. A design tool exports each part
// (type, rules, photographs, cut-outs) as an image or a fill with its box in the frame; this
// turns that list into a scene on the frame's artboard, every part placed in the design's
// own px, arriving in the order the eye reads it. The result is plain film JSON, a start to
// edit: change the moves, the times or the order as the film needs.
import type { Artboard, Layer, Move, Scene } from '../film/types.ts';

/** One part of the design, its box in the frame's px. */
export interface DesignLayer {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** An exported picture of the part, relative to the film. */
  src?: string;
  /** A flat colour, for rules and plain shapes. */
  fill?: string;
  /** What it is, when the shape alone does not say: a rule draws across, type rises into its line, a picture arrives last. */
  kind?: DesignKind;
  /** A primitive of its own, with props: used as given, placed and timed like the rest. */
  use?: string;
  props?: Record<string, unknown>;
}
export type DesignKind = 'rule' | 'type' | 'picture' | 'shape';

/** A frame of a design: its size, its background, and its parts from the bottom up, as the design stacks them. */
export interface Design {
  width: number;
  height: number;
  background?: string;
  layers: DesignLayer[];
}

export interface DesignOptions {
  /** Time between one part's arrival and the next: seconds, or beats ("0.5b"). Default 0.3. */
  step?: number | string;
  /** How the frame meets the stage. Default cover, centred. */
  fit?: Artboard['fit'];
  align?: Artboard['align'];
}

/**
 * What a part is, from its shape when it does not say: a long thin fill is a rule; a picture
 * covering a sixth of the frame or more is a picture; any other picture is type (exported
 * lettering, a logo); any other fill is a shape.
 */
export function kindOf(l: DesignLayer, frame: { width: number; height: number }): DesignKind {
  if (l.kind) return l.kind;
  const long = Math.max(l.width, l.height), thin = Math.min(l.width, l.height);
  if (!l.src && thin > 0 && long / thin >= 20 && thin <= Math.max(frame.width, frame.height) * 0.01) return 'rule';
  if (l.src && (l.width * l.height) / (frame.width * frame.height) >= 1 / 6) return 'picture';
  return l.src ? 'type' : 'shape';
}

/** Parts in reading order: rows from the top (parts whose tops are within `tolerance` of the frame's height share a row), each row left to right. */
export function readingOrder<T extends { x: number; y: number }>(parts: T[], frameHeight: number, tolerance = 0.04): T[] {
  const sorted = [...parts].sort((a, b) => a.y - b.y);
  const rows: T[][] = [];
  for (const p of sorted) {
    const row = rows[rows.length - 1];
    if (row && p.y - row[0]!.y <= tolerance * frameHeight) row.push(p); else rows.push([p]);
  }
  return rows.flatMap((r) => r.sort((a, b) => a.x - b.x));
}

const slug = (name: string) => name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'part';

/** `k` steps of `step`, in the step's own unit. */
function times(step: number | string, k: number): number | string {
  if (typeof step === 'number') return Number((step * k).toFixed(4));
  const m = /^\s*(\d+(?:\.\d+)?)\s*(b|beats?|bars?)\s*$/.exec(step);
  if (!m) throw new Error(`step is seconds or beats ("0.5b"), not "${step}".`);
  const v = Number((Number(m[1]) * k).toFixed(4)), unit = m[2]!.startsWith('bar') ? 'bar' : 'b';
  return `${v}${unit}`;
}

/**
 * A scene that builds the design: rules draw across first, two at a time; type and shapes
 * rise into place in reading order, a step apart; pictures arrive last, largest last. Every
 * part keeps its place in the stack. Times use the step's unit, so with a tempo they land
 * on the beat.
 */
export function sceneFromDesign(id: string, design: Design, opts: DesignOptions = {}): Scene {
  const step = opts.step ?? 0.3, frame = { width: design.width, height: design.height };
  const used = new Set<string>();
  const parts = design.layers.map((l) => {
    let lid = slug(l.name), n = 2;
    while (used.has(lid)) lid = `${slug(l.name)}-${n++}`;
    used.add(lid);
    return { ...l, id: lid, kind: kindOf(l, frame) };
  });
  // When each part arrives, in steps.
  const at = new Map<string, number>();
  const rules = readingOrder(parts.filter((p) => p.kind === 'rule'), design.height);
  rules.forEach((p, i) => at.set(p.id, Math.floor(i / 2)));
  let k = rules.length ? 1 : 0;
  for (const p of readingOrder(parts.filter((q) => q.kind === 'type' || q.kind === 'shape'), design.height)) at.set(p.id, k++);
  for (const p of parts.filter((q) => q.kind === 'picture').sort((a, b) => a.width * a.height - b.width * b.height)) at.set(p.id, k++);

  const enter = (p: (typeof parts)[number]): Move => {
    if (p.kind === 'rule') return { move: 'wipe', angle: p.width >= p.height ? 0 : 90, duration: times(step, 3), ease: 'expo.out' };
    if (p.kind === 'picture') return { move: 'slot-up', duration: times(step, 2) };
    if (p.kind === 'type') return { move: 'mask-up', duration: times(step, 2) };
    return { move: 'fade', duration: times(step, 2) };
  };
  const layers: Layer[] = parts.map((p) => {
    const place = { x: p.x, y: p.y, anchor: 'top-left' as const, unit: 'px' as const };
    const base = p.use
      ? { use: p.use, props: p.props ?? {} }
      : p.src
        ? { use: 'el/image', props: { src: p.src, alt: '' }, params: { width: p.width, radius: 0 } }
        : { use: 'el/box', props: { fill: p.fill ?? '#000000' }, params: { width: p.width, height: p.height, radius: 0 } };
    const when = at.get(p.id) ?? 0;
    return { id: p.id, ...base, place, ...(when ? { at: times(step, when) } : {}), enter: enter(p) } as Layer;
  });
  return {
    id,
    ...(design.background ? { background: design.background } : {}),
    layout: { padding: 0 },
    artboard: { width: design.width, height: design.height, ...(opts.fit ? { fit: opts.fit } : {}), ...(opts.align ? { align: opts.align } : {}) },
    layers,
  };
}
