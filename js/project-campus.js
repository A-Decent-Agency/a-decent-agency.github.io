import { itemIdentity } from './site-identities.js';
import { CANOPY } from './canopy-registry.js';

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
  { repository: 'A-Decent-Agency/a-decent-agency.github.io', name: 'Agency Office', form: 'hall', color: '#baa2e8',
    milestone: 'Planning observatory / shared jobs and project map' },
];

export function publicRepository(item) {
  if (!item || item.private || item.bodyRedacted || item.redacted || item.isPrivate || item.repository?.isPrivate) return null;
  const identity = itemIdentity(item);
  if (identity.projects.length === 1) return identity.projects[0].repository;
  const explicit = item.fields?.Project;
  if (CANOPY.projects.some(project => project.repository === explicit)) return explicit;
  const direct = typeof item.repository === 'string' && /^[\w.-]+\/[\w.-]+$/.test(item.repository)
    ? item.repository : item.url?.match(/^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/(?:issues|pull)\/\d+$/)?.[1];
  if (direct) return direct;
  if (item.fields?.Kind !== 'Portfolio') return null;
  return item.body?.match(/(?:^|\n)Repository:\s*https:\/\/github\.com\/([\w.-]+\/[\w.-]+)(?=[\s/]|$)/i)?.[1] || null;
}

export function projectSites(items, { includeContext = false } = {}) {
  const groups = new Map();
  for (const item of items) {
    if (item.fields?.Kind === 'Milestone') continue;
    const repository = publicRepository(item);
    if (!repository) continue;
    const key = repository.toLowerCase();
    if (!groups.has(key)) groups.set(key, { repository, items: [] });
    groups.get(key).items.push(item);
  }
  if (includeContext) for (const project of [...CANOPY.projects,
    { repository: 'A-Decent-Agency/DBuskRadio' }, { repository: 'A-Decent-Agency/DVert' }]) {
    if (!groups.has(project.repository.toLowerCase())) groups.set(project.repository.toLowerCase(), { repository: project.repository, items: [] });
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
  const versions = observation?.versions || [];
  const deliveredFloors = Math.min(12, versions.length);
  const remaining = site.items.filter(item => !['Done'].includes(item.fields?.Status) && item.fields?.Kind !== 'Portfolio');
  const active = remaining.filter(item => ['In Progress', 'Blocked'].includes(item.fields?.Status));
  const baseFloors = form === 'tower' ? Math.min(9, 3 + Math.floor(completed / 4)) : form === 'foundation' ? 2 : form === 'hall' || form === 'entrance' ? 1 : 0;
  const floors = Math.max(deliveredFloors, baseFloors);
  const codeBytes = observation?.codeBytes;
  const size = codeBytes == null ? 1 : Math.min(1.65, .85 + Math.log10(1 + codeBytes / 10000) * .22);
  const width = (form === 'foundation' ? 43 : form === 'hall' ? 36 : form === 'tower' ? 23 : 30) * size;
  const messy = active.length > 0 || !deliveredFloors && form !== 'entrance';
  const buildCranes = messy && site.items.length ? Math.max(1, site.cranes || 0) : 0;
  return { form, floors, deliveredFloors, versions, completed, remaining, active, codeBytes, observation, messy, buildCranes,
    height: form === 'tower' ? floors * 9 : form === 'foundation' ? floors * 6 : Math.max(8, floors * 9),
    width,
    label: site.project?.milestone || site.phase,
    basis: `${site.project?.basis || 'Steward-selected architectural stage'}. ${versions.length} receipt-backed delivered version(s); ${remaining.length} remaining mapped jobs. Public language bytes scale footprint logarithmically, not value or readiness.` };
}
