import test from 'node:test';
import assert from 'node:assert/strict';
import { issueSkeleton, culDeSacLayout, angleOffsets, MAIN_TOWER_STORIES, SATELLITE_STORIES, LOTS_PER_CULDESAC } from '../js/project-campus.js';
import { canopyCity, CITY_RADIUS } from '../js/canopy-city.js';
import { CANOPY } from '../js/canopy-registry.js';

const level = (order, open = 1, closed = 0) => ({ kind: 'level', order, number: order, name: `L${order}`, open, closed });
const grounds = (order, open = 1) => ({ kind: 'grounds', order, number: 100 + order, name: `G${order}`, open, closed: 0 });

test('angleOffsets mirrors Canopy spiral spreading', () => {
  assert.deepEqual(angleOffsets(1, 2), [0]);
  assert.deepEqual(angleOffsets(3, 2), [-1, 0, 1]);
});

test('a main tower fits up to its story capacity without sprawl', () => {
  const skeleton = issueSkeleton(Array.from({ length: 6 }, (_, index) => level(index + 1)), { width: 30 });
  assert.equal(skeleton.levels.length, 6);
  assert.ok(skeleton.levels.every(value => value.tower === 0));
  assert.deepEqual(skeleton.towers, []);
  assert.deepEqual(skeleton.roads, []);
  assert.equal(skeleton.top, 6 * 9);
});

test('levels beyond the main tower sprawl into six-story satellites on branching cul-de-sacs', () => {
  const structures = Array.from({ length: 24 }, (_, index) => level(index + 1, index % 2, 1));
  const skeleton = issueSkeleton(structures, { width: 30, baseFloors: 9, baseTop: 81, side: 1 });
  const main = skeleton.levels.filter(value => !value.tower);
  assert.equal(main.length, MAIN_TOWER_STORIES - 9);
  assert.equal(skeleton.levels.length, 24, 'every planned level is still rendered and listed');
  assert.deepEqual(skeleton.towers.map(tower => tower.levels.length), [6, 6, 6, 3]);
  assert.deepEqual(skeleton.towers.map(tower => tower.name), ['L4–L9', 'L10–L15', 'L16–L21', 'L22–L24']);
  assert.equal(skeleton.culdesacs.length, 2, 'four satellites need a second, branched cul-de-sac');
  assert.equal(skeleton.culdesacs[1].depth, 1);
  assert.equal(skeleton.roads.length, 3, 'connector plus one road per cul-de-sac');
  assert.ok(skeleton.towers.every(tower => tower.x > 30 / 2 && tower.z < -26), 'sprawl stays outward and behind');
  assert.equal(skeleton.top, 81 + main.length * 9, 'main tower height ignores satellites');
});

test('cul-de-sac lots never overlap and side flips the sprawl', () => {
  for (const count of [1, 3, 4, 7, 12, 20]) {
    const { lots, culdesacs } = culDeSacLayout(count, { side: -1, width: 34 });
    assert.equal(lots.length, count);
    assert.equal(culdesacs.length, Math.ceil(count / LOTS_PER_CULDESAC));
    assert.ok(lots.every(lot => lot.z < -40), 'behind the grounds slots');
    if (count <= 12) assert.ok(lots.every(lot => lot.x < 0), 'outward on the left');
    for (let a = 0; a < lots.length; a++) for (let b = a + 1; b < lots.length; b++) {
      assert.ok(Math.hypot(lots[a].x - lots[b].x, lots[a].z - lots[b].z) > 20, `lots ${a},${b} of ${count} overlap`);
    }
  }
  assert.deepEqual(culDeSacLayout(0), { culdesacs: [], roads: [], lots: [] });
});

test('grounds beyond the six nearby slots move onto cul-de-sac lots after satellite towers', () => {
  const skeleton = issueSkeleton([...Array.from({ length: 8 }, (_, index) => grounds(index + 1)), ...Array.from({ length: 13 }, (_, index) => level(index + 1))],
    { width: 30, side: -1 });
  assert.equal(skeleton.towers.length, 1);
  assert.equal(skeleton.grounds.length, 8);
  assert.deepEqual(skeleton.grounds.slice(6).map(value => value.culdesac), [0, 0]);
  assert.ok(skeleton.grounds.slice(0, 6).every(value => value.culdesac === undefined));
  assert.equal(SATELLITE_STORIES, 6);
});

test('the Canopy city places every unique registry project as a fractal rooted at DecentCanopy', () => {
  const feed = { repositories: [{ repository: 'TheJollyLaMa/BigNuten_Vanilla', structures: [level(1, 0, 3), level(2, 2, 0), grounds(1, 0)] }] };
  const city = canopyCity(CANOPY, feed, { root: 'TheJollyLaMa/DecentCanopy' });
  const unique = new Set(CANOPY.projects.map(project => project.repository.toLowerCase()));
  assert.equal(city.nodes.length, unique.size);
  assert.equal(city.edges.length, unique.size - 1, 'a spanning tree');
  const root = city.nodes.find(node => node.root);
  assert.equal(root.repository, 'TheJollyLaMa/DecentCanopy');
  assert.deepEqual([root.x, root.z], [0, 0]);
  assert.ok(city.nodes.every(node => Math.hypot(node.x, node.z) <= CITY_RADIUS + 1e-9));
  const bigNuten = city.nodes.find(node => node.repository === 'TheJollyLaMa/BigNuten_Vanilla');
  assert.deepEqual([bigNuten.observed, bigNuten.planned, bigNuten.finished, bigNuten.depth], [true, 2, 1, 1]);
  const busking = city.nodes.find(node => node.name === 'DecentBusking');
  assert.ok(city.edges.some(edge => edge.from === busking.key && edge.to === 'a-decent-agency/decentjukebox'), 'connections become branches');
  assert.ok(city.links.length > 0);
  for (let a = 0; a < city.nodes.length; a++) for (let b = a + 1; b < city.nodes.length; b++) {
    assert.ok(Math.hypot(city.nodes[a].x - city.nodes[b].x, city.nodes[a].z - city.nodes[b].z) > 6, `${city.nodes[a].name} / ${city.nodes[b].name} collide`);
  }
});

test('any steward registry in the same shape yields its own city; missing roots render nothing', () => {
  const registry = { projects: [{ repository: 'a/hub' }, { repository: 'a/one' }, { repository: 'a/two' }],
    connections: [{ from: 'a/one', to: 'a/two' }, { from: 'a/one', to: 'x/outside' }] };
  const city = canopyCity(registry, null);
  assert.equal(city.nodes.find(node => node.root).repository, 'a/hub');
  assert.deepEqual(city.edges.map(edge => `${edge.from}>${edge.to}`).sort(), ['a/hub>a/one', 'a/one>a/two'], 'a disconnected cluster hangs from the hub as one branch');
  assert.deepEqual(canopyCity(registry, null, { root: 'nobody/here' }), { nodes: [], edges: [], links: [] });
});
