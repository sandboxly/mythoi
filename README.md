# mythoi

A City of Mist character-creation plugin for Claude Code.

The plugin walks a player through CoM character creation conversationally — concept, awareness, themebook lineup, tag questions, Mystery/Identity, Title — then validates the resulting JSON against a schema and renders a printable HTML/PDF character sheet.

The data layer (themebook content, schema, rendering, PDF extraction) is deterministic JavaScript running on the Node runtime that Claude Code already ships with. The conversational layer is Claude, steered by a bundled skill. The two are joined by the `mythoi` MCP server.

**Cross-platform**: works identically on macOS, Linux, and Windows. No Python, no shell shims, no `bash` requirement.

## What's in here

```
mythoi/
├── .claude-plugin/
│   ├── plugin.json                # Claude Code plugin manifest
│   └── marketplace.json           # single-plugin marketplace catalog
├── .mcp.json                      # MCP server registration (just `node bin/server.js`)
├── package.json                   # Node dependencies (installed at SessionStart)
├── commands/                      # Slash commands
│   ├── create-character.md        # /mythoi:create-character
│   ├── extract-sourcebook.md      # /mythoi:extract-sourcebook <pdf>
│   ├── render-character.md        # /mythoi:render-character <path> [sheet|cards]
│   ├── show-themebook.md          # /mythoi:show-themebook <name>
│   └── validate-character.md      # /mythoi:validate-character <path>
├── skills/
│   ├── create-character/SKILL.md  # conversational character creation
│   └── extract-sourcebook/SKILL.md# PDF → themebook JSON extraction
├── bin/
│   ├── server.js                  # MCP server entrypoint
│   └── install.js                 # SessionStart hook: cross-platform npm install
├── hooks/
│   └── hooks.json                 # SessionStart → node bin/install.js
├── lib/                           # Tool implementations
│   ├── paths.js                   # plugin-root / data-dir / template paths
│   ├── themebooks.js              # list / get / question / save
│   ├── characters.js              # schema / template / validate / save / load
│   ├── render.js                  # Nunjucks + headless Chrome PDF
│   ├── extract.js                 # PDF → Markdown via mupdf.js
│   └── util.js
├── templates/                     # Nunjucks HTML templates for rendering
│   ├── character_sheet.html.njk
│   └── theme_cards.html.njk
├── data/
│   ├── themebooks/                # themebook.schema.json (extracted JSONs land here)
│   └── characters/                # character.schema.json
└── tests/
    └── bootstrap_test.js          # phased install/launch smoke test
```

## Install — Claude Code

Requirements on the user's machine:
- **Claude Code** (it ships with the Node runtime the plugin uses)
- **Google Chrome** — *optional*, only needed if you want PDF output. HTML rendering works without it.

That's it. No Python, no manual `npm install`, no shell setup.

### 1. Install the plugin

In Claude Code, add the marketplace and install:

```
/plugin marketplace add https://github.com/sandboxly/mythoi
/plugin install mythoi@mythoi
```

(For local development from a clone: `claude --plugin-dir ~/code/mythoi`.)

The first time the plugin is enabled, a **SessionStart hook** runs `node bin/install.js` which installs the plugin's Node dependencies (`@modelcontextprotocol/sdk`, `mupdf`, `nunjucks`, `ajv`, `zod`) into `$CLAUDE_PLUGIN_DATA/node_modules` — *not* into your global Node environment, your project, or anywhere else outside the plugin's persistent data directory. The first launch may take 30-90 seconds while npm runs; subsequent launches are instant.

A timestamped install log is written to `$CLAUDE_PLUGIN_DATA/install.log` for debugging.

### 2. Load your rulebook (one-time setup)

The plugin does not ship the City of Mist content (that's copyrighted). You need to supply your own copy of the **City of Mist Players Guide** PDF and extract the themebook data from it once:

```
/mythoi:extract-sourcebook ~/Downloads/city_of_mist_players_guide.pdf
```

Claude will convert the PDF to Markdown using `mupdf.js`, parse all 18 themebooks, and save them as JSON into the plugin's `data/themebooks/` directory. This takes about a minute and only needs to happen once (or when you add a new supplement).

### 3. Use it

```
/mythoi:create-character
```

Claude will walk you through the whole character-creation flow. The character JSON gets saved to `~/.mythoi/characters/<name>.json` by default. You can also use:

- `/mythoi:show-themebook DIVINATION` — print a themebook in full
- `/mythoi:render-character ~/.mythoi/characters/foo.json cards` — render an existing character to printable cards
- `/mythoi:validate-character ~/.mythoi/characters/foo.json` — schema check

## MCP tools exposed

| Tool | Purpose |
|---|---|
| `extract_pdf_to_markdown(pdf_path, output_path?)` | Convert a PDF to Markdown via mupdf.js (first step of themebook extraction) |
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

…in your shell, or add `"MYTHOI_CHARACTERS_DIR": "..."` to the `env` block of `.mcp.json`.

## Development

To verify the install + launch path:

```bash
node tests/bootstrap_test.js
```

This wipes a temporary `$CLAUDE_PLUGIN_DATA`, runs the install hook, smoke-imports every tool module, calls a representative tool from each, checks idempotency on a second run, and boots the MCP server under stdio to confirm it starts cleanly. The same test runs unchanged on macOS, Linux, and Windows.

## License

**AGPL-3.0-or-later.**

The plugin uses `mupdf.js` for PDF extraction (the only Node library that matches PyMuPDF/pymupdf4llm-grade quality, which is what the previous Python implementation used). `mupdf.js` is published under AGPL-3.0 by Artifex Software, so this plugin must be AGPL-licensed too. If you want to use mythoi's code in a non-AGPL project, replace the PDF extraction with a permissively-licensed alternative — but expect quality to drop on multi-column / italic-heavy PDFs.

The full AGPL-3.0 text is in [`LICENSE`](LICENSE).

## Status

`v0.2.0` — full Node port for cross-platform support. Roadmap:

- `/level-up` — when Attention fills, browse improvements from the themebook and pick one
- `/replace-theme` — when Crack/Fade fills, walk through theme loss + Nemesis creation
- `/build-npc` — full NPC writeup with optional theme cards
- `/build-crew` — collaborative crew theme creation
- A web-based character builder (single static HTML, no install)
