#!/usr/bin/env node
// ── handbook/scripts/capture-gm.mjs ─────────────────────────────────────────
// Operator manual screenshots, split into two parts:
//   Part 1 (m-XX)  — MiSSiONS games: landing → game → dashboard → team
//                    detail with a pending submission → lightbox + rotate →
//                    freeze modal → broadcast → chat → settings gate.
//   Part 2 (cr-XX) — CityRush games: landing tile → game-select → CR
//                    dashboard → CR team detail → map panel.
//
// Captured in DE and EN. Output in handbook/screenshots/gm-<lang>/.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { boot, PROJECT_ROOT } from './_fixture.mjs';

const require = createRequire(import.meta.url);
process.env.NODE_PATH = [process.env.NODE_PATH, 'C:/Users/darkh/AppData/Roaming/npm/node_modules'].filter(Boolean).join(';');
require('node:module').Module._initPaths();
const { chromium } = require('playwright');

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_ROOT  = join(PROJECT_ROOT, 'handbook', 'screenshots');

const args   = Object.fromEntries(process.argv.slice(2).map(a => a.startsWith('--') ? a.slice(2).split('=') : [a, true]));
const HEADED = !!args.headed;
const LANGS  = args.lang ? [args.lang] : ['de', 'en'];

// Per-shot captions in all five UI languages.
const DESC = {
  // ── PART 1: MiSSiONS ──────────────────────────────────────────────────────
  'm-01-landing':       { de: 'Startbildschirm — Standort wählen (oder unten die CityRush-Kachel).',
                          en: 'Landing screen — pick a location (or the CityRush tile at the bottom).',
                          fr: 'Écran d’accueil — choisir un emplacement (ou la tuile CityRush en bas).',
                          it: 'Schermata iniziale — scegli una posizione (o la tessera CityRush in basso).',
                          es: 'Pantalla de inicio: elige una ubicación (o la casilla CityRush abajo).' },
  'm-02-game-select':   { de: 'Spielauswahl: Modus wählen, neues Spiel anlegen oder bestehendes öffnen.',
                          en: 'Game select: pick a mode, start a new game or reopen an existing one.',
                          fr: 'Sélection de partie : choisir un mode, créer une partie ou rouvrir une existante.',
                          it: 'Selezione partita: scegli una modalità, avvia una nuova partita o riapri una esistente.',
                          es: 'Selección de partida: elige un modo, inicia una partida nueva o reabre una existente.' },
  'm-03-dashboard':     { de: 'Dashboard: Timer, Team-Chips, Chat- und Broadcast-Spalte rechts.',
                          en: 'Dashboard: timer, team chips, chat + broadcast panel on the right.',
                          fr: 'Tableau de bord : minuteur, pastilles d’équipe, panneau chat + diffusion à droite.',
                          it: 'Dashboard: timer, chip squadra, pannello chat + broadcast a destra.',
                          es: 'Panel de control: temporizador, fichas de equipo, panel de chat + difusión a la derecha.' },
  'm-04-team-detail':   { de: 'Team-Detail mit einer offenen Einreichung — links die Vorschau, daneben Annehmen/Ablehnen.',
                          en: 'Team detail with a pending submission — preview on the left, Accept/Reject next to it.',
                          fr: 'Détail d’équipe avec une soumission en attente — aperçu à gauche, Accepter/Refuser à droite.',
                          it: 'Dettaglio squadra con un invio in attesa: anteprima a sinistra, Accetta/Rifiuta accanto.',
                          es: 'Detalle del equipo con un envío pendiente: vista previa a la izquierda, Aceptar/Rechazar al lado.' },
  'm-05-lightbox':      { de: 'Vorschau-Bild vergrössert: Drehen-Knopf oben rechts, mit ✕ schliessen.',
                          en: 'Enlarged preview: rotate button top-right, close with ✕.',
                          fr: 'Aperçu agrandi : bouton de rotation en haut à droite, fermer avec ✕.',
                          it: 'Anteprima ingrandita: pulsante di rotazione in alto a destra, chiudi con ✕.',
                          es: 'Vista previa ampliada: botón de rotación arriba a la derecha, cerrar con ✕.' },
  'm-06-lightbox-rot':  { de: 'Dasselbe Bild nach einem Klick auf „↻ Drehen" — Drehung in 90°-Schritten.',
                          en: 'Same image after clicking “↻ Rotate” — rotation in 90° steps.',
                          fr: 'Même image après un clic sur « ↻ Rotation » — rotation par paliers de 90°.',
                          it: 'Stessa immagine dopo un clic su «↻ Ruota»: rotazione a passi di 90°.',
                          es: 'La misma imagen tras pulsar «↻ Rotar»: rotación en pasos de 90°.' },
  'm-07-reject-modal':  { de: 'Ablehnen-Dialog: Begründung wird dem Team mitgeteilt.',
                          en: 'Reject dialog: the reason is shown to the team.',
                          fr: 'Boîte de dialogue de refus : la raison est communiquée à l’équipe.',
                          it: 'Finestra di rifiuto: il motivo viene comunicato alla squadra.',
                          es: 'Cuadro de rechazo: el motivo se comunica al equipo.' },
  'm-08-broadcast':     { de: 'Broadcast-Panel: Nachricht an alle Teams gleichzeitig.',
                          en: 'Broadcast panel: send a message to every team at once.',
                          fr: 'Panneau de diffusion : envoyer un message à toutes les équipes en même temps.',
                          it: 'Pannello broadcast: invia un messaggio a tutte le squadre contemporaneamente.',
                          es: 'Panel de difusión: envía un mensaje a todos los equipos a la vez.' },
  'm-09-chat':          { de: 'Team-Chat: 1-zu-1 mit dem im Hauptbereich gewählten Team.',
                          en: 'Team chat: 1-to-1 with whichever team is selected in the main area.',
                          fr: 'Chat d’équipe : 1-à-1 avec l’équipe sélectionnée dans la zone principale.',
                          it: 'Chat squadra: 1 a 1 con la squadra selezionata nell’area principale.',
                          es: 'Chat de equipo: 1 a 1 con el equipo seleccionado en el área principal.' },
  'm-10-settings-gate': { de: 'Einstellungs-Tür — ohne GM-Passwort kein Zugriff für Operator.',
                          en: 'Settings gate — no access for operators without the GM password.',
                          fr: 'Porte des réglages — aucun accès pour les opérateurs sans le mot de passe GM.',
                          it: 'Porta delle impostazioni — nessun accesso per gli operatori senza la password GM.',
                          es: 'Puerta de ajustes: sin la contraseña del GM, los operadores no tienen acceso.' },

  // ── PART 2: CityRush ──────────────────────────────────────────────────────
  'cr-01-landing':       { de: 'CityRush-Kachel am unteren Rand des Startbildschirms.',
                           en: 'CityRush tile at the bottom of the landing screen.',
                           fr: 'Tuile CityRush en bas de l’écran d’accueil.',
                           it: 'Tessera CityRush in basso nella schermata iniziale.',
                           es: 'Casilla CityRush abajo en la pantalla de inicio.' },
  'cr-02-game-select':   { de: 'CityRush-Spielauswahl: Modus wählen statt Standort.',
                           en: 'CityRush game select: choose a mode instead of a location.',
                           fr: 'Sélection de partie CityRush : choisir un mode au lieu d’un emplacement.',
                           it: 'Selezione partita CityRush: scegli una modalità invece di una posizione.',
                           es: 'Selección de partida CityRush: elige un modo en lugar de una ubicación.' },
  'cr-03-dashboard':     { de: 'CityRush-Dashboard: gleiche Layout-Idee wie bei MiSSiONS, aber mit Karten-Tab.',
                           en: 'CityRush dashboard: same layout as MiSSiONS, but with a map tab.',
                           fr: 'Tableau de bord CityRush : même disposition que MiSSiONS, avec un onglet carte.',
                           it: 'Dashboard CityRush: stesso layout di MiSSiONS, ma con una scheda mappa.',
                           es: 'Panel CityRush: mismo diseño que MiSSiONS, pero con una pestaña de mapa.' },
  'cr-04-team-detail':   { de: 'CityRush-Team-Detail: Karten zeigen Reihenfolge, GPS-Status und Sondermissionen.',
                           en: 'CityRush team detail: cards show order, GPS status and special missions.',
                           fr: 'Détail d’équipe CityRush : les cartes affichent l’ordre, le statut GPS et les missions spéciales.',
                           it: 'Dettaglio squadra CityRush: le schede mostrano l’ordine, lo stato GPS e le missioni speciali.',
                           es: 'Detalle del equipo CityRush: las tarjetas muestran el orden, el estado del GPS y las misiones especiales.' },
  'cr-05-map':           { de: 'Karten-Panel: alle Missionen als Marker; Vollbild-Toggle oben rechts.',
                           en: 'Map panel: every mission as a marker; fullscreen toggle top-right.',
                           fr: 'Panneau carte : chaque mission est un marqueur ; bascule plein écran en haut à droite.',
                           it: 'Pannello mappa: ogni missione è un marker; toggle a tutto schermo in alto a destra.',
                           es: 'Panel del mapa: cada misión es un marcador; conmutador a pantalla completa arriba a la derecha.' },
  'cr-06-freeze':        { de: 'Rivalen einfrieren: PvP-Mechanik nur in CityRush — Ziel-Team und Minuten wählen.',
                           en: 'Freeze a rival: PvP mechanic — CityRush only — pick target team and minutes.',
                           fr: 'Geler un rival : mécanique PvP — CityRush uniquement — choisir l’équipe cible et la durée.',
                           it: 'Congela un rivale: meccanica PvP solo per CityRush — scegli la squadra bersaglio e i minuti.',
                           es: 'Congela a un rival: mecánica PvP solo en CityRush: elige el equipo objetivo y los minutos.' },
};

