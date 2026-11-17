# Motion Library

[![validate](https://github.com/bydiorama/motion/actions/workflows/validate.yml/badge.svg)](https://github.com/bydiorama/motion/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Our own vocabulary for making motion videos with code. It is the reference that the motion skills read.

A video = **one narrative + one style + brand input**.

| Layer | What it is | Folder |
|---|---|---|
| Primitive | One move: an effect, a transition, a text animation, a 3D rig, a scene type | `library/primitives/<group>/` |
| Style | Our named look: a set of preferred primitives, timing and surface | `library/styles/` |
| Narrative | A story structure: beats in order, with a share of time each | `library/narratives/` |

The runtime turns this vocabulary into films:

| Part | What it is | Where |
|---|---|---|
| Film | A video as JSON: scenes of layers, each layer a primitive with props and params. An agent writes it | `films/<name>.film.json` |
| Tune | A person's overrides and pinned notes, kept beside the film. The agent reads it back | `films/<name>.tune.json` |
| Runtime | Resolves a film (checks, timing, tokens) and draws any frame from its time alone | `src/` |
| Studio | DialKit panel and timeline for directing a film; writes only the tune | `motion preview` |
| Catalog | What a film may use: primitives, params, tokens, eases. Generated | `catalog.json`, `schema/film.schema.json` |

Other parts:

- `INDEX.md`: one line per entry. Generated. Start here.
- `tokens.yaml`: global timing and easing defaults. Styles override them.
- `recipes/`: code for primitives, one file per slug, all with the same interface.
- `examples/`: example storyboards (what a director skill outputs).
- `templates/`: starting files for new entries.
- `showcase/`: a short film about the library, built from its own entries.
- `tools/`: validation, index building, recipe checking, showcase build.
- `.github/workflows/validate.yml`: runs the checks on every pull request.
- `docs/DESIGN.md`: why the library is built this way.
- `docs/MAINTENANCE.md`: how to add references, change entries and release versions.

## Daily commands

```bash
python3 tools/new_entry.py primitive fx/my-effect   # start a new entry
python3 tools/validate.py                           # check everything
python3 tools/build_index.py                        # refresh INDEX.md
python3 tools/check_recipe.py type/word-build       # test one recipe in Chrome
python3 tools/build_showcase.py                     # rebuild showcase/index.html
```

Setup: `pip install -r requirements.txt` (Python 3.10+). Recipe checks also need Chrome.

## Start with a brief

```bash
node bin/motion.mjs wizard                    # questions in the browser, at http://127.0.0.1:4322
node bin/motion.mjs wizard --out wizard.html  # the same page as one file you can share
node bin/motion.mjs brief answers.json        # the same brief from saved answers, no browser
```

The wizard asks one question per screen: video type (product, brand, motion graphics or social, eleven in all), feel, message, what's on screen, moves, length, formats, and whether an agent or a chat assistant will make it. The look follows from the video type. Video types, feels and moves have thumbnails drawn by the runtime itself (`src/wizard/previews.ts`): the selected one plays, the rest hold a still. It then writes a Markdown brief to copy into Claude or ChatGPT. The brief has the beats with timings, the moves that can be drawn (and the ones in the library that can't be drawn yet), timing tokens, a starter film that validates, and what "done" means. The same answers always give the same brief: the wizard and `motion brief` call one pure function (`src/brief/brief.ts`).

Agents working in this repository use the `motion-film` skill (`.claude/skills/motion-film/`). It sets the order of work: read the brief and catalog, plan beats, write, validate, look at stills, check, hand over to the studio, then answer notes.

## Films

```bash
pnpm install                                         # Node 24+
node bin/motion.mjs catalog                          # what a film may use (read this first)
node bin/motion.mjs validate films/showcase.film.json  # errors with paths, hints and "did you mean"
node bin/motion.mjs preview films/showcase.film.json   # studio at http://127.0.0.1:4321
node bin/motion.mjs stills films/showcase.film.json    # key frames and a contact sheet
node bin/motion.mjs check films/showcase.film.json     # frames repeat exactly, nothing off stage (--loop: the seam)
node bin/motion.mjs make examples/builder.film.mjs     # a film written as a script: checked, then written as JSON
node bin/motion.mjs capture https://example.com --sections  # a 2× screenshot per section, banners hidden
node bin/motion.mjs render films/showcase.film.json    # MP4 and a report (needs ffmpeg)
node bin/motion.mjs bake films/showcase.film.json      # write agreed tuning into the film
pnpm verify                                          # type-check, tests, catalog, films
```

Commands that draw (`stills`, `check`, `render`, `capture`) use Playwright's Chromium. Without it, point them at any installed Chromium-based browser: `--browser "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"`, or set `MOTION_CHROMIUM` once. Films with `el/video` need ffmpeg, which pulls the frames each layer shows.

The studio is one screen: scenes on the left, each with a still and its intent, the stage with a transport under it (Space plays, ←/→ step a frame, Shift steps a second, [ and ] jump between scenes), an inspector with Tune, Notes and Issues on the right, and the DialKit timeline along the bottom.

Agents write the film and never the tune. People direct in the studio: every dial is generated from the film and the catalog, dragging a scene clip sets its length, and notes pinned to a moment are stored for the agent. Overrides address scenes and layers by id, so they survive the agent rewriting the film; an override whose target is gone is reported, not dropped.

The studio is drawn in bydiorama/ui's Graphite theme (Aspekta, no chroma). Films read `--ui-*` tokens too: pass a ui theme with `--css` and the stage uses its colours, fonts and easing curves (`ui.default`, `ui.spring`, …). A film can also set `"theme": { "ui": "zero" }` (or `graphite`, `hockney`): the stage then carries that bundled ui theme and Aspekta itself, in the studio, in stills and in renders. The demo films and the wizard's thumbnails are drawn this way. `node scripts/ui-theme.ts` regenerates the studio theme and the bundled stage themes from the ui token resolver.

## The one rule

Entries describe **patterns, not sources**. No links, no brand names, no "seen in". References are inspiration: they are watched, broken into generic observations, and then thrown away. See `docs/MAINTENANCE.md`.

## Licence

MIT, © 2026 Diorama (bydiorama). See [LICENSE](LICENSE).

Two bundled files keep their own licences: the DialKit stylesheet (MIT, `showcase/vendor/DIALKIT-LICENSE`) and the Aspekta typeface (SIL Open Font License 1.1, `src/studio/theme/fonts/OFL.txt`). [CREDITS.md](CREDITS.md) lists everything this repository bundles or draws on.
