// Self-contained adapter surface for the future vendored DecentHead vNext.
export function initHeader({ openHouse, openAbout, notify }) {
  document.querySelector('#house-button').addEventListener('click', openHouse);
  document.querySelector('#about-button').addEventListener('click', openAbout);
  const providers = new Map();
  let current, observed, busy = false, generation = 0, connecting;
  const button = document.querySelector('#wallet-button');
  const update = (accounts = []) => {
    generation++;
    const address = accounts[0];
    current = address || null;
    button.classList.toggle('connected', !!address);
    const label = button.querySelector('span:not(.head-orb)');
    label.replaceChildren(document.createTextNode(address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Connect wallet'));
    const small = document.createElement('small');
    small.textContent = address ? 'Connected · purchases require your approval' : 'No wallet needed to explore';
    label.append(small);
    window.dispatchEvent(new CustomEvent('decent:wallet-change', { detail: { address: current } }));
  };
  window.addEventListener('eip6963:announceProvider', event => {
    const { info, provider } = event.detail || {};
    if (info?.uuid && provider?.request) providers.set(info.uuid, { info, provider });
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  const invalidate = () => { generation++; window.dispatchEvent(new CustomEvent('decent:wallet-change', { detail: { address: current } })); };
  const disconnect = () => update([]);
  const connect = () => {
    if (connecting) return connecting;
    connecting = connectWallet().finally(() => { connecting = null; });
    return connecting;
  };
  async function connectWallet() {
    busy = true;
    button.disabled = true;
    try {
      const discovered = [...providers.values()];
      let provider;
      if (discovered.length > 1) {
        // A plain chooser avoids trusting wallet-supplied icons / HTML.
        const choice = window.prompt(`Choose a wallet:\n${discovered.map((p, i) => `${i + 1}. ${p.info.name}`).join('\n')}`, '1');
        if (choice === null) return;
        provider = discovered[Number(choice) - 1]?.provider;
        if (!provider) throw new Error('Choose a listed wallet number.');
      } else provider = discovered[0]?.provider || window.ethereum;
      if (!provider) throw new Error('No wallet found. Enable an EIP-6963 compatible browser wallet. Exploring is always wallet-free.');
      const { BrowserProvider } = await import('ethers');
      const ethersProvider = new BrowserProvider(provider, 'any');
      let accounts;
      try { accounts = await ethersProvider.send('eth_requestAccounts', []); }
      finally { ethersProvider.destroy(); }
      if (!accounts?.length) throw new Error('Wallet returned no accounts.');
      update(accounts);
      if (observed !== provider) {
        observed?.removeListener?.('accountsChanged', update);
        observed?.removeListener?.('chainChanged', invalidate);
        observed?.removeListener?.('disconnect', disconnect);
        provider.on?.('accountsChanged', update);
        provider.on?.('chainChanged', invalidate);
        provider.on?.('disconnect', disconnect);
        observed = provider;
      }
      notify('Connected. No signature, transaction, or network switch requested.');
      return session.snapshot();
    }
    finally { button.disabled = false; busy = false; }
  }
  const session = {
    snapshot: () => ({ address: current, rawProvider: current ? observed : null, generation }),
    connect,
  };
  button.addEventListener('click', async () => {
    if (busy) return;
    try { await connect(); }
    catch (error) { notify(error.code === 4001 || error.code === 'ACTION_REJECTED' ? 'Connection declined. Nothing changed.' : error.message); }
  });
  return session;
}
