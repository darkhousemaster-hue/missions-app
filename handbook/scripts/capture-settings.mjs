#!/usr/bin/env node
// ── handbook/scripts/capture-settings.mjs ───────────────────────────────────
// Settings manual screenshots, split into three labelled sections in the
// shot name:
//   adm-XX  — generic admin tabs (general / security / updates / template)
//   m-XX    — MiSSiONS configuration (locations / modes / missions / rules)
//   cr-XX   — CityRush configuration (modes / missions / hints / special)
//
// The PDF builder uses the prefix to group sections in the manual.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { boot, PROJECT_ROOT, PASSWORD } from './_fixture.mjs';

const require = createRequire(import.meta.url);
process.env.NODE_PATH = [process.env.NODE_PATH, 'C:/Users/darkh/AppData/Roaming/npm/node_modules'].filter(Boolean).join(';');
require('node:module').Module._initPaths();
const { chromium } = require('playwright');

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_ROOT  = join(PROJECT_ROOT, 'handbook', 'screenshots');

const args   = Object.fromEntries(process.argv.slice(2).map(a => a.startsWith('--') ? a.slice(2).split('=') : [a, true]));
const HEADED = !!args.headed;
const LANGS  = args.lang ? [args.lang] : ['de', 'en'];

// ── Shot list ───────────────────────────────────────────────────────────────
const SHOTS = [
  // Admin essentials
  { name: 'adm-01-gate',          tab: null,        desc: { de: 'Passwortabfrage zum Öffnen der Einstellungen.', en: 'Password gate to open settings.' } },
  { name: 'adm-02-general',       tab: 'general',   desc: { de: 'Allgemein-Tab: öffentliche URL und Timeout-Nachricht in allen Sprachen.', en: 'General tab: public URL and timeout message in every language.' } },
  { name: 'adm-03-security',      tab: 'security',  desc: { de: 'Sicherheit: GM-Passwort ändern.', en: 'Security: change the GM password.' } },
  { name: 'adm-04-updates',       tab: 'updates',   desc: { de: 'Updates: aktuelle Version und Update-Knopf (git pull + npm install).', en: 'Updates: current version and the update button (git pull + npm install).' } },
  { name: 'adm-05-template',      tab: 'template',  desc: { de: 'QR-Vorlage: Papierformat, Upload und QR-Marker-Position.', en: 'QR template: paper size, upload and QR marker drag.' } },

  // MiSSiONS
  { name: 'm-01-locations',       tab: 'locations', desc: { de: 'Standorte-Tab mit den drei Demostandorten.', en: 'Locations tab listing three demo locations.' } },
  { name: 'm-02-locations-add',   tab: 'locations', desc: { de: 'Modal „Standort hinzufügen" mit allen Optionen.', en: '“Add location” modal showing every option.' },
    setup: async (page) => { await page.evaluate(() => showAddLocation()); await page.waitForTimeout(400); } },
  { name: 'm-03-missions',        tab: 'missions',  desc: { de: 'MiSSiONS-Tab: Modus-Tabs, Standortfilter und Missionsliste.', en: 'MiSSiONS tab: mode bar, location filter and mission list.' } },
  { name: 'm-04-mission-add',     tab: 'missions',  desc: { de: 'Modal „MiSSiON hinzufügen" mit Mehrsprachen-Editor und Auto-Übersetzen.', en: '“Add MiSSiON” modal with the multi-language editor and auto-translate.' },
    setup: async (page) => { await page.evaluate(() => showAddMission()); await page.waitForTimeout(500); } },
  { name: 'm-05-rules',           tab: 'rules',     desc: { de: 'Regeln-Tab: Regelwerk-Auswahl und Regelliste mit Drag-Sortierung.', en: 'Rules tab: ruleset switcher and rule list with drag-reordering.' } },

  // CityRush
  { name: 'cr-01-modes-empty',    tab: 'cityrush',  desc: { de: 'CityRush-Tab: Modus-Tabs oben und Missionsliste darunter.', en: 'CityRush tab: mode bar at the top, mission list below.' } },
  { name: 'cr-02-mode-add',       tab: 'cityrush',  desc: { de: 'Neuer CityRush-Modus: Regelwerk, erlaubte Medien, Standard-Dauer.', en: 'New CityRush mode: ruleset, allowed media, default duration.' },
    setup: async (page) => { await page.evaluate(() => showAddCrMode()); await page.waitForTimeout(500); } },
  { name: 'cr-03-mission-add',    tab: 'cityrush',  desc: { de: 'Neue CityRush-Mission: GPS-Ziel, Radius, Karten-Anzeige.', en: 'New CityRush mission: GPS target, radius, map visibility.' },
    setup: async (page) => { await page.evaluate(() => showAddCrMission()); await page.waitForTimeout(600); } },
  { name: 'cr-04-mission-answer', tab: 'cityrush',  desc: { de: 'CityRush-Mission mit Antwort-Modus statt Medien.', en: 'CityRush mission in answer mode instead of media.' },
    setup: async (page) => {
      await page.evaluate(() => showAddCrMission());
      await page.waitForTimeout(600);
      // Toggle has_answer on so the answer field appears
      await page.evaluate(() => {
        const cb = document.querySelector('input#cr-m-has-answer, input[name="cr-has-answer"]');
        if (cb && !cb.checked) { cb.click(); }
      });
      await page.waitForTimeout(300);
    } },
  { name: 'cr-05-mission-special',tab: 'cityrush',  desc: { de: 'Sondermission: jederzeit spielbar, kein GPS, mit Cooldown.', en: 'Special mission: playable any time, no GPS, with cooldown.' },
    setup: async (page) => {
      await page.evaluate(() => showAddCrMission());
      await page.waitForTimeout(600);
      await page.evaluate(() => {
        const cb = document.querySelector('input#cr-m-is-special, input[name="cr-is-special"]');
        if (cb && !cb.checked) { cb.click(); }
      });
      await page.waitForTimeout(300);
    } },
];

