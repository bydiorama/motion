---
slug: scene/line-chart
kind: primitive
group: scene
summary: A line draws left to right behind a leading dot, the area fills, the last value lands.
status: specified
origin: designed
energy: medium
params:
  draw:
    default: 2
    min: 1.2
    max: 3.5
    unit: s
  width:
    default: 70
    min: 30
    max: 90
    unit: '% of stage width'
  height:
    default: 44
    min: 20
    max: 75
    unit: '% of stage height'
  area:
    default: true
    unit: on/off
  grid:
    default: 4
    min: 0
    max: 8
    unit: lines
related:
- scene/bar-chart
- fx/path-draw
since: 0.5.0
---

## Behaviour

Guide lines fade in, then a line draws left to right behind a leading dot at a steady pace, as if time were passing. The area under it fills behind the line, and the last value lands with a single pulse.

## Rules

- The line advances at a steady speed in x, so the x axis reads as time.
- Show the first and last labels, or one per point; never every other one.
- The end value lands with the dot, not before.
