---
slug: rig/browser-window
kind: primitive
group: rig
summary: A page in a browser window turns into perspective, then lifts one of its parts.
status: specified
origin: designed
energy: medium
params:
  width:
    default: 80
    min: 40
    max: 100
    unit: '% of stage width'
  aspect:
    default: 0.625
    min: 0.4
    max: 1.4
    unit: height / width
  lift:
    default: 140
    min: 0
    max: 320
    unit: px
  lift_at:
    default: 0.8
    min: 0
    max: 6
    unit: s
  path:
    default: in
    options:
    - in
    - out
    - in-out
    - hold
  tilt:
    default: -24
    min: -40
    max: 40
    unit: deg, negative faces left
  pitch:
    default: 10
    min: -15
    max: 30
    unit: deg
  roll:
    default: -2.4
    min: -12
    max: 12
    unit: deg
  zoom:
    default: 0.92
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
    default: 1
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
- scene/zoomed-ui
- fx/depth-drift
since: 0.5.0
---

## Behaviour

A page in a browser window (three lights and an address bar) starts square to the camera, then turns into perspective: it leans back, turns aside and recedes a little. At `lift_at`, one part of the page lifts off it towards the camera: the page's own picture cropped to that part, so it matches the page exactly. The part's shadow grows with its height and the page darkens softly beneath it. After the move, the camera keeps drifting slowly back towards square-on under the hold.

Give it a screenshot as `src`; without one it draws a placeholder page from the theme, whose middle card sits at `lift: [36, 54, 28, 38]`.

## Camera

Shared with every 3D rig, with the same names everywhere:

- `path`: `in` turns from square-on to the pose, `out` from the pose to square-on, `in-out` goes, waits `hold` seconds and comes back, `hold` stays in the pose.
- `tilt` and `pitch` (one 2D pad in the studio, "angle"), `roll`: the pose.
- `zoom`: below 1 stands back, above 1 moves in. It is a distance, so perspective stays true.
- `pan_x` and `pan_y` (one pad, "look"): the point the camera looks at and turns about, in % of the rig from its centre.
- `move`, `ease`: time and curve of each camera move. `drift`: once arrived, a slow linear drift (back towards square-on from a pose, a slight creep in when square-on).

## Rules

- Turn in 0.8–1.2 s on an in-out curve; lift with an expo ease-out, starting before the turn has settled.
- Tilt 20–30° and lean 8–14°: more reads as a stunt, less as a mistake.
- Lift one part only, the one the scene is about. Lifted parts stack in the order they sit on the page: the higher layer always rides on the one below.
- A part lying flush casts no shadow: shadow scales with height.
- Two clocks: the eased turn, then a slow linear drift through the hold.
