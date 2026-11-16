---
slug: texture/signal-field
kind: primitive
group: texture
summary: Points jitter like static, then fall into a calm dot grid from the centre out.
status: specified
origin: designed
energy: medium
params:
  cols:
    default: 36
    min: 16
    max: 60
    unit: columns
  settle_at:
    default: 0.6
    min: 0
    max: 4
    unit: s
  settle:
    default: 1.2
    min: 0.4
    max: 3
    unit: s
  jitter:
    default: 26
    min: 0
    max: 60
    unit: px
  glitch:
    default: 0.55
    min: 0
    max: 1
    unit: ratio
  pulse:
    default: 0.5
    min: 0
    max: 1
    unit: ratio
  accent:
    default: 0.07
    min: 0
    max: 0.2
    unit: share
related:
- fx/grid-ripple
- texture/grain
since: 0.5.0
---

## Behaviour

Points jitter like static, now and then torn sideways by a glitch band, then fall into a calm dot grid, the middle first and the edges last. Once in order, a slow pulse travels down the grid, so the hold never goes dead. A few points carry the accent colour.

## Rules

- It is an idea, not a decoration: use it when the message is about turning noise into order.
- Open from black: fade the field in over 0.6–0.8 s before it starts to settle.
- Settle in 1–1.5 s on an in-out curve, from the centre out by distance.
- Keep the settled grid faint (about 17% opacity per dot) behind type.
- Jitter is hashed from the frame number: the same frame is always the same static.
