# Credits

This library is written from scratch, but some files ship with it that are not
ours, and some of its numbers come from elsewhere. This page names them.

## Bundled material

Each item below keeps its own licence. The licence text travels with the file,
as the licence requires.

- **[DialKit](https://github.com/joshpuckett/dialkit)** — © 2026 Josh Puckett,
  MIT. The studio's parameter panel and timeline dock. The studio imports the
  `dialkit` package (a dev dependency, bundled when the studio is served); the
  showcase ships its stylesheet as `showcase/vendor/dialkit.min.css` and loads
  its script from a CDN at a pinned version. Licence:
  `showcase/vendor/DIALKIT-LICENSE`.
- **[Aspekta](https://github.com/ivodolenc/aspekta)** — © 2025 Ivo Dolenc,
  SIL Open Font License 1.1. The one typeface of the studio, the wizard and
  the bundled stage themes. Redistributed as
  `src/studio/theme/fonts/AspektaVF.woff2` (and embedded from it into the
  stage themes) with the licence text beside it:
  `src/studio/theme/fonts/OFL.txt`. The font stays under the OFL; the MIT
  licence of this repository does not cover it.

## From bydiorama/ui

**[bydiorama/ui](https://github.com/bydiorama/ui)** — © 2026 Diorama
(bydiorama), MIT, the same owner and licence as this repository.

- `src/dom/ui-themes.css.ts` and `src/studio/theme/graphite.css.ts` are
  generated from its token resolver by `scripts/ui-theme.ts`.
- `src/studio/fade.ts` ports its Fade component to plain DOM, with the
  perceptual ramp tables copied verbatim.
- The `ui.*` easing curves are its `--ui-ease-*` tokens.

Some of those tokens (`--ui-press-scale`, `--ui-stagger-step`, the hit-area
sizes) encode values ui adapted from
[jakubkrehel/skills](https://github.com/jakubkrehel/skills) (© 2026 Jakub
Krehel, MIT). See ui's [CREDITS.md](https://github.com/bydiorama/ui/blob/main/CREDITS.md).

## Tools, not shipped

Dev dependencies in `package.json` and `requirements.txt` (TypeScript,
esbuild, Playwright, yaml, PyYAML) and the ffmpeg the render commands call
are used under their own licences. None of their files are in this
repository.

## References

Library entries describe patterns, not sources (see `docs/MAINTENANCE.md`).
The films and pages that informed them are watched, turned into generic
observations and let go; no footage, frames, artwork or wording from them is
in this repository.

## Trademarks

Every name above is used **nominatively**, to say what this work uses or
draws on. Product and company names are the trademarks of their owners, and a
copyright licence grants no trademark rights: MIT licenses the code, not the
name. Nothing here implies sponsorship, endorsement or affiliation. "Diorama"
and "bydiorama" name the authors of this repository; the MIT licence does not
grant their use as a mark either.
