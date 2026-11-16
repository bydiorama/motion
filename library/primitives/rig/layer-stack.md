---
slug: rig/layer-stack
kind: primitive
group: rig
summary: Named planes float one above the other, then close onto the lowest and become one layer.
status: specified
origin: designed
energy: medium
params:
  width:
    default: 42
    min: 15
    max: 90
    unit: '% of stage width'
  aspect:
    default: 1
    min: 0.4
    max: 1.6
    unit: depth ÷ width
  gap:
    default: 120
    min: 20
    max: 320
    unit: px
  lay:
    default: 60
    min: 0
    max: 80
    unit: deg
  turn:
    default: -45
    min: -90
    max: 90
    unit: deg
  spin:
    default: 1.2
    min: -8
    max: 8
    unit: deg/s
  order:
    default: close
    options:
    - close
    - open
    - open-close
  start:
    default: 1.4
    min: 0
    max: 10
    unit: s
  travel:
    default: 0.9
    min: 0.3
    max: 3
    unit: s
  stagger:
    default: 0.14
    min: 0
    max: 0.6
    unit: s
  apart:
    default: 1.2
    min: 0
    max: 6
    unit: s
  radius:
    default: 28
    min: 0
    max: 120
    unit: px
  lens:
    default: 4
    min: 0
    max: 12
    unit: × the rig
  look:
    default: solid
    options:
    - solid
    - wire
  path:
    default: hold
    options:
    - in
    - out
    - in-out
    - hold
  tilt:
    default: 0
    min: -40
    max: 40
    unit: deg, negative faces left
  pitch:
    default: 0
    min: -15
    max: 30
    unit: deg
  roll:
    default: 0
    min: -12
    max: 12
    unit: deg
  zoom:
    default: 1
    min: 0.5
    max: 1.8
    unit: x
  pan_x:
    default: 0
    min: -50
    max: 50
    unit: '% of the rig'
  pan_y:
    default: 0
    min: -50
    max: 50
    unit: '% of the rig'
  move:
    default: 1.6
    min: 0.4
    max: 3
    unit: s
  hold:
    default: 1
    min: 0
    max: 6
    unit: s
  ease:
    default: cubic.inOut
  drift:
    default: 1.2
    min: 0
    max: 4
    unit: deg/s
related:
- rig/tab-stack
- rig/browser-window
- transition/dive-in
since: 0.5.0
---

## Behaviour

Two to seven named planes lie flat, one above the other, seen from above at an angle through a long lens, so they stay parallel and read as a diagram. Each plane carries a label on a short stem at its right-hand corner; labels always face the camera and stay level while the stack turns slowly.

With `order: close` the planes start apart and come down onto the base one after another, lowest first. A plane that lands on another dissolves into it. When the last has landed, the top face takes the accent, the plane labels have gone, the stack's `name` stands at the same corner, and one ring leaves the base outward, once. `open` is the reverse, top plane first; `open-close` opens, holds `apart` seconds and closes.

The base never moves: the stack grows upward from it and returns to it. The closed layer therefore sits low in the rig, where the next scene can stand things on it.

`faces` gives each plane a picture. Without it a plane is a plain surface.

`look: wire` draws the stack as a technical drawing: outlined planes with no shadows, dotted guides joining the corners of the base to the corners of the top plane, and numbered labels in the mono face on dotted stems. `look: solid` is surfaces with shadows.

## Camera

`lens` is the length of the lens in multiples of the rig; at 0 it is parallel, so nothing gets smaller with depth. For a true isometric drawing set `lens: 0`, `lay: 54.7356`, `turn: -45` (or 45) and `spin: 0`: a square plane is then drawn with its diagonals in the ratio 1 to √3, and every guide is vertical. A parallel lens has no distance, so `zoom` does nothing under it.

The planes' own angle is `lay` (how far they lie back) and `turn` (about their own axis), with `spin` as the drift that never stops. The rigs' shared camera sits on top with the same names as everywhere (`path`, `tilt`, `pitch`, `roll`, `zoom`, `pan_x`, `pan_y`, `move`, `hold`, `ease`, `drift`); by default it holds square-on and adds nothing.

## Rules

- A higher plane is never less lifted than the one below it, so planes cannot pass each other however the stagger is set.
- Shadows scale with the height above the plane below; a plane lying flush casts nothing.
- The accent appears once, at the moment of becoming one: lit face, name and ring together. Keep it off the planes while they are apart.
- Keep `spin` under 2 deg/s. Labels hang on the corner furthest right on screen, so a stack that turns through a quarter would hand its labels to the next corner.
- Leave room on the right for the labels: about a third of the plane's width.
- A wire stack does not spin: a drawing is aligned to its grid. Put the base on a point the rest of the film is built around.
- Name the planes with one or two words. The closed name is the message of the scene; hold it for at least 1.5 s.
