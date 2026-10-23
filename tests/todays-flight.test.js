import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { todaysFlight, dependencyEvidence } from '../js/todays-flight.js';
import { constructionSites } from '../js/construction-model.js';
import { mount } from '../js/todays-flight-ui.js';

const item = (id, fields = {}, extra = {}) => ({
  id, title: `Task ${id}`, type: 'draft',
  fields: { Kind: 'Work', Status: 'Todo', Workstream: 'Shared infrastructure', ...fields }, ...extra,
});
const group = (route, id) => route.groups.find(entry => entry.id === id);

test('explicit active status is evidence; prose, Horizon and dates do not imply activity', () => {
  const route = todaysFlight([
    item('active', { Status: 'In Progress' }),
    item('now', { Horizon: 'Now', Start: '2026-10-23' }, { body: 'In Progress; ready for review' }),
    item('done', { Status: 'Done' }),
  ]);
  assert.deepEqual(route.stops.map(stop => stop.itemId), ['active']);
  assert.deepEqual(route.stops[0].evidence, [{ field: 'Status', value: 'In Progress' }]);
  assert.match(route.stops[0].why, /explicitly/);
});

test('PRs, URLs and positive or negated review prose cannot establish readiness', () => {
  const route = todaysFlight([
    item('pr', {}, { type: 'PR', url: 'https://github.com/org/repo/pull/1', body: 'Ready for review; tests passed' }),
    item('not', {}, { body: 'Not ready for review. Awaiting review; merged yesterday.' }),
    item('explicit', { 'Review status': 'Ready for review' }, { type: 'PR' }),
    item('status', { Status: 'Review ready' }),
    item('done', { Status: 'Done', 'Review status': 'Ready' }),
    item('blocked', { Status: 'Blocked', 'Review status': 'Ready' }),
  ]);
  assert.deepEqual(group(route, 'review').stops.map(stop => stop.itemId), ['explicit', 'status']);
  assert.match(group(route, 'review').stops[0].why, /not approved, merged or deployed/);
  assert.equal(group(route, 'blockers').total, 1);
});

test('blockers and open decision cards are explicit, never inferred from Undecided or prose', () => {
  const route = todaysFlight([
    item('blocked', { Status: 'Blocked' }),
    item('decision', { Kind: 'Decision' }),
    item('undecided', { Decision: 'Undecided' }),
    item('prose', {}, { body: 'Blocked on a steward decision.' }),
    item('closed', { Kind: 'Decision', Status: 'Done' }),
    item('unknown', { Kind: 'Decision', Status: '' }),
  ]);
  assert.deepEqual(group(route, 'blockers').stops.map(stop => stop.itemId), ['blocked', 'decision']);
  assert.match(group(route, 'blockers').stops[0].why, /does not establish what decision/);
  assert.match(group(route, 'blockers').stops[1].why, /does not prove other work is blocked/);
});

test('only a complete explicit list of Done prerequisites or explicit none permits next', () => {
  const done = item('done', { Status: 'Done' }, { title: 'M1 — Foundation', url: 'https://github.com/org/repo/issues/1' });
  for (const Dependencies of ['M1', done.id, done.title, done.url, 'Requires: M1', 'Depends on: M1; done', 'M1\nM1', 'None', 'No dependencies.']) {
    const task = item('task', { Dependencies });
    const route = todaysFlight([done, task]);
    assert.deepEqual(group(route, 'next').stops.map(stop => stop.itemId), ['task'], Dependencies);
    assert.equal(group(route, 'next').stops[0].dependency.state, 'satisfied');
  }
});

test('missing, prose, partial, ambiguous, self and filtered prerequisites remain unknown', () => {
  const done = item('done', { Status: 'Done' }, { title: 'M1 — Foundation' });
  for (const Dependencies of ['', 'M1 is done; steward approval required', 'M1; unknown', 'M1,', 'task', 'M2', 'M1 -> task', 'None. Completed foundation']) {
    const task = item('task', { Dependencies });
    const route = todaysFlight([done, task]);
    assert.equal(group(route, 'next').total, 0, Dependencies);
    assert.equal(route.unknownDependencies, 1, Dependencies);
  }
  assert.equal(dependencyEvidence(item('task', { Dependencies: 'M1' }), [
    done, item('duplicate-alias', { Status: 'Done' }, { title: 'M1 — Another' }),
  ]).state, 'unknown');
  assert.equal(dependencyEvidence(item('task', { Dependencies: 'M1' }), []).state, 'unknown');
});

test('unfinished and cyclic prerequisites cannot be suggested as unblocked', () => {
  const a = item('a', { Dependencies: 'b' }), b = item('b', { Dependencies: 'a' });
  const route = todaysFlight([a, b]);
  assert.equal(group(route, 'next').total, 0);
  assert.equal(route.waitingDependencies, 2);
  assert.equal(dependencyEvidence(a, [a, b]).state, 'waiting');
});

