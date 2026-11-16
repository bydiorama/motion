# Changelog

## Unreleased
- Depth and camera, from the craft of our 2026 website reel. `docs/CRAFT.md` gains a section on it (one world per hand-over, blur along the path sized by speed, stacking lifts, cross-fades over one-frame switches, same size on screen, shared rhythm, opening from black), and rules for many equal steps (`sine.inOut`) and for the first frame as a thumbnail.
- Motion blur: any layer can set `"motionBlur": true` (or a shutter, 0–1). The engine measures the layer's speed from its poses half a frame either side and smears it along its path only, with an SVG Gaussian sized by speed; it is gone when the layer stops. `transition/push` now blurs along the push only.
- 4 transitions: `transition/camera-travel` (both scenes in one world; the camera pulls back, leans and travels), `transition/whip-pan` (anticipation, then a smear along the pan, braking on the next scene), `transition/signal-wipe` (a line of accent light leaves the next scene behind it), `transition/fly-past` (a scene's layers fly out past the camera, front first, revealing the next beneath).
- 4 primitives: `type/fill-text` (the line is there from frame 0, dim, and fills word by word), `texture/signal-field` (static that settles into a calm grid from the centre out, then pulses), `rig/browser-window` (a page turns into perspective and lifts one of its parts, shadow growing with height), `fx/pin-drop` (markers land, ripple in one phase and raise their labels on stems).
- Camera controls for the 3D rigs: a shared camera (`src/primitives/rig/camera.ts`) with `path` (`in`, `out`, `in-out`, `hold`), `tilt` and `pitch` on one studio pad, `roll`, `zoom` (a true distance), `pan_x` and `pan_y` on a second pad (where it looks and turns about), `move`, `hold`, `ease` and `drift`. `rig/browser-window` uses it (its `tilt`, `pitch`, `move` and `drift` keep their names) and gains `lift_at`.
- `rig/tab-stack`: tabs stacked as stairs in depth; the open state slides through them on a sine, sharing one tab's height between neighbours, each tab cross-fading between its closed and open look on one title row; the tab that ends open pops forward. Uses the shared camera.
- Studio: choice and ease params get a dropdown (they had no dial before), so a camera path or a transition's direction can be picked in the inspector.
- `transition/dive-in` gains `pace: glide`: one eased push that arrives at rest, blurring only while it moves, for match cuts.
- `narrative/website-launch`: a new site as one journey, each page handing over to the next. `style/dark-showcase` and `style/product-ui` use the new moves.
- Added `films/signal-reel.film.json` (4:5, 60 fps), which exercises all of the above.
- Runtime fix: finished hand-overs are now cleared before the frame's hand-overs are drawn. A scene that was the incoming side of one transition and the outgoing side of the next lost the second transition's styles when frames were drawn out of order.
- Primitives get the film's `fps` in their context (`transition/push` read the 30 fps default token, so its blur was wrong at 60 fps).
- CLI: `MOTION_CHROMIUM` points stills, check and render at a Chromium binary; the preview page declares an empty icon, so `check` no longer reports the browser's favicon request as an error.
- Added `docs/CRAFT.md`: the numbers behind designed motion — easing roles, spring presets, a duration scale for video, stagger and order, text reveals, composition and safe areas, transitions, logo-reveal patterns, end cards, data staging and loops. The `motion-film` skill reads it.
- Eases: `quad`, `quart`, `quint` and `circ` (in, out, in-out), `back.in`, `back.inOut`, `elastic.out`, and five expressive curves: `expressive.out`, `expressive.in`, `expressive.inOut`, `snap.out`, `anticipate.in`.
- Moves: `zoom`, `pop`, `focus`, `mask-up`, `mask-down`, `wipe-up`, `wipe-down`, `wipe-left`, `wipe-right`, `swing`. Masks and wipes uncover without fading; `pop` and `swing` bring their own spring when no ease is given. Tracks gain `rotateX`, `rotateY` and `skew`.
- Props can be lists of numbers (`number[]`), for charts.
- 18 primitives drawn by the runtime: `type/mask-reveal`, `type/char-cascade`, `type/block-reveal`, `type/word-roller`, `type/tracking-in`, `type/shimmer`, `type/echo`, `type/scribble-highlight`, `fx/odometer`, `fx/path-draw`, `fx/shape-morph`, `fx/grid-ripple`, `scene/logo-reveal`, `scene/bar-chart`, `scene/line-chart`, `texture/gradient-drift`, `texture/grain`, `ui/cursor-click`. Shared helpers split text into masked lines, words and letters, stagger from the start, end, centre, edges or at random (seeded, by distance on grids), and resample shapes for morphing.
- 7 transitions drawn by the runtime: `transition/push`, `transition/iris`, `transition/cover-reveal`, `transition/dive-in`, `transition/curtain`, `transition/stack-over`, `transition/slant-wipe`.
- Library: entries for the new primitives (most now `specified`), with params matching the runtime; `style/kinetic-poster` developed; styles and narratives use the new moves, drawable ones first so briefs and animatics can show them.
- Added `films/craft-reel.film.json`, a reel that exercises every new move.
- Runtime: scenes off screen are now `display: none` as well as hidden, because blend modes and SVG filters still painted through `visibility: hidden` and made frames depend on what was drawn before. Transitions hand over with scene opacity, never visibility. `check` no longer reports layers off stage while their scene is in a transition, or full-bleed textures that bleed by design. The primitive contract now says: children shown again use visibility `inherit`, never `visible`.
- Added `motion wizard`: a one-question-per-screen page that turns a video type, feel, message, moves, length and formats into a brief to paste into Claude or ChatGPT. `--out` writes it as a single HTML file.
- Added `motion brief <answers.json>`: the same brief without a browser. Briefs are deterministic, list drawable and not-yet-drawable moves apart, and include a starter film that validates.
- Added `library.json`: styles, narratives and primitives from the library's front matter, written by `motion catalog`.
- Added the `motion-film` agent skill, with a field-by-field film reference and fixes for common errors.
- Added six video types (app demo, brand identity, explainer, data story, social teaser, title sequence) and two looks (brand system, product UI). Narratives now have a `family`: product, brand, graphics or social.
- Wizard: video types sit under tabs by family; video types, feels and moves have thumbnails drawn by the runtime; only the selected thumbnail plays. The look step is gone: the look follows the video type. Length is a slider with its label and value inside the track, and a band for the usual length.
- Studio redesigned as one screen: scene list with intents, the largest stage that fits, a transport with play and scene skips, an inspector with Tune, Notes and Issues, and the timeline dock across the bottom. Keyboard: Space, arrows, [ and ].
- Studio: the scene list shows a still of each scene, drawn by the runtime, with a ring on the current one (no scene numbers; the still's radius is concentric with its card). There is no page-wide top bar: the scene list, the film (name, numbers, save state) and the inspector's tabs each head their own column, on one shared line. The timeline draws the current scene's clip solid. The note composer shows hover and focus on its own border.
- Studio: scrolling regions (scene list, Tune, Notes, Issues, timeline) dissolve at their edges with bydiorama/ui's Fade, ported to plain DOM in `src/studio/fade.ts` (same perceptual ramp, scroll-linked strength, scrollbar inset). The inspector is a flat column; DialKit's stacked folder borders are replaced by space between groups. On phones the transport controls are centred.
- Studio and wizard reviewed against bydiorama/ui's craft rules: tabs mark the selected tab with a fill, not an underline; chosen chips use the selected fill and chips gained a hover; stills and thumbnails get a translucent black or white outline; no dashed strokes (the wizard's usual-length band is a plain fill, DialKit's guide line is solid); counts and clip lengths are 12px, the caption floor.

## 0.4.0
- Added the runtime: films as JSON (`films/*.film.json`), resolved and checked in Node, drawn frame by frame in the browser. 14 primitives and 3 transitions, among them `rig/orbit-ring` (3D), `texture/halftone-field`, `fx/depth-drift` and `scene/marquee-wall`.
- Added tune files: a person's overrides and notes beside the film, addressed by id; `bake` writes them in.
- Added the studio (`motion preview`): DialKit parameter panel generated from the catalog (easing, spring, pad, colour and text dials, versions), a timeline dock whose clips set scene lengths, and pinned notes. Drawn in bydiorama/ui's Graphite theme.
- Added the CLI: `catalog`, `validate`, `inspect`, `notes`, `preview`, `stills`, `check`, `render`, `build`, `bake`, `bundle`.
- Films read bydiorama/ui tokens (`--ui-*`): colours, fonts, durations and ease curves.
- `tools/validate.py` checks `catalog.json` against the library: every runtime primitive needs an entry, and documented params must match the runtime's defaults and ranges.
- Ported the showcase to a film (`films/showcase.film.json`). `showcase/` stays until the film replaces it.

## 0.3.1
- Added the showcase film (`showcase/`) with a DialKit parameter panel and timeline.
- Added `tools/build_showcase.py`, `requirements.txt`, `CONTRIBUTING.md` and a CI workflow.
- No library entries changed.

## 0.3.0
- Library split into one file per entry with checked front matter.
- 54 primitives, 5 styles, 4 narratives migrated.
- `type/specimen-grid` renamed `type/style-multiply` (it clashed with `scene/specimen-grid`).
- Added tokens, templates, validator, index builder, recipe contract, first recipe (`type/word-build`).

## Open areas
- Sound design and music sync
- Vertical social cuts with captions
- Data and chart animation
- Character and illustration animation
- Logo reveals and identity animation
- Display and serif kinetic type
