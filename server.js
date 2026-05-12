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

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const PORT   = process.env.PORT || 3001;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req,file,cb) => { const d=path.join(UPLOAD_DIR,req.params.gameId||'misc'); fs.mkdirSync(d,{recursive:true}); cb(null,d); },
  filename: (req,file,cb) => { const ext=path.extname(file.originalname).toLowerCase()||(file.mimetype.includes('video')?'.mp4':'.jpg'); cb(null,`${uuidv4()}${ext}`); }
});
const upload       = multer({ storage, limits: { fileSize: 200*1024*1024 } });
const uploadSingle = multer({ dest: path.join(UPLOAD_DIR,'templates'), limits: { fileSize: 20*1024*1024 } });

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname,'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

function getTimerState(game) {
  const now = Date.now();
  // Ended games show 0
  if (game.status === 'ended') return { remaining: 0, running: false, total: game.timer_duration };
  const elapsed = game.timer_running && game.timer_started_at
    ? now - game.timer_started_at : (game.timer_paused_elapsed||0);
  return { remaining: Math.max(0,Math.floor((game.timer_duration*1000 - elapsed)/1000)), running:!!game.timer_running, total:game.timer_duration };
}

// ── Settings ──────────────────────────────────────────────────────────────────
app.get('/api/setup-status', (req,res) => res.json({isSetup:true}));
app.post('/api/setup',       (req,res) => res.json({success:true}));
app.post('/api/settings/verify', (req,res) => res.json({valid:db.verifyPassword(req.body.password)}));
app.post('/api/settings/change-password', (req,res) => res.json({success:db.changePassword(req.body.oldPassword,req.body.newPassword)}));
app.get('/api/settings',  (req,res) => res.json(db.getSettings()));
app.put('/api/settings',  (req,res) => {
  const {password,...s} = req.body;
  if(!db.verifyPassword(password)) return res.status(401).json({error:'Unauthorized'});
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
  if (!db.verifyPassword(password)) return res.status(401).json({error:'Unauthorized'});
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
  const npm = await run(npmCmd, npmArgs, {timeout: 20 * 60 * 1000});
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

// ── Modes ─────────────────────────────────────────────────────────────────────
app.get('/api/modes', (req,res) => res.json(db.getModes()));
app.post('/api/modes', (req,res) => {
  if(!db.verifyPassword(req.body.password)) return res.status(401).json({error:'Unauthorized'});
  const id = db.createMode(req.body.name, req.body.ruleset_id||1, req.body.timer_default||60);
  res.json({id,success:true});
});
app.put('/api/modes/:id', (req,res) => {
  if(!db.verifyPassword(req.body.password)) return res.status(401).json({error:'Unauthorized'});
  try { db.updateMode(req.params.id, req.body); res.json({success:true}); }
  catch(e) { res.status(400).json({error:e.message}); }
});
app.delete('/api/modes/:id', (req,res) => {
  if(!db.verifyPassword(req.body.password)) return res.status(401).json({error:'Unauthorized'});
  try { db.deleteMode(req.params.id); res.json({success:true}); }
  catch(e) { res.status(400).json({error:e.message}); }
});

// ── Rulesets ─────────────────────────────────────────────────────────────────
app.get('/api/rulesets', (req,res) => res.json(db.getRulesets()));
app.post('/api/rulesets', (req,res) => {
  if(!db.verifyPassword(req.body.password)) return res.status(401).json({error:'Unauthorized'});
  const id = db.createRuleset(req.body.name, req.body.rules_list||'[]');
  res.json({id,success:true});
});
app.put('/api/rulesets/:id', (req,res) => {
  if(!db.verifyPassword(req.body.password)) return res.status(401).json({error:'Unauthorized'});
  db.updateRuleset(req.params.id, {name:req.body.name, rules_list:req.body.rules_list||'[]'});
  res.json({success:true});
});
app.delete('/api/rulesets/:id', (req,res) => {
  if(!db.verifyPassword(req.body.password)) return res.status(401).json({error:'Unauthorized'});
  try { db.deleteRuleset(req.params.id); res.json({success:true}); }
  catch(e) { res.status(400).json({error:e.message}); }
});

// ── Locations ─────────────────────────────────────────────────────────────────
app.get('/api/locations', (req,res) => res.json(db.getLocations()));
app.post('/api/locations', (req,res) => {
  const {password,...d}=req.body;
  if(!db.verifyPassword(password)) return res.status(401).json({error:'Unauthorized'});
  const {timer_default:_ctd, ...locCreateData} = d; locCreateData.allow_photo=d.allow_photo!==undefined?d.allow_photo:1; locCreateData.allow_video=d.allow_video!==undefined?d.allow_video:1; locCreateData.allow_indoor=d.allow_indoor!==undefined?d.allow_indoor:1; res.json({id:db.createLocation(locCreateData),success:true});
});
app.put('/api/locations/:id', (req,res) => {
  const {password,...d}=req.body;
  if(!db.verifyPassword(password)) return res.status(401).json({error:'Unauthorized'});
  const {timer_default:_td, ...locData} = d; locData.allow_photo=d.allow_photo!==undefined?d.allow_photo:1; locData.allow_video=d.allow_video!==undefined?d.allow_video:1; locData.allow_indoor=d.allow_indoor!==undefined?d.allow_indoor:1; db.updateLocation(req.params.id,locData); res.json({success:true});
});
app.delete('/api/locations/:id', (req,res) => {
  if(!db.verifyPassword(req.body.password)) return res.status(401).json({error:'Unauthorized'});
  db.deleteLocation(req.params.id); res.json({success:true});
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
  if(!db.verifyPassword(password)) return res.status(401).json({error:'Unauthorized'});
  const newId=db.createMission(d); io.emit('settings_updated',{type:'missions'}); res.json({id:newId,success:true});
});
app.put('/api/missions/:id', (req,res) => {
  const {password,...d}=req.body;
  if(!db.verifyPassword(password)) return res.status(401).json({error:'Unauthorized'});
  db.updateMission(req.params.id,d); io.emit('settings_updated',{type:'missions'}); res.json({success:true});
});
app.delete('/api/missions/:id', (req,res) => {
  if(!db.verifyPassword(req.body.password)) return res.status(401).json({error:'Unauthorized'});
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
  creatingLocks.delete(lockKey);
  const publicUrl = db.getSetting('public_url')||`http://localhost:${PORT}`;
  const joinUrl   = `${publicUrl}/join.html?game=${gameId}`;
  QRCode.toDataURL(joinUrl,{errorCorrectionLevel:'H',width:400,margin:2},(err,qr)=>{
    if(err) return res.status(500).json({error:'QR failed'});
    res.json({id:gameId, joinUrl, qrCode:qr, timerDuration:timerSecs, missionCount:missionIds.length});
  });
});

app.delete('/api/games/:id', (req,res) => {
  if(!db.verifyPassword(req.body.password)) return res.status(401).json({error:'Unauthorized'});
  try {
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

// ── Teams ─────────────────────────────────────────────────────────────────────
app.post('/api/games/:gameId/teams', (req,res) => {
  const game=db.getGame(req.params.gameId);
  if(!game) return res.status(404).json({error:'Game not found'});
  if(game.status==='ended') return res.status(400).json({error:'Game has ended'});
  // Check for duplicate team name
  const existingTeams=db.getTeams(req.params.gameId);
  const nameTaken=existingTeams.some(t=>t.name.toLowerCase()===req.body.name.toLowerCase());
  if(nameTaken) return res.status(400).json({error:'Team name already taken. Please choose a different name.'});
  const teamId=db.createTeam({game_id:req.params.gameId, name:req.body.name});
  const team=db.getTeam(teamId);
  io.to(`gm_${req.params.gameId}`).emit('team_joined',team);
  res.json(team);
});
app.get('/api/games/:gameId/teams/:teamId', (req,res) => {
  const team=db.getTeam(req.params.teamId);
  if(!team) return res.status(404).json({error:'Not found'});
  res.json({...team, missions:db.getTeamMissions(req.params.teamId)});
});
app.get('/api/games/:gameId/rankings', (req,res) => res.json(db.getRankings(req.params.gameId)));

// ── Upload ────────────────────────────────────────────────────────────────────
app.post('/api/games/:gameId/media/upload',
  upload.single('media'), (req,res) => {
    if(!req.file) return res.status(400).json({error:'No file'});
    res.json({success:true, mediaPath:`${req.params.gameId}/${req.file.filename}`});
  }
);

app.post('/api/games/:gameId/teams/:teamId/missions/:missionId/upload',
  upload.single('media'), (req,res) => {
    const {gameId,teamId,missionId}=req.params;
    if(!req.file) return res.status(400).json({error:'No file'});
    const mediaPath=`${gameId}/${req.file.filename}`;
    db.submitMission({teamId:Number(teamId),missionId:Number(missionId),mediaPath});
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
  }
  io.to(`gm_${gameId}`).emit('submission_reviewed',{submissionId:sub.id,action,teamId:sub.team_id,missionId:sub.mission_id});
  io.to(`gm_${gameId}`).emit('rankings_update',db.getRankings(gameId));
  res.json({success:true});
});

// ── Game rules (for player) ────────────────────────────────────────────────────
app.get('/api/games/:id/rules', (req,res) => {
  const rules = db.getGameRules(req.params.id);
  res.json(rules);
});

// ── Chat ──────────────────────────────────────────────────────────────────────
app.post('/api/games/:gameId/chat', (req,res) => {
  const {teamId,content,fromGm}=req.body;
  const msgId=db.saveMessage({gameId:req.params.gameId,teamId:teamId||null,content,fromGm});
  const msg={id:msgId,content,fromGm,teamId:teamId||null,gameId:req.params.gameId,timestamp:Date.now()};
  if(teamId) io.to(`team_${teamId}`).emit('chat_message',msg);
  else io.to(`game_${req.params.gameId}`).emit('chat_message',msg);
  io.to(`gm_${req.params.gameId}`).emit('chat_message',msg);
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
  } else if(action==='pause' && game.timer_running && game.timer_started_at) {
    db.updateGame(req.params.gameId,{timer_paused_elapsed: now-game.timer_started_at, timer_running:0});
  } else if(action==='adjust' && typeof seconds==='number') {
    // Add or subtract seconds from the total duration
    const newDuration = Math.max(10, (game.timer_duration||3600) + seconds);
    db.updateGame(req.params.gameId,{timer_duration: newDuration});
    // If running, also adjust started_at so remaining time changes immediately
    if(game.timer_running && game.timer_started_at) {
      // Extending: move started_at further back (more time remaining)
      // Subtracting: move started_at forward (less time remaining)
      db.updateGame(req.params.gameId,{timer_started_at: game.timer_started_at - seconds*1000});
    }
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
  if(!db.verifyPassword(req.body.password)) return res.status(401).json({error:'Unauthorized'});
  const imagePath = _moveHintFileIntoPlace(req);
  const id = db.createCrHint({
    mission_id: req.params.missionId,
    order_index: req.body.order_index||0,
    text_de: req.body.text_de||'', text_en: req.body.text_en||'',
    text_fr: req.body.text_fr||'', text_it: req.body.text_it||'',
    image_path: imagePath,
    hint_type: req.body.hint_type === 'gps' ? 'gps' : 'answer',
  });
  res.json({id, success:true});
});

app.put('/api/cr/hints/:id', upload.single('image'), (req,res) => {
  if(!db.verifyPassword(req.body.password)) return res.status(401).json({error:'Unauthorized'});
  const existing = db.getCrHint(req.params.id);
  if(!existing) return res.status(404).json({error:'Not found'});
  const newPath  = _moveHintFileIntoPlace(req);
  const imagePath = newPath || (req.body.clear_image==='1' ? null : existing.image_path);
  db.updateCrHint(req.params.id, {
    order_index: req.body.order_index||0,
    text_de: req.body.text_de||'', text_en: req.body.text_en||'',
    text_fr: req.body.text_fr||'', text_it: req.body.text_it||'',
    image_path: imagePath,
    hint_type: req.body.hint_type === 'gps' ? 'gps' : 'answer',
  });
  res.json({success:true});
});

app.delete('/api/cr/hints/:id', (req,res) => {
  if(!db.verifyPassword(req.body.password)) return res.status(401).json({error:'Unauthorized'});
  db.deleteCrHint(req.params.id);
  res.json({success:true});
});

app.post('/api/cr/hints/reorder/:missionId', (req,res) => {
  if(!db.verifyPassword(req.body.password)) return res.status(401).json({error:'Unauthorized'});
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
  const {teamId, missionId, answer} = req.body;
  const mission = db.getCrMission(missionId);
  if(!mission) return res.status(404).json({error:'Not found'});
  // Flexible matching: case-insensitive, trim whitespace
  const correctAnswers = ['answer_de','answer_en','answer_fr','answer_it']
    .map(f => (mission[f]||'').trim().toLowerCase())
    .filter(Boolean);
  const userAnswer = (answer||'').trim().toLowerCase();
  const correct = correctAnswers.some(a => a === userAnswer || a.includes(userAnswer) || userAnswer.includes(a));
  res.json({correct, message: correct ? 'Richtig!' : 'Leider falsch. Versuche es erneut!'});
});


// ════════════════════════════════════════════════════════════
//   CITYRUSH ROUTES
// ════════════════════════════════════════════════════════════

// ── CR Modes ──────────────────────────────────────────────────────────────────
app.get('/api/cr/modes', (req,res) => res.json(db.getCrModes()));
app.post('/api/cr/modes', (req,res) => {
  if(!db.verifyPassword(req.body.password)) return res.status(401).json({error:'Unauthorized'});
  const {name, allow_photo, allow_video, ruleset_id, timer_default} = req.body;
  const id = db.createCrMode({name, allow_photo, allow_video, ruleset_id, timer_default});
  res.json({id, success:true});
});
app.put('/api/cr/modes/:id', (req,res) => {
  if(!db.verifyPassword(req.body.password)) return res.status(401).json({error:'Unauthorized'});
  const {name, allow_photo, allow_video, ruleset_id, timer_default} = req.body;
  db.updateCrMode(req.params.id, {name, allow_photo, allow_video, ruleset_id, timer_default});
  res.json({success:true});
});
app.delete('/api/cr/modes/:id', (req,res) => {
  if(!db.verifyPassword(req.body.password)) return res.status(401).json({error:'Unauthorized'});
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
  if(!db.verifyPassword(password)) return res.status(401).json({error:'Unauthorized'});
  const id = db.createCrMission(data);
  io.emit('settings_updated', {type:'cr_missions'});
  res.json({id, success:true});
});
app.put('/api/cr/missions/:id', (req,res) => {
  const {password,...data} = req.body;
  if(!db.verifyPassword(password)) return res.status(401).json({error:'Unauthorized'});
  db.updateCrMission(req.params.id, data);
  io.emit('settings_updated', {type:'cr_missions'});
  res.json({success:true});
});
app.delete('/api/cr/missions/:id', (req,res) => {
  if(!db.verifyPassword(req.body.password)) return res.status(401).json({error:'Unauthorized'});
  try {
    db.deleteCrMission(req.params.id);
    io.emit('settings_updated', {type:'cr_missions'});
    res.json({success:true});
  } catch(e) {
    res.status(500).json({error:'Delete failed: '+e.message});
  }
});
app.post('/api/cr/missions/reorder', (req,res) => {
  if(!db.verifyPassword(req.body.password)) return res.status(401).json({error:'Unauthorized'});
  db.reorderCrMissions(req.body.mode_id, req.body.order);
  res.json({success:true});
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
  const specialProgress = db.listCrSpecialProgressForGame(req.params.id);
  res.json({active:true, crMode, missions: missionsWithHints, progress, gps, captures, submissions, arrivals, specialProgress});
});

// Pending review counts per team (regular + CR), so the dashboard's
// notification dot can show a number that only zeroes out when the queue
// is fully cleared.
app.get('/api/games/:id/pending-counts', (req,res) => {
  res.json(db.getPendingCountsByTeam(req.params.id));
});

// ── GPS updates ───────────────────────────────────────────────────────────────
app.post('/api/games/:gameId/gps', (req,res) => {
  const {teamId, lat, lng} = req.body;
  if(!teamId||lat===undefined||lng===undefined) return res.status(400).json({error:'Missing params'});
  db.updateTeamGps(req.params.gameId, teamId, lat, lng);
  // Broadcast to GM and all players in the game
  io.to(`game_${req.params.gameId}`).emit('gps_update', {teamId, lat, lng, ts: Date.now()});
  io.to(`gm_${req.params.gameId}`).emit('gps_update', {teamId, lat, lng, ts: Date.now()});
  res.json({success:true});
});

// ── CR Team progress ──────────────────────────────────────────────────────────
app.get('/api/games/:gameId/cr/progress/:teamId', (req,res) => {
  const prog = db.getCrProgress(req.params.gameId, req.params.teamId);
  const crMode = db.getGameCrMode(req.params.gameId);
  if(!crMode) return res.json({active:false});
  // mission_index tracks the linear sequence only — special missions are
  // parallel and don't move the counter.
  const linear  = db.getLinearCrMissions(crMode.id);
  const special = db.getSpecialCrMissions(crMode.id);
  if(!prog && linear.length > 0) {
    db.initCrProgress(req.params.gameId, req.params.teamId, linear[0].id);
  }
  const progress = db.getCrProgress(req.params.gameId, req.params.teamId) || {mission_index:0};
  const currentMission = linear[progress.mission_index] || null;
  res.json({
    active:true, progress, currentMission,
    totalMissions: linear.length,
    specialMissions: special,
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
  const {teamId, missionId, mediaPath} = req.body;
  const gameId = req.params.gameId;
  const crMode = db.getGameCrMode(gameId);
  if(!crMode) return res.status(400).json({error:'No CityRush mode'});
  // Linear sequence only — special missions are completed via their own route.
  const missions = db.getLinearCrMissions(crMode.id);
  const prog = db.getCrProgress(gameId, teamId);
  if(!prog) return res.status(404).json({error:'No progress found'});
  const mission = missions[prog.mission_index];
  if(!mission) return res.status(400).json({error:'No current mission'});

  // Branch: media-bearing missions need GM approval. Don't advance yet.
  if(mediaPath) {
    const subId = db.createCrSubmission(gameId, teamId, mission.id, mediaPath);
    db.updateCrProgress(gameId, teamId, {
      media_path: mediaPath,
      media_status: 'pending',
    });
    io.to(`gm_${gameId}`).emit('cr_submission_new', {
      submissionId: subId, teamId, missionId: mission.id, missionIndex: prog.mission_index, mediaPath,
    });
    return res.json({success:true, pending:true});
  }

  // Otherwise (answer or no-media completion): advance immediately.
  const score = scoreForCrMission(mission, prog);
  const result = advanceCrTeam(gameId, teamId, mission, prog.mission_index, score) || {};
  res.json({success:true, score, nextMission: result.nextMission||null, nextIndex: result.nextIndex||null});
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
    db.acceptCrSubmission(sub.id);
    if(mission.is_special){
      // Specials don't advance the linear progress — just award points and
      // bump the completed counter.
      const score = mission.points || 0;
      db.addTeamScore(sub.team_id, score);
      const prog = db.getCrSpecialProgress(sub.game_id, sub.team_id, mission.id) || {};
      db.upsertCrSpecialProgress(sub.game_id, sub.team_id, mission.id, {
        completed_count: (prog.completed_count||0) + 1,
      });
      io.to(`gm_${sub.game_id}`).emit('rankings_update', db.getRankings(sub.game_id));
    } else {
      const prog = db.getCrProgress(sub.game_id, sub.team_id) || {};
      const score = scoreForCrMission(mission, prog);
      advanceCrTeam(sub.game_id, sub.team_id, mission, idx, score);
    }
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
      db.updateCrProgress(sub.game_id, sub.team_id, {media_path:null, media_status:'rejected'});
    }
    io.to(`team_${sub.team_id}`).emit('cr_submission_reviewed', {missionId: mission.id, accepted:false, message});
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
  const {teamId, lat, lng, accuracy} = req.body;
  const latN = Number(lat);
  const lngN = Number(lng);
  if(!Number.isFinite(latN) || !Number.isFinite(lngN)) return res.json({arrived:false});
  const prog = db.getCrProgress(req.params.gameId, teamId);
  if(!prog) return res.json({arrived:false});
  const crMode = db.getGameCrMode(req.params.gameId);
  if(!crMode) return res.json({arrived:false});
  const missions = db.getCrMissions(crMode.id);
  // Linear missions only — special missions don't use GPS gating.
  const linear = missions.filter(m => !m.is_special);
  const mission = linear[prog.mission_index];
  if(!mission || !mission.use_gps || !mission.lat || !mission.lng) return res.json({arrived:false});

  // Sticky: if any team member already arrived, report arrived without
  // re-running the geofence.
  if(db.hasCrArrival(req.params.gameId, teamId, mission.id)){
    io.to(`team_${teamId}`).emit('cr_arrived', {missionId: mission.id, distance: 0, sticky:true});
    return res.json({arrived:true, distance:0, sticky:true});
  }

  // Haversine distance, with a GPS-accuracy slack (15-30m phone error is
  // typical and would otherwise reject a player visibly on the target).
  const R = 6371000;
  const missionLat = Number(mission.lat);
  const missionLng = Number(mission.lng);
  if(!Number.isFinite(missionLat) || !Number.isFinite(missionLng)) return res.json({arrived:false});
  const dLat = (missionLat - latN) * Math.PI / 180;
  const dLng = (missionLng - lngN) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(latN*Math.PI/180)*Math.cos(missionLat*Math.PI/180)*Math.sin(dLng/2)**2;
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const slack  = Math.min(Math.max(Number(accuracy)||10, 10), 75) + 5;
  const radius = mission.radius_meters || 30;
  const arrived = dist <= radius + slack;
  if(arrived) {
    db.recordCrArrival(req.params.gameId, teamId, mission.id);
    io.to(`team_${teamId}`).emit('cr_arrived', {missionId: mission.id, distance: Math.round(dist)});
  }
  res.json({arrived, distance: Math.round(dist)});
});

// Skip current CR mission — forfeits its points, advances the team.
app.post('/api/games/:gameId/cr/skip', (req,res) => {
  const {teamId} = req.body;
  const crMode = db.getGameCrMode(req.params.gameId);
  if(!crMode) return res.status(400).json({error:'No CityRush mode'});
  const linear = db.getLinearCrMissions(crMode.id);
  const prog = db.getCrProgress(req.params.gameId, teamId);
  if(!prog) return res.status(404).json({error:'No progress found'});
  const mission = linear[prog.mission_index];
  if(!mission) return res.status(400).json({error:'No current mission'});
  // Award 0 points but advance the same way an accept does.
  const result = advanceCrTeam(req.params.gameId, teamId, mission, prog.mission_index, 0) || {};
  res.json({success:true, score:0, nextMission: result.nextMission||null, nextIndex: result.nextIndex||null});
});

// Special-mission completion. Independent of the linear progress; obeys its
// own cooldown. Photo/video specials still go through GM review.
app.post('/api/games/:gameId/cr/special/complete', (req,res) => {
  const {teamId, missionId, mediaPath} = req.body;
  const gameId = req.params.gameId;
  const mission = db.getCrMission(missionId);
  if(!mission || !mission.is_special) return res.status(400).json({error:'Not a special mission'});
  const prog = db.getCrSpecialProgress(gameId, teamId, missionId);
  const now = Date.now();
  // Enforce cooldown server-side too.
  if(prog && prog.last_attempt && mission.repeat_minutes > 0){
    const elapsedMs = now - prog.last_attempt;
    const cooldownMs = mission.repeat_minutes * 60 * 1000;
    if(elapsedMs < cooldownMs){
      const wait = Math.ceil((cooldownMs - elapsedMs)/1000);
      return res.status(429).json({error:'Cooldown', waitSeconds: wait});
    }
  }
  // Media branch → pending GM review (no instant award).
  if(mediaPath){
    const subId = db.createCrSubmission(gameId, teamId, mission.id, mediaPath);
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
});

// Timer broadcast
setInterval(() => {
  db.getRunningGames().forEach(game => {
    const state=getTimerState(game);
    io.to(`game_${game.id}`).emit('timer_update',state);
    io.to(`gm_${game.id}`).emit('timer_update',state);
    if(state.remaining<=0) {
      db.updateGame(game.id,{timer_running:0,status:'ended'});
      // Pick timeout message for the game's language (fallback chain)
      const lang_key = 'timeout_text'; // base key
      const msg = db.getSetting('timeout_text_de') || db.getSetting('timeout_text') || 'Die Zeit ist abgelaufen!';
      const langMsgs = {
        de: db.getSetting('timeout_text_de')||db.getSetting('timeout_text')||'Die Zeit ist abgelaufen!',
        en: db.getSetting('timeout_text_en')||'Time is up!',
        fr: db.getSetting('timeout_text_fr')||'Temps écoulé!',
        it: db.getSetting('timeout_text_it')||'Il tempo è scaduto!'
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
});

app.get('/gm*',        (req,res)=>res.sendFile(path.join(__dirname,'public','gm.html')));
app.get('/join*',      (req,res)=>res.sendFile(path.join(__dirname,'public','join.html')));
app.get('/play*',      (req,res)=>res.sendFile(path.join(__dirname,'public','play.html')));
app.get('/cityrush*',  (req,res)=>res.sendFile(path.join(__dirname,'public','cityrush.html')));

server.listen(PORT,'0.0.0.0',()=>{
  console.log(`\n🎮  MiSSiONS running on port ${PORT}`);
  console.log(`🖥️   Gamemaster: http://localhost:${PORT}/gm.html\n`);
});
