import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { constructionSites } from '../js/construction-model.js';
import { campusStructure } from '../js/project-campus.js';
import { featuredEdition, renderSupportCallout, renderVersionMints } from '../js/version-mints.js';
import { renderCampusDetails } from '../js/campus-details.js';
import { itemIdentity } from '../js/site-identities.js';
import { isProgressFeed } from '../js/progress-feed.js';

const feed = JSON.parse(readFileSync(new URL('../data/progress.json', import.meta.url)));
const repository = 'TheJollyLaMa/DecentVoyager';
const site = constructionSites([], { includeContext: true }).find(site => site.project?.repository === repository);

test('Legacy Asteroid board evidence joins Voyager without a duplicate campus or rewritten source', () => {
  const snapshot = JSON.parse(readFileSync(new URL('../data/project.json', import.meta.url)));
  const original = JSON.stringify(snapshot);
  const sites = constructionSites(snapshot.items, { includeContext: true });
  assert.equal(sites.filter(site => /asteroid|voyager/i.test(site.project?.repository || '')).length, 1);
  const voyager = sites.find(site => site.project?.repository === repository);
  assert.ok(voyager.items.length > 0);
  assert.ok(voyager.aliases.includes('project:thejollylama/asteroid'));
  assert.equal(JSON.stringify(snapshot), original);
});

test('Voyager has one launch tower and one receipt-backed floor, not twenty delivered release floors', () => {
  assert.ok(isProgressFeed(feed));
  assert.ok(site);
  assert.equal(site.title, 'Decent Voyager');
  const model = campusStructure(site, feed);
  assert.equal(model.form, 'tower');
  assert.equal(model.deliveredFloors, 1);
  assert.equal(model.versions[0].tag, 'v1.0.0');
  assert.equal(model.versions[0].tokenId, '80');
  assert.match(model.basis, /art direction|proposed/);
  const identity = itemIdentity({ repository, fields: { Kind: 'Task' } });
  assert.match(identity.artwork.url, /\/[a-f0-9]{40}\/src\/assets\/brand\/voyager-disc.png$/);
});

test('Voyager front/back images and sidepanel buy actions use verified token 80 replacement listing 18', () => {
  const version = featuredEdition(site, feed);
  assert.equal(version.tokenId, '80');
  assert.equal(version.storefront.listingId, '18');
  for (const face of ['front', 'back']) {
    const checksum = version.storefront[`${face}SHA256`];
    const bytes = readFileSync(new URL(`../data/mint-art/${checksum}.png`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), checksum);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  }
  const card = renderSupportCallout(site, feed);
  assert.match(card, /10 USDC on Base/);
  assert.match(card, /listingId=18/);
  assert.match(card, /token 80/);
  const gallery = renderVersionMints(site, feed);
  assert.equal((gallery.match(/data-mint-art/g) || []).length, 2);
  const panel = renderCampusDetails(site, feed);
  assert.match(panel, /Voyager launch tower/);
  assert.match(panel, /widget remains planned/);
  assert.match(panel, /710 Supporter NFTs|funded|winning-flight claim/);
});

test('Voyager missing release evidence leaves support unavailable, never inventing a buy action', () => {
  const unavailable = structuredClone(feed);
  unavailable.repositories.find(entry => entry.repository === repository).versions = [];
  assert.equal(featuredEdition(site, unavailable), null);
  assert.equal(renderSupportCallout(site, unavailable), '');
  assert.match(renderVersionMints(site, unavailable), /No receipt-backed version mint/);
});
