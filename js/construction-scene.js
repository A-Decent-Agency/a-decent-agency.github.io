import * as THREE from 'three';
import { COLORS } from './model.js';
import { constructionSites, routePoint, flightStep, FLIGHT_BOUNDS } from './construction-model.js';

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
  canvas.width = 1024; canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#100e1de8'; ctx.fillRect(0, 0, 1024, 160);
  ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.font = 'bold 35px system-ui';
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
export class ConstructionScene {
  constructor(container, { onSite, onFailure }) {
    this.container = container; this.onSite = onSite; this.sites = []; this.state = { progress: 0, x: 0, y: 0 };
    this.active = false; this.reduced = false; this.paused = false; this.keys = new Set();
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#100e1d');
    this.scene.fog = new THREE.Fog('#100e1d', 200, 850);
    this.camera = new THREE.PerspectiveCamera(58, 1, .1, 1200);
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
      if (!this.down || this.reduced || this.paused) return;
      this.target = null;
      this.state.x = THREE.MathUtils.clamp(this.down.sx + (event.clientX - this.down.x) / 7, -FLIGHT_BOUNDS.lateral, FLIGHT_BOUNDS.lateral);
      this.state.y = THREE.MathUtils.clamp(this.down.sy - (event.clientY - this.down.y) / 9, -FLIGHT_BOUNDS.vertical, FLIGHT_BOUNDS.vertical);
      this.invalidate();
    });
    container.addEventListener('pointerup', event => {
      if (this.down && Math.hypot(event.clientX - this.down.x, event.clientY - this.down.y) < 5) {
        const rect = container.getBoundingClientRect(), ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), this.camera);
        const hit = ray.intersectObjects(this.targets)[0];
        if (hit) this.goTo(hit.object.userData.index);
      }
      this.down = null;
    });
    container.addEventListener('pointercancel', () => { this.down = null; });
    container.addEventListener('lostpointercapture', () => { this.down = null; });
  }
  clear() {
    this.group.traverse(object => {
      object.geometry?.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) { material?.map?.dispose(); material?.dispose(); }
    });
    this.group.clear();
  }
  setData(items) {
    const previous = this.sites[this.selected]?.id;
    this.clear(); this.sites = constructionSites(items); this.targets = [];
    this.keys.clear(); this.target = null;
    this.sites.forEach(site => {
      const campus = new THREE.Group(); campus.position.set(site.position.x + (site.index % 2 ? 39 : -39), site.position.y - 12, site.position.z);
      const color = site.blocked ? COLORS.Blocked : site.active ? COLORS['In Progress'] : site.done === site.total ? COLORS.Done : COLORS.Todo;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(16 * site.scale, 16 * site.scale, 1, 6), new THREE.MeshBasicMaterial({ color: '#211a30' }));
      pad.userData.index = site.index; campus.add(pad); this.targets.push(pad);
      const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 6 }, (_, index) => {
        const a = index / 6 * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * 16 * site.scale, .7, Math.sin(a) * 16 * site.scale);
      })), lineMaterial(color)); campus.add(ring);
      const levels = site.phase === 'Handover' ? 4 : site.active ? 2 : 1;
      for (let i = 0; i < Math.min(site.total, 9); i++) {
        const height = (levels + i % 3) * 2;
        const building = new THREE.Mesh(new THREE.BoxGeometry(4, height, 4), new THREE.MeshBasicMaterial({ color, wireframe: true }));
        building.position.set((i % 3 - 1) * 6, height / 2 + 1, (Math.floor(i / 3) - 1) * 6); campus.add(building);
      }
      for (let i = 0; i < site.cranes; i++) {
        const tower = crane(.65 + site.scale * .2), angle = i / Math.max(1, site.cranes) * Math.PI * 2;
        tower.position.set(Math.cos(angle) * 12 * site.scale, 1, Math.sin(angle) * 12 * site.scale);
        tower.rotation.y = angle; campus.add(tower);
      }
      if (site.phase !== 'Handover') for (const side of [-1, 1]) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(.6, 1.8, 6), new THREE.MeshBasicMaterial({ color: site.blocked ? '#ee92af' : '#e5a65b' }));
        cone.position.set(side * 8, 1.7, 12 * site.scale); campus.add(cone);
      }
      const title = textSprite(`${site.type === 'milestone' ? 'MILESTONE' : 'WORKSTREAM'} / ${site.title}`, color, 39);
      title.position.set(0, 32, 0); title.userData.index = site.index; this.targets.push(title); campus.add(title);
      const count = textSprite(`${site.cranes} CRANES / ${site.active} ACTIVE / ${site.done} DONE / ${site.total} CARDS`, '#e5c583', 30);
      count.position.set(0, -3, 12); campus.add(count);
      if (site.start || site.target) {
        const dates = textSprite(`${site.start || 'UNSET'}  >  ${site.target || 'UNSET'} / TENTATIVE`, '#a89eb9', 33);
        dates.position.set(0, 37, 0); campus.add(dates);
      }
      this.group.add(campus);
      const gate = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 48 }, (_, i) => {
        const a = i / 48 * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * 27, Math.sin(a) * 19, 0);
      })), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .35 }));
      gate.position.set(site.position.x, site.position.y, site.position.z); this.group.add(gate);
    });
    const route = [];
    for (let n = 0; n <= Math.max(0, this.sites.length - 1) * 10; n++) { const p = routePoint(n / 10); route.push(new THREE.Vector3(p.x, p.y - 18, p.z)); }
    if (route.length > 1) this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(route), new THREE.LineDashedMaterial({ color: '#71e6d0', dashSize: 3, gapSize: 4 })));
    this.group.children.at(-1)?.computeLineDistances?.();
    this.selected = Math.max(0, this.sites.findIndex(site => site.id === previous));
    this.state = { progress: this.selected, x: 0, y: 0 }; this.onSite(this.sites[this.selected], this.selected);
    this.invalidate();
  }
  goTo(index) {
    if (!this.sites.length) return;
    const at = Math.max(0, Math.min(this.sites.length - 1, index));
    this.selected = at; this.keys.clear(); this.onSite(this.sites[at], at);
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
    if (this.target == null && nearest !== this.selected) { this.selected = nearest; this.onSite(this.sites[nearest], nearest); }
    const point = routePoint(this.state.progress), ahead = routePoint(this.state.progress + .5);
    this.ship.position.set(point.x + this.state.x, point.y + this.state.y, point.z + 27);
    this.ship.rotation.z = (Number(this.keys.has('a')) - Number(this.keys.has('d'))) * .4;
    this.flame.visible = steering || this.target != null;
    this.camera.position.set(point.x + this.state.x * .65, point.y + this.state.y * .7 + 11, point.z + 85);
    this.camera.lookAt(ahead.x + this.state.x * .35, ahead.y + this.state.y * .35, ahead.z - 25);
    this.renderer.render(this.scene, this.camera);
    if (!this.paused && !this.reduced && (steering || this.target != null)) this.timer = setTimeout(() => { this.timer = null; this.invalidate(); }, 1000 / 30);
  }
}
