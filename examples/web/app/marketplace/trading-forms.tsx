'use client';

import type {
  AskQuote,
  CardDetail,
  CardOrders,
  MarketplaceOrder,
} from '@renaiss-protocol/client';
import Image from 'next/image';
import { type ReactNode, useState } from 'react';
import { usd, usdToUsdt, usdt } from '../eoa/format';
import { FmvBadge } from './card-grid';
import {
  cardDisplayRows,
  formatDateTime,
  MINIMUM_OFFER,
  parseUsdtInput,
  usdtToInput,
} from './helpers';
import styles from './marketplace.module.css';

export type DialogState =
  | { kind: 'buy' }
  | { kind: 'offer' }
  | { kind: 'list'; mode: 'list' | 'edit' }
  | { kind: 'unlist' }
  | { kind: 'accept'; bid: MarketplaceOrder }
  | { kind: 'cancel-bid'; bid: MarketplaceOrder };

type OfferDuration = '1d' | '7d' | '30d' | '90d' | '180d';

const DURATIONS: { value: OfferDuration; label: string; days: number }[] = [
  { value: '1d', label: '1 day', days: 1 },
  { value: '7d', label: '1 week', days: 7 },
  { value: '30d', label: '1 month', days: 30 },
  { value: '90d', label: '3 months', days: 90 },
  { value: '180d', label: '6 months', days: 180 },
];

const BPS = 10_000n;

function Dialog({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className={styles.overlay}>
      <div
        className={styles.dialog}
        role='dialog'
        aria-modal='true'
        aria-label={title}
      >
        <div className={styles.dialogHead}>
          <span>{title}</span>
          <button
            type='button'
            className={`${styles.btn} ${styles.btnSmall}`}
            aria-label='Close dialog'
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className={styles.dialogBody}>{children}</div>
        <div className={styles.dialogFoot}>{footer}</div>
      </div>
    </div>
  );
}

/** Card preview + header rows + FMV pill shared by every dialog. */
function DialogCard({ card }: { card: CardDetail }) {
  const { firstRow, secondRow } = cardDisplayRows(card);
  return (
    <div className={styles.dialogCard}>
      <Image
        src={card.frontImageUrl}
        alt={card.name}
        width={200}
        height={200}
        sizes='(max-width: 640px) 120px, 200px'
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className={styles.metaText}>
          <div className={styles.metaLine1}>
            {firstRow.map((part) => (
              <span key={part}>{part}</span>
            ))}
          </div>
          <div className={styles.metaLine2}>{secondRow}</div>
        </div>
        {card.fmvPriceInUsd !== null ? (
          <FmvBadge
            cents={card.fmvPriceInUsd}
            updatedAt={card.fmvUpdatedAt}
            size='large'
          />
        ) : (
          <span className={styles.missing}>no FMV</span>
        )}
      </div>
    </div>
  );
}

function PendingNotice() {
  return <p className={styles.notice}>Connect your wallet to continue.</p>;
}

function Footer({
  primary,
  secondary,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <>
      {primary}
      {secondary}
    </>
  );
}

type Common = {
  card: CardDetail;
  busy: boolean;
  canSubmit: boolean;
  onClose: () => void;
};

function BalanceRow({ balance }: { balance: bigint | null }) {
  return (
    <div className={styles.breakdownRow}>
      <span>Balance</span>
      <span>{balance === null ? '—' : `$ ${usdt(balance, 2)} USDT`}</span>
    </div>
  );
}

/** The SDK signs a Permit2 witness; the EOA must have approved USDT to Permit2 first. */
function AllowanceRow({
  allowance,
  required,
}: {
  allowance: bigint | null;
  required: bigint | null;
}) {
  if (allowance === null) return null;
  const short = required !== null && allowance < required;
  return (
    <div className={styles.breakdownRow}>
      <span>Permit2 allowance</span>
      <span className={short ? styles.sUnused : undefined}>
        $ {usdt(allowance, 2)}
        {short ? ' · approval tx will be requested first' : ''}
      </span>
    </div>
  );
}

