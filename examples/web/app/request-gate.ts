/**
 * Orders the results of async requests. A result is applied only when no newer
 * request has started, nothing invalidated the gate, and the wallet that
 * started it is still the connected one.
 */
export type RequestGate = {
  /** Drops the result of every request started so far. */
  invalidate(): void;
  /** Starts a request; the returned check says whether its result may apply. */
  start(): () => boolean;
};

export function createRequestGate(): RequestGate {
  let latest = 0;
  return {
    invalidate() {
      latest += 1;
    },
    start() {
      latest += 1;
      const mine = latest;
      return () => mine === latest;
    },
  };
}

/**
 * Applies `apply` with the result of `load` only while `isCurrent` still holds
 * after the await. Returns whether the result was applied.
 */
export async function applyIfCurrent<T>(
  load: () => Promise<T>,
  isCurrent: () => boolean,
  apply: (value: T) => void,
): Promise<boolean> {
  const value = await load();
  if (!isCurrent()) return false;
  apply(value);
  return true;
}

/**
 * A request whose result, error and completion are each applied only while the
 * request is the latest one and `isWalletCurrent` holds.
 */
export async function loadLatest<T>({
  gate,
  isWalletCurrent,
  load,
  apply,
  fail,
  settle,
}: {
  gate: RequestGate;
  isWalletCurrent: () => boolean;
  load: () => Promise<T>;
  apply: (value: T) => void;
  fail: (error: unknown) => void;
  settle: () => void;
}): Promise<void> {
  const isLatest = gate.start();
  const live = () => isLatest() && isWalletCurrent();
  try {
    const value = await load();
    if (live()) apply(value);
  } catch (error) {
    if (live()) fail(error);
  } finally {
    if (live()) settle();
  }
}
