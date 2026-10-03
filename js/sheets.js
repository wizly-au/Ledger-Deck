/* Detail and edit panels: transactions, accounts, invoices and goals. */
import { state, save } from './store.js';
import { fmt, esc, dlong, todayIso, uid, toast, addDays, round2, sum } from './util.js';
import { cats, catColor, learn, DLABELS } from './categories.js';
import { ASSET_TYPES, DEBT_TYPES, TYPE_LABEL, isDebt, acctHistory, months12, signedBal } from './model.js';
import { lineChart, pill, tagB } from './charts.js';
import { openSheet, closeSheet, refresh, confirmBtn, opt, field } from './ui.js';
import { monthLabel } from './util.js';

export function openDetail(key) {
  const [kind, ...rest] = key.split(':'), arg = rest.join(':');
  if (kind === 'tx') txSheet(arg);
  else if (kind === 'acct') acctSheet(arg);
  else if (kind === 'newacct') acctSheet(null, arg || 'P');
  else if (kind === 'inv') invSheet(arg);
  else if (kind === 'newinv') invSheet(null);
  else if (kind === 'goal') goalSheet(arg);
  else if (kind === 'newgoal') goalSheet(null);
}

function txSheet(id) {
  const t = state.tx.find(x => x.id === id); if (!t) return;
  const a = state.accounts.find(x => x.id === t.acct), C = cats(t.book);
  const html = `<div class="stat"><div><span class="label">Amount</span><b class="num ${t.amount > 0 ? 'up' : ''}">${t.amount > 0 ? '+' : ''}${fmt(t.amount, 2)}</b></div><div><span class="label">Date</span><b>${dlong(t.date)}</b></div></div>
  <p class="say" style="margin:0">${esc(t.desc)}<br><span class="hint">${a ? esc(a.name) : 'No account'} · ${tagB(t.book)}</span></p>
  <div><div class="label" style="margin-bottom:8px">Category · tap to change</div><div class="filters" id="recat">${Object.keys(C).map(c => `<button type="button" aria-pressed="${c === t.cat}" data-f="${esc(c)}">${esc(c)}</button>`).join('')}</div>
  <label class="hint" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="learnAll" checked> Also change similar transactions and remember for future imports</label></div>
  ${t.book === 'P' && t.amount < 0 ? `<div class="field"><span>Tax deduction</span><div class="row2"><select id="dedL">${opt('', 'Not a deduction', t.ded || '')}${Object.entries(DLABELS).map(([k, l]) => opt(k, `${k} ${l}`, t.ded || '')).join('')}</select>
    <span class="seg" id="dedSt"><button type="button" data-v="yes" aria-pressed="${t.dedSt === 'yes'}">Claim</button><button type="button" data-v="ask" aria-pressed="${t.dedSt === 'ask'}">Not sure</button><button type="button" data-v="no" aria-pressed="${t.dedSt === 'no'}">Skip</button></span></div><span class="hint">Only claim what you spent earning your income, and keep the receipt.</span></div>` : ''}
  ${t.book === 'B' ? `<div class="field"><span>Includes GST?</span><span class="seg" id="gstSeg"><button type="button" data-v="" aria-pressed="${t.gst == null}">Use category default</button><button type="button" data-v="1" aria-pressed="${t.gst === true}">Yes</button><button type="button" data-v="0" aria-pressed="${t.gst === false}">No</button></span></div>` : ''}
  ${field('Note', `<textarea id="txNote" rows="2" maxlength="300">${esc(t.note || '')}</textarea>`)}
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="cta" type="button" id="txSave">Done</button><button class="cta ghost" type="button" id="txDel">Delete transaction</button></div>`;
  openSheet(t.amount > 0 ? 'Money in' : 'Money out', html, () => {
    const $ = s => document.getElementById(s);
    $('recat').querySelectorAll('button').forEach(b => b.onclick = () => {
      $('recat').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
      const c = b.dataset.f; t.cat = c;
      if ($('learnAll').checked) { const n = learn(t.desc, c, t.book); toast(n ? `Moved to ${c}, plus ${n} similar. Future imports will follow.` : `Moved to ${c}. Future imports will follow.`); } else toast(`Moved to ${c}.`);
      save();
    });
    $('dedL') && ($('dedL').onchange = () => { t.ded = $('dedL').value || null; if (t.ded && !t.dedSt) t.dedSt = 'ask'; save(); });
    $('dedSt')?.querySelectorAll('button').forEach(b => b.onclick = () => { $('dedSt').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); t.dedSt = b.dataset.v; if (!t.ded) { t.ded = 'D5'; $('dedL').value = 'D5'; } save(); });
    $('gstSeg')?.querySelectorAll('button').forEach(b => b.onclick = () => { $('gstSeg').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); t.gst = b.dataset.v === '' ? null : b.dataset.v === '1'; save(); });
    $('txNote').oninput = () => { t.note = $('txNote').value; save(); };
    $('txSave').onclick = () => closeSheet();
    confirmBtn($('txDel'), 'Click again to delete', () => { state.tx = state.tx.filter(x => x.id !== id); save(); closeSheet(); toast('Transaction deleted.'); });
  }, refresh);
}

