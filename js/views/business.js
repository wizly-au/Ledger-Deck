import { state } from '../store.js';
import { fmt, k, esc, N, sum, pct, dshort, days, monthLabel, todayIso, addDays, lastMonths, parseIso } from '../util.js';
import { V, tabsHtml, filterBind } from '../ui.js';
import { ring, pill, tbl, drawTbl, TBL, lineChart, groupBars, donut, hbars, legend, spark, waterfall, av } from '../charts.js';
import { accts, isCash, owed, overdue, txOf, avgMonthlyCosts } from '../model.js';
import { BCATS, catColor, merchantKey } from '../categories.js';
import { business } from '../insights.js';
import { tidyName } from '../model.js';

let B = null;
const noData = () => !state.tx.some(t => t.book === 'B') && !accts('B').length && !state.invoices.length;
function empty() {
  return `<section class="panel hero"><div></div><div><div class="label" style="margin-bottom:6px">Business</div><h2>Add your business account to see sales, costs, cash and GST in one place.</h2>
  <p class="say">Export a CSV from your business bank (or from Xero, MYOB or QuickBooks as a bank transactions report) and import it into the Business book.</p>
  <div class="pills"><button class="cta" type="button" data-go="data">Import a statement</button><button class="cta ghost" type="button" data-sheet="newacct:B">Add an account by hand</button><button class="cta ghost" type="button" data-sheet="newinv">Add an invoice</button></div></div><div></div></section>`;
}
const invStatus = v => v.paid ? ['Paid', 'good'] : days(v.due) < -14 ? [`Overdue ${-days(v.due)}d`, 'bad'] : days(v.due) < 0 ? [`Overdue ${-days(v.due)}d`, 'warn'] : days(v.due) <= 14 ? [`Due in ${days(v.due)}d`, 'info'] : [`Due ${dshort(v.due)}`, 'muted'];

V.business = {
  title: 'Business',
  tabs: [['overview', 'Overview'], ['cash', 'Cash flow'], ['invoices', 'Invoices'], ['costs', 'Costs']],
  render() {
    if (noData()) return empty();
    B = business();
    const name = state.settings.bizName ? esc(state.settings.bizName) : 'The business';
    const line = B.last.rev || B.last.exp
      ? `${name} made ${B.last.profit >= 0 ? `<em class="g">${k(B.last.profit)} profit</em>` : `<em class="r">a ${k(-B.last.profit)} loss</em>`} last quarter on ${k(B.last.rev)} of sales.${B.overdueT ? ` <em class="r">${k(B.overdueT)} is overdue</em>.` : ''}${B.runway != null ? ` Cash covers <em class="${B.runway < 3 ? 'w' : 'g'}">${B.runway.toFixed(1)} months</em> of costs.` : ''}`
      : `${name} has <em class="c">${k(B.cash)}</em> in the bank. Import transactions to see sales and costs.`;
    return `<section class="panel hero">
  ${B.margin != null ? ring(Math.max(B.margin, 0) * 100, { value: Math.round(B.margin * 100) + '%', small: 'Margin' }) : ring(0, { value: '–', small: 'Margin' })}
  <div><div class="label" style="margin-bottom:6px">In plain English</div><h2>${line}</h2>
  <div class="pills">${B.margin != null ? pill(`${Math.round(B.margin * 100)}% profit margin last quarter`, B.margin > .1 ? 'good' : 'warn') : ''}${B.overdue.length ? pill(`${B.overdue.length} invoices overdue`, 'bad') : ''}${B.reg ? pill('GST registered', 'muted') : ''}${state.demo ? pill('Sample data', 'muted') : ''}</div></div>
  <div class="qs"><div>Cash <b class="num">${fmt(B.cash)}</b></div><div>Owed to you <b class="num">${fmt(B.owed)}</b></div><div>Quarter so far <b class="num">${fmt(B.cur.profit)}</b></div></div></section>` + tabsHtml('business');
  },
  tab: {},
};
const T_ = V.business.tab;

