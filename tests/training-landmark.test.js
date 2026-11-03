import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrainingLandmark } from '../js/training-landmark.js';
import { campusStructure } from '../js/project-campus.js';

const repository = 'TheJollyLaMa/BigNuten_Vanilla';
const site = { project: { repository, form: 'staging' }, items: [] };
function emit(candidate = site, model = { width: 30 }) {
  const group = {}, blocks = [], trees = [];
  const built = buildTrainingLandmark(group, candidate, model, {
    block: (owner, x, y, z, w, h, d, color, glass) => {
      assert.equal(owner, group);
      blocks.push({ x, y, z, w, h, d, color, glass });
    },
    tree: (owner, x, z, size) => {
      assert.equal(owner, group);
      trees.push({ x, z, size });
    },
  });
  return { built, blocks, trees };
}

test('only the exact public repository receives a training landmark', () => {
  for (const candidate of [
    null, {}, { title: 'BigNuten' }, { project: { name: 'BigNuten' } },
    { project: { repository: 'private/BigNuten_Vanilla' } },
    { project: { repository: 'TheJollyLaMa/BigNuten' } },
    { project: { repository: repository.toLowerCase() } },
    { project: { repository, entityId: 'independent' } },
    ...['private', 'isPrivate', 'redacted', 'bodyRedacted'].map(key => ({ ...site, [key]: true })),
    ...['private', 'isPrivate', 'redacted'].map(key => ({ project: { repository, [key]: true } })),
  ]) {
    assert.deepEqual(emit(candidate), { built: false, blocks: [], trees: [] });
  }
  assert.equal(emit().built, true);
});

test('actual emitted boxes are finite, positive, low, and clear of tower and promenade at all supported footprints', () => {
  const widths = [18, 30, 49.5, ...[null, 1000, 1000000, Number.MAX_SAFE_INTEGER].map(codeBytes =>
    campusStructure(site, { repositories: [{ repository, codeBytes }] }).width)];
  for (const width of widths) {
    const { built, blocks, trees } = emit(site, { width });
    assert.equal(built, true);
    assert.equal(blocks.length, 101, 'fixed-size instanced-box budget');
    for (const b of blocks) {
      for (const key of ['x', 'y', 'z', 'w', 'h', 'd']) assert.ok(Number.isFinite(b[key]), key);
      assert.ok(b.w > 0 && b.h > 0 && b.d > 0);
      assert.ok(b.y >= 0 && b.y + b.h <= 8);
      assert.ok(Math.abs(b.x) + b.w / 2 <= width / 2 + 12);
      assert.ok(b.z - b.d / 2 > 17.5, 'existing path remains completely clear');
      assert.ok(b.z + b.d / 2 <= 34);
      assert.match(b.color, /^#[0-9a-f]{6}$/);
      assert.equal(typeof b.glass, 'boolean');
    }
    for (const tree of trees) {
      assert.ok(Math.abs(tree.x) + 2.7 * tree.size <= width / 2 + 12);
      assert.ok(tree.z - 2.7 * tree.size > 17.5);
    }
  }
});

test('landmark includes gym glazing, pull-up rig, weights, mats, hydration and three running lanes', () => {
  const { blocks } = emit();
  assert.equal(blocks.filter(b => b.glass).length, 4, "gym glazing, kiosk water, fountain basin");
  assert.equal(blocks.filter(b => b.color === "#b86854" && b.h === 3.4).length, 1, "heavy bag");
  assert.equal(blocks.filter(b => b.y === 2.14 && b.z === 25.2).length, 4, "kettlebell row");
  assert.ok(blocks.some(b => b.y > 6 && b.color === '#bc96df'), 'roof dumbbell');
  assert.ok(blocks.some(b => b.y === 6.35 && b.w === 4.3), 'pull-up crossbar');
  assert.equal(blocks.filter(b => b.color === '#293f50' && b.h === 1.15).length, 4, 'barbell plates');
  assert.equal(blocks.filter(b => b.w === 1.5 && b.d === 3.8).length, 2, 'stretch mats');
  assert.equal(blocks.filter(b => b.y === 2.14 && b.d === 1.2).length, 3, 'lane starts');
  assert.ok(blocks.some(b => b.glass && b.h === 1.5), 'water dispenser');
});

test('unsupported geometry and absent adapters fail without mutating input; optional trees are not required', () => {
  for (const width of [undefined, NaN, Infinity, -1, 0, 17]) {
    assert.equal(emit(site, { width }).built, false);
  }
  assert.equal(buildTrainingLandmark({}, site, { width: 30 }), false);
  const group = Object.freeze({});
  const candidate = Object.freeze({ project: Object.freeze({ repository }) });
  const model = Object.freeze({ width: 30 });
  let count = 0;
  assert.equal(buildTrainingLandmark(group, candidate, model, { block: () => count++ }), true);
  assert.equal(count, 101);
});
