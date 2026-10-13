import { expect, it, vi } from 'vitest';
import { connectWallet, type WalletReading } from './connect-wallet';
import { createWalletScope } from './wallet-scope';

const A = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const B = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const CHAIN = 97;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function setup(readWallet: () => Promise<WalletReading>) {
  const scope = createWalletScope();
  const publish = vi.fn();
  const attempt = connectWallet({
    scope,
    expectedChainId: CHAIN,
    wrongChainMessage: 'wrong chain',
    requestAccess: async () => undefined,
    readWallet,
    publish,
  });
  return { scope, publish, attempt };
}

it('publishes the wallet that is current when the attempt finishes', async () => {
  const { scope, publish, attempt } = setup(async () => ({
    account: A,
    chainId: CHAIN,
  }));
  const token = await attempt;
  expect(publish).toHaveBeenCalledExactlyOnceWith(token, A);
  expect(scope.isCurrent(token)).toBe(true);
});

it('does not publish account A when the user switches to B during the chain check', async () => {
  const first = deferred<WalletReading>();
  const reads = [
    first.promise,
    Promise.resolve({ account: B, chainId: CHAIN }),
  ];
  const { scope, publish, attempt } = setup(() => {
    const next = reads.shift();
    if (!next) throw new Error('unexpected read');
    return next;
  });
  const outcome = expect(attempt).rejects.toThrow(/changed while connecting/);
  // The account event arrives while nothing is connected yet: it must still
  // invalidate the pending attempt.
  scope.clear();
  first.resolve({ account: A, chainId: CHAIN });
  await outcome;
  expect(publish).not.toHaveBeenCalled();
  expect(scope.address()).toBeUndefined();
});

it('rejects when the final read shows another account even without an event', async () => {
  const reads: WalletReading[] = [
    { account: A, chainId: CHAIN },
    { account: B, chainId: CHAIN },
  ];
  const { scope, publish, attempt } = setup(async () => {
    const next = reads.shift();
    if (!next) throw new Error('unexpected read');
    return next;
  });
  await expect(attempt).rejects.toThrow(/changed while connecting/);
  expect(publish).not.toHaveBeenCalled();
  expect(scope.address()).toBeUndefined();
});

it('rejects when the chain changes before publishing', async () => {
  const reads: WalletReading[] = [
    { account: A, chainId: CHAIN },
    { account: A, chainId: 1 },
  ];
  const { publish, attempt } = setup(async () => {
    const next = reads.shift();
    if (!next) throw new Error('unexpected read');
    return next;
  });
  await expect(attempt).rejects.toThrow('wrong chain');
  expect(publish).not.toHaveBeenCalled();
});

it('does not publish when an account event arrives while the chain check is pending', async () => {
  const second = deferred<WalletReading>();
  const reads = [
    Promise.resolve({ account: A, chainId: CHAIN }),
    second.promise,
  ];
  const { scope, publish, attempt } = setup(() => {
    const next = reads.shift();
    if (!next) throw new Error('unexpected read');
    return next;
  });
  const outcome = expect(attempt).rejects.toThrow(/changed while connecting/);
  await Promise.resolve();
  await Promise.resolve();
  // The user switched to B and back to A: the event alone must abort.
  scope.clear();
  second.resolve({ account: A, chainId: CHAIN });
  await outcome;
  expect(publish).not.toHaveBeenCalled();
});
