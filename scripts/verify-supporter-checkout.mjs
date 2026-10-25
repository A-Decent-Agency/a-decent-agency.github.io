import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { ESCROW_ABI, USDC_ABI, BASE_USDC } from '../js/supporter-checkout.js';
import { SUPPORTER_ESCROW, SUPPORTER_NFT } from '../js/progress-feed.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { Interface } = await import(process.env.ETHERS_MODULE || 'ethers');
const escrowABI = new Interface(ESCROW_ABI), tokenABI = new Interface(USDC_ABI);
const base = process.env.OFFICE_URL || 'http://127.0.0.1:18778/';
const shots = process.env.SCREENSHOT_DIR || 'office-shots';
await mkdir(shots, { recursive: true });
const buyer = `0x${'1'.repeat(40)}`, blockHash = `0x${'7'.repeat(64)}`;
const browser = await chromium.launch({ headless: true });
const errors = [];
async function scenario(options = {}) {
  const page = await browser.newPage({ viewport: { width: options.width || 1280, height: 900 }, reducedMotion: options.threeD ? 'no-preference' : 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  const calls = [], sent = [], transactions = new Map();
  const state = { chain: options.wrongChain ? '0x1' : '0x2105', allowance: options.allowance || 0n, checks: 0 };
  let popups = 0; page.on('popup', () => popups++);
  await page.addInitScript(() => {
    const listeners = {};
    window.checkoutMockEvents = listeners;
    const provider = {
      request: async payload => {
        const response = await fetch('/__checkout_mock_rpc', { method: 'POST', body: JSON.stringify(payload) });
        const result = await response.json();
        if (result.error) throw Object.assign(new Error(result.error.message), { code: result.error.code });
        return result.result;
      },
      on: (event, handler) => { listeners[event] = handler; },
      removeListener: (event, handler) => { if (listeners[event] === handler) delete listeners[event]; },
    };
    window.addEventListener('eip6963:requestProvider', () => {
      window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: {
        info: { uuid: 'checkout-metamask', name: 'MetaMask test double' }, provider,
      } }));
    });
  });
  const rpc = async (payload, publicRead = false) => {
    const { method, params = [] } = payload;
    calls.push(method);
    if (method === 'eth_chainId') return publicRead ? '0x2105' : state.chain;
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [buyer];
    if (method === 'wallet_switchEthereumChain') { state.chain = '0x2105'; return null; }
    if (method === 'eth_blockNumber') return '0x64';
    if (method === 'eth_getTransactionCount') return '0x0';
    if (method === 'eth_gasPrice') return '0x1';
    if (method === 'eth_estimateGas') return '0x20000';
    if (method === 'eth_call') {
      const tx = params[0], isToken = tx.to.toLowerCase() === BASE_USDC.toLowerCase();
      const abi = isToken ? tokenABI : escrowABI;
      const parsed = abi.parseTransaction({ data: tx.data });
      let result;
      if (parsed.name === 'getListing') {
        state.checks++;
        const changed = options.changedPrice && state.allowance > 0n;
        const id = Number(parsed.args[0]);
        result = [[SUPPORTER_NFT, 70 + id, 0n, BASE_USDC, changed ? 1n : 10000000n,
          options.soldOut ? 0n : 99n, true, 'Mock listing']];
      } else if (parsed.name === 'getNFTBalance') result = [99n];
      else if (parsed.name === 'paused') result = [!!options.paused];
      else if (parsed.name === 'balanceOf') result = [options.lowBalance ? 1n : 10000000n];
      else if (parsed.name === 'allowance') result = [state.allowance];
      else throw new Error(`Unexpected view ${parsed.name}`);
      return abi.encodeFunctionResult(parsed.name, result);
    }
    if (method === 'eth_sendTransaction') {
      const tx = params[0], isApproval = tx.to.toLowerCase() === BASE_USDC.toLowerCase();
      const parsed = (isApproval ? tokenABI : escrowABI).parseTransaction({ data: tx.data });
      if (options.rejectApproval && isApproval || options.rejectPurchase && !isApproval) throw Object.assign(new Error('User rejected request'), { code: 4001 });
      const hash = `0x${(isApproval ? 'a' : 'b').repeat(64)}`;
      sent.push({ name: parsed.name, args: parsed.args.map(String), to: tx.to, value: tx.value || '0x0' });
      transactions.set(hash, { ...tx, isApproval });
      return hash;
    }
    if (method === 'eth_getTransactionByHash') {
      const tx = transactions.get(params[0]); if (!tx) return null;
      return { hash: params[0], blockHash, blockNumber: '0x64', transactionIndex: '0x0',
        from: buyer, to: tx.to, gas: '0x20000', gasPrice: '0x1', nonce: '0x0', value: '0x0', input: tx.data,
        r: `0x${'1'.repeat(64)}`, s: `0x${'2'.repeat(64)}`, v: '0x1b', type: '0x0', chainId: '0x2105' };
    }
    if (method === 'eth_getTransactionReceipt') {
      const hash = params[0], tx = transactions.get(hash); if (!tx) return null;
      const logs = [];
      if (tx.isApproval) {
        state.allowance = 10000000n;
        if (options.accountChange) await page.evaluate(() => window.checkoutMockEvents.accountsChanged([`0x${'3'.repeat(40)}`]));
      } else {
        const encoded = escrowABI.encodeEventLog(escrowABI.getEvent('Purchased'), [0n, buyer, 1n, BASE_USDC, 10000000n]);
        logs.push({ ...encoded, address: SUPPORTER_ESCROW, blockHash, blockNumber: '0x64', transactionHash: hash,
          transactionIndex: '0x0', logIndex: '0x0', removed: false });
      }
      return { transactionHash: hash, transactionIndex: '0x0', blockHash, blockNumber: '0x64',
        from: buyer, to: tx.to, cumulativeGasUsed: '0x10000', gasUsed: '0x10000', effectiveGasPrice: '0x1',
        contractAddress: null, logs, logsBloom: `0x${'0'.repeat(512)}`, status: options.revertPurchase && !tx.isApproval ? '0x0' : '0x1', type: '0x0' };
    }
    throw new Error(`Unexpected RPC ${method}`);
  };
  const handle = async route => {
    const body = route.request().postDataJSON();
    const answer = async item => {
      try { return { jsonrpc: '2.0', id: item.id, result: await rpc(item, route.request().url().startsWith('https://mainnet.base.org')) }; }
      catch (error) { return { jsonrpc: '2.0', id: item.id, error: { code: error.code || -32000, message: error.message } }; }
    };
    const response = Array.isArray(body) ? await Promise.all(body.map(answer)) : await answer(body);
    await route.fulfill({ json: response, headers: { 'access-control-allow-origin': '*' } });
  };
  await page.route('**/__checkout_mock_rpc', handle);
  await page.route('https://mainnet.base.org/**', handle);
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector('#progress-status').textContent.includes('repositories available'));
  assert.equal(calls.length, 0, 'No wallet or chain read until a token is selected');
  if (options.preconnect) {
    await page.click('#wallet-button');
    await page.waitForSelector('#wallet-button.connected');
  }
  await page.selectOption('#flight-destination', 'project:thejollylama/decenthead');
  if (options.threeD) {
    await page.waitForSelector('#scene canvas:visible');
    await page.click('#motion-button');
    await page.evaluate(async () => {
      const { ConstructionScene } = await import('./js/construction-scene.js');
      const original = ConstructionScene.prototype.setCamera;
      ConstructionScene.prototype.setCamera = function(...args) {
        globalThis.checkoutAcceptanceScene = this;
        return original.apply(this, args);
      };
    });
    await page.selectOption('#flight-camera', 'orbit');
    await page.click('#flight-fullscreen');
    await page.click('#immersive-panel');
    await page.waitForTimeout(200);
    const target = await page.evaluate(async () => {
      const THREE = await import('three'), scene = globalThis.checkoutAcceptanceScene;
      const card = scene.targets.find(object => object.isMesh && object.userData.purchaseUrl);
      scene.renderer.render(scene.scene, scene.camera);
      const p = card.getWorldPosition(new THREE.Vector3()).project(scene.camera);
      const bounds = scene.container.getBoundingClientRect();
      return { x: bounds.left + (p.x + 1) * bounds.width / 2, y: bounds.top + (1 - p.y) * bounds.height / 2 };
    });
    await page.mouse.click(target.x, target.y);
    assert.equal(await page.locator('#flight-pause').getAttribute('aria-pressed'), 'true');
  } else await page.click('.mint-buy');
  await page.waitForSelector('#supporter-checkout[open]');
  await page.waitForFunction(() => !document.querySelector('[data-checkout-status]').textContent.startsWith('Checking live'));
  assert.equal(calls.filter(method => method === 'eth_requestAccounts').length, options.preconnect ? 1 : 0);
  assert.equal(sent.length, 0);
  assert.equal(await page.locator('[data-checkout-image]').getAttribute('alt'), 'DecentHead v2.0.0 Supporter edition front');
  await page.click('[data-checkout-flip]');
  assert.match(await page.locator('[data-checkout-image]').getAttribute('alt'), /back$/);
  if (options.soldOut || options.paused) {
    assert.ok(await page.locator('[data-checkout-buy]').isDisabled());
    assert.match(await page.locator('[data-checkout-status]').innerText(), /unavailable|paused|sold out/);
  } else {
    await page.click('[data-checkout-buy]');
    await page.waitForFunction(() => document.querySelector('#supporter-checkout .dialog-close').disabled === false);
    const status = await page.locator('[data-checkout-status]').innerText();
    if (options.expectedError) assert.match(status, options.expectedError);
    else {
      assert.match(status, /Purchase confirmed on Base/);
      assert.equal(sent.filter(tx => tx.name === 'purchaseWithToken').length, 1);
      assert.ok(await page.locator('[data-checkout-buy]').isDisabled());
      const purchase = sent.find(tx => tx.name === 'purchaseWithToken');
      assert.deepEqual(purchase.args, ['0', '1']); assert.equal(purchase.value, '0x0');
    }
    if (options.allowance) assert.equal(sent.filter(tx => tx.name === 'approve').length, 0);
    for (const tx of sent.filter(tx => tx.name === 'approve')) assert.deepEqual(tx.args, [SUPPORTER_ESCROW, '10000000']);
    if (options.preconnect) assert.equal(calls.filter(method => method === 'eth_requestAccounts').length, 1, 'Checkout reuses the selected header session');
  }
  assert.equal(popups, 0); assert.equal(page.url(), base);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  if (options.screenshot) await page.screenshot({ path: `${shots}/${options.screenshot}.png`, fullPage: true });
  await page.close();
  return { calls, sent };
}
try {
  await scenario({ preconnect: true, screenshot: 'checkout-confirmed' });
  await scenario({ threeD: true, allowance: 10000000n, screenshot: 'checkout-3d-fullscreen' });
  await scenario({ allowance: 10000000n, wrongChain: true, width: 320, screenshot: 'checkout-mobile' });
  await scenario({ rejectApproval: true, expectedError: /declined/ });
  await scenario({ rejectPurchase: true, expectedError: /declined/ });
  await scenario({ changedPrice: true, expectedError: /price changed/ });
  await scenario({ accountChange: true, expectedError: /account or network changed/ });
  await scenario({ lowBalance: true, expectedError: /Insufficient Base USDC/ });
  await scenario({ revertPurchase: true, expectedError: /reverted|did not confirm/ });
  await scenario({ soldOut: true });
  await scenario({ paused: true });
  assert.deepEqual(errors, []);
  console.log('PASS: real ethers with mocked EIP-6963 wallet/RPC, same-page dialog, header-session reuse, exact USDC approval then purchase, allowance skip, chain switch, confirmed event, rejection/revert, changed price/account, insufficient funds, sold out/paused, no automatic wallet prompts, no popups, mobile; zero page errors. No real transaction sent.');
} finally { await browser.close(); }