T_.overview = {
  render() {
    const ms = B.ms.map(monthLabel), net = B.f.inc.map((v, i) => v - B.f.out[i]);
    const byClient = {}; txOf('B', addDays(todayIso(), -365)).filter(t => t.cat === 'Sales' && t.amount > 0).forEach(t => { const n = tidyName(t.desc.replace(/^(payment|deposit|transfer)\s+from\s+/i, '').replace(/\binv\b.*$/i, '')); byClient[n] = (byClient[n] || 0) + t.amount; });
    const cl = Object.entries(byClient).sort((a, b) => b[1] - a[1]), top = cl.slice(0, 5), rest = sum(cl.slice(5).map(c => c[1]));
    const CC = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s0)'];
    const items = [...top, ...(rest ? [['Everyone else', rest]] : [])].map((c, i) => [c[0], c[1], CC[i]]);
    const totalSales = sum(cl.map(c => c[1]));
    const share = totalSales ? cl[0]?.[1] / totalSales : 0;
    return `<div class="grid g4">
  ${[['Sales last quarter', fmt(B.last.rev), 'ex GST', '', B.f.inc, 'var(--accent)', 'cash'], ['Profit last quarter', fmt(B.last.profit), B.margin != null ? `${Math.round(B.margin * 100)}% margin` : '', B.last.profit >= 0 ? 'up' : 'down', net, 'var(--s2)', 'cash'], ['Cash in bank', fmt(B.cash), B.runway != null ? `${B.runway.toFixed(1)} months of costs` : '', '', [], 'var(--s4)', 'cash'], ['Owed to you', fmt(B.owed), B.overdueT ? `${fmt(B.overdueT)} overdue` : 'nothing overdue', B.overdueT ? 'down' : 'up', owed().map(v => v.amount), 'var(--bad)', 'invoices']]
      .map(([l, v, d, dc, sp, c, tab]) => `<button class="panel kpi click" type="button" data-tab="${tab}" style="text-align:left"><span class="label">${l}</span><span class="v num">${v}</span><span class="delta ${dc}">${d}</span>${spark(sp, c, { w: 200 })}</button>`).join('')}
</div>
<div class="grid g-7-5">
  <section class="panel"><div class="ph"><h2>Money in and out by month</h2>${legend([['Money in', 'var(--accent)'], ['Money out', 'var(--s0)'], ['Difference', 'var(--s4)']])}</div><p class="say">Including GST. Tax payments, transfers and owner drawings are left out.</p>${groupBars([{ name: 'Money in', vals: B.f.inc, color: 'var(--accent)' }, { name: 'Money out', vals: B.f.out, color: 'var(--s0)' }], ms, { line: { name: 'Difference', vals: net, color: 'var(--s4)' } })}</section>
  <section class="panel"><div class="ph"><h2>Who pays you</h2><span class="aside">Last 12 months</span></div><p class="say">${cl.length ? `<b>${esc(cl[0][0])}</b> is your biggest client at ${Math.round(share * 100)}% of sales.` : 'Payments categorised as Sales appear here.'}</p>${donut(items, { center: k(totalSales), sub: '12 months', size: 210 })}${legend(items.map(i => [i[0], i[2]]))}</section>
</div>
<section class="panel"><div class="ph"><h2>Health checks</h2></div>
  ${tbl('thc', [{ k: 0, l: 'Check' }, { k: 1, l: 'Now', n: 1 }, { k: 2, l: 'Rule of thumb', n: 1 }, { k: 3, l: 'Status', r: r => pill(r[3], r[4]) }, { k: 5, l: 'What to do', s: false, r: r => `<span class="hint">${esc(r[5])}</span>` }], [
      B.margin != null && ['Profit margin', Math.round(B.margin * 100) + '%', '15%+', B.margin >= .15 ? 'Good' : 'Watch', B.margin >= .15 ? 'good' : 'warn', B.margin >= .15 ? 'Keep pricing where it is.' : 'Check pricing and your biggest costs.'],
      B.runway != null && ['Cash runway', B.runway.toFixed(1) + ' months', '3+ months', B.runway >= 3 ? 'Good' : 'Watch', B.runway >= 3 ? 'good' : 'warn', B.runway >= 3 ? 'A healthy buffer.' : 'Collect overdue invoices and hold off on big purchases.'],
      ['Overdue invoices', fmt(B.overdueT), '$0', B.overdueT ? 'Act now' : 'Good', B.overdueT ? 'bad' : 'good', B.overdueT ? 'Send a friendly reminder from the Invoices tab.' : 'Nothing to chase.'],
      B.reg && B.basAmt > 0 && ['Tax set aside', fmt(+state.settings.taxAside || 0), fmt(B.basAmt), (+state.settings.taxAside || 0) >= B.basAmt ? 'Good' : 'Watch', (+state.settings.taxAside || 0) >= B.basAmt ? 'good' : 'warn', 'Keep GST and PAYG money in a separate account.'],
      totalSales && ['Biggest client share', Math.round(share * 100) + '%', 'under 30%', share < .3 ? 'Good' : 'Watch', share < .3 ? 'good' : 'warn', share < .3 ? 'A healthy spread of clients.' : 'Losing this client would hurt. Worth widening the base.'],
    ].filter(Boolean), {})}
</section>`;
  },
};

