import * as THREE from 'three';

export const MAX_FLIGHTS = 6;
const SILVER = '#c9dce6', BLUE = '#5abfff', GREEN = '#64dfb0', GOLD = '#f2d168';
export const MANDELBLUM_SOURCE = 'https://raw.githubusercontent.com/TheJollyLaMa/DecentVoyager/fdac2a68dd587ec82ebca43eab59f154946209ea/src/assets/game/rock-1.png';

function box(group, x, y, z, w, h, d, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color }));
  mesh.position.set(x, y + h / 2, z); group.add(mesh); return mesh;
}

function fighter(color = BLUE) {
  const ship = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5, 4), new THREE.MeshBasicMaterial({ color: SILVER }));
  body.rotation.x = -Math.PI / 2; ship.add(body);
  box(ship, 0, 0, 1, 7, .35, 2.2, color);
  box(ship, 0, .6, -.2, 1, .6, 1.4, GOLD);
  for (const x of [-1.6, 1.6]) box(ship, x, 0, 2.4, .5, .5, 3, GREEN);
  return ship;
}

export function buildVoyagerSpaceport(campus, model, { invalidate = () => {}, onError = () => {} } = {}) {
  let disposed = false;
  const group = new THREE.Group(); group.name = 'voyager-spaceport'; campus.add(group);
  const runway = new THREE.Group(); runway.name = 'voyager-runway'; group.add(runway);
  box(runway, 0, 1.2, 43, 21, .8, 56, '#142d40');
  for (const x of [-10.5, 10.5]) box(runway, x, 1.9, 43, .5, .3, 56, BLUE);
  for (let z = 20; z < 70; z += 7) {
    box(runway, 0, 1.8, z, .6, .2, 3, SILVER);
    for (const x of [-8.7, 8.7]) box(runway, x, 2, z, .8, .4, .8, z < 35 ? GREEN : GOLD);
  }
  for (const side of [-1, 1]) {
    box(group, side * 19, 1.5, 27, 13, 9, 17, '#25495b');
    box(group, side * 19, 5.2, 35.6, 10, 5.5, .4, '#091721');
    box(group, side * 19, 11, 27, 14, .8, 19, SILVER);
    box(group, side * 19, 8, 35.9, 10, .45, .5, GREEN);
    const parked = fighter(side < 0 ? BLUE : GREEN); parked.position.set(side * 19, 3.2, 29);
    parked.scale.setScalar(.7); group.add(parked);
  }
  const tower = new THREE.Group(); tower.name = 'voyager-control-tower'; group.add(tower);
  tower.position.set(-34, 0, 43);
  box(tower, 0, 1.5, 0, 5, model.baseHeight + 10, 5, SILVER);
  box(tower, 0, model.baseHeight + 11, 0, 11, 4, 9, '#1a5367');
  box(tower, 0, model.baseHeight + 15, 0, 13, .8, 11, GOLD);
  const radar = new THREE.Mesh(new THREE.TorusGeometry(3, .25, 4, 16), new THREE.MeshBasicMaterial({ color: GREEN }));
  radar.name = 'voyager-radar'; radar.position.set(0, model.baseHeight + 20, 0); tower.add(radar);
  const flights = Array.from({ length: MAX_FLIGHTS }, () => {
    const ship = fighter(); ship.visible = false; group.add(ship);
    return { ship, age: 0, kind: null };
  });
  const rocks = Array.from({ length: 3 }, (_, index) => {
    const rock = new THREE.Group(); rock.name = 'voyager-mandelblum';
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.5, 0), new THREE.MeshBasicMaterial({ color: index % 2 ? GREEN : SILVER, wireframe: true }));
    rock.add(core);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#b5e8e2', transparent: true }));
    sprite.visible = false;
    sprite.scale.setScalar(8 + index * 2); rock.add(sprite); group.add(rock);
    return { object: rock, sprite, phase: index * 17 };
  });
  const texture = new THREE.TextureLoader().load(MANDELBLUM_SOURCE, loaded => {
    if (disposed) { loaded.dispose(); return; }
    loaded.colorSpace = THREE.SRGBColorSpace;
    for (const rock of rocks) { rock.sprite.material.map = loaded; rock.sprite.material.needsUpdate = true; rock.sprite.visible = true; }
    invalidate();
  }, undefined, () => {
    if (!disposed) onError('Mandelblum artwork unavailable; faceted fallback retained.');
  });
  // Keep the texture in the scene's existing traversal-based resource cleanup even before it loads.
  for (const rock of rocks) rock.sprite.material.map = texture;
  const fragments = Array.from({ length: 6 }, (_, index) => {
    const mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(.7 + index * .12), new THREE.MeshBasicMaterial({ color: index % 2 ? SILVER : GREEN }));
    mesh.name = 'voyager-fragment'; group.add(mesh); return mesh;
  });
  const lasers = Array.from({ length: 2 }, (_, index) => {
    const mesh = box(group, 0, 0, 0, .22, .22, 9, index ? GOLD : BLUE);
    mesh.name = 'voyager-stray-laser'; return mesh;
  });
  let elapsed = 0, launchWait = 0, nextKind = 'arrival';
  const queued = { arrival: 0, departure: 0 }, observed = { arrival: 0, departure: 0 };
  function enqueue(kind, count) {
    if (!Object.hasOwn(queued, kind) || !Number.isSafeInteger(count) || count < 0 ||
        !Number.isSafeInteger(queued[kind] + count)) throw new Error('Invalid Voyager traffic count');
    queued[kind] += count; observed[kind] += count;
    invalidate();
  }
  function update(dt, moving) {
    if (!moving) return;
    elapsed += dt;
    radar.rotation.y = elapsed * .5;
    launchWait = Math.max(0, launchWait - dt);
    for (const flight of flights) {
      if (!flight.kind && launchWait === 0 && (queued.arrival || queued.departure)) {
        const kind = queued[nextKind] ? nextKind : nextKind === 'arrival' ? 'departure' : 'arrival';
        queued[kind]--; nextKind = kind === 'arrival' ? 'departure' : 'arrival';
        flight.kind = kind; flight.age = 0; flight.ship.visible = true; launchWait = 1.2;
        flight.ship.userData.trafficKind = kind;
      }
      if (!flight.kind) continue;
      flight.age += dt;
      const progress = Math.min(1, flight.age / 8);
      const t = flight.kind === 'arrival' ? 1 - progress : progress;
      flight.ship.position.set(Math.sin(t * Math.PI) * (flight.kind === 'arrival' ? -18 : 18), 4 + t * t * 70, 27 + t * 165);
      flight.ship.rotation.y = flight.kind === 'arrival' ? 0 : Math.PI;
      flight.ship.rotation.z = Math.sin(progress * Math.PI * 2) * .15;
      if (progress === 1) { flight.kind = null; flight.ship.visible = false; }
    }
    for (const [index, rock] of rocks.entries()) {
      const phase = (elapsed + rock.phase) % 70;
      rock.object.visible = phase < 24;
      rock.object.position.set(-90 + phase * 7.5, model.baseHeight + 38 + index * 12, -30 - index * 18);
      rock.object.rotation.z = elapsed * .12 + index;
    }
    for (const [index, fragment] of fragments.entries()) {
      const phase = (elapsed + index * 1.3) % 28;
      fragment.visible = phase < 6;
      fragment.position.set(82 - phase * 27, 23 + index * 3 - phase, 8 - index * 6);
      fragment.rotation.set(elapsed * .8, elapsed * .5, index);
    }
    for (const [index, laser] of lasers.entries()) {
      const phase = (elapsed + index * .3) % 23;
      laser.visible = phase > 10 && phase < 11.6;
      laser.position.set(-60 + (phase - 10) * 80, 38 + index * 8, 0);
      laser.rotation.y = Math.PI / 2;
    }
    group.userData.traffic = { ...observed, queued: queued.arrival + queued.departure,
      active: flights.filter(flight => flight.kind).length };
  }
  // Static reduced-motion scene: no fake reward departures or perpetual laser flashes.
  rocks.forEach((rock, index) => rock.object.position.set(-38 + index * 27, model.baseHeight + 45, -35));
  fragments.forEach(fragment => { fragment.visible = false; });
  lasers.forEach(laser => { laser.visible = false; });
  return { group, enqueue, update, dispose() { disposed = true; },
    snapshot: () => ({ queued: { ...queued }, observed: { ...observed }, active: flights.filter(flight => flight.kind).length }),
    drain() {
      const remaining = { ...queued };
      for (const flight of flights) if (flight.kind) remaining[flight.kind]++;
      return remaining;
    }
  };
}
