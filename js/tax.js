/* Tax assistant maths. General information only: rates and thresholds are simplified and must be
   checked against ato.gov.au. Nothing here is tax advice. */
import { state } from './store.js';
import { sum, round2, fmt, todayIso, fyStart, fyEnd, fyLabel, parseIso, days } from './util.js';
import { txOf, bizPeriod, fyProgress, accts, recurring, quarterOf, basDue, gstFor } from './model.js';
import { DLABELS, guessDeduction } from './categories.js';

export const DISCLAIMER = 'General information only, not personal tax or financial advice.';
export const AGENT_LINE = 'Talk this through with your registered tax agent before acting.';
export const ato = (q, url = 'https://www.ato.gov.au/') => `<a href="${url}" target="_blank" rel="noopener">Look up “${q}” on ato.gov.au</a>`;

/* Resident rates. FY is the year it ends in (2027 = 2026–27). */
const RATES = {
  2025: [[18200, 0], [45000, .16], [135000, .30], [190000, .37], [Infinity, .45]],
  2026: [[18200, 0], [45000, .16], [135000, .30], [190000, .37], [Infinity, .45]],
  2027: [[18200, 0], [45000, .15], [135000, .30], [190000, .37], [Infinity, .45]],
  2028: [[18200, 0], [45000, .14], [135000, .30], [190000, .37], [Infinity, .45]],
};
export const rates = fy => RATES[fy] || RATES[2027];
export const SG_RATE = .12, CC_CAP = 30000, NCC_CAP = 120000, COMPANY_RATE = .25;
export function incomeTax(ti, fy) { let t = 0, lo = 0; for (const [hi, r] of rates(fy)) { if (ti > lo) t += (Math.min(ti, hi) - lo) * r; lo = hi; } return Math.round(t); }
export const marginal = (ti, fy) => { let lo = 0; for (const [hi, r] of rates(fy)) { if (ti <= hi) return r; lo = hi; } return .45; };
export function lito(ti) { if (ti <= 37500) return 700; if (ti <= 45000) return Math.round(700 - (ti - 37500) * .05); if (ti <= 66667) return Math.max(0, Math.round(325 - (ti - 45000) * .015)); return 0; }
export function medicare(ti) { const lo = 27222, hi = lo * 1.25; if (ti <= lo) return 0; if (ti <= hi) return Math.round((ti - lo) * .1); return Math.round(ti * .02); }
export function mls(ti, phi) { if (phi === 'yes') return 0; if (ti <= 101000) return 0; const r = ti <= 118000 ? .01 : ti <= 158000 ? .0125 : .015; return Math.round(ti * r); }

/* Gross pay from net pay (resident, no HELP): find gross where gross - tax - medicare = net. */
function grossFromNet(net, fy) { let lo = net, hi = net * 2.2; for (let i = 0; i < 50; i++) { const g = (lo + hi) / 2, n = g - Math.max(incomeTax(g, fy) - lito(g), 0) - medicare(g); if (n > net) hi = g; else lo = g; } return Math.round((lo + hi) / 2); }

export const taxIn = fy => (state.tax[fy] ||= { salary: '', withheld: '', salSac: '', divs: '', frank: '', other: '', wfhHours: '', cgt: [], extraDed: [] });

/* Deduction candidates from personal transactions in the year. */
export function deductions(fy) {
  const list = txOf('P', fyStart(fy), fyEnd(fy)).filter(t => t.amount < 0).map(t => { if (t.ded === undefined) { const g = guessDeduction(t); if (g) { t.ded = g; t.dedSt = 'ask'; } } return t; }).filter(t => t.ded);
  const extra = taxIn(fy).extraDed || [];
  return { tx: list, extra };
}
export const dedTotal = fy => { const d = deductions(fy), I = taxIn(fy); return round2(-sum(d.tx.filter(t => t.dedSt === 'yes').map(t => t.amount)) + sum(d.extra.map(e => +e.amount || 0)) + (+I.wfhHours || 0) * .70); };

