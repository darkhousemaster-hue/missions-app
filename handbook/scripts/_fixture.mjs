// ── handbook/scripts/_fixture.mjs ───────────────────────────────────────────
// Boots missions-app against a throw-away DB + uploads dir, seeds it with
// enough realistic data that every screen in the manuals has something
// meaningful to render, and returns { base, server, cleanup }.
//
// Importable from capture scripts. Does NOT touch production data — both
// DB_PATH and UPLOAD_DIR are overridden via env.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import net from 'node:net';
const require = createRequire(import.meta.url);  // for node:zlib in placeholderPhotoPng

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = join(__dirname, '..', '..');
export const PASSWORD = 'admin1898';  // default seeded password

function freePort() {
  return new Promise(res => {
    const s = net.createServer();
    s.unref();
    s.listen(0, () => { const { port } = s.address(); s.close(() => res(port)); });
  });
}

async function waitForPort(port, ms = 15000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const ok = await new Promise(r => {
      const s = net.connect(port, '127.0.0.1');
      s.once('connect', () => { s.end(); r(true); });
      s.once('error',   () => r(false));
    });
    if (ok) return;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`server never opened :${port}`);
}

async function api(base, path, { method = 'GET', body } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${await r.text()}`);
  return r.headers.get('content-type')?.includes('json') ? r.json() : r.text();
}

async function seed(base) {
  const pw = PASSWORD;

  // Locations
  const locs = [];
  for (const l of [
    { name: 'Altstadt',       min_location_missions: 3, allow_photo: 1, allow_video: 1, allow_indoor: 1 },
    { name: 'Stadtpark',      min_location_missions: 2, allow_photo: 1, allow_video: 1, allow_indoor: 0 },
    { name: 'Hauptbahnhof',   min_location_missions: 2, allow_photo: 1, allow_video: 1, allow_indoor: 1 },
  ]) {
    const r = await api(base, '/api/locations', { method: 'POST', body: { password: pw, ...l } });
    locs.push({ id: r.id, ...l });
  }

  // A second ruleset
  await api(base, '/api/rulesets', { method: 'POST', body: { password: pw, name: 'Family' } });

  // A second mode
  const advanced = await api(base, '/api/modes', { method: 'POST', body: { password: pw, name: 'ADVANCED', ruleset_id: 1, timer_default: 90 } });

  // Missions across modes/locations. Multi-language so the language switch
  // demo actually shows different text.
  const missionDefs = [
    { mode: 1, loc: locs[0].id, name_de: 'Brunnen-Selfie',     name_en: 'Fountain selfie',     name_fr: 'Selfie à la fontaine',  name_it: 'Selfie alla fontana',   name_es: 'Selfie en la fuente',     points: 10, media_type: 'photo',
      description_de: 'Sucht den ältesten Brunnen der Altstadt.', description_en: 'Find the oldest fountain in the old town.',
      task_de: 'Macht ein Gruppenfoto mit dem Brunnen.',        task_en: 'Take a group photo with the fountain.' },
    { mode: 1, loc: locs[0].id, name_de: 'Inschrift entdecken', name_en: 'Spot the inscription', name_fr: 'Repérer l’inscription', name_it: 'Trova l’iscrizione', name_es: 'Encuentra la inscripción', points: 15, media_type: 'photo',
      description_de: 'An einer der Hausfassaden ist eine Jahreszahl in Stein gemeißelt.', description_en: 'A year is carved on one of the facades.',
      task_de: 'Filmt die Inschrift und nennt das Jahr.', task_en: 'Film the inscription and read out the year.' },
    { mode: 1, loc: locs[1].id, name_de: 'Baum umarmen', name_en: 'Hug a tree', name_fr: 'Câliner un arbre', name_it: 'Abbraccia un albero', name_es: 'Abraza un árbol', points: 5, media_type: 'video',
      description_de: 'Im Park steht eine alte Eiche.', description_en: 'There’s an old oak in the park.',
      task_de: 'Filmt das ganze Team beim Baumumarmen.', task_en: 'Film the whole team hugging the tree.' },
    { mode: 1, loc: locs[2].id, name_de: 'Ankunftstafel ablesen', name_en: 'Read the arrivals board', name_fr: 'Lis le panneau d’arrivées', name_it: 'Leggi il tabellone arrivi', name_es: 'Lee el panel de llegadas', points: 5, media_type: 'photo',
      description_de: 'Geht zur grossen Ankunftstafel im Hauptbahnhof.', description_en: 'Find the big arrivals board at the main station.',
      task_de: 'Macht ein Foto mit dem aktuellen ersten Eintrag.', task_en: 'Take a photo with the top entry.' },
    { mode: 1, loc: null,        name_de: 'Hochformat-Logo', name_en: 'Vertical logo shot', name_fr: 'Logo vertical', name_it: 'Logo verticale', name_es: 'Logo vertical', points: 20, media_type: 'video',
      description_de: 'Findet ein bekanntes Firmenlogo in eurer Umgebung.', description_en: 'Find a well-known company logo nearby.',
      task_de: 'Filmt das Logo hochkant, mit allen Spielern im Bild.', task_en: 'Film the logo vertically with everyone in frame.' },
    { mode: advanced.id, loc: locs[0].id, name_de: 'Stadtgeschichte erzählen', name_en: 'Tell the city story', name_fr: 'Raconter l’histoire de la ville', name_it: 'Racconta la storia della città', name_es: 'Cuenta la historia de la ciudad', points: 25, media_type: 'video',
      description_de: 'Recherchiert kurz und erzählt einen historischen Fakt zur Altstadt.', description_en: 'Briefly research and tell a historic fact about the old town.',
      task_de: 'Nehmt ein 30-Sekunden-Video mit eurer Geschichte auf.', task_en: 'Record a 30-second video with your fact.' },
  ];
  for (const m of missionDefs) {
    await api(base, '/api/missions', { method: 'POST', body: {
      password: pw, mode_id: m.mode, location_id: m.loc,
      name_de: m.name_de, name_en: m.name_en, name_fr: m.name_fr, name_it: m.name_it, name_es: m.name_es,
      description_de: m.description_de || '', description_en: m.description_en || '',
      task_de: m.task_de || '', task_en: m.task_en || '',
      points: m.points, media_type: m.media_type,
    }});
  }

  // CityRush mode + a handful of missions including a special and one with hints
  const crMode = await api(base, '/api/cr/modes', { method: 'POST', body: { password: pw, name: 'Altstadt-Tour', ruleset_id: 1, allow_photo: 1, allow_video: 1, timer_default: 60 } });
  const crDefs = [
    { name_de: 'Treffpunkt Marktplatz', name_en: 'Meet at the market square', lat: 47.378, lng: 8.540, radius: 30, points: 30, media_type: 'photo', has_gps: 1, show_on_map: 1, is_special: 0,
      description_de: 'Geht zum Marktplatz in der Altstadt.', description_en: 'Walk to the market square.',
      task_de: 'Macht ein Gruppenfoto am Brunnen.',          task_en: 'Take a group photo at the fountain.' },
    { name_de: 'Skulptur-Rätsel', name_en: 'Sculpture riddle', lat: 47.380, lng: 8.541, radius: 25, points: 40, media_type: 'photo', has_gps: 1, show_on_map: 1, is_special: 0,
      description_de: 'Vor dem Rathaus steht eine bronzene Skulptur.', description_en: 'A bronze sculpture stands in front of the town hall.',
      task_de: 'Welches Tier hält die Figur? Antwortet schriftlich.', task_en: 'Which animal does the figure hold? Type the answer.',
      has_answer: 1, answers: 'Eule|Owl|Hibou|Civetta|Búho' },
    { name_de: '⭐ Spontaner Tanz', name_en: '⭐ Spontaneous dance', is_special: 1, special_cooldown: 5, points: 15, media_type: 'video', has_gps: 0, show_on_map: 0,
      description_de: 'Sondermission – jederzeit spielbar.', description_en: 'Special mission – playable any time.',
      task_de: 'Filmt 10 Sekunden, wie das Team tanzt.', task_en: 'Film 10 seconds of the team dancing.' },
  ];
  for (const m of crDefs) {
    await api(base, '/api/cr/missions', { method: 'POST', body: {
      password: pw, mode_id: crMode.id,
      name_de: m.name_de, name_en: m.name_en, name_fr: '', name_it: '', name_es: '',
      description_de: m.description_de || '', description_en: m.description_en || '',
      task_de: m.task_de || '', task_en: m.task_en || '',
      points: m.points, media_type: m.media_type,
      latitude: m.lat || null, longitude: m.lng || null, radius_meters: m.radius || 20,
      has_gps: m.has_gps || 0, show_on_map: m.show_on_map || 0,
      is_special: m.is_special, special_cooldown_minutes: m.special_cooldown || 0,
      has_answer: m.has_answer || 0, answers: m.answers || '',
      is_timed: 0, time_limit_seconds: 0,
    }});
  }

  // A running MiSSiONS game in Altstadt with two teams
  const game = await api(base, '/api/games', { method: 'POST', body: { location_id: locs[0].id, mode_id: 1 } });
  const teamColors = ['#e63946', '#2a9d8f'];
  const teamNames  = ['Team Rot', 'Team Grün'];
  const teamIds = [];
  for (let i = 0; i < 2; i++) {
    const r = await api(base, `/api/games/${game.id}/teams`, { method: 'POST', body: { name: teamNames[i], color: teamColors[i] } });
    teamIds.push(r.id);
  }

  // Upload a placeholder photo from Team Rot for one of their missions, so
  // the GM team-detail view shows a real pending submission with Accept/
  // Reject buttons. We pull the team's missions, pick the first one, and
  // POST a synthetic PNG to the upload endpoint via multipart.
  const teamData = await api(base, `/api/games/${game.id}/teams/${teamIds[0]}`);
  const firstMission = teamData.missions?.[0];
  let pendingMissionId = null;
  if (firstMission) {
    pendingMissionId = firstMission.mission_id;
    const png = placeholderPhotoPng();
    const fd = new FormData();
    fd.append('media', new Blob([png], { type: 'image/png' }), 'submission.png');
    const r = await fetch(`${base}/api/games/${game.id}/teams/${teamIds[0]}/missions/${pendingMissionId}/upload`, {
      method: 'POST', body: fd,
    });
    if (!r.ok) console.warn('placeholder upload failed:', r.status, await r.text());
  }

  // A running CityRush game using the seeded CR mode, with two teams
  const crGame = await api(base, '/api/games', { method: 'POST', body: { is_cityrush: 1, cr_mode_id: crMode.id } });
  for (let i = 0; i < 2; i++) {
    await api(base, `/api/games/${crGame.id}/teams`, { method: 'POST', body: { name: ['Team Blau','Team Gelb'][i], color: ['#2a72d4','#f4b400'][i] } });
  }

  return { locs, crMode, gameId: game.id, teamIds, pendingMissionId, crGameId: crGame.id };
}

// ── Synthetic PNG for the pending-submission demo ───────────────────────────
// A larger-than-1x1 PNG so the GM lightbox actually has something to display.
// 100x150 dark-themed rectangle with the text "DEMO PHOTO" in the middle.
// Built once at module load, returned as Buffer.
function placeholderPhotoPng() {
  // We can't easily generate a 100×150 PNG without a library, but Node has
  // `node:zlib` and we can construct one. Use a flat fill — small enough to
  // hard-code. (4×6 = 24 px, dark red, scaled up by browsers when rendered.)
  // The browser will scale the lightbox to fit so detail isn't important —
  // we just need a recognisable colored swatch with non-trivial bytes.
  const { deflateSync } = require('node:zlib');
  const W = 60, H = 80;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    const row = y * (W * 4 + 1);
    raw[row] = 0; // filter: None
    for (let x = 0; x < W; x++) {
      const o = row + 1 + x * 4;
      // Diagonal red→orange gradient on a dark background
      const t = (x + y) / (W + H);
      raw[o]     = Math.floor(180 + 50 * t); // R
      raw[o + 1] = Math.floor(40 + 80 * t);  // G
      raw[o + 2] = 30;                       // B
      raw[o + 3] = 255;                      // A
    }
  }
  const idat = deflateSync(raw);
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0, 0);
    return Buffer.concat([len, t, data, crc]);
  }
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
function crc32(buf) {
  let c, table = crc32.table; if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    crc32.table = table;
  }
  c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = (table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)) >>> 0;
  return (c ^ 0xFFFFFFFF) >>> 0;
}

export async function boot({ seedData = true } = {}) {
  const sandbox = mkdtempSync(join(tmpdir(), 'missions-handbook-'));
  const dataDir = join(sandbox, 'data');
  const uploadDir = join(sandbox, 'uploads');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(uploadDir, { recursive: true });

  const port = await freePort();
  const server = spawn('node', ['server.js'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: join(dataDir, 'missions.db'),
      UPLOAD_DIR: uploadDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', d => process.stdout.write(`[srv] ${d}`));
  server.stderr.on('data', d => process.stderr.write(`[srv!] ${d}`));
  await waitForPort(port);

  const base = `http://127.0.0.1:${port}`;
  const seeded = seedData ? await seed(base) : null;

  function cleanup() {
    try { server.kill(); } catch {}
    try { rmSync(sandbox, { recursive: true, force: true }); } catch {}
  }

  return { base, port, server, sandbox, seeded, cleanup };
}
