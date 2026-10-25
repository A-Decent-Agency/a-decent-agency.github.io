import { CANOPY } from './canopy-registry.js';
import { relationships } from './model.js';

export function campusConnections(sites, feed) {
  const byRepo = new Map(sites.filter(site => site.project).map(site => [site.project.repository.toLowerCase(), site.id]));
  const byItem = new Map(sites.flatMap(site => site.items.map(item => [item.id, site.id])));
  const result = [], seen = new Set();
  const add = link => {
    const key = `${link.from}|${link.to}|${link.kind}|${link.label}`;
    if (!link.from || !link.to || link.from === link.to || seen.has(key)) return;
    seen.add(key); result.push(link);
  };
  for (const link of CANOPY.connections) add({
    ...link, from: byRepo.get(link.from.toLowerCase()), to: byRepo.get(link.to.toLowerCase()),
    url: link.evidence[0]?.url || CANOPY.source, origin: 'Canopy curated map',
    proposed: link.state === 'proposed',
  });
  for (const link of feed?.connections || []) add({
    ...link, from: byRepo.get(link.from.toLowerCase()), to: byRepo.get(link.to.toLowerCase()),
    kind: 'integration', state: 'recorded', proposed: false, origin: 'Reviewed integration evidence',
  });
  for (const link of relationships(sites.flatMap(site => site.items).filter(item => !item.private && !item.bodyRedacted))) add({
    ...link, from: byItem.get(link.from), to: byItem.get(link.to),
    label: link.kind === 'dependency' ? 'Explicit board dependency' : 'Explicit board crossover',
    proposed: link.kind === 'crossover', state: 'planning', origin: 'GitHub Project fields', url: '',
    itemIds: [link.from, link.to],
  });
  for (const site of sites.filter(site => site.type === 'milestone')) {
    const repository = site.items[0]?.fields?.Project;
    if (repository) add({ from: site.id, to: byRepo.get(repository.toLowerCase()),
      kind: 'milestone', state: 'planning', proposed: false,
      label: 'Explicit milestone Project field', origin: 'GitHub Project fields', url: site.items[0]?.url || '' });
  }
  return result;
}
export function campusPriority(site) {
  return site?.items.some(item => item.fields?.Status === 'Blocked') ? 'Blocked'
    : site?.items.some(item => item.fields?.Status !== 'Done' && item.fields?.Horizon === 'Now') ? 'Now'
      : site?.items.some(item => item.fields?.Status !== 'Done' && item.fields?.Horizon === 'Next') ? 'Next' : 'Later';
}
