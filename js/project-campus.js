import { itemIdentity } from './site-identities.js';

// Art direction records steward milestones, not a computed readiness or ownership score.
export const LANDMARKS = [
  { repository: 'TheJollyLaMa/DecentAgency', name: 'Decent Agency', form: 'entrance', color: '#71e6d0',
    milestone: 'Planning office / independently interconnected' },
  { repository: 'TheJollyLaMa/DecentBusking', name: 'DecentBusking', form: 'tower', color: '#f0bd70',
    milestone: 'Version 1 construction complete', basis: 'Steward milestone · 25 Oct 2026; not a claim of a published v1 tag' },
  { repository: 'TheJollyLaMa/DecentHead', name: 'DecentHead', form: 'hall', color: '#8ddbea',
    milestone: 'Shared infrastructure / released building' },
  { repository: 'TheJollyLaMa/DecentMarket', name: 'DecentMarket', form: 'hall', color: '#f3ce76',
    milestone: 'Marketplace / released building' },
  { repository: 'TheJollyLaMa/DecentCanopy', name: 'DecentCanopy', form: 'foundation', color: '#74dfb4',
    milestone: 'Broad foundations / growing the network' },
  { repository: 'TheJollyLaMa/BigNuten_Vanilla', name: 'BigNuten', form: 'staging', color: '#cfaaef',
    milestone: 'Next construction site / recovery acceptance ahead' },
];

export function publicRepository(item) {
  if (!item || item.private || item.bodyRedacted || item.redacted || item.isPrivate || item.repository?.isPrivate) return null;
  const identity = itemIdentity(item);
  if (identity.projects.length === 1) return identity.projects[0].repository;
  const direct = typeof item.repository === 'string' && /^[\w.-]+\/[\w.-]+$/.test(item.repository)
    ? item.repository : item.url?.match(/^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/(?:issues|pull)\/\d+$/)?.[1];
  if (direct) return direct;
  if (item.fields?.Kind !== 'Portfolio') return null;
  return item.body?.match(/(?:^|\n)Repository:\s*https:\/\/github\.com\/([\w.-]+\/[\w.-]+)(?=[\s/]|$)/i)?.[1] || null;
}

export function projectSites(items) {
  const groups = new Map();
  for (const item of items) {
    if (item.fields?.Kind === 'Milestone') continue;
    const repository = publicRepository(item);
    if (!repository) continue;
    const key = repository.toLowerCase();
    if (!groups.has(key)) groups.set(key, { repository, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()].map(group => {
    const index = LANDMARKS.findIndex(project => project.repository.toLowerCase() === group.repository.toLowerCase());
    const project = index < 0 ? { repository: group.repository, name: group.repository.split('/')[1],
      form: 'blueprint', color: '#8ba3bd', milestone: 'Future district / plans and barriers' } : LANDMARKS[index];
    return { id: `project:${group.repository.toLowerCase()}`, title: project.name, type: 'repository', project,
      items: group.items, start: '', target: '', horizon: index < 0 ? 'Later' : index === 5 ? 'Next' : 'Now',
      order: index < 0 ? 100 : index };
  }).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export function campusStructure(site, feed) {
  const observation = feed?.repositories?.find(entry => entry.repository.toLowerCase() === site.project?.repository.toLowerCase());
  const form = site.project?.form || 'blueprint';
  const completed = site.items.filter(item => item.fields?.Status === 'Done').length;
  const floors = form === 'tower' ? Math.min(12, 5 + Math.floor(completed / 3))
    : form === 'foundation' ? 2 + Math.min(2, Math.floor(completed / 8)) : form === 'hall' || form === 'entrance' ? 1 : 0;
  return { form, floors, completed, observation,
    height: form === 'tower' ? floors * 7 : form === 'foundation' ? floors * 4 : form === 'hall' ? 10 : 5,
    width: form === 'foundation' ? 43 : form === 'hall' ? 36 : form === 'tower' ? 23 : 30,
    label: site.project?.milestone || site.phase,
    basis: site.project?.basis || 'Steward-selected architectural stage; board counts and GitHub observations shown separately.' };
}
