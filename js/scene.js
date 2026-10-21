import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { COLORS, ROLE_COLORS, STATUS, dateNumber, relationships } from './model.js';

function rounded(ctx, x, y, width, height, radius) { ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); }
function wrap(ctx, text, maxWidth, maxLines = 2) {
  const lines = []; let line = '';
  for (const word of text.split(/\s+/)) {
    if (ctx.measureText(`${line} ${word}`).width > maxWidth && line) { lines.push(line); line = word; } else line += (line ? ' ' : '') + word;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].slice(0, -2) + '…'; }
  return lines;
}
function cardTexture(item, color) {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 224;
  const ctx = canvas.getContext('2d');
  rounded(ctx, 2, 2, 764, 220, 12); ctx.fillStyle = '#211a30'; ctx.fill(); ctx.strokeStyle = color + '75'; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); rounded(ctx, 2, 2, 764, 220, 12); ctx.clip(); ctx.fillStyle = color; ctx.fillRect(2, 2, 5, 220); ctx.restore();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(28, 29, 4, 0, 7); ctx.fill();
  ctx.font = '500 23px system-ui'; ctx.fillStyle = '#c0afcf';
  ctx.fillText(String(item.fields?.Kind || item.kind || 'ITEM').toUpperCase(), 44, 36);
  ctx.font = '500 38px system-ui'; ctx.fillStyle = '#eee8f7';
  wrap(ctx, item.title.replace(/^Portfolio:\s*/, ''), 704, 2).forEach((line, i) => ctx.fillText(line, 26, 85 + i * 42));
  ctx.strokeStyle = '#b79ddc25';ctx.beginPath();ctx.moveTo(26,157);ctx.lineTo(740,157);ctx.stroke();
  ctx.font = '22px system-ui'; ctx.fillStyle = '#a194b5';
  const footer = item.fields?.Workstream || item.fields?.Role || item.fields?.Status || 'YOUR OWN CORNER OF POSSIBILITY';
  ctx.fillText(footer.length > 54 ? footer.slice(0, 51) + '…' : footer, 26, 194);
  ctx.fillStyle = color; ctx.fillText('↗', 710, 194);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
function labelTexture(text, color = '#b7a7ce', width = 1024) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = 90;
  const ctx = canvas.getContext('2d');ctx.font = '500 46px system-ui';ctx.fillStyle = color;ctx.textAlign = 'center';ctx.fillText(text, width / 2, 56);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

