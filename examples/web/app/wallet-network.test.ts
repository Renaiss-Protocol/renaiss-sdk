import { expect, it, vi } from 'vitest';
import { demoNetwork } from './demo-network';
import {
  isConnectedWallet,
  switchToDemoChain,
  walletSelectionChanged,
} from './wallet-network';

it('treats only the connected wallet, ignoring case, as current', () => {
  expect(isConnectedWallet('0xAbC', '0xabc')).toBe(true);
  expect(isConnectedWallet('0xabc', '0xdef')).toBe(false);
  expect(isConnectedWallet(undefined, '0xabc')).toBe(false);
});

it('switches a known network without adding it', async () => {
  const wallet = {
    switchChain: vi.fn().mockResolvedValue(undefined),
    addChain: vi.fn(),
  };
  await switchToDemoChain(wallet);
  expect(wallet.switchChain).toHaveBeenCalledExactlyOnceWith({
    id: demoNetwork.chain.id,
  });
  expect(wallet.addChain).not.toHaveBeenCalled();
});

it.each([
  { code: 4902 },
  { cause: { cause: { code: 4902 } } },
])('adds an unknown network then switches again (%j)', async (error) => {
  const wallet = {
    switchChain: vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(undefined),
    addChain: vi.fn().mockResolvedValue(undefined),
  };
  await switchToDemoChain(wallet);
  expect(wallet.addChain).toHaveBeenCalledExactlyOnceWith({
    chain: demoNetwork.chain,
  });
  expect(wallet.switchChain).toHaveBeenCalledTimes(2);
});

it('does not add a network or retry when switching is rejected', async () => {
  const error = { code: 4001 };
  const wallet = {
    switchChain: vi.fn().mockRejectedValue(error),
    addChain: vi.fn(),
  };
  await expect(switchToDemoChain(wallet)).rejects.toBe(error);
  expect(wallet.switchChain).toHaveBeenCalledTimes(1);
  expect(wallet.addChain).not.toHaveBeenCalled();
});

it('does not switch again when adding the network is rejected', async () => {
  const error = { code: 4001 };
  const wallet = {
    switchChain: vi.fn().mockRejectedValue({ code: 4902 }),
    addChain: vi.fn().mockRejectedValue(error),
  };
  await expect(switchToDemoChain(wallet)).rejects.toBe(error);
  expect(wallet.switchChain).toHaveBeenCalledTimes(1);
});

it.each([
  ['accountsChanged', ['0xAbCd'], false],
  ['accountsChanged', ['0x1234'], true],
  ['accountsChanged', [], true],
  ['chainChanged', `0x${demoNetwork.chain.id.toString(16)}`, false],
  ['chainChanged', String(demoNetwork.chain.id), false],
  ['chainChanged', '0x1', true],
] as const)('only resets for a changed wallet selection (%s, %j)', (event, value, expected) => {
  expect(walletSelectionChanged('0xabcd', event, value)).toBe(expected);
  expect(walletSelectionChanged(undefined, event, value)).toBe(false);
});
