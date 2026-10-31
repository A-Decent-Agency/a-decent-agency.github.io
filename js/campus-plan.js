import { escapeHTML as esc } from './markdown.js';
import { campusConnections, campusPriority } from './campus-graph.js';
import { COLORS } from './model.js';
import { renderRevivalPlan, renderHumanPriorities } from './revival-plans.js';

export function renderCampusPlan(site, sites, feed) {
  if (!site) return '<p>Select a construction site.</p>';
  const connections = campusConnections(sites, feed).filter(link => link.from === site.id || link.to === site.id);
  const neighbors = [...new Set(connections.map(link => link.from === site.id ? link.to : link.from))]
    .map(id => sites.find(site => site.id === id)).filter(Boolean);
  const nodes = [site, ...neighbors], width = 600, height = Math.max(160, Math.ceil(nodes.length / 3) * 95 + 30);
  const position = index => ({ x: 100 + index % 3 * 200, y: 40 + Math.floor(index / 3) * 95 });
  const lines = connections.map(link => {
    const a = position(nodes.findIndex(node => node.id === link.from)), b = position(nodes.findIndex(node => node.id === link.to));
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${link.proposed ? '#b297da' : '#71e6d0'}" stroke-width="2" ${link.proposed ? 'stroke-dasharray="5 5"' : ''}/>`;
  }).join('');
  const diagram = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(site.title)} local connection map">${lines}${nodes.map((node, index) => {
    const p = position(index);
    return `<g><rect x="${p.x - 88}" y="${p.y - 17}" width="176" height="48" rx="8" fill="#24273b" stroke="${index ? '#7087a8' : '#f0bd70'}"/><text x="${p.x}" y="${p.y}" text-anchor="middle" fill="#f4eaff" font-size="12">${esc(node.title.slice(0, 24))}</text><text x="${p.x}" y="${p.y + 18}" text-anchor="middle" fill="#9fcece" font-size="10">${esc(campusPriority(node))} / ${node.items.length} cards</text></g>`;
  }).join('')}</svg>`;
  const groups = new Map();
  for (const item of site.items) {
    const component = item.fields?.Component || item.fields?.Workstream || 'Unmapped component';
    if (!groups.has(component)) groups.set(component, []);
    groups.get(component).push(item);
  }
  return `<section class="campus-plan">${site.project ? `<details><summary>Human needs / cultural beacons</summary>${renderHumanPriorities(site.project)}</details>` : ''}${renderRevivalPlan(site)}<h4>Site plan / same published jobs, in 2D</h4>${diagram}
    <p>Solid: recorded integration / dependency. Dashed: proposed crossover, not shipped compatibility. Select a job to illuminate this building's connections.</p>
    <div class="campus-neighbors">${neighbors.map(node => `<button data-campus-site="${esc(node.id)}">${esc(node.title)} / ${esc(campusPriority(node))}</button>`).join('')}</div>
    <details><summary>Connection evidence (${connections.length})</summary><ul>${connections.map(link => `<li><b>${esc(link.kind)} / ${esc(link.state)}</b> ${esc(link.label)}
      ${link.url ? `<a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">Source</a>` : ''}
      ${link.nextTest ? `<p>Next test: ${esc(link.nextTest)}</p>` : ''}</li>`).join('') || '<li>No mapped public connection.</li>'}</ul></details>
    ${[...groups].map(([component, items]) => `<details open><summary>${esc(component)} / ${items.length} jobs</summary><div class="campus-jobs">${items.map(item => `<button data-campus-item="${esc(item.id)}" style="border-left-color:${COLORS[item.fields?.Status] || '#8ba3bd'}"><small>${esc(item.fields?.Priority || item.fields?.Horizon || 'Unprioritized')} / ${esc(item.fields?.Status || 'Unset')}</small>${esc(item.title)}${item.fields?.['Delivery version'] ? `<small>${esc(item.fields['Delivery version'])}</small>` : ''}</button>`).join('')}</div></details>`).join('') || '<p>No board jobs mapped to this contextual project. Its presence is not a completion claim.</p>'}</section>`;
}
