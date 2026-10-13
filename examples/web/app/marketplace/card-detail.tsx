'use client';

import type {
  CardDetail,
  CardOrders,
  MarketplaceConfig,
  MarketplaceOrder,
  Price,
} from '@renaiss-protocol/client';
import Image from 'next/image';
import { useState } from 'react';
import { demoNetwork } from '../demo-network';
import { shortHex, usd, usdt } from '../eoa/format';
import { FmvBadge } from './card-grid';
import {
  cardDisplayRows,
  countdownText,
  initials,
  isSameAddress,
  relativeAgo,
  shortTokenId,
} from './helpers';
import styles from './marketplace.module.css';
import type { DialogState } from './trading-forms';

/*
 * Marketplace card page: sticky media
 * column (front / back slides, thumbnails, fullscreen), then header, metadata,
 * owner row, top offer / last sale box, buyer or owner actions, price history,
 * card details and offers.
 */

const EXPLORER = demoNetwork.chain.blockExplorers.default.url;

type OfferSort = 'latest' | 'highest' | 'lowest' | 'oldest';

const OFFER_SORTS: { value: OfferSort; label: string }[] = [
  { value: 'latest', label: 'Most recent' },
  { value: 'highest', label: 'Highest' },
  { value: 'lowest', label: 'Lowest' },
  { value: 'oldest', label: 'Oldest' },
];

