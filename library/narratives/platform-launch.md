---
slug: narrative/platform-launch
kind: narrative
family: product
summary: For a product made of several tools.
status: draft
origin: observed
observations: 1
duration:
  min: 35
  max: 50
  unit: s
fits_styles:
- style/dark-showcase
beats:
- name: hook
  share: 5
  content: Hero object built from the brand mark
  primitives:
  - scene/hero-object
  - rig/tumbling-object
- name: dive
  share: 1
  content: Camera pushes into the object
  primitives:
  - transition/dive-in
- name: burst
  share: 4
  content: Assets explode outward
  primitives:
  - fx/radial-burst
- name: title
  share: 5
  content: Product name with drifting collage
  primitives:
  - type/typed-title
  - fx/depth-drift
- name: collapse
  share: 2
  content: Everything shrinks into the first interface element
  primitives:
  - transition/collapse-to-anchor
- name: use
  share: 6
  content: A query is typed and results fill the frame
  primitives:
  - ui/prompt-typing
  - ui/streamed-result
  - scene/grid-wall
- name: tour
  share: 52
  content: One feature every 2 to 3 s inside a fixed frame
  primitives:
  - ui/tour-hold
  - transition/layout-locked-swap
  - transition/beat-cut
- name: delight
  share: 8
  content: A playful or illustrated moment
  primitives:
  - fx/letter-interleave
- name: proof
  share: 7
  content: Thousands of items tile the frame
  primitives:
  - scene/mosaic
  - fx/mosaic-fill
- name: bookend
  share: 10
  content: Return to the hero object so the film loops
  primitives:
  - rig/tumbling-object
  - scene/end-card
since: 0.3.0
---

## Notes

Shares are percentages of total duration and must add up to 100.
