#!/usr/bin/env node
// ── handbook/scripts/stagehand-tour.mjs ─────────────────────────────────────
// Stagehand-driven walkthrough. Use this when a flow requires interpreting the
// page (e.g. "click the settings tab", "fill the team name with X") rather
// than a hardcoded CSS selector. The screenshot helper (capture.mjs) is for
// deterministic shots; this is for AI-mediated flows.
//
//   ANTHROPIC_API_KEY=...  node handbook/scripts/stagehand-tour.mjs
//
// Edit the `tour()` body below to add steps. Output goes to
// handbook/screenshots/ alongside the deterministic captures.

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import net from 'node:net';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const GLOBAL_NODE_MODULES = 'C:/Users/darkh/AppData/Roaming/npm/node_modules';
process.env.NODE_PATH = [process.env.NODE_PATH, GLOBAL_NODE_MODULES].filter(Boolean).join(';');
require('node:module').Module._initPaths();
const { Stagehand } = require('@browserbasehq/stagehand');

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(PROJECT_ROOT, 'handbook', 'screenshots');
mkdirSync(OUT_DIR, { recursive: true });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ERROR: set ANTHROPIC_API_KEY before running.');
  console.error('  PowerShell:   $env:ANTHROPIC_API_KEY="sk-ant-..."');
  console.error('  Bash:         export ANTHROPIC_API_KEY=sk-ant-...');
  process.exit(1);
}

// ── Boot the missions-app server (same helper as capture.mjs) ───────────────
function freePort() {
  return new Promise(res => {
    const s = net.createServer();
    s.unref();
    s.listen(0, () => { const { port } = s.address(); s.close(() => res(port)); });
  });
}
async function bootServer(port) {
  const child = spawn('node', ['server.js'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', d => process.stdout.write(`[server] ${d}`));
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await new Promise(r => {
      const s = net.connect(port, '127.0.0.1');
      s.once('connect', () => { s.end(); r(true); });
      s.once('error',   () => r(false));
    })) return child;
    await new Promise(r => setTimeout(r, 200));
  }
  child.kill();
  throw new Error('server did not come up');
}

// ── The tour ────────────────────────────────────────────────────────────────
async function tour() {
  const port = await freePort();
  const server = await bootServer(port);
  const base = `http://127.0.0.1:${port}`;

  const sh = new Stagehand({
    env: 'LOCAL',
    modelName: 'claude-sonnet-4-5-20250929',  // or any current Sonnet/Haiku
    modelClientOptions: { apiKey: process.env.ANTHROPIC_API_KEY },
    verbose: 1,
    localBrowserLaunchOptions: { headless: !process.argv.includes('--headed'), viewport: { width: 390, height: 844 } },
  });

  try {
    await sh.init();
    const page = sh.page;

    // ── Step 1: GM landing ────────────────────────────────────────────────
    await page.goto(`${base}/gm.html`, { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: join(OUT_DIR, 'tour-01-gm-landing.png'), fullPage: true });

    // ── Step 2: Player join (AI-driven form fill) ─────────────────────────
    await page.goto(`${base}/join.html`, { waitUntil: 'domcontentloaded' });
    await page.act('type "Demo Team" into the team-name input');
    await page.screenshot({ path: join(OUT_DIR, 'tour-02-join-filled.png'), fullPage: true });

    // Add more `page.act(...)` / `page.observe(...)` / `page.extract(...)`
    // steps here. Each is an English instruction the model interprets.

    console.log('Tour finished.');
  } finally {
    await sh.close();
    server.kill();
  }
}

tour().catch(e => { console.error(e); process.exit(1); });
