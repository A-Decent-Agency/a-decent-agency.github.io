import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { tabMatches } from '../js/model.js';

// Optional verification helper: use an existing Playwright install, never a runtime dependency.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const shots = process.env.SCREENSHOT_DIR || 'office-shots';
await mkdir(shots, { recursive: true });
const base = process.env.OFFICE_URL || 'http://127.0.0.1:8073/';
const data = JSON.parse(await readFile(new URL('../data/project.json', import.meta.url)));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1150 }, deviceScaleFactor: 1 });
const errors = [];
await page.addInitScript(() => {
  const original = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function(text, x, y, ...rest) {
    if (text === 'THE MARATHON / DATES ARE A PLAN, NOT A PROMISE') {
      window.roadmapBanner = { textWidth: this.measureText(text).width, canvasWidth: this.canvas.width, center: x };
    }
    return original.call(this, text, x, y, ...rest);
  };
});
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('dialog', dialog => dialog.accept());
const shot = async name => page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
const tab = async name => { await page.locator(`[data-tab="${name}"]`).click(); await page.waitForTimeout(180); };
const count = () => page.locator('#item-count').innerText();
try {
  await page.goto(base);
  await page.waitForSelector('#scene canvas');
  await page.waitForFunction(() => document.querySelector('#sync-status').textContent.includes('LAST SYNCED'));
  assert.equal(await count(), `${data.items.length} ITEMS`);
  assert.equal(await page.locator('#project-view option').count(), data.views.length + 1);
  for (const [index, name] of ['board', 'roadmap', 'canopy', 'passports', 'catalog'].entries()) {
    await tab(name);
    const expected = data.items.filter(item => tabMatches(item, name)).length;
    assert.equal(await count(), `${expected} ITEMS`);
    assert.equal(await page.locator('#scene').isVisible(), true);
    if (name === 'roadmap') {
      const banner = await page.evaluate(() => window.roadmapBanner);
      assert.ok(banner.textWidth + 64 <= banner.canvasWidth, 'Full roadmap banner fits with padding');
      assert.equal(banner.center, banner.canvasWidth / 2);
    }
    await shot(`0${index + 1}-${name}`);
    await page.locator('#mode-button').click();
    assert.equal(await page.locator('.list-card').count(), expected);
    await page.locator('.list-card').first().click();
    assert.equal(await page.locator('#detail-panel').isVisible(), true);
    assert.ok(await page.locator('#detail-title').innerText());
    await page.locator('#close-detail').click();
    await page.locator('#mode-button').click();
  }
  await tab('board');
  const box = await page.locator('#scene').boundingBox();
  const scale = box.height / (68 * 1.08);
  await page.mouse.move(box.x + box.width / 2 - 48 * scale, box.y + box.height / 2 - 18 * scale);
  assert.equal(await page.locator('#tooltip').isVisible(), true);
  await page.mouse.click(box.x + box.width / 2 - 48 * scale, box.y + box.height / 2 - 18 * scale);
  assert.equal(await page.locator('#detail-panel').isVisible(), true);
  await shot('07-card-details');
  await page.locator('#close-detail').click();
  await page.locator('#next-page').click();assert.match(await page.locator('#page-label').innerText(), /Scene 2/);
  await page.locator('#search').fill('M1 —');assert.equal(await count(),'1 ITEMS');
  await page.locator('#search').fill('');
  await page.locator('#project-view').selectOption('kind:Milestone');assert.equal(await count(),`${data.items.filter(item=>item.fields?.Kind==='Milestone').length} ITEMS`);
  await page.locator('#project-view').selectOption('');
  await page.locator('#about-button').click();assert.equal(await page.locator('#about-dialog').isVisible(),true);await page.locator('#about-dialog .dialog-close').click();

  await tab('own');await page.locator('#studio-toggle').click();assert.equal(await count(),'3 NODES');
  await page.locator('#add-node').click();
  await page.locator('#node-form [name=title]').fill('A verified possibility');
  await page.locator('#node-form [name=notes]').fill('<script>alert("not executable")</script>\n**Safe notes**');
  await page.locator('#node-form button[type=submit]').click();assert.equal(await count(),'4 NODES');
  await page.locator('#link-nodes').click();await page.locator('#link-form button[type=submit]').click();
  await page.locator('#mode-button').click();
  await page.locator('.list-card').filter({hasText:'A verified possibility'}).click();
  assert.equal(await page.locator('#detail-content script').count(),0);
  await page.getByRole('button',{name:'Edit node',exact:true}).click();
  await page.locator('#node-form [name=title]').fill('A tended possibility');await page.locator('#node-form button[type=submit]').click();
  await page.reload();await page.waitForSelector('#scene canvas');await tab('own');await page.locator('#studio-toggle').click();assert.equal(await count(),'4 NODES');
  const before = await page.evaluate(()=>JSON.parse(localStorage.getItem('decent-office-map-v1')).nodes[0]);
  const ownBox = await page.locator('#scene').boundingBox(), ownScale = ownBox.height / (65 * 1.08);
  const px=ownBox.x+ownBox.width/2+before.x*ownScale,py=ownBox.y+ownBox.height/2-before.y*ownScale;
  await page.mouse.move(px,py);await page.mouse.down();await page.mouse.move(px+38,py+27,{steps:10});await page.mouse.up();
  const after = await page.evaluate(()=>JSON.parse(localStorage.getItem('decent-office-map-v1')).nodes[0]);
  assert.ok(Math.abs(after.x-before.x)>1,'3D dragging persists new coordinates');
  await shot('06-own-map');
  const portable={schemaVersion:1,nodes:[{id:'import-a',title:'Imported A',kind:'Idea',color:'#71e6d0',notes:'Portable',x:-15,y:0,z:0},{id:'import-b',title:'Imported B',kind:'Idea',color:'#aa8bea',notes:'',x:15,y:0,z:0}],links:[{from:'import-a',to:'import-b'}]};
  await page.locator('#import-map').setInputFiles({name:'map.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(portable))});assert.equal(await count(),'2 NODES');
  const downloaded=page.waitForEvent('download');await page.locator('#export-map').click();assert.equal((await downloaded).suggestedFilename(),'my-decent-map.json');
  await page.locator('#mode-button').click();await page.locator('.list-card').first().click();await page.getByRole('button',{name:'Delete node',exact:true}).click();assert.equal(await count(),'1 NODES');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('decent-office-map-v1')));assert.equal(saved.links.length,0);
  await page.locator('#house-map').click();await shot('08-house-your-data');
  const cid='bafybeigdyrzt5sfp7udm7hu76u3j6ws3uut5dyg3ohwaxh4f6jfs4mpwxa';
  await page.route('https://api.pinata.cloud/pinning/pinFileToIPFS',async route=>{assert.equal(route.request().headers().authorization,'Bearer mock-pinata-jwt');await route.fulfill({json:{IpfsHash:cid}});});
  await page.locator('#pinata-token').fill('mock-pinata-jwt');await page.locator('#pin-pinata').click();await page.waitForFunction(()=>document.querySelector('#house-status').textContent.includes('Pinned'));assert.equal(await page.locator('#pinata-token').inputValue(),'');
  await page.route('http://127.0.0.1:5001/api/v0/add?pin=true',route=>route.fulfill({json:{Hash:cid}}));
  await page.locator('#pin-local').click();await page.waitForFunction(()=>document.querySelector('#house-status').textContent.includes('Pinned'));
  await page.route(`https://ipfs.io/ipfs/${cid}`,route=>route.fulfill({json:portable}));
  await page.locator('#map-cid').fill(cid);await page.locator('#load-cid').click();await page.waitForFunction(()=>document.querySelector('#house-status').textContent.includes('Public map loaded'));assert.equal(await count(),'2 NODES');
  await page.route('https://api.github.com/graphql',async route=>{
    assert.equal(route.request().headers().authorization,'Bearer mock-github-token');
    const body=route.request().postDataJSON();
    const result=body.query.includes('organization(login:')?{organization:{projectV2:{id:'test-project'}}}:{node:{title:'Imported project',readme:'',url:'https://github.com/orgs/test/projects/1',views:{nodes:[],pageInfo:{hasNextPage:false}},items:{nodes:[{id:'gh-card',type:'DRAFT_ISSUE',content:{title:'A GitHub import',body:'Direct and local'},fieldValues:{nodes:[],pageInfo:{hasNextPage:false}}}],pageInfo:{hasNextPage:false}}}};
    await route.fulfill({json:{data:result}});
  });
  await page.locator('#github-project-url').fill('https://github.com/orgs/test/projects/1');await page.locator('#github-token').fill('mock-github-token');await page.locator('#import-github').click();await page.waitForFunction(()=>document.querySelector('#house-status').textContent.includes('Imported 1 cards'));assert.equal(await count(),'1 NODES');
  assert.equal(await page.locator('#github-token').inputValue(),'');
  assert.ok(!(await page.evaluate(()=>JSON.stringify(localStorage))).includes('mock-'));
  await page.locator('#house-dialog .dialog-close').click();
  assert.deepEqual(errors,[],'Normal desktop flow has no console/page errors');

  for(const mode of ['discovery','fallback']) {
    const wallet=await browser.newPage();
    await wallet.addInitScript(mode=>{
      window.walletCalls=[];window.walletListeners={};
      const provider={request:async({method})=>{window.walletCalls.push(method);if(method==='eth_chainId')return '0x1';if(['eth_accounts','eth_requestAccounts'].includes(method))return ['0x1111111111111111111111111111111111111111'];throw new Error('Unexpected wallet request: '+method);},on:(event,listener)=>window.walletListeners[event]=listener,removeListener:()=>{}};
      if(mode==='discovery')window.addEventListener('eip6963:requestProvider',()=>window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{uuid:'test-wallet',name:'Test wallet'},provider}})));
      else window.ethereum=provider;
    },mode);
    await wallet.goto(base);await wallet.waitForSelector('#scene canvas');
    assert.deepEqual(await wallet.evaluate(()=>window.walletCalls),[],'No wallet RPC before a click');
    await wallet.locator('#wallet-button').click();await wallet.waitForSelector('#wallet-button.connected');
    assert.ok((await wallet.evaluate(()=>window.walletCalls)).includes('eth_requestAccounts'));
    await wallet.evaluate(()=>window.walletListeners.accountsChanged([]));assert.equal(await wallet.locator('#wallet-button.connected').count(),0);
    await wallet.close();
  }
  const reduced=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  await reduced.goto(base);await reduced.waitForSelector('.list-card');assert.equal(await reduced.locator('#scene canvas').count(),0);assert.equal(await reduced.locator('.list-card').count(),data.items.length);await reduced.screenshot({path:`${shots}/09-reduced-motion-list.png`,fullPage:true});await reduced.close();
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await mobile.goto(base);await mobile.waitForSelector('.list-card');assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true);await mobile.screenshot({path:`${shots}/10-mobile.png`,fullPage:true});await mobile.close();
  const fallback=await browser.newPage();await fallback.route('https://cdn.jsdelivr.net/**',route=>route.abort());await fallback.goto(base);await fallback.waitForSelector('.list-card');assert.equal(await fallback.locator('.list-card').count(),data.items.length);await fallback.close();
  const prefix=await browser.newPage();await prefix.route(`${base}ipfs/example/**`,async route=>{const upstream=await route.fetch({url:route.request().url().replace('/ipfs/example/','/')});await route.fulfill({response:upstream});});await prefix.goto(`${base}ipfs/example/`);await prefix.waitForSelector('#scene canvas');assert.equal(await prefix.locator('#item-count').innerText(),`${data.items.length} ITEMS`);await prefix.close();
  console.log(`PASS: 5 real-data 3D views; ${data.items.length}-card list; hover/click; search/view filters; pagination; local add/edit/link/drag/delete/persist/import/export; mocked IPFS/Pinata/GitHub; EIP-6963 and fallback wallets (no RPC until click); no persisted tokens; reduced motion; mobile; CDN failure; IPFS-style prefix. ${errors.length} console/page errors. Screenshots: ${shots}`);
} finally {await browser.close();}
