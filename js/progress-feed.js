export const REPOSITORIES = ['TheJollyLaMa/DecentAgency', 'TheJollyLaMa/DecentBusking', 'TheJollyLaMa/DecentCanopy', 'TheJollyLaMa/DecentHead',
  'TheJollyLaMa/DecentMarket', 'TheJollyLaMa/BigNuten_Vanilla', 'A-Decent-Agency/DecentJukebox',
  'A-Decent-Agency/DBuskRadio', 'A-Decent-Agency/DVert', 'A-Decent-Agency/a-decent-agency.github.io',
  'TheJollyLaMa/DecentSubscriptions', 'TheJollyLaMa/DecentPilgrimages', 'TheJollyLaMa/DecentEscrow', 'TheJollyLaMa/DecentInvoice',
  'TheJollyLaMa/DecentAirdrop', 'TheJollyLaMa/Decent_NDA', 'TheJollyLaMa/Decent_UCAN_Play'];
export const CONNECTIONS = [
  { from: 'A-Decent-Agency/a-decent-agency.github.io', to: 'TheJollyLaMa/DecentCanopy', label: 'Planning office adapts Canopy provenance and public project-map patterns', url: 'https://github.com/A-Decent-Agency/a-decent-agency.github.io/pull/7' },
  { from: 'TheJollyLaMa/DecentHead', to: 'TheJollyLaMa/DecentMarket', label: 'Pinned shared header and session boundary', url: 'https://github.com/TheJollyLaMa/DecentMarket/pull/68' },
  { from: 'TheJollyLaMa/DecentBusking', to: 'TheJollyLaMa/DecentCanopy', label: 'Public fund evidence adapter', url: 'https://github.com/TheJollyLaMa/DecentCanopy/pull/41' },
  { from: 'TheJollyLaMa/DecentBusking', to: 'A-Decent-Agency/DecentJukebox', label: 'Extracted DJuke product', url: 'https://github.com/TheJollyLaMa/DecentBusking/pull/282' },
  { from: 'TheJollyLaMa/DecentBusking', to: 'A-Decent-Agency/DBuskRadio', label: 'Extracted radio / Canopy host', url: 'https://github.com/TheJollyLaMa/DecentCanopy/pull/43' },
  { from: 'TheJollyLaMa/DecentBusking', to: 'A-Decent-Agency/DVert', label: 'Extracted advertising product', url: 'https://github.com/TheJollyLaMa/DecentBusking/pull/282' },
];
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const github = (value, repository) => typeof value === 'string' && value.startsWith(`https://github.com/${repository}/`)
  && !/[<>"'\s]/.test(value) && !new URL(value).username;
export const SUPPORTER_NFT = '0xe63EC9f8228720bAAC2fD528C0A6d06B3Dc5439B';
export const SUPPORTER_ESCROW = '0x31b07b83e99A9bdF379bf40225b8A80d3804C89d';
export function supporterPriceLabel(priceUSDC) {
  if (!['10000000', '100000000'].includes(priceUSDC)) throw new Error('Unsupported Supporter price');
  return `${BigInt(priceUSDC) / 1000000n} USDC`;
}
export function isVersionStorefront(store, version, repository) {
  if (!store || version.nftContract?.toLowerCase() !== SUPPORTER_NFT.toLowerCase()
    || store.escrow?.toLowerCase() !== SUPPORTER_ESCROW.toLowerCase()
    || !/^(0|[1-9]\d{0,77})$/.test(store.listingId) || BigInt(store.listingId) >= 2n ** 256n
    || !['10000000', '100000000'].includes(store.priceUSDC)) return false;
  const assetRoot = `https://github.com/${repository}/releases/download/${encodeURIComponent(version.tag)}/`;
  if (store.frontUrl !== `${assetRoot}supporter-front.png` || store.backUrl !== `${assetRoot}supporter-back.png`
    || !/^[\da-f]{64}$/.test(store.frontSHA256) || !/^[\da-f]{64}$/.test(store.backSHA256)
    || !['supporter-minted.json', 'supporter-listing-evidence.json'].some(name => store.evidenceUrl === assetRoot + name)) return false;
  const routes = ['DecentHead', 'DecentMarket'].map(name => `https://thejollylama.github.io/${name}/supporter/buy.html`);
  try {
    const url = new URL(store.purchaseUrl);
    return routes.includes(`${url.origin}${url.pathname}`) && !url.username && !url.password && !url.hash
      && [...url.searchParams].length === (store.priceUSDC === '10000000' ? 3 : 4)
      && (store.priceUSDC === '10000000' ? !url.searchParams.has('priceUSDC') : url.searchParams.get('priceUSDC') === store.priceUSDC)
      && url.searchParams.get('chainId') === '8453'
      && url.searchParams.get('escrow')?.toLowerCase() === store.escrow.toLowerCase()
      && url.searchParams.get('listingId') === store.listingId;
  } catch { return false; }
}
export function mintArtworkPath(store, face) {
  return `data/mint-art/${store[`${face}SHA256`]}.png`;
}
export function isDeliveredVersion(version, repository) {
  return typeof version?.tag === 'string' && version.tag.length <= 100 && date(version.publishedAt)
    && github(version.url, repository) && github(version.evidenceUrl, repository)
    && version.chainId === 8453 && /^\d+$/.test(version.tokenId)
    && /^0x[\da-fA-F]{64}$/.test(version.mintTxHash)
    && /^0x[\da-fA-F]{40}$/.test(version.nftContract)
    && Number.isSafeInteger(version.confirmations) && version.confirmations > 0
    && (version.storefront === undefined || isVersionStorefront(version.storefront, version, repository))
    && (version.storefrontError === undefined || typeof version.storefrontError === 'string' && version.storefrontError.length <= 160);
}
// Steward-authored GitHub milestones name the planned skeleton: "Level N: …" stacks a tower level, "Grounds: …" raises a nearby structure.
export const MAX_STRUCTURES = 24;
export function milestoneStructure(milestone, repository) {
  const title = typeof milestone?.title === 'string' ? milestone.title.trim() : '';
  const level = title.match(/^Level\s+(\d{1,2})\s*[:·—–-]\s*(.+)$/i);
  const grounds = title.match(/^Grounds\s*[:·—–-]\s*(.+)$/i);
  if (!level && !grounds || !Number.isSafeInteger(milestone.number) || milestone.number < 1) return null;
  return { number: milestone.number, kind: level ? 'level' : 'grounds', order: level ? Number(level[1]) : milestone.number,
    name: (level ? level[2] : grounds[1]).trim().slice(0, 80), open: milestone.open_issues, closed: milestone.closed_issues,
    state: milestone.state, url: `https://github.com/${repository}/milestone/${milestone.number}` };
}
export function isStructure(value, repository) {
  return ['level', 'grounds'].includes(value?.kind) && Number.isSafeInteger(value.number) && value.number > 0
    && Number.isSafeInteger(value.order) && value.order >= 0 && value.order <= 9999
    && typeof value.name === 'string' && value.name.length > 0 && value.name.length <= 80
    && [value.open, value.closed].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 10000)
    && ['open', 'closed'].includes(value.state) && value.url === `https://github.com/${repository}/milestone/${value.number}`;
}
export function isProgressFeed(value) {
  if (![1, 2].includes(value?.schemaVersion) || !date(value.checkedAt) || !Array.isArray(value.repositories)
    || value.repositories.length !== REPOSITORIES.length || JSON.stringify(value.connections) !== JSON.stringify(CONNECTIONS)) return false;
  const seen = new Set();
  return value.repositories.every(entry => {
    if (!REPOSITORIES.includes(entry.repository) || seen.has(entry.repository)) return false;
    seen.add(entry.repository);
    return (value.schemaVersion === 1 || ((entry.codeBytes === null || Number.isSafeInteger(entry.codeBytes) && entry.codeBytes >= 0)
      && Array.isArray(entry.versions) && entry.versions.length <= 20
      && new Set(entry.versions.map(version => version.tag)).size === entry.versions.length
      && entry.versions.every(version => isDeliveredVersion(version, entry.repository))
      && typeof entry.versionsTruncated === 'boolean'))
      && ['available', 'unavailable'].includes(entry.state) && (entry.checkedAt === null || date(entry.checkedAt))
      && typeof entry.error === 'string' && entry.error.length <= 120
      && (entry.state !== 'available' || (date(entry.checkedAt) && !entry.error))
      && (entry.pushedAt === null || date(entry.pushedAt))
      && (entry.release === null || (typeof entry.release?.tag === 'string' && entry.release.tag.length <= 100
        && date(entry.release.publishedAt) && github(entry.release.url, entry.repository)))
      && (entry.structures === undefined || Array.isArray(entry.structures) && entry.structures.length <= MAX_STRUCTURES
        && new Set(entry.structures.map(structure => structure.number)).size === entry.structures.length
        && entry.structures.every(structure => isStructure(structure, entry.repository)))
      && (entry.issues === null || [entry.issues.open, entry.issues.closed].every(n => Number.isSafeInteger(n) && n >= 0))
      && Array.isArray(entry.mergedPulls) && entry.mergedPulls.length <= 5 && entry.mergedPulls.every(pr =>
        Number.isSafeInteger(pr.number) && pr.number > 0 && typeof pr.title === 'string' && pr.title.length <= 300
        && date(pr.mergedAt) && pr.url === `https://github.com/${entry.repository}/pull/${pr.number}`);
  });
}