function acctSheet(id, book = 'P') {
  const a = id ? state.accounts.find(x => x.id === id) : null; if (id && !a) return;
  const b = a?.book || book, n = a ? state.tx.filter(t => t.acct === a.id).length : 0;
  const ms = months12(), h = a ? acctHistory(a, ms) : [];
  const html = `${a ? `<div class="stat"><div><span class="label">${isDebt(a) ? 'Owed' : 'Balance'}</span><b class="num">${fmt(Math.abs(a.balance || 0), 2)}</b></div><div><span class="label">Transactions</span><b>${n}</b></div></div>${h.filter(x => x != null).length > 1 ? lineChart([{ name: a.name, vals: h, color: 'var(--accent)' }], ms.map(monthLabel), { h: 190, every: 2 }) : ''}` : ''}
  <form id="acctForm" class="stack">
    ${field('Name', `<input name="name" required maxlength="60" value="${esc(a?.name || '')}" placeholder="e.g. CommBank everyday">`)}
    <div class="wiz-grid">
      ${field('Book', `<select name="book">${opt('P', 'Personal', b)}${opt('B', 'Business', b)}</select>`)}
      ${field('Type', `<select name="type"><optgroup label="Things you own">${Object.entries(ASSET_TYPES).map(([k, l]) => opt(k, l, a?.type || 'bank')).join('')}</optgroup><optgroup label="Things you owe">${Object.entries(DEBT_TYPES).map(([k, l]) => opt(k, l, a?.type)).join('')}</optgroup></select>`)}
      ${field('Balance <span class="hint">(amount owed for loans and cards)</span>', `<input name="balance" inputmode="decimal" value="${a ? Math.abs(a.balance || 0) : ''}" placeholder="0.00">`)}
      ${field('Balance as at', `<input name="balanceDate" type="date" value="${a?.balanceDate || todayIso()}">`)}
      ${field('Interest rate % <span class="hint">(optional)</span>', `<input name="rate" inputmode="decimal" value="${a?.rate ?? ''}">`)}
      ${field('Monthly repayment <span class="hint">(loans)</span>', `<input name="repay" inputmode="decimal" value="${a?.repay ?? ''}">`)}
    </div>
    ${field('Note', `<input name="note" maxlength="140" value="${esc(a?.note || '')}">`)}
    <p class="hint">When a statement includes a running balance, importing it keeps this up to date for you.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="cta" type="submit">${a ? 'Save' : 'Add account'}</button>${a ? `<button class="cta ghost" type="button" id="acctImp">Import a statement</button><button class="cta ghost" type="button" id="acctDel">Delete</button>` : ''}</div>
  </form>`;
  openSheet(a ? a.name : 'Add an account', html, () => {
    const f = document.getElementById('acctForm');
    f.onsubmit = e => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(f));
      const bal = Math.abs(parseFloat(String(d.balance).replace(/[$,]/g, '')) || 0);
      const rec = a || { id: uid(), history: [] };
      const old = rec.balance;
      Object.assign(rec, { name: d.name.trim(), book: d.book, type: d.type, balance: bal, balanceDate: d.balanceDate || todayIso(), rate: d.rate === '' ? null : +d.rate, repay: d.repay === '' ? null : +d.repay, note: d.note });
      if (old !== bal || !a) { rec.history = (rec.history || []).filter(p => p[0] !== rec.balanceDate); rec.history.push([rec.balanceDate, bal]); }
      if (!a) state.accounts.push(rec);
      state.tx.forEach(t => { if (t.acct === rec.id) t.book = rec.book; });
      save(); closeSheet(); toast(a ? 'Saved.' : `${rec.name} added.`);
    };
    document.getElementById('acctImp')?.addEventListener('click', () => { closeSheet(); import('./views/data.js').then(m => m.startImport(null, a.id)); });
    const del = document.getElementById('acctDel');
    del && confirmBtn(del, n ? `Delete it and its ${n} transactions?` : 'Click again to delete', () => { state.accounts = state.accounts.filter(x => x.id !== a.id); state.tx = state.tx.filter(t => t.acct !== a.id); save(); closeSheet(); toast('Account deleted.'); });
  }, refresh);
}

