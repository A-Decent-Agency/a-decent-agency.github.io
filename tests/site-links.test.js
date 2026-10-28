import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { constructionSites } from '../js/construction-model.js';
import { siteAddress, resolveSiteAddress, siteForCard } from '../js/site-links.js';

const sites = [
  { id: 'project:owner/head', items: [{ id: 'card-1' }] },
  { id: 'workstream:Storage and recovery', items: [{ id: 'card-2' }] },
  { id: 'milestone-1', items: [{ id: 'milestone-1' }] },
];
test('stable addresses encode IDs, preserve deployment paths and drop unrelated state', () => {
  const link = siteAddress('https://office.test/ipfs/bafy/index.html?token=secret&filter=private#draft', sites[1].id, 'card-2');
  const url = new URL(link);
  assert.equal(url.pathname, '/ipfs/bafy/index.html');
  assert.deepEqual([...url.searchParams], [['site', sites[1].id], ['card', 'card-2']]);
  assert.equal(url.hash, '');
  assert.equal(resolveSiteAddress(link, sites).site, sites[1]);
  assert.equal(resolveSiteAddress(link, sites).card.id, 'card-2');
  assert.equal(resolveSiteAddress(link, [...sites].reverse()).site, sites[1]);
});
test('projects, milestone checkpoints and workstreams round-trip independently of route order', () => {
  for (const site of sites) {
    const result = resolveSiteAddress(siteAddress('http://localhost:8000/', site.id), [...sites].reverse());
    assert.equal(result.site, site);
    assert.equal(result.card, null);
  }
  assert.equal(siteForCard(sites, 'card-2'), sites[1]);
  assert.equal(siteForCard(sites, 'local-map-only'), undefined);
});
test('unknown, missing, duplicate, malformed and cross-site cards fail explicitly', () => {
  assert.equal(resolveSiteAddress('https://office.test/?other=1', sites), null);
  for (const query of ['site=', 'card=card-1', 'site=x&site=y', 'site=%00', 'site=missing', 'site=milestone-1&card=missing', 'site=milestone-1&card=card-1', 'site=milestone-1&card=a&card=b']) {
    assert.ok(resolveSiteAddress(`https://office.test/?${query}`, sites).error, query);
  }
  assert.equal(resolveSiteAddress('https://office.test/?site=milestone-1&card=missing', sites).site, sites[2]);
  assert.throws(() => siteAddress('file:///index.html', sites[0].id), /HTTP/);
  assert.throws(() => siteAddress('https://office.test/', ''), /published/);
});
test('every real published site is addressable, including the approved DCal checkpoint', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../data/project.json', import.meta.url)));
  const route = constructionSites(snapshot.items, { includeContext: true });
  for (const site of route) {
    const link = siteAddress('https://a-decent-agency.github.io/', site.id);
    assert.equal(resolveSiteAddress(link, route).site.id, site.id);
    for (const card of site.items) {
      const cardLink = siteAddress('https://a-decent-agency.github.io/', site.id, card.id);
      assert.equal(resolveSiteAddress(cardLink, route).card.id, card.id);
    }
  }
  const dcal = route.find(site => site.id === 'PVTI_lADODD7ovc4Bn91hzhELHuo');
  assert.ok(dcal);
  assert.match(dcal.title, /DecentCalendar/);
  assert.equal(dcal.project, undefined, 'do not invent a public repository campus from a private portfolio');
});
