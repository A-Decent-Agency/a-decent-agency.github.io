import * as THREE from 'three';
import { COLORS } from './model.js';
import { constructionSites, routePoint, flightStep, FLIGHT_BOUNDS } from './construction-model.js';
import { siteIdentity, PROJECT_MURALS } from './site-identities.js';
import { campusStructure } from './project-campus.js';
import { buildCampus } from './campus-buildings.js';
import { campusConnections, campusPriority } from './campus-graph.js';

const lineMaterial = color => new THREE.LineBasicMaterial({ color });
function lines(points, color) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map(point => new THREE.Vector3(...point)));
  return new THREE.LineSegments(geometry, lineMaterial(color));
}
function crane(scale = 1) {
  const group = new THREE.Group(), points = [];
  const segment = (a, b) => points.push(a.map(n => n * scale), b.map(n => n * scale));
  segment([0, 0, 0], [0, 22, 0]); segment([2, 0, 0], [2, 22, 0]);
  for (let y = 0; y < 21; y += 3) {
    segment([0, y, 0], [2, y + 3, 0]); segment([2, y, 0], [0, y + 3, 0]);
  }
  segment([-8, 20, 0], [16, 20, 0]); segment([-8, 22, 0], [16, 22, 0]);
  segment([1, 25, 0], [16, 20, 0]); segment([1, 25, 0], [-8, 20, 0]);
  segment([12, 20, 0], [12, 8, 0]); segment([11, 8, 0], [13, 8, 0]);
  for (let x = -8; x < 15; x += 3) segment([x, 20, 0], [x + 3, 22, 0]);
  group.add(lines(points, '#e5c583')); return group;
}
function textSprite(text, color = '#eee9f6', size = 24) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.scale(.5, .5);
  ctx.fillStyle = '#100e1de8'; ctx.fillRect(0, 0, 1024, 160);
  ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.font = `bold ${text.length < 32 ? 56 : 35}px system-ui`;
  const words = text.split(/\s+/); let row = '', y = 58;
  for (const word of words) {
    if (ctx.measureText(`${row} ${word}`).width > 950 && row) { ctx.fillText(row, 512, y); row = word; y += 46; }
    else row += `${row ? ' ' : ''}${word}`;
    if (y > 104) break;
  }
  ctx.fillText(row, 512, y);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(size, size * 160 / 1024, 1); return sprite;
}
function sitePlanSprite(site) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 384;
    const ctx = canvas.getContext('2d');
    ctx.scale(.5, .5);
    ctx.fillStyle = '#172331'; ctx.fillRect(0, 0, 1024, 768);
    ctx.fillStyle = '#b8f3e6'; ctx.font = 'bold 42px system-ui';
    ctx.fillText('SITE PLAN / PUBLISHED JOBS', 32, 60);
    ctx.fillStyle = '#e3c78b'; ctx.font = '30px system-ui';
    ctx.fillText(`${site.title} / ${site.items.length} cards`, 32, 106);
    const columns = 3, rows = Math.max(1, Math.ceil(site.items.length / columns)), cellHeight = Math.min(155, 570 / rows);
    site.items.forEach((item, index) => {
      const x = 30 + index % columns * 325, y = 140 + Math.floor(index / columns) * cellHeight;
      ctx.fillStyle = COLORS[item.fields?.Status] || '#8ba3bd'; ctx.fillRect(x, y, 305, cellHeight - 12);
      ctx.fillStyle = '#15242d'; ctx.font = `bold ${Math.min(26, cellHeight * .28)}px system-ui`;
      ctx.fillText((item.fields?.Component || item.fields?.Workstream || 'Unmapped').slice(0, 20), x + 12, y + cellHeight * .32);
      ctx.font = `${Math.min(24, cellHeight * .24)}px system-ui`;
      ctx.fillText((item.fields?.Status || 'Unset').slice(0, 20), x + 12, y + cellHeight * .62);
      ctx.fillText((item.fields?.Priority || item.fields?.Horizon || 'Triage').slice(0, 24), x + 12, y + cellHeight * .84);
    });
    if (!site.items.length) { ctx.fillStyle = '#c5c3dd'; ctx.font = '34px system-ui'; ctx.fillText('Context site / jobs not yet mapped', 40, 250); }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
    sprite.scale.set(27, 20, 1); return sprite;
  }
