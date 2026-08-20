'use strict';
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const multer     = require('multer');
const QRCode     = require('qrcode');
const path       = require('path');
const fs         = require('fs');
const { v4: uuidv4 } = require('uuid');
const cron       = require('node-cron');
const db         = require('./db/database');
const collage    = require('./lib/collage');
const profanity  = require('./lib/profanity');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const PORT   = process.env.PORT || 3001;
// UPLOAD_DIR is overridable via env so the handbook capture scripts can
// point at a throw-away fixture directory without touching production media.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req,file,cb) => { const d=path.join(UPLOAD_DIR,req.params.gameId||'misc'); fs.mkdirSync(d,{recursive:true}); cb(null,d); },
  filename: (req,file,cb) => { const ext=path.extname(file.originalname).toLowerCase()||(file.mimetype.includes('video')?'.mp4':'.jpg'); cb(null,`${uuidv4()}${ext}`); }
});
const upload       = multer({ storage, limits: { fileSize: 200*1024*1024 } });
const uploadSingle = multer({ dest: path.join(UPLOAD_DIR,'templates'), limits: { fileSize: 20*1024*1024 } });

app.use(express.json({ limit: '50mb' }));

// ── Baseline security headers ───────────────────────────────────────────────
// Deliberately conservative: no Content-Security-Policy here. The pages load
// Leaflet from a CDN, Google Fonts, inline <script>/<style>, and data:/blob:
// images — a CSP strict enough to be worth adding would need careful testing
// against all of that, so it's intentionally left out to avoid breaking the
// app. These three headers are safe everywhere and cost nothing at runtime.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');     // don't MIME-sniff uploads into executable types
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');         // clickjacking guard for the GM dashboard
  res.setHeader('Referrer-Policy', 'no-referrer');        // don't leak the (tunnel) URL to third parties
  next();
});

app.use(express.static(path.join(__dirname,'public')));

// Uploaded media is user-supplied. Serve it with nosniff (set above) AND force
// anything that isn't a recognised image/video to download instead of render,
// so a team can't upload an .html/.svg payload and get a same-origin script
// execution via its /uploads URL. Images/videos still display inline as normal.
app.use('/uploads', express.static(UPLOAD_DIR, {
  setHeaders: (res, filePath) => {
    if (!/\.(jpe?g|png|gif|webp|mp4|webm|mov|m4v)$/i.test(filePath)) {
      res.setHeader('Content-Disposition', 'attachment');
    }
    // Team media is written once under a UUID filename and never rewritten, so
    // it can be cached hard. This is what makes the GM-side prefetch pay off:
    // a clip pulled in when it arrives is served from disk on review instead of
    // being re-fetched (a 200 MB video over a slow uplink took ages otherwise).
    // Rotation is stored as metadata and applied via CSS, so the bytes really
    // are immutable. Deliberately scoped to UUID names — themes/templates and
    // regenerated files keep the default revalidate-every-time behaviour.
    if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpe?g|png|gif|webp|mp4|webm|mov|m4v)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    }
  },
}));

function getTimerState(game) {
  const now = Date.now();
  const started = !!game.timer_started_at;   // false until the GM starts the timer
  // Ended games show 0
  if (game.status === 'ended') return { remaining: 0, running: false, total: game.timer_duration, started };
  const elapsed = game.timer_running && game.timer_started_at
    ? now - game.timer_started_at : (game.timer_paused_elapsed||0);
  return { remaining: Math.max(0,Math.floor((game.timer_duration*1000 - elapsed)/1000)), running:!!game.timer_running, total:game.timer_duration, started };
}

// Play actions (submissions, completes, captures, scans, answers) are blocked
// until the GM starts the timer. `timer_started_at` is set on the first start
// and never cleared, so its absence means "the game hasn't started yet".
function timerNotStarted(gameId) {
  const g = db.getGame(gameId);
  return !!(g && !g.timer_started_at);
}

// ── GM authentication ───────────────────────────────────────────────────────
// A request is GM-authenticated if it presents EITHER a valid long-lived token
// (Authorization: Bearer <tok>, or body.token) OR the raw password (body
// .password). Accepting both keeps every existing client working unchanged
// while letting the dashboard stop resending the password on every call.
function isGmAuthed(req){
  const hdr = req.headers['authorization'] || '';
  const bearer = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  const token = bearer || (req.body && req.body.token);
  if(token && db.verifyGmToken(token)) return true;
  if(req.body && req.body.password && db.verifyPassword(req.body.password)) return true;
  return false;
}
// Express middleware form for routes that are purely GM-gated.
function gmAuth(req,res,next){
  if(isGmAuthed(req)) return next();
  return res.status(401).json({error:'Unauthorized'});
}

// ── Settings ──────────────────────────────────────────────────────────────────
app.get('/api/setup-status', (req,res) => res.json({isSetup:true}));
app.post('/api/setup',       (req,res) => res.json({success:true}));
// On success, also hand back a long-lived token the client can use instead of
// resending the password. Old clients that ignore `token` keep working.
app.post('/api/settings/verify', (req,res) => {
  const valid = db.verifyPassword(req.body.password);
  res.json({valid, token: valid ? db.issueGmToken() : null});
});
app.post('/api/settings/change-password', (req,res) => {
  const success = db.changePassword(req.body.oldPassword,req.body.newPassword);
  // Keep existing GM sessions valid after a password change (token secret is
  // independent of the password). Return a fresh token for convenience.
  res.json({success, token: success ? db.issueGmToken() : null});
});
app.get('/api/settings',  (req,res) => res.json(db.getSettings()));
app.put('/api/settings',  (req,res) => {
  const {password,token,...s} = req.body;  // strip auth fields so they aren't persisted as settings
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  db.updateSettings(s); res.json({success:true});
});

// Tunnel detection - try multiple methods
app.get('/api/detect-tunnel', async (req,res) => {
  // Method 1: read tunnel-url.txt written by the bat file
  try {
    const urlFile = path.join(__dirname,'tunnel-url.txt');
    if (fs.existsSync(urlFile)) {
      const content = fs.readFileSync(urlFile,'utf8');
      const match = content.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/i);
      if (match) return res.json({url: match[0]});
    }
  } catch(e) {}
  // Method 2: cloudflared API
  for (const port of [2999,8081,8080]) {
    try {
      const r = await fetch(`http://localhost:${port}/quicktunnel`, {signal:AbortSignal.timeout(800)});
      const d = await r.json();
      if (d.hostname) return res.json({url:`https://${d.hostname}`});
    } catch(e) {}
  }
  res.json({url:null});
});

// Template upload
app.post('/api/settings/template', uploadSingle.single('template'), (req,res) => {
  if (!req.file) return res.status(400).json({error:'No file'});
  const dest = path.join(UPLOAD_DIR,'templates', req.file.filename + path.extname(req.file.originalname||'.png'));
  fs.renameSync(req.file.path, dest);
  const relPath = `templates/${req.file.filename}${path.extname(req.file.originalname||'.png')}`;
  const size = req.body.size || 'A4';
  const lang = req.body.lang || 'de';
  // Save with lang key (new) and also legacy key (backward compat for de)
  db.setSetting(`qr_template_${lang}_${size}`, relPath);
  if (lang === 'de') db.setSetting(`qr_template_${size}`, relPath); // legacy
  res.json({success:true, path:relPath});
});

// Auto-translate via MyMemory (free, no API key required)
app.post('/api/translate', async (req,res) => {
  const {text, fromLang, toLangs} = req.body;
  if (!text || !toLangs?.length) return res.status(400).json({error:'Missing params'});
  try {
    const results = await Promise.all(toLangs.map(async toLang => {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${fromLang}|${toLang}`;
      const r = await fetch(url, {signal: AbortSignal.timeout(8000)});
      const data = await r.json();
      const translated = data.responseData?.translatedText || '';
      return [toLang, translated];
    }));
    res.json(Object.fromEntries(results));
  } catch(e) {
    res.status(500).json({error:'Translation failed: ' + e.message});
  }
});

// ── Update from GitHub ────────────────────────────────────────────────────────
app.post('/api/update', async (req,res) => {
  const { password } = req.body;
  if (!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  const { execFile } = require('child_process');
  const appDir = __dirname;
  const log = [];

  const quoteArg = v => /\s/.test(String(v)) ? JSON.stringify(String(v)) : String(v);
  const run = (cmd, args = [], opts = {}) => new Promise((resolve) => {
    log.push(`$ ${[cmd, ...args].map(quoteArg).join(' ')}`);
    execFile(cmd, args, {
      cwd: appDir,
      timeout: opts.timeout || 10 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024
    }, (err, stdout, stderr) => {
      if (stdout && stdout.trim()) log.push(stdout.trim());
      if (stderr && stderr.trim()) log.push(stderr.trim());
      resolve({ ok: !err, stdout: stdout || '', stderr: stderr || '', err });
    });
  });

  const fail = (msg) => {
    log.push(msg);
    return res.json({success:false, log:log.join('\n')});
  };

  const normalizeRepoUrl = (url) => {
    const value = String(url || '').trim();
    if (!value) return null;
    if (/^git@github\.com:[^/\s]+\/[^/\s]+(?:\.git)?$/i.test(value)) return value;
    const match = value.match(/^https:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?\/?$/i);
    if (!match) return false;
    return `https://github.com/${match[1]}/${match[2].replace(/\.git$/i, '')}.git`;
  };

  log.push('Starting update...');

  const insideRepo = await run('git', ['rev-parse', '--is-inside-work-tree']);
  if (!insideRepo.ok || insideRepo.stdout.trim() !== 'true') {
    return fail('Update failed: this installation is not a Git checkout. Install with git clone or set up a Git remote first.');
  }

  const settings = db.getSettings();
  const configuredRepo = normalizeRepoUrl(settings.github_url);
  if (configuredRepo === false) {
    return fail('Update failed: the configured GitHub repository URL is invalid. Use https://github.com/user/repo.git');
  }
  if (configuredRepo) {
    const remotes = await run('git', ['remote']);
    if (!remotes.ok) return fail('Update failed: could not read Git remotes.');
    const remoteArgs = remotes.stdout.split(/\r?\n/).includes('origin')
      ? ['remote', 'set-url', 'origin', configuredRepo]
      : ['remote', 'add', 'origin', configuredRepo];
    const remoteOk = await run('git', remoteArgs);
    if (!remoteOk.ok) return fail('Update failed: could not configure the GitHub remote.');
  }

  // Short-circuit when already on the latest commit. ls-remote queries the
  // remote tip directly and touches no local refs, so this works even when
  // the app directory is also the machine you push from — where a normal
  // fetch can hit a benign "cannot lock ref 'refs/remotes/origin/main'".
  const remoteRef = await run('git', ['ls-remote', 'origin', 'refs/heads/main']);
  if (remoteRef.ok && remoteRef.stdout.trim()) {
    const remoteSha = remoteRef.stdout.trim().split(/\s+/)[0];
    const headSha = (await run('git', ['rev-parse', 'HEAD'])).stdout.trim();
    if (remoteSha && headSha && remoteSha === headSha) {
      log.push(`Already up to date — running the latest version (${remoteSha.slice(0, 7)}). No restart needed.`);
      return res.json({ success: true, upToDate: true, log: log.join('\n') });
    }
  }

  // Refuse to update while any game is still live (waiting or running). The app
  // may only update once every game is ended — pulling new code + restarting
  // mid-game would disrupt players.
  const activeGames = db.getActiveGames();
  if (activeGames.length) {
    log.push(`Update blocked: ${activeGames.length} game(s) still running or waiting. Finish all games first.`);
    return res.json({ success:false, blocked:'games_active', activeCount: activeGames.length, log: log.join('\n') });
  }

  const dirty = await run('git', ['status', '--porcelain', '--untracked-files=no']);
  if (!dirty.ok) return fail('Update failed: could not inspect the local Git status.');
  if (dirty.stdout.trim()) {
    log.push('Local tracked changes detected. Saving them to git stash before updating.');
    const stash = await run('git', ['stash', 'push', '-m', `missions-app auto-update ${new Date().toISOString()}`]);
    if (!stash.ok) return fail('Update failed: could not stash local tracked changes.');
  }

  const fetch = await run('git', ['fetch', '--prune', 'origin', 'main'], {timeout: 15 * 60 * 1000});
  if (!fetch.ok) return fail('Update failed: could not fetch origin/main from GitHub.');

  const hasMain = await run('git', ['rev-parse', '--verify', 'main']);
  const checkoutArgs = hasMain.ok ? ['checkout', 'main'] : ['checkout', '-B', 'main', 'origin/main'];
  const checkout = await run('git', checkoutArgs);
  if (!checkout.ok) return fail('Update failed: could not switch to the main branch.');

  const merge = await run('git', ['merge', '--ff-only', 'origin/main']);
  if (!merge.ok) return fail('Update failed: local main has diverged from origin/main. Resolve the Git history manually, then try again.');

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const npmArgs = fs.existsSync(path.join(appDir, 'package-lock.json'))
    ? ['ci', '--omit=dev']
    : ['install', '--omit=dev'];
  let npm = await run(npmCmd, npmArgs, {timeout: 20 * 60 * 1000});
  // npm ci pre-wipes node_modules. On Linux the running server holds
  // binaries from packages like ffmpeg-static open via require(), which can
  // leave one file behind and trigger ENOTEMPTY / EBUSY / ETXTBSY when npm
  // tries to rmdir. Recover by force-wiping node_modules and falling back
  // to a plain `npm install` (which doesn't pre-wipe and is more tolerant
  // of busy files on a re-create).
  if (!npm.ok && /ENOTEMPTY|EBUSY|ETXTBSY/.test(npm.stderr + npm.stdout)) {
    log.push('npm ci could not clear node_modules. Wiping and retrying with npm install.');
    const wipe = process.platform === 'win32'
      ? await run('cmd', ['/c', 'rmdir', '/s', '/q', 'node_modules'], {timeout: 5 * 60 * 1000})
      : await run('sh',  ['-c', 'rm -rf node_modules'],                {timeout: 5 * 60 * 1000});
    if (!wipe.ok) return fail('Update failed: could not clear node_modules before retry.');
    npm = await run(npmCmd, ['install', '--omit=dev', '--no-audit', '--no-fund'], {timeout: 20 * 60 * 1000});
  }
  if (!npm.ok) return fail('Update failed: dependencies could not be installed.');

  log.push('Update complete. Restarting...');
  res.json({success:true, log:log.join('\n')});
  // Restart gracefully after response sent
  setTimeout(() => process.exit(0), 1000);
});

app.get('/api/version', (req,res) => {
  const { execSync } = require('child_process');
  let version = 'v1.0.0';
  let commit = '';
  try { commit = execSync('git rev-parse --short HEAD', {cwd:__dirname}).toString().trim(); } catch(e) {}
  try {
    const pkg = require('./package.json');
    version = 'v' + (pkg.version || '1.0.0');
  } catch(e) {}
  res.json({ version, commit, full: commit ? `${version} (${commit})` : version });
});

// Lightweight, non-mutating "is there an update?" probe used by the GM page on
// load. Compares the deployed commit to origin/main via ls-remote (no fetch, no
// working-tree changes). Cached 60s so repeated page loads don't hammer GitHub.
// Public on purpose — it only reveals version/commit info — while the actual
// /api/update stays password- and game-gated.
let _updCheckCache = { t: 0, data: null };
app.get('/api/update/check', async (req, res) => {
  const activeGames = db.getActiveGames().length;
  if (_updCheckCache.data && (Date.now() - _updCheckCache.t) < 60000) {
    return res.json({ ..._updCheckCache.data, activeGames });
  }
  const { execFile } = require('child_process');
  const run = (cmd, args) => new Promise(r => execFile(cmd, args,
    { cwd: __dirname, timeout: 15000, maxBuffer: 1024 * 1024 },
    (e, out) => r({ ok: !e, out: (out || '').trim() })));

  const inRepo = await run('git', ['rev-parse', '--is-inside-work-tree']);
  if (!inRepo.ok || inRepo.out !== 'true') {
    return res.json({ updateAvailable: false, error: 'not_a_git_checkout', activeGames });
  }
  const head = (await run('git', ['rev-parse', 'HEAD'])).out;
  const remote = await run('git', ['ls-remote', 'origin', 'refs/heads/main']);
  if (!remote.ok || !remote.out) {
    return res.json({ updateAvailable: false, error: 'check_failed', currentCommit: head.slice(0,7), activeGames });
  }
  const remoteSha = remote.out.split(/\s+/)[0] || '';
  let version = '';
  try { version = 'v' + (JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version || ''); } catch(e) {}
  const updateAvailable = !!(remoteSha && head && remoteSha !== head);
  // Changelog: the commit subjects between what's installed and what's on the
  // remote — i.e. exactly what this update would bring. Needs a fetch first;
  // ls-remote above only hands back the SHA. Cached with the rest of the
  // response (60 s), so this runs at most once a minute.
  let changes = [], newVersion = '';
  if (updateAvailable) {
    const fetched = await run('git', ['fetch', '--quiet', 'origin', 'main']);
    if (fetched.ok) {
      const log = await run('git', ['log', 'HEAD..FETCH_HEAD', '--no-merges', '--format=%s']);
      if (log.ok && log.out) {
        changes = log.out.split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 60);
      }
      // The version the update would land on, read straight from the incoming
      // package.json rather than guessed from the commit subjects.
      const pkg = await run('git', ['show', 'FETCH_HEAD:package.json']);
      if (pkg.ok && pkg.out) {
        try { newVersion = 'v' + (JSON.parse(pkg.out).version || ''); } catch(e) {}
      }
    }
  }
  const data = {
    updateAvailable,
    currentVersion: version,
    newVersion,
    changes,
    currentCommit: head.slice(0,7),
    remoteCommit: remoteSha.slice(0,7),
  };
  _updCheckCache = { t: Date.now(), data };
  res.json({ ...data, activeGames });
});

// ── Modes ─────────────────────────────────────────────────────────────────────
app.get('/api/modes', (req,res) => res.json(db.getModes()));
app.post('/api/modes', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  const id = db.createMode(req.body.name, req.body.ruleset_id||1, req.body.timer_default||60, req.body.location_id);
  if(req.body.no_randomize !== undefined) db.setModeNoRandomize(id, req.body.no_randomize);
  res.json({id,success:true});
});
// NOTE: must be declared before '/api/modes/:id' or Express treats "reorder"
// as the :id param. Body: { order: [modeId, ...] } in the desired display order.
app.put('/api/modes/reorder', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  db.reorderModes(Array.isArray(req.body.order) ? req.body.order : []);
  res.json({success:true});
});
app.put('/api/modes/:id', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  try {
    // Only run the full update when core fields are present; a no_randomize-only
    // PUT must not require name/ruleset (updateMode rejects an undefined name).
    if(req.body.name !== undefined) db.updateMode(req.params.id, req.body);
    if(req.body.no_randomize !== undefined) db.setModeNoRandomize(Number(req.params.id), req.body.no_randomize);
    res.json({success:true});
  }
  catch(e) { res.status(400).json({error:e.message}); }
});
app.delete('/api/modes/:id', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  try { db.deleteMode(req.params.id); res.json({success:true}); }
  catch(e) { res.status(400).json({error:e.message}); }
});

