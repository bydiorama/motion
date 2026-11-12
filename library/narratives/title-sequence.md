---
slug: narrative/title-sequence
kind: narrative
family: brand
summary: Opens an event, a series or a talk with names and a title.
status: draft
origin: designed
duration:
  min: 20
  max: 45
  unit: s
fits_styles:
- style/editorial-type
- style/dark-showcase
beats:
- name: open
  share: 15
  content: Texture and a first mark of light
  primitives:
  - texture/gradient-drift
  - texture/grain
  - texture/halftone-field
  - transition/curtain
- name: names
  share: 40
  content: Names and roles, one at a time
  primitives:
  - type/mask-reveal
  - type/typed-title
  - type/word-roller
  - type/writing-ticker
- name: title
  share: 30
  content: The title, set large
  primitives:
  - type/char-cascade
  - type/tracking-in
  - transition/zoom-through-letter
  - scene/kinetic-headline
  - type/echo
- name: date
  share: 15
  content: Date and place
  primitives:
  - type/block-reveal
  - type/split-flap
  - scene/end-card
since: 0.5.0
---

## Notes

Paced to music when there is any. The title is the only moment that may be loud.

Shares are percentages of total duration and must add up to 100.