T_.cash = {
  render() {
    const q = B.lq, f = txOf('B', q.from, q.to).filter(t => !['Transfers'].includes(t.cat));
    const inS = sum(f.filter(t => t.amount > 0).map(t => t.amount)), byCat = {};
    f.filter(t => t.amount < 0).forEach(t => byCat[t.cat] = (byCat[t.cat] || 0) + t.amount);
    const cashAccts = accts('B').filter(isCash), ids = new Set(cashAccts.map(a => a.id));
    const close = sum(cashAccts.map(a => a.balance || 0)) - sum(state.tx.filter(t => ids.has(t.acct) && t.date > q.to).map(t => t.amount));
    const open = close - sum(state.tx.filter(t => ids.has(t.acct) && t.date >= q.from && t.date <= q.to).map(t => t.amount));
    const outs = Object.entries(byCat).sort((a, b) => a[1] - b[1]), top = outs.slice(0, 5), restOut = sum(outs.slice(5).map(o => o[1]));
    const transfersNet = sum(txOf('B', q.from, q.to).filter(t => t.cat === 'Transfers' && ids.has(t.acct)).map(t => t.amount));
    const steps = [{ l: `Opening ${dshort(q.from)}`, v: Math.round(open), t: 'start' }, { l: 'Money in', v: Math.round(inS), t: 'delta' }, ...top.map(([c, v]) => ({ l: c, v: Math.round(v), t: 'delta' })), ...(restOut ? [{ l: 'Other costs', v: Math.round(restOut), t: 'delta' }] : []), ...(Math.abs(transfersNet) > 1 ? [{ l: 'Transfers', v: Math.round(transfersNet), t: 'delta' }] : []), { l: `Closing ${dshort(q.to)}`, v: Math.round(close), t: 'end' }];
    const avg = avgMonthlyCosts(), monthsF = lastMonths(4, addDays(todayIso(), 95)).map(monthLabel);
    const due = owed(), inflow = i => sum(due.filter(v => { const d = parseIso(v.due < todayIso() ? todayIso() : v.due), m = new Date(); m.setMonth(m.getMonth() + i); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear(); }).map(v => v.amount));
    let bal = B.cash; const fc = [Math.round(B.cash)]; for (let i = 0; i < 3; i++) { bal += inflow(i) - avg; fc.push(Math.round(bal)); }
    return `<section class="panel"><div class="ph"><h2>How cash moved last quarter</h2>${legend([['Money in', 'var(--s3)'], ['Money out', 'var(--s8)'], ['Balance', 'var(--s0)']])}</div><p class="say">${dshort(q.from)} to ${dshort(q.to)} across your business cash accounts. ${top.length ? `<b>${esc(top[0][0])}</b> was the biggest outflow.` : ''}</p>${cashAccts.length ? waterfall(steps, { w: 780, h: 300 }) : '<p class="hint">Add a business bank account to see this.</p>'}</section>
<div class="grid g-7-5">
  <section class="panel"><div class="ph"><h2>Cash outlook</h2>${legend([['Expected', 'var(--s2)']])}</div><p class="say">Today’s cash, plus unpaid invoices on their due dates, less your average monthly costs of <b>${fmt(avg)}</b>. New sales aren’t included, so this is the cautious view.</p>${lineChart([{ name: 'Expected', vals: fc, color: 'var(--s2)', dash: 1 }], ['Now', ...monthsF.slice(1)], { zero: true })}</section>
  <section class="panel" style="display:grid;justify-items:center;align-content:start"><div class="ph" style="justify-self:stretch"><h2>Runway</h2></div><p class="say" style="justify-self:stretch">How long cash lasts if no money came in.</p>${ring(B.runway != null ? B.runway / 6 * 100 : 0, { size: 170, stroke: 15, color: B.runway != null && B.runway < 3 ? 'var(--warn)' : 'var(--accent)', value: B.runway != null ? B.runway.toFixed(1) : '–', small: 'months' })}<div class="hint" style="margin-top:10px">Rule of thumb: 3 months or more</div></section>
</div>`;
  },
};

