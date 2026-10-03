/* Categories, automatic sorting rules and what each category means for tax and GST. */
import { state } from './store.js';

const C = i => `var(--s${i})`;
/* in: counts as income; skip: excluded from income and spending (transfers, card repayments). */
export const PCATS = {
  'Salary': { c: C(3), in: 1 }, 'Interest': { c: C(6), in: 1 }, 'Dividends': { c: C(4), in: 1 }, 'Other income': { c: C(7), in: 1 }, 'Refunds': { c: C(0), in: 1 },
  'Loan repayments': { c: C(1) }, 'Rent': { c: C(1) }, 'Groceries': { c: C(3) }, 'Dining out': { c: C(5) }, 'Transport': { c: C(2) },
  'Shopping': { c: C(7) }, 'Utilities': { c: C(4) }, 'Health': { c: C(6) }, 'Insurance': { c: C(8) }, 'Subscriptions': { c: C(8) },
  'Entertainment': { c: C(5) }, 'Travel': { c: C(2) }, 'Education': { c: C(7) }, 'Kids': { c: C(4) }, 'Pets': { c: C(6) },
  'Donations': { c: C(3) }, 'Work expenses': { c: C(1) }, 'Fees & interest': { c: C(8) }, 'Cash': { c: C(0) }, 'Tax': { c: C(0) },
  'Other': { c: C(0) }, 'Transfers': { c: C(0), skip: 1 },
};
/* gst: purchases in this category usually include GST that can be claimed as a credit. */
export const BCATS = {
  'Sales': { c: C(1), in: 1, gst: 1 }, 'Other income': { c: C(7), in: 1 }, 'Interest': { c: C(6), in: 1 },
  'Contractors': { c: C(1), gst: 1 }, 'Wages': { c: C(2) }, 'Super': { c: C(2) }, 'Rent': { c: C(3), gst: 1 }, 'Software': { c: C(4), gst: 1 },
  'Marketing': { c: C(5), gst: 1 }, 'Equipment': { c: C(7), gst: 1 }, 'Travel': { c: C(2), gst: 1 }, 'Vehicle': { c: C(6), gst: 1 },
  'Phone & internet': { c: C(4), gst: 1 }, 'Insurance': { c: C(8), gst: 1 }, 'Professional fees': { c: C(3), gst: 1 }, 'Supplies': { c: C(5), gst: 1 },
  'Bank fees': { c: C(0) }, 'Tax payments': { c: C(0), skip: 1 }, 'Owner drawings': { c: C(0), skip: 1 }, 'Transfers': { c: C(0), skip: 1 }, 'Other': { c: C(0), gst: 1 },
};
export const cats = book => book === 'B' ? BCATS : PCATS;
export const catColor = (book, cat) => cats(book)[cat]?.c || 'var(--s0)';
export const isIncome = (book, cat) => !!cats(book)[cat]?.in;
export const isSkip = (book, cat) => !!cats(book)[cat]?.skip;

/* ATO individual return deduction labels. */
export const DLABELS = {
  D1: 'Work-related car expenses', D2: 'Work-related travel expenses', D3: 'Work-related clothing, laundry and dry-cleaning',
  D4: 'Work-related self-education expenses', D5: 'Other work-related expenses', D7: 'Interest deductions', D8: 'Dividend deductions',
  D9: 'Gifts or donations', D10: 'Cost of managing tax affairs', D15: 'Other deductions (e.g. income protection)',
};

