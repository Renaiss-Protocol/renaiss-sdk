import type { EoaPull } from '@renaiss-protocol/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type PullJournal, watchPendingPull } from './pull-recovery';

const journal = {
  buyerWalletAddress: `0x${'12'.repeat(20)}`,
  packId: '11111111-1111-4111-8111-111111111111',
  packSlug: 'sample-pack',
  nonce: '123',
  quantity: 1,
  hash: `0x${'ab'.repeat(32)}`,
  submittedAt: '2026-09-29T11:45:47.000Z',
} satisfies PullJournal;
const resolved: EoaPull = {
  buyerWalletAddress: journal.buyerWalletAddress,
  packId: journal.packId,
  packName: 'Sample pack',
  permitFundTxHash: journal.hash,
  numOfTokens: 1,
  status: 'RESOLVED',
  pulledAt: null,
  draws: [],
};

afterEach(() => vi.useRealTimers());

describe('pending pull recovery', () => {
  it('polls status until the saved purchase resolves, without submitting anything', async () => {
    vi.useFakeTimers();
    const check = vi
      .fn()
      .mockResolvedValueOnce({ ...resolved, status: 'PENDING_RESOLUTION' })
      .mockResolvedValueOnce(resolved);
    const onResolved = vi.fn();
    const onState = vi.fn();
    const stop = watchPendingPull({
      journal,
      check,
      onResolved,
      onState,
      onDiagnostic: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(check).toHaveBeenCalledTimes(2);
    expect(onResolved).toHaveBeenCalledWith(resolved);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(check).toHaveBeenCalledTimes(2);
    stop();
  });
  it.each([
    'hash',
    'wallet',
    'pack',
    'quantity',
  ])('does not resolve a saved purchase using another %s', async (changed) => {
    vi.useFakeTimers();
    const other = { ...resolved };
    if (changed === 'hash') other.permitFundTxHash = `0x${'cd'.repeat(32)}`;
    if (changed === 'wallet') other.buyerWalletAddress = `0x${'34'.repeat(20)}`;
    if (changed === 'pack')
      other.packId = '22222222-2222-4222-8222-222222222222';
    if (changed === 'quantity') other.numOfTokens = 5;
    const onResolved = vi.fn();
    const stop = watchPendingPull({
      journal,
      check: vi.fn().mockResolvedValue(other),
      onResolved,
      onState: vi.fn(),
      onDiagnostic: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(onResolved).not.toHaveBeenCalled();
    stop();
  });
  it('bounds unavailable status checks and preserves recovery for a manual retry', async () => {
    vi.useFakeTimers();
    const check = vi
      .fn()
      .mockRejectedValue(new Error('Status temporarily unavailable'));
    const onResolved = vi.fn();
    const onState = vi.fn();
    const stop = watchPendingPull({
      journal,
      check,
      onResolved,
      onState,
      onDiagnostic: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(check).toHaveBeenCalledTimes(6);
    expect(onResolved).not.toHaveBeenCalled();
    expect(onState).toHaveBeenLastCalledWith('waiting');
    stop();
  });
  it('ignores a late response after disconnect, cancellation or a new purchase', async () => {
    let complete: (pull: EoaPull) => void = () => undefined;
    const response = new Promise<EoaPull>((resolve) => {
      complete = resolve;
    });
    const onResolved = vi.fn();
    const onState = vi.fn();
    const stop = watchPendingPull({
      journal,
      check: () => response,
      onResolved,
      onState,
      onDiagnostic: vi.fn(),
    });
    stop();
    complete(resolved);
    await response;
    await Promise.resolve();
    expect(onResolved).not.toHaveBeenCalled();
    expect(onState).toHaveBeenCalledTimes(1);
  });
});
