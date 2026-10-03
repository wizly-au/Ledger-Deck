/* Plain-English findings shared by the briefing, the voice summary and the AI context. */
import { state } from './store.js';
import { fmt, k, sum, pct, todayIso, monthKey, monthLong, lastMonths, days, dshort, fyLabel, round2, parseIso } from './util.js';
import { lastFullMonth, flows, netWorth, netWorthSeries, months12, recurring, upcoming, monthSpend, endMonth, quarterOf, bizPeriod, cashTotal, runway, owed, overdue, gstFor, basDue, accts, assetsTotal, debtsTotal, tracks, lastImport, TYPE_LABEL } from './model.js';

/* The last complete month we have data for. */
export const refMonth = lastFullMonth;

export function personal() {
  const ms = months12(), f = flows('P', ms), nwS = netWorthSeries('P', ms), rm = refMonth();
  const ref2 = lastMonths(2, rm + '-01'), i = ms.indexOf(rm), j = ms.indexOf(ref2[0]);
  const spend = i >= 0 ? f.out[i] : 0, prev = j >= 0 ? f.out[j] : 0, inc = i >= 0 ? f.inc[i] : 0;
  const cats = Object.entries(f.byCat).map(([c, v]) => ({ c, now: i >= 0 ? v[i] : 0, prev: j >= 0 ? v[j] : 0, avg: sum(v.slice(Math.max(0, i - 3), i)) / Math.max(1, Math.min(3, i)) })).sort((a, b) => b.now - a.now);
  const jump = cats.filter(c => c.avg > 50 && c.now > c.avg * 1.25 && c.now - c.avg > 60).sort((a, b) => (b.now - b.avg) - (a.now - a.avg))[0] || null;
  const cur = monthKey(todayIso()), spentNow = monthSpend('P', cur);
  const budgets = Object.entries(state.budgets).filter(([, l]) => l > 0).map(([c, l]) => ({ c, limit: l, spent: round2(spentNow[c] || 0) }));
  const subs = recurring('P').filter(r => r.sub);
  const first = nwS.find(v => v != null), nw = netWorth('P');
  return { ms, f, nwS, nw, nwChange: first != null ? nw - first : 0, rm, spend, prev, inc, saved: inc - spend, rate: inc > 0 ? (inc - spend) / inc : null, cats, jump, budgets, over: budgets.filter(b => b.spent > b.limit), subs, subsMonthly: round2(sum(subs.map(s => s.perMonth))), has: tracks('P') };
}

export function business() {
  const q = quarterOf(todayIso()), lq = quarterOf(addMonthsIso(q.from, -1));
  const cur = bizPeriod(q.from, todayIso()), last = bizPeriod(lq.from, lq.to), ms = months12(), f = flows('B', ms);
  const reg = state.settings.gst === 'yes', g = gstFor(lq.from, lq.to), due = basDue(lq), gNow = gstFor(q.from, q.to);
  const basAmt = reg ? g.net + (+state.settings.paygInst || 0) : 0;
  const ow = owed(), od = overdue();
  return { q, lq, cur, last, ms, f, cash: cashTotal('B'), runway: runway(), owed: round2(sum(ow.map(v => v.amount))), overdue: od, overdueT: round2(sum(od.map(v => v.amount))), reg, g, gNow, basDue: due, basDays: days(due), basAmt, margin: last.rev ? last.profit / last.rev : null, has: tracks('B') };
}
function addMonthsIso(s, n) { const [y, m] = s.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }

