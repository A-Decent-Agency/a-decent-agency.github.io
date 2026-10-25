import { compareSnapshots, isPublishedSnapshot, summarizeChanges } from './planning-changes.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

// Only explicit canonical GitHub repository, issue/PR and project references.
export function canonicalGitHubURL(value) {
  if (typeof value !== 'string' || !/^https:\/\/github\.com\//.test(value)) return '';
  try {
    const url = new URL(value);
    if (url.origin !== 'https://github.com' || url.username || url.password || url.port) return '';
    const repository = /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/(?:issues|pull)\/[1-9]\d*)?\/?$/;
    const project = /^\/(?:orgs|users)\/[A-Za-z0-9_.-]+\/projects\/[1-9]\d*\/?$/;
    if (!repository.test(url.pathname) && !project.test(url.pathname)) return '';
    // Preserve only the exporter-generated draft item selector, never arbitrary queries.
    const itemId = url.searchParams.get('itemId');
    const query = project.test(url.pathname) && /^\d+$/.test(itemId || '') && url.searchParams.get('pane') === 'issue'
      ? `?pane=issue&itemId=${itemId}` : '';
    return `${url.origin}${url.pathname.replace(/\/$/, '')}${query}`;
  } catch { return ''; }
}

function links(value) {
  const urls = [...new Set((String(value || '').match(/https:\/\/[^\s<>"']+/g) || [])
    .map(url => canonicalGitHubURL(url.replace(/[),.;\]]+$/, ''))).filter(Boolean))];
  return urls.length ? `<p class="planning-dock-links">${urls.map(url => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>`).join(' · ')}</p>` : '';
}

function source(item) {
  const restricted = item.private || item.bodyRedacted;
  if (restricted) return '<p>Details intentionally withheld from this public dock.</p>';
  const outcome = item.fields.Outcome || 'No Outcome finish line published.';
  const url = canonicalGitHubURL(item.url);
  return `${url ? `<p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open source card on GitHub ↗</a></p>` : ''}
    <p class="planning-dock-text">${esc(outcome)}</p>${links(outcome)}
    <details><summary>Published notes / evidence — source claims, not verification</summary>
      <p class="planning-dock-text">${esc(item.body || 'No evidence notes published.')}</p>${links(item.body)}</details>
    ${['Dependencies', 'Crossovers'].map(field => `<details><summary>${field} — explicit source field</summary>
      <p class="planning-dock-text">${esc(item.fields[field] || `No ${field.toLowerCase()} published.`)}</p>${links(item.fields[field])}</details>`).join('')}`;
}

function members({ site, items = [], current }) {
  if (!site || !isPublishedSnapshot(current)) return [];
  const ids = new Set((site.items || items).map(item => item.id));
  return current.items.filter(item => ids.has(item.id)).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function renderPlanningDock(options = {}) {
  const { site, previous = null, current } = options;
  const changes = compareSnapshots(previous, current);
  const cards = members(options);
  const remaining = cards.filter(item => item.fields.Status !== 'Done');
  const itemButton = item => `<button type="button" data-dock-item="${esc(item.id)}">${esc(item.title)}</button>`;
  const scope = new Set([...(site?.items || options.items || []).map(item => item.id)]);
  if (isPublishedSnapshot(previous) && site) {
    for (const item of previous.items) {
      if (item.id === site.id || (site.type === 'workstream' && !item.private && !item.bodyRedacted
        && `workstream:${item.fields.Workstream || 'Unassigned'}` === site.id
        && item.fields.Kind !== 'Milestone')) scope.add(item.id);
    }
  }
  const labels = new Map(cards.map(item => [item.id, item.title]));
  // Removed titles are deliberately not recovered from a possibly private baseline.
  const transitions = changes.kind !== 'compared' ? '' : [
    ...changes.added.filter(id => scope.has(id)).map(id => `${labels.get(id) || 'Card'}: added`),
    ...changes.removed.filter(id => scope.has(id)).map(() => 'Card removed from publication (not a completion)'),
    ...changes.statusChanges.filter(change => scope.has(change.id)).map(change => `${labels.get(change.id) || 'Card'}: ${change.from || 'unset'} → ${change.to || 'unset'}`),
    ...changes.dateShifts.filter(change => scope.has(change.id)).map(change => `${labels.get(change.id) || 'Card'}: ${change.field} ${change.from || 'unset'} → ${change.to || 'unset'}`),
    ...changes.updated.filter(id => scope.has(id)
      && !changes.statusChanges.some(change => change.id === id)
      && !changes.dateShifts.some(change => change.id === id)).map(id => `${labels.get(id) || 'Card'}: source details updated`),
  ].map(line => `<li>${esc(line)}</li>`).join('');
  return `<section class="planning-dock" aria-label="Docked planning site">
    <h3>${esc(site?.title || 'Choose a construction site')}</h3>
    <p role="status">${esc(summarizeChanges(changes))}</p>
    <p class="planning-dock-note">Comparison is project-wide; details below are site cards. Baseline is in memory only and resets on reload. A changed snapshot or a card marked Done is not independent delivery verification.</p>
    ${transitions ? `<details><summary>Site changes since previous publication</summary><ul>${transitions}</ul></details>` : ''}
    ${!isPublishedSnapshot(current) ? '<p>Current publication unavailable. No card progress inferred.</p>' : !site ? '<p>Select a site to inspect its actual cards.</p>' : !cards.length ? '<p>No published cards at this site.</p>' : `
    <h4>Source Outcome / finish line and evidence</h4>
    ${cards.length === 1 ? source(cards[0]) : `<p>${site.project ? 'Explicit public repository grouping' : 'Workstream grouping only'} — no extra milestone or inferred finish line.</p>${cards.map(item => `<details><summary>${esc(item.title)} — ${esc(item.fields.Status || 'Status unset')}</summary>${source(item)}</details>`).join('')}`}
    <h4>Remaining actual cards (${remaining.length} / ${cards.length})</h4>
    ${remaining.length ? `<ul class="planning-dock-cards">${remaining.map(item => `<li>${itemButton(item)} <span>${esc(item.fields.Status || 'Status unset')}</span></li>`).join('')}</ul>` : '<p>All site cards are marked Done in the source; evidence still requires review.</p>'}
    <details><summary>All source cards (${cards.length})</summary><ul>${cards.map(item => `<li>${itemButton(item)}</li>`).join('')}</ul></details>`}
    <p class="planning-dock-note">Dependencies and crossovers are quoted, never resolved from prose or assumed satisfied.</p>
  </section>`;
}

export function mountPlanningDock({ container, ...initial }) {
  if (!container || typeof container.addEventListener !== 'function' || typeof container.removeEventListener !== 'function') {
    throw new TypeError('A DOM container is required.');
  }
  let options = initial, destroyed = false;
  const click = event => {
    const button = event.target.closest?.('[data-dock-item]');
    if (!button || !container.contains(button)) return;
    const item = members(options).find(item => item.id === button.dataset.dockItem);
    if (item && typeof options.onItem === 'function') options.onItem(item);
  };
  container.addEventListener('click', click);
  const update = (next = {}) => {
    if (destroyed) return;
    options = { ...options, ...next };
    container.innerHTML = renderPlanningDock(options);
  };
  update();
  return {
    update,
    destroy() {
      destroyed = true;
      container.removeEventListener('click', click);
      container.innerHTML = '';
      options = {};
    },
  };
}
