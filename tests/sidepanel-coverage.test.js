import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { constructionSites } from '../js/construction-model.js';
import { renderCampusDetails } from '../js/campus-details.js';
import { renderCampusPlan } from '../js/campus-plan.js';
import { renderPlanningDock } from '../js/planning-dock.js';
import { renderRepositoryWork, validateRecall } from '../js/project-recall.js';
import { siteIdentity } from '../js/site-identities.js';
import { REPOSITORIES } from '../js/progress-feed.js';
import { collectRecall } from '../scripts/refresh-project-recall.mjs';
const json = async file => JSON.parse(await readFile(new URL(`../data/${file}`, import.meta.url)));

test('every public campus has dated source work, a real identity or explicit fallback, and useful no-board-card panels', async () => {
  const [board, feed, raw] = await Promise.all(['project.json', 'progress.json', 'project-recall.json'].map(json));
  const recall = validateRecall(raw), sites = constructionSites(board.items, { includeContext: true });
  assert.deepEqual(new Set(recall.projects.map(project => project.repository)), new Set(REPOSITORIES));
  assert.deepEqual(new Set(feed.repositories.map(project => project.repository)), new Set(REPOSITORIES));
  for (const site of sites) {
    assert.ok(renderCampusPlan(site, sites, feed).length > 50);
    const html = renderCampusDetails(site, feed, recall);
    const dock = renderPlanningDock({ site, current: board, recall });
    assert.ok(html.length > 50 && dock.length > 50);
    assert.doesNotMatch(html + dock, /\bhref="(?:null|undefined)"/);
    if (!site.project || site.project.entityId) continue;
    assert.match(html, /Public work \/ separate from the Project board/);
    assert.match(html, /GitHub checked/);
    assert.match(html, /Full issue backlog/);
    assert.equal(siteIdentity(site).kind, 'repository');
    if (!site.items.length) assert.match(dock, /Public work \/ separate from the Project board/);
  }
  const router = sites.find(site => site.project?.entityId);
  assert.doesNotMatch(renderCampusDetails(router, feed, recall), /Public work \/ separate/);
  assert.match(renderRepositoryWork(null, 'unknown/repo'), /unavailable/);
});

test('recall collector observes old open PRs separately, withholds private metadata and preserves closure reasons', async () => {
  const repository = 'maker/fixture', base = `https://github.com/${repository}`;
  const paths = [], old = { number: 42, title: '<Old untouched PR>', html_url: `${base}/pull/42`, updated_at: '2021-01-01T00:00:00Z' };
  let visibility = 'public';
  const read = async path => {
    paths.push(path);
    if (path === `repos/${repository}`) return { full_name: repository, private: visibility !== 'public', visibility };
    if (path.includes('/pulls?state=open')) return [old];
    if (path.includes('/issues?state=all')) return [{ number: 1, title: 'Moved to epic', html_url: `${base}/issues/1`, closed_at: '2026-11-11T00:00:00Z', state_reason: 'not_planned' }];
    return [];
  };
  const options = { read, now: () => new Date('2026-11-12T00:00:00Z'), repositories: [[repository, 'Fixture', 'Dated plan', '2026-10-22']], log: () => {} };
  const result = await collectRecall(options);
  assert.equal(result.projects[0].openPullCount, 1);
  assert.equal(result.projects[0].openPulls[0].number, 42);
  assert.equal(result.projects[0].recentClosed[0].stateReason, 'not_planned');
  assert.match(renderRepositoryWork(result, repository), /&lt;Old untouched PR&gt;/);
  assert.match(renderRepositoryWork(result, repository), /Not planned; not delivery/);
  visibility = 'private'; paths.length = 0;
  await assert.rejects(collectRecall(options), /unconfirmed public/);
  assert.deepEqual(paths, [`repos/${repository}`]);
});
