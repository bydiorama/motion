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
  tilt:
    default: -24
    min: -40
    max: 40
    unit: deg
  pitch:
    default: 10
    min: 0
    max: 25
    unit: deg
  move:
    default: 1
    min: 0.4
    max: 2.4
    unit: s
  lift:
    default: 140
    min: 0
    max: 320
    unit: px
  drift:
    default: 1.2
    min: 0
    max: 4
    unit: deg/s
related:
- scene/zoomed-ui
- fx/depth-drift
since: 0.5.0
---

## Behaviour

A page in a browser window (three lights and an address bar) starts square to the camera, then turns into perspective: it leans back, turns aside and recedes a little. Near the end of the turn, one part of the page lifts off it towards the camera: the page's own picture cropped to that part, so it matches the page exactly. The part's shadow grows with its height and the page darkens softly beneath it. After the move, the window keeps turning slowly back towards frontal under the hold.

Give it a screenshot as `src`; without one it draws a placeholder page from the theme, whose middle card sits at `lift: [36, 54, 28, 38]`.

## Rules

- Turn in 0.8–1.2 s on an in-out curve; lift with an expo ease-out, starting before the turn has settled.
- Tilt 20–30° and lean 8–14°: more reads as a stunt, less as a mistake.
- Lift one part only, the one the scene is about. Lifted parts stack in the order they sit on the page: the higher layer always rides on the one below.
- A part lying flush casts no shadow: shadow scales with height.
- Two clocks: the eased turn, then a slow linear drift through the hold.
