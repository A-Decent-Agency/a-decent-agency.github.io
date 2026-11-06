import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 980 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.OFFICE_URL || 'http://127.0.0.1:8930/');
  await page.waitForSelector('#scene canvas');
  await page.locator('#flight-camera').selectOption('orbit');
  await page.locator('#flight-destination').selectOption('project:thejollylama/decentvoyager');
  assert.match(await page.locator('.campus-art-brief').first().innerText(), /spaceport/);
  assert.match(await page.locator('.support-callout .mint-buy').getAttribute('data-mint-checkout'), /listingId=19/);
  const result = await page.evaluate(async () => {
    const [{ ConstructionScene }, { createVoyagerTraffic, REWARD_EVENTS, VOYAGER_GAME_ID }, project, feed] = await Promise.all([
      import('./js/construction-scene.js'), import('./js/voyager-traffic.js'),
      fetch('./data/project.json').then(response => response.json()),
      fetch('./data/progress.json').then(response => response.json())
    ]);
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#100e1d';
    document.body.append(host);
    const scene = new ConstructionScene(host, { onSite() {}, onFailure(message) { throw new Error(message); } });
    scene.setData(project.items, 'flight', 0, [], feed, { includeContext: true });
    scene.setActive(true); scene.setCamera('orbit');
    const site = scene.sites.find(site => site.project?.repository === 'TheJollyLaMa/DecentVoyager');
    scene.goTo(site.index, { immediate: true }); scene.setPaused(true);
    const structures = ['voyager-runway', 'voyager-control-tower', 'voyager-radar'].map(name =>
      Boolean(scene.spaceport.group.getObjectByName(name)));
    let head = 103, hasEvents = false;
    const reports = [];
    const response = value => ({ ok: true, text: async () => JSON.stringify(value) });
    const observer = createVoyagerTraffic({
      fetcher: async (url, init) => {
        if (url.includes('githubusercontent')) return response(url.includes('victory') ?
          { pending: hasEvents ? [{ recordId: 'fixture-only-not-published' }] : [], minted: [] } :
          { pending: [], settled: [] });
        const { method } = JSON.parse(init.body);
        const log = { address: REWARD_EVENTS[0].address, topics: [REWARD_EVENTS[0].topic, VOYAGER_GAME_ID, `0x${'c'.repeat(64)}`, `0x${'d'.repeat(64)}`],
          blockNumber: '0x65', logIndex: '0x0', transactionHash: `0x${'a'.repeat(64)}`, blockHash: `0x${'b'.repeat(64)}`, removed: false };
        return response({ result: method === 'eth_chainId' ? '0x2105' :
          method === 'eth_blockNumber' ? `0x${head.toString(16)}` : hasEvents ? [log] : [] });
      },
      onTraffic: (kind, count) => { reports.push([kind, count]); scene.enqueueVoyagerTraffic(kind, count); }
    });
    await observer.poll();
    const initial = scene.spaceport.snapshot();
    hasEvents = true; head = 106; await observer.poll(); await observer.poll();
    const paused = scene.spaceport.snapshot();
    scene.spaceport.update(1, false);
    scene.tick(performance.now());
    const frozen = scene.spaceport.snapshot();
    // Rebuilding the host preserves queued flights without replaying the public baseline.
    scene.setData(project.items, 'flight', 0, [], feed, { includeContext: true });
    const rebuilt = scene.spaceport.snapshot();
    for (let frame = 0; frame < 60; frame++) scene.spaceport.update(1 / 30, true);
    const moving = scene.spaceport.snapshot();
    scene.setData(project.items, 'flight', 0, [], feed, { includeContext: true });
    const activeRebuild = scene.spaceport.snapshot();
    scene.enqueueVoyagerTraffic('arrival', 20);
    for (let frame = 0; frame < 300; frame++) scene.spaceport.update(1 / 30, true);
    const burst = scene.spaceport.snapshot();
    for (let frame = 0; frame < 3000; frame++) scene.spaceport.update(1 / 30, true);
    const drained = scene.spaceport.snapshot();
    scene.spaceport.update(1, false);
    const laserCount = scene.spaceport.group.children.filter(child => child.name === 'voyager-stray-laser').length;
    observer.dispose();
    scene.tick(performance.now());
    globalThis.spaceportAcceptance = { scene, host };
    return { structures, reports, initial, paused, frozen, rebuilt, moving, activeRebuild, burst, drained, laserCount };
  });
  assert.ok(result.structures.every(Boolean));
  assert.deepEqual(result.reports, [['arrival', 1], ['departure', 1]]);
  assert.equal(result.initial.active, 0, 'old history must not launch a fleet');
  assert.deepEqual(result.paused.queued, { arrival: 1, departure: 1 });
  assert.deepEqual(result.frozen, result.paused, 'pause/reduced motion must not consume flights');
  assert.deepEqual(result.rebuilt.queued, result.paused.queued);
  assert.equal(result.moving.active, 2);
  assert.deepEqual(result.activeRebuild.queued, { arrival: 1, departure: 1 }, 'in-flight ships survive scene rebuild');
  assert.ok(result.burst.active <= 6);
  assert.equal(result.drained.active, 0);
  assert.deepEqual(result.drained.queued, { arrival: 0, departure: 0 }, 'bursts must drain without dropped events');
  assert.equal(result.laserCount, 2);
  await page.waitForFunction(() => {
    const rocks = globalThis.spaceportAcceptance.scene.spaceport.group.children.filter(child => child.name === 'voyager-mandelblum');
    return rocks.length === 3 && rocks.every(rock => rock.children[1].material.map?.image?.width > 0);
  });
  if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH });
  await page.evaluate(() => {
    const { scene, host } = globalThis.spaceportAcceptance;
    scene.setActive(false); scene.clear();
    if (scene.spaceport || scene.group.children.length || scene.frame || scene.timer) throw new Error('Spaceport lifecycle did not stop');
    scene.renderer.dispose(); host.remove(); delete globalThis.spaceportAcceptance;
  });
  assert.deepEqual(errors, []);
  console.log('PASS: airport architecture, real-observer fixture arrivals/departures, baseline/dedupe, pause, rebuild, six-flight burst bounds, loaded Mandelblums and cleanup.');
} finally { await browser.close(); }
