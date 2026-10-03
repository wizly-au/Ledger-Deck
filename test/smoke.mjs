// Smoke test: loads the app in Chromium, runs the sample data, visits every screen and tab, and fails on any console error.
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:8080/';
const SHOTS = process.env.SHOTS || '';
const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(URL);
await page.waitForSelector('.wiz');
if (SHOTS) await page.screenshot({ path: SHOTS + '/wizard.png' });
await page.click('#wizSample');
await page.waitForSelector('#voicePanel');
const shot = async n => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true }); };
await shot('briefing');
for (const v of ['personal', 'business', 'tax']) {
  await page.click(`.nav[data-view="${v}"]`);
  const tabs = await page.$$eval('#tabs button', bs => bs.map(b => b.dataset.tab));
  for (const t of tabs) { await page.click(`#tabs [data-tab="${t}"]`); await page.waitForTimeout(150); await shot(`${v}-${t}`); }
}
await page.click('.nav[data-view="whatif"]'); await page.waitForTimeout(200); await shot('whatif');
await page.click('.nav[data-view="data"]'); await page.waitForTimeout(200); await shot('data');
// open a transaction and recategorise it
await page.click('.nav[data-view="personal"]'); await page.click('#tabs [data-tab="spending"]');
await page.click('#ttx tbody tr.click'); await page.waitForSelector('#recat');
await page.click('#recat button[data-f="Shopping"]'); await page.click('#txSave');
// workbook export
await page.click('.nav[data-view="tax"]'); await page.click('#tabs [data-tab="export"]');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#xlsxBtn')]);
console.log('download:', dl.suggestedFilename());
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
