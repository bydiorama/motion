---
slug: fx/slow-push
kind: primitive
group: fx
summary: A still picture in a fixed frame slowly pushes in, pulls out or pans while it is held.
status: specified
origin: designed
energy: low
params:
  from:
    default: 1.08
    min: 1
    max: 1.6
    unit: ×
  to:
    default: 1
    min: 1
    max: 1.6
    unit: ×
  pan_x:
    default: 0
    min: -30
    max: 30
    unit: '% of frame'
  pan_y:
    default: 0
    min: -30
    max: 30
    unit: '% of frame'
  duration:
    default: 4
    min: 0.5
    max: 30
    unit: s
related:
- fx/depth-drift
- scene/hero-object
since: 0.5.0
---

## Behaviour

A photograph fills a frame that does not move. Inside it the picture grows or shrinks by a few percent, and may travel a little, for as long as it is on screen. The frame's edge stays put, so the move reads as the camera, not as the layout.

## Rules

- Linear: a drift has no start and no end. Run it for the whole time the picture can be seen, longer than its hold.
- 4–14% of scale over the hold. More reads as a zoom and competes with the scene's hero move.
- The picture always covers its frame; the pan never shows an edge.
- Push in on a subject, pull out on a place. In a row of pictures, keep one direction.
