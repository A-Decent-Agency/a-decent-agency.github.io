import { itemIdentity } from './site-identities.js';
import { CANOPY } from './canopy-registry.js';
import { REVIVAL_PLANS, ROUTER_PLAN, revivalPlan } from './revival-plans.js';

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
  ...REVIVAL_PLANS.map(plan => ({ repository: plan.repository, name: plan.name, form: 'planning-tower', color: plan.color,
    milestone: `${plan.district} / proposed revival`, basis: 'Steward-directed planning tower · 31 Oct 2026; schematic levels are proposals, not releases' })),
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
    { repository: 'A-Decent-Agency/DBuskRadio' }, { repository: 'A-Decent-Agency/DVert' },
    { repository: 'A-Decent-Agency/a-decent-agency.github.io' }]) {
    if (!groups.has(project.repository.toLowerCase())) groups.set(project.repository.toLowerCase(), { repository: project.repository, items: [] });
  }
  const sites = [...groups.values()].map(group => {
    const index = LANDMARKS.findIndex(project => project.repository.toLowerCase() === group.repository.toLowerCase());
    const project = index < 0 ? { repository: group.repository, name: group.repository.split('/')[1],
      form: 'blueprint', color: '#8ba3bd', milestone: 'Future district / plans and barriers' } : LANDMARKS[index];
    return { id: `project:${group.repository.toLowerCase()}`, title: project.name, type: 'repository', project,
      items: group.items, start: '', target: '', horizon: index < 0 ? 'Later' : index === 5 || index >= 7 ? 'Next' : 'Now',
      order: index < 0 ? 100 : index };
  }).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  if (includeContext) sites.push({
    id: `entity:${ROUTER_PLAN.entityId}`, title: ROUTER_PLAN.name, type: 'infrastructure',
    project: { repository: ROUTER_PLAN.repository, entityId: ROUTER_PLAN.entityId, name: ROUTER_PLAN.name,
      form: 'planning-tower', color: ROUTER_PLAN.color, milestone: 'Existing settlements infrastructure / independent makeover',
      basis: 'Steward-reported operational router; makeover levels are proposals, not verified transaction counts' },
    items: [], start: '', target: '', horizon: 'Now', order: 8,
  });
  return sites.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export function campusStructure(site, feed) {
  const observation = site.project?.entityId ? undefined
    : feed?.repositories?.find(entry => entry.repository.toLowerCase() === site.project?.repository.toLowerCase());
  const form = site.project?.form || 'blueprint';
  const plan = revivalPlan(site.project?.repository, site.project?.entityId);
  const plannedFloors = plan?.stages.length || 0;
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
  const baseHeight = form === 'tower' ? floors * 9 : form === 'foundation' ? floors * 6 : Math.max(8, floors * 9);
  const skeleton = issueSkeleton(observation?.structures, { width, baseTop: floors ? baseHeight : 0, baseFloors: floors, side: site.index % 2 ? 1 : -1 });
  const proposalBase = Math.max(floors ? baseHeight : 0, skeleton.top);
  const openSkeleton = [...skeleton.levels, ...skeleton.grounds].some(structure => structure.open > 0);
  const messy = active.length > 0 || openSkeleton || !deliveredFloors && form !== 'entrance' && !skeleton.finished;
  const buildCranes = messy && (site.items.length || openSkeleton) ? Math.max(1, site.cranes || 0) : 0;
  return { form, floors, deliveredFloors, plannedFloors, plan, proposalBase, versions, completed, remaining, active, codeBytes, observation, messy, buildCranes,
    baseHeight, height: plannedFloors ? proposalBase + plannedFloors * 9 : Math.max(baseHeight, skeleton.top), width, ...skeleton,
    label: site.project?.milestone || site.phase,
    basis: `${site.project?.basis || 'Steward-selected architectural stage'}. ${versions.length} receipt-backed delivered version(s); ${remaining.length} remaining mapped jobs. ${skeleton.levels.length + skeleton.grounds.length ? `${skeleton.finishedCount}/${skeleton.levels.length + skeleton.grounds.length} planned structures finished from public milestone issue counts. ` : ''}${plannedFloors ? `${plannedFloors} outlined proposal levels; they do not alter board status or delivered-floor counts. ` : ''}Public language bytes scale footprint logarithmically, not value or readiness.` };
}

