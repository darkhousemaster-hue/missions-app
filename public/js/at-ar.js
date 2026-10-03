/* AdventureTrail pattern AR. The camera looks for a pattern (a printed card,
 * a plaque, a poster) and pins a 3D object, a picture or a video to it, at
 * the size, angle and placement the studio set.
 *
 * Built on MindAR (MIT, image tracking in plain JavaScript on the camera feed,
 * so it runs in Safari on the iPhone as well, no app and no WebXR) and
 * three.js. Both come through the page's import map, pinned to versions that
 * work together: this MindAR build still imports sRGBEncoding, which three.js
 * dropped in 0.162.
 *
 * On the pattern, the centre is the origin, the width is one unit and the
 * height is `aspect` units; y runs up the picture and z out of it.
 */
import * as THREE from 'three';
import { MindARThree } from 'mindar-image-three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const fail = (code, cause) => Object.assign(new Error(code), { code, cause });
export const PLACES = ['stand', 'front', 'flat'];
export const placeOf = cfg => PLACES.includes(cfg.place) ? cfg.place : (cfg.show === 'model' ? 'stand' : 'flat');

// ── Patterns ─────────────────────────────────────────────────────────────────
// A picture becomes what the tracker looks for, in the browser, in a few
// seconds. It is first brought to a sensible size on white, and that exact
// picture is what gets stored, so the pattern and its target always match.
const PATTERN_MAX = 900;
function imageOf(blob) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob), img = new Image();
    img.onload = () => res(img);
    img.onerror = () => { URL.revokeObjectURL(url); rej(fail('bad_image')); };
    img.src = url;
  });
}
export async function compilePattern(file, onProgress) {
  const src = await imageOf(file);
  const k = Math.min(1, PATTERN_MAX / Math.max(src.naturalWidth, src.naturalHeight));
  const w = Math.max(1, Math.round(src.naturalWidth * k)), h = Math.max(1, Math.round(src.naturalHeight * k));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.drawImage(src, 0, 0, w, h);
  URL.revokeObjectURL(src.src);
  const image = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.92));
  if (!image) throw fail('bad_image');
  const img = await imageOf(image);
  let Compiler;
  try { ({ Compiler } = await import('mindar-image')); } catch (e) { throw fail('offline', e); }
  const compiler = new Compiler();
  await compiler.compileImageTargets([img], p => { if (onProgress) onProgress(Math.min(100, Math.round(p))); });
  URL.revokeObjectURL(img.src);
  // What the tracker can hold on to. A plain logo or a few words give it
  // almost nothing, and it then loses the pattern as soon as the phone moves.
  const d = compiler.data && compiler.data[0];
  const points = d ? (d.trackingData || []).reduce((s, t) => s + ((t.points || []).length), 0) : 0;
  return { mind: await compiler.exportData(), image, width: w, height: h, points,
           quality: points >= 40 ? 'good' : points >= 12 ? 'ok' : 'poor' };
}

