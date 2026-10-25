import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { isProgressFeed } from '../js/progress-feed.js';

export async function cacheMintArt(feed, destination, fetcher = fetch) {
  if (!isProgressFeed(feed)) throw new Error('Invalid public progress; artwork publication refused');
  await mkdir(destination, { recursive: true });
  const seen = new Set();
  for (const repo of feed.repositories) for (const version of repo.versions || []) {
    const store = version.storefront;
    if (!store) continue;
    for (const face of ['front', 'back']) {
      const checksum = store[`${face}SHA256`];
      if (seen.has(checksum)) continue;
      seen.add(checksum);
      const response = await fetcher(store[`${face}Url`], { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`Mint artwork HTTP ${response.status}: ${repo.repository} ${version.tag} ${face}`);
      if (Number(response.headers.get('content-length')) > 5000000) throw new Error('Mint artwork exceeds 5 MB');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 5000000 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
        || createHash('sha256').update(bytes).digest('hex') !== checksum) throw new Error(`Mint artwork PNG/checksum mismatch: ${repo.repository} ${version.tag} ${face}`);
      await writeFile(new URL(`${checksum}.png`, destination), bytes);
    }
  }
  return seen.size;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = new URL('../', import.meta.url);
  const feed = JSON.parse(await readFile(new URL('data/progress.json', root), 'utf8'));
  const output = process.argv[2] ? pathToFileURL(`${process.argv[2].replace(/\/$/, '')}/`) : new URL('data/mint-art/', root);
  console.log(`Cached ${await cacheMintArt(feed, output)} checksum-verified edition faces.`);
}
