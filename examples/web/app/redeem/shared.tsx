'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { shortHex, usd } from '../eoa/format';
import { relativeAgoLong, splitCardName } from '../marketplace/helpers';
import styles from './redeem.module.css';
import { useRedeem } from './redeem-provider';
import { orderNumber, sumFmv, trackingLabel } from './rules';
import type { RedemptionOrderFees, RedemptionOrderSummary } from './types';

export function Topbar({
  title,
  subtitle,
  back,
  children,
}: {
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
  children?: ReactNode;
}) {
  const {
    wallet,
    session,
    busy,
    connect,
    disconnect,
    verifyShipping,
    endShippingSession,
    work,
  } = useRedeem();
  return (
    <div className={styles.topbar}>
      <div className={styles.brand}>
        <span className={styles.eyebrow}>Renaiss SDK · redemption · EOA</span>
        {back && (
          <Link href={back.href} className={`${styles.small} ${styles.muted}`}>
            ← {back.label}
          </Link>
        )}
        <h1 className={styles.h1}>{title}</h1>
        {subtitle && <p className={styles.muted}>{subtitle}</p>}
      </div>
      <div className={styles.headerActions}>
        {children}
        {wallet && (
          <button
            type='button'
            className={`${styles.btn} ${styles.btnSolid}`}
            disabled={busy}
            onClick={() =>
              void work(session ? endShippingSession : verifyShipping)
            }
          >
            {session ? 'Sign out of Redeem' : 'Sign in for Redeem'}
          </button>
        )}
        {wallet ? (
          <button
            type='button'
            className={`${styles.btn} ${styles.btnOutline}`}
            title={session ? 'Signed in for Redeem' : undefined}
            disabled={busy}
            onClick={() => void work(disconnect)}
          >
            {shortHex(wallet.account)} · Disconnect wallet
          </button>
        ) : (
          <button
            type='button'
            className={`${styles.btn} ${styles.btnSolid}`}
            disabled={busy}
            onClick={() => void work(connect)}
          >
            Connect wallet
          </button>
        )}
      </div>
    </div>
  );
}

export function Messages() {
  const { error, status } = useRedeem();
  return (
    <>
      {error && (
        <div className={styles.alert} role='alert'>
          {error}
        </div>
      )}
      {status && (
        <p className={styles.status} role='status'>
          {status}
        </p>
      )}
    </>
  );
}

/** Gold "FMV $ 172" pill; the hover text explains how fresh the value is. */
export function FmvBadge({
  cents,
  updatedAt,
  size = 'small',
}: {
  cents: bigint | null;
  updatedAt?: string | null;
  size?: 'small' | 'large';
}) {
  const title = updatedAt
    ? `Fair market value · Priced ${relativeAgoLong(updatedAt, Date.now())} ago`
    : undefined;
  return (
    <span
      className={styles.fmvBadge}
      title={title}
      style={size === 'large' ? { fontSize: 14 } : undefined}
    >
      <span className={styles.fmvLabel}>FMV</span>
      <span>{cents === null ? 'N/A' : `$ ${usd(cents.toString(), 2)}`}</span>
    </span>
  );
}

/** Card name: grey part before "#", white part from "#". */
export function CardName({ name }: { name: string }) {
  const { title, subtitle } = splitCardName(name);
  return (
    <div style={{ minWidth: 0 }}>
      <div className={styles.tileTitle}>{title || '​'}</div>
      {subtitle && <div className={styles.tileSubtitle}>{subtitle}</div>}
    </div>
  );
}

