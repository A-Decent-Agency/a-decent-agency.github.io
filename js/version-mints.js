import { escapeHTML as esc } from './markdown.js';
import { isDeliveredVersion, isVersionStorefront, mintArtworkPath, supporterPriceLabel } from './progress-feed.js';

export function projectMints(site, feed) {
  if (!site?.project || site.project.entityId) return [];
  const repository = site.project.repository;
  const observation = feed?.repositories?.find(entry => entry.repository.toLowerCase() === repository.toLowerCase());
  return (observation?.versions || []).filter(version => isDeliveredVersion(version, repository)).map(version => ({
    ...version, storefront: isVersionStorefront(version.storefront, version, repository) ? version.storefront : null,
    retained: observation.state !== 'available',
  }));
}

// The newest approved storefront edition becomes the campus billboard and the panel's support card.
export function featuredEdition(site, feed) {
  return projectMints(site, feed).filter(version => version.storefront)
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))[0] || null;
}

export function renderSupportCallout(site, feed) {
  const version = featuredEdition(site, feed);
  if (!version) return '';
  const store = version.storefront;
  return `<section class="support-callout" aria-label="Support ${esc(site.title)}"><span class="eyebrow">SUPPORTER DNFT / ${esc(version.tag)}</span>
    <img src="${mintArtworkPath(store, 'front')}" alt="${esc(site.title)} ${esc(version.tag)} Supporter edition front" loading="lazy" referrerpolicy="no-referrer" data-mint-art>
    <button type="button" class="mint-buy" data-mint-checkout="${esc(store.purchaseUrl)}">Support ${esc(site.title)} · ${supporterPriceLabel(store.priceUSDC)} on Base</button>
    <small>Base token ${esc(version.tokenId)} · listing ${esc(store.listingId)} · published evidence; checkout rechecks live price and stock. Supports the builders; not equity, yield or a product claim.</small></section>`;
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
      <button type="button" class="mint-buy" data-mint-checkout="${esc(version.storefront.purchaseUrl)}">View / buy ${esc(version.tag)} · ${supporterPriceLabel(version.storefront.priceUSDC)} on Base</button>
      <p>${link(version.storefront.evidenceUrl, 'Published listing evidence')}</p>
      <small>Original art: The Jolly LaMa / A Decent Agency · ${link(`https://github.com/${site.project.repository}`, 'Source and license')}</small>`
      : `<p>${esc(version.storefrontError || 'No approved purchase evidence observed; checkout link withheld.')}</p>`}
      <p>${link(version.url, 'Release')} · ${link(version.evidenceUrl, 'Mint receipt')}</p></article>`).join('') || '<p>No receipt-backed version mint observed for this project. No buy link invented.</p>'}
    </section>`;
}
