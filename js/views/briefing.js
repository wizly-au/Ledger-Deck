import { state } from '../store.js';
import { fmt, k, esc, dshort, days, monthLabel, sum, N } from '../util.js';
import { V, segBind } from '../ui.js';
import { ring, pill, tagB, tbl, lineChart, groupBars } from '../charts.js';
import { upcoming, accts } from '../model.js';
import { personal, business, alerts, briefingLines } from '../insights.js';
import { speakLines, stop, voices, synth, canCloudVoice } from '../voice.js';
import { save } from '../store.js';

const sevColor = { bad: 'var(--bad)', warn: 'var(--warn)', info: 'var(--accent)', good: 'var(--good)' };
let kind = 'all', speaking = false;

export function emptyState() {
  return `<section class="panel hero"><div class="ring" style="width:64px;height:64px;border-radius:50%;background:var(--accent-soft)"></div>
  <div><div class="label" style="margin-bottom:6px">Let's get your numbers in</div><h2>Ledger Deck works from your own statements. <em class="c">Import one</em> to see your first briefing, or try it with sample data first.</h2>
  <div class="pills" style="margin-top:12px"><button class="cta" type="button" data-go="data">Import a statement</button><button class="cta ghost" type="button" data-sheet="newacct:P">Add an account by hand</button><button class="cta ghost" type="button" id="trySample">Try with sample data</button></div></div><div></div></section>`;
}

