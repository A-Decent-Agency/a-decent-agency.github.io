import test from 'node:test';
import assert from 'node:assert/strict';
import { compareSnapshots, isPublishedSnapshot, summarizeChanges } from '../js/planning-changes.js';

const item = (id, fields = {}, extra = {}) => ({ id, title: id, fields: { Status: 'Todo', ...fields }, ...extra });
const snapshot = (items = [], exportedAt = '2026-10-23T10:00:00Z') => ({
  schemaVersion: 1, exportedAt, url: 'https://github.com/orgs/example/projects/1', items,
});

test('first observation and empty compared publication are distinct', () => {
  const first = compareSnapshots(null, snapshot());
  assert.equal(first.kind, 'first-observation');
  assert.equal(first.changed, null);
  assert.match(summarizeChanges(first), /First observation/);
  assert.equal(compareSnapshots(snapshot(), snapshot()).changed, false);
  assert.match(summarizeChanges(compareSnapshots(snapshot(), snapshot())), /No observed card changes/);
});

test('rejects failed, incomplete, duplicate, malformed and wrong-project publications', () => {
  for (const bad of [null, {}, { error: 'HTTP 500' }, snapshot(null), snapshot([item('a'), item('a')]),
    snapshot([{ id: 'a', title: 'a' }]), snapshot([item('')]), snapshot([item('a', { Status: {} })]),
    snapshot([], 'invalid'), { ...snapshot(), exportedAt: 10 }, { ...snapshot(), error: 'failed' }]) {
    assert.equal(isPublishedSnapshot(bad), false);
    assert.equal(compareSnapshots(snapshot(), bad).kind, 'unavailable');
  }
  assert.equal(compareSnapshots({}, snapshot()).kind, 'unavailable');
  assert.equal(compareSnapshots(snapshot(), { ...snapshot(), url: 'another-project' }).kind, 'unavailable');
  assert.equal(compareSnapshots(snapshot([], '2026-10-24T00:00:00Z'), snapshot()).kind, 'unavailable');
});

test('stable IDs distinguish additions, removals, status, blocked, Done and explicit date shifts', () => {
  const before = snapshot([item('removed'), item('blocked'), item('done', { Status: 'Blocked' }),
    item('dates', { Start: '2026-10-01', Target: '2026-10-25' })]);
  const current = snapshot([item('added', { Status: 'Done' }), item('blocked', { Status: 'Blocked' }),
    item('done', { Status: 'Done' }), item('dates', { Start: '', Target: '2026-10-28' })]);
  const result = compareSnapshots(before, current);
  assert.deepEqual(result.added, ['added']);
  assert.deepEqual(result.removed, ['removed']);
  assert.deepEqual(result.newlyBlocked, ['blocked']);
  assert.deepEqual(result.completed, ['done']);
  assert.deepEqual(result.statusChanges, [{ id: 'blocked', from: 'Todo', to: 'Blocked' }, { id: 'done', from: 'Blocked', to: 'Done' }]);
  assert.deepEqual(result.dateShifts, [
    { id: 'dates', field: 'Start', from: '2026-10-01', to: '' },
    { id: 'dates', field: 'Target', from: '2026-10-25', to: '2026-10-28' },
  ]);
});

test('reordered items, fields and multi-selects plus timestamp-only refresh are unchanged', () => {
  const before = snapshot([item('b'), item('a', { 'Baseline met': ['Tests', 'License'], Outcome: 'source' })]);
  const after = snapshot([item('a', { Outcome: 'source', 'Baseline met': ['License', 'Tests'] }), item('b')], '2026-10-24T00:00:00Z');
  const frozen = JSON.stringify(before);
  assert.equal(compareSnapshots(before, after).changed, false);
  assert.equal(JSON.stringify(before), frozen);
});

test('prose changes do not imply Done or dependency satisfaction; outputs contain no bodies', () => {
  const before = snapshot([item('a', {}, { body: 'old' })]);
  const after = snapshot([item('a', { Outcome: 'Delivered; dependency satisfied!', Dependencies: 'all done' }, { body: 'secret evidence' })]);
  const result = compareSnapshots(before, after);
  assert.equal(result.changed, true);
  assert.deepEqual(result.completed, []);
  assert.deepEqual(result.updated, ['a']);
  assert.ok(!JSON.stringify(result).includes('secret evidence'));
});

test('private and redacted details never participate in visible change claims', () => {
  for (const restriction of [{ private: true }, { bodyRedacted: true }]) {
    const before = snapshot([item('a', { Outcome: 'private old' }, { ...restriction, body: 'old' })]);
    const after = snapshot([item('a', { Outcome: 'private new' }, { ...restriction, body: 'new' })]);
    assert.equal(compareSnapshots(before, after).changed, false);
    after.items[0].fields.Status = 'Done';
    assert.deepEqual(compareSnapshots(before, after).completed, ['a']);
  }
});
