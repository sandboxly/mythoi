#!/usr/bin/env node
// Bootstrap test for the mythoi plugin's install + launch path.
//
// Runs against a temp $CLAUDE_PLUGIN_DATA so the user's installed plugin data
// is untouched. Each phase prints a coloured PASS/FAIL line; the script exits
// with non-zero if any phase fails.
//
// Phases:
//   A. Happy path: install hook from a clean data dir succeeds, sentinel +
//      symlink exist, dependencies are present.
//   B. Smoke import: load every lib module via the installed tree and call a
//      representative tool from each.
//   C. Idempotency: a second install run is a no-op (no npm spawn).
//   D. Launcher boot: bin/server.js starts under stdio, exits cleanly when
//      stdin closes, no stack trace in stderr.

import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(here, '..');

// Copy the plugin into a temp directory so the install hook's
// `${CLAUDE_PLUGIN_ROOT}/node_modules` symlink doesn't pollute the dev tree.
function copyPlugin() {
  const dst = mkdtempSync(path.join(os.tmpdir(), 'mythoi-root-'));
  const items = ['bin', 'lib', 'templates', 'data', 'hooks', 'commands', 'skills', '.claude-plugin', '.mcp.json', 'package.json', 'package-lock.json'];
  for (const item of items) {
    const src = path.join(SRC_ROOT, item);
    if (!existsSync(src)) continue;
    cpSync(src, path.join(dst, item), { recursive: true });
  }
  return dst;
}

const ROOT = copyPlugin();

let pass = 0, fail = 0;

const C = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red:   (s) => `\x1b[31m${s}\x1b[0m`,
  bold:  (s) => `\x1b[1m${s}\x1b[0m`,
};

function ok(msg)   { console.log(`  ${C.green('PASS')} ${msg}`); pass++; }
function bad(msg)  { console.log(`  ${C.red('FAIL')} ${msg}`); fail++; }
function hdr(msg)  { console.log(`\n${C.bold('== ' + msg + ' ==')}`); }

