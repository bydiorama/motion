"""Build the private ChatGPT skill from this checkout's runtime and references."""
import subprocess
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "plugins/chatgpt"
SKILL = Path("skills/motion-film")
REFERENCES = {
    "catalog.json": "catalog.json",
    "library.json": "library.json",
    "film.schema.json": "schema/film.schema.json",
    "film.md": ".claude/skills/motion-film/reference/film.md",
    "CRAFT.md": "docs/CRAFT.md",
    "example.film.json": "films/feature-announcement.film.json",
}
OUTPUT = ROOT / "dist/diorama-motion.zip"


def main():
    OUTPUT.parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=OUTPUT.parent) as temp:
        checker = Path(temp) / "check-film.mjs"
        script = SKILL / "scripts" / checker.name
        subprocess.run([
            "pnpm", "exec", "esbuild", str(SOURCE / script), "--bundle",
            "--format=esm", "--platform=node", f"--outfile={checker}",
        ], cwd=ROOT, check=True)
        archive = Path(temp) / OUTPUT.name
        with ZipFile(archive, "w", ZIP_DEFLATED) as package:
            for file in ["plugin.json", SKILL / "SKILL.md"]:
                package.write(SOURCE / file, file)
            package.write(checker, script)
            for name, source in REFERENCES.items():
                package.write(ROOT / source, SKILL / "references" / name)
            package.write(ROOT / "LICENSE", "LICENSE")
        archive.replace(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    main()
