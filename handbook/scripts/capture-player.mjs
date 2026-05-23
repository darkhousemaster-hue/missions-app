#!/usr/bin/env node
// ── handbook/scripts/capture-player.mjs ─────────────────────────────────────
// Player-side handbook screenshots at phone resolution (390×844, iPhone 14
// portrait). Two parts, mirroring the GM script's naming:
//   m-XX   — MiSSiONS player flow: join → home → mission detail → chat
//   cr-XX  — CityRush player flow: home (tiles + mini-map + special button)
//             → fullscreen map → frozen state
//
// Output in handbook/screenshots/player-<lang>/.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { boot, PROJECT_ROOT, placeholderPhotoPng } from './_fixture.mjs';

const require = createRequire(import.meta.url);
process.env.NODE_PATH = [process.env.NODE_PATH, 'C:/Users/darkh/AppData/Roaming/npm/node_modules'].filter(Boolean).join(';');
require('node:module').Module._initPaths();
const { chromium } = require('playwright');

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_ROOT  = join(PROJECT_ROOT, 'handbook', 'screenshots');

const args   = Object.fromEntries(process.argv.slice(2).map(a => a.startsWith('--') ? a.slice(2).split('=') : [a, true]));
const HEADED = !!args.headed;
const LANGS  = args.lang ? [args.lang] : ['de', 'en'];

// Per-shot captions in both languages.
const DESC = {
  // ── PART 1: MiSSiONS player ───────────────────────────────────────────────
  'm-01-join':            { de: 'Beitritts-Bildschirm: Selfie aufnehmen, Teamnamen eingeben, Sprache wählen.',
                            en: 'Join screen: take a selfie, enter the team name, pick a language.' },
  'm-02-join-existing':   { de: 'Bestehendem Team beitreten: Liste der laufenden Teams mit Punktestand.',
                            en: 'Join an existing team: list of running teams with their current score.' },
  'm-03-home':            { de: 'MiSSiONS-Spielerübersicht: Missionskarten mit Filter-Leiste und Status-Pillen.',
                            en: 'MiSSiONS player home: mission cards with the filter strip and status pills.' },
  'm-04-mission-detail':  { de: 'Missions-Detailansicht: Aufgabe, Punkte und Aufnahme-/Upload-Buttons.',
                            en: 'Mission detail sheet: task, points and the capture / upload buttons.' },
  'm-05-chat':            { de: 'Chat-Tab: 1-zu-1-Konversation mit dem Spielleiter.',
                            en: 'Chat tab: 1-to-1 conversation with the Gamemaster.' },

  // ── PART 2: CityRush player ───────────────────────────────────────────────
  'cr-01-home':           { de: 'CityRush-Spieleransicht: Mini-Karte, Fortschritt und Missionskacheln in Reihenfolge.',
                            en: 'CityRush player home: mini-map, progress bar and mission tiles in route order.' },
  'cr-02-special-btn':    { de: 'Goldener Stern unten — Schnellzugriff auf die einzige Sondermission.',
                            en: 'Gold star at the bottom — shortcut to the lone special mission.' },
  'cr-03-fullscreen-map': { de: 'Vollbild-Karte: tippen auf die Mini-Karte; alle Stopps als Marker.',
                            en: 'Fullscreen map: tap the mini-map; every stop appears as a marker.' },
  'cr-04-frozen':         { de: 'Eingefroren: blau gefärbtes Banner oben, Abgabe gesperrt bis Timer abläuft.',
                            en: 'Frozen: blue banner at the top, submissions locked until the timer expires.' },
};

async function snap(page, dir, lang, name) {
  const file = join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return { name, file: `player-${lang}/${name}.png`, desc: DESC[name][lang] };
}

