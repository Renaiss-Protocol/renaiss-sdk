'use client';

import Image from 'next/image';
import Link from 'next/link';
import styles from './redeem.module.css';
import { useRedeem } from './redeem-provider';
import { cartRegion, sumFmv } from './rules';
import { FmvBadge } from './shared';

export function CartDrawer({ onClose }: { onClose: () => void }) {
  const { cart, config, removeFromCart } = useRedeem();
  const region = cartRegion(cart);
  const max = config.maxCards;
  return (
    <>
      <button
        type='button'
        className={styles.drawerOverlay}
        aria-label='Close cart'
        onClick={onClose}
      />
      <aside className={styles.drawer} aria-label='Redemption cart'>
        <div className={styles.drawerHead}>
          <div className={styles.drawerTitle}>
            <span>Redemption cart</span>
            <button
              type='button'
              className={`${styles.btn} ${styles.btnSmall}`}
              aria-label='Close cart'
              onClick={onClose}
            >
              ✕
            </button>
          </div>
          <span className={styles.rainbowText}>
            {cart.length} item{cart.length === 1 ? '' : 's'} in your cart
          </span>
          <span className={`${styles.small} ${styles.muted}`}>
            Location: {region ? region : '—'}
          </span>
        </div>
        <div className={styles.drawerBody}>
          {cart.length === 0 && (
            <p className={styles.muted}>Your cart is empty.</p>
          )}
          {cart.map((card) => (
            <div key={card.tokenId.toString()} className={styles.drawerItem}>
              <Image
                width={100}
                height={100}
                className={`${styles.thumb} ${styles.thumbCart}`}
                src={card.frontImageUrl}
                alt={card.name}
              />
              <div className={styles.summaryItemBody}>
                <span className={styles.itemName}>{card.name}</span>
                <span className={`${styles.small} ${styles.muted}`}>
                  {card.regionCountryCode}
                </span>
                <div className={styles.rowLine}>
                  <FmvBadge
                    cents={card.fmvPriceInUsd}
                    updatedAt={card.fmvUpdatedAt}
                  />
                  <button
                    type='button'
                    className={styles.linkBtn}
                    onClick={() => removeFromCart(card.tokenId)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.drawerFoot}>
          <div className={styles.breakdownRow}>
            <span>Total</span>
            <span>
              {cart.length} item{cart.length === 1 ? '' : 's'}
              {sumFmv(cart) !== null && (
                <>
                  {' · '}
                  <FmvBadge cents={sumFmv(cart)} />
                </>
              )}
            </span>
          </div>
          {cart.length > max && (
            <p className={styles.notice}>
              Your cart has more than {max} cards. Remove some to continue.
            </p>
          )}
          {cart.length === 0 || cart.length > max ? (
            <button
              type='button'
              className={`${styles.btn} ${styles.btnRainbow}`}
              disabled
            >
              Go to redemption cart
            </button>
          ) : (
            <Link
              href='/redeem/cart'
              className={`${styles.btn} ${styles.btnRainbow}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
              }}
              onClick={onClose}
            >
              Go to redemption cart
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
