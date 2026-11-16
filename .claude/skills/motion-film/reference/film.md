# The film

`schema/film.schema.json` gives editors completion; `motion validate` is the real check. Field by field:

## Film

| Field | Meaning |
|---|---|
| `motion` | Library version the film was written for, e.g. `"0.4.0"`. |
| `title` | Shown in the studio. |
| `size` | Stage in px, e.g. `[1920, 1080]`. Every px value in the film is on this canvas. |
| `fps` | Default 30 (the `fps` token). Briefs ask for 60. |
| `poster` | Seconds. The still used as the cover and under reduced motion. |
| `loop` | `true` for loops; the last frame must meet the first. `check` then measures the seam. |
| `seed` | Integer for anything random. Same seed, same film. |
| `narrative`, `style` | Library slugs the film follows. Informational. |
| `tokens` | Overrides of the timing tokens: `duration.{instant,fast,base,slow}`, `stagger.{tight,base,loose}`, `hold`, `hold_end`, `beat`, `ease_enter`, `ease_exit`, `ease_move`, `ease_loop`, and `transitions` (`standard` or `calm`: calm gives every transition quiet defaults, for editorial films). Refer to them as `"$duration.base"`. |
| `theme` | `scheme` (`light`/`dark`), `accent` (CSS colour), `onAccent`, `vars` (raw CSS variables). |
| `scenes` | In order. Each runs after the previous, overlapping by its `out` transition. |

## Scene

| Field | Meaning |
|---|---|
| `id` | Lowercase with dashes. Overrides and notes point at it. |
| `intent` | One line: what this scene must make the viewer understand. |
| `layers` | What is on screen. Without `place`, layers stack in the scene's `layout`. |
| `length` | Seconds. Usually left out: the scene lasts until its last layer ends, plus `hold`. |
| `hold` | Seconds of stillness at the end, or `"$hold_end"`. |
| `background` | `base`, `surface`, `sunken`, `accent`, `inverse`, or any CSS colour. |
| `scheme` | Flip one scene to `dark` or `light`. |
| `layout` | `align`, `justify` (`start`/`center`/`end`/`between`), `gap` and `padding` in px. |
| `tracks` | Camera keyframes for the whole scene (see Tracks). A scene whose camera moves is a canvas: layers may lie outside the frame for part of the time, and `check` reports one only if the camera never brings it into view. |
| `follow` | `{ "layer": "route", "at": [50, 50], "lag": 0.15, "blend": 0.6 }`: the camera holds the tip of a drawing line (`fx/path-draw`) at `at` (% of the stage), trailing by `lag` s, easing over from the x/y tracks in `blend` s. Scale and rotate tracks still apply, so zoom in with `scale` and let `follow` steer. |
| `out` | `{ "use": "transition/blur-dissolve", "duration": 0.4, "params": {} }`. |
| `uses` | Library slugs the scene is built from. Informational. |

## Layer

| Field | Meaning |
|---|---|
| `id` | Unique in its scene. Other layers refer to it: `"title.end + 0.2"`. |
| `use` | A slug from `catalog.json`. `el/text`, `el/box`, `el/image`, `el/video` (a stretch of a video file), `el/frames` (a numbered run of stills played as footage: a recorded scroll, frames already cut from a film; it can run backwards), `el/html`, `el/slot` for plain elements. |
| `props` | Content. Required props are marked in the catalog. |
| `params` | Motion values, each inside its catalog range. |
| `at` | Start, in seconds from the scene start, or relative: `"other.start"`, `"other.end - 0.1"`, `"scene.end - 1"`. |
| `enter` | `"rise"`, or `{ "move": "rise", "duration": "$duration.base", "ease": "expo.out", "amount": 24 }`. Moves: `fade`, `rise`, `drop`, `scale`, `blur`, `slide-left`, `slide-right`, `zoom` (scales down from slightly large), `pop` (spring from small), `focus` (sharpens from a blur), `mask-up`/`mask-down` (rises through its own edge, no fade), `wipe-up`/`wipe-down`/`wipe-left`/`wipe-right` (uncovered by a clip, no fade), `swing` (hinges in on X). Masks, wipes and `pop` bring their own eases when you give none. |
| `exit` | Same, plus `at` for when it starts. Default: it ends with the scene. |
| `style` | `size` (`hero`, `headline`, `title`, `body`, `caption`), `color` (see `colors` in the catalog), `font` (`display`, `body`, `mono`), `weight`, `align`, `width` (% of stage width: the most a line may run before it wraps), `css` (last resort). |
| `place` | `{ "x": 50, "y": 80, "anchor": "bottom" }` in % of the stage. Takes the layer out of the stack. A placed layer is as wide as its text, up to `style.width`, or else up to the room its anchor leaves on stage (centred at x 50: the whole width). |
| `tracks` | Keyframes from the layer start. |
| `motionBlur` | `true`, or the share of a frame the shutter is open (0–1). The layer smears along its path while it moves fast and is sharp when it stops. For long, fast travel: slides, throws, whips. |

