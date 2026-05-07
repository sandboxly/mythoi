// PDF -> Markdown extraction via mupdf.js.
//
// Approach: read structured text JSON per page, group spans into visual lines,
// detect headings via font size (relative to page median body text), preserve
// italic and bold via *...* / **...**, detect bullet markers at line start, and
// process columns left-to-right when bbox clustering suggests two columns.
//
// Fidelity target: roughly equivalent to pymupdf4llm.to_markdown() for clean
// commercial RPG PDFs (consistent fonts, two-column layout, italicised
// example tags, all-caps section headings). Not a marker-grade ML port.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as mupdf from 'mupdf';

const HEADING_RATIO_H1 = 1.6;
const HEADING_RATIO_H2 = 1.3;
const HEADING_RATIO_H3 = 1.12;
const COLUMN_GAP_MIN = 30;       // pt; horizontal whitespace gap between columns
const LINE_MERGE_Y_RATIO = 0.4;  // spans on same visual line if Δy < ratio * line-height
const BULLET_RE = /^[•‣●◦⁃\*·\-–—]\s+/;

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function isItalic(font) {
  if (!font) return false;
  if (font.style && /italic|oblique/i.test(font.style)) return true;
  if (font.name && /italic|oblique/i.test(font.name)) return true;
  return false;
}

function isBold(font) {
  if (!font) return false;
  if (font.weight === 'bold' || (typeof font.weight === 'number' && font.weight >= 600)) return true;
  if (font.name && /bold|black|heavy|semibold/i.test(font.name)) return true;
  return false;
}

// Collapse runs (one mupdf "line" = one span/run) into visual lines.
function groupVisualLines(spans) {
  if (!spans.length) return [];
  const sorted = [...spans].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const lines = [];
  let cur = null;
  for (const sp of sorted) {
    const lh = sp.bbox?.h ?? 10;
    if (!cur || Math.abs(sp.y - cur.y) > lh * LINE_MERGE_Y_RATIO) {
      cur = { y: sp.y, spans: [sp] };
      lines.push(cur);
    } else {
      cur.spans.push(sp);
    }
  }
  for (const ln of lines) ln.spans.sort((a, b) => a.x - b.x);
  return lines;
}

function spansToMarkdown(spans, bodySize) {
  let out = '';
  let italicOpen = false;
  let boldOpen = false;
  for (let i = 0; i < spans.length; i++) {
    const sp = spans[i];
    const txt = sp.text;
    if (!txt) continue;
    const ital = isItalic(sp.font);
    const bold = isBold(sp.font) && (sp.font?.size || 0) <= bodySize * HEADING_RATIO_H3;
    // close/open inline emphasis as font flags change
    if (italicOpen && !ital) { out = out.replace(/\s+$/, '') + '*'; italicOpen = false; }
    if (boldOpen && !bold) { out = out.replace(/\s+$/, '') + '**'; boldOpen = false; }
    if (!italicOpen && ital) { out += '*'; italicOpen = true; }
    if (!boldOpen && bold) { out += '**'; boldOpen = true; }
    // add a space if the previous span's right edge is well left of this one's left edge
    if (i > 0) {
      const prev = spans[i - 1];
      const prevRight = (prev.bbox?.x ?? prev.x) + (prev.bbox?.w ?? 0);
      if (sp.x - prevRight > 1.5 && !out.endsWith(' ')) out += ' ';
    }
    out += txt;
  }
  if (italicOpen) out += '*';
  if (boldOpen) out += '**';
  return out;
}

function lineToMarkdown(line, bodySize, headingSizes) {
  const text = spansToMarkdown(line.spans, bodySize).trim();
  if (!text) return '';

  // Bullet detection
  const bulletMatch = text.match(BULLET_RE);
  if (bulletMatch) {
    return `- ${text.slice(bulletMatch[0].length)}`;
  }

  // Heading detection by max font size on the line
  const maxSize = Math.max(0, ...line.spans.map(s => s.font?.size || 0));
  if (bodySize > 0 && maxSize >= bodySize * HEADING_RATIO_H1) return `# ${text}`;
  if (bodySize > 0 && maxSize >= bodySize * HEADING_RATIO_H2) return `## ${text}`;
  if (bodySize > 0 && maxSize >= bodySize * HEADING_RATIO_H3 && line.spans.every(s => isBold(s.font))) return `### ${text}`;

  return text;
}

