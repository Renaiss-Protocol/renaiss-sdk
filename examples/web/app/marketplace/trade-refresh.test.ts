import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshTradeOwner } from './trade-refresh';

describe('ownership refresh after settlement', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('retries stale reads until the buyer becomes the owner', async () => {
    const readOwner = vi
      .fn()
      .mockResolvedValueOnce('seller')
      .mockResolvedValueOnce('seller')
      .mockResolvedValue('BUYER');
    const onPending = vi.fn();
    const result = refreshTradeOwner({
      expectedOwner: 'buyer',
      readOwner,
      isCurrent: () => true,
      onPending,
    });
    await vi.runAllTimersAsync();
    expect(await result).toBe('updated');
    expect(readOwner).toHaveBeenCalledTimes(3);
    expect(onPending).toHaveBeenCalledTimes(1);
  });

  it('does not poll when the first read already reflects the transfer', async () => {
    const readOwner = vi.fn().mockResolvedValue('buyer');
    const onPending = vi.fn();
    expect(
      await refreshTradeOwner({
        expectedOwner: 'buyer',
        readOwner,
        isCurrent: () => true,
        onPending,
      }),
    ).toBe('updated');
    expect(readOwner).toHaveBeenCalledTimes(1);
    expect(onPending).not.toHaveBeenCalled();
  });

  it('stops after a bounded interval if ownership remains stale', async () => {
    const readOwner = vi.fn().mockResolvedValue('seller');
    const result = refreshTradeOwner({
      expectedOwner: 'buyer',
      readOwner,
      isCurrent: () => true,
      onPending: vi.fn(),
    });
    await vi.runAllTimersAsync();
    expect(await result).toBe('delayed');
    expect(readOwner).toHaveBeenCalledTimes(20);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops polling when the card, wallet or mounted page changes', async () => {
    let current = true;
    const readOwner = vi.fn().mockResolvedValue('seller');
    const result = refreshTradeOwner({
      expectedOwner: 'buyer',
      readOwner,
      isCurrent: () => current,
      onPending: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(0);
    current = false;
    await vi.runAllTimersAsync();
    expect(await result).toBe('cancelled');
    expect(readOwner).toHaveBeenCalledTimes(1);
  });

  it('ignores a read that completes after navigation', async () => {
    let current = true;
    const onPending = vi.fn();
    const readOwner = vi.fn(async () => {
      current = false;
      return 'buyer';
    });
    expect(
      await refreshTradeOwner({
        expectedOwner: 'buyer',
        readOwner,
        isCurrent: () => current,
        onPending,
      }),
    ).toBe('cancelled');
    expect(onPending).not.toHaveBeenCalled();
  });

  it('leaves a read failure distinct from a failed trade', async () => {
    expect(
      await refreshTradeOwner({
        expectedOwner: 'buyer',
        readOwner: async () => undefined,
        isCurrent: () => true,
        onPending: vi.fn(),
      }),
    ).toBe('delayed');
  });
});
