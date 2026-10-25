import test from 'node:test';
import assert from 'node:assert/strict';
import { collectProgress, deliveredVersion } from '../scripts/sync-progress.mjs';
import { isProgressFeed, REPOSITORIES } from '../js/progress-feed.js';
const now = '2026-10-25T15:00:00Z';
function fake({ privateRepo = false, fail = false } = {}) {
  return async url => {
    if (url.endsWith('/languages')) return { status: 200, ok: true, json: async () => ({ JavaScript: 10000 }) };
    if (url.endsWith('/releases?per_page=20')) return { status: 200, ok: true, json: async () => [] };
    if (url.includes('/releases/')) return { status: 404, ok: false };
    if (url.includes('/pulls?')) return { status: fail ? 503 : 200, ok: !fail, json: async () => [] };
    return { status: 200, ok: true, json: async () => ({ private: privateRepo, visibility: privateRepo ? 'private' : 'public', pushed_at: now }) };
  };
}
test('public observations are bounded and schema rejects foreign URLs and duplicate repositories', async () => {
  const feed = await collectProgress({ fetcher: fake(), now });
  assert.ok(isProgressFeed(feed));
  assert.equal(feed.repositories.length, REPOSITORIES.length);
  const bad = structuredClone(feed); bad.repositories[0] = bad.repositories[1]; assert.equal(isProgressFeed(bad), false);
  const wrong = structuredClone(feed); wrong.repositories[0].release = { tag: 'v1', publishedAt: now, url: 'https://evil.test/release' };
  assert.equal(isProgressFeed(wrong), false);
});
test('version floors require exact matching published mint evidence, not release prose or prepared assets', () => {
  const release = { tag_name: 'v1', html_url: 'https://github.com/a/b/releases/tag/v1', published_at: now };
  const receipt = { repo: 'a/b', version: 'v1', chainId: 8453, verification: { tokenId: '1', confirmations: 12,
    mintTxHash: `0x${'1'.repeat(64)}`, nftContract: `0x${'2'.repeat(40)}` } };
  assert.equal(deliveredVersion({ ...receipt, version: 'v2' }, release, 'a/b', 'source'), null);
  assert.equal(deliveredVersion({ ...receipt, verification: null }, release, 'a/b', 'source'), null);
  assert.equal(deliveredVersion(receipt, release, 'a/b', 'source').tag, 'v1');
});
test('unconfirmed public visibility fails closed and never retains private repository observations', async () => {
  const previous = await collectProgress({ fetcher: fake(), now });
  previous.repositories[0].release = { tag: 'v1', url: `https://github.com/${REPOSITORIES[0]}/releases/tag/v1`, publishedAt: now };
  const next = await collectProgress({ fetcher: fake({ privateRepo: true }), previous, now });
  assert.ok(next.repositories.every(entry => entry.state === 'unavailable' && entry.checkedAt === null && !entry.release));
});
test('transient observation failure retains only confirmed public history and labels it unavailable', async () => {
  const previous = await collectProgress({ fetcher: fake(), now });
  previous.repositories[0].release = { tag: 'v1', url: `https://github.com/${REPOSITORIES[0]}/releases/tag/v1`, publishedAt: now };
  const next = await collectProgress({ fetcher: fake({ fail: true }), previous, now: '2026-10-25T16:00:00Z' });
  assert.ok(next.repositories.every(entry => entry.state === 'unavailable' && entry.checkedAt === now && entry.error));
  assert.equal(next.repositories[0].release.tag, 'v1');
});
