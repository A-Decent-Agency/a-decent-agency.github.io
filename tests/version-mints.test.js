import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { isProgressFeed, isVersionStorefront, SUPPORTER_ESCROW, SUPPORTER_NFT } from '../js/progress-feed.js';
import { versionStorefront, collectProgress } from '../scripts/sync-progress.mjs';
import { cacheMintArt } from '../scripts/cache-mint-art.mjs';
import { projectMints, renderVersionMints } from '../js/version-mints.js';
import { renderCampusDetails } from '../js/campus-details.js';

const repository = 'TheJollyLaMa/DecentHead', tag = 'v2.0.0';
const root = `https://github.com/${repository}/releases/download/${tag}/`;
const version = { tag, url: `https://github.com/${repository}/releases/tag/${tag}`,
  publishedAt: '2026-10-25T15:00:00Z', evidenceUrl: root + 'supporter-minted.json', chainId: 8453,
  tokenId: '70', mintTxHash: `0x${'1'.repeat(64)}`, nftContract: SUPPORTER_NFT, confirmations: 12 };
const mint = { ...version, purchaseUrl: `https://thejollylama.github.io/DecentHead/supporter/buy.html?chainId=8453&escrow=${SUPPORTER_ESCROW}&listingId=0`,
  listingId: '0', escrow: SUPPORTER_ESCROW, available: '1000' };
const receipt = { repo: repository, version: tag, metadataURI: 'ipfs://example', chainId: 8453, priceUSDC: '10000000', verification: mint };
const release = { assets: ['supporter-front.png', 'supporter-back.png'].map((name, index) => ({ name, digest: `sha256:${String(index + 1).repeat(64)}` })) };
const site = { title: 'DecentHead', project: { repository }, items: [] };
const store = versionStorefront(receipt, null, receipt, release, version, repository);
const feed = { repositories: [{ repository, state: 'available', versions: [{ ...version, storefront: store }] }] };

