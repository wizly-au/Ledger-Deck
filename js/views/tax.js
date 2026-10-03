import { state, save } from '../store.js';
import { fmt, k, esc, N, dshort, days, fyLabel, fyEnd, todayIso, toast, download, addDays } from '../util.js';
import { V, tabsHtml, setTab, filterBind, refresh, sub, field, opt, notice } from '../ui.js';
import { ring, pill, tagB, tbl, drawTbl, hbars, waterfall, legend } from '../charts.js';
import { DLABELS } from '../categories.js';
import { quarterOf, gstFor, basDue, bizPeriod } from '../model.js';
import { estimate, deductions, strategies, agentFlags, taxIn, currentFy, buildWorkbook, DISCLAIMER, AGENT_LINE, ato, SG_RATE, CC_CAP, superAcct } from '../tax.js';
import { makeChat, TAX_RULES } from '../ask.js';

let fy = null;
const DISC_BAR = `<div class="disclaimer"><b>${DISCLAIMER}</b><span>${AGENT_LINE}</span></div>`;
const money = v => { const n = parseFloat(String(v).replace(/[$,\s]/g, '')); return isFinite(n) ? n : ''; };

V.tax = {
  title: 'Tax assistant',
  tabs: [['overview', 'Your position'], ['deductions', 'Deductions'], ['strategies', 'Strategies'], ['bas', 'BAS helper'], ['ask', 'Ask the assistant'], ['export', 'For your accountant']],
  render() {
    fy ||= currentFy();
    const e = estimate(fy), d = deductions(fy), ask = d.tx.filter(t => t.dedSt === 'ask').length, conf = d.tx.filter(t => t.dedSt === 'yes').length;
    if (!state.settings.track.B) V.tax.tabs = V.tax.tabs.filter(t => t[0] !== 'bas'); else if (!V.tax.tabs.some(t => t[0] === 'bas')) V.tax.tabs.splice(3, 0, ['bas', 'BAS helper']);
    save(); // keeps any new deduction guesses
    const has = e.salary || e.interest || e.divCash || e.bizProfit;
    return `<section class="panel hero">
  ${ring(d.tx.length ? conf / d.tx.length * 100 : 0, { value: `${conf}/${d.tx.length}`, small: 'reviewed', size: 108, btn: 'data-tab="deductions" aria-label="Review deductions"' })}
  <div><div class="label" style="margin-bottom:6px;display:flex;gap:10px;align-items:center">Your ${fyLabel(fy)} tax at a glance <select id="fySel" aria-label="Financial year">${[currentFy(), currentFy() - 1].map(y => opt(y, fyLabel(y), fy)).join('')}</select></div>
  <h2>${has ? `Based on your records${e.prog < 1 ? ' so far' : ''}, you’re heading for ${e.res >= 0 ? `a <em class="g">refund of about ${fmt(e.res)}</em>` : `<em class="w">a bill of about ${fmt(-e.res)}</em>`}.` : 'Add your income below, or import statements with your pay, to see an estimate.'} ${ask ? `${ask} possible deduction${ask > 1 ? 's need' : ' needs'} a look.` : ''}</h2>
  <div class="pills">${has ? pill(`Taxable income about ${k(e.ti)}`, 'muted') : ''}${e.salSrc === 'estimated' ? pill('Salary estimated from pay deposits', 'warn') : ''}${e.prog < 1 ? pill(`Projected from ${Math.round(e.prog * 100)}% of the year`, 'info') : ''}</div></div>
  <div class="qs"><div>Tax and Medicare <b class="num">${fmt(Math.max(e.tax - e.off, 0) + e.med + e.sur)}</b></div><div>Withheld <b class="num">${fmt(e.withheld)}</b></div><div>Deductions <b class="num">${fmt(e.ded)}</b></div></div>
</section>${tabsHtml('tax')}${DISC_BAR}`;
  },
  bind() { document.getElementById('fySel').onchange = e => { fy = +e.target.value; refresh(); }; },
  tab: {},
};
const T_ = V.tax.tab;