function sortBids(bids: MarketplaceOrder[], order: OfferSort) {
  const sorted = [...bids];
  switch (order) {
    case 'highest':
      return sorted.sort((a, b) =>
        Number(BigInt(b.amountInUsdt) - BigInt(a.amountInUsdt)),
      );
    case 'lowest':
      return sorted.sort((a, b) =>
        Number(BigInt(a.amountInUsdt) - BigInt(b.amountInUsdt)),
      );
    case 'oldest':
      return sorted.sort(
        (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
      );
    default:
      return sorted.sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
  }
}

export function CardDetailView({
  detail,
  orders,
  config,
  address,
  now,
  busy,
  onBack,
  onDialog,
  onShare,
}: {
  detail: CardDetail;
  orders: CardOrders | null;
  config: MarketplaceConfig;
  address: string | undefined;
  now: number;
  busy: boolean;
  onBack: () => void;
  onDialog: (state: DialogState) => void;
  onShare: () => void;
}) {
  const { firstRow, secondRow } = cardDisplayRows(detail);
  const listed = detail.askPriceInUsdt !== null;
  const isOwner = isSameAddress(address, detail.ownerAddress);
  const bids = orders?.activeBids ?? [];
  const yourBid = address
    ? (bids.find((bid) => isSameAddress(bid.ownerAddress, address)) ?? null)
    : null;
  const topBid = detail.pricing.topBid;
  const lastSale = detail.pricing.lastSale;

  return (
    <section>
      <div className={styles.detailTop}>
        <button
          type='button'
          className={`${styles.btn} ${styles.btnSmall}`}
          onClick={onBack}
        >
          ⊞ All cards
        </button>
      </div>
      <div className={styles.detail}>
        <MediaColumn detail={detail} />
        <div className={styles.infoCol}>
          <div className={styles.headerRow}>
            <button
              type='button'
              className={`${styles.btn} ${styles.btnSmall}`}
              aria-label='Share card'
              onClick={onShare}
            >
              ⇪ Share
            </button>
          </div>

          <div className={styles.metaRow}>
            <div className={styles.metaText}>
              <div className={styles.metaLine1}>
                {firstRow.map((part) => (
                  <span key={part}>{part}</span>
                ))}
              </div>
              <div className={styles.metaLine2}>{secondRow}</div>
            </div>
            <div className={styles.priceCol}>
              <span className={styles.bigPrice}>
                {listed && detail.askPriceInUsdt !== null
                  ? `$ ${usdt(detail.askPriceInUsdt, 18)}`
                  : 'Unlisted'}
              </span>
              {detail.fmvPriceInUsd !== null && (
                <FmvBadge
                  cents={detail.fmvPriceInUsd}
                  updatedAt={detail.fmvUpdatedAt}
                />
              )}
            </div>
          </div>

          <div className={styles.ownerRow}>
            <div className={styles.owner}>
              <div className={styles.avatar} aria-hidden>
                {detail.owner?.image ? (
                  <Image
                    src={detail.owner.image}
                    alt=''
                    width={42}
                    height={42}
                    unoptimized
                  />
                ) : detail.owner ? (
                  initials(detail.owner.username)
                ) : (
                  '?'
                )}
              </div>
              <div className={styles.kv}>
                <span className={styles.kvLabel}>Owned by</span>
                <span className={styles.kvValue}>
                  {detail.owner ? (
                    demoNetwork.isTestnet ? (
                      detail.owner.username
                    ) : (
                      <a
                        href={`https://renaiss.xyz/user/${encodeURIComponent(detail.owner.username)}`}
                        target='_blank'
                        rel='noreferrer'
                      >
                        {detail.owner.username}
                      </a>
                    )
                  ) : (
                    <a
                      href={`${EXPLORER}/address/${detail.ownerAddress}`}
                      target='_blank'
                      rel='noreferrer'
                    >
                      {shortHex(detail.ownerAddress)}
                    </a>
                  )}
                  {isOwner ? ' (you)' : ''}
                </span>
              </div>
            </div>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>Address</span>
              <a
                className={styles.kvValue}
                href={`${EXPLORER}/token/${config.contracts.nft}?a=${detail.tokenId}`}
                target='_blank'
                rel='noreferrer'
                title={config.contracts.nft}
              >
                {shortHex(config.contracts.nft)}
              </a>
            </div>
            <div className={styles.kv}>
              <span className={styles.kvLabel}>Token ID</span>
              <span className={styles.kvValue} title={detail.tokenId}>
                {shortTokenId(detail.tokenId)}
              </span>
            </div>
          </div>

          <div className={styles.offerBox}>
            <div className={styles.offerCell}>
              <span className={styles.kvLabel}>Top offer</span>
              <span className={styles.offerValue}>
                {topBid ? `$ ${priceText(topBid)}` : '--'}
              </span>
            </div>
            <div className={styles.offerCell}>
              <span className={styles.kvLabel}>Last sale</span>
              <span className={styles.offerValue}>
                {lastSale ? `$ ${priceText(lastSale)}` : '--'}
              </span>
            </div>
            {yourBid && (
              <div className={styles.offerCell}>
                <span className={styles.kvLabel}>Your offer</span>
                <span className={styles.offerValue}>
                  $ {usdt(yourBid.amountInUsdt, 2)}
                </span>
              </div>
            )}
          </div>

          <div className={styles.actions}>
            {isOwner ? (
              listed ? (
                <>
                  <button
                    type='button'
                    className={`${styles.btn} ${styles.btnSolid} ${styles.btnTall}`}
                    disabled={busy}
                    onClick={() => onDialog({ kind: 'list', mode: 'edit' })}
                  >
                    Edit listing
                  </button>
                  <button
                    type='button'
                    className={`${styles.btn} ${styles.btnOutline} ${styles.btnTall}`}
                    disabled={busy}
                    onClick={() => onDialog({ kind: 'unlist' })}
                  >
                    Unlist item
                  </button>
                </>
              ) : (
                <button
                  type='button'
                  className={`${styles.btn} ${styles.btnSolid} ${styles.btnTall}`}
                  disabled={busy}
                  onClick={() => onDialog({ kind: 'list', mode: 'list' })}
                >
                  List item
                </button>
              )
            ) : (
              <>
                {listed && detail.askPriceInUsdt !== null && (
                  <button
                    type='button'
                    className={`${styles.btn} ${styles.btnRainbow}`}
                    disabled={busy}
                    onClick={() => onDialog({ kind: 'buy' })}
                  >
                    Buy now ${usdt(detail.askPriceInUsdt, 18)}
                  </button>
                )}
                {yourBid ? (
                  <button
                    type='button'
                    className={`${styles.btn} ${styles.btnOutline} ${styles.btnTall}`}
                    disabled={busy}
                    onClick={() =>
                      onDialog({ kind: 'cancel-bid', bid: yourBid })
                    }
                  >
                    Your offer $ {usdt(yourBid.amountInUsdt, 2)} · Cancel offer
                  </button>
                ) : (
                  <button
                    type='button'
                    className={`${styles.btn} ${styles.btnOutline} ${styles.btnTall}`}
                    disabled={busy}
                    onClick={() => onDialog({ kind: 'offer' })}
                  >
                    Make Offer
                  </button>
                )}
              </>
            )}
          </div>

          <PriceHistory points={detail.pricing.priceHistory} />

          <CardDetails detail={detail} />

          <OffersPanel
            bids={bids}
            address={address}
            isOwner={isOwner}
            now={now}
            busy={busy}
            onAccept={(bid) => onDialog({ kind: 'accept', bid })}
            onCancel={(bid) => onDialog({ kind: 'cancel-bid', bid })}
          />
        </div>
      </div>
    </section>
  );
}

/** Pricing values carry their token: USDT is 18-decimal units, USD is cents. */
function priceText(price: Price): string {
  return String(price.token) === 'USD'
    ? usd(price.value, 2)
    : usdt(price.value, 2);
}

type PricePoint = { timestamp: string; amount: Price };

function pointTime(point: PricePoint): number {
  // A numeric timestamp is unix seconds.
  const numeric = Number(point.timestamp);
  return Number.isFinite(numeric)
    ? numeric * 1000
    : Date.parse(point.timestamp);
}

function pointValue(point: PricePoint): number {
  return Number(priceText(point.amount).replaceAll(',', ''));
}

function PriceHistory({ points }: { points: PricePoint[] }) {
  const width = 600;
  const height = 150;
  const pad = 12;
  const values = points.map(pointValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = values.map((value, i) => {
    const x =
      values.length === 1
        ? width / 2
        : pad + (i * (width - 2 * pad)) / (values.length - 1);
    const y = height - pad - ((value - min) / span) * (height - 2 * pad);
    return { x, y, value, key: `${points[i]?.timestamp}-${i}` };
  });
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Price History for Same Card</h3>
      <div className={`${styles.rowLine} ${styles.small}`}>
        <span className={styles.muted}>USDT</span>
        <span>
          {points.length
            ? `${points.length} recorded sale${points.length === 1 ? '' : 's'}`
            : 'No transactions yet'}
        </span>
      </div>
      {points.length > 0 ? (
        <div>
          <svg
            className={styles.chartSvg}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio='none'
            role='img'
            aria-label={`Price history, ${points.length} points`}
          >
            <polyline
              fill='none'
              stroke='#a2efb1'
              strokeWidth='2'
              points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
            />
            {coords.map((c) => (
              <circle key={c.key} cx={c.x} cy={c.y} r='3' fill='#a2efb1'>
                <title>${c.value.toLocaleString()}</title>
              </circle>
            ))}
          </svg>
          <div className={styles.chartLabels}>
            <span>
              {first ? new Date(pointTime(first)).toLocaleDateString() : ''}
            </span>
            <span>
              {min === max
                ? `$ ${max.toLocaleString()}`
                : `$ ${min.toLocaleString()} – $ ${max.toLocaleString()}`}
            </span>
            <span>
              {last ? new Date(pointTime(last)).toLocaleDateString() : ''}
            </span>
          </div>
        </div>
      ) : (
        <div className={styles.chart}>No sales recorded for this card</div>
      )}
    </div>
  );
}

function MediaColumn({ detail }: { detail: CardDetail }) {
  const slides = [detail.frontImageUrl, detail.backImageUrl].filter(
    (src): src is string => !!src,
  );
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const current = slides[Math.min(index, slides.length - 1)];

  return (
    <div className={styles.mediaCol}>
      <button
        type='button'
        className={styles.mediaFrame}
        aria-label={`View ${detail.name} in fullscreen`}
        onClick={() => setFullscreen(true)}
      >
        {current && (
          <Image
            className={styles.mediaImg}
            src={current}
            alt={detail.name}
            fill
            sizes='(max-width: 1000px) 100vw, 50vw'
            priority
          />
        )}
        <span className={styles.magnifier} aria-hidden>
          ⌕
        </span>
        {slides.length > 1 && (
          <span className={styles.dots} aria-hidden>
            {slides.map((src, i) => (
              <span
                key={src}
                className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
              />
            ))}
          </span>
        )}
      </button>
      {slides.length > 1 && (
        <div className={styles.thumbs}>
          {slides.map((src, i) => (
            <button
              type='button'
              key={src}
              className={`${styles.thumbBtn} ${i === index ? styles.thumbActive : ''}`}
              aria-label={`View slide ${i + 1}`}
              onClick={() => setIndex(i)}
            >
              <Image src={src} alt='' width={76} height={76} />
            </button>
          ))}
        </div>
      )}
      {fullscreen && current && (
        <div className={styles.overlay}>
          <div
            role='dialog'
            aria-modal='true'
            aria-label={`${detail.name} fullscreen view`}
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <button
              type='button'
              className={`${styles.btn} ${styles.btnSmall}`}
              style={{ alignSelf: 'flex-end' }}
              onClick={() => setFullscreen(false)}
            >
              ✕ Close
            </button>
            <Image
              src={current}
              alt={detail.name}
              width={1200}
              height={1600}
              sizes='100vw'
              style={{
                width: 'auto',
                height: 'auto',
                maxHeight: '80vh',
                maxWidth: '100%',
                objectFit: 'contain',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** "Card Details": seven rows, built from the flat fields plus Serial / Language attributes. */
function CardDetails({ detail }: { detail: CardDetail }) {
  const [open, setOpen] = useState(true);
  const attribute = (trait: string) =>
    detail.attributes.find((a) => a.trait === trait)?.value;
  const rows: [string, string | undefined][] = [
    ['Grader', detail.gradingCompany],
    ['Serial', attribute('Serial')],
    ['Grade', detail.grade],
    ['Year', String(detail.year)],
    ['Set', detail.setName],
    ['Language', attribute('Language')],
    ['Card Number', detail.cardNumber],
  ];
  const extras = detail.attributes.filter(
    (a) => a.trait !== 'Serial' && a.trait !== 'Language',
  );
  return (
    <div className={styles.section}>
      <button
        type='button'
        className={styles.sectionHead}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.sectionTitle}>Card Details</span>
        <span aria-hidden>{open ? '⌃' : '⌄'}</span>
      </button>
      {open && (
        <div className={styles.detailsRows}>
          {rows.map(([label, value]) => (
            <div key={label} className={styles.detailsRow}>
              <span className={styles.muted}>{label}</span>
              <span>{value ?? '—'}</span>
            </div>
          ))}
          {extras.map((a) => (
            <div key={a.trait} className={styles.detailsRow}>
              <span className={styles.muted}>{a.trait}</span>
              <span>{a.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OffersPanel({
  bids,
  address,
  isOwner,
  now,
  busy,
  onAccept,
  onCancel,
}: {
  bids: MarketplaceOrder[];
  address: string | undefined;
  isOwner: boolean;
  now: number;
  busy: boolean;
  onAccept: (bid: MarketplaceOrder) => void;
  onCancel: (bid: MarketplaceOrder) => void;
}) {
  const [order, setOrder] = useState<OfferSort>('latest');
  const highest = bids.reduce<bigint | null>((max, bid) => {
    const value = BigInt(bid.amountInUsdt);
    return max === null || value > max ? value : max;
  }, null);
  const shown = sortBids(bids, order).slice(0, 5);

  return (
    <div>
      <div className={styles.tabs}>
        <span className={`${styles.tab} ${styles.tabActive}`}>
          Offers <span className={styles.countBubble}>{bids.length}</span>
        </span>
      </div>
      {bids.length === 0 ? (
        <div className={styles.tabEmpty}>There is no offer yet.</div>
      ) : (
        <div>
          <div className={styles.offerSort}>
            <select
              className={styles.select}
              aria-label='Sort offers'
              value={order}
              onChange={(e) => setOrder(e.target.value as OfferSort)}
            >
              {OFFER_SORTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {shown.map((bid) => {
            const mine = isSameAddress(bid.ownerAddress, address);
            const isTop =
              highest !== null && BigInt(bid.amountInUsdt) === highest;
            return (
              <div key={bid.id} className={styles.offerRow}>
                <div className={styles.offerLeft}>
                  <span className={styles.offerTag}>♥ Offer</span>
                  <div className={styles.offerMeta}>
                    <span>
                      <span className={styles.muted}>From </span>
                      <span title={bid.ownerAddress}>
                        {mine ? 'you' : shortHex(bid.ownerAddress)}
                      </span>
                    </span>
                    <span className={styles.muted}>
                      {relativeAgo(bid.createdAt, now)} ago · Expires in{' '}
                      {countdownText(bid.expiresAt, now)}
                    </span>
                  </div>
                </div>
                <div className={styles.offerRight}>
                  <span className={styles.offerAmount}>
                    <span className={styles.muted}>$ </span>
                    {usdt(bid.amountInUsdt, 2)}
                  </span>
                  {isOwner && (
                    <button
                      type='button'
                      className={`${styles.btn} ${styles.btnSmall} ${isTop ? styles.btnSolid : ''}`}
                      disabled={busy}
                      onClick={() => onAccept(bid)}
                    >
                      {isTop ? 'Accept top offer' : 'Accept offer'}
                    </button>
                  )}
                  {mine && (
                    <button
                      type='button'
                      className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                      disabled={busy}
                      onClick={() => onCancel(bid)}
                    >
                      Cancel offer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
