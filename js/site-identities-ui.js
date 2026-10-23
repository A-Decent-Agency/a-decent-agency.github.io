import { isSafeArtworkUrl, siteIdentity } from './site-identities.js';

export const MAX_SITE_IMAGES = 3;

/** Opt-in selected/nearby panel. Mounting inactive performs no image requests. */
export function mountSiteIdentity(container, site, { active = false } = {}) {
  const document = container.ownerDocument;
  function update(nextSite, { active: nextActive = false } = {}) {
    const identity = siteIdentity(nextSite);
    const panel = document.createElement('section');
    panel.className = 'site-identity';
    panel.setAttribute('aria-label', 'Construction site identity');
    const heading = document.createElement('strong');
    heading.textContent = `${identity.kind === 'milestone' ? 'Milestone · ' : identity.kind === 'workstream' ? 'Workstream · ' : ''}${identity.label}`;
    panel.append(heading);
    for (const project of identity.projects.slice(0, MAX_SITE_IMAGES)) {
      const card = document.createElement('div');
      card.className = 'site-identity-project';
      const badge = document.createElement('span');
      badge.className = 'site-identity-badge';
      badge.textContent = project.fallback.monogram;
      badge.style.backgroundColor = project.fallback.color;
      badge.setAttribute('aria-label', project.fallback.description);
      const link = document.createElement('a');
      link.href = project.repositoryUrl;
      link.textContent = project.name;
      link.rel = 'noopener noreferrer';
      card.append(badge, link);
      const credit = document.createElement('small');
      credit.textContent = `${project.association}. ${project.artwork.description}. Artwork: ${project.artwork.provenance.attribution}, CC BY 4.0 (unmodified).`;
      const source = document.createElement('a');
      source.href = project.artwork.provenance.sourceUrl;
      source.textContent = 'Artwork source';
      source.rel = 'noopener noreferrer';
      const license = document.createElement('a');
      license.href = project.artwork.provenance.licenseUrl;
      license.textContent = 'CC BY 4.0';
      license.rel = 'noopener noreferrer';
      card.append(credit, source, license);
      if (nextActive && isSafeArtworkUrl(project.artwork.url)) {
        const image = document.createElement('img');
        image.alt = project.artwork.alt;
        image.width = 64;
        image.height = 64;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.referrerPolicy = 'no-referrer';
        image.addEventListener('error', () => {
          image.remove();
          credit.textContent += ' Image unavailable; local badge retained.';
        }, { once: true });
        image.src = project.artwork.url;
        card.append(image);
      }
      panel.append(card);
    }
    if (identity.projects.length > MAX_SITE_IMAGES) {
      const overflow = document.createElement('small');
      overflow.textContent = `+${identity.projects.length - MAX_SITE_IMAGES} other explicitly linked repositories; see site cards.`;
      panel.append(overflow);
    }
    container.replaceChildren(panel);
    return identity;
  }
  update(site, { active });
  return { update, destroy: () => container.replaceChildren() };
}
