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
  { name: 'adm-01-gate',          tab: null,        desc: { de: 'Passwortabfrage zum Öffnen der Einstellungen.', en: 'Password gate to open settings.', fr: 'Porte mot de passe pour ouvrir les réglages.', it: 'Porta password per aprire le impostazioni.', es: 'Puerta de contraseña para abrir los ajustes.' } },
  { name: 'adm-02-general',       tab: 'general',   desc: { de: 'Allgemein-Tab: öffentliche URL und Timeout-Nachricht in allen Sprachen.', en: 'General tab: public URL and timeout message in every language.', fr: 'Onglet Général : URL publique et message de fin de temps dans chaque langue.', it: 'Scheda Generale: URL pubblico e messaggio di timeout in ogni lingua.', es: 'Pestaña General: URL pública y mensaje de tiempo agotado en cada idioma.' } },
  { name: 'adm-03-security',      tab: 'security',  desc: { de: 'Sicherheit: GM-Passwort ändern.', en: 'Security: change the GM password.', fr: 'Sécurité : changer le mot de passe GM.', it: 'Sicurezza: cambia la password GM.', es: 'Seguridad: cambiar la contraseña del GM.' } },
  { name: 'adm-04-updates',       tab: 'updates',   desc: { de: 'Updates: aktuelle Version und Update-Knopf (git pull + npm install).', en: 'Updates: current version and the update button (git pull + npm install).', fr: 'Mises à jour : version actuelle et bouton de mise à jour (git pull + npm install).', it: 'Aggiornamenti: versione corrente e pulsante di aggiornamento (git pull + npm install).', es: 'Actualizaciones: versión actual y botón de actualizar (git pull + npm install).' } },
  { name: 'adm-05-template',      tab: 'template',  desc: { de: 'QR-Vorlage: Papierformat, Upload und QR-Marker-Position.', en: 'QR template: paper size, upload and QR marker drag.', fr: 'Modèle QR : format papier, téléversement et placement du marqueur QR.', it: 'Modello QR: formato carta, caricamento e trascinamento del marker QR.', es: 'Plantilla QR: tamaño de papel, subida y arrastre del marcador QR.' } },

  // MiSSiONS
  { name: 'm-01-locations',       tab: 'locations', desc: { de: 'Standorte-Tab mit den drei Demostandorten.', en: 'Locations tab listing three demo locations.', fr: 'Onglet Emplacements avec les trois emplacements de démo.', it: 'Scheda Posizioni con le tre posizioni demo.', es: 'Pestaña Ubicaciones con las tres ubicaciones de demostración.' } },
  { name: 'm-02-locations-add',   tab: 'locations', desc: { de: 'Modal „Standort hinzufügen" mit allen Optionen.', en: '“Add location” modal showing every option.', fr: 'Boîte « Ajouter un emplacement » avec toutes les options.', it: 'Finestra «Aggiungi posizione» con tutte le opzioni.', es: 'Cuadro «Añadir ubicación» con todas las opciones.' },
    setup: async (page) => { await page.evaluate(() => showAddLocation()); await page.waitForTimeout(400); } },
  { name: 'm-03-missions',        tab: 'missions',  desc: { de: 'MiSSiONS-Tab: Modus-Tabs, Standortfilter und Missionsliste.', en: 'MiSSiONS tab: mode bar, location filter and mission list.', fr: 'Onglet MiSSiONS : barre de modes, filtre par emplacement et liste de missions.', it: 'Scheda MiSSiONS: barra modalità, filtro posizioni ed elenco missioni.', es: 'Pestaña MiSSiONS: barra de modos, filtro de ubicaciones y lista de misiones.' } },
  { name: 'm-04-mission-add',     tab: 'missions',  desc: { de: 'Modal „MiSSiON hinzufügen" mit Mehrsprachen-Editor und Auto-Übersetzen.', en: '“Add MiSSiON” modal with the multi-language editor and auto-translate.', fr: 'Boîte « Ajouter une MiSSiON » avec l’éditeur multilingue et l’auto-traduction.', it: 'Finestra «Aggiungi MiSSiON» con l’editor multilingue e la traduzione automatica.', es: 'Cuadro «Añadir MiSSiON» con el editor multilenguaje y la traducción automática.' },
    setup: async (page) => { await page.evaluate(() => showAddMission()); await page.waitForTimeout(500); } },
  { name: 'm-05-rules',           tab: 'rules',     desc: { de: 'Regeln-Tab: Regelwerk-Auswahl und Regelliste mit Drag-Sortierung.', en: 'Rules tab: ruleset switcher and rule list with drag-reordering.', fr: 'Onglet Règles : sélecteur de jeu de règles et liste de règles avec tri par glisser.', it: 'Scheda Regole: selettore di insieme regole ed elenco con riordino trascinabile.', es: 'Pestaña Reglas: selector de conjunto de reglas y lista con reordenación arrastrable.' } },

  // CityRush
  { name: 'cr-01-modes-empty',    tab: 'cityrush',  desc: { de: 'CityRush-Tab: Modus-Tabs oben und Missionsliste darunter.', en: 'CityRush tab: mode bar at the top, mission list below.', fr: 'Onglet CityRush : barre de modes en haut, liste des missions en dessous.', it: 'Scheda CityRush: barra modalità in alto, elenco missioni sotto.', es: 'Pestaña CityRush: barra de modos arriba, lista de misiones debajo.' } },
  { name: 'cr-02-mode-add',       tab: 'cityrush',  desc: { de: 'Neuer CityRush-Modus: Regelwerk, erlaubte Medien, Standard-Dauer.', en: 'New CityRush mode: ruleset, allowed media, default duration.', fr: 'Nouveau mode CityRush : jeu de règles, médias autorisés, durée par défaut.', it: 'Nuova modalità CityRush: insieme regole, media consentiti, durata predefinita.', es: 'Nuevo modo CityRush: conjunto de reglas, medios permitidos, duración por defecto.' },
    setup: async (page) => { await page.evaluate(() => showAddCrMode()); await page.waitForTimeout(500); } },
  { name: 'cr-03-mission-add',    tab: 'cityrush',  desc: { de: 'Neue CityRush-Mission: GPS-Ziel, Radius, Karten-Anzeige.', en: 'New CityRush mission: GPS target, radius, map visibility.', fr: 'Nouvelle mission CityRush : cible GPS, rayon, visibilité sur la carte.', it: 'Nuova missione CityRush: target GPS, raggio, visibilità sulla mappa.', es: 'Nueva misión CityRush: objetivo GPS, radio, visibilidad en el mapa.' },
    setup: async (page) => { await page.evaluate(() => showAddCrMission()); await page.waitForTimeout(600); } },
  { name: 'cr-04-mission-answer', tab: 'cityrush',  desc: { de: 'CityRush-Mission mit Antwort-Modus statt Medien.', en: 'CityRush mission in answer mode instead of media.', fr: 'Mission CityRush en mode réponse au lieu de média.', it: 'Missione CityRush in modalità risposta invece di media.', es: 'Misión CityRush en modo respuesta en vez de medios.' },
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
  { name: 'cr-05-mission-special',tab: 'cityrush',  desc: { de: 'Sondermission: jederzeit spielbar, kein GPS, mit Cooldown.', en: 'Special mission: playable any time, no GPS, with cooldown.', fr: 'Mission spéciale : jouable à tout moment, sans GPS, avec délai de récupération.', it: 'Missione speciale: giocabile in qualsiasi momento, senza GPS, con cooldown.', es: 'Misión especial: jugable en cualquier momento, sin GPS, con tiempo de espera.' },
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
  // Desktop viewport so the settings UI renders in its wide-layout mode
  // (sidebar + form-grid) rather than the responsive mobile stack. Matches
  // the GM capture script's scale.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
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
