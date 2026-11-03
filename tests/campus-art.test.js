import test from 'node:test';
import assert from 'node:assert/strict';
import { campusArt } from '../js/campus-art.js';
import { buildWidgetLandmark, widgetLandmarkKind } from '../js/widget-landmarks.js';
import { renderCampusDetails } from '../js/campus-details.js';
import { constructionSites } from '../js/construction-model.js';
import { widgetProject, renderWidgetProject } from '../js/widget-projects.js';
import { readFile } from 'node:fs/promises';

test('public artistic identities never infer title-based or independent-entity delivery', () => {
  assert.equal(campusArt({ repository: 'THEJOLLYLAMA/BIGNUTEN_VANILLA' }).name, 'Training & nutrition campus');
  assert.equal(campusArt({ name: 'BigNuten' }), null);
  assert.equal(campusArt({ repository: 'private/gym' }), null);
  assert.equal(campusArt({ repository: 'TheJollyLaMa/DecentEscrow', entityId: 'other' }), null);
  assert.equal(campusArt({ repository: 'A-Decent-Agency/a-decent-agency.github.io' }).name, 'Agency Town Hall');
});

test('existing widgets reuse exact public ENS/mint evidence and validated storefronts, never duplicate tokens', async () => {
  const feed = JSON.parse(await readFile(new URL('../data/progress.json', import.meta.url)));
  for (const [repository, ens, token] of [
    ['DecentJukebox', 'djuke.decentagency.eth', '72'],
    ['DVert', 'dvert.decentagency.eth', '73'],
    ['DBuskRadio', 'dbusk.decentagency.eth', '74']
  ]) {
    const site = constructionSites([{ id: repository, repository: `A-Decent-Agency/${repository}`, fields: { Kind: 'Task' } }])[0];
    assert.equal(widgetProject(site.project).ens, ens);
    assert.equal(widgetProject(site.project).tokenId, token);
    const html = renderWidgetProject(site, feed);
    assert.match(html, /data-mint-checkout=/);
    assert.match(html, /CLONE_AND_ADAPT\.md/);
    assert.match(html, /not freshly verified/);
    assert.match(html, /must replace the original branding/);
    const unavailable = renderWidgetProject(site, null);
    assert.doesNotMatch(unavailable, /data-mint-checkout=/);
    assert.match(unavailable, /Purchase evidence unavailable/);
  }
  assert.equal(widgetProject({ repository: 'private/DVert' }), null);
  assert.equal(widgetProject({ repository: 'A-Decent-Agency/DVert', entityId: 'other' }), null);
});

test('both widget studios emit bounded finite instanced-box plans without inventing releases', () => {
  for (const [repository, kind] of [['A-Decent-Agency/DBuskRadio', 'radio'], ['A-Decent-Agency/DVert', 'advertising']]) {
    assert.equal(widgetLandmarkKind({ repository }), kind);
    for (const width of [25.5, 49.5]) {
      const blocks = [];
      assert.equal(buildWidgetLandmark({}, { project: { repository } }, { width }, {
        block: (group, x, y, z, w, h, d, color) => blocks.push({ x, y, z, w, h, d, color })
      }), true);
      assert.ok(blocks.length > 20 && blocks.length < 65);
      for (const block of blocks) {
        assert.ok([block.x, block.y, block.z, block.w, block.h, block.d].every(Number.isFinite));
        assert.ok(block.w > 0 && block.h > 0 && block.d > 0);
        assert.ok(Math.abs(block.x) + block.w / 2 <= width / 2 + 12);
        assert.ok(block.z - block.d / 2 >= 15 && block.z + block.d / 2 <= 34);
      }
    }
  }
  assert.equal(widgetLandmarkKind({ repository: 'private/DBuskRadio' }), null);
  assert.equal(widgetLandmarkKind({ repository: 'A-Decent-Agency/DVert', entityId: 'unrelated' }), null);
});

test('visual art labels cannot create receipt-backed floors or supporter routes', () => {
  const site = constructionSites([{ id: 'radio', title: 'Radio', repository: 'A-Decent-Agency/DBuskRadio', fields: { Kind: 'Task' } }])[0];
  const html = renderCampusDetails(site, null);
  assert.match(html, /Radio listening station/);
  assert.match(html, /Art direction only/);
  assert.match(html, /No receipt-backed version mint/);
  assert.doesNotMatch(html, /data-mint-checkout=/);
});
