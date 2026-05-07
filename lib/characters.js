// Character tools: schema, blank template, validate, save, load.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { characterSchemaPath, defaultCharacterDir } from './paths.js';
import { slugify } from './util.js';

let _schema = null;
let _validator = null;

function characterSchema() {
  if (_schema) return _schema;
  _schema = JSON.parse(readFileSync(characterSchemaPath(), 'utf8'));
  return _schema;
}

function characterValidator() {
  if (_validator) return _validator;
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats.default ? addFormats.default(ajv) : addFormats(ajv);
  _validator = ajv.compile(characterSchema());
  return _validator;
}

export function getCharacterSchema() {
  return characterSchema();
}

export function characterTemplate() {
  return {
    "$schema": "./character.schema.json",
    name: "",
    pronouns: "",
    concept: {
      mythos: "",
      mythos_description: "",
      logos: "",
      logos_description: "",
    },
    awareness: 1,
    character_class: "touched",
    setting: "",
    themes: [],
    crew_theme: null,
    story_tags: [],
    statuses: [],
    help_points: [],
    hurt_points: [],
    juice: 0,
    build_up: 0,
    nemeses: [],
    secondary_characters: [],
    moments_of_evolution: [],
    connections: [],
    notes: "",
    metadata: {},
  };
}

export function validateCharacter(character) {
  const validate = characterValidator();
  const ok = validate(character);
  const errors = (validate.errors || []).map(e => ({
    path: e.instancePath || '<root>',
    message: e.message || 'invalid',
  }));
  errors.sort((a, b) => a.path.localeCompare(b.path));
  return { ok: !!ok, errors };
}

export function saveCharacter(character, explicitPath) {
  const validation = validateCharacter(character);
  let target;
  if (explicitPath) {
    target = path.resolve(explicitPath.replace(/^~/, process.env.HOME || ''));
    mkdirSync(path.dirname(target), { recursive: true });
  } else {
    const dir = defaultCharacterDir();
    mkdirSync(dir, { recursive: true });
    target = path.join(dir, `${slugify(character.name || 'character')}.json`);
  }
  writeFileSync(target, JSON.stringify(character, null, 2) + '\n');
  return { path: target, validation };
}

export function loadCharacter(p) {
  return JSON.parse(readFileSync(p.replace(/^~/, process.env.HOME || ''), 'utf8'));
}
