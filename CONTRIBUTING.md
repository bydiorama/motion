# Contributing

Read `docs/DESIGN.md` once, then follow `docs/MAINTENANCE.md` for every change.

Short version:

1. Entries describe patterns, not sources. No links, brand names or "seen in".
2. A new reference usually changes an existing entry (a count, a range). Create a new entry only for new behaviour.
3. Before you commit:

   ```bash
   python3 tools/validate.py && python3 tools/build_index.py
   ```

   If you touched the showcase, also run `python3 tools/build_showcase.py`.
4. Add one line to `CHANGELOG.md`.
5. One topic per pull request. CI runs the same checks.

## Licence

By contributing, you agree that your contribution is licensed under the MIT licence in [LICENSE](LICENSE). Do not add files you may not license that way: footage, frames, artwork, fonts or code from elsewhere. If a third-party file has to ship, keep its licence text beside it and add it to [CREDITS.md](CREDITS.md).