// ── Rulesets ─────────────────────────────────────────────────────────────────
app.get('/api/rulesets', (req,res) => res.json(db.getRulesets()));
app.post('/api/rulesets', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  const id = db.createRuleset(req.body.name, req.body.rules_list||'[]');
  res.json({id,success:true});
});
app.put('/api/rulesets/:id', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  db.updateRuleset(req.params.id, {name:req.body.name, rules_list:req.body.rules_list||'[]'});
  res.json({success:true});
});
app.delete('/api/rulesets/:id', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  try { db.deleteRuleset(req.params.id); res.json({success:true}); }
  catch(e) { res.status(400).json({error:e.message}); }
});

// ── Locations ─────────────────────────────────────────────────────────────────
app.get('/api/locations', (req,res) => res.json(db.getLocations()));
app.post('/api/locations', (req,res) => {
  const {password,...d}=req.body;
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  const {timer_default:_ctd, ...locCreateData} = d; locCreateData.allow_photo=d.allow_photo!==undefined?d.allow_photo:1; locCreateData.allow_video=d.allow_video!==undefined?d.allow_video:1; locCreateData.allow_indoor=d.allow_indoor!==undefined?d.allow_indoor:1; res.json({id:db.createLocation(locCreateData),success:true});
});
app.put('/api/locations/:id', (req,res) => {
  const {password,...d}=req.body;
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  const {timer_default:_td, ...locData} = d; locData.allow_photo=d.allow_photo!==undefined?d.allow_photo:1; locData.allow_video=d.allow_video!==undefined?d.allow_video:1; locData.allow_indoor=d.allow_indoor!==undefined?d.allow_indoor:1; db.updateLocation(req.params.id,locData); res.json({success:true});
});
app.delete('/api/locations/:id', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  db.deleteLocation(req.params.id); res.json({success:true});
});

// ── Player colour schemes (per location / per RA mode) ──────────────────────
// Public: players resolve their game's theme on join/play load. NULL theme =
// the built-in default look. The GM dashboard never consumes this.
app.get('/api/games/:id/theme', (req,res) => {
  const game = db.getGame(req.params.id);
  if(!game) return res.status(404).json({error:'Not found'});
  let raw = null;
  if (game.location_id) { const loc = db.getLocation(game.location_id); raw = loc && loc.theme; }
  else { const cm = db.getGameCrMode(game.id); raw = cm && cm.theme; }
  let theme = null; try { theme = raw ? JSON.parse(raw) : null; } catch(e) {}
  res.json({ theme });
});
// Theme save (GM-gated). Dedicated routes so the designer can write ONLY the
// theme; the generic PUTs rewrite every column and would blank the rest.
app.put('/api/locations/:id/theme', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  db.setLocationTheme(Number(req.params.id), req.body.theme ?? null);
  res.json({success:true});
});
// Global GM dashboard theme (app-wide). Read is public (gm.html applies it on
// load); write requires GM auth.
app.get('/api/gm-theme', (req,res) => {
  const t = db.getGmTheme();
  let theme = null; if(t){ try{ theme = JSON.parse(t); }catch{ theme = null; } }
  res.json({ theme });
});
app.put('/api/gm-theme', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  db.setGmTheme(req.body.theme ?? null);
  res.json({success:true});
});
app.put('/api/cr/modes/:id/theme', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  db.setCrModeTheme(Number(req.params.id), req.body.theme ?? null);
  res.json({success:true});
});
// Theme logo upload (GM-gated). Multer drops the file in misc/; move it into
// themes/ so the stored path matches normTheme's whitelist. No SVG — an SVG
// served from /uploads could carry scripts on the app origin.
app.post('/api/theme-logo', upload.single('image'), (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  if(!req.file) return res.status(400).json({error:'No file'});
  const ext = path.extname(req.file.filename).toLowerCase();
  if(!['.png','.jpg','.jpeg','.webp','.gif'].includes(ext)){
    try{ fs.unlinkSync(req.file.path); }catch(e){}
    return res.status(400).json({error:'Images only (png/jpg/webp/gif)'});
  }
  const destDir = path.join(UPLOAD_DIR,'themes');
  fs.mkdirSync(destDir,{recursive:true});
  const dest = path.join(destDir, req.file.filename);
  try { fs.renameSync(req.file.path, dest); }
  catch(e) { fs.copyFileSync(req.file.path, dest); fs.unlinkSync(req.file.path); }
  res.json({ success:true, path: `themes/${req.file.filename}` });
});

// ── Automated (scheduled) broadcast messages ────────────────────────────────
// GM config; the timer loop fires them when a game's remaining time reaches the
// trigger and the game matches game_kind (+ location for missions).
app.get('/api/automated-messages', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  res.json(db.getAutoMessages());
});
app.post('/api/automated-messages', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  // Allow creating an empty row (the GM fills it in after adding); the timer
  // skips messages whose text is still blank.
  res.json({id: db.createAutoMessage(req.body||{}), success:true});
});
app.put('/api/automated-messages/:id', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  db.updateAutoMessage(Number(req.params.id), req.body); res.json({success:true});
});
app.delete('/api/automated-messages/:id', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  db.deleteAutoMessage(Number(req.params.id)); res.json({success:true});
});

// ── Play statistics (GM-gated) ───────────────────────────────────────────────
app.get('/api/stats', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  res.json(db.getStatsSummary(req.query.from, req.query.to));
});

// ── Missions ──────────────────────────────────────────────────────────────────
app.get('/api/missions', (req,res) => {
  const {mode_id, location_id} = req.query;
  const mId = mode_id ? Number(mode_id) : undefined;
  const lId = location_id === 'null' ? null : location_id ? Number(location_id) : undefined;
  res.json(db.getMissions(mId, lId));
});
app.post('/api/missions', (req,res) => {
  const {password,...d}=req.body;
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  const newId=db.createMission(d); io.emit('settings_updated',{type:'missions'}); res.json({id:newId,success:true});
});
// Drag-reorder MiSSiONS missions in the settings list. Body: { order:[id,...] }.
app.post('/api/missions/reorder', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  db.reorderMissions(Array.isArray(req.body.order) ? req.body.order : []);
  res.json({success:true});
});
app.put('/api/missions/:id', (req,res) => {
  const {password,...d}=req.body;
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  db.updateMission(req.params.id,d); io.emit('settings_updated',{type:'missions'}); res.json({success:true});
});
app.delete('/api/missions/:id', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  db.deleteMission(req.params.id);
  io.emit('settings_updated', {type:'missions'});
  res.json({success:true});
});

// ── Games ─────────────────────────────────────────────────────────────────────
const creatingLocks = new Set();
app.get('/api/games', (req,res) => {
  if(req.query.is_cityrush==='1'){
    // Return games that have a cr_mode linked
    const all = db.getGames(null);
    const crGames = all.filter(g => db.isCrGame(g.id));
    return res.json(crGames);
  }
  res.json(db.getGames(req.query.location_id));
});
app.get('/api/games/:id', (req,res) => { const g=db.getGameFull(req.params.id); g?res.json(g):res.status(404).json({error:'Not found'}); });

