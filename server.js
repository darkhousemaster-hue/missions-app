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
const { exec }   = require('child_process');
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
  db.setSetting(`qr_template_${size}`, relPath);
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
  const { exec } = require('child_process');
  const appDir = __dirname;
  const log = [];
  const run = (cmd) => new Promise((resolve) => {
    exec(cmd, {cwd: appDir}, (err, stdout, stderr) => {
      log.push(`$ ${cmd}`);
      if (stdout) log.push(stdout.trim());
      if (stderr) log.push(stderr.trim());
      resolve(!err);
    });
  });
  log.push('Starting update...');
  const gitOk = await run('git pull origin main');
  if (!gitOk) { return res.json({success:false, log:log.join('\n')}); }
  await run('npm install --production');
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
  const {timer_default:_ctd, ...locCreateData} = d; res.json({id:db.createLocation(locCreateData),success:true});
});
app.put('/api/locations/:id', (req,res) => {
  const {password,...d}=req.body;
  if(!db.verifyPassword(password)) return res.status(401).json({error:'Unauthorized'});
  const {timer_default:_td, ...locData} = d; db.updateLocation(req.params.id,locData); res.json({success:true});
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
app.get('/api/games', (req,res) => res.json(db.getGames(req.query.location_id)));
app.get('/api/games/:id', (req,res) => { const g=db.getGameFull(req.params.id); g?res.json(g):res.status(404).json({error:'Not found'}); });

app.post('/api/games', (req,res) => {
  const {location_id,mode_id} = req.body;
  const lock = `${location_id}_${mode_id||1}`;
  if(creatingLocks.has(lock)) return res.status(429).json({error:'Already creating'});
  creatingLocks.add(lock); setTimeout(()=>creatingLocks.delete(lock),3000);
  const location = db.getLocation(location_id);
  if(!location){ creatingLocks.delete(lock); return res.status(404).json({error:'Location not found'}); }
  const mode       = db.getMode(mode_id||1);
  const missionIds = db.selectMissions(location, mode_id||1);
  const gameId     = uuidv4().slice(0,8).toUpperCase();
  const timerSecs  = ((mode && mode.timer_default) || location.timer_default || 60) * 60;
  db.createGame({id:gameId, location_id, mode_id:mode_id||1, timer_duration:timerSecs, missions:missionIds});
  creatingLocks.delete(lock);
  const publicUrl = db.getSetting('public_url')||`http://localhost:${PORT}`;
  const joinUrl   = `${publicUrl}/join.html?game=${gameId}`;
  QRCode.toDataURL(joinUrl,{errorCorrectionLevel:'H',width:400,margin:2},(err,qr)=>{
    if(err) return res.status(500).json({error:'QR failed'});
    res.json({id:gameId, joinUrl, qrCode:qr, timerDuration:timerSecs, missionCount:missionIds.length});
  });
});

app.delete('/api/games/:id', (req,res) => {
  if(!db.verifyPassword(req.body.password)) return res.status(401).json({error:'Unauthorized'});
  const dir=path.join(UPLOAD_DIR,req.params.id);
  if(fs.existsSync(dir)) fs.rmSync(dir,{recursive:true,force:true});
  db.deleteGame(req.params.id); res.json({success:true});
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
app.post('/api/games/:gameId/teams/:teamId/missions/:missionId/upload',
  upload.single('media'), (req,res) => {
    const {gameId,teamId,missionId}=req.params;
    if(!req.file) return res.status(400).json({error:'No file'});
    const mediaPath=`${gameId}/${req.file.filename}`;
    db.submitMission({teamId:Number(teamId),missionId:Number(missionId),mediaPath});
    const sub=db.getSubmission(Number(teamId),Number(missionId));
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
  const {action}=req.body;
  const game=db.getGame(req.params.gameId);
  if(!game) return res.status(404).json({error:'Not found'});
  const now=Date.now();
  if(action==='start' && !game.timer_running) {
    db.updateGame(req.params.gameId,{timer_started_at: now-(game.timer_paused_elapsed||0), timer_running:1});
  } else if(action==='pause' && game.timer_running && game.timer_started_at) {
    db.updateGame(req.params.gameId,{timer_paused_elapsed: now-game.timer_started_at, timer_running:0});
  }
  const updated=db.getGame(req.params.gameId);
  const state=getTimerState(updated);
  io.to(`game_${req.params.gameId}`).emit('timer_state',state);
  io.to(`gm_${req.params.gameId}`).emit('timer_state',state);
  res.json({success:true,state});
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

app.get('/gm*',   (req,res)=>res.sendFile(path.join(__dirname,'public','gm.html')));
app.get('/join*', (req,res)=>res.sendFile(path.join(__dirname,'public','join.html')));
app.get('/play*', (req,res)=>res.sendFile(path.join(__dirname,'public','play.html')));

server.listen(PORT,'0.0.0.0',()=>{
  console.log(`\n🎮  MiSSiONS running on port ${PORT}`);
  console.log(`🖥️   Gamemaster: http://localhost:${PORT}/gm.html\n`);
});
