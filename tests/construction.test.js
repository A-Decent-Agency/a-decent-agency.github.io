import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { constructionSites, siteMetrics, flightStep, routePoint, FLIGHT_BOUNDS, snapshotFreshness } from '../js/construction-model.js';

const item = (id, status = 'Todo', extra = {}) => ({ id, title: id, fields: { Status: status, Kind: 'Task', Workstream: 'Shared work', ...extra } });
test('cranes follow explicit board activity and footprint follows workload, never inferred completion', () => {
  assert.equal(siteMetrics([item('a')]).cranes, 1);
  assert.equal(siteMetrics([item('a', 'Done')]).cranes, 0);
  assert.equal(siteMetrics([item('a', 'Blocked')]).phase, 'Access restricted');
  assert.equal(siteMetrics([item('a', 'Blocked')]).active, 0);
  assert.equal(siteMetrics([item('a', 'In Progress')]).cranes, 2);
  const large = siteMetrics(Array.from({ length: 25 }, (_, i) => item(`${i}`, 'In Progress')));
  assert.equal(large.cranes, 6);
  assert.ok(large.scale > siteMetrics([item('a')]).scale);
  const barelyStarted = siteMetrics(Array.from({ length: 25 }, (_, i) => item(`${i}`)));
  assert.equal(barelyStarted.cranes, 1, 'a large backlog is not a busy construction site');
});
test('construction route partitions every public card once and follows real roadmap dates', () => {
  const items = [item('late', 'Todo', { Kind: 'Milestone', Start: '2027-01-01' }),
    item('early', 'In Progress', { Kind: 'Milestone', Target: '2026-10-23' }),
    item('undated', 'Todo', { Kind: 'Milestone', Horizon: 'Now' }),
    item('task'), item('private', 'Todo', { Workstream: '' })];
  const sites = constructionSites(items);
  assert.deepEqual(sites.slice(0, 2).map(site => site.id), ['early', 'late']);
  assert.equal(sites[0].start, '');
  assert.equal(sites[0].target, '2026-10-23');
  assert.equal(sites.find(site => site.id === 'undated').target, '');
  assert.equal(sites.find(site => site.type === 'workstream').start, '');
  assert.deepEqual(sites.flatMap(site => site.items.map(item => item.id)).sort(), items.map(item => item.id).sort());
  assert.equal(sites.find(site => site.title === 'Unassigned').items[0].id, 'private');
  assert.ok(sites.every((site, i) => site.position.z === -i * FLIGHT_BOUNDS.spacing));
});
test('snapshot changes dynamically rebuild cranes, statuses, dates and route destinations', () => {
  const original = [item('mile', 'Todo', { Kind: 'Milestone', Start: '2026-11-01' }), item('task')];
  const first = constructionSites(original);
  const changed = structuredClone(original);
  changed[0].fields.Status = 'Done'; changed[0].fields.Start = '2026-12-01';
  changed.push(item('new-mile', 'In Progress', { Kind: 'Milestone', Start: '2026-10-23' }));
  const second = constructionSites(changed);
  assert.equal(first.find(site => site.id === 'mile').cranes, 1);
  assert.equal(second.find(site => site.id === 'mile').cranes, 0);
  assert.equal(second[0].id, 'new-mile');
  assert.equal(second[0].active, 1);
  assert.equal(second.find(site => site.id === 'mile').start, '2026-12-01');
});
test('free steering stays in the route corridor and progress cannot escape its endpoints', () => {
  let state = { progress: 0, x: 0, y: 0 };
  for (let i = 0; i < 1000; i++) state = flightStep(state, new Set(['w', 'd', 'e', 'shift']), .05, 10);
  assert.deepEqual(state, { progress: 9, x: FLIGHT_BOUNDS.lateral, y: FLIGHT_BOUNDS.vertical });
  for (let i = 0; i < 1000; i++) state = flightStep(state, new Set(['s', 'a', 'q']), .05, 10);
  assert.deepEqual(state, { progress: 0, x: -FLIGHT_BOUNDS.lateral, y: -FLIGHT_BOUNDS.vertical });
  assert.deepEqual(flightStep({ progress: 0, x: 0, y: 0 }, new Set(['w']), 100, 5), flightStep({ progress: 0, x: 0, y: 0 }, new Set(['w']), .05, 5));
  assert.equal(Math.abs(routePoint(0).z), 0);
  assert.equal(routePoint(2).z, -220);
  assert.equal(flightStep({ progress: 0, x: 0, y: 0 }, new Set(['w']), .05, 0).progress, 0);
});
test('real public snapshot remains the sole source, with no omissions or private-detail reconstruction', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../data/project.json', import.meta.url)));
  const sites = constructionSites(snapshot.items);
  assert.equal(sites.filter(site => site.type === 'milestone').length, snapshot.items.filter(item => item.fields.Kind === 'Milestone').length);
  assert.equal(sites.reduce((count, site) => count + site.total, 0), snapshot.items.length);
  assert.deepEqual(sites.flatMap(site => site.items.map(item => item.id)).sort(), snapshot.items.map(item => item.id).sort());
  for (const site of sites) for (const entry of site.items.filter(item => item.private)) {
    assert.equal(entry.repository, '');
    assert.equal(entry.body, '');
  }
});
test('freshness describes last changed snapshot, not a false real-time guarantee', () => {
  const now = Date.parse('2026-10-23T12:00:00Z');
  assert.match(snapshotFreshness('2026-10-23T11:00:00Z', now), /Recent/);
  assert.match(snapshotFreshness('2026-10-20T11:00:00Z', now), /over a day/);
  assert.match(snapshotFreshness('invalid', now), /unavailable/);
  assert.match(snapshotFreshness('2027-10-20T11:00:00Z', now), /invalid/);
});