app.post('/api/games', (req,res) => {
  const {location_id, mode_id} = req.body;
  const isCrGame = !!(req.body.is_cityrush || !location_id);
  const lockKey  = isCrGame ? `cr_${req.body.cr_mode_id||0}` : `${location_id}_${mode_id||1}`;
  if(creatingLocks.has(lockKey)) return res.status(429).json({error:'Already creating'});
  creatingLocks.add(lockKey); setTimeout(()=>creatingLocks.delete(lockKey),3000);
  const location = location_id ? db.getLocation(location_id) : null;
  if(!isCrGame && !location){ creatingLocks.delete(lockKey); return res.status(404).json({error:'Location not found'}); }
  const mode       = db.getMode(mode_id||1);
  const missionIds = isCrGame ? [] : db.selectMissions(location, mode_id||1);
  // CityRush games now have their own default duration on the cr_mode. Falls
  // back to 60 minutes if the mode doesn't have one set yet (older rows).
  let timerSecs;
  if(isCrGame){
    const crModeRow = req.body.cr_mode_id ? db.getCrMode(req.body.cr_mode_id) : null;
    timerSecs = ((crModeRow && crModeRow.timer_default) || 60) * 60;
  } else {
    timerSecs = ((mode && mode.timer_default) || (location && location.timer_default) || 60) * 60;
  }
  const gameId     = uuidv4().slice(0,8).toUpperCase();
  db.createGame({id:gameId, location_id:location_id||null, mode_id:mode_id||1, timer_duration:timerSecs, missions:missionIds});
  if(req.body.cr_mode_id) db.linkCrMode(gameId, req.body.cr_mode_id);
  // Play statistics: one denormalized row per game, written at creation so it
  // survives the 72h game cleanup.
  try {
    const cmRow = req.body.cr_mode_id ? db.getCrMode(req.body.cr_mode_id) : null;
    db.recordGameStat({
      game_id: gameId,
      kind: isCrGame ? 'cityrush' : 'missions',
      location_id: location ? location.id : null,
      location_name: location ? location.name : null,
      cr_mode_id: cmRow ? cmRow.id : null,
      cr_mode_name: cmRow ? cmRow.name : null,
      mode_id: isCrGame ? null : (mode_id||1),
      mode_name: (!isCrGame && mode) ? mode.name : null,
    });
  } catch(e){ console.warn('game stat record failed', e); }
  creatingLocks.delete(lockKey);
  const publicUrl = db.getSetting('public_url')||`http://localhost:${PORT}`;
  const joinUrl   = `${publicUrl}/join.html?game=${gameId}`;
  QRCode.toDataURL(joinUrl,{errorCorrectionLevel:'H',width:400,margin:2},(err,qr)=>{
    if(err) return res.status(500).json({error:'QR failed'});
    res.json({id:gameId, joinUrl, qrCode:qr, timerDuration:timerSecs, missionCount:missionIds.length});
  });
});

app.delete('/api/games/:id', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  try {
    // Statistics: a manually deleted game leaves the stats UNLESS it was
    // completed (timer ran out) — completed games count even after the GM
    // cleans up the list. The 72h auto-cleanup never touches game_stats.
    const g = db.getGame(req.params.id);
    try {
      if (g && g.status === 'ended') db.markGameStatEnded(req.params.id);
      else db.dropGameStat(req.params.id);
    } catch(e){}
    const dir=path.join(UPLOAD_DIR,req.params.id);
    if(fs.existsSync(dir)) fs.rmSync(dir,{recursive:true,force:true});
    db.deleteGame(req.params.id);
    res.json({success:true});
  } catch(e) {
    res.status(500).json({error:'Delete failed: '+e.message});
  }
});

app.get('/api/games/:id/qr', (req,res) => {
  const publicUrl=db.getSetting('public_url')||`http://localhost:${PORT}`;
  const joinUrl=`${publicUrl}/join.html?game=${req.params.id}`;
  QRCode.toDataURL(joinUrl,{errorCorrectionLevel:'H',width:400,margin:2},(err,qr)=>{
    if(err) return res.status(500).json({error:'QR failed'});
    res.json({qrCode:qr,joinUrl});
  });
});

// ── Game-media exports ────────────────────────────────────────────────────────
// Two endpoints + a couple of poll/serve helpers, all gated on the game
// having ended (so the deliverable is final). The zip streams directly to
// the client; the collage is a background job we track in-memory.
const collageJobs = new Map();  // jobId → { gameId, step, total, phase, path?, error? }

function endedGameOr404(id, res) {
  const g = db.getGame(id);
  if(!g) { res.status(404).json({ error: 'Game not found' }); return null; }
  if(g.status !== 'ended') { res.status(409).json({ error: 'Game not ended yet' }); return null; }
  return g;
}

// 1) Zip download — streams every accepted submission + team selfies. Names
//    inside the zip are `<team-slug>/<NN>-<mission-slug>.<ext>`.
app.get('/api/games/:id/media.zip', async (req,res) => {
  if(!endedGameOr404(req.params.id, res)) return;
  try { await collage.streamZip(db._db, req.params.id, UPLOAD_DIR, res); }
  catch(e) { console.error('zip error:', e); if(!res.headersSent) res.status(500).json({ error: e.message }); }
});

// 2) Collage POST — kick off the render, return a job id immediately. We
//    don't queue or rate-limit; assumption is the GM dashboard only fires
//    one of these at a time per game.
app.post('/api/games/:id/collage', (req,res) => {
  const g = endedGameOr404(req.params.id, res);
  if(!g) return;
  const jobId = uuidv4().slice(0,8);
  // total:0 + phase:'collecting' so the client shows "preparing" rather than a
  // misleading "0/1" until generateCollage reports the real step count.
  const job   = { gameId: g.id, step: 0, total: 0, phase: 'collecting', started_at: Date.now() };
  collageJobs.set(jobId, job);
  collage.generateCollage(db._db, g.id, UPLOAD_DIR, (p) => {
    job.step  = p.step; job.total = p.total; job.phase = p.phase;
  })
  .then(relPath => { job.phase = 'done'; job.path = relPath; })
  .catch(err   => { console.error('collage failed:', err);
                    job.phase = 'error'; job.error = err.message || 'render failed'; });
  res.json({ job_id: jobId });
});

// 3) Status poll — the GM dashboard hits this every 1–2s for progress
app.get('/api/games/:id/collage/status/:jobId', (req,res) => {
  const job = collageJobs.get(req.params.jobId);
  if(!job || job.gameId !== req.params.id) return res.status(404).json({ error: 'No such job' });
  res.json({
    phase: job.phase, step: job.step, total: job.total,
    error: job.error || null,
    url: job.path ? `/api/games/${job.gameId}/collage/file` : null,
  });
});

// 4) Final file — served as an attachment so the browser downloads instead
//    of trying to stream it inline.
app.get('/api/games/:id/collage/file', (req,res) => {
  const g = db.getGame(req.params.id);
  if(!g || !g.collage_path) return res.status(404).json({ error: 'No collage' });
  const abs = path.join(UPLOAD_DIR, g.collage_path);
  if(!fs.existsSync(abs)) return res.status(404).json({ error: 'File missing' });
  res.setHeader('Content-Disposition', `attachment; filename="missions-${g.id}-collage.mp4"`);
  res.setHeader('Content-Type', 'video/mp4');
  fs.createReadStream(abs).pipe(res);
});

// ── Teams ─────────────────────────────────────────────────────────────────────
app.post('/api/games/:gameId/teams', (req,res) => {
  const game=db.getGame(req.params.gameId);
  if(!game) return res.status(404).json({error:'Game not found'});
  if(game.status==='ended') return res.status(400).json({error:'Game has ended'});
  // Validate the name itself (also guards against a missing/blank body.name,
  // which previously threw on .toLowerCase()).
  const rawName = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if(rawName.length < 2) return res.status(400).json({error:'Team name too short.', error_code:'too_short'});
  if(rawName.length > 30) return res.status(400).json({error:'Team name too long.', error_code:'too_long'});
  // Profanity / hate-speech filter (server-side, authoritative). GM-configurable
  // in Settings → Profanity: an enable toggle (default ON) plus a custom word
  // list merged with the built-in multi-language list.
  const settings = db.getSettings();
  const filterOn = settings.profanity_enabled !== '0'; // default enabled
  if(filterOn) {
    const customWords = profanity.parseWordList(settings.profanity_custom_words);
    if(!profanity.isClean(rawName, customWords)) {
      return res.status(400).json({error:'That team name isn\'t allowed. Please choose another.', error_code:'profanity'});
    }
  }
  // Check for duplicate team name
  const existingTeams=db.getTeams(req.params.gameId);
  const nameTaken=existingTeams.some(t=>t.name.toLowerCase()===rawName.toLowerCase());
  if(nameTaken) return res.status(400).json({error:'Team name already taken. Please choose a different name.', error_code:'taken'});
  const teamId=db.createTeam({
    game_id:req.params.gameId,
    name:rawName,
    gps_anchor_key: req.body.gps_anchor_key || req.body.gpsAnchorKey || null,
  });
  const team=db.getTeam(teamId);
  try { db.bumpGameStatTeams(req.params.gameId); } catch(e){}
  io.to(`gm_${req.params.gameId}`).emit('team_joined',team);
  // Refresh the GM rankings so a newly-joined team appears immediately — joins
  // alone don't change scores, so without this the list stayed at whoever was
  // present on the last score event.
  io.to(`gm_${req.params.gameId}`).emit('rankings_update', db.getRankings(req.params.gameId));
  res.json(team);
});
app.get('/api/games/:gameId/teams/:teamId', (req,res) => {
  const team=db.getTeam(req.params.teamId);
  if(!team) return res.status(404).json({error:'Not found'});
  // Include the current freeze (if any) so the player UI can decide whether
  // to show the frozen overlay on reload.
  const freeze = db.activeFreezeFor(req.params.gameId, Number(req.params.teamId));
  // Surface the allowed-languages list so the player's cycler can hide
  // options that aren't permitted. MiSSiONS games read from the game's
  // location; CityRush games (no location_id) read from the CR mode.
  // Either way, fall back to all five supported languages if unset.
  const game = db.getGame(req.params.gameId);
  let allowed_langs = 'de,en,fr,it,es';
  // Custom (GM-defined) languages live on the MiSSiONS location. Surface them
  // so the player's language cycler can offer them and fall content back to
  // each one's chosen base language for the app's fixed labels.
  let custom_langs = [];
  if (game && game.location_id) {
    const loc = db.getLocation(game.location_id);
    if (loc && loc.allowed_langs) allowed_langs = loc.allowed_langs;
    if (loc && loc.custom_langs) { try { custom_langs = JSON.parse(loc.custom_langs) || []; } catch { custom_langs = []; } }
  } else if (game) {
    const crMode = db.getGameCrMode(game.id);
    if (crMode && crMode.allowed_langs) allowed_langs = crMode.allowed_langs;
  }
  // Max video length, so the player app can refuse an over-long clip BEFORE
  // uploading it. 0 = no limit. Unset falls back to 25s, which is what the
  // house rules already told players.
  const rawMaxVid = db.getSetting('max_video_seconds');
  const max_video_seconds = rawMaxVid === null || rawMaxVid === undefined || rawMaxVid === ''
    ? 25 : Math.max(0, parseInt(rawMaxVid, 10) || 0);
  // Effective upload ceiling. Not the same as multer's hard cap: when the app
  // is reached through a Cloudflare tunnel, Cloudflare cuts the request body
  // first (100 MB on Free, 200 MB on Business). Advertising 200 while the path
  // allows 100 is what made an over-size upload die with a generic network
  // error instead of a size message.
  const rawMaxMb = db.getSetting('max_upload_mb');
  const max_upload_mb = rawMaxMb === null || rawMaxMb === undefined || rawMaxMb === ''
    ? 100 : Math.max(1, Math.min(MAX_UPLOAD_MB, parseInt(rawMaxMb, 10) || 100));
  res.json({...team, missions:db.getTeamMissions(req.params.teamId), freeze, allowed_langs, custom_langs, max_video_seconds, max_upload_mb, timer: game ? getTimerState(game) : null});
});
app.delete('/api/games/:gameId/teams/:teamId', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  const team = db.getTeam(req.params.teamId);
  if(!team) return res.status(404).json({error:'Not found'});
  db.deleteTeam(req.params.teamId);
  const teamId = Number(req.params.teamId);
  io.to(`gm_${req.params.gameId}`).emit('team_deleted', { teamId });
  io.to(`gm_${req.params.gameId}`).emit('rankings_update', db.getRankings(req.params.gameId));
  res.json({success:true});
});
app.get('/api/games/:gameId/rankings', (req,res) => res.json(db.getRankings(req.params.gameId)));

// ── Upload ────────────────────────────────────────────────────────────────────
app.post('/api/games/:gameId/media/upload',
  upload.single('media'), (req,res) => {
    if(timerNotStarted(req.params.gameId)){ if(req.file){ try{ fs.unlinkSync(req.file.path); }catch(e){} } return res.status(403).json({error:'not_started'}); }
    if(!req.file) return res.status(400).json({error:'No file'});
    res.json({success:true, mediaPath:`${req.params.gameId}/${req.file.filename}`});
  }
);

// ── Draw sessions (collaborative drawing) ──────────────────────────────────────
// Ephemeral in-memory sessions for the Draw mission type. The starting device
// ("master") creates a session and shows a QR; teammates scan it to join a
// shared canvas. Strokes are relayed over socket.io and retained here so late
// joiners can replay them. Sessions die on submit/cancel/master-disconnect and
// in the hourly cron sweep. Solo draws use a single-participant session too, so
// draw.html has one way to load its mission context.
const drawSessions = new Map(); // token -> {gameId,teamId,missionId,strokes:[],masterId,createdAt}
function makeDrawToken(){ return uuidv4().slice(0,8).toUpperCase(); }
function drawPromptFor(m){
  if(!m) return {de:'',en:'',fr:'',it:'',es:''};
  return {
    de: m.task_de||m.description_de||'', en: m.task_en||m.description_en||'',
    fr: m.task_fr||m.description_fr||'', it: m.task_it||m.description_it||'',
    es: m.task_es||m.description_es||'',
  };
}
app.post('/api/games/:gameId/draw/session', (req,res) => {
  const { teamId, missionId } = req.body;
  const gameId = req.params.gameId;
  const crMode = db.getGameCrMode(gameId);
  if(!crMode) return res.status(400).json({error:'No Rail Adventure mode'});
  const mission = db.getCrMission(Number(missionId));
  if(!mission || !mission.use_draw) return res.status(400).json({error:'Not a draw mission'});
  const token = makeDrawToken();
  drawSessions.set(token, {
    gameId, teamId:Number(teamId), missionId:Number(missionId),
    collaborative: !!mission.draw_collaborative, strokes:[], masterId:null, createdAt:Date.now(),
  });
  const publicUrl = db.getSetting('public_url')||`http://localhost:${PORT}`;
  const url = `${publicUrl}/draw.html?session=${token}`;
  QRCode.toDataURL(url,{errorCorrectionLevel:'H',width:400,margin:2},(err,qr)=>{
    res.json({ token, url, qrCode: err?null:qr });
  });
});
app.get('/api/draw/session/:token', (req,res) => {
  const s = drawSessions.get(req.params.token);
  if(!s) return res.json({exists:false});
  const mission = db.getCrMission(s.missionId);
  const publicUrl = db.getSetting('public_url')||`http://localhost:${PORT}`;
  const url = `${publicUrl}/draw.html?session=${req.params.token}`;
  QRCode.toDataURL(url,{errorCorrectionLevel:'H',width:360,margin:2},(err,qr)=>{
    res.json({
      exists:true, gameId:s.gameId, teamId:s.teamId, missionId:s.missionId,
      collaborative: !!s.collaborative, prompt: drawPromptFor(mission),
      url, qrCode: err?null:qr,
    });
  });
});

