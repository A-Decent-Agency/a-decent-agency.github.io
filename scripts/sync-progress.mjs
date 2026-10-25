import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { REPOSITORIES, CONNECTIONS, isProgressFeed, isDeliveredVersion } from '../js/progress-feed.js';

export function deliveredVersion(receipt, release, repository, evidenceUrl) {
  const mint = receipt?.verification || receipt?.transactions?.mint;
  if (receipt?.version !== release.tag_name || ![repository, repository.split('/')[1]].includes(receipt.repo)
    || !mint || (mint.status && mint.status !== 'success')) return null;
  const value = { tag: release.tag_name, url: release.html_url, publishedAt: release.published_at, evidenceUrl,
    chainId: receipt.chainId, tokenId: receipt.tokenId || mint.tokenId,
    mintTxHash: mint.mintTxHash || mint.hash, nftContract: receipt.nft || mint.nftContract,
    confirmations: Number(mint.confirmations) };
  return value;
}
export async function collectProgress({ fetcher = fetch, token = '', previous = null, now = new Date().toISOString() } = {}) {
  const headers = { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const get = async (path, optional = false, asset = false) => {
    const response = await fetcher(`https://api.github.com/${path}`, { headers: asset ? { ...headers, Accept: 'application/octet-stream' } : headers, signal: AbortSignal.timeout(20000) });
    if (optional && response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
    return response.json();
  };
  const repositories = [];
  for (const repository of REPOSITORIES) {
    const blank = { repository, state: 'unavailable', checkedAt: null, error: '', pushedAt: null, release: null, mergedPulls: [], issues: null,
      codeBytes: null, versions: [], versionsTruncated: false };
    let publicConfirmed = false;
    try {
      const repo = await get(`repos/${repository}`);
      if (repo.private !== false || repo.visibility !== 'public') throw new Error('Repository is not confirmed public');
      publicConfirmed = true;
      const [release, pulls, languages, releases] = await Promise.all([
        get(`repos/${repository}/releases/latest`, true),
        get(`repos/${repository}/pulls?state=closed&sort=updated&direction=desc&per_page=30`),
        get(`repos/${repository}/languages`),
        get(`repos/${repository}/releases?per_page=20`),
      ]);
      const versions = [];
      for (const edition of releases.filter(value => !value.draft && !value.prerelease)) {
        const asset = edition.assets?.find(value => ['supporter-minted.json', 'supporter-mint-evidence.json'].includes(value.name));
        if (!asset) continue;
        if (!Number.isSafeInteger(asset.id) || asset.size > 100000) throw new Error('Mint evidence asset exceeds observation bounds');
        const receipt = await get(`repos/${repository}/releases/assets/${asset.id}`, false, true);
        const version = deliveredVersion(receipt, edition, repository, `https://github.com/${repository}/releases/download/${encodeURIComponent(edition.tag_name)}/${asset.name}`);
        if (!isDeliveredVersion(version, repository)) throw new Error('Mint evidence does not match its repository/version');
        versions.push(version);
      }
      repositories.push({ ...blank, state: 'available', checkedAt: now, pushedAt: repo.pushed_at,
        codeBytes: Object.values(languages).reduce((sum, bytes) => sum + bytes, 0), versions, versionsTruncated: releases.length === 20,
        release: release ? { tag: release.tag_name, url: release.html_url, publishedAt: release.published_at } : null,
        mergedPulls: pulls.filter(pr => pr.merged_at).slice(0, 5).map(pr => ({
          number: pr.number, title: pr.title, url: pr.html_url, mergedAt: pr.merged_at,
        })) });
    } catch (error) {
      // A failed visibility check must not retain previously public content that may now be private.
      const old = publicConfirmed && isProgressFeed(previous) ? previous.repositories.find(entry => entry.repository === repository) : null;
      repositories.push({ ...blank, ...(old || {}), state: 'unavailable',
        error: publicConfirmed ? 'Public GitHub observation failed; prior public observation retained when available.' : 'Public visibility unavailable; repository details withheld.' });
      console.error(`[Public progress] ${repository}: ${error.message}`);
    }
  }
  const result = { schemaVersion: 2, checkedAt: now, repositories, connections: CONNECTIONS };
  if (!isProgressFeed(result)) throw new Error('Collected public progress has an invalid format; publication refused.');
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const destination = new URL('../data/progress.json', import.meta.url);
  let previous = null;
  try { previous = JSON.parse(await readFile(destination, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const result = await collectProgress({ token: process.env.GITHUB_TOKEN, previous });
  await writeFile(destination, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Observed ${result.repositories.filter(entry => entry.state === 'available').length}/${REPOSITORIES.length} public repositories.`);
}
