import { escapeHTML as esc } from './markdown.js';
import { isDeliveredVersion, isVersionStorefront, mintArtworkPath } from './progress-feed.js';

export function projectMints(site, feed) {
  if (!site?.project) return [];
  const repository = site.project.repository;
  const observation = feed?.repositories?.find(entry => entry.repository.toLowerCase() === repository.toLowerCase());
  return (observation?.versions || []).filter(version => isDeliveredVersion(version, repository)).map(version => ({
    ...version, storefront: isVersionStorefront(version.storefront, version, repository) ? version.storefront : null,
    retained: observation.state !== 'available',
  }));
}

export function renderVersionMints(site, feed) {
  if (!site?.project) return '';
  const versions = projectMints(site, feed);
  const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
  return `<section class="version-mints" aria-label="Project Supporter editions"><h4>Own a piece of this build</h4>
    <p>Collect a version edition to support its builders. Published evidence, not live stock. Checkout rechecks price and availability before you choose to buy. No financial return promised.</p>
    ${versions.map(version => `<article data-version-mint="${esc(version.tag)}"><h4>${esc(site.title)} ${esc(version.tag)}</h4>
      <p>Base · ERC-1155 · token ${esc(version.tokenId)}${version.retained ? ' · retained observation / refresh unavailable' : ''}</p>
      ${version.storefront ? `<div class="mint-faces">${['front', 'back'].map(face => `<figure><img src="${mintArtworkPath(version.storefront, face)}" alt="${esc(site.title)} ${esc(version.tag)} Supporter edition ${face}" loading="lazy" referrerpolicy="no-referrer" data-mint-art><figcaption>${face}</figcaption></figure>`).join('')}</div>
      <a class="mint-buy" href="${esc(version.storefront.purchaseUrl)}" target="_blank" rel="noopener noreferrer">Buy ${esc(version.tag)} · 10 USDC on Base ↗</a>
      <p>${link(version.storefront.evidenceUrl, 'Published listing evidence')}</p>
      <small>Original art: The Jolly LaMa / A Decent Agency · ${link(`https://github.com/${site.project.repository}`, 'Source and license')}</small>`
      : `<p>${esc(version.storefrontError || 'No approved purchase evidence observed; checkout link withheld.')}</p>`}
      <p>${link(version.url, 'Release')} · ${link(version.evidenceUrl, 'Mint receipt')}</p></article>`).join('') || '<p>No receipt-backed version mint observed for this project. No buy link invented.</p>'}
    </section>`;
}
