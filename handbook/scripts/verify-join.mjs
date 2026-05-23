#!/usr/bin/env node
// Verifies join.html visually against mockup 09 at 390×844.
// Boots the sandbox, opens /join.html?game=<id> for both MiSSiONS and CityRush
// games, captures screenshots, and writes them under handbook/screenshots/verify/.

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { boot } from './_fixture.mjs';

const require = createRequire(import.meta.url);
process.env.NODE_PATH = [process.env.NODE_PATH, 'C:/Users/darkh/AppData/Roaming/npm/node_modules']
  .filter(Boolean).join(';');
require('node:module').Module._initPaths();
const { chromium } = require('playwright');

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'screenshots', 'verify');
mkdirSync(OUT, { recursive: true });

const { base, seeded, cleanup } = await boot();
console.log('[verify] base =', base, 'seeded games =', seeded.gameId, seeded.crGameId);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

async function shoot(name, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, name + '.png'), fullPage: false });
  console.log('[verify] saved', name + '.png');
}

// MiSSiONS — default (no existing teams yet wiped → seeded has 2 teams)
await shoot('join-missions-default', `${base}/join.html?game=${seeded.gameId}`);

// MiSSiONS — open the "join existing" panel
await page.click('#join-existing-link').catch(() => {});
await page.waitForTimeout(300);
await page.screenshot({ path: join(OUT, 'join-missions-existing.png'), fullPage: false });
console.log('[verify] saved join-missions-existing.png');

// CityRush join — same code path but redirect target differs
await shoot('join-cityrush-default', `${base}/join.html?game=${seeded.crGameId}`);

// Tap one of the language tabs to confirm it stays interactive
await page.click('[data-lang="en"]').catch(() => {});
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, 'join-cityrush-en.png'), fullPage: false });
console.log('[verify] saved join-cityrush-en.png');

console.log('\n── console / errors ──');
logs.slice(-30).forEach(l => console.log(l));

await browser.close();
cleanup();
process.exit(0);
