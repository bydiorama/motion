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
import { gridRipple } from './fx/grid-ripple.ts';
import { odometer } from './fx/odometer.ts';
import { pathDraw } from './fx/path-draw.ts';
import { shapeMorph } from './fx/shape-morph.ts';
import { barChart } from './scene/bar-chart.ts';
import { lineChart } from './scene/line-chart.ts';
import { logoReveal } from './scene/logo-reveal.ts';
import { gradientDrift } from './texture/gradient-drift.ts';
import { grain } from './texture/grain.ts';
import { coverReveal } from './transition/cover-reveal.ts';
import { curtain } from './transition/curtain.ts';
import { diveIn } from './transition/dive-in.ts';
import { iris } from './transition/iris.ts';
import { push } from './transition/push.ts';
import { slantWipe } from './transition/slant-wipe.ts';
import { stackOver } from './transition/stack-over.ts';
import { blockReveal } from './type/block-reveal.ts';
import { charCascade } from './type/char-cascade.ts';
import { echo } from './type/echo.ts';
import { maskReveal } from './type/mask-reveal.ts';
import { scribbleHighlight } from './type/scribble-highlight.ts';
import { shimmer } from './type/shimmer.ts';
import { trackingIn } from './type/tracking-in.ts';
import { wordRoller } from './type/word-roller.ts';
import { cursorClick } from './ui/cursor-click.ts';
import { pinDrop } from './fx/pin-drop.ts';
import { browserWindow } from './rig/browser-window.ts';
import { tabStack } from './rig/tab-stack.ts';
import { signalField } from './texture/signal-field.ts';
import { cameraTravel } from './transition/camera-travel.ts';
import { flyPast } from './transition/fly-past.ts';
import { signalWipe } from './transition/signal-wipe.ts';
import { whipPan } from './transition/whip-pan.ts';
import { fillText } from './type/fill-text.ts';
import type { Primitive, TransitionPrimitive } from './types.ts';

const byslug = <T extends { slug: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map((p) => [p.slug, p]));

export const PRIMITIVES: Record<string, Primitive> = byslug([
  text, box, image, html, slot, wordBuild, typedTitle, scramble, counterRoll, staggerFill, depthDrift, marqueeWall, orbitRing, halftoneField,
  maskReveal, charCascade, blockReveal, wordRoller, trackingIn, shimmer, echo, scribbleHighlight,
  odometer, pathDraw, shapeMorph, gridRipple, logoReveal, barChart, lineChart, gradientDrift, grain, cursorClick,
  fillText, signalField, browserWindow, tabStack, pinDrop,
]);

export const TRANSITIONS: Record<string, TransitionPrimitive> = byslug([
  beatCut, blurDissolve, stepWipe, push, iris, coverReveal, diveIn, curtain, stackOver, slantWipe,
  cameraTravel, whipPan, signalWipe, flyPast,
]);

export type { Ctx, ParamSpec, Primitive, PropSpec, TransitionPrimitive } from './types.ts';
