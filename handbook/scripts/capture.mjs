#!/usr/bin/env node
// ── handbook/scripts/capture.mjs ────────────────────────────────────────────
// Boots the missions-app server on a free port, walks the major screens with
// Playwright, and dumps annotated screenshots into handbook/screenshots/.
//
// Run from project root:   node handbook/scripts/capture.mjs
//   --headed               show the browser window (default: headless)
//   --viewport=W,H         override the default 390×844 (iPhone 14 portrait)
//   --base=http://host:port  skip auto-boot and capture against a running server
//
// Designed to be invoked by Claude when generating the user handbook.
// New screens? Add an entry to SHOTS below — the rest is automatic.

import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

// Resolve globally-installed playwright (Stagehand too if/when used)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const GLOBAL_NODE_MODULES = 'C:/Users/darkh/AppData/Roaming/npm/node_modules';
process.env.NODE_PATH = [process.env.NODE_PATH, GLOBAL_NODE_MODULES].filter(Boolean).join(';');
require('node:module').Module._initPaths();
const { chromium } = require('playwright');

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(PROJECT_ROOT, 'handbook', 'screenshots');
mkdirSync(OUT_DIR, { recursive: true });

// ── CLI flags ───────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.startsWith('--') ? a.slice(2).split('=') : [a, true])
);
const headed = !!args.headed;
const [vw, vh] = (args.viewport || '390,844').split(',').map(Number);

// ── Helpers ─────────────────────────────────────────────────────────────────
function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.unref();
    s.on('error', rej);
    s.listen(0, () => { const { port } = s.address(); s.close(() => res(port)); });
  });
}

async function bootServer(port) {
  console.log(`[capture] booting missions-app on :${port}`);
  const child = spawn('node', ['server.js'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', d => process.stdout.write(`[server] ${d}`));
  child.stderr.on('data', d => process.stderr.write(`[server!] ${d}`));
  // Wait until the port answers
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
  throw new Error('server did not come up within 15s');
}

// ── Shot list (extend freely) ───────────────────────────────────────────────
// Each entry runs in order. `setup` may navigate / interact before the snap.
// Keep selectors loose — these pages change often.
const SHOTS = [
  { name: '01-landing-gm',   path: '/gm.html',      desc: 'Gamemaster landing — mode + location picker' },
  { name: '02-join-team',    path: '/join.html',    desc: 'Player join screen — team name + colour' },
  { name: '03-player-missions', path: '/play.html', desc: 'MiSSiONS player home (no game)',
    setup: async (page) => { await page.waitForLoadState('networkidle'); } },
  { name: '04-cityrush-home',   path: '/cityrush.html', desc: 'CityRush player view (no game)',
    setup: async (page) => { await page.waitForLoadState('networkidle'); } },
];

// ── Main ────────────────────────────────────────────────────────────────────
const base = args.base || `http://127.0.0.1:${await freePort()}`;
const port = new URL(base).port;
const owns = !args.base;
const server = owns ? await bootServer(port) : null;

const browser = await chromium.launch({ headless: !headed });
const ctx = await browser.newContext({
  viewport: { width: vw, height: vh },
  deviceScaleFactor: 2,
});
const manifest = [];

try {
  for (const shot of SHOTS) {
    const page = await ctx.newPage();
    const url = base + shot.path;
    console.log(`[capture] ${shot.name}  ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (shot.setup) await shot.setup(page);
    await page.waitForTimeout(400); // settle animations
    const file = join(OUT_DIR, `${shot.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    manifest.push({ ...shot, file: `screenshots/${shot.name}.png` });
    await page.close();
  }

  // Manifest fuels the handbook generator (next step) — title, description,
  // and file path for every screenshot we took, in capture order.
  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`[capture] wrote ${manifest.length} screenshots + manifest.json`);
} finally {
  await browser.close();
  if (server) server.kill();
}
