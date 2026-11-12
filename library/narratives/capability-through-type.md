---
slug: narrative/capability-through-type
kind: narrative
family: graphics
summary: For features that can be shown through text itself.
status: draft
origin: observed
observations: 1
duration:
  min: 30
  max: 45
  unit: s
fits_styles:
- style/editorial-type
beats:
- name: write
  share: 15
  content: A sentence is written while it scrolls
  primitives:
  - type/writing-ticker
- name: restyle
  share: 30
  content: Each word gets a different treatment
  primitives:
  - type/per-word-restyle
  - ui/collab-cursors
- name: multiply
  share: 15
  content: One word becomes a grid of typefaces
  primitives:
  - type/style-multiply
  - scene/specimen-grid
- name: flip
  share: 15
  content: Mood changes to dark
  primitives:
  - transition/light-dark-flip
  - texture/dither
- name: posters
  share: 15
  content: Poster frames with visible grids
  primitives: []
- name: close
  share: 10
  content: Closing line and logo
  primitives:
  - scene/end-card
since: 0.3.0
---

## Notes

Shares are percentages of total duration and must add up to 100.
