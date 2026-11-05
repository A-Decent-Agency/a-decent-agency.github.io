import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.OFFICE_URL || 'http://127.0.0.1:8919/');
  await page.waitForSelector('#scene canvas');
  await page.locator('#flight-pause').click();
  await page.locator('#flight-camera').selectOption('orbit');
  await page.locator('#flight-destination').selectOption('project:thejollylama/decentvoyager');
  const buy = page.locator('.support-callout .mint-buy');
  assert.match(await buy.innerText(), /10 USDC on Base/);
  assert.match(await buy.getAttribute('data-mint-checkout'), /listingId=18/);
  await page.waitForFunction(() => {
    const image = document.querySelector('.support-callout img');
    return image?.complete && image.naturalWidth > 0;
  });
  await buy.click();
  await page.locator('#supporter-checkout').waitFor({ state: 'visible' });
  await page.locator('#supporter-checkout .dialog-close').click();
  await page.locator('.campus-editions summary').click();
  assert.equal(await page.locator('[data-version-mint="v1.0.0"] [data-mint-art]').count(), 2);

  // Reuse the real scene/raycaster acceptance pattern from verify-version-mints.mjs.
  const target = await page.evaluate(async () => {
    const [{ ConstructionScene }, THREE, project, feed] = await Promise.all([
      import('./js/construction-scene.js'), import('three'),
      fetch('./data/project.json').then(response => response.json()),
      fetch('./data/progress.json').then(response => response.json())
    ]);
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#100e1d';
    document.body.append(host);
    const scene = new ConstructionScene(host, {
      onSite() {}, onFailure(message) { throw new Error(message); },
      onMint(url) { host.dataset.purchase = url; }
    });
    scene.setMotion(true);
    scene.setData(project.items, 'flight', 0, [], feed, { includeContext: true });
    scene.setActive(true); scene.setCamera('orbit');
    const site = scene.sites.find(site => site.project?.repository === 'TheJollyLaMa/DecentVoyager');
    if (!site) throw new Error('Voyager campus missing');
    scene.goTo(site.index, { immediate: true }); scene.setPaused(true); scene.tick(performance.now());
    const cards = scene.targets.filter(object => object.isMesh &&
      object.userData.purchaseUrl && new URL(object.userData.purchaseUrl).searchParams.get('listingId') === '18');
    if (cards.length !== 1) throw new Error('Expected exactly one Voyager 3D Supporter card');
    const card = cards[0];
    const action = scene.targets.find(object => object.isSprite && object.userData.purchaseUrl === card.userData.purchaseUrl);
    const campus = scene.campuses.get(site.id);
    const crowns = campus?.children.filter(object => object.name === 'voyager-rocket-crown');
    if (crowns?.length !== 1) throw new Error('Expected exactly one rocket tower crown');
    if (!crowns[0].children.every(object => object.material.isMeshBasicMaterial)) {
      throw new Error('Rocket colors must remain visible independent of scene lighting');
    }
    globalThis.voyagerCampusAcceptance = { scene, host, card };
    const point = card.getWorldPosition(new THREE.Vector3()).project(scene.camera);
    return { x: (point.x + 1) * innerWidth / 2, y: (1 - point.y) * innerHeight / 2,
      purchaseUrl: card.userData.purchaseUrl, hasBuySign: Boolean(action) };
  });
  assert.ok(target.hasBuySign);
  await page.waitForFunction(() => {
    const card = globalThis.voyagerCampusAcceptance.card;
    return card.material[4].map && card.material[5].map &&
      card.material[4].map !== card.material[5].map;
  });
  await page.mouse.click(target.x, target.y);
  assert.equal(await page.evaluate(() => globalThis.voyagerCampusAcceptance.host.dataset.purchase), target.purchaseUrl);
  if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH });
  await page.evaluate(() => {
    const { scene, host } = globalThis.voyagerCampusAcceptance;
    scene.setActive(false); scene.clear(); scene.renderer.dispose(); host.remove();
    delete globalThis.voyagerCampusAcceptance;
  });
  assert.deepEqual(errors, []);
  console.log('PASS: Voyager rocket tower, unique token-80 billboard, both 3D faces, raycast purchase, sidepanel checkout and cleanup.');
} finally {
  await browser.close();
}
