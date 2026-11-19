---
slug: type/fill-text
kind: primitive
group: type
summary: The whole line is there, dim; each word fills to full in reading order.
status: specified
origin: designed
energy: low
params:
  duration:
    default: 1.7
    min: 0.4
    max: 4
    unit: s
  dim:
    default: 0.35
    min: 0
    max: 0.6
    unit: opacity
  blur:
    default: 0
    min: 0
    max: 6
    unit: px
  rise:
    default: 0
    min: 0
    max: 12
    unit: px
  soft:
    default: 1.5
    min: 1
    max: 8
    unit: words
  ease:
    default: smooth
  word_ease:
    default: linear
related:
- type/word-build
- type/mask-reveal
since: 0.5.0
---

## Behaviour

The whole line is on screen from the first frame, dim. Each word fills in reading order, from dim through a mid stop to full, as if the line were being read aloud. Nothing moves; only the light in the letters changes. Words named in `accent` fill to the accent colour.

## Rules

- The first frame is already a readable, if quiet, thumbnail: feeds often show it as the cover.
- Dim 0.3–0.4 and a mid stop a little past halfway: the eye reads a word as filled before it is quite done.
- Fill a whole line in 1.2–2 s on a symmetric curve (`smooth`), so neither end rushes.
- No movement on the type: no rise, no blur, no jitter. The fill is the move.
- Pair it with a still or slowly drifting background; it is the quietest headline reveal and should stay the hero of its frame.

## Streaming

With `dim` at 0 the line streams in instead, as a model's answer does: words arrive one after another out of a slight blur. Every word keeps its place from the first frame, so the paragraph never re-wraps or re-centres while it grows, and nothing below it moves.

- Words about 50 ms apart, each taking about 350 ms: `soft` is the time per word over the gap (7), and `duration` is (words − 1) × gap + time per word.
- `word_ease: expo.out`, `blur` 1 px, `rise` 0. The blur is the move; a rise on running text makes it hard to read.
- A word in braces, `{1}`, is a badge (a citation, a count): it pops on its turn from half size, past its mark and back, in the accent.
