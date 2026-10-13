import { BNB_MAINNET, BNB_TESTNET } from '@renaiss-protocol/client';
import { describe, expect, it } from 'vitest';
import { selectDemoNetwork } from './demo-network';

describe('demo deployment selection', () => {
  it('defaults to testnet; mainnet requires an explicit selection', () => {
    expect(selectDemoNetwork(undefined).network).toBe(BNB_TESTNET);
    expect(selectDemoNetwork('testnet').network).toBe(BNB_TESTNET);
    expect(selectDemoNetwork('mainnet').network).toBe(BNB_MAINNET);
  });
  it.each([
    '',
    'production',
    '56',
    'MAINNET',
    'mainet',
  ])('fails closed for an invalid selection: %s', (value) =>
    expect(() => selectDemoNetwork(value)).toThrow(
      'NEXT_PUBLIC_RENAISS_NETWORK',
    ));
  it.each([
    'testnet',
    'mainnet',
  ])('keeps RPC, SDK validation and explorer on the same network: %s', (value) => {
    const selected = selectDemoNetwork(value);
    expect(selected.chain.id).toBe(selected.network.chainId);
    expect(selected.chain.id).toBe(selected.network.marketplace.chainId);
    expect(selected.chain.id).toBe(selected.network.redemption.chainId);
    expect(selected.chain.blockExplorers.default.url).toBe(
      value === 'mainnet'
        ? 'https://bscscan.com'
        : 'https://testnet.bscscan.com',
    );
    expect(selected.network.marketplace.contracts.usdt).toBe(
      selected.network.redemption.tokenAddress,
    );
  });
});
