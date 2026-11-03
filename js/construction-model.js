import { projectSites } from './project-campus.js';

export const FLIGHT_BOUNDS = { lateral: 24, vertical: 16, spacing: 110 };
const OFFICE_REPOSITORY = 'A-Decent-Agency/a-decent-agency.github.io';
const OFFICE_ID = `project:${OFFICE_REPOSITORY.toLowerCase()}`;
// Reviewed Calendar blueprint belongs to the project, not its Office issue-host repository.
const PROJECT_CHECKPOINTS = new Map([
  ['PVTI_lADODD7ovc4Bn91hzhELHuo', 'project:thejollylama/decentcalendar']
]);
export function siteMetrics(items) {
  const total = items.length;
  const active = items.filter(item => item.fields?.Status === 'In Progress').length;
  const done = items.filter(item => item.fields?.Status === 'Done').length;
  const blocked = items.filter(item => item.fields?.Status === 'Blocked').length;
  // A planning-card count is a visual workload proxy, never an effort or funding estimate.
  const cranes = !total || total === done ? 0 : active === 0 ? 1 : Math.min(6, 1 + Math.ceil(Math.sqrt(active)));
  return { total, active, done, blocked, cranes, scale: 1 + Math.min(1.7, Math.sqrt(total) / 6),
    phase: !total ? 'Context / no mapped jobs' : total === done ? 'Handover' : active ? 'Under construction' : blocked ? 'Access restricted' : 'Foundations / not started' };
}
export function constructionSites(items, options) {
  const campuses = projectSites(items, options);
  const assigned = new Set(campuses.flatMap(site => site.items.map(item => item.id)));
  const shared = items.filter(item => !assigned.has(item.id));
  if (shared.length && !campuses.some(site => site.id === OFFICE_ID)) {
    const office = projectSites([], { includeContext: true }).find(site => site.id === OFFICE_ID);
    campuses.push(office);
  }
  const office = campuses.find(site => site.id === OFFICE_ID);
  if (office) {
    office.items.push(...shared);
    office.planningItems = shared.map(item => item.id);
  }
  for (const [cardId, destination] of PROJECT_CHECKPOINTS) {
    const target = campuses.find(site => site.id === destination);
    const source = campuses.find(site => site.items.some(item => item.id === cardId && !item.private && !item.bodyRedacted));
    if (!target || !source || source === target) continue;
    const index = source.items.findIndex(item => item.id === cardId);
    target.items.push(...source.items.splice(index, 1));
  }
  for (const site of campuses) {
    site.aliases = site.items.filter(item => item.fields?.Kind === 'Milestone').map(item => item.id);
  }
  // Old workstream addresses continue to reach Town Hall, but are no longer road destinations.
  if (office) office.aliases.push(...new Set(items.filter(item => item.fields?.Kind !== 'Milestone')
    .map(item => `workstream:${item.fields?.Workstream || 'Unassigned'}`)));
  return campuses.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
    .map((site, index) => ({ ...site, ...siteMetrics(site.items), index, position: routePoint(index) }));
}
export function routePoint(progress) {
  return { x: Math.sin(progress * .85) * 32, y: Math.sin(progress * .47) * 9, z: -progress * FLIGHT_BOUNDS.spacing };
}
export function pastCameraOffset(radius, azimuth, elevation) {
  const horizontal = Math.cos(elevation) * radius;
  return {
    x: Math.sin(azimuth) * horizontal,
    y: Math.sin(elevation) * radius,
    z: -Math.cos(azimuth) * horizontal,
  };
}
export function flightStep(state, keys, seconds, count) {
  const dt = Math.min(.05, Math.max(0, seconds));
  const axis = (a, b) => Number(keys.has(a)) - Number(keys.has(b));
  const forward = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
  return {
    progress: Math.min(Math.max(0, count - 1), Math.max(0, state.progress + forward * dt * (keys.has('shift') ? 1.4 : .65))),
    x: Math.min(FLIGHT_BOUNDS.lateral, Math.max(-FLIGHT_BOUNDS.lateral, state.x + axis('d', 'a') * dt * 20)),
    y: Math.min(FLIGHT_BOUNDS.vertical, Math.max(-FLIGHT_BOUNDS.vertical, state.y + axis('e', 'q') * dt * 14))
  };
}
export function snapshotFreshness(exportedAt, now = Date.now()) {
  const at = Date.parse(exportedAt);
  if (!Number.isFinite(at) || at > now + 60000) return 'Snapshot date unavailable or invalid';
  return now - at > 86400000 ? 'Last changed snapshot is over a day old; check refresh status' : 'Recent changed snapshot';
}
