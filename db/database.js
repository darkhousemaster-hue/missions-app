'use strict';
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path   = require('path');
const fs     = require('fs');

// DB_PATH defaults to data/missions.db beside the project root, but can be
// overridden via the DB_PATH env var (used by the handbook capture scripts
// to spin up a throw-away fixture without touching production data).
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'missions.db');
if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

function runTx(fn) {
  db.exec('BEGIN');
  try { fn(); db.exec('COMMIT'); } catch(e) { db.exec('ROLLBACK'); throw e; }
}
const num = v => typeof v === 'bigint' ? Number(v) : v;

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS modes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()*1000));
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    timer_default INTEGER DEFAULT 60, missions_count INTEGER DEFAULT 10,
    min_location_missions INTEGER DEFAULT 3,
    allow_photo INTEGER DEFAULT 1,
    allow_video INTEGER DEFAULT 1,
    allow_indoor INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (unixepoch()*1000));
  CREATE TABLE IF NOT EXISTS missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode_id INTEGER REFERENCES modes(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    name TEXT DEFAULT '',
    name_de TEXT DEFAULT '', name_en TEXT DEFAULT '', name_fr TEXT DEFAULT '', name_it TEXT DEFAULT '',
    description_de TEXT DEFAULT '', description_en TEXT DEFAULT '',
    description_fr TEXT DEFAULT '', description_it TEXT DEFAULT '',
    task_de TEXT DEFAULT '', task_en TEXT DEFAULT '',
    task_fr TEXT DEFAULT '', task_it TEXT DEFAULT '',
    media_type TEXT DEFAULT 'photo', points INTEGER DEFAULT 1,
    is_indoor INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()*1000));
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    mode_id INTEGER REFERENCES modes(id),
    status TEXT DEFAULT 'waiting',
    timer_duration INTEGER DEFAULT 3600,
    timer_started_at INTEGER,
    timer_paused_elapsed INTEGER DEFAULT 0,
    timer_running INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()*1000));
  CREATE TABLE IF NOT EXISTS game_missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
    mission_id INTEGER REFERENCES missions(id));
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
    name TEXT NOT NULL, score INTEGER DEFAULT 0,
    joined_at INTEGER DEFAULT (unixepoch()*1000),
    gps_anchor_key TEXT);
  CREATE TABLE IF NOT EXISTS team_missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    mission_id INTEGER REFERENCES missions(id),
    game_mission_id INTEGER REFERENCES game_missions(id),
    status TEXT DEFAULT 'open', media_path TEXT,
    rejection_message TEXT, submitted_at INTEGER, reviewed_at INTEGER);

  CREATE TABLE IF NOT EXISTS cr_modes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()*1000));
  CREATE TABLE IF NOT EXISTS cr_missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode_id INTEGER NOT NULL REFERENCES cr_modes(id) ON DELETE CASCADE,
    order_index INTEGER DEFAULT 0,
    name_de TEXT DEFAULT '', name_en TEXT DEFAULT '', name_fr TEXT DEFAULT '', name_it TEXT DEFAULT '',
    description_de TEXT DEFAULT '', description_en TEXT DEFAULT '',
    description_fr TEXT DEFAULT '', description_it TEXT DEFAULT '',
    task_de TEXT DEFAULT '', task_en TEXT DEFAULT '',
    task_fr TEXT DEFAULT '', task_it TEXT DEFAULT '',
    hint_de TEXT DEFAULT '', hint_en TEXT DEFAULT '',
    hint_fr TEXT DEFAULT '', hint_it TEXT DEFAULT '',
    points INTEGER DEFAULT 10,
    lat REAL, lng REAL, radius_meters INTEGER DEFAULT 30,
    use_map INTEGER DEFAULT 0,
    use_gps INTEGER DEFAULT 0,
    is_timed INTEGER DEFAULT 0,
    timer_seconds INTEGER DEFAULT 300,
    penalty_interval INTEGER DEFAULT 60,
    penalty_points INTEGER DEFAULT 2,
    media_required TEXT DEFAULT 'none',
    has_answer INTEGER DEFAULT 0,
    answer_de TEXT DEFAULT '', answer_en TEXT DEFAULT '', answer_fr TEXT DEFAULT '', answer_it TEXT DEFAULT '',
    created_at INTEGER DEFAULT (unixepoch()*1000));
  CREATE TABLE IF NOT EXISTS cr_game_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
    cr_mode_id INTEGER REFERENCES cr_modes(id));
  CREATE TABLE IF NOT EXISTS cr_team_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL, team_id INTEGER NOT NULL,
    mission_id INTEGER REFERENCES cr_missions(id),
    mission_index INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    started_at INTEGER, completed_at INTEGER,
    penalties INTEGER DEFAULT 0,
    score_earned INTEGER DEFAULT 0,
    media_path TEXT,
    media_status TEXT DEFAULT 'none',
    UNIQUE(game_id, team_id));
  CREATE TABLE IF NOT EXISTS cr_mission_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    team_id INTEGER NOT NULL,
    mission_id INTEGER NOT NULL REFERENCES cr_missions(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'open',
    started_at INTEGER,
    completed_at INTEGER,
    score_earned INTEGER DEFAULT 0,
    media_path TEXT,
    media_status TEXT DEFAULT 'none',
    UNIQUE(game_id, team_id, mission_id));
  CREATE TABLE IF NOT EXISTS team_gps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL, team_id INTEGER NOT NULL,
    lat REAL NOT NULL, lng REAL NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()*1000),
    UNIQUE(game_id, team_id));
  CREATE TABLE IF NOT EXISTS cr_hints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id INTEGER NOT NULL REFERENCES cr_missions(id) ON DELETE CASCADE,
    order_index INTEGER DEFAULT 0,
    text_de TEXT DEFAULT '', text_en TEXT DEFAULT '', text_fr TEXT DEFAULT '', text_it TEXT DEFAULT '',
    image_path TEXT,
    created_at INTEGER DEFAULT (unixepoch()*1000));
  CREATE TABLE IF NOT EXISTS cr_team_hints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL, team_id INTEGER NOT NULL, mission_id INTEGER NOT NULL,
    hints_used INTEGER DEFAULT 0,
    UNIQUE(game_id, team_id, mission_id));
  CREATE TABLE IF NOT EXISTS cr_team_captures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    team_id INTEGER NOT NULL,
    target_team_id INTEGER NOT NULL,
    media_path TEXT,
    status TEXT DEFAULT 'pending',
    bonus_points INTEGER DEFAULT 5,
    submitted_at INTEGER DEFAULT (unixepoch()*1000));
  -- A photo/video upload for a CR mission that needs GM approval before
  -- the team's progress advances. Mirrors the team_missions lifecycle for
  -- regular missions but keyed off cr_missions so IDs don't collide.
  CREATE TABLE IF NOT EXISTS cr_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    team_id INTEGER NOT NULL,
    mission_id INTEGER NOT NULL,
    media_path TEXT,
    status TEXT DEFAULT 'pending',          -- pending | accepted | rejected
    rejection_message TEXT,
    submitted_at INTEGER DEFAULT (unixepoch()*1000),
    reviewed_at INTEGER);

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    content TEXT NOT NULL, from_gm INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()*1000));
  CREATE TABLE IF NOT EXISTS rulesets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    rules_list TEXT DEFAULT '[]',
    created_at INTEGER DEFAULT (unixepoch()*1000));
  CREATE TABLE IF NOT EXISTS modes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    ruleset_id INTEGER REFERENCES rulesets(id) ON DELETE SET NULL,
    timer_default INTEGER DEFAULT 60,
    created_at INTEGER DEFAULT (unixepoch()*1000));
