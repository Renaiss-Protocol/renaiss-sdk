import {
  createMarketplaceClient,
  type MarketplaceClient,
  type RenaissSigner,
} from '@renaiss-protocol/client';

import { demoNetwork } from '../demo-network';

export const CHAIN_ID = demoNetwork.chain.id;
/** Browser requests use the backend; its builder key never reaches the browser. */
export const PROXY_BASE_URL = '/api/renaiss';
export type MarketplaceTrader = MarketplaceClient;

export function createMarketplaceReader(baseUrl: string): MarketplaceClient {
  return createMarketplaceClient({ baseUrl, network: demoNetwork.network });
}

export function createMarketplaceTrader(
  signer: RenaissSigner,
): MarketplaceClient {
  return createMarketplaceClient({
    baseUrl: PROXY_BASE_URL,
    network: demoNetwork.network,
    signer,
    expectedChainId: CHAIN_ID,
  });
}
