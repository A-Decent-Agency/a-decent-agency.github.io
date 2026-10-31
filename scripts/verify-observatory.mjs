import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.OFFICE_URL || 'http://127.0.0.1:18778/';
const shots = process.env.SCREENSHOT_DIR || 'office-shots';
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.waitForSelector('#scene canvas:visible');
  await page.waitForFunction(() => document.querySelector('#progress-status').textContent.includes('repositories available'));
  await page.locator('#motion-button').click();
  assert.ok(await page.locator('#scene').evaluate(element => element.clientHeight) >= 560);
  await page.locator('#flight-destination').selectOption('project:thejollylama/decenthead');
  await page.waitForFunction(() => [...document.querySelectorAll('#campus-artwork img')].some(img => img.complete && img.naturalWidth > 0));
  assert.match(await page.locator('#campus-details').innerText(), /Delivered version floors \(1\)/);
  assert.match(await page.locator('#campus-details').innerText(), /token 70/);
  // A delivered hall needs no crane unless it has unfinished planned structures (open milestone issues).
  const metrics = await page.locator('#flight-site-metrics').innerText(), planned = metrics.match(/(\d+)\/(\d+) planned structures finished/);
  assert.match(metrics, planned && planned[1] !== planned[2] ? /[1-9]\d* build cranes/ : /0 build cranes/);
  assert.ok(await page.locator('#campus-plan svg line').count() > 0);
  for (const camera of ['flight', 'orbit', 'top', 'universe']) {
    await page.locator('#flight-camera').selectOption(camera);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${shots}/observatory-${camera}.png`, fullPage: true });
  }
  await page.locator('#flight-zoom').fill('1.5');
  await page.locator('#flight-zoom').dispatchEvent('input');
  const canvas = page.locator('#scene canvas:visible');
  await canvas.hover(); await page.mouse.down(); await page.mouse.move(600, 700); await page.mouse.up();
  await page.locator('#flight-fullscreen').click();
  await page.waitForFunction(() => document.fullscreenElement || document.querySelector('#workspace').classList.contains('immersive'));
  assert.ok(await page.locator('#scene').evaluate(element => element.clientHeight) >= 950);
  await page.locator('#immersive-panel').click();
  await page.locator('#flight-site').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#flight-site').isVisible(), false);
  await page.locator('#immersive-panel').click();
  await page.locator('#immersive-camera').click();
  await page.locator('#immersive-zoom-in').click();
  assert.ok(Number(await page.locator('#flight-zoom').inputValue()) < 1.5);
  await page.locator('#immersive-pause').click();
  assert.equal(await page.locator('#immersive-pause').getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: `${shots}/observatory-fullscreen.png` });
  await page.locator('#immersive-exit').click();
  await page.waitForFunction(() => !document.fullscreenElement && !document.querySelector('#workspace').classList.contains('immersive'));
  await page.locator('#flight-destination').selectOption('project:thejollylama/decentbusking');
  const jobs = await page.locator('#campus-plan [data-campus-item]').count();
  assert.equal(jobs, await page.locator('#flight-site-items button').count());
  await page.locator('#campus-plan [data-campus-item]').first().click();
  assert.ok(await page.locator('#detail-panel').isVisible());
  assert.equal(await page.locator('#scene').getAttribute('data-focused-campus'), 'project:thejollylama/decentbusking');
  await page.locator('#close-detail').click();
  await page.locator('#flight-camera').selectOption('orbit');
  await page.screenshot({ path: `${shots}/observatory-busking.png`, fullPage: true });
  await page.locator('#flight-destination').selectOption('project:thejollylama/decentcanopy');
  await page.waitForFunction(() => [...document.querySelectorAll('#campus-artwork img')].some(img => img.complete && img.naturalWidth > 0));
  await page.screenshot({ path: `${shots}/observatory-canopy.png`, fullPage: true });
  for (const width of [375, 320]) {
    const mobile = await browser.newPage({ viewport: { width, height: 812 }, reducedMotion: 'reduce' });
    await mobile.goto(base);
    await mobile.waitForFunction(() => document.querySelector('#flight-destination').options.length > 0);
    assert.equal(await mobile.locator('#scene').isVisible(), false);
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await mobile.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: owned artwork, clean mint floor, 2D/3D job equality, four camera modes, task connection focus, drag/zoom with motion off, fullscreen/panel controls, mobile fallback; zero page errors.');
} finally { await browser.close(); }
