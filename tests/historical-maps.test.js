import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { HISTORICAL_MAPS } from '../js/historical-maps.js';

test('historical archive keeps full-resolution source images and lightweight scene previews', async () => {
  assert.equal(HISTORICAL_MAPS.length, 4);
  for (const map of HISTORICAL_MAPS) {
    assert.ok(map.aspect > 0);
    await access(new URL(`../${map.image.slice(2)}`, import.meta.url));
    await access(new URL(map.preview, new URL('../js/construction-scene.js', import.meta.url)));
    if (map.localPDF) {
      assert.equal(map.image, './studio/archive.html');
      assert.match(map.caution, /not bundled or uploaded/);
      const preview = await readFile(new URL(map.preview, new URL('../js/construction-scene.js', import.meta.url)));
      assert.equal(preview[0], 0xff);
      assert.equal(preview[1], 0xd8);
      assert.ok(preview.length < 1_000_000);
    } else {
      const image = await readFile(new URL(`../${map.image.slice(2)}`, import.meta.url));
      assert.equal(image.toString('ascii', 1, 4), 'PNG');
      assert.ok(image.readUInt32BE(16) <= 16000);
      assert.ok(image.readUInt32BE(20) <= 16000);
    }
    assert.ok(map.summary.length > 100);
    assert.ok(map.caution.includes('archival') || map.caution.includes('sketch'));
    assert.ok(map.themes.length > 0);
    assert.ok(map.openQuestions.length > 0);
    for (const path of map.paths) assert.match(path.url, /^https:\/\/github\.com\//);
  }
});

test('early blueprint signposts exact open issues without turning its proposals into commitments', () => {
  const early = HISTORICAL_MAPS.find(map => map.id === 'decent-agency-early-plan');
  assert.ok(early.paths.some(path => path.url.endsWith('/issues/11')));
  assert.ok(early.paths.some(path => path.url.endsWith('/issues/337')));
  assert.match(early.caution, /not a current product specification/);
  assert.ok(early.openQuestions.some(question => question.includes('WasteMan')));
});
