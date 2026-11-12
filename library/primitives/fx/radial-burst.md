---
slug: fx/radial-burst
kind: primitive
group: fx
summary: Items fly outward from the centre with thin streaks.
status: draft
origin: observed
observations: 1
energy: high
params:
  items:
    default: 30
    min: 20
    max: 40
    unit: items
  duration:
    default: 1.2
    min: 0.8
    max: 1.5
    unit: s
related:
- fx/depth-drift
since: 0.3.0
---

## Behaviour

Items spawn at the centre and travel outward at different depths. Thin lines trail behind them.

## Rules

- Ease-out only: fast start, soft landing.
- Clear the centre for what comes next.
