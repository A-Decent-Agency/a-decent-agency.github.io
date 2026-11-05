export const VOYAGER_REPOSITORY = 'TheJollyLaMa/DecentVoyager';
export const VOYAGER_RPC = 'https://base-rpc.publicnode.com';
export const VOYAGER_GAME_ID = '0x9bd3cd8b09e18e8dfe9804105946a3ee573fd786b3d4de6e665a3a38ac1dd185';
export const REWARD_EVENTS = Object.freeze([
  { address: '0xCa55A59BD2c15D0F11Ae5f7e7E96Bb58eb0B7DE5', topic: '0xd7dcad1c06d9462f1ec99b5b3e20fb86191031cfca9b8c78d6dd7c6cf0223b52' },
  { address: '0x4584c9D9b7C2bFc13b2c762d3ECD2a068d2bEd1a', topic: '0xf6cda753bde72555ae04d77ccf7deeb4c58d9b4842744291acb7f190609def91' },
  { address: '0x66E8DB66F074D2eb8910160f374D74958436cE4f', topic: '0x68a977aa0ce5b1fdce2179f771056fe52e3ff1dab0e548b5abf92e2eb3befe6b' }
]);
const ROOT = 'https://raw.githubusercontent.com/TheJollyLaMa/DecentVoyager/main/';
const HASH = /^0x[\da-f]{64}$/i;
const HEX = /^0x[\da-f]+$/i;

export function requestIds(stamps, prizes) {
  const ids = new Set();
  for (const [kind, doc, completed] of [['stamp', stamps, 'minted'], ['prize', prizes, 'settled']]) {
    if (!doc || !Array.isArray(doc.pending) || !Array.isArray(doc[completed]) ||
        doc.pending.length + doc[completed].length > 10000) throw new Error(`Invalid public ${kind} queue`);
    for (const entry of [...doc.pending, ...doc[completed]]) {
      let id = kind === 'stamp' ? entry?.recordId || entry?.record?.id : entry?.voucher?.claimId || entry?.id;
      if (!id && kind === 'prize') {
        const token = entry?.tokenId ?? entry?.prize?.tokenId;
        if (typeof entry?.runId === 'string' && entry.runId && /^0x[\da-f]{40}$/i.test(entry.player) &&
            /^\d+$/.test(String(token))) {
          id = `legacy:${entry.runId}:${entry.player.toLowerCase()}:${BigInt(token)}`;
        }
      }
      if (typeof id !== 'string' || !id || id.length > 200) throw new Error(`Public ${kind} request has no stable identity`);
      ids.add(`${kind}:${id}`);
    }
  }
  return ids;
}

export function rewardLogIds(logs, from, to) {
  if (!Array.isArray(logs) || logs.length > 10000) throw new Error('Invalid Base reward log response');
  const ids = new Set();
  for (const log of logs) {
    const source = REWARD_EVENTS.find(event => event.address.toLowerCase() === log.address?.toLowerCase());
    if (!source || !Array.isArray(log.topics) || log.topics.length !== 4 || !log.topics.every(topic => HASH.test(topic)) ||
        log.topics[0].toLowerCase() !== source.topic || log.topics[1].toLowerCase() !== VOYAGER_GAME_ID || log.removed ||
        !HASH.test(log.transactionHash) || !HASH.test(log.blockHash) ||
        !HEX.test(log.logIndex) || !HEX.test(log.blockNumber)) throw new Error('Unverified Base reward event');
    const block = Number(log.blockNumber);
    if (!Number.isSafeInteger(block) || block < from || block > to) throw new Error('Reward event outside confirmed range');
    ids.add(`${log.transactionHash.toLowerCase()}:${Number(log.logIndex)}`);
  }
  return ids;
}

