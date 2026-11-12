---
slug: narrative/app-demo
kind: narrative
family: product
summary: Shows an app doing one real task, start to finish.
status: draft
origin: designed
duration:
  min: 30
  max: 60
  unit: s
fits_styles:
- style/product-ui
- style/clean-explainer
beats:
- name: hook
  share: 10
  content: The problem in one line
  primitives:
  - type/mask-reveal
  - scene/kinetic-headline
  - type/word-build
- name: open
  share: 12
  content: The app arrives, enlarged where it matters
  primitives:
  - transition/iris
  - scene/zoomed-ui
  - transition/dive-in
- name: flow
  share: 30
  content: The cursor works through the task, one step per beat
  primitives:
  - ui/cursor-click
  - ui/prompt-typing
  - ui/tour-hold
- name: result
  share: 18
  content: The outcome appears, with the number that proves it
  primitives:
  - type/shimmer
  - ui/streamed-result
  - fx/counter-roll
- name: recap
  share: 18
  content: Three features, named
  primitives:
  - transition/stack-over
  - type/inline-chips
  - fx/stagger-fill
- name: end
  share: 12
  content: Name and where to get it
  primitives:
  - scene/logo-reveal
  - scene/end-card
since: 0.5.0
---

## Notes

One task, shown for real. Hold every step long enough to read the interface, and cut away anything the task does not need.

Shares are percentages of total duration and must add up to 100.