/* The full-year estimate. Uses what the person typed where available, otherwise their transactions. */
export function estimate(fy) {
  const I = taxIn(fy), [from, to] = [fyStart(fy), fyEnd(fy)], prog = fy === currentFy() ? Math.max(fyProgress(fy), 1 / 12) : 1;
  const proj = v => prog < 1 ? v / prog : v;
  const tx = txOf('P', from, to);
  const netPay = sum(tx.filter(t => t.cat === 'Salary' && t.amount > 0).map(t => t.amount));
  let salary = +I.salary || 0, withheld = +I.withheld || 0, salSrc = 'entered';
  if (!salary && netPay) { const netYr = proj(netPay); salary = grossFromNet(netYr, fy); withheld = withheld || Math.round(salary - netYr - medicare(salary)); salSrc = 'estimated'; }
  else if (salary && !withheld) withheld = Math.max(incomeTax(salary, fy) - lito(salary), 0) + medicare(salary);
  const interest = Math.round(proj(sum(tx.filter(t => t.cat === 'Interest' && t.amount > 0).map(t => t.amount))));
  const divCash = +I.divs || Math.round(sum(tx.filter(t => t.cat === 'Dividends' && t.amount > 0).map(t => t.amount)));
  const frank = +I.frank || 0, other = +I.other || 0;
  const cg = (I.cgt || []).map(c => { const gain = (+c.proceeds || 0) - (+c.cost || 0), long = c.bought && c.sold ? (parseIso(c.sold) - parseIso(c.bought)) / 864e5 > 365 : false; return { ...c, gain, long }; });
  const gains = sum(cg.filter(c => c.gain > 0).map(c => c.gain)), losses = -sum(cg.filter(c => c.gain < 0).map(c => c.gain));
  const longGains = sum(cg.filter(c => c.gain > 0 && c.long).map(c => c.gain)), shortGains = gains - longGains;
  const netCG = Math.round(Math.max(shortGains - losses, 0) + Math.max(longGains - Math.max(losses - shortGains, 0), 0) / 2);
  const biz = state.settings.entity === 'sole' && state.settings.track.B ? bizPeriod(from, to) : null;
  const bizProfit = biz ? Math.round(proj(biz.profit)) : 0;
  const ded = Math.round(dedTotal(fy)), salSac = +I.salSac || 0;
  const assess = Math.round(salary + interest + divCash + frank + netCG + other + bizProfit);
  const ti = Math.max(assess - ded, 0);
  const tax = incomeTax(ti, fy), off = Math.min(lito(ti), tax), med = medicare(ti), sur = mls(ti, state.settings.phi);
  const due = Math.max(tax - off, 0) + med + sur - frank;
  return { fy, salary, salSrc, withheld, interest, divCash, frank, other, cg, netCG, losses, bizProfit, ded, assess, ti, tax, off, med, sur, due, res: withheld - due, marg: marginal(ti, fy), salSac, prog, netPay };
}
export const currentFy = () => { const t = todayIso(); const [y, m] = t.split('-').map(Number); return m >= 7 ? y + 1 : y; };
export const superAcct = () => accts('P').find(a => a.type === 'super');