T_.overview = {
  render() {
    const e = estimate(fy), I = taxIn(fy), cg = I.cgt || [];
    const row = (l, s, v, neg) => `<tr><td>${l}${s ? `<small>${s}</small>` : ''}</td><td class="n num">${neg ? '−' : ''}${fmt(Math.abs(v))}</td></tr>`;
    const sg = Math.round(e.salary * SG_RATE), room = Math.max(CC_CAP - sg - e.salSac, 0);
    const dates = [[`${fy - 1}-10-31`, `${fyLabel(fy - 1)} return if you lodge yourself`], [`${fy}-05-15`, `${fyLabel(fy - 1)} return through a tax agent (usual date)`], [fyEnd(fy), `End of the ${fyLabel(fy)} financial year`], [`${fy}-10-31`, `${fyLabel(fy)} return if you lodge yourself`]];
    if (state.settings.track.B && state.settings.gst === 'yes') { const q = quarterOf(todayIso()); dates.push([basDue(q), `BAS for ${dshort(q.from)} to ${dshort(q.to)}`]); const lq = quarterOf(addDays(q.from, -1)); if (basDue(lq) >= todayIso()) dates.push([basDue(lq), `BAS for ${dshort(lq.from)} to ${dshort(lq.to)}`]); }
    return `<div class="grid g-7-5">
  <section class="panel"><div class="ph"><h2>Estimated position for ${fyLabel(fy)}</h2><span class="aside">Updates as you change anything</span></div><p class="say">${e.prog < 1 ? 'Income so far is projected to a full year. ' : ''}Resident rates for ${fyLabel(fy)}.</p>
    <table class="est">
      ${row('Salary and wages', e.salSrc === 'estimated' ? 'Estimated from your pay deposits. Enter your figures below to be exact.' : 'From what you entered', e.salary)}
      ${e.interest ? row('Interest', 'From transactions categorised as Interest', e.interest) : ''}
      ${e.divCash || e.frank ? row('Dividends and franking credits', '', e.divCash + e.frank) : ''}
      ${e.netCG ? row('Net capital gain', 'After losses and the 50% discount where it applies', e.netCG) : ''}
      ${e.bizProfit ? row('Business profit (sole trader)', 'From your business book', e.bizProfit) : ''}
      ${e.other ? row('Other income', '', e.other) : ''}
      ${row('Less deductions', `<button class="linkbtn" type="button" data-tab="deductions">See Deductions</button>`, e.ded, true)}
      <tr class="tot"><td>Taxable income</td><td class="n num">${fmt(e.ti)}</td></tr>
      ${row('Income tax', `Resident rates for ${fyLabel(fy)}`, e.tax)}
      ${e.off ? row('Less low income tax offset', '', e.off, true) : ''}
      ${row('Medicare levy (2%)', '', e.med)}
      ${e.sur ? row('Medicare levy surcharge', 'No private hospital cover', e.sur) : ''}
      ${e.frank ? row('Less franking credits', '', e.frank, true) : ''}
      ${row('Less tax withheld', e.salSrc === 'estimated' ? 'Estimated' : '', e.withheld, true)}
      <tr class="res"><td>${e.res >= 0 ? 'Likely refund' : 'Likely amount to pay'}</td><td class="n num ${e.res >= 0 ? 'up' : 'warnc'}">${fmt(Math.abs(e.res))}</td></tr>
    </table>
    <p class="hint">Assumes Australian residency for the full year.${state.settings.help === 'yes' ? ' Your study loan repayment isn’t included.' : ''} It doesn’t include offsets or income you haven’t told it about. ${state.settings.entity === 'company' ? 'Company tax is separate from this personal estimate.' : ''}</p></section>
  <div class="stack">
    <section class="panel"><div class="ph"><h2>Key dates</h2></div>
      ${tbl('tdates', [{ k: 0, l: 'Date', r: r => `<b>${dshort(r[0])}</b><small>${r[0].slice(0, 4)}</small>` }, { k: 1, l: 'What', r: r => esc(r[1]) }, { k: 'd', l: 'In', n: 1, v: r => days(r[0]), r: r => days(r[0]) < 0 ? pill('Passed', 'muted') : pill(days(r[0]) + ' days', days(r[0]) <= 30 ? 'warn' : 'muted') }], dates, { sort: 2, dir: 1 })}
      <p class="hint">Tax agent dates vary. Your agent will confirm yours.</p></section>
    ${e.salary ? `<section class="panel"><div class="ph"><h2>Super contribution room</h2></div>
      <div style="display:flex;height:12px;border-radius:6px;overflow:hidden;margin:10px 0;background:var(--tint2)"><span style="width:${Math.min((sg + e.salSac) / CC_CAP * 100, 100)}%;background:var(--accent)"></span></div>
      ${legend([[`Used about ${fmt(sg + e.salSac)}`, 'var(--accent)'], [`Room about ${fmt(room)}`, 'var(--tint2)']])}<p class="say" style="margin-top:10px">Against a ${fmt(CC_CAP)} concessional cap (check the current cap). <button class="linkbtn" type="button" data-tab="strategies">See strategies</button></p></section>` : ''}
  </div>
</div>
<section class="panel"><div class="ph"><h2>Your figures</h2><span class="aside">Saved on this device</span></div><p class="say">Your income statement in myGov has your exact salary and tax withheld. Anything left empty is worked out from your transactions where possible.</p>
  <form id="taxForm" class="wiz-grid">
    ${field('Gross salary for the year', `<input name="salary" inputmode="decimal" value="${I.salary}" placeholder="${e.salSrc === 'estimated' ? 'about ' + Math.round(e.salary) : ''}">`)}
    ${field('Tax withheld', `<input name="withheld" inputmode="decimal" value="${I.withheld}" placeholder="${e.salSrc === 'estimated' ? 'about ' + Math.round(e.withheld) : ''}">`)}
    ${field('Salary sacrificed to super', `<input name="salSac" inputmode="decimal" value="${I.salSac}">`)}
    ${field('Dividends received (cash)', `<input name="divs" inputmode="decimal" value="${I.divs}" placeholder="${e.divCash && !I.divs ? 'about ' + Math.round(e.divCash) : ''}">`)}
    ${field('Franking credits', `<input name="frank" inputmode="decimal" value="${I.frank}">`, 'from your tax statements')}
    ${field('Other income', `<input name="other" inputmode="decimal" value="${I.other}">`)}
    ${field('Hours worked from home', `<input name="wfhHours" inputmode="numeric" value="${I.wfhHours}">`, 'fixed rate, 70c an hour')}
  </form>
</section>
<section class="panel"><div class="ph"><h2>Shares and other assets sold</h2><button class="mini" type="button" id="addCgt">Add a sale</button></div><p class="say">Enter each sale this year. Held more than 12 months means only half the gain is taxed.</p>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Asset</th><th>Bought</th><th class="n">Cost base</th><th>Sold</th><th class="n">Proceeds</th><th class="n">Gain</th><th></th></tr></thead><tbody id="cgtBody">
  ${cg.map((c, i) => { const g = (+c.proceeds || 0) - (+c.cost || 0); return `<tr data-i="${i}"><td><input data-f="asset" value="${esc(c.asset || '')}" placeholder="e.g. VAS units" style="width:140px"></td><td><input type="date" data-f="bought" value="${c.bought || ''}"></td><td class="n"><input data-f="cost" inputmode="decimal" value="${c.cost ?? ''}" style="width:100px;text-align:right"></td><td><input type="date" data-f="sold" value="${c.sold || ''}"></td><td class="n"><input data-f="proceeds" inputmode="decimal" value="${c.proceeds ?? ''}" style="width:100px;text-align:right"></td><td class="n num ${g >= 0 ? 'up' : 'down'}">${fmt(g)}</td><td><button class="mini" type="button" data-del="${i}" aria-label="Remove">✕</button></td></tr>`; }).join('') || '<tr><td colspan="7" class="hint">No sales entered.</td></tr>'}
  </tbody></table></div></section>`;
  },
  bind() {
    const I = taxIn(fy);
    document.getElementById('taxForm').onchange = e => { const n = e.target.name; I[n] = money(e.target.value); save(); refresh(); };
    document.getElementById('addCgt').onclick = () => { (I.cgt ||= []).push({ asset: '', bought: '', cost: '', sold: todayIso(), proceeds: '' }); save(); setTab('overview'); };
    document.querySelectorAll('#cgtBody [data-f]').forEach(inp => inp.onchange = () => { const i = +inp.closest('tr').dataset.i, f = inp.dataset.f; I.cgt[i][f] = ['cost', 'proceeds'].includes(f) ? money(inp.value) : inp.value; save(); refresh(); });
    document.querySelectorAll('#cgtBody [data-del]').forEach(b => b.onclick = () => { I.cgt.splice(+b.dataset.del, 1); save(); refresh(); });
  },
};

