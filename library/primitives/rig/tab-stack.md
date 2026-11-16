---
slug: rig/tab-stack
kind: primitive
group: rig
summary: Tabs stacked as stairs in depth; the open tab slides through them, then pops forward.
status: specified
origin: designed
energy: medium
params:
  width:
    default: 64
    min: 30
    max: 100
    unit: '% of stage width'
  stack:
    default: 34
    min: 0
    max: 90
    unit: px
  slide_at:
    default: 0.9
    min: 0
    max: 6
    unit: s
  slide:
    default: 1.6
    min: 0.3
    max: 5
    unit: s
  pop:
    default: 46
    min: 0
    max: 140
    unit: px
  path:
    default: out
    options:
    - in
    - out
    - in-out
    - hold
  tilt:
    default: -19
    min: -40
    max: 40
    unit: deg, negative faces left
  pitch:
    default: 13
    min: -15
    max: 30
    unit: deg
  roll:
    default: -1.5
    min: -12
    max: 12
    unit: deg
  zoom:
    default: 0.9
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
- rig/browser-window
- fx/stagger-fill
since: 0.5.0
---

## Behaviour

A list of tabs stands as stairs in depth: each tab a step nearer the camera than the one before it, on a ground panel. The open state slides through the list as one continuous move, from `from` to `to`: each tab's openness is its distance from the slide's position, so one tab's worth of height is shared between neighbours at every instant and the list keeps its length. Each tab cross-fades between its closed look (quiet title, a plus) and its open look (tinted, the accent mark, its detail line, a bar that fills while it is open); both share one title row, so nothing jumps. The tab that ends open pops a step further forward.

By default the camera lands at an angle, so the stairs read, and turns square-on while the open tab slides.

## Camera

Shared with every 3D rig, with the same names everywhere:

- `path`: `in` turns from square-on to the pose, `out` from the pose to square-on, `in-out` goes, waits `hold` seconds and comes back, `hold` stays in the pose.
- `tilt` and `pitch` (one 2D pad in the studio, "angle"), `roll`: the pose.
- `zoom`: below 1 stands back, above 1 moves in. It is a distance, so perspective stays true.
- `pan_x` and `pan_y` (one pad, "look"): the point the camera looks at and turns about, in % of the rig from its centre.
- `move`, `ease`: time and curve of each camera move. `drift`: once arrived, a slow linear drift (back towards square-on from a pose, a slight creep in when square-on).

## Rules

- Slide on a sine: its top speed is 1.57× the average, so middle tabs are not rushed (a cubic in-out passes them 3× faster than the ends).
- Never switch a tab's look in one frame: the open look fades in over the first fifth of its opening.
- Keep steps small (20–40 px): stairs say order and depth, not architecture.
- Four to seven tabs. One detail line each; the one that ends open may carry two.
