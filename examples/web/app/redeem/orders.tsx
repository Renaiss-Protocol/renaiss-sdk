'use client';

import { useEffect, useState } from 'react';
import { DeveloperPanel } from './developer-panel';
import styles from './redeem.module.css';
import { unwrap, useRedeem } from './redeem-provider';
import { ORDERS_PAGE_SIZE } from './rules';
import { Messages, OrderCard, Topbar } from './shared';
import type { RedemptionOrderSummary } from './types';

type PageState = {
  items: RedemptionOrderSummary[];
  hasMore: boolean;
  nextCursor: string | undefined;
};

export function OrdersScreen() {
  const { generation } = useRedeem();
  // Keyed on the wallet generation so a wallet change resets every hook below.
  return <Orders key={generation} />;
}

function Orders() {
  const { wallet, session, requireClient, record } = useRedeem();
  const [pageIndex, setPageIndex] = useState(0);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState<PageState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet || !session) {
      setPage(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const result = unwrap(
          await requireClient()
            .listRedemptionOrders({ pageSize: ORDERS_PAGE_SIZE })
            .from(cursors[pageIndex])
            .firstPage(),
        );
        if (!active) return;
        setPage({
          items: result.items,
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
        });
        record('GET /v2/redeem/orders', result);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [wallet, session, pageIndex, cursors, requireClient, record]);

  const start = pageIndex * ORDERS_PAGE_SIZE;
  const shown = page?.items.length ?? 0;

  return (
    <main className={styles.page}>
      <Topbar
        title='All Orders'
        subtitle='View all your redemption orders and track their status.'
        back={{ href: '/redeem', label: 'Back' }}
      />
      <Messages />
      {!wallet || !session ? (
        <div className={styles.emptyCard}>
          <span>Sign in for Redeem to see your redemption orders.</span>
        </div>
      ) : (
        <>
          <div className={styles.sectionHead}>
            <span className={`${styles.small} ${styles.muted}`}>
              {shown === 0
                ? ''
                : `Showing ${start + 1}–${start + shown}${page?.hasMore ? ' · more on next page' : ' · end of list'}`}
            </span>
          </div>
          {error ? (
            <div className={styles.alert}>{error}</div>
          ) : page === null || loading ? (
            <p className={styles.muted}>Loading orders...</p>
          ) : page.items.length === 0 ? (
            <p className={styles.muted}>No redemption orders found.</p>
          ) : (
            <div className={styles.orderGrid}>
              {page.items.map((order) => (
                <OrderCard key={order.requestId} order={order} />
              ))}
            </div>
          )}
          {page && (page.hasMore || pageIndex > 0) && (
            <div className={styles.pager}>
              <button
                type='button'
                className={`${styles.btn} ${styles.btnSmall}`}
                disabled={pageIndex === 0 || loading}
                onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
              >
                Previous
              </button>
              <button
                type='button'
                className={`${styles.btn} ${styles.btnSmall}`}
                disabled={!page.hasMore || loading}
                onClick={() => {
                  setCursors((previous) => {
                    const copy = [...previous];
                    copy[pageIndex + 1] = page.nextCursor;
                    return copy;
                  });
                  setPageIndex((index) => index + 1);
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
      <DeveloperPanel />
    </main>
  );
}
