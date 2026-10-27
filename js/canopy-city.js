import { LANDMARKS } from './project-campus.js';

// A top-down canopy of one steward's agency-map registry ({ projects, connections }), rooted at the hosting repository.
// Branches follow curated connections breadth-first; each disconnected cluster branches from the root. Like DecentCanopy
// scripts/spiral.js hubs and placeBranch, children fan outward from their parent, here inside leaf-weighted wedges.
// Another steward's registry in the same shape yields their own close-up city; nothing here fetches third-party data.
export const CITY_RADIUS = 46, CITY_LIFT = 14;
const RING_RADII = [0, 22, 32, 40, 46];

export function canopyCity(registry, feed, { root, radius = CITY_RADIUS } = {}) {
  const seen = new Map();
  for (const project of registry?.projects || []) {
    const key = project.repository?.toLowerCase();
    if (key && !seen.has(key)) seen.set(key, { repository: project.repository, name: project.name || project.repository.split('/')[1] });
  }
  const rootKey = (root || registry?.projects?.[0]?.repository || '').toLowerCase();
  if (!seen.has(rootKey)) return { nodes: [], edges: [], links: [] };
  const neighbors = new Map([...seen.keys()].map(key => [key, new Set()]));
  const links = [];
  for (const link of registry.connections || []) {
    const from = link.from?.toLowerCase(), to = link.to?.toLowerCase();
    if (!neighbors.has(from) || !neighbors.has(to) || from === to) continue;
    neighbors.get(from).add(to); neighbors.get(to).add(from);
    if (!links.some(value => value.from === from && value.to === to || value.from === to && value.to === from)) links.push({ from, to, state: link.state });
  }
  const byName = (a, b) => seen.get(a).name.localeCompare(seen.get(b).name);
  const parent = new Map([[rootKey, null]]), children = new Map([...seen.keys()].map(key => [key, []]));
  const grow = start => {
    for (let queue = [start]; queue.length;) {
      const key = queue.shift();
      for (const next of [...neighbors.get(key)].sort(byName)) if (!parent.has(next)) { parent.set(next, key); children.get(key).push(next); queue.push(next); }
    }
  };
  grow(rootKey);
  // Each disconnected cluster hangs from the hub as its own branch, best-connected project first.
  const degree = key => neighbors.get(key).size;
  for (const key of [...seen.keys()].sort((a, b) => degree(b) - degree(a) || byName(a, b))) {
    if (!parent.has(key)) { parent.set(key, rootKey); children.get(rootKey).push(key); grow(key); }
  }
  const leaves = key => children.get(key).length ? children.get(key).reduce((sum, child) => sum + leaves(child), 0) : 1;
  const place = new Map();
  // Recursive wedges: every branch receives angular room in proportion to its leaves, so siblings never crowd.
  const branch = (key, from, to, depth) => {
    const angle = (from + to) / 2, r = RING_RADII[Math.min(depth, RING_RADII.length - 1)] + Math.max(0, depth - RING_RADII.length + 1) * 6;
    place.set(key, { x: depth ? Math.cos(angle) * r : 0, z: depth ? Math.sin(angle) * r : 0, depth });
    let start = from;
    for (const child of children.get(key)) {
      const share = (to - from) * leaves(child) / leaves(key);
      branch(child, start, start + share, depth + 1); start += share;
    }
  };
  branch(rootKey, -Math.PI / 2 - Math.PI, -Math.PI / 2 + Math.PI, 0);
  const extent = Math.max(1, ...[...place.values()].map(point => Math.hypot(point.x, point.z)));
  const scale = radius / extent;
  const nodes = [...seen.entries()].map(([key, project]) => {
    const point = place.get(key), observation = feed?.repositories?.find(entry => entry.repository.toLowerCase() === key);
    const planned = (observation?.structures || []).filter(structure => structure.open + structure.closed > 0);
    const finished = planned.filter(structure => structure.open === 0).length;
    const landmark = LANDMARKS.find(value => value.repository.toLowerCase() === key);
    return { key, repository: project.repository, name: project.name, x: point.x * scale, z: point.z * scale, depth: point.depth,
      root: key === rootKey, observed: Boolean(observation), planned: planned.length, finished,
      height: 2 + Math.min(10, planned.length * 1.5) + (key === rootKey ? 3 : 0), color: landmark?.color || '#8ba3bd' };
  });
  const edges = nodes.filter(node => parent.get(node.key)).map(node => ({ from: parent.get(node.key), to: node.key }));
  return { nodes, edges, links };
}