/* Strategy ideas built from the person's own figures. */
export function strategies(fy) {
  const e = estimate(fy), I = taxIn(fy), out = [], left = Math.max(days(fyEnd(fy)), 0);
  const sg = Math.round(e.salary * SG_RATE), room = Math.max(CC_CAP - sg - e.salSac, 0), sup = superAcct();
  if (e.salary && e.marg > .15 && room > 1000) {
    const x = Math.min(room, 10000);
    out.push({ id: 'cc', s: 'P', t: 'Use some of your concessional super room', v: Math.round(x * (e.marg + .02 - .15)), n: `if you add ${fmt(x)} this year`, d: `Employer super is about ${fmt(sg)} (${SG_RATE * 100}% of ${fmt(e.salary)}) against the ${fmt(CC_CAP)} concessional cap, leaving about ${fmt(room)}. Salary sacrifice or a personal deductible contribution is taxed at 15% in the fund instead of your marginal rate of ${Math.round(e.marg * 100)}% plus Medicare.`, why: 'The money is locked in super until you retire or meet a condition of release. Going over the cap costs extra tax, and the cap can change.', q: 'concessional contributions cap' });
    if (!sup || (sup.balance || 0) < 500000) out.push({ id: 'cf', s: 'P', t: 'Check for unused cap amounts from earlier years', v: 0, n: 'adds to the room above', d: `If your total super balance was under $500,000 on 30 June last year, unused concessional cap from the last five years may carry forward. myGov shows the exact figure under Super.`, why: 'Carry-forward amounts must be confirmed with the ATO, and a large contribution affects your cash flow.', q: 'carry-forward concessional contributions' });
  }
  const ask = deductions(fy).tx.filter(t => t.dedSt === 'ask');
  if (ask.length) out.push({ id: 'ded', s: 'P', t: `Review ${ask.length} possible deduction${ask.length > 1 ? 's' : ''}`, v: Math.round(-sum(ask.map(t => t.amount)) * (e.marg + .02)), n: 'if all are genuine work costs', d: `Ledger Deck found ${ask.length} transactions that might be deductible, worth ${fmt(-sum(ask.map(t => t.amount)))}. Only claim what you spent earning your income, and keep the receipts.`, why: 'Private costs aren’t deductible, and claims need records.', q: 'deductions you can claim', tab: 'deductions' });
  if (!(+I.wfhHours)) out.push({ id: 'wfh', s: 'P', t: 'Record your work-from-home hours', v: Math.round(300 * .7 * (e.marg + .02)), n: 'on 300 hours at 70c', d: 'The fixed-rate method allows a set amount per hour worked from home and needs a record of the hours. The actual-cost method can give more with a dedicated office but needs bills and a usage diary.', why: 'You need a record of every hour, and the rate changes from time to time.', q: 'working from home expenses' });
  if (e.netCG > 0) out.push({ id: 'cgt', s: 'P', t: 'Think about timing for capital gains', v: Math.round(e.netCG * e.marg), n: 'tax on your net gain', d: `Your sales this year make a net capital gain of about ${fmt(e.netCG)}. Assets held more than 12 months get the 50% discount. Selling an investment that is down before 30 June can offset a gain.`, why: 'Selling and buying back the same investment just for the loss can be treated as a wash sale and the loss denied.', q: 'capital gains tax discount' });
  if (left < 150 && left > 0) out.push({ id: 'pre', s: 'P', t: 'Prepay deductible costs before 30 June', v: 0, n: 'moves the deduction into this year', d: 'Paying a deductible expense, such as a professional membership or income protection premium, before 30 June brings the deduction into this year.', why: 'It only moves the deduction earlier, and you need the cash now.', q: 'prepaid expenses' });
  if (state.settings.phi !== 'yes' && e.ti > 101000) out.push({ id: 'mls', s: 'P', t: 'Compare private hospital cover with the Medicare levy surcharge', v: e.sur, n: 'surcharge in this estimate', d: `Without private hospital cover, singles above about $101,000 pay a surcharge of 1% to 1.5%. This estimate includes ${fmt(e.sur)}. A basic hospital policy can cost less than the surcharge.`, why: 'Family thresholds differ, and the cheapest policy may not suit your health needs.', q: 'Medicare levy surcharge' });
  if (state.settings.track.B) {
    const fyBiz = bizPeriod(fyStart(fy), fyEnd(fy)), turnover = fyBiz.rev / Math.max(e.prog, 1 / 12);
    if (state.settings.gst !== 'yes' && turnover > 60000) out.push({ id: 'gstreg', s: 'B', t: 'Check whether you must register for GST', v: 0, n: 'needs checking', d: `Your sales are on track for about ${fmt(turnover)} this year. You must register for GST once turnover reaches $75,000.`, why: 'Registering means charging GST on sales and lodging BAS.', q: 'registering for GST' });
    out.push({ id: 'iaw', s: 'B', t: 'Time any equipment purchase', v: Math.round(5000 * (state.settings.entity === 'company' ? COMPANY_RATE : e.marg)), n: 'on a $5,000 item', d: 'Equipment the business buys and starts using before 30 June can usually be deducted this year. Check whether an instant asset write-off threshold applies this year.', why: 'Buying only for the deduction still costs most of the price, and the write-off rules change from year to year.', q: 'instant asset write-off' });
    const qp = quarterOf(todayIso()), g = gstFor(qp.from, qp.to);
    if (state.settings.gst === 'yes' && g.net > 0 && (state.settings.taxAside || 0) < g.net) out.push({ id: 'aside', s: 'B', t: 'Set aside money for the next BAS', v: 0, n: `about ${fmt(g.net)} so far this quarter`, d: `GST collected minus credits this quarter is about ${fmt(g.net)} so far. Moving it to a separate account as you go avoids a scramble on the due date.`, why: 'This is cash flow, not a saving. PAYG instalments come on top.', q: 'paying your BAS' });
    if (state.settings.entity === 'company') out.push({ id: 'div7a', s: 'B', t: 'How you take money out of the company', v: 0, n: 'needs a professional', pro: true, d: 'Wages, dividends and loans from a company each have different tax results. Loans and drawings can be taxed as unfranked dividends (Division 7A) if not handled correctly.', why: 'This depends on your whole situation and is easy to get wrong.', q: 'Division 7A' });
    const contractors = recurring('B').filter(r => r.cat === 'Contractors');
    if (contractors.length) out.push({ id: 'contr', s: 'B', t: 'Check whether regular contractors are really employees', v: 0, n: 'needs a professional', pro: true, d: `${contractors.map(c => c.name).slice(0, 3).join(', ')} ${contractors.length > 1 ? 'are' : 'is'} paid regularly. If the ATO treats an arrangement as employment, the business may owe super guarantee and PAYG withholding.`, why: 'The answer depends on the whole working relationship, not the contract label.', q: 'employee or contractor' });
  }
  return out;
}