export function BuyNowDialog({
  card,
  balance,
  allowance,
  busy,
  canSubmit,
  onClose,
  onConfirm,
}: Common & {
  balance: bigint | null;
  allowance: bigint | null;
  onConfirm: () => void;
}) {
  const ask = card.askPriceInUsdt;
  const notEnough = ask !== null && balance !== null && BigInt(ask) > balance;
  return (
    <Dialog
      title='Buy now'
      onClose={onClose}
      footer={
        <Footer
          primary={
            <button
              type='button'
              className={`${styles.btn} ${styles.btnRainbow}`}
              disabled={busy || !canSubmit || ask === null || notEnough}
              onClick={onConfirm}
            >
              {busy ? 'Buying...' : 'Buy now'}
            </button>
          }
          secondary={
            <button
              type='button'
              className={`${styles.btn} ${styles.btnOutline} ${styles.btnTall}`}
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
          }
        />
      }
    >
      <DialogCard card={card} />
      <div className={styles.fieldLabel}>Purchase summary</div>
      <div className={styles.breakdown}>
        <div className={styles.breakdownRow}>
          <span>Buy now</span>
          <span>{ask === null ? 'N/A' : `$${usdt(ask, 18)}`}</span>
        </div>
        <div className={styles.breakdownRow}>
          <span>
            <span className={styles.maxBtn}>MAX</span>
          </span>
          <span>{ask === null ? 'N/A' : `~ $${usdt(ask, 18)}`}</span>
        </div>
        <BalanceRow balance={balance} />
        <AllowanceRow
          allowance={allowance}
          required={ask === null ? null : BigInt(ask)}
        />
      </div>
      {notEnough && (
        <p className={styles.notice}>Not enough USDT to buy this card.</p>
      )}
      {!canSubmit && <PendingNotice />}
    </Dialog>
  );
}

