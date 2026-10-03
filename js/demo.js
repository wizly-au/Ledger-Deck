/* Made-up sample records so people can try every screen before adding their own. */
import { uid, iso, todayIso, addDays, round2 } from './util.js';
import { categorise } from './categories.js';

export function sampleState(base) {
  let seed = 7; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const s = base; s.demo = true;
  Object.assign(s.settings, { done: true, track: { P: true, B: true }, bizName: 'Northline Studio Pty Ltd', entity: 'company', gst: 'yes', bas: 'Quarterly', gstBasis: 'cash', phi: 'yes' });
  const A = (book, name, type, balance, extra = {}) => { const a = { id: uid(), book, name, type, balance, balanceDate: todayIso(), inst: '', history: [], ...extra }; s.accounts.push(a); return a; };
  const every = A('P', 'Everyday account', 'bank', 0), save = A('P', 'High-interest savings', 'savings', 0), card = A('P', 'Credit card', 'card', 0, { rate: 20.99 });
  const sup = A('P', 'Super (balanced)', 'super', 142300, { history: [] }), etf = A('P', 'ETF portfolio', 'shares', 56900), home = A('P', 'Home (estimate)', 'property', 820000);
  const loan = A('P', 'Home loan', 'mortgage', 512400, { rate: 6.09, repay: 3150 }), car = A('P', 'Car loan', 'loan', 14600, { rate: 7.4, repay: 432 });
  const biz = A('B', 'Business account', 'bank', 0), bizSave = A('B', 'Tax savings', 'savings', 7000);
  const end = todayIso(), start = addDays(end, -395), tx = [];
  const T = (acct, date, desc, amount) => { if (date > end) return; tx.push({ id: uid(), acct: acct.id, book: acct.book, date, desc, amount: round2(amount), cat: categorise(desc, amount, acct.book) }); };
  const d0 = new Date(start); d0.setDate(1);
  for (let m = 0; m < 14; m++) {
    const y = d0.getFullYear(), mo = d0.getMonth() + m, D = n => iso(new Date(y, mo, n)), dim = new Date(y, mo + 1, 0).getDate();
    if (D(1) < start) continue;
    const dec = new Date(y, mo, 1).getMonth() === 11;
    T(every, D(15), 'SALARY NORTHLINE CLIENT PAY', 4900); T(every, D(Math.min(dim, 28)), 'SALARY NORTHLINE CLIENT PAY', 4900);
    T(every, D(3), 'HOME LOAN REPAYMENT', -3150); T(every, D(5), 'TRANSFER TO SAVINGS', -800); T(save, D(5), 'TRANSFER FROM EVERYDAY', 800);
    T(save, D(Math.min(dim, 30)), 'BONUS INTEREST CREDIT', round2(120 + m * 4));
    T(every, D(8), 'CAR LOAN REPAYMENT', -432);
    T(every, D(9), 'AGL ELECTRICITY BPAY', -(140 + rnd() * 90)); T(every, D(21), 'TELSTRA PHONE & INTERNET', -119);
    T(card, D(2), 'NETFLIX.COM', -18.99); T(card, D(6), 'SPOTIFY AU', -13.99); T(card, D(11), 'ANYTIME FITNESS', -69); T(card, D(17), 'ICLOUD STORAGE APPLE.COM/BILL', -4.49);
    T(card, D(14), 'BUPA HEALTH INSURANCE', -220);
    for (let i = 0; i < 9; i++) T(card, D(1 + Math.floor(rnd() * dim)), pick(['WOOLWORTHS 1234 SYDNEY', 'COLES 0456 ROZELLE', 'ALDI STORES', 'HARRIS FARM MARKETS']), -(45 + rnd() * 110));
    for (let i = 0; i < (dec ? 9 : 5); i++) T(card, D(1 + Math.floor(rnd() * dim)), pick(["GRILL'D LEICHHARDT", 'UBER *EATS', 'GUZMAN Y GOMEZ', 'THAI RIFFIC NEWTOWN', 'CORNER CAFE BALMAIN']), -(18 + rnd() * 70));
    for (let i = 0; i < 4; i++) T(card, D(1 + Math.floor(rnd() * dim)), pick(['AMPOL ROZELLE', 'SHELL COLES EXPRESS', 'LINKT SYDNEY TOLL', 'OPAL TOP UP']), -(30 + rnd() * 60));
    for (let i = 0; i < (dec ? 6 : 2); i++) T(card, D(1 + Math.floor(rnd() * dim)), pick(['KMART AUSTRALIA', 'JB HI-FI', 'BUNNINGS WAREHOUSE', 'AMAZON MARKETPLACE AU', 'REBEL SPORT']), -(25 + rnd() * 180));
    if (rnd() > .5) T(card, D(1 + Math.floor(rnd() * dim)), pick(['CHEMIST WAREHOUSE', 'PHYSIO PLUS BALMAIN', 'PRICELINE PHARMACY']), -(20 + rnd() * 60));
    if (m % 3 === 0) T(card, D(12), 'RED CROSS DONATION', -40);
    T(card, D(25), 'PAYMENT THANK YOU', 0); // placeholder, replaced below
    // business: clients pay invoices, costs go out
    const clients = ['Harbour & Co', 'Kestrel Logistics', 'Brightside Dental', 'Westpoint Physio', 'Tandem Cafe Group'];
    for (let i = 0; i < 4; i++) T(biz, D(4 + i * 6), `PAYMENT FROM ${pick(clients).toUpperCase()} INV`, Math.round(4000 + rnd() * 5000));
    T(biz, D(7), 'J LEE DESIGN CONTRACTOR', -(2400 + Math.round(rnd() * 600))); T(biz, D(21), 'J LEE DESIGN CONTRACTOR', -(2400 + Math.round(rnd() * 600)));
    T(biz, D(1), 'HUB AUSTRALIA RENT', -1650); T(biz, D(5), 'ADOBE CREATIVE CLOUD', -104.99); T(biz, D(5), 'XERO AUSTRALIA', -85); T(biz, D(6), 'GOOGLE WORKSPACE', -46.8); T(biz, D(9), 'FIGMA', -75);
    T(biz, D(13), pick(['META ADS', 'GOOGLE ADS', 'LINKEDIN ADS']), -(200 + rnd() * 400)); T(biz, D(18), 'TELSTRA BUSINESS', -95);
    if (rnd() > .6) T(biz, D(16), pick(['QANTAS AIRWAYS', 'OFFICEWORKS', 'UBER TRIP']), -(80 + rnd() * 500));
    T(biz, D(28), 'COMMBANK ACCOUNT FEE', -10); T(biz, D(14), 'PAYROLL WAGES DIRECTOR', -4900); T(biz, D(Math.min(dim, 28)), 'PAYROLL WAGES DIRECTOR', -4900); T(biz, D(20), 'SUPER CLEARING HOUSE', -1176);
    T(biz, D(27), 'TRANSFER TO TAX SAVINGS', -1500); T(bizSave, D(27), 'TRANSFER FROM BUSINESS', 1500);
    if ([1, 4, 7, 10].includes(new Date(y, mo, 1).getMonth() + 1)) { T(biz, D(26), 'ATO BAS PAYMENT', -5200); T(bizSave, D(26), 'TRANSFER TO BUSINESS', -5200); T(biz, D(26), 'TRANSFER FROM TAX SAVINGS', 5200); }
  }
  // card is paid off from the everyday account each month
  const byMonth = {}; tx.filter(t => t.acct === card.id && t.amount < 0).forEach(t => byMonth[t.date.slice(0, 7)] = (byMonth[t.date.slice(0, 7)] || 0) - t.amount);
  for (let i = tx.length - 1; i >= 0; i--) if (tx[i].acct === card.id && tx[i].amount === 0) tx.splice(i, 1);
  for (const [mk, v] of Object.entries(byMonth)) { const d = mk + '-25'; if (d <= end) { T(card, d, 'PAYMENT THANK YOU', v - 0); T(every, d, 'CREDIT CARD PAYMENT', -v); } }
  s.tx = tx.sort((a, b) => a.date < b.date ? 1 : -1);
  // closing balances follow from the flows, starting from sensible opening amounts
  const opening = { [every.id]: 3800, [save.id]: 26000, [card.id]: -1900, [biz.id]: 38200, [bizSave.id]: 7000 };
  for (const a of [every, save, card, biz, bizSave]) { const v = round2((opening[a.id] || 0) + tx.filter(t => t.acct === a.id).reduce((x, t) => x + t.amount, 0)); a.balance = a.type === 'card' ? Math.max(-v, 0) : v; }
  const hist = (end0, step) => Array.from({ length: 13 }, (_, i) => [addDays(todayIso(), -30 * (12 - i)), Math.round(end0 - step * (12 - i))]);
  sup.history = hist(142300, 1500); etf.history = hist(56900, 550); loan.history = hist(512400, 950); car.history = hist(14600, 410); home.history = hist(820000, 2200);
  s.budgets = { 'Groceries': 1100, 'Dining out': 450, 'Shopping': 400, 'Transport': 450 };
  s.goals = [{ id: uid(), name: 'Emergency fund', target: 45000, saved: 0, acct: save.id, by: addDays(todayIso(), 270), monthly: 800 }, { id: uid(), name: 'Japan trip', target: 8000, saved: 4200, by: addDays(todayIso(), 190), monthly: 500 }];
  const inv = (n, c, a, iss, due, paid) => s.invoices.push({ id: uid(), num: 'INV-' + n, client: c, amount: a, issued: addDays(todayIso(), iss), due: addDays(todayIso(), due), paid: paid == null ? '' : addDays(todayIso(), paid) });
  inv(1042, 'Harbour & Co', 8800, -53, -25); inv(1047, 'Brightside Dental', 3300, -35, -7); inv(1051, 'Kestrel Logistics', 6150, -18, 10); inv(1053, 'Tandem Cafe Group', 2420, -9, 18); inv(1044, 'Kestrel Logistics', 6150, -60, -32, -30); inv(1045, 'Westpoint Physio', 4180, -55, -27, -26);
  s.settings.paygInst = 4200; s.settings.taxAside = bizSave.balance;
  s.imports.push({ id: uid(), name: 'Sample data', date: todayIso(), rows: s.tx.length, acct: '' });
  return s;
}
