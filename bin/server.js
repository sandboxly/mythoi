#!/usr/bin/env node
// Mythoi MCP server. Launched directly by .mcp.json:
//   command: "node"
//   args:    ["${CLAUDE_PLUGIN_ROOT}/bin/server.js"]
//
// node_modules is installed into ${CLAUDE_PLUGIN_DATA} by hooks/install.js,
// and a directory junction at ${CLAUDE_PLUGIN_ROOT}/node_modules points at it,
// so Node's resolver finds dependencies without any path tricks.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { listThemebooks, getThemebook, themebookQuestion, saveThemebook } from '../lib/themebooks.js';
import {
  getCharacterSchema, characterTemplate, validateCharacter,
  saveCharacter, loadCharacter,
} from '../lib/characters.js';
import { renderSheet } from '../lib/render.js';
import { extractPdfToMarkdown } from '../lib/extract.js';

const server = new McpServer({ name: 'mythoi', version: '0.2.0' });

// Helper: wrap a tool body so any thrown error becomes a structured MCP error.
function tool(name, config, handler) {
  server.registerTool(name, config, async (args) => {
    try {
      const result = await handler(args || {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e?.message || String(e)}` }], isError: true };
    }
  });
}

// ---- Themebook tools ----
tool('list_themebooks', {
  description: "List the available City of Mist themebooks. Optional filter by type ('mythos', 'logos', 'crew', 'extra').",
  inputSchema: { type: z.enum(['mythos', 'logos', 'crew', 'extra']).optional() },
}, ({ type }) => listThemebooks(type));

tool('get_themebook', {
  description: 'Return the full themebook JSON, including all tag questions and example tags.',
  inputSchema: { name: z.string() },
}, ({ name }) => getThemebook(name));

tool('themebook_question', {
  description: 'Return a single tag question (with example tags) from a themebook.',
  inputSchema: {
    themebook: z.string(),
    letter: z.string(),
    kind: z.enum(['power', 'weakness']).default('power'),
  },
}, ({ themebook, letter, kind }) => themebookQuestion(themebook, letter, kind || 'power'));

tool('save_themebook', {
  description: 'Validate and persist one themebook JSON to data/themebooks/<type>/<name>.json.',
  inputSchema: { themebook: z.record(z.string(), z.any()) },
}, ({ themebook }) => saveThemebook(themebook));

// ---- PDF extraction ----
tool('extract_pdf_to_markdown', {
  description: 'Convert a PDF to Markdown using mupdf.js (first step of themebook extraction).',
  inputSchema: {
    pdf_path: z.string(),
    output_path: z.string().optional(),
  },
}, ({ pdf_path, output_path }) => extractPdfToMarkdown(pdf_path, output_path));

// ---- Character tools ----
tool('get_character_schema', {
  description: 'Return the character JSON schema for inspection.',
  inputSchema: {},
}, () => getCharacterSchema());

tool('character_template', {
  description: 'Return a blank character JSON skeleton, ready to fill in.',
  inputSchema: {},
}, () => characterTemplate());

tool('validate_character', {
  description: 'Validate a character JSON object against the schema.',
  inputSchema: { character: z.record(z.string(), z.any()) },
}, ({ character }) => validateCharacter(character));

tool('save_character', {
  description: 'Save a character JSON to disk. Defaults to ~/.mythoi/characters/<slug>.json.',
  inputSchema: {
    character: z.record(z.string(), z.any()),
    path: z.string().optional(),
  },
}, ({ character, path }) => saveCharacter(character, path));

tool('load_character', {
  description: 'Load a character JSON from disk by path.',
  inputSchema: { path: z.string() },
}, ({ path }) => loadCharacter(path));

// ---- Render ----
tool('render_sheet', {
  description: "Render a character to a printable HTML (and optionally PDF) sheet. layout: 'sheet' or 'cards'. format: 'html' or 'pdf'.",
  inputSchema: {
    character: z.record(z.string(), z.any()),
    layout: z.enum(['sheet', 'cards']).default('sheet'),
    format: z.enum(['html', 'pdf']).default('html'),
    output: z.string().optional(),
  },
}, ({ character, layout, format, output }) =>
  renderSheet(character, { layout: layout || 'sheet', format: format || 'html', output })
);

tool('render_character_file', {
  description: 'Render an already-saved character file. Same options as render_sheet.',
  inputSchema: {
    path: z.string(),
    layout: z.enum(['sheet', 'cards']).default('sheet'),
    format: z.enum(['html', 'pdf']).default('html'),
    output: z.string().optional(),
  },
}, ({ path, layout, format, output }) =>
  renderSheet(path, { layout: layout || 'sheet', format: format || 'html', output })
);

const transport = new StdioServerTransport();
await server.connect(transport);
