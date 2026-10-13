import type { ReactNode } from 'react';
import { demoNetwork } from '../demo-network';
import styles from './eoa.module.css';
import { explorerTx, shortHex } from './format';
import type { PullJournal, RecoveryState } from './pull-recovery';

export function PendingPull({
  journal,
  processing,
  progress,
  recoveryState,
  canCheck,
  onCheck,
  hashInput,
  onHashInput,
}: {
  journal: PullJournal;
  processing: boolean;
  progress?: string;
  recoveryState: RecoveryState;
  canCheck: boolean;
  onCheck: () => void;
  hashInput: string;
  onHashInput: (value: string) => void;
}) {
  let detail: ReactNode = progress;
  if (!processing) {
    if (!journal.hash)
      detail =
        'The payment reference has not arrived. Your attempt is saved; check your token-transfer history on the explorer before trying another purchase.';
    else if (!canCheck)
      detail = 'Connect the wallet that started this pull to check its status.';
    else if (recoveryState === 'checking')
      detail = 'Checking the saved transaction…';
    else if (recoveryState === 'pending')
      detail =
        'Payment was found. Your card is still being revealed; we will check again automatically.';
    else if (recoveryState === 'unavailable')
      detail =
        'Status is temporarily unavailable. We will check again automatically.';
    else detail = 'Your attempt is saved. Check again to confirm its outcome.';
  }
  return (
    <div className={styles.pullProgress} role='status' aria-live='polite'>
      <strong>
        {processing
          ? 'Opening your pack…'
          : 'Checking your previous pull before you open another.'}
      </strong>
      <p>{detail}</p>
      {!processing && !journal.hash && (
        <div>
          <p>
            <a
              href={`${demoNetwork.chain.blockExplorers.default.url}/address/${journal.buyerWalletAddress}#tokentxns`}
              target='_blank'
              rel='noreferrer'
            >
              Open token-transfer history ↗
            </a>{' '}
            and copy the funding transaction hash if a payment was sent.
          </p>
          <p>
            No funding transaction in your history? After confirming no payment
            was sent, clear this record in Developer › Manual recovery tools.
            Clearing does not cancel or refund a purchase.
          </p>
          <label>
            Funding transaction hash
            <input
              className={`${styles.input} ${styles.mono}`}
              aria-label='Funding transaction hash'
              placeholder='0x…'
              value={hashInput}
              onChange={(event) => onHashInput(event.target.value)}
            />
          </label>
        </div>
      )}
      <div className={styles.rowLine}>
        {journal.hash && (
          <a href={explorerTx(journal.hash)} target='_blank' rel='noreferrer'>
            View transaction {shortHex(journal.hash)} ↗
          </a>
        )}
        {!processing && (
          <button
            type='button'
            className={`${styles.btn} ${styles.btnSmall}`}
            disabled={
              !canCheck ||
              recoveryState === 'checking' ||
              (!journal.hash && !/^0x[0-9a-fA-F]{64}$/.test(hashInput))
            }
            onClick={onCheck}
          >
            Check status
          </button>
        )}
      </div>
    </div>
  );
}
