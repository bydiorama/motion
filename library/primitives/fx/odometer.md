---
slug: fx/odometer
kind: primitive
group: fx
summary: Each digit rolls in its own column and lands on the value.
status: specified
origin: observed
observations: 4
energy: medium
params:
  duration:
    default: 1.6
    min: 0.8
    max: 3
    unit: s
  stagger:
    default: 0.08
    min: 0
    max: 0.2
    unit: s
  spins:
    default: 1
    min: 0
    max: 3
    unit: turns
  group:
    default: true
    unit: on/off
related:
- fx/counter-roll
- scene/bar-chart
since: 0.5.0
---

## Behaviour

A number counts up with each digit on its own rolling strip, like a mechanical counter. The ones column spins the most and the leading column the least; a slight blur follows the speed of each strip.

## Rules

- Columns settle from right to left with a short stagger.
- Blur follows each strip's speed and is gone when it stops.
- Group thousands so long numbers stay readable.
- When a counter sits next to a chart, it uses the same curve as the bars.
