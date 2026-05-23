#!/usr/bin/env node
// Spot-check the Settings → Manuals panel: open the GM settings, switch
// to the Manuals tab, count rows, and HEAD-check each PDF link to confirm
// the file resolves. Runs against the sandbox boot.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { boot, PASSWORD } from './_fixture.mjs';

const require = createRequire(import.meta.url);
process.env.NODE_PATH = 'C:/Users/darkh/AppData/Roaming/npm/node_modules';
require('node:module').Module._initPaths();
const { chromium } = require('playwright');

const { base, cleanup } = await boot();
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 820 } });
const page = await ctx.newPage();
await page.goto(`${base}/gm.html`, { waitUntil: 'networkidle' });

// Unlock settings
await page.evaluate(() => showSettingsGate());
await page.waitForTimeout(300);
await page.fill('#gate-pw', PASSWORD);
await page.evaluate(() => verifyGate());
await page.waitForTimeout(1000);

// Open the Manuals tab
await page.evaluate(() => switchSettingsTab('manuals', document.getElementById('st-manuals')));
await page.waitForTimeout(400);

// Capture screenshots for each language
for (const lang of ['de', 'en']) {
  await page.selectOption('#manuals-lang-filter', lang);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `C:/projects/missions-app/handbook/screenshots/verify/manuals-${lang}.png`, fullPage: false });
  const rows = await page.$$eval('.manual-row', els => els.map(a => ({
    title: a.querySelector('.manual-row__title')?.textContent?.trim(),
    file:  a.getAttribute('href'),
  })));
  console.log(`[manuals/${lang}] ${rows.length} rows:`, rows);

  // HEAD each linked PDF
  for (const r of rows) {
    const url = base + r.file;
    const res = await fetch(url, { method: 'HEAD' });
    console.log('  ', res.ok ? 'OK ' : 'FAIL', res.status, r.file);
  }
}

await browser.close();
cleanup();
