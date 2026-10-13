'use client';

import { getValue, isFailed } from '@renaiss-protocol/client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { applyIfCurrent } from '../request-gate';
import { DeveloperPanel } from './developer-panel';
import styles from './redeem.module.css';
import { unwrap, useRedeem } from './redeem-provider';
import {
  dateDmy,
  estimatedDays,
  isCancelledOrder,
  orderNumber,
  splitOrderCards,
  sumFmv,
  TRACKING_STAGES,
  trackingLabel,
  trackingStageIndex,
  vaultNames,
} from './rules';
import {
  AddressCard,
  ContactCard,
  DeliveryCard,
  FeeBreakdown,
  FmvBadge,
  Messages,
  Topbar,
} from './shared';
import type { RedemptionCheckout, RedemptionOrder } from './types';

export function OrderDetailScreen({ requestId }: { requestId: string }) {
  const { generation } = useRedeem();
  // Keyed on the wallet generation so a wallet change resets every hook below.
  return <OrderDetail key={generation} requestId={requestId} />;
}

function OrderDetail({ requestId }: { requestId: string }) {
  const {
    wallet,
    session,
    isCurrentWallet,
    requireClient,
    record,
    work,
    busy,
    note,
    journal,
  } = useRedeem();
  const [order, setOrder] = useState<RedemptionOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<RedemptionCheckout | null>(null);

  useEffect(() => {
    if (!wallet || !session) {
      setOrder(null);
      setCheckout(null);
      return;
    }
    let active = true;
    setError(null);
    void (async () => {
      const result = await requireClient().fetchRedemptionOrder({ requestId });
      if (!active) return;
      try {
        const value = unwrap(result);
        setOrder(value);
        record('GET /v2/redeem/orders/{requestId}', value);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        // A just-submitted order may not be indexed yet; the checkout state
        // saved for its preparation still answers.
        if (
          journal &&
          journal.requestId.toLowerCase() === requestId.toLowerCase()
        ) {
          const state = await requireClient().fetchRedemptionCheckout({
            preparationId: journal.preparationId,
          });
          // If the status cannot be read, the plain error above stands.
          if (active && !isFailed(state)) {
            const value = getValue(state);
            setCheckout(value);
            record('GET /v2/redeem/checkout/{preparationId}', value);
          }
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [wallet, session, requestId, requireClient, record, journal]);

  async function refreshTracking() {
    const client = requireClient();
    const started = wallet;
    // A response for a wallet that has since changed is dropped.
    await applyIfCurrent(
      async () => unwrap(await client.syncRedemptionTracking({ requestId })),
      () => !!started && isCurrentWallet(started),
      (value) => {
        setOrder(value);
        record('POST /v2/redeem/orders/{requestId}/tracking', value);
        note(
          `Tracking refreshed${value.trackingLastSyncedAt ? ` (synced ${new Date(value.trackingLastSyncedAt).toLocaleTimeString()})` : ''}.`,
        );
      },
    );
  }

  const stage = order
    ? trackingStageIndex(order.status, order.shipmentStatus)
    : 0;
  const split = order
    ? splitOrderCards(order.cards, order.tokenStatuses)
    : null;

  return (
    <main className={styles.page}>
      <Topbar
        title='Order'
        back={{ href: '/redeem/orders', label: 'All orders' }}
      />
      <Messages />
      {!wallet || !session ? (
        <div className={styles.emptyCard}>
          <span>Sign in for Redeem to see this order.</span>
        </div>
      ) : error && !order ? (
        <div className={styles.emptyCard}>
          <span>{error}</span>
          {checkout && (
            <div className={styles.info}>
              This order is not indexed yet. Checkout status for its
              preparation: <strong>{checkout.status}</strong>
              {checkout.transactionHash && (
                <>
                  {' · tx '}
                  <span className={styles.mono}>
                    {checkout.transactionHash}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      ) : !order || !split ? (
        <p className={styles.muted}>Loading order...</p>
      ) : (
        <div className={styles.checkoutGrid}>
          <div className={styles.col}>
            <div className={styles.detailHead}>
              <div className={styles.rowLine}>
                <span>
                  Order no.{' '}
                  <span className={styles.mono}>
                    {orderNumber(order.requestId)}
                  </span>
                </span>
                {isCancelledOrder(order.status) && (
                  <span className={`${styles.pill} ${styles.pillDanger}`}>
                    Cancelled
                  </span>
                )}
              </div>
              <span className={`${styles.small} ${styles.muted}`}>
                Created on {dateDmy(order.createdAt)}
                {order.updatedAt &&
                  ` · last record update ${dateDmy(order.updatedAt)}`}
              </span>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>
                  {order.trackingNumber ? (
                    <>
                      Tracking no{' '}
                      {order.trackingUrl ? (
                        <a
                          href={order.trackingUrl}
                          target='_blank'
                          rel='noreferrer'
                        >
                          {order.trackingNumber}
                        </a>
                      ) : (
                        order.trackingNumber
                      )}
                    </>
                  ) : (
                    'Tracking'
                  )}
                </div>
                <button
                  type='button'
                  className={`${styles.btn} ${styles.btnSmall}`}
                  disabled={busy}
                  onClick={() => void work(refreshTracking)}
                >
                  {busy ? 'Refreshing...' : 'Refresh tracking'}
                </button>
              </div>
              {stage === -1 ? (
                <p className={styles.muted}>
                  {trackingLabel(order.status, order.shipmentStatus)}
                </p>
              ) : (
                <div className={styles.stages}>
                  {TRACKING_STAGES.map((label, index) => (
                    <div key={label} className={styles.stage}>
                      <span
                        className={`${styles.stageDot} ${index < stage ? styles.stageDone : ''} ${index === stage ? styles.stageCurrent : ''}`}
                      />
                      <div className={styles.stageText}>
                        <span
                          className={
                            index > stage ? styles.stageMuted : undefined
                          }
                        >
                          {index === stage &&
                          order.status === 'Shipped' &&
                          (order.shipmentStatus ?? '').trim().toLowerCase() ===
                            'exception'
                            ? 'Exception'
                            : label}
                        </span>
                        {index === 0 && (
                          <span className={`${styles.small} ${styles.muted}`}>
                            {dateDmy(order.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <span className={`${styles.small} ${styles.muted}`}>
                {order.shipmentStatus
                  ? `Courier status: ${order.shipmentStatus}`
                  : 'No courier status yet.'}
                {order.trackingLastSyncedAt &&
                  ` · synced ${new Date(order.trackingLastSyncedAt).toLocaleString()}`}
              </span>
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>Redemption summary</div>
              <span className={styles.rainbowText}>
                Total redeemed: {split.available.length} item
                {split.available.length === 1 ? '' : 's'}
              </span>
              <span className={`${styles.small} ${styles.muted}`}>
                Vault: {vaultNames(order.cards) || '—'}
              </span>
              <div className={styles.summaryList}>
                {split.available.map((card) => (
                  <div
                    key={card.tokenId.toString()}
                    className={styles.summaryItem}
                  >
                    <Image
                      width={80}
                      height={80}
                      className={`${styles.thumb} ${styles.thumbSmall}`}
                      src={card.frontImageUrl}
                      alt={card.name}
                    />
                    <div className={styles.summaryItemBody}>
                      <span className={styles.itemName}>{card.name}</span>
                      <FmvBadge
                        cents={card.fmvPriceInUsd}
                        updatedAt={card.fmvUpdatedAt}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {split.cancelled.length > 0 && (
                <div className={styles.cancelBox}>
                  <span className={styles.cancelTitle}>
                    ▲ The following items are not available for redemption
                  </span>
                  {split.cancelled.map((card) => (
                    <div
                      key={card.tokenId.toString()}
                      className={styles.summaryItem}
                    >
                      <Image
                        width={80}
                        height={80}
                        className={`${styles.thumb} ${styles.thumbSmall}`}
                        src={card.frontImageUrl}
                        alt={card.name}
                      />
                      <div className={styles.summaryItemBody}>
                        <span className={styles.itemName}>{card.name}</span>
                        <FmvBadge
                          cents={card.fmvPriceInUsd}
                          updatedAt={card.fmvUpdatedAt}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={`${styles.col} ${styles.sticky}`}>
            <AddressCard name={order.recipient.name} address={order.address} />
            <ContactCard
              name={order.recipient.name}
              email={order.recipient.email}
              phone={order.recipient.phone}
              chineseName={order.recipient.chineseName}
            />
            <DeliveryCard
              courierName={order.courierName}
              estimatedDays={estimatedDays(
                order.estimatedDeliveryDaysMin,
                order.estimatedDeliveryDaysMax,
              )}
              shippingFeeInUsd={order.fees.shippingFeeInUsd}
            />
            <div className={styles.card}>
              <FeeBreakdown
                fees={order.fees}
                fmv={sumFmv(order.cards)}
                count={order.cards.length}
                showShippingTooltip={false}
              />
            </div>
          </div>
        </div>
      )}
      <DeveloperPanel />
    </main>
  );
}
