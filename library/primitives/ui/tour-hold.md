---
slug: ui/tour-hold
kind: primitive
group: ui
summary: A product screen held still to show one feature.
status: draft
origin: observed
observations: 1
energy: low
params:
  hold:
    default: 2.0
    min: 1.5
    max: 3.0
    unit: s
related:
- transition/layout-locked-swap
since: 0.3.0
---

## Behaviour

The screen is static apart from one moving element that shows the feature.

## Rules

- One feature per hold.
