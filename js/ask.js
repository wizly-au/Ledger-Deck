/* The Ask drawer and the tax assistant chat. Both use the person's own AI key.
   Before the first question each session, people are told exactly what is sent and to whom. */
import { state, save } from './store.js';
import { esc, md, toast } from './util.js';
import { chat, aiReady, aiName, aiLabel } from './ai.js';
import { financeContext } from './insights.js';
import { sayOnce, stop as stopVoice, synth } from './voice.js';
import { AGENT_LINE } from './tax.js';

export const ASK_RULES = () => `You are the assistant inside Ledger Deck, a free personal and business money app for Australians. Speak in a calm, plain and humble way, like a careful bookkeeper. Never claim to be an accountant, tax agent or financial adviser, and never give personal financial product advice. Answer questions using the figures below, which come from the person's own records. Keep personal and business money separate unless asked to combine them. Be brief: usually 2 to 5 sentences or a few bullets, lead with the answer, use AUD, and show the numbers you used. For tax or super questions, give general information under Australian rules, say when a threshold should be checked on ato.gov.au, and suggest confirming with a registered tax agent before acting. If the figures don't contain the answer, say so plainly. Answers may be read aloud, so avoid tables.`;

let consentGiven = false;
export function consentHtml() {
  const share = state.settings.ai.shareFigures !== false;
  return `<div class="notice consent"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><span>Your question${share ? ' and a summary of your figures (totals by month and category, account balances, invoices; not individual transactions)' : ''} will be sent to <b>${esc(aiName())}</b> using your key. Nothing else leaves this device. <label style="display:inline-flex;gap:6px;align-items:center;margin-top:6px"><input type="checkbox" data-share ${share ? 'checked' : ''}> Include my figures so answers are specific</label></span></div>`;
}

/* A chat bound to a log element. systemFn builds the system prompt at send time. */
export function makeChat({ log, input, sendBtn, system, suggestions = [], intro, speak = () => false, onBusy = () => { } }) {
  let turns = [], ctl = null, busy = false;
  const bubble = (cls, html) => { const d = document.createElement('div'); d.className = 'msg ' + cls; d.innerHTML = html; log.append(d); log.scrollTop = log.scrollHeight; return d; };
  const reset = () => {
    ctl?.abort(); turns = []; log.innerHTML = '';
    bubble('ai', `<p>${intro}</p>`);
    if (!aiReady()) { bubble('ai err', `<p>To ask questions, connect an AI first. It takes a minute: pick a provider, paste your key, test it.</p><p><button class="cta" type="button" data-go="data">Connect an AI</button></p>`); return; }
    if (suggestions.length) { const s = document.createElement('div'); s.className = 'sugg'; s.innerHTML = suggestions.map(q => `<button type="button">${esc(q)}</button>`).join(''); s.querySelectorAll('button').forEach(b => b.onclick = () => send(b.textContent)); log.append(s); }
  };
  const setBusy = b => { busy = b; onBusy(b); };
  async function send(q) {
    q = (q || '').trim(); if (!q || busy) return;
    if (!aiReady()) { reset(); return; }
    if (!consentGiven) {
      const c = bubble('ai', consentHtml() + `<div class="meta"><button class="cta" type="button" data-ok>Send</button><button class="mini" type="button" data-no>Cancel</button></div>`);
      const ok = await new Promise(res => { c.querySelector('[data-ok]').onclick = () => res(true); c.querySelector('[data-no]').onclick = () => res(false); c.querySelector('[data-share]').onchange = e => { state.settings.ai.shareFigures = e.target.checked; save(); }; });
      c.remove(); if (!ok) return; consentGiven = true;
    }
    log.querySelector('.sugg')?.remove();
    bubble('me', esc(q)); input.value = ''; turns.push({ role: 'user', content: q }); turns = turns.slice(-12);
    const out = bubble('ai', '<span class="thinking">Thinking…</span>');
    ctl = new AbortController(); setBusy(true);
    try {
      const sys = system() + (state.settings.ai.shareFigures !== false ? `\n\nTHE PERSON'S FIGURES:\n${financeContext()}` : '\n\nThe person chose not to share their figures. Answer generally and say what figures would help.');
      const text = await chat({ system: sys, messages: turns, signal: ctl.signal, onText: t => { out.innerHTML = md(t); log.scrollTop = log.scrollHeight; } });
      out.innerHTML = md(text); turns.push({ role: 'assistant', content: text });
      const m = document.createElement('div'); m.className = 'meta'; m.innerHTML = `<span class="hint">${esc(aiLabel())}</span>${synth ? '<button class="mini" type="button">▶ Read aloud</button>' : ''}`; m.querySelector('button')?.addEventListener('click', () => sayOnce(text)); out.append(m);
      if (speak()) sayOnce(text);
    } catch (e) {
      turns.pop();
      if (e.name === 'AbortError') { if (!out.textContent || out.querySelector('.thinking')) out.innerHTML = '<p class="hint">Stopped.</p>'; }
      else { out.classList.add('err'); out.innerHTML = `<p>${esc(e.message || 'Something went wrong reaching the AI.')}</p>`; }
    } finally { setBusy(false); log.scrollTop = log.scrollHeight; }
  }
  sendBtn.closest('form').onsubmit = e => { e.preventDefault(); if (busy) ctl?.abort(); else send(input.value); };
  input.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!busy) send(input.value); } };
  reset();
  return { send, reset, abort: () => ctl?.abort(), get busy() { return busy; } };
}

