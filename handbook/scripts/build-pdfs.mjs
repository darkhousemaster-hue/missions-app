#!/usr/bin/env node
// ── handbook/scripts/build-pdfs.mjs ─────────────────────────────────────────
// Reads handbook/content/*.md, embeds the matching screenshots, renders an
// HTML page styled for print, and uses Playwright's page.pdf() to produce a
// PDF in handbook/pdf/.
//
//   node handbook/scripts/build-pdfs.mjs            # all four
//   node handbook/scripts/build-pdfs.mjs settings-en gm-de
//
// Each markdown file has YAML-ish front matter (title, subtitle, lang,
// manifest) and a custom directive `::shot:<name>` that expands to the
// screenshot with caption. No external markdown library — small parser
// inline.

import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
process.env.NODE_PATH = [process.env.NODE_PATH, 'C:/Users/darkh/AppData/Roaming/npm/node_modules'].filter(Boolean).join(';');
require('node:module').Module._initPaths();
const { chromium } = require('playwright');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT    = join(__dirname, '..');
const CONTENT = join(ROOT, 'content');
const SHOTS   = join(ROOT, 'screenshots');
const PDF_DIR = join(ROOT, 'pdf');
// public/manuals/ is the deployed copy the in-app 📖 Manuals button serves.
// Mirror the build output there on every run so the in-app downloads always
// match what we just regenerated.
const PUBLIC_MANUALS = join(ROOT, '..', 'public', 'manuals');
mkdirSync(PDF_DIR, { recursive: true });
mkdirSync(PUBLIC_MANUALS, { recursive: true });

// ── Tiny markdown → HTML converter ──────────────────────────────────────────
// We don't want to depend on an npm marked install. The set of constructs we
// use is small: headings, paragraphs, lists, blockquotes, bold, italic,
// inline code, and our ::shot:NAME directive.
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function inline(s) {
  // Order matters — handle code first so its contents aren't re-processed.
  return s
    .replace(/`([^`]+)`/g, (_, c) => `<code>${escHtml(c)}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}
function parseFrontmatter(src) {
  const m = src.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split(/\n/)) {
    const mm = line.match(/^(\w+):\s*"?(.*?)"?\s*$/);
    if (mm) meta[mm[1]] = mm[2];
  }
  return { meta, body: m[2] };
}
function mdToHtml(body, manifestMap) {
  const lines = body.split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i];
    // ::shot:NAME directive
    const shotMatch = ln.match(/^::shot:(\S+)\s*$/);
    if (shotMatch) {
      const entry = manifestMap.get(shotMatch[1]);
      if (entry) {
        out.push(`<figure class="shot">`);
        out.push(`  <img src="../screenshots/${entry.file.replace(/\\/g, '/')}" alt="${escHtml(entry.desc || '')}">`);
        out.push(`  <figcaption>${escHtml(entry.desc || '')}</figcaption>`);
        out.push(`</figure>`);
      } else {
        out.push(`<p class="missing-shot">[missing screenshot: ${shotMatch[1]}]</p>`);
      }
      i++; continue;
    }
    // ::part:NUMBER:TITLE directive — full-page section divider
    const partMatch = ln.match(/^::part:(\d+):(.+)$/);
    if (partMatch) {
      out.push(`<section class="part">`);
      out.push(`  <div class="part-num">Part ${partMatch[1]}</div>`);
      out.push(`  <div class="part-title">${escHtml(partMatch[2].trim())}</div>`);
      out.push(`</section>`);
      i++; continue;
    }
    // Headings
    const h = ln.match(/^(#{1,6})\s+(.+)$/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    // Horizontal rule
    if (/^---+\s*$/.test(ln)) { out.push('<hr>'); i++; continue; }
    // Blockquote
    if (/^>\s/.test(ln)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(inline(lines[i].replace(/^>\s?/, ''))); i++;
      }
      out.push(`<blockquote>${buf.join(' ')}</blockquote>`);
      continue;
    }
    // Unordered list
    if (/^[-*]\s/.test(ln)) {
      const buf = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        // Collect continuation lines until blank or next bullet
        let item = lines[i].replace(/^[-*]\s/, '');
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i])) {
          item += ' ' + lines[i].trim(); i++;
        }
        buf.push(`<li>${inline(item)}</li>`);
      }
      out.push(`<ul>${buf.join('')}</ul>`);
      continue;
    }
    // Ordered list
    if (/^\d+\.\s/.test(ln)) {
      const buf = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        let item = lines[i].replace(/^\d+\.\s/, '');
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i])) {
          item += ' ' + lines[i].trim(); i++;
        }
        buf.push(`<li>${inline(item)}</li>`);
      }
      out.push(`<ol>${buf.join('')}</ol>`);
      continue;
    }
    // Blank line
    if (/^\s*$/.test(ln)) { i++; continue; }
    // Paragraph (collect contiguous non-empty lines that aren't special)
    const para = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^[-*]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^>\s/.test(lines[i]) &&
      !/^::shot:/.test(lines[i]) &&
      !/^::part:/.test(lines[i]) &&
      !/^---+\s*$/.test(lines[i])
    ) {
      para.push(lines[i].trim()); i++;
    }
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

