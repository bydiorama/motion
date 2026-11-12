---
slug: narrative/explainer
kind: narrative
family: graphics
summary: Motion graphics that explain how something works.
status: draft
origin: designed
duration:
  min: 45
  max: 90
  unit: s
fits_styles:
- style/clean-explainer
- style/brand-system
beats:
- name: question
  share: 10
  content: The question the video answers
  primitives:
  - type/mask-reveal
  - scene/kinetic-headline
  - type/focus-blur
- name: setup
  share: 16
  content: What is there before anything happens
  primitives:
  - fx/grid-ripple
  - fx/stagger-fill
  - scene/grid-wall
- name: mechanism
  share: 30
  content: How it works, one step per beat
  primitives:
  - transition/push
  - transition/step-wipe
  - fx/card-arrangements
  - type/inline-chips
- name: proof
  share: 18
  content: The number that shows it works
  primitives:
  - scene/bar-chart
  - fx/odometer
  - scene/stat-with-evidence
  - fx/counter-roll
- name: takeaway
  share: 14
  content: The answer, in one line
  primitives:
  - type/scribble-highlight
  - type/word-build
- name: end
  share: 12
  content: Who made it
  primitives:
  - scene/end-card
since: 0.5.0
---

## Notes

One idea per beat, and every shape on screen stands for something. A viewer should be able to explain it back after one watch.

Shares are percentages of total duration and must add up to 100.
