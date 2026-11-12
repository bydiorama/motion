---
slug: transition/curtain
kind: primitive
group: transition
summary: Two panels part or close.
status: draft
origin: observed
observations: 1
energy: medium
params:
  duration:
    default: 0.6
    min: 0.5
    max: 0.8
    unit: s
related:
- transition/step-wipe
- type/parting
since: 0.3.0
---

## Behaviour

The frame splits into two halves that slide apart to reveal the next scene, or close over the current one.