/* Keyword rules for common Australian merchants. Checked in order; first match wins. */
const P_RULES = [
  [/coles express|reddy express|eg fuel/i, 'Transport'],
  [/\b(salary|payroll|wages|pay from|pay\b.*ltd)/i, 'Salary'], [/\binterest (credit|paid|earned)|credit interest|bonus interest/i, 'Interest'],
  [/dividend|div\b|distribution/i, 'Dividends'], [/refund|reversal|cashback/i, 'Refunds'],
  [/home loan|mortgage|loan repayment/i, 'Loan repayments'], [/\brent\b|realestate|real estate|ray white|lj hooker|belle property/i, 'Rent'],
  [/\b(transfer|tfr|trf|xfer|osko to|payid to|internal|to savings|from savings)\b|credit card payment|card repayment|payment thank ?you|payment received|bpay.*(card|amex|visa|mastercard)/i, 'Transfers'],
  [/woolworths|coles|aldi|iga\b|harris farm|foodworks|costco|drakes|ritchies|spudshed|fruit|butcher|bakery/i, 'Groceries'],
  [/uber\W*eats|menulog|doordash|deliveroo|mcdonald|kfc|hungry jack|grill'?d|guzman|nando|domino|pizza|cafe|café|coffee|restaurant|sushi|bar\b|pub\b|hotel\b.*bar|thai|starbucks|subway|oporto|zambrero|mad mex/i, 'Dining out'],
  [/ampol|shell|caltex|bp\b|7-eleven|united petrol|metro petroleum|liberty|linkt|e-?toll|citylink|transurban|opal|myki|go card|translink|uber(?!\W*eats)|didi|ola\b|13cabs|parking|secure parking|wilson parking|car wash/i, 'Transport'],
  [/agl|origin|energyaustralia|red energy|alinta|simply energy|powershop|sydney water|yarra valley water|sa water|telstra|optus|vodafone|tpg|aussie broadband|iinet|belong|dodo|superloop|council rates|rates\b/i, 'Utilities'],
  [/chemist|pharmacy|priceline|medical|doctor|gp\b|dental|dentist|physio|pathology|hospital|optometr|specsavers|psycholog|medicare/i, 'Health'],
  [/insurance|nrma|racv|racq|aami|allianz|budget direct|youi|qbe|suncorp|bupa|medibank|hcf|nib\b|ahm\b|hbf/i, 'Insurance'],
  [/netflix|spotify|stan\b|disney|binge|kayo|foxtel|youtube premium|apple\.com\/bill|apple music|icloud|google storage|google one|amazon prime|audible|paramount|microsoft 365|adobe|dropbox|chatgpt|openai|anthropic|claude\.ai|patreon/i, 'Subscriptions'],
  [/gym|fitness|anytime fitness|f45|jetts|snap fitness|crossfit|yoga|pilates/i, 'Health'],
  [/cinema|hoyts|event cinemas|village|ticketek|ticketmaster|steam|playstation|xbox|nintendo|bunnings.*(gift)|tab\b|sportsbet|ladbrokes/i, 'Entertainment'],
  [/qantas|virgin australia|jetstar|rex\b|airbnb|booking\.com|expedia|hotel|motel|wotif|accor|hilton|marriott/i, 'Travel'],
  [/university|tafe|school|course|udemy|coursera/i, 'Education'], [/childcare|early learning|kindergarten/i, 'Kids'], [/vet\b|petbarn|petstock|pet\b/i, 'Pets'],
  [/red cross|unicef|salvation army|smith family|world vision|oxfam|charity|donation|foundation|msf|amnesty/i, 'Donations'],
  [/engineers australia|cpa australia|ca anz|union|membership.*(institute|association)|officeworks|professional dev/i, 'Work expenses'],
  [/\bato\b|australian taxation|tax office/i, 'Tax'],
  [/fee\b|fees\b|interest charged|purchase interest|overdrawn|dishonour|annual fee|international transaction/i, 'Fees & interest'],
  [/atm|cash withdrawal|wdl atm/i, 'Cash'],
  [/kmart|target|big w|jb hi-?fi|harvey norman|the good guys|bunnings|ikea|myer|david jones|amazon|ebay|temu|shein|rebel|uniqlo|cotton on|h&m|zara|officeworks|catch\.com/i, 'Shopping'],
];
const B_RULES = [
  [/\b(transfer|tfr|trf|xfer|internal)\b/i, 'Transfers'], [/\bato\b|australian taxation|tax office|bas payment|payg/i, 'Tax payments'],
  [/drawing|director loan|to personal/i, 'Owner drawings'], [/\bsuper\b|superannuation|clearing house|hostplus|australiansuper|rest super|aware super|unisuper/i, 'Super'],
  [/payroll|wages|salary/i, 'Wages'], [/contractor|freelance|consulting fee/i, 'Contractors'], [/stripe|square|paypal.*(transfer|payout)|shopify payout|tyro|invoice|inv-?\d|payment from|deposit from/i, 'Sales'],
  [/interest (credit|paid|earned)|credit interest/i, 'Interest'],
  [/xero|myob|quickbooks|adobe|figma|google workspace|gsuite|microsoft|atlassian|slack|zoom|canva|notion|github|aws|amazon web services|digitalocean|heroku|vercel|cloudflare|openai|anthropic|dropbox|shopify(?!.*payout)/i, 'Software'],
  [/meta ads|facebk|facebook|google ads|linkedin|tiktok ads|mailchimp|advertis/i, 'Marketing'],
  [/qantas|virgin australia|jetstar|airbnb|booking\.com|hotel|motel|uber(?!\W*eats)|taxi|13cabs/i, 'Travel'],
  [/ampol|shell|caltex|bp\b|7-eleven|linkt|e-?toll|parking|rego|service nsw.*rego/i, 'Vehicle'],
  [/telstra|optus|vodafone|tpg|aussie broadband|iinet/i, 'Phone & internet'], [/insurance|qbe|allianz|aami|biz cover|bizcover/i, 'Insurance'],
  [/accountant|accounting|legal|lawyer|solicitor|bookkeep/i, 'Professional fees'], [/\brent\b|lease|regus|wework|hub australia/i, 'Rent'],
  [/officeworks|jb hi-?fi|apple store|harvey norman|dell|lenovo/i, 'Equipment'], [/bunnings|supplies|stationery|post office|auspost|australia post/i, 'Supplies'],
  [/fee\b|fees\b|merchant fee|account fee/i, 'Bank fees'],
];

export const norm = s => String(s || '').toLowerCase().replace(/\d{4,}/g, ' ').replace(/[^a-z&' ]+/g, ' ').replace(/\b(card|visa|eftpos|purchase|debit|aus|au|nsw|vic|qld|wa|sa|tas|act|nt|pty|ltd|value date|xx+)\b/g, ' ').replace(/\s+/g, ' ').trim();
export const merchantKey = s => norm(s).split(' ').slice(0, 3).join(' ');

/* Learned rules first (what the person corrected), then keyword rules, then a sign-based fallback. */
export function categorise(desc, amount, book) {
  const key = merchantKey(desc);
  const learned = state.rules.find(r => r.book === book && key && (key === r.match || key.startsWith(r.match)));
  if (learned) return learned.cat;
  for (const [re, cat] of (book === 'B' ? B_RULES : P_RULES)) {
    if (!re.test(desc)) continue;
    const income = isIncome(book, cat);
    if (income && amount < 0 && cat !== 'Refunds') continue; // "payroll" on a debit is not income
    if (!income && amount > 0 && !isSkip(book, cat) && cat !== 'Sales') continue;
    return cat;
  }
  if (amount > 0) return book === 'B' ? 'Sales' : 'Other income';
  return 'Other';
}

export function learn(desc, cat, book) {
  const match = merchantKey(desc); if (!match) return 0;
  state.rules = state.rules.filter(r => !(r.book === book && r.match === match));
  state.rules.push({ match, cat, book });
  let n = 0;
  for (const t of state.tx) if (t.book === book && merchantKey(t.desc) === match && t.cat !== cat) { t.cat = cat; n++; }
  return n;
}

/* A first guess at deductions from a personal transaction (the person always confirms). */
export function guessDeduction(t) {
  if (t.book !== 'P' || t.amount >= 0) return null;
  if (t.cat === 'Donations') return 'D9';
  if (t.cat === 'Work expenses') return 'D5';
  if (/tax agent|accountant|h&r block|etax|tax return/i.test(t.desc)) return 'D10';
  if (/income protection/i.test(t.desc)) return 'D15';
  if (/university|tafe|course/i.test(t.desc) && t.cat === 'Education') return 'D4';
  return null;
}
