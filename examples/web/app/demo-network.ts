import { BNB_MAINNET, BNB_TESTNET } from '@renaiss-protocol/client';
import { bsc, bscTestnet } from 'viem/chains';

/** One explicit selection for UI, RPC, wallet checks and signing expectations. */
export function selectDemoNetwork(value: string | undefined) {
  switch (value) {
    case undefined:
    case 'testnet':
      return {
        chain: bscTestnet,
        network: BNB_TESTNET,
        label: 'BNB Testnet',
        tokenLabel: 'mock USDT',
        isTestnet: true,
      };
    case 'mainnet':
      return {
        chain: bsc,
        network: BNB_MAINNET,
        label: 'BNB Mainnet',
        tokenLabel: 'USDT',
        isTestnet: false,
      };
    default:
      throw new Error(
        'NEXT_PUBLIC_RENAISS_NETWORK must be "testnet" or "mainnet".',
      );
  }
}

// NEXT_PUBLIC_ is inlined by Next.js. Restart dev / rebuild after changing it.
export const demoNetwork = selectDemoNetwork(
  process.env.NEXT_PUBLIC_RENAISS_NETWORK,
);
