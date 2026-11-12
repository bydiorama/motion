---
slug: narrative/data-story
kind: narrative
family: graphics
summary: Turns a few numbers into a short story.
status: draft
origin: designed
duration:
  min: 20
  max: 40
  unit: s
fits_styles:
- style/clean-explainer
- style/dark-showcase
beats:
- name: claim
  share: 15
  content: The claim, before the evidence
  primitives:
  - type/word-build
- name: number
  share: 25
  content: The headline number rolls in
  primitives:
  - fx/counter-roll
  - type/accent-number
- name: context
  share: 20
  content: What surrounds the number
  primitives:
  - scene/stat-with-evidence
  - fx/depth-drift
- name: compare
  share: 25
  content: Before and after, or this against that
  primitives:
  - rig/flip-ticker
  - fx/stagger-fill
- name: end
  share: 15
  content: Source and sign-off
  primitives:
  - scene/end-card
since: 0.5.0
---

## Notes

Never more than one number moving at a time. The source of every figure goes on screen, small, in the end card.

Shares are percentages of total duration and must add up to 100.