// ── Content ──────────────────────────────────────────────────────────────────
// stand: the pattern is the floor, the content rises out of it, facing whoever
//        reads the pattern the right way up. For a card on a table or the ground.
// front: the content stands in front of the pattern on its lower edge. For a
//        poster or a plaque on a wall.
// flat:  the content lies on the pattern itself, a picture or film over it.
// Size is the content's longest side, in pattern widths.
function shadowDisc() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'), r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}
// With nothing to show, the pattern gets a gold frame, so the team still sees
// that the camera has found it.
function frame(aspect) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xE8B23A, transparent: true, opacity: 0.95, depthTest: false });
  const t = 0.025;
  for (const [w, h, x, y] of [[1 + t, t, 0, aspect / 2], [1 + t, t, 0, -aspect / 2], [t, aspect, -0.5, 0], [t, aspect, 0.5, 0]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, 0.004); m.renderOrder = 2; g.add(m);
  }
  return g;
}
export async function buildContent(cfg) {
  const root = new THREE.Group();
  const show = ['model', 'image', 'video'].includes(cfg.show) && cfg.src ? cfg.show : 'none';
  const place = placeOf({ ...cfg, show });
  const size = num(cfg.scale, 0.1, 10, 1), aspect = num(cfg.aspect, 0.1, 10, 1);
  const rot = num(cfg.rot, -360, 360, 0) * Math.PI / 180;
  const out = { root, media: null, tick: null, show, place };
  if (show === 'none') { root.add(frame(aspect)); return out; }

  // The content, scaled, centred, standing on y = 0 and facing +z.
  let obj, mixer = null;
  if (show === 'model') {
    let gltf;
    try { gltf = await new GLTFLoader().loadAsync(cfg.src); } catch (e) { throw fail('content', e); }
    const model = gltf.scene;
    const s = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    model.scale.setScalar(size / (Math.max(s.x, s.y, s.z) || 1));
    const b = new THREE.Box3().setFromObject(model), c = b.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -b.min.y, -c.z);
    if (gltf.animations && gltf.animations.length) {
      mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach(a => mixer.clipAction(a).play());
    }
    obj = new THREE.Group(); obj.add(model);
  } else {
    let tex, a;
    if (show === 'video') {
      const v = document.createElement('video');
      v.loop = true; v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
      v.crossOrigin = 'anonymous'; v.src = cfg.src;
      await new Promise(res => { v.onloadedmetadata = res; v.onerror = res; setTimeout(res, 8000); });
      if (!v.videoWidth) throw fail('content');
      a = v.videoHeight / v.videoWidth;
      tex = new THREE.VideoTexture(v);
      out.media = v;
    } else {
      try { tex = await new THREE.TextureLoader().loadAsync(cfg.src); } catch (e) { throw fail('content', e); }
      a = tex.image && tex.image.width ? tex.image.height / tex.image.width : 1;
    }
    tex.colorSpace = THREE.SRGBColorSpace;
    const w = a > 1 ? size / a : size, h = w * a;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
    plane.position.y = h / 2;
    obj = new THREE.Group(); obj.add(plane);
  }

  const spin = new THREE.Group(); spin.add(obj); root.add(spin);
  if (place === 'flat') {
    // Centred, so it turns about its middle.
    const b = new THREE.Box3().setFromObject(obj);
    obj.position.y = -(b.max.y + b.min.y) / 2;
    spin.rotation.z = rot;
  } else obj.rotation.y = rot;
  const box = new THREE.Box3().setFromObject(spin);
  if (place === 'stand') {
    spin.rotation.x = Math.PI / 2;
    if (show === 'model') {
      const sh = shadowDisc(), foot = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 1.35;
      sh.scale.set(foot, foot, 1); sh.position.y = 0.002; spin.add(sh);
    }
  } else {
    // In front of the pattern, never through it.
    spin.position.z = -box.min.z + 0.004;
    if (place === 'front') spin.position.y = -aspect / 2 - box.min.y;
  }
  if (mixer) { const clock = new THREE.Clock(); out.tick = () => mixer.update(clock.getDelta()); }
  return out;
}
function light(scene, renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3530, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(0.4, 1, 1.2); scene.add(sun);
}

