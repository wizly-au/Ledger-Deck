// Embed test: loads embed/demo.html, checks the <ledger-deck> frame starts, takes sample data,
// follows host navigation, reports the screen back to the host, and fails on any console error.
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:8080/embed/demo.html';
const SHOTS = process.env.SHOTS || '';
const errors = [];
const browser = await chromium.launch();
for (const vp of [{ width: 1400, height: 1000 }, { width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(URL);
  await page.locator('ledger-deck').evaluate(el => el.scrollIntoView());
  const app = page.frameLocator('ledger-deck >>> iframe');
  await app.locator('#wizSample').click();
  await app.locator('#voicePanel').waitFor();
  if (!(await app.locator('body.embedded').count())) errors.push('frame is not in embedded mode');
  if (vp.width > 760) {
    await page.click('nav button[data-v="tax"]');
    await page.waitForFunction(() => document.getElementById('now').textContent === 'Showing: tax');
    const title = await app.locator('#title').textContent();
    if (!title.startsWith('Tax')) errors.push('host navigation did not reach Tax, got ' + title);
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/embed-${vp.width}.png` });
  await ctx.close();
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