// ── Team selfie (snapped at the start of the game) ────────────────────────────
// One-shot upload — POST overwrites any previous selfie for the team.
// The GM sees the latest selfie permanently in the dashboard.
app.post('/api/games/:gameId/teams/:teamId/selfie',
  upload.single('media'), (req,res) => {
    const {gameId, teamId} = req.params;
    if(!req.file) return res.status(400).json({error:'No file'});
    const path = `${gameId}/${req.file.filename}`;
    db.setTeamSelfie(Number(teamId), path);
    io.to(`gm_${gameId}`).emit('team_selfie_updated', {teamId: Number(teamId), selfiePath: path});
    res.json({success:true, selfiePath: path});
  }
);

// ── Freeze ────────────────────────────────────────────────────────────────────
// Initiated by the GM from a team's dashboard panel. The team whose panel is
// open is the *freezer*; the GM picks the *frozen* target from the list.
// Recording (freezer, frozen) lets the dashboard show which team froze whom
// and enforces "each team can freeze each rival only once" via the UNIQUE
// constraint on team_freezes(game_id, freezer_team_id, frozen_team_id).
app.post('/api/games/:gameId/freeze', (req,res) => {
  const {gameId} = req.params;
  const {freezerTeamId, frozenTeamId, durationSeconds} = req.body;
  if(!freezerTeamId || !frozenTeamId) return res.status(400).json({error:'Missing teams'});
  if(Number(freezerTeamId) === Number(frozenTeamId)) return res.status(400).json({error:'self-freeze'});
  const dur = Math.max(30, Math.min(60*60, Number(durationSeconds)||0)); // clamp 30s–60min
  try {
    const until = db.createTeamFreeze(gameId, Number(freezerTeamId), Number(frozenTeamId), dur);
    io.to(`team_${Number(frozenTeamId)}`).emit('team_frozen', {until, freezerTeamId: Number(freezerTeamId)});
    io.to(`gm_${gameId}`).emit('freezes_updated');
    res.json({success:true, until});
  } catch(e) {
    // UNIQUE conflict → this freezer has already used their one-shot on the target.
    if(String(e.message||'').includes('UNIQUE')) return res.status(409).json({error:'already-frozen'});
    res.status(500).json({error: e.message || 'freeze-failed'});
  }
});
// GM thaw — end the active freeze on this team early (regardless of freezer).
app.post('/api/games/:gameId/thaw', (req,res) => {
  const {frozenTeamId} = req.body;
  if(!frozenTeamId) return res.status(400).json({error:'Missing team'});
  db.expireActiveFreezesForTeam(req.params.gameId, Number(frozenTeamId));
  io.to(`team_${Number(frozenTeamId)}`).emit('team_thawed');
  io.to(`gm_${req.params.gameId}`).emit('freezes_updated');
  res.json({success:true});
});
app.get('/api/games/:gameId/freezes', (req,res) => {
  // Full log for the GM dashboard (incl. expired rows).
  res.json(db.listFreezesForGame(req.params.gameId));
});

app.post('/api/games/:gameId/teams/:teamId/missions/:missionId/upload',
  upload.single('media'), (req,res) => {
    const {gameId,teamId,missionId}=req.params;
    // Nothing can be submitted before the GM starts the timer.
    if(timerNotStarted(gameId)){ if(req.file){ try{ fs.unlinkSync(req.file.path); }catch(e){} } return res.status(403).json({error:'not_started'}); }
    // Server-side anti-cheat: a frozen team cannot submit anything.
    if(db.isTeamFrozen(gameId, Number(teamId))){
      return res.status(423).json({error:'frozen'});
    }
    if(!req.file) return res.status(400).json({error:'No file'});
    const mediaPath=`${gameId}/${req.file.filename}`;
    const result=db.submitMission({teamId:Number(teamId),missionId:Number(missionId),mediaPath});
    if(result && result.alreadyAccepted){
      // A teammate already got this mission accepted — discard this duplicate
      // upload so it can't be scored twice, and tell the player it's done.
      try{ fs.unlinkSync(path.join(UPLOAD_DIR, mediaPath)); }catch(e){}
      return res.status(409).json({error:'Already completed', code:'already_completed'});
    }
    const sub=db.getSubmission(Number(teamId),Number(missionId));
    if(!sub) return res.status(400).json({error:'Mission is not assigned to this team'});
    io.to(`gm_${gameId}`).emit('submission_new',{submissionId:sub.id,teamId:Number(teamId),missionId:Number(missionId),mediaPath});
    res.json({success:true,mediaPath});
  }
);

// ── Review ────────────────────────────────────────────────────────────────────
app.post('/api/submissions/:id/review', (req,res) => {
  const {action,message,gameId}=req.body;
  const sub=db.getSubmissionById(Number(req.params.id));
  if(!sub) return res.status(404).json({error:'Not found'});
  if(action==='accept') {
    db.acceptSubmission(sub.id);
    io.to(`team_${sub.team_id}`).emit('mission_accepted',{missionId:sub.mission_id});
  } else {
    db.rejectSubmission(sub.id,message);
    const fp=path.join(UPLOAD_DIR,sub.media_path||'');
    if(sub.media_path && fs.existsSync(fp)) fs.unlinkSync(fp);
    io.to(`team_${sub.team_id}`).emit('mission_rejected',{missionId:sub.mission_id,message});
    postRejectionToChat(gameId, sub.team_id, db.getMission(sub.mission_id), message);
  }
  io.to(`gm_${gameId}`).emit('submission_reviewed',{submissionId:sub.id,action,teamId:sub.team_id,missionId:sub.mission_id});
  io.to(`gm_${gameId}`).emit('rankings_update',db.getRankings(gameId));
  res.json({success:true});
});

// ── Media rotation ──────────────────────────────────────────────────────────
// The GM can rotate a sideways photo/selfie from the lightbox. We persist the
// chosen rotation (degrees clockwise, 0/90/180/270) rather than re-encoding the
// file, so it's lossless + reversible and applied consistently in the
// dashboard, the ZIP export and the collage. GM-gated.
app.post('/api/submissions/:id/rotate', gmAuth, (req,res) => {
  const sub = db.getSubmissionById(Number(req.params.id));
  if(!sub) return res.status(404).json({error:'Not found'});
  const deg = Number(req.body.rotation);
  db.setSubmissionRotation(sub.id, deg);
  const updated = db.getSubmissionById(sub.id);
  res.json({success:true, rotation: updated.media_rotation});
});
app.post('/api/cr/submissions/:id/rotate', gmAuth, (req,res) => {
  const sub = db.getCrSubmission(Number(req.params.id));
  if(!sub) return res.status(404).json({error:'Not found'});
  db.setCrSubmissionRotation(sub.id, Number(req.body.rotation));
  const updated = db.getCrSubmission(sub.id);
  res.json({success:true, rotation: updated.media_rotation});
});
app.post('/api/games/:gameId/teams/:teamId/selfie/rotate', gmAuth, (req,res) => {
  const team = db.getTeam(Number(req.params.teamId));
  if(!team) return res.status(404).json({error:'Not found'});
  db.setTeamSelfieRotation(team.id, Number(req.body.rotation));
  const updated = db.getTeam(team.id);
  io.to(`gm_${req.params.gameId}`).emit('team_selfie_updated', {teamId: team.id, selfiePath: updated.selfie_path, rotation: updated.selfie_rotation});
  res.json({success:true, rotation: updated.selfie_rotation});
});

// ── Game rules (for player) ────────────────────────────────────────────────────
app.get('/api/games/:id/rules', (req,res) => {
  const rules = db.getGameRules(req.params.id);
  res.json(rules);
});

// A rejection also lands in the team's chat, tagged with the mission it was
// about. The popup is easy to dismiss and then the reason is gone; in chat it
// stays readable next to everything else the GM said. Stored with a per-language
// copy so each device renders the label and mission name in its own language
// (the GM's typed reason is passed through as written).
const REJECT_LABEL = {de:'Abgelehnt', en:'Rejected', fr:'Refusé', it:'Rifiutato', es:'Rechazado'};
function postRejectionToChat(gameId, teamId, mission, message){
  if(!gameId || !teamId) return;
  const reason = String(message||'').trim();
  const nameIn = l => String((mission && (mission['name_'+l] || mission.name_de || mission.name_en || mission.name)) || '').trim();
  const langMsgs = {};
  ['de','en','fr','it','es'].forEach(l => {
    const name = nameIn(l);
    langMsgs[l] = `❌ ${REJECT_LABEL[l]}${name ? ': ' + name : ''}` + (reason ? `\n${reason}` : '');
  });
  const content = langMsgs.de;
  const msgId = db.saveMessage({gameId, teamId, content, fromGm:1, contentLangs:langMsgs});
  const msg = {id:msgId, content, messages:langMsgs, fromGm:1, teamId, gameId, timestamp:Date.now(), rejection:true};
  io.to(`team_${teamId}`).emit('chat_message', msg);
  io.to(`gm_${gameId}`).emit('chat_message', msg);
}

// ── Chat ──────────────────────────────────────────────────────────────────────
app.post('/api/games/:gameId/chat', (req,res) => {
  const {teamId,content,fromGm}=req.body;
  const msgId=db.saveMessage({gameId:req.params.gameId,teamId:teamId||null,content,fromGm});
  const msg={id:msgId,content,fromGm,teamId:teamId||null,gameId:req.params.gameId,timestamp:Date.now()};
  if(teamId){
    // Direct message to one team. The GM isn't in that team room, so send a
    // separate copy to the GM dashboard.
    io.to(`team_${teamId}`).emit('chat_message',msg);
    io.to(`gm_${req.params.gameId}`).emit('chat_message',msg);
  } else {
    // Broadcast to everyone. The GM also joins game_<id> (see join_gm), so a
    // single emit to game_ reaches players AND the GM — emitting to gm_ as well
    // would double the message on the GM dashboard.
    io.to(`game_${req.params.gameId}`).emit('chat_message',msg);
  }
  res.json({success:true,msg});
});
app.get('/api/games/:gameId/chat', (req,res) =>
  res.json(db.getMessages(req.params.gameId, req.query.teamId ? Number(req.query.teamId) : null)));

// ── Timer ─────────────────────────────────────────────────────────────────────
app.post('/api/games/:gameId/timer', (req,res) => {
  const {action, seconds}=req.body;
  const game=db.getGame(req.params.gameId);
  if(!game) return res.status(404).json({error:'Not found'});
  const now=Date.now();
  if(action==='start' && !game.timer_running) {
    db.updateGame(req.params.gameId,{timer_started_at: now-(game.timer_paused_elapsed||0), timer_running:1, status:'active'});
    try { db.markGameStatStarted(req.params.gameId); } catch(e){}
  } else if(action==='pause' && game.timer_running && game.timer_started_at) {
    db.updateGame(req.params.gameId,{timer_paused_elapsed: now-game.timer_started_at, timer_running:0});
  } else if(action==='adjust' && typeof seconds==='number') {
    // Add or subtract seconds from the total duration. getTimerState derives
    // `remaining` live as (timer_duration - elapsed), so changing the duration
    // alone shifts the remaining time immediately — whether the clock is
    // running or paused. Do NOT also move timer_started_at: that changes
    // `elapsed` by the same amount and exactly cancels the duration change
    // (net zero while running), and because timer_duration is floored at 10s
    // but the started_at shift isn't, a large subtract could even invert into
    // an increase. One line, both bugs gone.
    const newDuration = Math.max(10, (game.timer_duration||3600) + seconds);
    db.updateGame(req.params.gameId,{timer_duration: newDuration});
  }
  const updated=db.getGame(req.params.gameId);
  const state=getTimerState(updated);
  io.to(`game_${req.params.gameId}`).emit('timer_state',state);
  io.to(`gm_${req.params.gameId}`).emit('timer_state',state);
  res.json({success:true,state});
});



// ── CR Hints ──────────────────────────────────────────────────────────────────
// Optional ?type=gps|answer to scope the result to one hint group. Without
// the query param we still return every hint for backward compatibility.
app.get('/api/cr/hints/:missionId', (req,res) => {
  const type = req.query.type === 'gps' || req.query.type === 'answer' ? req.query.type : null;
  res.json(db.getCrHints(req.params.missionId, type));
});

// Multer was writing to UPLOAD_DIR/<gameId|misc>/<filename>, but the DB stores
// `cr_hints/<filename>`. So `/uploads/cr_hints/<filename>` 404'd and the player
// saw a broken-image icon. Move the file into cr_hints/ after upload.
function _moveHintFileIntoPlace(req){
  if(!req.file) return null;
  const destDir = path.join(UPLOAD_DIR,'cr_hints');
  if(!fs.existsSync(destDir)) fs.mkdirSync(destDir,{recursive:true});
  const dest = path.join(destDir, req.file.filename);
  try { fs.renameSync(req.file.path, dest); }
  catch(e) { fs.copyFileSync(req.file.path, dest); fs.unlinkSync(req.file.path); }
  return `cr_hints/${req.file.filename}`;
}

