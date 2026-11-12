---
slug: scene/logo-reveal
kind: primitive
group: scene
summary: The mark lands, then moves aside as the name slides out from behind it.
status: specified
origin: observed
observations: 4
energy: medium
params:
  mode:
    default: pop
    options:
    - pop
    - draw
    - iris
  arrive:
    default: 0.8
    min: 0.5
    max: 1.6
    unit: s
  slide:
    default: 0.8
    min: 0.5
    max: 1.2
    unit: s
  mark_size:
    default: 1.1
    min: 0.6
    max: 2
    unit: em
  gap:
    default: 0.35
    min: 0.1
    max: 1
    unit: em
related:
- scene/end-card
- fx/path-draw
- fx/shape-morph
since: 0.5.0
---

## Behaviour

The mark lands at the centre — it pops in on a spring, draws on, or opens through an iris. Then the lockup glides to its resting place while the name slides out from behind the mark, and a tagline rises under it.

## Rules

- Symbol first, then wordmark.
- The logo is settled by 1.0–1.5 s and then holds for at least 1.5 s.
- In 16:9 the lockup is 25–35% of the frame width.
- Three elements at most: mark, name, one line.
