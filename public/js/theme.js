// Player colour schemes (per location / per Rail Adventure mode).
// Loaded by join.html, play.html and cityrush.html. Two jobs:
//   1. Normal play: fetch the game's theme once and apply it (CSS-var
//      overrides + logo/stamp/wordmark swap). No theme = default look.
//   2. Preview (?preview=1): don't touch the network; listen for same-origin
//      postMessage {type:'ar-theme', theme} from the GM theme designer and
//      re-apply live. The GM dashboard itself is never themed.
(function(){
  const qs      = new URLSearchParams(location.search);
  const preview = qs.get('preview') === '1';
  let gameId    = qs.get('game');
  if (!gameId && !preview) { try { gameId = sessionStorage.getItem('gameId'); } catch(e){} }

  function hexToRgb(h){
    h = String(h).replace('#','');
    if (h.length === 3) h = h.split('').map(c=>c+c).join('');
    const n = parseInt(h.slice(0,6), 16);
    return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
  }
  const alpha = (hex,a) => { const {r,g,b}=hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
  const mix   = (hex,hex2,t) => {
    const a=hexToRgb(hex), b=hexToRgb(hex2);
    const c = k => Math.round(a[k]+(b[k]-a[k])*t);
    return `rgb(${c('r')},${c('g')},${c('b')})`;
  };

  // Tints/glows derived from the 12 base colors so the GM edits few values
  // and the soft/dim/glow variants stay consistent with them.
  function derived(vars){
    const d = {};
    const t = vars['--text'], o = vars['--orange'], g = vars['--green'], r = vars['--red'];
    if (t) d['--hairline'] = alpha(t, .08);
    if (o) { d['--orange-soft']=alpha(o,.14); d['--orange-dim']=alpha(o,.55); d['--glow-orange']=`0 0 16px ${alpha(o,.45)}`; d['--team-color']=o; }
    if (g) { d['--green-soft']=alpha(g,.14); d['--green-dim']=alpha(g,.55); }
    if (r) { d['--red-light']=mix(r,'#ffffff',.28); d['--red-dim']=mix(r,'#000000',.35); d['--glow-red']=`0 0 12px ${alpha(r,.5)}`; }
    return d;
  }

  const appliedVars = [];
  function applyVars(vars){
    const root = document.documentElement;
    appliedVars.forEach(k => root.style.removeProperty(k));
    appliedVars.length = 0;
    if (!vars) return;
    const all = Object.assign({}, vars, derived(vars));
    for (const [k,v] of Object.entries(all)){
      if (/^--[a-z0-9-]+$/i.test(k)) { root.style.setProperty(k, v); appliedVars.push(k); }
    }
  }

  // Stamp ("Adventurerooms") + wordmark ("MiSSiONS") swap, or a logo image
  // replacing both. Defaults are remembered on first touch so live preview
  // can toggle back without a reload.
  function applyBranding(theme){
    const stamps = document.querySelectorAll('.join-header .stamp, .ph-center .ar-stamp');
    const marks  = document.querySelectorAll('.join-header .wordmark, .ph-center .play-wordmark');
    stamps.forEach(el => {
      if (el.dataset.dflt === undefined) el.dataset.dflt = el.textContent;
      el.textContent = theme.stamp || el.dataset.dflt;
    });
    marks.forEach(el => {
      if (el.dataset.dflt === undefined) el.dataset.dflt = el.textContent;
      el.textContent = theme.wordmark || el.dataset.dflt;
    });
    // Logo image: sits above the stamp, replaces stamp + wordmark visually.
    document.querySelectorAll('.theme-logo').forEach(el => el.remove());
    const show = !theme.logo;
    stamps.forEach(el => { el.style.display = show ? '' : 'none'; });
    marks.forEach(el => { el.style.display = show ? '' : 'none'; });
    if (theme.logo){
      const containers = document.querySelectorAll('.join-header, .ph-center');
      containers.forEach(c => {
        const img = document.createElement('img');
        img.className = 'theme-logo';
        img.alt = '';
        img.src = '/uploads/' + theme.logo;
        img.style.cssText = 'display:block;margin:0 auto;max-height:52px;max-width:78%;object-fit:contain;';
        c.insertBefore(img, c.firstChild);
      });
    }
  }

  function apply(theme){
    theme = theme || {};
    applyVars(theme.vars || null);
    // Border thickness is numeric, so it lives outside `vars` (which is hex-only).
    const root = document.documentElement;
    if (theme.borderWidth != null && theme.borderWidth !== '') root.style.setProperty('--border-width', theme.borderWidth + 'px');
    else root.style.removeProperty('--border-width');
    if (document.body) applyBranding(theme);
    else document.addEventListener('DOMContentLoaded', () => applyBranding(theme), { once:true });
  }

  window.ArTheme = { preview, apply };

  if (preview){
    // Reverse hover: the designer asks us to outline the element(s) a hovered
    // setting recolours. Inverse of roleOf below.
    const SEL_BY_ROLE = {
      header:'.play-topbar, .join-header, .cr-topbar',
      tile:'.p-mission-card, .cr-tile', 'tile-active':'.p-mission-card, .cr-tile',
      'tile-text':'.mcard__title, .mcard__task, .cr-tile .name',
      button:'.btn-primary, .btn-secondary, .md-btn', nav:'.icon-btn, .cr-icon-btn',
      input:'.md-task, .name-field, .input',
      // notice covers the detail status note, the card's post-upload "awaiting
      // review" tag, the centered notice, and the rejection popup.
      notice:'.md-state-note, .mcard__pending-tag, .toast, #rejection-overlay, .cn-box, .msg-popup-box',
      chat:'.chat-bubble', points:'.mcard__points, #md-points',
      // Each Text setting points at what it actually recolours (primary title,
      // secondary body, muted labels) — not all at the same element.
      text:'.md-title', 'text-dim':'.mcard__desc, .md-desc', 'text-muted':'.md-label',
      accent:'.mcard__task .arrow, .score-pill svg',
      logo:'.play-wordmark, .wordmark, .theme-logo', border:'.p-mission-card, .cr-tile',
    };
    let _hlEls = [];
    function clearRoleHighlight(){ _hlEls.forEach(el => { el.style.outline=''; el.style.outlineOffset=''; el.style.boxShadow=''; }); _hlEls = []; }
    // Bold, high-contrast double ring (white + blue + glow) so the highlight is
    // obvious on ANY themed background, including light/yellow ones.
    function highlightRole(role){
      clearRoleHighlight();
      const sel = role && SEL_BY_ROLE[role]; if(!sel) return;
      document.querySelectorAll(sel).forEach(el => {
        el.style.outline='3px solid #2ea3ff';
        el.style.outlineOffset='2px';
        el.style.boxShadow='0 0 0 3px #fff, 0 0 0 6px #2ea3ff, 0 0 20px 4px rgba(46,163,255,.95)';
        _hlEls.push(el);
      });
    }
    window.addEventListener('message', e => {
      if (e.origin !== location.origin) return;
      const d = e.data;
      if (d && d.type === 'ar-theme') apply(d.theme || null);
      if (d && d.type === 'ar-theme-highlight') highlightRole(d.role);
    });
    // Hover-to-highlight: report which themable role the pointer is over so the
    // designer can flag the matching field. Clicks are swallowed (the preview
    // must not navigate or open the camera when the GM mouses over it).
    const roleOf = el => {
      if (!el || !el.closest) return 'bg';
      // Action buttons have their own Button-fill colour.
      if (el.closest('.btn-primary, .btn-secondary, .md-btn')) return 'button';
      // Points pills (mission card + detail window) have their own colour.
      if (el.closest('.mcard__points, #md-points')) return 'points';
      // Status notices (e.g. "photo uploaded / waiting for review") + centered
      // "time hasn't started" notice + player chat bubbles.
      if (el.closest('.md-state-note, .mcard__pending-tag, .toast, #rejection-overlay, .cn-box')) return 'notice';
      if (el.closest('.chat-bubble')) return 'chat';
      // Task callout + teamname field use the field-fill colour.
      if (el.closest('.md-task, .name-field')) return 'input';
      // Selfie capture square uses the tile-surface colour.
      if (el.closest('.selfie-square')) return 'tile';
      // Text variants: muted labels, secondary body, primary title.
      if (el.closest('.md-label')) return 'text-muted';
      if (el.closest('.mcard__desc, .md-desc')) return 'text-dim';
      if (el.closest('.md-title')) return 'text';
      if (el.closest('.mcard__title, .mcard__task, .cr-tile .name')) return 'tile-text';
      if (el.closest('.p-mission-card, .cr-tile, .mission-card, .cr-mission-card, .md-card')) return 'tile';
      if (el.closest('input, textarea, select, [contenteditable]')) return 'input';
      if (el.closest('.icon-btn, .cr-icon-btn')) return 'nav';
      if (el.closest('.wordmark, .play-wordmark, .theme-logo')) return 'logo';
      if (el.closest('.join-header, .play-topbar, .cr-topbar')) return 'header';
      return 'bg';
    };
    let _lastRole;
    document.addEventListener('mousemove', e => {
      const r = roleOf(e.target);
      if (r !== _lastRole) { _lastRole = r; try { parent.postMessage({ type:'ar-theme-hover', role:r }, location.origin); } catch(e){} }
    }, { passive:true });
    document.addEventListener('mouseleave', () => { _lastRole = null; try { parent.postMessage({ type:'ar-theme-hover', role:null }, location.origin); } catch(e){} });
    // Clicks are swallowed (no navigation), but first tell the designer to LOCK
    // the highlight for whatever was clicked so it stops following the cursor.
    document.addEventListener('click', e => {
      try { parent.postMessage({ type:'ar-theme-lock', role: roleOf(e.target) }, location.origin); } catch(err){}
      e.preventDefault(); e.stopPropagation();
    }, true);
    document.addEventListener('submit', e => { e.preventDefault(); }, true);
    // Tell the opener we're ready to receive the current draft.
    document.addEventListener('DOMContentLoaded', () => {
      try { parent.postMessage({ type:'ar-theme-ready' }, location.origin); } catch(e){}
    }, { once:true });
  } else if (gameId){
    fetch('/api/games/' + encodeURIComponent(gameId) + '/theme')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j && j.theme) apply(j.theme); })
      .catch(() => {});
  }
})();
