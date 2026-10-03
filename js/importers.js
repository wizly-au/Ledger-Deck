/* File importers: CSV (any Australian bank layout we can recognise), OFX, QIF and PDF statements.
   All parsing happens in the browser. Nothing is uploaded. */
import { iso } from './util.js';

const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
const fullYear = y => (y < 100 ? 2000 + y : y);

/* Parse one date string. order is 'dmy' (Australian default) or 'mdy'. Returns YYYY-MM-DD or null. */
export function parseDate(s, order = 'dmy') {
  s = String(s || '').trim().replace(/^"|"$/g, ''); if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return mk(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{8})/); // OFX style 20261003
  if (m) return mk(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) { const a = +m[1], b = +m[2], y = fullYear(+m[3]); return order === 'mdy' ? mk(y, a - 1, b) : mk(y, b - 1, a); }
  m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3,4})[a-z]*[\s-,]+(\d{2,4})/);
  if (m && MON[m[2].toLowerCase()] != null) return mk(fullYear(+m[3]), MON[m[2].toLowerCase()], +m[1]);
  m = s.match(/^([A-Za-z]{3,4})[a-z]*\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MON[m[1].toLowerCase()] != null) return mk(+m[3], MON[m[1].toLowerCase()], +m[2]);
  return null;
}
function mk(y, mo, d) { if (mo < 0 || mo > 11 || d < 1 || d > 31 || y < 1990 || y > 2100) return null; const dt = new Date(y, mo, d); return dt.getMonth() === mo ? iso(dt) : null; }

/* "$1,234.56", "-12.50", "(12.50)", "12.50 DR", "12.50CR" -> number, or null if it isn't money. */
export function parseMoney(s) {
  s = String(s ?? '').trim().replace(/^"|"$/g, ''); if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/\bDR$/i.test(s)) { neg = true; s = s.replace(/\s*DR$/i, ''); } else s = s.replace(/\s*CR$/i, '');
  s = s.replace(/[$,\s]|AUD/gi, '');
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); } else if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const v = parseFloat(s); return neg ? -v : v;
}

export function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  const delim = (() => { const line = text.split(/\r?\n/).find(l => l.trim()) || ''; const c = { ',': 0, ';': 0, '\t': 0 }; for (const ch of line) if (ch in c) c[ch]++; return Object.entries(c).sort((a, b) => b[1] - a[1])[0][1] ? Object.entries(c).sort((a, b) => b[1] - a[1])[0][0] : ','; })();
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some(c => c.trim())) rows.push(row.map(c => c.trim())); row = []; }
    else f += ch;
  }
  row.push(f); if (row.some(c => c.trim())) rows.push(row.map(c => c.trim()));
  return rows;
}

const HEAD = {
  date: /^(transaction |posted |value |effective )?date|^date posted|^trans(action)? date|^posting date/i,
  desc: /description|details|narrative|transaction details|merchant|payee|memo|particulars|reference|original description/i,
  amount: /^(transaction )?amount|^value$|^amount \(aud\)|^net amount/i,
  debit: /debit|withdrawal|money out|paid out|spent/i,
  credit: /credit|deposit|money in|paid in|received/i,
  balance: /balance/i,
};

