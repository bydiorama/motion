---
slug: scene/zoomed-ui
kind: primitive
group: scene
summary: One interface component enlarged to fill the frame.
status: specified
origin: observed
observations: 2
energy: low
params:
  ui_scale:
    default: 1.6
    min: 1.4
    max: 2.0
    unit: x
related:
- ui/prompt-typing
- ui/tour-hold
since: 0.3.0
---

## Behaviour

The camera shows only the component in use, not the whole screen.

## Rules

- Crop away navigation and chrome.
- One moving element at a time.
