# mythoi

A City of Mist character-creation plugin for Claude Code (and reusable MCP server for Claude Desktop).

The plugin walks a player through CoM character creation conversationally — concept, awareness, themebook lineup, tag questions, Mystery/Identity, Title — then validates the resulting JSON against a schema and renders a printable HTML/PDF character sheet.

The data layer (themebook content, schema, rendering) is purely deterministic Python. The conversational layer is Claude, steered by a bundled skill. The two are joined by the `mythoi` MCP server.

## What's in here

```
mythoi/
├── .claude-plugin/
│   └── plugin.json                # Claude Code plugin manifest
├── .mcp.json                      # MCP server registration
├── commands/                      # Slash commands
│   ├── create-character.md        # /mythoi:create-character
│   ├── show-themebook.md          # /mythoi:show-themebook <name>
│   ├── render-character.md        # /mythoi:render-character <path> [sheet|cards]
│   └── validate-character.md      # /mythoi:validate-character <path>
├── skills/
│   └── create-character/
│       └── SKILL.md               # the conversational workflow
├── mythoi_mcp/                    # Python MCP server
│   ├── __main__.py
│   ├── server.py                  # FastMCP wiring
│   ├── tools.py                   # tool implementations
│   └── paths.py
├── data/
│   ├── themebooks/                # 18 themebook JSONs + schema
│   └── characters/                # character schema + sample characters
├── templates/                     # Jinja2 HTML templates for rendering
│   ├── character_sheet.html.j2
│   └── theme_cards.html.j2
├── scripts/                       # CLI entry points (also reused by MCP server)
│   ├── render_character_sheet.py
│   └── validate.py
├── out/                           # rendered HTML/PDF outputs
└── requirements.txt
```

## Install — Claude Code (recommended)

Requirements:
- Claude Code
- Python 3.10+ on `PATH`
- Google Chrome (for PDF rendering — purely optional)

### 1. Install the Python dependencies

```bash
pip install -r requirements.txt
```

### 2. Install the plugin

For now, install from a local clone:

```bash
git clone <this-repo> ~/code/mythoi
```

Then in Claude Code:

```
/plugin install ~/code/mythoi
```

Or launch Claude Code with the plugin pre-loaded:

```bash
claude --plugin-dir ~/code/mythoi
```

### 3. Use it

```
/mythoi:create-character
```

Claude will walk you through the whole character-creation flow. The character JSON gets saved to `~/.mythoi/characters/<name>.json` by default. You can also use:

- `/mythoi:show-themebook DIVINATION` — print a themebook in full
- `/mythoi:render-character ~/.mythoi/characters/foo.json cards` — render an existing character to printable cards
- `/mythoi:validate-character ~/.mythoi/characters/foo.json` — schema check

## Install — Claude Desktop (MCP only, no skills)

Claude Desktop doesn't run plugins, but you can register the same MCP server in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mythoi": {
      "command": "python3",
      "args": ["-m", "mythoi_mcp"],
      "env": {
        "PYTHONPATH": "/absolute/path/to/mythoi"
      }
    }
  }
}
```

Restart Claude Desktop and the eight Mythoi tools will be available in any chat. You won't get the conversational `/create-character` skill, but you can still ask Claude in plain language: *"Help me create a City of Mist character. Use the mythoi tools."*

## MCP tools exposed

| Tool | Purpose |
|---|---|
| `list_themebooks(type?)` | Browse the 18 themebooks (filterable by mythos/logos/crew/extra) |
| `get_themebook(name)` | Fetch a full themebook (description, all questions, examples, theme improvements) |
| `themebook_question(themebook, letter, kind?)` | Fetch one tag question + examples |
| `get_character_schema()` | Inspect the character JSON schema |
| `character_template()` | Get a blank character JSON skeleton |
| `validate_character(character)` | Schema validation, returns `{ok, errors[]}` |
| `save_character(character, path?)` | Write JSON (default `~/.mythoi/characters/<slug>.json`) |
| `load_character(path)` | Load a character JSON |
| `render_sheet(character, layout?, format?, output?)` | Render to HTML or PDF (`sheet` or `cards` layout) |
| `render_character_file(path, ...)` | Same as `render_sheet` but for a saved file |

## Customizing where characters are saved

The MCP server defaults to `~/.mythoi/characters/`. Override with the env var:

```
MYTHOI_CHARACTERS_DIR=/some/other/path
```

…in your shell, or add `"MYTHOI_CHARACTERS_DIR": "..."` to the `env` block of `.mcp.json` (or your `claude_desktop_config.json`).

## Working with the data directly

Even without the plugin, the bare repo is useful:

```bash
# Render any character file
python scripts/render_character_sheet.py data/characters/humphrey_chandler.json --pdf

# Validate everything
python scripts/validate.py
```

## Status

`v0.1.0` — character creation works end-to-end. Roadmap:

- `/level-up` — when Attention fills, browse improvements from the themebook and pick one
- `/replace-theme` — when Crack/Fade fills, walk through theme loss + Nemesis creation
- `/build-npc` — full NPC writeup with optional theme cards
- `/build-crew` — collaborative crew theme creation
- A web-based character builder (single static HTML, no install)
