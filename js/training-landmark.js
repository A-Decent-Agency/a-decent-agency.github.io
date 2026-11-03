const REPOSITORY = 'TheJollyLaMa/BigNuten_Vanilla';
const COLORS = {
  paving: '#d8d8ca', steel: '#293f50', rubber: '#405666', mint: '#71dfbe',
  purple: '#bc96df', track: '#b86854', line: '#fff2d6', water: '#70cfe7',
  fruit: '#f4c968', leaf: '#79b66b',
};

// An architectural metaphor only: these props do not represent delivered amenities.
// All boxes use the campus builder's bottom-y convention and existing instance batch.
export function buildTrainingLandmark(group, site, model, { block, tree } = {}) {
  if (site?.project?.repository !== REPOSITORY || site.project.entityId ||
      site.private || site.redacted || site.bodyRedacted || site.isPrivate ||
      site.project.private || site.project.isPrivate || site.project.redacted ||
      !Number.isFinite(model?.width) || model.width < 18 || typeof block !== 'function') return false;

  const span = model.width + 20;
  const box = (x, y, z, w, h, d, color, glass = false) =>
    block(group, x, y, z, w, h, d, color, glass);
  const c = COLORS;

  // The promenade ends at z=17.5; the tower and its evidence-backed bays stay untouched.
  box(0, 1.65, 25.8, span, .35, 16.2, c.paving);
  box(0, 2, 26, span - 1.4, .12, 6.1, c.rubber);

  // Open gym frontage: a mint roof band, glazing, entry gap and oversized dumbbell.
  const gymX = -span * .17, gymWidth = span * .58;
  box(gymX, 2, 20.25, gymWidth, .15, 4.7, c.steel);
  for (const x of [gymX - gymWidth / 2 + .45, gymX + gymWidth / 2 - .45]) {
    box(x, 2.15, 20.25, .6, 4.5, 3.8, c.steel);
  }
  box(gymX, 6.6, 20.25, gymWidth + .6, .45, 5, c.mint);
  for (const side of [-1, 1]) {
    box(gymX + side * gymWidth * .31, 2.2, 18.25, gymWidth * .3, 3.8, .14, c.water, true);
    box(gymX + side * 1.25, 2.15, 18.25, .18, 3.9, .25, c.line);
  }
  box(gymX, 6.95, 20.25, 6.5, .45, .55, c.line);
  for (const side of [-1, 1]) {
    box(gymX + side * 2.7, 6.45, 20.25, .8, 1.5, 1.5, c.purple);
    box(gymX + side * 3.25, 6.65, 20.25, .35, 1.1, 1.1, c.line);
  }

  // Pull-up rig and squat station: upright silhouettes read above the low equipment.
  const rigX = -span * .35, squatX = -span * .14, benchX = span * .04;
  for (const x of [rigX - 2, rigX + 2]) {
    box(x, 2.15, 25.9, .3, 4.4, .35, c.mint);
    box(x, 2.15, 25.9, .8, .2, 2.9, c.steel);
  }
  box(rigX, 6.35, 25.9, 4.3, .25, .3, c.steel);
  box(rigX, 4.8, 26.9, 3.2, .2, .25, c.line);
  for (const x of [rigX - 1.5, rigX + 1.5]) box(x, 2.15, 26.9, .2, 2.7, .25, c.steel);

  const barbell = (x, y, z, length) => {
    box(x, y, z, length, .16, .18, c.line);
    for (const side of [-1, 1]) {
      box(x + side * (length / 2 - .4), y - .5, z, .45, 1.15, 1.15, c.steel);
      box(x + side * (length / 2 - .9), y - .35, z, .3, .85, .85, c.purple);
    }
  };
  for (const x of [squatX - 1.4, squatX + 1.4]) {
    box(x, 2.15, 25.9, .28, 3.4, .28, c.mint);
    box(x, 2.15, 26.1, .6, .18, 2.8, c.steel);
  }
  barbell(squatX, 4.6, 25.9, 4.6);
  box(benchX, 3, 26.6, 1.4, .4, 3.5, c.purple);
  for (const z of [25.4, 27.8]) box(benchX, 2.15, z, .9, .85, .35, c.steel);
  for (const x of [benchX - 1.6, benchX + 1.6]) box(x, 2.15, 25.4, .22, 2.5, .3, c.mint);
  barbell(benchX, 4.45, 25.4, 4.5);

  // Stretch deck and rolled-mat rack, next to a fruit / water nutrition kiosk.
  const yogaX = span * .31;
  box(yogaX, 2.15, 26.25, span * .23, .16, 5.3, c.leaf);
  for (const offset of [-1.4, 1.4]) {
    box(yogaX + offset, 2.31, 26.25, 1.5, .12, 3.8, offset < 0 ? c.purple : c.mint);
    box(yogaX + offset, 2.43, 24.7, 1.5, .3, .35, c.line);
  }
  const kioskX = span * .34, kioskWidth = span * .22;
  box(kioskX, 2, 20.3, kioskWidth, .15, 4.5, c.steel);
  box(kioskX, 2.15, 18.45, kioskWidth - .7, 2.9, .35, c.mint);
  for (const side of [-1, 1]) box(kioskX + side * (kioskWidth / 2 - .4), 2.15, 20.3, .3, 3.8, 3.9, c.steel);
  box(kioskX, 5.95, 20.3, kioskWidth + .5, .45, 4.8, c.fruit);
  box(kioskX, 3, 21.3, kioskWidth - .8, .3, 1.5, c.line);
  for (const offset of [-1.6, -.8, 0]) {
    box(kioskX + offset, 3.3, 21.3, .6, .55, .7, offset === -.8 ? c.leaf : c.fruit);
  }
  box(kioskX + 2, 3.3, 21.2, 1, 1.5, .9, c.water, true);
  box(kioskX + 2, 3.3, 21.8, .8, .35, .35, c.steel);
  box(kioskX + 2, 4.8, 21.2, .8, .2, .8, c.line);

  // Three terracotta sprint lanes: long bright seams and staggered finish marks.
  box(0, 2, 31.6, span - 1.4, .14, 4.4, c.track);
  for (const z of [29.65, 30.95, 32.25, 33.55]) box(0, 2.14, z, span - 1.7, .035, .09, c.line);
  for (let lane = 0; lane < 3; lane++) {
    const z = 30.3 + lane * 1.3;
    box(-span / 2 + 2.5 + lane * .55, 2.14, z, .12, .035, 1.2, c.line);
    for (let tile = 0; tile < 4; tile++) {
      box(span / 2 - 3 + tile * .45, 2.14, z + (tile % 2 ? .3 : -.3), .4, .035, .6, c.line);
    }
  }
  if (typeof tree === 'function') {
    for (const x of [-span / 2 + 2, span / 2 - 2]) tree(group, x, 20.3, .55);
  }
  return true;
}
