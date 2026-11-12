---
slug: ui/cursor-click
kind: primitive
group: ui
summary: A drawn cursor moves to a target and clicks.
status: draft
origin: observed
observations: 1
energy: low
params:
  travel:
    default: 0.4
    min: 0.3
    max: 0.6
    unit: s
  press_scale:
    default: 0.92
    min: 0.9
    max: 0.96
    unit: x
related: []
since: 0.3.0
---

## Behaviour

The cursor eases to the target. The target scales down briefly on press.

## Rules

- Curved path, not a straight line.
