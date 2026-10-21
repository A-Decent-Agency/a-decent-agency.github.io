import { initHeader } from './decent-head/head.js';
import { escapeHTML as esc, markdown, safeURL } from './markdown.js';
import { COLORS, ROLE_COLORS, VIEWS, tabMatches, viewMatches, spatialPages } from './model.js';
import { loadMap, saveMap, validateMap, downloadMap, projectToMap, readMapResponse, MAX_FILE_BYTES } from './editor.js';
import { exportProject, projectIdFromUrl } from './project.js';

const $ = selector => document.querySelector(selector);
const tabs = [...document.querySelectorAll('[data-tab]')];
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const state = { tab: 'board', query: '', view: '', page: 0, reduced: reducedQuery.matches || navigator.connection?.saveData || false, list: reducedQuery.matches || matchMedia('(max-width: 620px)').matches || navigator.connection?.saveData || false, project: { items: [], views: [] } };
let scene, scenePromise, sceneFailed = false, selected, detailOpener, editing, map, toastTimer;
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
function render() {
  const own=state.tab==='own',items=visibleItems(),pages=spatialPages(items,state.tab);
  state.page=Math.max(0,Math.min(state.page,pages-1));
  const list=state.list||sceneFailed;
  document.documentElement.dataset.reduced=String(state.reduced);
  $('#mode-button').textContent=list?'◇ 3D space':'☷ 2D list';$('#mode-button').setAttribute('aria-pressed',String(list));
  $('#motion-button').textContent=state.reduced?'◌ Motion off':'◌ Motion on';$('#motion-button').setAttribute('aria-pressed',String(state.reduced));
  $('#scene').hidden=list;$('#list-view').hidden=!list;$('#workspace').classList.toggle('list-mode',list);
  $('#view-title').textContent=VIEWS[state.tab][0];$('#view-description').textContent=VIEWS[state.tab][1];
  $('#item-count').textContent=`${items.length} ${own?'NODES':'ITEMS'}`;
  $('#editor-tools').hidden=!own;$('#project-view').disabled=own;
  $('#page-label').textContent=list?`All ${items.length} ${own?'nodes':'items'}`:`Scene ${state.page+1} / ${pages} · ${items.length} total`;
  $('#prev-page').disabled=list||state.page===0;$('#next-page').disabled=list||state.page===pages-1;
  $('#reset-camera').disabled=list;
  const legend=state.tab==='passports'?Object.entries(ROLE_COLORS):state.tab==='catalog'?[['Shared solution','#71e6d0'],['Standard','#aa8bea'],['Decision','#e5c583']]:Object.entries(COLORS);
  $('.legend').replaceChildren(...legend.map(([label,color])=>{const span=document.createElement('span'),dot=document.createElement('i');dot.style.background=color;span.append(dot,document.createTextNode(label));return span;}));
  if(list){showList(items);scene?.setActive(false);}else if(scene){scene.setActive(true);scene.setData(items,state.tab,state.page,map.links);scene.setMotion(state.reduced);}
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

render();
try {
  const response=await fetch(new URL('../data/project.json',import.meta.url));
  if(!response.ok)throw new Error(`Snapshot returned HTTP ${response.status}.`);
  state.project=await response.json();
  for(const view of state.project.views){const option=new Option(view.name,view.filter);option.title=`${view.layout} · ${view.filter||'All items'}`;$('#project-view').append(option);}
  $('#sync-status').textContent=`LAST SYNCED ${new Date(state.project.exportedAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}`;
  $('#project-readme').innerHTML=markdown(state.project.readme);
  render();
} catch(error){$('#sync-status').textContent='PUBLIC SNAPSHOT UNAVAILABLE';notify(`${error.message} You can still make your own map.`);}
async function startScene(){
  if(scene)return;
  if(scenePromise)return scenePromise;
  scenePromise=(async()=>{try {
  const {OfficeScene}=await import('./scene.js');
  scene=new OfficeScene($('#scene'),{onSelect:openDetail,onHover:hover,onMove:(id,x,y)=>{const node=map.nodes.find(n=>n.id===id);if(node){node.x=x;node.y=y;persist();render();}},onFailure:message=>{sceneFailed=true;render();notify(message);}});
  render();
} catch {sceneFailed=true;render();notify('3D is unavailable on this device or CDN connection. The complete 2D planning office is ready.');}})();
  return scenePromise;
}
if(!state.list)await startScene();
