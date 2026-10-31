import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { REVIVAL_PLANS, PLANNING_PLANS, ROUTER_PLAN, HUMAN_PRIORITIES, renderHumanPriorities, renderRevivalPlan } from '../js/revival-plans.js';
import { constructionSites } from '../js/construction-model.js';
import { campusStructure, publicRepository } from '../js/project-campus.js';
import { campusConnections } from '../js/campus-graph.js';
import { renderCampusPlan } from '../js/campus-plan.js';
import { HISTORICAL_MAPS } from '../js/historical-maps.js';
import { renderProjectRecall, validateRecall } from '../js/project-recall.js';
import { projectMints } from '../js/version-mints.js';
import { renderCampusDetails } from '../js/campus-details.js';

test('five revival campuses have distinct named proposed stages, acceptance tests and original-map provenance', () => {
  assert.equal(REVIVAL_PLANS.length, 5);
  assert.equal(new Set(REVIVAL_PLANS.map(plan => plan.repository)).size, 5);
  assert.equal(new Set(REVIVAL_PLANS.map(plan => plan.motif)).size, 5);
  for (const plan of REVIVAL_PLANS) {
    assert.equal(plan.stages.length, 5);
    assert.equal(new Set(plan.stages.map(stage => stage.id)).size, 5);
    assert.ok(plan.stages.every(stage => stage.state === 'proposed' && stage.test.length > 50));
    assert.ok(HISTORICAL_MAPS.some(map => map.id === plan.archive.id));
    assert.ok(plan.caution.length > 150);
    assert.ok(plan.sources.length >= 2);
    for (const entry of plan.sources) assert.match(entry.url, /^https:\/\/github\.com\//);
  }
});
test('proposal levels cannot create delivered floors, change board jobs, or identify private cards', () => {
  for (const plan of REVIVAL_PLANS) {
    const card = { id: plan.repository, title: 'Actual board task', repository: plan.repository, fields: { Kind: 'Task', Status: 'Todo' } };
    const sites = constructionSites([card], { includeContext: true });
    const site = sites.find(site => site.project?.repository === plan.repository);
    const structure = campusStructure(site);
    assert.equal(structure.plannedFloors, 5);
    assert.equal(structure.deliveredFloors, 0);
    assert.equal(structure.floors, 0);
    assert.equal(structure.height, 45);
    assert.equal(structure.completed, 0);
    assert.equal(site.items.length, 1);
    assert.equal(sites.flatMap(site => site.items).length, 1);
    const html = renderCampusPlan(site, sites, null);
    assert.equal((html.match(/data-revival-stage=/g) || []).length, 5);
    assert.equal((html.match(/data-campus-item=/g) || []).length, 1);
    assert.match(html, /PROPOSED \/ not delivered/);
    assert.match(html, /Acceptance:/);
    assert.equal(publicRepository({ ...card, private: true }), null);
    assert.equal(renderRevivalPlan({}), '');
  }
});
test('proposed crossovers are dashed evidence with an integration acceptance test, not observed relationships', () => {
  const sites = constructionSites([], { includeContext: true });
  const links = campusConnections(sites, null).filter(link => link.kind === 'revival proposal');
  assert.equal(links.length, PLANNING_PLANS.reduce((sum, plan) => sum + plan.connections.length, 0));
  assert.ok(links.every(link => link.state === 'proposed' && link.proposed && link.nextTest.length > 20));
  const filtered = constructionSites([{ id: 'one', title: 'One', repository: 'TheJollyLaMa/ArtFi', fields: {} }]);
  assert.equal(campusConnections(filtered, null).filter(link => link.kind === 'revival proposal').length, 0);
});
test('DLend is a display proposal over the existing ArtFi identity and distinct settlement responsibilities', () => {
  const plan = REVIVAL_PLANS[0];
  assert.equal(plan.repository, 'TheJollyLaMa/ArtFi');
  assert.equal(plan.name, 'DecentLending / DLend');
  assert.match(plan.observed, /ArtFiProtocol/);
  assert.match(plan.observed, /ArtFiSettlementRouter v2.1.0/);
  assert.match(plan.caution, /not a new token, contract deployment, repo rename or migration/);
  assert.ok(plan.stages.some(stage => stage.id === 'widget' && stage.test.includes('two synthetic host')));
});
test('router is an independent infrastructure entity, not duplicated lending jobs or releases', () => {
  const card = { id: 'artfi-job', title: 'Lending job', repository: 'TheJollyLaMa/ArtFi', fields: { Kind: 'Task', Status: 'Todo' } };
  const sites = constructionSites([card], { includeContext: true });
  const router = sites.find(site => site.id === 'entity:decent-settlements-router');
  const lending = sites.find(site => site.id === 'project:thejollylama/artfi');
  assert.equal(router.title, ROUTER_PLAN.name);
  assert.equal(router.project.repository, lending.project.repository, 'shared source does not imply a shared product entity');
  assert.equal(router.items.length, 0);
  assert.equal(lending.items.length, 1);
  const feed = { repositories: [{ repository: 'TheJollyLaMa/ArtFi', versions: [{ tag: 'v2' }], codeBytes: 999 }] };
  const model = campusStructure(router, feed);
  assert.equal(model.plannedFloors, 5);
  assert.equal(model.deliveredFloors, 0);
  assert.equal(model.codeBytes, undefined);
  assert.deepEqual(projectMints(router, feed), []);
  assert.match(renderCampusDetails(router, feed), /No lending-project releases/);
  assert.match(renderRevivalPlan(router), /issues\/62/);
  const links = campusConnections(sites, null);
  assert.ok(links.some(link => link.from === lending.id && link.to === router.id && link.proposed));
  assert.ok(links.some(link => link.from === router.id && link.to === 'project:thejollylama/decentcanopy' && link.proposed));
  assert.equal(constructionSites([card]).some(site => site.project?.entityId), false, 'filtered route does not inject unrelated infrastructure');
});
test('human priorities are overlapping cultural lenses with distinct entity navigation, not eligibility scores', () => {
  const sites = constructionSites([], { includeContext: true });
  const keys = new Set(sites.filter(site => site.project).map(site => site.project.entityId ? site.id : site.project.repository.toLowerCase()));
  assert.equal(HUMAN_PRIORITIES.length, 8);
  for (const need of HUMAN_PRIORITIES) for (const key of need.projects) assert.ok(keys.has(key.toLowerCase()), key);
  const html = renderHumanPriorities();
  assert.equal((html.match(/data-human-priority=/g) || []).length, 8);
  assert.match(html, /not a universal ranking/);
  assert.match(html, /data-human-site="entity:decent-settlements-router"/);
  const router = renderHumanPriorities(ROUTER_PLAN);
  assert.match(router, /data-human-priority="livelihood"/);
  assert.match(router, /data-human-priority="continuity"/);
  assert.doesNotMatch(router, /data-human-priority="health"/);
});
test('supplemental proposals preserve mainline issue skeletons and sit above rather than replacing them', () => {
  const site = constructionSites([{ id: 'lending', title: 'Lending', repository: 'TheJollyLaMa/ArtFi', fields: {} }])[0];
  const structures = [
    { kind: 'level', order: 1, title: 'Existing level', total: 2, closed: 1, open: 1 },
    { kind: 'grounds', order: 1, title: 'Existing grounds', total: 1, closed: 1, open: 0 },
  ];
  const feed = { repositories: [{ repository: site.project.repository, structures }] };
  const model = campusStructure(site, feed);
  assert.equal(model.levels.length, 1);
  assert.equal(model.grounds.length, 1);
  assert.equal(model.plannedFloors, 5);
  assert.equal(model.proposalBase, model.top);
  assert.equal(model.height, model.top + 45);
  assert.equal(model.finishedCount, 1);
  assert.equal(model.deliveredFloors, 0);
});
test('monthly recall keeps public source counts distinct from deployment and local work', async () => {
  const value = JSON.parse(await readFile(new URL('../data/project-recall.json', import.meta.url)));
  assert.equal(validateRecall(value), value);
  assert.equal(value.projects.length, 14);
  const html = renderProjectRecall(value);
  assert.equal((html.match(/data-recall-repository=/g) || []).length, 14);
  assert.match(html, /not proof of deployment/);
  assert.match(html, /not an edit of the older Project board/);
  assert.match(html, /mint.*deferred/);
  assert.ok(value.projects.some(project => project.repository === 'TheJollyLaMa/BigNuten_Vanilla' && project.octoberMergedCount > 0));
  assert.ok(value.projects.every(project => project.openIssueCount === project.open.length + project.omittedOpen));
  const bad = structuredClone(value); bad.projects[0].merged[0].url = 'https://other.example/secret';
  assert.throws(() => validateRecall(bad), /source/);
  const duplicate = structuredClone(value); duplicate.projects.push(duplicate.projects[0]);
  assert.throws(() => validateRecall(duplicate), /record/);
  const escaped = structuredClone(value); escaped.projects[0].name = '<img onerror=bad>';
  assert.match(renderProjectRecall(escaped), /&lt;img/);
  assert.doesNotMatch(renderProjectRecall(escaped), /<img/);
});
