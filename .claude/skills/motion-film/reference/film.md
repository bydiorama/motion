# The film

`schema/film.schema.json` in the library root gives editors completion (point `$schema` at it only inside the motion repository); `motion validate` is the real check. Field by field:

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
| `tempo` | `{ "bpm": 120, "bar": 4 }`: one pulse for the whole film. Every time may then be written in beats or bars: `"2b"`, `"0.5b"`, `"1bar"`, `"2bars"`, in `at`, offsets (`"title.end + 1b"`), `length`, `hold`, move and hand-over durations, params in seconds and track keys. Change the bpm and the film follows in proportion. Pick one whose beat is a whole number of frames (at 60 fps: 100, 120, 144, 150); `validate` warns otherwise. `motion pace` checks the film against it. |
| `audio` | `{ "src": "music/track.mp3", "from": 51.18, "gain": 0, "fade_in": 0, "fade_out": 0 }`: a soundtrack. Film time 0 plays the file from `from` seconds. The studio plays it with the playhead (after a first click on the page); `render` lays it under the video, cut to the film, with a few milliseconds of fade so the ends never click. With music, set `tempo.bpm` to the track's own tempo, even when its beat falls between frames (times are snapped to the nearest frame, so `beat-off-frame` is not warned), and `from` on a downbeat. For a loop, choose a stretch whose end flows back into its start: whole phrases, from one hit to the next. `motion beats <track or film>` measures the tempo, the downbeats and the stretches of whole bars that loop best, and for a film, whether its `tempo`, `from` and loop agree with the music. |
| `theme` | `ui` (`zero`, `graphite` or `hockney`: a bundled bydiorama/ui theme with Aspekta and its colour roles; `zero` is Diorama's own), `scheme` (`light`/`dark`), `accent` (CSS colour), `onAccent`, `vars` (raw CSS variables; e.g. `--m-band-1` … `--m-band-6` colour `transition/band-sweep`, `--m-card-radius` squares tiles and bare posters, `--m-card-shadow` sets or removes their shadow). |
| `scenes` | In order. Each runs after the previous, overlapping by its `out` transition. |

## Scene

| Field | Meaning |
|---|---|
| `id` | Lowercase with dashes. Overrides and notes point at it. |
| `intent` | One line: what this scene must make the viewer understand. |
| `layers` | What is on screen. Without `place`, layers stack in the scene's `layout`. |
| `length` | Seconds, or beats (`"4bars"`). Usually left out: the scene lasts until its last layer ends, plus `hold`. |
| `hold` | Seconds of stillness at the end, `"$hold_end"`, or beats (`"2b"`). |
| `background` | `base`, `surface`, `sunken`, `accent`, `inverse`, or any CSS colour. |
| `scheme` | Flip one scene to `dark` or `light`. |
| `layout` | `align`, `justify` (`start`/`center`/`end`/`between`), `gap` and `padding` in px. |
| `artboard` | `{ "width": 1920, "height": 1080, "fit": "height", "align": [0, 50] }`: the frame a design was drawn on, in its own px. Layers placed with `"unit": "px"` are laid out on it and the whole board is scaled onto the stage: `cover` (default) fills the stage, `contain` shows all of it, `width` or `height` matches that side. `align` is where the board sits when it overhangs or falls short, in % (default `[50, 50]`). The camera's tracks stay in stage px. `motion import <design.json>` writes such a scene from a design's exported parts. |
| `camera` | The framing camera (see Camera): keys that put a layer or a point at a place on the screen, this big, tilted so. Replaces the `x`, `y` and `scale` tracks. |
| `perspective` | Px from the viewer to the stage for the camera's tilt: smaller is a wider lens. Default 1.2 × the stage width. |
| `motionBlur` | Blur on the camera's moves: `true` for a half-frame shutter, or the share of a frame (0–1). Smears along the move, sharp at rest. |
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
| `at` | Start, in seconds from the scene start, or relative: `"other.start"`, `"other.end - 0.1"`, `"scene.end - 1"`. With a tempo: `"4b"`, `"other.end + 1b"`. |
| `enter` | `"rise"`, or `{ "move": "rise", "duration": "$duration.base", "ease": "expo.out", "amount": 24 }`. Moves: `fade`, `rise`, `drop`, `scale`, `blur`, `slide-left`, `slide-right`, `zoom` (scales down from slightly large), `pop` (spring from small), `focus` (sharpens from a blur), `mask-up`/`mask-down` (rises through its own edge, no fade), `wipe-up`/`wipe-down`/`wipe-left`/`wipe-right` (uncovered by a clip, no fade), `swing` (hinges in on X), `slot-up` (rises `amount` px, 48 by default, into its own box, cut off at the box's bottom edge, no fade: a framed picture settling into its slot), `wipe` (a wipe along any `angle` in degrees, 0 rightwards, 90 downwards; with `amount` the layer also travels that many px that way, so a slanted band unrolls along its own length), `slide` (a slide along any `angle`). `pop-check` (a check mark arriving: small, turned back −80° and soft, then past its size and home on `bounce.out`). Masks, wipes, `pop` and `pop-check` bring their own eases when you give none. Masks and `wipe-*` take `feather`: a soft edge instead of a hard line, in px, or `true` for a tenth of the line height; the ramp sits outside the edge, so nothing changes when the move ends. |
| `exit` | Same, plus `at` for when it starts. Default: it ends with the scene. |
| `style` | `size` (`hero`, `headline`, `title`, `body`, `caption`), `color` (see `colors` in the catalog), `font` (`display`, `body`, `mono`), `weight`, `align`, `width` (% of stage width: the most a line may run before it wraps), `css` (last resort). |
| `place` | `{ "x": 50, "y": 80, "anchor": "bottom" }` in % of the stage. Takes the layer out of the stack. A placed layer is as wide as its text, up to `style.width`, or else up to the room its anchor leaves on stage (centred at x 50: the whole width). With `"unit": "px"`, x and y are px on the scene's `artboard` (on the stage when it has none), and the layer's own sizes, `style.width` (% of the artboard), track `x`/`y` and move `amount` are design px too: copy a layer's position and size straight from the design file. |
| `tracks` | Keyframes from the layer start. |
| `parallax` | A depth against the scene's camera: `1.3` travels 1.3 times as far as the camera (nearer), `0.7` less (farther), `0` holds still on the stage. Or `{ "depth": 1.3, "home": "2b" }`: `home` is when the layer sits exactly where it is placed, the scene's end by default (the frame the camera arrives at). It follows the camera's x and y travel and replaces a counter-track worked out by hand. |
| `motionBlur` | `true`, or the share of a frame the shutter is open (0–1). The layer smears along its path while it moves fast and is sharp when it stops. For long, fast travel: slides, throws, whips. |
| `screen` | `true`: drawn outside the scene's camera, so its travel, zoom and tilt leave the layer where it is. For a vignette (`texture/vignette`), a frame, a caption bar. |
| `taps` | Taps on a control, as a viewer reads one: `["3.25b", "5b"]`. The layer goes 7% down over 80 ms, landing on the tap, comes back past rest over 350 ms (`bounce.out`), and a 1.5 px accent ring leaves it in its own shape, growing 12 px as it fades over 0.5 s. `{ "at": "3.25b", "ring": "send" }` draws the ring round another layer (a button in a card); `"ring": false` draws none. On a `rig/footage-plane`, `{ "at": "6b", "mark": "send" }` rings a recorded mark; the press is already in the footage. A `ui/cursor-click` with `props.target` adds its tap to that layer itself. |
| `reflow` | `"glide"`: the layer takes no room in the stack until it enters and gives its room up as it leaves; the layers around it glide over (0.45 s, quick then settling) by transforms, so no text re-wraps. Without it a layer keeps its room all scene, even hidden. |

## Camera

`scene.camera` is a list of keys. Each key says what to frame and how, and the camera solves its position every frame, so the framed thing stays exactly on its anchor through the whole move (moving `x`, `y` and `scale` tracks separately lets it drift off mid-move).

```json
"camera": [
  { "at": 0, "frame": [50, 50], "zoom": 1 },
  { "at": "2b", "frame": "card", "zoom": 1.6, "tilt": [8, -10], "ease": "expo.inOut" },
  { "at": "3.25b", "frame": "send", "zoom": 2.2, "ease": "punch" },
  { "at": "4b", "frame": "send", "zoom": 2.2, "drift": 0.02 }
]
```

| Field | Meaning |
|---|---|
| `at` | When the camera arrives. |
| `frame` | A layer id, `"plane#send"` (a mark recorded with a `rig/footage-plane`'s footage, followed as it moves), or a point `[x, y]` in % of the stage. The first key defaults to the stage centre. |
| `point` | Which point of the layer's box, as shares of its width and height. Default `[0.5, 0.5]`. |
| `offset` | Px added to the framed point. |
| `zoom` | 1 is the stage as laid out. Zoom travels in log space, so 1 → 2 paces like 2 → 4. |
| `anchor` | Where the framed point sits on the screen, % of the stage. Default `[50, 50]`. |
| `tilt` | `[rx, ry]` degrees: the picture turned in depth about the anchor, so the target never swings away. |
| `rotate` | Degrees in the plane of the screen. |
| `ease` | Shapes the move arriving at this key. `punch` for a punch-in (150–225 ms). |
| `drift` | On the last key: zoom per second, linear, to the scene's end, so the shot never comes to rest. `pace` does not count it as a move. |

The camera aims at where layout puts a layer, never where its enter or parallax has it at that moment, and keeps aiming at a layer after it has left. `rotate`, `rotateX`/`rotateY` and the other tracks still apply on top.

## Tracks

`x`, `y` (px), `scale`, `rotate`, `rotateX`, `rotateY`, `skew` (deg), `opacity`, `blur` (px). Each is a list of `[time, value]` or `[time, value, ease]`, time in seconds or, with a tempo, beats (`["2b", -40, "back.out"]`); the ease shapes the move arriving at that key.

```json
"tracks": { "scale": [[0, 1], [4, 1.06, "sine.inOut"]] }
```

## Eases

Named: `linear`, `smooth`, `sine.*`, `cubic.*`, `expo.*` (`.in`, `.out`, `.inOut`), `back.out`, `punch` (a camera punch-in: nearly all of it at once, then a long settle), `bounce.out` (back past rest and home), and the bydiorama/ui curves `ui.default`, `ui.in`, `ui.out`, `ui.spring`. Also `[x1, y1, x2, y2]` and `{ "spring": { "duration": 0.4, "bounce": 0.3 } }`.

## Footage

`el/video` plays a stretch of a file: `props: { "src": "shots/harbour.mp4", "from": 12.5, "to": 18 }`, `params: { "rate": 1, "loop": false, "width": 1920 }`. `to` left at 0 plays on until the scene ends (give the scene a `length`). `crop: [x, y, w, h]` in % of the source picks part of the picture; with `width` and `height` both set it fills the window without stretching. For a film that loops through footage, end on a shot and open on its continuation: give the opening layer `"continues": "outro.shot"` and no `from`. Renders pull exact frames with ffmpeg; never make one image layer per frame.

`rig/footage-plane` lays flat footage of a screen on a plane in the scene, for the camera to move over: `props: { "src": "screen.mp4", "marks": "screen.marks.json", "focus": "send" }`, `params: { "width": 1600, "aperture": 6, "light": 235 }`. Record the screen flat with `motion record <url> --scale 3 --marks '#send,#card'`, large enough for the deepest zoom (`render` warns `undersampled`), then frame the marks with camera keys (`"frame": "plane#send"`) and tap them (`"taps": [{ "at": "6b", "mark": "send" }]`). Tilted, the plane goes soft away from `focus` and catches the light. `src` may also be a still picture.

## Building films in code

When a film repeats itself (a card per photo, a pin per stop), write `films/<name>.film.mjs` that `export default film({...})` with helpers from `@bydiorama/motion/build` (`motion make` resolves that import in any project; `repeat`, `grid`, `staggerFrom`, `sequence`), then `motion make films/<name>.film.mjs` writes and checks `films/<name>.film.json`. Edit the script, not the JSON.

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
| `cut-mid-change` | A layer that cycles (a bento wall) is ended in the middle of a change; ending it on a rest is fine | End the scene after the change, or before it begins |
| `exit-early`, `exit-before-enter` | The exit starts before the entrance ends | Move the exit's `at` later |
| `too-long` | The text cannot be read in the time it stays | Shorten the text or hold it longer |
| `needs-tempo` | A time in beats in a film without `tempo` | Add `"tempo": {"bpm": …}`, or write seconds |
| `beat-off-frame` | The beat is not a whole number of frames, so beats drift | Take one of the tempos the hint lists |
| `handover-long`, `handover-crowds`, `handover-vs-picture` | A transition outweighs a scene, or is as long as one of its pictures | Hand over in a quarter of the shorter scene and within half a picture's time; usually one beat |
| `uneven-handovers`, `uneven-changes`, `uneven-rests`, `uneven-density` | Like moves take different times; one scene changes far more often than another | One length for every hand-over, one for every change, one rest; within 2× changes per second across scenes |
| `short-rest`, `restless`, `stalled` | Pictures rest under 1 s; the film moves more than 60% of the time, or moves and drifts under 20% | Longer rests, fewer things changing at once; or shorter holds, or a drift under them |
| `judder` | A pan (`fx/pan-across`) crosses more than a fortieth of the frame's shorter side a frame | Travel less of the picture, or give it longer |
| `even-cuts` | Five or more shots in a row of one length | Alternate long and short: a sweeping shot twice the quick ones around it |
| `off-grid`, `off-beat`, `loop-bars` | With a tempo: a hand-over not on a bar line or a plain cut not on a beat, a move off the half-beat, a loop not whole bars | Write the times in beats; make sections whole bars cut to cut (the cut is the middle of a hand-over) |
| `duplicate-id`, `bad-id` | Ids repeat, or are not lowercase with dashes starting with a letter (`1953-043` is not an id) | Take the id the hint offers; tell the person if overrides pointed at the old id |

## Design import

`motion import design.json [--id slide] [--step 0.5b] [--fit height] [--align 0,50] [--out scene.json]` writes a scene that builds a finished layout from its exported parts. The manifest is the frame and its parts from the bottom up, each part's box in the frame's px:

```json
{ "width": 1920, "height": 1080, "background": "#0B3B24", "layers": [
  { "name": "Rule 1", "x": 0, "y": 50, "width": 1900, "height": 2, "fill": "#F4EFCE" },
  { "name": "Title", "x": 115, "y": 326, "width": 846, "height": 300, "src": "parts/title.png" },
  { "name": "Photo", "x": 1103, "y": 177, "width": 816, "height": 903, "src": "parts/photo.png" }
] }
```

A part is a `rule` (a long thin fill: it wipes across), `type` (a smaller picture, such as exported lettering: it rises into its line), a `picture` (a sixth of the frame or more: it arrives last) or a `shape` (any other fill: it fades in); set `kind` when the shape does not say. A part with its own `use` and `props` is used as given. Paths in `src` are relative to the film. The scene is a start: retime it to the story.
