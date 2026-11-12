---
slug: narrative/social-teaser
kind: narrative
family: social
summary: A short vertical hook for a feed.
status: draft
origin: designed
duration:
  min: 6
  max: 15
  unit: s
fits_styles:
- style/kinetic-poster
- style/studio-loop
beats:
- name: hook
  share: 30
  content: One word or number that stops the scroll
  primitives:
  - type/block-reveal
  - type/char-cascade
  - type/scramble
  - type/split-flap
- name: payoff
  share: 45
  content: What it means, cut on the beat
  primitives:
  - type/word-roller
  - transition/slant-wipe
  - type/word-build
  - transition/beat-cut
- name: end
  share: 25
  content: Name and call to action
  primitives:
  - scene/logo-reveal
  - scene/end-card
since: 0.5.0
---

## Notes

Readable with the sound off and in the first second. Keep text inside the middle 80% of a 9:16 frame, clear of feed controls.

Shares are percentages of total duration and must add up to 100.
