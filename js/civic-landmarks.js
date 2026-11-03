// Symbolic frontage only: these identities do not assert shipped features or real amenities.
const CIVIC_IDENTITIES = new Map([
  ['a-decent-agency/a-decent-agency.github.io', 'town-hall'],
  ['thejollylama/decentpilgrimages', 'temple'],
  ['a-decent-agency/decentjukebox', 'jukebox-museum'],
  ['thejollylama/decentbusking', 'concert'],
  ['thejollylama/decentinvoice', 'invoice-office'],
  ['thejollylama/decentescrow', 'escrow-office'],
  ['thejollylama/decent_nda', 'nda-office'],
  ['thejollylama/decentmarket', 'market'],
  ['thejollylama/decenthead', 'gateway'],
]);

export function civicLandmarkKind(site) {
  const project = site?.project;
  if (!project || project.entityId || [site, project].some(record =>
    record.private || record.isPrivate || record.redacted || record.bodyRedacted)) return null;
  return typeof project.repository === 'string'
    ? CIVIC_IDENTITIES.get(project.repository.toLowerCase()) || null : null;
}

export function buildCivicLandmark(group, site, model, { block, tree }) {
  const kind = civicLandmarkKind(site);
  if (!kind) return false;
  const width = Number.isFinite(model?.width) && model.width > 0 ? model.width : 30;
  const scale = Math.min(1, (width / 2 + 12) / 22);
  const stone = '#e6d8be', dark = '#344555', gold = '#e0b867', green = '#57957a';
  // All frontage stays beyond the central tower's z[-10,10] evidence envelope.
  const b = (x, y, z, w, h, d, color = stone, glass = false) =>
    block(group, x * scale, y, z, w * scale, h, d, color, glass);
  const t = (x, z) => tree(group, x * scale, z, .65 * scale);
  const bench = (x, z) => {
    b(x, 1.8, z, 3, .4, 1, dark);
    for (const dx of [-1, 1]) b(x + dx, 1.1, z, .3, .7, .7, gold);
  };
  const columns = (xs, z, height = 5, y = 2.2) => {
    for (const x of xs) {
      b(x, y, z, 1.6, .35, 1.6);
      b(x, y + .35, z, .8, height - .7, .8);
      b(x, y + height - .35, z, 1.6, .35, 1.6);
    }
  };
  const pediment = (x, y, z, span, rise, depth) => {
    b(x, y, z, span, .8, depth);
    for (let tier = 0; tier < 7; tier++) {
      b(x, y + .8 + tier * rise / 7, z, span * (1 - (tier + 1) / 8), rise / 7, depth - .4);
    }
  };
  const jukebox = (x, z, color) => {
    b(x, 1.6, z, 2.8, 3.3, 1.3, color);
    b(x, 4.9, z, 2.1, .6, 1.3, gold);
    b(x, 5.5, z, 1.2, .4, 1.3, gold);
    b(x, 3.6, z + .7, 1.8, 1.1, .16, '#88e1df', true);
    b(x, 2, z + .7, 1.8, 1.2, .16, dark);
    for (const dx of [-.5, 0, .5]) b(x + dx, 2.1, z + .81, .12, 1, .08, gold);
  };
  b(0, 1, 24.5, 42, .25, 15, '#78827c');

  if (kind === 'town-hall') {
    for (let i = 0; i < 4; i++) b(0, 1.25 + i * .35, 24 - i * .5, 35 - i * 2, .35, 9 - i);
    b(0, 2.65, 20, 28, 8.6, 5, '#aeb8bf');
    b(0, 2.65, 22.6, 4, 6.5, .25, dark);
    columns([-13, -8, -3, 3, 8, 13], 25, 9.5, 2.65);
    pediment(0, 12.15, 24, 33, 5, 6);
    b(0, 11.25, 20, 7, 7.5, 4.8, stone);
    b(0, 18.75, 20, 8, .6, 5.8, gold);
    b(0, 19.35, 20, 6.2, 3.8, 4.5, stone);
    b(0, 19.85, 22.35, 3, 3, .2, dark);
    b(0, 21.3, 22.5, .2, 1.1, .1, gold);
    b(.55, 21.3, 22.5, 1.3, .2, .1, gold);
    b(0, 23.15, 20, 7.4, .6, 5.4, gold);
    b(0, 23.75, 20, 4.5, .7, 3.5, dark);
    for (const x of [-19, 19]) { bench(x, 29); t(x, 20); }
    b(0, 1.3, 30, 7, .35, 3, stone);
    b(0, 1.65, 30, 5.5, .15, 2, '#73bacc');
  } else if (kind === 'temple') {
    for (let i = 0; i < 3; i++) b(0, 1.3 + i * .4, 22, 34 - i * 2, .4, 10 - i);
    b(0, 2.5, 20.5, 21, 9.5, 6, '#c4b8a2');
    b(0, 2.5, 23.6, 4.5, 7, .25, dark);
    columns([-13, -8, -3.5, 3.5, 8, 13], 25, 10.5, 2.5);
    pediment(0, 13, 23, 32, 6, 8);
    b(0, 19.8, 23, 5, .6, 7.6, gold);
    for (const x of [-19, 19]) {
      columns([x], 20, 6, 1.3);
      columns([x], 24, 6, 1.3);
      b(x, 7.3, 22, 3, .5, 7);
      b(x, 1.3, 29, 6, .5, 5, green);
      t(x, 29); bench(x, 25.8);
    }
    for (let i = 0; i < 5; i++) b((i % 2 ? 1 : -1) * 1.3, 1.3, 25 + i * 1.4, 3.2, .18, 1, '#e3cda4');
  } else if (kind === 'jukebox-museum') {
    b(0, 1.3, 20.5, 24, 5.2, 6, '#84699a');
    b(0, 6.5, 21, 27, .7, 7, gold);
    for (const x of [-8, 0, 8]) {
      b(x, 2, 23.6, 5.7, 3.8, .2, '#8fd3d5', true);
      jukebox(x, 27, x ? '#be587b' : '#4a9b97');
    }
    // A red framed booth has visible glazing, handset and dial rather than signage.
    b(17, 1.3, 26, 3.4, .4, 3.4, '#bc4e50');
    for (const x of [15.6, 18.4]) for (const z of [24.6, 27.4]) b(x, 1.7, z, .3, 4.8, .3, '#bc4e50');
    b(17, 6.5, 26, 3.7, .6, 3.7, '#bc4e50');
    b(17, 2.1, 27.4, 2.5, 4, .12, '#a2d8e0', true);
    b(17, 3.3, 26, .8, 1.4, .5, dark);
    b(17.6, 3.6, 26.3, .25, 1, .25, gold);
    bench(-17, 29);
  } else if (kind === 'concert') {
    b(1, 1.3, 22, 25, 1, 8, dark);
    for (const x of [-12, 14]) {
      b(x, 2.3, 22, 1.2, 6.7, 1.2, gold);
      b(x + (x < 0 ? 2 : -2), 2.3, 23, 2, 4, 2, '#263442');
      for (const y of [3, 4.7]) b(x + (x < 0 ? 2 : -2), y, 24.1, 1.2, 1.2, .15, '#778b9c');
    }
    b(1, 8.7, 22, 28, .8, 7, dark);
    for (const x of [-8, -2, 4, 10]) b(x, 8.1, 25, 1, .6, .6, '#f2ce86');
    b(1, 2.3, 20, 14, 4.5, .5, '#705d8a');
    for (const x of [-4, 1, 6]) b(x, 1.3, 29.5, 3, .25, 2, '#d6c6a9');
    // Human-scale busking corner: open guitar case, instrument and microphone.
    b(-17, 1.3, 28, 6, .2, 5, '#c9aa7f');
    b(-17.5, 1.5, 29, 2.7, .25, 1.1, dark);
    b(-17, 1.5, 27, 1.2, 1.6, .6, '#ce8c50');
    b(-17, 3.1, 27, .35, 1.6, .35, gold);
    b(-15, 1.5, 27, .15, 3, .15, dark);
    b(-15.3, 4.4, 27, .8, .2, .25, dark);
  } else if (['invoice-office', 'escrow-office', 'nda-office'].includes(kind)) {
    const color = { 'invoice-office': '#6b9baf', 'escrow-office': '#668e80', 'nda-office': '#82738f' }[kind];
    b(0, 1.3, 21, 24, 5.5, 7, color);
    b(0, 6.8, 21, 26, .6, 7.5, stone);
    for (const x of [-8, 8]) b(x, 2.5, 24.6, 5, 2.8, .2, '#b8dfe2', true);
    b(0, 1.3, 24.6, 3, 4.2, .3, dark);
    columns([-3, 3], 25.5, 4);
    b(0, 6.2, 25.5, 9, .6, 2, stone);
    b(16, 1.3, 26, 6, .6, 5, stone);
    if (kind === 'invoice-office') {
      b(16, 1.9, 26, 3, 3.6, .5, '#f4e9cd');
      for (const y of [2.4, 3.1, 3.8, 4.5]) b(16, y, 26.3, 2, .16, .1, color);
    } else if (kind === 'escrow-office') {
      b(16, 1.9, 26, .4, 3.5, .4, gold);
      b(16, 5.4, 26, 5, .25, .35, gold);
      for (const x of [14, 18]) {
        b(x, 3.9, 26, .15, 1.5, .15, gold);
        b(x, 3.7, 26, 2, .25, 1.5, dark);
      }
    } else {
      b(16, 1.9, 26, 3.4, 2.4, 1.3, dark);
      b(16, 4.3, 26, 2.5, .35, .7, gold);
      for (const x of [14.9, 17.1]) b(x, 4.3, 26, .3, 1.3, .5, gold);
      b(16, 5.3, 26, 2.5, .35, .5, gold);
    }
    bench(-16, 28); t(-16, 20);
  } else if (kind === 'market') {
    for (const x of [-13, 0, 13]) {
      b(x, 1.3, 24, 8, 2, 4, '#aa815d');
      for (const dx of [-3.6, 3.6]) b(x + dx, 3.3, 24, .3, 2, .3, dark);
      for (let i = 0; i < 6; i++) b(x - 3.5 + i * 1.4, 5.3, 24, 1.4, .4, 5, i % 2 ? stone : '#b97063');
      for (let i = 0; i < 3; i++) b(x - 2.3 + i * 2.3, 3.3, 24, 1.5, .7, 2, ['#dfa85b', '#68a67a', '#b95e63'][i]);
    }
    bench(-9, 30); bench(9, 30);
  } else if (kind === 'gateway') {
    for (const x of [-10, 10]) {
      b(x, 1.3, 22, 4, 6, 5, dark);
      b(x, 7.3, 22, 5, .7, 6, gold);
      b(x, 2.4, 24.6, 1.8, 3.6, .2, '#80cdd5', true);
    }
    b(0, 7.5, 22, 24, .9, 5, '#8ddbea');
    for (const x of [-16, 16]) { t(x, 27); bench(x, 31); }
    for (const z of [26, 28, 30]) b(0, 1.3, z, 12, .15, .6, stone);
  }
  return true;
}