T_.deductions = {
  render() {
    const d = deductions(fy), I = taxIn(fy);
    return `<section class="panel"><div class="ph"><h2>Deduction finder</h2><span class="aside" id="dedSum"></span></div><p class="say">Found by scanning your ${fyLabel(fy)} transactions for things like work expenses, donations and tax agent fees. Mark each one. Only items marked <b>Claim</b> go into the estimate and the accountant workbook. To add any transaction, open it and choose a deduction label.</p>
  ${tbl('tded', [{ k: 'ded', l: 'Label', r: r => `<b>${r.ded}</b><small>${esc(DLABELS[r.ded] || '')}</small>` }, { k: 'desc', l: 'Item', r: r => `${esc(r.desc)}<small>${dshort(r.date)}</small>` }, { k: 'amount', l: 'Amount', n: 1, v: r => -r.amount, r: r => N(fmt(-r.amount, 2)) }, { k: 'st', l: 'Your call', s: false, r: r => `<span class="seg" data-ded="${r.id}"><button type="button" data-v="yes" aria-pressed="${r.dedSt === 'yes'}">Claim</button><button type="button" data-v="ask" aria-pressed="${r.dedSt === 'ask'}">Not sure</button><button type="button" data-v="no" aria-pressed="${r.dedSt === 'no'}">Skip</button></span>` }], d.tx, { sort: 0, dir: 1, click: null, empty: 'Nothing found yet. Categorise work expenses, donations and tax agent fees and they’ll appear here.' })}
</section>
<div class="grid g2">
  <section class="panel"><div class="ph"><h2>Other deductions</h2><button class="mini" type="button" id="addDed">Add one</button></div><p class="say">Things not in your bank records, such as union fees deducted from pay or a car logbook claim.</p>
    <div class="tbl-wrap"><table class="tbl"><tbody id="xdBody">${(I.extraDed || []).map((x, i) => `<tr data-i="${i}"><td><select data-f="label">${Object.entries(DLABELS).map(([kk, l]) => opt(kk, kk + ' ' + l, x.label)).join('')}</select></td><td><input data-f="desc" value="${esc(x.desc || '')}" placeholder="What it was"></td><td class="n"><input data-f="amount" inputmode="decimal" value="${x.amount ?? ''}" style="width:90px;text-align:right"></td><td><button class="mini" type="button" data-del="${i}" aria-label="Remove">✕</button></td></tr>`).join('') || '<tr><td class="hint">None added.</td></tr>'}</tbody></table></div></section>
  <section class="panel"><div class="ph"><h2>By return label</h2></div><p class="say">Claimed amounts only.</p><div id="dedBars"></div>
    ${notice('Claims need records. Keep receipts, and for a phone or internet claim, a four-week diary of work use.')}</section>
</div>`;
  },
  bind() {
    const I = taxIn(fy);
    const upd = () => { const d = deductions(fy), by = {}; d.tx.filter(t => t.dedSt === 'yes').forEach(t => by[t.ded] = (by[t.ded] || 0) - t.amount); (I.extraDed || []).forEach(x => by[x.label] = (by[x.label] || 0) + (+x.amount || 0)); if (+I.wfhHours) by.D5 = (by.D5 || 0) + I.wfhHours * .7;
      document.getElementById('dedSum').textContent = `${d.tx.filter(t => t.dedSt === 'yes').length} claimed · ${fmt(estimate(fy).ded)}`;
      document.getElementById('dedBars').innerHTML = hbars(Object.entries(by).map(([kk, v]) => ({ label: `${kk} ${DLABELS[kk] || ''}`, val: v, color: 'var(--accent)' }))); };
    document.getElementById('tded').addEventListener('click', e => { const b = e.target.closest('[data-ded] button'); if (!b) return; const t = state.tx.find(x => x.id === b.parentElement.dataset.ded); t.dedSt = b.dataset.v; save(); drawTbl('tded'); upd(); });
    document.getElementById('addDed').onclick = () => { (I.extraDed ||= []).push({ label: 'D5', desc: '', amount: '' }); save(); setTab('deductions'); };
    document.querySelectorAll('#xdBody [data-f]').forEach(inp => inp.onchange = () => { const i = +inp.closest('tr').dataset.i; I.extraDed[i][inp.dataset.f] = inp.dataset.f === 'amount' ? money(inp.value) : inp.value; save(); upd(); });
    document.querySelectorAll('#xdBody [data-del]').forEach(b => b.onclick = () => { I.extraDed.splice(+b.dataset.del, 1); save(); setTab('deductions'); });
    upd();
  },
};

