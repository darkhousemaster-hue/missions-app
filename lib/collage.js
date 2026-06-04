'use strict';
// ── lib/collage.js ─────────────────────────────────────────────────────────
// Game-media export — zip and photo-collage MP4 generation.
//
// Two exports:
//   - streamZip(db, gameId, upRoot, res)
//       Streams an attachment zip of every team's accepted media (photos +
//       videos) plus team selfies. Filenames are namespaced under each
//       team's name so the directory layout is readable.
//
//   - generateCollage(db, gameId, upRoot, onProgress)
//       Async. Produces a single MP4 slideshow of accepted PHOTOS (videos
//       are skipped here — they're already in the zip). Per-team title card
//       precedes each team's photos. ~2s per photo, 0.5s crossfade between
//       photos, 1.5s title cards. Writes to <upRoot>/<gameId>/collage.mp4.
//       Resolves with the relative path on success.
//
// The DB schema bit we lean on:
//   team_missions    (status='accepted', media_path) — MiSSiONS submissions
//   cr_submissions   (status='accepted', media_path) — CityRush submissions
//   teams.selfie_path                                — team-join selfie
//
// We deliberately render server-side via ffmpeg-static so users don't need
// a system ffmpeg install. The bundled binary path comes from the npm pkg.

const path     = require('path');
const fs       = require('fs');
const os       = require('os');
const archiver = require('archiver');
const ffmpegStatic = require('ffmpeg-static');
const ffmpeg   = require('fluent-ffmpeg');
const opentype = require('opentype.js');
ffmpeg.setFfmpegPath(ffmpegStatic);

// How many segment clips to render at once. Each clip is its own short-lived
// ffmpeg process pinned to ~1 core, so we scale with cores but leave one free
// for the server/event loop and cap it so RAM stays sane on big games.
const RENDER_CONCURRENCY = Math.max(1, Math.min(6, (os.cpus().length || 2) - 1));

// Safe filename slug — keeps unicode letters/numbers, replaces everything else
// with a single dash. The output is purely for human-readable zip entries; no
// filesystem write happens through it directly.
function slug(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';
}

// Pull every accepted media path for a game, joined with team metadata. Both
// MiSSiONS and CityRush submission tables contribute. Selfies are returned
// separately because they don't have a mission to title themselves with.
//
// Note: teams don't store a colour at the moment; title-card backgrounds use
// a fixed dark grey. If a `team_color` column is added later, this query is
// where to surface it.
function collectMedia(db, gameId) {
  const missionRows = db.prepare(`
    SELECT t.id AS team_id, t.name AS team_name,
           COALESCE(NULLIF(m.name_de,''), NULLIF(m.name_en,''), m.name) AS mission_name,
           m.media_type AS media_type,
           tm.media_path AS media_path,
           tm.media_rotation AS rotation,
           tm.reviewed_at AS accepted_at
      FROM team_missions tm
      JOIN teams t ON t.id = tm.team_id
      JOIN missions m ON m.id = tm.mission_id
     WHERE t.game_id = ?
       AND tm.status = 'accepted'
       AND tm.media_path IS NOT NULL
     ORDER BY t.id, tm.reviewed_at`).all(gameId);

  // cr_missions uses `media_required` (photo|video|none), not media_type.
  // Normalise to the same media_type field so downstream filters don't have
  // to special-case the source table.
  const crRows = db.prepare(`
    SELECT t.id AS team_id, t.name AS team_name,
           COALESCE(NULLIF(m.name_de,''), NULLIF(m.name_en,''), 'mission') AS mission_name,
           CASE WHEN m.media_required='video' THEN 'video' ELSE 'photo' END AS media_type,
           cs.media_path AS media_path,
           cs.media_rotation AS rotation,
           cs.reviewed_at AS accepted_at
      FROM cr_submissions cs
      JOIN teams t ON t.id = cs.team_id
      JOIN cr_missions m ON m.id = cs.mission_id
     WHERE cs.game_id = ?
       AND cs.status = 'accepted'
       AND cs.media_path IS NOT NULL
     ORDER BY t.id, cs.reviewed_at`).all(gameId);

  const selfies = db.prepare(`
    SELECT id AS team_id, name AS team_name, selfie_path,
           selfie_rotation AS rotation
      FROM teams
     WHERE game_id = ? AND selfie_path IS NOT NULL`).all(gameId);

  return { missions: [...missionRows, ...crRows], selfies };
}

