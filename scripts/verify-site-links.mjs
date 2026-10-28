import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.OFFICE_URL || 'http://127.0.0.1:18791/';
const dcal = 'PVTI_lADODD7ovc4Bn91hzhELHuo';
const head = 'project:thejollylama/decenthead';
const market = 'project:thejollylama/decentmarket';
const address = (site, card) => {
  const url = new URL(base);
  url.searchParams.set('site', site);
  if (card) url.searchParams.set('card', card);
  return url.href;
};
const browser = await chromium.launch({ headless: true });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      reducedMotion: mobile ? 'reduce' : 'no-preference',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(address(dcal));
    await page.waitForFunction(id => document.querySelector('#flight-destination').value === id, dcal);
    assert.match(await page.locator('#flight-site-title').innerText(), /DecentCalendar/);
    const heading = await page.locator('#flight-site-title').boundingBox();
    assert.ok(heading.y >= 0 && heading.y < (mobile ? 844 : 1000), 'shared destination must be visible without hunting down the page');
    if (!mobile) {
      await page.waitForSelector('#scene canvas:visible');
      assert.match(await page.locator('#mode-button').innerText(), /2D list/);
    }
    await page.locator('#share-site').click();
    assert.equal(await page.locator('#share-address').inputValue(), address(dcal));
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.copiedSiteLink = value; } } });
    });
    await page.locator('#copy-site-address').click();
    assert.equal(await page.evaluate(() => window.copiedSiteLink), address(dcal));
    assert.equal(await page.locator('#share-status').innerText(), 'Link copied.');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Permission denied'); } } });
    });
    await page.locator('#copy-site-address').click();
    assert.match(await page.locator('#share-status').innerText(), /Could not copy.*Permission denied/);
    await page.locator('#share-dialog .dialog-close').click();

    await page.locator('#flight-site-items button').first().click();
    await page.locator('#share-card').click();
    const cardLink = await page.locator('#share-address').inputValue();
    assert.equal(new URL(cardLink).searchParams.get('card'), dcal);
    await page.locator('#share-dialog .dialog-close').click();
    await page.goto(cardLink);
    await page.waitForSelector('#detail-panel:not([hidden])');
    assert.match(await page.locator('#detail-title').innerText(), /DecentCalendar/);
    await page.locator('#close-detail').click();

    await page.locator('#flight-destination').selectOption(head);
    assert.equal(new URL(page.url()).searchParams.get('site'), head);
    await page.locator('#flight-destination').selectOption(market);
    await page.goBack();
    await page.waitForFunction(() => document.querySelector('#flight-site-title').textContent === 'DecentHead');
    await page.goForward();
    await page.waitForFunction(() => document.querySelector('#flight-site-title').textContent === 'DecentMarket');

    await page.locator('#search').fill('no matching projects');
    await page.goto(address(dcal));
    await page.waitForFunction(id => document.querySelector('#flight-destination').value === id, dcal);
    assert.equal(await page.locator('#search').inputValue(), '');
    if (!mobile) {
      await page.locator('#mode-button').click();
      await page.locator('#flight-destination').selectOption(head);
      await page.locator('#mode-button').click();
      await page.waitForSelector('#scene canvas:visible');
      assert.equal(await page.locator('#flight-destination').inputValue(), head);
      await page.reload();
      await page.waitForFunction(() => document.querySelector('#flight-site-title').textContent === 'DecentHead');
    }
    await page.goto(address('removed-or-withheld-site'));
    await page.waitForSelector('#site-link-status:not([hidden])');
    assert.match(await page.locator('#site-link-status').innerText(), /not in the current public roadmap/);
    await page.goto(address(dcal, 'removed-card'));
    await page.waitForSelector('#site-link-status:not([hidden])');
    assert.match(await page.locator('#flight-site-title').innerText(), /DecentCalendar/);
    assert.match(await page.locator('#site-link-status').innerText(), /card is no longer published/);
    await page.goto(base);
    await page.waitForFunction(() => document.querySelector('#sync-status').textContent.startsWith('LAST SYNCED'));
    await page.locator('#flight-destination').selectOption(head);
    await page.goBack();
    await page.waitForFunction(() => document.querySelector('#flight-site-title').textContent === 'Decent Agency');
    await page.getByRole('tab', { name: /Make your own/ }).click();
    await page.locator('#add-node').click();
    await page.locator('#node-form [name=title]').fill('Local-only private draft');
    await page.locator('#node-form button[type=submit]').click();
    await page.locator('#mode-button').evaluate(button => { if (!button.textContent.includes('3D space')) button.click(); });
    await page.locator('#list-view .list-card').filter({ hasText: 'Local-only private draft' }).click();
    assert.equal(await page.locator('#share-card').isVisible(), false);
    assert.deepEqual(errors, []);
    console.log(`PASS ${mobile ? 'mobile/2D/reduced-motion' : 'desktop/3D'}: direct DCal/card links, sharing, clipboard denial, Back/Forward, reload, unavailable links and local-map privacy.`);
    await context.close();
  }
} finally {
  await browser.close();
}