T_.strategies = {
  render() {
    return `<section class="panel"><div class="ph"><h2>Strategies to consider</h2>${state.settings.track.B ? `<div class="seg" id="tipFilter"><button type="button" aria-pressed="true" data-f="all">All</button><button type="button" aria-pressed="false" data-f="P">Personal</button><button type="button" aria-pressed="false" data-f="B">Business</button></div>` : ''}</div><p class="say">Ideas based on your own figures, with the largest possible saving first. Each one says why it might not suit you. Items marked for a professional depend on judgement and your whole situation.</p><div id="tips" class="stack"></div></section>`;
  },
  bind() {
    const list = new Set(state.stratList || []);
    const draw = f => { const S = strategies(fy).filter(t => f === 'all' || t.s === f).sort((a, b) => (!!a.pro - !!b.pro) || (b.v - a.v));
      document.getElementById('tips').innerHTML = S.length ? S.map(t => `<div class="tip ${t.pro ? 'pro' : ''}"><h3>${tagB(t.s)} ${esc(t.t)} ${t.pro ? pill('Needs a professional', 'warn') : ''}</h3><div class="save">${t.v ? N('~' + fmt(t.v)) : '—'}<small>${esc(t.n)}</small></div><p>${esc(t.d)}</p><div class="why"><b>Why this might not suit you:</b> ${esc(t.why)}</div><div class="agent">${AGENT_LINE}</div><div class="acts"><button class="mini ${list.has(t.id) ? 'done' : ''}" type="button" data-list="${t.id}">${list.has(t.id) ? '✓ On your list for your agent' : 'Add to my list for my agent'}</button><button class="mini" type="button" data-ask="Explain this tax idea and whether it might suit me: ${esc(t.t)}">Ask about this</button>${t.tab ? `<button class="mini" type="button" data-tab="${t.tab}">Review now</button>` : ''}<span class="hint">${ato(t.q, 'https://www.ato.gov.au/single-page-applications/search?q=' + encodeURIComponent(t.q))}</span></div></div>`).join('') : '<p class="hint">No ideas yet. They appear as your records and figures fill in.</p>';
      document.querySelectorAll('[data-list]').forEach(b => b.onclick = () => { const id = b.dataset.list; list.has(id) ? list.delete(id) : list.add(id); state.stratList = [...list]; save(); draw(f); }); };
    draw('all'); filterBind('tipFilter', draw);
  },
};

