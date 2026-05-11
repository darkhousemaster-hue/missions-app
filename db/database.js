'use strict';
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path   = require('path');
const fs     = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'missions.db');
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
    joined_at INTEGER DEFAULT (unixepoch()*1000));
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
// CR mode-level settings: allowed media + chosen ruleset + default game duration
try { db.exec("ALTER TABLE cr_modes ADD COLUMN allow_photo INTEGER DEFAULT 1"); } catch(e) {}
try { db.exec("ALTER TABLE cr_modes ADD COLUMN allow_video INTEGER DEFAULT 1"); } catch(e) {}
try { db.exec("ALTER TABLE cr_modes ADD COLUMN ruleset_id INTEGER"); } catch(e) {}
try { db.exec("ALTER TABLE cr_modes ADD COLUMN timer_default INTEGER DEFAULT 60"); } catch(e) {}
// Hide a CR mission's description/task until the player physically arrives.
try { db.exec("ALTER TABLE cr_missions ADD COLUMN hide_until_arrival INTEGER DEFAULT 0"); } catch(e) {}
// Distinguish GPS-trigger hints (shown before arrival to help find the spot)
// from answer/question hints (shown after arrival to help solve the mission).
// Existing rows default to 'answer' so previously-saved hints keep their meaning.
try { db.exec("ALTER TABLE cr_hints ADD COLUMN hint_type TEXT DEFAULT 'answer'"); } catch(e) {}
// Track per-team GPS hint usage on the same cr_team_hints row as the answer
// hint usage — avoids changing the existing UNIQUE(game,team,mission) key.
try { db.exec("ALTER TABLE cr_team_hints ADD COLUMN gps_hints_used INTEGER DEFAULT 0"); } catch(e) {}
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
const getSettings = () => { const o={}; db.prepare('SELECT key,value FROM settings').all().forEach(r=>{ if(r.key!=='password_hash') o[r.key]=r.value; }); return o; };
const updateSettings = obj => { const u=db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)'); runTx(()=>{ for(const[k,v] of Object.entries(obj)) u.run(k,v); }); };

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
const getLocations   = () => db.prepare('SELECT * FROM locations ORDER BY name').all();
const getLocation    = id => db.prepare('SELECT * FROM locations WHERE id=?').get(id);
const createLocation = ({name,missions_count=10,min_location_missions=3,allow_photo=1,allow_video=1,allow_indoor=1}) =>
  num(db.prepare('INSERT INTO locations(name,timer_default,missions_count,min_location_missions,allow_photo,allow_video,allow_indoor) VALUES(?,?,?,?,?,?,?)').run(name,60,missions_count,min_location_missions,allow_photo?1:0,allow_video?1:0,allow_indoor?1:0).lastInsertRowid);
const updateLocation = (id,{name,missions_count,min_location_missions,allow_photo=1,allow_video=1,allow_indoor=1}) =>
  db.prepare('UPDATE locations SET name=?,missions_count=?,min_location_missions=?,allow_photo=?,allow_video=?,allow_indoor=? WHERE id=?').run(name,missions_count||10,min_location_missions||0,allow_photo?1:0,allow_video?1:0,allow_indoor?1:0,id);
const deleteLocation = id => db.prepare('DELETE FROM locations WHERE id=?').run(id);

