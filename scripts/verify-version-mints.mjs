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
  await page.waitForFunction(() => document.querySelector('#progress-status').textContent.includes('repositories available'));
  await page.waitForSelector('#scene canvas:visible');
  await page.locator('#motion-button').click();
  const feed = await (await page.request.get(new URL('data/progress.json', base).href)).json();
  const editions = feed.repositories.flatMap(repo => repo.versions.filter(version => version.storefront).map(version => ({ repository: repo.repository, ...version })));
  assert.ok(editions.length >= 5, 'All five published mint listings must be observed');
  for (const version of editions) {
    await page.locator('#flight-destination').selectOption(`project:${version.repository.toLowerCase()}`);
    const gallery = page.locator(`[data-version-mint="${version.tag}"]`);
    const buy = gallery.locator('.mint-buy');
    assert.equal(await buy.getAttribute('href'), version.storefront.purchaseUrl);
    assert.equal(await buy.getAttribute('target'), '_blank');
    assert.match(await buy.innerText(), /10 USDC on Base/);
    const art = gallery.locator('[data-mint-art]');
    await art.first().scrollIntoViewIfNeeded();
    await page.waitForFunction(tag => [...document.querySelectorAll(`[data-version-mint="${tag}"] img`)].every(img => img.complete && img.naturalWidth > 0), version.tag);
    assert.equal(await art.count(), 2);
    await page.locator('#flight-camera').selectOption('orbit');
    await page.screenshot({ path: `${shots}/${version.repository.split('/')[1]}-mint.png`, fullPage: true });
  }
  await page.locator('#flight-destination').selectOption('project:thejollylama/decentbusking');
  assert.equal(await page.locator('.mint-buy').count(), 0);
  assert.match(await page.locator('.version-mints').innerText(), /No receipt-backed version mint/);
  const legacy = await page.locator('#flight-destination option').evaluateAll(options => options.find(option => option.textContent.startsWith('LEGACY CHECKPOINT'))?.value);
  assert.ok(legacy);
  await page.locator('#flight-destination').selectOption(legacy);
  assert.match(await page.locator('#flight-site-type').innerText(), /LEGACY CHECKPOINT/);
  assert.match(await page.locator('#flight-site-metrics').innerText(), /Source status:/);

  // Use the real scene and raycaster in isolation to assert front/back and BUY hits.
  const target = await page.evaluate(async () => {
    const [{ ConstructionScene }, THREE, project, feed] = await Promise.all([
      import('./js/construction-scene.js'), import('three'),
      fetch('./data/project.json').then(response => response.json()), fetch('./data/progress.json').then(response => response.json()),
    ]);
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#100e1d';
    document.body.append(host);
    const scene = new ConstructionScene(host, { onSite() {}, onFailure(message) { throw new Error(message); },
      onMint(url) { host.dataset.purchase = url; } });
    scene.setMotion(true); scene.setData(project.items, 'flight', 0, [], feed, { includeContext: true });
    scene.setActive(true); scene.setCamera('orbit');
    scene.goTo(scene.sites.findIndex(site => site.project?.repository === 'TheJollyLaMa/DecentHead'));
    scene.tick(performance.now());
    const card = scene.targets.find(object => object.isMesh && object.userData.purchaseUrl);
    const action = scene.targets.find(object => object.isSprite && object.userData.purchaseUrl === card.userData.purchaseUrl);
    for (const face of [4, 5]) {
      if (card.material[face].map) continue;
      await new Promise((resolve, reject) => {
        const start = performance.now();
        const poll = () => card.material[face].map ? resolve() : performance.now() - start > 30000 ? reject(new Error('3D front/back texture missing')) : setTimeout(poll, 50);
        poll();
      });
    }
    scene.renderer.render(scene.scene, scene.camera);
    const point = object => {
      const p = object.getWorldPosition(new THREE.Vector3()).project(scene.camera);
      return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 };
    };
    globalThis.mintAcceptance = { scene, host };
    return { card: point(card), action: point(action), url: card.userData.purchaseUrl,
      twoFaces: card.material[4].map !== card.material[5].map };
  });
  assert.ok(target.twoFaces);
  await page.mouse.click(target.card.x, target.card.y);
  assert.equal(await page.evaluate(() => globalThis.mintAcceptance.host.dataset.purchase), target.url);
  await page.evaluate(() => { delete globalThis.mintAcceptance.host.dataset.purchase; });
  await page.mouse.click(target.action.x, target.action.y);
  assert.equal(await page.evaluate(() => globalThis.mintAcceptance.host.dataset.purchase), target.url);
  assert.equal(await page.evaluate(() => globalThis.mintAcceptance.scene.paused), true);
  await page.screenshot({ path: `${shots}/mint-gallery-3d.png` });
  await page.evaluate(() => {
    globalThis.mintAcceptance.scene.setActive(false); globalThis.mintAcceptance.scene.clear();
    globalThis.mintAcceptance.scene.renderer.dispose(); globalThis.mintAcceptance.host.remove();
    delete globalThis.mintAcceptance;
  });

  for (const width of [375, 320]) {
    const mobile = await browser.newPage({ viewport: { width, height: 812 }, reducedMotion: 'reduce' });
    await mobile.goto(base);
    await mobile.waitForFunction(() => document.querySelector('#progress-status').textContent.includes('repositories available'));
    await mobile.locator('#flight-destination').selectOption('project:thejollylama/decenthead');
    assert.equal(await mobile.locator('.mint-buy').count(), 1);
    await mobile.locator('.mint-buy').focus();
    assert.equal(await mobile.locator('.mint-buy').evaluate(element => element === document.activeElement), true);
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await mobile.close();
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: ${editions.length} project-specific live-receipt galleries, 10 loaded front/back images, real 3D card and BUY raycast, distinct textures, pause, safe links, unminted no-buy state, legacy disclosure, keyboard and 320/375px reduced-motion access; zero page errors.`);
} finally { await browser.close(); }
