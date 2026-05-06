#!/usr/bin/env python3
"""Convert a City of Mist (or other Coriolis/MoM supplement) PDF to Markdown.

Usage:
    python scripts/extract_sourcebook.py ~/Downloads/city_of_mist_players_guide.pdf
    python scripts/extract_sourcebook.py book.pdf -o ~/mythoi-data/players_guide.md
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


def extract(pdf_path: Path, output_path: Path) -> None:
    try:
        import pymupdf4llm  # noqa: PLC0415
    except ImportError:
        print(
            "[mythoi] pymupdf4llm is not installed.\n"
            "  Run:  pip install pymupdf4llm\n"
            "  (It is included in the plugin's auto-installed dependencies.)",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"[mythoi] Extracting {pdf_path.name} → {output_path} …", file=sys.stderr)
    md = pymupdf4llm.to_markdown(str(pdf_path))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(md, encoding="utf-8")
    size_kb = output_path.stat().st_size // 1024
    print(f"[mythoi] Done. {size_kb} KB written to {output_path}", file=sys.stderr)
    print(str(output_path))  # stdout: machine-readable path for callers


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract a PDF to Markdown for themebook parsing."
    )
    parser.add_argument("pdf", help="Path to the source PDF file.")
    parser.add_argument(
        "-o", "--output",
        help="Output .md path (default: same directory as the PDF, .md extension).",
    )
    args = parser.parse_args()

    pdf_path = Path(args.pdf).expanduser().resolve()
    if not pdf_path.exists():
        print(f"[mythoi] File not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    output_path = (
        Path(args.output).expanduser().resolve()
        if args.output
        else pdf_path.with_suffix(".md")
    )

    extract(pdf_path, output_path)


if __name__ == "__main__":
    main()
