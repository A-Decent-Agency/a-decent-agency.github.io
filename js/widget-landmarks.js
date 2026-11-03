const RADIO = 'a-decent-agency/dbuskradio';
const ADVERTISING = 'a-decent-agency/dvert';

export function widgetLandmarkKind(project) {
  if (!project || project.entityId) return null;
  const repository = project.repository?.toLowerCase();
  return repository === RADIO ? 'radio' : repository === ADVERTISING ? 'advertising' : null;
}

export function buildWidgetLandmark(group, site, model, { block }) {
  const kind = widgetLandmarkKind(site.project);
  if (!kind) return false;
  const color = kind === 'radio' ? '#64d8d0' : '#f6bc75';
  const ink = '#253447', paper = '#ede3c9';
  block(group, 0, 1.7, 24, model.width + 9, .5, 16, '#566b76');
  block(group, -4, 2.2, 23, 19, 9, 10, ink);
  block(group, -4, 11.2, 23, 22, .7, 13, color);
  block(group, -4, 4.5, 28.1, 16, 5, .25, '#8dcbd5', true);
  for (const x of [-10, -4, 2]) block(group, x, 4.5, 28.3, .35, 5, .35, paper);
  for (const x of [-11, -7, -3, 1]) block(group, x, 2.6, 30, 2.4, .45, 1.4, paper);
  if (kind === 'radio') {
    block(group, 11, 2.2, 21, 1, 21, 1, '#aab4c3');
    for (let i = 0; i < 4; i++) {
      block(group, 11, 9 + i * 3, 21, 7 - i, .4, .6, color);
    }
    block(group, 11, 23.2, 21, 1.5, 1.5, 1.5, '#f4d189');
    block(group, -4, 5, 28.6, 10, 2.4, .3, ink);
    for (let i = 0; i < 7; i++) block(group, -8 + i * 1.3, 5.2, 28.9, .6, 1 + i % 3 * .4, .25, color);
    for (const x of [7, 14]) {
      block(group, x, 2.2, 29, 4, .7, 2, '#c7a781');
      block(group, x, 2.2, 29, .45, 2, .5, ink);
    }
  } else {
    for (const [x, z, tint] of [[10, 21, '#d991c3'], [12, 29, '#67cfb7']]) {
      block(group, x, 2.2, z, .6, 7, .8, ink);
      block(group, x, 5.5, z, 7, 5, 1, paper);
      block(group, x, 6, z + .6, 5.8, 3.8, .25, tint);
      block(group, x - 1.3, 6.7, z + .8, 1.2, 1.2, .2, ink);
      block(group, x + .8, 6.2, z + .8, 1.5, .4, .2, paper);
      block(group, x + .3, 7.3, z + .8, 2.7, .4, .2, paper);
    }
    for (let i = 0; i < 4; i++) block(group, -10 + i * 4, 11.9, 23, 2.5, 1.4, 3, i % 2 ? '#67cfb7' : '#d991c3');
  }
  // Connection pads are a modularity motif, not a claim that hosts are integrated.
  for (const x of [-8, 0, 8]) {
    block(group, x, 2.2, 15.8, 3, .5, 1.6, color);
    block(group, x, 2.7, 15.8, .6, .6, .8, paper);
  }
  return true;
}
