import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { purchaseEdition, inspectListing, validateEdition, validateListing, ensureBase, checkoutError, BASE_USDC } from '../js/supporter-checkout.js';
import { SUPPORTER_ESCROW, SUPPORTER_NFT, isVersionStorefront } from '../js/progress-feed.js';

const feed = JSON.parse(await readFile(new URL('../data/progress.json', import.meta.url)));
const repo = feed.repositories.find(entry => entry.repository === 'TheJollyLaMa/DecentHead');
const selection = { repository: repo.repository, title: 'DecentHead', version: repo.versions[0] };
const buyer = `0x${'1'.repeat(40)}`;
const hash = `0x${'2'.repeat(64)}`;
const listing = { nftContract: SUPPORTER_NFT, tokenId: BigInt(selection.version.tokenId),
  priceETH: 0n, priceToken: BASE_USDC, priceAmount: 10000000n, available: 9n, active: true };
function setup(options = {}) {
  const chosen = options.selection || selection;
  const price = BigInt(chosen.version.storefront.priceUSDC);
  const calls = [], messages = [], txs = [];
  const state = { address: options.disconnected ? null : buyer, generation: 1, chain: options.chain || '0x2105',
    allowance: options.allowance || 0n, listing: { ...listing, priceAmount: price, ...options.listing }, checks: 0 };
  const raw = { request: async ({ method, params }) => {
    calls.push([method, params]);
    if (method === 'eth_chainId') return state.chain;
    if (method === 'eth_accounts') return [state.address];
    if (method === 'wallet_switchEthereumChain') { state.chain = '0x2105'; state.generation++; return null; }
    throw new Error(`Unexpected wallet method ${method}`);
  } };
  const session = { snapshot: () => ({ ...state, rawProvider: state.address ? raw : null }),
    connect: async () => { calls.push(['connect']); if (options.rejectConnect) throw { code: 4001 }; state.address = buyer; } };
  const escrow = {
    getListing: async () => { calls.push(['listing']); state.checks++; if (state.checks > 1 && options.afterApproval) Object.assign(state.listing, options.afterApproval); return state.listing; },
    getNFTBalance: async () => options.stock ?? 9n, paused: async () => options.paused || false,
    connect: () => escrow,
    interface: { parseLog: () => ({ name: 'Purchased', args: { listingId: BigInt(selection.version.storefront.listingId),
      buyer: options.wrongBuyer ? `0x${'3'.repeat(40)}` : buyer, amount: 1n, paymentToken: BASE_USDC, totalPaid: options.eventPrice ?? price } }) },
  };
  escrow.purchaseWithToken = Object.assign(async (id, quantity) => {
    calls.push(['purchase', id, quantity]); if (options.rejectPurchase) throw { code: 'ACTION_REJECTED' };
    return { hash, wait: async () => {
      if (options.waitError) throw options.waitError;
      return { status: options.failedPurchase ? 0 : 1, hash, logs: options.noEvent ? [] : [{ address: SUPPORTER_ESCROW }] };
    } };
  }, { estimateGas: async () => { calls.push(['estimate']); if (options.estimateError) throw new Error('Insufficient ETH for gas'); } });
  const token = {
    balanceOf: async () => options.balance ?? 10000000n, allowance: async () => state.allowance,
    approve: async (spender, amount) => {
      calls.push(['approve', spender, amount]); if (options.rejectApproval) throw { code: 4001 };
      return { hash, wait: async () => {
        state.allowance = amount;
        if (options.accountChange) { state.address = `0x${'4'.repeat(40)}`; state.generation++; }
        if (options.chainChange) { state.chain = '0x1'; state.generation++; }
        return { status: options.failedApproval ? 0 : 1 };
      } };
    },
  };
  const ethers = {
    BrowserProvider: class {
      getNetwork = async () => ({ chainId: options.wrongNetwork ? 1n : 8453n });
      getSigner = async () => ({ getAddress: async () => buyer });
      destroy = () => calls.push(['destroy']);
    },
    Contract: class { constructor(address) { return address === SUPPORTER_ESCROW ? escrow : token; } },
  };
  const run = () => purchaseEdition(chosen, session, { ethers, onStatus: text => messages.push(text), onTransaction: tx => txs.push(tx) });
  return { run, calls, messages, txs, state, raw, ethers };
}
test('purchase uses existing session, approves exactly 10 USDC, rechecks, buys one and requires confirmed event', async () => {
  const h = setup();
  assert.deepEqual(await h.run(), { hash, buyer });
  assert.deepEqual(h.calls.find(call => call[0] === 'approve'), ['approve', SUPPORTER_ESCROW, 10000000n]);
  assert.deepEqual(h.calls.find(call => call[0] === 'purchase'), ['purchase', selection.version.storefront.listingId, 1n]);
  assert.equal(h.calls.filter(call => call[0] === 'listing').length, 2);
  assert.equal(h.calls.filter(call => call[0] === 'connect').length, 0);
  assert.deepEqual(h.txs.map(tx => tx.stage), ['approval', 'purchase']);
  assert.equal(h.calls.at(-1)[0], 'destroy');
});
test('100-USDC edition binds route and live price, approves exactly 100000000 and verifies paid amount', async () => {
  const chosen = structuredClone(selection), store = chosen.version.storefront;
  store.priceUSDC = '100000000';
  store.purchaseUrl += '&priceUSDC=100000000';
  assert.ok(isVersionStorefront(store, chosen.version, chosen.repository));
  assert.equal(isVersionStorefront({ ...store, purchaseUrl: selection.version.storefront.purchaseUrl }, chosen.version, chosen.repository), false);
  assert.equal(isVersionStorefront({ ...store, purchaseUrl: store.purchaseUrl + '&priceUSDC=100000000' }, chosen.version, chosen.repository), false);
  const h = setup({ selection: chosen, balance: 100000000n, allowance: 10000000n });
  await h.run();
  assert.deepEqual(h.calls.find(call => call[0] === 'approve'), ['approve', SUPPORTER_ESCROW, 100000000n]);
  assert.ok(h.messages.some(text => text.includes('Approve exactly 100 USDC')));
  await assert.rejects(setup({ selection: chosen, balance: 100000000n, eventPrice: 10000000n }).run(), /expected purchase event/);
  for (const options of [{ balance: 10000000n }, { listing: { priceAmount: 10000000n } }]) {
    const blocked = setup({ selection: chosen, ...options });
    await assert.rejects(blocked.run());
    assert.ok(!blocked.calls.some(call => ['approve', 'purchase'].includes(call[0])));
  }
});
test('existing allowance skips approval, new wallet connects only inside buy, and Base switches explicitly', async () => {
  const h = setup({ allowance: 10000000n, disconnected: true, chain: '0x1' });
  await h.run();
  assert.equal(h.calls.filter(call => call[0] === 'approve').length, 0);
  assert.equal(h.calls.filter(call => call[0] === 'connect').length, 1);
  assert.equal(h.calls.filter(call => call[0] === 'wallet_switchEthereumChain').length, 1);
});
test('changed token/price, sold out, no escrow stock, pause, wrong network and insufficient funds never write', async () => {
  for (const options of [
    { listing: { tokenId: 999n } }, { listing: { nftContract: buyer } },
    { listing: { priceAmount: 1n } }, { listing: { priceETH: 1n } }, { listing: { priceToken: buyer } },
    { listing: { active: false } }, { listing: { available: 0n } }, { stock: 0n }, { paused: true },
    { wrongNetwork: true }, { balance: 1n },
  ]) {
    const h = setup(options);
    await assert.rejects(h.run());
    assert.ok(!h.calls.some(call => ['approve', 'purchase'].includes(call[0])), JSON.stringify(options, (_, value) => typeof value === 'bigint' ? String(value) : value));
  }
});
test('account/network changes and changed listing after approval stop purchase', async () => {
  for (const options of [{ accountChange: true }, { chainChange: true }, { afterApproval: { priceAmount: 1n } },
    { afterApproval: { tokenId: 99n } }, { afterApproval: { available: 0n } }]) {
    const h = setup(options);
    await assert.rejects(h.run());
    assert.equal(h.calls.filter(call => call[0] === 'purchase').length, 0);
  }
});
test('rejected approvals/purchases, reverted receipts, replacement, gas failure and absent/mismatched events never return success', async () => {
  for (const options of [{ rejectConnect: true, disconnected: true }, { rejectApproval: true }, { failedApproval: true },
    { rejectPurchase: true }, { failedPurchase: true }, { noEvent: true }, { wrongBuyer: true },
    { estimateError: true }, { waitError: { code: 'TRANSACTION_REPLACED' } }]) {
    await assert.rejects(setup(options).run());
  }
  assert.match(checkoutError({ code: 4001 }), /declined/);
  assert.match(checkoutError({ code: 'TRANSACTION_REPLACED' }), /Check its explorer history/);
});
test('review validates live listing without a wallet; prepared/unapproved edition never passes', async () => {
  const h = setup();
  const runner = new h.ethers.BrowserProvider();
  await inspectListing(selection, runner, h.ethers);
  assert.equal(h.calls.filter(call => ['connect', 'approve', 'purchase'].includes(call[0])).length, 0);
  assert.throws(() => validateEdition({ ...selection, version: { ...selection.version, storefront: null } }));
  assert.throws(() => validateListing(listing, 1n, false, { ...selection, repository: 'evil/repo' }));
});
test('Base add-chain fallback requires explicit switch and propagates denial', async () => {
  let chain = '0x1', switches = 0;
  const methods = [];
  const raw = { request: async ({ method }) => {
    methods.push(method);
    if (method === 'eth_chainId') return chain;
    if (method === 'wallet_switchEthereumChain') {
      if (!switches++) throw { code: 4902 };
      chain = '0x2105';
    }
  } };
  await ensureBase(raw);
  assert.ok(methods.includes('wallet_addEthereumChain'));
  await assert.rejects(ensureBase({ request: async ({ method }) => {
    if (method === 'eth_chainId') return '0x1';
    throw { code: 4001 };
  } }));
});