app.post('/api/cr/hints/:missionId', upload.single('image'), (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  const imagePath = _moveHintFileIntoPlace(req);
  const id = db.createCrHint({
    mission_id: req.params.missionId,
    order_index: req.body.order_index||0,
    text_de: req.body.text_de||'', text_en: req.body.text_en||'',
    text_fr: req.body.text_fr||'', text_it: req.body.text_it||'',
    text_es: req.body.text_es||'',
    image_path: imagePath,
    hint_type: req.body.hint_type === 'gps' ? 'gps' : 'answer',
  });
  res.json({id, success:true});
});

app.put('/api/cr/hints/:id', upload.single('image'), (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  const existing = db.getCrHint(req.params.id);
  if(!existing) return res.status(404).json({error:'Not found'});
  const newPath  = _moveHintFileIntoPlace(req);
  const imagePath = newPath || (req.body.clear_image==='1' ? null : existing.image_path);
  db.updateCrHint(req.params.id, {
    order_index: req.body.order_index||0,
    text_de: req.body.text_de||'', text_en: req.body.text_en||'',
    text_fr: req.body.text_fr||'', text_it: req.body.text_it||'',
    text_es: req.body.text_es||'',
    image_path: imagePath,
    hint_type: req.body.hint_type === 'gps' ? 'gps' : 'answer',
  });
  res.json({success:true});
});

app.delete('/api/cr/hints/:id', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  db.deleteCrHint(req.params.id);
  res.json({success:true});
});

app.post('/api/cr/hints/reorder/:missionId', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  db.reorderCrHints(req.params.missionId, req.body.order);
  res.json({success:true});
});

// Request next hint. `type` is 'gps' or 'answer' (default) so the GPS hint
// stream and the answer hint stream advance independently per team.
app.post('/api/games/:gameId/cr/hint', (req,res) => {
  const {teamId, missionId} = req.body;
  const type = req.body.type === 'gps' ? 'gps' : 'answer';
  const hints = db.getCrHints(missionId, type);
  if(!hints.length) return res.json({hint:null, index:-1, total:0, type});
  const used = db.incrementTeamHints(req.params.gameId, teamId, missionId, type);
  const idx = Math.min(used-1, hints.length-1);
  res.json({hint: hints[idx], index: idx, total: hints.length, type, allUsed: used >= hints.length});
});

// Answer submission for question missions
app.post('/api/games/:gameId/cr/answer', (req,res) => {
  if(timerNotStarted(req.params.gameId)) return res.status(403).json({error:'not_started'});
  const {teamId, missionId, answer} = req.body;
  const mission = db.getCrMission(missionId);
  if(!mission) return res.status(404).json({error:'Not found'});
  // Whitespace-tolerant FULL match against every accepted spelling the GM
  // listed, in any language. Never a substring: the old test accepted any
  // fragment (a single correct letter passed, "eiter" matched "Heitere Fahne").
  // Case is ignored unless the mission opts into answer_case_sensitive.
  const caseSensitive = !!mission.answer_case_sensitive;
  const norm = s => {
    const t = String(s == null ? '' : s).trim().replace(/\s+/g, ' ');
    return caseSensitive ? t : t.toLowerCase();
  };
  const correctAnswers = ['answer_de','answer_en','answer_fr','answer_it','answer_es']
    .flatMap(f => db.parseAnswerList(mission[f]))
    .map(norm)
    .filter(Boolean);
  const userAnswer = norm(answer);
  const correct = !!userAnswer && correctAnswers.some(a => a === userAnswer);
  res.json({correct, message: correct ? 'Richtig!' : 'Leider falsch. Versuche es erneut!'});
});

// In-app scan puzzle (QR / AR image). One endpoint for all three modes.
//   qr    → payload = decoded text, compared case-insensitively to scan_code / a fragment.
//   image → detected:true from the client's MindAR (recognition is client-trusted; the
//           .mind target is downloaded to the client anyway, so there's no secret to hide).
// solve → award; reveal → unlock the task via the arrival flag; fragment → collect, award on last.
app.post('/api/games/:gameId/cr/scan', (req,res) => {
  const gameId = req.params.gameId;
  const { teamId, missionId, payload, detected } = req.body;
  if(timerNotStarted(gameId)) return res.status(403).json({error:'not_started'});
  if(db.isTeamFrozen(gameId, Number(teamId))) return res.status(423).json({error:'frozen'});
  const mission = db.getCrMission(missionId);
  if(!mission || !mission.use_scan) return res.status(400).json({error:'Not a scan mission'});
  const norm = s => String(s||'').trim().toLowerCase();
  const isImage = mission.scan_type === 'image';
  const got = norm(payload);
  const crMode = db.getGameCrMode(gameId);
  const missions = crMode ? db.getLinearCrMissions(crMode.id) : [];

  // ── fragment mode (QR only — image can't distinguish which fragment) ──
  if(mission.scan_mode === 'fragment'){
    if(isImage) return res.json({correct:false, message:'Fragments require QR'});
    let fragments = [];
    try { fragments = JSON.parse(mission.scan_fragments||'[]'); } catch {}
    fragments = fragments.map(norm).filter(Boolean);
    if(!fragments.length) return res.json({correct:false, message:'No fragments configured'});
    if(!fragments.includes(got)) return res.json({correct:false});
    const prog = db.getCrMissionProgress(gameId, teamId, mission.id) || {};
    let collected = []; try { collected = JSON.parse(prog.scan_collected||'[]'); } catch {}
    if(!collected.includes(got)) collected.push(got);
    db.upsertCrMissionProgress(gameId, teamId, mission.id, { scan_collected: JSON.stringify(collected) });
    const total = fragments.length, have = collected.filter(c=>fragments.includes(c)).length;
    if(have >= total){
      const score = scoreForCrMission(mission, prog);
      const result = completeCrTeamMission(gameId, teamId, mission, score, {status:'completed'}) || {};
      return res.json({correct:true, complete:true, collected:have, total, ...crProgressPayload(gameId, teamId, missions, result.state || crMissionState(gameId, teamId, missions))});
    }
    return res.json({correct:true, complete:false, collected:have, total});
  }

  // ── solve / reveal: match the single code (or trust image detection) ──
  const matched = isImage ? !!detected : (norm(mission.scan_code) && got === norm(mission.scan_code));
  if(!matched) return res.json({correct:false});

  if(mission.scan_mode === 'reveal'){
    // Unlock the task: reuse the arrival flag so the player's popup reveals the
    // task (the player render treats a reveal-scan mission like a GPS lock).
    db.recordCrArrival(gameId, teamId, mission.id);
    io.to(`team_${teamId}`).emit('cr_arrived', {missionId: mission.id, distance:0, sticky:true, viaScan:true});
    return res.json({correct:true, revealed:true});
  }

  // solve → award. Mirror the one-shot / cooldown guards from
  // /cr/special/complete so re-scanning the same code can't farm points.
  if(mission.is_special){
    const sp = db.getCrSpecialProgress(gameId, teamId, mission.id) || {};
    const now = Date.now();
    const alreadyOneShot = !mission.is_repeatable && (sp.completed_count||0) > 0;
    let onCooldown = false;
    if(mission.is_repeatable && sp.last_attempt && mission.repeat_minutes > 0){
      onCooldown = (now - sp.last_attempt) < mission.repeat_minutes*60*1000;
    }
    // The scan matched, but the team isn't eligible to score again — acknowledge
    // completion (so the client stops the camera) without awarding a second time.
    if(alreadyOneShot || onCooldown){
      return res.json({correct:true, complete:true, score:0, alreadyCompleted:true});
    }
    const score = mission.points || 0;
    if(score > 0) db.addTeamScore(teamId, score);
    db.upsertCrSpecialProgress(gameId, teamId, mission.id, { completed_count:(sp.completed_count||0)+1, last_attempt:now });
    io.to(`gm_${gameId}`).emit('rankings_update', db.getRankings(gameId));
    return res.json({correct:true, complete:true, score});
  }
  const prog = db.getCrMissionProgress(gameId, teamId, mission.id) || db.getCrProgress(gameId, teamId) || {};
  const score = scoreForCrMission(mission, prog);
  const result = completeCrTeamMission(gameId, teamId, mission, score, {status:'completed'}) || {};
  res.json({correct:true, complete:true, score, ...crProgressPayload(gameId, teamId, missions, result.state || crMissionState(gameId, teamId, missions))});
});


// ════════════════════════════════════════════════════════════
//   CITYRUSH ROUTES
// ════════════════════════════════════════════════════════════

function crMediaMatchesMission(mission, mediaPath) {
  const req = mission.media_required || 'none';
  if (!mediaPath || req === 'none') return true;
  const p = String(mediaPath).toLowerCase();
  const looksVideo = /\.(mp4|webm|mov|m4v|mkv)$/i.test(p);
  if (req === 'photo' && looksVideo) return false;
  if (req === 'video' && !looksVideo) return false;
  return true;
}

// ── CR Modes ──────────────────────────────────────────────────────────────────
app.get('/api/cr/modes', (req,res) => res.json(db.getCrModes()));
app.post('/api/cr/modes', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  const {name, allow_photo, allow_video, ruleset_id, timer_default, allowed_langs, rush_mode} = req.body;
  const id = db.createCrMode({name, allow_photo, allow_video, ruleset_id, timer_default, allowed_langs, rush_mode});
  res.json({id, success:true});
});
// Declared before '/api/cr/modes/:id'. Body: { order: [crModeId, ...] }.
app.put('/api/cr/modes/reorder', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  db.reorderCrModes(Array.isArray(req.body.order) ? req.body.order : []);
  res.json({success:true});
});
app.put('/api/cr/modes/:id', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  const {name, allow_photo, allow_video, ruleset_id, timer_default, allowed_langs, rush_mode} = req.body;
  db.updateCrMode(req.params.id, {name, allow_photo, allow_video, ruleset_id, timer_default, allowed_langs, rush_mode});
  res.json({success:true});
});
app.delete('/api/cr/modes/:id', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  try {
    db.deleteCrMode(req.params.id);
    io.emit('settings_updated', {type:'cr_modes'});
    res.json({success:true});
  } catch(e) {
    res.status(500).json({error:'Delete failed: '+e.message});
  }
});

// ── CR Missions ────────────────────────────────────────────────────────────────
app.get('/api/cr/missions', (req,res) => res.json(db.getCrMissions(req.query.mode_id)));
app.post('/api/cr/missions', (req,res) => {
  const {password,...data} = req.body;
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  const id = db.createCrMission(data);
  io.emit('settings_updated', {type:'cr_missions'});
  res.json({id, success:true});
});
app.put('/api/cr/missions/:id', (req,res) => {
  const {password,...data} = req.body;
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  db.updateCrMission(req.params.id, data);
  io.emit('settings_updated', {type:'cr_missions'});
  res.json({success:true});
});
app.delete('/api/cr/missions/:id', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  try {
    db.deleteCrMission(req.params.id);
    io.emit('settings_updated', {type:'cr_missions'});
    res.json({success:true});
  } catch(e) {
    res.status(500).json({error:'Delete failed: '+e.message});
  }
});
app.post('/api/cr/missions/reorder', (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  db.reorderCrMissions(req.body.mode_id, req.body.order);
  res.json({success:true});
});

// Puzzle image upload for a CR mission. Multer drops the file under
// UPLOAD_DIR/<gameId|misc>/, so move it into cr_puzzles/ (matching the stored
// path) like the hint uploader does, then persist puzzle_image on the mission.
function _movePuzzleFileIntoPlace(req){
  if(!req.file) return null;
  const destDir = path.join(UPLOAD_DIR,'cr_puzzles');
  if(!fs.existsSync(destDir)) fs.mkdirSync(destDir,{recursive:true});
  const dest = path.join(destDir, req.file.filename);
  try { fs.renameSync(req.file.path, dest); }
  catch(e) { fs.copyFileSync(req.file.path, dest); fs.unlinkSync(req.file.path); }
  return `cr_puzzles/${req.file.filename}`;
}
app.post('/api/cr/missions/:id/puzzle-image', upload.single('image'), (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  if(!req.file) return res.status(400).json({error:'No file'});
  const mission = db.getCrMission(req.params.id);
  if(!mission) return res.status(404).json({error:'Not found'});
  const rel = _movePuzzleFileIntoPlace(req);
  db.updateCrMission(req.params.id, { puzzle_image: rel });
  io.emit('settings_updated', {type:'cr_missions'});
  res.json({success:true, puzzle_image: rel});
});

// Task reference image — optional image attached to a mission's task. Shown to
// players via a "View image" button (only when set). Lands the file under
// task_images/. POST with clear=1 and no file removes it. One uploader serves
// both MiSSiONS missions and Rail Adventure cr_missions.
function _moveTaskFileIntoPlace(req){
  if(!req.file) return null;
  const destDir = path.join(UPLOAD_DIR,'task_images');
  if(!fs.existsSync(destDir)) fs.mkdirSync(destDir,{recursive:true});
  const dest = path.join(destDir, req.file.filename);
  try { fs.renameSync(req.file.path, dest); }
  catch(e) { fs.copyFileSync(req.file.path, dest); fs.unlinkSync(req.file.path); }
  return `task_images/${req.file.filename}`;
}
app.post('/api/missions/:id/task-image', upload.single('image'), (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  if(!db.getMission(req.params.id)) return res.status(404).json({error:'Not found'});
  if(req.body.clear==='1' && !req.file){ db.setMissionTaskImage(req.params.id, null); io.emit('settings_updated',{type:'missions'}); return res.json({success:true, task_image:null}); }
  if(!req.file) return res.status(400).json({error:'No file'});
  const rel = _moveTaskFileIntoPlace(req);
  db.setMissionTaskImage(req.params.id, rel);
  io.emit('settings_updated', {type:'missions'});
  res.json({success:true, task_image: rel});
});
app.post('/api/cr/missions/:id/task-image', upload.single('image'), (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  if(!db.getCrMission(req.params.id)) return res.status(404).json({error:'Not found'});
  if(req.body.clear==='1' && !req.file){ db.updateCrMission(req.params.id, { task_image: null }); io.emit('settings_updated',{type:'cr_missions'}); return res.json({success:true, task_image:null}); }
  if(!req.file) return res.status(400).json({error:'No file'});
  const rel = _moveTaskFileIntoPlace(req);
  db.updateCrMission(req.params.id, { task_image: rel });
  io.emit('settings_updated', {type:'cr_missions'});
  res.json({success:true, task_image: rel});
});

