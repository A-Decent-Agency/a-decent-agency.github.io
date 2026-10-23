const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' ? value : '';
const safePrivateFields = new Set(['Kind', 'Status', 'Start', 'Target']);

export function isPublishedSnapshot(snapshot) {
  return record(snapshot) && snapshot.schemaVersion === 1
    && typeof snapshot.exportedAt === 'string'
    && Number.isFinite(Date.parse(snapshot.exportedAt)) && !snapshot.error
    && Array.isArray(snapshot.items)
    && snapshot.items.every(item => record(item) && typeof item.id === 'string' && item.id.trim()
      && typeof item.title === 'string' && record(item.fields)
      && Object.values(item.fields).every(value => typeof value === 'string'
        || (Array.isArray(value) && value.every(entry => typeof entry === 'string'))))
    && new Set(snapshot.items.map(item => item.id)).size === snapshot.items.length;
}

function canonical(value) {
  if (Array.isArray(value)) return JSON.stringify([...value].sort());
  if (record(value)) return JSON.stringify(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return JSON.stringify(value);
}

function observable(item) {
  const restricted = item.private || item.bodyRedacted;
  return {
    title: item.title,
    fields: Object.fromEntries(Object.entries(item.fields).filter(([key]) => !restricted || safePrivateFields.has(key))),
    ...(!restricted ? { body: text(item.body), url: text(item.url), repository: text(item.repository) } : {}),
  };
}

/**
 * Compare only successful, complete publications. Results contain IDs and explicit
 * status/date transitions, never bodies, tokens or inferred dependency state.
 */
export function compareSnapshots(previous, current) {
  const empty = { added: [], removed: [], statusChanges: [], newlyBlocked: [], completed: [], dateShifts: [], updated: [] };
  const unavailable = reason => ({ kind: 'unavailable', reason, changed: null, ...empty });
  if (!isPublishedSnapshot(current)) return unavailable('Current publication is invalid; retain the last valid baseline.');
  if (previous == null) return { kind: 'first-observation', changed: null, ...empty };
  if (!isPublishedSnapshot(previous)) return unavailable('Previous publication is invalid; no comparison is available.');
  if (text(previous.url) !== text(current.url)) return unavailable('Publications belong to different projects.');
  if (Date.parse(current.exportedAt) < Date.parse(previous.exportedAt)) return unavailable('Publication is older than the baseline.');
  const before = new Map(previous.items.map(item => [item.id, item]));
  const after = new Map(current.items.map(item => [item.id, item]));
  const result = { kind: 'compared', changed: false, ...empty };
  for (const id of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const old = before.get(id), item = after.get(id);
    if (!old) { result.added.push(id); continue; }
    if (!item) { result.removed.push(id); continue; }
    const from = text(old.fields.Status), to = text(item.fields.Status);
    if (from !== to) {
      result.statusChanges.push({ id, from, to });
      if (to === 'Blocked') result.newlyBlocked.push(id);
      if (to === 'Done') result.completed.push(id);
    }
    for (const field of ['Start', 'Target']) {
      const from = text(old.fields[field]), to = text(item.fields[field]);
      if (from !== to) result.dateShifts.push({ id, field, from, to });
    }
    if (canonical(observable(old)) !== canonical(observable(item))) result.updated.push(id);
  }
  result.changed = result.added.length + result.removed.length + result.updated.length > 0;
  return result;
}

export function summarizeChanges(changes) {
  if (changes.kind === 'first-observation') return 'First observation — no previous valid publication in this session.';
  if (changes.kind === 'unavailable') return `Change comparison unavailable. ${changes.reason}`;
  if (!changes.changed) return 'No observed card changes since the previous valid publication.';
  return `${changes.added.length} added · ${changes.removed.length} removed · ${changes.statusChanges.length} status changes · ${changes.newlyBlocked.length} newly blocked · ${changes.completed.length} marked Done · ${changes.dateShifts.length} date shifts · ${changes.updated.length} existing cards updated.`;
}
