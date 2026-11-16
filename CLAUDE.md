# Notes for Claude

- **Placeholders wear bydiorama/ui.** Any demo, sample, thumbnail or stand-in content (films in `films/`, `examples/`, wizard previews, mock cards, posters and slides) uses bydiorama/ui:
  - set `theme.ui` (`zero`, Diorama's own, unless another theme is named; the wizard and studio use `graphite`);
  - Aspekta through `var(--m-font-display)` / `var(--m-font-body)`;
  - colours only from role variables (`--m-bg-*`, `--m-text-*`, `--m-accent`, `--m-border`, `--ui-*`); radii from `--ui-radius-*`; hairlines rather than shadows;
  - inline SVG fills through `style="fill:var(…)"`.

  No hex colours, other faces or monospace. A person's own brand content keeps its own look. The full rule is in `.claude/skills/motion-film/SKILL.md`.
- After `node scripts/ui-theme.ts`, check `git diff src/studio/theme/`: it also rewrites the studio's Graphite file from the ui repo.
- `pnpm verify` before committing; `python tools/validate.py` for library entries.