export function createVoyagerTraffic({ fetcher = fetch, onTraffic = () => {}, onStatus = () => {} } = {}) {
  let requests = null, block = null, busy = false, disposed = false, controller;
  const totals = { arrivals: 0, departures: 0 };
  const status = { requests: 'Not observed', rewards: 'Not observed' };
  async function json(url, init = {}) {
    const response = await fetcher(url, { ...init, signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > 4000000) throw new Error('Public observation exceeds size limit');
    return JSON.parse(text);
  }
  async function rpc(method, params = []) {
    const value = await json(VOYAGER_RPC, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    if (value.error || value.result === undefined) throw new Error(value.error?.message || 'Base RPC result missing');
    return value.result;
  }
  async function poll() {
    if (busy || disposed) return;
    busy = true;
    controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      await Promise.all([
        (async () => {
          try {
            const docs = await Promise.all(['victory-stamps.json', 'payroll-queue.json'].map(file => json(ROOT + file)));
            const next = requestIds(...docs);
            let count = 0;
            if (requests) for (const id of next) if (!requests.has(id)) count++;
            // Retain identities across queue moves/removals so a reappearing request is not a new flight.
            if (!requests) requests = new Set();
            if (requests.size + [...next].filter(id => !requests.has(id)).length > 50000) {
              throw new Error('Request observation memory limit reached; reload to establish a new baseline');
            }
            for (const id of next) requests.add(id);
            totals.arrivals += count;
            if (count && !disposed) onTraffic('arrival', count);
            status.requests = `Public requests checked · ${totals.arrivals} new arrivals this visit`;
          } catch (error) {
            if (!disposed) status.requests = `Requests unavailable · ${error.message} · previous baseline retained`;
          }
        })(),
        (async () => {
          try {
            if (await rpc('eth_chainId') !== '0x2105') throw new Error('Reward observer is not on Base');
            const headHex = await rpc('eth_blockNumber');
            if (!HEX.test(headHex)) throw new Error('Invalid Base head');
            const head = Number(headHex) - 3;
            if (!Number.isSafeInteger(head) || head < 0) throw new Error('Invalid confirmed Base head');
            if (block === null) block = head;
            else if (head < block) throw new Error('Confirmed Base head moved backwards; cursor retained');
            else if (head > block) {
              const from = block + 1, to = Math.min(head, block + 500);
              const logs = await rpc('eth_getLogs', [{
                address: REWARD_EVENTS.map(event => event.address),
                topics: [REWARD_EVENTS.map(event => event.topic), VOYAGER_GAME_ID],
                fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}`
              }]);
              const count = rewardLogIds(logs, from, to).size;
              block = to;
              totals.departures += count;
              if (count && !disposed) onTraffic('departure', count);
            }
            status.rewards = `Base rewards checked through block ${block} · ${totals.departures} confirmed departures this visit${block < head ? ' · catching up' : ''}`;
          } catch (error) {
            if (!disposed) status.rewards = `Rewards unavailable · ${error.message} · confirmed cursor retained`;
          }
        })()
      ]);
      if (!disposed) onStatus({ ...status, ...totals });
    } finally { clearTimeout(timeout); busy = false; }
  }
  return { poll, dispose() { disposed = true; controller?.abort(); } };
}

export function mountVoyagerTraffic({ getScene, statusElement, documentImpl = document, ...options }) {
  let timer, disposed = false, refreshing = false, pending = { arrival: 0, departure: 0 };
  const observer = createVoyagerTraffic({ ...options,
    onTraffic(kind, count) {
      pending[kind] += count;
      flush();
    },
    onStatus(status) {
      statusElement.textContent = `VOYAGER SPACEPORT · ${status.requests} · ${status.rewards}. Baseline starts on opening; flybys are decorative.`;
      statusElement.dataset.state = /unavailable/.test(status.requests + status.rewards) ? 'unavailable' : 'observed';
    }
  });
  function flush() {
    const scene = getScene();
    if (!scene?.enqueueVoyagerTraffic) return;
    for (const kind of ['arrival', 'departure']) {
      if (pending[kind]) scene.enqueueVoyagerTraffic(kind, pending[kind]);
      pending[kind] = 0;
    }
  }
  async function refresh() {
    clearTimeout(timer);
    if (documentImpl.hidden || disposed || refreshing) return;
    refreshing = true;
    try {
      await observer.poll();
      if (!disposed) flush();
    } finally { refreshing = false; }
    if (!documentImpl.hidden && !disposed) timer = setTimeout(refresh, 30000);
  }
  const visibility = () => { clearTimeout(timer); if (!documentImpl.hidden) void refresh(); };
  documentImpl.addEventListener('visibilitychange', visibility);
  void refresh();
  return { refresh, dispose() {
    disposed = true; clearTimeout(timer); observer.dispose(); documentImpl.removeEventListener('visibilitychange', visibility);
  } };
}
