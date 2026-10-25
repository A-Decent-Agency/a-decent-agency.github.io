import { initHeader } from './decent-head/head.js';
import { escapeHTML as esc, markdown, safeURL } from './markdown.js';
import { COLORS, ROLE_COLORS, VIEWS, tabMatches, viewMatches, spatialPages } from './model.js';
import { loadMap, saveMap, validateMap, downloadMap, projectToMap, readMapResponse, MAX_FILE_BYTES } from './editor.js';
import { exportProject, projectIdFromUrl } from './project.js';
import { constructionSites, snapshotFreshness } from './construction-model.js';
import { mount as mountTodaysFlight } from './todays-flight-ui.js';
import { compareSnapshots, isPublishedSnapshot, summarizeChanges } from './planning-changes.js';
import { mountPlanningDock } from './planning-dock.js';
import { mountSiteIdentity } from './site-identities-ui.js';
import { renderCampusDetails } from './campus-details.js';
import { isProgressFeed } from './progress-feed.js';
import { renderCampusPlan } from './campus-plan.js';
import { campusStructure } from './project-campus.js';

const $ = selector => document.querySelector(selector);
const tabs = [...document.querySelectorAll('[data-tab]')];
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const state = { tab: 'flight', query: '', view: '', page: 0, reduced: reducedQuery.matches || navigator.connection?.saveData || false, list: reducedQuery.matches || matchMedia('(max-width: 620px)').matches || navigator.connection?.saveData || false, project: { items: [], views: [] } };
let scene, sceneKind, sceneFailed = false, selected, detailOpener, editing, map, toastTimer, flightSites = [], flightIndex = 0;
const scenes = new Map(), scenePromises = new Map(), sceneData = new WeakMap();
const dailyFlight = mountTodaysFlight({
  container: $('#daily-flight'),
  onDestination: id => {
    const index = flightSites.findIndex(site => site.id === id);
    if (index < 0) { notify('This destination is not in the current filtered route.'); return; }
    chartSite(index);
    $('#scene canvas:not([hidden])')?.focus();
  },
  onItem: openDetail
});
let dailyFlightKey = '';
let previousPublication = null, publicationLoaded = false;
const planningDock = mountPlanningDock({ container: $('#planning-dock'), current: null, onItem: openDetail });
const siteIdentityPanel = mountSiteIdentity($('#flight-site-identity'), null);
const campusArtwork = mountSiteIdentity($('#campus-artwork'), null);
let identitySiteId = null;
let progressFeed = null;
function updateSitePanels(site = flightSites[flightIndex]) {
  $('#campus-details').innerHTML = renderCampusDetails(site, progressFeed);
  for (const image of $('#campus-details').querySelectorAll('[data-project-mural], [data-mint-art]')) image.addEventListener('error', () => {
    image.hidden = true; notify('Project or edition artwork unavailable; source and purchase evidence links retained.');
  }, { once: true });
  $('#campus-plan').innerHTML = renderCampusPlan(site, flightSites, progressFeed);
  campusArtwork.update(site?.project ? site : null, { active: Boolean(site?.project && state.tab === 'flight') });
  planningDock.update({ site, previous: previousPublication, current: publicationLoaded ? state.project : null });
  if (identitySiteId !== site?.id) {
    identitySiteId = site?.id;
    $('#flight-identity-panel').open = false;
  }
  siteIdentityPanel.update(site, { active: state.tab === 'flight' && $('#flight-identity-panel').open });
}
$('#flight-identity-panel').addEventListener('toggle', () => {
  siteIdentityPanel.update(flightSites[flightIndex], { active: state.tab === 'flight' && $('#flight-identity-panel').open });
});
$('#flight-dock-panel').addEventListener('toggle', () => {
  if ($('#flight-dock-panel').open && scenes.has('flight')) { scenes.get('flight').setPaused(true); updatePause(true); }
});
function notify(message) { $('#toast').textContent = message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,7500); }
try { map = loadMap(); } catch { map={schemaVersion:1,nodes:[],links:[]};notify('Browser storage is unavailable or contains an invalid map. It has not been overwritten. Export your work to keep a copy.'); }
function persist() { try {saveMap(map);} catch {notify('Could not save in this browser. Your map remains in memory: download JSON to keep it.');} }
function openHouse() { $('#house-status').textContent='';$('#house-dialog').showModal(); }
function openAbout() { $('#about-dialog').showModal(); }
initHeader({openHouse,openAbout,notify});
$('#bottom-about').addEventListener('click',openAbout);
for(const dialog of document.querySelectorAll('dialog')) {
  dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
}
$('#house-dialog').addEventListener('close',()=>{ $('#pinata-token').value='';$('#github-token').value=''; });
function guard(action) { return async event => { const button=event?.currentTarget;try {if(button?.tagName==='BUTTON')button.disabled=true;await action(event);}catch(error){notify(error.message);if($('#house-dialog').open)$('#house-status').textContent=error.message;}finally{if(button?.tagName==='BUTTON')button.disabled=false;} }; }
function ownItems() {return map.nodes.map(node=>({...node,body:node.notes,fields:{Kind:node.kind,Status:'Todo'}}));}
function visibleItems() {
  const items=state.tab==='own'?ownItems():state.project.items;
  const query=state.query.toLowerCase();
  return items.filter(item=>tabMatches(item,state.tab)&&(state.tab==='own'||viewMatches(item,state.view))&&(!query||[item.title,item.body,JSON.stringify(item.fields)].join(' ').toLowerCase().includes(query)));
}
function openDetail(item) {
  if (state.tab === 'flight') scenes.get('flight')?.highlightTask(item.id);
  if (state.tab === 'flight' && scenes.has('flight')) { scenes.get('flight').setPaused(true); updatePause(true); }
  selected=item;detailOpener=document.activeElement;
  const panel=$('#detail-panel');const content=$('#detail-content');
  const fields=Object.entries(item.fields||{}).filter(([,value])=>value?.length);
  const url=safeURL(item.url);
  content.innerHTML=`<div class="eyebrow">${esc(state.tab==='own'?'YOUR MAP / YOUR DATA':item.fields?.Kind||'PROJECT CARD')}</div><h2 id="detail-title">${esc(item.title)}</h2>${item.private?'<p class="detail-note">Private repository: only title, kind, status, and dates are published.</p>':''}${item.bodyRedacted?'<p class="detail-note">Private portfolio: body withheld from the public snapshot.</p>':''}${url?`<a class="text-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open item on GitHub ↗</a>`:''}<dl>${fields.map(([key,value])=>`<dt>${esc(key)}</dt><dd>${esc(Array.isArray(value)?value.join(' · '):value)}</dd>`).join('')}${item.repository?`<dt>Repository</dt><dd>${esc(item.repository)}</dd>`:''}</dl><div class="markdown">${markdown(item.body|| (item.private||item.bodyRedacted?'Details are intentionally not published.':'No notes yet. A little room for possibility.'))}</div>`;
  if(state.tab==='own'){
    const actions=document.createElement('div');actions.className='detail-actions';
    const edit=document.createElement('button');edit.textContent='Edit node';edit.onclick=()=>editNode(item.id);
    const remove=document.createElement('button');remove.textContent='Delete node';remove.onclick=()=>{if(!confirm(`Delete “${item.title}” and its links?`))return;map.nodes=map.nodes.filter(n=>n.id!==item.id);map.links=map.links.filter(l=>l.from!==item.id&&l.to!==item.id);persist();closeDetail();render();};
    actions.append(edit,remove);content.prepend(actions);
    const attached=map.links.filter(l=>l.from===item.id||l.to===item.id);
    if(attached.length){const section=document.createElement('div');section.className='detail-actions';for(const link of attached){const target=map.nodes.find(n=>n.id===(link.from===item.id?link.to:link.from));const b=document.createElement('button');b.textContent=`Unlink ${target.title}`;b.onclick=()=>{map.links=map.links.filter(l=>l!==link);persist();render();openDetail(ownItems().find(n=>n.id===item.id));};section.append(b);}content.append(section);}
  }
  panel.hidden=false;$('#close-detail').focus();
}
function closeDetail() { $('#detail-panel').hidden=true;selected=null;detailOpener?.focus(); }
$('#close-detail').onclick=closeDetail;
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]'))closeDetail();});
function hover(item,event){const tooltip=$('#tooltip');if(!item){tooltip.hidden=true;return;}tooltip.textContent=`${item.title} · ${item.fields?.Status||item.kind||'Map node'}`;tooltip.hidden=false;const rect=$('#workspace').getBoundingClientRect();tooltip.style.left=`${Math.min(event.clientX-rect.left+14,rect.width-290)}px`;tooltip.style.top=`${Math.max(5,Math.min(event.clientY-rect.top+15,rect.height-75))}px`;}
function showList(items) {
  const list=$('#list-view');list.replaceChildren();
  if(!items.length){const p=document.createElement('p');p.textContent=state.tab==='own'?'Add a node to make a beginning.':'No matches. Try another search or Project view.';list.append(p);}
  for(const item of items){const button=document.createElement('button');button.className='list-card';button.style.setProperty('--card-color',state.tab==='passports'?ROLE_COLORS[item.fields?.Role]||'#aa8bea':item.color||COLORS[item.fields?.Status]||'#aa8bea');const kind=document.createElement('small');kind.textContent=item.fields?.Kind||item.kind||'Item';const title=document.createElement('strong');title.textContent=item.title;const status=document.createElement('span');status.textContent=[item.fields?.Status,item.fields?.Workstream,item.fields?.Role].filter(Boolean).join(' / ');button.append(kind,title,status);button.addEventListener('click',()=>openDetail(item));list.append(button);}
}
function showFlightSite(site, index = 0) {
  flightIndex = index;
  $('#flight-destination').value = site?.id || '';
  $('#flight-previous').disabled = !flightSites.length || index <= 0;
  $('#flight-next').disabled = !flightSites.length || index >= flightSites.length - 1;
  $('#flight-site-type').textContent = site ? `${site.project ? 'PROJECT OFFRAMP' : site.type === 'milestone' ? 'LEGACY CHECKPOINT' : '🚧 WORKSTREAM YARD'} / ${site.horizon}` : 'FLIGHT CONTROL';
  $('#flight-site-title').textContent = site?.title || 'No construction sites match this view';
  $('#flight-site-dates').textContent = site ? site.start || site.target
    ? `${site.start || 'Start unset'} → ${site.target || 'Target unset'} · tentative GitHub dates`
    : site.project ? 'Project district · architectural milestone and source evidence below' : 'Undated staging area · no dates invented' : 'Change the search or Project view filter.';
  $('#flight-site-metrics').textContent = site ? site.project
    ? `${campusStructure(site, progressFeed).buildCranes} build cranes · ${campusStructure(site, progressFeed).deliveredFloors} clean version floors · Board only: ${site.phase} · ${site.active} active · ${site.done}/${site.total} Done · ${site.blocked} blocked`
    : site.type === 'milestone' ? `Source status: ${site.items[0]?.fields?.Status || 'Unset'} · historical planning checkpoint, not a completion score`
    : `${site.phase === 'Handover' ? '✓' : '🏗'} ${site.phase} · ${site.cranes} cranes · ${site.active} active · ${site.done}/${site.total} Done · ${site.blocked} blocked` : '';
  $('#flight-site-items').replaceChildren(...(site?.items || []).map(item => {
    const button = document.createElement('button'); button.textContent = `${item.fields?.Status || 'Unknown'} / ${item.title}`;
    button.addEventListener('click', () => openDetail(item)); return button;
  }));
  updateSitePanels(site);
}
function chartSite(index) {
  if (!flightSites.length) return;
  const at = Math.max(0, Math.min(flightSites.length - 1, index));
  if (!state.list && sceneKind === 'flight' && !sceneFailed) scene?.goTo(at);
  else showFlightSite(flightSites[at], at);
}
function render() {
  const own=state.tab==='own',flight=state.tab==='flight',items=visibleItems(),pages=spatialPages(items,state.tab);
  state.page=Math.max(0,Math.min(state.page,pages-1));
  const list=state.list||sceneFailed;
  document.documentElement.dataset.reduced=String(state.reduced);
  document.documentElement.dataset.view=state.tab;
  $('#mode-button').textContent=list?'◇ 3D space':'☷ 2D list';$('#mode-button').setAttribute('aria-pressed',String(list));
  $('#motion-button').textContent=state.reduced?'◌ Motion off':'◌ Motion on';$('#motion-button').setAttribute('aria-pressed',String(state.reduced));
  $('#scene').hidden=list;$('#list-view').hidden=!list;$('#workspace').classList.toggle('list-mode',list);
  $('#view-title').textContent=VIEWS[state.tab][0];$('#view-description').textContent=VIEWS[state.tab][1];
  $('#item-count').textContent=`${items.length} ${own?'NODES':'ITEMS'}`;
  $('#editor-tools').hidden=!own;$('#project-view').disabled=own;
  document.querySelector('.office').classList.toggle('construction-view', flight);
  $('#flight-tools').hidden=!flight;$('#flight-site').hidden=!flight;$('#flight-controls').hidden=!flight||list;
  $('#daily-flight-panel').hidden=!flight;
  $('#planning-change-summary').hidden=!flight;
  if (!flight) { $('#flight-identity-panel').open = false; }
  if (flight) {
    const key = JSON.stringify(items);
    if (key !== dailyFlightKey) { dailyFlight.update(items); dailyFlightKey = key; }
  }
  if (flight) {
    const previous = flightSites[flightIndex]?.id;
    flightSites = constructionSites(items, { includeContext: !state.query && !state.view });
    $('#flight-destination').replaceChildren(...flightSites.map(site => new Option(`${site.project ? 'EXIT' : site.type === 'milestone' ? 'LEGACY CHECKPOINT /' : '🚧'} ${site.title}`, site.id)));
    showFlightSite(flightSites[Math.max(0, flightSites.findIndex(site => site.id === previous))], Math.max(0, flightSites.findIndex(site => site.id === previous)));
  }
  $('#page-label').textContent=list?`All ${items.length} ${own?'nodes':'items'}`:`Scene ${state.page+1} / ${pages} · ${items.length} total`;
  $('#prev-page').disabled=flight||list||state.page===0;$('#next-page').disabled=flight||list||state.page===pages-1;
  $('#reset-camera').disabled=list;
  $('.office-caption > span:first-child').textContent = flight ? 'FLY THE ROUTE · DOCK AT A SITE · SOURCE: PUBLIC GITHUB PROJECT SNAPSHOT' : '↖ DRAG TO ORBIT · SCROLL TO ZOOM · CLICK TO EXPLORE';
  $('#scene').setAttribute('aria-label', flight ? 'Construction route. Focus the canvas to steer; use destination selection or 2D list without flight.' : 'Interactive 3D planning board. Drag to orbit, scroll to zoom; choose 2D list for keyboard-accessible cards.');
  const legend=state.tab==='passports'?Object.entries(ROLE_COLORS):state.tab==='catalog'?[['Shared solution','#71e6d0'],['Standard','#aa8bea'],['Decision','#e5c583']]:Object.entries(COLORS);
  $('.legend').replaceChildren(...legend.map(([label,color])=>{const span=document.createElement('span'),dot=document.createElement('i');dot.style.background=color;span.append(dot,document.createTextNode(label));return span;}));
  if(list){showList(items);scene?.setActive(false);}else {
    const kind = flight ? 'flight' : 'board';
    if (scene && sceneKind === kind) {
      const key = JSON.stringify([items, state.tab, state.page, own ? map.links : [], flight ? progressFeed : null]);
      scene.setActive(true);
      if (sceneData.get(scene) !== key) { scene.setData(items,state.tab,state.page,map.links,progressFeed,{ includeContext: !state.query && !state.view }); sceneData.set(scene,key); }
      scene.setMotion(state.reduced);
    } else { scene?.setActive(false); startScene(); }
  }
}
function selectTab(tab) {
  if(!VIEWS[tab])return;
  closeDetail();state.tab=tab;state.page=0;$('#tooltip').hidden=true;
  for(const button of tabs){const active=button.dataset.tab===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
  $('#workspace').setAttribute('aria-labelledby',`tab-${tab}`);render();
}
tabs.forEach((button,index)=>{
  button.onclick=()=>selectTab(button.dataset.tab);
  button.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;if(next!==undefined){event.preventDefault();tabs[next].focus();selectTab(tabs[next].dataset.tab);}});
});
$('#search').addEventListener('input',event=>{state.query=event.target.value;state.page=0;render();});
$('#project-view').addEventListener('change',event=>{state.view=event.target.value;state.page=0;render();});
$('#mode-button').onclick=async()=>{if(sceneFailed){notify('3D is unavailable. The complete 2D list and editor remain usable.');return;}state.list=!state.list;if(!state.list)await startScene();render();};
$('#motion-button').onclick=()=>{state.reduced=!state.reduced;render();};
$('#flight-destination').addEventListener('change', event => chartSite(flightSites.findIndex(site => site.id === event.target.value)));
$('#flight-previous').onclick=()=>chartSite(flightIndex-1);
$('#flight-next').onclick=()=>chartSite(flightIndex+1);
$('#flight-pause').onclick=()=>{
  const flight = scenes.get('flight');
  if (!flight || state.list) { notify('Choose 3D space to steer; destination selection works without motion in the list.'); return; }
  flight.setPaused(!flight.paused); updatePause(flight.paused);
};
function updatePause(paused) {
  $('#flight-pause').textContent = paused ? 'Resume ship' : 'Pause ship';
  $('#flight-pause').setAttribute('aria-pressed', String(paused));
  $('#immersive-pause').textContent = paused ? 'Resume ship' : 'Pause ship';
  $('#immersive-pause').setAttribute('aria-pressed', String(paused));
}
$('#scene').addEventListener('flightpause', event => updatePause(event.detail));
$('#campus-plan').addEventListener('click', event => {
  const destination = event.target.closest('[data-campus-site]');
  if (destination) chartSite(flightSites.findIndex(site => site.id === destination.dataset.campusSite));
  const job = event.target.closest('[data-campus-item]');
  if (job) {
    const item = state.project.items.find(item => item.id === job.dataset.campusItem);
    if (item) openDetail(item);
  }
});
$('#flight-camera').addEventListener('change', event => scenes.get('flight')?.setCamera(event.target.value));
$('#flight-zoom').addEventListener('input', event => scenes.get('flight')?.setZoom(event.target.value));
$('#scene').addEventListener('camerazoom', event => { $('#flight-zoom').value = event.detail; });
$('#immersive-camera').onclick = () => {
  const camera = $('#flight-camera');
  camera.selectedIndex = (camera.selectedIndex + 1) % camera.options.length;
  camera.dispatchEvent(new Event('change'));
};
$('#immersive-previous').onclick = () => chartSite(flightIndex - 1);
$('#immersive-next').onclick = () => chartSite(flightIndex + 1);
$('#immersive-pause').onclick = () => $('#flight-pause').click();
for (const [id, factor] of [['#immersive-zoom-in', .8], ['#immersive-zoom-out', 1.25]]) {
  $(id).onclick = () => {
    const zoom = $('#flight-zoom');
    zoom.value = Math.max(Number(zoom.min), Math.min(Number(zoom.max), Number(zoom.value) * factor));
    zoom.dispatchEvent(new Event('input'));
  };
}
$('#immersive-panel').onclick = () => {
  const hidden = $('#workspace').classList.toggle('panel-hidden');
  $('#immersive-panel').setAttribute('aria-pressed', String(!hidden));
  $('#immersive-panel').textContent = hidden ? 'Show site panel' : 'Hide site panel';
};
function updateFullscreen() {
  const active = document.fullscreenElement === $('#workspace') || $('#workspace').classList.contains('immersive');
  $('#immersive-tools').hidden = !active;
  $('#flight-fullscreen').setAttribute('aria-pressed', String(active));
  $('#flight-fullscreen').textContent = active ? 'Exit fullscreen' : '⛶ Fullscreen';
}
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('#workspace').classList.contains('immersive')) $('#workspace').classList.remove('immersive');
    else if ($('#workspace').requestFullscreen) await $('#workspace').requestFullscreen();
    else { $('#workspace').classList.add('immersive'); notify('Native fullscreen unavailable; expanded window mode enabled. Escape exits.'); }
    updateFullscreen();
  } catch (error) { notify(`Fullscreen failed: ${error.message}`); }
}
$('#flight-fullscreen').onclick = toggleFullscreen;
$('#immersive-exit').onclick = toggleFullscreen;
document.addEventListener('fullscreenchange', updateFullscreen);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && $('#workspace').classList.contains('immersive')) {
    $('#workspace').classList.remove('immersive'); updateFullscreen();
  }
});
const artworkFailures = new Set();
$('#scene').addEventListener('artworkerror', event => {
  if (artworkFailures.has(event.detail)) return;
  artworkFailures.add(event.detail);
  console.warn('[Planning Office artwork]', event.detail);
  notify(event.detail);
});
for (const button of document.querySelectorAll('[data-thrust]')) {
  const release = () => scenes.get('flight')?.hold(button.dataset.thrust, false);
  button.addEventListener('pointerdown', event => {
    event.preventDefault(); button.setPointerCapture(event.pointerId);
    scenes.get('flight')?.hold(button.dataset.thrust, true);
  });
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release); button.addEventListener('blur', release);
  button.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); scenes.get('flight')?.hold(button.dataset.thrust, true); } });
  button.addEventListener('keyup', release);
}
reducedQuery.addEventListener('change',event=>{state.reduced=event.matches;if(event.matches)state.list=true;render();});
$('#next-page').onclick=()=>{state.page++;render();};$('#prev-page').onclick=()=>{state.page--;render();};$('#reset-camera').onclick=()=>scene?.reset();

