/* First-launch setup. Every answer can be changed later in Data & AI. */
import { state, save, setPasscode, hasPasscode } from './store.js';
import { esc, toast } from './util.js';
import { go, opt, field, notice, icon } from './ui.js';
import { aiForm, bindAiForm, startImport } from './views/data.js';
import { aiReady, aiLabel } from './ai.js';

const S = () => state.settings;
const STEPS = [
  { t: 'Welcome', r: () => `<h2>Welcome to Ledger Deck</h2><p class="lede">A free dashboard for your personal and business money, built for Australians. Setup takes a few minutes and you can change everything later.</p>
    ${notice('<b>Your data stays on this device.</b> There’s no account, no sign-up and no tracking. When you ask the AI something, that question goes to the AI company you choose, using your own key. Nothing else leaves this device.', 'lock')}
    <div class="checklist"><div class="ci"><span class="ic" style="background:var(--accent)">1</span><span>Choose what to track and tell it a little about you</span></div><div class="ci"><span class="ic" style="background:var(--accent)">2</span><span>Connect an AI if you’d like Ask and the tax assistant (optional)</span></div><div class="ci"><span class="ic" style="background:var(--accent)">3</span><span>Bring in your accounts by importing statements from your bank</span></div></div>
    <p class="hint">Ledger Deck gives general information only, not financial or tax advice. Always check with a registered tax agent or licensed adviser before acting.</p>` },
  { t: 'What to track', r: () => `<h2>What would you like to track?</h2><p class="lede">Personal and business money are always kept in separate books.</p>
    <div class="choice" id="wTrack"><button type="button" data-k="P" aria-pressed="${S().track.P}"><b>Personal</b><small>Bank accounts, cards, super, shares, loans and your own tax return.</small></button><button type="button" data-k="B" aria-pressed="${S().track.B}"><b>Business</b><small>Sales, costs, invoices, GST and BAS for a sole trader or company.</small></button></div>`,
    b: () => document.querySelectorAll('#wTrack button').forEach(x => x.onclick = () => { const on = x.getAttribute('aria-pressed') !== 'true'; x.setAttribute('aria-pressed', on); S().track[x.dataset.k] = on; save(); }),
    ok: () => S().track.P || S().track.B || 'Choose at least one.' },
  { t: 'About you', r: () => `<h2>A little about you</h2><p class="lede">This sets up the tax rules. Nothing here is shared.</p>
    <div class="wiz-grid">
      ${field('Australian resident for tax purposes?', `<select data-st="resident">${opt('yes', 'Yes', S().resident)}${opt('no', 'No', S().resident)}${opt('unsure', 'Not sure', S().resident)}</select>`)}
      ${field('Do you use a registered tax agent?', `<select data-st="agent">${opt('yes', 'Yes', S().agent)}${opt('no', 'No, I lodge myself', S().agent)}${opt('looking', 'Not yet, but I’d like one', S().agent)}</select>`)}
      ${field('Private hospital cover?', `<select data-st="phi">${opt('yes', 'Yes', S().phi)}${opt('no', 'No', S().phi)}</select>`)}
      ${field('Study loan (HELP)?', `<select data-st="help">${opt('no', 'No', S().help)}${opt('yes', 'Yes', S().help)}</select>`)}
      ${S().track.B ? `${field('Business name', `<input data-st="bizName" maxlength="60" value="${esc(S().bizName)}">`)}
      ${field('ABN <span class="hint">(optional)</span>', `<input data-st="abn" inputmode="numeric" placeholder="11 digits" maxlength="14" value="${esc(S().abn)}">`)}
      ${field('Business structure', `<select data-st="entity">${opt('sole', 'Sole trader', S().entity)}${opt('company', 'Company (Pty Ltd)', S().entity)}${opt('partnership', 'Partnership', S().entity)}${opt('trust', 'Trust', S().entity)}</select>`)}
      ${field('Registered for GST?', `<select data-st="gst">${opt('yes', 'Yes', S().gst)}${opt('no', 'No', S().gst)}</select>`)}
      ${field('How often do you lodge a BAS?', `<select data-st="bas">${['Quarterly', 'Monthly', 'Annually'].map(x => opt(x, x, S().bas)).join('')}</select>`)}` : ''}
    </div><p class="hint" id="wAboutMsg">${S().resident !== 'yes' ? 'Estimates use Australian resident rates. If you’re not a resident or not sure, check with a registered tax agent.' : ''}</p>`,
    b: () => document.querySelectorAll('[data-st]').forEach(el => el.oninput = el.onchange = () => { S()[el.dataset.st] = el.value; save(); document.getElementById('wAboutMsg').textContent = S().resident !== 'yes' ? 'Estimates use Australian resident rates. If you’re not a resident or not sure, check with a registered tax agent.' : ''; }),
    ok: () => !S().abn || S().abn.replace(/\s/g, '').length === 11 || 'An ABN has 11 digits.' },
  { t: 'Connect an AI', skip: true, r: () => `<h2>Connect an AI <span class="hint" style="font-size:14px;font-weight:400">(optional)</span></h2><p class="lede">Bring your own key from the AI company you already use. The dashboard works without one, but Ask and the tax assistant need it. You pay the provider directly for what you use, usually cents per question. OpenRouter is the easiest single key if you’re unsure.</p><div id="wAi">${aiForm()}</div>
    ${notice('Want nothing to leave your computer at all? Choose Ollama or LM Studio to use a model running on your own machine.', 'lock')}`,
    b: () => { const rb = () => { document.getElementById('wAi').innerHTML = aiForm(); bindAiForm(rb); }; bindAiForm(rb); } },
  { t: 'Add your accounts', r: () => `<h2>Bring in your accounts</h2><p class="lede">Download a statement from your bank as CSV, OFX or QIF and drop it here. Each file goes into one account. You can add more any time from Data &amp; AI.</p>
    <div class="drop" id="wDrop"><p>Drop a statement here or <label for="wFile">choose a file</label></p><input type="file" id="wFile" accept=".csv,.ofx,.qfx,.qif,.pdf,.txt,text/csv,application/pdf" hidden><p class="hint">Read in your browser and kept on this device.</p></div>
    <div id="wImported" class="hint"></div>
    <details><summary style="cursor:pointer;font-weight:500">Where do I find the file?</summary><p class="say" style="margin-top:8px">In internet banking on a computer, open the account and look for <i>Export</i> or <i>Download transactions</i>. Choose CSV and a date range (1 July last year to today is a good start). For super, download a statement PDF. For shares, you can type your portfolio value on an account.</p></details>
    <p class="hint">Ledger Deck never asks for your bank password. Automatic bank feeds need an accreditation the free app doesn’t have, so statements are the way in.</p>`,
    b: () => {
      const f = document.getElementById('wFile'), d = document.getElementById('wDrop');
      const upd = () => { document.getElementById('wImported').innerHTML = state.accounts.length ? `Added so far: ${state.accounts.map(a => `<b>${esc(a.name)}</b>`).join(', ')}` : ''; };
      f.onchange = () => { const x = f.files[0]; f.value = ''; x && startImport(x); };
      d.ondragover = e => { e.preventDefault(); d.classList.add('over'); }; d.ondragleave = () => d.classList.remove('over'); d.ondrop = e => { e.preventDefault(); d.classList.remove('over'); const x = e.dataTransfer.files[0]; x && startImport(x); };
      upd(); document.addEventListener('sheet-closed', upd);
    } },
  { t: 'Protect it', r: () => `<h2>Protect your data</h2><p class="lede">With a passcode, your records are encrypted in this browser and the app asks for it each time it opens.</p>
    <div class="wiz-grid">${field('Passcode <span class="hint">(at least 6 characters)</span>', '<input id="wPin" type="password" autocomplete="new-password">')}${field('Type it again', '<input id="wPin2" type="password" autocomplete="new-password">')}</div>
    <p class="hint">${hasPasscode() ? 'A passcode is already set. Leave these empty to keep it.' : 'Leave both empty to skip.'} If you forget the passcode, your data can’t be recovered, so make an encrypted backup from Data &amp; AI now and then.</p>`,
    ok: async () => { const a = document.getElementById('wPin').value, b = document.getElementById('wPin2').value; if (!a && !b) return true; if (a.length < 6) return 'Use at least 6 characters, or leave both empty to skip.'; if (a !== b) return 'The two passcodes don’t match.'; await setPasscode(a); return true; } },
  { t: 'Done', r: () => `<h2>You’re set up</h2><p class="lede">Here’s what Ledger Deck will use. Everything can be changed from Data &amp; AI.</p>
    <table class="est"><tr><td>Tracking</td><td class="n">${[S().track.P && 'Personal', S().track.B && 'Business'].filter(Boolean).join(' and ')}</td></tr><tr><td>Tax rules</td><td class="n">${S().resident === 'yes' ? 'Australian resident' : 'Check residency with a tax agent'}</td></tr>${S().track.B ? `<tr><td>Business</td><td class="n">${S().gst === 'yes' ? 'GST registered, ' + S().bas.toLowerCase() + ' BAS' : 'Not registered for GST'}</td></tr>` : ''}<tr><td>AI</td><td class="n">${aiReady() ? esc(aiLabel()) : 'Not connected (add one any time)'}</td></tr><tr><td>Accounts</td><td class="n">${state.accounts.length || 'None yet'}</td></tr><tr><td>Passcode</td><td class="n">${hasPasscode() ? 'On' : 'Off'}</td></tr></table>` },
];