// Detect column splits: cluster block x-centers; if two well-separated clusters
// emerge, return [leftBlocks, rightBlocks]; otherwise return [allBlocks].
function partitionByColumn(blocks, pageWidth) {
  if (blocks.length < 6) return [blocks];
  const centers = blocks.map(b => (b.bbox.x + b.bbox.w / 2));
  const sorted = [...centers].sort((a, b) => a - b);
  // Find largest gap between consecutive sorted centers
  let gap = 0, gapAt = -1;
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i] - sorted[i - 1];
    if (d > gap) { gap = d; gapAt = i; }
  }
  if (gap < COLUMN_GAP_MIN || gapAt < 0) return [blocks];
  const split = (sorted[gapAt - 1] + sorted[gapAt]) / 2;
  // Sanity: split should be near the page middle (not e.g. just an outlier)
  if (split < pageWidth * 0.3 || split > pageWidth * 0.7) return [blocks];
  const left = blocks.filter(b => (b.bbox.x + b.bbox.w / 2) < split);
  const right = blocks.filter(b => (b.bbox.x + b.bbox.w / 2) >= split);
  if (!left.length || !right.length) return [blocks];
  return [left, right];
}

function pageBodySize(blocks) {
  const sizes = [];
  for (const b of blocks) {
    if (b.type !== 'text') continue;
    for (const ln of b.lines || []) {
      const sz = ln.font?.size;
      if (sz && ln.text && ln.text.trim()) sizes.push(sz);
    }
  }
  // Use a robust mode-ish estimate: round to 0.5pt and pick the most common
  if (!sizes.length) return 10;
  const counts = new Map();
  for (const s of sizes) {
    const k = Math.round(s * 2) / 2;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let best = 0, bestN = -1;
  for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
  return best || median(sizes) || 10;
}

function pageToMarkdown(pageJson, pageWidth) {
  const blocks = (pageJson.blocks || []).filter(b => b.type === 'text' && b.lines && b.lines.length);
  if (!blocks.length) return '';
  const bodySize = pageBodySize(blocks);
  const headingSizes = [];

  const columns = partitionByColumn(blocks, pageWidth);
  const out = [];

  for (const col of columns) {
    const sortedBlocks = [...col].sort((a, b) => a.bbox.y - b.bbox.y);
    let prevWasBlank = true;
    for (const block of sortedBlocks) {
      const lines = groupVisualLines(block.lines || []);
      const blockOut = [];
      for (const ln of lines) {
        const md = lineToMarkdown(ln, bodySize, headingSizes);
        if (md) blockOut.push(md);
      }
      if (blockOut.length) {
        if (!prevWasBlank) out.push('');
        out.push(...blockOut);
        prevWasBlank = false;
      }
    }
    if (out.length && out[out.length - 1] !== '') out.push('');
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function extractPdfToMarkdown(pdfPath, outputPath) {
  const resolved = path.resolve(pdfPath.replace(/^~/, process.env.HOME || ''));
  const buf = readFileSync(resolved);
  const doc = mupdf.Document.openDocument(new Uint8Array(buf), 'application/pdf');
  const out = outputPath
    ? path.resolve(outputPath.replace(/^~/, process.env.HOME || ''))
    : resolved.replace(/\.pdf$/i, '.md');

  const pageCount = doc.countPages();
  const chunks = [];
  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    const bounds = page.getBounds();
    const width = bounds[2] - bounds[0];
    const st = page.toStructuredText('preserve-whitespace');
    const json = JSON.parse(st.asJSON());
    const md = pageToMarkdown(json, width);
    if (md) chunks.push(md);
  }
  const markdown = chunks.join('\n\n-----\n\n') + '\n';
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, markdown, 'utf8');
  return { ok: true, markdown_path: out, size_bytes: Buffer.byteLength(markdown) };
}
