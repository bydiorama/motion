---
slug: type/tracking-in
kind: primitive
group: type
summary: Wide-spaced letters close up to their set spacing while coming into focus.
status: specified
origin: observed
observations: 3
energy: low
params:
  duration:
    default: 1.6
    min: 0.8
    max: 3
    unit: s
  spread:
    default: 0.5
    min: 0.1
    max: 1.2
    unit: em
  blur:
    default: 12
    min: 0
    max: 30
    unit: px
related:
- type/char-cascade
- scene/end-card
since: 0.5.0
---

## Behaviour

Letters start widely spaced and out of focus, then draw together to their normal spacing and sharpen. It is slow and quiet: a title move for an opening or an end card.

## Rules

- Long and gentle: 1.2–2.4 s on a strong ease-out.
- Best on short, all-caps or spaced titles.
- Opacity is in by a third of the way; the spacing keeps closing after that.
