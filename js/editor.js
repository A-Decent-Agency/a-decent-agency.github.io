export const STORAGE_KEY = 'decent-office-map-v1';
export const MAX_FILE_BYTES = 16_000_000;
const colorPattern = /^#[a-f\d]{6}$/i;
export function validateMap(value) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.nodes) || !Array.isArray(value.links)) throw new Error('Expected a map with schemaVersion 1, nodes and links.');
  if (value.nodes.length > 500 || value.links.length > 2000) throw new Error('Maps are limited to 500 nodes and 2,000 links.');
  const ids = new Set();
  const nodes = value.nodes.map(node => {
    if (!node || typeof node.id !== 'string' || !node.id || node.id.length > 200 || ids.has(node.id)) throw new Error('Each node needs a unique ID.');
    if (typeof node.title !== 'string' || !node.title.trim()) throw new Error('Every node needs a title.');
    ids.add(node.id);
    return { id: node.id, title: node.title.slice(0, 160), kind: String(node.kind || 'Idea').slice(0, 60), color: colorPattern.test(node.color) ? node.color : '#aa8bea', notes: String(node.notes || '').slice(0, 4000),
      x: Number.isFinite(node.x) ? Math.max(-200, Math.min(200, node.x)) : 0,
      y: Number.isFinite(node.y) ? Math.max(-200, Math.min(200, node.y)) : 0, z: 0 };
  });
  const links = value.links.map(link => {
    if (!link || !ids.has(link.from) || !ids.has(link.to) || link.from === link.to) throw new Error('Links must join two different existing nodes.');
    return { from: link.from, to: link.to };
  });
  return { schemaVersion: 1, nodes, links };
}
export function starterMap() {
  return { schemaVersion: 1, nodes: [
    { id: 'seed', title: 'A little possibility', kind: 'Idea', color: '#aa8bea', notes: 'Start here. Click to edit, or drag this node to a new place.', x: -19, y: 10, z: 0 },
    { id: 'crossover', title: 'An unlikely connection', kind: 'Crossover', color: '#71e6d0', notes: 'Useful parts become something better together. Link your nodes to find the shape of it.', x: 18, y: 0, z: 0 },
    { id: 'build', title: 'Make something decent', kind: 'Milestone', color: '#e5c583', notes: 'No account. No data landlord. Just a beginning.', x: -8, y: -14, z: 0 },
  ], links: [{ from: 'seed', to: 'crossover' }, { from: 'crossover', to: 'build' }] };
}
export function loadMap(storage = localStorage) {
  const stored = storage.getItem(STORAGE_KEY);
  return stored ? validateMap(JSON.parse(stored)) : starterMap();
}
export function saveMap(map, storage = localStorage) { storage.setItem(STORAGE_KEY, JSON.stringify(validateMap(map))); }
export function projectToMap(project) {
  const count = Math.min(project.items.length, 500);
  const columns = Math.min(count || 1, Math.max(8, Math.ceil(count / 32)));
  const rows = Math.ceil(count / columns);
  return validateMap({ schemaVersion: 1, nodes: project.items.slice(0, 500).map((item, index) => ({ id: item.id, title: item.title, kind: item.fields.Kind || 'Item', color: '#aa8bea', notes: [item.body || '', ...Object.entries(item.fields).filter(([,v]) => String(v)).map(([k,v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)].join('\n\n').slice(0, 4000), x: (index % columns - (columns - 1) / 2) * 24, y: ((rows - 1) / 2 - Math.floor(index / columns)) * 12, z: 0 })), links: [] });
}
export function downloadMap(map) {
  const blob = new Blob([JSON.stringify(validateMap(map), null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = 'my-decent-map.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function readMapResponse(response) {
  if (!response.ok) throw new Error(`Map request failed (HTTP ${response.status}).`);
  if (Number(response.headers.get('content-length')) > MAX_FILE_BYTES) throw new Error('Map file is too large (16 MB limit).');
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_FILE_BYTES) throw new Error('Map file is too large (16 MB limit).');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return validateMap(JSON.parse(new TextDecoder().decode(bytes)));
}