function tmpDir(prefix) {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runInstall(env) {
  return spawnSync(process.execPath, [path.join(ROOT, 'bin', 'install.js')], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

const dataDir = tmpDir('mythoi-bootstrap-');
const baseEnv = { CLAUDE_PLUGIN_ROOT: ROOT, CLAUDE_PLUGIN_DATA: dataDir };

let allFail = false;
try {
  // ----------------------------------------------------------------
  hdr('Phase A — install hook on a clean data dir');
  const r1 = runInstall(baseEnv);
  if (r1.status === 0) ok('install.js exited 0');
  else { bad(`install.js exited ${r1.status}`); console.log(r1.stderr); }

  if (existsSync(path.join(dataDir, '.installed'))) ok('.installed sentinel written');
  else bad('.installed sentinel missing');

  if (existsSync(path.join(dataDir, 'node_modules', '@modelcontextprotocol', 'sdk', 'package.json'))) {
    ok('@modelcontextprotocol/sdk installed');
  } else bad('@modelcontextprotocol/sdk missing');

  if (existsSync(path.join(dataDir, 'node_modules', 'mupdf', 'package.json'))) ok('mupdf installed');
  else bad('mupdf missing');

  const linkPath = path.join(ROOT, 'node_modules');
  try {
    const st = lstatSync(linkPath);
    if (st.isSymbolicLink() || st.isDirectory()) ok(`${linkPath} exists (link or junction)`);
    else bad(`${linkPath} is neither symlink nor directory`);
  } catch (e) {
    bad(`${linkPath} not present: ${e.message}`);
  }

  // ----------------------------------------------------------------
  hdr('Phase B — smoke import + representative tool calls');
  const smokeCmd = `
    import('${pathToImportSpec(ROOT)}/lib/themebooks.js').then(m => {
      const list = m.listThemebooks();
      if (!Array.isArray(list)) throw new Error('listThemebooks did not return array');
      console.log('LIST_OK', list.length);
    }).then(() => import('${pathToImportSpec(ROOT)}/lib/characters.js')).then(m => {
      const tmpl = m.characterTemplate();
      if (typeof tmpl !== 'object') throw new Error('template not an object');
      const v = m.validateCharacter(tmpl);
      if (v.ok !== false) throw new Error('blank template should not validate');
      console.log('VALIDATE_OK');
    }).then(() => import('${pathToImportSpec(ROOT)}/lib/render.js')).then(m => {
      const ch = { name: 'Smoke', concept: { mythos:'m', logos:'l' }, awareness: 1, character_class:'touched', themes:[{type:'mythos',title:'T',themebook:'D',power_tags:[],weakness_tags:[],mystery_or_identity:{kind:'mystery',text:'q'},attention:0,fade_or_crack:0}], story_tags:[], statuses:[], help_points:[], hurt_points:[], juice:0, build_up:0, nemeses:[], secondary_characters:[], moments_of_evolution:[], connections:[], notes:'', metadata:{} };
      const r = m.renderSheet(ch, { layout:'sheet', format:'html', output: '${path.join(dataDir, 'smoke.html').replace(/\\/g,'\\\\')}' });
      if (!r.ok) throw new Error('renderSheet failed');
      console.log('RENDER_OK');
    }).catch(e => { console.error('SMOKE_ERR', e.message); process.exit(1); });
  `;
  const r2 = spawnSync(process.execPath, ['--input-type=module', '-e', smokeCmd], {
    env: { ...process.env, ...baseEnv },
    encoding: 'utf8',
  });
  if (r2.status === 0 && /LIST_OK/.test(r2.stdout) && /VALIDATE_OK/.test(r2.stdout) && /RENDER_OK/.test(r2.stdout)) {
    ok('listThemebooks + validate_character + render_sheet all worked');
  } else {
    bad(`smoke import/run failed (exit ${r2.status})`);
    console.log('  stdout:', r2.stdout);
    console.log('  stderr:', r2.stderr);
  }

  // ----------------------------------------------------------------
  hdr('Phase C — idempotency: second run is a no-op');
  const sdkBefore = statSync(path.join(dataDir, 'node_modules', '@modelcontextprotocol', 'sdk', 'package.json')).mtimeMs;
  const r3 = runInstall(baseEnv);
  if (r3.status === 0) ok('second install.js exited 0');
  else { bad(`second install.js exited ${r3.status}`); console.log(r3.stderr); }
  if (/already up-to-date/i.test(r3.stderr)) ok('stderr reports already-up-to-date');
  else bad('stderr did not say already-up-to-date');
  const sdkAfter = statSync(path.join(dataDir, 'node_modules', '@modelcontextprotocol', 'sdk', 'package.json')).mtimeMs;
  if (sdkBefore === sdkAfter) ok('sdk package.json mtime unchanged (npm not re-invoked)');
  else bad(`sdk mtime changed (before=${sdkBefore} after=${sdkAfter})`);

  // ----------------------------------------------------------------
  hdr('Phase D — launcher boots cleanly under stdio');
  const launchErr = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'bin', 'server.js')], {
      env: { ...process.env, ...baseEnv },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let err = '';
    child.stderr.on('data', (d) => { err += d.toString(); });
    setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 200);
    }, 800);
    child.on('exit', () => resolve(err));
    child.on('error', (e) => resolve(`(spawn error: ${e.message})`));
  });

  if (!/Error:|TypeError:|ModuleNotFoundError|Cannot find/.test(launchErr)) ok('no errors in launcher stderr');
  else { bad('launcher stderr contained errors:'); console.log(launchErr.split('\n').map(l => `    | ${l}`).join('\n')); }
  if (!/\$\{CLAUDE_PLUGIN/.test(launchErr)) ok('no unexpanded ${CLAUDE_PLUGIN_*} placeholders');
  else bad('launcher stderr contained unexpanded ${CLAUDE_PLUGIN_*}');
} catch (e) {
  console.error('test harness crashed:', e);
  allFail = true;
} finally {
  try { rmSync(dataDir, { recursive: true, force: true }); } catch {}
  try { rmSync(ROOT, { recursive: true, force: true }); } catch {}
}

console.log(`\n${C.bold('== Summary ==')}\n  ${pass} passed, ${fail} failed\n`);
process.exit(allFail || fail > 0 ? 1 : 0);

function pathToImportSpec(p) {
  // Use file:// URLs with absolute paths so dynamic import() works regardless of CWD.
  return new URL('file://' + p.replace(/\\/g, '/')).href;
}
