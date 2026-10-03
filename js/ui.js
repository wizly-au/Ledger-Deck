/* Router, tabs, detail sheet, tooltips and small form helpers shared by every screen. */
import { drawAll, clearTables, TBL } from './charts.js';
import { esc } from './util.js';
import { stop as stopVoice } from './voice.js';

export const V = {};      // name -> {title, render(), bind(), tabs, tab:{key:{render,bind}}}
export const sub = {};    // current tab per view
export let current = 'briefing';
const hooks = [];
export const onNav = f => hooks.push(f);

export function go(v, tab, keepScroll = false) {
  if (!V[v]) v = 'briefing';
  stopVoice(); closeSheet(); current = v; const def = V[v];
  if (def.tabs) sub[v] = tab && def.tabs.some(t => t[0] === tab) ? tab : (sub[v] || def.tabs[0][0]);
  clearTables();
  const y = scrollY;
  document.getElementById('root').innerHTML = `<div class="view">${def.render()}</div>`;
  document.getElementById('title').textContent = def.title;
  document.title = `${def.title} · Ledger Deck`;
  document.querySelectorAll('.nav').forEach(n => n.setAttribute('aria-current', n.dataset.view === v ? 'page' : 'false'));
  try { localStorage.setItem('ld-view', v); } catch { }
  if (location.hash.slice(1) !== v) history.replaceState(null, '', '#' + v);
  drawAll(); def.bind && def.bind();
  if (def.tabs) setTab(sub[v], true);
  scrollTo({ top: keepScroll ? y : 0 });
  hooks.forEach(f => f(v));
}
export const refresh = () => go(current, sub[current], true);

export function setTab(t) {
  const def = V[current]; if (!def?.tabs) return; sub[current] = t;
  const body = document.getElementById('tabBody'); if (!body) return;
  clearTables(id => { const el = document.getElementById(id); return el && !body.contains(el); });
  body.innerHTML = def.tab[t].render();
  document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  moveInk(); drawAll(); def.tab[t].bind && def.tab[t].bind();
}
export const tabsHtml = v => `<div class="tabs" role="tablist" id="tabs">${V[v].tabs.map(([key, l]) => `<button type="button" role="tab" data-tab="${key}" aria-selected="${sub[v] === key}">${l}</button>`).join('')}<span class="ink"></span></div><div id="tabBody"></div>`;
export function moveInk() { const tb = document.getElementById('tabs'); if (!tb) return; const a = tb.querySelector('[aria-selected="true"]'), ink = tb.querySelector('.ink'); if (a && ink) { ink.style.left = a.offsetLeft + 'px'; ink.style.width = a.offsetWidth + 'px'; } }
addEventListener('resize', moveInk);

/* detail sheet */
let sheetClose = null;
export function openSheet(title, html, after, onClose) {
  const sh = document.getElementById('sheet');
  document.getElementById('sheetT').textContent = title;
  document.getElementById('sheetB').innerHTML = html;
  sh.classList.add('on'); sh.setAttribute('aria-hidden', 'false'); document.getElementById('sheetBg').classList.add('on');
  sheetClose = onClose || null;
  for (const id in TBL) { const el = document.getElementById(id); if (el && sh.contains(el)) drawAll(); }
  after && after();
  setTimeout(() => document.getElementById('sheetX').focus(), 50);
}
export function closeSheet() {
  const sh = document.getElementById('sheet'); if (!sh?.classList.contains('on')) return;
  sh.classList.remove('on'); sh.setAttribute('aria-hidden', 'true'); document.getElementById('sheetBg').classList.remove('on');
  const f = sheetClose; sheetClose = null; f && f();
  document.dispatchEvent(new Event('sheet-closed'));
}
export const sheetOpen = () => document.getElementById('sheet')?.classList.contains('on');

export function segBind(id, cb) { const s = document.getElementById(id); if (!s) return; s.querySelectorAll('button').forEach(b => b.onclick = () => { s.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); cb && cb(b); }); }
export function filterBind(id, cb) { const s = document.getElementById(id); if (!s) return; s.querySelectorAll('button').forEach(b => b.onclick = () => { s.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); cb(b.dataset.f); }); }
/* A button that needs a second click to confirm something that can't be undone. */
export function confirmBtn(btn, label, action) {
  btn.onclick = () => {
    if (!btn.dataset.sure) { btn.dataset.sure = 1; const old = btn.textContent; btn.textContent = label; setTimeout(() => { delete btn.dataset.sure; btn.textContent = old; }, 4000); return; }
    delete btn.dataset.sure; action();
  };
}
export const opt = (v, l, sel) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(l)}</option>`;
export const field = (label, inner, hint = '') => `<label class="field"><span>${label}${hint ? ` <span class="hint">${hint}</span>` : ''}</span>${inner}</label>`;

/* A small modal asking for a password, used for backups and the passcode. */
export function askPassword({ title, body = '', confirm = false, button = 'Continue' }) {
  return new Promise(res => {
    const bg = document.createElement('div'); bg.className = 'pal-bg';
    bg.innerHTML = `<form class="pal modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-b"><h3>${esc(title)}</h3>${body ? `<p class="hint">${body}</p>` : ''}<label class="field"><span>Password</span><input type="password" id="pw1" autocomplete="new-password" required minlength="6"></label>${confirm ? '<label class="field"><span>Type it again</span><input type="password" id="pw2" autocomplete="new-password" required></label>' : ''}<p class="err" id="pwErr" role="alert"></p></div><div class="wiz-f"><span class="sp"></span><button type="button" class="cta ghost" id="pwCancel">Cancel</button><button class="cta" type="submit">${esc(button)}</button></div></form>`;
    document.body.append(bg); const f = bg.querySelector('form'); bg.querySelector('#pw1').focus();
    const done = v => { bg.remove(); res(v); };
    bg.querySelector('#pwCancel').onclick = () => done(null);
    bg.onclick = e => { if (e.target === bg) done(null); };
    f.onsubmit = e => { e.preventDefault(); const a = f.querySelector('#pw1').value, b = f.querySelector('#pw2')?.value; if (a.length < 6) { f.querySelector('#pwErr').textContent = 'Use at least 6 characters.'; return; } if (confirm && a !== b) { f.querySelector('#pwErr').textContent = 'The two don’t match.'; return; } done(a); };
    f.onkeydown = e => { if (e.key === 'Escape') done(null); };
  });
}

/* tooltips */
export function initTips() {
  const tip = document.getElementById('tip'); let cur = null;
  document.addEventListener('pointerover', e => { const t = e.target.closest?.('[data-tip]'); if (t === cur) return; cur = t; if (!t) { tip.classList.remove('on'); return; } tip.innerHTML = t.dataset.tip; tip.classList.add('on'); });
  document.addEventListener('pointermove', e => { if (!cur) return; const r = tip.getBoundingClientRect(); let x = e.clientX + 16, y = e.clientY + 16; if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14; if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14; tip.style.left = x + 'px'; tip.style.top = y + 'px'; }, { passive: true });
  document.addEventListener('pointerleave', () => { cur = null; tip.classList.remove('on'); });
  addEventListener('scroll', () => { cur = null; tip.classList.remove('on'); }, { passive: true });
}

export const icon = {
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>',
};
export const notice = (html, ic = 'info') => `<div class="notice">${icon[ic]}<span>${html}</span></div>`;
