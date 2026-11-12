// The registry: every primitive the runtime can draw, by slug.
import { box } from './el/box.ts';
import { html } from './el/html.ts';
import { image } from './el/image.ts';
import { slot } from './el/slot.ts';
import { text } from './el/text.ts';
import { counterRoll } from './fx/counter-roll.ts';
import { depthDrift } from './fx/depth-drift.ts';
import { staggerFill } from './fx/stagger-fill.ts';
import { orbitRing } from './rig/orbit-ring.ts';
import { marqueeWall } from './scene/marquee-wall.ts';
import { halftoneField } from './texture/halftone-field.ts';
import { beatCut } from './transition/beat-cut.ts';
import { blurDissolve } from './transition/blur-dissolve.ts';
import { stepWipe } from './transition/step-wipe.ts';
import { scramble } from './type/scramble.ts';
import { typedTitle } from './type/typed-title.ts';
import { wordBuild } from './type/word-build.ts';
import type { Primitive, TransitionPrimitive } from './types.ts';

const byslug = <T extends { slug: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map((p) => [p.slug, p]));

export const PRIMITIVES: Record<string, Primitive> = byslug([
  text, box, image, html, slot, wordBuild, typedTitle, scramble, counterRoll, staggerFill, depthDrift, marqueeWall, orbitRing, halftoneField,
]);

export const TRANSITIONS: Record<string, TransitionPrimitive> = byslug([beatCut, blurDissolve, stepWipe]);

export type { Ctx, ParamSpec, Primitive, PropSpec, TransitionPrimitive } from './types.ts';