async function cycleLangTo(page, lang) {
  for (let i = 0; i < 6; i++) {
    const cur = await page.evaluate(() => (typeof gmLang === 'string' ? gmLang : 'de'));
    if (cur === lang) return;
    await page.evaluate(() => cycleGmLang());
    await page.waitForTimeout(150);
  }
}

// Tear down EVERY known overlay/modal between shots so nothing leaks.
async function closeAllOverlays(page) {
  await page.evaluate(() => {
    if (typeof closeModal === 'function') closeModal();
    if (typeof closeFreezeModal === 'function') closeFreezeModal();
    if (typeof closeGmSelfieLightbox === 'function') closeGmSelfieLightbox();
    // The reject modal closes via direct style.display='none' (no helper fn)
    const rj = document.getElementById('reject-modal');
    if (rj) rj.style.display = 'none';
    // Generic lightboxes created by openLightbox() are appended to body
    document.querySelectorAll('div[style*="z-index:9000"], div[style*="z-index: 9000"]').forEach(el => el.remove());
  });
  await page.waitForTimeout(200);
}

async function snap(page, dir, lang, name) {
  const file = join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return { name, file: `gm-${lang}/${name}.png`, desc: DESC[name][lang] };
}

async function captureLang(base, fixture, lang) {
  const { gameId, crGameId, teamIds, pendingMissionId, locs } = fixture;
  const altstadt = locs.find(l => l.name === 'Altstadt');

  const outDir = join(OUT_ROOT, `gm-${lang}`);
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: !HEADED });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 820 }, deviceScaleFactor: 2 });
  // Patch Leaflet factory functions so null/undefined coords (from special
  // missions etc.) don't crash the map. Known app bug, tracked separately.
  await ctx.addInitScript(() => {
    const tick = () => {
      if (!window.L) { setTimeout(tick, 50); return; }
      const validCoords = (latlng) => {
        if (!latlng) return false;
        if (Array.isArray(latlng)) return latlng[0] != null && latlng[1] != null && !Number.isNaN(+latlng[0]) && !Number.isNaN(+latlng[1]);
        return latlng.lat != null && latlng.lng != null;
      };
      const noop = { addTo: () => noop, on: () => noop, bindPopup: () => noop, openPopup: () => noop, setIcon: () => noop, getLatLng: () => null, remove: () => noop };
      for (const k of ['marker', 'circle', 'circleMarker', 'polygon', 'polyline']) {
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
    await page.goto(`${base}/gm.html`, { waitUntil: 'networkidle' });
    await cycleLangTo(page, lang);

    // ── PART 1: MiSSiONS ────────────────────────────────────────────────────
    await closeAllOverlays(page);
    manifest.push(await snap(page, outDir, lang, 'm-01-landing'));

    await page.evaluate((id) => selectLocation(id, 'Altstadt'), altstadt.id);
    await page.waitForTimeout(700);
    manifest.push(await snap(page, outDir, lang, 'm-02-game-select'));

    await page.evaluate((gid) => openDashboard(gid), gameId);
    await page.waitForTimeout(1200);
    await closeAllOverlays(page);

    // Hide CityRush-only UI for MiSSiONS captures. The HTML renders these
    // unconditionally (map tab and freeze/thaw buttons) but they only make
    // sense in a CityRush game. paintTeamDetailFreezeButtons re-paints the
    // freeze button on every selectTeam, so we install a body-class-scoped
    // CSS rule with !important and toggle the class on/off between MiSSiONS
    // and CityRush captures.
    await page.addStyleTag({ content: `
      body.gm-mode-missions #tab-crmap,
      body.gm-mode-missions #btn-freeze-team,
      body.gm-mode-missions #btn-thaw-team { display: none !important; }
    ` });
    await page.evaluate(() => document.body.classList.add('gm-mode-missions'));
    const hideCrOnlyUI = async () => {/* CSS rule via body class handles it */};
    manifest.push(await snap(page, outDir, lang, 'm-03-dashboard'));

    // Select Team Rot (has the pending submission). After selectTeam re-paints
    // the freeze button on the team header, hide it again for MiSSiONS shots.
    await page.evaluate((tid) => selectTeam(Number(tid)), teamIds[0]);
    await page.waitForTimeout(700);
    await hideCrOnlyUI();
    manifest.push(await snap(page, outDir, lang, 'm-04-team-detail'));

    // Open the lightbox on the pending submission's media_path
    const mediaUrl = await page.evaluate(async (info) => {
      const team = await (await fetch(`/api/games/${info.gameId}/teams/${info.teamId}`)).json();
      const m = team.missions.find(x => x.mission_id === info.mid);
      return m && m.media_path ? `/uploads/${m.media_path}` : null;
    }, { gameId, teamId: teamIds[0], mid: pendingMissionId });
    if (mediaUrl) {
      await page.evaluate((url) => openLightbox(url, false), mediaUrl);
      await page.waitForTimeout(500);
      manifest.push(await snap(page, outDir, lang, 'm-05-lightbox'));

      // Click the "↻ Drehen" button — it's the first button in the lightbox's
      // floating control bar.
      await page.evaluate(() => {
        const bar = document.querySelector('div[style*="z-index:9001"], div[style*="z-index: 9001"]');
        const btn = bar && bar.querySelector('button');
        if (btn) btn.click();
      });
      await page.waitForTimeout(400);
      manifest.push(await snap(page, outDir, lang, 'm-06-lightbox-rot'));
      await closeAllOverlays(page);
    }

    // Reject modal — open against the same pending submission
    await page.evaluate(() => {
      // Find the first Reject button on the page and click it
      const btns = [...document.querySelectorAll('button')].filter(b =>
        /Ablehnen|Reject|Rechazar|Rifiut|Refuser/i.test(b.textContent || ''));
      if (btns[0]) btns[0].click();
    });
    await page.waitForTimeout(500);
    manifest.push(await snap(page, outDir, lang, 'm-07-reject-modal'));
    await closeAllOverlays(page);

    // Broadcast panel — universal feature (both MiSSiONS and CityRush)
    await page.evaluate(() => switchPanel('broadcast', document.getElementById('tab-broadcast')));
    await page.waitForTimeout(300);
    await page.fill('#broadcast-input',
      lang === 'de' ? 'Halbzeit-Erinnerung: 15 Minuten Pause!'
                    : 'Halftime reminder — 15 minute break!');
    await page.waitForTimeout(200);
    await hideCrOnlyUI();  // re-hide after panel switch redraws the header
    manifest.push(await snap(page, outDir, lang, 'm-08-broadcast'));

    // Chat panel — switch back and type
    await page.evaluate(() => switchPanel('chat', document.getElementById('tab-chat')));
    await page.waitForTimeout(300);
    const chatInput = page.locator('#gm-chat-input').first();
    if (await chatInput.isVisible().catch(()=>false)) {
      await chatInput.fill(
        lang === 'de' ? 'Euer Brunnenbild sieht super aus, weiter so!'
                      : 'Your fountain photo looks great — keep it up!');
      await page.waitForTimeout(200);
    }
    await hideCrOnlyUI();
    manifest.push(await snap(page, outDir, lang, 'm-09-chat'));

    // Settings gate (locked)
    await page.evaluate(() => showSettingsGate());
    await page.waitForTimeout(400);
    manifest.push(await snap(page, outDir, lang, 'm-10-settings-gate'));

    // ── PART 2: CityRush ────────────────────────────────────────────────────
    // CityRush IS where the freeze button and map tab belong — re-enable them
    // by dropping the body class that hid them during the MiSSiONS captures.
    await page.evaluate(() => document.body.classList.remove('gm-mode-missions'));
    await page.evaluate(() => goBack());
    await page.waitForTimeout(300);
    await page.evaluate(() => showScreen('screen-landing'));
    await page.waitForTimeout(500);
    await closeAllOverlays(page);
    manifest.push(await snap(page, outDir, lang, 'cr-01-landing'));

    // CityRush game-select uses selectLocation('cityrush', 'CityRush')
    await page.evaluate(() => selectLocation('cityrush', 'CityRush'));
    await page.waitForTimeout(700);
    manifest.push(await snap(page, outDir, lang, 'cr-02-game-select'));

    // Open the CR dashboard
    await page.evaluate((gid) => openDashboard(gid), crGameId);
    await page.waitForTimeout(1500);
    await closeAllOverlays(page);
    manifest.push(await snap(page, outDir, lang, 'cr-03-dashboard'));

    // Select the first CR team for the detail shot
    const firstCrTeam = await page.evaluate(() => {
      const t = document.querySelector('[id^="tc-"]');
      return t ? Number(t.id.slice(3)) : null;
    });
    if (firstCrTeam) {
      await page.evaluate((tid) => selectTeam(tid), firstCrTeam);
      await page.waitForTimeout(700);
      manifest.push(await snap(page, outDir, lang, 'cr-04-team-detail'));
    }

    // Map tab (rightmost panel tab — 🗺️). Swallow any Leaflet error from
    // missions without GPS coords (known bug — tracked separately) so the
    // snap still happens with whatever markers rendered before the throw.
    await page.evaluate(() => {
      try { switchPanel('crmap', document.getElementById('tab-crmap')); }
      catch (e) { console.warn('crmap switch:', e.message); }
    });
    await page.waitForTimeout(1500);
    manifest.push(await snap(page, outDir, lang, 'cr-05-map'));

    // Freeze modal — CityRush-only PvP feature. Switch back to chat panel
    // so the freeze modal isn't competing with a fullscreen map view, then
    // open the modal and pre-select Team Gelb as the rival.
    await page.evaluate(() => switchPanel('chat', document.getElementById('tab-chat')));
    await page.waitForTimeout(300);
    await page.evaluate(() => openFreezeModal());
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter(b => /Team Gelb|Team Yellow/.test(b.textContent || ''));
      if (btns[0]) btns[0].click();
    });
    await page.waitForTimeout(200);
    manifest.push(await snap(page, outDir, lang, 'cr-06-freeze'));
    await closeAllOverlays(page);
  } finally {
    await browser.close();
  }

  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`[gm/${lang}] ${manifest.length} shots → ${outDir}`);
}

(async () => {
  const f = await boot();
  try {
    for (const lang of LANGS) await captureLang(f.base, f.seeded, lang);
  } finally {
    f.cleanup();
  }
})().catch(e => { console.error(e); process.exit(1); });
