/* Start-up: unlock if needed, wire up navigation, register the offline service worker. */
import { load, unlock, state, save, saveNow, replaceState, DEFAULT_STATE, persist } from './store.js';
import { toast, todayIso, fyLabel } from './util.js';
import { V, go, current, sub, setTab, closeSheet, sheetOpen, initTips } from './ui.js';
import { openDetail } from './sheets.js';
import { initAsk, openAsk, closeAsk } from './ask.js';
import { aiReady, aiName } from './ai.js';
import { fyNow, fyProgress } from './model.js';
import './views/briefing.js';
import './views/personal.js';
import './views/business.js';
import './views/tax.js';
import './views/whatif.js';
import './views/data.js';
import { sampleState } from './demo.js';
import { applyEmbed } from './embed.js';

const VIEWS = ['briefing', 'personal', 'business', 'tax', 'whatif', 'data'];
const $ = id => document.getElementById(id);

export async function loadSample() {
  const keepAi = state.settings.ai;
  const s = sampleState(DEFAULT_STATE()); s.settings.ai = keepAi;
  await replaceState(s); updateChrome(); go('briefing');
  toast('Sample data loaded. Clear it from Data & AI when you’re ready to add your own.');
}

function updateChrome() {
  const c = $('aiChip'); c.classList.toggle('ai-ok', aiReady());
  $('aiChipT').textContent = aiReady() ? `AI: ${aiName()}` : 'AI not connected';
  $('sampleTag').hidden = !state.demo;
  const p = fyProgress(); $('fybar').style.width = (p * 100) + '%'; $('fytext').textContent = `FY${String(fyNow()).slice(2)} · ${Math.round(p * 100)}%`;
  $('fy').title = `Australian financial year ${fyLabel(fyNow())}`;
  document.querySelector('.nav[data-view="business"]').hidden = !state.settings.track.B && !state.tx.some(t => t.book === 'B');
}

function wire() {
  document.querySelectorAll('.nav').forEach(n => n.onclick = () => go(n.dataset.view));
  document.addEventListener('click', e => {
    const more = e.target.closest('[data-more]'); if (more) return;
    const g = e.target.closest('[data-go]'); if (g) { closeAsk(); go(g.dataset.go, g.dataset.gotab); return; }
    const t = e.target.closest('[data-tab]'); if (t && V[current]?.tabs) { if (t.dataset.pickcat) sub.pickcat = t.dataset.pickcat; setTab(t.dataset.tab); return; }
    const s = e.target.closest('[data-sheet]'); if (s) { openDetail(s.dataset.sheet); return; }
    const a = e.target.closest('[data-ask]'); if (a) openAsk(a.dataset.ask);
  });
  $('sheetX').onclick = closeSheet; $('sheetBg').onclick = closeSheet;
  $('privacy').onclick = togglePrivacy;
  document.addEventListener('ai-changed', updateChrome);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (sheetOpen()) { closeSheet(); return; } if ($('ask').classList.contains('open')) { closeAsk(); return; } }
    if (e.target.matches('input,select,textarea') || e.altKey || e.metaKey || e.ctrlKey || document.querySelector('.pal-bg') || $('wizRoot').children.length) return;
    if (/^[1-6]$/.test(e.key)) { go(VIEWS[+e.key - 1]); return; }
    if (e.key === 'h' || e.key === 'H') togglePrivacy();
    if (e.key === 'a' || e.key === 'A') { e.preventDefault(); openAsk(); }
  });
  addEventListener('hashchange', () => { const h = location.hash.slice(1); if (V[h] && h !== current) go(h); });
  addEventListener('pagehide', () => { saveNow(); });
}
function togglePrivacy() { const on = document.body.classList.toggle('private'); const b = $('privacy'); b.setAttribute('aria-pressed', on); b.classList.toggle('on', on); b.textContent = on ? 'Show numbers' : 'Hide numbers'; }

function lockScreen() {
  return new Promise(res => {
    const root = $('lockRoot');
    root.innerHTML = `<div class="wiz-bg"><form class="wiz lock" id="lockForm"><div class="wiz-h"><div class="brand"><i aria-hidden="true"></i>Ledger Deck</div></div><div class="wiz-b"><h2>Enter your passcode</h2><p class="lede">Your records are encrypted on this device.</p><label class="field"><span>Passcode</span><input id="lockPw" type="password" autocomplete="current-password" autofocus></label><p class="err" id="lockErr" role="alert"></p><p class="hint">Forgot it? Your data can’t be recovered without it, but you can restore a backup after <button class="linkbtn" type="button" id="lockReset">starting fresh</button>.</p></div><div class="wiz-f"><span class="sp"></span><button class="cta" type="submit">Unlock</button></div></form></div>`;
    $('lockPw').focus();
    $('lockForm').onsubmit = async e => { e.preventDefault(); const btn = e.submitter; btn.disabled = true; btn.textContent = 'Unlocking…'; try { await unlock($('lockPw').value); root.innerHTML = ''; res(); } catch { $('lockErr').textContent = 'That passcode didn’t work.'; btn.disabled = false; btn.textContent = 'Unlock'; $('lockPw').select(); } };
    let sure = false; $('lockReset').onclick = async () => { if (!sure) { sure = true; $('lockReset').textContent = 'click again to delete everything on this device'; return; } const { wipe } = await import('./store.js'); await wipe(); location.reload(); };
  });
}

async function start() {
  applyEmbed(); initTips();
  const st = await load();
  if (st === 'locked') await lockScreen();
  wire(); initAsk(); updateChrome();
  let v = 'briefing'; try { const s = localStorage.getItem('ld-view'); if (V[s]) v = s; } catch { }
  const h = location.hash.slice(1); if (V[h]) v = h;
  go(v);
  if (!state.settings.done) import('./wizard.js').then(m => m.openWizard(0));
  persist();
  document.addEventListener('ai-changed', () => go(current, sub[current], true));
}

/* Offline support and the install prompt. */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => { const w = reg.installing; w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) { const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = 'A new version of Ledger Deck is ready. <button class="linkbtn" type="button" style="color:inherit">Reload</button>'; t.querySelector('button').onclick = () => location.reload(); document.body.append(t); } }); });
  }).catch(() => { }));
}
addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__installPrompt = e; });

start().catch(e => { console.error(e); document.getElementById('root').innerHTML = `<section class="panel"><h2>Ledger Deck couldn’t start</h2><p class="say">This browser may be blocking storage (for example in private browsing). Try a normal window, or another browser.</p><p class="hint">${String(e.message || e)}</p></section>`; });