function invSheet(id) {
  const v = id ? state.invoices.find(x => x.id === id) : null; if (id && !v) return;
  const late = v && !v.paid && v.due < todayIso();
  const body = v ? encodeURIComponent(`Hi ${v.client},\n\nA quick reminder that invoice ${v.num} for ${fmt(v.amount, 2)} was due on ${dlong(v.due)}. If it's already on its way, thank you and please ignore this.\n\nKind regards,\n${state.settings.bizName || ''}`) : '';
  const html = `${v ? `<div class="stat"><div><span class="label">Amount</span><b class="num">${fmt(v.amount, 2)}</b></div><div><span class="label">Status</span><b>${v.paid ? pill('Paid', 'good') : late ? pill('Overdue', 'bad') : pill('Waiting', 'info')}</b></div></div>` : ''}
  <form id="invForm" class="stack"><div class="wiz-grid">
    ${field('Client', `<input name="client" required maxlength="60" value="${esc(v?.client || '')}">`)}
    ${field('Invoice number', `<input name="num" maxlength="30" value="${esc(v?.num || '')}">`)}
    ${field('Amount (incl. GST)', `<input name="amount" required inputmode="decimal" value="${v?.amount ?? ''}">`)}
    ${field('Sent', `<input name="issued" type="date" value="${v?.issued || todayIso()}">`)}
    ${field('Due', `<input name="due" type="date" value="${v?.due || addDays(todayIso(), 14)}">`)}
    ${field('Paid on <span class="hint">(leave empty if unpaid)</span>', `<input name="paid" type="date" value="${v?.paid || ''}">`)}
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="cta" type="submit">${v ? 'Save' : 'Add invoice'}</button>${v && !v.paid ? `<button class="cta ghost" type="button" id="invPaid">Mark paid today</button>` : ''}${late ? `<a class="cta ghost" href="mailto:?subject=${encodeURIComponent('Invoice ' + v.num + ' reminder')}&body=${body}" style="text-decoration:none">Draft a reminder email</a>` : ''}${v ? `<button class="cta ghost" type="button" id="invDel">Delete</button>` : ''}</div>
  ${late ? '<p class="hint">The reminder opens in your own email app. Ledger Deck doesn’t send anything.</p>' : ''}</form>`;
  openSheet(v ? `${v.num || 'Invoice'} · ${v.client}` : 'Add an invoice', html, () => {
    const f = document.getElementById('invForm');
    f.onsubmit = e => { e.preventDefault(); const d = Object.fromEntries(new FormData(f)); const rec = v || { id: uid() }; Object.assign(rec, { client: d.client.trim(), num: d.num.trim(), amount: round2(parseFloat(String(d.amount).replace(/[$,]/g, '')) || 0), issued: d.issued, due: d.due || d.issued, paid: d.paid }); if (!v) state.invoices.push(rec); save(); closeSheet(); toast('Saved.'); };
    document.getElementById('invPaid')?.addEventListener('click', () => { v.paid = todayIso(); save(); closeSheet(); toast(`${v.client} marked as paid.`); });
    const del = document.getElementById('invDel'); del && confirmBtn(del, 'Click again to delete', () => { state.invoices = state.invoices.filter(x => x.id !== v.id); save(); closeSheet(); });
  }, refresh);
}

function goalSheet(id) {
  const g = id ? state.goals.find(x => x.id === id) : null; if (id && !g) return;
  const cashAccts = state.accounts.filter(a => a.book === 'P' && !isDebt(a));
  const html = `<form id="goalForm" class="stack"><div class="wiz-grid">
    ${field('Goal', `<input name="name" required maxlength="50" value="${esc(g?.name || '')}" placeholder="e.g. Emergency fund">`)}
    ${field('Target', `<input name="target" required inputmode="decimal" value="${g?.target ?? ''}">`)}
    ${field('Track with an account', `<select name="acct">${opt('', 'No, I’ll enter the amount', g?.acct || '')}${cashAccts.map(a => opt(a.id, a.name, g?.acct || '')).join('')}</select>`)}
    ${field('Saved so far', `<input name="saved" inputmode="decimal" value="${g?.saved ?? ''}">`)}
    ${field('Target date', `<input name="by" type="date" value="${g?.by || addDays(todayIso(), 365)}">`)}
    ${field('Monthly amount', `<input name="monthly" inputmode="decimal" value="${g?.monthly ?? ''}">`)}
  </div><div style="display:flex;gap:8px"><button class="cta" type="submit">${g ? 'Save' : 'Add goal'}</button>${g ? '<button class="cta ghost" type="button" id="goalDel">Delete</button>' : ''}</div></form>`;
  openSheet(g ? g.name : 'Add a goal', html, () => {
    const f = document.getElementById('goalForm');
    f.onsubmit = e => { e.preventDefault(); const d = Object.fromEntries(new FormData(f)); const rec = g || { id: uid() }; Object.assign(rec, { name: d.name.trim(), target: +d.target || 0, acct: d.acct, saved: +d.saved || 0, by: d.by, monthly: +d.monthly || 0 }); if (!g) state.goals.push(rec); save(); closeSheet(); };
    const del = document.getElementById('goalDel'); del && confirmBtn(del, 'Click again to delete', () => { state.goals = state.goals.filter(x => x.id !== g.id); save(); closeSheet(); });
  }, refresh);
}
export const goalSaved = g => g.acct ? Math.max(state.accounts.find(a => a.id === g.acct)?.balance || 0, 0) : (g.saved || 0);
