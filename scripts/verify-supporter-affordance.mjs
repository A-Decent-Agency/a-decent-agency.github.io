import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.OFFICE_URL || 'http://127.0.0.1:8073/';
const shots = process.env.SCREENSHOT_DIR || 'office-shots';
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.waitForSelector('#scene canvas');
  await page.locator('#flight-pause').click();
  await page.locator('#flight-destination').selectOption('project:thejollylama/decentcanopy');
  const art = page.locator('.support-callout .mint-art-buy');
  await art.hover();
  await page.waitForTimeout(500);
  assert.notEqual(await art.evaluate(e => getComputedStyle(e).transform), 'none');
  await page.screenshot({ path: `${shots}/supporter-glow-panel.png` });
  await art.focus();
  assert.ok(await art.evaluate(e => getComputedStyle(e).boxShadow.includes('85, 186, 255')));
  await page.keyboard.press('Enter');
  await page.locator('#supporter-checkout').waitFor({ state: 'visible' });
  await page.locator('#supporter-checkout .dialog-close').click();
  await page.locator('#motion-button').click();
  await page.locator('#flight-destination').selectOption('project:thejollylama/decentcanopy');
  await art.hover();
  assert.equal(await art.evaluate(e => getComputedStyle(e).transform), 'none');
  assert.equal(await art.evaluate(e => getComputedStyle(e, '::after').animationName), 'none');
  const target = await page.evaluate(async () => {
    const [{ ConstructionScene }, THREE, project, feed] = await Promise.all([
      import('./js/construction-scene.js'), import('three'),
      fetch('./data/project.json').then(r => r.json()), fetch('./data/progress.json').then(r => r.json()),
    ]);
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#100e1d';
    document.body.append(host);
    const scene = new ConstructionScene(host, { onSite() {}, onFailure(m) { throw new Error(m); },
      onMint(url) { host.dataset.purchase = url; } });
    scene.setData(project.items, 'flight', 0, [], feed, { includeContext: true });
    scene.setActive(true); scene.setCamera('orbit');
    scene.goTo(scene.sites.findIndex(s => s.project?.repository === 'TheJollyLaMa/DecentCanopy'), { immediate: true });
    scene.tick(performance.now());
    const cards = scene.targets.filter(o => o.isMesh && o.userData.purchaseUrl);
    const expected = feed.repositories.reduce((n, r) => n + r.versions.filter(v => v.storefront).length, 0);
    if (cards.length !== expected || scene.mintEffects.length !== expected) throw new Error('Every buyable edition needs exactly one decorated card');
    const card = cards.find(o => new URL(o.userData.purchaseUrl).searchParams.get('listingId') === '9');
    const point = card.getWorldPosition(new THREE.Vector3()).project(scene.camera);
    globalThis.affordanceTest = { scene, host, card };
    return { x: (point.x + 1) * innerWidth / 2, y: (1 - point.y) * innerHeight / 2, url: card.userData.purchaseUrl, expected };
  });
  await page.mouse.move(target.x, target.y);
  assert.equal(await page.evaluate(() => affordanceTest.scene.hoveredMint === affordanceTest.card.userData.mintEffect), true);
  assert.equal(await page.evaluate(() => affordanceTest.scene.renderer.domElement.style.cursor), 'pointer');
  await page.mouse.move(1, 1);
  assert.equal(await page.evaluate(() => affordanceTest.scene.hoveredMint), null);
  await page.mouse.move(target.x, target.y);
  const motion = await page.evaluate(() => {
    const { scene, card } = affordanceTest, effect = card.userData.mintEffect;
    scene.tick(1100); scene.stop();
    const first = effect.pivot.rotation.y;
    scene.tick(2300); scene.stop();
    const second = effect.pivot.rotation.y;
    scene.setPaused(true); scene.tick(3000); scene.stop();
    const paused = effect.pivot.rotation.y;
    scene.setPaused(false); scene.setMotion(true); scene.tick(4000); scene.stop();
    const reduced = effect.pivot.rotation.y;
    scene.tick(5000); scene.stop();
    return { first, second, paused, reduced, reducedAgain: effect.pivot.rotation.y, halo: effect.halo.material.opacity, sparkles: effect.sparkles.material.opacity };
  });
  assert.notEqual(motion.first, motion.second);
  assert.ok(Math.abs(motion.first) <= .42 && Math.abs(motion.second) <= .42);
  assert.equal(motion.paused, 0);
  assert.equal(motion.reduced, 0);
  assert.equal(motion.reducedAgain, 0);
  assert.equal(motion.halo, 1);
  assert.equal(motion.sparkles, .8);
  await page.screenshot({ path: `${shots}/supporter-glow-city.png` });
  await page.mouse.click(target.x, target.y);
  assert.equal(await page.evaluate(() => affordanceTest.host.dataset.purchase), target.url);
  await page.evaluate(() => {
    const { scene, host } = affordanceTest;
    scene.setActive(false); scene.clear();
    if (scene.mintEffects.length || scene.hoveredMint) throw new Error('Stale decoration after scene rebuild');
    scene.renderer.dispose(); host.remove(); delete globalThis.affordanceTest;
  });
  for (const width of [375, 320]) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height: 812 });
    await page.reload();
    await page.locator('#flight-destination').selectOption('project:thejollylama/decentcanopy');
    const button = page.locator('.support-callout .mint-art-buy');
    await button.waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const e = document.querySelector('.support-callout .mint-art-buy');
      return e?.isConnected && getComputedStyle(e, '::after').animationName === 'none' && getComputedStyle(e).transform === 'none';
    });
    await button.click();
    await page.locator('#supporter-checkout').waitFor({ state: 'visible' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.locator('#supporter-checkout .dialog-close').click();
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: ${target.expected} decorated buyable 3D editions; real hover raycast/cursor, bounded swivel, paused/reduced static glow, unchanged purchase target, cleanup, keyboard art checkout and 320/375px touch/reduced-motion access.`);
} finally { await browser.close(); }
