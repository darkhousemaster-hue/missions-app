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
    if (document.body) applyBranding(theme);
    else document.addEventListener('DOMContentLoaded', () => applyBranding(theme), { once:true });
  }

  window.ArTheme = { preview, apply };

  if (preview){
    window.addEventListener('message', e => {
      if (e.origin !== location.origin) return;
      const d = e.data;
      if (d && d.type === 'ar-theme') apply(d.theme || null);
    });
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
