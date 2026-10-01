// Shared in-app dialogs, replacing window.alert / confirm / prompt everywhere.
//
// A browser popup cannot be styled, breaks the fiction mid-game, is suppressed
// outright by some mobile browsers, and on an installed home-screen app shows
// the bare origin. Every page loads this and calls uiConfirm / uiPrompt /
// uiAlert instead. All three return a promise, so a call site that used the
// synchronous built-ins has to await.
//
// Colours come from whatever CSS variables the host page defines, with a dark
// fallback, so one dialog looks native in the control room and in the field app.
(function (w) {
  'use strict';
  if (w.uiConfirm) return;

  const CSS = `
.uidlg-back{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;
  padding:20px;background:rgba(6,6,8,.72);opacity:0;transition:opacity .16s cubic-bezier(.22,1,.36,1)}
.uidlg-back.on{opacity:1}
.uidlg{width:100%;max-width:400px;border-radius:12px;padding:20px;
  background:var(--surface,var(--card,#1A1817));color:var(--text,var(--ink,#F4F2EE));
  border:1px solid var(--border,var(--line,#2A2724));
  box-shadow:0 20px 60px rgba(0,0,0,.6);
  font-family:var(--body,Inter,-apple-system,'Segoe UI',Roboto,sans-serif);
  transform:translateY(8px) scale(.99);transition:transform .18s cubic-bezier(.22,1,.36,1)}
.uidlg-back.on .uidlg{transform:none}
.uidlg h4{margin:0 0 9px;font:700 16px/1.3 inherit;color:inherit}
.uidlg p{margin:0 0 15px;font:400 14px/1.5 inherit;color:var(--text-dim,var(--ink2,#9B9690));white-space:pre-wrap}
.uidlg input{width:100%;box-sizing:border-box;margin:0 0 15px;padding:11px 12px;border-radius:7px;
  background:var(--surface2,var(--raised,#221F1D));color:inherit;
  border:1px solid var(--border,var(--line,#2A2724));font:400 15px/1.4 inherit}
.uidlg input:focus{outline:none;border-color:var(--orange,var(--accent,#E85F1E))}
.uidlg .uidlg-row{display:flex;gap:9px}
.uidlg button{flex:1;padding:12px;border:0;border-radius:7px;cursor:pointer;
  font:700 11px/1 inherit;letter-spacing:.09em;text-transform:uppercase;
  background:var(--surface2,var(--raised,#221F1D));color:inherit}
.uidlg button.pri{background:var(--orange,var(--accent,#E85F1E));color:#fff}
.uidlg button.danger{background:#23100F;color:var(--red-light,#FF3B3B)}
`;

  function mount() {
    if (document.getElementById('uidlg-css')) return;
    const st = document.createElement('style');
    st.id = 'uidlg-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  // title/message/ok/cancel/input/danger; resolves to the value, or null when
  // dismissed. Escape and a click on the backdrop both cancel.
  function open(opts) {
    mount();
    return new Promise(resolve => {
      const back = document.createElement('div');
      back.className = 'uidlg-back';
      const hasInput = opts.input !== undefined;
      back.innerHTML =
        '<div class="uidlg" role="dialog" aria-modal="true">' +
        (opts.title ? '<h4></h4>' : '') +
        (opts.message ? '<p></p>' : '') +
        (hasInput ? '<input type="text">' : '') +
        '<div class="uidlg-row">' +
        (opts.cancel === false ? '' : '<button data-x="0"></button>') +
        '<button data-x="1" class="' + (opts.danger ? 'danger' : 'pri') + '"></button>' +
        '</div></div>';
      if (opts.title) back.querySelector('h4').textContent = opts.title;
      if (opts.message) back.querySelector('p').textContent = opts.message;
      const field = back.querySelector('input');
      if (field) { field.value = opts.input || ''; if (opts.placeholder) field.placeholder = opts.placeholder; }
      const no = back.querySelector('[data-x="0"]');
      const yes = back.querySelector('[data-x="1"]');
      if (no) no.textContent = opts.cancel || 'Abbrechen';
      yes.textContent = opts.ok || 'OK';

      let closed = false;
      const done = v => {
        if (closed) return; closed = true;
        back.classList.remove('on');
        document.removeEventListener('keydown', key, true);
        setTimeout(() => back.remove(), 180);
        resolve(v);
      };
      const key = e => {
        if (e.key === 'Escape') { e.preventDefault(); done(null); }
        else if (e.key === 'Enter' && (hasInput || document.activeElement === yes)) { e.preventDefault(); yes.click(); }
      };
      if (no) no.onclick = () => done(null);
      yes.onclick = () => done(hasInput ? (field.value || '') : true);
      back.onclick = e => { if (e.target === back) done(null); };
      document.addEventListener('keydown', key, true);

      document.body.appendChild(back);
      requestAnimationFrame(() => back.classList.add('on'));
      setTimeout(() => { (field || yes).focus(); if (field) field.select(); }, 40);
    });
  }

  w.uiDialog = open;
  w.uiAlert = (message, title) => open({ message, title, cancel: false, ok: 'OK' });
  // Resolves true or false, so `if (!(await uiConfirm(...))) return;` reads the
  // same as the built-in it replaces.
  w.uiConfirm = (message, opts) => open(Object.assign({
    message, ok: 'Ja', cancel: 'Abbrechen', danger: true,
  }, opts || {})).then(v => v === true);
  // Resolves the typed string, or null when dismissed.
  w.uiPrompt = (message, opts) => open(Object.assign({
    message, input: '', ok: 'Weiter', cancel: 'Abbrechen',
  }, opts || {}));
})(window);