/* Things worth a look, most urgent first. Each: {sev, icon, tag, t, d, go, tab}. */
export function alerts(P = personal(), B = business()) {
  const out = [];
  if (B.has) {
    if (B.overdue.length) out.push({ sev: 'bad', icon: '!', tag: 'B', t: `${B.overdue.length} invoice${B.overdue.length > 1 ? 's' : ''} overdue`, d: `${fmt(B.overdueT)} outstanding. ${B.overdue.sort((a, b) => a.due < b.due ? -1 : 1)[0].client} is ${-days(B.overdue[0].due)} days late.`, go: 'business', tab: 'invoices' });
    if (B.reg && B.basDays >= 0 && B.basDays <= 35 && B.basAmt > 0) out.push({ sev: 'warn', icon: '◷', tag: 'B', t: `BAS due in ${B.basDays} days`, d: `About ${fmt(B.basAmt)} for ${dshort(B.lq.from)} to ${dshort(B.lq.to)}, due ${dshort(B.basDue)}.${state.settings.taxAside ? ` Tax savings cover ${Math.min(100, Math.round(state.settings.taxAside / B.basAmt * 100))}%.` : ''}`, go: 'tax', tab: 'bas' });
    if (B.runway != null && B.runway < 2) out.push({ sev: 'warn', icon: '↓', tag: 'B', t: `Cash covers ${B.runway.toFixed(1)} months of costs`, d: `${fmt(B.cash)} in business accounts against about ${fmt(B.cash / B.runway)} of monthly costs.`, go: 'business', tab: 'cash' });
  }
  if (P.has) {
    P.over.forEach(b => out.push({ sev: 'warn', icon: '↑', tag: 'P', t: `${b.c} is over budget`, d: `${fmt(b.spent)} spent this month against ${fmt(b.limit)}.`, go: 'personal', tab: 'goals' }));
    if (P.jump) out.push({ sev: 'warn', icon: '↑', tag: 'P', t: `${P.jump.c} up ${pct(P.jump.now, P.jump.avg)}%`, d: `${fmt(P.jump.now)} in ${monthLong(P.rm).split(' ')[0]}, against a usual ${fmt(P.jump.avg)}.`, go: 'personal', tab: 'spending' });
    if (P.subs.length) out.push({ sev: 'info', icon: '↻', tag: 'P', t: `${P.subs.length} subscriptions cost ${fmt(P.subsMonthly, 2)} a month`, d: `That’s ${fmt(P.subsMonthly * 12)} a year. Worth checking you still use them all.`, go: 'personal', tab: 'bills' });
  }
  const other = state.tx.filter(t => t.cat === 'Other' && t.date >= lastMonths(3)[0] + '-01');
  if (other.length > 8) out.push({ sev: 'info', icon: '?', tag: other[0].book, t: `${other.length} recent transactions are uncategorised`, d: 'Sorting them makes spending and tax figures more accurate. Fix one and similar ones follow.', go: other[0].book === 'B' ? 'business' : 'personal', tab: other[0].book === 'B' ? 'costs' : 'spending' });
  const li = lastImport();
  if (li && days(li) < -35 && !state.demo) out.push({ sev: 'info', icon: '⟳', tag: 'P', t: 'Your records are over a month old', d: `Last import ${dshort(li)}. Download fresh statements and import them in Data & AI.`, go: 'data' });
  const order = { bad: 0, warn: 1, info: 2, good: 3 };
  return out.sort((a, b) => order[a.sev] - order[b.sev]);
}

/* The spoken and written briefing, in a calm, plain voice. */
export function briefingLines(kind = 'all', P = personal(), B = business()) {
  const lines = [], when = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long' });
  const pm = monthLong(P.rm).split(' ')[0];
  if (kind === 'all') lines.push(`Here's where things stand on ${when}.`);
  if ((kind === 'all' || kind === 'personal') && P.has) {
    if (kind === 'personal') lines.push(`Here's where your personal money stands.`);
    if (accts('P').length) lines.push(`Your net worth is about ${k(P.nw)}${Math.abs(P.nwChange) > 100 ? `, ${P.nwChange > 0 ? 'up' : 'down'} ${k(Math.abs(P.nwChange))} over the past year` : ''}.`);
    if (P.spend) lines.push(`You spent ${fmt(P.spend)} in ${pm}${P.prev ? (Math.abs(pct(P.spend, P.prev)) < 3 ? ', about the same as the month before' : `, about ${Math.abs(pct(P.spend, P.prev))} percent ${P.spend > P.prev ? 'more' : 'less'} than the month before`) : ''}.`);
    if (P.inc && P.rate != null) lines.push(P.saved >= 0 ? `Money in was ${fmt(P.inc)}, so you kept about ${Math.round(P.rate * 100)} percent of it.` : `Money in was ${fmt(P.inc)}, so you spent ${fmt(-P.saved)} more than came in.`);
    if (P.jump) lines.push(`${P.jump.c} was the main change, at ${fmt(P.jump.now)} against a usual ${fmt(P.jump.avg)}.`);
    if (P.over.length) lines.push(`${P.over.map(b => b.c).join(' and ')} ${P.over.length > 1 ? 'are' : 'is'} over budget this month.`);
    if (P.subs.length) lines.push(`Subscriptions come to about ${fmt(P.subsMonthly)} a month.`);
  }
  if ((kind === 'all' || kind === 'business') && B.has) {
    lines.push(kind === 'business' ? `Here's where the business stands.` : `Now the business.`);
    if (B.last.rev || B.last.exp) lines.push(`Last quarter it made ${B.last.profit >= 0 ? `a profit of ${fmt(B.last.profit)}` : `a loss of ${fmt(-B.last.profit)}`} on ${fmt(B.last.rev)} of sales.`);
    if (B.cash) lines.push(`There is ${fmt(B.cash)} in the business accounts${B.runway != null ? `, which covers about ${B.runway.toFixed(1)} months of costs` : ''}.`);
    if (B.overdue.length) lines.push(`${B.overdue.length} invoice${B.overdue.length > 1 ? 's are' : ' is'} overdue, ${fmt(B.overdueT)} in total.`);
    if (B.reg && B.basDays >= 0 && B.basDays <= 60 && B.basAmt > 0) lines.push(`The BAS is due on ${parseIso(B.basDue).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })} and comes to about ${fmt(B.basAmt)}.`);
  }
  if (lines.length <= 1) lines.push('There isn’t enough in your records yet for a summary. Import a statement to get started.');
  else if (kind === 'all') lines.push(`That's the summary for now.`);
  return lines;
}

