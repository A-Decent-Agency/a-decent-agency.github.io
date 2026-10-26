import { isDeliveredVersion, isVersionStorefront, SUPPORTER_ESCROW, SUPPORTER_NFT, supporterPriceLabel } from './progress-feed.js';

// Adapted from DecentHead supporter-purchase.js / AboutModal.js, Apache-2.0.
export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const BASE_CHAIN = { chainId: '0x2105', chainName: 'Base',
  rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'],
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } };
export const ESCROW_ABI = [
  'function getListing(uint256) view returns (tuple(address nftContract,uint256 tokenId,uint256 priceETH,address priceToken,uint256 priceAmount,uint256 available,bool active,string note))',
  'function getNFTBalance(address,uint256) view returns (uint256)',
  'function paused() view returns (bool)',
  'function purchaseWithToken(uint256,uint256)',
  'event Purchased(uint256 indexed listingId,address indexed buyer,uint256 amount,address indexed paymentToken,uint256 totalPaid)',
];
export const USDC_ABI = [
  'function allowance(address,address) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
];
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
export function validateEdition(selection) {
  if (!selection || !isDeliveredVersion(selection.version, selection.repository)
    || !isVersionStorefront(selection.version.storefront, selection.version, selection.repository)) {
    throw new Error('This edition has no approved purchase evidence. Refresh the project map.');
  }
  return selection.version.storefront;
}
export function validateListing(listing, stock, paused, selection) {
  const store = validateEdition(selection);
  if (!equal(listing.nftContract, SUPPORTER_NFT) || listing.tokenId !== BigInt(selection.version.tokenId)) throw new Error('Listing token does not match this project edition.');
  if (paused) throw new Error('Supporter sales are paused.');
  if (!listing.active || listing.available < 1n || stock < 1n) throw new Error('This Supporter edition is sold out or not available.');
  if (!equal(listing.priceToken, BASE_USDC) || listing.priceETH !== 0n || listing.priceAmount !== BigInt(store.priceUSDC)) throw new Error(`Listing price changed. Only the displayed ${supporterPriceLabel(store.priceUSDC)} on Base is approved.`);
  return listing;
}
export async function inspectListing(selection, runner, ethers) {
  const store = validateEdition(selection);
  if ((await runner.getNetwork()).chainId !== 8453n) throw new Error('Listing provider is not on Base.');
  const escrow = new ethers.Contract(SUPPORTER_ESCROW, ESCROW_ABI, runner);
  const listing = await escrow.getListing(store.listingId);
  const [stock, paused] = await Promise.all([
    escrow.getNFTBalance(SUPPORTER_NFT, selection.version.tokenId), escrow.paused(),
  ]);
  validateListing(listing, stock, paused, selection);
  return { listing, escrow, stock };
}
export async function readEdition(selection) {
  const ethers = await import('ethers');
  const provider = new ethers.JsonRpcProvider(BASE_CHAIN.rpcUrls[0], undefined, { batchMaxCount: 1 });
  try { return await inspectListing(selection, provider, ethers); }
  finally { provider.destroy(); }
}
export async function ensureBase(raw) {
  if (BigInt(await raw.request({ method: 'eth_chainId' })) === 8453n) return;
  try {
    await raw.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN.chainId }] });
  } catch (error) {
    if (Number(error.code ?? error.data?.originalError?.code) !== 4902) throw error;
    await raw.request({ method: 'wallet_addEthereumChain', params: [BASE_CHAIN] });
    await raw.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN.chainId }] });
  }
  if (BigInt(await raw.request({ method: 'eth_chainId' })) !== 8453n) throw new Error('Wallet did not switch to Base.');
}
export async function purchaseEdition(selection, session, { ethers, onStatus = () => {}, onTransaction = () => {} } = {}) {
  const store = validateEdition(selection);
  const price = BigInt(store.priceUSDC), priceLabel = supporterPriceLabel(store.priceUSDC);
  ethers ||= await import('ethers');
  if (!session.snapshot().address) {
    onStatus('Connect your wallet to buy this edition…');
    await session.connect();
  }
  const connected = session.snapshot();
  if (!connected.address || !connected.rawProvider) throw new Error('Connect a wallet using the DecentHead control first.');
  onStatus('Checking Base network in your selected wallet…');
  await ensureBase(connected.rawProvider);
  const locked = session.snapshot();
  if (locked.rawProvider !== connected.rawProvider || !equal(locked.address, connected.address)) throw new Error('Wallet account changed. Review and try again.');
  const guard = async () => {
    const accounts = await locked.rawProvider.request({ method: 'eth_accounts' });
    const chain = await locked.rawProvider.request({ method: 'eth_chainId' });
    const now = session.snapshot();
    if (now.rawProvider !== locked.rawProvider || now.generation !== locked.generation
      || !equal(now.address, locked.address) || !equal(accounts?.[0], locked.address) || BigInt(chain) !== 8453n) {
      throw new Error('Wallet account or network changed. Review this edition and try again.');
    }
  };
  const provider = new ethers.BrowserProvider(locked.rawProvider, 'any');
  try {
    await guard();
    const signer = await provider.getSigner(locked.address);
    if (!equal(await signer.getAddress(), locked.address)) throw new Error('Wallet signer does not match the selected account.');
    const token = new ethers.Contract(BASE_USDC, USDC_ABI, signer);
    onStatus('Checking live listing, price, pause state and escrow stock…');
    const check = () => inspectListing(selection, provider, ethers);
    await check();
    if (await token.balanceOf(locked.address) < price) throw new Error(`Insufficient Base USDC. One edition costs ${priceLabel}; Base ETH is also needed for gas.`);
    if (await token.allowance(locked.address, SUPPORTER_ESCROW) < price) {
      await guard();
      onStatus(`Approve exactly ${priceLabel} for the approved escrow in your wallet. A separate purchase confirmation follows.`);
      const approval = await token.approve(SUPPORTER_ESCROW, price);
      onTransaction({ stage: 'approval', hash: approval.hash });
      const receipt = await approval.wait();
      if (receipt?.status !== 1) throw new Error('USDC approval did not confirm successfully. No purchase submitted.');
      onStatus(`${priceLabel} approval confirmed. Rechecking the edition before purchase…`);
    }
    await guard();
    const { escrow } = await check();
    if (await token.balanceOf(locked.address) < price || await token.allowance(locked.address, SUPPORTER_ESCROW) < price) throw new Error('USDC balance or approval is insufficient. No purchase submitted.');
    await guard();
    const purchase = escrow.connect(signer);
    await purchase.purchaseWithToken.estimateGas(store.listingId, 1n);
    await guard();
    onStatus(`Confirm purchase of one edition for ${priceLabel} plus gas in your wallet…`);
    const tx = await purchase.purchaseWithToken(store.listingId, 1n);
    onTransaction({ stage: 'purchase', hash: tx.hash });
    onStatus('Purchase submitted. Waiting for Base confirmation; do not submit another purchase.');
    const receipt = await tx.wait();
    if (receipt?.status !== 1) throw new Error('Purchase transaction did not confirm successfully.');
    const event = receipt.logs.filter(log => equal(log.address, SUPPORTER_ESCROW)).some(log => {
      const parsed = escrow.interface.parseLog(log);
      return parsed?.name === 'Purchased' && parsed.args.listingId === BigInt(store.listingId)
        && equal(parsed.args.buyer, locked.address) && parsed.args.amount === 1n
        && equal(parsed.args.paymentToken, BASE_USDC) && parsed.args.totalPaid === price;
    });
    if (!event) throw new Error('Transaction confirmed but the expected purchase event was not found. Check the transaction before retrying.');
    return { hash: receipt.hash || tx.hash, buyer: locked.address };
  } finally { provider.destroy(); }
}

export function checkoutError(error) {
  if (error.code === 'TRANSACTION_REPLACED') return 'Transaction replaced or cancelled. Check its explorer history before retrying; no purchase confirmation is claimed here.';
  if (error.code === 4001 || error.code === 'ACTION_REJECTED' || error.info?.error?.code === 4001) return 'Wallet request declined. No purchase confirmation is claimed. Any already-confirmed USDC approval remains in place.';
  return error.shortMessage || error.message || 'Checkout failed. Check any submitted transaction before retrying.';
}
