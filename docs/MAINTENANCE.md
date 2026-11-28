# Maintenance

## 1. Taking in a new reference

The reference is watched once and then let go. Only generic observations enter the library.

1. **Watch and note.** Write short notes in `inbox/` (ignored by git, never committed). One note per move: what moves, how fast, in what order.
2. **Generalise.** Rewrite each note without the product, brand, content or wording of the reference. If nothing is left, it was content, not motion. Drop it.
3. **Match.** For each note, search `INDEX.md`:

   | Result | Action |
   |---|---|
   | Same behaviour exists | Add 1 to `observations`. Widen a parameter range if the new case is outside it. |
   | Same behaviour, one new option | Add a parameter to the existing entry. |
   | Different behaviour | `tools/new_entry.py`, status `draft`, `observations: 1`. |
   | A whole-video structure | Compare with narratives first; most are variants of an existing one. |

4. **Delete the inbox notes.** Run `validate.py` and `build_index.py`. Commit.

**Same or different?** Two moves are the same entry if one can become the other by changing numbers (speed, count, size, direction). They are different if elements, order of events or the idea changes.

## 2. Creating and changing styles

Styles are decisions, not observations. A style is added when we want a look we can name and repeat.

- Start as `draft` with `uses`, `avoids`, token overrides and surface.
- A style becomes `specified` after one **style proof**: a short video rendered from an example storyboard and approved by a person.
- Two styles that share most of `uses` and tokens should be merged, or the difference written in one sentence in each.

## 3. Moving an entry forward

`draft → specified → recipe → tested` (see `docs/DESIGN.md`, decision 6).

Checklist for `tested`:
- `tools/check_recipe.py <slug>` passes (loads, repeatable seek).
- Frames in `out/` were looked at, at the busiest moment and at the end.
- For loops: first and last frame match.
- Defaults look right without any parameters set.

## 4. Renaming, merging, splitting, removing

- **Rename:** change slug and path; add the old slug to `aliases` so old storyboards still resolve.
- **Merge:** keep the better name, add the other as alias, add up `observations`, union the parameter ranges.
- **Split:** when an entry has more than 7 parameters or parameters that exclude each other.
- **Remove:** set `status: deprecated` and `replaced_by`. Delete the file only in the next major version.

## 5. Versions

Version lives in `CHANGELOG.md`; every entry records the version it arrived in (`since`).

| Change | Version step |
|---|---|
| Parameter default or range tuned, text fixes | patch (0.3.0 → 0.3.1) |
| New entries, new parameters, new aliases | minor (0.3.0 → 0.4.0) |
| Slug removed without alias, recipe contract changed | major |

## 6. Regular review

After every ~10 references, or once a month:

- Drafts with one observation that nobody has used: keep, merge or delete.
- Primitives no style or narrative uses (validator warnings): assign or delete.
- Pairs of entries with near-identical summaries: merge.
- Styles: is each still distinct in one sentence?
- "Open areas" in the changelog: which gap should the next references fill?

## 7. Every change, before commit

```bash
python3 tools/validate.py && python3 tools/build_index.py
```

Then add one line to `CHANGELOG.md`. CI (`.github/workflows/validate.yml`) runs the same checks on every pull request and also fails when `INDEX.md` or `showcase/index.html` is out of date.

## 8. Prepare an npm release

Install dependencies with `pnpm install --frozen-lockfile` and run `pnpm verify`. Check the release version in `package.json` and `src/version.ts`. Run `npm pack --pack-destination dist` to compile the CLI, public ESM modules, declarations, studio and wizard. The package allowlist is in `package.json`.

Install the tarball in an empty project and exercise the CLI and both public imports. Rehearse publication with `npm publish --dry-run --access public ./dist/bydiorama-motion-0.4.1.tgz`, substituting the release version. When releasing, a maintainer with publish access to the `@bydiorama` npm scope can publish the tested tarball with `npm publish --access public ./dist/bydiorama-motion-0.4.1.tgz`. [npm publish documentation](https://docs.npmjs.com/cli/v11/commands/npm-publish/)
