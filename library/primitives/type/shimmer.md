---
slug: type/shimmer
kind: primitive
group: type
summary: A band of light passes across the letters, again and again.
status: specified
origin: observed
observations: 3
energy: low
params:
  period:
    default: 2.4
    min: 1.2
    max: 4
    unit: s
  band:
    default: 0.22
    min: 0.1
    max: 0.5
    unit: ratio
  strength:
    default: 0.65
    min: 0.3
    max: 1
    unit: ratio
related:
- type/tracking-in
since: 0.5.0
---

## Behaviour

A soft band of light passes across the letters on a loop, as if the type were catching light. The text itself does not move.

## Rules

- The band moves at a constant speed and loops seamlessly.
- One pass every 1.2–4 s; faster reads as a loading state.
- Use it on one line in a frame, during a hold, never during an entrance.
