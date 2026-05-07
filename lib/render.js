// Render a character to HTML (and optionally PDF) using Nunjucks + headless Chrome.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import nunjucks from 'nunjucks';
import { pluginRoot, templatesDir } from './paths.js';
import { slugify } from './util.js';

const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(templatesDir(), { noCache: true }), {
  autoescape: true,
  trimBlocks: true,
  lstripBlocks: true,
});

function chromeCandidates() {
  const platform = process.platform;
  if (platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
  }
  if (platform === 'win32') {
    const pf = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean);
    const out = [];
    for (const base of pf) {
      out.push(path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      out.push(path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
      out.push(path.join(base, 'Chromium', 'Application', 'chromium.exe'));
    }
    return out;
  }
  return [];
}

function which(cmd) {
  const PATH = (process.env.PATH || '').split(path.delimiter);
  const exts = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of PATH) {
    for (const ext of exts) {
      const full = path.join(dir, cmd + ext);
      if (existsSync(full)) return full;
    }
  }
  return null;
}

function findChrome() {
  for (const p of chromeCandidates()) if (existsSync(p)) return p;
  return which('chromium') || which('google-chrome') || which('chrome') || which('msedge');
}

function htmlToPdf(htmlPath, pdfPath) {
  const chrome = findChrome();
  if (!chrome) {
    throw new Error('No Chrome/Chromium-family browser found. Install Google Chrome or open the HTML and Save as PDF.');
  }
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
    pathToFileURL(path.resolve(htmlPath)).href,
  ];
  const result = spawnSync(chrome, args, { encoding: 'utf8' });
  if (result.status !== 0 || !existsSync(pdfPath)) {
    throw new Error(`Chrome PDF conversion failed (exit ${result.status}).\nstderr:\n${result.stderr || ''}`);
  }
}

export function renderSheet(character, { layout = 'sheet', format = 'html', output } = {}) {
  if (layout !== 'sheet' && layout !== 'cards') {
    throw new Error(`layout must be 'sheet' or 'cards', got ${JSON.stringify(layout)}`);
  }
  if (format !== 'html' && format !== 'pdf') {
    throw new Error(`format must be 'html' or 'pdf', got ${JSON.stringify(format)}`);
  }

  // Accept either a parsed character object or a string path.
  let charObj;
  if (typeof character === 'string') {
    charObj = JSON.parse(readFileSync(character.replace(/^~/, os.homedir()), 'utf8'));
  } else {
    charObj = character;
  }

  const templateName = layout === 'cards' ? 'theme_cards.html.njk' : 'character_sheet.html.njk';
  const html = env.render(templateName, { character: charObj });

  let outHtml;
  if (output) {
    outHtml = path.resolve(output.replace(/^~/, os.homedir()));
  } else {
    const outDir = path.join(pluginRoot(), 'out');
    mkdirSync(outDir, { recursive: true });
    const suffix = layout === 'cards' ? '_cards' : '';
    outHtml = path.join(outDir, `${slugify(charObj.name || 'character')}${suffix}.html`);
  }

  mkdirSync(path.dirname(outHtml), { recursive: true });
  writeFileSync(outHtml, html);

  const paths = { html: outHtml };
  if (format === 'pdf') {
    const pdf = outHtml.replace(/\.html$/i, '.pdf');
    htmlToPdf(outHtml, pdf);
    paths.pdf = pdf;
  }
  return { ok: true, paths };
}