T_.bas = {
  render() {
    const S = state.settings;
    if (S.gst !== 'yes') return `<section class="panel"><h2>BAS helper</h2><p class="say">You told Ledger Deck the business isn’t registered for GST, so there’s no GST to report. You can change this in Data & AI under your details.</p></section>`;
    const q = quarterOf(todayIso()), qs = [quarterOf(addDays(q.from, -1)), q];
    const i = sub.basQ ?? 0, p = qs[i], g = gstFor(p.from, p.to), payg = +S.paygInst || 0, total = g.net + payg, due = basDue(p), aside = +S.taxAside || 0;
    return `<div class="grid g-5-7">
  <section class="panel"><div class="ph"><h2>BAS for ${dshort(p.from)} to ${dshort(p.to)}</h2>${pill('Due ' + dshort(due), days(due) <= 30 && days(due) >= 0 ? 'warn' : 'muted')}</div>
    <div class="seg" id="basQ" style="margin:6px 0 12px"><button type="button" data-q="0" aria-pressed="${i === 0}">Last quarter</button><button type="button" data-q="1" aria-pressed="${i === 1}">This quarter so far</button></div>
    <p class="say">GST on a ${S.gstBasis} basis, from your business transactions. These are the boxes you or your agent fill in.</p>
    <table class="est">
      <tr><td><b>G1</b> Total sales<small>Including GST</small></td><td class="n num">${fmt(g.sales)}</td></tr>
      <tr><td><b>1A</b> GST on sales</td><td class="n num">${fmt(g.salesGst)}</td></tr>
      <tr><td><b>1B</b> GST on purchases<small>Credits you can claim</small></td><td class="n num">−${fmt(g.credits)}</td></tr>
      <tr class="tot"><td>Net GST</td><td class="n num">${fmt(g.net)}</td></tr>
      <tr><td><b>T7</b> PAYG instalment<small>The amount on your activity statement</small></td><td class="n"><input id="payg" inputmode="decimal" value="${payg || ''}" placeholder="0" style="width:100px;text-align:right"></td></tr>
      <tr class="res"><td>Total to pay</td><td class="n num">${fmt(total)}</td></tr>
    </table>
    <div class="field" style="margin-top:14px"><span>Money set aside for tax</span><div class="row2"><input id="aside" inputmode="decimal" value="${aside || ''}" placeholder="0" style="width:120px"><span class="hint">${total > 0 ? `${Math.min(100, Math.round(aside / total * 100))}% of this BAS` : ''}</span></div></div>
    <p class="hint">Cash basis assumed. If you report on an accruals basis, use invoice dates instead. Accrual reporting isn’t automated yet.</p></section>
  <section class="panel"><div class="ph"><h2>How the amount builds up</h2></div><p class="say">GST you collected, minus GST you paid, plus the PAYG instalment.</p>
    ${waterfall([{ l: 'GST collected', v: g.salesGst, t: 'start' }, { l: 'GST credits', v: -g.credits, t: 'delta' }, { l: 'PAYG instalment', v: payg, t: 'delta' }, { l: 'Total to pay', v: total, t: 'end' }], { w: 560, h: 260 })}
    ${notice('Check that GST credits only include business purchases with a valid tax invoice. Wages, super, bank fees and most insurance premiums don’t include GST. Fix any transaction’s GST setting by opening it in Business, Costs.')}</section>
</div>`;
  },
  bind() {
    document.querySelectorAll('#basQ button').forEach(b => b.onclick = () => { sub.basQ = +b.dataset.q; setTab('bas'); });
    document.getElementById('payg')?.addEventListener('change', e => { state.settings.paygInst = money(e.target.value) || 0; save(); setTab('bas'); });
    document.getElementById('aside')?.addEventListener('change', e => { state.settings.taxAside = money(e.target.value) || 0; save(); setTab('bas'); });
  },
};

