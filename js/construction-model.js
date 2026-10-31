import { dateNumber } from './model.js';
import { projectSites } from './project-campus.js';

export const FLIGHT_BOUNDS = { lateral: 24, vertical: 16, spacing: 110 };
const horizons = ['Now', 'Next', 'Later', 'Inventory'];
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
  const milestones = items.filter(item => item.fields?.Kind === 'Milestone');
  const sites = milestones.map(item => ({ id: item.id, title: item.title, type: 'milestone', items: [item],
    start: item.fields?.Start || '', target: item.fields?.Target || '', horizon: item.fields?.Horizon || 'Inventory' }));
  const groups = new Map();
  for (const item of items.filter(item => item.fields?.Kind !== 'Milestone' && !assigned.has(item.id))) {
    const workstream = item.fields?.Workstream || 'Unassigned';
    if (!groups.has(workstream)) groups.set(workstream, []);
    groups.get(workstream).push(item);
  }
  for (const [name, members] of groups) {
    sites.push({ id: `workstream:${name}`, title: name, type: 'workstream', items: members, start: '', target: '',
      horizon: horizons.find(horizon => members.some(item => item.fields?.Horizon === horizon)) || 'Inventory' });
  }
  sites.sort((a, b) => {
    const ad = dateNumber(a.start) ?? dateNumber(a.target), bd = dateNumber(b.start) ?? dateNumber(b.target);
    if (ad !== null && bd !== null) return ad - bd || a.id.localeCompare(b.id);
    if (ad !== null || bd !== null) return ad !== null ? -1 : 1;
    return horizons.indexOf(a.horizon) - horizons.indexOf(b.horizon) || a.title.localeCompare(b.title);
  });
  return [...campuses, ...sites].map((site, index) => ({ ...site, ...siteMetrics(site.items), index, position: routePoint(index) }));
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
