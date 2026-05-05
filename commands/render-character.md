---
description: Render a saved City of Mist character JSON to a printable HTML and PDF sheet.
argument-hint: "<path-to-character.json> [sheet|cards]"
---

Render the character file at the path given by `$ARGUMENTS`. The first argument is the path; the optional second argument is the layout (`sheet` or `cards`, default `sheet`).

Use the mythoi MCP tool `render_character_file` with `format='pdf'` so both HTML and PDF are produced. Report the output file paths to the user. If the path doesn't exist or isn't a valid character, call `validate_character` after `load_character` and surface any errors clearly before rendering.