V.briefing = {
  title: 'Briefing',
  render() {
    if (!state.tx.length && !state.accounts.length) return emptyState();
    const P = personal(), B = business(), A = alerts(P, B);
    const both = P.has && B.has;
    const head = [];
    if (P.has) head.push(P.rate == null ? `Your personal net worth is <em class="c">${k(P.nw)}</em>` : P.saved >= 0 ? `You kept <em class="g">${Math.round(P.rate * 100)}% of what came in</em> last month` : `You spent <em class="w">${k(-P.saved)} more than came in</em> last month`);
    if (B.has) head.push(B.last.rev || B.last.exp ? `the business made ${B.last.profit >= 0 ? `<em class="g">${k(B.last.profit)} profit</em>` : `<em class="r">a ${k(-B.last.profit)} loss</em>`} last quarter` : `the business has <em class="c">${k(B.cash)}</em> in the bank`);
    let line = head.join(', and ') + '.';
    line = line[0].toUpperCase() + line.slice(1);
    const urgent = A.filter(a => a.sev !== 'info').length;
    const up = upcoming(14);
    return `
<section class="panel hero">
  <div style="display:flex;gap:14px">${P.has && P.rate != null ? ring(Math.max(P.rate, 0) * 100, { value: Math.round(P.rate * 100) + '%', small: 'Kept', size: 108, btn: 'data-go="personal" aria-label="Personal overview"' }) : ''}${B.has && B.margin != null ? ring(Math.max(B.margin, 0) * 100, { value: Math.round(B.margin * 100) + '%', small: 'Margin', size: 108, btn: 'data-go="business" aria-label="Business overview"' }) : ''}</div>
  <div><div class="label" style="margin-bottom:6px">In one line</div><h2>${line}</h2>
    <div class="pills">${urgent ? pill(`${urgent} thing${urgent > 1 ? 's' : ''} to look at`, 'warn') : pill('Nothing urgent', 'good')}${state.demo ? pill('Sample data', 'muted') : ''}</div></div>
  <div class="qs">${P.has ? `<div>Net worth <b class="num">${k(P.nw)}</b></div><div>Spent last month <b class="num">${k(P.spend)}</b></div>` : ''}${B.has ? `<div>Business cash <b class="num">${k(B.cash)}</b></div>${B.runway != null ? `<div>Runway <b class="num">${B.runway.toFixed(1)} mo</b></div>` : ''}` : ''}</div>
</section>
<section class="panel" id="voicePanel">
  <div class="voice">
    <button class="play" type="button" id="playBtn" aria-label="Play briefing"><svg viewBox="0 0 24 24" id="playIcon"><path d="M7 4l14 8-14 8z"/></svg></button>
    <div style="min-width:0">
      <div class="ph"><h2>Your briefing</h2><span class="aside">${canCloudVoice() && state.settings.voiceSrc === 'cloud' ? 'Read aloud with OpenAI’s voice' : 'Read aloud with this device’s voice'}</span></div>
      <div class="wave" aria-hidden="true">${Array.from({ length: 48 }, (_, i) => `<span style="--k:${i}"></span>`).join('')}</div>
      <div class="ctrl">
        ${both ? `<div class="seg" id="briefKind"><button type="button" aria-pressed="${kind === 'all'}" data-k="all">Everything</button><button type="button" aria-pressed="${kind === 'personal'}" data-k="personal">Personal</button><button type="button" aria-pressed="${kind === 'business'}" data-k="business">Business</button></div>` : ''}
        <select id="rate" aria-label="Speed">${[.9, 1, 1.2].map(r => `<option value="${r}" ${+state.settings.rate === r ? 'selected' : ''}>${r}×</option>`).join('')}</select>
        <select id="voiceSel" aria-label="Voice"></select>
      </div>
    </div>
  </div>
  <p class="transcript" id="transcript"></p>
  <div class="ctrl"><button class="chip btn" type="button" data-ask="">Ask a follow-up question</button><button class="chip btn" type="button" data-ask="What should I do first this week?">What should I do first this week?</button></div>
</section>
<div class="grid g-7-5">
  <section class="panel"><div class="ph"><h2>Needs attention</h2><span class="aside">Tap one to jump there</span></div>
    ${A.length ? A.map(a => `<button class="alert" type="button" data-go="${a.go}" ${a.tab ? `data-gotab="${a.tab}"` : ''} style="color:${sevColor[a.sev]}"><span class="sev">${a.icon}</span><span style="color:var(--fg)"><b>${esc(a.t)}</b> ${tagB(a.tag)}<small>${esc(a.d)}</small></span><span class="go">›</span></button>`).join('') : '<p class="say">Nothing needs your attention right now.</p>'}
  </section>
  <section class="panel"><div class="ph"><h2>Next 14 days</h2><span class="aside">Expected, based on your regular payments</span></div>
    ${tbl('t14', [{ k: 'd', l: 'When', r: r => `<b>${dshort(r.d)}</b><small>${days(r.d) ? `in ${days(r.d)} day${days(r.d) > 1 ? 's' : ''}` : r.late ? 'overdue' : 'today'}</small>` }, { k: 'w', l: 'What', r: r => `${esc(r.w)}<small>${r.b === 'P' ? 'Personal' : 'Business'}</small>` }, { k: 'a', l: 'Amount', n: 1, r: r => N(r.a > 0 ? '+' + fmt(r.a) : fmt(r.a), r.a > 0 ? 'up' : '') }], up, { sort: 0, dir: 1, limit: 8, empty: 'No regular payments found yet. They appear after a few months of statements.' })}
  </section>
</div>
<div class="grid g2">
  ${P.has && accts('P').length ? `<button class="panel kpi click" type="button" data-go="personal" style="text-align:left"><div class="ph"><h2>Personal net worth</h2>${tagB('P')}</div><span class="big num">${fmt(P.nw)}</span><span class="delta ${P.nwChange >= 0 ? 'up' : 'down'}">${P.nwChange >= 0 ? '▲' : '▼'} ${fmt(Math.abs(P.nwChange))} in 12 months</span>${lineChart([{ name: 'Net worth', vals: P.nwS, color: 'var(--accent)' }], P.ms.map(monthLabel), { h: 150, every: 2 })}</button>` : ''}
  ${B.has ? `<button class="panel kpi click" type="button" data-go="business" style="text-align:left"><div class="ph"><h2>Business: money in less money out</h2>${tagB('B')}</div><span class="big num">${fmt(sum(B.f.inc.slice(-3)) - sum(B.f.out.slice(-3)))}</span><span class="delta">last 3 months, including GST</span>${groupBars([{ name: 'In less out', vals: B.f.inc.map((v, i) => v - B.f.out[i]), color: 'var(--accent)' }], B.ms.map(monthLabel), { h: 150 })}</button>` : ''}
</div>`;
  },
  bind() {
    document.getElementById('trySample')?.addEventListener('click', () => import('../app.js').then(m => m.loadSample()));
    if (!document.getElementById('playBtn')) return;
    const draw = () => { const ls = briefingLines(kind); document.getElementById('transcript').innerHTML = ls.map((s, i) => `<span data-i="${i}">${esc(s)}</span>`).join(' '); return ls; };
    let lines = draw();
    const icon = on => { document.getElementById('playIcon').innerHTML = on ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>' : '<path d="M7 4l14 8-14 8z"/>'; document.getElementById('voicePanel').classList.toggle('speaking', on); };
    const halt = () => { stop(); speaking = false; icon(false); document.querySelectorAll('#transcript span.on').forEach(x => x.classList.remove('on')); };
    document.getElementById('playBtn').onclick = async () => {
      if (speaking) { halt(); return; }
      speaking = true; icon(true);
      await speakLines(lines, i => document.querySelectorAll('#transcript span').forEach(x => x.classList.toggle('on', +x.dataset.i === i)), +document.getElementById('rate').value);
      if (speaking) halt();
    };
    segBind('briefKind', b => { halt(); kind = b.dataset.k; lines = draw(); });
    document.getElementById('rate').onchange = e => { state.settings.rate = +e.target.value; save(); };
    const fill = () => { const sel = document.getElementById('voiceSel'); if (!sel) return; const vs = voices(); sel.innerHTML = (canCloudVoice() ? `<option value="cloud" ${state.settings.voiceSrc === 'cloud' ? 'selected' : ''}>OpenAI voice (uses your key)</option>` : '') + (vs.length ? vs.map(v => `<option value="${esc(v.name)}" ${state.settings.voiceSrc !== 'cloud' && v.name === state.settings.voice ? 'selected' : ''}>${esc(v.name)}</option>`).join('') : '<option value="">Device voice</option>'); };
    fill(); if (synth) synth.onvoiceschanged = fill;
    document.getElementById('voiceSel').onchange = e => { const v = e.target.value; if (v === 'cloud') state.settings.voiceSrc = 'cloud'; else { state.settings.voiceSrc = 'device'; state.settings.voice = v; } save(); };
  },
};
