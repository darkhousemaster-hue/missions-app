#!/usr/bin/env node
// Verify the CityRush special button stays on-screen when the team is frozen.
// Drives a real freeze via the freeze API endpoint and inspects the button's
// bounding rect before and after.

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { boot } from './_fixture.mjs';

const require = createRequire(import.meta.url);
process.env.NODE_PATH = 'C:/Users/darkh/AppData/Roaming/npm/node_modules';
require('node:module').Module._initPaths();
const { chromium } = require('playwright');

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'screenshots', 'verify');
mkdirSync(OUT, { recursive: true });

const { base, seeded, cleanup } = await boot();
console.log('[freeze] base =', base, 'crGameId =', seeded.crGameId);

// Pull the existing CR teams from the seeded game.
const crGame = await fetch(`${base}/api/games/${seeded.crGameId}`).then(r => r.json());
const teamA = crGame.teams[0];
const teamB = crGame.teams[1];
console.log('[freeze] teams =', teamA.id, teamA.name, '/', teamB.id, teamB.name);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errs.push(`[pageerror] ${e.message}`));

// Establish team session via sessionStorage so cityrush.html starts up clean.
await page.goto(`${base}/cityrush.html?game=${seeded.crGameId}&team=${teamA.id}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// Force the button visible so we can measure its position regardless of
// whether the seeded data loaded a single-special mission for this team.
await page.evaluate(() => {
  window._specialBtnWanted = true;
  const btn = document.getElementById('cr-special-btn');
  if (btn) btn.style.display = 'flex';
});
await page.screenshot({ path: join(OUT, 'freeze-before.png'), fullPage: false });

const before = await page.evaluate(() => {
  const btn = document.getElementById('cr-special-btn');
  if (!btn) return { exists: false };
  const r = btn.getBoundingClientRect();
  return {
    exists: true,
    display: getComputedStyle(btn).display,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    inViewport: r.y >= 0 && r.bottom <= window.innerHeight,
    viewportH: window.innerHeight,
    parentTag: btn.parentElement?.tagName,
  };
});
console.log('[freeze] before =', JSON.stringify(before));

// Trigger a freeze on team A by the other team via the real endpoint.
const freezeRes = await fetch(`${base}/api/games/${seeded.crGameId}/freeze`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ freezerTeamId: teamB.id, frozenTeamId: teamA.id, durationSeconds: 120 }),
}).then(async r => ({ status: r.status, body: await r.text().then(t => { try { return JSON.parse(t); } catch { return t.slice(0, 100); } }) })).catch(e => ({ error: String(e) }));
console.log('[freeze] freezeRes =', JSON.stringify(freezeRes));

// Give socket.io and the frozen overlay logic a moment to settle.
await page.waitForTimeout(2500);

// Dismiss the frozen overlay so we can see the underlying view.
await page.evaluate(() => {
  const btn = document.getElementById('cr-frozen-close');
  if (btn) btn.click();
});
await page.waitForTimeout(500);

// Force the button visible again (we already forced before the freeze; the
// renderer might have re-run after freeze socket events and reset it).
await page.evaluate(() => {
  window._specialBtnWanted = true;
  const btn = document.getElementById('cr-special-btn');
  if (btn) btn.style.display = 'flex';
});
await page.screenshot({ path: join(OUT, 'freeze-after.png'), fullPage: false });

const after = await page.evaluate(() => {
  const btn = document.getElementById('cr-special-btn');
  if (!btn) return { exists: false };
  const r = btn.getBoundingClientRect();
  const vm = document.getElementById('view-mission');
  const vmFilter = vm ? getComputedStyle(vm).filter : null;
  return {
    exists: true,
    bodyClass: document.body.className,
    display: getComputedStyle(btn).display,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    inViewport: r.y >= 0 && r.bottom <= window.innerHeight,
    viewportH: window.innerHeight,
    parentTag: btn.parentElement?.tagName,
    parentId: btn.parentElement?.id,
    viewMissionFilter: vmFilter,
  };
});
console.log('[freeze] after  =', JSON.stringify(after));

console.log('\n── errors ──');
errs.forEach(e => console.log(e));

await browser.close();
cleanup();
process.exit(0);
