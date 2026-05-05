"""Path resolution for the Mythoi MCP server.

When the server runs inside a Claude Code plugin, ``CLAUDE_PLUGIN_ROOT`` is set
to the plugin's root directory and we read bundled resources (themebooks,
templates) from there. Otherwise we fall back to discovering the repository
that contains this package — useful for local development and ad-hoc runs from
Claude Desktop.

Character files default to ``~/.mythoi/characters/`` so the MCP server doesn't
write into the user's repo. The default can be overridden per call by passing
an explicit ``path``.
"""

from __future__ import annotations

import os
from pathlib import Path


def plugin_root() -> Path:
    """Return the directory holding bundled resources (themebooks, templates).

    Honors ``CLAUDE_PLUGIN_ROOT`` when set; otherwise walks up from this file
    to find a directory containing ``data/themebooks/`` (the canonical signal
    that we're inside the source repo).
    """
    env = os.environ.get("CLAUDE_PLUGIN_ROOT")
    if env:
        return Path(env).resolve()

    here = Path(__file__).resolve()
    for candidate in [here.parent, *here.parents]:
        if (candidate / "data" / "themebooks").is_dir():
            return candidate
    # Last resort: this file's grandparent.
    return here.parent.parent


def themebooks_dir() -> Path:
    return plugin_root() / "data" / "themebooks"


def themebook_schema_path() -> Path:
    return themebooks_dir() / "themebook.schema.json"


def character_schema_path() -> Path:
    return plugin_root() / "data" / "characters" / "character.schema.json"


def templates_dir() -> Path:
    return plugin_root() / "templates"


def render_script() -> Path:
    return plugin_root() / "scripts" / "render_character_sheet.py"


def default_character_dir() -> Path:
    """Where new character files go by default. Lives in user-space, not the repo."""
    env = os.environ.get("MYTHOI_CHARACTERS_DIR")
    if env:
        return Path(env).expanduser().resolve()
    return Path.home() / ".mythoi" / "characters"
