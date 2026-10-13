import {
  createRedemptionClient,
  type RedemptionClient,
  type RenaissSigner,
} from '@renaiss-protocol/client';

import { demoNetwork } from '../demo-network';

export const CHAIN_ID = demoNetwork.chain.id;
/** Browser requests use the backend; its builder key never reaches the browser. */
export const PROXY_BASE_URL = '/api/renaiss';

/**
 * Signer-bound client. It owns the wallet access token in memory after
 * `signInRedemptionWallet({ origin })`; nothing about it is persisted here.
 */
export function createRedemptionTrader(
  signer: RenaissSigner,
  walletSessionIssuer: string,
): RedemptionClient {
  return createRedemptionClient({
    baseUrl: PROXY_BASE_URL,
    network: demoNetwork.network,
    walletSessionIssuer,
    signer,
    expectedChainId: CHAIN_ID,
  });
}