T_.ask = {
  render() {
    return `<section class="panel chat"><div class="ph"><h2>Ask the tax assistant</h2><span class="aside" id="taxWho"></span></div><p class="say">Ask about deductions, super, capital gains, GST or anything on these screens. It explains Australian rules in plain English using your figures, and tells you when something needs a professional.</p>
  <div class="log" id="taxLog"></div>
  <form id="taxAskForm"><textarea id="taxIn" rows="2" placeholder="Ask a tax question…"></textarea><button class="cta" type="submit" id="taxSend">Ask</button></form></section>`;
  },
  bind() {
    makeChat({ log: document.getElementById('taxLog'), input: document.getElementById('taxIn'), sendBtn: document.getElementById('taxSend'),
      system: () => { const e = estimate(fy); return `${TAX_RULES()}\n\nTAX ESTIMATE ${fyLabel(fy)}: salary ${fmt(e.salary)} (${e.salSrc}), withheld ${fmt(e.withheld)}, interest ${fmt(e.interest)}, dividends ${fmt(e.divCash)} with franking ${fmt(e.frank)}, net capital gain ${fmt(e.netCG)}, business profit in personal return ${fmt(e.bizProfit)}, deductions ${fmt(e.ded)}, taxable income ${fmt(e.ti)}, tax ${fmt(e.tax)}, offset ${fmt(e.off)}, Medicare ${fmt(e.med)}, surcharge ${fmt(e.sur)}, estimated ${e.res >= 0 ? 'refund' : 'bill'} ${fmt(Math.abs(e.res))}. Salary sacrifice ${fmt(e.salSac)}. Super balance ${fmt(superAcct()?.balance || 0)}. Business structure: ${state.settings.track.B ? state.settings.entity : 'none'}.`; },
      intro: 'Hello. I can walk you through how Australian tax rules apply to your figures. I’m not a tax agent, so for anything you act on, please check with your registered tax agent.',
      suggestions: ['What can I claim for working from home?', 'Should I think about salary sacrifice?', 'What records do I need for my deductions?', 'Explain my BAS in plain English'],
      onBusy: b => { document.getElementById('taxSend').textContent = b ? 'Stop' : 'Ask'; } });
  },
};

