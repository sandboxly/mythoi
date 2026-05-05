#!/usr/bin/env python3
"""Validate every themebook JSON file under data/themebooks/ against the schema."""

import json
import sys
from pathlib import Path

import jsonschema

ROOT = Path(__file__).resolve().parent.parent
THEMEBOOKS_DIR = ROOT / "data" / "themebooks"
SCHEMA_PATH = THEMEBOOKS_DIR / "themebook.schema.json"


def main() -> int:
    schema = json.loads(SCHEMA_PATH.read_text())
    jsonschema.Draft202012Validator.check_schema(schema)
    validator = jsonschema.Draft202012Validator(schema)

    files = sorted(p for p in THEMEBOOKS_DIR.rglob("*.json") if p != SCHEMA_PATH)
    if not files:
        print("No themebook files found.")
        return 1

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

    print()
    print(f"{len(files) - failed}/{len(files)} themebook files validate against {SCHEMA_PATH.relative_to(ROOT)}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
