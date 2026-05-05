---
description: Show a City of Mist themebook in full (concept, all questions with example tags, mystery/identity prompts, theme improvements).
argument-hint: "<themebook name>"
---

Use the mythoi MCP tool `get_themebook` to fetch the themebook named `$ARGUMENTS`. Render the result as a clean reference document for the user:

- Type, name, categories
- Description (paragraphs)
- Concept question + sentence starters
- All power tag questions with their example tags
- All weakness tag questions with their example tags
- Mystery/Identity examples and guidance options
- Title examples
- Crew relationships (if present)
- Theme improvements

If `$ARGUMENTS` is empty or doesn't match a known themebook, call `list_themebooks` first and present the catalog. Do not paraphrase question text — quote it exactly as the tool returns it.
