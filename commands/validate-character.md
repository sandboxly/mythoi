---
description: Validate a City of Mist character JSON file against the schema.
argument-hint: "<path-to-character.json>"
---

Use the mythoi MCP tool `load_character` on the path in `$ARGUMENTS`, then call `validate_character` on the result. Report `ok: true` cleanly if the character validates. Otherwise present each error with its `path` and `message`, in a numbered list, and suggest concrete fixes if the error is obvious (missing required field, wrong enum value, etc.).
