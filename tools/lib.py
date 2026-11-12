"""Shared loader for library entries (Markdown with YAML front matter)."""
import pathlib, yaml
ROOT = pathlib.Path(__file__).resolve().parent.parent
LIB = ROOT / "library"

def load_entry(path):
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError(f"{path}: missing front matter")
    _, fm, body = text.split("---\n", 2)
    meta = yaml.safe_load(fm) or {}
    return meta, body

def load_all():
    entries, errors = {}, []
    for p in sorted(LIB.rglob("*.md")):
        try:
            meta, body = load_entry(p)
        except Exception as e:  # noqa: BLE001
            errors.append(str(e)); continue
        meta["_path"], meta["_body"] = p, body
        slug = meta.get("slug", f"?{p}")
        if slug in entries:
            errors.append(f"{p}: duplicate slug {slug}")
        entries[slug] = meta
    return entries, errors

def tokens():
    return yaml.safe_load((ROOT / "tokens.yaml").read_text())