T_.export = {
  render() {
    const e = estimate(fy), flags = agentFlags(fy), d = deductions(fy);
    const sheets = [['Summary', 'Year, your details and the estimated position'], ['Income', 'Salary, interest, dividends and franking, capital gains' + (e.bizProfit ? ', business income' : '')], ['Deductions', `${d.tx.filter(t => t.dedSt === 'yes').length + (taxIn(fy).extraDed || []).length} claimed items by ATO label, plus anything still unsure`], ['Capital gains', 'Each sale with dates, cost base, proceeds and discount'], ['Super', 'Contributions against the cap'], ['Business BAS', state.settings.track.B ? 'GST by quarter, plus income and costs' : 'Not used'], ['For your accountant', `${flags.length} questions and items flagged for review`]];
    return `<div class="grid g-7-5">
  <section class="panel"><div class="ph"><h2>Financial year workbook</h2>${pill('.xlsx', 'muted')}</div><p class="say">One spreadsheet for ${fyLabel(fy)} that your tax agent can review and lodge from. Plain headings, totals and no formulas to untangle.</p>
    <table class="tbl"><thead><tr><th>Tab</th><th>What’s in it</th></tr></thead><tbody>${sheets.map(s => `<tr><td><b>${s[0]}</b></td><td>${esc(s[1])}</td></tr>`).join('')}</tbody></table>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:16px"><button class="cta" type="button" id="xlsxBtn">Download ${fyLabel(fy)} workbook</button><span class="hint" id="xlsxSt">Built on this device. Nothing is uploaded.</span></div></section>
  <section class="panel"><div class="ph"><h2>Flagged for your tax agent</h2></div><p class="say">These go on the last tab so nothing gets missed.</p>
    ${flags.length ? `<ol style="margin:0;padding-left:20px;display:grid;gap:8px;font-size:14px">${flags.map(q => `<li>${esc(q)}</li>`).join('')}</ol>` : '<p class="hint">Nothing flagged yet.</p>'}
    <div class="field" style="margin-top:14px"><span>Add a note for your agent</span><div class="row2"><input id="noteIn" maxlength="200" placeholder="e.g. Started a new job in March" style="flex:1"><button class="mini" type="button" id="noteAdd">Add</button></div></div>
    ${notice(`Estimated position in the workbook: ${e.res >= 0 ? 'refund' : 'bill'} of about ${fmt(Math.abs(e.res))}. Your agent will confirm the final figures.`)}</section>
</div>`;
  },
  bind() {
    const b = document.getElementById('xlsxBtn'), st = document.getElementById('xlsxSt');
    b.onclick = async () => { b.disabled = true; st.textContent = 'Building the workbook…'; try { const { buf, name } = await buildWorkbook(fy); download(name, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); st.textContent = 'Downloaded. Check your downloads folder.'; } catch (err) { console.error(err); st.textContent = 'Couldn’t build the workbook. Try again.'; } finally { b.disabled = false; } };
    document.getElementById('noteAdd').onclick = () => { const v = document.getElementById('noteIn').value.trim(); if (!v) return; const I = taxIn(fy); (I.notes ||= []).push(v); save(); setTab('export'); toast('Added for your agent.'); };
  },
};
