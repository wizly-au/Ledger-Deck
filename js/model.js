/* Everything the screens show is worked out here from the stored records. */
import { state } from './store.js';
import { sum, round2, todayIso, lastMonths, monthKey, addDays, days, parseIso, iso, fyOf, fyStart, fyEnd } from './util.js';
import { cats, isIncome, isSkip, merchantKey } from './categories.js';

export const ASSET_TYPES = { bank: 'Everyday account', savings: 'Savings', offset: 'Offset account', super: 'Super', shares: 'Shares and ETFs', property: 'Property', vehicle: 'Vehicle', other: 'Other asset' };
export const DEBT_TYPES = { card: 'Credit card', loan: 'Loan', mortgage: 'Home loan', bnpl: 'Buy now pay later', debt: 'Other debt' };
export const TYPE_LABEL = { ...ASSET_TYPES, ...DEBT_TYPES };
export const isDebt = a => a.type in DEBT_TYPES;
export const isCash = a => ['bank', 'savings', 'offset'].includes(a.type);
/* Debts are stored as positive amounts owed and shown negative. */
export const signedBal = a => isDebt(a) ? -Math.abs(a.balance || 0) : (a.balance || 0);

export const accts = book => state.accounts.filter(a => !book || a.book === book);
export const txOf = (book, from, to) => state.tx.filter(t => (!book || t.book === book) && (!from || t.date >= from) && (!to || t.date <= to));
export const hasData = book => state.tx.some(t => t.book === book) || state.accounts.some(a => a.book === book);
export const tracks = b => !!state.settings.track[b] || hasData(b);

/* The 12 months shown on charts end with the latest month that has data (or this month). */
export function endMonth() {
  const latest = state.tx.reduce((m, t) => t.date > m ? t.date : m, '');
  const now = todayIso();
  return latest && latest < now.slice(0, 7) + '-01' ? latest : now;
}
/* Charts use complete months only, so a half-finished month doesn't look like a drop. */
export function lastFullMonth() { const e = endMonth(), now = todayIso(); return monthKey(e) === monthKey(now) ? lastMonths(2, now)[0] : monthKey(e); }
export const months12 = () => lastMonths(12, lastFullMonth() + '-01');

/* Income, spending and category totals per month for one book. */
export function flows(book, months = months12()) {
  const idx = Object.fromEntries(months.map((m, i) => [m, i]));
  const inc = months.map(() => 0), out = months.map(() => 0), byCat = {};
  for (const t of state.tx) {
    if (t.book !== book) continue; const i = idx[monthKey(t.date)]; if (i == null || isSkip(book, t.cat)) continue;
    if (isIncome(book, t.cat)) inc[i] += t.amount;
    else { out[i] += -t.amount; (byCat[t.cat] ||= months.map(() => 0))[i] += -t.amount; }
  }
  return { months, inc: inc.map(round2), out: out.map(round2), byCat };
}

/* Account balance at the end of each month, worked backwards from the latest known balance. */
export function acctHistory(a, months = months12()) {
  const txs = state.tx.filter(t => t.acct === a.id), asOf = a.balanceDate || todayIso();
  const first = txs.reduce((m, t) => t.date < m ? t.date : m, '9999');
  return months.map(m => {
    const end = iso(new Date(+m.slice(0, 4), +m.slice(5, 7), 0));
    if (txs.length) {
      if (end >= asOf) return signedBal(a);
      if (end < first.slice(0, 7) + '-01') return null; // before the records start
      // both assets and debts: the net value moves by each transaction's signed amount
      const after = sum(txs.filter(t => t.date > end && t.date <= asOf).map(t => t.amount));
      return round2(signedBal(a) - after);
    }
    const pts = (a.history || []).filter(p => p[0] <= end).sort((x, y) => x[0] < y[0] ? -1 : 1);
    if (pts.length) return isDebt(a) ? -Math.abs(pts.at(-1)[1]) : pts.at(-1)[1];
    return (a.balanceDate && a.balanceDate > end) ? null : signedBal(a);
  });
}
export function netWorthSeries(book, months = months12()) {
  // before an account's records start, assume its earliest known balance
  const hs = accts(book).map(a => { const h = acctHistory(a, months), f = h.find(x => x != null); return h.map(x => x ?? f ?? 0); });
  return hs.length ? months.map((_, i) => round2(sum(hs.map(h => h[i])))) : months.map(() => null);
}
export const netWorth = book => round2(sum(accts(book).map(signedBal)));
export const assetsTotal = book => round2(sum(accts(book).filter(a => !isDebt(a)).map(a => a.balance || 0)));
export const debtsTotal = book => round2(sum(accts(book).filter(isDebt).map(a => Math.abs(a.balance || 0))));
export const cashTotal = book => round2(sum(accts(book).filter(isCash).map(a => a.balance || 0)));

