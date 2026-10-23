import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalGitHubURL, mountPlanningDock, renderPlanningDock } from '../js/planning-dock.js';

const item = (id, fields = {}, extra = {}) => ({ id, title: id, fields: { Status: 'Todo', Workstream: 'Build', ...fields }, ...extra });
const snapshot = items => ({ schemaVersion: 1, exportedAt: '2026-10-23T10:00:00Z', items });
const site = items => ({ id: 'workstream:Build', type: 'workstream', title: 'Build', items });
const render = (items, extra = {}) => renderPlanningDock({ site: site(items), current: snapshot(items), ...extra });

test('canonical links reject executable, offsite, credential and non-reference URLs', () => {
  for (const bad of ['javascript:alert(1)', '//github.com/a/b', 'https://evil.test/a/b',
    'https://github.com.evil.test/a/b', 'https://user:pass@github.com/a/b', 'https://github.com/a/b/actions',
    'https://github.com/a/b/issues/nope', 'http://github.com/a/b', 'https://github.com:444/a/b']) {
    assert.equal(canonicalGitHubURL(bad), '');
  }
  assert.equal(canonicalGitHubURL('https://github.com/a/b/issues/12?token=private#fragment'), 'https://github.com/a/b/issues/12');
  assert.equal(canonicalGitHubURL('https://github.com/orgs/a/projects/1?pane=issue&itemId=42&token=private'),
    'https://github.com/orgs/a/projects/1?pane=issue&itemId=42');
});

test('dock displays actual Outcome/evidence, remaining cards, explicit relations without inference', () => {
  const cards = [item('unfinished', { Outcome: 'Finish line', Dependencies: 'Needs source #3', Crossovers: 'https://github.com/a/b/issues/4' },
    { body: 'Evidence: https://github.com/a/b/pull/5', url: 'https://github.com/a/b/issues/3' }), item('done', { Status: 'Done' })];
  const html = render(cards);
  for (const phrase of ['Finish line', 'Evidence:', 'Remaining actual cards (1 / 2)', 'Dependencies — explicit source field',
    'Crossovers — explicit source field', 'Needs source #3', 'not independent delivery verification',
    'never resolved from prose', 'in memory only', 'First observation', 'Open source card']) assert.ok(html.includes(phrase), phrase);
  assert.match(html, /href="https:\/\/github.com\/a\/b\/issues\/4"/);
  assert.match(html, /<details><summary>Published notes \/ evidence/);
  const remaining = html.split('Remaining actual cards')[1].split('<details>')[0];
  assert.ok(remaining.includes('unfinished'));
  assert.ok(!remaining.includes('data-dock-item="done"'));
});

test('empty, invalid and missing site states are explicit', () => {
  assert.match(render([]), /No published cards at this site/);
  assert.match(render([], { current: { error: 'failed' } }), /publication unavailable/);
  assert.match(render([], { site: null }), /Select a site/);
  assert.match(render([item('a', { Status: 'Done' })]), /All site cards are marked Done in the source/);
});

test('escapes untrusted HTML and withholds restricted details even from stale site objects', () => {
  const attack = '<img src=x onerror="alert(1)">';
  const a = item('"><script>', { Outcome: attack, Dependencies: attack, Crossovers: attack }, { title: attack, body: attack });
  const html = render([a], { site: { ...site([a]), title: attack } });
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;img/);
  assert.match(html, /data-dock-item="&quot;&gt;&lt;script&gt;"/);
  for (const flag of ['private', 'bodyRedacted']) {
    const safe = { ...a, id: 'a', title: 'Allowed title', [flag]: true };
    const output = render([safe], { site: site([a, safe]) });
    assert.ok(!output.includes('onerror'));
    assert.match(output, /Details intentionally withheld/);
  }
});

test('site changes include removed workstream cards without leaking baseline titles', () => {
  const before = [item('gone', {}, { title: 'OLD PRIVATE TITLE' }), item('kept')];
  const now = [item('kept', { Status: 'Done', Target: '2026-10-25' })];
  const html = render(now, { previous: snapshot(before) });
  assert.match(html, /Card removed from publication \(not a completion\)/);
  assert.match(html, /Todo → Done/);
  assert.match(html, /Target unset → 2026-10-25/);
  assert.ok(!html.includes('OLD PRIVATE TITLE'));
  assert.match(render(now, { previous: snapshot([...now].reverse()) }), /No observed card changes/);
});

test('mount/update/destroy delegate only current site cards and release callback state', () => {
  const listeners = new Map();
  const container = {
    innerHTML: '', addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name), contains: node => node.inside,
  };
  const cards = [item('a')], selected = [];
  const dock = mountPlanningDock({ container, site: site(cards), current: snapshot(cards), onItem: card => selected.push(card.id) });
  const click = (id, inside = true) => listeners.get('click')({ target: { closest: () => ({ inside, dataset: { dockItem: id } }) } });
  click('a'); click('unknown'); click('a', false);
  assert.deepEqual(selected, ['a']);
  const next = [item('b')];
  dock.update({ site: site(next), previous: snapshot(cards), current: snapshot(next) });
  click('a'); click('b');
  assert.deepEqual(selected, ['a', 'b']);
  assert.match(container.innerHTML, /1 added/);
  dock.destroy();
  assert.equal(container.innerHTML, '');
  assert.equal(listeners.size, 0);
  dock.update({ current: snapshot(cards) });
  assert.equal(container.innerHTML, '');
  assert.throws(() => mountPlanningDock({}), /DOM container/);
});
