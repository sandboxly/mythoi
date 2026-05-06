---
description: Extract City of Mist themebook data from the Players Guide PDF. Usage: /mythoi:extract-sourcebook ~/Downloads/city_of_mist_players_guide.pdf
---

Invoke the `extract-sourcebook` skill from the mythoi plugin to convert the provided PDF into themebook JSON files. The skill will:

1. Run `extract_pdf_to_markdown` on the file path given as the argument to this command.
2. Read the resulting Markdown file and parse each of the 18 standard City of Mist themebooks.
3. Save them using `save_themebook` into the plugin's `data/themebooks/` directory.
4. Report the final count and flag anything that needs manual review.

The PDF argument is: $ARGUMENTS
