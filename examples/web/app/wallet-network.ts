import type { WalletClient } from 'viem';
import { demoNetwork } from './demo-network';

function isUnknownChain(error: unknown): boolean {
  let current = error;
  for (
    let depth = 0;
    depth < 8 && current && typeof current === 'object';
    depth++
  ) {
    if ('code' in current && current.code === 4902) return true;
    current = 'cause' in current ? current.cause : undefined;
  }
  return false;
}

/** Add the selected network only when the wallet says it is unknown. */
export async function switchToDemoChain(
  wallet: Pick<WalletClient, 'switchChain' | 'addChain'>,
): Promise<void> {
  try {
    await wallet.switchChain({ id: demoNetwork.chain.id });
  } catch (error) {
    if (!isUnknownChain(error)) throw error;
    await wallet.addChain({ chain: demoNetwork.chain });
    await wallet.switchChain({ id: demoNetwork.chain.id });
  }
}

/** True when `candidate` is the connected wallet (case-insensitive). */
export function isConnectedWallet(
  connected: string | null | undefined,
  candidate: string,
): boolean {
  return !!connected && connected.toLowerCase() === candidate.toLowerCase();
}

/** Ignore delayed notifications for the wallet and chain already selected. */
export function walletSelectionChanged(
  address: string | null | undefined,
  event: 'accountsChanged' | 'chainChanged',
  value: unknown,
): boolean {
  if (!address) return false;
  if (event === 'accountsChanged')
    return !(
      Array.isArray(value) &&
      typeof value[0] === 'string' &&
      value[0].toLowerCase() === address.toLowerCase()
    );
  return !(typeof value === 'string' && Number(value) === demoNetwork.chain.id);
}