export class ConstructionScene {
  constructor(container, { onSite, onFailure }) {
    this.container = container; this.onSite = onSite; this.sites = []; this.state = { progress: 0, x: 0, y: 0 };
    this.active = false; this.reduced = false; this.paused = false; this.keys = new Set();
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#100e1d');
    this.routeFog = new THREE.Fog('#100e1d', 400, 1600); this.scene.fog = this.routeFog;
    this.camera = new THREE.PerspectiveCamera(58, 1, .1, 20000);
    this.cameraMode = 'flight'; this.azimuth = .65; this.elevation = .7; this.zoom = 1;
    this.scene.add(new THREE.HemisphereLight('#d9e9ff', '#46415d', 2.2));
    const sun = new THREE.DirectionalLight('#ffe2b3', 2.5); sun.position.set(-80, 180, 100); this.scene.add(sun);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.append(this.renderer.domElement);
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute('aria-label', 'Construction flight. W or up arrow thrust, S or down arrow reverse, A D steer, Q E altitude, Shift boost. Space pauses. Select a destination for guided travel.');
    this.group = new THREE.Group(); this.scene.add(this.group);
    const shipPoints = [[0, 0, -4], [-2.7, -.6, 2.8], [0, .5, 1], [0, 0, -4], [2.7, -.6, 2.8], [0, .5, 1], [-2.7, -.6, 2.8], [2.7, -.6, 2.8]];
    this.ship = lines(shipPoints, '#71e6d0'); this.scene.add(this.ship);
    this.ship.scale.setScalar(1.7);
    const cockpit = new THREE.Mesh(new THREE.ConeGeometry(.7, 3, 4), new THREE.MeshBasicMaterial({ color: '#71e6d0', transparent: true, opacity: .35 }));
    cockpit.rotation.x = -Math.PI / 2; cockpit.position.set(0, .3, -.5); this.ship.add(cockpit);
    this.flame = lines([[-.7, 0, 2], [0, 0, 5.5], [0, 0, 5.5], [.7, 0, 2]], '#e5c583'); this.ship.add(this.flame);
    this.stars = new THREE.Group();
    const stars = [];
    for (let i = 0; i < 300; i++) stars.push(Math.sin(i * 127.1) * 350, Math.cos(i * 311.7) * 190, -i * 13);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
    this.stars.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#bba4e9', size: .6 }))); this.scene.add(this.stars);
    new ResizeObserver(() => this.resize()).observe(container);
    this.renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); this.setActive(false); onFailure('Flight context lost. All construction sites remain in the accessible list.'); });
    this.renderer.domElement.addEventListener('keydown', event => {
      const key = event.key.toLowerCase();
      if (key === ' ') { event.preventDefault(); this.setPaused(!this.paused); this.container.dispatchEvent(new CustomEvent('flightpause', { detail: this.paused })); return; }
      if (!['w', 's', 'a', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'shift'].includes(key)) return;
      event.preventDefault();
      if (!this.reduced && !this.paused) { this.keys.add(key); this.invalidate(); }
    });
    document.addEventListener('keyup', event => { if (this.keys.delete(event.key.toLowerCase())) this.invalidate(); });
    const release = () => { this.keys.clear(); this.stop(); this.invalidate(); };
    this.renderer.domElement.addEventListener('blur', release); window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.keys.clear(); this.stop(); } else this.invalidate(); });
    container.addEventListener('pointerdown', event => {
      this.down = { x: event.clientX, y: event.clientY, sx: this.state.x, sy: this.state.y };
      container.setPointerCapture(event.pointerId);
    });
    container.addEventListener('pointermove', event => {
      if (!this.down) return;
      if (this.cameraMode !== 'flight') {
        this.azimuth += (event.clientX - this.down.x) * .006;
        this.elevation = THREE.MathUtils.clamp(this.elevation + (event.clientY - this.down.y) * .004, .12, 1.5);
        this.down.x = event.clientX; this.down.y = event.clientY; this.down.dragged = true;
        this.invalidate(); return;
      }
      if (this.reduced || this.paused) return;
      this.target = null;
      this.state.x = THREE.MathUtils.clamp(this.down.sx + (event.clientX - this.down.x) / 7, -FLIGHT_BOUNDS.lateral, FLIGHT_BOUNDS.lateral);
      this.state.y = THREE.MathUtils.clamp(this.down.sy - (event.clientY - this.down.y) / 9, -FLIGHT_BOUNDS.vertical, FLIGHT_BOUNDS.vertical);
      this.invalidate();
    });
    container.addEventListener('pointerup', event => {
      if (this.down && !this.down.dragged && Math.hypot(event.clientX - this.down.x, event.clientY - this.down.y) < 5) {
        const rect = container.getBoundingClientRect(), ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), this.camera);
        const hit = ray.intersectObjects(this.targets)[0];
        if (hit) this.goTo(hit.object.userData.index);
      }
      this.down = null;
    });
    container.addEventListener('pointercancel', () => { this.down = null; });
    container.addEventListener('lostpointercapture', () => { this.down = null; });
    container.addEventListener('wheel', event => {
      event.preventDefault(); this.zoom = THREE.MathUtils.clamp(this.zoom * (event.deltaY > 0 ? 1.1 : .9), .45, 3); this.invalidate();
      this.container.dispatchEvent(new CustomEvent('camerazoom', { detail: this.zoom }));
    }, { passive: false });
  }
  clear() {
    this.group.traverse(object => {
      if (object.isInstancedMesh) object.dispose();
      object.geometry?.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) { material?.map?.dispose(); material?.dispose(); }
    });
    this.group.clear();
  }
  setData(items, tab, page, links, feed, options) {
    const previous = this.sites[this.selected]?.id;
    this.clear(); this.sites = constructionSites(items, options); this.targets = []; this.signals = []; this.campuses = new Map();
    this.connections = campusConnections(this.sites, feed);
    this.keys.clear(); this.target = null;
    this.sites.forEach(site => {
      const campus = new THREE.Group(); campus.position.set(site.position.x + (site.index % 2 ? 77 : -77), site.position.y - 22, site.position.z);
      if (site.project) this.campuses.set(site.project.repository.toLowerCase(), campus);
      const color = site.blocked ? COLORS.Blocked : site.active ? COLORS['In Progress'] : site.done === site.total ? COLORS.Done : COLORS.Todo;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(27 * site.scale, 27 * site.scale, 1, 6), new THREE.MeshBasicMaterial({ color: '#211a30' }));
      pad.userData.index = site.index; campus.add(pad); this.targets.push(pad);
      const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 6 }, (_, index) => {
        const a = index / 6 * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * 16 * site.scale, .7, Math.sin(a) * 16 * site.scale);
      })), lineMaterial(color)); campus.add(ring);
      const structure = campusStructure(site, feed), tint = site.project?.color || color;
      if (site.project) {
        buildCampus(campus, site, structure);
        site.visibleCranes = structure.buildCranes;
        const plan = sitePlanSprite(site); plan.position.set(-structure.width / 2 - 16, 13, 18);
        plan.userData.index = site.index; this.targets.push(plan); campus.add(plan);
        const crown = textSprite(site.project.milestone, tint, 62); crown.position.set(0, structure.height + 15, 0); campus.add(crown);
        if (structure.form === 'entrance') {
          const billboard = textSprite('DECENT AGENCY / PLANNING OFFICE', '#71e6d0', 76);
          billboard.position.set(0, 30, 12); campus.add(billboard);
        }
      } else {
        campus.add(lines([[-18, 1, -10], [18, 1, -10], [18, 1, -10], [18, 1, 10],
          [18, 1, 10], [-18, 1, 10], [-18, 1, 10], [-18, 1, -10]], tint));
        const blueprint = new THREE.Mesh(new THREE.PlaneGeometry(26, 15), new THREE.MeshBasicMaterial({ color: '#294c69', side: THREE.DoubleSide }));
        blueprint.rotation.x = -Math.PI / 2; blueprint.position.y = 1; campus.add(blueprint);
        for (let x = -20; x <= 20; x += 8) {
          const barrier = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 1), new THREE.MeshBasicMaterial({ color: '#e5a65b' }));
          barrier.position.set(x, 2, 16); campus.add(barrier);
        }
      }
      for (let i = 0; i < (site.visibleCranes ?? site.cranes); i++) {
        const tower = crane(.65 + site.scale * .2), angle = i / Math.max(1, site.cranes) * Math.PI * 2;
        tower.position.set(site.project ? structure.width / 2 + 17 : Math.cos(angle) * 12 * site.scale, 1, Math.sin(angle) * 12 * site.scale);
        tower.rotation.y = angle; campus.add(tower);
      }
      if (site.project ? structure.messy : site.phase !== 'Handover') for (const side of [-1, 1]) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(.6, 1.8, 6), new THREE.MeshBasicMaterial({ color: site.blocked ? '#ee92af' : '#e5a65b' }));
        cone.position.set(side * 8, 1.7, 12 * site.scale); campus.add(cone);
      }
      const title = textSprite(`${site.project ? 'EXIT ' + (site.index + 1) : site.type === 'milestone' ? 'MILESTONE' : 'WORKSTREAM'} / ${site.title}`, tint, site.project ? 80 : 52);
      title.position.set(0, site.project ? -4 : 32, 22); title.userData.index = site.index; this.targets.push(title); campus.add(title);
      const count = textSprite(`${site.visibleCranes ?? site.cranes} BUILD CRANES / ${site.active} ACTIVE / ${site.done} DONE / ${site.total} CARDS`, '#e5c583', 40);
      count.position.set(0, -10, 22); campus.add(count);
      const identity = siteIdentity(site);
      const sign = textSprite(identity.projects.length
        ? `PUBLIC REPO REFERENCES / ${identity.projects.map(project => project.name).join(' / ')}`
        : identity.kind === 'milestone' ? 'MILESTONE / NOT A REPOSITORY' : 'WORKSTREAM / NO PROJECT IDENTITY ESTABLISHED',
      identity.fallback.color, 34);
      sign.position.set(0, site.project ? -16 : 27, 0); campus.add(sign);
      if (site.start || site.target) {
        const dates = textSprite(`${site.start || 'UNSET'}  >  ${site.target || 'UNSET'} / TENTATIVE`, '#a89eb9', 33);
        dates.position.set(0, 37, 0); campus.add(dates);
      }
      this.group.add(campus);
      if (site.project) {
        if (structure.observation) {
          const observation = structure.observation;
          const label = observation.state !== 'available' ? 'GITHUB OBSERVATION UNAVAILABLE'
            : observation.release ? `RELEASE / ${observation.release.tag}` : 'PUBLIC GITHUB ACTIVITY / OBSERVED';
          const activity = textSprite(label, observation.state === 'available' ? '#71e6d0' : '#ee92af', 38);
          activity.scale.multiplyScalar(1.4);
          activity.position.set(0, structure.height + 24, 0); campus.add(activity);
        }
        const from = new THREE.Vector3(site.position.x, site.position.y - 18, site.position.z + 35);
        const to = campus.position.clone().add(new THREE.Vector3(0, 2, 24));
        const curve = new THREE.QuadraticBezierCurve3(from, new THREE.Vector3(to.x, from.y, from.z), to);
        this.addSignal(curve, tint);
        const exit = textSprite(`${site.index + 1} / ${site.title}  >>`, tint, 48);
        exit.position.copy(from).add(new THREE.Vector3(0, 10, 0)); this.group.add(exit);
        const identity = siteIdentity(site);
        const mural = PROJECT_MURALS[site.project.repository];
        if (identity.artwork) {
          const textureURL = identity.artwork.url.endsWith('.svg') && mural ? mural.url : identity.artwork.url;
          new THREE.TextureLoader().load(textureURL, texture => {
            if (!campus.parent) { texture.dispose(); return; }
            texture.colorSpace = THREE.SRGBColorSpace;
            const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
            sign.scale.set(24, 24, 1); sign.position.set(0, structure.height + 44, 0); campus.add(sign); this.invalidate();
          }, undefined, () => {
            if (campus.parent) this.container.dispatchEvent(new CustomEvent('artworkerror', { detail: `${site.title}: artwork unavailable; project sign retained.` }));
          });
        }
        if (mural) new THREE.TextureLoader().load(mural.url, texture => {
          if (!campus.parent) { texture.dispose(); return; }
          texture.colorSpace = THREE.SRGBColorSpace;
          const poster = new THREE.Mesh(new THREE.PlaneGeometry(22, 16), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
          poster.position.set(0, 10, 30); campus.add(poster); this.invalidate();
        }, undefined, () => {
          if (campus.parent) this.container.dispatchEvent(new CustomEvent('artworkerror', { detail: `${site.title}: mural unavailable; project sign retained.` }));
        });
      }
      const gate = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 48 }, (_, i) => {
        const a = i / 48 * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * 27, Math.sin(a) * 19, 0);
      })), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .35 }));
      gate.position.set(site.position.x, site.position.y, site.position.z); this.group.add(gate);
    });
    const route = [];
    for (let n = 0; n <= Math.max(0, this.sites.length - 1) * 10; n++) { const p = routePoint(n / 10); route.push(new THREE.Vector3(p.x, p.y - 18, p.z)); }
    if (route.length > 1) {
      for (const offset of [-12, 12]) {
        this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(route.map(p => p.clone().add(new THREE.Vector3(offset, 0, 0)))), lineMaterial('#596d95')));
      }
      this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(route), new THREE.LineDashedMaterial({ color: '#71e6d0', dashSize: 3, gapSize: 4 })));
    }
    this.group.children.at(-1)?.computeLineDistances?.();
    for (const link of this.connections) {
      const fromSite = this.sites.find(site => site.id === link.from), toSite = this.sites.find(site => site.id === link.to);
      const a = fromSite?.project ? this.campuses.get(fromSite.project.repository.toLowerCase()) : null;
      const b = toSite?.project ? this.campuses.get(toSite.project.repository.toLowerCase()) : null;
      const from = (a?.position || new THREE.Vector3(fromSite.position.x, fromSite.position.y - 20, fromSite.position.z)).clone().add(new THREE.Vector3(0, 12, 0));
      const to = (b?.position || new THREE.Vector3(toSite.position.x, toSite.position.y - 20, toSite.position.z)).clone().add(new THREE.Vector3(0, 12, 0));
      const color = campusPriority(fromSite) === 'Blocked' || campusPriority(toSite) === 'Blocked' ? '#ee92af' : link.proposed ? '#b297da' : '#71e6d0';
      this.addSignal(new THREE.QuadraticBezierCurve3(from, from.clone().lerp(to, .5).add(new THREE.Vector3(0, 42, 0)), to), color, link);
    }
    this.selected = Math.max(0, this.sites.findIndex(site => site.id === previous));
    this.state = { progress: this.selected, x: 0, y: 0 }; this.onSite(this.sites[this.selected], this.selected);
    this.highlightSite(this.sites[this.selected]?.id);
    this.invalidate();
  }
  addSignal(curve, color, link = null) {
    const material = link?.proposed ? new THREE.LineDashedMaterial({ color, dashSize: 5, gapSize: 6, transparent: true, opacity: .3 })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity: .45 });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(30)), material);
    line.computeLineDistances(); this.group.add(line);
    const packet = new THREE.Mesh(new THREE.SphereGeometry(1.1, 6, 6), new THREE.MeshBasicMaterial({ color }));
    this.group.add(packet); this.signals.push({ curve, packet, line, link });
  }
  setCamera(mode) {
    this.cameraMode = mode; this.keys.clear(); this.target = null; this.invalidate();
  }
  setZoom(value) { this.zoom = Number(value); this.invalidate(); }
  highlightTask(id) {
    const site = this.sites.find(site => site.items.some(item => item.id === id));
    this.highlightSite(site?.id);
  }
  highlightSite(id) {
    this.highlighted = id;
    this.container.dataset.focusedCampus = id || '';
    for (const signal of this.signals) {
      const selected = signal.link && [signal.link.from, signal.link.to].includes(id);
      signal.line.material.opacity = selected ? 1 : .18;
      signal.packet.scale.setScalar(selected ? 2 : .75);
    }
    this.invalidate();
  }
  goTo(index) {
    if (!this.sites.length) return;
    const at = Math.max(0, Math.min(this.sites.length - 1, index));
    this.selected = at; this.keys.clear(); this.onSite(this.sites[at], at);
    this.highlightSite(this.sites[at].id);
    if (this.reduced || this.paused) { this.state = { progress: at, x: 0, y: 0 }; this.target = null; }
    else this.target = at;
    this.invalidate();
  }
  reset() { this.goTo(0); }
  hold(key, value) { if (value && !this.paused && !this.reduced && this.active) this.keys.add(key); else this.keys.delete(key); this.invalidate(); }
  setPaused(value) { this.paused = value; this.keys.clear(); this.target = null; this.stop(); this.invalidate(); }
  setMotion(reduced) { this.reduced = reduced; this.keys.clear(); this.target = null; this.stop(); this.invalidate(); }
  setActive(active) { this.active = active; this.renderer.domElement.hidden = !active; this.keys.clear(); this.stop(); if (active) this.resize(); }
  resize() {
    const width = this.container.clientWidth, height = this.container.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false); this.invalidate();
  }
  stop() { if (this.frame) cancelAnimationFrame(this.frame); clearTimeout(this.timer); this.frame = this.timer = null; this.last = 0; }
  invalidate() {
    clearTimeout(this.timer); this.timer = null;
    if (this.active && !document.hidden && !this.frame) this.frame = requestAnimationFrame(time => this.tick(time));
  }
  tick(time) {
    this.frame = null;
    if (!this.active || document.hidden) return;
    const dt = this.last ? Math.min(.05, (time - this.last) / 1000) : 1 / 30; this.last = time;
    const steering = [...this.keys].some(key => key !== 'shift');
    if (!this.reduced && !this.paused) {
      if (steering) { this.target = null; this.state = flightStep(this.state, this.keys, dt, this.sites.length); }
      else if (this.target !== null && this.target !== undefined) {
        const delta = this.target - this.state.progress, step = dt * (this.keys.has('shift') ? 2.8 : 1.4);
        this.state.progress += Math.sign(delta) * Math.min(Math.abs(delta), step);
        this.state.x *= .9; this.state.y *= .9;
        if (Math.abs(delta) <= step) this.target = null;
      }
    }
    const nearest = Math.round(this.state.progress);
    if (this.target == null && nearest !== this.selected) { this.selected = nearest; this.onSite(this.sites[nearest], nearest); this.highlightSite(this.sites[nearest]?.id); }
    const point = routePoint(this.state.progress), ahead = routePoint(this.state.progress + .5);
    for (const [index, signal] of (this.signals || []).entries()) {
      const t = this.reduced || this.paused ? .5 : (time / 4200 + index * .17) % 1;
      signal.packet.position.copy(signal.curve.getPoint(index % 2 ? 1 - t : t));
    }
    this.ship.position.set(point.x + this.state.x, point.y + this.state.y, point.z + 27);
    this.ship.rotation.z = (Number(this.keys.has('a')) - Number(this.keys.has('d'))) * .4;
    this.flame.visible = steering || this.target != null;
    this.scene.fog = this.cameraMode === 'universe' ? null : this.routeFog;
    if (this.cameraMode === 'universe') {
      const length = Math.max(300, (this.sites.length - 1) * FLIGHT_BOUNDS.spacing);
      this.camera.up.set(0, 0, -1);
      this.camera.position.set(0, length * this.zoom, -length / 2);
      this.camera.lookAt(0, -20, -length / 2);
    } else if (this.cameraMode === 'flight') {
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(point.x + this.state.x * .65, point.y + this.state.y * .7 + 62 * this.zoom, point.z + 170 * this.zoom);
      this.camera.lookAt(ahead.x + this.state.x * .35 - 25, ahead.y + this.state.y * .35, ahead.z - 35);
    } else {
      const site = this.sites[this.selected], center = site?.position || point;
      const target = new THREE.Vector3(center.x + (site?.index % 2 ? 77 : -77), center.y, center.z);
      const top = this.cameraMode === 'top', elevation = top ? Math.PI / 2 : this.elevation;
      const radius = 190 * this.zoom;
      this.camera.up.set(0, top ? 0 : 1, top ? -1 : 0);
      this.camera.position.copy(target).add(new THREE.Vector3(Math.sin(this.azimuth) * Math.cos(elevation) * radius, Math.sin(elevation) * radius, Math.cos(this.azimuth) * Math.cos(elevation) * radius));
      this.camera.lookAt(target);
    }
    this.renderer.render(this.scene, this.camera);
    if (!this.paused && !this.reduced && (steering || this.target != null || this.signals?.length)) this.timer = setTimeout(() => { this.timer = null; this.invalidate(); }, 1000 / (steering || this.target != null ? 30 : 12));
  }
}
