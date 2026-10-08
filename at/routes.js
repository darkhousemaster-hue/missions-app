// AdventureTrail HTTP surface. Everything lives under /api/at.
//
// Exported as a factory so the module receives what it needs from server.js
// instead of reaching into it. The dependency points one way only: nothing in
// MiSSiONS imports from here.
const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const at = require('./db.js');
const QRCode = require('qrcode');

module.exports = function createAtRouter({ upload, UPLOAD_DIR, isGmAuthed }) {
  const r = express.Router();
  const AT_UPLOAD_DIR = path.join(UPLOAD_DIR, 'at');

  const gm = (req, res, next) => isGmAuthed(req) ? next()
    : res.status(401).json({ error: 'Unauthorized' });

  // ── Geometry ───────────────────────────────────────────────────────────────
  function metresBetween(aLat, aLng, bLat, bLng) {
    const R = 6371000, rad = d => d * Math.PI / 180;
    const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  // ── Graph ──────────────────────────────────────────────────────────────────
  // A node opens when ANY incoming edge comes from a finished node, which is
  // what a converging ending needs. A node with no incoming edges is a root.
  // Edges tagged with a branch_key only count for a run on that branch.
  function computeOpen(nodes, edges, progress, branchKey) {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const doneIds = new Set(progress.filter(p => p.status !== 'open').map(p => p.node_id));
    const incoming = new Map(nodes.map(n => [n.id, []]));
    for (const e of edges) {
      if (!incoming.has(e.to_node)) continue;
      if (e.branch_key && e.branch_key !== branchKey) continue;
      incoming.get(e.to_node).push(e);
    }
    const open = [];
    for (const n of nodes) {
      if (doneIds.has(n.id)) continue;
      const inc = incoming.get(n.id) || [];
      if (!inc.length) { if (!edges.some(e => e.to_node === n.id)) open.push(n.id); continue; }
      if (inc.some(e => doneIds.has(e.from_node))) open.push(n.id);
    }
    return { open: new Set(open), done: doneIds, byId };
  }

  // A Peilung owns no coordinates. It aims at the first node downstream that
  // has some, so moving a station automatically moves every bearing leading to
  // it and there is nothing to keep in sync by hand.
  function navTarget(node, nodes, edges, branchKey) {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const seen = new Set([node.id]);
    let frontier = [node.id];
    for (let depth = 0; depth < 12 && frontier.length; depth++) {
      const next = [];
      for (const id of frontier) {
        for (const e of edges) {
          if (e.from_node !== id || seen.has(e.to_node)) continue;
          if (e.branch_key && branchKey && e.branch_key !== branchKey) continue;
          seen.add(e.to_node);
          const t = byId.get(e.to_node);
          if (t && t.lat != null && t.lng != null) return t;
          next.push(e.to_node);
        }
      }
      frontier = next;
    }
    return null;
  }

  // The same rule as the renderer's: a design counts once anything about it
  // differs from a plain page, a colour or a hidden top bar included.
  const hasDesign = d => !!(d && typeof d === 'object' && ((Array.isArray(d.layers) && d.layers.length)
    || (d.page && (d.page.image || d.page.chrome === false || (d.page.bg && d.page.bg !== '#0B0F1A')))));

  // ── Player payload ─────────────────────────────────────────────────────────
  // Everything the player app is allowed to know. Answers, post codes and
  // unreleased hints never leave the server: the quiz leak we fixed in Rail
  // Adventure came from exactly this kind of payload.
  function playerView(run) {
    const trail = at.getTrail(run.trail_id);
    if (!trail) return null;
    const nodes = at.listNodes(trail.id);
    const edges = at.listEdges(trail.id);
    const progress = at.listProgress(run.id);
    const progByNode = new Map(progress.map(p => [p.node_id, p]));
    const { open, done } = computeOpen(nodes, edges, progress, run.branch_key);
    // A part's clock starts the first time it is in play. The hint ladder and
    // the skip offer both run on it. It used to wait for the player app to call
    // /open, which it never did, so only the first part ever had a clock: later
    // hints never released and "skip after N minutes" never came.
    for (const id of open) {
      const p = progByNode.get(id);
      if (!p || !p.opened_at) progByNode.set(id, at.openNode(run.id, id));
    }
    const lang = run.lang || 'de';
    const now = Date.now();

    const visible = nodes.filter(n => open.has(n.id) || done.has(n.id));
    const coordsFor = n => {
      if (n.kind === 'nav') {
        const t = navTarget(n, nodes, edges, run.branch_key);
        return t ? { lat: t.lat, lng: t.lng } : null;
      }
      if (n.trigger_kind === 'gps' && n.lat != null) return { lat: n.lat, lng: n.lng };
      return null;
    };
    return {
      run: {
        id: run.id, team_name: run.team_name, join_code: run.join_code,
        lang, branch_key: run.branch_key,
        started_at: run.started_at, finished_at: run.finished_at,
      },
      trail: {
        id: trail.id, name: trail.name, city: trail.city,
        langs: trail.langs, intro: trail.intro, theme: trail.theme,
        video_path: trail.video_path,
      },
      total: nodes.length,
      done: done.size,
      nodes: visible.map(n => {
        const p = progByNode.get(n.id);
        const isDone = done.has(n.id);
        const openedAt = p && p.opened_at;
        const minutesHere = openedAt ? (now - openedAt) / 60000 : 0;
        // Only hints whose clock has run are sent at all.
        const hints = at.listHints(n.id)
          .filter(h => minutesHere >= (h.after_minutes || 0))
          .map(h => ({ text: at.pick(h.text, lang), resolves: !!h.resolves }));
        const nextHintIn = at.listHints(n.id)
          .map(h => (h.after_minutes || 0) - minutesHere)
          .filter(m => m > 0).sort((a, b) => a - b)[0];
        const assets = at.listAssets(n.id).filter(a => {
          const w = a.appear_when || {};
          if (w.on === 'solve') return isDone;
          if (w.on === 'delay') return minutesHere >= (Number(w.minutes) || 0);
          return true;
        }).map(a => ({
          id: a.id, kind: a.kind, path: ['page', 'model', 'ar'].includes(a.kind) ? '' : a.path, title: a.title, preload: !!a.preload,
          ios: a.kind === 'model' ? !!(a.meta && a.meta.usdz) : undefined,
          ref: ['link', 'phone', 'email'].includes(a.kind) ? a.ref : undefined,
          body: a.kind === 'note' ? at.pick(a.body, lang) : undefined,
          look: a.kind === 'note' ? (a.meta && a.meta.look) || 'letter' : undefined,
          subject: a.kind === 'email' ? (a.meta && a.meta.subject) || '' : undefined,
          shown: a.kind === 'page' ? (a.meta && a.meta.display_url) || '' : undefined,
          name: a.kind === 'file' ? (a.meta && a.meta.name) || '' : undefined,
          size: a.kind === 'file' ? (a.meta && a.meta.size) || 0 : undefined,
          ar: a.kind === 'ar' ? arView(a) : undefined,
        }));

        return {
          id: n.id, kind: n.kind, status: isDone ? (p && p.status) || 'done' : 'open',
          title: at.pick(n.title, lang),
          task: at.pick(n.task, lang),
          arrive: isDone ? at.pick(n.arrive, lang) : '',
          depart: isDone ? at.pick(n.depart, lang) : '',
          trigger_kind: n.trigger_kind,
          story_media: n.story_media || 'text',
          design: hasDesign(n.design) ? n.design : null,
          story_media_path: n.story_media_path || null,
          nav_mode: n.nav_mode,
          // Coordinates only go out when the node actually uses them, and only
          // for a node already in play. Otherwise the whole route leaks.
          lat: coordsFor(n) ? coordsFor(n).lat : null,
          lng: coordsFor(n) ? coordsFor(n).lng : null,
          radius_m: n.radius_m,
          style: n.style,
          points: n.points,
          hints,
          hints_total: at.listHints(n.id).length,
          next_hint_in_min: nextHintIn === undefined ? null : Math.ceil(nextHintIn),
          can_skip: !!(n.skip_after_min && minutesHere >= n.skip_after_min),
          assets,
          choices: n.kind === 'gate'
            ? edges.filter(e => e.from_node === n.id)
                   .map(e => ({ to: e.to_node, label: at.pick(e.label, lang), branch_key: e.branch_key }))
            : [],
        };
      }),
    };
  }

  function requireRun(req, res) {
    const run = at.getRun(req.params.runId);
    if (!run) { res.status(404).json({ error: 'unknown_run' }); return null; }
    return run;
  }

  // ════════════════════════════ PLAYER ══════════════════════════════════════
  r.post('/api/at/redeem', (req, res) => {
    const out = at.redeemKey(req.body.code, {
      teamName: req.body.teamName, lang: req.body.lang, trailId: req.body.trailId,
    });
    if (out.error) return res.status(out.error === 'unknown_code' ? 404 : 409).json(out);
    if (req.body.teamName) at.setRunTeam(out.run.id, req.body.teamName);
    if (req.body.lang) at.setRunLang(out.run.id, req.body.lang);
    const run = at.getRun(out.run.id);
    res.json({ runId: run.id, joinCode: run.join_code, reused: !!out.reused });
  });

  // ── Several phones, one team ───────────────────────────────────────────────
  // Every phone of a team listens on one stream per run. When one phone moves
  // the run on, the others hear about it within a moment and fetch the new
  // state themselves: the stream only says what changed and which phone did
  // it. A locked screen closes its stream, so the number of phones listening
  // is told to everyone as phones come and go.
  const live = new Map();                 // runId -> Set<{ res, device }>
  const LIVE_MAX = 12;
  const deviceOf = req => String(req.get('X-AT-Device') || req.query.device || '')
    .replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
  function broadcast(runId, ev) {
    const set = live.get(runId); if (!set) return;
    const line = 'data: ' + JSON.stringify(ev) + '\n\n';
    for (const c of set) { try { c.res.write(line); } catch (e) {} }
  }
  function presence(runId) {
    const set = live.get(runId);
    broadcast(runId, { type: 'presence', phones: new Set([...(set || [])].map(c => c.device)).size });
  }
  const told = (req, run, ev) => broadcast(run.id, Object.assign({ by: deviceOf(req) }, ev));
  r.get('/api/at/run/:runId/live', (req, res) => {
    const run = requireRun(req, res); if (!run) return;
    let set = live.get(run.id);
    if (!set) { set = new Set(); live.set(run.id, set); }
    if (set.size >= LIVE_MAX) return res.status(429).json({ error: 'too_many_phones' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    const c = { res, device: deviceOf(req) || ('anon' + crypto.randomBytes(4).toString('hex')) };
    set.add(c);
    presence(run.id);
    // Proxies close a stream that stays silent; a comment every 20 s keeps it open.
    const beat = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) {} }, 20000);
    req.on('close', () => {
      clearInterval(beat); set.delete(c);
      if (!set.size) live.delete(run.id); else presence(run.id);
    });
  });
  // The way in for another phone: a QR code that opens the trail straight
  // into this run. Drawn here, so it works with the team's own address.
  r.get('/api/at/run/:runId/join-qr', async (req, res) => {
    const run = requireRun(req, res); if (!run) return;
    if (!run.join_code) return res.status(404).end();
    const proto = String(req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
    const host = String(req.get('host') || '').replace(/[^A-Za-z0-9.:\-\[\]]/g, '');
    const url = `${proto === 'http' ? 'http' : 'https'}://${host}/at-play.html?join=${encodeURIComponent(run.join_code)}`;
    try {
      const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#14110F', light: '#F4F1EA' } });
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(svg);
    } catch (e) { res.status(500).end(); }
  });

  // A second phone in the same team. Keeps a trail alive when a battery dies,
  // and gives a team more eyes.
  r.post('/api/at/join', (req, res) => {
    const run = at.findRunByJoinCode(req.body.code);
    if (!run) return res.status(404).json({ error: 'unknown_code' });
    res.json({ runId: run.id });
  });

  r.get('/api/at/run/:runId', (req, res) => {
    const run = requireRun(req, res); if (!run) return;
    const view = playerView(run);
    if (!view) return res.status(404).json({ error: 'unknown_trail' });
    res.json(view);
  });

  r.post('/api/at/run/:runId/start', (req, res) => {
    const run = requireRun(req, res); if (!run) return;
    at.startRun(run.id);
    // Open every root node so its hint clock begins.
    const nodes = at.listNodes(run.trail_id), edges = at.listEdges(run.trail_id);
    for (const n of nodes) if (!edges.some(e => e.to_node === n.id)) at.openNode(run.id, n.id);
    told(req, run, { type: 'start' });
    res.json(playerView(at.getRun(run.id)));
  });

  r.post('/api/at/run/:runId/node/:nodeId/open', (req, res) => {
    const run = requireRun(req, res); if (!run) return;
    at.openNode(run.id, Number(req.params.nodeId));
    res.json(playerView(run));
  });

  // The one endpoint that decides whether a team gets through a station.
  r.post('/api/at/run/:runId/node/:nodeId/solve', (req, res) => {
    const run = requireRun(req, res); if (!run) return;
    const node = at.getNode(req.params.nodeId);
    if (!node || node.trail_id !== run.trail_id) return res.status(404).json({ error: 'unknown_node' });

    const nodes = at.listNodes(run.trail_id), edges = at.listEdges(run.trail_id);
    const { open } = computeOpen(nodes, edges, at.listProgress(run.id), run.branch_key);
    if (!open.has(node.id)) return res.status(409).json({ error: 'not_open' });

    at.bumpAttempts(run.id, node.id);
    // A Peilung is a signpost, not a lock. It has no answer and no radius of
    // its own, so walking past it is always allowed.
    const kind = node.kind === 'nav' ? 'none' : (node.trigger_kind || 'answer');

    // The post code always works, whatever the node's own trigger is. It is the
    // way through when the camera, the GPS or the puzzle has defeated a team.
    const typed = String(req.body.answer || req.body.code || '').trim();
    if (node.post_code && typed && typed.toUpperCase().replace(/\s|-/g, '')
        === String(node.post_code).toUpperCase().replace(/\s|-/g, '')) {
      at.completeNode(run.id, node.id);
      told(req, run, { type: 'solve', node: node.id });
      return res.json({ ok: true, via: 'post_code', state: playerView(run) });
    }

    if (kind === 'answer' || kind === 'code' || kind === 'qr') {
      const accepted = [];
      const pool = node.answers || {};
      for (const list of Object.values(pool)) {
        if (Array.isArray(list)) accepted.push(...list);
        else if (typeof list === 'string') accepted.push(...list.split(',').map(s => s.trim()));
      }
      const norm = s => {
        const t = String(s).trim().replace(/\s+/g, ' ');
        return node.answer_case_sensitive ? t : t.toLowerCase();
      };
      // Full match only. A substring match once let "eiter" through for
      // "Heitere Fahne" in Rail Adventure.
      const hit = accepted.filter(Boolean).some(a => norm(a) === norm(typed));
      if (!hit) return res.json({ ok: false, reason: 'wrong' });
      at.completeNode(run.id, node.id);
      told(req, run, { type: 'solve', node: node.id });
      return res.json({ ok: true, via: 'answer', state: playerView(run) });
    }

    if (kind === 'gps') {
      const { lat, lng, accuracy } = req.body;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return res.json({ ok: false, reason: 'no_fix' });
      }
      if (node.lat == null || node.lng == null) {
        return res.json({ ok: false, reason: 'node_has_no_location' });
      }
      const acc = Number(accuracy) || 0;
      const dist = Math.round(metresBetween(lat, lng, node.lat, node.lng));
      // A fix worse than the node's tolerance is not a failure, it is "we do
      // not know". Saying "you are 90 m away" off a +/-120 m reading is a lie.
      if (acc && acc > (node.accuracy_max || 80)) {
        return res.json({ ok: false, reason: 'weak_signal', accuracy: acc, distance: dist });
      }
      if (dist > (node.radius_m || 45)) {
        return res.json({ ok: false, reason: 'too_far', distance: dist });
      }
      at.completeNode(run.id, node.id);
      told(req, run, { type: 'solve', node: node.id });
      return res.json({ ok: true, via: 'gps', distance: dist, state: playerView(run) });
    }

    if (kind === 'ar') {
      // The camera found one of this part's patterns. Like a GPS fix, that is
      // the phone's word; what is checked here is that the pattern belongs to
      // this part and was out for the team to find.
      const a = at.getAsset(Number(req.body.ar));
      if (!a || a.kind !== 'ar' || a.node_id !== node.id || (a.appear_when || {}).on === 'solve') {
        return res.json({ ok: false, reason: 'wrong' });
      }
      at.completeNode(run.id, node.id);
      told(req, run, { type: 'solve', node: node.id });
      return res.json({ ok: true, via: 'ar', state: playerView(run) });
    }

    at.completeNode(run.id, node.id);
    told(req, run, { type: 'solve', node: node.id });
    res.json({ ok: true, via: 'none', state: playerView(run) });
  });

  // Distance readout for a Peilung, without giving away whether you may pass.
  r.post('/api/at/run/:runId/node/:nodeId/distance', (req, res) => {
    const run = requireRun(req, res); if (!run) return;
    const node = at.getNode(req.params.nodeId);
    if (!node || node.trail_id !== run.trail_id) return res.status(404).json({ error: 'unknown_node' });
    const { lat, lng, accuracy } = req.body;
    let target = node;
    if (node.kind === 'nav') {
      target = navTarget(node, at.listNodes(run.trail_id), at.listEdges(run.trail_id), run.branch_key);
    }
    if (!target || target.lat == null || target.lng == null) return res.json({ distance: null });
    if (typeof lat !== 'number' || typeof lng !== 'number') return res.json({ distance: null });
    res.json({
      distance: Math.round(metresBetween(lat, lng, target.lat, target.lng)),
      accuracy: Number(accuracy) || null,
    });
  });

  r.post('/api/at/run/:runId/node/:nodeId/hint', (req, res) => {
    const run = requireRun(req, res); if (!run) return;
    at.useHint(run.id, Number(req.params.nodeId), Number(req.body.n) || 1);
    told(req, run, { type: 'hint', node: Number(req.params.nodeId) });
    res.json(playerView(run));
  });

  r.post('/api/at/run/:runId/node/:nodeId/skip', (req, res) => {
    const run = requireRun(req, res); if (!run) return;
    const node = at.getNode(req.params.nodeId);
    if (!node) return res.status(404).json({ error: 'unknown_node' });
    const p = at.listProgress(run.id).find(x => x.node_id === node.id);
    const mins = p && p.opened_at ? (Date.now() - p.opened_at) / 60000 : 0;
    if (!node.skip_after_min || mins < node.skip_after_min) {
      return res.status(409).json({ error: 'too_early' });
    }
    at.completeNode(run.id, node.id, 'skipped');
    told(req, run, { type: 'skip', node: node.id });
    res.json(playerView(run));
  });

  // A gate: the team picks a branch, and everything tagged with the other key
  // stops existing for this run.
  r.post('/api/at/run/:runId/node/:nodeId/choose', (req, res) => {
    const run = requireRun(req, res); if (!run) return;
    const branch = String(req.body.branch_key || '');
    if (!branch) return res.status(400).json({ error: 'no_branch' });
    at.setRunBranch(run.id, branch);
    at.completeNode(run.id, Number(req.params.nodeId));
    told(req, run, { type: 'choose', node: Number(req.params.nodeId) });
    res.json(playerView(at.getRun(run.id)));
  });

  r.post('/api/at/run/:runId/finish', (req, res) => {
    const run = requireRun(req, res); if (!run) return;
    at.finishRun(run.id);
    told(req, run, { type: 'finish' });
    res.json(playerView(at.getRun(run.id)));
  });

  r.post('/api/at/run/:runId/lang', (req, res) => {
    const run = requireRun(req, res); if (!run) return;
    at.setRunLang(run.id, String(req.body.lang || 'de'));
    told(req, run, { type: 'lang' });
    res.json(playerView(at.getRun(run.id)));
  });

  // ════════════════════════════ STUDIO ══════════════════════════════════════
  // ── Files ──────────────────────────────────────────────────────────────────
  // Every file a find owns: its own, plus what some kinds keep beside it (the
  // iPhone copy of a 3D object, a pattern's target and what appears on it).
  const assetFiles = a => { const m = (a && a.meta) || {}; return [a && a.path, m.usdz, m.mind, m.src].filter(Boolean); };
  // What a part leaves behind: the files of its finds and its own recording.
  // Its design files are not here; a copied design shares them, so they go
  // through dropUnusedDesignFiles.
  const nodeFiles = n => n ? [...at.listAssets(n.id).flatMap(assetFiles), n.story_media_path].filter(Boolean) : [];
  function unlinkRel(rel) {
    if (rel && !String(rel).includes('..')) { try { fs.unlinkSync(path.join(UPLOAD_DIR, rel)); } catch (e) {} }
  }

  r.get('/api/at/trails', gm, (req, res) => res.json(at.listTrails()));

  r.post('/api/at/trails', gm, (req, res) => {
    const id = at.createTrail(req.body || {});
    res.json({ id, success: true });
  });

  r.get('/api/at/trails/:id', gm, (req, res) => {
    const trail = at.getTrail(req.params.id);
    if (!trail) return res.status(404).json({ error: 'not_found' });
    const nodes = at.listNodes(trail.id).map(n => ({
      ...n, hints: at.listHints(n.id), assets: at.listAssets(n.id),
    }));
    res.json({ trail, nodes, edges: at.listEdges(trail.id) });
  });

  r.put('/api/at/trails/:id', gm, (req, res) => {
    res.json({ success: at.updateTrail(req.params.id, req.body || {}) });
  });

  // Deleting a trail or a part used to delete only rows: every upload stayed on
  // the disk for good. Now the files go with them, once the rows are gone.
  r.delete('/api/at/trails/:id', gm, (req, res) => {
    const nodes = at.listNodes(req.params.id);
    const files = nodes.flatMap(nodeFiles);
    const designs = new Set(nodes.flatMap(n => [...designFiles(n.design)]));
    at.deleteTrail(req.params.id);
    files.forEach(unlinkRel);
    dropUnusedDesignFiles(designs);
    res.json({ success: true });
  });

  r.post('/api/at/trails/:id/nodes', gm, (req, res) => {
    const id = at.createNode(req.params.id, req.body || {});
    res.json({ id, success: true });
  });

  r.put('/api/at/nodes/:id', gm, (req, res) => {
    const ok = at.updateNode(req.params.id, req.body || {});
    if (ok && Array.isArray(req.body.hints)) at.setHints(req.params.id, req.body.hints);
    res.json({ success: ok });
  });

  r.delete('/api/at/nodes/:id', gm, (req, res) => {
    const node = at.getNode(req.params.id);
    const files = nodeFiles(node);
    const gone = designFiles((node || {}).design);
    at.deleteNode(req.params.id);
    files.forEach(unlinkRel);
    dropUnusedDesignFiles(gone);
    res.json({ success: true });
  });

  // ── Page designs ───────────────────────────────────────────────────────────
  // A design arrives from the designer and leaves for every player's phone, so
  // it is rebuilt here field by field: numbers clamped, choices from fixed
  // lists, colours as colours, files only by the paths we issued, links only
  // to the web. Anything else is dropped rather than stored.
  const LANGS = ['de', 'en', 'fr', 'it', 'es'];
  const dNum = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  const dPick = (v, list, d) => list.includes(v) ? v : d;
  const dColor = (v, d) => typeof v === 'string' && /^(#[0-9a-fA-F]{3,8}|transparent)$/.test(v) ? v : d;
  const dFile = v => typeof v === 'string' && /^at\/[A-Za-z0-9._-]+$/.test(v) ? v : null;
  const dText = (v, max) => {
    const o = {};
    if (v && typeof v === 'object') for (const k of LANGS) if (typeof v[k] === 'string') o[k] = v[k].slice(0, max);
    return o;
  };
  const dUrl = v => { try { const u = new URL(String(v || '')); return /^https?:$/.test(u.protocol) ? u.href.slice(0, 2000) : ''; } catch (e) { return ''; } };
  function cleanDesign(d) {
    d = d && typeof d === 'object' ? d : {};
    const pg = d.page && typeof d.page === 'object' ? d.page : {};
    const out = {
      v: 1,
      page: { bg: dColor(pg.bg, '#0B0F1A'), image: dFile(pg.image), fit: dPick(pg.fit, ['cover', 'contain'], 'cover'),
              chrome: pg.chrome !== false },
      layers: [],
    };
    const seen = new Set();
    for (const l of (Array.isArray(d.layers) ? d.layers : []).slice(0, 60)) {
      if (!l || typeof l !== 'object') continue;
      const type = dPick(l.type, ['image', 'button', 'video', 'text', 'content'], null);
      const id = typeof l.id === 'string' && /^[A-Za-z0-9]{1,16}$/.test(l.id) && !seen.has(l.id) ? l.id : null;
      if (!type || !id) continue;
      seen.add(id);
      const o = { id, type, name: String(l.name || '').slice(0, 40),
        x: dNum(l.x, -100, 200, 0), y: dNum(l.y, -100, 200, 0), w: dNum(l.w, 0.5, 300, 30), h: dNum(l.h, 0.3, 300, 10),
        rot: dNum(l.rot, -360, 360, 0), opacity: dNum(l.opacity, 0, 1, 1), hidden: !!l.hidden, locked: !!l.locked };
      if (type === 'image') { o.src = dFile(l.src); o.fit = dPick(l.fit, ['fill', 'contain', 'cover'], 'fill'); }
      if (type === 'button') {
        o.label = dText(l.label, 80); o.src = dFile(l.src); o.fit = dPick(l.fit, ['fill', 'contain', 'cover'], 'contain');
        o.bg = dColor(l.bg, '#E8B23A'); o.fg = dColor(l.fg, '#16120C'); o.border = dColor(l.border, null);
        o.radius = dNum(l.radius, 0, 200, 12); o.size = dNum(l.size, 8, 72, 16);
        const a = l.action && typeof l.action === 'object' ? l.action : {};
        const act = dPick(a.do, ['primary', 'asset', 'url', 'video', 'branch', 'none'], 'primary');
        o.action = { do: act };
        if (act === 'asset') o.action.asset = dNum(a.asset, 0, 1e9, 0) | 0;
        if (act === 'url') o.action.url = dUrl(a.url);
        if (act === 'video') o.action.video = typeof a.video === 'string' && /^[A-Za-z0-9]{1,16}$/.test(a.video) ? a.video : '';
        if (act === 'branch') o.action.to = dNum(a.to, 0, 1e9, 0) | 0;
      }
      if (type === 'video') {
        o.src = l.src === 'story' ? 'story' : dFile(l.src);
        o.fit = dPick(l.fit, ['cover', 'contain', 'fill'], 'cover'); o.radius = dNum(l.radius, 0, 200, 0);
        o.controls = l.controls !== false; o.autoplay = !!l.autoplay; o.loop = !!l.loop;
      }
      if (type === 'text') {
        o.text = dText(l.text, 2000); o.font = dPick(l.font, ['display', 'body', 'mono'], 'body');
        o.size = dNum(l.size, 6, 160, 18); o.weight = dPick(Number(l.weight), [400, 600, 800], 600);
        o.color = dColor(l.color, '#F4F1EA'); o.align = dPick(l.align, ['left', 'center', 'right'], 'left');
        o.bg = dColor(l.bg, null); o.pad = dNum(l.pad, 0, 80, 0); o.radius = dNum(l.radius, 0, 200, 0); o.shadow = !!l.shadow;
      }
      if (type === 'content') {
        const sh = l.show && typeof l.show === 'object' ? l.show : {};
        o.show = { text: sh.text !== false, hints: sh.hints !== false, finds: sh.finds !== false, actions: sh.actions !== false };
        o.bg = dColor(l.bg, '#141828DB'); o.fg = dColor(l.fg, null);
        o.radius = dNum(l.radius, 0, 200, 16); o.pad = dNum(l.pad, 0, 80, 16);
      }
      out.layers.push(o);
    }
    return out;
  }
  // Files the designer uploaded for a design are named at/d-…; story media and
  // finds are never touched here.
  function designFiles(d) {
    const out = new Set();
    if (!d || typeof d !== 'object') return out;
    const add = v => { if (typeof v === 'string' && /^at\/d-[A-Za-z0-9._-]+$/.test(v)) out.add(v); };
    add(d.page && d.page.image);
    for (const l of d.layers || []) add(l && l.src);
    return out;
  }
  // Drop design files nothing uses any more. A copied design shares files, so
  // every design is asked; and a file uploaded within the hour is spared, since
  // the designer saves it into the design a moment after the upload.
  function dropUnusedDesignFiles(candidates) {
    const used = new Set();
    for (const d of at.listAllDesigns()) for (const f of designFiles(d)) used.add(f);
    const now = Date.now();
    let names = [];
    try { names = fs.readdirSync(AT_UPLOAD_DIR).filter(n => n.startsWith('d-')); } catch (e) { return; }
    const want = new Set([...(candidates || [])].map(f => f.slice(3)));
    for (const n of names) {
      const rel = 'at/' + n;
      if (used.has(rel)) continue;
      const file = path.join(AT_UPLOAD_DIR, n);
      let age = 0; try { age = now - fs.statSync(file).mtimeMs; } catch (e) { continue; }
      if (want.has(n) || age > 3600 * 1000) { try { fs.unlinkSync(file); } catch (e) {} }
    }
  }
  r.put('/api/at/nodes/:id/design', gm, (req, res) => {
    const node = at.getNode(req.params.id);
    if (!node) return res.status(404).json({ error: 'unknown_node' });
    const clean = cleanDesign((req.body || {}).design);
    const before = designFiles(node.design);
    at.updateNode(node.id, { design: clean });
    const after = designFiles(clean);
    dropUnusedDesignFiles([...before].filter(f => !after.has(f)));
    res.json({ success: true, design: clean });
  });
  r.delete('/api/at/nodes/:id/design', gm, (req, res) => {
    const node = at.getNode(req.params.id);
    if (!node) return res.status(404).json({ error: 'unknown_node' });
    at.updateNode(node.id, { design: {} });
    dropUnusedDesignFiles(designFiles(node.design));
    res.json({ success: true });
  });
  // Pictures and videos for a design: transparent PNG and WebP keep their
  // transparency, nothing is re-encoded.
  const D_IMG = /\.(png|jpe?g|webp|gif)$/i, D_VID = /\.(mp4|webm|m4v)$/i;
  r.post('/api/at/design-asset', upload.single('file'), (req, res) => {
    const drop = () => { if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) {} } };
    if (!isGmAuthed(req)) { drop(); return res.status(401).json({ error: 'Unauthorized' }); }
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    const name = String(req.file.originalname || ''), mime = String(req.file.mimetype || '').toLowerCase();
    const isImg = D_IMG.test(name) && /^image\/(png|jpeg|webp|gif)$/.test(mime);
    const isVid = D_VID.test(name) && /^video\/(mp4|webm|x-m4v)$/.test(mime);
    if (!isImg && !isVid) { drop(); return res.status(400).json({ error: 'unsupported_type' }); }
    if (isImg && req.file.size > 15 * 1024 * 1024) { drop(); return res.status(400).json({ error: 'too_large' }); }
    if (!fs.existsSync(AT_UPLOAD_DIR)) fs.mkdirSync(AT_UPLOAD_DIR, { recursive: true });
    const stored = 'd-' + req.file.filename;
    const dest = path.join(AT_UPLOAD_DIR, stored);
    try { fs.renameSync(req.file.path, dest); }
    catch (e) { fs.copyFileSync(req.file.path, dest); fs.unlinkSync(req.file.path); }
    res.json({ success: true, path: 'at/' + stored, kind: isImg ? 'image' : 'video' });
  });

  r.post('/api/at/trails/:id/edges', gm, (req, res) => {
    const id = at.addEdge(req.params.id, req.body.from, req.body.to,
      req.body.label || {}, req.body.branch_key || null);
    res.json({ id, success: id !== null });
  });

  r.delete('/api/at/trails/:id/edges', gm, (req, res) => {
    at.removeEdge(req.body.from, req.body.to); res.json({ success: true });
  });

  // Images, audio, documents for the ARG layer. SVG is refused for the same
  // reason as the mode tiles: it runs script when opened from our own origin.
  const ASSET_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav',
    'video/mp4', 'video/webm', 'application/pdf']);
  r.post('/api/at/nodes/:id/assets', upload.single('file'), (req, res) => {
    if (!isGmAuthed(req)) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) {} }
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    // A website is one self-contained HTML file; a download is any document,
    // archive or card a phone can open. Everything else must be real media.
    const want = String(req.body.kind || '');
    const name = String(req.file.originalname || '');
    // The browser's claimed type alone is not enough: the name has to agree,
    // or a page named .html could ride in as an "image".
    const media = ASSET_TYPES.has(String(req.file.mimetype || '').toLowerCase()) && MEDIA_EXT.test(name);
    const ok = want === 'page' ? PAGE_EXT.test(name) && req.file.size <= PAGE_MAX
      : want === 'model' ? MODEL_EXT.test(name) && req.file.size <= MODEL_MAX && magic(req.file.path, 'glTF')
      : want === 'file' ? FILE_EXT.test(name) || media
      : media;
    if (!ok) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      const tooBig = (want === 'page' && PAGE_EXT.test(name) && req.file.size > PAGE_MAX)
                  || (want === 'model' && MODEL_EXT.test(name) && req.file.size > MODEL_MAX);
      return res.status(400).json({ error: tooBig ? 'too_large' : want === 'model' && MODEL_EXT.test(name) ? 'not_glb' : 'unsupported_type' });
    }
    const node = at.getNode(req.params.id);
    if (!node) { try { fs.unlinkSync(req.file.path); } catch (e) {} return res.status(404).json({ error: 'unknown_node' }); }
    if (!fs.existsSync(AT_UPLOAD_DIR)) fs.mkdirSync(AT_UPLOAD_DIR, { recursive: true });
    const dest = path.join(AT_UPLOAD_DIR, req.file.filename);
    try { fs.renameSync(req.file.path, dest); }
    catch (e) { fs.copyFileSync(req.file.path, dest); fs.unlinkSync(req.file.path); }
    const rel = `at/${req.file.filename}`;
    const kind = ['page', 'file', 'model'].includes(want) ? want : guessKind(req.file.mimetype);
    const meta = { name: cleanName(name), size: req.file.size };
    if (kind === 'page') meta.display_url = cleanShown(req.body.display_url);
    let appear = {};
    try { appear = req.body.appear_when ? JSON.parse(req.body.appear_when) : {}; } catch (e) {}
    const id = at.addAsset(node.id, {
      kind, path: rel, title: String(req.body.title || name).slice(0, 120), appear_when: appear, meta,
      // A download can be big and is opened on purpose, so it is not fetched ahead.
      preload: kind === 'file' ? 0 : 1,
    });
    res.json({ id, path: rel, success: true });
  });
  // Downloads: archives, office files, notes, and the cards a phone knows what
  // to do with (a contact, a calendar invite, a GPS track). HTML, SVG and
  // scripts never go here: from our own origin they would run.
  const FILE_EXT = /\.(zip|7z|rar|txt|md|csv|rtf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|epub|json|gpx|kml|kmz|vcf|ics|eml|pdf)$/i;
  const PAGE_EXT = /\.html?$/i;
  const MEDIA_EXT = /\.(png|jpe?g|webp|gif|mp3|m4a|aac|ogg|oga|wav|mp4|m4v|webm|pdf)$/i;
  const PAGE_MAX = 5 * 1024 * 1024;
  // 3D: one self-contained .glb (the format Android and the viewer read), and
  // optionally a .usdz beside it, which iPhones place in the room most faithfully.
  // Without one, the viewer builds it on the phone.
  const MODEL_EXT = /\.glb$/i;
  const USDZ_EXT = /\.usdz$/i;
  const MODEL_MAX = 60 * 1024 * 1024;
  // A file is what its first bytes say, not what its name claims.
  const magic = (file, sig) => {
    try {
      const fd = fs.openSync(file, 'r'); const b = Buffer.alloc(sig.length);
      fs.readSync(fd, b, 0, sig.length, 0); fs.closeSync(fd);
      return b.toString('latin1') === sig;
    } catch (e) { return false; }
  };
  const cleanName = n => String(n || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120);
  // What a fake website shows in its address bar. Display only, never followed.
  const cleanShown = u => String(u || '').replace(/[\u0000-\u001f<>"]/g, '').trim().slice(0, 120);

  // A find that is not a file. Each kind is checked for what it is: a link has
  // to be a web address (a "javascript:" link would run in the player), a
  // number has to be dialable, an address has to look like one.
  function entryFields(kind, b) {
    const out = { title: String(b.title || '').slice(0, 120) };
    if (kind === 'link') {
      let u; try { u = new URL(String(b.ref || '').trim()); } catch (e) { return { error: 'bad_url' }; }
      if (!/^https?:$/.test(u.protocol)) return { error: 'bad_url' };
      out.ref = u.href.slice(0, 2000);
    } else if (kind === 'phone') {
      const t = String(b.ref || '').trim();
      if (!/^\+?[0-9][0-9 ()\/.\-]{2,28}$/.test(t)) return { error: 'bad_phone' };
      out.ref = t;
    } else if (kind === 'email') {
      const t = String(b.ref || '').trim();
      if (!/^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[A-Za-z]{2,24}$/.test(t)) return { error: 'bad_email' };
      out.ref = t;
      out.meta = { subject: String((b.meta && b.meta.subject) || '').slice(0, 200) };
    } else if (kind === 'note') {
      const body = {};
      for (const [k, v] of Object.entries(b.body || {})) {
        if (/^(de|en|fr|it|es)$/.test(k)) body[k] = String(v || '').slice(0, 10000);
      }
      if (!Object.values(body).some(v => v.trim())) return { error: 'empty_note' };
      out.body = body;
      out.meta = { look: ['letter', 'message', 'note'].includes(b.meta && b.meta.look) ? b.meta.look : 'letter' };
    } else return { error: 'bad_kind' };
    if (!out.title) out.title = kind === 'note' ? 'Brief' : String(out.ref || '').slice(0, 120);
    return out;
  }
  r.post('/api/at/nodes/:id/assets/entry', gm, (req, res) => {
    const node = at.getNode(req.params.id);
    if (!node) return res.status(404).json({ error: 'unknown_node' });
    const kind = String((req.body || {}).kind || '');
    const f = entryFields(kind, req.body || {});
    if (f.error) return res.status(400).json({ error: f.error });
    const id = at.addAsset(node.id, { kind, path: '', preload: 0, ...f });
    res.json({ success: true, id });
  });
  r.put('/api/at/assets/:id', gm, (req, res) => {
    const a = at.getAsset(req.params.id);
    if (!a) return res.status(404).json({ error: 'unknown_asset' });
    const b = req.body || {};
    let patch;
    if (['link', 'phone', 'email', 'note'].includes(a.kind)) {
      patch = entryFields(a.kind, { ...a, ...b, meta: { ...a.meta, ...(b.meta || {}) } });
      if (patch.error) return res.status(400).json({ error: patch.error });
    } else {
      patch = { title: String(b.title == null ? a.title : b.title).slice(0, 120) };
      if (a.kind === 'page' && b.meta && b.meta.display_url !== undefined) {
        patch.meta = { ...a.meta, display_url: cleanShown(b.meta.display_url) };
      }
      if (a.kind === 'ar' && b.meta && typeof b.meta === 'object') patch.meta = arPlacement(a.meta || {}, b.meta);
    }
    at.updateAsset(a.id, patch);
    res.json({ success: true });
  });

  // An uploaded website, served so it cannot reach the game: the sandbox gives
  // it an origin of its own, so it sees none of our storage and cannot act as
  // us, even when opened in a tab of its own. A team only gets it once the part
  // holding it is in play; the studio previews it with the GM login.
  function canSeeAsset(req, a) {
    if (isGmAuthed(req)) return true;
    if (!req.query.run) return false;
    const run = at.getRun(String(req.query.run));
    if (!run) return false;
    const node = at.getNode(a.node_id);
    if (!node || node.trail_id !== run.trail_id) return false;
    const { open, done } = computeOpen(at.listNodes(run.trail_id), at.listEdges(run.trail_id),
      at.listProgress(run.id), run.branch_key);
    return open.has(node.id) || done.has(node.id);
  }
  r.get('/api/at/page/:id', (req, res) => {
    const a = at.getAsset(req.params.id);
    if (!a || a.kind !== 'page' || !a.path || String(a.path).includes('..')) return res.status(404).end();
    if (!canSeeAsset(req, a)) return res.status(404).end();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', 'sandbox allow-scripts allow-forms allow-popups allow-modals');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.sendFile(path.join(UPLOAD_DIR, a.path), err => { if (err && !res.headersSent) res.status(404).end(); });
  });

  // A 3D object, under the content type each AR viewer insists on. The address
  // is handed to the phone's own AR app as well, so it carries the run.
  r.get('/api/at/model/:id/:file', (req, res) => {
    const a = at.getAsset(req.params.id);
    if (!a || a.kind !== 'model' || !canSeeAsset(req, a)) return res.status(404).end();
    const usdz = req.params.file === 'model.usdz';
    if (!usdz && req.params.file !== 'model.glb') return res.status(404).end();
    const rel = usdz ? a.meta && a.meta.usdz : a.path;
    if (!rel || String(rel).includes('..')) return res.status(404).end();
    res.setHeader('Content-Type', usdz ? 'model/vnd.usdz+zip' : 'model/gltf-binary');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(path.join(UPLOAD_DIR, rel), err => { if (err && !res.headersSent) res.status(404).end(); });
  });
  // Built-in 3D objects, so a manager can try AR before having a model of their
  // own. Each pick is a copy, so it is deleted like any upload and never
  // touches the sample itself. Made by at/samples/build-samples.js.
  const SAMPLES = { chest: 'Schatztruhe (Beispiel)', key: 'Alter Schlüssel (Beispiel)' };
  r.post('/api/at/nodes/:id/assets/sample', gm, (req, res) => {
    const node = at.getNode(req.params.id);
    if (!node) return res.status(404).json({ error: 'unknown_node' });
    const which = String((req.body || {}).sample || '');
    if (!Object.prototype.hasOwnProperty.call(SAMPLES, which)) return res.status(400).json({ error: 'unknown_sample' });
    const src = path.join(__dirname, 'samples', which + '.glb');
    if (!fs.existsSync(src)) return res.status(404).json({ error: 'unknown_sample' });
    if (!fs.existsSync(AT_UPLOAD_DIR)) fs.mkdirSync(AT_UPLOAD_DIR, { recursive: true });
    const name = crypto.randomUUID() + '.glb';
    fs.copyFileSync(src, path.join(AT_UPLOAD_DIR, name));
    const id = at.addAsset(node.id, { kind: 'model', path: `at/${name}`, title: SAMPLES[which],
      meta: { name: which + '.glb', size: fs.statSync(src).size, sample: which } });
    res.json({ success: true, id });
  });

  // The iPhone companion of a 3D object. Replacing it drops the old file.
  r.post('/api/at/assets/:id/usdz', upload.single('file'), (req, res) => {
    const drop = () => { if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) {} } };
    if (!isGmAuthed(req)) { drop(); return res.status(401).json({ error: 'Unauthorized' }); }
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    const a = at.getAsset(req.params.id);
    if (!a || a.kind !== 'model') { drop(); return res.status(404).json({ error: 'unknown_asset' }); }
    if (!USDZ_EXT.test(String(req.file.originalname || '')) || !magic(req.file.path, 'PK')) { drop(); return res.status(400).json({ error: 'not_usdz' }); }
    if (req.file.size > MODEL_MAX) { drop(); return res.status(400).json({ error: 'too_large' }); }
    if (!fs.existsSync(AT_UPLOAD_DIR)) fs.mkdirSync(AT_UPLOAD_DIR, { recursive: true });
    const dest = path.join(AT_UPLOAD_DIR, req.file.filename);
    try { fs.renameSync(req.file.path, dest); }
    catch (e) { fs.copyFileSync(req.file.path, dest); fs.unlinkSync(req.file.path); }
    if (a.meta && a.meta.usdz && !String(a.meta.usdz).includes('..')) {
      try { fs.unlinkSync(path.join(UPLOAD_DIR, a.meta.usdz)); } catch (e) {}
    }
    const rel = `at/${req.file.filename}`;
    at.updateAsset(a.id, { meta: { ...a.meta, usdz: rel, usdz_size: req.file.size } });
    res.json({ success: true });
  });

  // ── Pattern AR ─────────────────────────────────────────────────────────────
  // A pattern is a picture the camera looks for, stored with the target the
  // studio compiled from it (MindAR's .mind), and optionally something to show
  // on it: a 3D object, a picture or a video. Every file has to be what its
  // first bytes say, since all of them are served from our own origin.
  const AR_SHOW = ['model', 'image', 'video'];
  const AR_PLACE = ['stand', 'front', 'flat'];
  const AR_IMAGE_MAX = 15 * 1024 * 1024, AR_MIND_MAX = 20 * 1024 * 1024, AR_VIDEO_MAX = 100 * 1024 * 1024;
  const AR_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
    '.mind': 'application/octet-stream', '.glb': 'model/gltf-binary', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm' };
  const AR_EXT = { png: /\.png$/i, jpeg: /\.jpe?g$/i, webp: /\.webp$/i, glb: /\.glb$/i,
    mp4: /\.(mp4|m4v)$/i, webm: /\.webm$/i, mind: /\.mind$/i };
  function sniff(file) {
    const b = Buffer.alloc(16);
    try { const fd = fs.openSync(file, 'r'); fs.readSync(fd, b, 0, 16, 0); fs.closeSync(fd); } catch (e) { return null; }
    const s = b.toString('latin1');
    if (s.startsWith('\x89PNG\r\n\x1a\n')) return 'png';
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
    if (s.startsWith('RIFF') && s.slice(8, 12) === 'WEBP') return 'webp';
    if (s.startsWith('glTF')) return 'glb';
    if (s.slice(4, 8) === 'ftyp') return 'mp4';
    if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm';
    // MindAR writes a msgpack map whose first key is "v", its format version.
    if (b[0] === 0x82 && b[1] === 0xa1 && b[2] === 0x76) return 'mind';
    return null;
  }
  // One of the wanted kinds, when the bytes and the name agree.
  const arKind = (f, kinds) => {
    const k = sniff(f.path);
    return k && kinds.includes(k) && AR_EXT[k].test(String(f.originalname || '')) ? k : null;
  };
  const keepUpload = f => {
    if (!fs.existsSync(AT_UPLOAD_DIR)) fs.mkdirSync(AT_UPLOAD_DIR, { recursive: true });
    const dest = path.join(AT_UPLOAD_DIR, f.filename);
    try { fs.renameSync(f.path, dest); }
    catch (e) { fs.copyFileSync(f.path, dest); fs.unlinkSync(f.path); }
    return `at/${f.filename}`;
  };
  const dropUploads = req => {
    const all = [].concat(req.file || [], ...Object.values(req.files || {}));
    for (const f of all) { try { fs.unlinkSync(f.path); } catch (e) {} }
  };
  // What a phone needs to find the pattern and show what sits on it. Files go
  // by their stored names, so a replaced file is a new address and no phone
  // keeps looking for yesterday's pattern out of its cache.
  function arView(a) {
    const m = a.meta || {};
    const base = f => f ? path.basename(String(f)) : '';
    return {
      pattern: base(a.path), mind: base(m.mind), src: m.src ? base(m.src) : '',
      show: m.src && AR_SHOW.includes(m.show) ? m.show : 'none',
      place: AR_PLACE.includes(m.place) ? m.place : '',
      scale: dNum(m.scale, 0.1, 10, 1), rot: dNum(m.rot, -180, 180, 0),
      aspect: m.pw > 0 && m.ph > 0 ? m.ph / m.pw : 1,
      hint: m.hint !== false,
    };
  }
  const arPlacement = (cur, m) => ({ ...cur,
    place: AR_PLACE.includes(m.place) ? m.place : cur.place,
    scale: m.scale !== undefined ? Math.round(dNum(m.scale, 0.1, 10, 1) * 100) / 100 : cur.scale,
    rot: m.rot !== undefined ? Math.round(dNum(m.rot, -180, 180, 0)) : cur.rot,
    hint: m.hint !== undefined ? m.hint !== false : cur.hint,
  });
  // The picture and its compiled target arrive together, so they always match.
  const arFields = upload.fields([{ name: 'image', maxCount: 1 }, { name: 'mind', maxCount: 1 }]);
  function patternUpload(req) {
    const img = req.files && req.files.image && req.files.image[0];
    const mind = req.files && req.files.mind && req.files.mind[0];
    if (!img || !mind) return { error: 'no_file' };
    if (!arKind(img, ['png', 'jpeg', 'webp']) || img.size > AR_IMAGE_MAX) return { error: 'bad_pattern' };
    if (!arKind(mind, ['mind']) || mind.size > AR_MIND_MAX) return { error: 'bad_target' };
    const b = req.body || {};
    return { img, mind, meta: {
      pw: dNum(b.pw, 1, 20000, 1) | 0, ph: dNum(b.ph, 1, 20000, 1) | 0,
      points: dNum(b.points, 0, 100000, 0) | 0, quality: dPick(b.quality, ['good', 'ok', 'poor'], 'ok'),
      name: cleanName(img.originalname),
    } };
  }
  r.post('/api/at/nodes/:id/assets/ar', arFields, (req, res) => {
    if (!isGmAuthed(req)) { dropUploads(req); return res.status(401).json({ error: 'Unauthorized' }); }
    const node = at.getNode(req.params.id);
    if (!node) { dropUploads(req); return res.status(404).json({ error: 'unknown_node' }); }
    const f = patternUpload(req);
    if (f.error) { dropUploads(req); return res.status(400).json({ error: f.error }); }
    const id = at.addAsset(node.id, { kind: 'ar', path: keepUpload(f.img),
      title: String((req.body && req.body.title) || 'AR-Muster').slice(0, 120),
      meta: { ...f.meta, mind: keepUpload(f.mind), hint: true } });
    res.json({ success: true, id });
  });
  r.post('/api/at/assets/:id/ar-pattern', arFields, (req, res) => {
    if (!isGmAuthed(req)) { dropUploads(req); return res.status(401).json({ error: 'Unauthorized' }); }
    const a = at.getAsset(req.params.id);
    if (!a || a.kind !== 'ar') { dropUploads(req); return res.status(404).json({ error: 'unknown_asset' }); }
    const f = patternUpload(req);
    if (f.error) { dropUploads(req); return res.status(400).json({ error: f.error }); }
    const old = [a.path, a.meta && a.meta.mind];
    at.updateAsset(a.id, { path: keepUpload(f.img), meta: { ...a.meta, ...f.meta, mind: keepUpload(f.mind) } });
    old.forEach(unlinkRel);
    res.json({ success: true });
  });
  // The built-in test pattern, an old town map, made by at/samples/build-marker.cjs
  // and compiled the way the studio compiles an upload. Each pick is a copy.
  r.post('/api/at/nodes/:id/assets/ar-sample', gm, (req, res) => {
    const node = at.getNode(req.params.id);
    if (!node) return res.status(404).json({ error: 'unknown_node' });
    const dir = path.join(__dirname, 'samples');
    let meta;
    try { meta = JSON.parse(fs.readFileSync(path.join(dir, 'marker.json'), 'utf8')); }
    catch (e) { return res.status(404).json({ error: 'unknown_sample' }); }
    if (!fs.existsSync(AT_UPLOAD_DIR)) fs.mkdirSync(AT_UPLOAD_DIR, { recursive: true });
    const copy = ext => {
      const name = crypto.randomUUID() + ext;
      fs.copyFileSync(path.join(dir, 'marker' + ext), path.join(AT_UPLOAD_DIR, name));
      return `at/${name}`;
    };
    const id = at.addAsset(node.id, { kind: 'ar', path: copy('.jpg'), title: 'Testmuster (Beispiel)',
      meta: { pw: meta.pw | 0, ph: meta.ph | 0, points: meta.points | 0, quality: dPick(meta.quality, ['good', 'ok', 'poor'], 'ok'),
              name: 'testmuster.jpg', mind: copy('.mind'), hint: true, sample_pattern: true } });
    res.json({ success: true, id });
  });
  // What appears on the pattern: a 3D object, a picture or a video, or one of
  // the built-in 3D samples. Replacing it drops the old file.
  r.post('/api/at/assets/:id/ar-content', upload.single('file'), (req, res) => {
    if (!isGmAuthed(req)) { dropUploads(req); return res.status(401).json({ error: 'Unauthorized' }); }
    const a = at.getAsset(req.params.id);
    if (!a || a.kind !== 'ar') { dropUploads(req); return res.status(404).json({ error: 'unknown_asset' }); }
    let next;
    if (req.file) {
      const k = arKind(req.file, ['glb', 'png', 'jpeg', 'webp', 'mp4', 'webm']);
      if (!k) {
        dropUploads(req);
        return res.status(400).json({ error: /\.glb$/i.test(String(req.file.originalname || '')) ? 'not_glb' : 'unsupported_type' });
      }
      const show = k === 'glb' ? 'model' : k === 'mp4' || k === 'webm' ? 'video' : 'image';
      if (req.file.size > (show === 'model' ? MODEL_MAX : show === 'video' ? AR_VIDEO_MAX : AR_IMAGE_MAX)) {
        dropUploads(req); return res.status(400).json({ error: 'too_large' });
      }
      next = { show, src_name: cleanName(req.file.originalname), src_size: req.file.size, sample: null, src: keepUpload(req.file) };
    } else {
      const which = String((req.body || {}).sample || '');
      if (!Object.prototype.hasOwnProperty.call(SAMPLES, which)) return res.status(400).json({ error: 'unknown_sample' });
      const from = path.join(__dirname, 'samples', which + '.glb');
      if (!fs.existsSync(from)) return res.status(404).json({ error: 'unknown_sample' });
      if (!fs.existsSync(AT_UPLOAD_DIR)) fs.mkdirSync(AT_UPLOAD_DIR, { recursive: true });
      const name = crypto.randomUUID() + '.glb';
      fs.copyFileSync(from, path.join(AT_UPLOAD_DIR, name));
      next = { show: 'model', src_name: which + '.glb', src_size: fs.statSync(from).size, sample: which, src: `at/${name}` };
    }
    unlinkRel(a.meta && a.meta.src);
    at.updateAsset(a.id, { meta: { ...a.meta, ...next } });
    res.json({ success: true, show: next.show });
  });
  r.delete('/api/at/assets/:id/ar-content', gm, (req, res) => {
    const a = at.getAsset(req.params.id);
    if (!a || a.kind !== 'ar') return res.status(404).json({ error: 'unknown_asset' });
    unlinkRel(a.meta && a.meta.src);
    const meta = { ...a.meta };
    for (const k of ['src', 'show', 'src_name', 'src_size', 'sample']) delete meta[k];
    at.updateAsset(a.id, { meta });
    res.json({ success: true });
  });
  // A team gets a pattern's files once the part holding it is in play, the
  // studio with the GM login.
  r.get('/api/at/ar/:id/:file', (req, res) => {
    const a = at.getAsset(req.params.id);
    if (!a || a.kind !== 'ar' || !canSeeAsset(req, a)) return res.status(404).end();
    const m = a.meta || {};
    const rel = [a.path, m.mind, m.src].find(f => f && path.basename(String(f)) === req.params.file);
    if (!rel || String(rel).includes('..')) return res.status(404).end();
    res.setHeader('Content-Type', AR_TYPES[path.extname(String(rel)).toLowerCase()] || 'application/octet-stream');
    // A replaced file has a new name, so a copy here never goes stale.
    res.setHeader('Cache-Control', 'private, max-age=604800, immutable');
    res.sendFile(path.join(UPLOAD_DIR, rel), err => { if (err && !res.headersSent) res.status(404).end(); });
  });

  function guessKind(mime) {
    if (/^audio\//.test(mime)) return 'audio';
    if (/^video\//.test(mime)) return 'video';
    if (/pdf$/.test(mime)) return 'doc';
    return 'image';
  }

  // The story's own recording, stored on the node rather than in its find list:
  // it is how this beat is told, not something the team discovers.
  r.post('/api/at/nodes/:id/story-media', upload.single('file'), (req, res) => {
    if (!isGmAuthed(req)) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) {} }
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    const mime = String(req.file.mimetype || '').toLowerCase();
    if (!/^audio\/|^video\//.test(mime)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(400).json({ error: 'unsupported_type' });
    }
    const node = at.getNode(req.params.id);
    if (!node) { try { fs.unlinkSync(req.file.path); } catch (e) {} return res.status(404).json({ error: 'unknown_node' }); }
    if (!fs.existsSync(AT_UPLOAD_DIR)) fs.mkdirSync(AT_UPLOAD_DIR, { recursive: true });
    const dest = path.join(AT_UPLOAD_DIR, req.file.filename);
    try { fs.renameSync(req.file.path, dest); }
    catch (e) { fs.copyFileSync(req.file.path, dest); fs.unlinkSync(req.file.path); }
    // Replacing one drops the old file rather than leaving it behind.
    if (node.story_media_path && !String(node.story_media_path).includes('..')) {
      try { fs.unlinkSync(path.join(UPLOAD_DIR, node.story_media_path)); } catch (e) {}
    }
    const rel = `at/${req.file.filename}`;
    at.updateNode(node.id, { story_media_path: rel, story_media: /^video\//.test(mime) ? 'video' : 'voice' });
    res.json({ success: true, path: rel, kind: /^video\//.test(mime) ? 'video' : 'voice' });
  });

  r.delete('/api/at/assets/:id', gm, (req, res) => {
    const a = at.getAsset(req.params.id);
    at.deleteAsset(req.params.id);
    assetFiles(a).forEach(unlinkRel);
    res.json({ success: true });
  });

  r.get('/api/at/trails/:id/keys', gm, (req, res) => res.json(at.listKeys(req.params.id)));
  r.post('/api/at/trails/:id/keys', gm, (req, res) => {
    res.json({ codes: at.mintKeys(req.params.id, Number(req.body.count) || 1, req.body.note || '') });
  });

  // Everything that would strand or confuse a paying team, found before publish
  // rather than by a customer standing in the rain.
  r.get('/api/at/trails/:id/check', gm, (req, res) => {
    const trail = at.getTrail(req.params.id);
    if (!trail) return res.status(404).json({ error: 'not_found' });
    const nodes = at.listNodes(trail.id), edges = at.listEdges(trail.id);
    const out = [];
    const reachable = new Set();
    const roots = nodes.filter(n => !edges.some(e => e.to_node === n.id));
    const walk = id => {
      if (reachable.has(id)) return;
      reachable.add(id);
      edges.filter(e => e.from_node === id).forEach(e => walk(e.to_node));
    };
    roots.forEach(n => walk(n.id));

    if (!nodes.length) out.push({ level: 'error', msg: 'Der Trail hat keine Bausteine.' });
    if (roots.length > 1) out.push({ level: 'warn', msg: `${roots.length} Startpunkte. Normal ist einer.` });

    for (const n of nodes) {
      const name = at.pick(n.title, trail.langs[0] || 'de') || `#${n.id}`;
      if (!reachable.has(n.id)) out.push({ level: 'error', node: n.id, msg: `„${name}“ ist von keinem Weg aus erreichbar.` });
      if (n.kind !== 'end' && !edges.some(e => e.from_node === n.id)) {
        out.push({ level: 'error', node: n.id, msg: `„${name}“ führt nirgendwohin.` });
      }
      if (n.kind === 'nav') {
        const t = navTarget(n, nodes, edges, null);
        if (!t) out.push({ level: 'error', node: n.id, msg: `Die Peilung „${name}“ zeigt auf nichts: kein verbundener Baustein dahinter hat einen Ort.` });
        continue;
      }
      if (n.trigger_kind === 'gps' && (n.lat == null || n.lng == null)) {
        out.push({ level: 'error', node: n.id, msg: `„${name}“ wird per GPS geöffnet, hat aber keinen Ort.` });
      }
      const patterns = at.listAssets(n.id).filter(a => a.kind === 'ar');
      if (n.trigger_kind === 'ar' && !patterns.some(a => (a.appear_when || {}).on !== 'solve')) {
        out.push({ level: 'error', node: n.id, msg: `„${name}“ wird mit einem AR-Muster geöffnet, hat aber keins. Unter Fundstücke ein AR-Muster anlegen.` });
      }
      for (const a of patterns) {
        if ((a.meta || {}).quality === 'poor') {
          out.push({ level: 'warn', node: n.id, msg: `Das AR-Muster „${a.title}“ bei „${name}“ hat wenig Details. Die Kamera verliert es leicht.` });
        }
        if (n.trigger_kind !== 'ar' && !(a.meta || {}).src) {
          out.push({ level: 'warn', node: n.id, msg: `Das AR-Muster „${a.title}“ bei „${name}“ zeigt nichts und öffnet nichts.` });
        }
      }
      if (n.trigger_kind === 'answer') {
        const any = Object.values(n.answers || {}).some(v => (Array.isArray(v) ? v.length : String(v || '').trim()));
        if (!any) out.push({ level: 'error', node: n.id, msg: `„${name}“ erwartet eine Antwort, hat aber keine hinterlegt.` });
      }
      if (['station', 'riddle'].includes(n.kind) && !at.listHints(n.id).length) {
        out.push({ level: 'warn', node: n.id, msg: `„${name}“ hat keine Hinweise. Ohne Spielleiter kann niemand helfen.` });
      }
      if (n.kind === 'story' && n.trigger_kind === 'gps' && !n.post_code && !n.skip_after_min) {
        out.push({ level: 'warn', node: n.id, msg: `Der Story-Beat „${name}“ wartet auf GPS, hat aber weder Posten-Code noch Überspringen. Bei schlechtem Empfang kommt das Team dort nicht weiter.` });
      }
      if (['station', 'riddle'].includes(n.kind) && !n.post_code) {
        out.push({ level: 'warn', node: n.id, msg: `„${name}“ hat keinen Posten-Code als Rückfall.` });
      }
      const hints = at.listHints(n.id);
      if (hints.length && !hints.some(h => h.resolves)) {
        out.push({ level: 'warn', node: n.id, msg: `Die Hinweise bei „${name}“ lösen nie auf.` });
      }
    }

    // Two GPS posts closer together than this cannot be told apart in an old
    // town, where the median error is around 28 m.
    const geo = nodes.filter(n => n.trigger_kind === 'gps' && n.lat != null);
    for (let i = 0; i < geo.length; i++) {
      for (let j = i + 1; j < geo.length; j++) {
        const d = Math.round(metresBetween(geo[i].lat, geo[i].lng, geo[j].lat, geo[j].lng));
        if (d < 120) {
          out.push({
            level: 'warn', node: geo[i].id,
            msg: `„${at.pick(geo[i].title, 'de')}“ und „${at.pick(geo[j].title, 'de')}“ liegen nur ${d} m auseinander. Unter 120 m sind sie per GPS nicht zu unterscheiden.`,
          });
        }
      }
    }
    res.json({ issues: out, errors: out.filter(i => i.level === 'error').length });
  });

  return r;
};
