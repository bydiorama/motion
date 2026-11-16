---
slug: transition/camera-travel
kind: primitive
group: transition
summary: The camera pulls back and travels to the next scene, laid beside this one in one world.
status: specified
origin: designed
energy: medium
params:
  duration:
    default: 1.4
    min: 0.8
    max: 2.4
    unit: s
  direction:
    default: down
    options:
    - down
    - up
    - right
    - left
  pull:
    default: 0.32
    min: 0
    max: 0.6
    unit: ratio
  tilt:
    default: 14
    min: 0
    max: 30
    unit: deg
  gap:
    default: 0.18
    min: 0
    max: 0.6
    unit: of the frame
  shutter:
    default: 0.5
    min: 0
    max: 1
    unit: ratio
related:
- transition/push
- transition/stack-over
since: 0.5.0
---

## Behaviour

The two scenes are sheets in one world, the next one laid beside the current one (below, by default). Only the camera moves: it pulls back, leans the world over and travels from one sheet to the other, then settles square on the new one. While the camera is back, the sheets show their corners, a hairline and a shadow. Motion blur follows the camera's speed on screen, along the travel only.

## Rules

- One camera, one world. Never animate the two scenes separately for one hand-over: it reads as two unrelated moves and can leave a ghost of the first.
- 1.2–1.8 s. The pull-back and lean leave and arrive with zero speed (a sin² bump), so the move has no corners.
- Lay the next scene where it would be: below for what comes next on a page, beside for a sibling.
- The outgoing scene leaves the frame completely; nothing of it is left hanging.
