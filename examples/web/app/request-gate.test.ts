import { expect, it, vi } from 'vitest';
import { applyIfCurrent, createRequestGate, loadLatest } from './request-gate';
import { createWalletScope } from './wallet-scope';

const A = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const B = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// Order detail: wallet A starts "Refresh tracking", the account changes, and
// A's late response must not restore A's order.
it('ignores a late tracking response after the account changed', async () => {
  const scope = createWalletScope();
  const tokenA = scope.connect(A);
  const response = deferred<{ requestId: string }>();
  const show = vi.fn();
  const pending = applyIfCurrent(
    () => response.promise,
    () => scope.isCurrent(tokenA),
    show,
  );
  scope.clear();
  scope.connect(B);
  response.resolve({ requestId: 'order-of-A' });
  expect(await pending).toBe(false);
  expect(show).not.toHaveBeenCalled();
});

it('applies a tracking response while the same wallet stays connected', async () => {
  const scope = createWalletScope();
  const token = scope.connect(A);
  const show = vi.fn();
  await applyIfCurrent(
    async () => 'order',
    () => scope.isCurrent(token),
    show,
  );
  expect(show).toHaveBeenCalledExactlyOnceWith('order');
});

// Selection: A's card request is pending, A disconnects, B signs in and B's
// region request is still pending when A's cards arrive.
it('ignores late cards after disconnect and another wallet signing in', async () => {
  const scope = createWalletScope();
  const gate = createRequestGate();
  const tokenA = scope.connect(A);
  const cards = deferred<string[]>();
  const apply = vi.fn();
  const settle = vi.fn();
  const request = loadLatest({
    gate,
    isWalletCurrent: () => scope.isCurrent(tokenA),
    load: () => cards.promise,
    apply,
    fail: vi.fn(),
    settle,
  });
  scope.clear();
  gate.invalidate();
  scope.connect(B);
  cards.resolve(['card-of-A']);
  await request;
  expect(apply).not.toHaveBeenCalled();
  expect(settle).not.toHaveBeenCalled();
});

it('drops late cards when only the wallet changed and the gate was not touched', async () => {
  const scope = createWalletScope();
  const gate = createRequestGate();
  const tokenA = scope.connect(A);
  const cards = deferred<string[]>();
  const apply = vi.fn();
  const request = loadLatest({
    gate,
    isWalletCurrent: () => scope.isCurrent(tokenA),
    load: () => cards.promise,
    apply,
    fail: vi.fn(),
    settle: vi.fn(),
  });
  scope.clear();
  scope.connect(B);
  cards.resolve(['card-of-A']);
  await request;
  expect(apply).not.toHaveBeenCalled();
});

it('drops a late error after the gate was invalidated', async () => {
  const scope = createWalletScope();
  const gate = createRequestGate();
  const token = scope.connect(A);
  const fail = vi.fn();
  const request = loadLatest({
    gate,
    isWalletCurrent: () => scope.isCurrent(token),
    load: () => Promise.reject(new Error('late')),
    apply: vi.fn(),
    fail,
    settle: vi.fn(),
  });
  gate.invalidate();
  await request;
  expect(fail).not.toHaveBeenCalled();
});

it('applies only the latest of two overlapping requests', async () => {
  const scope = createWalletScope();
  const gate = createRequestGate();
  const token = scope.connect(A);
  const first = deferred<string>();
  const second = deferred<string>();
  const apply = vi.fn();
  const run = (load: () => Promise<string>) =>
    loadLatest({
      gate,
      isWalletCurrent: () => scope.isCurrent(token),
      load,
      apply,
      fail: vi.fn(),
      settle: vi.fn(),
    });
  const a = run(() => first.promise);
  const b = run(() => second.promise);
  second.resolve('new');
  first.resolve('old');
  await Promise.all([a, b]);
  expect(apply).toHaveBeenCalledExactlyOnceWith('new');
});
