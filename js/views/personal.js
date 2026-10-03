import { state, save } from '../store.js';
import { fmt, k, esc, N, T, sum, pct, dshort, days, monthLabel, monthLong, monthKey, todayIso, parseIso, iso } from '../util.js';
import { V, tabsHtml, setTab, filterBind, sub } from '../ui.js';
import { ring, pill, tbl, drawTbl, TBL, lineChart, groupBars, stackBars, donut, hbars, legend, spark, heatmap, av } from '../charts.js';
import { accts, isDebt, signedBal, acctHistory, recurring, assetsTotal, debtsTotal, TYPE_LABEL, monthSpend, months12 } from '../model.js';
import { PCATS, catColor } from '../categories.js';
import { personal } from '../insights.js';
import { goalSaved } from '../sheets.js';
import { emptyState } from './briefing.js';

let P = null;
const noData = () => !state.tx.some(t => t.book === 'P') && !accts('P').length;

V.personal = {
  title: 'Personal',
  tabs: [['overview', 'Overview'], ['spending', 'Spending'], ['accounts', 'Accounts'], ['bills', 'Bills & subscriptions'], ['goals', 'Goals & budgets']],
  render() {
    if (noData()) return emptyState();
    P = personal();
    const pm = monthLong(P.rm).split(' ')[0];
    const bits = [];
    if (accts('P').length) bits.push(`Your net worth is <em class="c">${k(P.nw)}</em>${Math.abs(P.nwChange) > 100 ? `, <em class="${P.nwChange >= 0 ? 'g' : 'r'}">${P.nwChange >= 0 ? 'up' : 'down'} ${k(Math.abs(P.nwChange))}</em> on a year ago` : ''}.`);
    if (P.spend) bits.push(`You spent ${fmt(P.spend)} in ${pm}${P.jump ? `, with <em class="w">${esc(P.jump.c.toLowerCase())}</em> higher than usual` : ''}.`);
    return `<section class="panel hero">
  ${P.rate != null ? ring(Math.max(P.rate, 0) * 100, { value: Math.round(P.rate * 100) + '%', small: 'Kept' }) : ring(0, { value: '–', small: 'Kept' })}
  <div><div class="label" style="margin-bottom:6px">In plain English</div><h2>${bits.join(' ') || 'Import a bank statement to see where your money goes.'}</h2>
  <div class="pills">${P.rate != null ? pill(`${Math.round(P.rate * 100)}% of money in kept in ${pm}`, P.rate >= .1 ? 'good' : 'warn') : ''}${P.budgets.length ? pill(`${P.budgets.length - P.over.length} of ${P.budgets.length} budgets on track`, P.over.length ? 'warn' : 'good') : ''}${state.demo ? pill('Sample data', 'muted') : ''}</div></div>
  <div class="qs"><div>Net worth <b class="num">${k(P.nw)}</b></div><div>Money in, ${pm} <b class="num">${fmt(P.inc)}</b></div><div>Spent, ${pm} <b class="num">${fmt(P.spend)}</b></div></div></section>` + tabsHtml('personal');
  },
  tab: {},
};
const T_ = V.personal.tab;

