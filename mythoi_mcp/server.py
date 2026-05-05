"""FastMCP server wiring for Mythoi tools."""

from __future__ import annotations

from typing import Any, Optional

from mcp.server.fastmcp import FastMCP

from . import tools

mcp = FastMCP("mythoi")


@mcp.tool()
def list_themebooks(type: Optional[str] = None) -> list[dict[str, Any]]:
    """List the available City of Mist themebooks.

    Args:
        type: Optional filter — one of 'mythos', 'logos', 'crew', 'extra'.

    Returns:
        A list of {name, type, categories, summary, file} entries.
    """
    return tools.list_themebooks(type=type)


@mcp.tool()
def get_themebook(name: str) -> dict[str, Any]:
    """Return the full themebook JSON, including all tag questions and example tags.

    Args:
        name: The themebook name, case-insensitive (e.g. 'DIVINATION', 'Routine').
    """
    return tools.get_themebook(name)


@mcp.tool()
def themebook_question(themebook: str, letter: str, kind: str = "power") -> dict[str, Any]:
    """Return a single tag question (with example tags) from a themebook.

    Args:
        themebook: Themebook name (e.g. 'DIVINATION').
        letter: Question letter A-Z.
        kind: 'power' (default) or 'weakness'.
    """
    return tools.themebook_question(themebook, letter, kind)


@mcp.tool()
def get_character_schema() -> dict[str, Any]:
    """Return the character JSON schema for inspection."""
    return tools.get_character_schema()


@mcp.tool()
def character_template() -> dict[str, Any]:
    """Return a blank character JSON skeleton, ready to fill in."""
    return tools.character_template()


@mcp.tool()
def validate_character(character: dict[str, Any]) -> dict[str, Any]:
    """Validate a character JSON object against the schema.

    Returns:
        {"ok": bool, "errors": [{path, message}, ...]}
    """
    return tools.validate_character(character)


@mcp.tool()
def save_character(character: dict[str, Any], path: Optional[str] = None) -> dict[str, Any]:
    """Save a character JSON to disk.

    Args:
        character: The character object.
        path: Optional explicit path. Defaults to ``~/.mythoi/characters/<slug>.json``.

    Returns:
        {"path": str, "validation": {ok, errors}}
    """
    return tools.save_character(character, path=path)


@mcp.tool()
def load_character(path: str) -> dict[str, Any]:
    """Load a character JSON from disk by path."""
    return tools.load_character(path)


@mcp.tool()
def render_sheet(
    character: dict[str, Any],
    layout: str = "sheet",
    format: str = "html",
    output: Optional[str] = None,
) -> dict[str, Any]:
    """Render a character to a printable HTML (and optionally PDF) sheet.

    Args:
        character: The character object.
        layout: 'sheet' (full A4 portrait) or 'cards' (one theme per A5 landscape page).
        format: 'html' or 'pdf'. PDF requires Chrome installed locally.
        output: Optional explicit output path; otherwise a default path under ``out/`` is used.

    Returns:
        {"ok": bool, "paths": {"html": str, "pdf": str?}}
    """
    return tools.render_sheet(character, layout=layout, format=format, output=output)


@mcp.tool()
def render_character_file(
    path: str,
    layout: str = "sheet",
    format: str = "html",
    output: Optional[str] = None,
) -> dict[str, Any]:
    """Render an already-saved character file. Same options as ``render_sheet``."""
    return tools.render_sheet(path, layout=layout, format=format, output=output)


def main() -> None:
    """Entry point for ``python -m mythoi_mcp``."""
    mcp.run()


if __name__ == "__main__":
    main()