/* Work out which column is which. Returns {header, map:{date,desc,amount,debit,credit,balance}, order}. */
export function detect(rows) {
  const first = rows[0] || [], sample = rows.slice(0, 40);
  const isHeader = first.length > 1 && !first.some(c => parseDate(c)) && first.filter(c => /[a-z]/i.test(c)).length >= 2 && !first.some(c => parseMoney(c) != null && /\d/.test(c));
  const map = { date: -1, desc: -1, amount: -1, debit: -1, credit: -1, balance: -1 };
  if (isHeader) {
    first.forEach((h, i) => {
      const H = h.trim();
      if (map.date < 0 && HEAD.date.test(H)) map.date = i;
      else if (map.balance < 0 && HEAD.balance.test(H)) map.balance = i;
      else if (map.debit < 0 && HEAD.debit.test(H) && !/card/i.test(H)) map.debit = i;
      else if (map.credit < 0 && HEAD.credit.test(H) && !/card/i.test(H)) map.credit = i;
      else if (map.amount < 0 && HEAD.amount.test(H)) map.amount = i;
    });
    // description: prefer the most specific header match that isn't already used
    const used = new Set(Object.values(map));
    const descCands = first.map((h, i) => [h, i]).filter(([h, i]) => !used.has(i) && HEAD.desc.test(h));
    const pref = descCands.find(([h]) => /transaction details|narrative|description|details/i.test(h) && !/original/i.test(h)) || descCands[0];
    if (pref) map.desc = pref[1];
  }
  const body = isHeader ? sample.slice(1) : sample, cols = Math.max(...body.map(r => r.length), 0);
  const share = (i, f) => body.filter(r => f(r[i])).length / Math.max(body.length, 1);
  if (map.date < 0) for (let i = 0; i < cols; i++) if (share(i, parseDate) > .8) { map.date = i; break; }
  if (map.amount < 0 && map.debit < 0) {
    const nums = []; for (let i = 0; i < cols; i++) if (i !== map.date && i !== map.balance && share(i, c => parseMoney(c) != null) > .8) nums.push(i);
    if (nums.length === 1) map.amount = nums[0];
    else if (nums.length >= 2) {
      // a running balance changes by the amount each row: test which pair fits
      const fits = (a, b) => { let ok = 0, n = 0; for (let r = 1; r < body.length; r++) { const p = parseMoney(body[r - 1][b]), c = parseMoney(body[r][b]), am = parseMoney(body[r][a]), amp = parseMoney(body[r - 1][a]); if ([p, c, am].some(x => x == null)) continue; n++; if (Math.abs(c + amp - p) < .02 || Math.abs(p + am - c) < .02) ok++; } return n ? ok / n : 0; };
      if (map.balance >= 0) map.amount = nums.find(i => i !== map.balance);
      else if (fits(nums[0], nums[1]) >= fits(nums[1], nums[0])) { map.amount = nums[0]; map.balance = nums[1]; }
      else { map.amount = nums[1]; map.balance = nums[0]; }
    }
  }
  if (map.desc < 0) {
    let best = -1, bl = 0;
    for (let i = 0; i < cols; i++) { if (Object.values(map).includes(i)) continue; const l = body.reduce((s, r) => s + (/[a-z]/i.test(r[i] || '') ? (r[i] || '').length : 0), 0); if (l > bl) { bl = l; best = i; } }
    map.desc = best;
  }
  // date order: if any first part is over 12 it's day-first; if any second part is, month-first
  let order = 'dmy';
  if (map.date >= 0) { const parts = body.map(r => String(r[map.date] || '').match(/^(\d{1,2})[-/.](\d{1,2})[-/.]/)).filter(Boolean); if (!parts.some(p => +p[1] > 12) && parts.some(p => +p[2] > 12)) order = 'mdy'; }
  return { header: isHeader ? first : null, map, order };
}

export function rowsFromCSV(rows, det) {
  const { map, order } = det, out = [];
  const body = det.header ? rows.slice(1) : rows;
  for (const r of body) {
    const date = parseDate(r[map.date], order); if (!date) continue;
    let amount = null;
    if (map.amount >= 0) amount = parseMoney(r[map.amount]);
    if (amount == null && (map.debit >= 0 || map.credit >= 0)) {
      const d = parseMoney(r[map.debit]), c = parseMoney(r[map.credit]);
      if (d) amount = -Math.abs(d); else if (c) amount = Math.abs(c); else if (d === 0 || c === 0) amount = 0;
    }
    if (amount == null || amount === 0) continue;
    const desc = (map.desc >= 0 ? r[map.desc] : '') || 'Transaction';
    const bal = map.balance >= 0 ? parseMoney(r[map.balance]) : null;
    out.push({ date, desc: desc.replace(/\s+/g, ' ').trim(), amount: Math.round(amount * 100) / 100, balance: bal });
  }
  return out;
}

