import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { itemIdentity, siteIdentity, isSafeArtworkUrl } from '../js/site-identities.js';
import { mountSiteIdentity, MAX_SITE_IMAGES } from '../js/site-identities-ui.js';
import { constructionSites } from '../js/construction-model.js';

const item = (repository = 'TheJollyLaMa/DecentCanopy', extra = {}) => ({
  id: 'public-item', title: 'Arbitrary title', repository, fields: { Kind: 'Task' }, ...extra,
});
const repositories = ['DecentCanopy', 'DecentBusking', 'BigNuten_Vanilla', 'DecentHead', 'DecentMarket'];

test('exact public repository identities provide pinned artwork, source, license and local fallback', () => {
  const badges = new Set();
  for (const name of repositories) {
    const identity = itemIdentity(item(`TheJollyLaMa/${name}`));
    assert.equal(identity.kind, 'repository');
    assert.equal(identity.label, name);
    assert.ok(isSafeArtworkUrl(identity.artwork.url));
    assert.match(identity.artwork.url, /^https:\/\/raw\.githubusercontent\.com\/TheJollyLaMa\/[^/]+\/[a-f0-9]{40}\//);
    assert.equal(identity.artwork.provenance.visibility, 'public');
    assert.equal(identity.artwork.provenance.license, 'CC-BY-4.0');
    assert.match(identity.artwork.provenance.sourceUrl, /\/blob\/[a-f0-9]{40}\//);
    assert.equal(identity.projects[0].associationEvidence.source, 'repository-reference');
    badges.add(identity.fallback.monogram);
  }
  assert.equal(badges.size, 5);
  assert.match(itemIdentity(item('TheJollyLaMa/DecentMarket')).artwork.description, /not proof of published ENS/);
});

test('only exact GitHub repository or issue/PR URLs qualify; lookalikes are rejected', () => {
  for (const url of [
    'https://github.com/TheJollyLaMa/DecentCanopy',
    'https://github.com/thejollylama/decentcanopy/issues/15',
    'https://github.com/TheJollyLaMa/DecentCanopy/pull/29',
  ]) assert.equal(itemIdentity(item('', { url })).kind, 'repository');
  for (const url of [
    'javascript:alert(1)', 'https://github.com.evil.test/TheJollyLaMa/DecentCanopy',
    'https://github.com@evil.test/TheJollyLaMa/DecentCanopy', 'http://github.com/TheJollyLaMa/DecentCanopy',
    'https://user@github.com/TheJollyLaMa/DecentCanopy', 'https://github.com/TheJollyLaMa/DecentCanopy-evil',
    'https://github.com/TheJollyLaMa/DecentCanopy?x=1', '//github.com/TheJollyLaMa/DecentCanopy',
    'https://github.com/TheJollyLaMa/DecentCanopy/blob/main/index.html',
  ]) assert.equal(itemIdentity(item('', { url })).projects.length, 0, url);
});

test('private/redacted items fail closed even with known IDs, titles, repository and notes', () => {
  for (const marker of ['private', 'bodyRedacted', 'redacted', 'isPrivate']) {
    const identity = itemIdentity(item('TheJollyLaMa/DecentCanopy', {
      id: 'PVTI_lADODD7ovc4Bn91hzhCOGZs', title: 'Portfolio: DecentCanopy',
      body: 'https://github.com/TheJollyLaMa/DecentCanopy', [marker]: true,
      fields: { Kind: 'Portfolio' },
    }));
    assert.equal(identity.kind, 'private');
    assert.equal(identity.artwork, null);
    assert.deepEqual(identity.projects, []);
    assert.equal(JSON.stringify(identity).includes('DecentCanopy'), false);
  }
  assert.equal(itemIdentity(item({ isPrivate: true, nameWithOwner: 'TheJollyLaMa/DecentCanopy' })).kind, 'private');
  assert.equal(siteIdentity({ private: true, items: [item()] }).kind, 'private');
});

test('title, workstream, arbitrary body mentions and ENS cannot invent an association', () => {
  for (const extra of [
    { title: 'Portfolio: DecentCanopy', body: 'https://github.com/TheJollyLaMa/DecentCanopy', fields: { Kind: 'Portfolio' } },
    { title: 'DecentBusking', fields: { Workstream: 'DecentBusking' } },
    { body: 'Dependency: https://github.com/TheJollyLaMa/DecentCanopy' },
    { url: 'https://decentcanopy.decentagency.eth' },
  ]) assert.equal(itemIdentity(item('', extra)).projects.length, 0);
  assert.equal(itemIdentity(item('', {
    id: 'PVTI_lADODD7ovc4Bn91hzhCOGZs', fields: { Kind: 'Portfolio' },
    body: 'https://github.com/TheJollyLaMa/DecentCanopyEvil',
  })).projects.length, 0);
});

test('milestones remain route gates, and mixed workstream yards never inherit repository branding', () => {
  assert.equal(itemIdentity(item(undefined, { fields: { Kind: 'Milestone' } })).kind, 'milestone');
  const milestone = siteIdentity({ type: 'milestone', title: 'M2', items: [item()] });
  assert.equal(milestone.artwork, null);
  assert.equal(milestone.fallback.monogram, 'MS');
  const yard = siteIdentity({ type: 'workstream', title: 'Canopy', items: [item(), item(), item('TheJollyLaMa/DecentMarket')] });
  assert.equal(yard.kind, 'workstream');
  assert.equal(yard.artwork, null);
  assert.equal(yard.projects.length, 2);
  assert.equal(siteIdentity({ type: 'workstream', title: 'Canopy', items: [item()] }).artwork, null);
  assert.equal(siteIdentity({ type: 'repository', items: [item()] }).kind, 'repository');
  assert.equal(siteIdentity({ type: 'repository', items: [item(), item('', { private: true })] }).kind, 'workstream');
});

test('real public snapshot resolves all five reviewed portfolios without reclassifying other drafts', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../data/project.json', import.meta.url)));
  const portfolios = snapshot.items.filter(entry => entry.fields.Kind === 'Portfolio' && itemIdentity(entry).projects.length);
  assert.deepEqual(portfolios.map(entry => itemIdentity(entry).label), repositories);
  for (const entry of portfolios) {
    assert.equal(itemIdentity(entry).projects[0].associationEvidence.source, 'reviewed-portfolio');
    assert.equal(itemIdentity({ ...entry, body: '' }).projects.length, 0, 'missing evidence must drop draft association');
  }
  for (const site of constructionSites(snapshot.items)) {
    if (site.type === 'milestone') assert.equal(siteIdentity(site).projects.length, 0);
    else if (site.type === 'repository' && siteIdentity(site).projects.length === 1) assert.ok(siteIdentity(site).artwork);
    else assert.equal(siteIdentity(site).artwork, null);
  }
});

test('metadata cannot mutate the registry; no arbitrary remote image, owner avatar or data URL is allowed', () => {
  const first = itemIdentity(item());
  first.artwork.url = 'https://evil.test/image.png';
  first.fallback.monogram = 'XX';
  assert.equal(isSafeArtworkUrl(first.artwork.url), false);
  assert.equal(itemIdentity(item()).fallback.monogram, 'CN');
  for (const url of [null, 'javascript:alert(1)', 'data:image/svg+xml,test',
    'https://avatars.githubusercontent.com/u/1', 'https://raw.githubusercontent.com/TheJollyLaMa/DecentCanopy/main/assets/favicon.png']) {
    assert.equal(isSafeArtworkUrl(url), false);
  }
});

// A small DOM double keeps loading/lifecycle tests dependency-free.
class Element {
  constructor(tag, document) {
    this.tagName = tag; this.ownerDocument = document; this.children = []; this.style = {}; this.listeners = {};
  }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
}
const all = node => [node, ...node.children.flatMap(all)];
function container() {
  const document = { createElement: tag => new Element(tag, document) };
  return new Element('div', document);
}

test('optional panel is inactive by default, bounds active artwork, labels provenance and cleans up', () => {
  const root = container();
  const site = { type: 'workstream', title: '<img src=x onerror=alert(1)>', items: repositories.map(name => item(`TheJollyLaMa/${name}`)) };
  const mounted = mountSiteIdentity(root, site);
  assert.equal(all(root).filter(node => node.tagName === 'img').length, 0);
  mounted.update(site, { active: true });
  const images = all(root).filter(node => node.tagName === 'img');
  assert.equal(images.length, MAX_SITE_IMAGES);
  for (const image of images) {
    assert.equal(image.loading, 'lazy');
    assert.equal(image.referrerPolicy, 'no-referrer');
    assert.ok(isSafeArtworkUrl(image.src));
  }
  assert.match(all(root).map(node => node.textContent || '').join(' '), /CC BY 4.0/);
  images[0].listeners.error();
  assert.equal(all(root).filter(node => node.tagName === 'img').length, MAX_SITE_IMAGES - 1);
  assert.match(all(root).map(node => node.textContent || '').join(' '), /local badge retained/);
  mounted.update(site);
  assert.equal(all(root).filter(node => node.tagName === 'img').length, 0);
  mounted.destroy();
  assert.equal(root.children.length, 0);
});

test('module import performs no image or fetch work', async () => {
  const previousFetch = globalThis.fetch;
  const previousImage = globalThis.Image;
  globalThis.fetch = () => { throw new Error('Unexpected fetch'); };
  globalThis.Image = class { constructor() { throw new Error('Unexpected image'); } };
  try {
    await import('../js/site-identities.js?no-network-test');
    await import('../js/site-identities-ui.js?no-network-test');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousImage === undefined) delete globalThis.Image;
    else globalThis.Image = previousImage;
  }
});
