---
slug: scene/strip-cycle
kind: primitive
group: scene
summary: Pictures change strip by strip across a ruled grid, each change led by a field of colour.
status: draft
origin: designed
energy: medium
params:
  rows:
    default: 8
    min: 2
    max: 16
    unit: strips
  width:
    default: 100
    min: 20
    max: 100
    unit: '% of stage'
  height:
    default: 100
    min: 20
    max: 100
    unit: '% of stage'
  hold:
    default: 1.2
    min: 0.3
    max: 6
    unit: s
  ground_hold:
    default: 0
    min: 0
    max: 6
    unit: s
  shift:
    default: 1
    min: 0.3
    max: 2.5
    unit: s
  stagger:
    default: 0.05
    min: 0
    max: 0.3
    unit: s
  order:
    default: down
    options:
    - down
    - up
    - center
    - edges
    - random
  direction:
    default: left
    options:
    - left
    - right
    - alternate
    - weave
  lead:
    default: 0.35
    min: 0
    max: 1
    unit: × frame width
  drag:
    default: 0.12
    min: 0
    max: 0.5
    unit: × frame width
  push:
    default: 1.06
    min: 1
    max: 1.3
    unit: ×
  rule_width:
    default: 2
    min: 0
    max: 12
    unit: px
  rule_opacity:
    default: 0.6
    min: 0
    max: 1
    unit: ratio
  edges:
    default: false
  ease:
    default: quart.inOut
    unit: ease
  empty:
    default: none
    options:
    - none
    - start
    - end
    - both
related:
- scene/bento-grid
- transition/step-wipe
- transition/cover-reveal
- fx/slow-push
since: 0.5.0
---

## Behaviour

A frame is ruled into equal horizontal strips, the way an editorial poster is ruled into rows. Pictures take turns filling the whole frame. A change does not cut the frame at once: it travels strip by strip, a step apart, and in each strip a field of solid colour runs ahead of the next picture. All strips run the same way (`direction` is the way they run: `left`, the default, goes forward in the reading direction, entering from the right), so the steps between them stack into a staircase of colour, like rows of type set one indent apart, that sweeps down the frame and leaves the next picture behind. The rules stay drawn over everything: the grid is the constant, the pictures pass through it.

`shift` is the whole change, from the first strip leaving to the last one landing, so a change lasts exactly what the film says (two beats, say) whatever the stagger. `alternate` and `weave` send neighbouring strips from opposite sides, which shears the frame like a shutter: a harder, glitchier cut that most identities do not want.

The frame can begin and end on its bare ruled ground (`empty`), so one layer can open from the grid, show a run of pictures and close back onto the grid. A picture arrives a few percent large and settles while it is seen.

## Rules

- The grid comes from the identity: use the system's own row count and rule weight, and keep the rules the system's colour, not the accent.
- Picture changes need pictures that read at a glance: one subject, high contrast. Busy wide shots fall apart into strips.
- Hold each picture at least as long as a change takes (`hold` ≥ `shift`), or the eye never rests. On a tempo: hold four beats, change in two.
- One direction for the whole film, with the reading direction going forward. Opposite sides (`alternate`, `weave`) only when the identity itself is about cuts and noise.
- 6–10 strips on a tall frame. Fewer reads as panels sliding; more reads as a glitch.
- Fields in the identity's own colours, one per change, in turn; never two changes in a row with the same field.
- Keep the stagger small (0.03–0.08 s): the staircase should read as one gesture, not as a list.
- For a loop, set `empty: both` and put whatever rests on the bare grid (a mark, a dot) in the same place at both ends.