// Map a clockwise rotation in degrees to an ffmpeg transpose filter chain.
// transpose=1 = 90° CW, =2 = 90° CCW. 180 = two transposes.
function transposeFilter(deg) {
  const d = ((Math.round(Number(deg) / 90) % 4) + 4) % 4;
  if (d === 1) return 'transpose=1';
  if (d === 2) return 'transpose=1,transpose=1';
  if (d === 3) return 'transpose=2';
  return null;
}

// Bake a rotation into a copy of `srcAbs`, written to `outAbs`. Works for both
// images and videos (re-encode with the transpose filter). Resolves to outAbs.
function bakeRotation(srcAbs, deg, outAbs, isVideo) {
  const vf = transposeFilter(deg);
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg().input(srcAbs).videoFilters(vf);
    if (isVideo) cmd.outputOptions(['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'copy']);
    cmd.on('end', () => resolve(outAbs)).on('error', reject).save(outAbs);
  });
}

// Stream a zip of all accepted submission files + selfies to `res`. Each team
// gets its own subfolder; selfies land at <team>/00-selfie.<ext>; mission
// submissions are numbered in acceptance order. GM-applied rotations are baked
// into the exported files (lossless for the originals on disk — we only rotate
// a temp copy). Async because rotated files must be re-encoded first.
async function streamZip(db, gameId, upRoot, res) {
  const { missions, selfies } = collectMedia(db, gameId);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition',
    `attachment; filename="missions-${gameId}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', err => res.destroy(err));
  archive.pipe(res);

  // Temp dir for rotated copies; cleaned up after the archive finalizes.
  const tmpDir = path.join(upRoot, gameId, '_ziprot');
  fs.mkdirSync(tmpDir, { recursive: true });
  let rotSeq = 0;

  // Resolve the file to add: original if no rotation, else a baked temp copy.
  const resolveFile = async (abs, rotation, isVideo) => {
    if (!transposeFilter(rotation)) return abs;
    try {
      const ext = path.extname(abs) || (isVideo ? '.mp4' : '.jpg');
      const out = path.join(tmpDir, `r${rotSeq++}${ext}`);
      return await bakeRotation(abs, rotation, out, isVideo);
    } catch (e) { return abs; } // rotation failed → fall back to original
  };

  // Selfies first, grouped by team
  for (const s of selfies) {
    const abs = path.join(upRoot, s.selfie_path);
    if (!fs.existsSync(abs)) continue;
    const ext = path.extname(s.selfie_path) || '.jpg';
    const add = await resolveFile(abs, s.rotation, false);
    archive.file(add, { name: `${slug(s.team_name)}/00-selfie${ext}` });
  }

  // Submissions, numbered per team in acceptance order
  const counters = {};
  for (const m of missions) {
    const abs = path.join(upRoot, m.media_path);
    if (!fs.existsSync(abs)) continue;
    counters[m.team_id] = (counters[m.team_id] || 0) + 1;
    const isVideo = m.media_type === 'video';
    const ext = path.extname(m.media_path) || (isVideo ? '.mp4' : '.jpg');
    const idx = String(counters[m.team_id]).padStart(2, '0');
    const add = await resolveFile(abs, m.rotation, isVideo);
    archive.file(add, { name: `${slug(m.team_name)}/${idx}-${slug(m.mission_name)}${ext}` });
  }

  // Clean up temp rotated copies once the archive is fully written.
  archive.on('end', () => { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {} });

  // Even if nothing exists for the game, emit an empty (but valid) zip rather
  // than a hung connection.
  archive.finalize();
}

// Build a static photo-only collage. Videos are skipped here (they're in the
// zip). Calls onProgress({step,total,phase}) periodically so the GM can show
// a progress bar.
async function generateCollage(db, gameId, upRoot, onProgress = () => {}) {
  const { missions, selfies } = collectMedia(db, gameId);

  // Filter to photos only (we don't transcode team videos into the slideshow)
  const photoExt = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
  const photosByTeam = new Map(); // team_id → { team_name, selfie_abs, files: [] }
  const ensureTeam = (id, name) => {
    if (!photosByTeam.has(id)) photosByTeam.set(id, { team_name: name, selfie_abs: null, selfie_rotation: 0, files: [] });
    return photosByTeam.get(id);
  };
  for (const s of selfies) {
    if (!photoExt.test(s.selfie_path)) continue;
    const abs = path.join(upRoot, s.selfie_path);
    if (!fs.existsSync(abs)) continue;
    const t = ensureTeam(s.team_id, s.team_name);
    // The selfie becomes the team's title-card background (see renderTitleCardClip).
    // It's NOT added to files[] anymore — it would otherwise also appear as a
    // regular slide right after the title card showing the same image twice.
    t.selfie_abs = abs;
    t.selfie_rotation = s.rotation || 0;
  }
  for (const m of missions) {
    if (m.media_type !== 'photo' && !photoExt.test(m.media_path)) continue;
    const abs = path.join(upRoot, m.media_path);
    if (!fs.existsSync(abs)) continue;
    ensureTeam(m.team_id, m.team_name).files.push({ abs, is_selfie: false, rotation: m.rotation || 0 });
  }

  // Keep any team that has at least one photo OR a selfie (the selfie alone
  // still makes a worthwhile title card).
  const teams = [...photosByTeam.values()].filter(t => t.files.length > 0 || t.selfie_abs);
  if (teams.length === 0) throw new Error('NO_PHOTOS');

  const gameDir = path.join(upRoot, gameId);
  fs.mkdirSync(gameDir, { recursive: true });
  const workDir = path.join(gameDir, '_collage');
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  // Render each segment (title card or photo) as a fixed-length 1280×720 MP4
  // clip, then crossfade them together at the end. Each clip must be longer
  // than XFADE or the transition would consume the whole clip.
  const W = 1280, H = 720, FPS = 30;
  // Durations are GM-configurable (Settings → Collage). Read from the settings
  // table with safe fallbacks + clamping so a bad value can't break a render.
  const readNum = (key, def, min, max) => {
    try {
      const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
      const n = row ? parseFloat(row.value) : NaN;
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
    } catch (e) { return def; }
  };
  const PHOTO_SECS = readNum('collage_photo_secs', 2.5, 0.5, 30);
  const TITLE_SECS = readNum('collage_cover_secs', 5.0, 0.5, 30);
  // Convert to exact frame counts so encoded duration == nominal duration
  // (see renderPhotoClip). Offsets below are derived from these same frame
  // counts, guaranteeing every segment — including every team title card —
  // is timed identically.
  const PHOTO_FRAMES = Math.round(PHOTO_SECS * FPS);
  const TITLE_FRAMES = Math.round(TITLE_SECS * FPS);

  // Collect every "step" we'll need to render so we can report progress.
  const steps = [];
  for (const t of teams) {
    steps.push({ kind: 'title', team: t });
    for (const f of t.files) steps.push({ kind: 'photo', team: t, file: f });
  }
  const totalSteps = steps.length + 1; // +1 for the final concat
  let done = 0;

  // Tell the client the real total up front so the bar/label show "0/N"
  // immediately instead of sitting at "0/1" until the first clip finishes.
  onProgress({ step: 0, total: totalSteps, phase: 'render' });

  // Deterministic output path per step — index keeps concat order correct even
  // though clips finish out of order under the parallel pool below.
  const segmentFiles = steps.map((_, i) =>
    path.join(workDir, `seg-${String(i).padStart(4, '0')}.mp4`));

  // Bounded worker pool: keep RENDER_CONCURRENCY ffmpeg processes in flight at
  // once. A shared cursor hands out the next index; each worker loops until the
  // steps are exhausted. Order of completion doesn't matter — segmentFiles[i]
  // is fixed by index, so the concat list stays in the intended sequence.
  let nextIndex = 0;
  let failure = null;
  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= steps.length || failure) return;
      const s = steps[i];
      try {
        if (s.kind === 'title') {
          await renderTitleCardClip(s.team.team_name, s.team.selfie_abs, s.team.selfie_rotation, TITLE_FRAMES, W, H, FPS, segmentFiles[i]);
        } else {
          await renderPhotoClip(s.file.abs, s.file.rotation, PHOTO_FRAMES, W, H, FPS, segmentFiles[i]);
        }
      } catch (e) {
        failure = failure || e;
        return;
      }
      done++;
      onProgress({ step: done, total: totalSteps, phase: 'render' });
    }
  }
  const workers = [];
  for (let w = 0; w < Math.min(RENDER_CONCURRENCY, steps.length); w++) workers.push(worker());
  await Promise.all(workers);
  if (failure) throw failure;

  // Signal the stitching phase up front — it's a single ffmpeg call that can
  // take a few seconds on big games, so the label should change before it runs
  // rather than only after.
  onProgress({ step: done, total: totalSteps, phase: 'concat' });

  const outFile = path.join(gameDir, 'collage.mp4');
  // Crossfade is GM-configurable. Snap it to a whole number of frames and cap
  // it just under the shortest clip, then derive seconds from frames so the
  // xfade offsets line up exactly with the encoded clip durations.
  const xfadeReq = Math.min(readNum('collage_xfade_secs', 0.5, 0, 5), PHOTO_SECS - 0.1);
  const XFADE_FRAMES = Math.max(0, Math.min(Math.round(xfadeReq * FPS), PHOTO_FRAMES - 1));
  const XFADE = XFADE_FRAMES / FPS;
  // Per-segment durations in exact seconds (frames / FPS), matching what was
  // actually encoded — this is what keeps every title card uniformly timed.
  const segDur = steps.map(s => (s.kind === 'title' ? TITLE_FRAMES : PHOTO_FRAMES) / FPS);

  if (segmentFiles.length === 1 || XFADE_FRAMES === 0) {
    // One clip, or crossfade disabled (XFADE ~ 0) → hard cuts via the concat
    // demuxer with stream-copy (fast, no re-encode).
    const listFile = path.join(workDir, 'list.txt');
    fs.writeFileSync(listFile, segmentFiles.map(f =>
      `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
    await new Promise((resolve, reject) => {
      ffmpeg().input(listFile).inputFormat('concat').inputOptions(['-safe', '0'])
        .outputOptions(['-c', 'copy', '-movflags', '+faststart'])
        .on('end', resolve).on('error', reject).save(outFile);
    });
  } else {
    // Crossfade chain: feed every segment as an input and chain `xfade` so each
    // clip dissolves into the next. xfade overlaps the two streams by XFADE
    // seconds, so the running offset is (sum of prior clip lengths) minus the
    // crossfades already consumed. Re-encode is required (xfade blends frames),
    // but inputs are already small 720p clips so it's quick.
    await new Promise((resolve, reject) => {
      const cmd = ffmpeg();
      segmentFiles.forEach(f => cmd.input(f));
      const filters = [];
      let prevLabel = '0:v';
      let offset = segDur[0] - XFADE; // first transition starts here
      for (let i = 1; i < segmentFiles.length; i++) {
        const out = (i === segmentFiles.length - 1) ? 'v' : `x${i}`;
        filters.push(
          `[${prevLabel}][${i}:v]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(3)}[${out}]`
        );
        prevLabel = out;
        // Next clip adds its full length minus the crossfade overlap.
        offset += segDur[i] - XFADE;
      }
      cmd.complexFilter(filters, prevLabel)
        .outputOptions(['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'])
        .on('end', resolve).on('error', reject)
        .save(outFile);
    });
  }
  done++;
  onProgress({ step: done, total: totalSteps, phase: 'concat' });

  // Clean up the per-segment files; keep collage.mp4
  fs.rmSync(workDir, { recursive: true, force: true });

  const relPath = `${gameId}/collage.mp4`;
  db.prepare('UPDATE games SET collage_path=?, collage_generated_at=? WHERE id=?')
    .run(relPath, Date.now(), gameId);
  return relPath;
}