function editNode(id) {
  editing=id||null;const node=map.nodes.find(n=>n.id===id);const form=$('#node-form');form.reset();
  if(node)for(const field of ['title','kind','color','notes'])form.elements[field].value=node[field];
  $('#node-title').textContent=node?'Tend this possibility.':'Make a little possibility.';$('#node-dialog').showModal();
}
$('#add-node').onclick=()=>editNode();
$('#node-form').addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget;const values=Object.fromEntries(new FormData(form));if(!values.title.trim()){notify('Give your node a title.');return;}if(editing){Object.assign(map.nodes.find(n=>n.id===editing),values);}else{if(map.nodes.length>=500){notify('This map has reached its 500-node limit.');return;}map.nodes.push({id:crypto.randomUUID(),...values,x:(Math.random()-.5)*42,y:(Math.random()-.5)*32,z:0});}persist();$('#node-dialog').close();closeDetail();render();});
$('#link-nodes').onclick=()=>{if(map.nodes.length<2){notify('Add at least two nodes to find a crossover.');return;}for(const select of $('#link-form').querySelectorAll('select')){select.replaceChildren(...map.nodes.map(n=>new Option(n.title,n.id)));}$('#link-form').elements.to.selectedIndex=1;$('#link-dialog').showModal();};
$('#link-form').addEventListener('submit',event=>{event.preventDefault();const data=new FormData(event.currentTarget),from=data.get('from'),to=data.get('to');if(from===to){notify('Choose two different nodes.');return;}if(map.links.length>=2000){notify('This map has reached its 2,000-link limit.');return;}if(!map.links.some(l=>(l.from===from&&l.to===to)||(l.from===to&&l.to===from)))map.links.push({from,to});persist();$('#link-dialog').close();render();});
$('#export-map').onclick=()=>downloadMap(map);$('#house-download').onclick=()=>downloadMap(map);$('#house-map').onclick=openHouse;
function replaceMap(next) {if(!confirm('Replace this browser’s map? Download your current map first if you want to keep it.'))return false;map=validateMap(next);persist();state.query='';$('#search').value='';selectTab('own');notify('Map loaded on this device. We did not receive a copy.');return true;}
$('#import-map').addEventListener('change',guard(async event=>{const file=event.target.files[0];try{if(!file)return;if(file.size>MAX_FILE_BYTES)throw new Error('Map file is too large (16 MB limit).');replaceMap(validateMap(JSON.parse(await file.text())));}finally{event.target.value='';}}));
const mapBlob=()=>new Blob([JSON.stringify(validateMap(map))],{type:'application/json'});
function pinConsent(){return confirm('Publish this map to public, immutable IPFS using your own service? Do not include secrets or personal data.');}
function pinResult(cid){$('#house-status').replaceChildren(document.createTextNode('Pinned with your infrastructure. CID: '));const code=document.createElement('code');code.textContent=cid;$('#house-status').append(code);}
$('#pin-local').addEventListener('click',guard(async()=>{if(!pinConsent())return;const form=new FormData();form.append('file',mapBlob(),'my-decent-map.json');$('#house-status').textContent='Contacting your local Kubo node…';const response=await fetch('http://127.0.0.1:5001/api/v0/add?pin=true',{method:'POST',body:form,signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`Local node returned HTTP ${response.status}. Check Kubo CORS and browser local-network permission.`);const result=JSON.parse((await response.text()).trim().split('\n').pop());if(!result.Hash)throw new Error('No CID returned by the local node.');pinResult(result.Hash);}));
$('#pin-pinata').addEventListener('click',guard(async()=>{let token=$('#pinata-token').value.trim();$('#pinata-token').value='';try{if(!token)throw new Error('Enter your own Pinata JWT.');if(!pinConsent())return;const form=new FormData();form.append('file',mapBlob(),'my-decent-map.json');$('#house-status').textContent='Pinning directly to your Pinata account…';const response=await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form,signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`Pinata returned HTTP ${response.status}. Check your JWT permissions and account quota.`);const result=await response.json();if(!result.IpfsHash)throw new Error('Pinata returned no CID.');pinResult(result.IpfsHash);}finally{token='';}}));
$('#load-cid').addEventListener('click',guard(async()=>{const cid=$('#map-cid').value.trim();if(!/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,150})$/.test(cid))throw new Error('Enter a CID only, not a URL or path.');$('#house-status').textContent='Reading the public CID through ipfs.io…';const response=await fetch(`https://ipfs.io/ipfs/${cid}`,{signal:AbortSignal.timeout(45000)});if(replaceMap(await readMapResponse(response)))$('#house-status').textContent='Public map loaded in this browser. Export to keep a backup.';}));
$('#import-github').addEventListener('click',guard(async()=>{let token=$('#github-token').value.trim();$('#github-token').value='';try{if(!token)throw new Error('Enter a GitHub token with read:project access.');$('#house-status').textContent='Reading your project directly from GitHub…';const id=await projectIdFromUrl($('#github-project-url').value.trim(),token);const project=await exportProject(token,id);if(project.items.length>500)throw new Error('This project exceeds the editor’s 500-node limit.');if(replaceMap(projectToMap(project)))$('#house-status').textContent=`Imported ${project.items.length} cards. Private issue/PR details were filtered. Your map stays local until you export or pin it.`;}finally{token='';}}));

