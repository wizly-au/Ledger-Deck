/* Small shared helpers: money and date formatting, escaping, ids and toasts. */
export const sum = a => a.reduce((x, y) => x + y, 0);
export const round2 = n => Math.round(n * 100) / 100;

export const fmt = (n, dp = 0) => (n < 0 ? '−' : '') + '$' + Math.abs(n || 0).toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const k = n => {
  const a = Math.abs(n || 0), s = n < 0 ? '−' : '';
  return s + '$' + (a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'k' : Math.round(a));
};
export const pct = (a, b) => b ? Math.round((a / b - 1) * 100) : 0;

/* Escape anything that came from a file, a user or an AI before it goes into innerHTML. */
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const N = (v, cls = '') => `<span class="num ${cls}">${v}</span>`;
export const T = h => `data-tip="${String(h).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

/* Dates are kept as local YYYY-MM-DD strings. */
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const todayIso = () => iso(today());
export const days = s => Math.round((parseIso(s) - today()) / 864e5);
export const addDays = (s, n) => { const d = parseIso(s); d.setDate(d.getDate() + n); return iso(d); };
export const dshort = s => parseIso(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
export const dlong = s => parseIso(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
export const monthKey = s => s.slice(0, 7);
export const monthLabel = key => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-AU', { month: 'short' }); };
export const monthLong = key => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }); };
/* The last n month keys ending with the month of `end` (default this month). */
export function lastMonths(n, end = todayIso()) {
  const [y, m] = end.split('-').map(Number), out = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(y, m - 1 - i, 1); out.push(iso(d).slice(0, 7)); }
  return out;
}

/* Australian financial year: 1 July to 30 June. fyOf('2026-10-03') -> 2027 (FY2026-27). */
export const fyOf = s => { const [y, m] = s.split('-').map(Number); return m >= 7 ? y + 1 : y; };
export const fyStart = fy => `${fy - 1}-07-01`;
export const fyEnd = fy => `${fy}-06-30`;
export const fyLabel = fy => `${fy - 1}–${String(fy).slice(2)}`;

export function toast(m) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = m;
  document.body.append(t); setTimeout(() => t.remove(), 3200);
}

/* Minimal markdown for AI answers: bold, bullets, paragraphs. Input is escaped first. */
export function md(t) {
  const lines = esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split('\n'); let h = '', ul = false;
  for (const l of lines) {
    const m = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
    if (m) { if (!ul) { h += '<ul>'; ul = true; } h += `<li>${m[1]}</li>`; }
    else { if (ul) { h += '</ul>'; ul = false; } if (l.trim()) h += `<p>${l.replace(/^#+\s*/, '')}</p>`; }
  }
  return h + (ul ? '</ul>' : '');
}

export const $ = id => document.getElementById(id);
export const debounce = (f, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };

export function download(name, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
