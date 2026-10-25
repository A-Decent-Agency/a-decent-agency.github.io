export const STATUS = ['Todo', 'In Progress', 'Done', 'Blocked'];
export const COLORS = { Todo: '#aa8bea', 'In Progress': '#71e6d0', Done: '#e5c583', Blocked: '#ee92af' };
export const ROLE_COLORS = { 'Umbrella & core platform': '#e5c583', 'Active dapp': '#71e6d0', 'Shared module source': '#8aaff1', Incubating: '#aa8bea', 'Reference / archive candidate': '#bd9c8b', 'External / learning': '#ee92af' };
export const VIEWS = {
  flight: ['The Agency, under construction', 'Fly the project highway: recognizable buildings and public repository offramps, then shared milestone and workstream districts. Architecture records steward milestones; cranes follow the board.'],
  board: ['The execution board', 'Small moves, shared momentum. Pick a card to see what’s behind it.'],
  roadmap: ['The marathon runway', 'Milestones by Start / Target. Today is cyan; undated possibilities wait in staging.'],
  canopy: ['Independently interconnected', 'Workstreams in orbit. Solid lines: dependencies. Dashed lines: crossovers.'],
  passports: ['A passport for every possibility', 'Portfolio cards colored by Role. Larger cards have more baseline standards met.'],
  catalog: ['Reuse before reinvention', 'Shared solutions, standards, and decisions. Useful parts for decent Frankensteins.'],
  own: ['Your little corner of possibility', 'A local-first map. Add a node, find a crossover, and take it anywhere.'],
};
export function viewMatches(item, expression) {
  if (!expression?.trim()) return true;
  // GitHub's exported view filters use field:value, quoted values, comma OR and leading negation.
  const clauses = expression.match(/-?[\w ]+:(?:"[^"]*"|[^\s]+)/g);
  if (!clauses) return true;
  return clauses.every(clause => {
    const match = clause.trim().match(/^(-?)([\w ]+):(.+)$/);
    if (!match) return true;
    const [, negate, name, raw] = match;
    const key = Object.keys(item.fields || {}).find(key => key.toLowerCase() === name.trim().toLowerCase());
    const options = raw.replace(/^"|"$/g, '').split(',').map(value => value.toLowerCase());
    const actual = String(item.fields?.[key] || '').toLowerCase();
    return negate ? !options.includes(actual) : options.includes(actual);
  });
}
export function tabMatches(item, tab) {
  const kind = item.fields?.Kind;
  if (tab === 'roadmap') return kind === 'Milestone';
  if (tab === 'passports') return kind === 'Portfolio' || /^Portfolio:/i.test(item.title);
  if (tab === 'catalog') return ['Shared solution', 'Standard', 'Decision'].includes(kind);
  return true;
}
export function dateNumber(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
  const value = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(value) ? value / 86400000 : null;
}
const normalized = value => value.toLowerCase().replace(/^portfolio:\s*/, '').replace(/_vanilla$/i, '').replace(/[^a-z0-9]/g, '');
export function relationships(items) {
  const aliases = new Map();
  for (const item of items) {
    aliases.set(normalized(item.title), item.id);
    const milestone = item.title.match(/^M\d+\b/);
    if (milestone) aliases.set(normalized(milestone[0]), item.id);
    if (item.repository) aliases.set(normalized(item.repository.split('/').pop()), item.id);
  }
  const result = [], seen = new Set();
  const add = (from, to, kind) => {
    const key = [from, to].sort().join('|') + kind;
    if (from && to && from !== to && !seen.has(key)) { seen.add(key); result.push({ from, to, kind }); }
  };
  for (const item of items) for (const field of ['Dependencies', 'Crossovers']) {
    const text = item.fields?.[field] || '';
    const kind = field === 'Dependencies' ? 'dependency' : 'crossover';
    for (const pair of text.matchAll(/([\w-]+)\s*(?:->|→)\s*([\w-]+)/g)) add(aliases.get(normalized(pair[1])), aliases.get(normalized(pair[2])), kind);
    for (const milestone of text.matchAll(/\bM\d+\b/g)) add(item.id, aliases.get(normalized(milestone[0])), kind);
    for (const target of items) if (target.url && text.includes(target.url)) add(item.id, target.id, kind);
  }
  return result;
}
export function spatialPages(items, tab) {
  if (tab === 'board') return Math.max(1, ...STATUS.map(s => Math.ceil(items.filter(i => (i.fields?.Status || 'Todo') === s).length / 6)));
  if (tab === 'canopy') return Math.max(1, ...[...new Set(items.map(i => i.fields?.Workstream || 'Unassigned'))].map(s => Math.ceil(items.filter(i => (i.fields?.Workstream || 'Unassigned') === s).length / 8)));
  return 1;
}
