import { expect, it } from 'vitest';
import { createWalletScope } from './wallet-scope';

const A = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const B = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

it('accepts a result for the generation that issued the request', () => {
  const scope = createWalletScope();
  const token = scope.connect(A);
  expect(scope.isCurrent(token)).toBe(true);
});

it('rejects a result for an old generation after a clear', () => {
  const scope = createWalletScope();
  const token = scope.connect(A);
  scope.clear();
  expect(scope.isCurrent(token)).toBe(false);
});

it('rejects an old result even when the same wallet reconnects', () => {
  const scope = createWalletScope();
  const old = scope.connect(A);
  scope.clear();
  const next = scope.connect(A.toLowerCase());
  expect(scope.isCurrent(old)).toBe(false);
  expect(scope.isCurrent(next)).toBe(true);
});

it('rejects an old result when another wallet replaces the connection', () => {
  const scope = createWalletScope();
  const old = scope.connect(A);
  scope.connect(B);
  expect(scope.isCurrent(old)).toBe(false);
});

it('issues no token for a stale or missing wallet, so no request is made', () => {
  const scope = createWalletScope();
  expect(scope.token()).toBeUndefined();
  expect(scope.token(A)).toBeUndefined();
  scope.connect(A);
  expect(scope.token(B)).toBeUndefined();
  expect(scope.token(A.toLowerCase())).toBeDefined();
  expect(scope.token()).toBeDefined();
});

it('resets the address when cleared', () => {
  const scope = createWalletScope();
  scope.connect(A);
  const generation = scope.generation();
  scope.clear();
  expect(scope.address()).toBeUndefined();
  expect(scope.token()).toBeUndefined();
  expect(scope.generation()).toBeGreaterThan(generation);
});
