---
slug: type/fill-text
kind: primitive
group: type
summary: The whole line is there, dim; each word fills to full in reading order.
status: specified
origin: designed
energy: low
params:
  duration:
    default: 1.7
    min: 0.4
    max: 4
    unit: s
  dim:
    default: 0.35
    min: 0.15
    max: 0.6
    unit: opacity
  soft:
    default: 1.5
    min: 1
    max: 4
    unit: words
  ease:
    default: smooth
related:
- type/word-build
- type/mask-reveal
since: 0.5.0
---

## Behaviour

The whole line is on screen from the first frame, dim. Each word fills in reading order, from dim through a mid stop to full, as if the line were being read aloud. Nothing moves; only the light in the letters changes. Words named in `accent` fill to the accent colour.

## Rules

- The first frame is already a readable, if quiet, thumbnail: feeds often show it as the cover.
- Dim 0.3–0.4 and a mid stop a little past halfway: the eye reads a word as filled before it is quite done.
- Fill a whole line in 1.2–2 s on a symmetric curve (`smooth`), so neither end rushes.
- No movement on the type: no rise, no blur, no jitter. The fill is the move.
- Pair it with a still or slowly drifting background; it is the quietest headline reveal and should stay the hero of its frame.