test('private records use public Status only and never establish dependency eligibility', () => {
  const privateItem = item('private', { Status: 'In Progress', Dependencies: 'None', 'Review status': 'Ready' }, { private: true });
  const route = todaysFlight([privateItem, item('todo', { Dependencies: 'None' }, { private: true })]);
  assert.deepEqual(route.stops.map(stop => stop.itemId), ['private']);
  assert.equal(route.stops[0].dependency.state, 'unknown');
  assert.deepEqual(route.stops[0].evidence, [{ field: 'Status', value: 'In Progress' }]);
  assert.equal(group(route, 'review').total, 0);
  assert.equal(group(route, 'next').total, 0);
});

test('portfolio, milestone, registry and decision records are not next task suggestions', () => {
  const route = todaysFlight(['Portfolio', 'Milestone', 'Registry', 'Decision'].map(Kind => item(Kind, { Kind, Dependencies: 'None' })));
  assert.equal(group(route, 'next').total, 0);
  assert.equal(route.unknownDependencies, 0);
});

test('bounds, IDs and tie-breaking are stable and inputs remain unchanged', () => {
  const items = Array.from({ length: 12 }, (_, i) => item(`a${String(i).padStart(2, '0')}`, { Status: 'In Progress' }));
  const original = JSON.stringify(items);
  const route = todaysFlight(items);
  assert.equal(group(route, 'active').stops.length, 3);
  assert.equal(group(route, 'active').omitted, 9);
  assert.equal(group(todaysFlight(items, { maxPerGroup: 1000 }), 'active').stops.length, 5);
  assert.equal(group(todaysFlight(items, { maxPerGroup: 0 }), 'active').stops.length, 1);
  assert.equal(group(todaysFlight(items, { maxPerGroup: NaN }), 'active').stops.length, 3);
  assert.deepEqual(todaysFlight([...items].reverse()), route);
  assert.equal(JSON.stringify(items), original);
  assert.equal(route.stops[0].id, 'todays-flight:active:a00');
  assert.equal(todaysFlight().stops.length, 0);
});

test('duplicate IDs and malformed records fail closed', () => {
  const duplicate = item('duplicate', { Status: 'Done' });
  const route = todaysFlight([null, {}, duplicate, duplicate, item('task', { Dependencies: 'duplicate' })]);
  assert.equal(route.excludedDuplicateIds, 1);
  assert.equal(route.stops.length, 0);
  assert.equal(route.unknownDependencies, 1);
});

test('real snapshot route is bounded, explainable and maps to existing construction sites', async () => {
  const project = JSON.parse(await readFile(new URL('../data/project.json', import.meta.url), 'utf8'));
  const before = JSON.stringify(project);
  const route = todaysFlight(project.items);
  const sites = constructionSites(project.items);
  assert.ok(route.stops.length > 0);
  assert.ok(route.stops.length <= 12);
  assert.ok(route.unknownDependencies > 0);
  for (const stop of route.stops) {
    assert.ok(stop.why.length);
    assert.ok(stop.evidence.length);
    assert.ok(sites.some(site => site.id === stop.destinationId && site.items.some(item => item.id === stop.itemId)));
    if (stop.group === 'review') assert.ok(stop.evidence.some(entry => ['Review status', 'Status'].includes(entry.field)));
    if (stop.group === 'next') assert.equal(stop.dependency.state, 'satisfied');
  }
  assert.equal(JSON.stringify(project), before);
});

class Element {
  constructor(tag, ownerDocument) { this.tag = tag; this.ownerDocument = ownerDocument; this.children = []; this.attributes = {}; this.listeners = {}; }
  append(node) { this.children.push(node); node.parent = this; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  replaceChildren() { this.children = []; }
  remove() { this.parent.children = this.parent.children.filter(node => node !== this); }
}
const descendants = node => [node, ...node.children.flatMap(descendants)];

test('UI uses plain text, has named buttons, calls read-only navigation and supports update/destroy', () => {
  const doc = { createElement: tag => new Element(tag, doc) };
  const container = doc.createElement('div');
  const source = item('unsafe', { Status: 'In Progress' }, { title: '<img src=x onerror=alert(1)>' });
  let destination, opened;
  const ui = mount({ container, items: [source], onDestination: id => { destination = id; }, onItem: item => { opened = item; } });
  const nodes = descendants(container);
  assert.ok(nodes.some(node => node.tag === 'strong' && node.textContent === source.title));
  assert.ok(!nodes.some(node => node.tag === 'img'));
  const buttons = nodes.filter(node => node.tag === 'button');
  assert.equal(buttons.length, 2);
  for (const button of buttons) {
    assert.equal(button.type, 'button');
    assert.ok(button.attributes['aria-label'].includes(source.title));
    button.listeners.click();
  }
  assert.equal(destination, 'workstream:Shared infrastructure');
  assert.equal(opened, source);
  assert.equal(ui.update([]).stops.length, 0);
  assert.equal(descendants(container).filter(node => node.tag === 'button').length, 0);
  ui.destroy();
  assert.equal(container.children.length, 0);
});
