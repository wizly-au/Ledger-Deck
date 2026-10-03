import { state } from '../store.js';
import { fmt, esc, monthLabel, lastMonths, todayIso, addDays } from '../util.js';
import { V } from '../ui.js';
import { lineChart, legend, tagB } from '../charts.js';
import { accts, isDebt, cashTotal, avgMonthlyCosts } from '../model.js';
import { opt } from '../ui.js';
import { COMPANY_RATE, estimate, currentFy } from '../tax.js';

const $ = id => document.getElementById(id);
V.whatif = {
  title: 'What if',
  render() {
    const loans = accts('P').filter(a => isDebt(a) && a.type !== 'card' && a.balance > 0);
    const hasB = state.settings.track.B;
    return `<section class="panel hero"><div></div><div><div class="label" style="margin-bottom:6px">Play with the future</div><h2>Move the sliders. Charts and numbers <em class="c">update as you go</em>. Nothing real changes.</h2></div><div></div></section>
<div class="grid g2">
  <section class="panel"><div class="ph"><h2>Pay a loan down faster</h2>${tagB('P')}</div>
    ${loans.length ? `<div class="wiz-grid">
      <label class="field"><span>Loan</span><select id="loanSel">${loans.map(a => opt(a.id, a.name, loans[0].id)).join('')}</select></label>
      <label class="field"><span>Balance</span><input id="lBal" inputmode="decimal"></label>
      <label class="field"><span>Interest rate %</span><input id="lRate" inputmode="decimal"></label>
      <label class="field"><span>Monthly repayment</span><input id="lPay" inputmode="decimal"></label></div>
    <div class="slider"><div class="top2"><label for="xtra">Extra each month</label><b class="num" id="xtraV"></b></div><input type="range" id="xtra" min="0" max="3000" step="50" value="300"></div>
    <div class="out"><div><div class="label">Interest saved</div><div class="v up num" id="intSaved"></div></div><div><div class="label">Paid off</div><div class="v num" id="yrsCut"></div></div></div>
    <div id="loanChart" style="margin-top:14px"></div>${legend([['Current plan', 'var(--s0)'], ['With extra', 'var(--accent)']])}
    <p class="hint">Assumes the rate stays the same. Money in an offset account works the same way as extra repayments.</p>` : `<p class="say">Add a loan in Personal, Accounts with its balance, rate and repayment to try this.</p><button class="cta ghost" type="button" data-sheet="newacct:P">Add a loan</button>`}
  </section>
  <section class="panel"><div class="ph"><h2>${hasB ? 'Buy equipment or hire' : 'A big purchase'}</h2>${tagB(hasB ? 'B' : 'P')}</div><p class="say">See how a large purchase${hasB ? ' or a new monthly cost' : ''} changes how long your cash lasts.</p>
    <div class="slider"><div class="top2"><label for="equip">Purchase</label><b class="num" id="equipV"></b></div><input type="range" id="equip" min="0" max="50000" step="500" value="5000"></div>
    <div class="slider"><div class="top2"><label for="hire">New monthly cost</label><b class="num" id="hireV"></b></div><input type="range" id="hire" min="0" max="10000" step="250" value="0"></div>
    <div class="out"><div><div class="label">Cash lasts</div><div class="v num" id="runAfter"></div></div><div><div class="label">Possible tax saving</div><div class="v up num" id="taxSave"></div></div></div>
    <div id="runChart" style="margin-top:14px"></div><p class="hint" id="runNote"></p></section>
</div>`;
  },
  bind() {
    const hasB = state.settings.track.B, book = hasB ? 'B' : 'P';
    const loanSel = $('loanSel');
    const loadLoan = () => { const a = state.accounts.find(x => x.id === loanSel.value); $('lBal').value = a.balance || 0; $('lRate').value = a.rate ?? 6; $('lPay').value = a.repay ?? Math.round((a.balance || 0) * .0065); upd(); };
    const sim = (B0, rate, pmt, x) => { const r = rate / 100 / 12; let b = B0, m = 0, int = 0; const yr = [B0]; while (b > .5 && m < 720) { const i = b * r; int += i; b = Math.max(b + i - pmt - x, 0); m++; if (m % 12 === 0) yr.push(b); if (pmt + x <= i && m > 2) return { m: Infinity, int: Infinity, yr }; } if (m % 12) yr.push(0); return { m, int, yr }; };
    const upd = () => {
      if (loanSel) {
        const B0 = +$('lBal').value || 0, rate = +$('lRate').value || 0, pmt = +$('lPay').value || 0, x = +$('xtra').value;
        const base = sim(B0, rate, pmt, 0), s = sim(B0, rate, pmt, x);
        $('xtraV').textContent = fmt(x) + '/mo';
        if (!isFinite(base.m)) { $('intSaved').textContent = '–'; $('yrsCut').textContent = 'Repayment too low'; $('loanChart').innerHTML = ''; }
        else { const cut = base.m - s.m; $('intSaved').textContent = fmt(base.int - s.int); $('yrsCut').textContent = cut > 0 ? `${Math.floor(cut / 12)}y ${cut % 12}m sooner` : `in ${Math.floor(base.m / 12)}y ${base.m % 12}m`;
          $('loanChart').innerHTML = lineChart([{ name: 'With extra', vals: base.yr.map((_, i) => s.yr[i] ?? 0), color: 'var(--accent)' }, { name: 'Current plan', vals: base.yr, color: 'var(--s0)', dash: true, width: 2 }], base.yr.map((_, i) => i ? i + 'y' : 'Now'), { h: 220, every: Math.max(1, Math.round(base.yr.length / 8)), zero: true }); }
      }
      const cash = cashTotal(book), costs = hasB ? avgMonthlyCosts() : 0;
      const e = +$('equip').value, h = +$('hire').value;
      const burn = (hasB ? costs : spendAvg()) + h, left = Math.max(cash - e, 0), ra = burn > 0 ? left / burn : Infinity;
      $('equipV').textContent = fmt(e); $('hireV').textContent = fmt(h) + '/mo';
      $('runAfter').textContent = isFinite(ra) ? ra.toFixed(1) + ' months' : '–'; $('runAfter').className = 'v num ' + (ra < 2 ? 'down' : ra < 3 ? 'warnc' : 'up');
      const rate = hasB ? (state.settings.entity === 'company' ? COMPANY_RATE : estimate(currentFy()).marg) : 0;
      $('taxSave').textContent = hasB ? fmt(e * rate) : '–';
      $('runNote').textContent = hasB ? `Uses ${fmt(cash)} in business cash accounts and average costs of ${fmt(costs)} a month. Tax saving assumes the purchase is fully deductible this year at ${Math.round(rate * 100)}%. Check the write-off rules for this year.` : `Uses ${fmt(cash)} in your cash accounts and your average spending of ${fmt(spendAvg())} a month, with no new income.`;
      const ml = lastMonths(7, addDays(todayIso(), 190)).map(monthLabel); ml[0] = 'Now';
      $('runChart').innerHTML = lineChart([{ name: 'After', vals: ml.map((_, i) => Math.max(cash - e - burn * i, 0)), color: 'var(--accent)' }, { name: 'Today', vals: ml.map((_, i) => Math.max(cash - (burn - h) * i, 0)), color: 'var(--s0)', dash: true, width: 2 }], ml, { h: 200, zero: true, every: 2 });
    };
    const spendAvg = () => { const t = state.tx.filter(x => x.book === 'P' && x.amount < 0 && x.date >= addDays(todayIso(), -90) && !['Transfers'].includes(x.cat)); return t.reduce((s, x) => s - x.amount, 0) / 3; };
    if (loanSel) { loanSel.onchange = loadLoan;['lBal', 'lRate', 'lPay', 'xtra'].forEach(id => $(id).oninput = upd); }
    ['equip', 'hire'].forEach(id => $(id).oninput = upd);
    loanSel ? loadLoan() : upd();
  },
};