// AR scan target upload — the source image a player points the camera at plus
// the compiled MindAR `.mind` target (compiled client-side in the GM editor).
// Both land under uploads/ar_targets/. POST with clear=1 and no files removes
// them. Uses upload.fields because two files arrive together.
function _moveScanFileIntoPlace(file){
  if(!file) return null;
  const destDir = path.join(UPLOAD_DIR,'ar_targets');
  if(!fs.existsSync(destDir)) fs.mkdirSync(destDir,{recursive:true});
  const dest = path.join(destDir, file.filename);
  try { fs.renameSync(file.path, dest); }
  catch(e) { fs.copyFileSync(file.path, dest); fs.unlinkSync(file.path); }
  return `ar_targets/${file.filename}`;
}
app.post('/api/cr/missions/:id/scan-target', upload.fields([{name:'image',maxCount:1},{name:'mind',maxCount:1}]), (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  if(!db.getCrMission(req.params.id)) return res.status(404).json({error:'Not found'});
  const img  = req.files && req.files.image && req.files.image[0];
  const mind = req.files && req.files.mind  && req.files.mind[0];
  if(req.body.clear==='1' && !img && !mind){
    db.updateCrMission(req.params.id, { scan_image:null, scan_target:null });
    io.emit('settings_updated', {type:'cr_missions'});
    return res.json({success:true, scan_image:null, scan_target:null});
  }
  if(!img || !mind) return res.status(400).json({error:'Need both image and compiled target'});
  const updates = { scan_image:_moveScanFileIntoPlace(img), scan_target:_moveScanFileIntoPlace(mind) };
  db.updateCrMission(req.params.id, updates);
  io.emit('settings_updated', {type:'cr_missions'});
  res.json({success:true, ...updates});
});

// Ordering-puzzle image upload. Not tied to a mission id (the GM builds the
// ordered list before the mission even exists), so it just stores one file and
// returns its path; the ordered list is persisted via puzzle_order_images.
app.post('/api/cr/puzzle-order-image', upload.single('image'), (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  if(!req.file) return res.status(400).json({error:'No file'});
  const rel = _movePuzzleFileIntoPlace(req);
  res.json({success:true, file: rel});
});

// Brand logo image upload (Settings → Logo). Stores the file under
// uploads/branding/ and records its path in the logo_image setting.
app.post('/api/settings/logo-image', upload.single('image'), (req,res) => {
  if(!isGmAuthed(req)) return res.status(401).json({error:'Unauthorized'});
  if(!req.file) return res.status(400).json({error:'No file'});
  const destDir = path.join(UPLOAD_DIR,'branding');
  if(!fs.existsSync(destDir)) fs.mkdirSync(destDir,{recursive:true});
  const dest = path.join(destDir, req.file.filename);
  try { fs.renameSync(req.file.path, dest); }
  catch(e){ fs.copyFileSync(req.file.path,dest); fs.unlinkSync(req.file.path); }
  const rel = `branding/${req.file.filename}`;
  db.setSetting('logo_image', rel);
  io.emit('settings_updated', {type:'logo'});
  res.json({success:true, logo_image: rel});
});

// QR image for the GM to print (Scan puzzle). Encodes the raw code string
// (NOT a URL), so a player scanning it in-app just decodes the code — it never
// opens a website. Public + cached; length-capped to avoid abuse. Used for the
// live preview in the mission editor and the printable QR sheet.
app.get('/api/qr.png', (req,res) => {
  const text = String(req.query.text||'').slice(0,512);
  if(!text) return res.status(400).end();
  const size = Math.min(1200, Math.max(120, parseInt(req.query.size)||400));
  QRCode.toBuffer(text, {errorCorrectionLevel:'H', width:size, margin:2}, (err,buf)=>{
    if(err) return res.status(500).end();
    res.setHeader('Content-Type','image/png');
    res.setHeader('Cache-Control','public, max-age=86400');
    res.end(buf);
  });
});

// ── CR Game info ──────────────────────────────────────────────────────────────
app.get('/api/games/:id/cr', (req,res) => {
  const crMode = db.getGameCrMode(req.params.id);
  if(!crMode) return res.json({active:false});
  const missions = db.getCrMissions(crMode.id);
  const missionsWithHints = missions.map(m => ({
    ...m,
    hints: db.getCrHints(m.id),                       // back-compat: full list
    gps_hints: db.getCrHints(m.id, 'gps'),            // pre-arrival reveals
    answer_hints: db.getCrHints(m.id, 'answer'),      // post-arrival reveals
  }));
  const progress = db.getAllCrProgress(req.params.id);
  const gps      = db.getTeamGps(req.params.id);
  const captures = db.getCrCaptures(req.params.id);
  const submissions = db.listCrSubmissions(req.params.id);
  const arrivals = db.listCrArrivalsForGame(req.params.id);
  const missionProgress = db.listCrMissionProgressForGame(req.params.id);
  const specialProgress = db.listCrSpecialProgressForGame(req.params.id);
  const freezes  = db.listFreezesForGame(req.params.id);
  res.json({active:true, crMode, missions: missionsWithHints.map(sanitizeCrMissionForPlayer), progress, missionProgress, gps, captures, submissions, arrivals, specialProgress, freezes});
});

// Pending review counts per team (regular + CR), so the dashboard's
// notification dot can show a number that only zeroes out when the queue
// is fully cleared.
app.get('/api/games/:id/pending-counts', (req,res) => {
  res.json(db.getPendingCountsByTeam(req.params.id));
});

// ── GPS updates ───────────────────────────────────────────────────────────────
app.post('/api/games/:gameId/gps', (req,res) => {
  const {teamId, lat, lng, playerKey} = req.body;
  if(!teamId||lat===undefined||lng===undefined) return res.status(400).json({error:'Missing params'});
  const updatedDb = db.updateTeamGps(req.params.gameId, teamId, lat, lng, playerKey||null);
  const payload = {teamId, lat, lng, playerKey: playerKey||null, ts: Date.now()};
  // Broadcast to GM and all players in the game (playerKey lets teammates see each other on the map)
  io.to(`game_${req.params.gameId}`).emit('gps_update', payload);
  io.to(`gm_${req.params.gameId}`).emit('gps_update', payload);
  res.json({success:true, persisted: updatedDb !== false});
});

// ── CR Team progress ──────────────────────────────────────────────────────────
app.get('/api/games/:gameId/cr/progress/:teamId', (req,res) => {
  let prog = db.getCrProgress(req.params.gameId, req.params.teamId);
  const crMode = db.getGameCrMode(req.params.gameId);
  if(!crMode) return res.json({active:false});
  // mission_index tracks the linear sequence only — special missions are
  // parallel and don't move the counter.
  const linear  = db.getLinearCrMissions(crMode.id);
  const special = db.getSpecialCrMissions(crMode.id);
  if(!prog && linear.length > 0) {
    db.initCrProgress(req.params.gameId, req.params.teamId, linear[0].id);
    prog = db.getCrProgress(req.params.gameId, req.params.teamId);
  }
  let state = crMissionState(req.params.gameId, req.params.teamId, linear);
  const progress = syncCrAggregateProgress(req.params.gameId, req.params.teamId, linear, state)
    || prog
    || {mission_index:state.nextIndex,status:state.finished?'finished':'active',score_earned:state.scoreEarned};
  state = crMissionState(req.params.gameId, req.params.teamId, linear);
  res.json({
    active:true, progress, currentMission: sanitizeCrMissionForPlayer(state.nextMission),
    totalMissions: linear.length,
    missionProgress: state.rows,
    completedMissionIds: state.completedMissionIds,
    pendingMissionIds: state.pendingMissionIds,
    skippedMissionIds: state.skippedMissionIds,
    specialMissions: special.map(sanitizeCrMissionForPlayer),
    arrivedMissionIds: db.listCrArrivals(req.params.gameId, Number(req.params.teamId)),
    specialProgress:  db.getCrSpecialProgressForTeam(req.params.gameId, Number(req.params.teamId)),
  });
});

// Compute the score a team would receive for completing the given CR mission
// right now (after applying time-based penalties).
function scoreForCrMission(mission, prog) {
  const elapsed = prog.started_at ? Math.floor((Date.now() - prog.started_at) / 1000) : 0;
  let score = mission.points;
  if(mission.is_timed && prog.started_at) {
    const overtime = Math.max(0, elapsed - mission.timer_seconds);
    const extraPenalties = Math.floor(overtime / (mission.penalty_interval||60));
    const totalPenalties = (prog.penalties||0) + extraPenalties;
    score = Math.max(0, mission.points - totalPenalties * (mission.penalty_points||2));
  }
  return score;
}

function crMissionState(gameId, teamId, missions) {
  const rows = db.getCrMissionProgressForTeam(gameId, teamId);
  const cleared = new Set();
  const pending = new Set();
  const skipped = new Set();
  rows.forEach(r => {
    if(r.status === 'completed' || r.status === 'skipped') cleared.add(r.mission_id);
    if(r.status === 'pending') pending.add(r.mission_id);
    if(r.status === 'skipped') skipped.add(r.mission_id);
  });
  const nextIndex = missions.findIndex(m => !cleared.has(m.id) && !pending.has(m.id));
  const finished = missions.length > 0 && missions.every(m => cleared.has(m.id));
  return {
    rows,
    completedMissionIds: missions.filter(m => cleared.has(m.id)).map(m => m.id),
    pendingMissionIds: missions.filter(m => pending.has(m.id)).map(m => m.id),
    skippedMissionIds: missions.filter(m => skipped.has(m.id)).map(m => m.id),
    nextIndex: nextIndex < 0 ? missions.length : nextIndex,
    nextMission: nextIndex < 0 ? null : missions[nextIndex],
    finished,
    scoreEarned: rows
      .filter(r => r.status === 'completed' || r.status === 'skipped')
      .reduce((sum, r) => sum + (Number(r.score_earned) || 0), 0),
  };
}

function syncCrAggregateProgress(gameId, teamId, missions, state) {
  if(!db.getCrProgress(gameId, teamId) && missions.length > 0) {
    db.initCrProgress(gameId, teamId, state.nextMission ? state.nextMission.id : null);
  }
  const prog = db.getCrProgress(gameId, teamId);
  if(!prog) return null;
  db.updateCrProgress(gameId, teamId, {
    mission_index: state.nextIndex,
    mission_id: state.nextMission ? state.nextMission.id : null,
    status: state.finished ? 'finished' : 'active',
    completed_at: state.finished ? Date.now() : null,
    score_earned: state.scoreEarned,
    media_path: null,
    media_status: 'none',
  });
  return db.getCrProgress(gameId, teamId);
}

// Strip solution secrets before a mission object is sent to players — they can
// read the raw network payload, so the QR/fragment codes must never travel to
// the client. Keeps a fragment COUNT so the player UI can still show "x / N".
// (scan_image / scan_target stay: AR needs the compiled target at runtime, and
// it reveals no answer.) The GM editor uses the authed /api/cr/missions route,
// which is left untouched.
function sanitizeCrMissionForPlayer(m){
  if(!m || typeof m !== 'object') return m;
  const out = {...m};
  let fragCount = 0;
  try { const a = JSON.parse(out.scan_fragments||'[]'); if(Array.isArray(a)) fragCount = a.filter(x=>String(x||'').trim()).length; } catch {}
  out.scan_fragment_count = fragCount;
  delete out.scan_code;
  delete out.scan_fragments;
  // Quiz solutions must never reach the player device — answers are checked
  // server-side (/cr/answer), so the client has no use for them. has_answer
  // stays so the UI still renders the answer input.
  ['answer_de','answer_en','answer_fr','answer_it','answer_es'].forEach(f => delete out[f]);
  return out;
}

function crProgressPayload(gameId, teamId, missions, state) {
  return {
    teamId: Number(teamId),
    missionProgress: state.rows,
    completedMissionIds: state.completedMissionIds,
    pendingMissionIds: state.pendingMissionIds,
    skippedMissionIds: state.skippedMissionIds,
    currentMission: sanitizeCrMissionForPlayer(state.nextMission),
    missionIndex: state.nextIndex,
    totalMissions: missions.length,
    finished: state.finished,
    score_earned: state.scoreEarned,
  };
}

function completeCrTeamMission(gameId, teamId, mission, score, opts={}) {
  const crMode = db.getGameCrMode(gameId);
  const missions = crMode ? db.getLinearCrMissions(crMode.id) : [];
  const existing = db.getCrMissionProgress(gameId, teamId, mission.id);
  if(existing && (existing.status === 'completed' || existing.status === 'skipped')) {
    const state = crMissionState(gameId, teamId, missions);
    syncCrAggregateProgress(gameId, teamId, missions, state);
    return {alreadyCompleted:true, state};
  }
  const status = opts.status || 'completed';
  db.upsertCrMissionProgress(gameId, teamId, mission.id, {
    status,
    completed_at: Date.now(),
    score_earned: score || 0,
    media_path: opts.mediaPath || null,
    media_status: opts.mediaStatus || 'none',
  });
  if(score > 0) db.addTeamScore(teamId, score);
  const state = crMissionState(gameId, teamId, missions);
  syncCrAggregateProgress(gameId, teamId, missions, state);
  const missionIndex = missions.findIndex(m => m.id === mission.id);
  io.to(`gm_${gameId}`).emit('cr_mission_completed', {
    teamId: Number(teamId),
    missionId: mission.id,
    missionIndex,
    score,
    finished: state.finished,
    completedMissionIds: state.completedMissionIds,
    pendingMissionIds: state.pendingMissionIds,
  });
  io.to(`gm_${gameId}`).emit('rankings_update', db.getRankings(gameId));
  io.to(`team_${teamId}`).emit('cr_progress_updated', crProgressPayload(gameId, teamId, missions, state));
  if(state.finished) {
    io.to(`team_${teamId}`).emit('cr_finished', {score_earned: state.scoreEarned});
  }
  return {state};
}

