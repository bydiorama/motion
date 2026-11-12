---
slug: scene/hero-object
kind: primitive
group: scene
summary: One object alone on an empty canvas.
status: draft
origin: observed
observations: 1
energy: medium
params:
  object_height:
    default: 0.6
    min: 0.5
    max: 0.8
    unit: frame
  hold:
    default: 1.5
    min: 1
    max: 3
    unit: s
related:
- rig/tumbling-object
since: 0.3.0
---

## Behaviour

A single object sits centred under soft studio light. Nothing else competes with it.

## Rules

- Object fills at least half of the frame height.
- No text unless it is on the object itself.
