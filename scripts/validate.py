#!/usr/bin/env python3
"""Validate every themebook and character JSON under data/ against its schema.

Usage: python scripts/validate.py [themebooks|characters|all]
"""

import json
import sys
from pathlib import Path

import jsonschema

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

TARGETS = {
    "themebooks": (
        DATA / "themebooks",
        DATA / "themebooks" / "themebook.schema.json",
    ),
    "characters": (
        DATA / "characters",
        DATA / "characters" / "character.schema.json",
    ),
}


def validate_dir(label: str, dir_path: Path, schema_path: Path) -> int:
    schema = json.loads(schema_path.read_text())
    jsonschema.Draft202012Validator.check_schema(schema)
    validator = jsonschema.Draft202012Validator(schema)

    files = sorted(
        p for p in dir_path.rglob("*.json")
        if p != schema_path
        and not any(part.startswith(".") for part in p.relative_to(dir_path).parts)
    )
    if not files:
        print(f"[{label}] No files found in {dir_path.relative_to(ROOT)}")
        return 0

    failed = 0
    for path in files:
        rel = path.relative_to(ROOT)
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError as exc:
            print(f"FAIL {rel}: invalid JSON – {exc}")
            failed += 1
            continue

        errors = sorted(validator.iter_errors(data), key=lambda e: list(e.path))
        if errors:
            print(f"FAIL {rel}: {len(errors)} schema error(s)")
            for err in errors:
                location = "/".join(str(p) for p in err.path) or "<root>"
                print(f"  - {location}: {err.message}")
            failed += 1
        else:
            print(f"OK   {rel}")

    print(f"  → {len(files) - failed}/{len(files)} {label} validate against {schema_path.relative_to(ROOT)}")
    return failed


def main() -> int:
    target = sys.argv[1] if len(sys.argv) > 1 else "all"
    if target == "all":
        labels = list(TARGETS)
    elif target in TARGETS:
        labels = [target]
    else:
        print(f"Unknown target: {target}. Choose from: {', '.join(TARGETS)}, all")
        return 2

    total_failed = 0
    for label in labels:
        dir_path, schema_path = TARGETS[label]
        if not schema_path.exists():
            print(f"[{label}] schema not found at {schema_path.relative_to(ROOT)}")
            total_failed += 1
            continue
        print(f"\n=== Validating {label} ===")
        total_failed += validate_dir(label, dir_path, schema_path)

    print()
    return 0 if total_failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
