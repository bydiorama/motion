---
name: motion-film
description: Write, check and revise motion videos with the bydiorama motion library — films as JSON that the runtime draws, checks and renders. Use whenever the task is to make, change or fix a motion video, animated announcement, product film, social loop or title sequence in this repository; when the person pastes a motion brief (a "# Motion brief:" document from the wizard or `motion brief`); when they mention a .film.json or .tune.json file, the studio, stills, a contact sheet or rendering an MP4; or when they say they left notes in the studio. Do NOT use for editing the library's Markdown entries (library/**), for UI animation in an app's codebase, or for video editing of footage.
---

# Motion film

A film is JSON you write. The runtime resolves it in Node (errors with paths and fixes), draws any frame from its time alone, and renders it. A person directs it in the studio; their changes go to a tune file you read but never write.

```
films/<name>.film.json   yours: scenes, layers, timing
films/<name>.tune.json   theirs: overrides by id, and notes pinned to moments
catalog.json             every primitive, prop, param range, ease, token you may use
library.json             styles and narratives: the beats a story needs, what a look prefers
```

## Workflow

Follow it in order. Each step is cheap; skipping one costs a round with the person.

1. **Read the brief, then the catalog.** If there is no brief, ask for the four things one needs: what it is about, the one thing to remember, the length, the format. Or point the person at `node bin/motion.mjs wizard`. Read `catalog.json` before writing a single layer: it is the only list of what can be drawn.
2. **Plan scenes from beats.** One scene per beat is a good start. Merge beats under 1.5 s. Write each scene's `intent` in one line before its layers.
3. **Write the film.** See the rules below, `reference/film.md` for the shape, and `docs/CRAFT.md` for the numbers that make motion look designed: eases, durations, reveal patterns, end cards and safe areas.
4. **Validate until clean.** `node bin/motion.mjs validate films/<name>.film.json`. Fix exactly what each error says; the hint names the fix and "did you mean" names the slug. Warnings about params out of range are real: bring them back in range unless the brief asks otherwise.
5. **Look.** `node bin/motion.mjs stills films/<name>.film.json` writes key frames and `sheet.png` to `films/out/<name>/stills/`. Open the sheet. Check: text collides, leaves the frame, is too long to read, or the accent appears more than once per scene.
6. **Check.** `node bin/motion.mjs check films/<name>.film.json` must report frames that repeat exactly and nothing off stage. For loops it also reports the seam: fix a `loop-seam` warning. If no Chromium is installed, add `--browser <path to Chrome or Brave>`.
7. **Hand over.** Tell the person to run `node bin/motion.mjs preview films/<name>.film.json` (studio at http://127.0.0.1:4321). Say what you would like them to judge.
8. **Answer notes.** When they come back: `node bin/motion.mjs notes films/<name>.film.json`. Each note has a time, a scene and text. Change the film to answer it, validate again, and say per note what you did. Do not mark notes done; the person does.

Render only when asked: `node bin/motion.mjs render films/<name>.film.json` (needs ffmpeg).

## Rules for the film

- **Only drawable moves.** `use` must be a slug in `catalog.json`. Library entries that are not in the catalog cannot be drawn: build the effect from drawable ones and `el/*`, or tell the person which move you would need.
- **Props are content, params are motion.** Words, numbers and items go in `props`. Anything with a range goes in `params`, inside its range.
- **Times are relative when they depend on something.** `"at": "title.end + 0.2"` survives the person retiming the title; `"at": 1.3` does not. Times snap to whole frames.
- **Timing comes from tokens.** Put the brief's tokens in `tokens` and write `"$duration.base"`, not `0.5`. A person tunes the whole film's feel by changing one token.
- **Ids are stable.** Lowercase with dashes, never renamed without reason: the person's overrides and notes point at them. If you must rename, say so, because their overrides on the old id become orphans.
- **Text must be readable twice** in the time it stays. One line of on-screen text per idea. The message gets at least 1.5 s of stillness.
- **One accent per scene.** The accent colour marks the one thing that matters in that frame.
- **The last frame is a poster.** Set `poster` to a moment that reads as a still.
- **Masks over fades.** Reveal text with `type/mask-reveal`, `type/block-reveal` or the `mask-up` and `wipe-*` moves; keep `fade` for supporting text.
- **One hero move per scene.** Everything else in the frame enters quietly or holds.
- **Exits are quicker than entrances** (60–75% of the time) and use an ease-in, never the entrance played backwards.
- **One world per camera move.** When a scene hands to the next by moving the camera, use `transition/camera-travel` (or `whip-pan`), not two layers sliding separately. Give layers that travel far and fast `"motionBlur": true`.
- **Footage is one layer.** Use `el/video` with `from`/`to`, never an image layer per frame. Loops through footage use `continues`.
- **Repeating films are scripts.** When layers repeat, write a `.film.mjs` with the builder and run `motion make`; see `reference/film.md`.
- **A camera that travels a route follows it.** Give the scene `follow` on the `fx/path-draw` layer instead of copying the line's ease into camera keys.
- **Placeholders wear bydiorama/ui.** Demo and placeholder content (sample films, thumbnails, stand-in posters, cards and slides) sets `theme.ui` (`zero` unless the person names another theme) and takes every colour from the role variables (`--m-bg-*`, `--m-text-*`, `--m-accent`, `--m-border`, or `--ui-*` for roles the stage does not map). Type is Aspekta through `var(--m-font-display)` / `var(--m-font-body)`, weight 500, tracking −0.02em on display sizes. Radii come from `--ui-radius-*`, cards get a hairline instead of a shadow, and inline SVG fills through `style="fill:var(…)"`, never `fill="#…"`. No hex colours, no other faces, no monospace. A different `theme.ui` or `accent` must restyle the whole film. A person's own brand content keeps its own colours and fonts.
- **Nothing is dead still.** A scene's `tracks` can carry a slow linear drift (`scale` 1.03 → 1 over the scene) under the holds.

## Never

- Never write `*.tune.json`. It is the person's. Read it; answer it in the film.
- Never bake (`motion bake`) unless the person asks. Baking writes their tuning into your film and empties their file.
- Never claim a film is done without a clean `validate` and `check`, and a look at the stills.
- Never invent a primitive, prop, param or ease. If the catalog lacks it, say so.

## When the person pasted a brief into a chat with no tools

Return the whole film as one JSON code block, then a short list of beats you could not draw. When they paste validation errors back, fix those exactly and return the whole film again.

## Reference

- `reference/film.md`: the film shape, with every field, and common errors with their fixes.
- `docs/CRAFT.md`: the craft rules, with numbers: easing, springs, durations, staggers, text reveals, depth and camera, transitions, logo reveals, data scenes, end cards and safe areas.
