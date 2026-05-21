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
const archiver = require('archiver');
const ffmpegStatic = require('ffmpeg-static');
const ffmpeg   = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegStatic);

const FONT_PATH = path.resolve(__dirname, '..', 'assets', 'fonts', 'Inter-Bold.ttf');

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
           cs.reviewed_at AS accepted_at
      FROM cr_submissions cs
      JOIN teams t ON t.id = cs.team_id
      JOIN cr_missions m ON m.id = cs.mission_id
     WHERE cs.game_id = ?
       AND cs.status = 'accepted'
       AND cs.media_path IS NOT NULL
     ORDER BY t.id, cs.reviewed_at`).all(gameId);

  const selfies = db.prepare(`
    SELECT id AS team_id, name AS team_name, selfie_path
      FROM teams
     WHERE game_id = ? AND selfie_path IS NOT NULL`).all(gameId);

  return { missions: [...missionRows, ...crRows], selfies };
}

// Stream a zip of all accepted submission files + selfies to `res`. Each team
// gets its own subfolder; selfies land at <team>/00-selfie.<ext>; mission
// submissions are numbered in acceptance order.
function streamZip(db, gameId, upRoot, res) {
  const { missions, selfies } = collectMedia(db, gameId);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition',
    `attachment; filename="missions-${gameId}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', err => res.destroy(err));
  archive.pipe(res);

  // Selfies first, grouped by team
  for (const s of selfies) {
    const abs = path.join(upRoot, s.selfie_path);
    if (!fs.existsSync(abs)) continue;
    const ext = path.extname(s.selfie_path) || '.jpg';
    archive.file(abs, { name: `${slug(s.team_name)}/00-selfie${ext}` });
  }

  // Submissions, numbered per team in acceptance order
  const counters = {};
  for (const m of missions) {
    const abs = path.join(upRoot, m.media_path);
    if (!fs.existsSync(abs)) continue;
    counters[m.team_id] = (counters[m.team_id] || 0) + 1;
    const ext = path.extname(m.media_path) || (m.media_type === 'video' ? '.mp4' : '.jpg');
    const idx = String(counters[m.team_id]).padStart(2, '0');
    archive.file(abs, {
      name: `${slug(m.team_name)}/${idx}-${slug(m.mission_name)}${ext}`,
    });
  }

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
  const photosByTeam = new Map(); // team_id → { team_name, files: [] }
  for (const s of selfies) {
    if (!photoExt.test(s.selfie_path)) continue;
    const abs = path.join(upRoot, s.selfie_path);
    if (!fs.existsSync(abs)) continue;
    if (!photosByTeam.has(s.team_id)) {
      photosByTeam.set(s.team_id, { team_name: s.team_name, files: [] });
    }
    photosByTeam.get(s.team_id).files.push({ abs, is_selfie: true });
  }
  for (const m of missions) {
    if (m.media_type !== 'photo' && !photoExt.test(m.media_path)) continue;
    const abs = path.join(upRoot, m.media_path);
    if (!fs.existsSync(abs)) continue;
    if (!photosByTeam.has(m.team_id)) {
      photosByTeam.set(m.team_id, { team_name: m.team_name, files: [] });
    }
    photosByTeam.get(m.team_id).files.push({ abs, is_selfie: false });
  }

  const teams = [...photosByTeam.values()].filter(t => t.files.length > 0);
  if (teams.length === 0) throw new Error('NO_PHOTOS');

  const gameDir = path.join(upRoot, gameId);
  fs.mkdirSync(gameDir, { recursive: true });
  const workDir = path.join(gameDir, '_collage');
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  // Render each segment (title card or photo) as a fixed-length 1280×720 MP4
  // clip. We concat them all at the end. This keeps the ffmpeg pipeline
  // small and predictable — no exotic xfade graph spanning N inputs.
  const W = 1280, H = 720, FPS = 30;
  const PHOTO_SECS = 2.5;
  const TITLE_SECS = 1.5;

  // Collect every "step" we'll need to render so we can report progress.
  const steps = [];
  for (const t of teams) {
    steps.push({ kind: 'title', team: t });
    for (const f of t.files) steps.push({ kind: 'photo', team: t, file: f });
  }
  const totalSteps = steps.length + 1; // +1 for the final concat
  let done = 0;

  const segmentFiles = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const out = path.join(workDir, `seg-${String(i).padStart(4,'0')}.mp4`);
    if (s.kind === 'title') {
      await renderTitleCardClip(s.team.team_name, TITLE_SECS, W, H, FPS, out);
    } else {
      await renderPhotoClip(s.file.abs, PHOTO_SECS, W, H, FPS, out);
    }
    segmentFiles.push(out);
    done++;
    onProgress({ step: done, total: totalSteps, phase: 'render' });
  }

  // Final concat — write a list file then call ffmpeg's concat demuxer
  const listFile = path.join(workDir, 'list.txt');
  fs.writeFileSync(listFile, segmentFiles.map(f =>
    `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));

  const outFile = path.join(gameDir, 'collage.mp4');
  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(listFile)
      .inputFormat('concat')
      .inputOptions(['-safe', '0'])
      .outputOptions(['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'])
      .on('end', resolve).on('error', reject)
      .save(outFile);
  });
  done++;
  onProgress({ step: done, total: totalSteps, phase: 'concat' });

  // Clean up the per-segment files; keep collage.mp4
  fs.rmSync(workDir, { recursive: true, force: true });

  const relPath = `${gameId}/collage.mp4`;
  db.prepare('UPDATE games SET collage_path=?, collage_generated_at=? WHERE id=?')
    .run(relPath, Date.now(), gameId);
  return relPath;
}

// A solid-colour 1280×720 title card with the team name centred. Teams
// don't store a colour yet, so all cards use the same dark-grey background.
// (If a per-team accent colour is added later, just thread it through here.)
function renderTitleCardClip(teamName, secs, W, H, FPS, out) {
  // ffmpeg's `color=c=` filter expects a full 6-digit hex (or a named colour).
  // Three-digit shorthand like "222" is rejected — must be "0x222222".
  const bg = '0x222222';
  const text = String(teamName || '')
    .replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "'\\''");
  // ffmpeg on Windows wants forward-slash paths inside filter expressions
  const fontfile = FONT_PATH.replace(/\\/g, '/').replace(/:/g, '\\:');
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`color=c=${bg}:s=${W}x${H}:r=${FPS}:d=${secs}`)
      .inputFormat('lavfi')
      .videoFilters([
        `drawtext=fontfile='${fontfile}':text='${text}':fontsize=84:fontcolor=white:` +
        `borderw=3:bordercolor=black@0.45:x=(w-text_w)/2:y=(h-text_h)/2`,
      ])
      .outputOptions(['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(FPS)])
      .on('end', resolve).on('error', reject)
      .save(out);
  });
}

// A still-image clip: pad/letterbox to 1280×720, hold for `secs` seconds.
function renderPhotoClip(abs, secs, W, H, FPS, out) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(abs)
      .inputOptions(['-loop', '1', '-t', String(secs)])
      .videoFilters([
        `scale=w=${W}:h=${H}:force_original_aspect_ratio=decrease`,
        `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black`,
        `setsar=1`,
      ])
      .outputOptions(['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(FPS)])
      .on('end', resolve).on('error', reject)
      .save(out);
  });
}

module.exports = { streamZip, generateCollage, collectMedia };
