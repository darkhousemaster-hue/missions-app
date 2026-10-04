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
  const previewPage = preview ? qs.get('tdpage') : null;
  const pageFile = location.pathname.split('/').pop();
  let gameId    = qs.get('game');
  // The join landing can be opened without a game so a team can enter a code.
  // A leftover session game must not apply that location's colors before a
  // location/game has been chosen. Play and CityRush still use the session as
  // a fallback for their internal links, which may omit the game query.
  if (!gameId && !preview && pageFile !== 'join.html') { try { gameId = sessionStorage.getItem('gameId'); } catch(e){} }

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
  const appliedPageVars = [];
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
  function currentPage(){
    if(previewPage) return previewPage;
    if(document.body && document.body.dataset.arThemePage) return document.body.dataset.arThemePage;
    return pageFile==='join.html'?'join':(pageFile==='cityrush.html'?'cityrush':'play');
  }
  function applyPageVars(vars){
    const body=document.body;
    if(body) appliedPageVars.forEach(k=>body.style.removeProperty(k));
    appliedPageVars.length=0;
    if(!body || !vars) return;
    const all=Object.assign({},vars,derived(vars));
    for(const [k,v] of Object.entries(all)){
      if(/^--[a-z0-9-]+$/i.test(k)){body.style.setProperty(k,v);appliedPageVars.push(k);}
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

  // The theme currently in force. Kept so features that need the branding
  // itself — not just its colours — can read it (e.g. the RA map pin graphic).
  let current = {};
  function logoUrl(){ return current && current.logo ? '/uploads/' + current.logo : null; }

  function apply(theme){
    theme = theme || {};
    current = theme;
    applyVars(theme.vars || null);
    applyPageVars((theme.pages||{})[currentPage()]?.vars||null);
    // Border thickness is numeric, so it lives outside `vars` (which is hex-only).
    const root = document.documentElement;
    if (theme.borderWidth != null && theme.borderWidth !== '') root.style.setProperty('--border-width', theme.borderWidth + 'px');
    else root.style.removeProperty('--border-width');
    if (document.body) applyBranding(theme);
    else document.addEventListener('DOMContentLoaded', () => applyBranding(theme), { once:true });
    // Anything drawn outside the DOM flow (the RA map pins are SVG built by
    // Leaflet) can't be restyled by CSS vars alone — let it re-render itself.
    try { document.dispatchEvent(new CustomEvent('ar-theme-applied', { detail: theme })); } catch(e){}
  }

  window.ArTheme = { preview, apply, logoUrl, setPage(page){ if(document.body) document.body.dataset.arThemePage=page; apply(current); } };

  if (preview){
    // Reverse hover: the designer asks us to outline the element(s) a hovered
    // setting recolours. Inverse of roleOf below.
    const SEL_BY_ROLE = {
      bg:'body', header:'.play-topbar, .join-header, .cr-topbar',
      tile:'.p-mission-card, .cr-tile, .selfie-square, .team-row', 'tile-active':'.p-mission-card:hover, .cr-tile:hover',
      'tile-text':'.mcard__title, .mcard__task, .cr-tile .name, .team-row .name',
      'points-bg':'.mcard__points, #md-points', points:'.mcard__points, #md-points',
      'button-bg':'.btn-primary, .btn-secondary, .md-actions .md-btn, .join-cta .btn-primary, .team-row .join-btn',
      'button-primary-text':'.join-cta .btn-primary, .md-actions .md-btn--primary, .team-row .join-btn',
      'button-secondary-text':'.md-actions .md-btn--secondary',
      'button-join-text':'.join-existing-link', nav:'.icon-btn, .cr-icon-btn',
      input:'.md-task, .name-field, .input',
      // notice covers the detail status note, the card's post-upload "awaiting
      // review" tag, the centered notice, and the rejection popup.
      'notice-bg':'.md-state-note, .mcard__pending-tag, .toast, #rejection-overlay, .cn-box, .msg-popup-box',
      'notice-text':'.md-state-note, .mcard__pending-tag, .toast, #rejection-overlay, .cn-box, .msg-popup-box',
      chat:'.chat-bubble',
      // Each Text setting points at what it actually recolours (primary title,
      // secondary body, muted labels) — not all at the same element.
      text:'.md-title, .name-field input, .join-body .lead', 'text-dim':'.mcard__desc, .md-desc', 'text-muted':'.md-label',
      accent:'#technical-support a, .join-existing-link, .mcard__task .arrow, .md-task .arrow, .score-pill svg, .cr-tile .badges, .cr-tile.pending .status-pill, .cr-tile.current .status-pill, .cr-mission-number, .topbar-btn.active',
      success:'.mcard__check, .cr-tile.done .status-pill, .cr-gps-dot.near, .cr-gps-dot.arrived',
      logo:'.play-wordmark, .wordmark, .theme-logo', border:'.p-mission-card, .cr-tile',
    };
    let _hlEls = [];
    let _hoverOutline;
    function clearRoleHighlight(){ _hlEls.forEach(({el,old})=>{ for(const [k,v] of Object.entries(old)){ if(v.value) el.style.setProperty(k,v.value,v.priority); else el.style.removeProperty(k); } }); _hlEls=[]; }
    function addRoleHighlight(el){
      const props=['outline','outline-offset','box-shadow'];
      const old=Object.fromEntries(props.map(k=>[k,{value:el.style.getPropertyValue(k),priority:el.style.getPropertyPriority(k)}]));
      el.style.setProperty('outline','3px solid #2ea3ff','important');
      el.style.setProperty('outline-offset','2px','important');
      el.style.setProperty('box-shadow','0 0 0 3px #fff, 0 0 0 6px #2ea3ff, 0 0 20px 4px rgba(46,163,255,.95)','important');
      _hlEls.push({el,old});
    }
    function outlineHoveredElement(el){
      if(!el || !el.getBoundingClientRect){ if(_hoverOutline) _hoverOutline.style.display='none'; return; }
      if(!_hoverOutline){
        _hoverOutline=document.createElement('div');
        _hoverOutline.setAttribute('aria-hidden','true');
        _hoverOutline.style.cssText='position:fixed;z-index:2147483647;pointer-events:none;box-sizing:border-box;border:2px solid #fff;border-radius:4px;box-shadow:0 0 0 3px #2ea3ff,0 0 18px 5px rgba(46,163,255,.95);background:rgba(46,163,255,.08);';
        document.body.appendChild(_hoverOutline);
      }
      const r=el.getBoundingClientRect();
      if(!r.width || !r.height){ _hoverOutline.style.display='none'; return; }
      Object.assign(_hoverOutline.style,{display:'block',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
    }
    // Bold, high-contrast double ring (white + blue + glow) so the highlight is
    // obvious on ANY themed background, including light/yellow ones.
    function highlightVariable(variable,scopeName){
      const root=scopeName==='page'?document.body:document.documentElement;
      if(!root || !/^--[a-z0-9-]+$/i.test(variable||'')) return [];
      const magenta='#ff00d4';
      const derived={
        '--text':{'--hairline':'rgba(255,0,212,.08)'},
        '--orange':{'--orange-soft':'rgba(255,0,212,.14)','--orange-dim':'rgba(255,0,212,.55)','--glow-orange':'0 0 16px rgba(255,0,212,.45)','--team-color':magenta},
        '--green':{'--green-soft':'rgba(255,0,212,.14)','--green-dim':'rgba(255,0,212,.55)'},
        '--red':{'--red-light':'#ff48e1','--red-dim':'#a6008b','--glow-red':'0 0 12px rgba(255,0,212,.5)'},
      }[variable]||{};
      const values={[variable]:magenta,...derived};
      const nodes=[root,...root.querySelectorAll('*')].filter(el=>el.getClientRects().length);
      const props=['background-color','color','border-top-color','border-right-color','border-bottom-color','border-left-color','outline-color','text-decoration-color','fill','stroke','box-shadow','text-shadow','filter','accent-color'];
      const read=el=>{const s=getComputedStyle(el);return props.map(k=>s.getPropertyValue(k)).join('|');};
      const freeze=document.createElement('style');freeze.textContent='*,*::before,*::after{transition:none!important;animation:none!important;}';document.head.appendChild(freeze);
      const before=nodes.map(read), saved=[];
      for(const [key,value] of Object.entries(values)){
        saved.push({scope:root,key,value:root.style.getPropertyValue(key),priority:root.style.getPropertyPriority(key)});
        root.style.setProperty(key,value,'important');
      }
      void root.offsetHeight;
      const changed=nodes.filter((el,i)=>read(el)!==before[i]);
      for(const old of saved){ if(old.value)old.scope.style.setProperty(old.key,old.value,old.priority);else old.scope.style.removeProperty(old.key); }
      freeze.remove();
      // Hover-only fills do not affect computed styles until a tile is hovered.
      // The editor is asking which elements this setting controls, so show its
      // tile targets in the idle preview as well.
      if(variable==='--tile-active'){
        changed.push(...[...root.querySelectorAll('.p-mission-card, .cr-tile')].filter(el=>el.getClientRects().length));
      }
      return changed;
    }
    function highlightRole(role,variable,scope){
      clearRoleHighlight();
      if(variable){
        const changed=highlightVariable(variable,scope);
        changed.forEach(addRoleHighlight);
        return;
      }
      const sel = role && SEL_BY_ROLE[role]; if(!sel) return;
      let els = [...document.querySelectorAll(sel)];
      if(role === 'text'){
        // --text is inherited across most of the player UI. Highlight every
        // visible text-bearing leaf using that variable, rather than only the
        // title and name field where it was originally noticed.
        const target = cssColor(getComputedStyle(document.documentElement).getPropertyValue('--text'));
        els = [...document.querySelectorAll('body *')].filter(el => {
          if(el.children.length || !el.getClientRects().length) return false;
          return cssColor(getComputedStyle(el).color) === target;
        });
      }
      els.forEach(addRoleHighlight);
    }
    function cssColor(value){
      const v=String(value||'').trim().toLowerCase();
      if(/^#[0-9a-f]{3}$/.test(v)) return '#'+v.slice(1).split('').map(c=>c+c).join('');
      if(/^#[0-9a-f]{6}$/.test(v)) return v;
      const m=v.match(/^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/);
      return m ? `#${[m[1],m[2],m[3]].map(n=>Number(n).toString(16).padStart(2,'0')).join('')}` : v;
    }
    window.addEventListener('message', e => {
      if (e.origin !== location.origin) return;
      const d = e.data;
      if (d && d.type === 'ar-theme') apply(d.theme || null);
      if (d && d.type === 'ar-theme-highlight') highlightRole(d.role,d.variable,d.scope);
    });
    // Hover-to-highlight: report which themable role the pointer is over so the
    // designer can flag the matching field. Clicks are swallowed (the preview
    // must not navigate or open the camera when the GM mouses over it).
    function textHitAtPoint(event){
      if(!event) return false;
      try {
        const range=document.caretRangeFromPoint&&document.caretRangeFromPoint(event.clientX,event.clientY);
        if(range&&range.startContainer.nodeType===Node.TEXT_NODE) return !!range.startContainer.textContent.trim();
      } catch(e){}
      try {
        const pos=document.caretPositionFromPoint&&document.caretPositionFromPoint(event.clientX,event.clientY);
        if(pos&&pos.offsetNode.nodeType===Node.TEXT_NODE) return !!pos.offsetNode.textContent.trim();
      } catch(e){}
      return false;
    }
    const roleOf = (el,event) => {
      if (!el || !el.closest) return 'bg';
      const textHit=textHitAtPoint(event) || [...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
      const joinLink=el.closest('.join-existing-link');
      if(joinLink) return textHit?'button-join-text':'accent';
      const button=el.closest('.btn-primary, .btn-secondary, .md-btn, .team-row .join-btn');
      if(button){
        if(!textHit) return 'button-bg';
        if(button.matches('.md-btn--secondary, .btn-secondary')) return 'button-secondary-text';
        return 'button-primary-text';
      }
      const points=el.closest('.mcard__points, #md-points');
      if(points) return textHit?'points':'points-bg';
      const notice=el.closest('.md-state-note, .mcard__pending-tag, .toast, #rejection-overlay, .cn-box, .msg-popup-box');
      if(notice) return textHit?'notice-text':'notice-bg';
      if(el.closest('.chat-bubble')) return 'chat';
      if(el.closest('.name-field .label, .lang-label, .md-label')) return 'text-muted';
      if(el.closest('.mcard__task .arrow, .md-task .arrow, .mcard__title .indoor')) return 'accent';
      if(el.closest('#technical-support a, .score-pill svg, .cr-tile .badges, .cr-mission-number, .topbar-btn.active')) return 'accent';
      if(el.closest('.mcard__check, .cr-tile.done .status-pill, .cr-gps-dot.near, .cr-gps-dot.arrived')) return 'success';
      if(el.closest('.input, .name-field, .md-task, input, textarea, select, [contenteditable]')) return 'input';
      if(el.closest('.selfie-square')) return 'tile';
      if(el.closest('.md-label')) return 'text-muted';
      if(el.closest('.mcard__desc, .md-desc')) return 'text-dim';
      if(el.closest('.md-title')) return 'text';
      if(el.closest('.mcard__title, .mcard__task, .cr-tile .name')) return 'tile-text';
      const tile=el.closest('.p-mission-card, .cr-tile, .mission-card, .cr-mission-card, .md-card');
      if(tile){
        const active=cssColor(getComputedStyle(tile).getPropertyValue('--tile-active'));
        return cssColor(getComputedStyle(tile).backgroundColor)===active?'tile-active':'tile';
      }
      if(el.closest('.icon-btn, .cr-icon-btn')) return 'nav';
      if(el.closest('.wordmark, .play-wordmark, .theme-logo')) return 'logo';
      if(el.matches('.join-header, .play-topbar, .cr-topbar')) return 'header';
      if(textHit || (!el.children.length && el.textContent.trim())){
        const style=getComputedStyle(el), color=cssColor(style.color);
        const primary=cssColor(style.getPropertyValue('--text'));
        const dim=cssColor(style.getPropertyValue('--text-dim'));
        const muted=cssColor(style.getPropertyValue('--text-muted'));
        const orange=cssColor(style.getPropertyValue('--orange'));
        const green=cssColor(style.getPropertyValue('--green'));
        if(color===orange && orange!==primary) return 'accent';
        if(color===green) return 'success';
        if(color===dim && dim!==primary) return 'text-dim';
        if(color===muted && muted!==primary) return 'text-muted';
        return 'text';
      }
      return 'bg';
    };
    let _lastRole;
    document.addEventListener('mousemove', e => {
      outlineHoveredElement(e.target);
      const r = roleOf(e.target,e);
      if (r !== _lastRole) { _lastRole = r; try { parent.postMessage({ type:'ar-theme-hover', role:r }, location.origin); } catch(e){} }
    }, { passive:true });
    document.addEventListener('mouseleave', () => { _lastRole = null; outlineHoveredElement(null); try { parent.postMessage({ type:'ar-theme-hover', role:null }, location.origin); } catch(e){} });
    // Clicks are swallowed (no navigation), but first tell the designer to LOCK
    // the highlight for whatever was clicked so it stops following the cursor.
    document.addEventListener('click', e => {
      try { parent.postMessage({ type:'ar-theme-lock', role: roleOf(e.target,e) }, location.origin); } catch(err){}
      e.preventDefault(); e.stopPropagation();
    }, true);
    document.addEventListener('submit', e => { e.preventDefault(); }, true);
    // Tell the opener we're ready to receive the current draft.
    document.addEventListener('DOMContentLoaded', () => {
      try { parent.postMessage({ type:'ar-theme-ready' }, location.origin); } catch(e){}
    }, { once:true });
  } else if (gameId){
    fetch('/api/games/' + encodeURIComponent(gameId) + '/theme', {cache:'no-store'})
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j && j.theme) apply(j.theme); })
      .catch(() => {});
  }
})();
