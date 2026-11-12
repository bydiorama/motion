---
slug: type/scribble-highlight
kind: primitive
group: type
summary: A hand-drawn mark draws under or around a word.
status: specified
origin: observed
observations: 3
energy: medium
params:
  duration:
    default: 0.5
    min: 0.3
    max: 0.9
    unit: s
  kind:
    default: underline
    options:
    - underline
    - circle
    - marker
    - strike
  delay:
    default: 0.3
    min: 0
    max: 2
    unit: s
  weight:
    default: 0.08
    min: 0.03
    max: 0.4
    unit: em
related:
- type/mask-reveal
- fx/path-draw
since: 0.3.0
---

## Behaviour

After the line has landed, chosen words get a hand-drawn mark: an underline, a circle, a marker band or a strike-through, drawn on in one stroke.

## Rules

- The mark draws after the text has settled, never with it.
- One stroke per word, drawn at an even speed with a soft ease at each end.
- Mark one or two words in a line; more than that and none stands out.