let step = 0;
export function openWizard(n = 0) { step = n; render(); }
function close() { document.getElementById('wizRoot').innerHTML = ''; document.body.classList.remove('wiz-open'); }
function render() {
  const s = STEPS[step], last = step === STEPS.length - 1;
  document.body.classList.add('wiz-open');
  document.getElementById('wizRoot').innerHTML = `<div class="wiz-bg" role="dialog" aria-modal="true" aria-label="Set up Ledger Deck"><div class="wiz">
    <div class="wiz-h"><div class="brand"><i aria-hidden="true"></i>Ledger Deck</div><span class="hint">Step ${step + 1} of ${STEPS.length}</span><div class="wiz-steps" aria-hidden="true">${STEPS.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div></div>
    <div class="wiz-b" id="wizB">${s.r()}</div>
    <div class="wiz-f"><span class="sp" id="wizMsg" role="alert">${step === 0 ? '<button class="linkbtn" type="button" id="wizSample">Try it with sample data first</button>' : ''}</span>${step ? '<button class="cta ghost" type="button" id="wizBack">Back</button>' : ''}${s.skip && !aiReady() ? '<button class="cta ghost" type="button" id="wizLater">Skip for now</button>' : ''}<button class="cta" type="button" id="wizNext">${step === 0 ? 'Get started' : last ? 'Open my dashboard' : 'Continue'}</button></div>
  </div></div>`;
  s.b && s.b();
  const msg = document.getElementById('wizMsg');
  document.getElementById('wizNext').onclick = async () => {
    const v = s.ok ? await s.ok() : true; if (v !== true) { msg.innerHTML = `<span class="err">${esc(v)}</span>`; return; }
    if (last) { S().done = true; save(); close(); go(state.tx.length ? 'briefing' : 'data'); toast('Setup saved on this device.'); return; }
    step++; render();
  };
  document.getElementById('wizBack')?.addEventListener('click', () => { step--; render(); });
  document.getElementById('wizLater')?.addEventListener('click', () => { step++; render(); });
  document.getElementById('wizSample')?.addEventListener('click', () => { close(); import('./app.js').then(m => m.loadSample()); });
  setTimeout(() => document.getElementById('wizNext')?.focus({ preventScroll: true }), 30);
}
