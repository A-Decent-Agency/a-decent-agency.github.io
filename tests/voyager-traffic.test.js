import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoyagerTraffic, mountVoyagerTraffic, requestIds, rewardLogIds, REWARD_EVENTS, VOYAGER_GAME_ID } from '../js/voyager-traffic.js';

const emptyStamps = () => ({ pending: [], minted: [] });
const emptyPrizes = () => ({ pending: [], settled: [] });
const log = (index = 0, patch = {}) => ({ address: REWARD_EVENTS[0].address,
  topics: [REWARD_EVENTS[0].topic, VOYAGER_GAME_ID, `0x${'c'.repeat(64)}`, `0x${'d'.repeat(64)}`], blockNumber: '0x65', logIndex: `0x${index.toString(16)}`,
  transactionHash: `0x${'a'.repeat(64)}`, blockHash: `0x${'b'.repeat(64)}`, removed: false, ...patch });

test('public request identities dedupe queue transitions but never invent identifiers', () => {
  const record = { recordId: 'one' }, prize = { voucher: { claimId: 'two' } };
  assert.deepEqual([...requestIds({ pending: [record], minted: [record] }, { pending: [prize], settled: [prize] })],
    ['stamp:one', 'prize:two']);
  for (const value of [null, [], { pending: [], minted: 'unknown' }, { pending: [{}], minted: [] }]) {
    assert.throws(() => requestIds(value, emptyPrizes()), /Invalid|identity/);
  }
});

test('only exact deployed-contract, game-qualified, confirmed reward events count once', () => {
  assert.equal(rewardLogIds([log(), log(), log(1)], 101, 105).size, 2);
  for (const patch of [{ address: '0xunknown' }, { topics: log().topics.with(1, `0x${'0'.repeat(64)}`) }, { topics: log().topics.slice(0, 2) },
    { blockNumber: '0x64' }, { blockNumber: '0x6a' }, { removed: true }, { blockHash: null }, { transactionHash: 'pending' }]) {
    assert.throws(() => rewardLogIds([log(0, patch)], 101, 105));
  }
});

test('legacy Supporter requests use run/player/token identity across pending/settled transitions', () => {
  const legacy = { runId: 'old-run', player: `0x${'aB'.repeat(20)}`, prize: { tokenId: '075' } };
  const moved = { ...legacy, player: legacy.player.toLowerCase(), tokenId: 75 };
  const ids = requestIds(emptyStamps(), { pending: [legacy], settled: [moved] });
  assert.equal(ids.size, 1);
  assert.match([...ids][0], /legacy:old-run:0x[ab]+:75$/);
  assert.throws(() => requestIds(emptyStamps(), { pending: [{ ...legacy, player: 'unknown' }], settled: [] }), /identity/);
});

function harness() {
  let head = 103, stamps = emptyStamps(), prizes = emptyPrizes(), logs = [], failing = '', calls = [];
  const traffic = [], status = [];
  const response = value => ({ ok: true, text: async () => JSON.stringify(value) });
  const observer = createVoyagerTraffic({
    fetcher: async (url, init) => {
      if (url.includes('githubusercontent')) {
        if (failing === 'requests') return { ok: false, status: 503 };
        return response(url.includes('victory') ? stamps : prizes);
      }
      const body = JSON.parse(init.body); calls.push(body);
      if (failing === 'rewards') return response({ error: { message: 'RPC unavailable' } });
      return response({ result: body.method === 'eth_chainId' ? '0x2105' :
        body.method === 'eth_blockNumber' ? `0x${head.toString(16)}` : logs });
    },
    onTraffic: (kind, count) => traffic.push([kind, count]), onStatus: value => status.push(value)
  });
  return { observer, traffic, status, calls, set: value => {
    if ('head' in value) head = value.head;
    if ('stamps' in value) stamps = value.stamps;
    if ('prizes' in value) prizes = value.prizes;
    if ('logs' in value) logs = value.logs;
    if ('failing' in value) failing = value.failing;
  } };
}

