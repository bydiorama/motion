---
slug: texture/depth-fade
kind: primitive
group: texture
summary: Elements facing away lose colour and opacity.
status: draft
origin: observed
observations: 1
energy: low
params:
  min_opacity:
    default: 0.4
    min: 0.3
    max: 0.6
    unit: ratio
related:
- rig/orbit-ring
since: 0.3.0
---

## Behaviour

Opacity and saturation follow the angle to the camera.