/* A compact summary of figures for the AI. Totals and patterns, not raw transactions. */
export function financeContext() {
  const P = personal(), B = business(), S = state.settings, out = [];
  out.push(`Today is ${todayIso()}. Australian financial year ${fyLabel(+todayIso().slice(0, 4) + (+todayIso().slice(5, 7) >= 7 ? 1 : 0))}. Amounts in AUD.`);
  out.push(`Profile: ${S.resident === 'yes' ? 'Australian resident for tax' : 'residency unclear'}; ${S.phi === 'yes' ? 'has' : 'no'} private hospital cover; ${S.help === 'yes' ? 'has a HELP debt' : 'no HELP debt'}; ${S.agent === 'yes' ? 'uses a registered tax agent' : 'no tax agent'}.`);
  if (P.has) {
    out.push(`PERSONAL: net worth ${fmt(P.nw)} (assets ${fmt(assetsTotal('P'))}, debts ${fmt(debtsTotal('P'))}); change over 12 months ${fmt(P.nwChange)}.`);
    out.push('Accounts: ' + accts('P').map(a => `${a.name} (${TYPE_LABEL[a.type]}) ${fmt(a.balance)}${a.rate ? ` at ${a.rate}%` : ''}${a.repay ? `, repay ${fmt(a.repay)}/mo` : ''}`).join('; ') + '.');
    out.push('Monthly money in / out (last 12 months): ' + P.ms.map((m, i) => `${m} ${Math.round(P.f.inc[i])}/${Math.round(P.f.out[i])}`).join(', ') + '.');
    out.push(`Spending by category in ${P.rm} (previous month): ` + P.cats.filter(c => c.now || c.prev).slice(0, 14).map(c => `${c.c} ${fmt(c.now)} (${fmt(c.prev)})`).join('; ') + '.');
    if (P.budgets.length) out.push('Budgets this month (spent/limit): ' + P.budgets.map(b => `${b.c} ${fmt(b.spent)}/${fmt(b.limit)}`).join('; ') + '.');
    const rec = recurring('P'); if (rec.length) out.push('Regular payments: ' + rec.slice(0, 15).map(r => `${r.name} ${fmt(r.amount, 2)} ${r.period}`).join('; ') + '.');
    if (state.goals.length) out.push('Goals: ' + state.goals.map(g => `${g.name} target ${fmt(g.target)} by ${g.by}`).join('; ') + '.');
  }
  if (B.has) {
    out.push(`BUSINESS${S.bizName ? ` (${S.bizName})` : ''}: ${S.entity === 'company' ? 'company' : S.entity === 'sole' ? 'sole trader' : S.entity}; ${B.reg ? `GST registered, ${S.bas.toLowerCase()} BAS, ${S.gstBasis} basis` : 'not registered for GST'}.`);
    out.push('Monthly income / costs (last 12 months, incl. GST): ' + B.ms.map((m, i) => `${m} ${Math.round(B.f.inc[i])}/${Math.round(B.f.out[i])}`).join(', ') + '.');
    out.push(`Last quarter ${B.lq.from} to ${B.lq.to}: sales ${fmt(B.last.rev)}, costs ${fmt(B.last.exp)}, profit ${fmt(B.last.profit)} (ex GST). This quarter so far: sales ${fmt(B.cur.rev)}, costs ${fmt(B.cur.exp)}.`);
    out.push(`Cash ${fmt(B.cash)}${B.runway != null ? `, runway ${B.runway.toFixed(1)} months` : ''}. Owed by clients ${fmt(B.owed)}, overdue ${fmt(B.overdueT)}.`);
    if (state.invoices.length) out.push('Unpaid invoices: ' + owed().map(v => `${v.client} ${fmt(v.amount)} due ${v.due}`).join('; ') + '.');
    if (B.reg) out.push(`Last quarter GST collected ${fmt(B.g.salesGst)}, credits ${fmt(B.g.credits)}, net ${fmt(B.g.net)}, PAYG instalment ${fmt(+S.paygInst || 0)}, due ${B.basDue}. Tax savings set aside ${fmt(+S.taxAside || 0)}.`);
    const costs = Object.entries(B.f.byCat).map(([c, v]) => [c, sum(v.slice(-3))]).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (costs.length) out.push('Costs by category, last 3 months: ' + costs.map(([c, v]) => `${c} ${fmt(v)}`).join('; ') + '.');
  }
  const up = upcoming(14); if (up.length) out.push('Next 14 days: ' + up.slice(0, 12).map(u => `${u.d} ${u.w} ${fmt(u.a)}`).join('; ') + '.');
  return out.join('\n');
}