/* Items for the "For your accountant" tab. */
export function agentFlags(fy) {
  const e = estimate(fy), d = deductions(fy), out = [];
  if (e.salSrc === 'estimated') out.push('Salary and tax withheld were estimated from pay deposits. Check them against the income statement in myGov.');
  d.tx.filter(t => t.dedSt === 'ask').slice(0, 6).forEach(t => out.push(`Is ${t.desc} (${fmt(-t.amount, 2)}, ${t.date}) deductible?`));
  if (e.frank === 0 && e.divCash > 0) out.push('Dividends were received but no franking credits were entered. Check the annual tax statements.');
  if ((taxIn(fy).cgt || []).length) out.push('Confirm the cost base of each asset sold, including brokerage.');
  if (state.settings.resident !== 'yes') out.push('Residency for tax purposes needs confirming.');
  if (state.settings.help === 'yes') out.push('A study loan (HELP) repayment applies and isn’t included in the estimate.');
  strategies(fy).filter(s => s.pro).forEach(s => out.push(s.t + '.'));
  (taxIn(fy).notes || []).forEach(n => out.push(n));
  return out;
}

/* ---------- accountant workbook (.xlsx) ---------- */
export async function buildWorkbook(fy) {
  const X = window.XLSX || await new Promise((res, rej) => { const s = document.createElement('script'); s.src = new URL('../vendor/xlsx.full.min.js', import.meta.url).href; s.onload = () => res(window.XLSX); s.onerror = rej; document.head.append(s); });
  const e = estimate(fy), I = taxIn(fy), S = state.settings, wb = X.utils.book_new(), lab = fyLabel(fy), now = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const add = (name, rows, cols) => { const ws = X.utils.aoa_to_sheet(rows); ws['!cols'] = cols.map(w => ({ wch: w })); X.utils.book_append_sheet(wb, ws, name); };
  add('Summary', [[`Ledger Deck: ${lab} financial year summary for your tax agent`], [], ['Financial year', `1 July ${fy - 1} to 30 June ${fy}`], ['Prepared', now], ['Australian resident for tax', S.resident === 'yes' ? 'Yes' : 'Check with tax agent'], ['Private hospital cover', S.phi === 'yes' ? 'Yes' : 'No'], ['Study loan (HELP)', S.help === 'yes' ? 'Yes, repayment not included' : 'No'], ...(S.track.B ? [['Business', S.bizName || 'Not named'], ['Structure', { sole: 'Sole trader', company: 'Company', partnership: 'Partnership', trust: 'Trust' }[S.entity] || S.entity], ['ABN', S.abn || 'Not entered'], ['GST', S.gst === 'yes' ? `Registered, ${S.bas.toLowerCase()} BAS, ${S.gstBasis} basis` : 'Not registered']] : []), [], ['Estimated position', 'Amount (AUD)'], ['Assessable income', e.assess], ['Deductions', -e.ded], ['Taxable income', e.ti], ['Income tax (resident rates)', e.tax], ['Low income tax offset', -e.off], ['Medicare levy', e.med], ['Medicare levy surcharge', e.sur], ['Less franking credits', -e.frank], ['Less tax withheld', -e.withheld], [e.res >= 0 ? 'Estimated refund' : 'Estimated amount to pay', Math.abs(e.res)], [], [e.prog < 1 ? `Figures are projected to a full year from records up to ${now}.` : 'Figures cover the full year.'], [`${DISCLAIMER} Figures come from the taxpayer's own records and need review by a registered tax agent before lodging.`]], [40, 44]);
  add('Income', [['Return item', 'Income type', 'Source', 'Gross amount', 'Tax withheld', 'Franking credits', 'Notes'], ['Item 1', 'Salary and wages', 'Employer', e.salary, e.withheld, '', e.salSrc === 'estimated' ? 'Estimated from pay deposits. Confirm with income statement in myGov.' : 'Entered by taxpayer'], ['Item 10', 'Gross interest', 'Bank accounts', e.interest, 0, '', e.prog < 1 ? 'Projected to full year' : ''], ['Item 11', 'Dividends', 'Shares and ETFs', e.divCash, 0, e.frank, 'Confirm against annual tax statements'], ['Item 18', 'Net capital gain', 'See Capital gains tab', e.netCG, '', '', ''], ...(e.bizProfit ? [['P8', 'Business income (sole trader)', S.bizName || 'Business', e.bizProfit, '', '', 'Net profit from the business book']] : []), ...(e.other ? [['Other', 'Other income', 'Entered by taxpayer', e.other, '', '', '']] : []), [], ['Total', '', '', e.assess, e.withheld, e.frank, '']], [10, 30, 30, 14, 13, 16, 52]);
  const d = deductions(fy), yes = d.tx.filter(t => t.dedSt === 'yes');
  const dedRows = [...yes.map(t => [t.ded, DLABELS[t.ded] || '', t.date, t.desc, -t.amount, t.note || '', 'Confirmed by taxpayer']), ...d.extra.map(x => [x.label, DLABELS[x.label] || '', '', x.desc, +x.amount || 0, x.note || '', 'Entered by taxpayer']), ...(+I.wfhHours ? [['D5', DLABELS.D5, 'Full year', `Working from home, fixed rate, ${I.wfhHours} hours at 70c`, Math.round(I.wfhHours * .7), 'Hours record', 'Entered by taxpayer']] : [])];
  add('Deductions', [['ATO label', 'Category', 'Date', 'Description', 'Amount', 'Receipt or note', 'Status'], ...dedRows, [], ['Total', '', '', '', round2(sum(dedRows.map(r => r[4]))), '', ''], [], ['Not yet confirmed (not included above)'], ...d.tx.filter(t => t.dedSt === 'ask').map(t => [t.ded, DLABELS[t.ded] || '', t.date, t.desc, -t.amount, '', 'Needs review'])], [10, 34, 12, 44, 12, 26, 22]);
  add('Capital gains', [['Asset', 'Purchase date', 'Cost base', 'Sale date', 'Sale proceeds', 'Gain or loss', 'Held over 12 months', 'Discount'], ...e.cg.map(c => [c.asset, c.bought, +c.cost || 0, c.sold, +c.proceeds || 0, c.gain, c.long ? 'Yes' : 'No', c.long && c.gain > 0 ? '50%' : 'None']), [], ['Net capital gain after losses and discount', '', '', '', '', e.netCG]], [26, 13, 12, 12, 14, 13, 18, 10]);
  const sg = Math.round(e.salary * SG_RATE);
  add('Super', [['Contribution type', 'Amount', 'Cap', 'Room left', 'Notes'], [`Employer (super guarantee, ${SG_RATE * 100}%)`, sg, '', '', 'Estimated from salary'], ['Salary sacrifice', e.salSac, '', '', ''], ['Total concessional', sg + e.salSac, CC_CAP, Math.max(CC_CAP - sg - e.salSac, 0), 'Check the current cap'], ['Super balance', superAcct()?.balance || '', '', '', 'Latest balance in Ledger Deck']], [38, 12, 10, 12, 40]);
  const bizRows = [];
  if (S.track.B) {
    for (let q = 1; q <= 4; q++) { const sm = [7, 10, 1, 4][q - 1], y = sm >= 7 ? fy - 1 : fy, from = `${y}-${String(sm).padStart(2, '0')}-01`, p = quarterOf(from), g = gstFor(p.from, p.to); bizRows.push([`Q${q}`, `${p.from} to ${p.to}`, g.sales, g.salesGst, g.credits, g.net, basDue(p)]); }
  }
  const bp = bizPeriod(fyStart(fy), fyEnd(fy));
  add('Business BAS', S.track.B ? [[`${S.bizName || 'Business'}: ${lab}`], [], ['Quarter', 'Period', 'G1 Total sales (incl. GST)', '1A GST on sales', '1B GST on purchases', 'Net GST', 'Usual due date'], ...bizRows, [], ['Year to date', '', 'Amount (ex GST)'], ['Income', '', bp.rev], ['Expenses', '', bp.exp], ['Net profit', '', bp.profit], [], ['GST figures assume purchases in GST-able categories include GST. Check tax invoices.']] : [['No business tracked.']], [10, 26, 22, 16, 18, 12, 16]);
  add('For your accountant', [['#', 'Question or item flagged for review'], ...agentFlags(fy).map((q, i) => [i + 1, q])], [5, 100]);
  return { buf: X.write(wb, { bookType: 'xlsx', type: 'array' }), name: `Ledger-Deck-${lab.replace('–', '-')}-for-tax-agent.xlsx` };
}
