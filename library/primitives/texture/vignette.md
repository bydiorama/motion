---
slug: texture/vignette
kind: primitive
group: texture
summary: The frame darkens towards its edges, holding the eye on the middle.
status: specified
origin: designed
energy: low
params:
  inner:
    default: 48
    min: 0
    max: 90
    unit: '%'
  outer:
    default: 82
    min: 10
    max: 100
    unit: '%'
  strength:
    default: 0.85
    min: 0
    max: 1
    unit: ratio
  mid:
    default: 0.55
    min: 0
    max: 1
    unit: ratio
  center_x:
    default: 50
    min: 0
    max: 100
    unit: '%'
  center_y:
    default: 46
    min: 0
    max: 100
    unit: '%'
related:
- texture/grain
since: 0.5.0
---

## Behaviour

A radial falloff from clear in the middle to dark at the corners: clear to `inner`, `mid` at `outer`, `strength` at the corners. It does not move.

## Rules

- Give it `"screen": true`: a vignette belongs to the lens, not the world, so the camera's travel, zoom and tilt must leave it in place. Written after the scene's other layers, it lies over them.
- Centre a little above the middle (46% down): the eye reads that as level.
- Keep the middle clear to at least 40%: the subject sits there.
