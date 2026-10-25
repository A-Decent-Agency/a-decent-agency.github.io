import { escapeHTML as esc } from './markdown.js';
import { campusStructure } from './project-campus.js';

export function renderCampusDetails(site, feed) {
  if (!site?.project) return '<p>Shared planning yard. Select a project offramp for its building, evidence and connections.</p>';
  const model = campusStructure(site, feed), observation = model.observation;
  const repository = site.project.repository;
  const connections = (feed?.connections || []).filter(link => [link.from.toLowerCase(), link.to.toLowerCase()].includes(repository.toLowerCase()));
  const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
  return `<div class="campus-stage">${esc(model.label)}</div><p>${esc(model.basis)}</p>
    <p>${link(`https://github.com/${repository}`, 'Repository')} · ${link(`https://github.com/${repository}/issues`, 'Issues and next work')}</p>
    <details><summary>Completed building blocks (${model.completed} board cards)</summary>
      <p>Floors combine the steward's architectural milestone and Done cards. This is not a percentage, budget, deployment audit or proof that every feature is finished.</p>
      <ul>${site.items.filter(item => item.fields?.Status === 'Done').map(item => `<li>${esc(item.title)}</li>`).join('') || '<li>No Done cards in this selection. The architectural milestone is labeled separately.</li>'}</ul></details>
    <details open><summary>Latest public GitHub evidence</summary>
      ${!observation ? '<p>Public activity has not been observed for this repository. Board data remains available.</p>'
        : `<p>${observation.state === 'available' ? 'Observed' : 'Unavailable / retained observation'} ${esc(observation.checkedAt || 'No observation time')}. ${esc(observation.error || '')}</p>
        ${observation.release ? `<p>${link(observation.release.url, `Release ${observation.release.tag}`)} · ${esc(observation.release.publishedAt)}</p>` : '<p>No release observed; no version tag inferred.</p>'}
        <ul>${observation.mergedPulls.map(pr => `<li>${link(pr.url, pr.title)} <small>${esc(pr.mergedAt)}</small></li>`).join('')}</ul>`}
    </details>
    <details><summary>Connected infrastructure (${connections.length})</summary>
      <p>Signals illustrate recorded integration paths, not live network traffic or payments. A line does not imply every feature is compatible.</p>
      <ul>${connections.map(connection => `<li>${link(connection.url, connection.label)}<small>${esc(connection.from)} → ${esc(connection.to)}</small></li>`).join('') || '<li>No public integration path recorded in this feed.</li>'}</ul></details>`;
}
