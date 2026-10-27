import { escapeHTML as esc } from './markdown.js';
import { campusStructure } from './project-campus.js';
import { CANOPY } from './canopy-registry.js';
import { ENS_ARTWORK_OBSERVATION, PROJECT_MURALS } from './site-identities.js';
import { renderVersionMints } from './version-mints.js';

export function renderCampusDetails(site, feed) {
  if (!site?.project) return site?.type === 'milestone'
    ? '<p>Legacy planning checkpoint. Source status and tentative dates are retained, not a project-completion score. Review its original acceptance evidence before changing status.</p>'
    : '<p>Shared planning yard. Select a project offramp for its building, evidence and connections.</p>';
  const model = campusStructure(site, feed), observation = model.observation;
  const repository = site.project.repository;
  const identity = CANOPY.projects.find(project => project.repository.toLowerCase() === repository.toLowerCase());
  const avatarRecord = ENS_ARTWORK_OBSERVATION.records[identity?.ens];
  const mural = PROJECT_MURALS[repository];
  const connections = (feed?.connections || []).filter(link => [link.from.toLowerCase(), link.to.toLowerCase()].includes(repository.toLowerCase()));
  const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
  return `${renderVersionMints(site, feed)}<div class="campus-stage">${esc(model.label)}</div><p>${esc(model.basis)}</p>
    ${identity?.ens ? `<p>Recorded ENS identity: <b>${esc(identity.ens)}</b>.</p>` : ''}
    ${avatarRecord ? `<details><summary>ENS artwork provenance / observed ${ENS_ARTWORK_OBSERVATION.observedAt}</summary><p>${esc(avatarRecord)}. Mainnet avatar text read without a wallet connection. Project-owned, commit-pinned artwork is displayed instead of following mutable avatar-service URLs automatically.</p></details>` : ''}
    ${mural ? `<figure class="campus-mural"><img src="${esc(mural.url)}" alt="${esc(mural.alt)}" loading="lazy" referrerpolicy="no-referrer" data-project-mural><figcaption>${link(mural.source, 'Project artwork')} · The Jolly LaMa / A Decent Agency · ${link(mural.license, 'CC BY 4.0')} (unmodified)</figcaption></figure>` : ''}
    <p>${link(`https://github.com/${repository}`, 'Repository')} · ${link(`https://github.com/${repository}/issues`, 'Issues and next work')}</p>
    <p>${model.codeBytes == null ? 'Public code-size observation unavailable; neutral footprint retained.' : `${model.codeBytes.toLocaleString()} public language bytes (GitHub Linguist), not lines of code, effort or value.`}</p>
    ${renderIssueSkeleton(model, repository, link)}
    <details open><summary>Delivered version floors (${model.versions.length})</summary>
      <p>Clean floors require version-matched published Supporter mint receipts. Source-reported verification, not a new independent chain audit. Release prose or prepared artwork alone creates no delivered floor.</p>
      <ul>${model.versions.map(version => `<li>${link(version.url, version.tag)} · token ${esc(version.tokenId)} / Base · ${link(version.evidenceUrl, 'Mint receipt')} · ${link(`https://basescan.org/tx/${version.mintTxHash}`, 'Transaction')}</li>`).join('') || '<li>No eligible mint receipt observed. Steward architecture remains labeled, not promoted to minted delivery.</li>'}</ul>
      ${observation?.versionsTruncated ? '<p>Only the most recent 20 releases were observed; version history is partial.</p>' : ''}</details>
    <details><summary>Completed building blocks (${model.completed} board cards)</summary>
      <p>Steward architecture and Done cards shape the base. Only mint receipts create clean delivered floors. Current jobs occupy a separate scaffolded service yard. Neither is a readiness percentage.</p>
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

function renderIssueSkeleton(model, repository, link) {
  const row = structure => `<li data-structure="${esc(structure.kind)}"><b>${structure.kind === 'level' ? `Level ${esc(structure.order)}` : 'Grounds'} · ${esc(structure.name)}</b>
    — ${esc(structure.stage)} · ${structure.closed}/${structure.total} issues closed · ${link(structure.url, 'Milestone issues')}</li>`;
  const count = model.levels.length + model.grounds.length;
  return `<details open class="issue-skeleton"><summary>Planned structures (${model.finishedCount}/${count} finished)</summary>
    <p>Each tower level and grounds structure is a public GitHub milestone. Every issue in it is one structural bay: open issues show bare steel, closed issues clad their bay, and a structure looks finished when all its issues are closed. Issue counts are planning evidence, not a quality or readiness score.</p>
    ${count ? `${model.levels.length ? `<h5>Tower levels</h5><ul>${model.levels.map(row).join('')}</ul>` : ''}
      ${model.grounds.length ? `<h5>Grounds and nearby structures</h5><ul>${model.grounds.map(row).join('')}</ul>` : ''}`
      : `<p>No planned structures observed yet. Stewards add one by creating a milestone named <code>Level N: …</code> or <code>Grounds: …</code> in ${link(`https://github.com/${repository}/milestones`, 'the repository milestones')} and assigning its issues.</p>`}
  </details>`;
}