/* Recurring payments: the same merchant at a regular interval with a similar amount. */
export function recurring(book) {
  const groups = {};
  const since = addDays(todayIso(), -400);
  for (const t of state.tx) {
    if ((book && t.book !== book) || t.amount >= 0 || t.date < since || isSkip(t.book, t.cat)) continue;
    const k = t.book + '|' + merchantKey(t.desc); if (!merchantKey(t.desc)) continue;
    (groups[k] ||= []).push(t);
  }
  const out = [];
  for (const [k, list] of Object.entries(groups)) {
    if (list.length < 3) continue;
    list.sort((a, b) => a.date < b.date ? -1 : 1);
    const gaps = list.slice(1).map((t, i) => (parseIso(t.date) - parseIso(list[i].date)) / 864e5).filter(g => g > 3);
    if (gaps.length < 2) continue;
    const med = gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
    const period = med >= 25 && med <= 35 ? 'monthly' : med >= 12 && med <= 16 ? 'fortnightly' : med >= 6 && med <= 8 ? 'weekly' : med >= 85 && med <= 95 ? 'quarterly' : med >= 350 && med <= 380 ? 'yearly' : null;
    if (!period) continue;
    const regular = gaps.filter(g => Math.abs(g - med) <= Math.max(4, med * .2)).length / gaps.length;
    const amts = list.slice(-4).map(t => -t.amount), avg = sum(amts) / amts.length;
    const steady = amts.every(a => Math.abs(a - avg) <= Math.max(2, avg * .25));
    if (regular < .6 || !steady) continue;
    const last = list.at(-1), next = addDays(last.date, Math.round(med));
    if (days(last.date) < -Math.max(med * 2.2, 45)) continue; // stopped
    const perMonth = avg * ({ weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, yearly: 1 }[period]) / 12;
    out.push({ key: k, book: last.book, name: tidyName(last.desc), cat: last.cat, amount: round2(avg), period, next, last: last.date, perMonth: round2(perMonth), count: list.length, sub: last.cat === 'Subscriptions' || last.cat === 'Software' });
  }
  return out.sort((a, b) => b.perMonth - a.perMonth);
}
export const tidyName = d => {
  let s = String(d).replace(/\s{2,}/g, ' ').replace(/\b(card|xx\d+|\d{4,}|value date.*|aus|au)\b/gi, '').replace(/\s+/g, ' ').trim();
  if (s === s.toUpperCase()) s = s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\b(Bpay|Atm|Ato|Agl|Abn|Gst|Jb|Iga|Kfc|Bp)\b/g, w => w.toUpperCase());
  return s.length > 42 ? s.slice(0, 40) + '…' : s;
};

/* Money in and out over the next n days: predicted recurring payments plus invoices due. */
export function upcoming(n = 14, book) {
  const end = addDays(todayIso(), n), list = [];
  for (const r of recurring(book)) {
    let d = r.next, step = { weekly: 7, fortnightly: 14, monthly: 30.4, quarterly: 91, yearly: 365 }[r.period], g = 0;
    while (d < todayIso() && g++ < 60) d = addDays(d, Math.round(step));
    while (d <= end && g++ < 80) { list.push({ d, w: r.name, b: r.book, a: -r.amount, kind: 'bill' }); d = addDays(d, Math.round(step)); }
  }
  if (!book || book === 'B') for (const v of state.invoices) if (!v.paid && v.due <= end) list.push({ d: v.due < todayIso() ? todayIso() : v.due, w: `${v.client} pays ${v.num || 'invoice'}`, b: 'B', a: v.amount, kind: 'inv', late: v.due < todayIso() });
  return list.sort((a, b) => a.d < b.d ? -1 : 1);
}