// ── Through the camera ───────────────────────────────────────────────────────
// cfg: { mind, show, src, place, scale, rot, aspect }
// hooks: { onFound, onLost }
// Errors carry a code: unsupported, denied, nocamera, busy, camera, offline, content.
export async function startAR(container, cfg, hooks = {}) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw fail('unsupported');
  // The camera is asked for here rather than inside MindAR, which swallows the
  // reason when it is refused. MindAR is then handed the stream it would have
  // asked for; 1.2.5, pinned in the import map, asks exactly once in start().
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'environment' } }); }
  catch (e) {
    const n = e && e.name;
    throw fail(n === 'NotAllowedError' || n === 'SecurityError' ? 'denied'
      : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'nocamera'
      : n === 'NotReadableError' || n === 'AbortError' ? 'busy' : 'camera', e);
  }
  const drop = () => stream.getTracks().forEach(t => t.stop());
  let mt, content;
  try {
    mt = new MindARThree({ container, imageTargetSrc: cfg.mind, uiLoading: 'no', uiScanning: 'no', uiError: 'no' });
  } catch (e) { drop(); container.replaceChildren(); throw fail('unsupported', e); }
  const { renderer, scene, camera } = mt;
  const anchor = mt.addAnchor(0);
  const quit = () => { drop(); renderer.dispose(); renderer.forceContextLoss(); container.replaceChildren(); };
  try {
    light(scene, renderer);
    content = await buildContent(cfg);
  } catch (e) { quit(); throw e.code ? e : fail('content', e); }
  anchor.group.add(content.root);
  const media = content.media;
  anchor.onTargetFound = () => { if (media) media.play().catch(() => {}); if (hooks.onFound) hooks.onFound(); };
  anchor.onTargetLost = () => { if (media) media.pause(); if (hooks.onLost) hooks.onLost(); };

  const md = navigator.mediaDevices;
  md.getUserMedia = () => Promise.resolve(stream);
  try { await mt.start(); }
  catch (e) {
    delete md.getUserMedia; quit();
    // The target is fetched inside start(); a failure there is the network.
    throw fail('offline', e);
  }
  delete md.getUserMedia;
  renderer.setAnimationLoop(() => { if (content.tick) content.tick(); renderer.render(scene, camera); });
  let stopped = false;
  return {
    sound(on) { if (media) { media.muted = !on; if (on) media.play().catch(() => {}); } },
    stop() {
      if (stopped) return; stopped = true;
      renderer.setAnimationLoop(null);
      try { mt.stop(); } catch (e) { drop(); }
      // MindAR keeps a resize listener it never removes; without a video it
      // returns straight away.
      mt.video = null;
      if (media) { media.pause(); media.removeAttribute('src'); media.load(); }
      renderer.dispose(); renderer.forceContextLoss();
      container.replaceChildren();
    },
  };
}

// ── Preview in the studio ────────────────────────────────────────────────────
// The pattern as it will lie or hang, with the content on it, to turn with the
// mouse. No camera needed.
export async function previewAR(container, cfg) {
  let OrbitControls;
  try { ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js')); } catch (e) { throw fail('offline', e); }
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.replaceChildren(renderer.domElement);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  const scene = new THREE.Scene();
  light(scene, renderer);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.enablePan = false;
  const world = new THREE.Group(); scene.add(world);
  const aspect = num(cfg.aspect, 0.1, 10, 1);
  let patternTex = null;
  if (cfg.pattern) {
    try { patternTex = await new THREE.TextureLoader().loadAsync(cfg.pattern); patternTex.colorSpace = THREE.SRGBColorSpace; } catch (e) {}
  }
  world.add(new THREE.Mesh(new THREE.PlaneGeometry(1, aspect),
    new THREE.MeshBasicMaterial(patternTex ? { map: patternTex, toneMapped: false } : { color: 0x8a8378 })));
  let content = null, gen = 0, stopped = false;
  const free = m => { if (m) { m.pause(); m.removeAttribute('src'); m.load(); } };
  const fitSize = () => {
    const w = container.clientWidth || 300, h = container.clientHeight || 200;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fitSize) : null;
  if (ro) ro.observe(container);
  async function update(next) {
    if (stopped) return;
    cfg = { ...cfg, ...next };
    const mine = ++gen;
    const built = await buildContent(cfg);
    if (mine !== gen) { free(built.media); return; }
    if (content) { world.remove(content.root); free(content.media); }
    content = built;
    if (content.media) content.media.play().catch(() => {});
    world.add(content.root);
    // A pattern for standing on lies on the table; the others hang on a wall.
    world.rotation.x = content.place === 'stand' ? -Math.PI / 2 : 0;
    const reach = Math.max(1, aspect, num(cfg.scale, 0.1, 10, 1));
    camera.position.set(0, content.place === 'stand' ? reach * 1.1 : reach * 0.35, reach * 1.9);
    controls.target.set(0, content.place === 'stand' ? reach * 0.2 : 0, 0);
    controls.update();
  }
  fitSize();
  await update({});
  const api = {
    update,
    stop() {
      if (stopped) return; stopped = true;
      gen++;
      renderer.setAnimationLoop(null);
      if (ro) ro.disconnect();
      controls.dispose();
      if (content) free(content.media);
      renderer.dispose(); renderer.forceContextLoss();
      container.replaceChildren();
    },
  };
  // A panel that re-renders takes the preview with it; the preview notices
  // and lets go of its graphics context rather than drawing on unseen.
  renderer.setAnimationLoop(() => {
    if (!container.isConnected) return api.stop();
    controls.update(); if (content && content.tick) content.tick(); renderer.render(scene, camera);
  });
  return api;
}