async function cycleLangTo(page, lang) {
  for (let i = 0; i < 6; i++) {
    const cur = await page.evaluate(() => (typeof gmLang === 'string' ? gmLang : 'de'));
    if (cur === lang) return;
    await page.evaluate(() => cycleGmLang());
    await page.waitForTimeout(150);
  }
}

async function closeAllOverlays(page) {
  await page.evaluate(() => {
    if (typeof closeModal === 'function') closeModal();
    if (typeof closeFreezeModal === 'function') closeFreezeModal();
    if (typeof closeRejectModal === 'function') closeRejectModal();
    if (typeof closeGmSelfieLightbox === 'function') closeGmSelfieLightbox();
    document.querySelectorAll('div[style*="z-index:9000"], div[style*="z-index: 9000"]').forEach(el => el.remove());
  });
  await page.waitForTimeout(150);
}

async function captureLang(base, lang) {
  const outDir = join(OUT_ROOT, `settings-${lang}`);
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: !HEADED });
  const ctx = await browser.newContext({ viewport: { width: 480, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') console.error('  [page]', m.text()); });

  const manifest = [];
  try {
    await page.goto(`${base}/gm.html`, { waitUntil: 'networkidle' });
    await cycleLangTo(page, lang);

    // Capture the gate first
    await page.evaluate(() => showSettingsGate());
    await page.waitForTimeout(400);
    {
      const file = join(outDir, 'adm-01-gate.png');
      await page.screenshot({ path: file, fullPage: true });
      manifest.push({ name: 'adm-01-gate', file: `settings-${lang}/adm-01-gate.png`, desc: SHOTS[0].desc[lang] });
    }

    await page.fill('#gate-pw', PASSWORD);
    await page.click('#sg-unlock');
    await page.waitForTimeout(700);

    for (const shot of SHOTS.slice(1)) {
      await closeAllOverlays(page);

      await page.evaluate((tab) => {
        const btn = document.getElementById('st-' + tab);
        if (btn && typeof switchSettingsTab === 'function') switchSettingsTab(tab, btn);
      }, shot.tab);
      await page.waitForTimeout(500);

      if (shot.setup) {
        try { await shot.setup(page); } catch (e) { console.warn(`setup '${shot.name}':`, e.message); }
      }
      await page.waitForTimeout(300);

      const file = join(outDir, `${shot.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      manifest.push({ name: shot.name, file: `settings-${lang}/${shot.name}.png`, desc: shot.desc[lang] });
    }
  } finally {
    await browser.close();
  }

  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`[settings/${lang}] ${manifest.length} shots → ${outDir}`);
}

(async () => {
  const f = await boot();
  try {
    for (const lang of LANGS) await captureLang(f.base, lang);
  } finally {
    f.cleanup();
  }
})().catch(e => { console.error(e); process.exit(1); });
