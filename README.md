# mythoi

A City of Mist character-creation plugin for Claude Code (and reusable MCP server for Claude Desktop).

The plugin walks a player through CoM character creation conversationally — concept, awareness, themebook lineup, tag questions, Mystery/Identity, Title — then validates the resulting JSON against a schema and renders a printable HTML/PDF character sheet.

The data layer (themebook content, schema, rendering) is purely deterministic Python. The conversational layer is Claude, steered by a bundled skill. The two are joined by the `mythoi` MCP server.

## What's in here

```
mythoi/
├── .claude-plugin/
│   ├── plugin.json                # Claude Code plugin manifest
│   └── marketplace.json           # single-plugin marketplace catalog
├── .mcp.json                      # MCP server registration
├── commands/                      # Slash commands
│   ├── create-character.md        # /mythoi:create-character
│   ├── extract-sourcebook.md      # /mythoi:extract-sourcebook <pdf>
│   ├── render-character.md        # /mythoi:render-character <path> [sheet|cards]
│   ├── show-themebook.md          # /mythoi:show-themebook <name>
│   └── validate-character.md      # /mythoi:validate-character <path>
├── skills/
│   ├── create-character/
│   │   └── SKILL.md               # conversational character creation
│   └── extract-sourcebook/
│       └── SKILL.md               # PDF → themebook JSON extraction
├── hooks/
│   ├── hooks.json                 # SessionStart → auto-install Python deps
│   └── install_deps.sh
├── mythoi_mcp/                    # Python MCP server
│   ├── __main__.py
│   ├── server.py                  # FastMCP wiring
│   ├── tools.py                   # tool implementations
│   └── paths.py
├── data/
│   ├── themebooks/                # themebook.schema.json (your extracted JSONs land here)
│   └── characters/                # character.schema.json
├── templates/                     # Jinja2 HTML templates for rendering
│   ├── character_sheet.html.j2
│   └── theme_cards.html.j2
├── scripts/                       # CLI entry points (also reused by MCP server)
│   ├── extract_sourcebook.py      # PDF → 18 themebook JSONs
│   ├── pdf2md.py                  # PDF → Markdown helper
│   ├── render_character_sheet.py
│   ├── validate.py                # validate a character file
│   └── validate_themebooks.py     # validate extracted themebooks against schema
└── requirements.txt
```

## Install — Claude Code (recommended)

Requirements on the user's machine:
- **Claude Code**
- **Python 3.10+ with pip** on `PATH` (default on most Macs / dev machines)
- **Google Chrome** — *optional*, only needed if you want PDF output. HTML rendering works without it.

### 1. Install the plugin

In Claude Code, add the marketplace and install:

```
/plugin marketplace add https://github.com/sandboxly/mythoi
/plugin install mythoi@mythoi
```

(For local development from a clone: `claude --plugin-dir ~/code/mythoi`.)

The first time the plugin is enabled, a **SessionStart hook** auto-installs the Python dependencies (`mcp`, `jsonschema`, `jinja2`, `pymupdf4llm`) into the plugin's persistent data directory — *not* into your global Python environment. There's nothing you need to `pip install` yourself. The first launch may take 10-20 seconds while pip runs; subsequent launches are instant.

If the auto-install ever fails (e.g. you're using a non-default Python), set `MYTHOI_PYTHON=/path/to/python3` in your shell or in `.mcp.json`'s `env` block.

### 2. Load your rulebook (one-time setup)

The plugin does not ship the City of Mist content (that's copyrighted). You need to supply your own copy of the **City of Mist Players Guide** PDF and extract the themebook data from it once:

```
/mythoi:extract-sourcebook ~/Downloads/city_of_mist_players_guide.pdf
```

Claude will convert the PDF to Markdown, parse all 18 themebooks, and save them as JSON into the plugin's `data/themebooks/` directory. This takes about a minute and only needs to happen once (or when you add a new supplement).

### 3. Use it

```
/mythoi:create-character
```

Claude will walk you through the whole character-creation flow. The character JSON gets saved to `~/.mythoi/characters/<name>.json` by default. You can also use:

- `/mythoi:show-themebook DIVINATION` — print a themebook in full
- `/mythoi:render-character ~/.mythoi/characters/foo.json cards` — render an existing character to printable cards
- `/mythoi:validate-character ~/.mythoi/characters/foo.json` — schema check

## Install — Claude Desktop (MCP only, no skills)

Claude Desktop doesn't run plugins (so no auto-install hook), but you can register the same MCP server manually. Install deps once:

```bash
pip install -r requirements.txt
```

Then add to `claude_desktop_config.json`:

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

Restart Claude Desktop and the ten Mythoi tools will be available in any chat. You won't get the conversational `/create-character` skill, but you can still ask Claude in plain language: *"Help me create a City of Mist character. Use the mythoi tools."*

## MCP tools exposed

| Tool | Purpose |
|---|---|
| `extract_pdf_to_markdown(pdf_path, output_path?)` | Convert a PDF to Markdown (first step of themebook extraction) |
| `save_themebook(themebook)` | Validate and save one parsed themebook JSON |
| `list_themebooks(type?)` | Browse the 18 themebooks (filterable by mythos/logos/crew/extra) |
| `get_themebook(name)` | Fetch a full themebook (description, all questions, examples, theme improvements) |
| `themebook_question(themebook, letter, kind?)` | Fetch one tag question + examples |
| `get_character_schema()` | Inspect the character JSON schema |
| `character_template()` | Get a blank character JSON skeleton |
| `validate_character(character)` | Schema validation, returns `{ok, errors[]}` |
| `save_character(character, path?)` | Write JSON (default `~/.mythoi/characters/<slug>.json`) |
| `load_character(path)` | Load a character JSON |
| `render_sheet(character, layout?, format?, output?)` | Render to HTML or PDF (`sheet` or `cards` layout). `character` accepts a JSON object or a path to a saved file. |

## Customizing where characters are saved

The MCP server defaults to `~/.mythoi/characters/`. Override with the env var:

```
MYTHOI_CHARACTERS_DIR=/some/other/path
```

…in your shell, or add `"MYTHOI_CHARACTERS_DIR": "..."` to the `env` block of `.mcp.json` (or your `claude_desktop_config.json`).

## Working with the data directly

Even without the plugin, the scripts are useful:

```bash
# Extract themebook data from your own PDF
python scripts/extract_sourcebook.py ~/Downloads/players_guide.pdf

# Render any character file
python scripts/render_character_sheet.py path/to/character.json --pdf

# Validate a character file against the schema
python scripts/validate.py path/to/character.json

# Validate all extracted themebooks against the themebook schema
python scripts/validate_themebooks.py
```

## Status

`v0.1.0` — character creation works end-to-end. Roadmap:

- `/level-up` — when Attention fills, browse improvements from the themebook and pick one
- `/replace-theme` — when Crack/Fade fills, walk through theme loss + Nemesis creation
- `/build-npc` — full NPC writeup with optional theme cards
- `/build-crew` — collaborative crew theme creation
- A web-based character builder (single static HTML, no install)
