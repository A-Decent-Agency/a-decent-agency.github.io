import { escapeHTML as esc } from './markdown.js';
import { REVIVAL_PLANS } from './revival-plans.js';

export function validateRecall(value) {
  if (value?.schemaVersion !== 1 || !Array.isArray(value.projects) || value.projects.length > 30
    || !Number.isFinite(Date.parse(value.observedAt)) || !Number.isFinite(Date.parse(value.periodStart))
    || !Number.isFinite(Date.parse(value.periodEndExclusive))) throw new Error('Invalid project recall snapshot.');
  const ids = new Set();
  for (const project of value.projects) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(project.repository) || ids.has(project.repository.toLowerCase())
      || typeof project.name !== 'string' || typeof project.focus !== 'string'
      || !['octoberMergedCount', 'octoberClosedCount', 'openIssueCount', 'omittedOpen', 'openPullCount'].every(key => Number.isSafeInteger(project[key]) && project[key] >= 0)) throw new Error('Invalid project recall record.');
    ids.add(project.repository.toLowerCase());
    for (const key of ['merged', 'closed', 'open', 'openPulls', 'releases']) {
      if (!Array.isArray(project[key]) || project[key].length > 5) throw new Error('Invalid project evidence list.');
      for (const entry of project[key]) {
        const url = new URL(entry.url);
        if (url.origin !== 'https://github.com' || url.username || url.password || !url.pathname.toLowerCase().startsWith(`/${project.repository.toLowerCase()}/`)
          || typeof (entry.title || entry.tag) !== 'string') throw new Error('Invalid project evidence source.');
      }
    }
  }
  return value;
}
export function renderProjectRecall(value) {
  const recall = validateRecall(value);
  const merged = recall.projects.reduce((sum, project) => sum + project.octoberMergedCount, 0);
  const closed = recall.projects.reduce((sum, project) => sum + project.octoberClosedCount, 0);
  const evidence = entries => entries.map(entry => `<li><a href="${esc(entry.url)}" target="_blank" rel="noopener noreferrer">${esc(entry.title || entry.tag)}</a><small>${esc(entry.at || 'Timestamp unavailable')}</small></li>`).join('') || '<li>None observed in this selected evidence window.</li>';
  return `<p>Public GitHub state checked ${esc(recall.observedAt)}. October 1–31 UTC, through this observation: <b>${merged} merged PRs / ${closed} issue closures</b> across ${recall.projects.length} selected public repositories.${recall.projects.some(project => project.partial) ? ' Some repository histories are partial; totals are lower bounds.' : ''}</p>
    <p>${esc(recall.scope)} A closed issue is not necessarily a delivered feature; a merged PR or release is not proof of deployment, payment or full acceptance. This is a separate recall snapshot, not an edit of the older Project board.</p>
    <p><b>Local Office work:</b> diagram studio and founding-map viewer passed acceptance tests; this morning’s proposal towers are local work, not merged/deployed releases. Busking is in observation mode; Agency/Canopy mints remain deferred by steward direction.</p>
    <div class="project-recall-grid">${recall.projects.map(project => `<article data-recall-repository="${esc(project.repository)}"><h3>${esc(project.name)}</h3><p>${esc(project.focus)}</p>
      <button data-recall-site="${esc(project.repository)}">Visit project campus</button>
      <p>${project.octoberMergedCount} October merges / ${project.octoberClosedCount} October issue closures / ${project.openIssueCount} open issues${project.partial ? ' / partial history' : ''}</p>
      <details><summary>Recently merged / source work</summary><ul>${evidence(project.merged)}</ul></details>
      <details><summary>Recently closed / GitHub state</summary><ul>${evidence(project.closed)}</ul></details>
      <details><summary>Open / next issue signposts (${project.openIssueCount})</summary><ul>${evidence(project.open)}</ul>${project.omittedOpen ? `<p>${project.omittedOpen} further open issues; <a href="https://github.com/${esc(project.repository)}/issues" target="_blank" rel="noopener noreferrer">view the full backlog</a>.</p>` : ''}</details>
      <details><summary>In-flight pull requests (${project.openPullCount}${project.partial ? ' / partial observation' : ''})</summary><ul>${evidence(project.openPulls)}</ul></details>
      <details><summary>Observed release tags / not mint or deployment proof</summary><ul>${evidence(project.releases)}</ul></details>
      ${REVIVAL_PLANS.some(plan => plan.repository === project.repository) ? '<p>Five proposed plan levels are available at this campus; no new GitHub jobs or completed floors are inferred.</p>' : ''}
    </article>`).join('')}</div>`;
}
