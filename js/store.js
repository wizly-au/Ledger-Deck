/* Everything lives in this browser's IndexedDB. With a passcode set, the whole record is encrypted
   with AES-GCM using a key derived from the passcode (PBKDF2, SHA-256). Nothing is ever sent anywhere. */

export const DEFAULT_STATE = () => ({
  v: 1,
  demo: false,
  settings: {
    done: false, track: { P: true, B: false }, resident: 'yes', agent: 'yes',
    bizName: '', abn: '', entity: 'sole', gst: 'yes', gstBasis: 'cash', bas: 'Quarterly', paygInst: 0, taxAside: 0,
    phi: 'yes', help: 'no',
    ai: { provider: '', model: '', key: '', base: '', ok: false, shareFigures: true },
    voice: '', rate: 1, theme: '',
  },
  accounts: [],      // {id, book:'P'|'B', name, type, inst, balance, balanceDate, rate, repay, note, history:[[date,bal]]}
  tx: [],            // {id, acct, book, date, desc, amount, cat, ded, dedSt, gst, note, hash}
  rules: [],         // {match, cat, book}
  budgets: {},       // {cat: monthly limit}
  goals: [],         // {id, name, target, saved, by, monthly}
  invoices: [],      // {id, num, client, amount, issued, due, paid}
  tax: {},           // per FY: {salary, withheld, divs, frank, other, cgt:[], extraDed:[], notes:[]}
  imports: [],       // {id, name, date, rows, acct}
  stratList: [],
  cancelList: [],
});

const DB = 'ledger-deck', ST = 'kv';
let db = null, key = null, salt = null;
export let state = DEFAULT_STATE();

function idb() {
  if (db) return Promise.resolve(db);
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => { db = r.result; res(db); };
    r.onerror = () => rej(r.error);
  });
}
const get = async k => { const d = await idb(); return new Promise((res, rej) => { const q = d.transaction(ST).objectStore(ST).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); };
const put = async (k, v) => { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction(ST, 'readwrite'); t.objectStore(ST).put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); };
const del = async k => { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction(ST, 'readwrite'); t.objectStore(ST).delete(k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); };

const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function derive(pass, saltBytes) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: saltBytes, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(obj, k, s) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(JSON.stringify(obj)));
  return { enc: true, salt: b64(s), iv: b64(iv), ct: b64(ct) };
}
async function open(rec, pass) {
  const s = unb64(rec.salt), k = await derive(pass, s);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv) }, k, unb64(rec.ct)); // throws on a wrong passcode
  return { obj: JSON.parse(dec.decode(pt)), k, s };
}
const merge = o => { const d = DEFAULT_STATE(); return { ...d, ...o, settings: { ...d.settings, ...(o.settings || {}), ai: { ...d.settings.ai, ...(o.settings?.ai || {}) }, track: { ...d.settings.track, ...(o.settings?.track || {}) } } }; };

/* Returns 'new', 'open' or 'locked'. */
export async function load() {
  let rec = null;
  try { rec = await get('data'); } catch (e) { console.warn('Storage unavailable', e); }
  if (!rec) return 'new';
  if (rec.enc) return 'locked';
  state = merge(rec.data); return 'open';
}
export async function unlock(pass) {
  const rec = await get('data'); const { obj, k, s } = await open(rec, pass);
  key = k; salt = s; state = merge(obj); return true;
}
export const hasPasscode = () => !!key;

let timer = null, pending = null;
export function save() {
  clearTimeout(timer);
  pending = new Promise(res => { timer = setTimeout(async () => { await saveNow(); res(); }, 250); });
  return pending;
}
export async function saveNow() {
  clearTimeout(timer);
  try { await put('data', key ? await seal(state, key, salt) : { enc: false, data: state }); }
  catch (e) { console.error(e); import('./util.js').then(u => u.toast('Couldn’t save to this browser’s storage. Check it isn’t in private mode.')); }
}
export async function setPasscode(pass) {
  if (pass) { salt = crypto.getRandomValues(new Uint8Array(16)); key = await derive(pass, salt); }
  else { key = null; salt = null; }
  await saveNow();
}
export function replaceState(next) { state = merge(next); return saveNow(); }
export async function wipe() { key = null; salt = null; state = DEFAULT_STATE(); await del('data'); }

/* Backups are always encrypted with a password the person chooses. */
export async function backupBlob(password) {
  const s = crypto.getRandomValues(new Uint8Array(16)), k = await derive(password, s);
  const sealed = await seal(state, k, s);
  return new Blob([JSON.stringify({ app: 'ledger-deck', kind: 'backup', v: 1, created: new Date().toISOString(), ...sealed })], { type: 'application/json' });
}
export async function readBackup(text, password) {
  let rec; try { rec = JSON.parse(text); } catch { throw new Error('That file isn’t a Ledger Deck backup.'); }
  if (rec.app !== 'ledger-deck' || !rec.ct) throw new Error('That file isn’t a Ledger Deck backup.');
  try { return (await open(rec, password)).obj; } catch { throw new Error('Wrong password, or the file is damaged.'); }
}

/* Ask the browser not to clear our storage when space is low. */
export async function persist() { try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch { } }
