#!/usr/bin/env python3
"""Check every library entry and example storyboard. Exit 1 on any error.

Usage: python3 tools/validate.py
"""
import re, sys, yaml
from lib import ROOT, LIB, load_all, tokens

STATUS = ["draft", "specified", "recipe", "tested", "deprecated"]
GROUPS = ["scene", "transition", "fx", "type", "rig", "ui", "texture"]
ENERGY = ["low", "medium", "high"]
SOURCE_WORDS = re.compile(r"https?://|www\.|linkedin|\b(inspired by|seen (in|on|at)|as in the|taken from)\b", re.I)

def main():
    entries, errors = load_all()
    warnings = []
    tok = tokens()
    aliases = {a: s for s, m in entries.items() for a in m.get("aliases", [])}
    def resolves(ref): return ref in entries or ref in aliases
    def err(m, msg): errors.append(f"{m['_path'].relative_to(ROOT)}: {msg}")
    def warn(m, msg): warnings.append(f"{m['_path'].relative_to(ROOT)}: {msg}")

    for slug, m in entries.items():
        kind = m.get("kind")
        rel = m["_path"].relative_to(LIB).with_suffix("")
        for f in ("slug", "kind", "summary", "status", "origin", "since"):
            if f not in m: err(m, f"missing field '{f}'")
        if m.get("status") not in STATUS: err(m, f"status must be one of {STATUS}")
        if m.get("origin") not in ("observed", "designed"): err(m, "origin must be observed or designed")
        if len(m.get("summary", "")) > 90: err(m, "summary longer than 90 characters")
        if SOURCE_WORDS.search(m["_body"]) or SOURCE_WORDS.search(m.get("summary", "")):
            err(m, "mentions a source or link; entries describe patterns only")
        if m.get("status") == "deprecated" and not m.get("replaced_by"):
            warn(m, "deprecated without replaced_by")
        if m.get("replaced_by") and not resolves(m["replaced_by"]): err(m, "replaced_by does not resolve")

        if kind == "primitive":
            if str(rel) != f"primitives/{slug}": err(m, f"path does not match slug {slug}")
            if m.get("group") not in GROUPS or m.get("group") != slug.split("/")[0]:
                err(m, f"group must match slug prefix and be one of {GROUPS}")
            if m.get("energy") not in ENERGY: err(m, f"energy must be one of {ENERGY}")
            if m.get("origin") == "observed":
                obs = m.get("observations", 0)
                if not isinstance(obs, int) or obs < 1: err(m, "observed entries need observations >= 1")
                elif obs < 2 and m.get("status") != "draft":
                    err(m, "needs 2 observations (or origin: designed) to leave draft")
            for name, p in (m.get("params") or {}).items():
                if "default" not in p: err(m, f"param {name}: no default"); continue
                lo, hi, d = p.get("min"), p.get("max"), p["default"]
                if lo is not None and hi is not None and not (lo <= d <= hi):
                    err(m, f"param {name}: default {d} outside {lo}..{hi}")
            if len(m.get("params") or {}) > 7: warn(m, "more than 7 params; consider splitting")
            for r in m.get("related", []):
                if not resolves(r): err(m, f"related '{r}' does not resolve")
            if m.get("status") in ("recipe", "tested"):
                if not (ROOT / "recipes" / f"{slug}.js").exists(): err(m, "status says recipe exists, file missing")
        elif kind == "style":
            if str(rel) != f"styles/{slug.split('/')[1]}": err(m, "path does not match slug")
            for k in (m.get("tokens") or {}):
                if k not in tok: err(m, f"token override '{k}' is not in tokens.yaml")
            for r in m.get("uses", []) + m.get("avoids", []):
                if not resolves(r): err(m, f"'{r}' does not resolve")
            if set(m.get("uses", [])) & set(m.get("avoids", [])): err(m, "same entry in uses and avoids")
        elif kind == "narrative":
            if str(rel) != f"narratives/{slug.split('/')[1]}": err(m, "path does not match slug")
            beats = m.get("beats") or []
            if sum(b.get("share", 0) for b in beats) != 100: err(m, "beat shares must add up to 100")
            for b in beats:
                for r in b.get("primitives", []):
                    if not resolves(r): err(m, f"beat {b.get('name')}: '{r}' does not resolve")
            for s in m.get("fits_styles", []):
                if not resolves(s): err(m, f"style '{s}' does not resolve")
        else:
            err(m, "kind must be primitive, style or narrative")

    # orphans: primitives no style or narrative uses
    used = set()
    for m in entries.values():
        used |= set(m.get("uses", []))
        tex = (m.get("surface") or {}).get("texture")
        if tex: used.add(tex)
        for b in m.get("beats", []) or []: used |= set(b.get("primitives", []))
    for slug, m in entries.items():
        if m.get("kind") == "primitive" and slug not in used and m.get("status") != "deprecated":
            warnings.append(f"{slug}: not used by any style or narrative yet")

    # storyboards
    for p in sorted((ROOT / "examples").glob("*.yaml")):
        sb = yaml.safe_load(p.read_text())
        for key in ("narrative", "style"):
            if not resolves(sb.get(key, "")): errors.append(f"{p.name}: {key} does not resolve")
        for sc in sb.get("scenes", []):
            for r in sc.get("uses", []):
                if not resolves(r): errors.append(f"{p.name}: scene {sc.get('id')}: '{r}' does not resolve")

    for w in warnings: print("warn ", w)
    for e in errors: print("ERROR", e)
    print(f"{len(entries)} entries, {len(errors)} errors, {len(warnings)} warnings")
    sys.exit(1 if errors else 0)

if __name__ == "__main__":
    main()
