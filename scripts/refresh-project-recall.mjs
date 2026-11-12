import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CANOPY } from '../js/canopy-registry.js';
import { REPOSITORIES } from '../js/progress-feed.js';
import { validateRecall } from '../js/project-recall.js';
const exec = promisify(execFile);
const catalog = REPOSITORIES.map(repository => {
  const project = CANOPY.projects.find(project => !project.entityId && project.repository === repository);
  return [repository, project.name, project.currentState, project.reviewedAt];
});
async function api(path) {
  const { stdout } = await exec('gh', ['api', path], { maxBuffer: 10_000_000 });
  return JSON.parse(stdout);
}
export async function collectRecall({ read = api, now = () => new Date(), repositories = catalog, log = console.log } = {}) {
async function pages(path) {
  const rows = [];
  for (let number = 1; number <= 3; number++) {
    const page = await read(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${number}`);
    if (!Array.isArray(page) || page.length > 100) throw new Error('Invalid public recall page.');
    rows.push(...page);
    if (page.length < 100) return { rows, partial: false };
  }
  return { rows, partial: true };
}
const start = '2026-10-01T00:00:00Z', end = '2026-11-01T00:00:00Z';
const observedAt = now().toISOString();
const recentStart = new Date(Date.parse(observedAt) - 7 * 86400000).toISOString();
const inOctober = date => date && date >= start && date < end;
const projects = [];
for (const [repository, name, focus, reviewedAt] of repositories) {
  const metadata = await read(`repos/${repository}`);
  if (metadata.visibility !== 'public' || metadata.private !== false || metadata.full_name?.toLowerCase() !== repository.toLowerCase()) throw new Error(`Refusing to publish unconfirmed public metadata: ${repository}`);
  const issues = await pages(`repos/${repository}/issues?state=all&since=${start}&sort=updated&direction=desc`);
  const pulls = await pages(`repos/${repository}/pulls?state=all&sort=updated&direction=desc`);
  // Fetch all open issues separately: old untouched work must not disappear from recall.
  const open = await pages(`repos/${repository}/issues?state=open`);
  const openPullsPage = await pages(`repos/${repository}/pulls?state=open&sort=updated&direction=desc`);
  const releases = await read(`repos/${repository}/releases?per_page=5`);
  const merged = pulls.rows.filter(row => inOctober(row.merged_at));
  const closed = issues.rows.filter(row => !row.pull_request && inOctober(row.closed_at));
  const openIssues = open.rows.filter(row => !row.pull_request);
  const openPulls = openPullsPage.rows;
  const record = row => ({ number: row.number, title: row.title, url: row.html_url, at: row.merged_at || row.closed_at || row.updated_at,
    ...(row.closed_at && !row.pull_request ? { stateReason: row.state_reason || 'unknown' } : {}) });
  const newest = (rows, key) => rows.sort((a, b) => String(b[key]).localeCompare(String(a[key])));
  projects.push({
    repository, name, focus: focus || 'No implementation brief reviewed; public source observations are separate.', reviewedAt, observedAt: now().toISOString(),
    partial: issues.partial || pulls.partial || open.partial || openPullsPage.partial,
    octoberMergedCount: merged.length, octoberClosedCount: closed.length, openIssueCount: openIssues.length,
    merged: merged.slice(0, 4).map(record), closed: closed.slice(0, 3).map(record),
    recentMerged: newest(pulls.rows.filter(row => row.merged_at >= recentStart && row.merged_at <= observedAt), 'merged_at').slice(0, 5).map(record),
    recentClosed: newest(issues.rows.filter(row => !row.pull_request && row.closed_at >= recentStart && row.closed_at <= observedAt), 'closed_at').slice(0, 5).map(record),
    open: openIssues.slice(0, 5).map(record), omittedOpen: Math.max(0, openIssues.length - 5),
    openPullCount: openPulls.length, openPulls: openPulls.slice(0, 5).map(record),
    releases: releases.filter(row => !row.draft && !row.prerelease).slice(0, 2).map(row => ({ tag: row.tag_name, url: row.html_url, at: row.published_at })),
  });
  log(`${name}: ${merged.length} October merges, ${closed.length} October issue closures, ${openIssues.length} open${projects.at(-1).partial ? ' (partial)' : ''}`);
}
return validateRecall({
  schemaVersion: 2, observedAt, recentStart, periodStart: start, periodEndExclusive: end,
  scope: `${repositories.length} public repositories from the pinned Canopy inventory. Recent evidence covers the seven days before this observation, with October activity retained separately. Curated project descriptions keep their own review dates. Not the whole library; GitHub state is not deployment, payment or product acceptance.`,
  projects,
});
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const snapshot = await collectRecall();
  await writeFile(new URL('../data/project-recall.json', import.meta.url), JSON.stringify(snapshot, null, 2) + '\n');
}
