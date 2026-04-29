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
const deleteGame = id => db.prepare('DELETE FROM games WHERE id=?').run(id);
const getGameFull = gameId => {
  const game=getGame(gameId); if(!game) return null;
  const location=getLocation(game.location_id);
  const mode=getMode(game.mode_id);
  const teams=db.prepare('SELECT * FROM teams WHERE game_id=? ORDER BY joined_at').all(gameId);
  const missions=db.prepare('SELECT gm.id as game_mission_id, m.* FROM game_missions gm JOIN missions m ON m.id=gm.mission_id WHERE gm.game_id=? ORDER BY gm.id').all(gameId);
  return {...game, location, mode, teams, missions};
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

// Get rules for a game (via mode -> ruleset)
const getGameRules = gameId => {
  const game = db.prepare('SELECT * FROM games WHERE id=?').get(gameId);
  if (!game || !game.mode_id) return [];
  const mode = db.prepare('SELECT * FROM modes WHERE id=?').get(game.mode_id);
  if (!mode || !mode.ruleset_id) return [];
  const rs = db.prepare('SELECT * FROM rulesets WHERE id=?').get(mode.ruleset_id);
  try { return JSON.parse(rs?.rules_list || '[]'); } catch(e) { return []; }
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
};