// ── Missions ──────────────────────────────────────────────────────────────────
const getMissions = (modeId, locationId) => {
  if (modeId===undefined && locationId===undefined) return db.prepare('SELECT * FROM missions ORDER BY id').all();
  if (locationId===null) return db.prepare('SELECT * FROM missions WHERE mode_id=? AND location_id IS NULL ORDER BY id').all(modeId);
  if (locationId!==undefined) return db.prepare('SELECT * FROM missions WHERE mode_id=? AND location_id=? ORDER BY id').all(modeId, locationId);
  return db.prepare('SELECT * FROM missions WHERE mode_id=? ORDER BY id').all(modeId);
};
const getMission = id => db.prepare('SELECT * FROM missions WHERE id=?').get(id);
const createMission = ({mode_id=1,location_id=null,name='',name_de='',name_en='',name_fr='',name_it='',description_de='',description_en='',description_fr='',description_it='',task_de='',task_en='',task_fr='',task_it='',media_type='photo',points=1,is_indoor=0}) =>
  num(db.prepare('INSERT INTO missions(mode_id,location_id,name,name_de,name_en,name_fr,name_it,description_de,description_en,description_fr,description_it,task_de,task_en,task_fr,task_it,media_type,points,is_indoor) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(mode_id||1,location_id||null,name||name_de||'',name_de||name||'',name_en||name||'',name_fr||name||'',name_it||name||'',description_de,description_en,description_fr,description_it,task_de,task_en,task_fr,task_it,media_type,points,is_indoor?1:0).lastInsertRowid);
const updateMission = (id,{mode_id,location_id,name,name_de,name_en,name_fr,name_it,description_de,description_en,description_fr,description_it,task_de,task_en,task_fr,task_it,media_type,points,is_indoor}) =>
  db.prepare('UPDATE missions SET mode_id=?,location_id=?,name=?,name_de=?,name_en=?,name_fr=?,name_it=?,description_de=?,description_en=?,description_fr=?,description_it=?,task_de=?,task_en=?,task_fr=?,task_it=?,media_type=?,points=?,is_indoor=? WHERE id=?').run(mode_id||1,location_id||null,name||name_de||'',name_de||name||'',name_en||name||'',name_fr||name||'',name_it||name||'',description_de,description_en,description_fr,description_it||'',task_de||'',task_en||'',task_fr||'',task_it||'',media_type,points,is_indoor?1:0,id);
const deleteMission = id => db.prepare('DELETE FROM missions WHERE id=?').run(id);

// ── Games ─────────────────────────────────────────────────────────────────────
const getGame         = id => db.prepare('SELECT * FROM games WHERE id=?').get(id);
const getRunningGames = () => db.prepare('SELECT * FROM games WHERE timer_running=1').all();
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
    db.prepare('DELETE FROM cr_team_hints WHERE game_id=?').run(id);
    db.prepare('DELETE FROM cr_team_captures WHERE game_id=?').run(id);
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
const createTeam = ({game_id, name}) => {
  const teamId=num(db.prepare('INSERT INTO teams(game_id,name) VALUES(?,?)').run(game_id,name).lastInsertRowid);
  const gms=db.prepare('SELECT id,mission_id FROM game_missions WHERE game_id=?').all(game_id);
  const ins=db.prepare('INSERT INTO team_missions(team_id,mission_id,game_mission_id) VALUES(?,?,?)');
  runTx(()=>gms.forEach(gm=>ins.run(teamId,gm.mission_id,gm.id)));
  return teamId;
};
const getRankings = gameId => db.prepare(`
  SELECT t.id, t.name, t.score,
    (SELECT COUNT(*) FROM team_missions tm WHERE tm.team_id=t.id AND tm.status='accepted') as completed
  FROM teams t WHERE t.game_id=? ORDER BY t.score DESC, completed DESC`).all(gameId);

// ── Team Missions ─────────────────────────────────────────────────────────────
const getTeamMissions = teamId => db.prepare(`
  SELECT tm.*, m.name as mission_name, m.name_de, m.name_en, m.name_fr, m.name_it,
    m.description_de, m.description_en, m.description_fr, m.description_it,
    m.task_de, m.task_en, m.task_fr, m.task_it,
    m.media_type, m.points, m.is_indoor
  FROM team_missions tm JOIN missions m ON m.id=tm.mission_id
  WHERE tm.team_id=? ORDER BY tm.id`).all(teamId);
const getSubmission          = (tid,mid) => db.prepare('SELECT * FROM team_missions WHERE team_id=? AND mission_id=?').get(tid,mid);
const getSubmissionById      = id => db.prepare('SELECT * FROM team_missions WHERE id=?').get(id);
const getAcceptedSubmissions = tid => db.prepare(`
  SELECT tm.*, m.media_type FROM team_missions tm JOIN missions m ON m.id=tm.mission_id
  WHERE tm.team_id=? AND tm.status='accepted' AND tm.media_path IS NOT NULL`).all(tid);

const submitMission = ({teamId,missionId,mediaPath}) =>
  db.prepare('UPDATE team_missions SET status=?,media_path=?,submitted_at=? WHERE team_id=? AND mission_id=?').run('pending',mediaPath,Date.now(),teamId,missionId);
const acceptSubmission = id => {
  const sub=getSubmissionById(id); if(!sub) return;
  const pts=getMission(sub.mission_id)?.points||1;
  db.prepare('UPDATE team_missions SET status=?,reviewed_at=? WHERE id=?').run('accepted',Date.now(),id);
  db.prepare('UPDATE teams SET score=score+? WHERE id=?').run(pts,sub.team_id);
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
  const {name, allow_photo=1, allow_video=1, ruleset_id=null, timer_default=60} = data;
  return num(db.prepare('INSERT INTO cr_modes(name,allow_photo,allow_video,ruleset_id,timer_default) VALUES(?,?,?,?,?)')
    .run(name, allow_photo?1:0, allow_video?1:0, ruleset_id||null, Number(timer_default)||60).lastInsertRowid);
};
const updateCrMode  = (id, data) => {
  if (typeof data === 'string') data = {name: data};
  const existing = getCrMode(id) || {};
  const name          = data.name          !== undefined ? data.name          : existing.name;
  const allow_photo   = data.allow_photo   !== undefined ? (data.allow_photo?1:0) : existing.allow_photo;
  const allow_video   = data.allow_video   !== undefined ? (data.allow_video?1:0) : existing.allow_video;
  const ruleset_id    = data.ruleset_id    !== undefined ? (data.ruleset_id||null) : existing.ruleset_id;
  const timer_default = data.timer_default !== undefined ? (Number(data.timer_default)||60) : (existing.timer_default||60);
  db.prepare('UPDATE cr_modes SET name=?, allow_photo=?, allow_video=?, ruleset_id=?, timer_default=? WHERE id=?')
    .run(name, allow_photo, allow_video, ruleset_id, timer_default, id);
};
const deleteCrMode  = id => {
  runTx(() => {
    // Find missions in this mode so we can clear their team progress/hints
    const missions = db.prepare('SELECT id FROM cr_missions WHERE mode_id=?').all(id);
    const mIds = missions.map(m => m.id);
    if (mIds.length) {
      const placeholders = mIds.map(()=>'?').join(',');
      db.prepare(`DELETE FROM cr_team_progress WHERE mission_id IN (${placeholders})`).run(...mIds);
      db.prepare(`DELETE FROM cr_team_hints WHERE mission_id IN (${placeholders})`).run(...mIds);
    }
    db.prepare('DELETE FROM cr_game_links WHERE cr_mode_id=?').run(id);
    db.prepare('DELETE FROM cr_modes WHERE id=?').run(id);
  });
};

const getCrMissions    = modeId => db.prepare('SELECT * FROM cr_missions WHERE mode_id=? ORDER BY order_index, id').all(modeId);
const getCrMission     = id => db.prepare('SELECT * FROM cr_missions WHERE id=?').get(id);
// Field list shared by INSERT and UPDATE so adding a column happens in one place.
const CR_MISSION_EDIT_FIELDS = ['order_index','name_de','name_en','name_fr','name_it',
  'description_de','description_en','description_fr','description_it',
  'task_de','task_en','task_fr','task_it','hint_de','hint_en','hint_fr','hint_it',
  'points','lat','lng','radius_meters','use_map','use_gps',
  'is_timed','timer_seconds','penalty_interval','penalty_points','media_required',
  'has_answer','answer_de','answer_en','answer_fr','answer_it',
  'hide_until_arrival'];
const createCrMission  = (data) => {
  const fields = ['mode_id', ...CR_MISSION_EDIT_FIELDS];
  const vals = fields.map(f => data[f] !== undefined ? data[f] : null);
  return num(db.prepare(`INSERT INTO cr_missions(${fields.join(',')}) VALUES(${fields.map(()=>'?').join(',')})`).run(...vals).lastInsertRowid);
};
const updateCrMission  = (id, data) => {
  const sets = CR_MISSION_EDIT_FIELDS.map(f=>`${f}=?`).join(',');
  const vals = [...CR_MISSION_EDIT_FIELDS.map(f => data[f] !== undefined ? data[f] : null), id];
  db.prepare(`UPDATE cr_missions SET ${sets} WHERE id=?`).run(...vals);
};
const deleteCrMission  = id => {
  runTx(() => {
    db.prepare('DELETE FROM cr_team_progress WHERE mission_id=?').run(id);
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

// GPS tracking
const updateTeamGps = (gameId, teamId, lat, lng) =>
  db.prepare('INSERT OR REPLACE INTO team_gps(game_id,team_id,lat,lng,updated_at) VALUES(?,?,?,?,?)')
    .run(gameId, teamId, lat, lng, Date.now());
const getTeamGps = gameId =>
  db.prepare('SELECT * FROM team_gps WHERE game_id=?').all(gameId);

// CR Hints. `hint_type` is 'gps' (shown before arrival) or 'answer' (shown
// after arrival / for answer missions). getCrHints can optionally be scoped
// to one type.
const getCrHints     = (missionId, type) => type
  ? db.prepare('SELECT * FROM cr_hints WHERE mission_id=? AND hint_type=? ORDER BY order_index,id').all(missionId, type)
  : db.prepare('SELECT * FROM cr_hints WHERE mission_id=? ORDER BY order_index,id').all(missionId);
const createCrHint   = ({mission_id,order_index=0,text_de='',text_en='',text_fr='',text_it='',image_path=null,hint_type='answer'}) =>
  num(db.prepare('INSERT INTO cr_hints(mission_id,order_index,text_de,text_en,text_fr,text_it,image_path,hint_type) VALUES(?,?,?,?,?,?,?,?)').run(mission_id,order_index,text_de,text_en,text_fr,text_it,image_path,hint_type==='gps'?'gps':'answer').lastInsertRowid);
const updateCrHint   = (id,{order_index,text_de,text_en,text_fr,text_it,image_path,hint_type}) => {
  // If hint_type isn't passed we leave the existing value alone (back-compat).
  const existing = db.prepare('SELECT hint_type FROM cr_hints WHERE id=?').get(id);
  const ht = hint_type !== undefined
    ? (hint_type==='gps'?'gps':'answer')
    : (existing ? existing.hint_type : 'answer');
  db.prepare('UPDATE cr_hints SET order_index=?,text_de=?,text_en=?,text_fr=?,text_it=?,image_path=?,hint_type=? WHERE id=?')
    .run(order_index||0,text_de||'',text_en||'',text_fr||'',text_it||'',image_path||null,ht,id);
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
const createCrSubmission = (gameId, teamId, missionId, mediaPath) => {
  // Replace any prior pending/rejected submission for this team+mission so
  // the queue stays clean when a player retries.
  db.prepare('DELETE FROM cr_submissions WHERE game_id=? AND team_id=? AND mission_id=? AND status<>?')
    .run(gameId, teamId, missionId, 'accepted');
  return num(db.prepare('INSERT INTO cr_submissions(game_id,team_id,mission_id,media_path,status) VALUES(?,?,?,?,?)')
    .run(gameId, teamId, missionId, mediaPath, 'pending').lastInsertRowid);
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
const addTeamScore = (teamId, delta) => {
  if(!delta) return;
  db.prepare('UPDATE teams SET score = score + ? WHERE id = ?').run(delta, teamId);
};

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
    if (cap) db.prepare('UPDATE teams SET score=score+? WHERE id=?').run(bonusPoints||5, cap.team_id);
  } else {
    db.prepare('UPDATE cr_team_captures SET status=? WHERE id=?').run('rejected', id);
  }
};


module.exports = {
  getSetting,setSetting,isSetup,setupPassword,verifyPassword,changePassword,getSettings,updateSettings,
  getRulesets,getRuleset,createRuleset,updateRuleset,deleteRuleset,
  getModes,getMode,createMode,updateMode,deleteMode,getGameRules,
  getLocations,getLocation,createLocation,updateLocation,deleteLocation,
  getMissions,getMission,createMission,updateMission,deleteMission,
  getGame,getGames,getGameFull,getRunningGames,getOldGames,createGame,updateGame,deleteGame,selectMissions,
  getTeam,getTeams,createTeam,getRankings,
  getTeamMissions,getSubmission,getSubmissionById,getAcceptedSubmissions,
  submitMission,acceptSubmission,rejectSubmission,
  saveMessage,getMessages,
  getCrModes,getCrMode,createCrMode,updateCrMode,deleteCrMode,
  getCrMissions,getCrMission,createCrMission,updateCrMission,deleteCrMission,reorderCrMissions,
  linkCrMode,getGameCrMode,isCrGame,
  getCrHints,getCrHint,createCrHint,updateCrHint,deleteCrHint,reorderCrHints,getTeamHintsUsed,incrementTeamHints,
  getCrProgress,getAllCrProgress,initCrProgress,updateCrProgress,
  updateTeamGps,getTeamGps,
  createCrCapture,getCrCaptures,reviewCrCapture,
  createCrSubmission,getCrSubmission,getCrSubmissionFor,
  getPendingCrSubmissionsByTeam,acceptCrSubmission,rejectCrSubmission,
  getPendingCountsByTeam,listCrSubmissions,addTeamScore,
};
