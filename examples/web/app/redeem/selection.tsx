'use client';

import {
  RedemptionCardSort,
  RedemptionSortOrder,
} from '@renaiss-protocol/client';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { createRequestGate, loadLatest } from '../request-gate';
import { CartDrawer } from './cart-drawer';
import { DeveloperPanel } from './developer-panel';
import styles from './redeem.module.css';
import { unwrap, useRedeem } from './redeem-provider';
import {
  type CartDecision,
  dateDmy,
  initialRegion,
  orderedRegions,
  orderNumber,
  PAGE_SIZE,
  RECORD_STRIP_LIMIT,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MAX,
} from './rules';
import {
  CardName,
  Dialog,
  FmvBadge,
  Messages,
  OrderCard,
  Topbar,
} from './shared';
import type { RedeemableCard, RedemptionOrderSummary } from './types';

type Region = 'all' | string;
type Sort = 'fmv-desc' | 'fmv-asc';
type View = 'grid' | 'table';
type PageState = {
  items: RedeemableCard[];
  total: number | undefined;
  hasMore: boolean;
  nextCursor: string | undefined;
};

export function SelectionScreen() {
  const { generation } = useRedeem();
  // Keyed on the wallet generation so a wallet change resets every hook below.
  return <Selection key={generation} />;
}

