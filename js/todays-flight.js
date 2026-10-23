import { constructionSites } from './construction-model.js';

export const FLIGHT_GROUPS = [
  { id: 'active', title: 'Active work', empty: 'No explicit In Progress work in this selection.' },
  { id: 'review', title: 'Ready for review', empty: 'No explicit review-ready field in this selection. A PR or prose alone is not readiness.' },
  { id: 'blockers', title: 'Blockers / decisions', empty: 'No explicit Blocked status or open Decision card in this selection.' },
  { id: 'next', title: 'Next unblocked task', empty: 'No Todo task has a fully established, satisfied dependency list in this selection.' },
];

const text = value => typeof value === 'string' ? value.trim() : '';
const reviewReady = item => ['Ready for review', 'Review ready'].includes(item.fields?.Status)
  || ['Ready', 'Ready for review'].includes(item.fields?.['Review status']);
const actionable = item => !['Portfolio', 'Milestone', 'Registry', 'Decision'].includes(item.fields?.Kind)
  && !/^Portfolio:|^Registry:/i.test(item.title);

// Unlike the spatial relationship hints, eligibility needs a complete, unambiguous list.
// Mixed prose, arrows and references outside the supplied public selection stay unknown.
export function dependencyEvidence(item, items) {
  if (item.private) return { state: 'unknown', ids: [], reason: 'Dependencies are withheld for this private item.' };
  const raw = text(item.fields?.Dependencies);
  if (!raw) return { state: 'unknown', ids: [], reason: 'No explicit dependency list is published.' };
  if (/^(?:none|no dependencies)[.!]?$/i.test(raw)) {
    return { state: 'satisfied', ids: [], reason: 'Dependencies explicitly states no dependencies.' };
  }
  const entries = raw.replace(/^(?:requires|depends on):\s*/i, '').split(/[;,\n]/).map(text);
  const ids = [];
  for (const entry of entries) {
    if (!entry) return { state: 'unknown', ids: [], reason: 'The dependency list is incomplete or ambiguous.' };
    const matches = items.filter(candidate => entry === candidate.id || entry === candidate.url
      || entry === candidate.title
      || (/^M\d+$/.test(entry) && candidate.title?.match(/^M\d+\b/)?.[0] === entry));
    if (matches.length !== 1 || matches[0].id === item.id) {
      return { state: 'unknown', ids: [], reason: 'Dependency text is not a complete, uniquely resolved list of public prerequisites.' };
    }
    ids.push(matches[0].id);
  }
  const unique = [...new Set(ids)];
  const satisfied = unique.every(id => items.find(candidate => candidate.id === id)?.fields?.Status === 'Done');
  return { state: satisfied ? 'satisfied' : 'waiting', ids: unique,
    reason: satisfied ? 'Every explicitly listed prerequisite has Status: Done (not proof of deployment).'
      : 'At least one explicitly listed prerequisite does not have Status: Done.' };
}

/**
 * Pure, read-only suggestions from already privacy-filtered snapshot items.
 * Input selection is authoritative: missing prerequisite records remain unknown.
 */
export function todaysFlight(items = [], { maxPerGroup = 3 } = {}) {
  const limit = Number.isFinite(maxPerGroup) ? Math.max(1, Math.min(5, Math.floor(maxPerGroup))) : 3;
  const valid = items.filter(item => item && typeof item.id === 'string' && item.id && typeof item.title === 'string');
  const counts = new Map();
  for (const item of valid) counts.set(item.id, (counts.get(item.id) || 0) + 1);
  // Duplicate IDs cannot establish a stable destination or a unique prerequisite.
  const source = valid.filter(item => counts.get(item.id) === 1);
  const destinations = new Map();
  for (const site of constructionSites(source)) for (const item of site.items) destinations.set(item.id, site.id);
  const candidates = Object.fromEntries(FLIGHT_GROUPS.map(group => [group.id, []]));
  let unknownDependencies = 0, waitingDependencies = 0;
  for (const item of source) {
    const fields = item.fields || {};
    const dependency = dependencyEvidence(item, source);
    if (fields.Status === 'Todo' && actionable(item)) {
      if (dependency.state === 'unknown') unknownDependencies++;
      if (dependency.state === 'waiting') waitingDependencies++;
    }
    let group, why, evidence;
    if (fields.Status === 'Done') continue;
    if (fields.Status === 'Blocked') {
      group = 'blockers'; why = 'Status explicitly says Blocked. The snapshot does not establish what decision will unblock it.';
      evidence = [{ field: 'Status', value: fields.Status }];
    } else if (fields.Kind === 'Decision' && ['Todo', 'In Progress'].includes(fields.Status)) {
      group = 'blockers'; why = 'Kind explicitly says Decision and this card is not Done; this does not prove other work is blocked.';
      evidence = [{ field: 'Kind', value: fields.Kind }, { field: 'Status', value: fields.Status || 'Not published' }];
    } else if (reviewReady(item) && !item.private) {
      group = 'review'; why = 'An explicit field marks this ready for review, not approved, merged or deployed.';
      const field = ['Ready for review', 'Review ready'].includes(fields.Status) ? 'Status' : 'Review status';
      evidence = [{ field, value: fields[field] }];
    } else if (fields.Status === 'In Progress') {
      group = 'active'; why = 'Status explicitly says In Progress; this is active planning work, not a completion claim.';
      evidence = [{ field: 'Status', value: fields.Status }];
    } else if (fields.Status === 'Todo' && actionable(item) && dependency.state === 'satisfied') {
      group = 'next'; why = `Status is Todo. ${dependency.reason} This is a suggestion, not a priority change.`;
      evidence = [{ field: 'Status', value: fields.Status }, { field: 'Dependencies', value: text(fields.Dependencies) }];
    }
    if (group) candidates[group].push({
      id: `todays-flight:${group}:${item.id}`, group, itemId: item.id, item,
      destinationId: destinations.get(item.id), title: item.title, why, evidence, dependency,
    });
  }
  const groups = FLIGHT_GROUPS.map(group => {
    // Snapshot ordering is not a priority signal; IDs provide a deterministic tie-break.
    const all = candidates[group.id].sort((a, b) => a.itemId.localeCompare(b.itemId));
    return { ...group, total: all.length, omitted: Math.max(0, all.length - limit), stops: all.slice(0, limit) };
  });
  return { groups, stops: groups.flatMap(group => group.stops), unknownDependencies, waitingDependencies,
    excludedDuplicateIds: [...counts.values()].filter(count => count > 1).length };
}
