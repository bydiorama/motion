---
slug: type/word-roller
kind: primitive
group: type
summary: Words roll vertically in a slot.
status: specified
origin: observed
observations: 4
energy: medium
params:
  per_word:
    default: 0.9
    min: 0.5
    max: 1.6
    unit: s
  roll:
    default: 0.5
    min: 0.3
    max: 0.7
    unit: s
  direction:
    default: up
    options:
    - up
    - down
  style:
    default: roll
    options:
    - roll
    - lift
  gap:
    default: 0.05
    min: 0
    max: 0.2
    unit: s
related:
- type/mask-reveal
- type/typed-title
since: 0.3.0
---

## Behaviour

One word in a sentence is replaced by the next from a list, rolling up or down inside a clipped slot. The slot eases to the width of the incoming word, so the sentence around it closes up without a jump.

## Rules

- Each word holds long enough to read: at least 0.6 s still, per word.
- The roll uses an expressive in-out curve and takes 0.3–0.7 s.
- The slot width eases with the roll, never snaps.
- `style: lift` is the status-line swap: the word lifts 8 px away into a 2 px blur and fades over 150 ms, a 50 ms beat of nothing, and the next settles in the same way from below. Use it for a status that changes ("Thinking" → "Searching"), where a roll reads as a slot machine. Set `roll` to about 0.35 s.
- End on the word the sentence is about.
