#!/usr/bin/env node
// End-to-end verification: join.html scroll fit + red wordmark on every page.
// Boots the sandbox, takes screenshots at 390×844 (iPhone-portrait),
// and measures whether join.html's body now fits without scrolling.

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
console.log('[verify] base =', base);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errs.push(`[pageerror] ${e.message}`));

async function shoot(name, url, settle = 400) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(settle);
  await page.screenshot({ path: join(OUT, name + '.png'), fullPage: false });
  console.log('[verify] saved', name + '.png');
}

// 1. join.html — confirm no scroll at 390×844 and red wordmark.
await shoot('after-join-missions', `${base}/join.html?game=${seeded.gameId}`);
const joinMetrics = await page.evaluate(() => {
  const wm = document.querySelector('.join-header .wordmark');
  return {
    docScrollHeight: document.documentElement.scrollHeight,
    viewportHeight:  window.innerHeight,
    overflowing:     document.documentElement.scrollHeight > window.innerHeight,
    wordmarkColor:   wm ? getComputedStyle(wm).color : null,
  };
});
console.log('[join] metrics =', joinMetrics);

// 2. play.html — red wordmark on player topbar.
//    Build a session first by joining as a team via the API.
const teamRes = await fetch(`${base}/api/games/${seeded.gameId}/teams`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'Verify Red', color: '#ff3b3b' }),
}).then(r => r.json());
await shoot('after-play-missions', `${base}/play.html?game=${seeded.gameId}&team=${teamRes.id}`);
const playWordmarkColor = await page.evaluate(() => {
  const wm = document.querySelector('.play-wordmark');
  return wm ? getComputedStyle(wm).color : null;
});
console.log('[play] wordmark color =', playWordmarkColor);

// 3. gm.html — landing logo + dashboard wordmark.
await shoot('after-gm-landing', `${base}/gm.html`);
const landingColor = await page.evaluate(() => {
  const h = document.querySelector('.landing-logo h1');
  return h ? getComputedStyle(h).color : null;
});
console.log('[gm landing] wordmark color =', landingColor);

// Open a dashboard to check the topbar wordmark
await page.evaluate((gid) => {
  // openDashboard isn't directly exposed via a button on landing without
  // clicking through; navigate via the dashboard hash if supported, else
  // just call window.openDashboard if it exists.
  if (typeof window.openDashboard === 'function') {
    sessionStorage.setItem('gmAuthed', '1');
    window.openDashboard(gid);
  }
}, seeded.gameId);
await page.waitForTimeout(800);
await page.screenshot({ path: join(OUT, 'after-gm-dashboard.png'), fullPage: false });
const dashColor = await page.evaluate(() => {
  const wm = document.querySelector('.dt-wordmark');
  return wm ? getComputedStyle(wm).color : null;
});
console.log('[gm dash] wordmark color =', dashColor);

// 4. Accept-chime: toggle the setting, then call playAcceptChime() and
//    verify the AudioContext was created. Headless Chromium will create
//    the context even without speakers; we only check the function runs.
const chimeWorks = await page.evaluate(() => {
  try {
    localStorage.setItem('gm_sound_accept', '1');
    if (typeof window.playAcceptChime !== 'function') return 'no-function';
    window.playAcceptChime();
    return 'ok';
  } catch (e) { return 'error:' + e.message; }
});
console.log('[chime] result =', chimeWorks);

console.log('\n── errors ──');
errs.forEach(e => console.log(e));

await browser.close();
cleanup();
process.exit(0);
