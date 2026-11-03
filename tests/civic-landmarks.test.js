import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCivicLandmark, civicLandmarkKind } from '../js/civic-landmarks.js';

const identities = [
  ['A-Decent-Agency/a-decent-agency.github.io', 'town-hall'],
  ['TheJollyLaMa/DecentPilgrimages', 'temple'],
  ['A-Decent-Agency/DecentJukebox', 'jukebox-museum'],
  ['TheJollyLaMa/DecentBusking', 'concert'],
  ['TheJollyLaMa/DecentInvoice', 'invoice-office'],
  ['TheJollyLaMa/DecentEscrow', 'escrow-office'],
  ['TheJollyLaMa/Decent_NDA', 'nda-office'],
  ['TheJollyLaMa/DecentMarket', 'market'],
  ['TheJollyLaMa/DecentHead', 'gateway'],
];
const site = repository => ({ project: { repository } });

test('civic identities match exact public repository pairs, case-insensitively', () => {
  for (const [repository, kind] of identities) {
    assert.equal(civicLandmarkKind(site(repository)), kind);
    assert.equal(civicLandmarkKind(site(repository.toUpperCase())), kind);
  }
});

test('titles, URL fragments, other owners, private and entity sites never infer civic identities', () => {
  for (const value of [
    null, {}, { title: 'Town Hall' }, { repository: identities[0][0] },
    site('other/DecentPilgrimages'), site('TheJollyLaMa/DecentJukebox'),
    site('https://github.com/TheJollyLaMa/DecentBusking'),
    site('TheJollyLaMa/DecentBusking/issues/1'), site('TheJollyLaMa/DecentBusking '),
    site('__proto__'), site('constructor'),
    { project: { repository: { name: identities[0][0] } } },
    { project: { repository: identities[0][0], entityId: 'independent' } },
  ]) assert.equal(civicLandmarkKind(value), null);
  for (const flag of ['private', 'isPrivate', 'redacted', 'bodyRedacted']) {
    assert.equal(civicLandmarkKind({ ...site(identities[0][0]), [flag]: true }), null);
    assert.equal(civicLandmarkKind({ project: { repository: identities[0][0], [flag]: true } }), null);
  }
});

test('supplemental frontage is batched, bounded and clear of central evidence at all footprint sizes', () => {
  for (const [repository] of identities) for (const width of [10, 23, 36, 71]) {
    const group = {}, model = { width }, before = JSON.stringify(model), blocks = [], trees = [];
    assert.equal(buildCivicLandmark(group, site(repository), model, {
      block: (owner, x, y, z, w, h, d, color, glass) => {
        assert.equal(owner, group);
        assert.ok([x, y, z, w, h, d].every(Number.isFinite));
        assert.ok(w > 0 && h > 0 && d > 0);
        assert.ok(Math.abs(x) + w / 2 <= width / 2 + 12 + 1e-8);
        assert.ok(z - d / 2 >= 17 && z + d / 2 <= 32);
        blocks.push({ color, glass });
      },
      tree: (owner, x, z, size) => {
        assert.equal(owner, group);
        assert.ok(Math.abs(x) + 2.7 * size <= width / 2 + 12);
        assert.ok(z - 2.7 * size >= 17 && z + 2.7 * size <= 32);
        trees.push({ x, z });
      },
    }), true);
    assert.ok(blocks.length > 10 && blocks.length < 110);
    assert.ok(trees.length <= 4);
    assert.equal(JSON.stringify(model), before);
    assert.deepEqual(group, {});
  }
});

test('unsupported sites add no geometry', () => {
  const unexpected = () => assert.fail('unsupported site emitted geometry');
  assert.equal(buildCivicLandmark({}, site('other/unknown'), {}, { block: unexpected, tree: unexpected }), false);
});

test('civic hall and sanctuary have tall readable porticos and stepped roof silhouettes', () => {
  for (const [repository, expectedTop, roofBase, roofRise] of [
    ['A-Decent-Agency/a-decent-agency.github.io', 24.45, 12.15, 5],
    ['TheJollyLaMa/DecentPilgrimages', 20.4, 13, 6],
  ]) {
    const blocks = [];
    buildCivicLandmark({}, site(repository), { width: 36 }, {
      block: (group, x, y, z, w, h, d, color) => blocks.push({ x, y, z, w, h, d, color }),
      tree: () => {},
    });
    assert.ok(Math.abs(Math.max(...blocks.map(block => block.y + block.h)) - expectedTop) < 1e-8);
    const columns = blocks.filter(block => block.z === 25 && block.w === .8);
    assert.equal(columns.length, 6);
    assert.ok(columns.every(block => block.h >= 8.8));
    const roof = blocks.filter(block =>
      block.y >= roofBase + .8 - 1e-8 && block.y < roofBase + .8 + roofRise - 1e-8 &&
      Math.abs(block.h - roofRise / 7) < 1e-8);
    assert.equal(roof.length, 7);
    assert.ok(roof.every((block, i) => !i || block.w < roof[i - 1].w));
    assert.ok(roof[0].w >= 28);
    if (repository.includes('github.io')) {
      assert.ok(blocks.some(block => block.y > 19 && block.color === '#344555' && block.w === 3));
      assert.ok(blocks.some(block => block.y > 21 && block.h === 1.1 && block.color === '#e0b867'));
    }
  }
});
