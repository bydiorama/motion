# Changelog

## Unreleased
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