// ── Title cards without ffmpeg's lavfi/drawtext ─────────────────────────────
// The original title card used ffmpeg's `color=` (lavfi virtual device) source
// plus the `drawtext` filter (needs libfreetype). Minimal / "essentials"
// ffmpeg builds — including some that `ffmpeg-static` may resolve on a
// production `--omit=dev` install — ship WITHOUT the lavfi input device and/or
// drawtext, which surfaces as "Input format lavfi is not available".
//
// To be portable across any ffmpeg that can do the basics, we render the title
// card to a PNG entirely in Node (background + centred team name drawn with a
// built-in 5×7 bitmap font), then turn it into a clip through the exact same
// image→video path photos use. That path needs only the image2 demuxer +
// libx264, which every real build has.

const zlib = require('zlib');

// Encode raw RGBA (Buffer, W*H*4) as a PNG buffer. Self-contained, no deps.
function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const src = y * width * 4;
    const dst = y * (width * 4 + 1);
    raw[dst] = 0; // filter: none
    rgba.copy(raw, dst + 1, src, src + width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 6 });
  const crcTable = encodePng._crc || (encodePng._crc = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
    return t;
  })());
  const crc32 = buf => { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0, 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Real Inter (the app's team-name font, --body) rendered with opentype.js so
// the collage title matches the UI. Loaded once and cached. We render
// glyph-by-glyph (charToGlyph + per-glyph getPath) and advance manually rather
// than font.getPath(string), because Inter's woff trips opentype's not-yet-
// implemented GSUB substitution path on whole-string layout — per-glyph
// outlines are unaffected.
const TITLE_FONT_PATH = path.resolve(__dirname, '..', 'assets', 'fonts', 'BigShouldersStencil-800.woff');
let _titleFont; // lazy, cached
function titleFont() {
  if (_titleFont !== undefined) return _titleFont;
  try {
    const b = fs.readFileSync(TITLE_FONT_PATH);
    _titleFont = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  } catch (e) {
    console.warn('collage: could not load title font, titles will have no text:', e.message);
    _titleFont = null;
  }
  return _titleFont;
}

function sanitizeName(teamName) {
  // Keep it to a sane length; preserve the actual casing/letters (Inter has the
  // glyphs, incl. accents). Strip control chars only.
  return String(teamName || '').toUpperCase().replace(/\s+/g, ' ').trim().slice(0, 28) || 'TEAM';
}

// Flatten an opentype Path's commands into closed polygons (arrays of [x,y]).
function pathToPolys(cmds) {
  const polys = []; let cur = null, px = 0, py = 0, sx = 0, sy = 0;
  const lineTo = (x, y) => { cur.push([x, y]); px = x; py = y; };
  for (const c of cmds) {
    if (c.type === 'M') { if (cur && cur.length) polys.push(cur); cur = [[c.x, c.y]]; sx = c.x; sy = c.y; px = c.x; py = c.y; }
    else if (c.type === 'L') lineTo(c.x, c.y);
    else if (c.type === 'C') { const n = 16, x0 = px, y0 = py; for (let i = 1; i <= n; i++) { const t = i/n, m = 1-t; lineTo(m*m*m*x0+3*m*m*t*c.x1+3*m*t*t*c.x2+t*t*t*c.x, m*m*m*y0+3*m*m*t*c.y1+3*m*t*t*c.y2+t*t*t*c.y); } }
    else if (c.type === 'Q') { const n = 12, x0 = px, y0 = py; for (let i = 1; i <= n; i++) { const t = i/n, m = 1-t; lineTo(m*m*x0+2*m*t*c.x1+t*t*c.x, m*m*y0+2*m*t*c.y1+t*t*c.y); } }
    else if (c.type === 'Z') { if (cur) cur.push([sx, sy]); }
  }
  if (cur && cur.length) polys.push(cur);
  return polys;
}

// Accumulate ANTI-ALIASED coverage [0..1] for a set of glyph polygons into a
// Float32 coverage map (W*H), offset by (ox,oy). Coverage = fraction of SS×SS
// sub-samples inside the even-odd fill, giving smooth edges instead of the old
// 1-bit scanline fill that made the text look choppy/low quality.
function accumulateCoverage(polys, W, H, ox, oy, cov, SS) {
  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
  for (const p of polys) for (const pt of p) {
    if (pt[1] < minY) minY = pt[1]; if (pt[1] > maxY) maxY = pt[1];
    if (pt[0] < minX) minX = pt[0]; if (pt[0] > maxX) maxX = pt[0];
  }
  if (!isFinite(minY)) return;
  const y0 = Math.max(0, Math.floor(minY + oy)), y1 = Math.min(H - 1, Math.ceil(maxY + oy));
  const x0 = Math.max(0, Math.floor(minX + ox)), x1 = Math.min(W - 1, Math.ceil(maxX + ox));
  if (y1 < y0 || x1 < x0) return;
  const inc = 1 / (SS * SS);
  const xsArr = [];
  for (let y = y0; y <= y1; y++) {
    for (let s = 0; s < SS; s++) {
      const yc = (y - oy) + (s + 0.5) / SS; // sub-scanline in glyph space
      xsArr.length = 0;
      for (const p of polys) for (let i = 0; i < p.length - 1; i++) {
        const ay = p[i][1], by = p[i+1][1];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xsArr.push(p[i][0] + (yc - ay) / (by - ay) * (p[i+1][0] - p[i][0]));
      }
      if (xsArr.length < 2) continue;
      xsArr.sort((m, n) => m - n);
      for (let i = 0; i + 1 < xsArr.length; i += 2) {
        const spanA = xsArr[i] + ox, spanB = xsArr[i+1] + ox;
        const pxa = Math.max(x0, Math.floor(spanA)), pxb = Math.min(x1, Math.ceil(spanB) - 1);
        for (let x = pxa; x <= pxb; x++) {
          // horizontal sub-pixel coverage of this pixel cell [x, x+1)
          for (let sx = 0; sx < SS; sx++) {
            const xc = x + (sx + 0.5) / SS;
            if (xc >= spanA && xc < spanB) cov[y * W + x] += inc;
          }
        }
      }
    }
  }
}

// Composite a solid colour into rgba using a coverage map (premultiplied "over").
function compositeCoverage(rgba, W, H, cov, r, g, b, maxA) {
  for (let i = 0; i < W * H; i++) {
    let c = cov[i]; if (c <= 0) continue; if (c > 1) c = 1;
    const a = c * (maxA / 255);
    const o = i * 4;
    const ia = 1 - a;
    rgba[o]   = Math.round(r * a + rgba[o]   * ia);
    rgba[o+1] = Math.round(g * a + rgba[o+1] * ia);
    rgba[o+2] = Math.round(b * a + rgba[o+2] * ia);
    rgba[o+3] = Math.min(255, Math.round(a * 255 + rgba[o+3] * ia));
  }
}

// Draw `text` in the title font, horizontally centred, vertical centre on `cy`.
// White glyphs with a soft dark drop-shadow so the name reads over any selfie.
// Uses 4× supersampled coverage for smooth, high-quality anti-aliased edges.
// `scaleFrac` = target text width as a fraction of W; `maxHFrac` caps height.
function drawCenteredText(rgba, W, H, text, cy, scaleFrac, maxHFrac) {
  const font = titleFont();
  if (!font) return; // font missing → background-only card (graceful)
  const upm = font.unitsPerEm;

  let widthEm = 0;
  const glyphs = [];
  for (const ch of text) { const g = font.charToGlyph(ch); glyphs.push(g); widthEm += (g.advanceWidth || 0); }
  if (widthEm <= 0) return;
  const byWidth  = (W * scaleFrac) / (widthEm / upm);
  const byHeight = (H * maxHFrac) / 1.0;
  const size = Math.max(12, Math.min(byWidth, byHeight));
  const scale = size / upm;
  const totalW = (widthEm / upm) * size;

  let penX = (W - totalW) / 2;
  const baseline = cy + size * 0.36;
  const sh = Math.max(1, Math.round(size * 0.045)); // shadow offset
  const SS = 4; // supersampling factor per axis

  // Build one coverage map for the whole word, then composite shadow + glyph.
  const cov = new Float32Array(W * H);
  for (const g of glyphs) {
    const polys = pathToPolys(g.getPath(penX, baseline, size).commands);
    accumulateCoverage(polys, W, H, 0, 0, cov, SS);
    penX += (g.advanceWidth || 0) * scale;
  }
  // Shadow = same coverage shifted; recompute cheaply by reusing cov shifted.
  const shadowCov = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sxp = x - sh, syp = y - sh;
    if (sxp >= 0 && syp >= 0) shadowCov[y * W + x] = cov[syp * W + sxp];
  }
  compositeCoverage(rgba, W, H, shadowCov, 0, 0, 0, 0xCC);   // soft shadow
  compositeCoverage(rgba, W, H, cov,       0xFF, 0xFF, 0xFF, 0xFF); // white glyphs
}

// Transparent overlay PNG: just the team name near the bottom-centre, for
// compositing over a selfie via ffmpeg's core `overlay` filter.
function textOverlayPng(teamName, W, H) {
  const rgba = Buffer.alloc(W * H * 4); // all zero = fully transparent
  // Darken a band behind the text so white stays readable over light selfies.
  const bandH = Math.round(H * 0.22), bandY = H - bandH;
  for (let y = bandY; y < H; y++) {
    // vertical gradient: stronger at the very bottom
    const a = Math.round(0x99 * (y - bandY) / bandH);
    for (let x = 0; x < W; x++) { const o = (y*W+x)*4; rgba[o]=0; rgba[o+1]=0; rgba[o+2]=0; rgba[o+3]=a; }
  }
  drawCenteredText(rgba, W, H, sanitizeName(teamName), H - Math.round(H * 0.11), 0.7, 0.16);
  return encodePng(W, H, rgba);
}

// Solid black card with the team name near the bottom-centre, baked in. Used
// when a team has no selfie.
function blackCardPng(teamName, W, H) {
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) rgba[i*4+3] = 0xFF; // opaque black (RGB already 0)
  drawCenteredText(rgba, W, H, sanitizeName(teamName), H - Math.round(H * 0.11), 0.7, 0.16);
  return encodePng(W, H, rgba);
}

