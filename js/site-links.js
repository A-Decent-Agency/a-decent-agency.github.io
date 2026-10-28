const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 240
  && !/[\u0000-\u001f\u007f]/.test(value);

export function siteAddress(base, siteId, cardId) {
  if (!validId(siteId) || cardId !== undefined && !validId(cardId)) throw new Error('A published site address is required.');
  const url = new URL(base);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Site sharing requires an HTTP(S) address.');
  url.search = ''; url.hash = ''; url.username = ''; url.password = '';
  url.searchParams.set('site', siteId);
  if (cardId !== undefined) url.searchParams.set('card', cardId);
  return url.href;
}

export function resolveSiteAddress(base, sites) {
  const params = new URL(base).searchParams;
  if (!params.has('site') && !params.has('card')) return null;
  const siteId = params.get('site'), cardId = params.get('card');
  if (!validId(siteId) || cardId !== null && !validId(cardId)
    || params.getAll('site').length !== 1 || params.getAll('card').length > 1) {
    return { error: 'This site link is invalid. Choose a destination from Chart a course.' };
  }
  const site = sites.find(site => site.id === siteId);
  if (!site) return { error: 'This shared site is not in the current public roadmap. It may have been removed or withheld; no private details have been recovered.' };
  const card = cardId === null ? null : site.items.find(item => item.id === cardId);
  if (cardId !== null && !card) return { site, error: 'The site is available, but this shared card is no longer published at it.' };
  return { site, card };
}

export function siteForCard(sites, cardId) {
  return sites.find(site => site.items.some(item => item.id === cardId));
}