export function MakeOfferDialog({
  card,
  balance,
  allowance,
  busy,
  canSubmit,
  onClose,
  onConfirm,
  onBuyNow,
}: Common & {
  balance: bigint | null;
  allowance: bigint | null;
  onConfirm: (amountInUsdt: bigint, expiresInSeconds: number) => void;
  onBuyNow: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState<OfferDuration>('180d');
  const parsed = parseUsdtInput(amount);
  const invalid = amount.trim() !== '' && parsed === null;
  const notEnough = parsed !== null && balance !== null && parsed > balance;
  const belowMinimum = parsed !== null && parsed < MINIMUM_OFFER;
  const ask = card.askPriceInUsdt === null ? null : BigInt(card.askPriceInUsdt);
  const aboveAsk = parsed !== null && ask !== null && parsed > ask;
  const days = DURATIONS.find((d) => d.value === duration)?.days ?? 180;
  const expiresAt = new Date(Date.now() + days * 86_400_000);
  return (
    <Dialog
      title='Make an offer'
      onClose={onClose}
      footer={
        <Footer
          primary={
            <button
              type='button'
              className={`${styles.btn} ${styles.btnSolid} ${styles.btnTall}`}
              disabled={
                busy ||
                !canSubmit ||
                parsed === null ||
                notEnough ||
                belowMinimum
              }
              onClick={() =>
                parsed !== null && onConfirm(parsed, days * 86_400)
              }
            >
              {busy ? 'Creating offer...' : 'Confirm'}
            </button>
          }
          secondary={
            <button
              type='button'
              className={`${styles.btn} ${styles.btnOutline} ${styles.btnTall}`}
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
          }
        />
      }
    >
      <DialogCard card={card} />
      {ask !== null && (
        <div className={styles.breakdownRow}>
          <span>Listing price</span>
          <span>${usdt(ask, 2)}</span>
        </div>
      )}
      <div className={styles.fieldLabel}>Offer Amount</div>
      <div className={styles.amountField}>
        <div className={styles.amountInner}>
          <span style={{ fontSize: 20, color: '#e0e3e6' }}>$</span>
          <input
            className={styles.amountInput}
            inputMode='decimal'
            placeholder='0.00'
            aria-label='Offer amount in USDT'
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button
            type='button'
            className={styles.maxBtn}
            disabled={balance === null}
            onClick={() => balance !== null && setAmount(usdtToInput(balance))}
          >
            MAX
          </button>
        </div>
      </div>
      <div className={styles.breakdown}>
        <BalanceRow balance={balance} />
        <AllowanceRow allowance={allowance} required={parsed} />
      </div>
      {invalid && (
        <p className={styles.notice}>
          Enter a valid amount with up to 2 decimal places.
        </p>
      )}
      {notEnough && (
        <p className={styles.notice}>Not enough USDT to create this offer.</p>
      )}
      {belowMinimum && (
        <p className={styles.notice}>
          The minimum offer is {usdt(MINIMUM_OFFER, 0)} USDT.
        </p>
      )}
      {aboveAsk && ask !== null && (
        <p className={styles.notice}>
          Your offer is higher than the current listing price ({usdt(ask, 2)}{' '}
          USDT). Buy now instead?{' '}
          <button type='button' className={styles.linkBtn} onClick={onBuyNow}>
            Buy now
          </button>
        </p>
      )}
      <div className={styles.fieldLabel}>Duration</div>
      <select
        className={styles.select}
        aria-label='Offer duration'
        value={duration}
        onChange={(e) => setDuration(e.target.value as OfferDuration)}
      >
        {DURATIONS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>
      <p className={`${styles.small} ${styles.muted}`}>
        Expires in {formatDateTime(expiresAt.toISOString())}
      </p>
      {!canSubmit && <PendingNotice />}
    </Dialog>
  );
}

function QuoteBreakdown({ quote }: { quote: AskQuote }) {
  return (
    <div className={styles.breakdown}>
      <div className={styles.breakdownRow}>
        <span>You will receive</span>
        <span>$ {usdt(quote.sellerReceivesInUsdt, 18)}</span>
      </div>
      <div className={styles.breakdownRow}>
        <span>Platform fee</span>
        <span>$ {usdt(quote.platformFeeInUsdt, 18)}</span>
      </div>
      <div className={`${styles.breakdownRow} ${styles.breakdownTotal}`}>
        <span>Total Listing Price</span>
        <span>$ {usdt(quote.totalPriceInUsdt, 18)}</span>
      </div>
      <div className={styles.breakdownRow}>
        <span>Expires</span>
        <span>{formatDateTime(quote.expiresAt)}</span>
      </div>
    </div>
  );
}

export function ListCardDialog({
  card,
  orders,
  mode,
  feeBps,
  result,
  busy,
  canSubmit,
  onClose,
  onConfirm,
}: Common & {
  orders: CardOrders | null;
  mode: 'list' | 'edit';
  feeBps: bigint;
  result: AskQuote | null;
  onConfirm: (sellerReceivesInUsdt: bigint) => void;
}) {
  const [price, setPrice] = useState('');
  const parsed = parseUsdtInput(price);
  const invalid = price.trim() !== '' && parsed === null;
  const fee = parsed !== null ? (parsed * feeBps) / BPS : null;
  const total = parsed !== null && fee !== null ? parsed + fee : null;
  const highestBid = orders?.activeBids[0] ?? null;
  const belowHighest =
    total !== null &&
    highestBid !== null &&
    total < BigInt(highestBid.amountInUsdt);

  if (result)
    return (
      <Dialog
        title={mode === 'edit' ? 'Edit listing price' : 'List your card'}
        onClose={onClose}
        footer={
          <Footer
            primary={
              <button
                type='button'
                className={`${styles.btn} ${styles.btnOutline} ${styles.btnTall}`}
                onClick={onClose}
              >
                View Listing
              </button>
            }
          />
        }
      >
        <p className={styles.successText}>
          Congrats, the following item is listed on marketplace.
        </p>
        <DialogCard card={card} />
        <div className={styles.fieldLabel}>Listing Price</div>
        <div className={styles.amountField}>
          <div className={styles.amountInner}>
            <span style={{ fontSize: 20, color: '#e0e3e6' }}>
              $ {usdt(result.totalPriceInUsdt, 18)}
            </span>
          </div>
        </div>
        <QuoteBreakdown quote={result} />
      </Dialog>
    );

  return (
    <Dialog
      title={mode === 'edit' ? 'Edit listing price' : 'List your card'}
      onClose={onClose}
      footer={
        <Footer
          primary={
            <button
              type='button'
              className={`${styles.btn} ${styles.btnSolid} ${styles.btnTall}`}
              disabled={busy || !canSubmit || parsed === null}
              onClick={() => parsed !== null && onConfirm(parsed)}
            >
              {busy
                ? mode === 'edit'
                  ? 'Updating...'
                  : 'Listing...'
                : mode === 'edit'
                  ? 'Update Listing Price'
                  : 'List item'}
            </button>
          }
          secondary={
            <button
              type='button'
              className={`${styles.btn} ${styles.btnOutline} ${styles.btnTall}`}
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
          }
        />
      }
    >
      <DialogCard card={card} />
      {mode === 'edit' && card.askPriceInUsdt !== null && (
        <div className={styles.breakdown}>
          <div className={styles.breakdownRow}>
            <span>Current total listing price</span>
            <span>$ {usdt(card.askPriceInUsdt, 18)}</span>
          </div>
          <div className={styles.breakdownRow}>
            <span>Current ask expires</span>
            <span>
              {card.askExpiresAt ? formatDateTime(card.askExpiresAt) : '—'}
            </span>
          </div>
          <p className={`${styles.small} ${styles.muted}`}>
            This signs a new ask.
          </p>
        </div>
      )}
      {belowHighest && highestBid && (
        <p className={styles.notice}>
          Your total listing price is below the current highest offer of ${' '}
          {usdt(highestBid.amountInUsdt, 2)}. You might prefer accepting the
          offer instead.
        </p>
      )}
      <div className={styles.fieldLabel}>
        {mode === 'edit' ? 'New Listing Price' : 'Listing Price'}
      </div>
      <div className={styles.amountField}>
        <div className={styles.amountInner}>
          <span style={{ fontSize: 20, color: '#e0e3e6' }}>$</span>
          <input
            className={styles.amountInput}
            inputMode='decimal'
            placeholder='0.00'
            aria-label='Listing price in USDT'
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
      </div>
      {invalid && (
        <p className={styles.notice}>
          Enter a valid amount with up to 2 decimal places.
        </p>
      )}
      <div className={styles.breakdown}>
        <div className={styles.breakdownRow}>
          <span>You will receive</span>
          <span>$ {parsed === null ? '0.00' : usdt(parsed, 2)}</span>
        </div>
        <div className={styles.breakdownRow}>
          <span>Platform fee ({feeBps.toString()} bps)</span>
          <span>$ {fee === null ? '0.00' : usdt(fee, 2)}</span>
        </div>
        <div className={`${styles.breakdownRow} ${styles.breakdownTotal}`}>
          <span>Total Listing Price</span>
          <span>$ {total === null ? '0.00' : usdt(total, 2)}</span>
        </div>
      </div>
      {!canSubmit && <PendingNotice />}
    </Dialog>
  );
}

export function UnlistDialog({
  card,
  askOrderId,
  busy,
  canSubmit,
  onClose,
  onConfirm,
}: Common & { askOrderId: string | null; onConfirm: () => void }) {
  return (
    <Dialog
      title='Unlist your card'
      onClose={onClose}
      footer={
        <Footer
          primary={
            <button
              type='button'
              className={`${styles.btn} ${styles.btnSolid} ${styles.btnTall}`}
              disabled={busy || !canSubmit || askOrderId === null}
              onClick={onConfirm}
            >
              {busy ? 'Unlisting...' : 'Unlist item'}
            </button>
          }
          secondary={
            <button
              type='button'
              className={`${styles.btn} ${styles.btnOutline} ${styles.btnTall}`}
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
          }
        />
      }
    >
      <DialogCard card={card} />
      <div className={styles.breakdown}>
        <div className={styles.breakdownRow}>
          <span>Current listing price</span>
          <span>
            {card.askPriceInUsdt === null
              ? '—'
              : `$ ${usdt(card.askPriceInUsdt, 18)}`}
          </span>
        </div>
        <div className={styles.breakdownRow}>
          <span>Ask order</span>
          <span className={styles.mono}>
            {askOrderId ?? (
              <span className={styles.missing}>No active listing</span>
            )}
          </span>
        </div>
      </div>
      {!canSubmit && <PendingNotice />}
    </Dialog>
  );
}

export function AcceptOfferDialog({
  card,
  bid,
  feeBps,
  busy,
  canSubmit,
  onClose,
  onConfirm,
}: Common & {
  bid: MarketplaceOrder;
  feeBps: bigint;
  onConfirm: () => void;
}) {
  const amount = BigInt(bid.amountInUsdt);
  const receive = (amount * BPS) / (BPS + feeBps);
  const fee = amount - receive;
  const fmvUsdt =
    card.fmvPriceInUsd === null ? null : usdToUsdt(card.fmvPriceInUsd);
  const belowFmv = fmvUsdt !== null && amount * 10n < fmvUsdt * 8n;
  return (
    <Dialog
      title='Accept offer'
      onClose={onClose}
      footer={
        <Footer
          primary={
            <button
              type='button'
              className={`${styles.btn} ${styles.btnSolid} ${styles.btnTall}`}
              disabled={busy || !canSubmit}
              onClick={onConfirm}
            >
              {busy ? 'Accepting...' : 'Accept offer'}
            </button>
          }
          secondary={
            <button
              type='button'
              className={`${styles.btn} ${styles.btnOutline} ${styles.btnTall}`}
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
          }
        />
      }
    >
      <DialogCard card={card} />
      <div className={styles.breakdown}>
        <div className={styles.breakdownRow}>
          <span>Offer price</span>
          <span>$ {usdt(amount, 18)}</span>
        </div>
        <div className={styles.breakdownRow}>
          <span>Platform fee</span>
          <span>$ {usdt(fee, 3)}</span>
        </div>
        <div className={`${styles.breakdownRow} ${styles.breakdownTotal}`}>
          <span>You will receive</span>
          <span>$ {usdt(receive, 2)}</span>
        </div>
        {card.fmvPriceInUsd !== null && (
          <div className={styles.breakdownRow}>
            <span>FMV</span>
            <span>$ {usd(card.fmvPriceInUsd, 2)}</span>
          </div>
        )}
      </div>
      {belowFmv && (
        <p className={styles.notice}>
          The offer price is lower than 80% of the FMV of the card. Please
          consider your options carefully before proceeding.
        </p>
      )}
      {!canSubmit && <PendingNotice />}
    </Dialog>
  );
}

/** Cancels the wallet's own funded bid by signing a cancellation. */
export function CancelBidDialog({
  card,
  bid,
  busy,
  canSubmit,
  onClose,
  onConfirm,
}: Common & { bid: MarketplaceOrder; onConfirm: () => void }) {
  return (
    <Dialog
      title='Cancel offer'
      onClose={onClose}
      footer={
        <Footer
          primary={
            <button
              type='button'
              className={`${styles.btn} ${styles.btnDanger} ${styles.btnTall}`}
              disabled={busy || !canSubmit}
              onClick={onConfirm}
            >
              {busy ? 'Cancelling...' : 'Cancel offer'}
            </button>
          }
          secondary={
            <button
              type='button'
              className={`${styles.btn} ${styles.btnOutline} ${styles.btnTall}`}
              disabled={busy}
              onClick={onClose}
            >
              Keep offer
            </button>
          }
        />
      }
    >
      <DialogCard card={card} />
      <div className={styles.breakdown}>
        <div className={styles.breakdownRow}>
          <span>Your offer</span>
          <span>$ {usdt(bid.amountInUsdt, 18)}</span>
        </div>
        <div className={styles.breakdownRow}>
          <span>Expires</span>
          <span>{formatDateTime(bid.expiresAt)}</span>
        </div>
      </div>
      <p className={`${styles.small} ${styles.muted}`}>
        Removes the order from the book. The Permit2 allowance behind it is not
        revoked.
      </p>
      {!canSubmit && <PendingNotice />}
    </Dialog>
  );
}
