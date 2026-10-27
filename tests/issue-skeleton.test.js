import test from 'node:test';
import assert from 'node:assert/strict';
import { milestoneStructure, isProgressFeed, REPOSITORIES } from '../js/progress-feed.js';
import { collectProgress } from '../scripts/sync-progress.mjs';
import { constructionSites } from '../js/construction-model.js';
import { campusStructure, issueSkeleton, LEVEL_HEIGHT } from '../js/project-campus.js';
import { renderCampusDetails } from '../js/campus-details.js';

const repository = 'TheJollyLaMa/BigNuten_Vanilla';
const milestone = (number, title, open, closed, state = 'open') => ({ number, title, open_issues: open, closed_issues: closed, state });

test('only Level N / Grounds milestones become planned structures, with canonical public milestone URLs', () => {
  assert.deepEqual(milestoneStructure(milestone(4, 'Level 2: Scrub and test', 3, 1), repository), {
    number: 4, kind: 'level', order: 2, name: 'Scrub and test', open: 3, closed: 1, state: 'open',
    url: `https://github.com/${repository}/milestone/4` });
  assert.equal(milestoneStructure(milestone(5, 'Grounds — Genie guide house', 0, 2, 'closed'), repository).kind, 'grounds');
  assert.equal(milestoneStructure(milestone(6, 'v3.3.0 release', 1, 0), repository), null);
  assert.equal(milestoneStructure(milestone(0, 'Level 1: bad number', 1, 0), repository), null);
});

test('feed validation accepts structures and rejects foreign URLs, duplicates and bad counts', async () => {
  const milestones = [milestone(1, 'Level 1: Land and stabilize', 2, 0), milestone(2, 'Grounds: Workshop', 0, 3), milestone(3, 'Backlog', 9, 9)];
  const fetcher = async url => {
    const reply = value => ({ ok: true, status: 200, json: async () => value });
    if (url.includes('/milestones?')) return reply(url.includes(repository) ? milestones : []);
    if (url.endsWith('/releases/latest')) return { ok: false, status: 404 };
    if (url.endsWith('/languages')) return reply({});
    if (url.includes('/pulls?') || url.endsWith('/releases?per_page=20')) return reply([]);
    return reply({ private: false, visibility: 'public', pushed_at: '2026-10-27T00:00:00Z' });
  };
  const feed = await collectProgress({ fetcher, now: '2026-10-27T00:00:00Z' });
  assert.ok(isProgressFeed(feed));
  const entry = feed.repositories.find(value => value.repository === repository);
  assert.deepEqual(entry.structures.map(value => value.name), ['Workshop', 'Land and stabilize']);
  const index = REPOSITORIES.indexOf(repository);
  const foreign = structuredClone(feed); foreign.repositories[index].structures[0].url = 'https://evil.test/milestone/2';
  assert.equal(isProgressFeed(foreign), false);
  const duplicate = structuredClone(feed); duplicate.repositories[index].structures[1].number = 2;
  duplicate.repositories[index].structures[1].url = `https://github.com/${repository}/milestone/2`;
  assert.equal(isProgressFeed(duplicate), false);
  const negative = structuredClone(feed); negative.repositories[index].structures[0].open = -1;
  assert.equal(isProgressFeed(negative), false);
  const legacy = structuredClone(feed); delete legacy.repositories[index].structures;
  assert.ok(isProgressFeed(legacy));
});

test('issues are bays: skeleton, partial cladding and finished stages follow open/closed counts only', () => {
  const skeleton = issueSkeleton([
    { kind: 'level', order: 2, number: 9, name: 'Second', open: 3, closed: 1 },
    { kind: 'level', order: 1, number: 8, name: 'First', open: 0, closed: 4 },
    { kind: 'level', order: 3, number: 7, name: 'Third', open: 39, closed: 1 },
    { kind: 'grounds', order: 5, number: 5, name: 'Yard', open: 0, closed: 0 },
  ], { width: 30, baseTop: 0 });
  assert.deepEqual(skeleton.levels.map(level => level.name), ['First', 'Second', 'Third']);
  assert.deepEqual(skeleton.levels.map(level => level.stage), ['Finished', 'Under construction', 'Under construction']);
  assert.equal(skeleton.levels[0].cladBays, 4);
  assert.equal(skeleton.levels[1].cladBays, 1);
  assert.equal(skeleton.levels[2].bays, 16);
  assert.equal(skeleton.levels[2].cladBays, 1, 'any closed issue is visible');
  assert.equal(skeleton.grounds[0].stage, 'Outlined / no issues yet');
  assert.equal(skeleton.grounds[0].finished, false, 'an empty milestone never looks finished');
  assert.equal(skeleton.finishedCount, 1);
  assert.equal(skeleton.levels[1].y - skeleton.levels[0].y, LEVEL_HEIGHT);
  assert.equal(skeleton.top, 3 * LEVEL_HEIGHT);
  const nearlyDone = issueSkeleton([{ kind: 'level', order: 1, number: 1, name: 'x', open: 1, closed: 99 }]).levels[0];
  assert.ok(nearlyDone.cladBays < nearlyDone.bays, 'one open issue keeps a bare bay');
});

test('campus height rises with planned levels, open structures raise cranes, finished skeleton calms the site', () => {
  const site = constructionSites([{ id: 'portfolio', title: 'BigNuten', repository, fields: { Kind: 'Portfolio', Status: 'Done' } }])[0];
  const feed = structures => ({ repositories: [{ repository, versions: [], structures }] });
  const plain = campusStructure(site, feed([]));
  const open = campusStructure(site, feed([{ kind: 'level', order: 1, number: 1, name: 'Base', open: 2, closed: 0, state: 'open', url: '' },
    { kind: 'level', order: 2, number: 2, name: 'Next', open: 1, closed: 0, state: 'open', url: '' }]));
  assert.equal(open.height, 2 * LEVEL_HEIGHT);
  assert.ok(open.height > plain.height);
  assert.equal(open.messy, true); assert.ok(open.buildCranes > 0);
  const done = campusStructure(site, feed([{ kind: 'level', order: 1, number: 1, name: 'Base', open: 0, closed: 2, state: 'closed', url: '' }]));
  assert.equal(done.messy, false); assert.equal(done.buildCranes, 0);
  assert.equal(done.deliveredFloors, 0, 'finished issues never become receipt-backed version floors');
});

test('site panel lists levels and grounds with milestone links and escapes names', () => {
  const site = constructionSites([{ id: 'one', title: 'one', repository, fields: { Kind: 'Issue', Status: 'Todo' } }])[0];
  const html = renderCampusDetails(site, { repositories: [{ repository, state: 'available', versions: [], mergedPulls: [], structures: [
    { kind: 'level', order: 1, number: 3, name: '<b>Base</b>', open: 1, closed: 1, state: 'open', url: `https://github.com/${repository}/milestone/3` },
    { kind: 'grounds', order: 4, number: 4, name: 'Workshop', open: 0, closed: 2, state: 'closed', url: `https://github.com/${repository}/milestone/4` },
  ] }] });
  assert.match(html, /Planned structures \(1\/2 finished\)/);
  assert.match(html, /Level 1 · &lt;b&gt;Base&lt;\/b&gt;/);
  assert.match(html, /Grounds · Workshop<\/b>\s*— Finished · 2\/2 issues closed/);
  assert.match(html, /milestone\/3/);
  const empty = renderCampusDetails(site, { repositories: [{ repository, state: 'available', versions: [], mergedPulls: [] }] });
  assert.match(empty, /Level N: …/);
});
