// Curated public identities, not a name/keyword classifier. Revisions pin artwork provenance.
const entries = [
  ['canopy', 'DecentCanopy', 'CN', '#74dfb4', '14aef826624f9e1651bf39407a3a82ef2936e39d',
    'assets/decentcanopy-ens-favicon.png', 'Project favicon', 'index.html',
    'PVTI_lADODD7ovc4Bn91hzhCOGZs'],
  ['busking', 'DecentBusking', 'BK', '#f0bd70', '7c3658a2079dd720823702dcd39805cb1e7d49e8',
    'img/hat.svg', 'Project favicon', 'index.html',
    'PVTI_lADODD7ovc4Bn91hzhCOGeI'],
  ['bignuten', 'BigNuten_Vanilla', 'BN', '#cfaaef', '8eb8d1314af929109724731d9794b93db6505811',
    'img/BigNuten.png', 'Project logo', 'index.html',
    'PVTI_lADODD7ovc4Bn91hzhCOGi4'],
  ['head', 'DecentHead', 'HD', '#8ddbea', '3b2a72f7f8c49fb2af89ea7df2ead8e338e0e870',
    'img/ens/head-avatar.png', 'Project artwork (Supporter front adaptation)',
    'https://github.com/TheJollyLaMa/DecentHead/commit/9aa196caf305588b9a677fb1b6dc7db784fdb932',
    'PVTI_lADODD7ovc4Bn91hzhCOHro'],
  ['market', 'DecentMarket', 'MK', '#f3ce76', '76afe7491cee4767048b2270dfe9dd8135984006',
    'img/ens/market-avatar.png', 'Prepared project identity artwork; not proof of published ENS',
    'data/market-ens.json', 'PVTI_lADODD7ovc4Bn91hzhCOH4g'],
];

const identities = entries.map(([id, name, monogram, color, revision, path, description, evidence, portfolioId]) => {
  const repository = `TheJollyLaMa/${name}`;
  const repositoryUrl = `https://github.com/${repository}`;
  return {
    id, name, repository, repositoryUrl, portfolioId,
    fallback: { monogram, color, description: 'Local wayfinding badge, not an official logo' },
    artwork: {
      url: `https://raw.githubusercontent.com/${repository}/${revision}/${path}`,
      alt: `${name}: ${description}`, description,
      provenance: {
        sourceUrl: `${repositoryUrl}/blob/${revision}/${path}`,
        evidenceUrl: evidence.startsWith('https:') ? evidence : `${repositoryUrl}/blob/${revision}/${evidence}`,
        revision, verifiedAt: '2026-10-23', visibility: 'public',
        attribution: 'The Jolly LaMa / A Decent Agency',
        license: 'CC-BY-4.0',
        licenseUrl: `${repositoryUrl}/blob/${revision}/LICENSES/CC-BY-4.0.txt`,
        modified: false,
      },
    },
  };
});

function repositoryFrom(value) {
  if (typeof value !== 'string') return null;
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) return value.toLowerCase();
  try {
    const url = new URL(value);
    if (url.origin !== 'https://github.com' || url.username || url.password || url.search || url.hash) return null;
    const match = url.pathname.match(/^\/([\w.-]+\/[\w.-]+)(?:\/(?:issues|pull)\/\d+)?\/?$/);
    return match?.[1].toLowerCase() || null;
  } catch { return null; }
}

function privateItem(item) {
  return Boolean(item?.private || item?.bodyRedacted || item?.redacted || item?.isPrivate || item?.repository?.isPrivate);
}

function publicProject(item) {
  if (!item || privateItem(item)) return null;
  const repository = repositoryFrom(item.repository) || repositoryFrom(item.url);
  const linked = identities.find(identity => identity.repository.toLowerCase() === repository);
  if (linked) return { ...structuredClone(linked), association: 'Explicit public repository reference',
    associationEvidence: { itemId: item.id || '', repositoryUrl: linked.repositoryUrl, source: 'repository-reference' } };
  // Only these reviewed portfolio IDs may supply a draft association. A mention in arbitrary notes is not ownership.
  if (item.fields?.Kind !== 'Portfolio' || typeof item.body !== 'string') return null;
  const identity = identities.find(identity => identity.portfolioId === item.id &&
    new RegExp(`https://github\\.com/${identity.repository}(?=[\\s/#)?]|$)`, 'i').test(item.body));
  return identity ? { ...structuredClone(identity), association: 'Reviewed public portfolio ID and repository link',
    associationEvidence: { itemId: item.id, repositoryUrl: identity.repositoryUrl, source: 'reviewed-portfolio' } } : null;
}

function generic(kind, label) {
  const milestone = kind === 'milestone';
  return {
    kind, label, projects: [], artwork: null,
    fallback: { monogram: milestone ? 'MS' : kind === 'private' ? '—' : 'WS',
      color: milestone ? '#f0b878' : '#8ba3bd',
      description: milestone ? 'Milestone route gate, not a repository' : 'Unbranded planning site' },
  };
}

/** Pure, offline metadata. Never interprets titles, dependency prose, workstreams or ENS as project ownership. */
export function itemIdentity(item) {
  if (privateItem(item)) return generic('private', 'Private / redacted item');
  if (item?.fields?.Kind === 'Milestone') return generic('milestone', item.title || 'Milestone');
  const project = publicProject(item);
  return project ? {
    kind: 'repository', label: project.name, projects: [project],
    artwork: project.artwork, fallback: project.fallback,
  } : generic('unassigned', 'No verified project identity');
}

/** A workstream can contain several repositories; it must not inherit one member's logo as its owner. */
export function siteIdentity(site) {
  if (privateItem(site)) return generic('private', 'Private / redacted site');
  if (site?.type === 'milestone') return generic('milestone', site.title || 'Milestone');
  if (!Array.isArray(site?.items)) return itemIdentity(site);
  const projects = new Map();
  for (const item of site.items) {
    const identity = itemIdentity(item);
    for (const project of identity.projects) projects.set(project.id, project);
  }
  if (site.type === 'repository' && projects.size === 1 &&
      site.items.every(item => itemIdentity(item).projects[0]?.id === [...projects.keys()][0])) {
    const project = [...projects.values()][0];
    return { kind: 'repository', label: project.name, projects: [project], artwork: project.artwork, fallback: project.fallback };
  }
  return { ...generic('workstream', site.title || 'Workstream yard'), projects: [...projects.values()] };
}

/** Only pinned, reviewed image sources are eligible for rendering; rejects owner avatars and arbitrary URLs. */
export function isSafeArtworkUrl(value) {
  return typeof value === 'string' && identities.some(identity => identity.artwork.url === value);
}
