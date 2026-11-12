---
slug: scene/bar-chart
kind: primitive
group: scene
summary: Bars grow from the baseline one after another, each value counting up with it.
status: specified
origin: designed
energy: medium
params:
  grow:
    default: 0.9
    min: 0.5
    max: 1.4
    unit: s
  stagger:
    default: 0.07
    min: 0.03
    max: 0.15
    unit: s
  orientation:
    default: vertical
    options:
    - vertical
    - horizontal
  width:
    default: 64
    min: 30
    max: 90
    unit: '% of stage width'
  height:
    default: 46
    min: 20
    max: 75
    unit: '% of stage height'
related:
- scene/line-chart
- fx/odometer
since: 0.5.0
---

## Behaviour

A bar chart builds in stages: the baseline draws, the bars grow one after another from it, then each value lands above its bar. One bar can be highlighted in the accent colour.

## Rules

- Stage it: axis, then data, then labels, then the highlight; each stage 0.6–1.0 s.
- Bars grow from the baseline with a short stagger, all on the same curve.
- Highlight one bar at most, in the accent colour; the others are muted.
