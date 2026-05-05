"""Pure-Python implementations of the MCP tools.

Kept free of MCP framework imports so they can be unit-tested directly and
reused from CLI scripts.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

import jsonschema

from . import paths

# ---------------------------------------------------------------------------
# Themebook tools
# ---------------------------------------------------------------------------


def _all_themebook_files() -> list[Path]:
    return sorted(
        p for p in paths.themebooks_dir().rglob("*.json")
        if p.name != "themebook.schema.json"
    )


def _load_themebook(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def _themebook_index() -> list[dict[str, Any]]:
    """Build a lightweight index of all themebooks (no questions, no examples)."""
    items = []
    for path in _all_themebook_files():
        tb = _load_themebook(path)
        items.append({
            "name": tb["name"],
            "type": tb["type"],
            "categories": tb.get("categories", []),
            "summary": tb.get("description", [""])[0][:240] if tb.get("description") else "",
            "file": str(path.relative_to(paths.plugin_root())),
        })
    return items


def list_themebooks(type: str | None = None) -> list[dict[str, Any]]:
    """Return a brief index of themebooks. ``type`` filters by mythos/logos/crew/extra."""
    items = _themebook_index()
    if type:
        items = [i for i in items if i["type"] == type.lower()]
    return items


def _find_themebook(name: str) -> Path:
    """Find a themebook file by case-insensitive name match."""
    target = name.strip().upper()
    for path in _all_themebook_files():
        tb = _load_themebook(path)
        if tb["name"].upper() == target:
            return path
    raise ValueError(f"Themebook not found: {name!r}. Use list_themebooks() to browse.")


def get_themebook(name: str) -> dict[str, Any]:
    """Return the full themebook JSON (concept, all questions, examples, etc.)."""
    return _load_themebook(_find_themebook(name))


def themebook_question(themebook: str, letter: str, kind: str = "power") -> dict[str, Any]:
    """Return a single tag question from a themebook.

    ``kind`` is 'power' or 'weakness'. ``letter`` is a single capital A-Z.
    """
    tb = get_themebook(themebook)
    letter = letter.strip().upper()
    if kind not in ("power", "weakness"):
        raise ValueError(f"kind must be 'power' or 'weakness', got {kind!r}")
    field = "power_tag_questions" if kind == "power" else "weakness_tag_questions"
    for q in tb.get(field, []):
        if q.get("letter", "").upper() == letter:
            return {
                "themebook": tb["name"],
                "kind": kind,
                **q,
            }
    raise ValueError(f"No {kind} tag question {letter!r} in themebook {tb['name']!r}.")


# ---------------------------------------------------------------------------
# Character tools
# ---------------------------------------------------------------------------


def _character_schema() -> dict[str, Any]:
    return json.loads(paths.character_schema_path().read_text())


def _validator() -> jsonschema.Draft202012Validator:
    schema = _character_schema()
    jsonschema.Draft202012Validator.check_schema(schema)
    return jsonschema.Draft202012Validator(schema)


def get_character_schema() -> dict[str, Any]:
    """Return the character JSON schema."""
    return _character_schema()


def character_template() -> dict[str, Any]:
    """Return a blank character JSON skeleton, ready to fill in."""
    return {
        "$schema": "./character.schema.json",
        "name": "",
        "pronouns": "",
        "concept": {
            "mythos": "",
            "mythos_description": "",
            "logos": "",
            "logos_description": "",
        },
        "awareness": 1,
        "character_class": "touched",
        "setting": "",
        "themes": [],
        "crew_theme": None,
        "story_tags": [],
        "statuses": [],
        "help_points": [],
        "hurt_points": [],
        "juice": 0,
        "build_up": 0,
        "nemeses": [],
        "secondary_characters": [],
        "moments_of_evolution": [],
        "connections": [],
        "notes": "",
        "metadata": {},
    }


def validate_character(character: dict[str, Any]) -> dict[str, Any]:
    """Validate a character object against the schema. Returns ``{ok, errors}``."""
    validator = _validator()
    errors = []
    for err in sorted(validator.iter_errors(character), key=lambda e: list(e.path)):
        errors.append({
            "path": "/".join(str(p) for p in err.path) or "<root>",
            "message": err.message,
        })
    return {"ok": not errors, "errors": errors}


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", name).strip("_").lower()
    return s or "character"


def save_character(character: dict[str, Any], path: str | None = None) -> dict[str, Any]:
    """Write a character JSON to disk. Defaults to ``~/.mythoi/characters/<slug>.json``."""
    validation = validate_character(character)
    if path is None:
        target_dir = paths.default_character_dir()
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / f"{_slugify(character.get('name', 'character'))}.json"
    else:
        target = Path(path).expanduser().resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(character, indent=2, ensure_ascii=False) + "\n")
    return {
        "path": str(target),
        "validation": validation,
    }


def load_character(path: str) -> dict[str, Any]:
    """Read a character JSON from disk."""
    return json.loads(Path(path).expanduser().read_text())


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------


def render_sheet(
    character: dict[str, Any] | str,
    layout: str = "sheet",
    format: str = "html",
    output: str | None = None,
) -> dict[str, Any]:
    """Render a character to HTML (and optionally PDF).

    ``character`` can be the JSON object or a path to a character file.
    ``layout`` is 'sheet' (full A4 sheet) or 'cards' (one theme per page).
    ``format`` is 'html' or 'pdf' ('pdf' implies HTML rendered + Chrome conversion).
    """
    if layout not in ("sheet", "cards"):
        raise ValueError(f"layout must be 'sheet' or 'cards', got {layout!r}")
    if format not in ("html", "pdf"):
        raise ValueError(f"format must be 'html' or 'pdf', got {format!r}")

    # Resolve character source: write to a temp file if given as dict.
    char_path: Path
    cleanup: Path | None = None
    if isinstance(character, str):
        char_path = Path(character).expanduser().resolve()
    else:
        slug = _slugify(character.get("name", "character"))
        cleanup = paths.default_character_dir() / f".tmp_{slug}.json"
        cleanup.parent.mkdir(parents=True, exist_ok=True)
        cleanup.write_text(json.dumps(character, indent=2, ensure_ascii=False))
        char_path = cleanup

    cmd = [sys.executable, str(paths.render_script()), str(char_path)]
    if layout == "cards":
        cmd.append("--cards")
    if format == "pdf":
        cmd.append("--pdf")
    if output:
        cmd.extend(["-o", str(Path(output).expanduser().resolve())])

    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
    finally:
        if cleanup is not None and cleanup.exists():
            cleanup.unlink()

    if result.returncode != 0:
        return {
            "ok": False,
            "stdout": result.stdout,
            "stderr": result.stderr,
        }

    # Render script prints "Wrote HTML: <path>" and "Wrote PDF: <path>" lines.
    paths_out = {}
    for line in result.stdout.splitlines():
        if line.startswith("Wrote HTML:"):
            paths_out["html"] = line.split(":", 1)[1].strip()
        elif line.startswith("Wrote PDF:"):
            paths_out["pdf"] = line.split(":", 1)[1].strip()
    return {"ok": True, "paths": paths_out, "stdout": result.stdout}
