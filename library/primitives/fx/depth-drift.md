---
slug: fx/depth-drift
kind: primitive
group: fx
summary: A floating collage on several depth planes.
status: specified
origin: observed
observations: 2
energy: low
params:
  planes:
    default: 3
    min: 2
    max: 3
    unit: planes
  speed:
    default: 20
    min: 10
    max: 30
    unit: px/s
related:
- scene/stat-with-evidence
since: 0.3.0
---

## Behaviour

Near items are larger, faster and slightly blurred. Far items are smaller and slower.

## Rules

- Keep the centre free for text.