let refreshing = false;
async function refreshProject() {
  if (refreshing) return;
  refreshing = true; $('#refresh-project').disabled = true;
  try {
    const response = await fetch(new URL('../data/progress.json', import.meta.url), { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Public activity returned HTTP ${response.status}.`);
    const next = await response.json();
    if (!isProgressFeed(next)) throw new Error('Public activity format is invalid.');
    if (progressFeed && Date.parse(next.checkedAt) < Date.parse(progressFeed.checkedAt)) throw new Error('Public activity publication is older than the retained observation.');
    progressFeed = next;
    const available = next.repositories.filter(entry => entry.state === 'available').length;
    $('#progress-status').textContent = `PUBLIC ACTIVITY CHECKED ${new Date(next.checkedAt).toLocaleString()} · ${available}/${next.repositories.length} repositories available · hourly GitHub observation / page checks every 5 minutes`;
    render();
  } catch (error) {
    console.error('[Planning Office public activity]', error);
    $('#progress-status').textContent = `PUBLIC ACTIVITY REFRESH FAILED · ${progressFeed ? 'previous observation retained' : 'activity unavailable'} · ${error.message}`;
  }
  try {
    const response=await fetch(new URL('../data/project.json',import.meta.url), { cache:'no-store', signal:AbortSignal.timeout(20000) });
    if(!response.ok)throw new Error(`Snapshot returned HTTP ${response.status}.`);
    const project=await response.json();
    if (!isPublishedSnapshot(project) || !Array.isArray(project.views)) {
      throw new Error('Public snapshot has an unsupported or incomplete format.');
    }
    const comparison = compareSnapshots(publicationLoaded ? state.project : null, project);
    if (comparison.kind === 'unavailable') throw new Error(comparison.reason);
    const changed = JSON.stringify(project) !== JSON.stringify(state.project);
    if (changed && publicationLoaded) previousPublication = state.project;
    state.project=project;
    publicationLoaded = true;
    $('#planning-change-summary').textContent = `${summarizeChanges(compareSnapshots(previousPublication, project))} Comparison stays in this tab's memory; Done is a source status, not verified delivery.`;
    $('#project-view').replaceChildren(new Option('All items',''));
    for(const view of state.project.views){const option=new Option(view.name,view.filter);option.title=`${view.layout} · ${view.filter||'All items'}`;$('#project-view').append(option);}
    if ([...$('#project-view').options].some(option => option.value === state.view)) $('#project-view').value=state.view;
    else state.view='';
    $('#sync-status').textContent=`LAST SYNCED ${new Date(project.exportedAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})} · checked ${new Date().toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}`;
    $('#sync-status').title=`${snapshotFreshness(project.exportedAt)}. Last synced means last changed export, not last poll. Source export is scheduled hourly when its read secret is available; this page checks every five minutes while visible.`;
    $('#project-readme').innerHTML=markdown(state.project.readme);
    if (changed) render();
  } catch(error){
    console.error('[Planning Office snapshot]',error);
    $('#sync-status').textContent=state.project.items.length?'REFRESH FAILED · SHOWING PREVIOUS SNAPSHOT':'PUBLIC SNAPSHOT UNAVAILABLE';
    $('#planning-change-summary').textContent = 'Refresh failed. Previous publication and comparison retained; no new progress inferred.';
    notify(`${error.message} ${state.project.items.length?'Previous snapshot retained; no new progress inferred.':'You can still make your own map.'}`);
  } finally { refreshing=false; $('#refresh-project').disabled=false; }
}
$('#refresh-project').onclick=refreshProject;
let refreshTimer;
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  if (!document.hidden) refreshTimer=setTimeout(async()=>{await refreshProject();scheduleRefresh();},300000);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshProject();scheduleRefresh();});
render();
await refreshProject();
scheduleRefresh();
async function startScene(){
  const kind=state.tab==='flight'?'flight':'board';
  if (scenes.has(kind)) { scene?.setActive(false); scene=scenes.get(kind); sceneKind=kind; render(); return; }
  if(scenePromises.has(kind))return scenePromises.get(kind);
  const promise=(async()=>{try {
    let next;
    const onFailure=message=>{sceneFailed=true;render();notify(message);};
    if (kind==='flight') {
      const {ConstructionScene}=await import('./construction-scene.js');
      next=new ConstructionScene($('#scene'),{onSite:showFlightSite,onFailure,onMint:url=>window.open(url,'_blank','noopener,noreferrer')});
      next.setCamera($('#flight-camera').value);
      next.setZoom($('#flight-zoom').value);
    } else {
      const {OfficeScene}=await import('./scene.js');
      next=new OfficeScene($('#scene'),{onSelect:openDetail,onHover:hover,onMove:(id,x,y)=>{const node=map.nodes.find(n=>n.id===id);if(node){node.x=x;node.y=y;persist();render();}},onFailure});
    }
    next.setActive(false); scenes.set(kind,next);
    if ((state.tab==='flight'?'flight':'board')===kind && !state.list) { scene?.setActive(false);scene=next;sceneKind=kind;render(); }
  } catch(error) {console.error('[Planning Office 3D]',error);sceneFailed=true;render();notify('3D is unavailable on this device or CDN connection. The complete 2D planning office is ready.');}})();
  scenePromises.set(kind,promise);
  return promise;
}
