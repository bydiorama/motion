---
slug: fx/pan-across
kind: primitive
group: fx
summary: The camera travels along a picture wider or taller than its frame.
status: draft
origin: designed
energy: low
params:
  width:
    default: 0
    min: 0
    max: 4000
    unit: px
  height:
    default: 0
    min: 0
    max: 4000
    unit: px
  aspect:
    default: 1.78
    min: 0.2
    max: 6
    unit: w ÷ h
  from:
    default: 20
    min: 0
    max: 100
    unit: '% of travel'
  to:
    default: 80
    min: 0
    max: 100
    unit: '% of travel'
  scale:
    default: 1
    min: 1
    max: 1.3
    unit: ×
  duration:
    default: 4
    min: 0.5
    max: 30
    unit: s
  ease:
    default: sine.inOut
related:
- fx/slow-push
- fx/depth-drift
since: 0.5.0
---

## Behaviour

A picture much wider than the frame (a landscape billboard in a portrait phone frame) fills the frame top to bottom, and the camera travels along it from one point to another, starting and settling like a camera on a slider. A picture much taller than a wide frame does the same downwards. The picture is never stretched and its edge never shows. The pace check knows how fast the picture crosses the stage at its fastest, and warns (`judder`) when a frame-to-frame step is big enough to strobe.

## Rules

- For a picture whose lettering or composition would be cut by a crop: let the camera read it, instead of cropping it to the frame.
- Set `aspect` to the picture's own width over height, so the travel and the speed check are true.
- At its fastest, the picture moves at most a fortieth of the frame's shorter side a frame (27 px a frame on a 1080 px wide frame). Travel less of it, or give it longer.
- `sine.inOut`: a camera starts and settles. Linear only when the pan runs on past both cuts.
- A pan is a long shot in a montage: twice the length of the quick shots around it. One direction for every pan in a film.
