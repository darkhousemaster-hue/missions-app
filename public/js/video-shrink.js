/* Video shrink. A clip picked from the phone's gallery is often filmed in 4K,
 * which runs past the 100 MB one request may carry through the Cloudflare
 * tunnel, so the upload died. Before a video goes up, this makes a 1080p
 * H.264 copy on the phone itself: WebCodecs through Mediabunny (MPL-2.0,
 * vendored in js/vendor), which uses the phone's own video encoder and copies
 * the sound across untouched.
 *
 * shrinkVideo(file, { maxBytes, text }) resolves to the file to upload: the
 * smaller copy, or the original when it is already at most 1080p and not big,
 * or when this browser can't make a copy (the caller's size check decides
 * then). It resolves null only when the player taps Cancel. `text` holds the
 * progress card's { title, hint, cancel } in the player's language.
 */
const LIB = '/js/vendor/mediabunny-1.61.5.min.js';
const BOX_1080 = [1920, 1080], BOX_720 = [1280, 720];
const VIDEO_BPS = 6e6;      // plenty for a phone clip at 1080p
const AUDIO_BPS = 192e3;    // allowance for the copied sound
const STALL_MS = 30000;     // no progress for this long: give up and send the original

export async function shrinkVideo(file, { maxBytes = 100 * 1048576, text = {} } = {}) {
  if (!file || typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') return file;
  const small = () => file.size <= maxBytes * 0.4;
  // At most 1080p and small: nothing to do, and no library to load.
  const meta = await probe(file);
  if (meta && fits(meta.w, meta.h) && small()) return file;

  const ui = overlay(text);
  let conversion = null;
  const canceled = new Promise(resolve => {
    ui.onCancel = () => { ui.close(); if (conversion) conversion.cancel().catch(() => {}); resolve(null); };
  });
  const work = (async () => {
    let input = null;
    try {
      const mb = await import(LIB);
      if (ui.canceled) return null;
      input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) });
      const video = await input.getPrimaryVideoTrack();
      if (!video) return file;
      const w = video.displayWidth, h = video.displayHeight;
      const duration = await input.computeDuration();
      if (!(w > 0 && h > 0 && duration > 0) || (fits(w, h) && small())) return file;

      // A bitrate that keeps the copy well inside the upload limit even for a
      // long clip; once that gets thin, 720p looks better than starved 1080p.
      const room = (maxBytes * 0.8 * 8) / duration - AUDIO_BPS;
      const bitrate = Math.round(Math.max(1e6, Math.min(VIDEO_BPS, room)));
      const [long, short] = bitrate < 2.5e6 ? BOX_720 : BOX_1080;
      const scale = Math.min(1, long / Math.max(w, h), short / Math.min(w, h));
      const even = n => Math.max(2, Math.round(n * scale / 2) * 2);   // H.264 wants even sizes
      const width = even(w), height = even(h);
      const quality = new mb.Quality({ bitrate });
      if (!(await mb.canEncodeVideo('avc', { width, height, quality }))) return file;
      const stats = await video.computePacketStats(90).catch(() => null);
      // One sound track, AAC when there is one: new iPhones add a spatial
      // track next to the stereo one, and only the stereo one fits an MP4.
      const audios = await input.getAudioTracks();
      const sound = audios.find(t => t.codec === 'aac') || audios[0] || null;

      const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() });
      conversion = await mb.Conversion.init({
        input, output, showWarnings: false,
        video: t => t.id !== video.id ? { discard: true } : {
          width, height, fit: 'fill', codec: 'avc', quality, forceTranscode: true,
          allowTransformationMetadata: false,          // bake a portrait clip's rotation into the frames
          ...(stats && stats.averagePacketRate > 31 ? { frameRate: 30 } : {}),
        },
        audio: t => (sound && t.id === sound.id ? {} : { discard: true }),
      });
      // A copy without its picture or sound is no use as proof: keep the original.
      const kept = id => conversion.utilizedTracks.some(t => t.id === id);
      if (!conversion.isValid || !kept(video.id) || (sound && !kept(sound.id))) return file;
      if (ui.canceled) return null;

      let last = Date.now();
      conversion.onProgress = p => { last = Date.now(); ui.progress(p); };
      const watchdog = setInterval(() => {
        if (Date.now() - last > STALL_MS) conversion.cancel().catch(() => {});
      }, 2000);
      try { await conversion.execute(); } finally { clearInterval(watchdog); }

      const name = (file.name || 'video').replace(/\.[^.]*$/, '') + '.mp4';
      const copy = new File([output.target.buffer], name, { type: 'video/mp4' });
      return copy.size < file.size ? copy : file;
    } catch (e) {
      if (ui.canceled) return null;
      console.warn('[video-shrink] sending the original instead:', e);
      return file;
    } finally {
      if (input) { try { input.dispose(); } catch (e) {} }
    }
  })();
  try { return await Promise.race([work, canceled]); }
  finally { ui.close(); }
}

const fits = (w, h) => Math.max(w, h) <= BOX_1080[0] && Math.min(w, h) <= BOX_1080[1];

// Picture size from the browser's own player: quick, and needs no library.
// null when it can't read the file (HEVC in a browser without HEVC).
function probe(file) {
  return new Promise(resolve => {
    const v = document.createElement('video');
    let url = null, done = false;
    const finish = r => {
      if (done) return;
      done = true;
      v.removeAttribute('src');
      try { v.load(); } catch (e) {}
      if (url) URL.revokeObjectURL(url);
      resolve(r);
    };
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => finish(v.videoWidth && v.videoHeight ? { w: v.videoWidth, h: v.videoHeight } : null);
    v.onerror = () => finish(null);
    setTimeout(() => finish(null), 4000);
    try { url = URL.createObjectURL(file); v.src = url; } catch (e) { finish(null); }
  });
}

// The progress card, styled by .vshrink in app.css.
function overlay(text) {
  const el = document.createElement('div');
  el.className = 'vshrink';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'vshrink-title');
  el.innerHTML = '<div class="vshrink-card">'
    + '<p class="vshrink-title" id="vshrink-title"></p><p class="vshrink-hint"></p>'
    + '<div class="vshrink-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="vshrink-fill"></div></div>'
    + '<p class="vshrink-pct">0 %</p>'
    + '<button type="button" class="btn btn-ghost vshrink-cancel"></button></div>';
  el.querySelector('.vshrink-title').textContent = text.title || '';
  el.querySelector('.vshrink-hint').textContent = text.hint || '';
  const track = el.querySelector('.vshrink-track'), fill = el.querySelector('.vshrink-fill'), pct = el.querySelector('.vshrink-pct');
  const btn = el.querySelector('.vshrink-cancel');
  btn.textContent = text.cancel || '';
  const ui = {
    canceled: false,
    onCancel: null,
    progress(p) {
      const n = Math.max(0, Math.min(100, Math.round(p * 100)));
      fill.style.transform = 'scaleX(' + n / 100 + ')';
      track.setAttribute('aria-valuenow', String(n));
      pct.textContent = n + ' %';
    },
    close() { el.remove(); },
  };
  btn.onclick = () => { ui.canceled = true; btn.disabled = true; if (ui.onCancel) ui.onCancel(); };
  document.body.appendChild(el);
  btn.focus({ preventScroll: true });
  return ui;
}
