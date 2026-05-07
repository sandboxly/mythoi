// Path resolution for the mythoi MCP server.
// Honors $CLAUDE_PLUGIN_ROOT when set; otherwise walks up from this file
// to find a directory containing data/themebooks/ (dev runs from a clone).

import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export function pluginRoot() {
  const env = process.env.CLAUDE_PLUGIN_ROOT;
  if (env) return path.resolve(env);

  let cur = here;
  for (let i = 0; i < 10; i++) {
    if (existsSync(path.join(cur, 'data', 'themebooks'))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return path.resolve(here, '..');
}

export function dataDir() {
  return process.env.CLAUDE_PLUGIN_DATA || path.join(os.homedir(), '.claude', 'plugins', 'data', 'mythoi-local');
}

export const themebooksDir       = () => path.join(pluginRoot(), 'data', 'themebooks');
export const themebookSchemaPath = () => path.join(themebooksDir(), 'themebook.schema.json');
export const characterSchemaPath = () => path.join(pluginRoot(), 'data', 'characters', 'character.schema.json');
export const templatesDir        = () => path.join(pluginRoot(), 'templates');

export function defaultCharacterDir() {
  const env = process.env.MYTHOI_CHARACTERS_DIR;
  if (env) return path.resolve(env.replace(/^~/, os.homedir()));
  return path.join(os.homedir(), '.mythoi', 'characters');
}
