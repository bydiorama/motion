# Craft

What separates motion that looks designed from motion that looks generated is mostly numbers: which curve, how long, how far, in what order. This page collects the numbers. Each rule can be checked against a film or a contact sheet. Library entries cite these rules; films should follow them unless a brief says otherwise.

Everything here describes patterns, not sources.

## 1. Easing

A film uses **at most four curves plus one signature curve**. More than that and nothing feels related.

| Job | Name in the catalog | Curve | Use it for |
| --- | --- | --- | --- |
| Arrive | `expressive.out` | (0.05, 0.7, 0.1, 1) | Most entrances. Arrives in the first fifth, then glides. |
| Leave | `expressive.in` | (0.3, 0, 0.8, 0.15) | Exits. Gathers, then goes. |
| Hand over | `quint.inOut` | (0.83, 0, 0.17, 1) | Pushes, wipes, scene-to-scene moves. |
| Land hard | `snap.out` | (0.3, 0.9, 0.1, 1) | Words that land after a block or a cut. |
| Workhorse | `ui.spring` | (0.22, 1, 0.36, 1) | Small UI moves and supporting text. |
| Wind up | `anticipate.in` | (0.45, −0.48, 1, −0.82) | Before a whip or a throw. Pulls back, then goes. |
| Overshoot | `back.out` or a bezier (0.34, Y, 0.64, 1) | Y from 1.3 to 1.56 | Icons, chips and marks that pop. |
| Drift | `linear` | | Container drift, loops, marquees, rotation. |

- **Entrances ease out, exits ease in, moves on screen ease in-out.** A move that both starts and ends on screen never uses an ease-out alone.
- **Opacity never overshoots.** Only position, scale and rotation do.
- **Two clocks.** An eased move for the element, and a slow linear drift on its container that keeps going through the hold. The eye reads the first as action and the second as life.
- **Polynomials, not lookalikes.** When a curve has a name in the catalog, use the name: it is solved exactly.
- **Many equal steps, one sine.** When one move passes through several equal steps (an accordion sliding card to card, a list scrolling item to item), ease it with `sine.inOut`. A cubic in-out's top speed is 3× its average, so the middle steps flash by; a sine's is 1.57×.
- **A push that lands on the next scene eases in and out.** Accelerating into the cut (`dive-in` at its default pace) is a hit; when the point you dive into continues as the next scene, use `pace: glide`, which arrives at rest.

### Springs

Write a spring as `{ "spring": { "duration": d, "bounce": b } }`. The runtime lengthens the move so the overshoot settles.

| Preset | duration | bounce | Feel |
| --- | --- | --- | --- |
| settle | 0.8 | 0 | Critically damped, no overshoot. |
| glide | 0.9 | 0.1 | A trace of give. |
| pop | 0.6 | 0.25 | Marks, buttons, stickers. The `pop` move uses 0.5 / 0.35. |
| playful | 0.7 | 0.4 | Social, consumer. One per film. |
| heavy | 1.2 | 0.05 | Large objects, cameras. |

Tie bounce to impact: a harder hit wobbles more and faster.

## 2. Duration

The video scale is longer than an interface's, because nobody is waiting on it.

| Step | Seconds | For |
| --- | --- | --- |
| cut | 0.1 | A hard swap, a flash. |
| quick | 0.2 | Small UI responses, presses. |
| short | 0.33 | Chips, icons, supporting moves. |
| base | 0.5 | Words, small blocks. |
| long | 0.8 | Lines of text, panels, transitions. |
| hero | 1.2 | The one big move in a scene. |
| slow | 2.0 | Logo builds, line charts, morphs. |
| drift | 3–8 | Ambient: camera creep, gradients, loops. |

- **Exits take 60–75% of their entrance**, and an exit is never the entrance played backwards.
- **Text holds still** for at least the longer of 1.2 s and 0.3 s per word + 1 s.
- **Beats.** Product films cut every 1.5–4 s. A word or image swap holds about 0.7 s and moves about 0.4 s. A fast index list steps every 0.5 s.

## 3. Stagger and order

- **Forward order in, backward order out.**
- **Set the spread, not the gap**, when the count can change: a whole grid of any size grows in within about 1 s.
- **On a grid, stagger by distance** from an origin (centre, edges, a corner, a chosen cell), not by index. `fx/grid-ripple` and the `from` param of the type primitives do this.
- **Random order is seeded.** Same film, same frames.
- Words 80–150 ms apart, lines 60–120 ms, letters 15–60 ms, tiles 20–100 ms.

## 4. Text

- **Masks over fades.** Text is uncovered: it rises through its own edge (`type/mask-reveal`, `mask-up`), a block passes over it (`type/block-reveal`), or a clip opens on it (`wipe-*`). A plain fade is for supporting text only.
- **Reveal by line or word.** Per-letter motion only for display words of 12 characters or fewer (`type/char-cascade`, `type/echo`).
- **Line masks travel 100–110%** of the line's height in 0.6–0.9 s, 60–120 ms between lines.
- **Opacity leads, transform follows.** When something fades and moves, the fade is complete by half the move.
- **A blur that sharpens** reads as focus; keep it under 24 px and gone by the end of the move.
- **Velocity-only trails.** Motion blur and echoes appear while something is moving fast and are gone when it stops: blur ≈ velocity × half a frame.
- **The first frame is a thumbnail.** Feeds show it as the cover. A headline that is already there, dim, and fills word by word (`type/fill-text`) reads at frame 0 and still has a reveal.
- **Mark after landing.** Underlines, circles and highlights draw after the line has settled (`type/scribble-highlight`).