/* This month and last month spending for budgets. */
export function monthSpend(book, mk) {
  const by = {};
  for (const t of state.tx) if (t.book === book && monthKey(t.date) === mk && t.amount < 0 && !isSkip(book, t.cat) && !isIncome(book, t.cat)) by[t.cat] = (by[t.cat] || 0) - t.amount;
  return by;
}

/* ---------- business ---------- */
export function quarterOf(dateIso) { const [y, m] = dateIso.split('-').map(Number); const q = Math.floor(((m - 7 + 12) % 12) / 3); const fy = fyOf(dateIso); const sm = 7 + q * 3; const sy = sm > 12 ? fy : fy - 1; const smm = ((sm - 1) % 12) + 1; const from = `${sy}-${String(smm).padStart(2, '0')}-01`; const to = iso(new Date(sy, smm - 1 + 3, 0)); return { q: q + 1, fy, from, to }; }
export function basDue(period) { const end = parseIso(period.to); const m = end.getMonth() + 1; if (state.settings.bas === 'Monthly') return iso(new Date(end.getFullYear(), end.getMonth() + 1, 21)); if (m === 12) return `${end.getFullYear() + 1}-02-28`; return iso(new Date(end.getFullYear(), end.getMonth() + 1, 28)); }
export function gstFor(from, to) {
  const reg = state.settings.gst === 'yes'; let sales = 0, salesGst = 0, purch = 0, credits = 0;
  for (const t of state.tx) {
    if (t.book !== 'B' || t.date < from || t.date > to || isSkip('B', t.cat)) continue;
    const meta = cats('B')[t.cat] || {}, hasGst = t.gst != null ? t.gst : !!meta.gst;
    if (t.amount > 0 && isIncome('B', t.cat)) { sales += t.amount; if (hasGst && reg) salesGst += t.amount / 11; }
    else if (t.amount < 0) { purch += -t.amount; if (hasGst && reg) credits += -t.amount / 11; }
  }
  return { sales: round2(sales), salesGst: Math.round(salesGst), purch: round2(purch), credits: Math.round(credits), net: Math.round(salesGst - credits) };
}
export function bizPeriod(from, to) {
  const f = txOf('B', from, to).filter(t => !isSkip('B', t.cat));
  const rev = sum(f.filter(t => isIncome('B', t.cat)).map(t => t.amount)), exp = -sum(f.filter(t => !isIncome('B', t.cat) && t.amount < 0).map(t => t.amount));
  const reg = state.settings.gst === 'yes', g = gstFor(from, to);
  const revEx = reg ? rev - g.salesGst : rev, expEx = reg ? exp - g.credits : exp;
  return { rev: round2(revEx), exp: round2(expEx), profit: round2(revEx - expEx) };
}
export function avgMonthlyCosts(n = 3) { const f = flows('B', lastMonths(n, lastFullMonth() + '-01')); return sum(f.out) / n; }
export const runway = () => { const c = avgMonthlyCosts(); return c > 0 ? cashTotal('B') / c : null; };
export const owed = () => state.invoices.filter(v => !v.paid);
export const overdue = () => owed().filter(v => v.due < todayIso());

export const fyNow = () => fyOf(todayIso());
export const fyRange = fy => [fyStart(fy), fyEnd(fy)];
export const fyProgress = (fy = fyNow()) => { const s = parseIso(fyStart(fy)), e = parseIso(fyEnd(fy)), t = parseIso(todayIso()); return Math.min(Math.max((t - s) / (e - s), 0), 1); };
export const lastImport = () => state.imports.reduce((m, i) => i.date > m ? i.date : m, '');
