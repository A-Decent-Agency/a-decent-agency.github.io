import { escapeHTML as esc } from './markdown.js';
import { REVIVAL_PLANS } from './revival-plans.js';

export function validateRecall(value) {
  if (![1, 2].includes(value?.schemaVersion) || !Array.isArray(value.projects) || value.projects.length > 50
    || !Number.isFinite(Date.parse(value.observedAt)) || !Number.isFinite(Date.parse(value.periodStart))
    || !Number.isFinite(Date.parse(value.periodEndExclusive))) throw new Error('Invalid project recall snapshot.');
  if (Date.parse(value.periodStart) >= Date.parse(value.periodEndExclusive)
    || (value.schemaVersion === 2 && (!Number.isFinite(Date.parse(value.recentStart))
      || Date.parse(value.recentStart) > Date.parse(value.observedAt)))) throw new Error('Invalid project recall evidence window.');
  const ids = new Set();
  for (const project of value.projects) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(project.repository) || ids.has(project.repository.toLowerCase())
      || typeof project.name !== 'string' || typeof project.focus !== 'string'
      || !['octoberMergedCount', 'octoberClosedCount', 'openIssueCount', 'omittedOpen', 'openPullCount'].every(key => Number.isSafeInteger(project[key]) && project[key] >= 0)) throw new Error('Invalid project recall record.');
    ids.add(project.repository.toLowerCase());
    if (project.observedAt !== undefined && !Number.isFinite(Date.parse(project.observedAt))
      || project.reviewedAt !== undefined && !Number.isFinite(Date.parse(project.reviewedAt))) throw new Error('Invalid project recall date.');
    for (const key of ['merged', 'closed', 'open', 'openPulls', 'releases', ...(value.schemaVersion === 2 ? ['recentMerged', 'recentClosed'] : [])]) {
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
export function renderRepositoryWork(value, repository) {
  const project = value?.projects?.find(project => project.repository.toLowerCase() === repository?.toLowerCase());
  if (!project) return '<p>Public issue/PR observation unavailable for this repository. No empty backlog or completion inferred; repository source links remain available.</p>';
  const rows = entries => entries.map(entry => `<li><a href="${esc(entry.url)}" target="_blank" rel="noopener noreferrer">${esc(entry.title || entry.tag)}</a><small> ${esc(entry.at || 'Timestamp not recorded')}${entry.stateReason ? ` / ${esc(entry.stateReason === 'not_planned' ? 'Not planned; not delivery' : entry.stateReason === 'completed' ? 'Closed as completed; GitHub state only' : 'Closure reason unknown')}` : ''}</small></li>`).join('') || '<li>None returned in this selected observation; this does not establish a current empty backlog.</li>';
  return `<section class="repository-work" aria-label="Observed public repository work"><h4>Public work / separate from the Project board</h4>
    <p>GitHub checked ${esc(project.observedAt || value.observedAt)}${project.partial ? ' / partial, bounded history' : ''}. These are source states, not deployment, payment or acceptance.</p>
    <p>${project.partial ? 'At least ' : ''}${project.openIssueCount} open issues · ${project.openPullCount} open pull requests at observation.
      <a href="https://github.com/${esc(project.repository)}/issues" target="_blank" rel="noopener noreferrer">Full issue backlog</a> ·
      <a href="https://github.com/${esc(project.repository)}/pulls" target="_blank" rel="noopener noreferrer">All pull requests</a></p>
    <details open><summary>Open issue signposts (${project.open.length} shown)</summary><ul>${rows(project.open)}</ul>${project.omittedOpen ? `<p>${project.omittedOpen} further open issues; use the full backlog.</p>` : ''}</details>
    <details><summary>In-flight pull requests (${project.openPulls.length} shown)</summary><ul>${rows(project.openPulls)}</ul></details>
    <details><summary>Merged source / seven-day window ending ${esc(value.observedAt)}</summary><ul>${rows(project.recentMerged || [])}</ul></details>
    <details><summary>Issue closures / same observed window</summary><ul>${rows(project.recentClosed || [])}</ul></details></section>`;
}
export function renderProjectRecall(value) {
  const recall = validateRecall(value);
  const merged = recall.projects.reduce((sum, project) => sum + project.octoberMergedCount, 0);
  const closed = recall.projects.reduce((sum, project) => sum + project.octoberClosedCount, 0);
  const evidence = entries => entries.map(entry => `<li><a href="${esc(entry.url)}" target="_blank" rel="noopener noreferrer">${esc(entry.title || entry.tag)}</a><small>${esc(entry.at || 'Timestamp unavailable')}${entry.stateReason ? ` / ${esc(entry.stateReason === 'not_planned' ? 'Not planned / moved or declined; not delivery' : entry.stateReason === 'completed' ? 'Closed as completed / GitHub state only' : 'Closure reason unknown')}` : ''}</small></li>`).join('') || '<li>None observed in this selected evidence window.</li>';
  return `<p>Public GitHub state checked ${esc(recall.observedAt)}. <b>${recall.projects.length} selected public repositories</b>; recent changes and open work below.</p>
    <details><summary>October archive / ${merged} merged PRs and ${closed} issue closures</summary><p>October 1–31 UTC. Counts include closed-as-not-planned work; they are not a delivered-feature score.${recall.projects.some(project => project.partial) ? ' Some repository histories are partial; totals are lower bounds.' : ''}</p></details>
    <p>${esc(recall.scope)} A closed issue is not necessarily a delivered feature; a merged PR or release is not proof of deployment, payment or full acceptance. This is a separate recall snapshot, not an edit of the older Project board.</p>
    <p><b>Evidence boundaries:</b> Proposal levels remain plans, not deliveries. Curated descriptions and actual GitHub observations have separate dates; neither certifies current chain state. A closed-as-not-planned issue may have moved into an open epic.</p>
    <div class="project-recall-grid">${recall.projects.map(project => `<article data-recall-repository="${esc(project.repository)}"><h3>${esc(project.name)}</h3><details><summary>Curated context / reviewed ${esc(project.reviewedAt || 'date not recorded')}</summary><p>${esc(project.focus)}</p></details><p>GitHub checked ${esc(project.observedAt || recall.observedAt)}. <a href="https://github.com/${esc(project.repository)}/issues" target="_blank" rel="noopener noreferrer">Full issue backlog</a> · <a href="https://github.com/${esc(project.repository)}/pulls" target="_blank" rel="noopener noreferrer">All pull requests</a></p>
      <button data-recall-site="${esc(project.repository)}">Visit project campus</button>
      <p>${project.openIssueCount} open issues / ${project.openPullCount} in-flight PRs${project.partial ? ' / partial history' : ''}</p>
      <details><summary>Seven-day window ending ${esc(recall.observedAt)} / merged source work</summary><ul>${evidence(project.recentMerged || [])}</ul></details>
      <details><summary>Same observed window / issue closures and reasons</summary><ul>${evidence(project.recentClosed || [])}</ul></details>
      <details><summary>October history / ${project.octoberMergedCount} merges and ${project.octoberClosedCount} closures</summary><ul>${evidence(project.merged)}${evidence(project.closed)}</ul></details>
      <details><summary>Open / next issue signposts (${project.openIssueCount})</summary><ul>${evidence(project.open)}</ul>${project.omittedOpen ? `<p>${project.omittedOpen} further open issues; <a href="https://github.com/${esc(project.repository)}/issues" target="_blank" rel="noopener noreferrer">view the full backlog</a>.</p>` : ''}</details>
      <details><summary>In-flight pull requests (${project.openPullCount}${project.partial ? ' / partial observation' : ''})</summary><ul>${evidence(project.openPulls)}</ul></details>
      <details><summary>Observed release tags / not mint or deployment proof</summary><ul>${evidence(project.releases)}</ul></details>
      ${REVIVAL_PLANS.some(plan => plan.repository === project.repository) ? '<p>Five proposed plan levels are available at this campus; no new GitHub jobs or completed floors are inferred.</p>' : ''}
    </article>`).join('')}</div>`;
}