export class OfficeScene {
  constructor(container, { onSelect, onHover, onMove, onFailure }) {
    this.container = container; this.onSelect = onSelect; this.onHover = onHover; this.onMove = onMove;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#100e1b');
    this.camera = new THREE.OrthographicCamera(-60, 60, 35, -35, .1, 1200);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.append(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); this.stop(); onFailure('3D context lost. Your cards are still available in the 2D list.'); });
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false; this.controls.minZoom = .3; this.controls.maxZoom = 7;this.controls.maxPolarAngle = Math.PI * .8;
    this.controls.addEventListener('change', () => this.render());
    this.group = new THREE.Group();this.scene.add(this.group);this.cards = [];
    this.raycaster = new THREE.Raycaster();this.pointer = new THREE.Vector2();
    this.makeSite();
    new ResizeObserver(() => this.resize()).observe(container);
    container.addEventListener('pointerdown', event => this.pointerDown(event));
    container.addEventListener('pointermove', event => this.pointerMove(event));
    container.addEventListener('pointerup', event => this.pointerUp(event));
    container.addEventListener('pointercancel', () => { this.dragging = null; this.controls.enabled = true; });
    container.addEventListener('pointerleave', () => this.onHover(null));
    this.reset();
  }
  makeSite() {
    const grid = new THREE.GridHelper(350, 70, '#49345e', '#252033'); grid.position.set(0, -34, -15);this.scene.add(grid);
    const points = [];let seed = 2026;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i=0;i<220;i++) points.push((random()-.5)*300,(random()-.5)*180, -60-random()*100);
    const geometry = new THREE.BufferGeometry();geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    this.stars = new THREE.Points(geometry, new THREE.PointsMaterial({ color:'#9e8ac8', size:.19, transparent:true,opacity:.52 }));this.scene.add(this.stars);
    const lines = [];
    // Two wireframe tower cranes: construction, not a finished empire.
    for (const side of [-1, 1]) {
      const x = side*72;
      const segment = (a,b) => lines.push(...a,...b);
      segment([x,-34,-30],[x,39,-30]);segment([x+3,-34,-30],[x+3,39,-30]);
      for(let y=-34;y<38;y+=8){segment([x,y,-30],[x+3,y+8,-30]);segment([x+3,y,-30],[x,y+8,-30]);}
      segment([x-19,34,-30],[x+25,34,-30]);segment([x-19,36,-30],[x+25,36,-30]);segment([x,39,-30],[x+25,34,-30]);segment([x+25,34,-30],[x+25,8,-30]);segment([x+24,8,-30],[x+26,8,-30]);
    }
    const craneGeometry = new THREE.BufferGeometry();craneGeometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
    this.scene.add(new THREE.LineSegments(craneGeometry,new THREE.LineBasicMaterial({color:'#a58b64',transparent:true,opacity:.3})));
  }
  clear() {
    this.group.traverse(object => { object.geometry?.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material];for(const material of materials) {material?.map?.dispose();material?.dispose();} });
    this.group.clear();this.cards=[];
  }
  label(text,x,y,z=0,color='#b7a7ce',width=25) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture(text,color),transparent:true,depthTest:false}));sprite.position.set(x,y,z);sprite.scale.set(width,width*90/1024,1);this.group.add(sprite);return sprite;
  }
  line(from,to,color='#71e6d0',dashed=false) {
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...from),new THREE.Vector3(...to)]);
    const material = dashed ? new THREE.LineDashedMaterial({color,transparent:true,opacity:.38,dashSize:1,gapSize:.6}) : new THREE.LineBasicMaterial({color,transparent:true,opacity:.3});
    const line = new THREE.Line(geometry,material);line.computeLineDistances();this.group.add(line);return line;
  }
  card(item,x,y,z=0,width=23,color=COLORS[item.fields?.Status]||'#aa8bea') {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width,width*224/768,.36),new THREE.MeshBasicMaterial({map:cardTexture(item,color),color:'#ffffff'}));
    mesh.position.set(x,y,z);mesh.userData.item=item;this.group.add(mesh);this.cards.push(mesh);return mesh;
  }
  setData(items, tab, page=0, links=[]) {
    this.clear();this.tab=tab;this.dragging=null;this.controls.enabled=true;
    if(tab==='board') {
      STATUS.forEach((status,index)=>{
        const x=(index-1.5)*32, group=items.filter(item=>(item.fields?.Status||'Todo')===status);
        this.label(`${status.toUpperCase()}  /  ${group.length}`,x,27,0,COLORS[status],29);
        this.line([x-15,24,0],[x+15,24,0],COLORS[status]);
        group.slice(page*6,page*6+6).forEach((item,row)=>this.card(item,x,18-row*8.1,row*.4,29));
        if(!group.length) this.label('ROOM FOR POSSIBILITY',x,16,0,'#665872',21);
      });this.bounds={width:145,height:68};
    } else if(tab==='roadmap') {
      const dated=items.filter(i=>dateNumber(i.fields.Start)!==null||dateNumber(i.fields.Target)!==null).sort((a,b)=>(dateNumber(a.fields.Start)??dateNumber(a.fields.Target))-(dateNumber(b.fields.Start)??dateNumber(b.fields.Target)));
      const dates=dated.flatMap(i=>[dateNumber(i.fields.Start),dateNumber(i.fields.Target)]).filter(n=>n!==null);
      const today=Math.floor(Date.now()/86400000),min=Math.min(...dates,today),max=Math.max(...dates,today+1),span=max-min||1;
      const xFor = n => -49+(n-min)/span*98;
      this.label('THE MARATHON / DATES ARE A PLAN, NOT A PROMISE',0,36,0,'#b7a7ce',58);
      for(let n=min;n<=max;n+=Math.max(7,Math.round(span/6))){ const x=xFor(n);this.line([x,-28,-3],[x,29,-3],'#635078');this.label(new Date(n*86400000).toISOString().slice(0,10),x,31,0,'#9583aa',17); }
      dated.forEach((item,i)=>{
        const start=dateNumber(item.fields.Start)??dateNumber(item.fields.Target),end=dateNumber(item.fields.Target)??start;
        const x=xFor(start),y=22-(i%6)*8.7,z=-Math.floor(i/6)*2;
        this.line([x,y-3.4,z],[xFor(end),y-3.4,z],COLORS[item.fields.Status]||'#aa8bea');
        this.card(item,x,y,z,18);
      });
      const tx=xFor(today);this.line([tx,-29,3],[tx,30,3],'#71e6d0');this.label('TODAY',tx,-31,3,'#71e6d0',13);
      const undated=items.filter(i=>!dated.includes(i));this.label('UNDATED / STAGING',-37,-39,0,'#e5c583',28);
      undated.forEach((item,i)=>this.card(item,-14+i*24,-40,0,21));this.bounds={width:135,height:93};
    } else if(tab==='canopy') {
      const groups=[...new Set(items.map(i=>i.fields?.Workstream||'Unassigned'))];
      groups.forEach((name,index)=>{
        const col=index%4,row=Math.floor(index/4),cx=(col-1.5)*33,cy=26-row*30;
        const group=items.filter(i=>(i.fields?.Workstream||'Unassigned')===name);
        this.label(`${name.toUpperCase()} / ${group.length}`,cx,cy+12,0,'#baa3dd',32);
        const ringPoints=[];for(let j=0;j<=64;j++){const a=j/64*Math.PI*2;ringPoints.push(new THREE.Vector3(cx+13*Math.cos(a),cy+9*Math.sin(a),-2));}
        this.group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPoints),new THREE.LineBasicMaterial({color:'#725590',transparent:true,opacity:.28})));
        group.slice(page*8,page*8+8).forEach((item,i)=>{const a=i/8*Math.PI*2;const mesh=this.card(item,cx+9*Math.cos(a),cy+6.8*Math.sin(a),i*.25,11);mesh.userData.orbit={cx,cy,a};});
      });this.connect(relationships(items));this.bounds={width:151,height:110};
    } else if(tab==='passports') {
      const columns=7;
      items.forEach((item,index)=>{
        const count=Array.isArray(item.fields['Baseline met'])?item.fields['Baseline met'].length:0;
        const width=14+Math.min(count,8)*.5;
        this.card(item,(index%columns-3)*21,24-Math.floor(index/columns)*12,Math.min(count,8)*.5,width,ROLE_COLORS[item.fields.Role]||'#aa8bea');
      });
      this.label('ROLE → COLOR     /     BASELINE MET → SIZE',0,34,0,'#e5c583',54);
      this.bounds={width:155,height:Math.max(76,Math.ceil(items.length/columns)*12+24)};
    } else if(tab==='catalog') {
      ['Shared solution','Standard','Decision'].forEach((kind,index)=>{
        const group=items.filter(i=>i.fields.Kind===kind),x=(index-1)*42;
        this.label(`${kind.toUpperCase()} / ${group.length}`,x,32,0,['#71e6d0','#aa8bea','#e5c583'][index],39);
        group.forEach((item,i)=>this.card(item,x+(i%2-.5)*19.5,24-Math.floor(i/2)*8,-(i%2),18,['#71e6d0','#aa8bea','#e5c583'][index]));
      });this.bounds={width:145,height:Math.max(90,Math.ceil(items.filter(i=>i.fields.Kind==='Shared solution').length/2)*8+25)};
    } else {
      items.forEach(item=>this.card(item,item.x,item.y,0,23,item.color));this.connect(links);
      const xs=items.map(i=>i.x),ys=items.map(i=>i.y);
      this.bounds={width:Math.max(100,Math.max(...xs,0)-Math.min(...xs,0)+40),height:Math.max(65,Math.max(...ys,0)-Math.min(...ys,0)+35),cx:(Math.max(...xs,0)+Math.min(...xs,0))/2,cy:(Math.max(...ys,0)+Math.min(...ys,0))/2};
    }
    if(!items.length)this.label(tab==='own'?'ADD A NODE. MAKE A BEGINNING.':'NO MATCHES. TRY ANOTHER FILTER.',0,0,0,'#aa8bea',66);
    this.reset();
  }
  connect(links) {
    const cards=new Map(this.cards.map(card=>[card.userData.item.id,card]));
    for(const link of links){const a=cards.get(link.from),b=cards.get(link.to);if(a&&b)this.line([a.position.x,a.position.y,a.position.z-1],[b.position.x,b.position.y,b.position.z-1],link.kind==='dependency'?'#71e6d0':'#e5c583',link.kind!=='dependency');}
  }
  reset(){const {cx=0,cy=0}=this.bounds||{};this.camera.position.set(cx,cy+15,105);this.controls.target.set(cx,cy,0);this.camera.zoom=1;this.controls.update();this.resize();}
  resize(){const width=this.container.clientWidth,height=this.container.clientHeight;if(!width||!height)return;const aspect=width/height,b=this.bounds||{width:116,height:68};const half=Math.max(b.height/2,b.width/2/aspect)*1.08;this.camera.left=-half*aspect;this.camera.right=half*aspect;this.camera.top=half;this.camera.bottom=-half;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);this.render();}
  hit(event){const rect=this.container.getBoundingClientRect();this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);return this.raycaster.intersectObjects(this.cards)[0];}
  pointerDown(event){this.down={x:event.clientX,y:event.clientY};const hit=this.hit(event);if(this.tab==='own'&&hit){this.dragging={mesh:hit.object,offset:hit.point.clone().sub(hit.object.position),moved:false};this.controls.enabled=false;this.container.setPointerCapture(event.pointerId);}}
  pointerMove(event){if(this.dragging){this.hit(event);const point=new THREE.Vector3();if(this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),0),point)){point.sub(this.dragging.offset);this.dragging.mesh.position.set(Math.max(-200,Math.min(200,point.x)),Math.max(-200,Math.min(200,point.y)),0);this.dragging.moved=Math.hypot(event.clientX-this.down.x,event.clientY-this.down.y)>4;this.render();}return;}const hit=this.hit(event);this.container.style.cursor=hit?'pointer':'grab';this.onHover(hit?.object.userData.item||null,event);}
  pointerUp(event){const moved=this.down&&Math.hypot(event.clientX-this.down.x,event.clientY-this.down.y)>5;this.controls.enabled=true;if(this.dragging){const {mesh}=this.dragging;if(moved)this.onMove(mesh.userData.item.id,mesh.position.x,mesh.position.y);this.dragging=null;}if(!moved){const hit=this.hit(event);if(hit)this.onSelect(hit.object.userData.item);}this.down=null;}
  render(){if(this.active!==false)this.renderer.render(this.scene,this.camera);}
  setMotion(reduced){this.reduced=reduced;this.stop();if(!reduced&&this.active!==false)this.animate();else this.render();}
  animate(){let last=0;const frame=time=>{if(time-last>50&&!document.hidden){this.stars.rotation.z=Math.sin(time/150000)*.025;if(this.tab==='canopy'){for(const card of this.cards){const o=card.userData.orbit;if(o){const a=o.a+Math.sin(time/18000)*.035;card.position.x=o.cx+9*Math.cos(a);card.position.y=o.cy+6.8*Math.sin(a);}}}this.render();last=time;}this.frame=requestAnimationFrame(frame);};this.frame=requestAnimationFrame(frame);}
  stop(){if(this.frame)cancelAnimationFrame(this.frame);this.frame=null;}
  setActive(active){this.active=active;this.stop();if(active){this.resize();this.setMotion(this.reduced);}}
}