export const LEVEL_HEIGHT = 9;
// A main tower holds at most MAIN_TOWER_STORIES stories (base floors + planned levels); further levels sprawl into
// satellite towers on fractal cul-de-sacs, adapting DecentCanopy's scripts/spiral.js placeBranch / angleOffsets layout.
export const MAIN_TOWER_STORIES = 12, SATELLITE_STORIES = 6, LOTS_PER_CULDESAC = 3, SATELLITE_WIDTH = 16;
// Grounds sit behind the tower, clear of the level signs (left), service yard (right) and plan sign (front left).
const GROUNDS_SLOTS = [() => [-16, -46], () => [16, -46], w => [-(w / 2 + 26), -38], w => [w / 2 + 32, -42], () => [0, -72], w => [-(w / 2 + 26), -64]];
export function angleOffsets(count, spread) {
  if (count <= 1) return [0];
  return Array.from({ length: count }, (_, index) => -spread / 2 + spread / (count - 1) * index);
}
// Cul-de-sacs form a binary branch tree in breadth-first order, branching outward (side = +1 right, -1 left) and
// behind the campus so the highway, plaza, service yard and grounds slots stay clear. Each bulb holds three lots.
export function culDeSacLayout(lotCount, { side = 1, width = 30 } = {}) {
  const count = Math.ceil(Math.max(0, lotCount) / LOTS_PER_CULDESAC);
  if (!count) return { culdesacs: [], roads: [], lots: [] };
  const gate = { x: side * (width / 2 + 6), z: -26 }, junction = { x: side * (width / 2 + 46), z: -26 };
  const roads = [{ x1: gate.x, z1: gate.z, x2: junction.x, z2: junction.z }], culdesacs = [];
  for (let index = 0; index < count; index++) {
    const parent = index ? culdesacs[Math.floor((index - 1) / 2)] : null, from = parent || junction;
    const siblings = parent ? Math.min(2, count - (2 * parent.index + 1)) : 1;
    const angle = parent ? parent.angle + angleOffsets(siblings, 1.4)[(index - 1) % 2] : -Math.PI / 2 + side * .3;
    const depth = parent ? parent.depth + 1 : 0, length = 66 * Math.pow(.9, depth);
    const x = from.x + Math.cos(angle) * length, z = from.z + Math.sin(angle) * length;
    culdesacs.push({ index, depth, angle, x, z, radius: 11, branches: Math.max(0, Math.min(2, count - (2 * index + 1))) });
    roads.push({ x1: from.x, z1: from.z, x2: x, z2: z });
  }
  const lots = culdesacs.flatMap(bulb => (bulb.branches ? [-2.2, 2.2, 1.3] : [-1.3, 0, 1.3])
    .map(turn => ({ culdesac: bulb.index, x: bulb.x + Math.cos(bulb.angle + turn) * (bulb.radius + 13),
      z: bulb.z + Math.sin(bulb.angle + turn) * (bulb.radius + 13) }))).slice(0, lotCount);
  return { culdesacs, roads, lots };
}
// Each public issue in a planned milestone is one structural bay; closed issues clad their bay. Counts are planning evidence, not quality.
export function issueSkeleton(structures, { width = 30, baseTop = 0, baseFloors = 0, side = 1 } = {}) {
  const shape = structure => {
    const total = structure.open + structure.closed;
    const bays = Math.max(1, Math.min(16, total));
    return { ...structure, total, bays,
      cladBays: !total ? 0 : !structure.open ? bays : Math.min(bays - 1, Math.max(structure.closed ? 1 : 0, Math.round(bays * structure.closed / total))),
      finished: total > 0 && structure.open === 0,
      stage: !total ? 'Outlined / no issues yet' : structure.open === 0 ? 'Finished' : structure.closed ? 'Under construction' : 'Skeleton' };
  };
  const list = Array.isArray(structures) ? structures : [];
  const planned = list.filter(structure => structure.kind === 'level').sort((a, b) => a.order - b.order || a.number - b.number).map(shape);
  const mainCount = Math.max(0, MAIN_TOWER_STORIES - baseFloors);
  const main = planned.slice(0, mainCount).map((structure, index) => ({ ...structure, tower: 0, x: 0, z: 0,
    y: 2 + baseTop + index * LEVEL_HEIGHT, width: Math.max(12, width * .82 - index * 1.4) }));
  const overflow = planned.slice(mainCount);
  const satellites = Array.from({ length: Math.ceil(overflow.length / SATELLITE_STORIES) }, (_, index) => overflow.slice(index * SATELLITE_STORIES, (index + 1) * SATELLITE_STORIES));
  const sortedGrounds = list.filter(structure => structure.kind === 'grounds').sort((a, b) => a.order - b.order || a.number - b.number).map(shape);
  const extraGrounds = sortedGrounds.slice(GROUNDS_SLOTS.length);
  const sprawl = culDeSacLayout(satellites.length + extraGrounds.length, { side, width });
  const towers = satellites.map((stories, index) => {
    const { x, z, culdesac } = sprawl.lots[index];
    const levels = stories.map((structure, story) => ({ ...structure, tower: index + 1, x, z, culdesac,
      y: 2 + story * LEVEL_HEIGHT, width: SATELLITE_WIDTH }));
    return { index: index + 1, x, z, culdesac, levels, top: 2 + levels.length * LEVEL_HEIGHT,
      name: `L${levels[0].order}${levels.length > 1 ? `–L${levels.at(-1).order}` : ''}`,
      finishedCount: levels.filter(level => level.finished).length, finished: levels.every(level => level.finished) };
  });
  const grounds = sortedGrounds.map((shaped, index) => {
    const lot = index < GROUNDS_SLOTS.length ? null : sprawl.lots[satellites.length + index - GROUNDS_SLOTS.length];
    const [x, z] = lot ? [lot.x, lot.z] : GROUNDS_SLOTS[index](width);
    return { ...shaped, x, z, ...(lot ? { culdesac: lot.culdesac } : {}),
      size: lot ? 10 : 11 + Math.min(6, shaped.bays * .5), height: 6 + Math.min(8, shaped.bays) };
  });
  const levels = [...main, ...towers.flatMap(tower => tower.levels)];
  const all = [...levels, ...grounds];
  return { levels, grounds, towers, culdesacs: sprawl.culdesacs, roads: sprawl.roads,
    finishedCount: all.filter(structure => structure.finished).length,
    finished: all.length > 0 && all.every(structure => structure.finished),
    top: main.length ? baseTop + main.length * LEVEL_HEIGHT : 0 };
}
