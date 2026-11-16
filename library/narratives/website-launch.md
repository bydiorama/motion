---
slug: narrative/website-launch
kind: narrative
family: product
summary: Shows a new website as one journey, each page handing over to the next.
status: draft
origin: designed
duration:
  min: 18
  max: 30
  unit: s
fits_styles:
- style/dark-showcase
- style/product-ui
beats:
- name: idea
  share: 13
  content: The site's headline, doing what it says
  primitives:
  - type/fill-text
  - texture/signal-field
- name: site
  share: 12
  content: The homepage pulls back into perspective; its key card lifts off the page
  primitives:
  - rig/browser-window
  - transition/dive-in
- name: product
  share: 13
  content: The product itself, in depth, then out of the way
  primitives:
  - fx/depth-drift
  - transition/fly-past
- name: pages
  share: 30
  content: Inner pages, reached by one camera move or a whip; features as stacked tabs that open one after another
  primitives:
  - transition/camera-travel
  - rig/tab-stack
  - transition/whip-pan
  - type/fill-text
- name: proof
  share: 16
  content: Where it works, as places that light up
  primitives:
  - fx/pin-drop
  - transition/signal-wipe
- name: end
  share: 16
  content: The logo alone, at rest
  primitives:
  - scene/logo-reveal
  - scene/end-card
since: 0.5.0
---

## Notes

One journey, not a slideshow: every hand-over is driven by something already on screen (the headline, a card, the product, the page itself, a line of light). Where a hand-over is a camera move, both scenes live in one world and only the camera moves.

Use the site's own words and pictures: real pages, real product footage, no invented copy. In 4:5 for feeds, keep text within the middle 80% of the frame.

Shares are percentages of total duration and must add up to 100.