T_.overview = {
  render() {
    const ms = P.ms.map(monthLabel), i = P.ms.indexOf(P.rm);
    const kept = P.f.inc.map((v, j) => v - P.f.out[j]);
    const types = {}; accts('P').filter(a => !isDebt(a)).forEach(a => { const t = TYPE_LABEL[a.type]; types[t] = (types[t] || 0) + (a.balance || 0); });
    const tc = ['var(--s1)', 'var(--s7)', 'var(--s4)', 'var(--s3)', 'var(--s2)', 'var(--s6)', 'var(--s5)', 'var(--s0)'];
    const own = Object.entries(types).sort((a, b) => b[1] - a[1]).map(([t, v], j) => [t, v, tc[j % tc.length]]);
    return `<div class="grid g4">
  ${[['Net worth', fmt(P.nw), `${P.nwChange >= 0 ? '▲' : '▼'} ${k(Math.abs(P.nwChange))} this year`, P.nwChange >= 0 ? 'up' : 'down', P.nwS, 'var(--accent)', 'accounts'],
      [`Spent in ${monthLabel(P.rm)}`, fmt(P.spend), P.prev ? (Math.abs(pct(P.spend, P.prev)) < 1 ? 'Same as the month before' : `${P.spend > P.prev ? '▲' : '▼'} ${Math.abs(pct(P.spend, P.prev))}% on the month before`) : '', P.spend > P.prev ? 'down' : 'up', P.f.out, 'var(--s2)', 'spending'],
      [`Kept in ${monthLabel(P.rm)}`, fmt(P.saved), P.rate != null ? `${Math.round(P.rate * 100)}% of money in` : '', P.saved >= 0 ? 'up' : 'down', kept, 'var(--s3)', 'goals'],
      ['Subscriptions', fmt(P.subsMonthly, 2), `${P.subs.length} found · ${fmt(P.subsMonthly * 12)} a year`, '', P.subs.map(s => s.perMonth), 'var(--s4)', 'bills']]
      .map(([l, v, d, dc, sp, c, tab]) => `<button class="panel kpi click" type="button" data-tab="${tab}" style="text-align:left"><span class="label">${l}</span><span class="v num">${v}</span><span class="delta ${dc}">${d}</span>${spark(sp, c, { w: 200 })}</button>`).join('')}
</div>
<div class="grid g-7-5">
  <section class="panel"><div class="ph"><h2>Net worth over time</h2></div><p class="say">What you own minus what you owe, at the end of each month. Hover for each month.</p>${lineChart([{ name: 'Net worth', vals: P.nwS, color: 'var(--accent)' }], ms, { every: 2 })}</section>
  <section class="panel"><div class="ph"><h2>What you own</h2></div><p class="say">${own.length ? `Most of it is in <b>${esc(own[0][0].toLowerCase())}</b>.` : 'Add accounts to see this.'}</p>${donut(own, { center: k(assetsTotal('P')), sub: 'total assets' })}${legend(own.map(o => [o[0], o[2]]))}</section>
</div>
<section class="panel"><div class="ph"><h2>Money in and money out</h2>${legend([['Money in', 'var(--s3)'], ['Spending', 'var(--s2)'], ['Kept', 'var(--s4)']])}</div><p class="say">Transfers between your own accounts and card repayments are left out so nothing is counted twice.</p>${groupBars([{ name: 'Money in', vals: P.f.inc, color: 'var(--s3)' }, { name: 'Spending', vals: P.f.out, color: 'var(--s2)' }], ms, { w: 1100, h: 300, line: { name: 'Kept', vals: kept, color: 'var(--s4)' } })}</section>`;
  },
};

