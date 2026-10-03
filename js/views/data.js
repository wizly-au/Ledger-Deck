import { state, save, saveNow, hasPasscode, setPasscode, backupBlob, readBackup, replaceState, wipe } from '../store.js';
import { fmt, esc, N, dshort, dlong, todayIso, uid, toast, download, round2, sum, fyLabel } from '../util.js';
import { V, openSheet, closeSheet, refresh, segBind, confirmBtn, askPassword, opt, field, notice, icon, go } from '../ui.js';
import { ring, pill, tagB, tbl } from '../charts.js';
import { readFile, rowsFromCSV, detect } from '../importers.js';
import { categorise, norm, BCATS, PCATS } from '../categories.js';
import { ASSET_TYPES, DEBT_TYPES, TYPE_LABEL, isDebt, lastImport, tidyName } from '../model.js';
import { PROVIDERS, provById, listModels, testModel, aiReady, aiLabel } from '../ai.js';
import { taxIn, currentFy } from '../tax.js';

/* ---------- AI connection form (shared with the setup wizard) ---------- */
export function aiForm() {
  const a = state.settings.ai, p = provById(a.provider), tiers = [...new Set(PROVIDERS.map(x => x.tier))];
  return `<div class="wiz-grid">
    ${field('Provider', `<select id="aiProv"><option value="">Choose a provider…</option>${tiers.map(t => `<optgroup label="${t}">${PROVIDERS.filter(x => x.tier === t).map(x => opt(x.id, x.name + (x.featured ? ' (one key, many models)' : ''), a.provider)).join('')}</optgroup>`).join('')}</select>`)}
    <label class="field" id="aiKeyWrap" ${p && (p.local) ? 'hidden' : ''}><span>API key ${p?.keyUrl ? `<a class="hint" href="${p.keyUrl}" target="_blank" rel="noopener">Get a key</a>` : ''}</span><input id="aiKey" type="password" autocomplete="off" spellcheck="false" placeholder="${esc(p?.hint || 'Paste your key')}" value="${esc(a.key || '')}"></label>
    <label class="field" id="aiBaseWrap" ${p && (p.local || p.custom) ? '' : 'hidden'}><span>Address</span><input id="aiBase" type="url" spellcheck="false" placeholder="${esc(p?.base || 'https://…/v1')}" value="${esc(a.base || p?.base || '')}"></label>
  </div>
  <p class="hint" id="aiNote">${esc(p?.note || 'Your key is stored only on this device and used only when you ask something. You pay the provider directly for what you use, usually a few cents a question.')}</p>
  <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><button class="cta ghost" type="button" id="aiTest">Test connection</button><span id="aiSt" class="hint" role="status">${aiReady() ? `<span class="ok">✓ Connected: ${esc(aiLabel())}</span>` : ''}</span></div>
  <label class="field" id="aiModelWrap" ${a.ok ? '' : 'hidden'}><span>Model</span><select id="aiModel">${(a.models || [a.model]).filter(Boolean).map(m => opt(m, m, a.model)).join('')}</select></label>`;
}
export function bindAiForm(onChange = () => { }) {
  const $ = id => document.getElementById(id), a = state.settings.ai;
  $('aiProv').onchange = () => { const p = provById($('aiProv').value); state.settings.ai = { ...a, provider: $('aiProv').value, model: '', models: [], key: '', base: p?.local ? p.base : '', ok: false, shareFigures: a.shareFigures }; save(); onChange(); };
  $('aiKey').oninput = () => { state.settings.ai.key = $('aiKey').value.trim(); state.settings.ai.ok = false; save(); };
  $('aiBase').oninput = () => { state.settings.ai.base = $('aiBase').value.trim(); state.settings.ai.ok = false; save(); };
  $('aiTest').onclick = async () => {
    const A = state.settings.ai, p = provById(A.provider), st = $('aiSt');
    if (!p) { st.innerHTML = '<span class="err">Choose a provider first.</span>'; return; }
    if (!p.local && !p.custom && (A.key || '').length < 12) { st.innerHTML = '<span class="err">That key looks too short. Check you copied all of it.</span>'; return; }
    $('aiTest').disabled = true; st.textContent = 'Checking the key…';
    try {
      const models = await listModels(p.id, A.key, A.base);
      A.models = models; A.model = models.includes(A.model) ? A.model : models[0]; A.ok = true;
      st.textContent = `Key accepted. Testing ${A.model}…`;
      try { await testModel(); st.innerHTML = `<span class="ok">✓ Connected.</span> ${models.length} model${models.length > 1 ? 's' : ''} available.`; }
      catch (e) { st.innerHTML = `<span class="warnc">Key works, but ${esc(A.model)} didn’t answer: ${esc(e.message)} Try another model.</span>`; }
      save(); $('aiModel').innerHTML = models.map(m => opt(m, m, A.model)).join(''); $('aiModelWrap').hidden = false;
    } catch (e) { A.ok = false; save(); st.innerHTML = `<span class="err">${esc(e.message)}</span>`; }
    finally { $('aiTest').disabled = false; document.dispatchEvent(new Event('ai-changed')); }
  };
  $('aiModel').onchange = () => { state.settings.ai.model = $('aiModel').value; save(); document.dispatchEvent(new Event('ai-changed')); };
}