export function Dialog({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={styles.overlay}>
      <div
        className={`${styles.dialog} ${wide ? styles.dialogWide : ''}`}
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

export function Tip({ children }: { children: ReactNode }) {
  return (
    <button type='button' className={styles.tip} aria-label='More information'>
      i<span className={styles.tipBox}>{children}</span>
    </button>
  );
}

export function OrderCard({ order }: { order: RedemptionOrderSummary }) {
  const shown = order.collectibles.slice(0, 3);
  const extra = order.collectibles.length - shown.length;
  const single = order.collectibles.length === 1;
  return (
    <Link
      href={`/redeem/orders/${order.requestId}`}
      className={styles.orderCard}
    >
      <div className={styles.orderMeta}>
        <span>
          Tracking no. <strong>{order.trackingNumber ?? ' '}</strong>
        </span>
        <span>
          Status{' '}
          <strong>{trackingLabel(order.status, order.shipmentStatus)}</strong>
        </span>
        <span>
          Order{' '}
          <strong className={styles.mono}>
            {orderNumber(order.requestId)}
          </strong>
        </span>
      </div>
      <div
        className={`${styles.orderImages} ${single ? styles.orderImagesLarge : ''}`}
      >
        {shown.map((card) => (
          <div key={card.tokenId.toString()} className={styles.orderImg}>
            <Image
              src={card.frontImageUrl}
              alt={card.name}
              fill
              sizes={
                single
                  ? '(max-width: 768px) 25vw, (max-width: 999px) 50vw, (max-width: 1179px) 33vw, 280px'
                  : '(max-width: 760px) 25vw, 140px'
              }
            />
          </div>
        ))}
        {extra > 0 && (
          <div className={styles.orderImg}>
            {order.collectibles[3] && (
              <Image
                src={order.collectibles[3].frontImageUrl}
                alt=''
                fill
                sizes='(max-width: 760px) 25vw, 140px'
              />
            )}
            <span className={styles.orderMore}>+{extra}</span>
          </div>
        )}
      </div>
      <div className={styles.orderFoot}>
        <span className={styles.muted}>Items {order.collectibles.length}</span>
        <FmvBadge cents={sumFmv(order.collectibles)} />
      </div>
    </Link>
  );
}

/**
 * Read-only fees: handling, shipping, insurance, total
 * (duties shown separately, paid on delivery). Amounts are server cents.
 */
export function FeeBreakdown({
  fees,
  fmv,
  count,
  showShippingTooltip = true,
}: {
  fees: RedemptionOrderFees;
  fmv: bigint | null;
  count: number;
  showShippingTooltip?: boolean;
}) {
  const total =
    fees.handlingFeeInUsd + fees.shippingFeeInUsd + fees.insuranceFeeInUsd;
  return (
    <div className={styles.breakdown}>
      <div className={styles.fmvBox}>
        <span>
          Total FMV • {count} item{count === 1 ? '' : 's'}
        </span>
        <span>{fmv === null ? 'N/A' : `$ ${usd(fmv.toString(), 2)}`}</span>
      </div>
      {fees.insuranceFeeInUsd > 0n && (
        <div className={styles.breakdownRow}>
          <span>Insurance</span>
          <span>$ {usd(fees.insuranceFeeInUsd.toString(), 2)}</span>
        </div>
      )}
      <div className={styles.breakdownRow}>
        <span>Handling fee</span>
        <span>$ {usd(fees.handlingFeeInUsd.toString(), 2)}</span>
      </div>
      <div className={styles.breakdownRow}>
        <span>
          Shipping cost
          {showShippingTooltip && (
            <Tip>Shipping cost is calculated by courier and total weight.</Tip>
          )}
        </span>
        <span>$ {usd(fees.shippingFeeInUsd.toString(), 2)}</span>
      </div>
      <div className={`${styles.breakdownRow} ${styles.breakdownTotal}`}>
        <span>Total</span>
        <span>$ {usd(total.toString(), 2)}</span>
      </div>
      {fees.dutyAndTaxesInUsd > 0n && (
        <div className={styles.dutyBox}>
          <div className={styles.breakdownRow}>
            <span>Estimated duties &amp; taxes</span>
            <span>$ {usd(fees.dutyAndTaxesInUsd.toString(), 2)}</span>
          </div>
          <span className={styles.muted}>
            You may need to pay duties/taxes upon receiving your package,
            depending on the destination country.
          </span>
        </div>
      )}
    </div>
  );
}

export function AddressCard({
  title = 'Shipping address',
  name,
  address,
}: {
  title?: string;
  name: string;
  address: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state?: string;
    postalCode: string;
    countryCode: string;
  };
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>{title}</div>
      <div className={styles.kv}>
        <span>{name}</span>
        <span>{address.addressLine1}</span>
        {address.addressLine2 && <span>{address.addressLine2}</span>}
        <span>
          {[address.city, address.state, address.postalCode]
            .filter(Boolean)
            .join(', ')}
          , {address.countryCode}
        </span>
      </div>
    </div>
  );
}

export function ContactCard({
  name,
  email,
  phone,
  chineseName,
}: {
  name: string;
  email: string;
  phone: string;
  chineseName?: string;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Contact information</div>
      <div className={styles.kv}>
        <span>{name}</span>
        {chineseName && <span>{chineseName}</span>}
        <span>{email}</span>
        <span>{phone}</span>
      </div>
    </div>
  );
}

export function DeliveryCard({
  courierName,
  estimatedDays,
  logoUrl,
  shippingFeeInUsd,
}: {
  courierName: string;
  estimatedDays: string | null;
  logoUrl?: string | null;
  shippingFeeInUsd: bigint;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Delivery</div>
      <div className={styles.radioRow} style={{ cursor: 'default' }}>
        {/* Orders carry only courierName; a logo comes from a quote. Without
            one, the name in the line below identifies the courier. */}
        {logoUrl ? <CourierLogo name={courierName} logoUrl={logoUrl} /> : null}
        <div className={styles.courierBody}>
          <span className={styles.muted}>Estimated delivery time</span>
          <span>{estimatedDays ?? '—'}</span>
          <span>
            USDT {usd(shippingFeeInUsd.toString(), 2)} - {courierName}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CourierLogo({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  return (
    <span className={styles.courierLogo}>
      {logoUrl ? (
        <Image src={logoUrl} alt={name} width={80} height={48} unoptimized />
      ) : (
        name
      )}
    </span>
  );
}
