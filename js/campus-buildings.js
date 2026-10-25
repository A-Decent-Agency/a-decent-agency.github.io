import * as THREE from 'three';

function block(group, x, y, z, w, h, d, color, glass = false) {
  group.userData.buildingBlocks.push({ x, y: y + h / 2, z, w, h, d, color, glass });
}
function batchBlocks(group) {
  for (const glass of [false, true]) {
    const blocks = group.userData.buildingBlocks.filter(block => block.glass === glass);
    if (!blocks.length) continue;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: glass, opacity: glass ? .68 : 1 }), blocks.length);
    const transform = new THREE.Object3D();
    for (const [index, block] of blocks.entries()) {
      transform.position.set(block.x, block.y, block.z);
      transform.scale.set(block.w, block.h, block.d); transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix); mesh.setColorAt(index, new THREE.Color(block.color));
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere(); group.add(mesh);
  }
  delete group.userData.buildingBlocks;
}
function tree(group, x, z, size = 1) {
  block(group, x, 1, z, .7, 3 * size, .7, '#6d4c43');
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.7 * size, 0), new THREE.MeshLambertMaterial({ color: '#3d987d' }));
  crown.position.set(x, 5 * size, z); group.add(crown);
}
function terrace(group, width, y, color) {
  block(group, 0, y, 0, width + 3, 1.1, 24, '#e6d8be');
  block(group, 0, y + 1.1, 0, width, .8, 21, color);
  for (const x of [-width / 2 + 3, width / 2 - 3]) {
    const planter = new THREE.Mesh(new THREE.IcosahedronGeometry(2, 0), new THREE.MeshLambertMaterial({ color: '#42b88e' }));
    planter.position.set(x, y + 3, 7); group.add(planter);
  }
}
export function buildCampus(group, site, model) {
  group.userData.buildingBlocks = [];
  const color = site.project?.color || '#8ba3bd', width = model.width;
  block(group, 0, 1, 0, width + 12, .9, 35, '#435566');
  block(group, 0, 2, 15, width + 10, .5, 5, '#d0c8ae');
  for (const x of [-width / 2 - 4, width / 2 + 4]) tree(group, x, 10);
  for (let floor = 0; floor < model.floors; floor++) {
    const h = model.height / model.floors, y = 2 + floor * h;
    const delivered = floor < model.deliveredFloors;
    const tint = delivered ? color : '#60748b';
    const w = Math.max(10, width - floor * (model.form === 'tower' ? 1.8 : model.form === 'foundation' ? 5 : 0));
    block(group, 0, y, 0, w, h - .6, 20, tint, true);
    terrace(group, w, y + h - .6, model.form === 'foundation' ? '#326e53' : '#3e4c67');
    for (let x = -w / 2 + 2; x < w / 2; x += 5) {
      block(group, x, y + 2, 10.2, 2, Math.max(1, h - 4), .2, delivered ? '#fae5a0' : '#87e0e3');
    }
  }
  if (model.form === 'tower') {
    // Stage canopy, equalizer roofline and a plaza make the music campus recognizable.
    block(group, 0, 2, 24, width + 7, 2, 10, '#6a4c75');
    for (let x = -width / 2; x <= width / 2; x += 4) {
      block(group, x, model.height + 3, 0, 2, 3 + Math.abs(Math.sin(x)) * 9, 3, color);
    }
    block(group, 0, 11, 23, width + 10, 1, 13, color);
    for (const x of [-width / 2, width / 2]) block(group, x, 3, 23, 1, 9, 1, '#ecd6af');
  } else if (model.form === 'hall') {
    const gateway = site.project.repository.endsWith('/DecentHead');
    if (gateway) {
      for (const x of [-width / 2, width / 2]) block(group, x, 2, 0, 4, model.height + 8, 24, color);
      block(group, 0, model.height + 7, 0, width + 5, 3, 26, color);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(5, .65, 6, 24), new THREE.MeshLambertMaterial({ color: '#f4e4ac' }));
      ring.position.set(0, model.height + 10, 2); group.add(ring);
    } else {
      for (let x = -width / 2 + 3; x < width / 2; x += 7) {
        block(group, x, 4, 17, 6, 1, 8, '#e9af79');
        block(group, x, 2.5, 19, 5, 1.5, 2, '#825678');
        block(group, x - 2, 2, 20, .4, 3, .4, '#e7dcc1');
      }
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, width * .6, 7, 4), new THREE.MeshLambertMaterial({ color: '#8b5778' }));
      roof.scale.z = .55; roof.rotation.y = Math.PI / 4; roof.position.y = model.height + 6; group.add(roof);
    }
  } else if (model.form === 'foundation') {
    for (let i = 0; i < 4; i++) tree(group, -width / 2 + 4 + i * (width - 8) / 3, -15, 1.2);
  } else if (model.form === 'entrance') {
    for (const x of [-width / 2, width / 2]) block(group, x, 2, 0, 2, 22, 3, color);
    block(group, 0, 23, 0, width + 5, 2, 4, color);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color, transparent: true, opacity: .65 }));
    dome.position.set(0, 9, -3); group.add(dome);
  } else {
    block(group, 0, 2, 0, width * .7, .4, 18, '#386b8a');
    for (let x = -width / 3; x <= width / 3; x += 6) block(group, x, 2, 0, .35, .45, 18, '#98cadd');
    if (model.form === 'staging') {
      for (const x of [-9, 9]) {
        const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#bd9bd5', wireframe: true }));
        dome.position.set(x, 2, 0); group.add(dome);
      }
    }
  }
  // Work in progress occupies a separate service yard, never the delivered version floors.
  const messy = model.messy;
  if (messy) {
    const x = width / 2 + 14;
    for (let i = 0; i < Math.min(8, Math.max(2, model.remaining.length)); i++) {
      block(group, x + (i % 2) * 5, 2, -10 + Math.floor(i / 2) * 5, 3.5, 2 + i % 3, 3.5, i % 2 ? '#b17c51' : '#7c86a7');
    }
    for (let y = 2; y < 18; y += 5) {
      block(group, x + 2, y, 8, 13, .4, 9, '#deba78');
      for (const side of [-1, 1]) block(group, x + 2 + side * 6, 2, 8, .4, 18, .4, '#deba78');
    }
    for (let z = -15; z <= 20; z += 7) block(group, x + 12, 2, z, .7, 2, 5, '#e6a15b');
  } else {
    for (const x of [-width / 2, 0, width / 2]) tree(group, x, -19, .8);
  }
  batchBlocks(group);
}
