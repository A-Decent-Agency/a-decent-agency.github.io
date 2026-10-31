import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
const exec = promisify(execFile);
const repositories = [
  ['A-Decent-Agency/a-decent-agency.github.io', 'Planning Office', 'Active / local studio and archive awaiting review'],
  ['TheJollyLaMa/DecentBusking', 'DecentBusking', 'Released / observe runtime and bounded follow-up'],
  ['TheJollyLaMa/DecentCanopy', 'DecentCanopy', 'Active / evidence and ecosystem integration; mint deferred'],
  ['TheJollyLaMa/BigNuten_Vanilla', 'BigNuten', 'Primary buildout / health, recovery and participation'],
  ['TheJollyLaMa/DecentHead', 'DecentHead', 'Shared infrastructure / host adapters and release kit'],
  ['TheJollyLaMa/DecentMarket', 'DecentMarket', 'Shared infrastructure / storefront and receipts'],
  ['A-Decent-Agency/DecentJukebox', 'DecentJukebox widget', 'Reusable widget / integration maintenance'],
  ['A-Decent-Agency/DBuskRadio', 'DBuskRadio widget', 'Reusable widget / integration maintenance'],
  ['A-Decent-Agency/DVert', 'DVert widget', 'Reusable widget / integration maintenance'],
  ['TheJollyLaMa/ArtFi', 'DecentLending / DLend (ArtFi)', 'Next / steward-selected revamp'],
  ['TheJollyLaMa/jolly-sim-siddhi', 'JollySimSiddhi', 'Discovery / staged revival'],
  ['TheJollyLaMa/DecentPilgrimages', 'DecentPilgrimages', 'Discovery / staged revival'],
  ['TheJollyLaMa/AJollyDecentCodeCamp', 'A Jolly Decent CodeCamp', 'Discovery / staged revival'],
  ['TheJollyLaMa/BabelBet', 'BabelBet', 'Discovery / staged revival'],
];
async function api(path) {
  const { stdout } = await exec('gh', ['api', path], { maxBuffer: 10_000_000 });
  return JSON.parse(stdout);
}
async function pages(path) {
  const rows = [];
  for (let number = 1; number <= 3; number++) {
    const page = await api(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${number}`);
    rows.push(...page);
    if (page.length < 100) return { rows, partial: false };
  }
  return { rows, partial: true };
}
const start = '2026-10-01T00:00:00Z', end = '2026-11-01T00:00:00Z';
const inOctober = date => date && date >= start && date < end;
const projects = [];
for (const [repository, name, focus] of repositories) {
  const metadata = await api(`repos/${repository}`);
  if (metadata.visibility !== 'public') throw new Error(`Refusing to publish non-public metadata: ${repository}`);
  const issues = await pages(`repos/${repository}/issues?state=all&since=${start}&sort=updated&direction=desc`);
  const pulls = await pages(`repos/${repository}/pulls?state=all&sort=updated&direction=desc`);
  // Fetch all open issues separately: old untouched work must not disappear from recall.
  const open = await pages(`repos/${repository}/issues?state=open`);
  const releases = await api(`repos/${repository}/releases?per_page=5`);
  const merged = pulls.rows.filter(row => inOctober(row.merged_at));
  const closed = issues.rows.filter(row => !row.pull_request && inOctober(row.closed_at));
  const openIssues = open.rows.filter(row => !row.pull_request);
  const openPulls = pulls.rows.filter(row => row.state === 'open');
  const record = row => ({ number: row.number, title: row.title, url: row.html_url, at: row.merged_at || row.closed_at || row.updated_at });
  projects.push({
    repository, name, focus, observedAt: new Date().toISOString(),
    partial: issues.partial || pulls.partial || open.partial,
    octoberMergedCount: merged.length, octoberClosedCount: closed.length, openIssueCount: openIssues.length,
    merged: merged.slice(0, 4).map(record), closed: closed.slice(0, 3).map(record),
    open: openIssues.slice(0, 5).map(record), omittedOpen: Math.max(0, openIssues.length - 5),
    openPullCount: openPulls.length, openPulls: openPulls.slice(0, 5).map(record),
    releases: releases.filter(row => !row.draft && !row.prerelease).slice(0, 2).map(row => ({ tag: row.tag_name, url: row.html_url, at: row.published_at })),
  });
  console.log(`${name}: ${merged.length} October merges, ${closed.length} October issue closures, ${openIssues.length} open${projects.at(-1).partial ? ' (partial)' : ''}`);
}
await writeFile(new URL('../data/project-recall.json', import.meta.url), JSON.stringify({
  schemaVersion: 1, observedAt: new Date().toISOString(), periodStart: start, periodEndExclusive: end,
  scope: 'Fourteen public repositories selected for October recall; not the whole library. GitHub state is not deployment, payment or product acceptance.',
  projects,
}, null, 2) + '\n');