test('published Head/Market receipt yields a bound Base purchase route and exact release artwork', () => {
  assert.ok(isVersionStorefront(store, version, repository));
  assert.equal(store.frontUrl, root + 'supporter-front.png');
  assert.equal(store.listingId, '0');
  assert.equal(projectMints(site, feed).length, 1);
  assert.equal(projectMints({ project: { repository: 'TheJollyLaMa/DecentBusking' } }, feed).length, 0);
  assert.equal(projectMints({ type: 'milestone' }, feed).length, 0);
});
test('checkout rejects foreign hosts, credentials, extra params, wrong chain/escrow/id/price and foreign artwork', () => {
  for (const bad of [
    { purchaseUrl: store.purchaseUrl.replace('thejollylama.github.io', 'evil.test') },
    { purchaseUrl: store.purchaseUrl.replace('https://', 'https://user@') },
    { purchaseUrl: store.purchaseUrl + '&redirect=evil' }, { purchaseUrl: store.purchaseUrl + '#evil' },
    { purchaseUrl: store.purchaseUrl.replace('chainId=8453', 'chainId=1') },
    { listingId: '1' }, { listingId: String(2n ** 256n) }, { listingId: '00' },
    { escrow: `0x${'1'.repeat(40)}` }, { priceUSDC: '1' }, { frontUrl: 'https://evil.test/art.png' },
    { evidenceUrl: root + 'supporter-release.json' },
  ]) assert.equal(isVersionStorefront({ ...store, ...bad }, version, repository), false, JSON.stringify(bad));
});
test('minted alone or mismatched listing/metadata/art cannot invent a purchase route', () => {
  for (const change of [{ version: 'v3' }, { metadataURI: 'ipfs://other' }, { chainId: 1 }, { priceUSDC: '1' },
    { verification: { ...mint, available: '0' } }, { verification: { ...mint, confirmations: undefined } },
    { verification: { ...mint, tokenId: '71' } }, { verification: { ...mint, mintTxHash: `0x${'2'.repeat(64)}` } }]) {
    assert.throws(() => versionStorefront({ ...receipt, ...change }, null, receipt, release, version, repository));
  }
  assert.throws(() => versionStorefront(receipt, null, receipt, { assets: [] }, version, repository));
});
test('widget listing protocol is bound to the same repo/version/token/mint and canonical checkout', () => {
  const listing = { ...receipt, status: 'listed', available: '99', tokenId: version.tokenId, nft: SUPPORTER_NFT,
    listingId: mint.listingId, escrow: mint.escrow, purchaseUrl: mint.purchaseUrl,
    protocolEvidence: { ...receipt, mint } };
  assert.equal(versionStorefront(receipt, listing, receipt, release, version, repository).evidenceUrl, root + 'supporter-listing-evidence.json');
  for (const patch of [{ status: 'not-listed' }, { listingId: '9' }, { tokenId: '9' }, { repo: 'foreign/repo' },
    { protocolEvidence: { ...listing.protocolEvidence, version: 'v3' } }]) {
    assert.throws(() => versionStorefront(receipt, { ...listing, ...patch }, receipt, release, version, repository));
  }
});
test('sidepanel shows two faces and native safe buy link; retains unavailable/source-only states', () => {
  const html = renderVersionMints(site, feed);
  assert.match(html, /data-mint-art/g);
  assert.equal((html.match(/data-mint-art/g) || []).length, 2);
  assert.match(html, /Buy v2.0.0 · 10 USDC on Base/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /not live stock/);
  const old = structuredClone(feed); old.repositories[0].state = 'unavailable';
  assert.match(renderVersionMints(site, old), /retained observation/);
  delete old.repositories[0].versions[0].storefront;
  assert.doesNotMatch(renderVersionMints(site, old), /class="mint-buy"/);
  assert.match(renderVersionMints(site, old), /checkout link withheld/);
  assert.match(renderVersionMints({ ...site, title: '<img onerror=x>' }, feed), /&lt;img/);
  assert.match(renderVersionMints(site, null), /No receipt-backed version mint/);
});
test('old schema-v2 snapshots remain valid and unsafe storefronts fail publication validation', async () => {
  const data = JSON.parse(await readFile(new URL('../data/progress.json', import.meta.url)));
  assert.ok(isProgressFeed(data));
  const entry = data.repositories.find(value => value.repository === repository);
  entry.versions = [{ ...version, storefront: structuredClone(store) }];
  assert.ok(isProgressFeed(data));
  entry.versions[0].storefront.purchaseUrl = 'https://evil.test/';
  assert.equal(isProgressFeed(data), false);
});
test('legacy checkpoint disclosure preserves statuses without an invented completion score', () => {
  assert.match(renderCampusDetails({ type: 'milestone' }, null), /Legacy planning checkpoint/);
  assert.match(renderCampusDetails({ type: 'milestone' }, null), /Source status and tentative dates are retained/);
});
test('art cache checks public schema, PNG bytes and release digest before persisting same-origin faces', async () => {
  const data = JSON.parse(await readFile(new URL('../data/progress.json', import.meta.url)));
  for (const repo of data.repositories) for (const v of repo.versions) delete v.storefront;
  const png = Buffer.from('89504e470d0a1a0a00010203', 'hex');
  const digest = createHash('sha256').update(png).digest('hex');
  const edition = { ...version, storefront: { ...store, frontSHA256: digest, backSHA256: digest } };
  data.repositories.find(repo => repo.repository === repository).versions = [edition];
  const folder = await mkdtemp(join(tmpdir(), 'office-mint-art-'));
  const destination = pathToFileURL(`${folder}/`);
  const response = bytes => ({ ok: true, headers: new Headers(), arrayBuffer: async () => bytes });
  try {
    let requests = 0;
    assert.equal(await cacheMintArt(data, destination, async () => { requests++; return response(png); }), 1);
    assert.equal(requests, 1, 'Shared checksum is downloaded once');
    assert.deepEqual(await readFile(new URL(`${digest}.png`, destination)), png);
    await assert.rejects(cacheMintArt(data, destination, async () => response(Buffer.from('not art'))), /PNG\/checksum/);
    await assert.rejects(cacheMintArt(data, destination, async () => response(Buffer.concat([png, Buffer.from('changed')]))), /PNG\/checksum/);
    await assert.rejects(cacheMintArt(data, destination, async () => ({ ok: false, status: 503 })), /HTTP 503/);
    await assert.rejects(cacheMintArt({}, destination), /Invalid public progress/);
  } finally { await rm(folder, { recursive: true }); }
});
test('observer attaches verified checkout and retains minted floors with explicit storefront errors on missing listing evidence', async () => {
  const edition = { ...release, tag_name: tag, html_url: version.url, published_at: version.publishedAt,
    assets: [...release.assets, { name: 'supporter-minted.json', id: 123, size: 2000 }] };
  let broken = false;
  const fetcher = async url => {
    const reply = value => ({ ok: true, status: 200, json: async () => value });
    if (url.includes('/releases/assets/')) return reply(broken ? { ...receipt, verification: { ...mint, purchaseUrl: 'https://evil.test' } } : receipt);
    if (url.endsWith('/releases?per_page=20')) return reply(url.includes(repository) ? [edition] : []);
    if (url.endsWith('/releases/latest')) return { ok: false, status: 404 };
    if (url.endsWith('/languages')) return reply({});
    if (url.includes('/pulls?')) return reply([]);
    return reply({ private: false, visibility: 'public', pushed_at: version.publishedAt });
  };
  const observed = await collectProgress({ fetcher });
  assert.ok(observed.repositories.find(repo => repo.repository === repository).versions[0].storefront);
  broken = true;
  const failure = await collectProgress({ fetcher });
  const kept = failure.repositories.find(repo => repo.repository === repository);
  assert.equal(kept.state, 'available');
  assert.equal(kept.versions.length, 1);
  assert.equal(kept.versions[0].storefront, undefined);
  assert.match(kept.versions[0].storefrontError, /checkout link withheld/);
  assert.ok(isProgressFeed(failure));
});
