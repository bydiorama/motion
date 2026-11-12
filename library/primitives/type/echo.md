---
slug: type/echo
kind: primitive
group: type
summary: Copies of a headline trail behind it.
status: specified
origin: observed
observations: 2
energy: medium
params:
  copies:
    default: 4
    min: 3
    max: 6
    unit: copies
  lag:
    default: 0.06
    min: 0.03
    max: 0.12
    unit: s
  distance:
    default: 1.2
    min: 0.4
    max: 3
    unit: em
  settle:
    default: 0
    min: 0
    max: 0.6
    unit: em
related:
- type/mask-reveal
since: 0.3.0
---

## Behaviour

Outlined copies of a headline travel in ahead of it, each a little later than the one before, then collapse into the solid headline as it lands.

## Rules

- 3–6 copies; the copies are outlines, the final word is solid.
- The lag between copies is 30–120 ms.
- The copies are gone within half a second of the headline landing.
