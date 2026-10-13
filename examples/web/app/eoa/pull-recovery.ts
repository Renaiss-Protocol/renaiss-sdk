import type { EoaPull } from '@renaiss-protocol/client';

export type PullJournal = {
  buyerWalletAddress: `0x${string}`;
  packId: string;
  packSlug: string;
  nonce: string;
  quantity: number;
  hash?: string;
  submittedAt: string;
};
export type RecoveryState = 'checking' | 'pending' | 'unavailable' | 'waiting';

/** A response for another purchase must never clear this recovery record. */
function matchesPendingPull(journal: PullJournal, pull: EoaPull) {
  return (
    !!journal.hash &&
    pull.permitFundTxHash.toLowerCase() === journal.hash.toLowerCase() &&
    pull.buyerWalletAddress.toLowerCase() ===
      journal.buyerWalletAddress.toLowerCase() &&
    pull.packId === journal.packId &&
    pull.numOfTokens === journal.quantity
  );
}

/** Bounded read-only polling. Never resubmits a purchase or clears on an error. */
export function watchPendingPull({
  journal,
  check,
  onState,
  onResolved,
  onDiagnostic,
}: {
  journal: PullJournal;
  check: () => Promise<EoaPull>;
  onState: (state: RecoveryState) => void;
  onResolved: (pull: EoaPull) => void | Promise<void>;
  onDiagnostic: (error: unknown) => void;
}) {
  let stopped = false;
  let checks = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function poll() {
    onState('checking');
    try {
      const pull = await check();
      if (stopped) return;
      if (!matchesPendingPull(journal, pull))
        throw new Error('Draw status does not match the saved purchase.');
      if (pull.status === 'RESOLVED') {
        await onResolved(pull);
        return;
      }
      onState('pending');
    } catch (error) {
      if (stopped) return;
      onDiagnostic(error);
      onState('unavailable');
    }
    if (!stopped && ++checks < 6) timer = setTimeout(() => void poll(), 5_000);
    else if (!stopped) onState('waiting');
  }
  void poll();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