function Selection() {
  const ctx = useRedeem();
  const {
    wallet,
    session,
    isCurrentWallet,
    requireClient,
    cart,
    isInCart,
    addToCart,
    replaceCart,
    removeFromCart,
    config,
    journal,
    record,
    note,
    setError,
  } = ctx;
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sort, setSort] = useState<Sort>('fmv-desc');
  const [view, setView] = useState<View>('grid');
  const [pageIndex, setPageIndex] = useState(0);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState<PageState | null>(null);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [orders, setOrders] = useState<RedemptionOrderSummary[] | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [dialog, setDialog] = useState<
    | { kind: 'region'; card: RedeemableCard; region: string }
    | { kind: 'limit' }
    | null
  >(null);
  const cardRequests = useState(createRequestGate)[0];

  useEffect(() => {
    const id = setTimeout(
      () => setDebounced(search.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(id);
  }, [search]);

  // Reset paging whenever a filter changes.
  const resetPaging = useCallback(() => {
    setPageIndex(0);
    setCursors([undefined]);
  }, []);

  // Region counts; the list waits for them so the default region is right.
  useEffect(() => {
    if (!wallet || !session) {
      setCounts(null);
      setRegion(null);
      setPage(null);
      setOrders(null);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const regions = unwrap(await requireClient().fetchRedemptionRegions());
        if (!active) return;
        setCounts(regions.counts);
        record('GET /v2/redeem/regions', regions);
        setRegion(initialRegion(regions.counts));
        setPageIndex(0);
        setCursors([undefined]);
      } catch (e) {
        if (active) setListError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [wallet, session, requireClient, record]);

  // Eligible cards for the current filters and page.
  useEffect(() => {
    // Every wallet or session change, including a disconnect, drops requests
    // still in flight.
    if (!wallet || !session || region === null) {
      cardRequests.invalidate();
      if (!wallet || !session) setLoading(false);
      return;
    }
    setLoading(true);
    setListError(null);
    const cursor = cursors[pageIndex];
    void loadLatest({
      gate: cardRequests,
      isWalletCurrent: () => isCurrentWallet(wallet),
      load: async () =>
        unwrap(
          await requireClient()
            .listRedeemableCards({
              search: debounced || undefined,
              countryCode: region === 'all' ? undefined : region,
              sortBy: RedemptionCardSort.RixPrice,
              sortOrder:
                sort === 'fmv-desc'
                  ? RedemptionSortOrder.Descending
                  : RedemptionSortOrder.Ascending,
              pageSize: PAGE_SIZE,
            })
            .from(cursor)
            .firstPage(),
        ),
      apply(result) {
        setPage({
          items: result.items,
          total: result.totalCount,
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
        });
        record('GET /v2/redeem/collectibles', result);
      },
      fail: (e) => setListError(e instanceof Error ? e.message : String(e)),
      settle: () => setLoading(false),
    });
    return () => cardRequests.invalidate();
  }, [
    cardRequests,
    isCurrentWallet,
    wallet,
    session,
    region,
    debounced,
    sort,
    pageIndex,
    cursors,
    requireClient,
    record,
  ]);

  // "Record" strip: the latest orders. Per-order tracking refresh
  // (POST orders/{id}/tracking) is used on the detail page rather than here.
  useEffect(() => {
    if (!wallet || !session) return;
    let active = true;
    void (async () => {
      try {
        const result = unwrap(
          await requireClient()
            .listRedemptionOrders({ pageSize: RECORD_STRIP_LIMIT })
            .firstPage(),
        );
        if (!active) return;
        setOrders(result.items);
        record('GET /v2/redeem/orders', result);
      } catch (e) {
        if (active) setOrdersError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [wallet, session, requireClient, record]);

  function changeRegion(next: Region) {
    setRegion(next);
    resetPaging();
  }
  function changeSort(next: Sort) {
    setSort(next);
    resetPaging();
  }
  function changeSearch(next: string) {
    setSearch(next.slice(0, SEARCH_MAX));
    resetPaging();
  }
  function nextPage() {
    if (!page?.hasMore) return;
    setCursors((previous) => {
      const copy = [...previous];
      copy[pageIndex + 1] = page.nextCursor;
      return copy;
    });
    setPageIndex((index) => index + 1);
  }
  function previousPage() {
    setPageIndex((index) => Math.max(0, index - 1));
  }

  function handleDecision(card: RedeemableCard, decision: CartDecision) {
    switch (decision.kind) {
      case 'added':
        note(`Added ${card.name} to the redemption cart.`);
        break;
      case 'already':
        break;
      case 'region-conflict':
        setDialog({ kind: 'region', card, region: decision.region });
        break;
      case 'limit':
        setDialog({ kind: 'limit' });
        break;
    }
  }
  function toggle(card: RedeemableCard) {
    setError('');
    if (isInCart(card.tokenId)) {
      removeFromCart(card.tokenId);
      return;
    }
    handleDecision(card, addToCart(card));
  }

  const total = page?.total;
  const shown = page?.items.length ?? 0;
  const start = pageIndex * PAGE_SIZE;
  const max = config.maxCards;

  return (
    <main className={styles.page}>
      <Topbar
        title='Redeem'
        subtitle='Redeem your on-chain collectibles as physical items.'
      >
        <button
          type='button'
          className={`${styles.btn} ${styles.headerCart}`}
          onClick={() => setDrawer(true)}
        >
          Redemption <span className={styles.countBadge}>{cart.length}</span>
        </button>
      </Topbar>
      <Messages />
      {journal && (
        <div className={styles.notice} style={{ marginBottom: 16 }}>
          A checkout is pending reconciliation (
          <span className={styles.mono}>{orderNumber(journal.requestId)}</span>
          ). <Link href='/redeem/cart'>Open the cart</Link> to read its status
          before paying again.
        </div>
      )}

      {!wallet || !session ? (
        <div className={styles.emptyCard}>
          <span>Sign in for Redeem to see the cards you can redeem.</span>
          <span className={`${styles.small} ${styles.muted}`}>
            Signing in is a signed message (no transaction); the wallet access
            token lives only in this tab's memory.
          </span>
        </div>
      ) : (
        <>
          <section>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Record</h2>
              <Link href='/redeem/orders' className={styles.small}>
                View all →
              </Link>
            </div>
            {ordersError ? (
              <p className={styles.alert}>{ordersError}</p>
            ) : orders === null ? (
              <p className={styles.muted}>Loading orders...</p>
            ) : orders.length === 0 ? (
              <p className={styles.muted}>No redemption orders found.</p>
            ) : (
              <div className={styles.strip}>
                {orders.map((order) => (
                  <OrderCard key={order.requestId} order={order} />
                ))}
              </div>
            )}
          </section>

          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Available for redemption</h2>
            <span className={`${styles.small} ${styles.muted}`}>
              {total === undefined
                ? `Showing ${shown} cards`
                : `Showing ${shown} of ${total} cards`}
            </span>
          </div>
          <p className={`${styles.small} ${styles.muted}`}>
            Redeem separately for different regions.
          </p>

          <div className={styles.filterBar}>
            <div className={styles.chipRow}>
              {counts &&
                orderedRegions(counts).map((code) => (
                  <button
                    type='button'
                    key={code}
                    className={`${styles.filterChip} ${region === code ? styles.filterChipActive : ''}`}
                    onClick={() => changeRegion(region === code ? 'all' : code)}
                  >
                    {code}
                    <span className={styles.countBubble}>{counts[code]}</span>
                  </button>
                ))}
            </div>
            <div className={styles.searchRow}>
              <div className={styles.viewToggle}>
                <button
                  type='button'
                  className={`${styles.viewBtn} ${view === 'table' ? styles.viewBtnActive : ''}`}
                  onClick={() => setView('table')}
                >
                  Table
                </button>
                <button
                  type='button'
                  className={`${styles.viewBtn} ${view === 'grid' ? styles.viewBtnActive : ''}`}
                  onClick={() => setView('grid')}
                >
                  Grid
                </button>
              </div>
              <div className={styles.searchWrap}>
                <span className={styles.searchIcon} aria-hidden>
                  ⌕
                </span>
                <input
                  className={`${styles.input} ${styles.searchInput}`}
                  placeholder='Search cards'
                  aria-label='Search cards'
                  maxLength={SEARCH_MAX}
                  value={search}
                  onChange={(e) => changeSearch(e.target.value)}
                />
              </div>
              <select
                className={styles.select}
                aria-label='Sort by'
                value={sort}
                onChange={(e) => changeSort(e.target.value as Sort)}
              >
                <option value='fmv-desc'>Highest FMV</option>
                <option value='fmv-asc'>Lowest FMV</option>
              </select>
            </div>
          </div>

          {listError ? (
            <div className={styles.emptyCard}>
              <span>{listError}</span>
              <button
                type='button'
                className={`${styles.btn} ${styles.btnRainbow} ${styles.btnRainbowSmall}`}
                onClick={() => setCursors((previous) => [...previous])}
              >
                Try again
              </button>
            </div>
          ) : page === null || (loading && page.items.length === 0) ? (
            <div className={styles.loader}>Loading cards…</div>
          ) : page.items.length === 0 ? (
            <div className={styles.emptyCard}>
              <span>No cards available for redemption.</span>
            </div>
          ) : view === 'grid' ? (
            <div
              className={styles.grid}
              style={loading ? { opacity: 0.6 } : undefined}
            >
              {page.items.map((card) => (
                <GridTile
                  key={card.tokenId.toString()}
                  card={card}
                  inCart={isInCart(card.tokenId)}
                  label={
                    region === 'all'
                      ? card.regionCountryCode
                      : card.vaultDisplayName || card.regionCountryCode
                  }
                  onToggle={() => toggle(card)}
                />
              ))}
            </div>
          ) : (
            <div
              className={styles.tableWrap}
              style={loading ? { opacity: 0.6 } : undefined}
            >
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>FMV</th>
                    <th>Location</th>
                    <th>Purchase / Mint date</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((card) => {
                    const inCart = isInCart(card.tokenId);
                    return (
                      <tr key={card.tokenId.toString()}>
                        <td>
                          <div className={styles.itemCell}>
                            <Image
                              width={140}
                              height={140}
                              sizes='(max-width: 760px) 80px, 140px'
                              className={styles.thumb}
                              src={card.frontImageUrl}
                              alt={card.name}
                            />
                            <div className={styles.summaryItemBody}>
                              <span className={styles.itemName}>
                                {card.name}
                              </span>
                              {inCart && (
                                <span
                                  className={styles.addedPill}
                                  style={{ position: 'static' }}
                                >
                                  Added to cart
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <FmvBadge
                            cents={card.rixPriceInUsd}
                            updatedAt={card.rixPriceUpdatedAt}
                          />
                        </td>
                        <td>
                          <div className={styles.kv}>
                            <span>{card.vaultDisplayName || '—'}</span>
                            <span className={styles.kvLabel}>
                              {card.regionCountryCode}
                            </span>
                          </div>
                        </td>
                        <td>{dateDmy(card.ownerAcquiredAt)}</td>
                        <td>
                          <button
                            type='button'
                            className={
                              inCart
                                ? `${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`
                                : `${styles.btn} ${styles.btnRainbow} ${styles.btnRainbowSmall}`
                            }
                            onClick={() => toggle(card)}
                          >
                            {inCart ? 'Remove from cart' : 'Redeem'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {page && (page.hasMore || pageIndex > 0) && (
            <div className={styles.pager}>
              <button
                type='button'
                className={`${styles.btn} ${styles.btnSmall}`}
                disabled={pageIndex === 0 || loading}
                onClick={previousPage}
              >
                Previous
              </button>
              <span className={styles.muted}>
                {total === undefined
                  ? `Page ${pageIndex + 1}`
                  : `Page ${pageIndex + 1} of ${Math.max(1, Math.ceil(total / PAGE_SIZE))} · ${start + 1}–${start + shown}`}
              </span>
              <button
                type='button'
                className={`${styles.btn} ${styles.btnSmall}`}
                disabled={!page.hasMore || loading}
                onClick={nextPage}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <button
        type='button'
        className={`${styles.btn} ${styles.btnSolid} ${styles.fab}`}
        onClick={() => setDrawer(true)}
        aria-label='Open redemption cart'
      >
        Redemption ({cart.length})
      </button>
      {drawer && <CartDrawer onClose={() => setDrawer(false)} />}

      {dialog?.kind === 'region' && (
        <Dialog
          title='Notice'
          onClose={() => setDialog(null)}
          footer={
            <>
              <button
                type='button'
                className={`${styles.btn} ${styles.btnRainbow}`}
                onClick={() => {
                  replaceCart(dialog.card);
                  note(`Cart emptied; added ${dialog.card.name}.`);
                  setDialog(null);
                }}
              >
                Confirm
              </button>
              <button
                type='button'
                className={`${styles.btn} ${styles.btnOutline} ${styles.btnTall}`}
                onClick={() => setDialog(null)}
              >
                Cancel
              </button>
            </>
          }
        >
          <p>
            Adding collectibles from a different region will empty the items
            already in your cart.
          </p>
          <p className={`${styles.small} ${styles.muted}`}>
            Cart region: {dialog.region} · this card:{' '}
            {dialog.card.regionCountryCode}
          </p>
        </Dialog>
      )}
      {dialog?.kind === 'limit' && (
        <Dialog
          title='Card limit reached'
          onClose={() => setDialog(null)}
          footer={
            <button
              type='button'
              className={`${styles.btn} ${styles.btnRainbow}`}
              onClick={() => setDialog(null)}
            >
              Got it
            </button>
          }
        >
          <p>
            You can redeem up to {max} cards per order. Remove a card to add a
            different one.
          </p>
        </Dialog>
      )}

      <DeveloperPanel />
    </main>
  );
}

function GridTile({
  card,
  inCart,
  label,
  onToggle,
}: {
  card: RedeemableCard;
  inCart: boolean;
  label: string;
  onToggle: () => void;
}) {
  const cta = inCart ? 'Remove' : 'Redeem';
  return (
    <div className={`${styles.tile} ${inCart ? styles.tileInCart : ''}`}>
      <div className={styles.tileMedia}>
        {inCart && <span className={styles.addedPill}>Added to cart</span>}
        <Image
          fill
          sizes='(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw'
          className={styles.slab}
          src={card.frontImageUrl}
          alt={card.name}
        />
        <span className={styles.vaultLabel}>{label}</span>
        <div className={styles.tileOverlay}>
          <FmvBadge
            cents={card.rixPriceInUsd}
            updatedAt={card.rixPriceUpdatedAt}
          />
          <button
            type='button'
            className={
              inCart
                ? `${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`
                : `${styles.btn} ${styles.btnRainbow} ${styles.btnRainbowSmall}`
            }
            onClick={onToggle}
          >
            {cta}
          </button>
        </div>
      </div>
      <div className={styles.tileBody}>
        <CardName name={card.name} />
        <div className={styles.tileFooter}>
          <FmvBadge
            cents={card.rixPriceInUsd}
            updatedAt={card.rixPriceUpdatedAt}
          />
          <button
            type='button'
            className={`${styles.btn} ${styles.btnSmall} ${styles.tileMobileCta}`}
            onClick={onToggle}
          >
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
}
