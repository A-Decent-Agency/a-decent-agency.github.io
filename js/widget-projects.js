import { escapeHTML as esc } from './markdown.js';
import { projectMints } from './version-mints.js';
import { supporterPriceLabel } from './progress-feed.js';

const WIDGETS = [
  ['DecentJukebox', 'DJuke', 'djuke.decentagency.eth', 'v0.2.0', '72', 'a84c90f1e8e52a2bffe6b8d185e9af10725b2971'],
  ['DVert', 'DVert', 'dvert.decentagency.eth', 'v0.2.1', '73', '535a5081c66018be0855a86a4a21b62fb4fb45a3'],
  ['DBuskRadio', 'DBuskRadio', 'dbusk.decentagency.eth', 'v0.2.0', '74', '6b67e0242e9377358c1d7c9196fa2a95163a1746']
];

export function widgetProject(project) {
  if (!project || project.entityId || typeof project.repository !== 'string') return null;
  const row = WIDGETS.find(([repo]) => `a-decent-agency/${repo.toLowerCase()}` === project.repository.toLowerCase());
  if (!row) return null;
  const [repo, name, ens, version, tokenId, revision] = row;
  return { repository: `A-Decent-Agency/${repo}`, name, ens, version, tokenId, revision };
}

export function renderWidgetProject(site, feed) {
  const widget = widgetProject(site?.project);
  if (!widget) return '';
  const source = `https://github.com/${widget.repository}`;
  const release = `${source}/releases/download/${widget.version}`;
  const version = projectMints(site, feed).find(version => version.tag === widget.version && version.tokenId === widget.tokenId);
  return `<section class="campus-widget" aria-label="Clone and support ${esc(widget.name)}"><h4>Clone it / make it yours</h4>
    <p>Independent public repository. Existing ENS identity and Supporter edition; no duplicate project or token is needed.</p>
    <p><a href="${source}/blob/${widget.revision}/docs/CLONE_AND_ADAPT.md" target="_blank" rel="noopener noreferrer">Clone &amp; adaptation guide</a>
    · <a href="${source}" target="_blank" rel="noopener noreferrer">Source repository</a></p>
    <p>Recorded ENS: <a href="https://app.ens.domains/name/${widget.ens}" target="_blank" rel="noopener noreferrer">${widget.ens}</a>
    · Base edition ${widget.version} / token ${widget.tokenId}.</p>
    ${version?.storefront ? `<button type="button" class="mint-buy" data-mint-checkout="${esc(version.storefront.purchaseUrl)}">Support ${esc(widget.name)} / ${supporterPriceLabel(version.storefront.priceUSDC)} on Base</button>` : '<p>Purchase evidence unavailable in the current observation; no checkout action inferred.</p>'}
    <details><summary>Release evidence / identity and support boundaries</summary>
    <p>Published ENS/mint snapshot: October 24, 2026 at 19:50 UTC; listing snapshot: 19:59 UTC. These record existing configuration, not freshly verified current ENS resolution, stock or price. Checkout rechecks live terms before a purchase.</p>
    <p><a href="${release}/supporter-mint-evidence.json" target="_blank" rel="noopener noreferrer">ENS / mint snapshot</a> · <a href="${release}/supporter-listing-evidence.json" target="_blank" rel="noopener noreferrer">Listing snapshot</a></p>
    <p>A clone must replace the original branding, deployment, ENS, payee and support configuration; it must not silently collect support for another project. Preserve the documented lifecycle, consent, licensing and host-specific acceptance tests.</p></details></section>`;
}