// Switch the per-page language by writing the storage key the page reads on
// load + calling its own setter if one is exposed. Both join.html and
// play.html persist to localStorage['m_lang']; cityrush.html uses 'cr_lang'.
async function setPlayerLang(page, lang) {
  await page.evaluate((l) => {
    localStorage.setItem('m_lang', l);
    localStorage.setItem('cr_lang', l);
    if (typeof window.setJoinLang === 'function') window.setJoinLang(l);
    if (typeof window.setPlayLang === 'function') window.setPlayLang(l);
    if (typeof window.crSetLang  === 'function') window.crSetLang(l);
  }, lang);
  await page.waitForTimeout(200);
}

async function captureLang(base, fixture, lang) {
  const { gameId, crGameId, teamIds } = fixture;
  const teamA = teamIds[0];

  const outDir = join(OUT_ROOT, `player-${lang}`);
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: !HEADED });
  // 390×844 = iPhone 14 portrait. Mobile UA gives realistic CSS env() values.
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  // Stub Leaflet construction the same way the GM capture does, so a CR
  // mission with no coords doesn't blow up the mini-map.
  await ctx.addInitScript(() => {
    const tick = () => {
      if (!window.L) { setTimeout(tick, 50); return; }
      const validCoords = (latlng) => {
        if (!latlng) return false;
        if (Array.isArray(latlng)) return latlng[0] != null && latlng[1] != null;
        return latlng.lat != null && latlng.lng != null;
      };
      const noop = { addTo: () => noop, on: () => noop, bindPopup: () => noop, openPopup: () => noop, setIcon: () => noop, getLatLng: () => null, remove: () => noop };
      for (const k of ['marker','circle','circleMarker','polygon','polyline']) {
        const orig = window.L[k];
        if (typeof orig === 'function') {
          window.L[k] = function(latlng, ...rest) {
            if (!validCoords(latlng)) return noop;
            return orig.call(this, latlng, ...rest);
          };
        }
      }
    };
    tick();
  });

  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') console.error('  [page]', m.text()); });
  page.on('pageerror', e => console.warn('  [pageerror]', e.message));

  const manifest = [];
  try {
    // ── M-01 join screen — defaults to the create-new view; the "Or join
    //    existing team" link is visible because the seeded game already has
    //    two teams.
    await page.goto(`${base}/join.html?game=${gameId}`, { waitUntil: 'networkidle' });
    await setPlayerLang(page, lang);
    await page.waitForTimeout(600);
    // Pre-fill the team name so the captured screen looks lived-in.
    await page.evaluate((name) => {
      const i = document.getElementById('team-name');
      if (i) i.value = name;
    }, lang === 'de' ? 'Team Phönix' : 'Team Phoenix');
    manifest.push(await snap(page, outDir, lang, 'm-01-join'));

    // ── M-02 join-existing panel
    await page.evaluate(() => { if (typeof showJoinExisting === 'function') showJoinExisting(); });
    await page.waitForTimeout(400);
    manifest.push(await snap(page, outDir, lang, 'm-02-join-existing'));

    // ── M-03 player home. Resume an existing team so the home view has data.
    await page.goto(`${base}/play.html?game=${gameId}&team=${teamA}`, { waitUntil: 'networkidle' });
    await setPlayerLang(page, lang);
    await page.waitForTimeout(1200);
    manifest.push(await snap(page, outDir, lang, 'm-03-home'));

    // ── M-04 mission detail — open the first listed mission.
    const firstMissionId = await page.evaluate(() => {
      const card = document.querySelector('[id^="mc-"]');
      return card ? Number(card.id.slice(3)) : null;
    });
    if (firstMissionId && await page.evaluate(() => typeof openMissionDetail === 'function')) {
      await page.evaluate((mid) => openMissionDetail(mid), firstMissionId);
      await page.waitForTimeout(500);
      manifest.push(await snap(page, outDir, lang, 'm-04-mission-detail'));
      // Close the sheet so the chat view isn't covered.
      await page.evaluate(() => { if (typeof closeMissionDetail === 'function') closeMissionDetail(); });
      await page.waitForTimeout(300);
    }

    // ── M-05 chat tab
    await page.evaluate(() => { if (typeof showView === 'function') showView('chat'); });
    await page.waitForTimeout(500);
    manifest.push(await snap(page, outDir, lang, 'm-05-chat'));

    // ── CR-01 CityRush home. Pull the first CR team via the API.
    const crGame = await fetch(`${base}/api/games/${crGameId}`).then(r => r.json());
    const crTeamA = crGame.teams?.[0]?.id;
    if (!crTeamA) throw new Error('seeded CR game has no teams');

    // Upload a synthetic selfie for the CR team so the team-selfie overlay
    // doesn't gate the screen on first load. Reuses the fixture's 60×80
    // gradient PNG (same one the MiSSiONS pending-submission demo uses).
    {
      const fd = new FormData();
      fd.append('media', new Blob([placeholderPhotoPng()], { type: 'image/png' }), 'selfie.png');
      await fetch(`${base}/api/games/${crGameId}/teams/${crTeamA}/selfie`, { method: 'POST', body: fd });
    }

    await page.goto(`${base}/cityrush.html?game=${crGameId}&team=${crTeamA}`, { waitUntil: 'networkidle' });
    await setPlayerLang(page, lang);
    await page.waitForTimeout(2000);
    // Belt-and-braces: hide the selfie overlay if it still rendered, force
    // the special button (the seeded data may not have exactly one special
    // for this team), and snap-back to the mission view (the bootstrap may
    // have left us on the map).
    await page.evaluate(() => {
      const ov = document.getElementById('cr-selfie-overlay');
      if (ov) ov.style.display = 'none';
      window._specialBtnWanted = true;
      const btn = document.getElementById('cr-special-btn');
      if (btn) btn.style.display = 'flex';
      if (typeof crShowView === 'function') crShowView('mission');
    });
    await page.waitForTimeout(600);
    manifest.push(await snap(page, outDir, lang, 'cr-01-home'));

    // ── CR-02 zoomed crop of the special-mission star button. We crop the
    //    bottom strip of the same shot, programmatically.
    const btnBox = await page.evaluate(() => {
      const b = document.getElementById('cr-special-btn');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: Math.max(0, r.x - 80), y: Math.max(0, r.y - 80), w: r.width + 160, h: r.height + 160 };
    });
    if (btnBox) {
      await page.screenshot({
        path: join(outDir, 'cr-02-special-btn.png'),
        clip: { x: btnBox.x, y: btnBox.y, width: btnBox.w, height: btnBox.h },
      });
      manifest.push({ name: 'cr-02-special-btn', file: `player-${lang}/cr-02-special-btn.png`, desc: DESC['cr-02-special-btn'][lang] });
    }

    // ── CR-03 fullscreen map
    await page.evaluate(() => { if (typeof crShowView === 'function') crShowView('map'); });
    await page.waitForTimeout(1200);
    manifest.push(await snap(page, outDir, lang, 'cr-03-fullscreen-map'));

    // ── CR-04 frozen state. Go back to mission view, drive a freeze via the
    //    API, dismiss the overlay so the banner + blue tint is what we see.
    await page.evaluate(() => { if (typeof crShowView === 'function') crShowView('mission'); });
    await page.waitForTimeout(400);
    const crTeamB = crGame.teams?.[1]?.id;
    if (crTeamB) {
      await fetch(`${base}/api/games/${crGameId}/freeze`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ freezerTeamId: crTeamB, frozenTeamId: crTeamA, durationSeconds: 120 }),
      });
      await page.waitForTimeout(2000);
      await page.evaluate(() => {
        const btn = document.getElementById('cr-frozen-close');
        if (btn) btn.click();
      });
      await page.waitForTimeout(500);
      manifest.push(await snap(page, outDir, lang, 'cr-04-frozen'));
    }
  } finally {
    await browser.close();
  }

  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`[player/${lang}] ${manifest.length} shots → ${outDir}`);
}

(async () => {
  const f = await boot();
  try {
    for (const lang of LANGS) await captureLang(f.base, f.seeded, lang);
  } finally {
    f.cleanup();
  }
})().catch(e => { console.error(e); process.exit(1); });
