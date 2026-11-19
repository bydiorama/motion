---
slug: rig/footage-plane
kind: primitive
group: rig
summary: Flat screen footage on a plane the camera moves over, with depth of field and light.
status: specified
origin: designed
energy: medium
params:
  width:
    default: 1080
    min: 100
    max: 8000
    unit: px
  radius:
    default: 0
    min: 0
    max: 200
    unit: px
  rate:
    default: 1
    min: 0.1
    max: 4
    unit: ×
  loop:
    default: false
  aperture:
    default: 6
    min: 0
    max: 24
    unit: px
  depth:
    default: 260
    min: 40
    max: 2000
    unit: px
  light:
    default: 235
    min: 0
    max: 360
    unit: deg
  shade:
    default: 0.5
    min: 0
    max: 1
    unit: ratio
  sheen:
    default: 0.06
    min: 0
    max: 0.3
    unit: opacity
  shadow:
    default: 0.35
    min: 0
    max: 1
    unit: opacity
related:
- rig/browser-window
- fx/slow-push
since: 0.5.0
---

## Behaviour

The traditional motion-design pipeline: a screen is recorded flat, once (`motion record`), and laid on a plane in the film, where the scene's camera moves over it. The page is never re-laid out to move the camera, so its type cannot step, wiggle or re-wrap; everything moves as one rigid picture under one camera.

`src` can also be a still picture of a screen (a PNG from `motion capture`); it then shows as it is, with no frames to pull, and marks do not apply.

The plane answers the camera:

- **Depth of field.** Tilted, the parts of the plane furthest from the focal plane go soft, up to `aperture` px of blur at `depth` px from it. The focus sits on the `focus` mark, or the middle of the picture. Flat, it is all sharp.
- **Light.** The plane brightens as it turns towards the light (`light`, the direction it comes from on the screen) and darkens turning away, by `shade`. A soft band of reflected light slides across as it turns (`sheen`).
- **Shadow.** Its shadow on what is behind it grows as it tilts.
- **Resolution.** For a render, the footage is pulled at the size the deepest camera zoom shows it, plus halved copies; the plane draws the copy nearest its size on screen and cross-fades to the next, so a dive stays sharp and a pull-out does not shimmer. `motion render` warns `undersampled` when the source is too small for the deepest zoom.

**Marks.** `motion record --marks '#send,.card'` writes each element's box on every frame beside the footage. Set `props.marks` to that file, and then:

- a camera key can aim at a mark with `"frame": "plane#send"`, following the element as the footage scrolls;
- a tap can draw its ring on one with `"taps": [{ "at": "3.25b", "mark": "send" }]` (the press itself is already in the footage);
- `focus` can name the mark the lens holds sharp.

A mark is named by its selector as passed to `--marks`; an id or class can drop its `#` or `.`, so `#send` is `send`.

## Rules

- Shoot flat, move the camera in the film. The page being recorded holds still, at its final layout: no camera, no CSS zoom, no tilt. Every move a viewer reads as the camera belongs to `scene.camera` over this plane.
- Record at the size the deepest zoom needs. At zoom 4 on a 1080 px plane, the footage must be about 4320 px wide; record with a larger `--scale` rather than letting the render upsample.
- Tilt grows with closeness: 12–20° in a close-up, 1–3° on a wide, flat on a punch. Depth of field only shows while it is tilted, so a flat wide stays sharp everywhere.
- Keep `aperture` low (4–8 px). It is a lens, not a blur effect: the viewer should feel depth, not notice softness.
- The light comes from one direction for the whole film. Change `light` only between films, never between scenes.
