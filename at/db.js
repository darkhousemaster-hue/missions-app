// AdventureTrail data layer.
//
// Every table is prefixed at_ and created here on first require, so the module
// owns its own schema and dropping those tables removes it completely. It
// borrows the open DatabaseSync handle from the main db module rather than
// opening a second connection to the same file, which SQLite would serialise
// badly.
//
// Translatable fields are stored as a JSON object keyed by language
// ({"de":"...","en":"..."}) instead of one column per language. A trail has far
// more text than a mission does, and five columns per field would have put this
// table past sixty columns before the first feature.
const main = require('../db/database.js');
const db = main._db;

const crypto = require('node:crypto');

// ── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS at_trails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    city TEXT DEFAULT '',
    status TEXT DEFAULT 'draft',          -- draft | live | retired
    langs TEXT DEFAULT '["de"]',          -- which languages this trail ships
    intro TEXT DEFAULT '{}',              -- hook + how-to pages, i18n
    theme TEXT DEFAULT '{}',              -- trail-wide look, nodes override
    video_path TEXT,                      -- optional opener, played on Start
    start_lat REAL, start_lng REAL,
    created_at INTEGER DEFAULT (unixepoch()*1000),
    updated_at INTEGER DEFAULT (unixepoch()*1000));

  CREATE TABLE IF NOT EXISTS at_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trail_id INTEGER NOT NULL REFERENCES at_trails(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'station', -- start|station|riddle|story|arg|gate|nav|end
    title TEXT DEFAULT '{}',              -- i18n
    arrive TEXT DEFAULT '{}',             -- i18n, shown on unlocking
    depart TEXT DEFAULT '{}',             -- i18n, shown on leaving: carries the story
    task TEXT DEFAULT '{}',               -- i18n, what to do here

    -- how the node opens. 'answer' is the default and needs no permissions.
    trigger_kind TEXT DEFAULT 'answer',   -- answer|gps|qr|code|none
    answers TEXT DEFAULT '{}',            -- i18n -> array of accepted spellings
    answer_case_sensitive INTEGER DEFAULT 0,
    post_code TEXT,                       -- printed on the post, always a way through
    lat REAL, lng REAL,
    radius_m INTEGER DEFAULT 45,
    accuracy_max INTEGER DEFAULT 80,      -- refuse a fix worse than this

    nav_mode TEXT DEFAULT 'none',         -- none|distance|arrow
    story_media TEXT DEFAULT 'text',      -- text|video|voice
    story_media_path TEXT,                -- the uploaded file, when not text
    x INTEGER DEFAULT 0, y INTEGER DEFAULT 0,   -- canvas position
    style TEXT DEFAULT '{}',              -- per-node look, within the theme
    points INTEGER DEFAULT 0,
    skip_after_min INTEGER DEFAULT 0,     -- 0 = never offer a skip
    order_index INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()*1000));

  CREATE TABLE IF NOT EXISTS at_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trail_id INTEGER NOT NULL REFERENCES at_trails(id) ON DELETE CASCADE,
    from_node INTEGER NOT NULL REFERENCES at_nodes(id) ON DELETE CASCADE,
    to_node INTEGER NOT NULL REFERENCES at_nodes(id) ON DELETE CASCADE,
    label TEXT DEFAULT '{}',              -- i18n, shown on a branch choice
    branch_key TEXT,                      -- tags everything downstream of a gate
    UNIQUE(from_node, to_node));

  CREATE TABLE IF NOT EXISTS at_hints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id INTEGER NOT NULL REFERENCES at_nodes(id) ON DELETE CASCADE,
    order_index INTEGER DEFAULT 0,
    text TEXT DEFAULT '{}',               -- i18n
    after_minutes INTEGER DEFAULT 3,      -- time at the post before it opens
    resolves INTEGER DEFAULT 0);          -- the last rung gives the answer away

  CREATE TABLE IF NOT EXISTS at_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id INTEGER NOT NULL REFERENCES at_nodes(id) ON DELETE CASCADE,
    kind TEXT DEFAULT 'image',            -- audio|video|image|doc|page
    path TEXT NOT NULL,
    title TEXT DEFAULT '',
    appear_when TEXT DEFAULT '{}',        -- {on:'arrive'|'solve'|'delay', minutes:n}
    preload INTEGER DEFAULT 1,
    order_index INTEGER DEFAULT 0);

  CREATE TABLE IF NOT EXISTS at_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trail_id INTEGER NOT NULL REFERENCES at_trails(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    note TEXT DEFAULT '',
    run_id TEXT,                          -- set once redeemed
    created_at INTEGER DEFAULT (unixepoch()*1000),
    redeemed_at INTEGER);

  CREATE TABLE IF NOT EXISTS at_runs (
    id TEXT PRIMARY KEY,
    trail_id INTEGER NOT NULL REFERENCES at_trails(id) ON DELETE CASCADE,
    key_id INTEGER,
    team_name TEXT DEFAULT '',
    join_code TEXT,                       -- other phones in the team join with this
    lang TEXT DEFAULT 'de',
    branch_key TEXT,
    started_at INTEGER,
    finished_at INTEGER,
    created_at INTEGER DEFAULT (unixepoch()*1000));

  CREATE TABLE IF NOT EXISTS at_run_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL REFERENCES at_runs(id) ON DELETE CASCADE,
    node_id INTEGER NOT NULL REFERENCES at_nodes(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'open',           -- open | done | skipped
    opened_at INTEGER,                    -- first seen: the clock hints run on
    done_at INTEGER,
    hints_used INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    UNIQUE(run_id, node_id));

  CREATE INDEX IF NOT EXISTS at_nodes_trail ON at_nodes(trail_id);
  CREATE INDEX IF NOT EXISTS at_edges_trail ON at_edges(trail_id);
  CREATE INDEX IF NOT EXISTS at_prog_run    ON at_run_progress(run_id);
