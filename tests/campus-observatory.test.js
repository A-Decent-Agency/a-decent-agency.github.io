import test from 'node:test';
import assert from 'node:assert/strict';
import { CANOPY } from '../js/canopy-registry.js';
import { constructionSites } from '../js/construction-model.js';
import { campusStructure } from '../js/project-campus.js';
import { campusConnections } from '../js/campus-graph.js';
import { renderCampusPlan } from '../js/campus-plan.js';
import { sanitizeItem } from '../js/project.js';
const card = (id, repository, status = 'Todo') => ({ id, title: id, repository, fields: { Kind: 'Issue', Status: status, Component: 'Storage', Horizon: 'Now' } });
test('minted floors stay clean and separate active jobs from delivered structure', () => {
  const repository = 'TheJollyLaMa/DecentHead';
  const site = constructionSites([card('finished', repository, 'Done')])[0];
  const feed = { repositories: [{ repository, codeBytes: 50000, versions: [{ tag: 'v2' }] }] };
  const clean = campusStructure(site, feed);
  assert.equal(clean.deliveredFloors, 1);
  assert.equal(clean.messy, false); assert.equal(clean.buildCranes, 0);
  site.items.push(card('next', repository, 'In Progress'));
  const active = campusStructure(site, feed);
  assert.equal(active.deliveredFloors, 1); assert.equal(active.messy, true); assert.ok(active.buildCranes > 0);
  feed.repositories[0].versions.push({ tag: 'v3' });
  assert.equal(campusStructure(site, feed).floors, 2);
  assert.equal(campusStructure(site, { repositories: [{ repository, release: { tag: 'prepared' } }] }).deliveredFloors, 0);
});
test('code bytes affect bounded footprint, never a completion score; unavailable size uses neutral base', () => {
  const site = constructionSites([card('head', 'TheJollyLaMa/DecentHead')])[0];
  const shape = bytes => campusStructure(site, { repositories: [{ repository: site.project.repository, codeBytes: bytes }] });
  assert.ok(shape(1000000).width > shape(1000).width);
  assert.ok(shape(Number.MAX_SAFE_INTEGER).width <= 36 * 1.65);
  assert.equal(shape(1000000).floors, shape(1000).floors);
  assert.equal(shape(null).width, 36);
});
test('all public Canopy graph endpoints have contextual sites; private cards retain exact separate partition', () => {
  const items = [card('one', 'TheJollyLaMa/DecentBusking'), { ...card('private', 'private/hidden'), private: true }];
  const sites = constructionSites(items, { includeContext: true });
  assert.deepEqual(sites.flatMap(site => site.items.map(item => item.id)).sort(), ['one', 'private']);
  assert.ok(!sites.some(site => site.project?.repository === 'private/hidden'));
  assert.ok(sites.filter(site => !site.items.length).every(site => site.phase === 'Context / no mapped jobs' && site.cranes === 0));
  const links = campusConnections(sites, null);
  assert.equal(links.filter(link => link.kind !== 'revival proposal').length, CANOPY.connections.length);
  assert.ok(links.filter(link => link.kind === 'revival proposal').every(link => link.proposed && link.state === 'proposed'));
  assert.ok(links.some(link => link.proposed && link.state === 'proposed'));
  assert.ok(links.some(link => !link.proposed && link.state === 'observed'));
});
test('the 2D job plan contains the same jobs and components, escapes input and keeps project navigation explicit', () => {
  const item = card('<img onerror=x>', 'TheJollyLaMa/DecentBusking');
  const sites = constructionSites([item], { includeContext: true });
  const html = renderCampusPlan(sites.find(site => site.items.length), sites, null);
  assert.match(html, /Storage \/ 1 jobs/);
  assert.match(html, /data-campus-item=/);
  assert.match(html, /data-campus-site=/);
  assert.match(html, /&lt;img/); assert.doesNotMatch(html, /<img/);
  assert.match(html, /proposed crossover, not shipped/);
});
test('new planning metadata is public-allowlisted and stripped from private/registry portfolios', () => {
  const item = { id: 'draft', content: { title: 'Registry: private', body: 'no' }, fieldValues: { nodes: [
    { field: { name: 'Project' }, text: 'TheJollyLaMa/DecentBusking' }, { field: { name: 'Component' }, text: 'Private plans' },
  ] } };
  assert.equal(sanitizeItem(item).fields.Component, '');
  item.content.title = 'Public job';
  assert.equal(sanitizeItem(item).fields.Component, 'Private plans');
  item.fieldValues.nodes[0].text = 'private/unknown';
  assert.equal(sanitizeItem(item).fields.Component, '');
});
