// AdventureTrail HTTP surface. Everything lives under /api/at.
//
// Exported as a factory so the module receives what it needs from server.js
// instead of reaching into it. The dependency points one way only: nothing in
// MiSSiONS imports from here.
const express = require('express');
const fs = require('fs');
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
    const lang = run.lang || 'de';
    const now = Date.now();

    const visible = nodes.filter(n => open.has(n.id) || done.has(n.id));
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
        }).map(a => ({ id: a.id, kind: a.kind, path: a.path, title: a.title, preload: !!a.preload }));

        return {
          id: n.id, kind: n.kind, status: isDone ? (p && p.status) || 'done' : 'open',
          title: at.pick(n.title, lang),
          task: at.pick(n.task, lang),
          arrive: isDone ? at.pick(n.arrive, lang) : '',
          depart: isDone ? at.pick(n.depart, lang) : '',
          trigger_kind: n.trigger_kind,
          nav_mode: n.nav_mode,
          // Coordinates only go out when the node actually uses them, and only
          // for a node already in play. Otherwise the whole route leaks.
          lat: (n.nav_mode !== 'none' || n.trigger_kind === 'gps') ? n.lat : null,
          lng: (n.nav_mode !== 'none' || n.trigger_kind === 'gps') ? n.lng : null,
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
      teamName: req.body.teamName, lang: req.body.lang,
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
    const kind = node.trigger_kind || 'answer';

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
    if (node.lat == null || node.lng == null) return res.json({ distance: null });
    if (typeof lat !== 'number' || typeof lng !== 'number') return res.json({ distance: null });
    res.json({
      distance: Math.round(metresBetween(lat, lng, node.lat, node.lng)),
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
    if (!ASSET_TYPES.has(String(req.file.mimetype || '').toLowerCase())) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(400).json({ error: 'unsupported_type' });
    }
    const node = at.getNode(req.params.id);
    if (!node) { try { fs.unlinkSync(req.file.path); } catch (e) {} return res.status(404).json({ error: 'unknown_node' }); }
    if (!fs.existsSync(AT_UPLOAD_DIR)) fs.mkdirSync(AT_UPLOAD_DIR, { recursive: true });
    const dest = path.join(AT_UPLOAD_DIR, req.file.filename);
    try { fs.renameSync(req.file.path, dest); }
    catch (e) { fs.copyFileSync(req.file.path, dest); fs.unlinkSync(req.file.path); }
    const rel = `at/${req.file.filename}`;
    const id = at.addAsset(node.id, {
      kind: req.body.kind || guessKind(req.file.mimetype),
      path: rel, title: req.body.title || req.file.originalname,
      appear_when: req.body.appear_when ? JSON.parse(req.body.appear_when) : {},
    });
    res.json({ id, path: rel, success: true });
  });
  function guessKind(mime) {
    if (/^audio\//.test(mime)) return 'audio';
    if (/^video\//.test(mime)) return 'video';
    if (/pdf$/.test(mime)) return 'doc';
    return 'image';
  }

  r.delete('/api/at/assets/:id', gm, (req, res) => {
    const a = at.getAsset(req.params.id);
    if (a && a.path && !String(a.path).includes('..')) {
      try { fs.unlinkSync(path.join(UPLOAD_DIR, a.path)); } catch (e) {}
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
