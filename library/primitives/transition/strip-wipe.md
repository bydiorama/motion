---
slug: transition/strip-wipe
kind: primitive
group: transition
summary: The next scene arrives row by row, each row led by a field of colour.
status: draft
origin: designed
energy: medium
params:
  duration:
    default: 1
    min: 0.5
    max: 2
    unit: s
  mode:
    default: lead
    options:
    - lead
    - cover
  direction:
    default: left
    options:
    - left
    - right
  alternate:
    default: false
  rows:
    default: 8
    min: 2
    max: 16
    unit: rows
  order:
    default: down
    options:
    - down
    - up
    - centre
  stagger:
    default: 0.04
    min: 0
    max: 0.1
    unit: ratio
  lead:
    default: 0.35
    min: 0.05
    max: 1
    unit: × frame width
  colour:
    default: band-1
    options:
    - band-1
    - band-2
    - band-3
    - band-4
    - band-5
    - band-6
    - accent
    - inverse
    - surface
    - sunken
related:
- scene/strip-cycle
- transition/band-sweep
- transition/step-wipe
since: 0.5.0
---

## Behaviour

The frame is cut into horizontal strips, the rows of a ruled grid. Row by row, a step apart, a field of colour runs across the strip and the next scene follows right behind it, so the old scene is wiped away from one side in a staircase of colour. The first row has landed before the last one starts to move; the field runs out of the far edge as its row lands. It is the change of `scene/strip-cycle` used to hand over from one scene to the next.

In `cover` mode the rows close over the old scene first, every row whole on the cut, so the frame is one colour for an instant; then they run on out of the far side and open on the next scene. With `alternate`, every other row runs the other way, like strands woven across the frame.

## Rules

- One colour per hand-over, from the identity's palette: set `--m-band-1` … `--m-band-6` on the theme and pick a band. Changing it from cut to cut, in a fixed order, gives each seam its own colour.
- Use the same number of rows as the grid of the scenes it joins, so the strips run along their rules.
- Keep one direction for the whole film, and the same as anything else that runs across the frame.
- One or two beats long, like every other hand-over in the film. Fast reads as finished: rows a few hundredths of a second apart (`stagger` 0.03–0.05), `cover` over about one and a half beats.
- Keep it for the turns of the film, into and out of a run of plain cuts; between single pictures, cut.