/* ---------- the Ask drawer ---------- */
let drawer = null;
const el = id => document.getElementById(id);
export function initAsk() {
  const askEl = el('ask');
  drawer = makeChat({
    log: el('askLog'), input: el('askIn'), sendBtn: el('askSend'), system: ASK_RULES,
    intro: 'Ask about your numbers, personal or business. You can type, or tap the microphone to speak. Answers are general information, not advice.',
    suggestions: ['How am I tracking this month?', 'Where could I cut $300 a month?', 'How much should I put aside for tax?', 'Which invoices should I chase first?'],
    speak: () => el('askSpeak').checked,
    onBusy: b => { el('sendIcon').innerHTML = b ? '<path d="M6 6h12v12H6z"/>' : '<path d="M3 20l18-8L3 4v6l12 2-12 2z"/>'; el('askSend').setAttribute('aria-label', b ? 'Stop' : 'Send'); },
  });
  el('askFab').onclick = () => openAsk();
  el('askClose').onclick = closeAsk;
  el('askClear').onclick = () => drawer.reset();
  el('askIn').addEventListener('keydown', e => { if (e.key === 'Escape') closeAsk(); });
  // speech input where the browser supports it
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = el('askMic'), note = el('askNote');
  if (!SR) mic.onclick = () => toast('Voice input isn’t supported in this browser. Use your keyboard’s dictation key instead.');
  else { let rec = null; mic.onclick = () => { if (rec) { rec.stop(); return; } stopVoice(); rec = new SR(); rec.lang = 'en-AU'; rec.interimResults = true; mic.classList.add('live'); note.textContent = 'Listening…'; rec.onresult = e => { el('askIn').value = [...e.results].map(r => r[0].transcript).join(''); if (e.results[e.results.length - 1].isFinal) { const q = el('askIn').value; rec.stop(); drawer.send(q); } }; rec.onerror = e => toast(e.error === 'not-allowed' ? 'Microphone access was blocked. Allow it in your browser settings, or type instead.' : 'Didn’t catch that. Try again.'); rec.onend = () => { rec = null; mic.classList.remove('live'); note.textContent = ''; }; try { rec.start(); } catch { rec = null; mic.classList.remove('live'); note.textContent = ''; } }; }
  askEl.dataset.ready = '1';
}
export function openAsk(q) {
  const askEl = el('ask'); askEl.classList.add('open'); askEl.setAttribute('aria-hidden', 'false');
  el('askWho').textContent = aiReady() ? `Answers from ${aiLabel()}` : 'Connect an AI to ask questions';
  if (!aiReady() || el('askLog').querySelector('.err')) drawer.reset();
  setTimeout(() => el('askIn').focus(), 50); if (q) drawer.send(q);
}
export function closeAsk() { const askEl = el('ask'); askEl.classList.remove('open'); askEl.setAttribute('aria-hidden', 'true'); drawer?.abort(); stopVoice(); }
export const TAX_RULES = () => `You are the tax assistant inside Ledger Deck, a free money app for Australians. Act like a knowledgeable, calm and humble accountant explaining things to a client, but never call yourself an accountant, tax agent or adviser, and never offer to lodge anything. Give general information about Australian tax rules only, using the person's figures and the tax estimate below. Be brief: lead with the answer in 2 to 5 sentences or a few bullets, show the numbers you used, and use AUD. When a strategy is involved, add one short line on why it might not suit them. Flag anything high-risk or judgement-based (for example Part IVA, trusts, Division 7A, employee versus contractor, residency) as needing a professional. Mention ato.gov.au where useful, and say when a rate or threshold should be checked. Always end with: "${AGENT_LINE}"`;