T_.invoices = {
  render() {
    const un = owed(), bk = [['Not due yet', sum(un.filter(v => days(v.due) >= 0).map(v => v.amount)), 'var(--s3)'], ['1–14 days late', sum(un.filter(v => days(v.due) < 0 && days(v.due) >= -14).map(v => v.amount)), 'var(--warn)'], ['15+ days late', sum(un.filter(v => days(v.due) < -14).map(v => v.amount)), 'var(--bad)']];
    const tot = sum(bk.map(b => b[1])) || 1, paid = state.invoices.filter(v => v.paid && v.issued);
    const avgDays = paid.length ? Math.round(sum(paid.map(v => (parseIso(v.paid) - parseIso(v.issued)) / 864e5)) / paid.length) : null;
    return `<div class="grid g-7-5">
  <section class="panel"><div class="ph"><h2>Money owed to you</h2></div><p class="say"><b>${fmt(B.owed)}</b> unpaid${B.overdueT ? `, ${fmt(B.overdueT)} of it late` : ''}.</p>
    <div style="display:flex;height:22px;border-radius:11px;overflow:hidden;margin:6px 0 14px;background:var(--tint2)">${bk.map(b => b[1] ? `<span style="width:${b[1] / tot * 100}%;background:${b[2]}" data-tip="<b>${b[0]}</b><br>${fmt(b[1])}"></span>` : '').join('')}</div>${legend(bk.map(b => [`${b[0]} · ${fmt(b[1])}`, b[2]]))}</section>
  <section class="panel"><div class="ph"><h2>How fast clients pay</h2></div><p class="say">${avgDays != null ? `On average <b>${avgDays} days</b> from invoice to payment.` : 'Mark invoices as paid to see this.'}</p></section>
</div>
<section class="panel"><div class="ph"><h2>Invoices</h2><button class="mini" type="button" data-sheet="newinv">Add an invoice</button></div>
  <div class="filters" id="invFilters"><button type="button" aria-pressed="true" data-f="all">All</button><button type="button" aria-pressed="false" data-f="late">Overdue</button><button type="button" aria-pressed="false" data-f="soon">Due soon</button><button type="button" aria-pressed="false" data-f="paid">Paid</button><input id="invSearch" type="search" placeholder="Search clients…" aria-label="Search invoices"></div>
  ${tbl('tinv', [{ k: 'num', l: 'Invoice', r: r => esc(r.num || '—') }, { k: 'client', l: 'Client', r: r => `<span class="who">${av(r.client, 'var(--s1)')}<span>${esc(r.client)}</span></span>` }, { k: 'issued', l: 'Sent', r: r => r.issued ? dshort(r.issued) : '' }, { k: 'due', l: 'Due', r: r => dshort(r.due) }, { k: 'st', l: 'Status', v: r => r.paid ? 9999 : days(r.due), r: r => pill(...invStatus(r)) }, { k: 'amount', l: 'Amount', n: 1, r: r => N(fmt(r.amount)) }], state.invoices, { sort: 4, dir: 1, click: r => 'inv:' + r.id, empty: 'No invoices yet. Add the ones you’re waiting on so Ledger Deck can track them.', foot: rows => `<td colspan="5">${rows.length} invoices</td><td class="n">${N(fmt(sum(rows.map(r => r.amount))))}</td>` })}
  <p class="hint">Invoices are entered by hand for now. A direct Xero connection is planned.</p>
</section>`;
  },
  bind() {
    let f = 'all', q = ''; const apply = () => { TBL.tinv.filter = v => (f === 'all' || (f === 'late' && !v.paid && days(v.due) < 0) || (f === 'soon' && !v.paid && days(v.due) >= 0 && days(v.due) <= 14) || (f === 'paid' && v.paid)) && (!q || v.client.toLowerCase().includes(q)); drawTbl('tinv'); };
    filterBind('invFilters', x => { f = x; apply(); }); document.getElementById('invSearch').oninput = e => { q = e.target.value.toLowerCase(); apply(); };
  },
};

