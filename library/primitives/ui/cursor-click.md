---
slug: ui/cursor-click
kind: primitive
group: ui
summary: A drawn cursor moves to a target and clicks.
status: specified
origin: observed
observations: 4
energy: low
params:
  from_x:
    default: 78
    min: 0
    max: 100
    unit: '% of width'
  from_y:
    default: 82
    min: 0
    max: 100
    unit: '% of height'
  to_x:
    default: 50
    min: 0
    max: 100
    unit: '% of width'
  to_y:
    default: 50
    min: 0
    max: 100
    unit: '% of height'
  travel:
    default: 0.7
    min: 0.3
    max: 1.8
    unit: s
  arc:
    default: 0.06
    min: 0
    max: 0.2
    unit: ratio
  size:
    default: 2.4
    min: 1.5
    max: 4
    unit: '% of width'
related:
- ui/collab-cursors
- ui/tour-hold
since: 0.3.0
---

## Behaviour

A drawn cursor travels to a target along a slight curve, presses with a quick squeeze, and a ring spreads from the tip.

## Rules

- Curved path, not a straight line; the bow is 0–20% of the distance.
- Glide on an in-out curve; the press is about 80 ms down and a little longer back.
- The target responds after the press, not during the travel.