`);

// Migrations for existing DBs
const migrations = [
  "ALTER TABLE missions ADD COLUMN mode_id INTEGER",
  "ALTER TABLE missions ADD COLUMN description_it TEXT DEFAULT ''",
  "ALTER TABLE missions ADD COLUMN task_de TEXT DEFAULT ''",
  "ALTER TABLE missions ADD COLUMN task_en TEXT DEFAULT ''",
  "ALTER TABLE missions ADD COLUMN task_fr TEXT DEFAULT ''",
  "ALTER TABLE missions ADD COLUMN task_it TEXT DEFAULT ''",
  "ALTER TABLE missions ADD COLUMN name TEXT DEFAULT ''",
  "ALTER TABLE missions ADD COLUMN is_indoor INTEGER DEFAULT 0",
  "ALTER TABLE locations ADD COLUMN missions_count INTEGER DEFAULT 10",
  "ALTER TABLE games ADD COLUMN mode_id INTEGER",
];
migrations.forEach(sql => { try { db.exec(sql); } catch(e) {} });
// Rulesets migrations
try { db.exec("ALTER TABLE modes ADD COLUMN ruleset_id INTEGER"); } catch(e) {}
try { db.exec("ALTER TABLE modes ADD COLUMN timer_default INTEGER DEFAULT 60"); } catch(e) {}
try { db.exec("ALTER TABLE missions ADD COLUMN name_de TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE locations ADD COLUMN allow_photo INTEGER DEFAULT 1"); } catch(e) {}
try { db.exec("ALTER TABLE locations ADD COLUMN allow_video INTEGER DEFAULT 1"); } catch(e) {}
try { db.exec("ALTER TABLE locations ADD COLUMN allow_indoor INTEGER DEFAULT 1"); } catch(e) {}
try { db.exec("ALTER TABLE cr_missions ADD COLUMN has_answer INTEGER DEFAULT 0"); } catch(e) {}
try { db.exec("ALTER TABLE cr_missions ADD COLUMN answer_de TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE cr_missions ADD COLUMN answer_en TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE cr_missions ADD COLUMN answer_fr TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE cr_missions ADD COLUMN answer_it TEXT DEFAULT ''"); } catch(e) {}
// Spanish (es) was added as the fifth supported language. Idempotent ADD COLUMNs
// so an existing DB picks up the new fields on next boot without a manual migration.
try { db.exec("ALTER TABLE missions ADD COLUMN name_es TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE missions ADD COLUMN description_es TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE missions ADD COLUMN task_es TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE cr_missions ADD COLUMN name_es TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE cr_missions ADD COLUMN description_es TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE cr_missions ADD COLUMN task_es TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE cr_missions ADD COLUMN hint_es TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE cr_missions ADD COLUMN answer_es TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE cr_hints ADD COLUMN text_es TEXT DEFAULT ''"); } catch(e) {}
// CR mode-level settings: allowed media + chosen ruleset + default game duration
try { db.exec("ALTER TABLE cr_modes ADD COLUMN allow_photo INTEGER DEFAULT 1"); } catch(e) {}
try { db.exec("ALTER TABLE cr_modes ADD COLUMN allow_video INTEGER DEFAULT 1"); } catch(e) {}
try { db.exec("ALTER TABLE cr_modes ADD COLUMN ruleset_id INTEGER"); } catch(e) {}
try { db.exec("ALTER TABLE cr_modes ADD COLUMN timer_default INTEGER DEFAULT 60"); } catch(e) {}
// CityRush games aren't tied to a location, so the per-location language
// allow-list doesn't apply. Each CR mode carries its own list instead;
// player cycler reads cr_mode.allowed_langs the same way MiSSiONS reads
// location.allowed_langs. Default 'de,en,fr,it,es' = unchanged behaviour.
try { db.exec("ALTER TABLE cr_modes ADD COLUMN allowed_langs TEXT DEFAULT 'de,en,fr,it,es'"); } catch(e) {}
// Hide a CR mission's description/task until the player physically arrives.
try { db.exec("ALTER TABLE cr_missions ADD COLUMN hide_until_arrival INTEGER DEFAULT 0"); } catch(e) {}
// "Special" missions: available at any time, no GPS dependency, repeatable
// every `repeat_minutes` (0 = one-shot). They render above the regular linear
// roster on the player side. is_special=1 implies use_gps/use_map are
// ignored for gating purposes.
try { db.exec("ALTER TABLE cr_missions ADD COLUMN is_special INTEGER DEFAULT 0"); } catch(e) {}
try { db.exec("ALTER TABLE cr_missions ADD COLUMN repeat_minutes INTEGER DEFAULT 0"); } catch(e) {}
// Explicit repeatable flag for specials. 0 = one-shot (a team can complete it
// exactly once), 1 = repeatable (optionally throttled by repeat_minutes). This
// makes one-shot unambiguous instead of overloading repeat_minutes=0.
try { db.exec("ALTER TABLE cr_missions ADD COLUMN is_repeatable INTEGER DEFAULT 0"); } catch(e) {}
// Jigsaw puzzle mission: the GM uploads an image which is sliced into a
// puzzle_grid × puzzle_grid grid; the player drags pieces to rearrange it.
// Solving auto-awards the mission (verified client-side, no GM review).
try { db.exec("ALTER TABLE cr_missions ADD COLUMN use_puzzle INTEGER DEFAULT 0"); } catch(e) {}
try { db.exec("ALTER TABLE cr_missions ADD COLUMN puzzle_image TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE cr_missions ADD COLUMN puzzle_grid INTEGER DEFAULT 3"); } catch(e) {}
// Puzzle "peek": let the player briefly see the finished image.
//  puzzle_peek_enabled  0/1  — feature on for this puzzle
//  puzzle_peek_onetime  0/1  — single peek that stays until the player closes it
//  puzzle_peeks         JSON array of durations in seconds, in order of use
//                       (e.g. [0.5,1.5,0]); 0 = stays until the X is pressed.
//                       Length = how many times the player may peek.
try { db.exec("ALTER TABLE cr_missions ADD COLUMN puzzle_peek_enabled INTEGER DEFAULT 0"); } catch(e) {}
try { db.exec("ALTER TABLE cr_missions ADD COLUMN puzzle_peek_onetime INTEGER DEFAULT 0"); } catch(e) {}
try { db.exec("ALTER TABLE cr_missions ADD COLUMN puzzle_peeks TEXT DEFAULT '[]'"); } catch(e) {}
// Puzzle kind + ordering-puzzle data.
//  puzzle_type          'jigsaw' (default) | 'order'
//  puzzle_order_images  JSON array of image paths in the CORRECT order; the
//                       player rearranges them back into this order to solve.
try { db.exec("ALTER TABLE cr_missions ADD COLUMN puzzle_type TEXT DEFAULT 'jigsaw'"); } catch(e) {}
try { db.exec("ALTER TABLE cr_missions ADD COLUMN puzzle_order_images TEXT DEFAULT '[]'"); } catch(e) {}
try { db.exec("ALTER TABLE teams ADD COLUMN gps_anchor_key TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE cr_submissions ADD COLUMN player_key TEXT"); } catch(e) {}
// Team selfie taken at the start of the game so the GM can see who's who.
// `selfie_path` is the uploads-relative path; stays NULL until uploaded.
try { db.exec("ALTER TABLE teams ADD COLUMN selfie_path TEXT"); } catch(e) {}
// Ranking tie-breaker: epoch-ms of the team's most recent score change. When
// two teams are level on points, the one that REACHED that total first ranks
// higher (smaller last_score_at). Stamped by every score-writing path. Default
// 0 so pre-existing teams fall back to joined_at order until they next score.
try { db.exec("ALTER TABLE teams ADD COLUMN last_score_at INTEGER DEFAULT 0"); } catch(e) {}
// Image rotation chosen by the GM in the lightbox. Degrees clockwise, one of
// 0/90/180/270. Stored (not baked into the file) so it's lossless + reversible
// and applied consistently in the dashboard, ZIP export and collage. Photos
// live in team_missions / cr_submissions; selfies on teams.
try { db.exec("ALTER TABLE team_missions ADD COLUMN media_rotation INTEGER DEFAULT 0"); } catch(e) {}
try { db.exec("ALTER TABLE cr_submissions ADD COLUMN media_rotation INTEGER DEFAULT 0"); } catch(e) {}
try { db.exec("ALTER TABLE teams ADD COLUMN selfie_rotation INTEGER DEFAULT 0"); } catch(e) {}
// Game media export — populated after the GM renders the photo-collage MP4
// from the dashboard. NULL until the first render. The path is relative to
// UPLOAD_DIR (e.g. "ABC12345/collage.mp4"). generated_at is a unix-epoch ms.
try { db.exec("ALTER TABLE games ADD COLUMN collage_path TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE games ADD COLUMN collage_generated_at INTEGER"); } catch(e) {}
// Per-location allowed languages. Stored as a comma-separated list (e.g.
// "de,en,fr"). Players joining a game at this location only see these
// languages in the cycler — the rest are hidden. Default is all five
// supported languages so existing locations behave as before.
try { db.exec("ALTER TABLE locations ADD COLUMN allowed_langs TEXT DEFAULT 'de,en,fr,it,es'"); } catch(e) {}
// Rival-team freeze. One row per (game, freezer, frozen). UNIQUE constraint
// enforces "each team can only freeze each rival once". `until_ms` is the
// absolute epoch when the freeze ends; rows are kept forever (used to grey
// out already-frozen teams in the freezer's picker even after expiry).
db.exec(`
  CREATE TABLE IF NOT EXISTS team_freezes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    freezer_team_id INTEGER NOT NULL,
    frozen_team_id INTEGER NOT NULL,
    started_at INTEGER DEFAULT (unixepoch()*1000),
    until_ms INTEGER NOT NULL,
    UNIQUE(game_id, freezer_team_id, frozen_team_id));