test('first load is baseline; new requests arrive and real claims depart without old history', async () => {
  const h = harness();
  h.set({ stamps: { pending: [{ recordId: 'old' }], minted: [] } });
  await h.observer.poll();
  assert.deepEqual(h.traffic, []);
  h.set({ head: 106, stamps: { pending: [{ recordId: 'new' }], minted: [{ recordId: 'old' }] },
    prizes: { pending: [{ voucher: { claimId: 'bundle' } }], settled: [] }, logs: [log(), log()] });
  await h.observer.poll();
  assert.deepEqual(h.traffic, [['arrival', 2], ['departure', 1]]);
  const filter = h.calls.find(call => call.method === 'eth_getLogs').params[0];
  assert.equal(filter.toBlock, '0x67', 'three-block confirmation depth');
  assert.equal(filter.topics[1], VOYAGER_GAME_ID);
  assert.equal(filter.address.length, 3);
  h.set({ logs: [], stamps: { pending: [], minted: [{ recordId: 'new' }, { recordId: 'old' }] } });
  await h.observer.poll();
  assert.equal(h.traffic.length, 2, 'queue state changes and unchanged head do not repeat flights');
  h.observer.dispose();
});

test('failed sources retain cursors independently, report unavailable and recover without losing events', async () => {
  const h = harness(); await h.observer.poll();
  h.set({ failing: 'rewards', head: 106, stamps: { pending: [{ recordId: 'request' }], minted: [] } });
  await h.observer.poll();
  assert.deepEqual(h.traffic, [['arrival', 1]]);
  assert.match(h.status.at(-1).rewards, /unavailable/);
  h.set({ failing: 'requests', logs: [log()] });
  await h.observer.poll();
  assert.deepEqual(h.traffic, [['arrival', 1], ['departure', 1]]);
  assert.match(h.status.at(-1).requests, /unavailable/);
  h.set({ failing: '', stamps: { pending: [{ recordId: 'request' }, { recordId: 'recovered' }], minted: [] } });
  await h.observer.poll();
  assert.deepEqual(h.traffic.at(-1), ['arrival', 1]);
  h.observer.dispose();
});

test('bounded log scans catch up in chunks without skipping, and pause on backward heads', async () => {
  const h = harness(); await h.observer.poll();
  h.set({ head: 2000 }); await h.observer.poll(); await h.observer.poll();
  const scans = h.calls.filter(call => call.method === 'eth_getLogs').map(call => call.params[0]);
  assert.deepEqual(scans.map(scan => [Number(scan.fromBlock), Number(scan.toBlock)]), [[101, 600], [601, 1100]]);
  h.set({ head: 100 }); await h.observer.poll();
  assert.match(h.status.at(-1).rewards, /moved backwards/);
  h.observer.dispose();
});

test('disposal aborts observation and emits no late traffic/status callbacks', async () => {
  let release, signal;
  const reports = [];
  const observer = createVoyagerTraffic({
    fetcher: (url, init) => {
      signal = init.signal;
      return new Promise(resolve => { release = resolve; init.signal.addEventListener('abort', () => resolve({ ok: false, status: 499 })); });
    }, onStatus: value => reports.push(value), onTraffic: value => reports.push(value)
  });
  const poll = observer.poll();
  observer.dispose();
  assert.equal(signal.aborted, true);
  await poll;
  assert.deepEqual(reports, []);
  assert.ok(release);
});

test('mount pauses hidden polling, flushes lazy-scene backlog and does not resurrect timers after dispose', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const documentImpl = new EventTarget(); documentImpl.hidden = true;
  const statusElement = { textContent: '', dataset: {} };
  let requests = 0, scene, stamps = emptyStamps();
  const delivered = [];
  const mounted = mountVoyagerTraffic({ getScene: () => scene, documentImpl, statusElement,
    fetcher: async (url, init) => {
      requests++;
      const method = init?.body && JSON.parse(init.body).method;
      const value = url.includes('githubusercontent') ? url.includes('victory') ? stamps : emptyPrizes() :
        { result: method === 'eth_chainId' ? '0x2105' : '0x67' };
      return { ok: true, text: async () => JSON.stringify(value) };
    } });
  await mounted.refresh(); assert.equal(requests, 0);
  documentImpl.hidden = false; await mounted.refresh();
  stamps = { pending: [{ recordId: 'new' }], minted: [] };
  await mounted.refresh();
  scene = { enqueueVoyagerTraffic: (...args) => delivered.push(args) };
  await mounted.refresh();
  assert.deepEqual(delivered, [['arrival', 1]]);
  assert.equal(statusElement.dataset.state, 'observed');
  documentImpl.hidden = true; documentImpl.dispatchEvent(new Event('visibilitychange'));
  const before = requests; t.mock.timers.tick(60000); await mounted.refresh();
  assert.equal(requests, before);
  mounted.dispose();
  documentImpl.hidden = false; documentImpl.dispatchEvent(new Event('visibilitychange'));
  t.mock.timers.tick(60000); await mounted.refresh();
  assert.equal(requests, before);
});
