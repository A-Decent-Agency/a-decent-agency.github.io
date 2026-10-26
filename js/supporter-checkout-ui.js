import { escapeHTML as esc } from './markdown.js';
import { mintArtworkPath, supporterPriceLabel } from './progress-feed.js';
import { validateEdition, readEdition, purchaseEdition, checkoutError } from './supporter-checkout.js';

export function mountSupporterCheckout({ dialog, session, onOpen, notify }) {
  const status = dialog.querySelector('[data-checkout-status]');
  const buy = dialog.querySelector('[data-checkout-buy]');
  const close = dialog.querySelector('.dialog-close');
  const flip = dialog.querySelector('[data-checkout-flip]');
  const image = dialog.querySelector('[data-checkout-image]');
  const transactions = dialog.querySelector('[data-checkout-transactions]');
  const outcomes = new Map();
  let selection, busy = false, request = 0, face = 'front', opener;
  const key = value => `${value.repository}/${value.version.tag}/${value.version.tokenId}`;
  const message = (text, error = false) => {
    status.textContent = text; status.setAttribute('role', error ? 'alert' : 'status');
  };
  const showFace = () => {
    image.hidden = false; image.src = mintArtworkPath(selection.version.storefront, face);
    image.alt = `${selection.title} ${selection.version.tag} Supporter edition ${face}`;
    flip.textContent = `Show ${face === 'front' ? 'back' : 'front'}`;
  };
  const transaction = ({ stage, hash }) => {
    if (!/^0x[\da-fA-F]{64}$/.test(hash)) throw new Error('Wallet returned an invalid transaction hash. Check wallet activity before retrying.');
    const anchor = document.createElement('a');
    anchor.href = `https://basescan.org/tx/${hash}`; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
    anchor.textContent = `${stage === 'approval' ? 'USDC approval' : 'Purchase'} transaction on Base`;
    const line = document.createElement('p'); line.append(anchor); transactions.append(line);
    if (stage === 'purchase') outcomes.set(key(selection), { message: 'Purchase was submitted. Check its Base transaction before attempting another purchase.', hash });
  };
  const updateWallet = () => {
    const address = session.snapshot().address;
    dialog.querySelector('[data-checkout-wallet]').textContent = address ? `Selected wallet: ${address}` : 'No wallet connected. Buy will ask you to connect using DecentHead.';
  };
  window.addEventListener('decent:wallet-change', updateWallet);
  image.addEventListener('error', () => { image.hidden = true; notify('Edition artwork unavailable. Token details and purchase controls remain available.'); });
  flip.addEventListener('click', () => { face = face === 'front' ? 'back' : 'front'; showFace(); });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => {
    request++;
    if (opener?.isConnected) opener.focus();
  });
  buy.addEventListener('click', async () => {
    if (busy || !selection || outcomes.has(key(selection))) return;
    busy = true; buy.disabled = true; close.disabled = true;
    try {
      const result = await purchaseEdition(selection, session, { onStatus: message, onTransaction: transaction });
      const text = `Purchase confirmed on Base. One ${selection.title} ${selection.version.tag} edition was purchased by ${result.buyer}.`;
      outcomes.set(key(selection), { message: text, hash: result.hash });
      message(text);
      buy.textContent = 'Purchased';
    } catch (error) {
      console.error('[Supporter checkout]', error);
      message(checkoutError(error), true);
      if (outcomes.has(key(selection))) outcomes.get(key(selection)).message = `${status.textContent} Check the submitted purchase transaction below before retrying.`;
    } finally {
      busy = false; close.disabled = false;
      buy.disabled = outcomes.has(key(selection));
      updateWallet();
    }
  });
  return {
    async open(value) {
      if (busy) { notify('A checkout is already awaiting your wallet or Base confirmation.'); return; }
      try { validateEdition(value); }
      catch (error) { notify(error.message); return; }
      selection = value; opener = document.activeElement; const current = ++request;
      onOpen?.(); face = 'front'; transactions.replaceChildren(); showFace();
      dialog.querySelector('[data-checkout-title]').textContent = `${value.title} ${value.version.tag}`;
      dialog.querySelector('[data-checkout-token]').textContent = `Base · ERC-1155 · token ${value.version.tokenId} · listing ${value.version.storefront.listingId}`;
      dialog.querySelector('[data-checkout-evidence]').innerHTML = `<a href="${esc(value.version.storefront.evidenceUrl)}" target="_blank" rel="noopener noreferrer">Published listing evidence ↗</a>`;
      const priceLabel = supporterPriceLabel(value.version.storefront.priceUSDC);
      updateWallet(); buy.disabled = true; buy.textContent = `Buy one · ${priceLabel} + gas`;
      if (!dialog.open) dialog.showModal();
      const prior = outcomes.get(key(value));
      if (prior) {
        message(prior.message);
        transaction({ stage: 'purchase', hash: prior.hash });
        outcomes.set(key(value), prior);
        return;
      }
      message('Checking live listing, token, price, stock and pause state on Base…');
      try {
        const { listing } = await readEdition(value);
        if (current !== request || !dialog.open) return;
        message(`Available on Base: ${listing.available} listed edition(s). Buy one for ${priceLabel} plus network gas. Your wallet opens only when you choose Buy.`);
        buy.disabled = false;
      } catch (error) {
        if (current !== request || !dialog.open) return;
        console.error('[Supporter listing]', error); message(`Purchase unavailable: ${checkoutError(error)}`, true);
      }
    },
  };
}
