// Themebook tools: list, fetch, fetch a single tag question, save (with validation).

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { pluginRoot, themebookSchemaPath, themebooksDir } from './paths.js';
import { slugify } from './util.js';

function walkJson(dir) {
  const out = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkJson(full));
    else if (name.endsWith('.json') && name !== 'themebook.schema.json') out.push(full);
  }
  return out;
}

function loadJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function allThemebookFiles() {
  return walkJson(themebooksDir()).sort();
}

function index() {
  const items = [];
  for (const file of allThemebookFiles()) {
    const tb = loadJson(file);
    const summary = (tb.description && tb.description[0]) ? tb.description[0].slice(0, 240) : '';
    items.push({
      name: tb.name,
      type: tb.type,
      categories: tb.categories || [],
      summary,
      file: path.relative(pluginRoot(), file),
    });
  }
  return items;
}

export function listThemebooks(type) {
  const items = index();
  if (!type) return items;
  return items.filter(i => i.type === type.toLowerCase());
}

function findByName(name) {
  const target = name.trim().toUpperCase();
  for (const file of allThemebookFiles()) {
    const tb = loadJson(file);
    if (tb.name.toUpperCase() === target) return tb;
  }
  throw new Error(`Themebook not found: ${JSON.stringify(name)}. Use list_themebooks() to browse.`);
}

export function getThemebook(name) {
  return findByName(name);
}

export function themebookQuestion(themebook, letter, kind = 'power') {
  if (kind !== 'power' && kind !== 'weakness') {
    throw new Error(`kind must be 'power' or 'weakness', got ${JSON.stringify(kind)}`);
  }
  const tb = findByName(themebook);
  const field = kind === 'power' ? 'power_tag_questions' : 'weakness_tag_questions';
  const target = letter.trim().toUpperCase();
  for (const q of tb[field] || []) {
    if ((q.letter || '').toUpperCase() === target) {
      return { themebook: tb.name, kind, ...q };
    }
  }
  throw new Error(`No ${kind} tag question ${JSON.stringify(target)} in themebook ${JSON.stringify(tb.name)}.`);
}

let _validator = null;
function themebookValidator() {
  if (_validator) return _validator;
  const schema = loadJson(themebookSchemaPath());
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats.default ? addFormats.default(ajv) : addFormats(ajv);
  _validator = ajv.compile(schema);
  return _validator;
}

export function saveThemebook(themebook) {
  const validate = themebookValidator();
  if (!validate(themebook)) {
    return { ok: false, errors: (validate.errors || []).map(e => `${e.instancePath || '<root>'}: ${e.message}`) };
  }
  const slug = slugify(themebook.name);
  const dest = path.join(themebooksDir(), themebook.type, `${slug}.json`);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(themebook, null, 2) + '\n');
  return { ok: true, path: dest };
}
