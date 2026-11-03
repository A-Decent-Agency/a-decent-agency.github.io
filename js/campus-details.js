import { escapeHTML as esc } from './markdown.js';
import { campusStructure } from './project-campus.js';
import { CANOPY } from './canopy-registry.js';
import { canopyCity } from './canopy-city.js';
import { ENS_ARTWORK_OBSERVATION, PROJECT_MURALS } from './site-identities.js';
import { renderSupportCallout, renderVersionMints } from './version-mints.js';
import { campusArt } from './campus-art.js';
import { renderWidgetProject, widgetProject } from './widget-projects.js';

export function renderCampusDetails(site, feed) {
  if (!site?.project) return site?.type === 'milestone'
    ? '<p>Legacy planning checkpoint. Source status and tentative dates are retained, not a project-completion score. Review its original acceptance evidence before changing status.</p>'
    : '<p>Shared planning yard. Select a project offramp for its building, evidence and connections.</p>';
  const model = campusStructure(site, feed), observation = model.observation;
  if (site.project.entityId) return `${renderReviewedBrief(site.project)}<div class="campus-stage">${esc(model.label)}</div>
    <p>${esc(model.basis)}</p><p>Independent infrastructure entity; source currently resides in
    <a href="https://github.com/${esc(site.project.repository)}" target="_blank" rel="noopener noreferrer">ArtFi</a>.
    No lending-project releases, mint receipts or balances are attributed to this entity.</p>
    <p>Deployment and public-ledger reconciliation pending
    <a href="https://github.com/TheJollyLaMa/ArtFi/issues/62" target="_blank" rel="noopener noreferrer">the dedicated makeover issue</a>.
    Existing operation is steward-reported, not independently verified here.</p>`;
  const repository = site.project.repository;
  const art = campusArt(site.project);
  const identity = CANOPY.projects.find(project => !project.entityId && project.repository.toLowerCase() === repository.toLowerCase());
  const avatarRecord = ENS_ARTWORK_OBSERVATION.records[identity?.ens];
  const mural = PROJECT_MURALS[repository];
  const connections = (feed?.connections || []).filter(link => [link.from.toLowerCase(), link.to.toLowerCase()].includes(repository.toLowerCase()));
  const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
  return `${art ? `<section class="campus-art-brief"><span class="eyebrow">CITY LANDMARK</span><h4>${esc(art.name)}</h4><p>${esc(art.description)}</p><small>Art direction only / not a physical facility, feature delivery, legal protection or funding claim. Issue structures and receipt-backed floors retain their separate evidence rules.</small></section>` : ''}${widgetProject(site.project) ? '' : renderSupportCallout(site, feed)}${renderWidgetProject(site, feed)}${renderReviewedBrief(site.project)}<details class="campus-editions"><summary>Supporter editions / receipt-backed evidence</summary>${renderVersionMints(site, feed)}</details><div class="campus-stage">${esc(model.label)}</div><details><summary>Architecture / evidence rules</summary><p>${esc(model.basis)}</p></details>
    ${identity?.ens ? `<p>Recorded ENS identity: <b>${esc(identity.ens)}</b>.</p>` : ''}
    ${avatarRecord ? `<details><summary>ENS artwork provenance / observed ${ENS_ARTWORK_OBSERVATION.observedAt}</summary><p>${esc(avatarRecord)}. Mainnet avatar text read without a wallet connection. Project-owned, commit-pinned artwork is displayed instead of following mutable avatar-service URLs automatically.</p></details>` : ''}
    ${mural ? `<figure class="campus-mural"><img src="${esc(mural.url)}" alt="${esc(mural.alt)}" loading="lazy" referrerpolicy="no-referrer" data-project-mural><figcaption>${link(mural.source, 'Project artwork')} · The Jolly LaMa / A Decent Agency · ${link(mural.license, 'CC BY 4.0')} (unmodified)</figcaption></figure>` : ''}
    <p>${link(`https://github.com/${repository}`, 'Repository')} · ${link(`https://github.com/${repository}/issues`, 'Issues and next work')}</p>
    <p>${model.codeBytes == null ? 'Public code-size observation unavailable; neutral footprint retained.' : `${model.codeBytes.toLocaleString()} public language bytes (GitHub Linguist), not lines of code, effort or value.`}</p>
    ${renderIssueSkeleton(model, repository, link)}
    ${repository === 'TheJollyLaMa/DecentCanopy' ? renderCanopyCity(feed, link) : ''}
    <details><summary>Delivered version floors (${model.versions.length})</summary>
      <p>Clean floors require version-matched published Supporter mint receipts. Source-reported verification, not a new independent chain audit. Release prose or prepared artwork alone creates no delivered floor.</p>
      <ul>${model.versions.map(version => `<li>${link(version.url, version.tag)} · token ${esc(version.tokenId)} / Base · ${link(version.evidenceUrl, 'Mint receipt')} · ${link(`https://basescan.org/tx/${version.mintTxHash}`, 'Transaction')}</li>`).join('') || '<li>No eligible mint receipt observed. Steward architecture remains labeled, not promoted to minted delivery.</li>'}</ul>
      ${observation?.versionsTruncated ? '<p>Only the most recent 20 releases were observed; version history is partial.</p>' : ''}</details>
    <details><summary>Completed building blocks (${model.completed} board cards)</summary>
      <p>Steward architecture and Done cards shape the base. Only mint receipts create clean delivered floors. Current jobs occupy a separate scaffolded service yard. Neither is a readiness percentage.</p>
      <ul>${site.items.filter(item => item.fields?.Status === 'Done').map(item => `<li>${esc(item.title)}</li>`).join('') || '<li>No Done cards in this selection. The architectural milestone is labeled separately.</li>'}</ul></details>
    <details><summary>Latest public GitHub evidence</summary>
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
  const row = structure => `<li data-structure="${esc(structure.kind)}"><b>${structure.kind === 'level' ? `Level ${esc(structure.order)}` : 'Grounds'} · ${esc(structure.name)}</b>${structure.tower ? ` <small>Tower ${structure.tower + 1}, cul-de-sac ${structure.culdesac + 1}</small>` : structure.culdesac !== undefined ? ` <small>Cul-de-sac ${structure.culdesac + 1}</small>` : ''}
    — ${esc(structure.stage)} · ${structure.closed}/${structure.total} issues closed
    ${structure.closures ? `<small>${structure.closures.completed} completed / ${structure.closures.notPlanned} not planned / ${structure.closures.unknown} unknown closure reasons</small>` : '<small>Closure reasons not observed; closed does not mean delivered.</small>'}
    · ${link(structure.url, 'Milestone issues')}</li>`;
  const count = model.levels.length + model.grounds.length;
  return `<details class="issue-skeleton"><summary>Planned structures (${model.finishedCount}/${count} finished)</summary>
    <p>Milestone issues form structural bays. Observed completed closures clad bays; not-planned, superseded or unknown closures do not count as delivered. Legacy observations without closure reasons remain explicitly unverified. Closed-as-completed is still GitHub state, not deployment or product acceptance.</p>
    <p>A main tower holds up to 12 stories; overflow grows six-story satellites on branching cul-de-sacs. Grounds beyond six slots move onto cul-de-sac lots.</p>
    ${count ? `${model.levels.length ? `<h5>Tower levels</h5><ul>${model.levels.map(row).join('')}</ul>` : ''}
      ${model.grounds.length ? `<h5>Grounds and nearby structures</h5><ul>${model.grounds.map(row).join('')}</ul>` : ''}`
      : `<p>No planned structures observed yet. Stewards add one by creating a milestone named <code>Level N: …</code> or <code>Grounds: …</code> in ${link(`https://github.com/${repository}/milestones`, 'the repository milestones')} and assigning its issues.</p>`}
  </details>`;
}
function renderReviewedBrief(project) {
  const identity = CANOPY.projects.find(entry => project.entityId ? entry.entityId === project.entityId
    : !entry.entityId && entry.repository.toLowerCase() === project.repository.toLowerCase());
  if (!identity?.currentState) return '';
  return `<section class="campus-brief" aria-label="Reviewed project brief"><span class="eyebrow">CURATED REVIEW / ${esc(identity.reviewedAt)}</span>
    ${identity.updates?.length ? `<details><summary>Review context and limits</summary><p>${esc(identity.currentState)}</p></details>` : `<p>${esc(identity.currentState)}</p>`}
    <div class="campus-updates">${(identity.updates || []).map(update => `<article><small class="evidence-state" data-state="${esc(update.state)}">${update.state === 'merged' ? 'MERGED SOURCE' : update.state === 'in-flight' ? 'OPEN PR / NOT MERGED' : 'PLANNED / NOT DELIVERED'}</small><h5>${esc(update.label)}</h5>
      <p>${esc(update.detail)}</p><ul>${update.evidence.map(entry => `<li><a href="${esc(entry.url)}" target="_blank" rel="noopener noreferrer">${esc(entry.label)}</a></li>`).join('')}</ul></article>`).join('')}</div>
    ${identity.nextAction ? `<details><summary>Next useful move</summary><p>${esc(identity.nextAction)}</p></details>` : ''}
    <p>Curated evidence is dated; live-source observations below may be newer. No chain balances or verified deployment are inferred.</p></section>`;
}
function renderCanopyCity(feed, link) {
  const city = canopyCity(CANOPY, feed, { root: 'TheJollyLaMa/DecentCanopy' });
  return `<details class="canopy-city"><summary>Top-down canopy city (${city.nodes.length} projects)</summary>
    <p>The roof canopy is a fractal map of the curated Canopy registry: branches follow mapped connections outward from DecentCanopy, and unconnected projects branch from the hub. Mini-building height follows observed planned structures; steel caps mark open ones; grey translucent buildings are not yet observed. Select one to fly to its site. Another steward's registry in the same shape would render their own city.</p>
    <ul>${city.nodes.map(node => `<li>${esc(node.name)} · ${node.entityId ? 'independent entity / ' : ''}${link(`https://github.com/${node.repository}`, 'source repository')} — ${node.observed ? `${node.finished}/${node.planned} planned structures finished` : 'not observed by the office'}</li>`).join('')}</ul></details>`;
}
