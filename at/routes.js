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
          id: a.id, kind: a.kind, path: a.kind === 'page' || a.kind === 'model' ? '' : a.path, title: a.title, preload: !!a.preload,
          ios: a.kind === 'model' ? !!(a.meta && a.meta.usdz) : undefined,
          ref: ['link', 'phone', 'email'].includes(a.kind) ? a.ref : undefined,
          body: a.kind === 'note' ? at.pick(a.body, lang) : undefined,
          look: a.kind === 'note' ? (a.meta && a.meta.look) || 'letter' : undefined,
          subject: a.kind === 'email' ? (a.meta && a.meta.subject) || '' : undefined,
          shown: a.kind === 'page' ? (a.meta && a.meta.display_url) || '' : undefined,
          name: a.kind === 'file' ? (a.meta && a.meta.name) || '' : undefined,
          size: a.kind === 'file' ? (a.meta && a.meta.size) || 0 : undefined,
        }));

        return {
          id: n.id, kind: n.kind, status: isDone ? (p && p.status) || 'done' : 'open',
          title: at.pick(n.title, lang),
          task: at.pick(n.task, lang),
          arrive: isDone ? at.pick(n.arrive, lang) : '',
          depart: isDone ? at.pick(n.depart, lang) : '',
          trigger_kind: n.trigger_kind,
          story_media: n.story_media || 'text',
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

  // A second phone in the same team. Keeps a trail alive when a battery dies.
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
      return res.json({ ok: true, via: 'gps', distance: dist, state: playerView(run) });
    }

    at.completeNode(run.id, node.id);
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
    res.json(playerView(at.getRun(run.id)));
  });

  r.post('/api/at/run/:runId/finish', (req, res) => {
    const run = requireRun(req, res); if (!run) return;
    at.finishRun(run.id);
    res.json(playerView(at.getRun(run.id)));
  });

  r.post('/api/at/run/:runId/lang', (req, res) => {
    const run = requireRun(req, res); if (!run) return;
    at.setRunLang(run.id, String(req.body.lang || 'de'));
    res.json(playerView(at.getRun(run.id)));
  });

  // ════════════════════════════ STUDIO ══════════════════════════════════════
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

  r.delete('/api/at/trails/:id', gm, (req, res) => {
    at.deleteTrail(req.params.id); res.json({ success: true });
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
    at.deleteNode(req.params.id); res.json({ success: true });
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
    for (const rel of [a && a.path, a && a.meta && a.meta.usdz]) {
      if (rel && !String(rel).includes('..')) { try { fs.unlinkSync(path.join(UPLOAD_DIR, rel)); } catch (e) {} }
    }
    at.deleteAsset(req.params.id);
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