export function parseOFX(text) {
  const tag = (blk, t) => (blk.match(new RegExp(`<${t}>([^<\\r\\n]*)`, 'i')) || [])[1]?.trim();
  const rows = [];
  for (const blk of text.split(/<STMTTRN>/i).slice(1)) {
    const date = parseDate(tag(blk, 'DTPOSTED')), amount = parseMoney(tag(blk, 'TRNAMT'));
    const desc = [tag(blk, 'NAME'), tag(blk, 'MEMO')].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · ');
    if (date && amount) rows.push({ date, desc: desc || 'Transaction', amount, balance: null, fitid: tag(blk, 'FITID') });
  }
  const lb = text.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]*)[\s\S]*?<DTASOF>([^<\r\n]*)/i);
  return { rows, balance: lb ? { amount: parseMoney(lb[1]), date: parseDate(lb[2]) } : null };
}

export function parseQIF(text) {
  const rows = []; let cur = {};
  for (const line of text.split(/\r?\n/)) {
    const c = line[0], v = line.slice(1).trim();
    if (c === 'D') cur.date = parseDate(v.replace(/'/g, '/'));
    else if (c === 'T' || c === 'U') cur.amount = parseMoney(v);
    else if (c === 'P') cur.desc = v; else if (c === 'M') cur.memo = v;
    else if (c === '^') { if (cur.date && cur.amount) rows.push({ date: cur.date, desc: cur.desc || cur.memo || 'Transaction', amount: cur.amount, balance: null }); cur = {}; }
  }
  return rows;
}

/* PDF statements (super, shares, myGov): pull the text and look for balances and dates the person can confirm. */
let pdfjs = null;
export async function pdfText(file) {
  if (!pdfjs) { pdfjs = await import('../vendor/pdf.min.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href; }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  let text = '';
  for (let p = 1; p <= Math.min(doc.numPages, 12); p++) { const pg = await doc.getPage(p); const c = await pg.getTextContent(); text += c.items.map(i => i.str + (i.hasEOL ? '\n' : ' ')).join('') + '\n'; }
  return text.replace(/[ \t]+/g, ' ');
}
export function findBalances(text) {
  const out = [], seen = new Set();
  const re = /((?:closing|ending|current|total|account|your|withdrawal|net)\s+(?:account\s+)?(?:balance|value)(?:\s+(?:as at|at|on)\s+[\w\s/,]{3,20}?)?|balance\s+(?:as at|at)\s+[\w\s/,]{3,20}?|total\s+(?:portfolio|holdings?|market)\s+value|gross\s+(?:payments|income)|total\s+tax\s+withheld|tax\s+withheld)[\s:]*\$?\s*([\d,]+\.\d{2})/gi;
  let m; while ((m = re.exec(text))) { const v = parseMoney(m[2]); const lab = m[1].replace(/\s+/g, ' ').trim(); const k = lab.toLowerCase() + v; if (v != null && !seen.has(k)) { seen.add(k); out.push({ label: lab[0].toUpperCase() + lab.slice(1), amount: v }); } }
  return out.slice(0, 8);
}

/* One entry point: returns {kind, rows, det?, csv?, balance?, text?}. */
export async function readFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf' || file.type === 'application/pdf') { const text = await pdfText(file); return { kind: 'pdf', text, found: findBalances(text) }; }
  const text = await file.text();
  if (ext === 'ofx' || ext === 'qfx' || /<OFX>/i.test(text)) { const o = parseOFX(text); return { kind: 'ofx', rows: o.rows, balance: o.balance }; }
  if (ext === 'qif' || /^!Type:/m.test(text)) return { kind: 'qif', rows: parseQIF(text) };
  const csv = parseCSV(text), det = detect(csv);
  return { kind: 'csv', csv, det, rows: rowsFromCSV(csv, det) };
}
