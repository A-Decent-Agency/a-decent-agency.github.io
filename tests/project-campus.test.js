import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { constructionSites } from '../js/construction-model.js';
import { publicRepository, campusStructure } from '../js/project-campus.js';
import { renderCampusDetails } from '../js/campus-details.js';

const card = (id, repository, status = 'Todo') => ({ id, title: id, repository, fields: { Kind: 'Task', Status: status } });
test('project offramps use explicit identity, keep shared/private cards separate and partition exactly once', () => {
  const items = [card('busking', 'TheJollyLaMa/DecentBusking', 'Done'), card('head', 'TheJollyLaMa/DecentHead'),
    card('canopy', 'TheJollyLaMa/DecentCanopy'), card('next', 'TheJollyLaMa/BigNuten_Vanilla'),
    card('later', 'TheJollyLaMa/ArtFi'), { ...card('secret', 'private/hidden'), private: true },
    { ...card('milestone', 'TheJollyLaMa/DecentBusking'), fields: { Kind: 'Milestone' } }];
  const sites = constructionSites(items);
  assert.deepEqual(sites.filter(site => site.project).map(site => site.title), ['DecentBusking', 'DecentHead', 'DecentCanopy', 'BigNuten', 'ArtFi']);
  assert.deepEqual(sites.flatMap(site => site.items.map(item => item.id)).sort(), items.map(item => item.id).sort());
  assert.ok(!sites.some(site => site.project?.repository === 'private/hidden'));
  assert.equal(publicRepository({ ...items[0], bodyRedacted: true }), null);
  assert.equal(publicRepository({ id: 'unrelated', title: 'DecentBusking' }), null);
  assert.equal(publicRepository({ id: 'prose', body: 'Use https://github.com/TheJollyLaMa/DecentBusking', fields: { Kind: 'Task' } }), null);
});
test('architecture distinguishes tower, broad foundation, finished hall and raw sites without calling PR count a release', () => {
  const sites = constructionSites([card('busking', 'TheJollyLaMa/DecentBusking'), card('canopy', 'TheJollyLaMa/DecentCanopy'),
    card('head', 'TheJollyLaMa/DecentHead'), card('next', 'TheJollyLaMa/BigNuten_Vanilla')]);
  const structures = Object.fromEntries(sites.map(site => [site.title, campusStructure(site)]));
  assert.ok(structures.DecentBusking.height > structures.DecentHead.height);
  assert.ok(structures.DecentCanopy.width > structures.DecentBusking.width);
  assert.equal(structures.DecentHead.floors, 1);
  assert.equal(structures.BigNuten.floors, 0);
  assert.match(structures.DecentBusking.basis, /not a claim of a published v1 tag/);
  const busking = sites[0], before = campusStructure(busking).floors;
  busking.items.push(...Array.from({ length: 30 }, (_, index) => card(`done${index}`, busking.project.repository, 'Done')));
  assert.ok(campusStructure(busking).floors > before);
  assert.ok(campusStructure(busking).floors <= 12);
});
test('real snapshot keeps all cards and preserves raw private inventory without reconstructing identities', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../data/project.json', import.meta.url)));
  const sites = constructionSites(snapshot.items);
  assert.equal(sites[0].title, 'Decent Agency');
  for (const name of ['DecentBusking', 'DecentHead', 'DecentMarket', 'DecentCanopy', 'BigNuten']) assert.ok(sites.some(site => site.title === name));
  assert.equal(sites.reduce((sum, site) => sum + site.items.length, 0), snapshot.items.length);
});
test('project detail follows Canopy provenance/disclosure pattern and does not hide unavailable observations', () => {
  const site = constructionSites([card('busking', 'TheJollyLaMa/DecentBusking', 'Done')])[0];
  const feed = { repositories: [{ repository: site.project.repository, state: 'unavailable', checkedAt: null, error: 'Fetch failed', release: null,
    mergedPulls: [{ url: 'https://github.com/TheJollyLaMa/DecentBusking/pull/1', title: '<img onerror=bad>', mergedAt: '2026-10-25T00:00:00Z' }] }],
    connections: [] };
  const html = renderCampusDetails(site, feed);
  assert.match(html, /Unavailable \/ retained observation/);
  assert.match(html, /not live network traffic/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img/);
});
