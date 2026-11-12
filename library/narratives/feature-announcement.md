---
slug: narrative/feature-announcement
kind: narrative
family: product
summary: For one new capability.
status: draft
origin: observed
observations: 1
duration:
  min: 18
  max: 25
  unit: s
fits_styles:
- style/clean-explainer
beats:
- name: headline
  share: 14
  content: Headline builds word by word
  primitives:
  - type/mask-reveal
  - scene/kinetic-headline
  - type/word-build
  - type/inline-chips
- name: stat
  share: 14
  content: Big number with evidence around it
  primitives:
  - fx/odometer
  - scene/stat-with-evidence
  - type/accent-number
- name: prompt
  share: 16
  content: A request is typed and sent
  primitives:
  - scene/zoomed-ui
  - ui/prompt-typing
  - ui/cursor-click
- name: result
  share: 18
  content: The answer streams in
  primitives:
  - ui/streamed-result
- name: context
  share: 8
  content: One line that widens the claim
  primitives:
  - transition/push
  - transition/blur-dissolve
  - scene/kinetic-headline
- name: breadth
  share: 18
  content: Wall of related items, one highlighted
  primitives:
  - scene/marquee-wall
  - fx/marquee-highlight
- name: end
  share: 12
  content: The highlight becomes the logo
  primitives:
  - scene/logo-reveal
  - transition/collapse-to-anchor
  - scene/end-card
since: 0.3.0
---

## Notes

Shares are percentages of total duration and must add up to 100.
