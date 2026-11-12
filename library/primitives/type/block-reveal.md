---
slug: type/block-reveal
kind: primitive
group: type
summary: A solid block covers each line, then retracts as the line slides out from behind it.
status: specified
origin: observed
observations: 3
energy: high
params:
  duration:
    default: 0.8
    min: 0.5
    max: 1.2
    unit: s
  stagger:
    default: 0.08
    min: 0.03
    max: 0.2
    unit: s
  direction:
    default: right
    options:
    - right
    - left
related:
- type/mask-reveal
- transition/cover-reveal
since: 0.5.0
---

## Behaviour

A solid block grows across each line from one side, then retracts toward the other. The line's words slide out from behind the retreating edge. Lines follow one another with a short stagger.

## Rules

- The block is exactly the width of its line, not the text box.
- The block grows and retracts on a strong in-out curve; the words land on a fast ease-out.
- Use the accent colour or the inverse colour for the block; never a third colour.
- Three lines at most; with more, use `type/mask-reveal`.