T_.costs = {
  render() {
    const from = lastMonths(3, B.ms.at(-1) + '-01')[0] + '-01';
    const f = txOf('B', from).filter(t => t.amount < 0 && !BCATS[t.cat]?.skip);
    const byCat = {}; f.forEach(t => byCat[t.cat] = (byCat[t.cat] || 0) - t.amount);
    const cc = Object.entries(byCat).sort((a, b) => b[1] - a[1]), tot = sum(cc.map(c => c[1])) || 1;
    const vend = {}; f.forEach(t => { const kk = merchantKey(t.desc) || t.desc; (vend[kk] ||= { name: tidyName(t.desc), cat: t.cat, v: 0, n: 0 }); vend[kk].v -= t.amount; vend[kk].n++; });
    const vs = Object.values(vend), big = Math.max(1, ...vs.map(v => v.v));
    const accName = Object.fromEntries(state.accounts.map(a => [a.id, a.name]));
    return `<div class="grid g-5-7">
  <section class="panel"><div class="ph"><h2>Costs by type · last 3 months</h2><span class="aside">Tap to filter</span></div><p class="say">${cc.length ? `<b>${esc(cc[0][0])}</b> make up ${Math.round(cc[0][1] / tot * 100)}% of costs.` : 'No costs found yet.'}</p>${hbars(cc.map(([c, v]) => ({ label: c, val: v, color: catColor('B', c), sub: Math.round(v / tot * 100) + '%' })), { pick: 'bcat' })}</section>
  <section class="panel"><div class="ph"><h2>Costs over the year</h2>${legend([['Money out', 'var(--s2)'], ['Money in', 'var(--accent)']])}</div><p class="say">Including GST.</p>${lineChart([{ name: 'Money out', vals: B.f.out, color: 'var(--s2)' }, { name: 'Money in', vals: B.f.inc, color: 'var(--accent)' }], B.ms.map(monthLabel), { every: 2 })}</section>
</div>
<section class="panel"><div class="ph"><h2>Who you paid · last 3 months</h2><span class="aside" id="vendCount"></span></div>
  <div class="filters" id="vendFilters"><button type="button" aria-pressed="true" data-f="">All</button>${cc.map(c => `<button type="button" aria-pressed="false" data-f="${esc(c[0])}">${esc(c[0])}</button>`).join('')}</div>
  ${tbl('tvend', [{ k: 'name', l: 'Supplier', r: r => `<span class="who">${av(r.name, catColor('B', r.cat))}<span>${esc(r.name)}<small>${r.n} payment${r.n > 1 ? 's' : ''}</small></span></span>` }, { k: 'cat', l: 'Type', r: r => `<span class="pill" style="color:${catColor('B', r.cat)}">${esc(r.cat)}</span>` }, { k: 'v', l: 'Spent', n: 1, r: r => N(fmt(r.v)) }, { k: 'sh', l: 'Share', n: 1, v: r => r.v, r: r => `<div class="ibar"><span style="width:${r.v / big * 100}%;background:${catColor('B', r.cat)}"></span></div>` }], vs, { sort: 2, dir: -1, foot: rows => `<td colspan="2">Total</td><td class="n">${N(fmt(sum(rows.map(r => r.v))))}</td><td></td>` })}
</section>
<section class="panel"><div class="ph"><h2>All business transactions</h2></div>
  ${tbl('tbtx', [{ k: 'date', l: 'Date', r: r => dshort(r.date) }, { k: 'desc', l: 'Description', r: r => `${esc(r.desc)}<small>${esc(accName[r.acct] || '')}</small>` }, { k: 'cat', l: 'Category', r: r => `<span class="pill" style="color:${catColor('B', r.cat)}">${esc(r.cat)}</span>` }, { k: 'amount', l: 'Amount', n: 1, r: r => N((r.amount > 0 ? '+' : '') + fmt(r.amount, 2), r.amount > 0 ? 'up' : '') }], txOf('B', B.ms[0] + '-01'), { sort: 0, dir: -1, click: r => 'tx:' + r.id, limit: 50 })}
  <p class="hint">Click a transaction to change its category or GST treatment.</p></section>`;
  },
  bind() {
    let c = ''; const apply = () => { TBL.tvend.filter = r => !c || r.cat === c; drawTbl('tvend'); document.getElementById('vendCount').textContent = c ? `Showing ${c}` : ''; document.querySelectorAll('.hbar[data-bcat]').forEach(h => { h.classList.toggle('sel', h.dataset.bcat === c); h.classList.toggle('dim', !!c && h.dataset.bcat !== c); }); document.querySelectorAll('#vendFilters button').forEach(b => b.setAttribute('aria-pressed', b.dataset.f === c)); };
    document.querySelectorAll('.hbar[data-bcat]').forEach(h => h.onclick = () => { c = c === h.dataset.bcat ? '' : h.dataset.bcat; apply(); }); filterBind('vendFilters', x => { c = x; apply(); }); apply();
  },
};