## Tracks

`x`, `y` (px), `scale`, `rotate`, `rotateX`, `rotateY`, `skew` (deg), `opacity`, `blur` (px). Each is a list of `[seconds, value]` or `[seconds, value, ease]`; the ease shapes the move arriving at that key.

```json
"tracks": { "scale": [[0, 1], [4, 1.06, "sine.inOut"]] }
```

## Eases

Named: `linear`, `smooth`, `sine.*`, `cubic.*`, `expo.*` (`.in`, `.out`, `.inOut`), `back.out`, and the bydiorama/ui curves `ui.default`, `ui.in`, `ui.out`, `ui.spring`. Also `[x1, y1, x2, y2]` and `{ "spring": { "duration": 0.4, "bounce": 0.3 } }`.

## Footage

`el/video` plays a stretch of a file: `props: { "src": "shots/harbour.mp4", "from": 12.5, "to": 18 }`, `params: { "rate": 1, "loop": false, "width": 1920 }`. `to` left at 0 plays on until the scene ends (give the scene a `length`). `crop: [x, y, w, h]` in % of the source picks part of the picture; with `width` and `height` both set it fills the window without stretching. For a film that loops through footage, end on a shot and open on its continuation: give the opening layer `"continues": "outro.shot"` and no `from`. Renders pull exact frames with ffmpeg; never make one image layer per frame.

## Building films in code

When a film repeats itself (a card per photo, a pin per stop), write `films/<name>.film.mjs` that `export default film({...})` with helpers from `@bydiorama/motion/build` (`repeat`, `grid`, `staggerFrom`, `sequence`), then `node bin/motion.mjs make films/<name>.film.mjs` writes and checks `films/<name>.film.json`. Edit the script, not the JSON.

## Errors and their fixes

Every issue has `code`, `path`, `message` and usually `hint`. `motion validate --json` returns them as data.

| Code | Usually means | Fix |
|---|---|---|
| `unknown-primitive`, `unknown-transition` | A slug not in the catalog, often a library-only entry | Take the "did you mean" slug, or build it from drawable moves |
| `unknown-prop` | Motion put in `props` | Move it to `params` (the hint says so) |
| `unknown-param`, `out-of-range` | Misspelt, or outside the range | Use the catalog name and range |
| `missing-prop` | A required prop is absent | Add it; the catalog marks required props |
| `unknown-layer`, `time-cycle`, `self-reference` | A relative time points at a missing layer, or in a circle | Point at an existing layer that starts earlier |
| `unknown-token` | `$name` that is not a token | Use a token path from the catalog, or add it under `tokens` |
| `never-seen` | The layer starts at or after the scene end (times snap to frames) | Start it before the last frame the hint names, or give the scene more `hold` |
| `never-in-view` | In a scene with a moving camera, the camera never reaches the layer | Move the layer onto the camera's path, or the camera to it |
| `loop-seam` | The last frame does not lead into the first | End moves where the film began; for footage use `continues` |
| `cut-off` | The scene ends before the layer finishes | Lengthen the scene or shorten the layer |
| `exit-early`, `exit-before-enter` | The exit starts before the entrance ends | Move the exit's `at` later |
| `too-long` | The text cannot be read in the time it stays | Shorten the text or hold it longer |
| `duplicate-id`, `bad-id` | Ids repeat, or are not lowercase with dashes starting with a letter (`1953-043` is not an id) | Take the id the hint offers; tell the person if overrides pointed at the old id |
