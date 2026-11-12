---
slug: rig/orbit-ring
kind: primitive
group: rig
summary: Tiles on a tilted ring that rotates forever.
status: draft
origin: observed
observations: 1
energy: low
params:
  tiles:
    default: 12
    min: 8
    max: 16
    unit: tiles
  tilt_x:
    default: 25
    min: 15
    max: 35
    unit: deg
  tilt_z:
    default: -20
    min: -30
    max: -10
    unit: deg
  period:
    default: 15
    min: 12
    max: 18
    unit: s
related:
- texture/depth-fade
since: 0.3.0
---

## Behaviour

Square tiles sit on a ring. The ring is tilted and rotates around its axis at constant speed.

## Rules

- Loop length equals one full rotation.
- Combine with `texture/depth-fade`.
