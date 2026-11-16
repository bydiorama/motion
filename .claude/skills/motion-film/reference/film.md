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
| `loop` | `true` for loops; the last frame must meet the first. |
| `seed` | Integer for anything random. Same seed, same film. |
| `narrative`, `style` | Library slugs the film follows. Informational. |
| `tokens` | Overrides of the timing tokens: `duration.{instant,fast,base,slow}`, `stagger.{tight,base,loose}`, `hold`, `hold_end`, `beat`, `ease_enter`, `ease_exit`, `ease_move`, `ease_loop`. Refer to them as `"$duration.base"`. |
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
| `tracks` | Camera keyframes for the whole scene (see Tracks). A scene with a camera is a world: layers may lie outside the frame, and `check` does not report them. |
| `out` | `{ "use": "transition/blur-dissolve", "duration": 0.4, "params": {} }`. |
| `uses` | Library slugs the scene is built from. Informational. |

## Layer

| Field | Meaning |
|---|---|
| `id` | Unique in its scene. Other layers refer to it: `"title.end + 0.2"`. |
| `use` | A slug from `catalog.json`. `el/text`, `el/box`, `el/image`, `el/frames` (footage as numbered stills: one layer per shot), `el/html`, `el/slot` for plain elements. |
| `props` | Content. Required props are marked in the catalog. |
| `params` | Motion values, each inside its catalog range. |
| `at` | Start, in seconds from the scene start, or relative: `"other.start"`, `"other.end - 0.1"`, `"scene.end - 1"`. |
| `enter` | `"rise"`, or `{ "move": "rise", "duration": "$duration.base", "ease": "expo.out", "amount": 24 }`. Moves: `fade`, `rise`, `drop`, `scale`, `blur`, `slide-left`, `slide-right`, `zoom` (scales down from slightly large), `pop` (spring from small), `focus` (sharpens from a blur), `mask-up`/`mask-down` (rises through its own edge, no fade), `wipe-up`/`wipe-down`/`wipe-left`/`wipe-right` (uncovered by a clip, no fade), `swing` (hinges in on X). Masks, wipes and `pop` bring their own eases when you give none. |
| `exit` | Same, plus `at` for when it starts. Default: it ends with the scene. |
| `style` | `size` (`hero`, `headline`, `title`, `body`, `caption`), `color` (see `colors` in the catalog), `font` (`display`, `body`, `mono`), `weight`, `align`, `width` (% of stage width), `css` (last resort). |
| `place` | `{ "x": 50, "y": 80, "anchor": "bottom" }` in % of the stage. Takes the layer out of the stack. |
| `tracks` | Keyframes from the layer start. |
| `motionBlur` | `true`, or the share of a frame the shutter is open (0–1). The layer smears along its path while it moves fast and is sharp when it stops. For long, fast travel: slides, throws, whips. |

## Tracks

`x`, `y` (px), `scale`, `rotate`, `rotateX`, `rotateY`, `skew` (deg), `opacity`, `blur` (px). Each is a list of `[seconds, value]` or `[seconds, value, ease]`; the ease shapes the move arriving at that key.

```json
"tracks": { "scale": [[0, 1], [4, 1.06, "sine.inOut"]] }
```

## Eases

Named: `linear`, `smooth`, `sine.*`, `cubic.*`, `expo.*` (`.in`, `.out`, `.inOut`), `back.out`, and the bydiorama/ui curves `ui.default`, `ui.in`, `ui.out`, `ui.spring`. Also `[x1, y1, x2, y2]` and `{ "spring": { "duration": 0.4, "bounce": 0.3 } }`.

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
| `never-seen` | The layer starts after the scene ends | Start it earlier, or give the scene more `hold` |
| `cut-off` | The scene ends before the layer finishes | Lengthen the scene or shorten the layer |
| `exit-early`, `exit-before-enter` | The exit starts before the entrance ends | Move the exit's `at` later |
| `too-long` | The text cannot be read in the time it stays | Shorten the text or hold it longer |
| `duplicate-id`, `bad-id` | Ids repeat or are not lowercase with dashes | Rename; tell the person if overrides pointed at the old id |