// Accept a CR media submission and award its points. Shared by the GM review
// "accept" action and by Draw missions whose approval is turned off (which
// auto-award on submit). Mirrors the special-vs-linear award split.
function acceptCrSubmissionAndAward(sub, mission) {
  // Idempotent: never award the same submission twice (GM double-click / retry).
  if (sub.status === 'accepted') return { score: 0, alreadyAccepted: true };
  db.acceptCrSubmission(sub.id);
  if (mission.is_special) {
    const prog = db.getCrSpecialProgress(sub.game_id, sub.team_id, mission.id) || {};
    // One-shot specials award only once, even across multiple accepted submissions.
    if (!mission.is_repeatable && (prog.completed_count || 0) > 0) {
      return { score: 0, alreadyCompleted: true };
    }
    const score = mission.points || 0;
    if (score > 0) db.addTeamScore(sub.team_id, score);
    db.upsertCrSpecialProgress(sub.game_id, sub.team_id, mission.id, {
      completed_count: (prog.completed_count || 0) + 1,
    });
    io.to(`gm_${sub.game_id}`).emit('rankings_update', db.getRankings(sub.game_id));
    return { score };
  }
  const prog = db.getCrMissionProgress(sub.game_id, sub.team_id, mission.id)
    || db.getCrProgress(sub.game_id, sub.team_id) || {};
  const score = scoreForCrMission(mission, prog);
  completeCrTeamMission(sub.game_id, sub.team_id, mission, score, {
    status: 'completed', mediaPath: sub.media_path, mediaStatus: 'accepted',
  });
  return { score };
}

// Move a team to the next CR mission after a successful completion. Awards
// points to the team and emits the appropriate sockets to player + GM.
function advanceCrTeam(gameId, teamId, mission, missionIndex, score) {
  const crMode = db.getGameCrMode(gameId);
  // Linear sequence only — special missions live in parallel and don't move
  // the mission_index counter.
  const missions = crMode ? db.getLinearCrMissions(crMode.id) : [];
  const prog = db.getCrProgress(gameId, teamId);
  if(!prog) return null;
  const nextIndex = missionIndex + 1;
  const nextMission = missions[nextIndex] || null;
  db.updateCrProgress(gameId, teamId, {
    mission_index: nextIndex,
    mission_id: nextMission ? nextMission.id : null,
    status: nextMission ? 'active' : 'finished',
    completed_at: Date.now(),
    score_earned: (prog.score_earned||0) + score,
  });
  if(score > 0) db.addTeamScore(teamId, score);
  io.to(`gm_${gameId}`).emit('cr_mission_completed', {teamId, missionIndex, score, nextMission});
  io.to(`gm_${gameId}`).emit('rankings_update', db.getRankings(gameId));
  if(nextMission) {
    io.to(`team_${teamId}`).emit('cr_next_mission', {mission: nextMission, missionIndex: nextIndex});
  } else {
    io.to(`team_${teamId}`).emit('cr_finished', {score_earned: (prog.score_earned||0)+score});
  }
  return {nextMission, nextIndex};
}

app.post('/api/games/:gameId/cr/complete', (req,res) => {
  const {teamId, missionId, mediaPath, playerKey} = req.body;
  const gameId = req.params.gameId;
  if(timerNotStarted(gameId)) return res.status(403).json({error:'not_started'});
  // Frozen teams cannot complete anything until their freeze expires.
  if(db.isTeamFrozen(gameId, Number(teamId))) return res.status(423).json({error:'frozen'});
  const crMode = db.getGameCrMode(gameId);
  if(!crMode) return res.status(400).json({error:'No CityRush mode'});
  // Linear sequence only — special missions are completed via their own route.
  const missions = db.getLinearCrMissions(crMode.id);
  let prog = db.getCrProgress(gameId, teamId);
  if(!prog && missions.length > 0) {
    db.initCrProgress(gameId, teamId, missions[0].id);
    prog = db.getCrProgress(gameId, teamId);
  }
  const requestedMissionId = Number(missionId);
  const missionIndex = missions.findIndex(m => m.id === requestedMissionId);
  const mission = missions[missionIndex];
  if(!mission) return res.status(400).json({error:'Mission is not available in this CityRush game'});
  const existing = db.getCrMissionProgress(gameId, teamId, mission.id);
  if(existing && (existing.status === 'completed' || existing.status === 'skipped')) {
    const state = crMissionState(gameId, teamId, missions);
    return res.json({success:true, alreadyCompleted:true, ...crProgressPayload(gameId, teamId, missions, state)});
  }

  // Branch: media-bearing missions need GM approval. Don't advance yet.
  if(mediaPath) {
    if (!mission.use_draw && !crMediaMatchesMission(mission, mediaPath)) {
      return res.status(400).json({error:'Media type does not match mission (photo vs video)'});
    }
    const sub = db.createCrSubmission(gameId, teamId, mission.id, mediaPath, playerKey||null);
    if (sub.conflict) {
      return res.status(409).json({error:'Teammate submission pending', code:'submission_conflict'});
    }
    const subId = sub.id;
    // Draw mission with approval off: accept immediately (no GM review) but keep
    // the drawing as an accepted submission so it still lands in the gallery/collage.
    if (mission.use_draw && !mission.draw_needs_approval) {
      const fullSub = db.getCrSubmission(subId);
      const { score } = acceptCrSubmissionAndAward(fullSub, mission);
      const stNow = crMissionState(gameId, teamId, missions);
      return res.json({success:true, autoAwarded:true, score, ...crProgressPayload(gameId, teamId, missions, stNow)});
    }
    db.upsertCrMissionProgress(gameId, teamId, mission.id, {
      status: 'pending',
      media_path: mediaPath,
      media_status: 'pending',
    });
    const state = crMissionState(gameId, teamId, missions);
    syncCrAggregateProgress(gameId, teamId, missions, state);
    io.to(`gm_${gameId}`).emit('cr_submission_new', {
      submissionId: subId, teamId, missionId: mission.id, missionIndex, mediaPath,
    });
    io.to(`team_${teamId}`).emit('cr_progress_updated', crProgressPayload(gameId, teamId, missions, state));
    return res.json({success:true, pending:true, ...crProgressPayload(gameId, teamId, missions, state)});
  }

  // Otherwise (answer or no-media completion): award immediately. Mission
  // order no longer matters; completion is tracked per mission.
  const score = scoreForCrMission(mission, existing || prog || {});
  const result = completeCrTeamMission(gameId, teamId, mission, score, {status:'completed'}) || {};
  res.json({success:true, score, ...crProgressPayload(gameId, teamId, missions, result.state)});
});

// GM review of a CR media submission. accept → award points and advance the
// team; reject → wipe the media and let the player retry the same mission.
app.post('/api/cr/submissions/:id/review', (req,res) => {
  const {action, message, gameId} = req.body;
  const sub = db.getCrSubmission(Number(req.params.id));
  if(!sub) return res.status(404).json({error:'Not found'});
  const crMode = db.getGameCrMode(sub.game_id);
  if(!crMode) return res.status(400).json({error:'No CityRush mode'});
  const missions = db.getCrMissions(crMode.id);
  // Resolve the index of the mission the submission was for so we award the
  // right amount even if the team has somehow already moved on.
  const idx = missions.findIndex(m => m.id === sub.mission_id);
  if(idx < 0) return res.status(400).json({error:'Mission no longer exists'});
  const mission = missions[idx];

  if(action === 'accept') {
    // Already reviewed — don't re-award or re-notify (GM double-click / retry).
    if(sub.status === 'accepted') return res.json({success:true, alreadyAccepted:true});
    acceptCrSubmissionAndAward(sub, mission);
    io.to(`team_${sub.team_id}`).emit('cr_submission_reviewed', {missionId: mission.id, accepted:true});
  } else {
    db.rejectCrSubmission(sub.id, message);
    const fp = path.join(UPLOAD_DIR, sub.media_path||'');
    if(sub.media_path && fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch(e){} }
    if(mission.is_special){
      // Per spec: rejected special-mission media skips the cooldown so the
      // player can retake immediately.
      db.clearCrSpecialCooldown(sub.game_id, sub.team_id, mission.id);
    } else {
      db.upsertCrMissionProgress(sub.game_id, sub.team_id, mission.id, {
        status: 'open',
        media_path: null,
        media_status: 'rejected',
      });
      const linear = db.getLinearCrMissions(crMode.id);
      const state = crMissionState(sub.game_id, sub.team_id, linear);
      syncCrAggregateProgress(sub.game_id, sub.team_id, linear, state);
      io.to(`team_${sub.team_id}`).emit('cr_progress_updated', crProgressPayload(sub.game_id, sub.team_id, linear, state));
    }
    io.to(`team_${sub.team_id}`).emit('cr_submission_reviewed', {missionId: mission.id, accepted:false, message});
    postRejectionToChat(sub.game_id, sub.team_id, mission, message);
  }
  io.to(`gm_${sub.game_id}`).emit('cr_submission_reviewed', {submissionId: sub.id, teamId: sub.team_id, action});
  res.json({success:true});
});

// ── CR GPS arrival check ──────────────────────────────────────────────────────
// Once any team member triggers arrival, it sticks for the whole team
// (recorded in cr_arrivals). Later GPS pings from any team member
// short-circuit immediately and re-emit the cr_arrived event so the action UI
// unlocks across every device.
app.post('/api/games/:gameId/cr/arrival', (req,res) => {
  const {teamId, missionId, lat, lng, accuracy} = req.body;
  const latN = Number(lat);
  const lngN = Number(lng);
  if(!Number.isFinite(latN) || !Number.isFinite(lngN)) return res.json({arrived:false});
  let prog = db.getCrProgress(req.params.gameId, teamId);
  const crMode = db.getGameCrMode(req.params.gameId);
  if(!crMode) return res.json({arrived:false});
  const linear = db.getLinearCrMissions(crMode.id);
  if(!prog && linear.length > 0) {
    db.initCrProgress(req.params.gameId, teamId, linear[0].id);
    prog = db.getCrProgress(req.params.gameId, teamId);
  }
  const requestedMissionId = Number(missionId);
  const mission = Number.isFinite(requestedMissionId) && requestedMissionId > 0
    ? linear.find(m => m.id === requestedMissionId)
    : linear[prog?.mission_index || 0];
  const missionLat = Number(mission?.lat);
  const missionLng = Number(mission?.lng);
  if(!mission || !mission.use_gps || !Number.isFinite(missionLat) || !Number.isFinite(missionLng)) return res.json({arrived:false});

  // Sticky: if any team member already arrived, report arrived without
  // re-running the geofence.
  if(db.hasCrArrival(req.params.gameId, teamId, mission.id)){
    io.to(`team_${teamId}`).emit('cr_arrived', {missionId: mission.id, distance: 0, sticky:true});
    return res.json({arrived:true, distance:0, sticky:true});
  }

  // Haversine distance, with a GPS-accuracy slack (15-30m phone error is
  // typical and would otherwise reject a player visibly on the target).
  const R = 6371000;
  const dLat = (missionLat - latN) * Math.PI / 180;
  const dLng = (missionLng - lngN) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(latN*Math.PI/180)*Math.cos(missionLat*Math.PI/180)*Math.sin(dLng/2)**2;
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const slack  = Math.min(Math.max(Number(accuracy)||10, 10), 75) + 5;
  const configuredRadius = Number(mission.radius_meters);
  const radius = Number.isFinite(configuredRadius) && configuredRadius > 0 ? configuredRadius : 30;
  const arrived = dist <= radius + slack;
  if(arrived) {
    db.recordCrArrival(req.params.gameId, teamId, mission.id);
    io.to(`team_${teamId}`).emit('cr_arrived', {missionId: mission.id, distance: Math.round(dist)});
  }
  res.json({arrived, distance: Math.round(dist)});
});

// Skip current CR mission — forfeits its points, advances the team.
app.post('/api/games/:gameId/cr/skip', (req,res) => {
  const {teamId, missionId} = req.body;
  if(db.isTeamFrozen(req.params.gameId, Number(teamId))) return res.status(423).json({error:'frozen'});
  const crMode = db.getGameCrMode(req.params.gameId);
  if(!crMode) return res.status(400).json({error:'No CityRush mode'});
  const linear = db.getLinearCrMissions(crMode.id);
  let prog = db.getCrProgress(req.params.gameId, teamId);
  if(!prog && linear.length > 0) {
    db.initCrProgress(req.params.gameId, teamId, linear[0].id);
    prog = db.getCrProgress(req.params.gameId, teamId);
  }
  const requestedMissionId = Number(missionId);
  const mission = Number.isFinite(requestedMissionId) && requestedMissionId > 0
    ? linear.find(m => m.id === requestedMissionId)
    : linear[prog?.mission_index || 0];
  if(!mission) return res.status(400).json({error:'Mission is not available in this CityRush game'});
  const result = completeCrTeamMission(req.params.gameId, teamId, mission, 0, {status:'skipped'}) || {};
  res.json({success:true, score:0, ...crProgressPayload(req.params.gameId, teamId, linear, result.state)});
});