`);
// Per-team progress for special missions — separate from the linear team
// progress so repeat cooldown can be tracked without disturbing the main
// mission_index. last_attempt = ms epoch of last attempt (accepted or pending).
db.exec(`
  CREATE TABLE IF NOT EXISTS cr_special_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    team_id INTEGER NOT NULL,
    mission_id INTEGER NOT NULL,
    last_attempt INTEGER,           -- last attempt (start of cooldown)
    completed_count INTEGER DEFAULT 0,
    UNIQUE(game_id, team_id, mission_id));
`);
// Track team-wide GPS arrival on a CityRush mission. Once any team member
// arrives, the row marks the whole team as arrived for that mission so
// later GPS checks short-circuit and trigger the action UI for everyone.
db.exec(`
  CREATE TABLE IF NOT EXISTS cr_arrivals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    team_id INTEGER NOT NULL,
    mission_id INTEGER NOT NULL,
    arrived_at INTEGER DEFAULT (unixepoch()*1000),
    UNIQUE(game_id, team_id, mission_id));
`);
// Distinguish GPS-trigger hints (shown before arrival to help find the spot)
// from answer/question hints (shown after arrival to help solve the mission).
// Existing rows default to 'answer' so previously-saved hints keep their meaning.
try { db.exec("ALTER TABLE cr_hints ADD COLUMN hint_type TEXT DEFAULT 'answer'"); } catch(e) {}
// Track per-team GPS hint usage on the same cr_team_hints row as the answer
// hint usage — avoids changing the existing UNIQUE(game,team,mission) key.
try { db.exec("ALTER TABLE cr_team_hints ADD COLUMN gps_hints_used INTEGER DEFAULT 0"); } catch(e) {}
try { db.exec("UPDATE cr_missions SET radius_meters=30 WHERE radius_meters IS NULL OR radius_meters<=0"); } catch(e) {}

// One-shot back-fill: missions created before the multi-hint editor only had
// the single hint_de/en/fr/it columns on cr_missions. Migrate that text into
// a single GPS-type cr_hints row so existing missions show their hint to
// players under the new system. Guarded by a settings flag so it runs once.
try {
  const done = db.prepare("SELECT value FROM settings WHERE key='cr_hint_migration_v1'").get();
  if (!done) {
    const oldRows = db.prepare(`
      SELECT id, hint_de, hint_en, hint_fr, hint_it FROM cr_missions
      WHERE COALESCE(hint_de,'') || COALESCE(hint_en,'') || COALESCE(hint_fr,'') || COALESCE(hint_it,'') <> ''
    `).all();
    // text_es is left empty by the back-fill — the GM can run auto-translate
    // on the migrated hint to populate Spanish.
    const ins = db.prepare(`INSERT INTO cr_hints(mission_id,order_index,text_de,text_en,text_fr,text_it,text_es,image_path,hint_type)
                            VALUES(?,?,?,?,?,?,?,?, 'gps')`);
    oldRows.forEach(r => {
      // Avoid double-creating: skip if this mission already has a GPS hint.
      const exists = db.prepare(`SELECT 1 FROM cr_hints WHERE mission_id=? AND hint_type='gps' LIMIT 1`).get(r.id);
      if (!exists) ins.run(r.id, 0, r.hint_de||'', r.hint_en||'', r.hint_fr||'', r.hint_it||'', '', null);
    });
    db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('cr_hint_migration_v1','1')").run();
  }
} catch(e) { /* best-effort; don't block startup */ }
try { db.exec("ALTER TABLE missions ADD COLUMN name_en TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE missions ADD COLUMN name_fr TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE missions ADD COLUMN name_it TEXT DEFAULT ''"); } catch(e) {}
// Seed default ruleset if none exist
const rsCheck = db.prepare('SELECT id FROM rulesets LIMIT 1').get();
if (!rsCheck) {
  const defaultRules = db.prepare("SELECT value FROM settings WHERE key='rules_list'").get();
  const rulesJson = defaultRules ? defaultRules.value : '[]';
  db.prepare("INSERT INTO rulesets(id,name,rules_list) VALUES(1,'Standard',?)").run(rulesJson);
  db.prepare("UPDATE modes SET ruleset_id=1 WHERE ruleset_id IS NULL").run();
}

// Seed default mode "MiSSiONS"
const modeCheck = db.prepare('SELECT id FROM modes WHERE id=1').get();
if (!modeCheck) {
  db.prepare("INSERT INTO modes (id,name) VALUES (1,'MiSSiONS')").run();
  db.prepare("UPDATE missions SET mode_id=1 WHERE mode_id IS NULL").run();
}

// Seed defaults
if (!db.prepare('SELECT value FROM settings WHERE key=?').get('timeout_text')) {
  db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run('timeout_text','Die Zeit ist abgelaufen! Sammelt euch beim Treffpunkt.');
}
if (!db.prepare('SELECT value FROM settings WHERE key=?').get('password_hash')) {
  db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run('password_hash', bcrypt.hashSync('admin1898',10));
}

// ── Settings ─────────────────────────────────────────────────────────────────
const getSetting    = k => { const r=db.prepare('SELECT value FROM settings WHERE key=?').get(k); return r?r.value:null; };
const setSetting    = (k,v) => db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run(k,v);
const isSetup       = () => true;
const setupPassword = pw => setSetting('password_hash', bcrypt.hashSync(pw,10));
const verifyPassword = pw => { const h=getSetting('password_hash'); return h?bcrypt.compareSync(pw,h):false; };
const changePassword = (op,np) => { if(!verifyPassword(op)) return false; setupPassword(np); return true; };
// Keys that carry secrets and must never be exposed via GET /api/settings nor
// be writable through the generic settings PUT (which takes arbitrary keys).
const SETTINGS_SECRET_KEYS = new Set(['password_hash', 'gm_token_secret']);
const getSettings = () => { const o={}; db.prepare('SELECT key,value FROM settings').all().forEach(r=>{ if(!SETTINGS_SECRET_KEYS.has(r.key)) o[r.key]=r.value; }); return o; };
const updateSettings = obj => { const u=db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)'); runTx(()=>{ for(const[k,v] of Object.entries(obj)){ if(SETTINGS_SECRET_KEYS.has(k)) continue; u.run(k,v); } }); };

// ── GM auth token ──────────────────────────────────────────────────────────
// A long-lived bearer token so the dashboard doesn't have to resend the raw
// password on every privileged request. The token is just the password-gated
// secret; we persist a random secret (created once, survives restarts) and
// hand the client an opaque value derived from it. Rotating the password does
// NOT rotate this (keeps existing sessions working); call rotateGmToken() if
// you ever need to invalidate everything.
const crypto = require('crypto');
const getGmTokenSecret = () => {
  let s = getSetting('gm_token_secret');
  if(!s){ s = crypto.randomBytes(32).toString('hex'); setSetting('gm_token_secret', s); }
  return s;
};
// Opaque token = HMAC(secret, "gm"). Stable across restarts, reveals nothing
// about the password, and verifying needs only the stored secret.
const issueGmToken = () => crypto.createHmac('sha256', getGmTokenSecret()).update('gm').digest('hex');
const verifyGmToken = tok => {
  if(!tok || typeof tok !== 'string') return false;
  const expected = issueGmToken();
  // constant-time compare
  const a = Buffer.from(tok); const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const rotateGmToken = () => { setSetting('gm_token_secret', crypto.randomBytes(32).toString('hex')); };

// ── Modes ─────────────────────────────────────────────────────────────────────
const getModes   = () => db.prepare('SELECT m.*, r.name as ruleset_name FROM modes m LEFT JOIN rulesets r ON r.id=m.ruleset_id ORDER BY m.name').all();
const getMode    = id => db.prepare('SELECT * FROM modes WHERE id=?').get(id);
const createMode = (name, ruleset_id=1, timer_default=60) => num(db.prepare('INSERT INTO modes(name,ruleset_id,timer_default) VALUES(?,?,?)').run(name, ruleset_id||1, timer_default||60).lastInsertRowid);
const updateMode = (id, {name, ruleset_id, timer_default}) =>
  db.prepare('UPDATE modes SET name=?,ruleset_id=?,timer_default=? WHERE id=?').run(name, ruleset_id||1, timer_default||60, id);
const deleteMode = id => { if(Number(id)===1) throw new Error("Cannot delete default mode"); db.prepare('DELETE FROM modes WHERE id=?').run(id); };

// ── Rulesets ─────────────────────────────────────────────────────────────────
const getRulesets   = () => db.prepare('SELECT * FROM rulesets ORDER BY name').all();
const getRuleset    = id => db.prepare('SELECT * FROM rulesets WHERE id=?').get(id);
const createRuleset = (name, rules_list='[]') =>
  num(db.prepare('INSERT INTO rulesets(name,rules_list) VALUES(?,?)').run(name, rules_list).lastInsertRowid);
const updateRuleset = (id, {name, rules_list}) =>
  db.prepare('UPDATE rulesets SET name=?,rules_list=? WHERE id=?').run(name, rules_list, id);
const deleteRuleset = id => {
  if(Number(id)===1) throw new Error("Cannot delete default ruleset");
  db.prepare('UPDATE modes SET ruleset_id=1 WHERE ruleset_id=?').run(id);
  db.prepare('DELETE FROM rulesets WHERE id=?').run(id);
};

// ── Locations ─────────────────────────────────────────────────────────────────
// Normalise the allowed-langs input into a canonical "de,en,fr,it,es"-style
// string. Accepts either an array (['de','en']) or a comma string. Falls
// back to all five supported languages if nothing valid is provided, so the
// payer-side cycler never ends up with an empty list.
const ALL_LANGS = ['de','en','fr','it','es'];
function normLangs(v) {
  let arr;
  if (Array.isArray(v))           arr = v;
  else if (typeof v === 'string') arr = v.split(',');
  else                            arr = ALL_LANGS;
  const set = new Set(arr.map(x => String(x).trim().toLowerCase()).filter(x => ALL_LANGS.includes(x)));
  if (set.size === 0) ALL_LANGS.forEach(l => set.add(l));
  // Preserve canonical order regardless of input order
  return ALL_LANGS.filter(l => set.has(l)).join(',');
}
const getLocations   = () => db.prepare('SELECT * FROM locations ORDER BY name').all();
const getLocation    = id => db.prepare('SELECT * FROM locations WHERE id=?').get(id);
const createLocation = ({name,missions_count=10,min_location_missions=3,allow_photo=1,allow_video=1,allow_indoor=1,allowed_langs}) => {
  const langs = normLangs(allowed_langs);
  return num(db.prepare('INSERT INTO locations(name,timer_default,missions_count,min_location_missions,allow_photo,allow_video,allow_indoor,allowed_langs) VALUES(?,?,?,?,?,?,?,?)').run(name,60,missions_count,min_location_missions,allow_photo?1:0,allow_video?1:0,allow_indoor?1:0,langs).lastInsertRowid);
};
const updateLocation = (id,{name,missions_count,min_location_missions,allow_photo=1,allow_video=1,allow_indoor=1,allowed_langs}) =>
  db.prepare('UPDATE locations SET name=?,missions_count=?,min_location_missions=?,allow_photo=?,allow_video=?,allow_indoor=?,allowed_langs=? WHERE id=?').run(name,missions_count||10,min_location_missions||0,allow_photo?1:0,allow_video?1:0,allow_indoor?1:0,normLangs(allowed_langs),id);
const deleteLocation = id => db.prepare('DELETE FROM locations WHERE id=?').run(id);

// ── Missions ──────────────────────────────────────────────────────────────────
const getMissions = (modeId, locationId) => {
  if (modeId===undefined && locationId===undefined) return db.prepare('SELECT * FROM missions ORDER BY id').all();
  if (locationId===null) return db.prepare('SELECT * FROM missions WHERE mode_id=? AND location_id IS NULL ORDER BY id').all(modeId);
  if (locationId!==undefined) return db.prepare('SELECT * FROM missions WHERE mode_id=? AND location_id=? ORDER BY id').all(modeId, locationId);
  return db.prepare('SELECT * FROM missions WHERE mode_id=? ORDER BY id').all(modeId);
};
const getMission = id => db.prepare('SELECT * FROM missions WHERE id=?').get(id);
const createMission = ({mode_id=1,location_id=null,name='',name_de='',name_en='',name_fr='',name_it='',name_es='',description_de='',description_en='',description_fr='',description_it='',description_es='',task_de='',task_en='',task_fr='',task_it='',task_es='',media_type='photo',points=1,is_indoor=0}) =>
  num(db.prepare('INSERT INTO missions(mode_id,location_id,name,name_de,name_en,name_fr,name_it,name_es,description_de,description_en,description_fr,description_it,description_es,task_de,task_en,task_fr,task_it,task_es,media_type,points,is_indoor) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(mode_id||1,location_id||null,name||name_de||'',name_de||name||'',name_en||name||'',name_fr||name||'',name_it||name||'',name_es||'',description_de,description_en,description_fr,description_it,description_es||'',task_de,task_en,task_fr,task_it,task_es||'',media_type,points,is_indoor?1:0).lastInsertRowid);
const updateMission = (id,{mode_id,location_id,name,name_de,name_en,name_fr,name_it,name_es,description_de,description_en,description_fr,description_it,description_es,task_de,task_en,task_fr,task_it,task_es,media_type,points,is_indoor}) =>
  db.prepare('UPDATE missions SET mode_id=?,location_id=?,name=?,name_de=?,name_en=?,name_fr=?,name_it=?,name_es=?,description_de=?,description_en=?,description_fr=?,description_it=?,description_es=?,task_de=?,task_en=?,task_fr=?,task_it=?,task_es=?,media_type=?,points=?,is_indoor=? WHERE id=?').run(mode_id||1,location_id||null,name||name_de||'',name_de||name||'',name_en||name||'',name_fr||name||'',name_it||name||'',name_es||'',description_de,description_en,description_fr,description_it||'',description_es||'',task_de||'',task_en||'',task_fr||'',task_it||'',task_es||'',media_type,points,is_indoor?1:0,id);
const deleteMission = id => db.prepare('DELETE FROM missions WHERE id=?').run(id);

// ── Games ─────────────────────────────────────────────────────────────────────
const getGame         = id => db.prepare('SELECT * FROM games WHERE id=?').get(id);
const getRunningGames = () => db.prepare('SELECT * FROM games WHERE timer_running=1').all();
// Games that are not finished yet — i.e. waiting to start OR currently running.
// Used to gate self-updates: the app may only update when every game is ended.
const getActiveGames  = () => db.prepare("SELECT * FROM games WHERE status <> 'ended'").all();
const getOldGames     = cutoff => db.prepare('SELECT * FROM games WHERE created_at < ?').all(cutoff);
const getGames        = locationId => locationId
  ? db.prepare('SELECT g.*,l.name as location_name,m.name as mode_name FROM games g LEFT JOIN locations l ON l.id=g.location_id LEFT JOIN modes m ON m.id=g.mode_id WHERE g.location_id=? ORDER BY g.created_at DESC').all(locationId)
  : db.prepare('SELECT g.*,l.name as location_name,m.name as mode_name FROM games g LEFT JOIN locations l ON l.id=g.location_id LEFT JOIN modes m ON m.id=g.mode_id ORDER BY g.created_at DESC').all();

const createGame = ({id, location_id, mode_id=1, timer_duration, missions}) => {
  runTx(()=>{
    db.prepare('INSERT INTO games(id,location_id,mode_id,timer_duration) VALUES(?,?,?,?)').run(id,location_id,mode_id||1,timer_duration);
    const ins=db.prepare('INSERT INTO game_missions(game_id,mission_id) VALUES(?,?)');
    missions.forEach(mId=>ins.run(id,mId));
  });
};
const updateGame = (id,fields) => {
  const sets=Object.keys(fields).map(k=>`${k}=?`).join(',');
  db.prepare(`UPDATE games SET ${sets} WHERE id=?`).run(...Object.values(fields),id);
};
const deleteGame = id => {
  // Clean up tables that don't have CASCADE so the games row can be removed cleanly.
  runTx(() => {
    db.prepare('DELETE FROM team_gps WHERE game_id=?').run(id);
    db.prepare('DELETE FROM cr_team_progress WHERE game_id=?').run(id);
    db.prepare('DELETE FROM cr_mission_progress WHERE game_id=?').run(id);
    db.prepare('DELETE FROM cr_team_hints WHERE game_id=?').run(id);
    db.prepare('DELETE FROM cr_team_captures WHERE game_id=?').run(id);
    db.prepare('DELETE FROM team_freezes WHERE game_id=?').run(id);
    db.prepare('DELETE FROM cr_submissions WHERE game_id=?').run(id);
    db.prepare('DELETE FROM cr_game_links WHERE game_id=?').run(id);
    db.prepare('DELETE FROM games WHERE id=?').run(id);
  });
};
const getGameFull = gameId => {
  const game=getGame(gameId); if(!game) return null;
  const location=getLocation(game.location_id);
  const mode=getMode(game.mode_id);
  const teams=db.prepare('SELECT * FROM teams WHERE game_id=? ORDER BY joined_at').all(gameId);
  const missions=db.prepare('SELECT gm.id as game_mission_id, m.* FROM game_missions gm JOIN missions m ON m.id=gm.mission_id WHERE gm.game_id=? ORDER BY gm.id').all(gameId);
  const crLink=db.prepare('SELECT cr_mode_id FROM cr_game_links WHERE game_id=?').get(gameId);
  const crMode=crLink?db.prepare('SELECT * FROM cr_modes WHERE id=?').get(crLink.cr_mode_id):null;
  return {...game, location, mode, teams, missions, crMode};
};

// ── Mission selection ─────────────────────────────────────────────────────────
function selectMissions(location, modeId) {
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
  const locMs  = shuffle(getMissions(modeId, location.id));
  const poolMs = shuffle(getMissions(modeId, null));
  const total  = location.missions_count || 10;
  const minLoc = Math.min(location.min_location_missions || 0, locMs.length);
  // Take at least minLoc from location; fill remaining from pool; top up with location if pool runs short
  const locTake  = Math.min(locMs.length,  Math.max(minLoc, total - poolMs.length));
  const poolTake = Math.min(poolMs.length, total - locTake);
  return shuffle([...locMs.slice(0, locTake), ...poolMs.slice(0, poolTake)]).map(m => m.id);
}

// ── Teams ─────────────────────────────────────────────────────────────────────
const getTeam  = id => db.prepare('SELECT * FROM teams WHERE id=?').get(id);
const getTeams = gameId => db.prepare('SELECT * FROM teams WHERE game_id=? ORDER BY joined_at').all(gameId);
const createTeam = ({game_id, name, gps_anchor_key=null}) => {
  const teamId=num(db.prepare('INSERT INTO teams(game_id,name,gps_anchor_key) VALUES(?,?,?)').run(game_id,name,gps_anchor_key||null).lastInsertRowid);
  const gms=db.prepare('SELECT id,mission_id FROM game_missions WHERE game_id=?').all(game_id);
  const ins=db.prepare('INSERT INTO team_missions(team_id,mission_id,game_mission_id) VALUES(?,?,?)');
  runTx(()=>gms.forEach(gm=>ins.run(teamId,gm.mission_id,gm.id)));
  return teamId;
};
const getRankings = gameId => db.prepare(`
  SELECT t.id, t.name, t.score, t.last_score_at,
    (SELECT COUNT(*) FROM team_missions tm WHERE tm.team_id=t.id AND tm.status='accepted') as completed
  FROM teams t WHERE t.game_id=?
  ORDER BY t.score DESC,
    -- Tie-break: among equal scores, the team that REACHED the total first
    -- ranks higher. last_score_at=0 means "never scored / pre-migration" —
    -- push those last by treating 0 as the largest possible value.
    CASE WHEN t.last_score_at > 0 THEN t.last_score_at ELSE 9223372036854775807 END ASC,
    t.joined_at ASC, completed DESC`).all(gameId);

// ── Team Missions ─────────────────────────────────────────────────────────────
const getTeamMissions = teamId => db.prepare(`
  SELECT tm.*, m.name as mission_name, m.name_de, m.name_en, m.name_fr, m.name_it, m.name_es,
    m.description_de, m.description_en, m.description_fr, m.description_it, m.description_es,
    m.task_de, m.task_en, m.task_fr, m.task_it, m.task_es,
    m.media_type, m.points, m.is_indoor
  FROM team_missions tm JOIN missions m ON m.id=tm.mission_id
  WHERE tm.team_id=? ORDER BY tm.id`).all(teamId);
const getSubmission          = (tid,mid) => db.prepare('SELECT * FROM team_missions WHERE team_id=? AND mission_id=?').get(tid,mid);
const getSubmissionById      = id => db.prepare('SELECT * FROM team_missions WHERE id=?').get(id);
// Rotation setters. Normalise to 0/90/180/270 clockwise.
const _normRot = d => ((Math.round(Number(d) / 90) % 4) + 4) % 4 * 90;
const setSubmissionRotation   = (id, deg) => db.prepare('UPDATE team_missions SET media_rotation=? WHERE id=?').run(_normRot(deg), id);
const setCrSubmissionRotation = (id, deg) => db.prepare('UPDATE cr_submissions SET media_rotation=? WHERE id=?').run(_normRot(deg), id);
const setTeamSelfieRotation   = (teamId, deg) => db.prepare('UPDATE teams SET selfie_rotation=? WHERE id=?').run(_normRot(deg), teamId);
const getAcceptedSubmissions = tid => db.prepare(`
  SELECT tm.*, m.media_type FROM team_missions tm JOIN missions m ON m.id=tm.mission_id
  WHERE tm.team_id=? AND tm.status='accepted' AND tm.media_path IS NOT NULL`).all(tid);

const submitMission = ({teamId,missionId,mediaPath}) =>
  db.prepare('UPDATE team_missions SET status=?,media_path=?,submitted_at=? WHERE team_id=? AND mission_id=?').run('pending',mediaPath,Date.now(),teamId,missionId);
const acceptSubmission = id => {
  const sub=getSubmissionById(id); if(!sub) return;
  const pts=getMission(sub.mission_id)?.points||1;
  db.prepare('UPDATE team_missions SET status=?,reviewed_at=? WHERE id=?').run('accepted',Date.now(),id);
  db.prepare('UPDATE teams SET score=score+?, last_score_at=? WHERE id=?').run(pts,Date.now(),sub.team_id);
};
const rejectSubmission = (id,msg) =>
  db.prepare('UPDATE team_missions SET status=?,rejection_message=?,media_path=NULL,reviewed_at=? WHERE id=?').run('rejected',msg,Date.now(),id);

// ── Messages ──────────────────────────────────────────────────────────────────
const saveMessage = ({gameId,teamId,content,fromGm}) =>
  num(db.prepare('INSERT INTO messages(game_id,team_id,content,from_gm) VALUES(?,?,?,?)').run(gameId,teamId||null,content,fromGm?1:0).lastInsertRowid);
const getMessages = (gameId,teamId) => {
  if(teamId) return db.prepare('SELECT * FROM messages WHERE game_id=? AND (team_id=? OR team_id IS NULL) ORDER BY created_at').all(gameId,teamId);
  return db.prepare('SELECT m.*,t.name as team_name FROM messages m LEFT JOIN teams t ON t.id=m.team_id WHERE m.game_id=? ORDER BY m.created_at').all(gameId);
};

// Get rules for a game. CityRush games resolve their ruleset via the linked
// cr_mode; regular games resolve via the regular mode.
const getGameRules = gameId => {
  const crLink = db.prepare('SELECT cr_mode_id FROM cr_game_links WHERE game_id=?').get(gameId);
  if (crLink) {
    const crMode = db.prepare('SELECT * FROM cr_modes WHERE id=?').get(crLink.cr_mode_id);
    if (crMode && crMode.ruleset_id) {
      const rs = db.prepare('SELECT * FROM rulesets WHERE id=?').get(crMode.ruleset_id);
      try { return JSON.parse(rs?.rules_list || '[]'); } catch(e) {}
    }
    // CR game with no ruleset: fall through (don't try the regular mode_id=1 default).
    return [];
  }
  const game = db.prepare('SELECT * FROM games WHERE id=?').get(gameId);
  if (!game || !game.mode_id) return [];
  const mode = db.prepare('SELECT * FROM modes WHERE id=?').get(game.mode_id);
  if (!mode || !mode.ruleset_id) return [];
  const rs = db.prepare('SELECT * FROM rulesets WHERE id=?').get(mode.ruleset_id);
  try { return JSON.parse(rs?.rules_list || '[]'); } catch(e) { return []; }
};


// ── CityRush ─────────────────────────────────────────────────────────────────
const getCrModes    = () => db.prepare('SELECT cm.*, r.name as ruleset_name FROM cr_modes cm LEFT JOIN rulesets r ON r.id=cm.ruleset_id ORDER BY cm.name').all();
const getCrMode     = id => db.prepare('SELECT * FROM cr_modes WHERE id=?').get(id);
const createCrMode  = (data) => {
  // Backward-compat: callers used to pass just a name string.
  if (typeof data === 'string') data = {name: data};
  const {name, allow_photo=1, allow_video=1, ruleset_id=null, timer_default=60, allowed_langs} = data;
  return num(db.prepare('INSERT INTO cr_modes(name,allow_photo,allow_video,ruleset_id,timer_default,allowed_langs) VALUES(?,?,?,?,?,?)')
    .run(name, allow_photo?1:0, allow_video?1:0, ruleset_id||null, Number(timer_default)||60, normLangs(allowed_langs)).lastInsertRowid);
};
const updateCrMode  = (id, data) => {
  if (typeof data === 'string') data = {name: data};
  const existing = getCrMode(id) || {};
  const name          = data.name          !== undefined ? data.name          : existing.name;
  const allow_photo   = data.allow_photo   !== undefined ? (data.allow_photo?1:0) : existing.allow_photo;
  const allow_video   = data.allow_video   !== undefined ? (data.allow_video?1:0) : existing.allow_video;
  const ruleset_id    = data.ruleset_id    !== undefined ? (data.ruleset_id||null) : existing.ruleset_id;
  const timer_default = data.timer_default !== undefined ? (Number(data.timer_default)||60) : (existing.timer_default||60);
  const allowed_langs = data.allowed_langs !== undefined ? normLangs(data.allowed_langs) : (existing.allowed_langs || 'de,en,fr,it,es');
  db.prepare('UPDATE cr_modes SET name=?, allow_photo=?, allow_video=?, ruleset_id=?, timer_default=?, allowed_langs=? WHERE id=?')
    .run(name, allow_photo, allow_video, ruleset_id, timer_default, allowed_langs, id);
};
const deleteCrMode  = id => {
  runTx(() => {
    // Find missions in this mode so we can clear their team progress/hints
    const missions = db.prepare('SELECT id FROM cr_missions WHERE mode_id=?').all(id);
    const mIds = missions.map(m => m.id);
    if (mIds.length) {
      const placeholders = mIds.map(()=>'?').join(',');
      db.prepare(`DELETE FROM cr_team_progress WHERE mission_id IN (${placeholders})`).run(...mIds);
      db.prepare(`DELETE FROM cr_mission_progress WHERE mission_id IN (${placeholders})`).run(...mIds);
      db.prepare(`DELETE FROM cr_team_hints WHERE mission_id IN (${placeholders})`).run(...mIds);
    }
    db.prepare('DELETE FROM cr_game_links WHERE cr_mode_id=?').run(id);
    db.prepare('DELETE FROM cr_modes WHERE id=?').run(id);
  });
};

const getCrMissions    = modeId => db.prepare('SELECT * FROM cr_missions WHERE mode_id=? ORDER BY order_index, id').all(modeId);
const getCrMission     = id => db.prepare('SELECT * FROM cr_missions WHERE id=?').get(id);
// Field list shared by INSERT and UPDATE so adding a column happens in one place.
const CR_MISSION_EDIT_FIELDS = ['order_index','name_de','name_en','name_fr','name_it','name_es',
  'description_de','description_en','description_fr','description_it','description_es',
  'task_de','task_en','task_fr','task_it','task_es','hint_de','hint_en','hint_fr','hint_it','hint_es',
  'points','lat','lng','radius_meters','use_map','use_gps',
  'is_timed','timer_seconds','penalty_interval','penalty_points','media_required',
  'has_answer','answer_de','answer_en','answer_fr','answer_it','answer_es',
  'hide_until_arrival',
  'is_special','repeat_minutes','is_repeatable',
  'use_puzzle','puzzle_image','puzzle_grid',
  'puzzle_peek_enabled','puzzle_peek_onetime','puzzle_peeks',
  'puzzle_type','puzzle_order_images'];
const toNullableNumber = v => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const toPositiveInt = (v, fallback) => {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
};
const toFlag = v => (v === true || v === 1 || v === '1') ? 1 : 0;
const normalizeCrMissionData = (data = {}) => {
  const out = {...data};
  if (out.lat !== undefined) out.lat = toNullableNumber(out.lat);
  if (out.lng !== undefined) out.lng = toNullableNumber(out.lng);
  out.radius_meters = toPositiveInt(out.radius_meters, 30);
  ['use_map','use_gps','is_timed','has_answer','hide_until_arrival','is_special','use_puzzle','is_repeatable','puzzle_peek_enabled','puzzle_peek_onetime'].forEach(f => {
    if (out[f] !== undefined && out[f] !== null) out[f] = toFlag(out[f]);
  });
  // puzzle_peeks: accept an array or a JSON string; store a clean JSON string
  // of non-negative numbers.
  if (out.puzzle_peeks !== undefined && out.puzzle_peeks !== null) {
    let arr = out.puzzle_peeks;
    if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { arr = []; } }
    if (!Array.isArray(arr)) arr = [];
    arr = arr.map(n => { const v = Number(n); return Number.isFinite(v) && v >= 0 ? v : 0; }).slice(0, 10);
    out.puzzle_peeks = JSON.stringify(arr);
  }
  // Puzzle grid: clamp to the supported sizes (3/4/5) when provided.
  if (out.puzzle_grid !== undefined && out.puzzle_grid !== null && out.puzzle_grid !== '') {
    const g = Math.round(Number(out.puzzle_grid));
    out.puzzle_grid = (g >= 3 && g <= 5) ? g : 3;
  }
  // Puzzle kind.
  if (out.puzzle_type !== undefined && out.puzzle_type !== null) {
    out.puzzle_type = (String(out.puzzle_type) === 'order') ? 'order' : 'jigsaw';
  }
  // Ordering-puzzle images: accept an array or JSON string; store a clean JSON
  // array of non-empty path strings (max 12).
  if (out.puzzle_order_images !== undefined && out.puzzle_order_images !== null) {
    let arr = out.puzzle_order_images;
    if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { arr = []; } }
    if (!Array.isArray(arr)) arr = [];
    arr = arr.map(s => String(s || '').trim()).filter(Boolean).slice(0, 12);
    out.puzzle_order_images = JSON.stringify(arr);
  }
  return out;
};
const createCrMission  = (data) => {
  const cleaned = normalizeCrMissionData(data);
  const fields = ['mode_id', ...CR_MISSION_EDIT_FIELDS];
  const vals = fields.map(f => cleaned[f] !== undefined ? cleaned[f] : null);
  return num(db.prepare(`INSERT INTO cr_missions(${fields.join(',')}) VALUES(${fields.map(()=>'?').join(',')})`).run(...vals).lastInsertRowid);
};
const updateCrMission  = (id, data) => {
  const existing = getCrMission(id) || {};
  const cleaned = normalizeCrMissionData({...existing, ...data});
  const sets = CR_MISSION_EDIT_FIELDS.map(f=>`${f}=?`).join(',');
  const vals = [...CR_MISSION_EDIT_FIELDS.map(f => cleaned[f] !== undefined ? cleaned[f] : null), id];
  db.prepare(`UPDATE cr_missions SET ${sets} WHERE id=?`).run(...vals);
};
const deleteCrMission  = id => {
  runTx(() => {
    db.prepare('DELETE FROM cr_team_progress WHERE mission_id=?').run(id);
    db.prepare('DELETE FROM cr_mission_progress WHERE mission_id=?').run(id);
    db.prepare('DELETE FROM cr_team_hints WHERE mission_id=?').run(id);
    db.prepare('DELETE FROM cr_missions WHERE id=?').run(id);
  });
};
const reorderCrMissions = (modeId, orderedIds) => {
  const stmt = db.prepare('UPDATE cr_missions SET order_index=? WHERE id=? AND mode_id=?');
  runTx(() => orderedIds.forEach((id, i) => stmt.run(i, id, modeId)));
};

// CR Game links
const linkCrMode   = (gameId, crModeId) => {
  db.prepare('INSERT OR REPLACE INTO cr_game_links(game_id, cr_mode_id) VALUES(?,?)').run(gameId, crModeId);
};
const getGameCrMode = gameId => {
  const link = db.prepare('SELECT cr_mode_id FROM cr_game_links WHERE game_id=?').get(gameId);
  return link ? getCrMode(link.cr_mode_id) : null;
};
const isCrGame = gameId => !!db.prepare('SELECT 1 FROM cr_game_links WHERE game_id=?').get(gameId);
const getCrHint = id => db.prepare('SELECT * FROM cr_hints WHERE id=?').get(id);

// CR Team progress
const getCrProgress = (gameId, teamId) =>
  db.prepare('SELECT * FROM cr_team_progress WHERE game_id=? AND team_id=?').get(gameId, teamId);
const getAllCrProgress = gameId =>
  db.prepare('SELECT * FROM cr_team_progress WHERE game_id=?').all(gameId);
const initCrProgress = (gameId, teamId, firstMissionId) =>
  db.prepare('INSERT OR IGNORE INTO cr_team_progress(game_id,team_id,mission_id,mission_index) VALUES(?,?,?,0)')
    .run(gameId, teamId, firstMissionId);
const updateCrProgress = (gameId, teamId, fields) => {
  const sets = Object.keys(fields).map(k=>`${k}=?`).join(',');
  db.prepare(`UPDATE cr_team_progress SET ${sets} WHERE game_id=? AND team_id=?`)
    .run(...Object.values(fields), gameId, teamId);
};
const getCrMissionProgress = (gameId, teamId, missionId) =>
  db.prepare('SELECT * FROM cr_mission_progress WHERE game_id=? AND team_id=? AND mission_id=?')
    .get(gameId, teamId, missionId);
const getCrMissionProgressForTeam = (gameId, teamId) =>
  db.prepare('SELECT * FROM cr_mission_progress WHERE game_id=? AND team_id=? ORDER BY completed_at, id')
    .all(gameId, teamId);
const listCrMissionProgressForGame = gameId =>
  db.prepare('SELECT * FROM cr_mission_progress WHERE game_id=? ORDER BY id').all(gameId);
const upsertCrMissionProgress = (gameId, teamId, missionId, fields={}) => {
  db.prepare('INSERT OR IGNORE INTO cr_mission_progress(game_id,team_id,mission_id) VALUES(?,?,?)')
    .run(gameId, teamId, missionId);
  if(fields && Object.keys(fields).length){
    const sets = Object.keys(fields).map(k=>`${k}=?`).join(',');
    db.prepare(`UPDATE cr_mission_progress SET ${sets} WHERE game_id=? AND team_id=? AND mission_id=?`)
      .run(...Object.values(fields), gameId, teamId, missionId);
  }
  return getCrMissionProgress(gameId, teamId, missionId);
};

// GPS tracking — only the team's anchor device (first creator, see gps_anchor_key)
// updates the row the GM map seeds from; other devices still broadcast live via socket.
const updateTeamGps = (gameId, teamId, lat, lng, playerKey) => {
  const team = getTeam(teamId);
  const anchor = team?.gps_anchor_key || null;
  if (anchor && playerKey && String(playerKey) !== String(anchor)) return false;
  db.prepare('INSERT OR REPLACE INTO team_gps(game_id,team_id,lat,lng,updated_at) VALUES(?,?,?,?,?)')
    .run(gameId, teamId, lat, lng, Date.now());
  return true;
};
const getTeamGps = gameId =>
  db.prepare('SELECT * FROM team_gps WHERE game_id=?').all(gameId);

// CR Hints. `hint_type` is 'gps' (shown before arrival) or 'answer' (shown
// after arrival / for answer missions). getCrHints can optionally be scoped
// to one type.
const getCrHints     = (missionId, type) => type
  ? db.prepare('SELECT * FROM cr_hints WHERE mission_id=? AND hint_type=? ORDER BY order_index,id').all(missionId, type)
  : db.prepare('SELECT * FROM cr_hints WHERE mission_id=? ORDER BY order_index,id').all(missionId);
const createCrHint   = ({mission_id,order_index=0,text_de='',text_en='',text_fr='',text_it='',text_es='',image_path=null,hint_type='answer'}) =>
  num(db.prepare('INSERT INTO cr_hints(mission_id,order_index,text_de,text_en,text_fr,text_it,text_es,image_path,hint_type) VALUES(?,?,?,?,?,?,?,?,?)').run(mission_id,order_index,text_de,text_en,text_fr,text_it,text_es||'',image_path,hint_type==='gps'?'gps':'answer').lastInsertRowid);
const updateCrHint   = (id,{order_index,text_de,text_en,text_fr,text_it,text_es,image_path,hint_type}) => {
  // If hint_type isn't passed we leave the existing value alone (back-compat).
  const existing = db.prepare('SELECT hint_type FROM cr_hints WHERE id=?').get(id);
  const ht = hint_type !== undefined
    ? (hint_type==='gps'?'gps':'answer')
    : (existing ? existing.hint_type : 'answer');
  db.prepare('UPDATE cr_hints SET order_index=?,text_de=?,text_en=?,text_fr=?,text_it=?,text_es=?,image_path=?,hint_type=? WHERE id=?')
    .run(order_index||0,text_de||'',text_en||'',text_fr||'',text_it||'',text_es||'',image_path||null,ht,id);
};
const deleteCrHint   = id => db.prepare('DELETE FROM cr_hints WHERE id=?').run(id);
const reorderCrHints = (missionId, orderedIds) => {
  const stmt = db.prepare('UPDATE cr_hints SET order_index=? WHERE id=? AND mission_id=?');
  runTx(() => orderedIds.forEach((id,i) => stmt.run(i,id,missionId)));
};
// Per-team hint counters. Stored as two separate columns on the same row so
// the existing UNIQUE(game_id, team_id, mission_id) constraint still holds.
// hints_used = answer hints consumed; gps_hints_used = GPS hints consumed.
const _hintColumn = type => type==='gps' ? 'gps_hints_used' : 'hints_used';
const getTeamHintsUsed = (gameId,teamId,missionId,hintType='answer') => {
  const col = _hintColumn(hintType);
  const row = db.prepare(`SELECT ${col} as used FROM cr_team_hints WHERE game_id=? AND team_id=? AND mission_id=?`)
    .get(gameId,teamId,missionId);
  return row?.used || 0;
};
const incrementTeamHints = (gameId,teamId,missionId,hintType='answer') => {
  const col = _hintColumn(hintType);
  db.prepare('INSERT OR IGNORE INTO cr_team_hints(game_id,team_id,mission_id) VALUES(?,?,?)').run(gameId,teamId,missionId);
  db.prepare(`UPDATE cr_team_hints SET ${col}=${col}+1 WHERE game_id=? AND team_id=? AND mission_id=?`)
    .run(gameId,teamId,missionId);
  return getTeamHintsUsed(gameId,teamId,missionId,hintType);
};

// CR Submissions (photo/video that needs GM approval)
const createCrSubmission = (gameId, teamId, missionId, mediaPath, playerKey=null) => {
  const pending = db.prepare(`SELECT * FROM cr_submissions WHERE game_id=? AND team_id=? AND mission_id=? AND status='pending'`)
    .get(gameId, teamId, missionId);
  if (pending) {
    const pk = playerKey ? String(playerKey) : '';
    const oldPk = pending.player_key ? String(pending.player_key) : '';
    // Another teammate already has a submission in review — keep the first one for the GM.
    if (pk && oldPk && pk !== oldPk) return { conflict: true };
    db.prepare('DELETE FROM cr_submissions WHERE id=?').run(pending.id);
  } else {
    db.prepare('DELETE FROM cr_submissions WHERE game_id=? AND team_id=? AND mission_id=? AND status<>?')
      .run(gameId, teamId, missionId, 'accepted');
  }
  const id = num(db.prepare('INSERT INTO cr_submissions(game_id,team_id,mission_id,media_path,status,player_key) VALUES(?,?,?,?,?,?)')
    .run(gameId, teamId, missionId, mediaPath, 'pending', playerKey||null).lastInsertRowid);
  return { id };
};
const getCrSubmission   = id => db.prepare('SELECT * FROM cr_submissions WHERE id=?').get(id);
const getCrSubmissionFor = (gameId, teamId, missionId) =>
  db.prepare('SELECT * FROM cr_submissions WHERE game_id=? AND team_id=? AND mission_id=? ORDER BY id DESC LIMIT 1')
    .get(gameId, teamId, missionId);
const getPendingCrSubmissionsByTeam = gameId =>
  db.prepare('SELECT team_id, COUNT(*) as cnt FROM cr_submissions WHERE game_id=? AND status=? GROUP BY team_id')
    .all(gameId, 'pending');
// Convenience accessors used from the server route so we don't have to
// expose `prepare` itself.
const listCrSubmissions = gameId =>
  db.prepare('SELECT * FROM cr_submissions WHERE game_id=? ORDER BY id').all(gameId);
const listCrArrivalsForGame = gameId =>
  db.prepare('SELECT * FROM cr_arrivals WHERE game_id=?').all(gameId);
const listCrSpecialProgressForGame = gameId =>
  db.prepare('SELECT * FROM cr_special_progress WHERE game_id=?').all(gameId);
const addTeamScore = (teamId, delta) => {
  if(!delta) return;
  // Only advance the tie-break clock on a score INCREASE — a penalty
  // (negative delta) shouldn't change "who reached this total first".
  if(delta > 0) db.prepare('UPDATE teams SET score = score + ?, last_score_at = ? WHERE id = ?').run(delta, Date.now(), teamId);
  else          db.prepare('UPDATE teams SET score = score + ? WHERE id = ?').run(delta, teamId);
};

// ── Team-wide GPS arrival ─────────────────────────────────────────────────────
// One row per (game, team, mission). Once any team member triggers arrival
// the row persists, so any further GPS-check short-circuits and the action
// UI is unlocked for every team member.
const recordCrArrival = (gameId, teamId, missionId) =>
  db.prepare('INSERT OR IGNORE INTO cr_arrivals(game_id,team_id,mission_id) VALUES(?,?,?)')
    .run(gameId, teamId, missionId);
const hasCrArrival = (gameId, teamId, missionId) =>
  !!db.prepare('SELECT 1 FROM cr_arrivals WHERE game_id=? AND team_id=? AND mission_id=?')
       .get(gameId, teamId, missionId);
const listCrArrivals = (gameId, teamId) =>
  db.prepare('SELECT mission_id FROM cr_arrivals WHERE game_id=? AND team_id=?')
    .all(gameId, teamId).map(r => r.mission_id);

// ── Special missions (parallel, always-available, optionally on cooldown) ─────
const getSpecialCrMissions = modeId =>
  db.prepare('SELECT * FROM cr_missions WHERE mode_id=? AND is_special=1 ORDER BY order_index, id').all(modeId);
const getLinearCrMissions = modeId =>
  db.prepare('SELECT * FROM cr_missions WHERE mode_id=? AND (is_special IS NULL OR is_special=0) ORDER BY order_index, id').all(modeId);
const getCrSpecialProgress = (gameId, teamId, missionId) =>
  db.prepare('SELECT * FROM cr_special_progress WHERE game_id=? AND team_id=? AND mission_id=?')
    .get(gameId, teamId, missionId);
const getCrSpecialProgressForTeam = (gameId, teamId) =>
  db.prepare('SELECT * FROM cr_special_progress WHERE game_id=? AND team_id=?')
    .all(gameId, teamId);
const upsertCrSpecialProgress = (gameId, teamId, missionId, fields) => {
  db.prepare('INSERT OR IGNORE INTO cr_special_progress(game_id,team_id,mission_id) VALUES(?,?,?)')
    .run(gameId, teamId, missionId);
  if(fields && Object.keys(fields).length){
    const sets = Object.keys(fields).map(k=>`${k}=?`).join(',');
    db.prepare(`UPDATE cr_special_progress SET ${sets} WHERE game_id=? AND team_id=? AND mission_id=?`)
      .run(...Object.values(fields), gameId, teamId, missionId);
  }
};
// Reset the cooldown so the player can retry immediately (used when the GM
// rejects a special-mission submission).
const clearCrSpecialCooldown = (gameId, teamId, missionId) =>
  db.prepare('UPDATE cr_special_progress SET last_attempt=NULL WHERE game_id=? AND team_id=? AND mission_id=?')
    .run(gameId, teamId, missionId);

const acceptCrSubmission = id => {
  db.prepare('UPDATE cr_submissions SET status=?, reviewed_at=? WHERE id=?')
    .run('accepted', Date.now(), id);
};
const rejectCrSubmission = (id, msg) => {
  const sub = getCrSubmission(id); if(!sub) return;
  db.prepare('UPDATE cr_submissions SET status=?, rejection_message=?, media_path=NULL, reviewed_at=? WHERE id=?')
    .run('rejected', msg||'', Date.now(), id);
};

// Combined pending count per team across both regular team_missions and
// cr_submissions — used to drive the GM dashboard notification dot.
const getPendingCountsByTeam = gameId => {
  const counts = {};
  db.prepare(`SELECT t.id as team_id, COUNT(tm.id) as cnt
              FROM teams t LEFT JOIN team_missions tm
                ON tm.team_id=t.id AND tm.status='pending'
              WHERE t.game_id=? GROUP BY t.id`).all(gameId).forEach(r => {
    counts[r.team_id] = (counts[r.team_id]||0) + (r.cnt||0);
  });
  db.prepare(`SELECT team_id, COUNT(*) as cnt FROM cr_submissions
              WHERE game_id=? AND status='pending' GROUP BY team_id`)
    .all(gameId).forEach(r => {
      counts[r.team_id] = (counts[r.team_id]||0) + (r.cnt||0);
    });
  return counts;
};

// CR Captures (photo of another team)
const createCrCapture = (gameId, teamId, targetTeamId, mediaPath) =>
  num(db.prepare('INSERT INTO cr_team_captures(game_id,team_id,target_team_id,media_path) VALUES(?,?,?,?)')
    .run(gameId, teamId, targetTeamId, mediaPath).lastInsertRowid);
const getCrCaptures   = gameId => db.prepare('SELECT * FROM cr_team_captures WHERE game_id=?').all(gameId);
const reviewCrCapture = (id, accept, bonusPoints) => {
  if (accept) {
    db.prepare('UPDATE cr_team_captures SET status=? WHERE id=?').run('accepted', id);
    const cap = db.prepare('SELECT * FROM cr_team_captures WHERE id=?').get(id);
    if (cap) db.prepare('UPDATE teams SET score=score+?, last_score_at=? WHERE id=?').run(bonusPoints||5, Date.now(), cap.team_id);
  } else {
    db.prepare('UPDATE cr_team_captures SET status=? WHERE id=?').run('rejected', id);
  }
};


// ── Team selfies ─────────────────────────────────────────────────────────────
const setTeamSelfie = (teamId, path) =>
  db.prepare('UPDATE teams SET selfie_path=? WHERE id=?').run(path, teamId);

// ── Team freezes ─────────────────────────────────────────────────────────────
// Insert a freeze row. Throws on UNIQUE conflict (same freezer→frozen pair
// already exists) so the route can surface "already frozen" to the caller.
const createTeamFreeze = (gameId, freezerId, frozenId, durationSec) => {
  const until = Date.now() + Math.max(1, durationSec|0)*1000;
  db.prepare('INSERT INTO team_freezes(game_id,freezer_team_id,frozen_team_id,until_ms) VALUES(?,?,?,?)')
    .run(gameId, freezerId, frozenId, until);
  return until;
};

// End every active freeze targeting `frozenId` (regardless of freezer) by
// expiring their until_ms. Used by the GM's thaw button.
const expireActiveFreezesForTeam = (gameId, frozenId) =>
  db.prepare('UPDATE team_freezes SET until_ms=? WHERE game_id=? AND frozen_team_id=? AND until_ms>?')
    .run(Date.now()-1, gameId, frozenId, Date.now());
// All freezes the given team has issued (used for "already frozen" greying).
const listFreezesByFreezer = (gameId, freezerId) =>
  db.prepare('SELECT * FROM team_freezes WHERE game_id=? AND freezer_team_id=? ORDER BY id').all(gameId, freezerId);
// All active freezes targeting `frozenId` right now.
const activeFreezeFor = (gameId, frozenId) => {
  const now = Date.now();
  return db.prepare('SELECT * FROM team_freezes WHERE game_id=? AND frozen_team_id=? AND until_ms>? ORDER BY until_ms DESC LIMIT 1')
    .get(gameId, frozenId, now);
};
// Quick boolean: is this team currently frozen?
const isTeamFrozen = (gameId, frozenId) => !!activeFreezeFor(gameId, frozenId);
// Full freeze log for a game (used by GM dashboard).
const listFreezesForGame = gameId =>
  db.prepare('SELECT * FROM team_freezes WHERE game_id=? ORDER BY id').all(gameId);

module.exports = {
  // Raw handle for callers that need ad-hoc prepared statements (e.g. the
  // collage helper's UNION query). Prefer named helpers below for everything
  // else; reach for `_db` only when adding a new helper would be overkill.
  _db: db,
  getSetting,setSetting,isSetup,setupPassword,verifyPassword,changePassword,getSettings,updateSettings,
  issueGmToken,verifyGmToken,rotateGmToken,
  getRulesets,getRuleset,createRuleset,updateRuleset,deleteRuleset,
  getModes,getMode,createMode,updateMode,deleteMode,getGameRules,
  getLocations,getLocation,createLocation,updateLocation,deleteLocation,
  getMissions,getMission,createMission,updateMission,deleteMission,
  getGame,getGames,getGameFull,getRunningGames,getActiveGames,getOldGames,createGame,updateGame,deleteGame,selectMissions,
  getTeam,getTeams,createTeam,getRankings,
  getTeamMissions,getSubmission,getSubmissionById,getAcceptedSubmissions,
  submitMission,acceptSubmission,rejectSubmission,
  setSubmissionRotation,setCrSubmissionRotation,setTeamSelfieRotation,
  saveMessage,getMessages,
  getCrModes,getCrMode,createCrMode,updateCrMode,deleteCrMode,
  getCrMissions,getCrMission,createCrMission,updateCrMission,deleteCrMission,reorderCrMissions,
  linkCrMode,getGameCrMode,isCrGame,
  getCrHints,getCrHint,createCrHint,updateCrHint,deleteCrHint,reorderCrHints,getTeamHintsUsed,incrementTeamHints,
  getCrProgress,getAllCrProgress,initCrProgress,updateCrProgress,
  getCrMissionProgress,getCrMissionProgressForTeam,listCrMissionProgressForGame,upsertCrMissionProgress,
  updateTeamGps,getTeamGps,
  createCrCapture,getCrCaptures,reviewCrCapture,
  createCrSubmission,getCrSubmission,getCrSubmissionFor,
  getPendingCrSubmissionsByTeam,acceptCrSubmission,rejectCrSubmission,
  getPendingCountsByTeam,listCrSubmissions,addTeamScore,
  recordCrArrival,hasCrArrival,listCrArrivals,listCrArrivalsForGame,
  getSpecialCrMissions,getLinearCrMissions,
  getCrSpecialProgress,getCrSpecialProgressForTeam,upsertCrSpecialProgress,clearCrSpecialCooldown,
  listCrSpecialProgressForGame,
  setTeamSelfie,
  createTeamFreeze,listFreezesByFreezer,activeFreezeFor,isTeamFrozen,listFreezesForGame,
  expireActiveFreezesForTeam,
};
