import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { publicRepository } from '../js/project-campus.js';
import { CANOPY } from '../js/canopy-registry.js';
import { REPOSITORIES } from '../js/progress-feed.js';

const PROJECT = 'PVT_kwDODD7ovc4Bn91h';
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' }).trim();
const snapshot = JSON.parse(await readFile(new URL('../data/project.json', import.meta.url)));
const feed = JSON.parse(await readFile(new URL('../data/progress.json', import.meta.url)));
const allowed = new Set([...REPOSITORIES, ...CANOPY.projects.map(project => project.repository)]);
const applying = process.argv.includes('--apply');
const changes = [];
for (const item of snapshot.items) {
  if (item.private || item.bodyRedacted || item.fields.Kind === 'Milestone') continue;
  const repository = publicRepository(item);
  if (!allowed.has(repository)) continue;
  const observation = feed.repositories.find(entry => entry.repository === repository);
  const values = {
    Project: repository,
    Component: item.fields.Component || (item.fields.Kind === 'Portfolio' ? 'Project overview' : item.fields.Workstream || 'Unassigned component'),
    Priority: item.fields.Status === 'Done' ? 'Delivered' : ({ Now: 'P1 / Now', Next: 'P2 / Next', Later: 'P3 / Later', Inventory: 'P4 / Inventory' })[item.fields.Horizon] || 'Needs triage',
    'Delivery version': item.fields.Kind === 'Portfolio' ? (observation?.versions || []).map(version => version.tag).join(', ') : '',
  };
  for (const [field, value] of Object.entries(values)) if (value && item.fields[field] !== value) changes.push({ id: item.id, field, value });
}
const milestones = [
  { prefix: 'M1 —', status: 'Done', outcome: 'Delivered reuse desk in Canopy PR44 (https://github.com/TheJollyLaMa/DecentCanopy/pull/44), merged and Pages-verified 2026-10-24. Now/Next needs, grouped donors, evidence and per-consumer compatibility checks; 34 focused tests plus two synthetic visitor portfolios and mobile/keyboard acceptance. Supersedes earlier keep-local direction with steward-approved publication. Not real-user or donor-code integration validation.' },
  { prefix: 'M2 —', status: 'In Progress', outcome: 'Public repository linking/activity/freshness shipped in Canopy and Office PR7 (https://github.com/A-Decent-Agency/a-decent-agency.github.io/pull/7); production observer verified 10/10 public repos on 2026-10-25. Source links, checked-at times and error/retention states are visible. Full milestone remains open: complete paginated issue/PR/contributor coverage and unlink/revocation acceptance are not implied by a bounded public snapshot.' },
];
for (const milestone of milestones) {
  const item = snapshot.items.find(item => item.title.startsWith(milestone.prefix));
  if (!item || item.private || item.bodyRedacted) throw new Error(`Missing reviewed milestone ${milestone.prefix}`);
  for (const [field, value] of Object.entries({ Status: milestone.status, Outcome: milestone.outcome,
    Project: 'TheJollyLaMa/DecentCanopy', Component: 'Milestone / coordination', Priority: milestone.status === 'Done' ? 'Delivered' : 'P3 / Later acceptance' })) {
    if (item.fields[field] !== value) changes.push({ id: item.id, field, value });
  }
}
console.log(JSON.stringify({ mode: applying ? 'apply' : 'dry-run', changes }, null, 2));
if (!applying) process.exit(0);
const fields = JSON.parse(gh('project', 'field-list', '3', '--owner', 'A-Decent-Agency', '--format', 'json')).fields;
for (const name of ['Project', 'Component', 'Delivery version', 'Priority']) {
  if (!fields.some(field => field.name === name)) {
    const created = JSON.parse(gh('project', 'field-create', '3', '--owner', 'A-Decent-Agency', '--name', name, '--data-type', 'TEXT', '--format', 'json'));
    fields.push(created);
  }
}
for (const change of changes) {
  const field = fields.find(field => field.name === change.field);
  if (!field?.id) throw new Error(`No field ID for ${change.field}`);
  const args = ['project', 'item-edit', '--project-id', PROJECT, '--id', change.id, '--field-id', field.id];
  if (field.options) {
    const option = field.options.find(option => option.name === change.value);
    if (!option) throw new Error(`No option for ${change.field}: ${change.value}`);
    args.push('--single-select-option-id', option.id);
  } else args.push('--text', change.value);
  gh(...args);
}
for (const milestone of milestones) {
  const item = snapshot.items.find(item => item.title.startsWith(milestone.prefix));
  const content = JSON.parse(gh('api', 'graphql', '-f', `query=query { node(id:${JSON.stringify(item.id)}) { ... on ProjectV2Item { content { ... on DraftIssue { id body } } } } }`)).data.node.content;
  if (!content?.id || typeof content.body !== 'string') throw new Error('Reviewed milestone is no longer a readable draft');
  const marker = '## Delivery reconciliation (2026-10-25)';
  if (!content.body.startsWith(marker)) gh('project', 'item-edit', '--id', content.id, '--body',
    `${marker}\n\n${milestone.outcome}\n\nThe source Status/Outcome above supersede the historical delivery statements below. Original dates remain planning windows, not reconstructed completion dates. No remaining acceptance is waived.\n\n## Historical planning notes (retained)\n\n${content.body}`);
}
// The whole-library view was unfiltered; make its stated portfolio scope real.
gh('api', 'graphql', '-f', 'query=mutation { updateProjectV2View(input:{viewId:"PVTV_lADODD7ovc4Bn91hzgMKGew",filter:"kind:Portfolio"}) { projectV2View { id filter } } }');
const views = JSON.parse(gh('api', 'graphql', '-f', 'query=query { organization(login:"A-Decent-Agency") { projectV2(number:3) { views(first:50) { nodes { id layout configuration { visibleFields(first:100) { nodes { ... on ProjectV2FieldCommon { id } } } } } } } } }')).data.organization.projectV2.views.nodes;
for (const view of views) {
  if (view.layout === 'ROADMAP_LAYOUT') {
    console.log('GitHub roadmap does not support visible-field columns; shared item metadata/status is preserved, dates unchanged.');
    continue;
  }
  const ids = [...new Set([...view.configuration.visibleFields.nodes.map(field => field.id).filter(Boolean),
    ...fields.filter(field => ['Project', 'Component', 'Priority', 'Delivery version'].includes(field.name)).map(field => field.id)])];
  gh('api', 'graphql', '-f', `query=mutation { updateProjectV2View(input:{viewId:${JSON.stringify(view.id)},configuration:{visibleFieldIds:${JSON.stringify(ids)}}}) { projectV2View { id } } }`);
}
console.log(`Applied ${changes.length} metadata corrections; no dates, points, private cards or funding fields changed.`);
