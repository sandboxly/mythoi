---
name: extract-sourcebook
description: Extract City of Mist themebook data from a user-supplied PDF (Players Guide or supplement) and save it as JSON files. Use when the user runs /mythoi:extract-sourcebook with a PDF path.
---

# /extract-sourcebook — Extract themebook data from a PDF

You are extracting City of Mist themebook data from a user-supplied PDF. The result will be 18 JSON files (one per themebook) saved into the plugin's `data/themebooks/` directory so all other plugin features work.

Work methodically. Read the markdown in sections; don't try to process the whole thing in one go.

## Tools available

| Tool | Use it for |
|---|---|
| `extract_pdf_to_markdown(pdf_path)` | Convert the PDF to a Markdown file. Returns `{ok, markdown_path}`. |
| `save_themebook(themebook)` | Validate and save one themebook JSON. Returns `{ok, path}` or `{ok: false, errors}`. |
| `list_themebooks()` | Check how many themebooks are already saved. |
| Read tool | Read the extracted Markdown file in chunks (use `offset` and `limit` as needed). |

---

## Step 1 — Extract the PDF

Call `extract_pdf_to_markdown` with the path provided by the user. Note the `markdown_path` in the result.

Let the user know extraction is running — it may take 10–30 seconds for a large PDF.

---

## Step 2 — Find the themebook chapters

Read the markdown file. The Players Guide covers these 18 themebooks:

**Mythos (7):** ADAPTATION · BASTION · DIVINATION · EXPRESSION · MOBILITY · RELIC · SUBVERSION  
**Logos (7):** DEFINING EVENT · DEFINING RELATIONSHIP · MISSION · PERSONALITY · POSSESSIONS · ROUTINE · TRAINING  
**Crew (1):** THE CREW THEMEBOOK  
**Extra (3):** ALLY · BASE OF OPERATIONS · RIDE

Each section opens with the themebook name as an all-caps heading, followed by category bullets, a description, and structured subsections (CONCEPT, POWER TAG QUESTIONS, WEAKNESS TAG QUESTIONS, EXTRA TAGS, MYSTERY/IDENTITY, TITLE, CREW RELATIONSHIPS, THEME IMPROVEMENTS).

Read in chunks as needed — don't try to load the whole file at once.

---

## Step 3 — Extract and save each themebook

For each of the 18 themebooks, build a JSON object and call `save_themebook`. Process them one at a time and report progress as you go.

### JSON structure

```json
{
  "type": "mythos",
  "name": "ADAPTATION",
  "categories": ["A WIDE RANGE OF POWERS", "SHAPESHIFTING", "..."],
  "description": ["Mortal life is in a constant state of flux...", "..."],
  "concept": {
    "main_question": "HOW DOES YOUR MYTHOS ADAPT TO THE CIRCUMSTANCES?",
    "sentence_starters": ["It has a range/collection/set of ___."],
    "follow_up": ["Think about your Mythos. In the legend..."]
  },
  "power_tag_questions": [
    {
      "letter": "A",
      "question": "WHAT MYTHOS POWER ALLOWS YOU TO RESPOND DIFFERENTLY TO EVERY SITUATION?",
      "examples": ["cast a magic spell", "shapeshifting", "steal other people's powers"]
    }
  ],
  "weakness_tag_questions": [
    {
      "letter": "A",
      "question": "WHAT ARE YOUR POWERS OF ADAPTIVITY DEPENDENT ON?",
      "examples": ["only works with a magic wand", "needs moisture in the air"]
    }
  ],
  "mystery_or_identity": {
    "kind": "mystery",
    "examples": [
      { "context": "Merlin", "text": "Where is the Holy Grail now?" }
    ],
    "guidance_options": ["Philosophical questions about the nature of your powers"]
  },
  "title": {
    "instructions": "Name your theme in a way that encapsulates its nature and style.",
    "examples": [
      { "context": "Merlin", "text": "Wizard & Guide" }
    ]
  },
  "crew_relationships": [
    "One of them once challenged you to push the boundaries..."
  ],
  "theme_improvements": [
    { "name": "Game Changer", "description": "When you Change the Game with power tags from this theme, it's Dynamite!" }
  ]
}
```

### Type mapping

| Themebook type | `"type"` value | `mystery_or_identity.kind` |
|---|---|---|
| Mythos | `"mythos"` | `"mystery"` |
| Logos | `"logos"` | `"identity"` |
| Crew | `"crew"` | `"either"` |
| Extra (Ally, Base of Ops, Ride) | `"extra"` | `"either"` |

### Parsing tips

- **Examples** appear italicised in the markdown as `*example one, example two*`. Strip the asterisks and split on `, ` to get the examples array.
- **Mythos sections** may have fragmented lines caused by the PDF's two-column layout. Where a question or sentence is obviously cut off, reconstruct it from context. Mark reconstructed text with `"truncated": true` on the question object.
- **Power tag questions** run A–J; the first (A) is mandatory for players.
- **Weakness tag questions** run A–D; players choose one.
- **Concept sentence starters** are the `•  It has a range of ___` bullet lines under the concept question.
- **Theme improvements** each have a bold name and a prose description — capture both.
- **Categories** are the short bullets (like `SHAPESHIFTING · BROAD POWERS · VERSATILE FORMS`) printed under the themebook name.

---

## Step 4 — Validate

After saving all themebooks, call `list_themebooks()`. Report:
- Total saved (target: 18)
- Any that failed validation, with the error
- Any that may need manual review (e.g. `"truncated": true` on any questions)

If fewer than 18 were found in the PDF, tell the user which ones are missing and that they may be in a different supplement.