/* ---------- importing a file ---------- */
const dupKey = t => `${t.date}|${t.amount.toFixed(2)}|${norm(t.desc)}`;
export function startImport(file, acctId) {
  if (!file) { const i = document.createElement('input'); i.type = 'file'; i.accept = '.csv,.ofx,.qfx,.qif,.pdf,.txt,text/csv,application/pdf'; i.onchange = () => i.files[0] && startImport(i.files[0], acctId); i.click(); return; }
  openSheet('Import ' + file.name, '<p class="hint">Reading the file on this device…</p>');
  readFile(file).then(res => res.kind === 'pdf' ? pdfSheet(file, res, acctId) : txSheet(file, res, acctId)).catch(e => { console.error(e); openSheet('Import', `<p class="err">Couldn’t read ${esc(file.name)}. ${file.name.toLowerCase().endsWith('.pdf') ? 'The PDF may be scanned or protected.' : 'Check it’s a CSV, OFX or QIF export from your bank.'}</p>`); });
}
const acctPicker = (acctId, defType = 'bank') => `<div class="wiz-grid">
  ${field('Put these in', `<select id="impAcct">${state.accounts.map(a => opt(a.id, `${a.name} (${a.book === 'B' ? 'Business' : 'Personal'})`, acctId || '')).join('')}<option value="__new" ${acctId ? '' : 'selected'}>A new account…</option></select>`)}
  <span></span>
  <div class="field" id="newAcctFields" style="grid-column:1/-1;display:${acctId ? 'none' : 'grid'};grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
    ${field('Account name', `<input id="naName" maxlength="60" placeholder="e.g. CommBank everyday">`)}
    ${field('Book', `<select id="naBook">${opt('P', 'Personal', state.settings.track.P ? 'P' : 'B')}${opt('B', 'Business', state.settings.track.P ? 'P' : 'B')}</select>`)}
    ${field('Type', `<select id="naType"><optgroup label="Things you own">${Object.entries(ASSET_TYPES).map(([k, l]) => opt(k, l, defType)).join('')}</optgroup><optgroup label="Things you owe">${Object.entries(DEBT_TYPES).map(([k, l]) => opt(k, l, defType)).join('')}</optgroup></select>`)}
  </div></div>`;
function resolveAcct() {
  const v = document.getElementById('impAcct').value;
  if (v !== '__new') return state.accounts.find(a => a.id === v);
  const name = document.getElementById('naName').value.trim(); if (!name) { toast('Give the new account a name.'); document.getElementById('naName').focus(); return null; }
  const a = { id: uid(), name, book: document.getElementById('naBook').value, type: document.getElementById('naType').value, balance: 0, balanceDate: '', history: [] };
  state.accounts.push(a); return a;
}
function bindPicker() { const s = document.getElementById('impAcct'); s.onchange = () => { document.getElementById('newAcctFields').style.display = s.value === '__new' ? 'grid' : 'none'; }; }

