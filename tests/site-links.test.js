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
  const dcal = resolveSiteAddress('https://office.test/?site=PVTI_lADODD7ovc4Bn91hzhELHuo', route).site;
  assert.ok(dcal);
  assert.match(dcal.title, /DecentCalendar/);
  assert.equal(dcal.project.repository, 'TheJollyLaMa/DecentCalendar', 'explicit public repository record now owns the project campus');
  assert.equal(dcal.items.filter(item => item.id === 'PVTI_lADODD7ovc4Bn91hzhELHuo').length, 1);
  const legacyWorkstream = resolveSiteAddress('https://office.test/?site=workstream%3AStandards%20and%20reuse', route);
  assert.equal(legacyWorkstream.site.id, 'project:a-decent-agency/a-decent-agency.github.io');
});

test('legacy links accept only cards that belonged to that old checkpoint or workstream', () => {
  const route = [
    { id: 'project:owner/office', aliases: ['checkpoint', 'workstream:Shared work'], items: [
      { id: 'checkpoint', fields: { Kind: 'Milestone', Workstream: 'Shared work' } },
      { id: 'unrelated', fields: { Kind: 'Task', Workstream: 'Other work' } }
    ] },
    { id: 'project:owner/app', aliases: [], items: [
      { id: 'app-task', fields: { Kind: 'Task', Workstream: 'Shared work' } }
    ] }
  ];
  const resolve = (site, card) => resolveSiteAddress(siteAddress('https://office.test/', site, card), route);
  assert.equal(resolve('workstream:Shared work', 'app-task').site.id, 'project:owner/app');
  assert.equal(resolve('checkpoint', 'checkpoint').card.id, 'checkpoint');
  assert.ok(resolve('checkpoint', 'app-task').error);
  assert.ok(resolve('checkpoint', 'unrelated').error);
  assert.ok(resolve('workstream:Shared work', 'unrelated').error);
  assert.ok(resolve('workstream:Shared work', 'checkpoint').error);
  assert.ok(resolve('workstream:Shared work', 'removed').error);
  assert.ok(resolve('project:owner/office', 'app-task').error);
});
