// The Christmas look's end screen: a picture over the whole phone page, with the
// GM's text and the map buttons on it.
//
// Everything sits on a fixed 1080 x 1920 stage that is then scaled to the screen.
// So text breaks at the same words on every phone, and the mode editor's preview
// and the downloadable reference show exactly where it lands on the picture. The
// player page and the mode editor both draw through here, so they can't drift apart.
(function (w) {
  'use strict';
  if (w.EndScreen) return;

  const W = 1080, H = 1920;
  // What a phone may cut off. The picture always fills the screen, so a narrow
  // phone loses some of the sides and a short one (browser bars showing) some of
  // the top and bottom. Text and buttons stay inside these margins.
  const SAFE_X = 130, SAFE_Y = 190;
  // Wider than this (a tablet, a phone on its side) filling would cut too much,
  // so the whole stage shows instead, with dark bars.
  const COVER_MAX = 0.7;
  const DEFAULTS = { pos: 14, size: 100, color: '#f4f2ee' };
  const TOKEN = '{adresse}';
  const LANGS = ['de', 'en', 'fr', 'it', 'es', 'zh'];
  const TITLE_PX = 120, BODY_PX = 54;
  const TITLE_FONT = "'HomeChristmas',Georgia,serif";
  const BODY_FONT = "'Inter',-apple-system,'Segoe UI',Roboto,sans-serif";

  const CSS = `
@font-face{font-family:'HomeChristmas';src:url('/assets/christmas/homechristmas.woff2') format('woff2');font-display:swap;}
.endimg-box{position:relative;overflow:hidden;background:#0d0c0b;}
.endimg-stage{position:absolute;left:50%;top:50%;width:${W}px;height:${H}px;overflow:hidden;-webkit-text-size-adjust:none;text-size-adjust:none;}
.endimg-pic{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;display:block;}
.endimg-guide{position:absolute;left:${SAFE_X}px;right:${SAFE_X}px;top:${SAFE_Y}px;bottom:${SAFE_Y}px;border:4px dashed rgba(255,255,255,.28);border-radius:8px;}
.endimg-text{position:absolute;left:${SAFE_X}px;right:${SAFE_X}px;text-align:center;}
.endimg-title{font:400 ${TITLE_PX}px/1.1 ${TITLE_FONT};white-space:pre-line;overflow-wrap:anywhere;}
.endimg-body{font:500 ${BODY_PX}px/1.35 ${BODY_FONT};margin-top:36px;white-space:pre-line;overflow-wrap:anywhere;}
.endimg-title:empty,.endimg-body:empty{display:none;}
.endimg-title:empty+.endimg-body{margin-top:0;}
.endimg-btns{position:absolute;left:${SAFE_X}px;right:${SAFE_X}px;bottom:${SAFE_Y}px;display:flex;gap:20px;}
.endimg-btn{flex:1 1 0;min-width:0;height:136px;display:flex;align-items:center;justify-content:center;border-radius:20px;background:var(--btn-bg,#E85F1E);color:#fff;font:700 42px/1 ${BODY_FONT};text-transform:uppercase;text-decoration:none;}
`;
  function addCss() {
    if (document.getElementById('endimg-css')) return;
    const st = document.createElement('style');
    st.id = 'endimg-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  const div = cls => { const d = document.createElement('div'); d.className = cls; return d; };
  // A halo of the opposite brightness, tight and then wide, so text stays readable
  // where it crosses a bright and a dark part of the picture.
  function haloOf(color) {
    const n = parseInt(String(color).slice(1), 16) || 0;
    const lum = (.299 * (n >> 16 & 255) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255;
    return lum > .5 ? '0,0,0' : '255,255,255';
  }

  // The stage at its full size. o: image, title, body, pos, size, color, links
  // [{label, href}], guides. A link without href is a stand-in for the preview.
  function build(o, oldPic) {
    const stage = div('endimg-stage');
    if (o.image) {
      const keep = oldPic && oldPic.getAttribute('src') === o.image;
      const pic = keep ? oldPic : document.createElement('img');
      if (!keep) { pic.className = 'endimg-pic'; pic.alt = ''; pic.src = o.image; }
      stage.appendChild(pic);
    }
    if (o.guides) stage.appendChild(div('endimg-guide'));
    const size = Number(o.size) || DEFAULTS.size, color = o.color || DEFAULTS.color;
    const text = div('endimg-text');
    text.style.top = Math.round(H * (Number(o.pos) || DEFAULTS.pos) / 100) + 'px';
    text.style.color = color;
    const halo = haloOf(color);
    text.style.textShadow = `0 1px 5px rgba(${halo},.9),0 2px 22px rgba(${halo},.7)`;
    const title = div('endimg-title'), body = div('endimg-body');
    title.style.fontSize = Math.round(TITLE_PX * size / 100) + 'px';
    body.style.fontSize = Math.round(BODY_PX * size / 100) + 'px';
    title.textContent = o.title || '';
    body.textContent = o.body || '';
    text.append(title, body);
    stage.appendChild(text);
    if (o.links && o.links.length) {
      const row = div('endimg-btns');
      o.links.forEach(l => {
        const a = document.createElement(l.href ? 'a' : 'span');
        a.className = 'endimg-btn';
        a.textContent = l.label;
        if (l.href) { a.href = l.href; a.target = '_blank'; a.rel = 'noopener'; }
        row.appendChild(a);
      });
      stage.appendChild(row);
    }
    return stage;
  }

  // Draws the stage into a box and keeps it fitted when the box changes size
  // (phone turned, browser bars sliding away). Returns the stage.
  function mount(box, o) {
    addCss();
    box.classList.add('endimg-box');
    const oldPic = box.querySelector('.endimg-pic');
    const stage = build(o, oldPic);
    box.textContent = '';
    box.appendChild(stage);
    const fit = () => {
      const bw = box.clientWidth, bh = box.clientHeight;
      if (!bw || !bh) return;
      const k = bw / bh > COVER_MAX ? Math.min(bw / W, bh / H) : Math.max(bw / W, bh / H);
      stage.style.transform = `translate(-50%,-50%) scale(${k})`;
    };
    fit();
    if (box._endimgFit) box._endimgFit.disconnect();
    if (w.ResizeObserver) { box._endimgFit = new ResizeObserver(fit); box._endimgFit.observe(box); }
    else w.addEventListener('resize', fit);
    return stage;
  }

  // The text for a language: the GM's own, else whatever they wrote in another
  // language (like the auto messages), else the built-in one.
  function pick(map, lang, fallback) {
    if (map && String(map[lang] || '').trim()) return map[lang];
    // Chinese tries English first, like the rest of the player app.
    const order = lang === 'zh' ? ['en', ...LANGS] : LANGS;
    const any = map && order.map(l => map[l]).find(v => String(v || '').trim());
    return any || fallback;
  }
  // Puts the address in. A line that held only the placeholder goes away when
  // there is no address, instead of leaving a gap.
  function fill(text, address) {
    return String(text || '').split('\n').map(line => {
      const had = line.toLowerCase().includes(TOKEN);
      const out = line.replace(/\{adresse\}/gi, () => address || '');
      return had && !out.trim() ? null : out;
    }).filter(l => l !== null).join('\n').trim();
  }

  // The title and text for a language, address filled in. c: what the GM set;
  // defaults: the built-in wording for what wasn't written. A part switched off
  // stays off, for a picture that already says it.
  function texts(c, lang, defaults, address) {
    const on = v => v === undefined || Number(v) !== 0;
    return {
      title: on(c.show_title) ? fill(pick(c.title, lang, defaults.title), address) : '',
      body: on(c.show_body) ? fill(pick(c.body, lang, address ? defaults.body : ''), address) : '',
    };
  }

  function fontsFor(stage) {
    if (!document.fonts) return Promise.resolve();
    const parts = [...stage.querySelectorAll('.endimg-title,.endimg-body,.endimg-btn')];
    const wait = Promise.all(parts.map(el => {
      const cs = getComputedStyle(el);
      return document.fonts.load(`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, el.textContent || 'A');
    })).then(() => document.fonts.ready).catch(() => {});
    return Promise.race([wait, new Promise(r => setTimeout(r, 4000))]);
  }
  // Writes an element's text onto the canvas line by line, at the places the
  // browser broke it, so the reference matches the real screen.
  function drawText(x, el, origin) {
    const node = el.firstChild;
    if (!node || node.nodeType !== 3) return;
    const cs = getComputedStyle(el);
    x.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    x.fillStyle = cs.color;
    const metric = x.measureText('Hg');
    const range = document.createRange();
    const lines = [];
    let i = 0, cur = null;
    for (const ch of node.data) {
      range.setStart(node, i); range.setEnd(node, i + ch.length);
      i += ch.length;
      const r = range.getClientRects()[0];
      if (!r || !r.width) continue;
      if (!cur || Math.abs(r.top - cur.top) > 2) { cur = { top: r.top, left: r.left, height: r.height, s: '' }; lines.push(cur); }
      cur.s += ch;
    }
    const upper = cs.textTransform === 'uppercase';
    lines.forEach(l => {
      const ascent = metric.fontBoundingBoxAscent || l.height * .8;
      x.fillText(upper ? l.s.toUpperCase() : l.s, l.left - origin.left, l.top - origin.top + ascent);
    });
  }
  // Dim enough that white text reads in any image viewer, see-through enough to
  // lay it over the picture while designing. The dark edge is what phones may cut.
  function paintGuides(x, labels) {
    x.fillStyle = 'rgba(38,38,42,.62)';
    x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(0,0,0,.38)';
    x.fillRect(0, 0, W, SAFE_Y);
    x.fillRect(0, H - SAFE_Y, W, SAFE_Y);
    x.fillRect(0, SAFE_Y, SAFE_X, H - 2 * SAFE_Y);
    x.fillRect(W - SAFE_X, SAFE_Y, SAFE_X, H - 2 * SAFE_Y);
    x.strokeStyle = 'rgba(255,255,255,.75)';
    x.lineWidth = 3;
    x.setLineDash([18, 14]);
    x.strokeRect(SAFE_X, SAFE_Y, W - 2 * SAFE_X, H - 2 * SAFE_Y);
    x.setLineDash([]);
    x.fillStyle = '#fff';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    const line = (s, y) => {
      let px = 32;
      do { x.font = `600 ${px}px ${BODY_FONT}`; px -= 2; } while (x.measureText(s).width > W - 60 && px > 16);
      x.fillText(s, W / 2, y);
    };
    line(labels.top, SAFE_Y / 2 - 24);
    line(labels.crop, SAFE_Y / 2 + 24);
    line(labels.crop, H - SAFE_Y / 2);
    x.textAlign = 'left';
    x.textBaseline = 'alphabetic';
  }
  // The reference to design the picture around: a transparent PNG at full size
  // with the text and buttons where they will be. labels: top, crop.
  async function reference(o, labels) {
    addCss();
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = `position:fixed;left:${-W * 2}px;top:0;width:${W}px;height:${H}px;overflow:hidden;`;
    const stage = build(Object.assign({}, o, { image: null, guides: false }));
    stage.style.left = '0'; stage.style.top = '0';
    host.appendChild(stage);
    document.body.appendChild(host);
    try {
      await fontsFor(stage);
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const x = canvas.getContext('2d');
      paintGuides(x, labels);
      const origin = stage.getBoundingClientRect();
      stage.querySelectorAll('.endimg-btn').forEach(b => {
        const r = b.getBoundingClientRect();
        x.fillStyle = getComputedStyle(b).backgroundColor;
        x.beginPath();
        if (x.roundRect) x.roundRect(r.left - origin.left, r.top - origin.top, r.width, r.height, 20);
        else x.rect(r.left - origin.left, r.top - origin.top, r.width, r.height);
        x.fill();
        drawText(x, b, origin);
      });
      x.shadowColor = `rgba(${haloOf(o.color || DEFAULTS.color)},.8)`;
      x.shadowBlur = 16;
      x.shadowOffsetY = 2;
      stage.querySelectorAll('.endimg-title,.endimg-body').forEach(el => drawText(x, el, origin));
      return await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('no png')), 'image/png'));
    } finally { host.remove(); }
  }

  w.EndScreen = { W, H, SAFE_X, SAFE_Y, DEFAULTS, TOKEN, mount, texts, reference };
})(window);
