/* AdventureTrail page designs. One renderer for the player and the designer,
 * so what the designer shows is what a team sees.
 *
 * A designed page is a fixed 390 x 844 canvas, scaled as a whole to fit the
 * phone and centred. Layers are placed in percent of that canvas and stacked
 * in array order (first is bottom). Because nothing reflows, a video placed
 * inside the screen of a TV picture stays inside it on every phone.
 *
 * Every user-written string goes in through textContent, and every file
 * through the uploads path pattern the server enforces, so a design can never
 * inject markup.
 */
(function () {
  'use strict';
  var REF = { w: 390, h: 844 };
  var FONTS = {
    display: "'Big Shoulders Display','Bebas Neue',Impact,sans-serif",
    body: "'Inter',-apple-system,'Segoe UI',Roboto,sans-serif",
    mono: "'JetBrains Mono',Consolas,monospace",
  };
  var CSS = [
    '.atd-stage{position:absolute;left:0;top:0;width:' + REF.w + 'px;height:' + REF.h + 'px;transform-origin:0 0;overflow:hidden}',
    '.atd-bg{position:absolute;inset:0;background-repeat:no-repeat;background-position:center}',
    '.atd-l{position:absolute;box-sizing:border-box;margin:0}',
    // Decoration never takes a tap: a TV frame on top must not block the video's controls.
    '.atd-image{pointer-events:none}',
    '.atd-image img,.atd-imgbtn img{width:100%;height:100%;display:block;user-select:none;-webkit-user-select:none;-webkit-user-drag:none;pointer-events:auto}',
    '.atd-image img{pointer-events:none}',
    '.atd-button{display:flex;align-items:center;justify-content:center;text-align:center;padding:0 10px;border:0;cursor:pointer;',
    '  font:700 16px/1.15 ' + FONTS.body + ';letter-spacing:.02em;-webkit-tap-highlight-color:transparent;overflow:hidden}',
    '.atd-button.atd-imgbtn{background:none !important;padding:0;border-radius:0}',
    '.atd-button:active{filter:brightness(.92)}',
    '.atd-video video{width:100%;height:100%;display:block;background:#0B0A09}',
    // Text is decoration too: a heading over a video must not swallow the tap.
    '.atd-text{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.25;overflow:hidden;pointer-events:none}',
    '.atd-content{overflow:auto;-webkit-overflow-scrolling:touch;color:inherit}',
    '.atd-content .mid{flex:none !important;justify-content:flex-start !important;min-height:0}',
    '.atd-content .foot{margin-top:14px !important;padding-top:0 !important}',
    '.atd-content.atd-no-text .story,.atd-content.atd-no-text .beat{display:none !important}',
    '.atd-content.atd-no-hints .hints{display:none !important}',
    '.atd-content.atd-no-finds .finds{display:none !important}',
    '.atd-content.atd-no-actions .foot{display:none !important}',
    '.atd-empty{background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.07) 0 10px,transparent 10px 20px);outline:1px dashed rgba(255,255,255,.35);outline-offset:-1px}',
  ].join('\n');

  function injectCss() {
    if (document.getElementById('atd-css')) return;
    var s = document.createElement('style');
    s.id = 'atd-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }
  function pick(o, lang) {
    o = o || {};
    if (o[lang]) return o[lang];
    var order = ['de', 'en', 'fr', 'it', 'es'];
    for (var i = 0; i < order.length; i++) if (o[order[i]]) return o[order[i]];
    return '';
  }
  // Only files the server stored for a trail, and only by the path it issued.
  function media(p) { return typeof p === 'string' && /^at\/[A-Za-z0-9._-]+$/.test(p) ? '/uploads/' + p : ''; }
  // A design counts once anything about it differs from a plain page: a layer,
  // a picture, a colour, or the top bar switched off.
  function has(d) {
    if (!d) return false;
    var pg = d.page || {};
    return !!((d.layers && d.layers.length) || pg.image || pg.chrome === false || (pg.bg && pg.bg !== '#0B0F1A'));
  }
  function usesStory(d) { return !!(d && (d.layers || []).some(function (l) { return l.type === 'video' && l.src === 'story' && !l.hidden; })); }

  // A layer's box, shared by the first render and every drag in the designer.
  function place(el, l) {
    el.style.left = l.x + '%'; el.style.top = l.y + '%';
    el.style.width = l.w + '%'; el.style.height = l.h + '%';
    el.style.transform = l.rot ? 'rotate(' + l.rot + 'deg)' : '';
    el.style.opacity = l.opacity == null || l.opacity === 1 ? '' : String(l.opacity);
    el.style.display = l.hidden ? 'none' : '';
  }

  var alphaCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  // Is the picture solid at (x, y), in the img box's own CSS pixels? Honours
  // object-fit, so a contained or cropped picture is sampled where it is drawn.
  function alphaAt(img, x, y) {
    if (!img || !img.complete || !img.naturalWidth || !alphaCache) return true;
    var W = img.clientWidth, H = img.clientHeight, nw = img.naturalWidth, nh = img.naturalHeight;
    if (!W || !H || nw * nh > 4194304) return true;
    var fit = img.style.objectFit || 'fill', sx, sy, ox = 0, oy = 0;
    if (fit === 'fill') { sx = nw / W; sy = nh / H; }
    else {
      var s = fit === 'contain' ? Math.min(W / nw, H / nh) : Math.max(W / nw, H / nh);
      sx = sy = 1 / s; ox = (W - nw * s) / 2; oy = (H - nh * s) / 2;
    }
    var px = Math.floor((x - ox) * sx), py = Math.floor((y - oy) * sy);
    if (px < 0 || py < 0 || px >= nw || py >= nh) return false;
    var c = alphaCache.get(img);
    try {
      if (!c) {
        c = document.createElement('canvas'); c.width = nw; c.height = nh;
        c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
        alphaCache.set(img, c);
      }
      return c.getContext('2d').getImageData(px, py, 1, 1).data[3] > 24;
    } catch (e) { return true; }
  }
  // Image buttons: a tap on a see-through part of the picture is not a tap on
  // the button. It goes to whatever lies underneath instead.
  function alphaHit(img, ev) {
    if (ev.target !== img) return true;
    return alphaAt(img, ev.offsetX, ev.offsetY);
  }
  function passThrough(el, ev) {
    el.style.pointerEvents = 'none';
    var under = document.elementFromPoint(ev.clientX, ev.clientY);
    el.style.pointerEvents = '';
    if (under && under !== el && !el.contains(under)) {
      under.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: ev.clientX, clientY: ev.clientY }));
    }
  }

  function img(src, fit) {
    var i = new Image();
    i.src = src; i.alt = ''; i.draggable = false; i.decoding = 'async';
    i.style.objectFit = fit;
    return i;
  }

  function layerEl(l, ctx) {
    var play = ctx.mode === 'play';
    var el = document.createElement(l.type === 'button' && play ? 'button' : 'div');
    el.className = 'atd-l atd-' + l.type;
    el.setAttribute('data-layer', l.id);
    if (l.type === 'image') {
      var src = media(l.src);
      if (src) el.appendChild(img(src, l.fit || 'fill')); else el.classList.add('atd-empty');
    } else if (l.type === 'button') {
      var label = pick(l.label, ctx.lang);
      var bsrc = media(l.src);
      if (play) { el.type = 'button'; el.setAttribute('aria-label', label || 'Knopf'); }
      if (bsrc) {
        el.classList.add('atd-imgbtn');
        el.appendChild(img(bsrc, l.fit || 'contain'));
      } else {
        el.textContent = label;
        el.style.background = l.bg || '#E8B23A';
        el.style.color = l.fg || '#16120C';
        el.style.borderRadius = (l.radius == null ? 12 : l.radius) + 'px';
        el.style.fontSize = (l.size || 16) + 'px';
        if (l.border) el.style.boxShadow = 'inset 0 0 0 2px ' + l.border;
      }
      if (play) {
        el.addEventListener('click', function (ev) {
          var pic = el.querySelector('img');
          if (pic && ev.isTrusted !== false && !alphaHit(pic, ev)) { ev.stopPropagation(); return passThrough(el, ev); }
          if (ctx.onAction) ctx.onAction(l, ev);
        });
      }
    } else if (l.type === 'video') {
      var v = document.createElement('video');
      var vsrc = l.src === 'story' ? (ctx.holdStory ? '' : (ctx.storyVideo || '')) : media(l.src);
      if (vsrc) v.src = vsrc; else el.classList.add('atd-empty');
      v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'metadata';
      v.style.objectFit = l.fit || 'cover';
      v.style.borderRadius = (l.radius || 0) + 'px';
      if (play) {
        v.controls = l.controls !== false;
        v.loop = !!l.loop;
        // Phones only start a video on their own when it is silent.
        if (l.autoplay) { v.muted = true; v.setAttribute('muted', ''); v.autoplay = true; v.setAttribute('autoplay', ''); }
      } else {
        v.muted = true;
      }
      el.appendChild(v);
    } else if (l.type === 'text') {
      el.textContent = pick(l.text, ctx.lang);
      el.style.fontFamily = FONTS[l.font] || FONTS.body;
      el.style.fontSize = (l.size || 18) + 'px';
      el.style.fontWeight = String(l.weight || 600);
      el.style.color = l.color || '#F4F1EA';
      el.style.textAlign = l.align || 'left';
      el.style.background = l.bg || 'transparent';
      el.style.padding = (l.pad || 0) + 'px';
      el.style.borderRadius = (l.radius || 0) + 'px';
      if (l.font === 'display') { el.style.textTransform = 'uppercase'; el.style.letterSpacing = '.03em'; el.style.lineHeight = '1.02'; }
      if (l.shadow) el.style.textShadow = '0 1px 3px rgba(0,0,0,.85),0 0 14px rgba(0,0,0,.5)';
    } else if (l.type === 'content') {
      el.style.background = l.bg || 'rgba(20,24,40,.86)';
      if (l.fg) el.style.color = l.fg;
      el.style.borderRadius = (l.radius == null ? 16 : l.radius) + 'px';
      el.style.padding = (l.pad == null ? 16 : l.pad) + 'px';
      var sh = l.show || {};
      ['text', 'hints', 'finds', 'actions'].forEach(function (k) { if (sh[k] === false) el.classList.add('atd-no-' + k); });
      if (ctx.content) { var inner = ctx.content(l); if (inner) el.appendChild(inner); }
    }
    place(el, l);
    return el;
  }

  function render(stage, design, ctx) {
    injectCss();
    ctx = ctx || {};
    while (stage.firstChild) stage.removeChild(stage.firstChild);
    stage.classList.add('atd-stage');
    var pg = (design && design.page) || {};
    stage.style.background = pg.bg && pg.bg !== 'transparent' ? pg.bg : 'transparent';
    var bg = document.createElement('div');
    bg.className = 'atd-bg';
    var bimg = media(pg.image);
    if (bimg) {
      bg.style.backgroundImage = 'url("' + bimg + '")';
      bg.style.backgroundSize = pg.fit === 'contain' ? 'contain' : 'cover';
    }
    stage.appendChild(bg);
    var els = new Map();
    ((design && design.layers) || []).forEach(function (l) {
      var el = layerEl(l, ctx);
      stage.appendChild(el);
      els.set(l.id, el);
    });
    return els;
  }

  // Scales the fixed page into a box: whole, centred, never cropped.
  function fit(stage, box, pad) {
    pad = pad || 0;
    var W = Math.max(1, box.clientWidth - pad * 2), H = Math.max(1, box.clientHeight - pad * 2);
    var s = Math.min(W / REF.w, H / REF.h);
    var ox = pad + (W - REF.w * s) / 2, oy = pad + (H - REF.h * s) / 2;
    stage.style.transform = 'translate(' + ox + 'px,' + oy + 'px) scale(' + s + ')';
    return { s: s, ox: ox, oy: oy };
  }

  window.ATDesign = { REF: REF, FONTS: FONTS, render: render, fit: fit, place: place, has: has, usesStory: usesStory, pick: pick, media: media, alphaAt: alphaAt };
})();
