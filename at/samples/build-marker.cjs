// Builds the test pattern a manager can pick to try pattern AR before having a
// pattern of their own: an old town map, drawn in a browser and compiled there
// with the same code the studio uses, so it matches what an upload would give.
// Writes marker.jpg, marker.mind and marker.json next to this file.
//
// Needs Playwright with Chromium and a network connection (MindAR and three.js
// come from the CDN, as in the studio):
//   NODE_PATH="$(npm root -g)" node at/samples/build-marker.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const OUT = __dirname;
const PUBLIC = path.join(__dirname, '..', '..', 'public');
const PAGE = `<!doctype html><meta charset="utf-8">
<script type="importmap">{"imports":{
  "three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/",
  "mindar-image-three":"https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js",
  "mindar-image":"https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js"}}</script>
<script type="module">
import { compilePattern } from '/js/at-ar.js';
const W = 900, H = 600;
const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
const g = cv.getContext('2d');
let seed = 1898;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const INK = '#2A1D12', RED = '#C22F19';

// Paper, foxed and speckled: grain the tracker can hold on to everywhere.
g.fillStyle = '#EFE3C4'; g.fillRect(0, 0, W, H);
for (let i = 0; i < 14; i++) {
  const x = rnd() * W, y = rnd() * H, r = 30 + rnd() * 90, s = g.createRadialGradient(x, y, 2, x, y, r);
  s.addColorStop(0, 'rgba(150,105,55,.22)'); s.addColorStop(1, 'rgba(150,105,55,0)');
  g.fillStyle = s; g.fillRect(x - r, y - r, r * 2, r * 2);
}
for (let i = 0; i < 9000; i++) {
  g.fillStyle = 'rgba(80,52,24,' + (0.06 + rnd() * 0.3).toFixed(2) + ')';
  const s = 1 + rnd() * 2.4; g.fillRect(rnd() * W, rnd() * H, s, s);
}

// The river, then the streets as wandering lines, then the houses.
g.strokeStyle = '#2E5C7A'; g.lineCap = 'round'; g.lineWidth = 26;
g.beginPath(); g.moveTo(40, 470); g.bezierCurveTo(230, 380, 300, 560, 470, 455); g.bezierCurveTo(600, 380, 690, 520, 860, 430); g.stroke();
g.strokeStyle = '#EFE3C4'; g.lineWidth = 3; g.setLineDash([9, 7]);
g.beginPath(); g.moveTo(40, 470); g.bezierCurveTo(230, 380, 300, 560, 470, 455); g.bezierCurveTo(600, 380, 690, 520, 860, 430); g.stroke();
g.setLineDash([]);
g.strokeStyle = INK;
for (let i = 0; i < 30; i++) {
  let x = 60 + rnd() * 560, y = 60 + rnd() * 340, a = rnd() * Math.PI * 2;
  g.lineWidth = 2 + rnd() * 6; g.beginPath(); g.moveTo(x, y);
  for (let k = 0; k < 5; k++) {
    a += (rnd() - 0.5) * 1.4; x += Math.cos(a) * (25 + rnd() * 45); y += Math.sin(a) * (25 + rnd() * 45);
    g.lineTo(Math.max(45, Math.min(W - 45, x)), Math.max(45, Math.min(H - 45, y)));
  }
  g.stroke();
}
for (let i = 0; i < 70; i++) {
  const x = 55 + rnd() * 600, y = 55 + rnd() * 360, w = 10 + rnd() * 30, h = 8 + rnd() * 24, t = (rnd() - 0.5) * 0.9;
  g.save(); g.translate(x, y); g.rotate(t);
  g.fillStyle = rnd() < 0.22 ? '#8C3A22' : INK; g.fillRect(-w / 2, -h / 2, w, h);
  if (rnd() < 0.5) { g.fillStyle = '#EFE3C4'; g.fillRect(-w / 2 + 3, -h / 2 + 3, Math.max(2, w / 3), Math.max(2, h / 3)); }
  g.restore();
}

// A compass rose, off to one side so the pattern has no symmetry to confuse.
g.save(); g.translate(735, 165);
for (let i = 0; i < 16; i++) {
  const long = i % 4 === 0, r = long ? 105 : i % 2 === 0 ? 72 : 48, a = i * Math.PI / 8, b = Math.PI / 16 * (long ? 1.2 : 1);
  g.fillStyle = i % 2 ? '#EFE3C4' : INK;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(a - b) * r * 0.28, -Math.cos(a - b) * r * 0.28);
  g.lineTo(Math.sin(a) * r, -Math.cos(a) * r); g.lineTo(Math.sin(a + b) * r * 0.28, -Math.cos(a + b) * r * 0.28); g.closePath();
  g.fill(); g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke();
}
g.beginPath(); g.arc(0, 0, 112, 0, Math.PI * 2); g.lineWidth = 2; g.stroke();
g.fillStyle = INK; g.font = '700 30px Georgia, serif'; g.textAlign = 'center'; g.fillText('N', 0, -120);
g.restore();

// The treasure, marked.
g.strokeStyle = RED; g.lineWidth = 9; g.lineCap = 'round';
g.beginPath(); g.moveTo(515, 250); g.lineTo(555, 290); g.moveTo(555, 250); g.lineTo(515, 290); g.stroke();
g.setLineDash([2, 12]); g.lineWidth = 5;
g.beginPath(); g.moveTo(120, 140); g.bezierCurveTo(260, 60, 380, 330, 505, 270); g.stroke(); g.setLineDash([]);

// A seal with the year, and the name plate.
g.save(); g.translate(760, 440); g.rotate(-0.18);
g.strokeStyle = RED; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 66, 0, Math.PI * 2); g.stroke();
g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 54, 0, Math.PI * 2); g.stroke();
g.fillStyle = RED; g.font = '800 38px Georgia, serif'; g.textAlign = 'center'; g.fillText('1898', 0, 13);
for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; g.fillRect(Math.cos(a) * 60 - 2, Math.sin(a) * 60 - 2, 4, 4); }
g.restore();
g.fillStyle = INK; g.fillRect(48, 476, 380, 58);
g.fillStyle = '#EFE3C4'; g.font = '800 34px Georgia, serif'; g.textAlign = 'left'; g.fillText('ADVENTURETRAIL', 62, 517);
g.fillStyle = INK; g.font = 'italic 600 19px Georgia, serif'; g.fillText('Testmuster · Altstadt anno 1898', 50, 555);

// The frame, with a scale bar of uneven steps along all four sides.
g.strokeStyle = INK; g.lineWidth = 14; g.strokeRect(14, 14, W - 28, H - 28);
g.lineWidth = 2; g.strokeRect(36, 36, W - 72, H - 72);
g.fillStyle = INK;
for (const [len, put] of [[W - 80, (p, l) => { g.fillRect(40 + p, 25, l, 8); g.fillRect(40 + p, H - 33, l, 8); }],
                          [H - 80, (p, l) => { g.fillRect(25, 40 + p, 8, l); g.fillRect(W - 33, 40 + p, 8, l); }]]) {
  let p = 0, on = true;
  while (p < len) { const l = Math.min(8 + rnd() * 30, len - p); if (on) put(p, l); p += l; on = !on; }
}

try {
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const res = await compilePattern(blob);
  const b64 = async b => { const u = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
  window.OUT = { jpg: await b64(res.image), mind: await b64(new Blob([res.mind])),
                 meta: { pw: res.width, ph: res.height, points: res.points, quality: res.quality } };
} catch (e) { window.OUT = { error: String(e && e.stack || e) }; }
</script>`;

const srv = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(PAGE); }
  const f = path.join(PUBLIC, url);
  if (!f.startsWith(PUBLIC + path.sep) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${srv.address().port}/`);
    await page.waitForFunction(() => window.OUT, null, { timeout: 300000 });
    const out = await page.evaluate(() => window.OUT);
    if (out.error) throw new Error(out.error);
    fs.writeFileSync(path.join(OUT, 'marker.jpg'), Buffer.from(out.jpg, 'base64'));
    fs.writeFileSync(path.join(OUT, 'marker.mind'), Buffer.from(out.mind, 'base64'));
    fs.writeFileSync(path.join(OUT, 'marker.json'), JSON.stringify(out.meta, null, 2) + '\n');
    console.log('marker written:', JSON.stringify(out.meta));
  } finally { await browser.close(); srv.close(); }
});