// Special-mission completion. Independent of the linear progress; obeys its
// own cooldown. Photo/video specials still go through GM review.
app.post('/api/games/:gameId/cr/special/complete', (req,res) => {
  const {teamId, missionId, mediaPath, playerKey} = req.body;
  const gameId = req.params.gameId;
  if(timerNotStarted(gameId)) return res.status(403).json({error:'not_started'});
  if(db.isTeamFrozen(gameId, Number(teamId))) return res.status(423).json({error:'frozen'});
  const mission = db.getCrMission(missionId);
  if(!mission || !mission.is_special) return res.status(400).json({error:'Not a special mission'});
  const prog = db.getCrSpecialProgress(gameId, teamId, missionId);
  const now = Date.now();
  // One-shot enforcement: a non-repeatable special can be completed once.
  if(!mission.is_repeatable && (prog?.completed_count||0) > 0){
    return res.status(409).json({error:'Already completed', code:'already_completed'});
  }
  // Repeatable specials may still be throttled by a per-attempt cooldown.
  if(mission.is_repeatable && prog && prog.last_attempt && mission.repeat_minutes > 0){
    const elapsedMs = now - prog.last_attempt;
    const cooldownMs = mission.repeat_minutes * 60 * 1000;
    if(elapsedMs < cooldownMs){
      const wait = Math.ceil((cooldownMs - elapsedMs)/1000);
      return res.status(429).json({error:'Cooldown', waitSeconds: wait});
    }
  }
  // Media branch → pending GM review (no instant award).
  if(mediaPath){
    if (!crMediaMatchesMission(mission, mediaPath)) {
      return res.status(400).json({error:'Media type does not match mission (photo vs video)'});
    }
    const sub = db.createCrSubmission(gameId, teamId, mission.id, mediaPath, playerKey||null);
    if (sub.conflict) {
      return res.status(409).json({error:'Teammate submission pending', code:'submission_conflict'});
    }
    const subId = sub.id;
    db.upsertCrSpecialProgress(gameId, teamId, mission.id, {last_attempt: now});
    io.to(`gm_${gameId}`).emit('cr_submission_new', {
      submissionId: subId, teamId, missionId: mission.id, missionIndex: -1, mediaPath, isSpecial: true,
    });
    return res.json({success:true, pending:true});
  }
  // No-media special (answer or plain complete) — instant award.
  const score = mission.points || 0;
  db.addTeamScore(teamId, score);
  db.upsertCrSpecialProgress(gameId, teamId, mission.id, {last_attempt: now, completed_count: (prog?.completed_count||0)+1});
  io.to(`gm_${gameId}`).emit('rankings_update', db.getRankings(gameId));
  io.to(`gm_${gameId}`).emit('cr_special_completed', {teamId, missionId: mission.id, score});
  res.json({success:true, score});
});

// ── CR Team capture (photo of another team) ───────────────────────────────────
app.post('/api/games/:gameId/cr/capture',
  upload.single('media'), (req,res) => {
    if(timerNotStarted(req.params.gameId)){ if(req.file){ try{ fs.unlinkSync(req.file.path); }catch(e){} } return res.status(403).json({error:'not_started'}); }
    const {teamId, targetTeamId} = req.body;
    const mediaPath = req.file ? `${req.params.gameId}/${req.file.filename}` : null;
    if(!mediaPath) return res.status(400).json({error:'No media'});
    const id = db.createCrCapture(req.params.gameId, teamId, targetTeamId, mediaPath);
    io.to(`gm_${req.params.gameId}`).emit('cr_capture_new', {id, teamId, targetTeamId, mediaPath});
    res.json({success:true, id});
  }
);
app.post('/api/cr/captures/:id/review', (req,res) => {
  const {accept, bonusPoints, gameId} = req.body;
  db.reviewCrCapture(req.params.id, accept, bonusPoints||5);
  if(gameId) io.to(`gm_${gameId}`).emit('cr_capture_reviewed', {id:Number(req.params.id), accept});
  res.json({success:true});
});


// ── Socket ────────────────────────────────────────────────────────────────────
io.on('connection', socket => {
  socket.on('join_game', ({gameId,teamId}) => {
    socket.join(`game_${gameId}`);
    if(teamId) socket.join(`team_${teamId}`);
    const game=db.getGame(gameId);
    if(game) socket.emit('timer_state',getTimerState(game));
  });
  socket.on('join_gm', ({gameId}) => {
    socket.join(`gm_${gameId}`);
    socket.join(`game_${gameId}`);
    const game=db.getGame(gameId);
    if(game) socket.emit('timer_state',getTimerState(game));
  });

  // ── Collaborative Draw relay ──
  socket.on('draw_join', ({token, role}) => {
    const s = drawSessions.get(token);
    if(!s){ socket.emit('draw_closed', {reason:'gone'}); return; }
    socket.join(`draw_${token}`);
    socket.data.drawToken = token;
    if(role === 'master' || role === 'solo'){ s.masterId = socket.id; s.masterGone = null; }
    socket.emit('draw_init', { strokes: s.strokes });
    socket.to(`draw_${token}`).emit('draw_peer', { count: io.sockets.adapter.rooms.get(`draw_${token}`)?.size || 1 });
  });
  socket.on('draw_stroke', ({token, stroke}) => {
    const s = drawSessions.get(token); if(!s || !stroke) return;
    if(s.strokes.length < 5000) s.strokes.push(stroke);
    socket.to(`draw_${token}`).emit('draw_stroke', { stroke });
  });
  socket.on('draw_live', ({token, seg}) => {
    if(!drawSessions.has(token)) return;
    socket.to(`draw_${token}`).emit('draw_live', { seg });
  });
  socket.on('draw_remove', ({token, id}) => {
    const s = drawSessions.get(token); if(!s) return;
    s.strokes = s.strokes.filter(st => st.id !== id);
    socket.to(`draw_${token}`).emit('draw_remove', { id });
  });
  socket.on('draw_clear', ({token}) => {
    const s = drawSessions.get(token); if(!s) return;
    s.strokes = [];
    io.to(`draw_${token}`).emit('draw_clear', {});
  });
  socket.on('draw_close', ({token, reason}) => {
    if(!drawSessions.has(token)) return;
    io.to(`draw_${token}`).emit('draw_closed', { reason: reason||'closed' });
    drawSessions.delete(token);
  });
  socket.on('disconnect', () => {
    const token = socket.data && socket.data.drawToken;
    if(!token) return;
    const s = drawSessions.get(token);
    if(s && s.masterId === socket.id){
      // Grace period: a mobile master often reconnects within seconds (transport
      // hiccup, screen lock). Only end the session if they don't come back.
      s.masterGone = Date.now();
      setTimeout(() => {
        const cur = drawSessions.get(token);
        if(cur && cur.masterId === socket.id && cur.masterGone){
          io.to(`draw_${token}`).emit('draw_closed', {reason:'master_left'});
          drawSessions.delete(token);
        }
      }, 25000);
    }
  });
});

// Automated (scheduled) broadcasts. Fired from the per-second timer loop when a
// game's remaining time first reaches a rule's trigger. _autoSent guards against
// re-sending every tick (per game+rule); cleared when the game ends.
const _autoSent = {};
const _AM_LANGS = ['de','en','fr','it','es'];
// Build the {de,en,fr,it,es} map for an automated-message rule. Each language
// the GM left blank falls back to the base text (German, else the first
// non-empty language) so a player never gets an empty bubble.
function _amLangMap(m){
  const base = _AM_LANGS.map(l => String(m['message_'+l]||'').trim()).find(Boolean)
            || String(m.message||'').trim();
  const out = {};
  for(const l of _AM_LANGS){
    const v = String(m['message_'+l]||'').trim();
    out[l] = v || base;
  }
  return out;
}
function _sendAutoBroadcast(gameId, langMsgs){
  try{
    const base = langMsgs.de || _AM_LANGS.map(l=>langMsgs[l]).find(Boolean) || '';
    // Persist the base text for the GM dashboard + the per-language map so a
    // player reloading mid-game still sees the broadcast in its own language.
    const msgId = db.saveMessage({gameId, teamId:null, content:base, fromGm:1, contentLangs:langMsgs});
    // Mirror a GM broadcast: a no-team chat_message to game_<id> reaches every
    // player and the GM dashboard (the GM also joins game_<id>). `messages`
    // carries all five languages; each player renders the one its app is set to.
    io.to(`game_${gameId}`).emit('chat_message', {id:msgId, content:base, messages:langMsgs, fromGm:1, teamId:null, gameId, timestamp:Date.now(), auto:true});
  }catch(e){ console.warn('auto-broadcast failed', e); }
}
function _fireAutoMessages(game, remaining, autoMsgs){
  // RA games are identified by a cr_game_links row (there is no is_cityrush column).
  const kind = db.isCrGame(game.id) ? 'cityrush' : 'missions';
  let sent = _autoSent[game.id]; if(!sent){ sent = _autoSent[game.id] = new Set(); }
  for(const m of autoMsgs){
    if(sent.has(m.id)) continue;
    const langMsgs = _amLangMap(m);
    if(!_AM_LANGS.some(l => langMsgs[l])) continue;   // skip blank (unfinished) rows
    if(m.game_kind !== kind) continue;
    if(kind==='missions' && m.location_id!=null && Number(m.location_id)!==Number(game.location_id)) continue;
    if(remaining <= m.trigger_seconds){ sent.add(m.id); _sendAutoBroadcast(game.id, langMsgs); }
  }
}

// Timer broadcast
setInterval(() => {
  const autoMsgs = db.getAutoMessages().filter(m=>m.enabled);
  db.getRunningGames().forEach(game => {
    const state=getTimerState(game);
    io.to(`game_${game.id}`).emit('timer_update',state);
    io.to(`gm_${game.id}`).emit('timer_update',state);
    if(autoMsgs.length && state.running && state.remaining>0) _fireAutoMessages(game, state.remaining, autoMsgs);
    if(state.remaining<=0) {
      delete _autoSent[game.id];
      db.updateGame(game.id,{timer_running:0,status:'ended'});
      try { db.markGameStatEnded(game.id); } catch(e){}
      // Pick timeout message for the game's language (fallback chain)
      const lang_key = 'timeout_text'; // base key
      const msg = db.getSetting('timeout_text_de') || db.getSetting('timeout_text') || 'Die Zeit ist abgelaufen!';
      // Per-language broadcast so each player sees the message in their selected UI language.
      // Falls back to the German text (or the hardcoded default) when an es/fr/it/en
      // setting was never customised by the GM.
      const langMsgs = {
        de: db.getSetting('timeout_text_de')||db.getSetting('timeout_text')||'Die Zeit ist abgelaufen!',
        en: db.getSetting('timeout_text_en')||'Time is up!',
        fr: db.getSetting('timeout_text_fr')||'Temps écoulé!',
        it: db.getSetting('timeout_text_it')||'Il tempo è scaduto!',
        es: db.getSetting('timeout_text_es')||'¡Se acabó el tiempo!'
      };
      io.to(`game_${game.id}`).emit('game_ended',{messages:langMsgs, message:msg});
      io.to(`gm_${game.id}`).emit('game_ended',{});
    }
  });
},1000);

// 72h cleanup
cron.schedule('0 * * * *', () => {
  const cutoff=Date.now()-72*60*60*1000;
  db.getOldGames(cutoff).forEach(game => {
    const dir=path.join(UPLOAD_DIR,game.id);
    if(fs.existsSync(dir)) fs.rmSync(dir,{recursive:true,force:true});
    db.deleteGame(game.id);
  });
  // Games opened but never started, after 5 h. GMs create these and walk away;
  // they pile up in the game list and used to be counted as played. The stats
  // row is dropped too — unlike the 72 h sweep above, which keeps stats
  // because those games really were played.
  const staleCutoff = Date.now() - STALE_WAITING_HOURS*60*60*1000;
  db.getNeverStartedGames(staleCutoff).forEach(game => {
    const dir=path.join(UPLOAD_DIR,game.id);
    if(fs.existsSync(dir)) fs.rmSync(dir,{recursive:true,force:true});
    try { db.dropGameStat(game.id); } catch(e){}
    db.deleteGame(game.id);
  });
  // Sweep abandoned draw sessions (master never closed) older than 6h.
  const drawCutoff = Date.now()-6*60*60*1000;
  for(const [token,s] of drawSessions){ if(s.createdAt < drawCutoff) drawSessions.delete(token); }
});

app.get('/gm*',        (req,res)=>res.sendFile(path.join(__dirname,'public','gm.html')));
app.get('/join*',      (req,res)=>res.sendFile(path.join(__dirname,'public','join.html')));
app.get('/play*',      (req,res)=>res.sendFile(path.join(__dirname,'public','play.html')));
app.get('/cityrush*',  (req,res)=>res.sendFile(path.join(__dirname,'public','cityrush.html')));
app.get('/draw*',      (req,res)=>res.sendFile(path.join(__dirname,'public','draw.html')));

// Turn Multer's file-size limit (200 MB, see `upload` above) into a clean 413
// the player app can explain ("video too large"), instead of a generic 500 that
// surfaces as an unhelpful "upload failed". A 45s 4K clip commonly exceeds it.
const MAX_UPLOAD_MB = 200;
// How long a game may sit on "waiting" (clock never started) before the hourly
// sweep removes it. Deliberately far shorter than the 72 h rule for played
// games: nothing of value is lost, since the game was never run.
const STALE_WAITING_HOURS = 5;
app.use((err, req, res, next) => {
  if(err && err.code === 'LIMIT_FILE_SIZE'){
    return res.status(413).json({ error:'File too large', code:'file_too_large', maxMb: MAX_UPLOAD_MB });
  }
  if(err && err.name === 'MulterError'){
    return res.status(400).json({ error: err.message, code:'upload_error' });
  }
  if(err){ console.error('Unhandled error:', err); return res.status(500).json({ error:'Server error' }); }
  next();
});

server.listen(PORT,'0.0.0.0',()=>{
  console.log(`\n🎮  MiSSiONS running on port ${PORT}`);
  console.log(`🖥️   Gamemaster: http://localhost:${PORT}/gm.html\n`);
});