`);

// Added after the first build, so existing trails get them here.
try { db.exec("ALTER TABLE at_nodes ADD COLUMN story_media TEXT DEFAULT 'text'"); } catch (e) {}
try { db.exec("ALTER TABLE at_nodes ADD COLUMN story_media_path TEXT"); } catch (e) {}
// Finds that are not files: a link, a number, an address, a letter. ref holds
// the target, body the text (per language), meta the rest (file name, size,
// the address a fake website shows, an email subject).
// A page's own look, from the page designer: background, placed pictures,
// buttons, video areas, text, and where the part's own content sits.
try { db.exec("ALTER TABLE at_nodes ADD COLUMN design TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE at_assets ADD COLUMN ref TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE at_assets ADD COLUMN body TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE at_assets ADD COLUMN meta TEXT"); } catch (e) {}

// ── Helpers ──────────────────────────────────────────────────────────────────
const J = (v, fallback) => {
  if (v === null || v === undefined || v === '') return fallback;
  try { const p = JSON.parse(v); return p === null ? fallback : p; } catch (e) { return fallback; }
};
const S = v => JSON.stringify(v === undefined ? null : v);
const num = v => (typeof v === 'bigint' ? Number(v) : v);

// Pick a language out of an i18n object, falling back to the trail's first
// language and then to anything present, so a half-translated trail still reads.
const pick = (obj, lang) => {
  const o = typeof obj === 'string' ? J(obj, {}) : (obj || {});
  if (o[lang]) return o[lang];
  for (const k of ['de', 'en', 'fr', 'it', 'es']) if (o[k]) return o[k];
  const first = Object.values(o).find(v => v);
  return first || '';
};

// Codes are typed off a printed card, outdoors, on a phone. No character that
// can be read as another one, and no vowels, so a code can never spell a word.
const CODE_ALPHABET = '23456789CDFGHJKMNPQRTVWXY';
const makeCode = (len = 8) => {
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
};
// Accept what a human typed: strip everything that is not in the alphabet,
// upper-case it, and map the characters people habitually substitute.
const normCode = s => String(s || '').toUpperCase()
  .replace(/[O]/g, '0').replace(/[IL]/g, '1')   // then drop them, 0/1 are not in the set
  .replace(/[^0-9A-Z]/g, '')
  .replace(/[^23456789CDFGHJKMNPQRTVWXY]/g, '');

const shortId = () => makeCode(8);

// ── Trails ───────────────────────────────────────────────────────────────────
const listTrails = () => db.prepare(
  `SELECT t.*, (SELECT COUNT(*) FROM at_nodes n WHERE n.trail_id=t.id) AS node_count,
               (SELECT COUNT(*) FROM at_runs r WHERE r.trail_id=t.id) AS run_count
     FROM at_trails t ORDER BY t.updated_at DESC`).all().map(hydrateTrail);

const getTrail = id => {
  const t = db.prepare('SELECT * FROM at_trails WHERE id=?').get(Number(id));
  return t ? hydrateTrail(t) : null;
};
function hydrateTrail(t) {
  return { ...t, id: num(t.id), langs: J(t.langs, ['de']), intro: J(t.intro, {}), theme: J(t.theme, {}) };
}

const createTrail = ({ name, city = '', langs = ['de'] }) => num(db.prepare(
  'INSERT INTO at_trails(name,city,langs) VALUES(?,?,?)')
  .run(String(name || 'Neuer Trail'), String(city), S(langs)).lastInsertRowid);

const updateTrail = (id, p) => {
  const cur = db.prepare('SELECT * FROM at_trails WHERE id=?').get(Number(id));
  if (!cur) return false;
  const v = (k, enc) => p[k] === undefined ? cur[k] : (enc ? S(p[k]) : p[k]);
  db.prepare(`UPDATE at_trails SET name=?,city=?,status=?,langs=?,intro=?,theme=?,
              video_path=?,start_lat=?,start_lng=?,updated_at=? WHERE id=?`)
    .run(v('name'), v('city'), v('status'), v('langs', 1), v('intro', 1), v('theme', 1),
         v('video_path'), v('start_lat'), v('start_lng'), Date.now(), Number(id));
  return true;
};
const deleteTrail = id => { db.prepare('DELETE FROM at_trails WHERE id=?').run(Number(id)); };

// ── Nodes ────────────────────────────────────────────────────────────────────
const NODE_JSON = ['title', 'arrive', 'depart', 'task', 'answers', 'style', 'design'];
function hydrateNode(n) {
  const out = { ...n, id: num(n.id), trail_id: num(n.trail_id) };
  for (const k of NODE_JSON) out[k] = J(n[k], k === 'answers' ? {} : (k === 'style' ? {} : {}));
  return out;
}
const listNodes = trailId => db.prepare(
  'SELECT * FROM at_nodes WHERE trail_id=? ORDER BY order_index, id').all(Number(trailId)).map(hydrateNode);
const getNode = id => {
  const n = db.prepare('SELECT * FROM at_nodes WHERE id=?').get(Number(id));
  return n ? hydrateNode(n) : null;
};
const SOLVABLE = new Set(['station', 'riddle']);
const createNode = (trailId, p = {}) => {
  const kind = String(p.kind || 'station');
  // Without a position, land below whatever sits lowest. The corner is where
  // the first card already is, so defaulting to it hides one behind another.
  let x = Number(p.x), y = Number(p.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    const low = db.prepare('SELECT MAX(y) AS y FROM at_nodes WHERE trail_id=?').get(Number(trailId));
    x = Number.isFinite(x) ? x : 40;
    y = Number.isFinite(y) ? y : (low && low.y != null ? Number(low.y) + 155 : 30);
  }
  return num(db.prepare(
    'INSERT INTO at_nodes(trail_id,kind,title,x,y,order_index,trigger_kind) VALUES(?,?,?,?,?,?,?)')
    .run(Number(trailId), kind, S(p.title || {}),
         Math.max(0, Math.round(x)), Math.max(0, Math.round(y)), Number(p.order_index) || 0,
         p.trigger_kind || (SOLVABLE.has(kind) ? 'answer' : 'none')).lastInsertRowid);
};

const NODE_FIELDS = ['kind', 'title', 'arrive', 'depart', 'task', 'trigger_kind', 'answers',
  'story_media', 'story_media_path',
  'answer_case_sensitive', 'post_code', 'lat', 'lng', 'radius_m', 'accuracy_max',
  'nav_mode', 'x', 'y', 'style', 'points', 'skip_after_min', 'order_index', 'design'];
const updateNode = (id, p) => {
  const cur = db.prepare('SELECT * FROM at_nodes WHERE id=?').get(Number(id));
  if (!cur) return false;
  const vals = NODE_FIELDS.map(k => {
    if (p[k] === undefined) return cur[k];
    return NODE_JSON.includes(k) ? S(p[k]) : p[k];
  });
  db.prepare(`UPDATE at_nodes SET ${NODE_FIELDS.map(k => k + '=?').join(',')} WHERE id=?`)
    .run(...vals, Number(id));
  return true;
};
const deleteNode = id => { db.prepare('DELETE FROM at_nodes WHERE id=?').run(Number(id)); };
// Every saved design, for telling which uploaded design files are still used.
const listAllDesigns = () => db.prepare("SELECT design FROM at_nodes WHERE design IS NOT NULL AND design <> '{}'")
  .all().map(r => J(r.design, null)).filter(Boolean);

// ── Edges ────────────────────────────────────────────────────────────────────
const listEdges = trailId => db.prepare('SELECT * FROM at_edges WHERE trail_id=?')
  .all(Number(trailId)).map(e => ({ ...e, id: num(e.id), label: J(e.label, {}) }));
const addEdge = (trailId, from, to, label = {}, branchKey = null) => {
  if (Number(from) === Number(to)) return null;
  try {
    return num(db.prepare('INSERT INTO at_edges(trail_id,from_node,to_node,label,branch_key) VALUES(?,?,?,?,?)')
      .run(Number(trailId), Number(from), Number(to), S(label), branchKey).lastInsertRowid);
  } catch (e) { return null; }   // UNIQUE: the edge already exists
};
const removeEdge = (from, to) => {
  db.prepare('DELETE FROM at_edges WHERE from_node=? AND to_node=?').run(Number(from), Number(to));
};

// ── Hints ────────────────────────────────────────────────────────────────────
const listHints = nodeId => db.prepare('SELECT * FROM at_hints WHERE node_id=? ORDER BY order_index, id')
  .all(Number(nodeId)).map(h => ({ ...h, id: num(h.id), text: J(h.text, {}) }));
const setHints = (nodeId, hints = []) => {
  db.prepare('DELETE FROM at_hints WHERE node_id=?').run(Number(nodeId));
  const ins = db.prepare('INSERT INTO at_hints(node_id,order_index,text,after_minutes,resolves) VALUES(?,?,?,?,?)');
  hints.forEach((h, i) => ins.run(Number(nodeId), i, S(h.text || {}),
    Number(h.after_minutes) || 0, h.resolves ? 1 : 0));
};

// ── Assets ───────────────────────────────────────────────────────────────────
const hydrateAsset = a => ({ ...a, id: num(a.id), node_id: num(a.node_id),
  appear_when: J(a.appear_when, {}), body: J(a.body, {}), meta: J(a.meta, {}) });
const listAssets = nodeId => db.prepare('SELECT * FROM at_assets WHERE node_id=? ORDER BY order_index, id')
  .all(Number(nodeId)).map(hydrateAsset);
const addAsset = (nodeId, p) => num(db.prepare(
  'INSERT INTO at_assets(node_id,kind,path,title,appear_when,preload,order_index,ref,body,meta) VALUES(?,?,?,?,?,?,?,?,?,?)')
  .run(Number(nodeId), String(p.kind || 'image'), String(p.path || ''), String(p.title || ''),
       S(p.appear_when || {}), p.preload === 0 ? 0 : 1, Number(p.order_index) || 0,
       p.ref == null ? null : String(p.ref), S(p.body || {}), S(p.meta || {})).lastInsertRowid);
const getAsset = id => { const a = db.prepare('SELECT * FROM at_assets WHERE id=?').get(Number(id)); return a ? hydrateAsset(a) : null; };
const ASSET_FIELDS = ['title', 'ref', 'body', 'meta', 'appear_when', 'preload'];
const updateAsset = (id, p) => {
  const cur = db.prepare('SELECT * FROM at_assets WHERE id=?').get(Number(id));
  if (!cur) return false;
  const vals = ASSET_FIELDS.map(k => {
    if (p[k] === undefined) return cur[k];
    return ['body', 'meta', 'appear_when'].includes(k) ? S(p[k]) : (k === 'preload' ? (p[k] ? 1 : 0) : p[k]);
  });
  db.prepare(`UPDATE at_assets SET ${ASSET_FIELDS.map(k => k + '=?').join(',')} WHERE id=?`).run(...vals, Number(id));
  return true;
};
const deleteAsset = id => { db.prepare('DELETE FROM at_assets WHERE id=?').run(Number(id)); };

// ── Keys ─────────────────────────────────────────────────────────────────────
const mintKeys = (trailId, count = 1, note = '') => {
  const ins = db.prepare('INSERT INTO at_keys(trail_id,code,note) VALUES(?,?,?)');
  const out = [];
  for (let i = 0; i < Math.min(500, Math.max(1, count)); i++) {
    for (let tries = 0; tries < 8; tries++) {
      const code = makeCode(8);
      try { ins.run(Number(trailId), code, String(note)); out.push(code); break; }
      catch (e) { /* collision, try again */ }
    }
  }
  return out;
};
const listKeys = trailId => db.prepare('SELECT * FROM at_keys WHERE trail_id=? ORDER BY created_at DESC')
  .all(Number(trailId)).map(k => ({ ...k, id: num(k.id) }));
// A fixed key for testing, which never runs out: every redemption of it starts
// a fresh run rather than handing back the last one, so the trail can be walked
// again and again without minting anything. Live keys stay single use.
const TEST_CODE = '1898';
const isTestCode = code => String(code || '').replace(/[^0-9A-Za-z]/g, '') === TEST_CODE;

const findKey = code => {
  if (isTestCode(code)) return null;      // handled separately, it has no row
  const c = normCode(code);
  if (!c) return null;
  const k = db.prepare('SELECT * FROM at_keys WHERE code=?').get(c);
  return k ? { ...k, id: num(k.id) } : null;
};

// ── Runs ─────────────────────────────────────────────────────────────────────
const getRun = id => {
  const r = db.prepare('SELECT * FROM at_runs WHERE id=?').get(String(id || ''));
  return r ? { ...r, trail_id: num(r.trail_id), key_id: num(r.key_id) } : null;
};
const findRunByJoinCode = code => {
  const c = normCode(code);
  if (!c) return null;
  const r = db.prepare('SELECT * FROM at_runs WHERE join_code=?').get(c);
  return r ? { ...r, trail_id: num(r.trail_id) } : null;
};

// Redeeming is one transaction: a key can only ever produce one run, so two
// phones racing on the same code cannot create two runs.
const redeemKey = (code, { teamName = '', lang = 'de', trailId = null } = {}) => {
  if (isTestCode(code)) {
    // Pick the trail being worked on, else the newest live one, else any trail
    // at all, so the test key works before anything has been published.
    const t = (trailId && getTrail(trailId))
      || db.prepare("SELECT * FROM at_trails WHERE status='live' ORDER BY updated_at DESC").get()
      || db.prepare('SELECT * FROM at_trails ORDER BY updated_at DESC').get();
    if (!t) return { error: 'unknown_code' };
    const runId = shortId();
    db.prepare('INSERT INTO at_runs(id,trail_id,key_id,team_name,join_code,lang) VALUES(?,?,?,?,?,?)')
      .run(runId, num(t.id), null, String(teamName || 'Test'), makeCode(6), String(lang || 'de'));
    return { run: getRun(runId), test: true };
  }
  const key = findKey(code);
  if (!key) return { error: 'unknown_code' };
  if (key.run_id) {
    const existing = getRun(key.run_id);
    if (existing) return { run: existing, reused: true };
    // The key points at a run that is gone: a crash between claiming the key
    // and writing the run, or a deleted trail. Release it rather than leaving
    // a paid-for code permanently dead.
    db.prepare('UPDATE at_keys SET run_id=NULL, redeemed_at=NULL WHERE id=?').run(key.id);
    key.run_id = null;
  }
  const trail = getTrail(key.trail_id);
  if (!trail) return { error: 'unknown_code' };
  if (trail.status !== 'live') return { error: 'trail_not_live' };

  const runId = shortId();
  const joinCode = makeCode(6);
  let ok = false;
  main.runTx ? main.runTx(doIt) : doIt();
  function doIt() {
    const claimed = db.prepare('UPDATE at_keys SET run_id=?, redeemed_at=? WHERE id=? AND run_id IS NULL')
      .run(runId, Date.now(), key.id);
    if (!num(claimed.changes)) return;
    db.prepare('INSERT INTO at_runs(id,trail_id,key_id,team_name,join_code,lang) VALUES(?,?,?,?,?,?)')
      .run(runId, key.trail_id, key.id, String(teamName || ''), joinCode, String(lang || 'de'));
    ok = true;
  }
  if (!ok) {
    const again = findKey(code);
    const existing = again && again.run_id ? getRun(again.run_id) : null;
    return existing ? { run: existing, reused: true } : { error: 'redeem_failed' };
  }
  return { run: getRun(runId) };
};

const startRun = id => { db.prepare('UPDATE at_runs SET started_at=COALESCE(started_at,?) WHERE id=?').run(Date.now(), String(id)); };
const finishRun = id => { db.prepare('UPDATE at_runs SET finished_at=? WHERE id=?').run(Date.now(), String(id)); };
const setRunLang = (id, lang) => { db.prepare('UPDATE at_runs SET lang=? WHERE id=?').run(String(lang), String(id)); };
const setRunBranch = (id, branch) => { db.prepare('UPDATE at_runs SET branch_key=? WHERE id=?').run(branch || null, String(id)); };
const setRunTeam = (id, name) => { db.prepare('UPDATE at_runs SET team_name=? WHERE id=?').run(String(name || ''), String(id)); };

// ── Progress ─────────────────────────────────────────────────────────────────
const listProgress = runId => db.prepare('SELECT * FROM at_run_progress WHERE run_id=?')
  .all(String(runId)).map(p => ({ ...p, id: num(p.id), node_id: num(p.node_id) }));

// Called the first time a node is shown. opened_at is the clock the hint ladder
// runs on, so it must be set once and never moved.
const openNode = (runId, nodeId) => {
  db.prepare(`INSERT INTO at_run_progress(run_id,node_id,status,opened_at) VALUES(?,?,'open',?)
              ON CONFLICT(run_id,node_id) DO UPDATE SET opened_at=COALESCE(opened_at,excluded.opened_at)`)
    .run(String(runId), Number(nodeId), Date.now());
  return db.prepare('SELECT * FROM at_run_progress WHERE run_id=? AND node_id=?').get(String(runId), Number(nodeId));
};
const completeNode = (runId, nodeId, status = 'done') => {
  openNode(runId, nodeId);
  db.prepare('UPDATE at_run_progress SET status=?, done_at=? WHERE run_id=? AND node_id=? AND status=\'open\'')
    .run(status, Date.now(), String(runId), Number(nodeId));
};
const bumpAttempts = (runId, nodeId) => {
  openNode(runId, nodeId);
  db.prepare('UPDATE at_run_progress SET attempts=attempts+1 WHERE run_id=? AND node_id=?')
    .run(String(runId), Number(nodeId));
};
const useHint = (runId, nodeId, n) => {
  openNode(runId, nodeId);
  db.prepare('UPDATE at_run_progress SET hints_used=MAX(hints_used,?) WHERE run_id=? AND node_id=?')
    .run(Number(n), String(runId), Number(nodeId));
};

module.exports = {
  pick, makeCode, normCode, J, TEST_CODE, isTestCode,
  listTrails, getTrail, createTrail, updateTrail, deleteTrail,
  listNodes, getNode, createNode, updateNode, deleteNode, listAllDesigns,
  listEdges, addEdge, removeEdge,
  listHints, setHints,
  listAssets, addAsset, getAsset, updateAsset, deleteAsset,
  mintKeys, listKeys, findKey,
  getRun, findRunByJoinCode, redeemKey, startRun, finishRun, setRunLang, setRunBranch, setRunTeam,
  listProgress, openNode, completeNode, bumpAttempts, useHint,
};
