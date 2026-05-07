#!/usr/bin/env node
// Cross-platform SessionStart install hook for the mythoi plugin.
//
// Mirrors the npm-install pattern documented for plugin SessionStart hooks:
//   1. If $CLAUDE_PLUGIN_DATA/package.json differs from the bundled one,
//      copy it over and run `npm install --omit=dev` inside the data dir.
//   2. Ensure $CLAUDE_PLUGIN_ROOT/node_modules points at
//      $CLAUDE_PLUGIN_DATA/node_modules (symlink on Unix, junction on Windows)
//      so the MCP server's ESM resolver can find deps without env tricks.
//
// Idempotent: subsequent runs with an unchanged package.json are no-ops.
// Cross-platform: pure Node, no shell dependency, no bash on Windows.

import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, unlinkSync, rmSync, readlinkSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
const dataDir    = process.env.CLAUDE_PLUGIN_DATA;

if (!pluginRoot) { fail('CLAUDE_PLUGIN_ROOT is not set; cannot locate plugin files.'); }
if (!dataDir)    { fail('CLAUDE_PLUGIN_DATA is not set; cannot locate install target.'); }

mkdirSync(dataDir, { recursive: true });
const logPath = path.join(dataDir, 'install.log');

function log(msg) {
  const stamp = new Date().toISOString();
  try { writeFileSync(logPath, `[${stamp}] ${msg}\n`, { flag: 'a' }); } catch {}
  process.stderr.write(`[mythoi] ${msg}\n`);
}

function fail(msg) {
  process.stderr.write(`[mythoi] ${msg}\n`);
  process.exit(1);
}

const srcPkg  = path.join(pluginRoot, 'package.json');
const destPkg = path.join(dataDir, 'package.json');
const sentinel = path.join(dataDir, '.installed');

if (!existsSync(srcPkg)) fail(`Bundled package.json not found at ${srcPkg}`);

const srcText = readFileSync(srcPkg, 'utf8');
const destText = existsSync(destPkg) ? readFileSync(destPkg, 'utf8') : '';

const dataNodeModules = path.join(dataDir, 'node_modules');
const linkTarget      = path.join(pluginRoot, 'node_modules');

function ensureLink() {
  // Make ${CLAUDE_PLUGIN_ROOT}/node_modules point at ${CLAUDE_PLUGIN_DATA}/node_modules.
  // - On Unix: symlink to absolute path.
  // - On Windows: directory junction (no admin / Developer Mode required).
  let needLink = true;
  try {
    const st = lstatSync(linkTarget);
    if (st.isSymbolicLink()) {
      try {
        const cur = readlinkSync(linkTarget);
        const resolved = path.isAbsolute(cur) ? cur : path.resolve(pluginRoot, cur);
        if (path.resolve(resolved) === path.resolve(dataNodeModules)) needLink = false;
      } catch { /* fall through and recreate */ }
    } else if (st.isDirectory() && process.platform === 'win32') {
      // Windows junctions report as directory; trust if exists for now.
      needLink = false;
    }
    if (needLink) {
      try { rmSync(linkTarget, { recursive: true, force: true }); } catch {}
    }
  } catch { /* doesn't exist; will create */ }

  if (needLink) {
    try {
      mkdirSync(dataNodeModules, { recursive: true });
      const type = process.platform === 'win32' ? 'junction' : 'dir';
      symlinkSync(dataNodeModules, linkTarget, type);
    } catch (e) {
      fail(`Could not link ${linkTarget} -> ${dataNodeModules}: ${e?.message || e}`);
    }
  }
}

const requirementsUnchanged = srcText === destText
  && existsSync(sentinel)
  && existsSync(path.join(dataNodeModules, '@modelcontextprotocol', 'sdk', 'package.json'))
  && existsSync(path.join(dataNodeModules, 'mupdf', 'package.json'));

if (requirementsUnchanged) {
  ensureLink();
  log('Dependencies already up-to-date.');
  process.exit(0);
}

// Stage the package.json into the data dir, then npm install in-place.
copyFileSync(srcPkg, destPkg);

const lockSrc  = path.join(pluginRoot, 'package-lock.json');
const lockDest = path.join(dataDir, 'package-lock.json');
if (existsSync(lockSrc)) {
  copyFileSync(lockSrc, lockDest);
}

log(`Installing Node dependencies into ${dataNodeModules} (this may take 30-90s on first run) …`);

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npmCmd, ['install', '--omit=dev', '--no-audit', '--no-fund'], {
  cwd: dataDir,
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  // On failure: dump pip-style helpful tail and remove the staged manifest so
  // the next session retries (matches the documented npm-install hook pattern).
  log(`npm install failed (exit ${result.status}).`);
  const tail = (text) => (text || '').split('\n').slice(-30).map(l => `  | ${l}`).join('\n');
  if (result.stdout) process.stderr.write(tail(result.stdout) + '\n');
  if (result.stderr) process.stderr.write(tail(result.stderr) + '\n');
  try { unlinkSync(destPkg); } catch {}
  process.exit(1);
}

writeFileSync(sentinel, srcText);
ensureLink();
log('Dependencies installed.');
