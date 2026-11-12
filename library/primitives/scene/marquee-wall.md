---
slug: scene/marquee-wall
kind: primitive
group: scene
summary: Rows of chips or logos scrolling sideways.
status: draft
origin: observed
observations: 1
energy: low
params:
  rows:
    default: 5
    min: 4
    max: 6
    unit: rows
  speed:
    default: 60
    min: 30
    max: 120
    unit: px/s
related:
- fx/marquee-highlight
since: 0.3.0
---

## Behaviour

Several rows scroll in alternating directions at slightly different speeds.

## Rules

- Linear motion only.
- Rows never stop or reverse.
