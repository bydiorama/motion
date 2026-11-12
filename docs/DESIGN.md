# Design

## Goals

1. **Ours.** The library holds our styles. References only inform it.
2. **Usable by a model and by a person.** A skill must find the right entry cheaply; a designer must be able to read and edit it.
3. **Grows without rotting.** Fifty references later it should have better entries, not five times as many.
4. **Leads to renders.** Every entry can end in tested code.

## Decisions

### 1. One file per entry, with structured front matter
Each entry is a Markdown file. The top part (YAML) holds facts a tool can check: slug, status, parameters, links. The body holds the description for people.

Why: small diffs, easy review, and a skill can load `INDEX.md` (short) and then only the few entries it needs, not the whole library.

### 2. Three layers, linked by slug
Primitives know nothing about styles. Styles and narratives point to primitives by slug. The validator checks that every pointer resolves.

Why: one primitive serves many styles. A new style is a new combination, not new copies.

### 3. Names say what happens
A slug is `group/what-it-does`, for example `transition/blur-dissolve`. Never a brand, product, tool or person.

Test: could someone who never saw any reference understand the name?

### 4. Variation is a parameter, not a new entry
Each parameter has a default and a range. When a new reference shows the same move faster or bigger, the range widens. A new entry is created only when the *behaviour* is different.

Why: this is what stops overlapping references from creating duplicates.

### 5. Sources are counted, never named
`observations: 3` means three independent references showed the pattern. That is all we keep. The count tells us how established a pattern is; nothing can be traced back or copied.

`origin: designed` marks entries we invented ourselves. Styles are always designed.

### 6. Status shows how far an entry can be trusted

| Status | Meaning | To get here |
|---|---|---|
| `draft` | An idea or a single observation | Create the file |
| `specified` | Behaviour and parameters agreed | 2+ observations, or `origin: designed` |
| `recipe` | Code exists in `recipes/` | Recipe follows the contract |
| `tested` | Rendered, looked at, approved | `check_recipe.py` passes and a person approved the frames |
| `deprecated` | Do not use | Set `replaced_by` |

Skills should prefer `tested`, may use `recipe`, and must say so when they fall back to `draft`.

### 7. Timing lives in tokens
`tokens.yaml` holds beat length, standard durations, staggers and easing names. A style changes the feel by overriding tokens, not by editing primitives.

Why: one place to tune the rhythm of everything.

### 8. Recipes share one contract
Every recipe exports `build(root, params, ctx)` and returns `{ duration, seek(t) }`. `seek(t)` must draw the exact state at time `t`, with no clock and no unseeded randomness.

Why: the renderer can capture any frame in any order, renders repeat exactly, and loops can be checked by comparing the first and last frame. See `recipes/README.md`.

### 9. The library is versioned; storyboards pin a version
A storyboard states `library_version`. Old storyboards keep rendering the same way after the library changes.

### 10. Tools enforce the rules
`tools/validate.py` fails on: missing fields, broken links, defaults outside ranges, beat shares that do not add up to 100, source mentions or URLs in entries, and entries that left `draft` without enough observations. It warns about primitives nothing uses.

## What is deliberately left out

- **No source index, no reference media.** Not in the repository, not in entry text.
- **No brand values.** Colours, fonts and logos come from a design-system file at render time.
- **No renderer.** Rendering belongs to a separate skill; this repository only guarantees the recipe contract.