// Render a team's title card:
//   • selfie present → scale/pad the selfie to frame, overlay the name PNG.
//   • no selfie      → black card with the name baked in.
// Uses only the image2 demuxer + core scale/pad/overlay filters — no lavfi,
// no drawtext — so it runs on any ffmpeg build. Temp PNGs live in workDir and
// are cleaned up with everything else.
// IMPORTANT: clips are sized by an exact FRAME COUNT, not "-t seconds". With
// "-t 2.5" libx264 actually emits ~2.53s (it rounds up to whole frames + muxer
// overhead), and because the xfade chain uses ABSOLUTE offsets from the start
// of the whole video, that per-clip overshoot makes every transition after the
// first drift — so the 2nd, 3rd… team title cards stop lining up with their
// crossfades. Pinning each clip to round(secs*FPS) frames makes the real
// duration equal the nominal one to the frame, so every title card (first or
// last) gets identical timing.
function renderTitleCardClip(teamName, selfieAbs, rotation, frames, W, H, FPS, out) {
  if (selfieAbs && fs.existsSync(selfieAbs)) {
    const overlayPng = out.replace(/\.mp4$/i, '.overlay.png');
    fs.writeFileSync(overlayPng, textOverlayPng(teamName, W, H));
    // Apply the GM's rotation to the selfie before fitting it to frame.
    const tp = transposeFilter(rotation);
    const bgChain = (tp ? tp + ',' : '') +
      `scale=w=${W}:h=${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(selfieAbs).inputOptions(['-loop', '1'])
        .input(overlayPng).inputOptions(['-loop', '1'])
        .complexFilter([
          `[0:v]${bgChain}[bg]`,
          `[bg][1:v]overlay=0:0:format=auto[v]`,
        ], 'v')
        .outputOptions(['-r', String(FPS), '-frames:v', String(frames), '-c:v', 'libx264', '-pix_fmt', 'yuv420p'])
        .on('end', resolve).on('error', reject)
        .save(out);
    });
  }
  const png = out.replace(/\.mp4$/i, '.png');
  fs.writeFileSync(png, blackCardPng(teamName, W, H));
  return renderPhotoClip(png, 0, frames, W, H, FPS, out); // generated PNG is upright
}

// A still-image clip: optional rotation, then pad/letterbox to 1280×720, held
// for an exact `frames` count (see renderTitleCardClip for why frames).
function renderPhotoClip(abs, rotation, frames, W, H, FPS, out) {
  const tp = transposeFilter(rotation);
  const filters = [];
  if (tp) filters.push(tp);
  filters.push(
    `scale=w=${W}:h=${H}:force_original_aspect_ratio=decrease`,
    `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black`,
    `setsar=1`,
  );
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(abs)
      .inputOptions(['-loop', '1'])
      .videoFilters(filters)
      .outputOptions(['-r', String(FPS), '-frames:v', String(frames), '-c:v', 'libx264', '-pix_fmt', 'yuv420p'])
      .on('end', resolve).on('error', reject)
      .save(out);
  });
}

module.exports = { streamZip, generateCollage, collectMedia };