## 5. Composition

- **One hero move per scene.** Everything else enters quietly or holds.
- **One accent per scene.** The accent colour marks the one thing that matters.
- **Safe areas.** In 16:9, keep text 5% inside every edge. In 9:16 (1080 × 1920), keep text within x 60–940 and y 250–1500: interface chrome covers the rest.
- **Nothing is dead still.** Under every hold, a slow drift: scale 1.03 → 1 over the scene, or a few degrees of rotation, on a linear curve.

## 6. Depth and camera

What makes 3D look shot rather than assembled.

- **One world per hand-over.** When one scene hands to the next by a camera move, both live in one world and only the camera moves (`transition/camera-travel`). Two layers animated separately for one transition read as two unrelated moves.
- **Motion blur follows the path.** Blur only along the direction of travel, sized by on-screen speed: deviation = speed (px per frame) × shutter ÷ √12, with a half-frame shutter (0.5) as the film standard. A round blur reads as out of focus, not as speed. Set `"motionBlur": true` on any layer that travels far and fast; transitions that move whole scenes do this themselves.
- **Blur only while moving.** A camera move's blur rises and falls with its speed: peak in the middle, none at either end.
- **Lifts stack.** A part lifted off a page rides on the plane below it, so the order never inverts however far the lower one moves. Its shadow scales with its height: a part lying flush casts nothing.
- **Never change state in one frame.** When something switches look (closed to open, one picture to the next), cross-fade the two over 0.2–0.4 s. Dissolve straight from one to the other; never dip through an empty state.
- **Same size means same size on screen.** Markers on a tilted plane are scaled against their depth, or turned to face the camera, so near ones are not drawn bigger. Use a long lens for things standing on a plane: stems stay vertical and parallel.
- **Shared rhythm.** A family of pulses (ripples, glows) shares one phase, so they are the same size at every instant.
- **Open from black.** A dark film fades in its first texture over 0.6–0.8 s before anything settles; the type starts with it.

## 7. Transitions

| Transition | Length | When |
| --- | --- | --- |
| `transition/beat-cut` | 0 | On the beat, between scenes that share a layout. |
| `transition/push` | 0.5–0.9 s | Sequential steps; push in reading direction. |
| `transition/slant-wipe` | 0.4–0.9 s | Energetic sequences, posters. |
| `transition/cover-reveal` | 0.6–1.6 s | Chapter breaks; panels in accent and inverse. |
| `transition/curtain` | 0.5–1.4 s | Formal breaks, title cards. |
| `transition/stack-over` | 0.4–1.2 s | One screen after another, as cards. |
| `transition/iris` | 0.4–1.4 s | From a point the eye is already on. |
| `transition/dive-in` | 0.4–0.9 s | Into a detail: a letter, a button, a dot. |
| `transition/blur-dissolve` | 0.4–0.8 s | Quiet changes of subject; at most once a film. |
| `transition/camera-travel` | 1.2–1.8 s | To what lies beside or below: the next page, the next section. |
| `transition/whip-pan` | 0.4–0.6 s | Between siblings of equal weight; at most twice a film. |
| `transition/signal-wipe` | 0.4–0.7 s | A cut drawn by accent light; for dark films. |
| `transition/fly-past` | 0.8–1.4 s | Out of a scene made of panels or tiles, to what lies beneath. |

- **Content stays still while the edge moves** in a wipe, so it reads as a cut, not a slide.
- **Swap only while covered.** A cover or curtain changes the scene while the frame is fully covered.
- **Anticipation before speed.** A whip or a throw pulls back 3–5° for about 0.15 s first.
- **Changes between logo states are hard cuts**, not crossfades.

## 8. Logo reveals

Pick one pattern for a film and repeat it, short, at the end.

- **Stroke, then fill.** The outline draws at an even speed (`fx/path-draw`), then the fill fades in.
- **Construction.** Guide circles and lines draw first; the mark is built on them.
- **Mask from the mark.** The mark's own shape opens as an aperture on the next scene.
- **Morph.** A simple shape becomes the mark (`fx/shape-morph`).
- **Grid assembly.** Parts arrive cell by cell, by distance.
- **Slice shift.** The mark is cut into bands that slide into register.
- **Symbol, then wordmark.** The symbol lands centred; the lockup glides and the name slides out from behind it (`scene/logo-reveal`).
- **Wordmark rise.** The name rises through a mask, letter or line at a time.
- **Convergence.** Parts fly in from outside and meet.
- **Container collapse.** A full-frame shape shrinks into the mark.
- **Beat pulse.** The mark scales on the beat, once.
- **Glint.** A band of light passes over the finished mark (`type/shimmer` on the name).

## 9. End cards

- The logo is settled by 1.0–1.5 s into the card and holds for at least 1.5 s.
- In 16:9 the lockup is 25–35% of the frame width.
- Three elements at most: mark, name, one line (a call to action, a date or a URL).
- The poster frame is the end card at rest.

## 10. Data

- **Stage it:** axes, then data, then labels, then the one annotation that carries the point. Each stage 0.6–1.0 s.
- **A counter uses the same curve as its bars**, so they land together.
- **Line charts draw at a steady pace in x**, so the axis reads as time.
- **One highlight.** One bar or point in the accent; the rest muted.
- Never more than one number moving at a time.

## 11. Loops

- The last frame equals the first. Rotate roles or slots so the state after one period matches the start.
- Duplicate lists and wrap them, rather than resetting.
- Desynchronise a family of moves by phase offsets, not by fresh randomness.
- Loop lengths are whole multiples of the beat.