// ── Page CSS — print-optimized, no external fonts ───────────────────────────
const CSS = `
@page { size: A4; margin: 18mm 16mm 18mm 16mm; }
* { box-sizing: border-box; }
html, body { background: #fff; color: #111; }
body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.55; margin: 0; }
.cover { page-break-after: always; padding: 80mm 0 0 0; text-align: center; }
.cover h1 { font-size: 32pt; margin: 0 0 .4em 0; letter-spacing: .04em; }
.cover .sub { color: #555; font-size: 14pt; }
.cover .meta { margin-top: 60mm; color: #888; font-size: 10pt; }
h1 { font-size: 22pt; margin: 1.2em 0 .4em 0; border-bottom: 1px solid #ddd; padding-bottom: .15em; page-break-after: avoid; }
h2 { font-size: 16pt; margin: 1.4em 0 .35em 0; color: #c0392b; page-break-after: avoid; }
h3 { font-size: 13pt; margin: 1.2em 0 .25em 0; page-break-after: avoid; }
p { margin: .35em 0 .75em 0; }
ul, ol { margin: .35em 0 .9em 1.25em; padding: 0; }
li { margin: .2em 0; }
blockquote { border-left: 3px solid #e85f1e; background: #fff7f1; padding: .55em .8em; margin: .9em 0; color: #5a3520; font-size: 10pt; border-radius: 0 4px 4px 0; }
code { background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-family: Consolas, "Courier New", monospace; font-size: 95%; }
hr { border: none; border-top: 1px solid #e6e6e6; margin: 1.5em 0; }
strong { color: #000; }
a { color: #c0392b; text-decoration: none; }
.shot { margin: 1.1em 0 1.2em 0; page-break-inside: avoid; text-align: center; }
.shot img { max-width: 70%; max-height: 130mm; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.shot figcaption { font-size: 9.5pt; color: #666; margin-top: .35em; font-style: italic; }
.missing-shot { color: #c0392b; font-style: italic; }
.part { page-break-before: always; page-break-after: always; text-align: center; padding-top: 90mm; }
.part .part-num { font-size: 11pt; letter-spacing: .3em; color: #888; text-transform: uppercase; }
.part .part-title { font-size: 28pt; margin-top: .2em; color: #c0392b; letter-spacing: .03em; }
/* Avoid orphan headings */
h1 + p, h2 + p, h3 + p { page-break-before: avoid; }
`;

function wrap(meta, htmlBody) {
  const lang = meta.lang || 'en';
  const today = new Date().toISOString().slice(0, 10);
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${escHtml(meta.title || 'Manual')}</title>
<style>${CSS}</style>
</head>
<body>
  <section class="cover">
    <h1>${escHtml(meta.title || 'Manual')}</h1>
    <div class="sub">${escHtml(meta.subtitle || '')}</div>
    <div class="meta">Version ${escHtml(process.env.npm_package_version || readPkgVersion())} · ${today}</div>
  </section>
  ${htmlBody}
</body>
</html>`;
}

function readPkgVersion() {
  try {
    return JSON.parse(readFileSync(join(ROOT, '..', 'package.json'), 'utf8')).version;
  } catch { return ''; }
}

// Map content slugs (`settings-en`, `gm-de`, ...) to the requested final
// filename pattern `SETTINGS_Manual-en` / `GM_Manual-de`. The content slugs
// stay the same so capture scripts and manifests don't need to change; only
// the PDF + HTML output filenames are renamed.
function outputBasename(slug) {
  const [kind, lang] = slug.split('-');
  if (kind === 'settings') return `SETTINGS_Manual-${lang}`;
  if (kind === 'gm')       return `GM_Manual-${lang}`;
  if (kind === 'player')   return `PLAYER_Manual-${lang}`;
  return slug;  // fallback for anything that doesn't match
}

async function buildOne(mdFile) {
  const src = readFileSync(join(CONTENT, mdFile), 'utf8');
  const { meta, body } = parseFrontmatter(src);
  if (!meta.manifest) throw new Error(`${mdFile} is missing 'manifest:' in front-matter`);
  const manifestPath = join(SHOTS, meta.manifest, 'manifest.json');
  if (!existsSync(manifestPath)) throw new Error(`manifest not found at ${manifestPath}: did you run the capture scripts?`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const map = new Map(manifest.map(e => [e.name, e]));
  const html = wrap(meta, mdToHtml(body, map));

  // Write HTML alongside the PDF for debugging, both using the renamed slug
  const slug    = basename(mdFile, '.md');
  const outName = outputBasename(slug);
  const htmlPath = join(PDF_DIR, outName + '.html');
  writeFileSync(htmlPath, html);

  // Render PDF via Playwright
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto('file://' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    const out = join(PDF_DIR, outName + '.pdf');
    await page.pdf({ path: out, format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
    // Mirror to public/manuals/ so the in-app download button serves the
    // fresh build immediately on next request.
    copyFileSync(out, join(PUBLIC_MANUALS, outName + '.pdf'));
    console.log(`  ${outName}.pdf  (${manifest.length} screenshots) → public/manuals/`);
  } finally {
    await browser.close();
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
const requested = process.argv.slice(2);
const all = readdirSync(CONTENT).filter(f => f.endsWith('.md')).map(f => basename(f, '.md'));
const targets = requested.length ? requested : all;

console.log(`Building ${targets.length} PDF(s) → ${PDF_DIR}`);
for (const slug of targets) {
  try { await buildOne(slug + '.md'); }
  catch (e) { console.error(`FAIL ${slug}: ${e.message}`); process.exitCode = 1; }
}
