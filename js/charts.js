/* Chart kit: small inline-SVG charts and sortable tables. Every label that could come from user data is escaped here. */
import { fmt, k, sum, esc, T } from './util.js';

const rid = p => p + Math.random().toString(36).slice(2, 8);
const grid = (pad, w, y, lo, hi, fmtY) => { let g = ''; for (let i = 0; i < 4; i++) { const v = lo + (hi - lo) * i / 3; g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" ${i ? 'stroke-dasharray="3 5"' : ''}/><text x="${pad.l - 10}" y="${y(v) + 4}" text-anchor="end">${fmtY(v)}</text>`; } return g; };

export function lineChart(series, labels, { h = 240, w = 680, fmtY = k, fill = true, every = 1, zero = false } = {}) {
  const pad = { l: 58, r: 18, t: 16, b: 30 }, iw = w - pad.l - pad.r, ih = h - pad.t - pad.b, n = labels.length;
  const all = series.flatMap(s => s.vals.filter(v => v != null)); if (!all.length || !n) return emptyChart(h);
  let mn = Math.min(...all), mx = Math.max(...all); if (mn === mx) { mn -= 1; mx += 1; }
  const lo = zero ? Math.min(0, mn) : mn - (mx - mn) * .15, hi = mx + (mx - mn) * .12;
  const x = i => pad.l + (n === 1 ? iw / 2 : i * iw / (n - 1)), y = v => pad.t + ih - (v - lo) / (hi - lo) * ih;
  const xl = labels.map((l, i) => i % every === 0 || i === n - 1 ? `<text x="${x(i)}" y="${h - 8}" text-anchor="middle">${esc(l)}</text>` : '').join('');
  let defs = '', body = '';
  series.forEach((s, si) => {
    const pts = s.vals.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean); if (!pts.length) return;
    const str = pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    if (fill && si === 0) { const id = rid('lg'); defs += `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".35"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`; body += `<polygon fill="url(#${id})" points="${pts[0][0]},${pad.t + ih} ${str} ${pts.at(-1)[0]},${pad.t + ih}"/>`; }
    body += `<polyline fill="none" stroke="${s.color}" stroke-width="${s.width || 2}" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? 'stroke-dasharray="7 7"' : ''} points="${str}"/>`;
    if (!s.dash && si === 0) { const lp = pts.at(-1); body += `<circle cx="${lp[0]}" cy="${lp[1]}" r="4" fill="${s.color}"/>`; }
  });
  const cw = n > 1 ? iw / (n - 1) : iw; let cols = '';
  labels.forEach((l, i) => {
    const tip = `<b>${esc(l)}</b><br>` + series.filter(s => s.vals[i] != null).map(s => `<i style='background:${s.color}'></i>${esc(s.name)}: ${(s.fmt || fmt)(s.vals[i])}`).join('<br>');
    cols += `<g class="col" ${T(tip)}><rect class="hit" x="${x(i) - cw / 2}" y="${pad.t}" width="${cw}" height="${ih}"/><line class="guide" x1="${x(i)}" x2="${x(i)}" y1="${pad.t}" y2="${pad.t + ih}" stroke="var(--line-strong)" stroke-dasharray="3 3"/>${series.map(s => s.vals[i] == null ? '' : `<circle class="pt" cx="${x(i)}" cy="${y(s.vals[i])}" r="5" fill="var(--panel)" stroke="${s.color}" stroke-width="2.4"/>`).join('')}</g>`;
  });
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img"><defs>${defs}</defs>${grid(pad, w, y, lo, hi, fmtY)}${body}${xl}${cols}</svg>`;
}

export function groupBars(sets, labels, { h = 240, w = 680, line = null, hl = -1, fmtY = k } = {}) {
  const pad = { l: 58, r: 14, t: 14, b: 30 }, iw = w - pad.l - pad.r, ih = h - pad.t - pad.b, n = labels.length; if (!n) return emptyChart(h);
  const vals = [...sets.flatMap(s => s.vals), ...(line ? line.vals : [])];
  const mx = Math.max(1, ...vals) * 1.1, mn = Math.min(0, ...vals) * 1.1;
  const y = v => pad.t + ih - (v - mn) / (mx - mn) * ih, bw = iw / n, ww = bw * .64 / sets.length;
  let s = grid(pad, w, y, mn, mx, fmtY);
  labels.forEach((l, i) => {
    const x0 = pad.l + i * bw + bw * .18, op = hl < 0 || i >= hl ? 1 : .5;
    const tip = `<b>${esc(l)}</b><br>` + sets.map(st => `<i style='background:${st.color}'></i>${esc(st.name)}: ${fmt(st.vals[i])}`).join('<br>') + (line ? `<br><i style='background:${line.color}'></i>${esc(line.name)}: ${(line.fmt || fmt)(line.vals[i])}` : '');
    s += `<g class="col" ${T(tip)}><rect class="hit" x="${pad.l + i * bw}" y="${pad.t}" width="${bw}" height="${ih}"/>`;
    sets.forEach((st, j) => { const v = st.vals[i] || 0; s += `<rect class="bar" x="${x0 + j * ww}" y="${y(Math.max(v, 0))}" width="${Math.max(ww - 2, 1)}" height="${Math.abs(y(v) - y(0))}" rx="4" fill="${st.color}" opacity="${op}"/>`; });
    s += `<text x="${pad.l + i * bw + bw / 2}" y="${h - 8}" text-anchor="middle">${esc(l)}</text></g>`;
  });
  if (line) { const pts = line.vals.map((v, i) => `${(pad.l + i * bw + bw / 2).toFixed(1)},${y(v).toFixed(1)}`).join(' '); s += `<polyline fill="none" stroke="${line.color}" stroke-width="2" stroke-linejoin="round" points="${pts}" style="pointer-events:none"/>` + line.vals.map((v, i) => `<circle cx="${pad.l + i * bw + bw / 2}" cy="${y(v)}" r="3.5" fill="${line.color}" style="pointer-events:none"/>`).join(''); }
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">${s}</svg>`;
}

export function stackBars(rows, labels, { h = 260, w = 680, hidden = new Set() } = {}) {
  const pad = { l: 58, r: 14, t: 14, b: 30 }, iw = w - pad.l - pad.r, ih = h - pad.t - pad.b, n = labels.length, vis = rows.filter(r => !hidden.has(r.name)); if (!n) return emptyChart(h);
  const tot = labels.map((_, i) => sum(vis.map(r => r.vals[i]))), mx = Math.max(...tot, 1) * 1.08, y = v => pad.t + ih - v / mx * ih, bw = iw / n;
  let s = grid(pad, w, y, 0, mx, k);
  labels.forEach((l, i) => {
    let acc = 0; const x0 = pad.l + i * bw + bw * .2, ww = bw * .6;
    const tip = `<b>${esc(l)} · ${fmt(tot[i])}</b><br>` + vis.slice().reverse().filter(r => r.vals[i]).map(r => `<i style='background:${r.color}'></i>${esc(r.name)}: ${fmt(r.vals[i])}`).join('<br>');
    s += `<g class="col" ${T(tip)}><rect class="hit" x="${pad.l + i * bw}" y="${pad.t}" width="${bw}" height="${ih}"/>`;
    vis.forEach(r => { const v = r.vals[i]; if (!v) return; const y0 = y(acc + v); s += `<rect class="bar" x="${x0}" y="${y0}" width="${ww}" height="${Math.max(y(acc) - y0 - 1.5, 0)}" rx="3" fill="${r.color}"/>`; acc += v; });
    s += `<text x="${pad.l + i * bw + bw / 2}" y="${h - 8}" text-anchor="middle">${esc(l)}</text></g>`;
  });
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">${s}</svg>`;
}

export function donut(items, { size = 200, stroke = 24, center = '', sub = '', pick = '' } = {}) {
  items = items.filter(i => i[1] > 0);
  const r = (size - stroke) / 2 - 4, c = size / 2, tot = sum(items.map(i => i[1])) || 1; let off = 0;
  const segs = items.map(it => { const len = it[1] / tot * 100, gap = items.length > 1 ? .8 : 0; const el = `<circle class="dseg" ${pick ? `data-${pick}="${esc(it[0])}"` : ''} cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${it[2]}" stroke-width="${stroke}" pathLength="100" stroke-dasharray="${Math.max(len - gap, .1)} ${100 - len + gap}" stroke-dashoffset="${-off}" ${T(`<i style='background:${it[2]}'></i><b>${esc(it[0])}</b><br>${fmt(it[1])} · ${Math.round(it[1] / tot * 100)}%`)}/>`; off += len; return el; }).join('');
  const track = items.length ? '' : `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--tint2)" stroke-width="${stroke}"/>`;
  return `<div class="donut" style="width:${size}px;max-width:100%"><svg viewBox="0 0 ${size} ${size}"><g transform="rotate(-90 ${c} ${c})">${track}${segs}</g></svg><div class="dc"><b class="num">${center}</b><small>${esc(sub)}</small></div></div>`;
}

export function hbars(items, { pick = '', max = null, valFmt = v => fmt(v) } = {}) {
  if (!items.length) return '<p class="hint">Nothing to show yet.</p>';
  const mx = max || Math.max(...items.map(i => i.val), 1);
  return `<div class="hbars">${items.map(it => `<button class="hbar" type="button" ${pick ? `data-${pick}="${esc(it.key || it.label)}"` : ''} ${T(`<b>${esc(it.label)}</b><br>${valFmt(it.val)}${it.tip ? '<br>' + it.tip : ''}`)}><span class="t"><i style="background:${it.color}"></i>${esc(it.label)}</span><span class="track"><span style="width:${Math.min(it.val / mx * 100, 100)}%;background:${it.color}"></span></span><span class="val num">${valFmt(it.val)}${it.sub ? `<small class="${it.subc || ''}">${it.sub}</small>` : ''}</span></button>`).join('')}</div>`;
}

export function ring(p, { size = 120, stroke = 11, color = 'var(--accent)', value = '', small = '', btn = '' } = {}) {
  const r = (size - stroke) / 2, c = size / 2;
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" fill="none" class="ring-track" stroke-width="${stroke}"/><circle class="ring-arc" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" pathLength="100" style="--p:${Math.min(Math.max(p || 0, 0), 100)}"/></svg><span class="rv"><span><b class="num">${value}</b><small>${esc(small)}</small></span></span>`;
  return btn ? `<button class="ring" type="button" ${btn} style="width:${size}px;height:${size}px">${svg}</button>` : `<div class="ring" style="width:${size}px;height:${size}px">${svg}</div>`;
}

export function spark(vals, color, { w = 140, h = 38 } = {}) {
  vals = vals.filter(v => v != null); if (vals.length < 2) return `<svg class="sline" width="${w}" height="${h}" aria-hidden="true"></svg>`;
  const mn = Math.min(...vals), mx = Math.max(...vals), r = mx - mn || 1, x = i => i * (w - 4) / (vals.length - 1) + 2, y = v => h - 4 - (v - mn) / r * (h - 8);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' '), id = rid('sp');
  return `<svg class="sline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" style="max-width:100%"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".3"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><polygon fill="url(#${id})" points="2,${h} ${pts} ${w - 2},${h}"/><polyline fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" points="${pts}"/><circle cx="${x(vals.length - 1)}" cy="${y(vals.at(-1))}" r="3" fill="${color}"/></svg>`;
}

export function waterfall(steps, { h = 280, w = 680 } = {}) {
  const pad = { l: 58, r: 14, t: 18, b: 46 }, iw = w - pad.l - pad.r, ih = h - pad.t - pad.b, n = steps.length; let run = 0; const bars = [];
  steps.forEach(st => { if (st.t === 'start' || st.t === 'end') { bars.push([0, st.v, st]); run = st.v; } else { bars.push([run, run + st.v, st]); run += st.v; } });
  const mx = Math.max(1, ...bars.map(b => Math.max(b[0], b[1]))) * 1.08, mn = Math.min(0, ...bars.map(b => Math.min(b[0], b[1]))) * 1.08, y = v => pad.t + ih - (v - mn) / (mx - mn) * ih, bw = iw / n;
  let s = grid(pad, w, y, mn, mx, k);
  bars.forEach(([a, b, st], i) => {
    const x0 = pad.l + i * bw + bw * .16, ww = bw * .68, col = st.t === 'start' || st.t === 'end' ? 'var(--s0)' : st.v >= 0 ? 'var(--s3)' : 'var(--s8)', top = y(Math.max(a, b)), hh = Math.max(Math.abs(y(a) - y(b)), 2);
    const words = String(st.l).split(' ');
    s += `<g ${T(`<b>${esc(st.l)}</b><br>${st.t === 'delta' ? (st.v >= 0 ? '+' : '') + fmt(st.v) : fmt(st.v)}`)}><rect class="bar" x="${x0}" y="${top}" width="${ww}" height="${hh}" rx="4" fill="${col}"/>${i < n - 1 ? `<line x1="${x0 + ww}" x2="${x0 + bw}" y1="${y(b)}" y2="${y(b)}" stroke="var(--line-strong)" stroke-dasharray="2 3"/>` : ''}<text x="${x0 + ww / 2}" y="${top - 6}" text-anchor="middle" style="fill:var(--fg);font-weight:500">${st.t === 'delta' ? (st.v >= 0 ? '+' : '−') + k(Math.abs(st.v)) : k(st.v)}</text><text x="${x0 + ww / 2}" y="${h - 26}" text-anchor="middle">${esc(words[0])}</text><text x="${x0 + ww / 2}" y="${h - 12}" text-anchor="middle">${esc(words.slice(1).join(' '))}</text></g>`;
  });
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">${s}</svg>`;
}

export function heatmap(vals, year, month, color) {
  const first = new Date(year, month, 1).getDay(), dim = new Date(year, month + 1, 0).getDate(), mx = Math.max(1, ...vals.slice(1, dim + 1));
  let h = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<span class="dow">${d}</span>`).join('');
  for (let i = 0; i < first; i++) h += '<span class="d empty"></span>';
  for (let d = 1; d <= dim; d++) { const v = vals[d] || 0, a = v ? .14 + .86 * Math.sqrt(v / mx) : .05; h += `<span class="d" style="background:color-mix(in srgb,${color} ${Math.round(a * 100)}%,var(--tint))" ${T(`<b>${d} ${new Date(year, month, d).toLocaleDateString('en-AU', { month: 'short' })}</b><br>${v ? fmt(v, 2) : 'Nothing'}`)}>${d}</span>`; }
  return `<div class="heat">${h}</div>`;
}

const emptyChart = h => `<div class="hint" style="height:${Math.round(h / 2)}px;display:grid;place-items:center">Not enough data yet.</div>`;
export const legend = (items, toggle = '') => `<div class="legend">${items.map(it => toggle ? `<button type="button" data-${toggle}="${esc(it[0])}"><i style="background:${it[1]}"></i>${esc(it[0])}</button>` : `<span><i style="background:${it[1]}"></i>${esc(it[0])}</span>`).join('')}</div>`;
export const pill = (t, c) => `<span class="pill ${c}">${t}</span>`;
export const tagB = b => `<span class="tag ${b}">${b === 'P' ? 'Personal' : 'Business'}</span>`;
export const av = (name, color) => `<span class="av" style="background:${color}">${esc(String(name).replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '·')}</span>`;

/* Sortable tables. Column renderers (c.r) must escape their own user text. */
export const TBL = {};
export function tbl(id, cols, rows, opt = {}) {
  TBL[id] = { cols, rows, sort: opt.sort ?? null, dir: opt.dir ?? -1, click: opt.click, filter: null, foot: opt.foot, empty: opt.empty || 'Nothing here yet.', limit: opt.limit || 0 };
  return `<div class="tbl-wrap"><table class="tbl" id="${id}"></table></div>`;
}
export function drawTbl(id) {
  const t = TBL[id], el = document.getElementById(id); if (!t || !el) return;
  let rows = t.filter ? t.rows.filter(t.filter) : t.rows.slice();
  if (t.sort != null) { const c = t.cols[t.sort], v = c.v || (r => r[c.k]); rows.sort((a, b) => { const x = v(a), y = v(b); return (x > y ? 1 : x < y ? -1 : 0) * t.dir; }); }
  const all = rows, shown = t.limit && !t.showAll ? rows.slice(0, t.limit) : rows;
  el.innerHTML = `<thead><tr>${t.cols.map((c, i) => `<th class="${c.s === false ? '' : 's'} ${c.n ? 'n' : ''} ${t.sort === i ? (t.dir > 0 ? 'asc' : 'desc') : ''}" data-col="${i}">${c.l}</th>`).join('')}</tr></thead><tbody>${shown.length ? shown.map(r => `<tr class="${t.click ? 'click' : ''}" ${t.click ? `data-sheet="${esc(t.click(r))}"` : ''}>${t.cols.map(c => `<td class="${c.n ? 'n' : ''}">${c.r ? c.r(r) : esc(r[c.k])}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${t.cols.length}" class="hint" style="text-align:center;padding:22px">${t.empty}</td></tr>`}${t.limit && all.length > t.limit && !t.showAll ? `<tr><td colspan="${t.cols.length}" style="text-align:center"><button class="mini" type="button" data-more="${id}">Show all ${all.length}</button></td></tr>` : ''}</tbody>${t.foot ? `<tfoot class="tfoot"><tr>${t.foot(all)}</tr></tfoot>` : ''}`;
  el.querySelectorAll('th.s').forEach(th => th.onclick = () => { const i = +th.dataset.col; if (t.sort === i) t.dir *= -1; else { t.sort = i; t.dir = t.cols[i].n ? -1 : 1; } drawTbl(id); });
  el.querySelector('[data-more]')?.addEventListener('click', () => { t.showAll = true; drawTbl(id); });
}
export const drawAll = () => Object.keys(TBL).forEach(id => document.getElementById(id) && drawTbl(id));
export const clearTables = (keep = () => false) => { for (const id in TBL) if (!keep(id)) delete TBL[id]; };
