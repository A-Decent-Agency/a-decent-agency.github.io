export const REPOSITORIES = ['TheJollyLaMa/DecentAgency', 'TheJollyLaMa/DecentBusking', 'TheJollyLaMa/DecentCanopy', 'TheJollyLaMa/DecentHead',
  'TheJollyLaMa/DecentMarket', 'TheJollyLaMa/BigNuten_Vanilla', 'A-Decent-Agency/DecentJukebox',
  'A-Decent-Agency/DBuskRadio', 'A-Decent-Agency/DVert', 'A-Decent-Agency/a-decent-agency.github.io'];
export const CONNECTIONS = [
  { from: 'TheJollyLaMa/DecentHead', to: 'TheJollyLaMa/DecentMarket', label: 'Pinned shared header and session boundary', url: 'https://github.com/TheJollyLaMa/DecentMarket/pull/68' },
  { from: 'TheJollyLaMa/DecentBusking', to: 'TheJollyLaMa/DecentCanopy', label: 'Public fund evidence adapter', url: 'https://github.com/TheJollyLaMa/DecentCanopy/pull/41' },
  { from: 'TheJollyLaMa/DecentBusking', to: 'A-Decent-Agency/DecentJukebox', label: 'Extracted DJuke product', url: 'https://github.com/TheJollyLaMa/DecentBusking/pull/282' },
  { from: 'TheJollyLaMa/DecentBusking', to: 'A-Decent-Agency/DBuskRadio', label: 'Extracted radio / Canopy host', url: 'https://github.com/TheJollyLaMa/DecentCanopy/pull/43' },
  { from: 'TheJollyLaMa/DecentBusking', to: 'A-Decent-Agency/DVert', label: 'Extracted advertising product', url: 'https://github.com/TheJollyLaMa/DecentBusking/pull/282' },
];
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const github = (value, repository) => typeof value === 'string' && value.startsWith(`https://github.com/${repository}/`)
  && !/[<>"'\s]/.test(value) && !new URL(value).username;
export function isProgressFeed(value) {
  if (value?.schemaVersion !== 1 || !date(value.checkedAt) || !Array.isArray(value.repositories)
    || value.repositories.length !== REPOSITORIES.length || JSON.stringify(value.connections) !== JSON.stringify(CONNECTIONS)) return false;
  const seen = new Set();
  return value.repositories.every(entry => {
    if (!REPOSITORIES.includes(entry.repository) || seen.has(entry.repository)) return false;
    seen.add(entry.repository);
    return ['available', 'unavailable'].includes(entry.state) && (entry.checkedAt === null || date(entry.checkedAt))
      && typeof entry.error === 'string' && entry.error.length <= 120
      && (entry.state !== 'available' || (date(entry.checkedAt) && !entry.error))
      && (entry.pushedAt === null || date(entry.pushedAt))
      && (entry.release === null || (typeof entry.release?.tag === 'string' && entry.release.tag.length <= 100
        && date(entry.release.publishedAt) && github(entry.release.url, entry.repository)))
      && (entry.issues === null || [entry.issues.open, entry.issues.closed].every(n => Number.isSafeInteger(n) && n >= 0))
      && Array.isArray(entry.mergedPulls) && entry.mergedPulls.length <= 5 && entry.mergedPulls.every(pr =>
        Number.isSafeInteger(pr.number) && pr.number > 0 && typeof pr.title === 'string' && pr.title.length <= 300
        && date(pr.mergedAt) && pr.url === `https://github.com/${entry.repository}/pull/${pr.number}`);
  });
}
