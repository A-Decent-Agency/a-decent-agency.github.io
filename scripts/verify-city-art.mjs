import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.OFFICE_URL || 'http://127.0.0.1:8073/';
const shots = process.env.SCREENSHOT_DIR || 'office-shots';
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ headless: true });
const campuses = [
  ['TheJollyLaMa/BigNuten_Vanilla', 'Training & nutrition campus'],
  ['A-Decent-Agency/a-decent-agency.github.io', 'Agency Town Hall'],
  ['TheJollyLaMa/DecentPilgrimages', 'Pilgrimage temple'],
  ['A-Decent-Agency/DecentJukebox', 'Jukebox museum'],
  ['TheJollyLaMa/DecentBusking', 'Concert venue & busking corner'],
  ['TheJollyLaMa/DecentInvoice', 'Invoice business office'],
  ['TheJollyLaMa/DecentEscrow', 'Escrow business office'],
  ['TheJollyLaMa/Decent_NDA', 'NDA law office'],
  ['A-Decent-Agency/DBuskRadio', 'Radio listening station'],
  ['A-Decent-Agency/DVert', 'Advertising design studio']
];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.waitForSelector('#flight-destination option[value="project:a-decent-agency/dvert"]', { state: 'attached' });
  await page.waitForSelector('#scene canvas:visible');
  await page.locator('#motion-button').click();
  const destinations = await page.locator('#flight-destination option').evaluateAll(options => options.map(option => ({ value: option.value, label: option.textContent })));
  assert.ok(destinations.every(option => /^(project:|entity:)/.test(option.value)), 'every road exit is a project, not a workflow category');
  const geometry = await page.evaluate(async campuses => {
    const THREE = await import('three');
    const { buildCampus } = await import('./js/campus-buildings.js');
    const { constructionSites } = await import('./js/construction-model.js');
    const { campusStructure } = await import('./js/project-campus.js');
    const snapshot = await (await fetch('./data/project.json')).json();
    const feed = await (await fetch('./data/progress.json')).json();
    const sites = constructionSites(snapshot.items, { includeContext: true });
    const results = [];
    for (const [repository, name] of campuses) {
      const site = sites.find(site => !site.project?.entityId && site.project?.repository.toLowerCase() === repository.toLowerCase());
      const model = campusStructure(site, feed), before = JSON.stringify(model);
      const group = new THREE.Group();
      buildCampus(group, site, model);
      if (before !== JSON.stringify(model)) throw new Error(`${name}: artwork mutated construction evidence`);
      let meshes = 0, instances = 0, triangles = 0;
      group.traverse(object => {
        if (!object.isMesh) return;
        meshes++;
        const count = object.isInstancedMesh ? object.count : 1;
        if (object.isInstancedMesh) instances += count;
        triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3 * count;
        if (!object.position.toArray().every(Number.isFinite)) throw new Error(`${name}: invalid mesh position`);
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
        if (object.isInstancedMesh) object.dispose();
      });
      results.push({ name, meshes, instances, triangles });
    }
    return results;
  }, campuses);
  for (const result of geometry) {
    assert.ok(result.instances > 20, `${result.name}: decorative boxes remain batched`);
    assert.ok(result.meshes < 60, `${result.name}: fewer than 60 campus mesh draws`);
    assert.ok(result.triangles < 100000, `${result.name}: bounded geometry`);
  }
  await page.locator('#flight-panel-toggle').click();
  await page.locator('#flight-site').waitFor({ state: 'hidden' });
  for (const [repository, name] of campuses) {
    await page.locator('#flight-destination').selectOption(`project:${repository.toLowerCase()}`);
    await page.waitForFunction(name => document.querySelector('.campus-art-brief h4')?.textContent === name, name);
    await page.locator('#flight-camera').selectOption('landmark');
    await page.locator('#flight-zoom').fill('0.9');
    await page.locator('#flight-zoom').dispatchEvent('input');
    await page.waitForTimeout(100);
    await page.locator('#scene').screenshot({ path: `${shots}/city-${repository.split('/')[1].toLowerCase()}.png` });
  }
  await page.locator('#flight-panel-toggle').click();
  for (const repository of ['DecentJukebox', 'DVert', 'DBuskRadio']) {
    await page.locator('#flight-destination').selectOption(`project:a-decent-agency/${repository.toLowerCase()}`);
    const widget = page.locator('.campus-widget');
    assert.match(await widget.innerText(), /existing ENS identity and Supporter edition/i);
    assert.equal(await widget.locator('a[href*="CLONE_AND_ADAPT.md"]').count(), 1);
    assert.equal(await widget.locator('[data-mint-checkout]').count(), 1, 'support action reuses observed approved storefront');
  }
  const before = await page.locator('#flight-site-title').innerText();
  await page.locator('#flight-panel-toggle').click();
  await page.locator('#flight-site').waitFor({ state: 'hidden' });
  await page.locator('#flight-panel-toggle').click();
  assert.equal(await page.locator('#flight-site-title').innerText(), before);
  assert.deepEqual(errors, []);
  await page.close();
  for (const width of [375, 320]) {
    const mobile = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await mobile.goto(base);
    await mobile.locator('#flight-destination').selectOption('project:thejollylama/bignuten_vanilla');
    assert.match(await mobile.locator('.campus-art-brief').innerText(), /Training & nutrition campus/);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await mobile.close();
  }
  console.log(JSON.stringify({ result: 'PASS', projects: destinations.length, geometry, mobile: [375, 320], evidenceUnchanged: true, pageErrors: errors }, null, 2));
} finally {
  await browser.close();
}