T_.spending = {
  render() {
    const i = P.ms.indexOf(P.rm), j = i - 1, ms = P.ms.map(monthLabel);
    const cats = P.cats.filter(c => c.now > 0);
    const txs = state.tx.filter(t => t.book === 'P' && t.date >= P.ms[0] + '-01');
    const [y, m] = P.rm.split('-').map(Number), dayTot = Array(32).fill(0);
    txs.forEach(t => { if (monthKey(t.date) === P.rm && t.amount < 0 && !(PCATS[t.cat]?.skip)) dayTot[+t.date.slice(8)] += -t.amount; });
    const accName = Object.fromEntries(state.accounts.map(a => [a.id, a.name]));
    return `<div class="grid g-7-5">
  <section class="panel"><div class="ph"><h2>Where it went in ${monthLong(P.rm)}</h2><span class="aside">Tap a category to filter</span></div><p class="say">${cats.length ? `<b>${esc(cats[0].c)}</b> was the biggest cost.` : 'No spending found for this month.'} The small figure compares with the month before.</p>
    ${hbars(cats.map(c => ({ label: c.c, val: c.now, color: catColor('P', c.c), sub: c.prev ? `${pct(c.now, c.prev) > 0 ? '+' : ''}${pct(c.now, c.prev)}%` : 'new', subc: pct(c.now, c.prev) > 5 ? 'down' : pct(c.now, c.prev) < -5 ? 'up' : '', tip: `Month before ${fmt(c.prev)}` })), { pick: 'cat' })}</section>
  <section class="panel"><div class="ph"><h2>Share of spending</h2></div><p class="say">Total <b>${fmt(P.spend)}</b> across ${cats.length} categories.</p>${donut(cats.map(c => [c.c, c.now, catColor('P', c.c)]), { center: k(P.spend), sub: monthLabel(P.rm), pick: 'cat', size: 220 })}</section>
</div>
<div class="grid g-7-5">
  <section class="panel"><div class="ph"><h2>Spending by month</h2><span class="aside">Tap a colour to hide it</span></div>${legend(Object.keys(P.f.byCat).map(c => [c, catColor('P', c)]), 'series')}<div id="stackChart" style="margin-top:10px"></div></section>
  <section class="panel"><div class="ph"><h2>Daily spending · ${monthLong(P.rm)}</h2></div><p class="say">Darker days cost more. Hover a day to see the total.</p>${heatmap(dayTot, y, m - 1, 'var(--accent)')}</section>
</div>
<section class="panel"><div class="ph"><h2>Transactions</h2><span class="aside" id="txCount"></span></div>
  <div class="filters" id="txFilters"><button type="button" aria-pressed="true" data-f="">All</button>${Object.keys(PCATS).filter(c => txs.some(t => t.cat === c)).map(c => `<button type="button" aria-pressed="false" data-f="${esc(c)}">${esc(c)}</button>`).join('')}<input id="txSearch" type="search" placeholder="Search…" aria-label="Search transactions"></div>
  ${tbl('ttx', [{ k: 'date', l: 'Date', r: r => dshort(r.date) }, { k: 'desc', l: 'Where', r: r => `<span class="who">${av(r.desc, catColor('P', r.cat))}<span>${esc(r.desc)}<small>${esc(accName[r.acct] || '')}</small></span></span>` }, { k: 'cat', l: 'Category', r: r => `<span class="pill" style="color:${catColor('P', r.cat)}">${esc(r.cat)}</span>${r.ded ? ` <span class="tag">${r.ded}</span>` : ''}` }, { k: 'amount', l: 'Amount', n: 1, r: r => N((r.amount > 0 ? '+' : '') + fmt(r.amount, 2), r.amount > 0 ? 'up' : '') }], txs, { sort: 0, dir: -1, click: r => 'tx:' + r.id, limit: 60, foot: rows => `<td colspan="3">${rows.length} transactions</td><td class="n">${N(fmt(sum(rows.map(r => r.amount)), 2))}</td>`, empty: 'No transactions yet. Import a statement in Data & AI.' })}
  <p class="hint">Click a transaction to change its category. Similar ones follow, and future imports remember it.</p>
</section>`;
  },
  bind() {
    let cat = '', q = ''; const hidden = new Set();
    const apply = () => {
      TBL.ttx.filter = r => (!cat || r.cat === cat) && (!q || r.desc.toLowerCase().includes(q)); TBL.ttx.showAll = !!(cat || q); drawTbl('ttx');
      document.getElementById('txCount').textContent = cat ? `Showing ${cat}` : 'Last 12 months';
      document.querySelectorAll('.hbar[data-cat]').forEach(h => { h.classList.toggle('sel', h.dataset.cat === cat); h.classList.toggle('dim', !!cat && h.dataset.cat !== cat); });
      document.querySelectorAll('.dseg[data-cat]').forEach(h => h.classList.toggle('dim', !!cat && h.dataset.cat !== cat));
      document.querySelectorAll('#txFilters button').forEach(b => b.setAttribute('aria-pressed', b.dataset.f === cat));
    };
    document.querySelectorAll('.hbar[data-cat],.dseg[data-cat]').forEach(el => el.onclick = () => { cat = cat === el.dataset.cat ? '' : el.dataset.cat; apply(); document.getElementById('ttx').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    filterBind('txFilters', f => { cat = f; apply(); });
    document.getElementById('txSearch').oninput = e => { q = e.target.value.toLowerCase(); apply(); };
    const drawStack = () => { document.getElementById('stackChart').innerHTML = stackBars(Object.entries(P.f.byCat).sort((a, b) => sum(b[1]) - sum(a[1])).map(([c, v]) => ({ name: c, vals: v, color: catColor('P', c) })), P.ms.map(monthLabel), { hidden }); };
    document.querySelectorAll('[data-series]').forEach(b => b.onclick = () => { const n = b.dataset.series; hidden.has(n) ? hidden.delete(n) : hidden.add(n); b.classList.toggle('off', hidden.has(n)); drawStack(); });
    drawStack(); apply();
    if (sub.pickcat) { cat = sub.pickcat; sub.pickcat = null; apply(); }
  },
};

T_.accounts = {
  render() {
    const A = accts('P'), ms = months12();
    const rows = A.map(a => ({ a, n: a.name, t: TYPE_LABEL[a.type], v: signedBal(a), h: acctHistory(a, ms) }));
    const big = Math.max(1, ...rows.map(r => Math.abs(r.v)));
    return `<div class="grid g3">
  <div class="panel kpi"><span class="label">You own</span><span class="v num up">${fmt(assetsTotal('P'))}</span><span class="hint">${A.filter(a => !isDebt(a)).length} accounts and assets</span></div>
  <div class="panel kpi"><span class="label">You owe</span><span class="v num down">${fmt(debtsTotal('P'))}</span><span class="hint">${A.filter(isDebt).length} loans and cards</span></div>
  <div class="panel kpi"><span class="label">Net worth</span><span class="v num">${fmt(P.nw)}</span><span class="hint">Own minus owe</span></div>
</div>
<section class="panel"><div class="ph"><h2>All accounts</h2><button class="mini" type="button" data-sheet="newacct:P">Add an account</button></div><p class="say">Click an account to edit it, update its balance or import a statement into it.</p>
  ${tbl('tacc', [{ k: 'n', l: 'Account', r: r => `<span class="who">${av(r.n, isDebt(r.a) ? 'var(--s8)' : 'var(--s1)')}<span>${esc(r.n)}<small>${esc(r.t)}${r.a.balanceDate ? ' · as at ' + dshort(r.a.balanceDate) : ''}</small></span></span>` }, { k: 'v', l: 'Balance', n: 1, r: r => N(fmt(r.v), r.v < 0 ? 'down' : '') }, { k: 'h', l: 'Trend', s: false, r: r => spark(r.h, isDebt(r.a) ? 'var(--s8)' : 'var(--accent)', { w: 110, h: 30 }) }, { k: 'sh', l: 'Share', n: 1, v: r => Math.abs(r.v), r: r => `<div class="ibar"><span style="width:${Math.abs(r.v) / big * 100}%;background:${isDebt(r.a) ? 'var(--s8)' : 'var(--accent)'}"></span></div>` }], rows, { sort: 1, dir: -1, click: r => 'acct:' + r.a.id, empty: 'No accounts yet.' })}
</section>
${A.filter(isDebt).length ? `<section class="panel"><div class="ph"><h2>Debts at a glance</h2></div>
  ${tbl('tdebt', [{ k: 'name', l: 'Debt', r: r => esc(r.name) }, { k: 'rate', l: 'Rate', n: 1, r: r => r.rate != null ? r.rate + '%' : '<span class="hint">add</span>' }, { k: 'repay', l: 'Monthly', n: 1, r: r => r.repay ? N(fmt(r.repay)) : '<span class="hint">add</span>' }, { k: 'balance', l: 'Owed', n: 1, r: r => N(fmt(r.balance), 'down') }], A.filter(isDebt), { sort: 3, dir: -1, click: r => 'acct:' + r.id })}
  <p class="hint">Add a rate and repayment to try paying a loan off faster in What if.</p></section>` : ''}`;
  },
};

T_.bills = {
  render() {
    const rec = recurring('P'), subs = rec.filter(r => r.sub), bills = rec.filter(r => !r.sub);
    const now = todayIso(), [y, m] = now.split('-').map(Number), cal = Array(32).fill(0);
    rec.forEach(r => { const step = { weekly: 7, fortnightly: 14, monthly: 30.4, quarterly: 91, yearly: 365 }[r.period]; let d = parseIso(r.next), g = 0; while (iso(d) < now.slice(0, 8) + '01' && g++ < 60) d.setDate(d.getDate() + Math.round(step)); while (d.getMonth() === m - 1 && d.getFullYear() === y && g++ < 80) { cal[d.getDate()] += r.amount; d.setDate(d.getDate() + Math.round(step)); } });
    const flagged = new Set(state.cancelList || []);
    const cols = [{ k: 'name', l: 'What', r: r => `<span class="who">${av(r.name, catColor('P', r.cat))}<span>${esc(r.name)}<small>${esc(r.cat)} · ${r.period}</small></span></span>` }, { k: 'next', l: 'Next', r: r => `${dshort(r.next)}<small>${days(r.next) >= 0 ? 'in ' + days(r.next) + ' days' : 'expected'}</small>` }, { k: 'amount', l: 'Amount', n: 1, r: r => N(fmt(r.amount, 2)) }, { k: 'perMonth', l: 'Per year', n: 1, v: r => r.perMonth, r: r => N(fmt(r.perMonth * 12)) }];
    return `<div class="grid g-5-7">
  <section class="panel"><div class="ph"><h2>${monthLong(now.slice(0, 7))} bill calendar</h2></div><p class="say">Expected regular payments by day. Hover a day.</p>${heatmap(cal, y, m - 1, 'var(--accent)')}</section>
  <section class="panel"><div class="ph"><h2>Regular bills</h2></div><p class="say">Found by spotting payments that repeat. <b>${fmt(sum(bills.map(b => b.perMonth)))}</b> a month in total.</p>
    ${tbl('tbill', cols, bills, { sort: 1, dir: 1, empty: 'Regular bills appear after about three months of statements.' })}</section>
</div>
<section class="panel"><div class="ph"><h2>Subscriptions</h2><span class="aside" id="subSave"></span></div><p class="say">${subs.length ? `<b>${fmt(P.subsMonthly, 2)}</b> a month, ${fmt(P.subsMonthly * 12)} a year. Flag any you no longer use as a reminder to cancel them.` : 'No subscriptions found yet.'}</p>
  ${tbl('tsub', [...cols, { k: 'x', l: '', s: false, r: r => `<button class="mini ${flagged.has(r.key) ? 'done' : ''}" type="button" data-cancel="${esc(r.key)}">${flagged.has(r.key) ? '✓ On cancel list' : 'Flag to cancel'}</button>` }], subs, { sort: 3, dir: -1, empty: 'Nothing found yet.' })}
</section>`;
  },
  bind() {
    const subs = recurring('P').filter(r => r.sub);
    const upd = () => { const set = new Set(state.cancelList || []); const s = sum(subs.filter(x => set.has(x.key)).map(x => x.perMonth)); document.getElementById('subSave').innerHTML = s ? `<span class="pill good">Cancelling saves ${fmt(s * 12)} a year</span>` : ''; };
    document.getElementById('tsub').addEventListener('click', e => { const b = e.target.closest('[data-cancel]'); if (!b) return; const set = new Set(state.cancelList || []); const key = b.dataset.cancel; set.has(key) ? set.delete(key) : set.add(key); state.cancelList = [...set]; save(); drawTbl('tsub'); upd(); });
    upd();
  },
};

T_.goals = {
  render() {
    const cur = monthKey(todayIso()), spent = monthSpend('P', cur);
    const spendCats = Object.keys(PCATS).filter(c => !PCATS[c].in && !PCATS[c].skip);
    const avg3 = c => { const v = P.f.byCat[c]; return v ? sum(v.slice(-4, -1)) / 3 : 0; };
    return `<section class="panel"><div class="ph"><h2>Savings goals</h2><button class="mini" type="button" data-sheet="newgoal">Add a goal</button></div><p class="say">Each goal shows whether you’ll get there in time at your monthly amount.</p>
  ${state.goals.length ? state.goals.map(g => { const s = goalSaved(g), p = g.target ? s / g.target * 100 : 0, left = Math.max(g.target - s, 0), mo = g.monthly > 0 ? Math.ceil(left / g.monthly) : Infinity, need = Math.max(1, Math.round((parseIso(g.by) - new Date()) / (30.4 * 864e5))), fin = new Date(); fin.setMonth(fin.getMonth() + (isFinite(mo) ? mo : 0)); const ok = mo <= need;
      return `<div class="goal">${ring(p, { size: 104, stroke: 10, value: Math.round(p) + '%', small: 'saved', btn: `data-sheet="goal:${g.id}" aria-label="Edit ${esc(g.name)}"` })}<div><div class="ph"><h3>${esc(g.name)}</h3>${left <= 0 ? pill('Reached', 'good') : pill(ok ? 'On track' : 'Behind', ok ? 'good' : 'warn')}</div><div class="hint num">${fmt(s)} of ${fmt(g.target)} · by ${dshort(g.by)} ${g.acct ? '· tracks ' + esc(state.accounts.find(a => a.id === g.acct)?.name || '') : ''}</div><p class="say" style="margin:6px 0 0">${left <= 0 ? 'Done. Nice work.' : isFinite(mo) ? `At ${fmt(g.monthly)} a month you’ll finish around <b>${fin.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}</b>. To hit the date you need about ${fmt(Math.ceil(left / need))} a month.` : 'Add a monthly amount to see when you’ll finish.'}</p></div></div>`;
    }).join('') : '<p class="hint">No goals yet.</p>'}
</section>
<section class="panel"><div class="ph"><h2>Monthly budgets</h2><span class="aside">${monthLong(cur)} so far</span></div><p class="say">Set a limit for any category. The usual amount is your average over the last three months. Leave a box empty for no budget.</p>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Category</th><th class="n">Usual</th><th class="n">This month</th><th>Progress</th><th class="n">Limit</th></tr></thead><tbody>
  ${spendCats.filter(c => avg3(c) > 0 || state.budgets[c]).map(c => { const l = state.budgets[c] || 0, s = spent[c] || 0, p = l ? s / l * 100 : 0, col = p > 100 ? 'var(--bad)' : p > 85 ? 'var(--warn)' : 'var(--s3)'; return `<tr><td><span class="pill" style="color:${catColor('P', c)}">${esc(c)}</span></td><td class="n">${N(fmt(avg3(c)))}</td><td class="n">${N(fmt(s))}</td><td>${l ? `<div class="ibar" ${T(`${Math.round(p)}% of ${fmt(l)}`)}><span style="width:${Math.min(p, 100)}%;background:${col}"></span></div>` : '<span class="hint">No budget</span>'}</td><td class="n"><input class="budget" data-bud="${esc(c)}" inputmode="decimal" value="${l || ''}" placeholder="—" aria-label="${esc(c)} budget" style="width:90px;text-align:right"></td></tr>`; }).join('') || '<tr><td colspan="5" class="hint">Budgets appear once you have some spending.</td></tr>'}
  </tbody></table></div></section>`;
  },
  bind() {
    document.querySelectorAll('[data-bud]').forEach(i => i.onchange = () => { const v = parseFloat(i.value.replace(/[$,]/g, '')); if (v > 0) state.budgets[i.dataset.bud] = v; else delete state.budgets[i.dataset.bud]; save(); setTab('goals'); });
  },
};
