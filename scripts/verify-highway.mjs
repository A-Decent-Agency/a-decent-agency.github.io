import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.OFFICE_URL || 'http://127.0.0.1:18778/';
const shots = process.env.SCREENSHOT_DIR || 'office-shots';
await mkdir(shots, { recursive: true });
const feed = JSON.parse(await readFile(new URL('../data/progress.json', import.meta.url)));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.highwaySigns = [];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
      window.highwaySigns.push(text);
      return fillText.call(this, text, ...args);
    };
  });
  await page.goto(base);
  await page.waitForSelector('#scene canvas:visible');
  await page.waitForFunction(() => document.querySelector('#progress-status').textContent.includes('repositories available'));
  await page.locator('#motion-button').click();
  assert.equal(await page.locator('#flight-site-title').innerText(), 'Decent Agency');
  assert.ok(await page.evaluate(() => window.highwaySigns.join(' ').includes('DECENT AGENCY / PLANNING OFFICE')));
  await page.screenshot({ path: `${shots}/highway-entrance.png`, fullPage: true });
  for (const [repository, milestone] of [
    ['DecentBusking', 'Version 1 construction complete'],
    ['DecentHead', 'Shared infrastructure'],
    ['DecentMarket', 'Marketplace'],
    ['DecentCanopy', 'Broad foundations'],
    ['BigNuten_Vanilla', 'Next construction site'],
  ]) {
    await page.locator('#flight-destination').selectOption(`project:thejollylama/${repository.toLowerCase()}`);
    assert.match(await page.locator('#campus-details .campus-stage').innerText(), new RegExp(milestone));
    assert.match(await page.locator('#flight-site-metrics').innerText(), /Board only:/);
    const observation = feed.repositories.find(entry => entry.repository === `TheJollyLaMa/${repository}`);
    if (observation.release) assert.ok((await page.locator('#campus-details').innerText()).includes(observation.release.tag));
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${shots}/highway-${repository.toLowerCase()}.png`, fullPage: true });
  }
  const busking = feed.repositories.find(entry => entry.repository.endsWith('/DecentBusking'));
  const updated = structuredClone(feed);
  updated.checkedAt = new Date(Date.parse(feed.checkedAt) + 3600000).toISOString();
  updated.repositories.find(entry => entry.repository === busking.repository).release = {
    tag: 'v-browser-acceptance', url: `https://github.com/${busking.repository}/releases/tag/v-browser-acceptance`, publishedAt: updated.checkedAt,
  };
  await page.route('**/data/progress.json', route => route.fulfill({ json: updated }));
  await page.locator('#refresh-project').click();
  await page.waitForFunction(() => window.highwaySigns.some(sign => sign.includes('v-browser-acceptance')));
  await page.locator('#flight-destination').selectOption('project:thejollylama/decentbusking');
  assert.match(await page.locator('#campus-details').innerText(), /Release v-browser-acceptance/);
  // Older, malformed and failed publications cannot replace a valid observation.
  await page.route('**/data/progress.json', route => route.fulfill({ json: feed }));
  await page.locator('#refresh-project').click();
  await page.waitForFunction(() => document.querySelector('#progress-status').textContent.includes('older'));
  assert.match(await page.locator('#campus-details').innerText(), /Release v-browser-acceptance/);
  await page.route('**/data/progress.json', route => route.fulfill({ json: { schemaVersion: 0 } }));
  await page.locator('#refresh-project').click();
  await page.waitForFunction(() => document.querySelector('#progress-status').textContent.includes('invalid'));
  await page.route('**/data/progress.json', route => route.fulfill({ status: 503 }));
  await page.locator('#refresh-project').click();
  await page.waitForFunction(() => document.querySelector('#progress-status').textContent.includes('503'));
  assert.match(await page.locator('#campus-details').innerText(), /Release v-browser-acceptance/);
  const unavailable = structuredClone(updated);
  unavailable.repositories.find(entry => entry.repository === busking.repository).state = 'unavailable';
  unavailable.repositories.find(entry => entry.repository === busking.repository).error = 'Public observation unavailable.';
  await page.route('**/data/progress.json', route => route.fulfill({ json: unavailable }));
  await page.locator('#refresh-project').click();
  await page.waitForFunction(() => document.querySelector('#campus-details').textContent.includes('Unavailable / retained observation'));
  assert.ok(await page.evaluate(() => window.highwaySigns.join(' ').includes('GITHUB OBSERVATION UNAVAILABLE')));
  assert.deepEqual(errors, []);
  console.log('PASS: six project landmarks; entrance billboard; source release links; refreshed 3D release sign; rollback/invalid/503 retention; unavailable labels; zero page errors.');
} finally {
  await browser.close();
}
