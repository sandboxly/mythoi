#!/usr/bin/env python3
"""Render a character JSON into a printable HTML (and optionally PDF) character sheet.

Usage:
    python scripts/render_character_sheet.py <character.json> [--cards] [--pdf] [-o out/file]

Templates:
    --sheet (default): full sheet on A4 portrait, 2x2 theme grid + footer
    --cards          : one theme per page on A5 landscape (CoM-style theme cards)

PDF generation:
    --pdf            : also write a PDF beside the HTML using headless Chrome
                       (requires Google Chrome installed; no extra Python deps)
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import jinja2

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = ROOT / "templates"
DEFAULT_OUT_DIR = ROOT / "out"

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
]


def slugify(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", name).strip("_").lower()
    return s or "character"


def render(character: dict, template_path: Path) -> str:
    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(str(template_path.parent)),
        autoescape=jinja2.select_autoescape(["html", "j2"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    template = env.get_template(template_path.name)
    return template.render(character=character)


def find_chrome() -> str | None:
    for p in CHROME_CANDIDATES:
        if Path(p).exists():
            return p
    return shutil.which("chromium") or shutil.which("google-chrome") or shutil.which("chrome")


def html_to_pdf(html_path: Path, pdf_path: Path) -> None:
    chrome = find_chrome()
    if not chrome:
        raise RuntimeError(
            "No Chrome/Chromium-family browser found. Install Google Chrome or "
            "open the HTML in your browser and use ⌘P → Save as PDF."
        )
    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path}",
        html_path.absolute().as_uri(),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 or not pdf_path.exists():
        raise RuntimeError(
            f"Chrome PDF conversion failed (exit {result.returncode}).\n"
            f"stderr:\n{result.stderr}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("character", type=Path, help="Path to character JSON")
    parser.add_argument("-o", "--output", type=Path, default=None, help="Output HTML path")
    parser.add_argument("-t", "--template", type=Path, default=None, help="Override template path")
    parser.add_argument(
        "--cards",
        action="store_true",
        help="Use the one-theme-per-page (theme card) template instead of the full sheet",
    )
    parser.add_argument("--pdf", action="store_true", help="Also write a PDF using headless Chrome")
    args = parser.parse_args()

    if not args.character.exists():
        print(f"Character file not found: {args.character}", file=sys.stderr)
        return 2

    character = json.loads(args.character.read_text())

    if args.template is None:
        args.template = TEMPLATES_DIR / ("theme_cards.html.j2" if args.cards else "character_sheet.html.j2")

    if args.output is None:
        DEFAULT_OUT_DIR.mkdir(parents=True, exist_ok=True)
        suffix = "_cards" if args.cards else ""
        args.output = DEFAULT_OUT_DIR / f"{slugify(character.get('name', 'character'))}{suffix}.html"

    args.output.parent.mkdir(parents=True, exist_ok=True)
    html = render(character, args.template)
    args.output.write_text(html)
    print(f"Wrote HTML: {args.output.relative_to(ROOT) if args.output.is_relative_to(ROOT) else args.output}")

    if args.pdf:
        pdf_path = args.output.with_suffix(".pdf")
        html_to_pdf(args.output, pdf_path)
        print(f"Wrote PDF:  {pdf_path.relative_to(ROOT) if pdf_path.is_relative_to(ROOT) else pdf_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