function txSheet(file, res, acctId) {
  let rows = res.rows, det = res.det;
  const colSel = (key, label) => { const hdr = det.header || (res.csv[0] || []).map((_, i) => `Column ${i + 1}`); return field(label, `<select data-map="${key}"><option value="-1">None</option>${hdr.map((h, i) => opt(i, h || `Column ${i + 1}`, det.map[key])).join('')}</select>`); };
  const html = () => {
    const dates = rows.map(r => r.date).sort(), hasBal = rows.some(r => r.balance != null) || !!res.balance;
    return `<p class="say" style="margin:0">Found <b>${rows.length}</b> transactions${rows.length ? ` from ${dlong(dates[0])} to ${dlong(dates.at(-1))}` : ''}. Read on this device; nothing is uploaded.</p>
    ${!rows.length ? notice('No transactions could be read. If this is a CSV, check the columns below.') : ''}
    ${res.kind === 'csv' ? `<details ${rows.length ? '' : 'open'}><summary class="hint" style="cursor:pointer">Columns ${rows.length ? 'look right? Check or change them' : ''}</summary><div class="wiz-grid" style="margin-top:10px">${colSel('date', 'Date')}${colSel('desc', 'Description')}${colSel('amount', 'Amount')}${colSel('debit', 'Debit (money out)')}${colSel('credit', 'Credit (money in)')}${colSel('balance', 'Balance')}${field('Date format', `<select id="dOrder">${opt('dmy', 'Day first (31/12/2026)', det.order)}${opt('mdy', 'Month first (12/31/2026)', det.order)}</select>`)}</div></details>` : ''}
    ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Description</th><th class="n">Amount</th>${hasBal ? '<th class="n">Balance</th>' : ''}</tr></thead><tbody>${rows.slice(0, 6).map(r => `<tr><td>${dshort(r.date)}</td><td>${esc(tidyName(r.desc))}</td><td class="n num ${r.amount > 0 ? 'up' : ''}">${fmt(r.amount, 2)}</td>${hasBal ? `<td class="n num">${r.balance != null ? fmt(r.balance, 2) : ''}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : ''}
    ${acctPicker(acctId)}
    ${!hasBal ? field('Current balance <span class="hint">(optional, from your banking app)</span>', `<input id="impBal" inputmode="decimal" placeholder="Leave empty to keep the balance as it is">`) : ''}
    <p class="hint">Money out should show as negative. If it’s the other way round, <button class="linkbtn" type="button" id="flip">flip the signs</button>.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="cta" type="button" id="impGo" ${rows.length ? '' : 'disabled'}>Import ${rows.length} transactions</button><button class="cta ghost" type="button" id="impCancel">Cancel</button></div>`;
  };
  let flipped = false;
  const draw = () => openSheet('Import ' + file.name, html(), () => {
    bindPicker();
    document.querySelectorAll('[data-map]').forEach(s => s.onchange = () => { det.map[s.dataset.map] = +s.value; rows = rowsFromCSV(res.csv, det); if (flipped) rows.forEach(r => r.amount = -r.amount); draw(); });
    document.getElementById('dOrder')?.addEventListener('change', e => { det.order = e.target.value; rows = rowsFromCSV(res.csv, det); draw(); });
    document.getElementById('flip').onclick = () => { flipped = !flipped; rows.forEach(r => r.amount = -r.amount); draw(); };
    document.getElementById('impCancel').onclick = closeSheet;
    document.getElementById('impGo').onclick = () => {
      const a = resolveAcct(); if (!a) return;
      const existing = new Map(); state.tx.filter(t => t.acct === a.id).forEach(t => { const k = dupKey(t); existing.set(k, (existing.get(k) || 0) + 1); });
      const seen = new Map(); let added = 0, skipped = 0;
      for (const r of rows) {
        const k = dupKey(r), n = (seen.get(k) || 0) + 1; seen.set(k, n);
        if ((existing.get(k) || 0) >= n) { skipped++; continue; }
        state.tx.push({ id: uid(), acct: a.id, book: a.book, date: r.date, desc: r.desc, amount: r.amount, cat: categorise(r.desc, r.amount, a.book) });
        added++;
      }
      // closing balance: the running balance on the latest row, or what the person typed
      const withBal = rows.map((r, i) => ({ ...r, i })).filter(r => r.balance != null);
      if (withBal.length) {
        const maxD = withBal.reduce((m, r) => r.date > m ? r.date : m, ''), newestFirst = rows.length > 1 && rows[0].date >= rows.at(-1).date;
        const atMax = withBal.filter(r => r.date === maxD), pick = newestFirst ? atMax[0] : atMax.at(-1);
        if (!a.balanceDate || maxD >= a.balanceDate) { a.balance = isDebt(a) ? Math.abs(pick.balance) : pick.balance; a.balanceDate = maxD; }
      } else if (res.balance?.amount != null) { a.balance = isDebt(a) ? Math.abs(res.balance.amount) : res.balance.amount; a.balanceDate = res.balance.date || todayIso(); }
      const typed = parseFloat((document.getElementById('impBal')?.value || '').replace(/[$,\s]/g, ''));
      if (isFinite(typed)) { a.balance = isDebt(a) ? Math.abs(typed) : typed; a.balanceDate = todayIso(); }
      if (a.balanceDate) { a.history = (a.history || []).filter(p => p[0] !== a.balanceDate); a.history.push([a.balanceDate, a.balance]); }
      state.imports.push({ id: uid(), name: file.name, date: todayIso(), rows: added, acct: a.id });
      if (state.demo) { /* real data arriving: keep sample until they clear it */ }
      save(); closeSheet();
      toast(`${added} added to ${a.name}${skipped ? `, ${skipped} already there` : ''}.`);
      go(a.book === 'B' ? 'business' : 'personal', a.book === 'B' ? 'costs' : 'spending');
    };
  });
  draw();
}

function pdfSheet(file, res, acctId) {
  const fy = currentFy(), gross = res.found.find(f => /gross/i.test(f.label)), withheld = res.found.find(f => /withheld/i.test(f.label));
  const html = `<p class="say" style="margin:0">Read <b>${esc(file.name)}</b> on this device. PDF statements don’t list transactions in a form we can rely on, so Ledger Deck takes the balance from them.</p>
  ${res.found.length ? `<div class="field"><span>Amounts found. Pick the balance to use</span>${res.found.map((f, i) => `<label class="ci" style="display:flex;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:8px"><input type="radio" name="pdfAmt" value="${f.amount}" ${i === 0 ? 'checked' : ''}><span style="flex:1">${esc(f.label)}</span><b class="num">${fmt(f.amount, 2)}</b></label>`).join('')}</div>` : notice('No balance was found automatically. Type it below.')}
  ${field('Or type the balance', `<input id="pdfBal" inputmode="decimal" placeholder="0.00">`)}
  ${field('Balance date', `<input id="pdfDate" type="date" value="${todayIso()}">`)}
  ${acctPicker(acctId, 'super')}
  ${gross || withheld ? `<div class="notice">${icon.info}<span>This looks like an income statement. <button class="linkbtn" type="button" id="useIS">Use ${gross ? fmt(gross.amount) + ' as salary' : ''}${gross && withheld ? ' and ' : ''}${withheld ? fmt(withheld.amount) + ' as tax withheld' : ''} for ${fyLabel(fy)}</button></span></div>` : ''}
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="cta" type="button" id="pdfGo">Update balance</button><button class="cta ghost" type="button" id="impCancel">Cancel</button></div>`;
  openSheet('Import ' + file.name, html, () => {
    bindPicker();
    document.getElementById('impCancel').onclick = closeSheet;
    document.getElementById('useIS')?.addEventListener('click', () => { const I = taxIn(fy); if (gross) I.salary = gross.amount; if (withheld) I.withheld = withheld.amount; save(); toast(`Saved to your ${fyLabel(fy)} tax figures.`); });
    document.getElementById('pdfGo').onclick = () => {
      const typed = document.getElementById('pdfBal').value, sel = document.querySelector('[name=pdfAmt]:checked');
      const v = typed ? parseFloat(typed.replace(/[$,]/g, '')) : sel ? +sel.value : NaN; if (!isFinite(v)) { toast('Pick or type a balance.'); return; }
      const a = resolveAcct(); if (!a) return; const d = document.getElementById('pdfDate').value || todayIso();
      a.balance = Math.abs(v); a.balanceDate = d; a.history = (a.history || []).filter(p => p[0] !== d); a.history.push([d, a.balance]);
      state.imports.push({ id: uid(), name: file.name, date: todayIso(), rows: 0, acct: a.id }); save(); closeSheet(); toast(`${a.name} updated to ${fmt(a.balance)}.`); refresh();
    };
  });
}

/* ---------- the Data & AI screen ---------- */
const INST = [
  ['Banks', 'CommBank, ANZ, Westpac, NAB, Macquarie, ING and others', 'In internet banking on a computer, open the account and choose <i>Export</i> or <i>Download transactions</i>. Pick CSV (or OFX/QIF), choose the date range (1 July last year to today is a good start) and import the file here. Do the same for each account and credit card, and repeat whenever you want fresh numbers.'],
  ['Super', 'Hostplus, AustralianSuper, Rest, UniSuper and others', 'Download your latest statement PDF from your fund’s member site and import it. Ledger Deck reads the balance. You can also just type the balance on the account.'],
  ['Shares', 'CommSec, Webull, Stake, SelfWealth, Pearler', 'Type the current portfolio value on a Shares account and update it when you like. Enter sales for the year in the tax assistant. Dividends paid into your bank are picked up from bank imports.'],
  ['Business accounting', 'Xero, MYOB, QuickBooks', 'Export your business bank account transactions as CSV (from the bank, or from your accounting software’s bank reconciliation report) and import into the Business book. A direct Xero connection is planned.'],
  ['myGov', 'Income statement', 'In myGov, open the ATO, find your income statement and save it as PDF. Importing it fills in your salary and tax withheld for the tax estimate.'],
];

V.data = {
  title: 'Data & AI',
  render() {
    const S = state.settings, li = lastImport();
    const rows = state.accounts.map(a => { const t = state.tx.filter(x => x.acct === a.id); return { a, n: t.length, last: t.reduce((m, x) => x.date > m ? x.date : m, '') }; });
    return `<section class="panel hero">${ring(100, { value: '✓', small: 'on device', size: 100 })}<div><div class="label" style="margin-bottom:6px">Where your numbers come from</div><h2>Everything is stored <em class="c">in this browser on this device</em>. ${state.accounts.length ? `${state.accounts.length} account${state.accounts.length > 1 ? 's' : ''}, ${state.tx.length} transactions.` : 'Nothing added yet.'}${li ? ` Last import ${dshort(li)}.` : ''}</h2>
  <div class="pills">${pill('No sign-up, no tracking', 'good')}${pill(aiReady() ? `AI: ${esc(aiLabel())}` : 'AI not connected', aiReady() ? 'info' : 'muted')}${pill(hasPasscode() ? 'Passcode on' : 'No passcode', hasPasscode() ? 'good' : 'warn')}${state.demo ? pill('Sample data loaded', 'warn') : ''}</div></div><div></div></section>
${state.demo ? `<section class="panel">${notice(`You’re looking at <b>sample data</b>. When you’re ready, clear it and add your own. <button class="cta" type="button" id="clearDemo" style="margin-left:8px">Clear sample data</button>`)}</section>` : ''}
<div class="grid g-7-5">
  <section class="panel"><div class="ph"><h2>Accounts</h2><button class="mini" type="button" data-sheet="newacct:${S.track.P ? 'P' : 'B'}">Add an account</button></div><p class="say">Click one to edit it, update its balance or import into it.</p>
    ${tbl('tsrc', [{ k: 'name', l: 'Account', v: r => r.a.name, r: r => `${esc(r.a.name)}<small>${esc(TYPE_LABEL[r.a.type] || '')}</small>` }, { k: 'b', l: '', v: r => r.a.book, r: r => tagB(r.a.book) }, { k: 'n', l: 'Rows', n: 1, r: r => N(r.n) }, { k: 'bal', l: 'Balance', n: 1, v: r => r.a.balance, r: r => N(fmt(isDebt(r.a) ? -r.a.balance : r.a.balance)) }, { k: 'last', l: 'Up to', v: r => r.last || r.a.balanceDate, r: r => (r.last || r.a.balanceDate) ? dshort(r.last || r.a.balanceDate) : '<span class="hint">—</span>' }], rows, { click: r => 'acct:' + r.a.id, empty: 'No accounts yet. Import a statement or add one by hand.' })}</section>
  <section class="panel"><div class="ph"><h2>Import a file</h2></div>
    <div class="drop" id="drop"><p>Drop a statement here or <label for="file">choose a file</label></p><input type="file" id="file" accept=".csv,.ofx,.qfx,.qif,.pdf,.txt,text/csv,application/pdf" hidden><p class="hint">CSV, OFX or QIF from your bank, or a PDF statement for super and other balances. Read in your browser. Nothing is uploaded.</p></div>
    <details style="margin-top:12px"><summary style="cursor:pointer;font-weight:500">How to get your files</summary><div class="stack" style="margin-top:10px">${INST.map(i => `<div><b>${i[0]}</b> <span class="hint">${i[1]}</span><p class="say" style="margin:4px 0 0">${i[2]}</p></div>`).join('')}<p class="hint">Ledger Deck will never ask for your bank password.</p></div></details></section>
</div>
<div class="grid g2">
  <section class="panel"><div class="ph"><h2>AI connection</h2>${aiReady() ? pill('Connected', 'good') : pill('Not connected', 'muted')}</div><p class="say">Use your own key from the AI company you choose. When you ask something, your question${S.ai.shareFigures !== false ? ' and a summary of your figures' : ''} go to that company. Nothing else leaves this device.</p>
    <div id="aiBox">${aiForm()}</div>
    <label class="hint" style="display:flex;gap:6px;align-items:center;margin-top:10px"><input type="checkbox" id="shareFig" ${S.ai.shareFigures !== false ? 'checked' : ''}> Include a summary of my figures with questions (totals, not individual transactions)</label>
    ${aiReady() ? '<button class="mini" type="button" id="aiForget" style="margin-top:10px">Disconnect and forget the key</button>' : ''}</section>
  <section class="panel"><div class="ph"><h2>Privacy and backup</h2></div>
    <table class="est"><tr><td>Where data is kept<small>This browser’s storage on this device</small></td><td class="n">${pill('On this device', 'good')}</td></tr>
      <tr><td>Passcode<small>${hasPasscode() ? 'Your records are encrypted and locked when the app opens' : 'Anyone using this browser can open the app'}</small></td><td class="n"><button class="mini" type="button" id="pcBtn">${hasPasscode() ? 'Change' : 'Set a passcode'}</button>${hasPasscode() ? ' <button class="mini" type="button" id="pcOff">Turn off</button>' : ''}</td></tr>
      <tr><td>Encrypted backup<small>Save it somewhere safe, such as your own cloud folder or a USB drive</small></td><td class="n"><button class="mini" type="button" id="bkBtn">Back up now</button></td></tr>
      <tr><td>Restore<small>From a Ledger Deck backup file, on this or another device</small></td><td class="n"><button class="mini" type="button" id="rsBtn">Restore</button><input type="file" id="rsFile" accept=".json,application/json" hidden></td></tr>
      <tr><td>Export transactions<small>A plain CSV, not encrypted</small></td><td class="n"><button class="mini" type="button" id="csvBtn">Export CSV</button></td></tr>
      <tr><td>Analytics and tracking</td><td class="n">${pill('None', 'good')}</td></tr></table>
    <p class="hint">If you lose your passcode and your backup, your data can’t be recovered. No one else ever has it.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="cta ghost" type="button" id="rerun">Run setup again</button><button class="cta ghost" type="button" id="wipe">Delete everything on this device</button></div></section>
</div>
<div class="grid g2">
  <section class="panel"><div class="ph"><h2>Your details</h2></div><p class="say">Used for tax rules and business figures.</p>
    <form id="detForm" class="wiz-grid">
      ${field('Track personal money', `<select name="trackP">${opt('1', 'Yes', S.track.P ? '1' : '0')}${opt('0', 'No', S.track.P ? '1' : '0')}</select>`)}
      ${field('Track a business', `<select name="trackB">${opt('1', 'Yes', S.track.B ? '1' : '0')}${opt('0', 'No', S.track.B ? '1' : '0')}</select>`)}
      ${field('Australian resident for tax', `<select name="resident">${opt('yes', 'Yes', S.resident)}${opt('no', 'No', S.resident)}${opt('unsure', 'Not sure', S.resident)}</select>`)}
      ${field('Private hospital cover', `<select name="phi">${opt('yes', 'Yes', S.phi)}${opt('no', 'No', S.phi)}</select>`)}
      ${field('Study loan (HELP)', `<select name="help">${opt('no', 'No', S.help)}${opt('yes', 'Yes', S.help)}</select>`)}
      ${field('Registered tax agent', `<select name="agent">${opt('yes', 'Yes', S.agent)}${opt('no', 'No, I lodge myself', S.agent)}${opt('looking', 'Looking for one', S.agent)}</select>`)}
      ${S.track.B ? `${field('Business name', `<input name="bizName" maxlength="60" value="${esc(S.bizName)}">`)}${field('ABN', `<input name="abn" inputmode="numeric" maxlength="14" value="${esc(S.abn)}">`)}
      ${field('Structure', `<select name="entity">${opt('sole', 'Sole trader', S.entity)}${opt('company', 'Company', S.entity)}${opt('partnership', 'Partnership', S.entity)}${opt('trust', 'Trust', S.entity)}</select>`)}
      ${field('Registered for GST', `<select name="gst">${opt('yes', 'Yes', S.gst)}${opt('no', 'No', S.gst)}</select>`)}
      ${field('BAS', `<select name="bas">${['Quarterly', 'Monthly', 'Annually'].map(x => opt(x, x, S.bas)).join('')}</select>`)}
      ${field('GST basis', `<select name="gstBasis">${opt('cash', 'Cash', S.gstBasis)}${opt('accruals', 'Accruals', S.gstBasis)}</select>`)}` : ''}
    </form></section>
  <section class="panel"><div class="ph"><h2>Sorting rules you’ve taught it</h2></div><p class="say">Created when you change a transaction’s category. New imports follow them.</p>
    ${tbl('trules', [{ k: 'match', l: 'When the description starts with', r: r => `<code>${esc(r.match)}</code>` }, { k: 'cat', l: 'Category', r: r => `${esc(r.cat)} <small>${r.book === 'B' ? 'Business' : 'Personal'}</small>` }, { k: 'x', l: '', s: false, r: r => `<button class="mini" type="button" data-rule="${esc(r.book + '|' + r.match)}">Remove</button>` }], state.rules, { empty: 'None yet.' })}</section>
</div>
<section class="panel"><div class="ph"><h2>Install and share</h2></div><p class="say">Ledger Deck works offline once loaded. To keep it on your home screen or dock: on iPhone, tap Share then <b>Add to Home Screen</b>; on Android or in Chrome and Edge, use <b>Install app</b> in the browser menu. ${'<button class="cta ghost" type="button" id="installBtn" hidden>Install Ledger Deck</button>'}</p>
  <p class="hint">Automatic bank feeds aren’t available in the free app. Australia’s open banking system requires accreditation, so statements are the reliable way in. Ledger Deck will never ask for your bank password. <a href="privacy.html" target="_blank" rel="noopener">Privacy statement</a></p></section>`;
  },
  bind() {
    const $ = id => document.getElementById(id);
    $('file').onchange = () => { const f = $('file').files[0]; $('file').value = ''; f && startImport(f); };
    const drop = $('drop'); drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over'); drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; f && startImport(f); };
    const rebind = () => { $('aiBox').innerHTML = aiForm(); bindAiForm(rebind); };
    bindAiForm(rebind);
    $('shareFig').onchange = e => { state.settings.ai.shareFigures = e.target.checked; save(); };
    $('aiForget')?.addEventListener('click', () => { state.settings.ai = { provider: '', model: '', key: '', base: '', ok: false, shareFigures: state.settings.ai.shareFigures }; save(); document.dispatchEvent(new Event('ai-changed')); refresh(); toast('AI disconnected and key removed.'); });
    $('pcBtn').onclick = async () => { const p = await askPassword({ title: hasPasscode() ? 'Change passcode' : 'Set a passcode', body: 'Your records will be encrypted with it, and you’ll need it each time you open Ledger Deck. It can’t be recovered if you forget it, so keep a backup.', confirm: true, button: 'Save passcode' }); if (!p) return; await setPasscode(p); toast('Passcode set. Your records are encrypted.'); refresh(); };
    $('pcOff')?.addEventListener('click', async () => { await setPasscode(null); toast('Passcode removed.'); refresh(); });
    $('bkBtn').onclick = async () => { const p = await askPassword({ title: 'Back up your data', body: 'Choose a password for the backup file. You’ll need it to restore. It can be the same as your passcode.', confirm: true, button: 'Create backup' }); if (!p) return; await saveNow(); download(`ledger-deck-backup-${todayIso()}.json`, await backupBlob(p)); state.lastBackup = todayIso(); save(); toast('Encrypted backup saved to your downloads.'); };
    $('rsBtn').onclick = () => $('rsFile').click();
    $('rsFile').onchange = async () => { const f = $('rsFile').files[0]; $('rsFile').value = ''; if (!f) return; const p = await askPassword({ title: 'Restore a backup', body: 'This replaces everything currently on this device with the backup.', button: 'Restore' }); if (!p) return; try { const obj = await readBackup(await f.text(), p); await replaceState(obj); toast('Backup restored.'); location.reload(); } catch (e) { toast(e.message); } };
    $('csvBtn').onclick = () => { const an = Object.fromEntries(state.accounts.map(a => [a.id, a.name])); const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`; const csv = ['Date,Account,Book,Description,Amount,Category,Deduction,Note', ...state.tx.slice().sort((a, b) => a.date < b.date ? -1 : 1).map(t => [t.date, q(an[t.acct]), t.book === 'B' ? 'Business' : 'Personal', q(t.desc), t.amount.toFixed(2), q(t.cat), t.dedSt === 'yes' ? t.ded : '', q(t.note)].join(','))].join('\n'); download(`ledger-deck-transactions-${todayIso()}.csv`, new Blob([csv], { type: 'text/csv' })); };
    $('rerun').onclick = () => import('../wizard.js').then(m => m.openWizard(0));
    confirmBtn($('wipe'), 'Click again: this deletes everything here', async () => { await wipe(); try { localStorage.removeItem('ld-view'); } catch { } location.reload(); });
    $('clearDemo')?.addEventListener('click', async () => { const keepSettings = { ...state.settings, done: true }; await wipe(); state.settings = { ...keepSettings, bizName: '', track: { P: true, B: false } }; await saveNow(); toast('Sample data cleared.'); location.reload(); });
    $('detForm').onchange = e => { const t = e.target, S = state.settings; if (t.name === 'trackP') S.track.P = t.value === '1'; else if (t.name === 'trackB') S.track.B = t.value === '1'; else S[t.name] = t.value; save(); if (['trackP', 'trackB'].includes(t.name)) refresh(); };
    document.getElementById('trules').addEventListener('click', e => { const b = e.target.closest('[data-rule]'); if (!b) return; const [bk, ...m] = b.dataset.rule.split('|'); state.rules = state.rules.filter(r => !(r.book === bk && r.match === m.join('|'))); save(); refresh(); });
    const ib = $('installBtn'); if (window.__installPrompt) { ib.hidden = false; ib.onclick = async () => { window.__installPrompt.prompt(); await window.__installPrompt.userChoice; window.__installPrompt = null; ib.hidden = true; }; }
  },
};
