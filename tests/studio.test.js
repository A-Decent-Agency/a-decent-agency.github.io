import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canvasSize, fitScale, zoomAt, MAX_CANVAS_PIXELS } from '../studio/viewport.js';
import { officeMapToDiagram, editorMessage, readDiagram, MAX_DIAGRAM_BYTES } from '../studio/diagram-format.js';

test('historical viewer bounds the actual output canvas even for enormous displays and high DPR', () => {
  for (const [width, height, dpr] of [[1440, 900, 2], [390, 844, 3], [10000, 10000, 4], [304425, 191475, 1]]) {
    const size = canvasSize(width, height, dpr);
    assert.ok(size.width * size.height <= MAX_CANVAS_PIXELS);
    assert.ok(size.width > 0 && size.height > 0);
  }
  assert.throws(() => canvasSize(0, 800), /Invalid/);
});
test('giant PDF fits without rasterizing its natural page dimensions', () => {
  const scale = fitScale(304425, 191475, 1200, 700);
  assert.ok(304425 * scale <= 1200);
  assert.ok(191475 * scale <= 700);
  assert.throws(() => fitScale(NaN, 10, 10, 10), /Invalid/);
});
test('zoom retains the point under the cursor and enforces useful bounds', () => {
  const before = { x: 10, y: 20, zoom: 2 };
  const after = zoomAt(before, 2, 100, 120);
  assert.equal((100 - after.x) / after.zoom, (100 - before.x) / before.zoom);
  assert.equal((120 - after.y) / after.zoom, (120 - before.y) / before.zoom);
  assert.equal(zoomAt(before, 1000, 0, 0).zoom, 512);
  assert.equal(zoomAt(before, .001, 0, 0).zoom, 1);
});
test('Office node-map adaptation preserves labels, colors, notes, kinds and edges as escaped XML', () => {
  const result = officeMapToDiagram({ schemaVersion: 1, nodes: [
    { id: 'a', title: '<Start & "learn">', notes: 'Body & home', kind: 'Idea', color: '#123456', x: -2, y: 3 },
    { id: 'b', title: 'Build', color: '#abcdef', x: 2, y: -3 },
  ], links: [{ from: 'a', to: 'b' }] });
  assert.match(result, /label="&lt;Start &amp; &quot;learn&quot;&gt;"/);
  assert.match(result, /notes="Body &amp; home"/);
  assert.match(result, /fillColor=#123456/);
  assert.match(result, /source="node-a" target="node-b"/);
  assert.match(result, /x="2080" y="2070"/);
  assert.throws(() => officeMapToDiagram({}), /Expected a map/);
});
test('only the exact editor window and origin may send protocol messages', () => {
  const source = {};
  const event = { source, origin: 'https://office.example', data: '{"event":"save"}' };
  assert.equal(editorMessage(event, source, event.origin).event, 'save');
  assert.equal(editorMessage(event, {}, event.origin), null);
  assert.equal(editorMessage(event, source, 'https://other.example'), null);
  assert.equal(editorMessage({ ...event, data: 'invalid' }, source, event.origin), null);
});
test('editable import rejects entities, unrelated XML, malformed XML and oversized documents', () => {
  assert.throws(() => readDiagram('<!DOCTYPE x>', 'a.xml'), /entities/);
  assert.throws(() => readDiagram('a'.repeat(MAX_DIAGRAM_BYTES + 1), 'a.xml'), /16 MB/);
  const parse = name => () => ({ querySelector: () => null, documentElement: { nodeName: name } });
  assert.throws(() => readDiagram('<svg/>', 'a.xml', parse('svg')), /Open a/);
  assert.equal(readDiagram('<mxfile/>', 'a.drawio', parse('mxfile')), '<mxfile/>');
  assert.throws(() => readDiagram('<bad', 'a.xml', () => ({ querySelector: () => ({}) })), /malformed/);
});
test('editor and viewer are bundled and network restricted, with no automatic cloud save', async () => {
  const engine = await readFile(new URL('../vendor/drawio/index.html', import.meta.url), 'utf8');
  assert.match(engine, /Content-Security-Policy/);
  assert.match(engine, /connect-src 'self'/);
  assert.match(engine, /form-action 'none'/);
  const config = await readFile(new URL('../vendor/drawio/js/PreConfig.js', import.meta.url), 'utf8');
  assert.match(config, /urlParams\['offline'\] = '1'/);
  assert.match(config, /urlParams\['local'\] = '1'/);
  const studio = await readFile(new URL('../studio/studio.js', import.meta.url), 'utf8');
  assert.doesNotMatch(studio, /localStorage|indexedDB|fetch\(/);
  assert.match(studio, /format, spin/);
});
