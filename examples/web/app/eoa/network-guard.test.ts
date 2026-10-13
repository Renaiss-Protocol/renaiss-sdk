import {
  BNB_MAINNET,
  BNB_TESTNET,
  type EoaPreparedPull,
  type RenaissNetwork,
} from '@renaiss-protocol/client';
import { describe, expect, it } from 'vitest';
import { assertPullNetwork } from './network-guard';

// Only the deployment boundary is exercised here; SDK tests cover the full payload.
function preparation(network: RenaissNetwork) {
  const { usdt, permit2 } = network.marketplace.contracts;
  return {
    chainId: network.chainId,
    pack: { vendingMachineAddress: network.vendingMachineAddress },
    approval: { token: usdt, spender: permit2 },
    permit2TypedData: {
      domain: { chainId: network.chainId, verifyingContract: permit2 },
      message: {
        spender: network.vendingMachineAddress,
        permitted: { token: usdt },
      },
    },
  } as EoaPreparedPull;
}

describe.each([
  BNB_TESTNET,
  BNB_MAINNET,
])('gacha chain $chainId approval guard', (network) => {
  it('allows the configured token and Permit2', () => {
    expect(() =>
      assertPullNetwork(preparation(network), network),
    ).not.toThrow();
  });
  it.each([
    'vendingMachine',
    'permitSpender',
    'chain',
    'domainChain',
    'approvalToken',
    'permitToken',
    'approvalSpender',
    'permitContract',
  ])('rejects a mismatched %s', (field) => {
    const prepared = preparation(network);
    const other = network.chainId === 56 ? BNB_TESTNET : BNB_MAINNET;
    const wrongAddress = '0x2222222222222222222222222222222222222222';
    if (field === 'vendingMachine')
      prepared.pack.vendingMachineAddress = wrongAddress;
    if (field === 'permitSpender')
      prepared.permit2TypedData.message.spender = wrongAddress;
    if (field === 'chain') prepared.chainId = other.chainId;
    if (field === 'domainChain')
      prepared.permit2TypedData.domain.chainId = other.chainId;
    if (field === 'approvalToken')
      prepared.approval.token = other.marketplace.contracts.usdt;
    if (field === 'permitToken')
      prepared.permit2TypedData.message.permitted.token =
        other.marketplace.contracts.usdt;
    if (field === 'approvalSpender') prepared.approval.spender = wrongAddress;
    if (field === 'permitContract')
      prepared.permit2TypedData.domain.verifyingContract = wrongAddress;
    expect(() => {
      assertPullNetwork(prepared, network);
    }).toThrow('does not match the configured network');
  });
});
