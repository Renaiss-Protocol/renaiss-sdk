'use client';

import { getError, getValue, isFailed } from '@renaiss-protocol/client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { countdown, explorerTx, shortHex, usd, usdt } from '../eoa/format';
import { DeveloperPanel } from './developer-panel';
import styles from './redeem.module.css';
import { unwrap, useRedeem } from './redeem-provider';
import {
  type AddressErrors,
  type AddressForm,
  addressLabel,
  type ContactErrors,
  type ContactForm,
  cartRegion,
  centsToUsdt,
  checkPrepared,
  dateDmy,
  EMAIL_MAX,
  EMPTY_ADDRESS,
  EMPTY_CONTACT,
  type ExpectedRedemption,
  feeLines,
  hasRequiredAddressFields,
  isExpired,
  LINE_MAX,
  NAME_MAX,
  normalizeCountryCode,
  orderNumber,
  POSTAL_MAX,
  quoteKey,
  requiresChineseName,
  requiresTaxId,
  sortedTokenIds,
  sumFmv,
  toForm,
  toRecipient,
  toShippingAddress,
  validateAddress,
  validateContact,
  vaultNames,
} from './rules';
import {
  AddressCard,
  ContactCard,
  CourierLogo,
  DeliveryCard,
  Dialog,
  FeeBreakdown,
  FmvBadge,
  Messages,
  Tip,
  Topbar,
} from './shared';
import type {
  PreparedRedemption,
  RedeemableCard,
  RedemptionCheckout,
  RedemptionCourier,
  RedemptionQuote,
  ShippingAddress,
} from './types';

type Phase =
  | 'idle'
  | 'preparing'
  | 'checking'
  | 'approving'
  | 'signing'
  | 'submitting'
  | 'reconciling';

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'Pay',
  preparing: 'Preparing redemption...',
  checking: 'Checking balance...',
  approving: 'Approving USDT...',
  signing: 'Sign in your wallet...',
  submitting: 'Creating redemption request...',
  reconciling: 'Reconciling...',
};

type Outcome = {
  prepared: PreparedRedemption;
  checkout: RedemptionCheckout;
  courier: RedemptionCourier;
  cards: RedeemableCard[];
  submittedAt: string;
};

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function CheckoutScreen() {
  const ctx = useRedeem();
  const { generation } = ctx;
  // Keyed on the wallet generation: an account or chain change drops every
  // form, quote and in-progress preparation.
  return <CheckoutForm key={generation} />;
}

function CheckoutForm() {
  const router = useRouter();
  const {
    wallet,
    session,
    config,
    cart,
    removeFromCart,
    clearCart,
    requireClient,
    assertWallet,
    fetchBalance,
    ensureAllowance,
    refreshFunds,
    isCurrentWallet,
    balance,
    allowance,
    journal,
    saveJournal,
    busy,
    work,
    note,
    record,
  } = useRedeem();
  const max = config.maxCards;
  const [address, setAddress] = useState<ShippingAddress | null>(null);
  const [addressDialog, setAddressDialog] = useState(false);
  const [contact, setContact] = useState<ContactForm>(EMPTY_CONTACT);
  const [contactErrors, setContactErrors] = useState<ContactErrors>({});
  const [quote, setQuote] = useState<RedemptionQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [courierId, setCourierId] = useState('');
  const [insurance, setInsurance] = useState(false);
  const [terms, setTerms] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const now = useNow(quote !== null);

  const tokenIds = useMemo(() => sortedTokenIds(cart), [cart]);
  const currentKey = address ? quoteKey(address, tokenIds) : null;
  const [quotedKey, setQuotedKey] = useState<string | null>(null);

  // Any address or cart change invalidates the quote and the courier choice.
  useEffect(() => {
    if (quote && quotedKey !== currentKey) {
      setQuote(null);
      setCourierId('');
      setQuotedKey(null);
    }
  }, [quote, quotedKey, currentKey]);

  // The country decides which contact fields exist; clear the others.
  useEffect(() => {
    setContact((previous) => ({
      ...previous,
      taxId:
        address && requiresTaxId(address.countryCode) ? previous.taxId : '',
      chineseName:
        address && requiresChineseName(address.countryCode)
          ? previous.chineseName
          : '',
    }));
  }, [address]);

  const courier = quote?.couriers.find((c) => c.id === courierId) ?? null;
  const lines = quote && courier ? feeLines(quote, courier, insurance) : null;
  const quoteExpired = quote ? isExpired(quote.expiresAt, now) : false;
  const overLimit = cart.length > max;
  const fmv = sumFmv(cart);
  const journalForWallet =
    journal && wallet
      ? journal.walletAddress.toLowerCase() === wallet.account.toLowerCase()
      : false;

  async function getCourierOptions() {
    if (!address) throw new Error('Add a shipping address first.');
    const client = requireClient();
    setQuoteError(null);
    const result = await client.fetchRedemptionQuote({ tokenIds, address });
    if (isFailed(result)) {
      const e = getError(result);
      setQuote(null);
      setCourierId('');
      setQuoteError(`${e.code} (${e.status}): ${e.detail}`);
      throw new Error('Failed to fetch courier rates. Please try again.');
    }
    const value = getValue(result);
    setQuote(value);
    setQuotedKey(currentKey);
    setCourierId(value.couriers[0]?.id ?? '');
    record('POST /v2/redeem/quotes', value);
    note(
      `${value.couriers.length} courier option(s); quote valid until ${new Date(value.expiresAt).toLocaleTimeString()}.`,
    );
  }

  async function pay() {
    if (!address) throw new Error('Add a shipping address first.');
    if (!quote || !courier) throw new Error('Please select a courier service');
    if (!lines) throw new Error('Get courier options first.');
    if (isExpired(quote.expiresAt, Date.now()))
      throw new Error('The quote expired. Get courier options again.');
    const errors = validateContact(contact, address.countryCode);
    setContactErrors(errors);
    if (Object.keys(errors).length > 0)
      throw new Error('Fix the highlighted contact fields.');
    if (!terms)
      throw new Error('Confirm that your NFTs will be permanently burned.');
    if (overLimit)
      throw new Error(
        `Your cart has more than ${max} cards. Remove some to continue.`,
      );
    if (journal)
      throw new Error('Reconcile the pending checkout before paying again.');
    if (lines.total <= 0n)
      throw new Error('The redemption total must be positive.');
    const client = requireClient();
    const connected = await assertWallet();
    const recipient = toRecipient(contact, address.countryCode);
    const expected: ExpectedRedemption = {
      tokenIds,
      totalFeeInUsdt: centsToUsdt(lines.total),
      address,
      recipient,
    };
    try {
      setPhase('preparing');
      const prepared = unwrap(
        await client.prepareRedemption({
          quoteId: quote.quoteId,
          courierId: courier.id,
          recipient,
          insurance,
        }),
      );
      record('POST /v2/redeem/checkout/prepare', prepared);
      const mismatch = checkPrepared(
        prepared,
        expected,
        connected.account,
        Date.now(),
      );
      if (mismatch) throw new Error(mismatch);
      note(
        `Prepared ${orderNumber(prepared.requestId)}; total ${usdt(prepared.fees.totalFeeInUsdt, 2)} USDT, valid until ${new Date(prepared.expiresAt).toLocaleTimeString()}.`,
      );

      setPhase('checking');
      const funds = await fetchBalance();
      if (funds < prepared.fees.totalFeeInUsdt)
        throw new Error(
          `Insufficient USDT balance. You have ${usdt(funds, 2)} USDT but need ${usdt(prepared.fees.totalFeeInUsdt, 2)} USDT`,
        );

      setPhase('approving');
      await ensureAllowance(prepared.fees.totalFeeInUsdt);

      setPhase('signing');
      await assertWallet();
      note('Please sign the redemption request in your wallet...');
      const signed = unwrap(
        await client.signRedemption({ prepared, expected }),
      );

      // Journal first: the submit below must never run unrecorded.
      saveJournal({
        preparationId: signed.preparationId,
        requestId: signed.requestId,
        walletAddress: connected.account,
        savedAt: new Date().toISOString(),
      });

      setPhase('submitting');
      const result = await client.submitRedemption({ signed });
      record('POST /v2/redeem/checkout', result);
      if (isFailed(result)) {
        const e = getError(result);
        throw new Error(
          `Submission uncertain (${e.code}: ${e.detail}). Do not pay again; use Reconcile to read the checkout status.`,
        );
      }
      const state = getValue(result);
      switch (state.status) {
        case 'succeeded':
          saveJournal();
          setOutcome({
            prepared,
            checkout: state,
            courier,
            cards: cart,
            submittedAt: new Date().toISOString(),
          });
          if (isCurrentWallet(connected)) clearCart();
          note(
            `Redemption ${orderNumber(state.requestId)} submitted${state.transactionHash ? ` (${shortHex(state.transactionHash)})` : ''}.`,
          );
          await refreshFunds();
          break;
        case 'failed':
          saveJournal();
          throw new Error(
            'The redemption was rejected before payment. Nothing was charged; review the order and try again.',
          );
        default:
          note(
            `Checkout status is "${state.status}". Keep this page and use Reconcile; do not pay again.`,
          );
      }
    } finally {
      setPhase('idle');
    }
  }

  async function reconcile() {
    if (!journal) return;
    const client = requireClient();
    const connected = await assertWallet();
    setPhase('reconciling');
    try {
      const result = await client.fetchRedemptionCheckout({
        preparationId: journal.preparationId,
      });
      record('GET /v2/redeem/checkout/{preparationId}', result);
      if (isFailed(result)) {
        const e = getError(result);
        throw new Error(
          `${e.code} (${e.status}): ${e.detail}. If the checkout status is no longer available, check the orders list before dismissing.`,
        );
      }
      const state = getValue(result);
      switch (state.status) {
        case 'succeeded':
          saveJournal();
          if (isCurrentWallet(connected)) clearCart();
          note(
            `Redemption ${orderNumber(state.requestId)} succeeded${state.transactionHash ? ` (${shortHex(state.transactionHash)})` : ''}. It is listed under your orders once indexed.`,
          );
          break;
        case 'failed':
          saveJournal();
          note(
            'The pending checkout failed before payment. You can start a new one.',
          );
          break;
        case 'prepared':
          saveJournal();
          note(
            'The pending checkout was never submitted; the preparation expires on its own. Start a new checkout.',
          );
          break;
        default:
          note('The checkout is still submitting. Check again in a moment.');
      }
    } finally {
      setPhase('idle');
    }
  }

  function removeItem(card: RedeemableCard) {
    removeFromCart(card.tokenId);
    if (cart.length === 1) router.push('/redeem');
  }

  const region = cartRegion(cart);

  if (!wallet || !session)
    return (
      <Shell>
        <div className={styles.emptyCard}>
          <span>Sign in for Redeem to view your cart.</span>
        </div>
      </Shell>
    );

  if (outcome)
    return (
      <Shell>
        <Confirmation outcome={outcome} />
      </Shell>
    );

  return (
    <Shell>
      {journal && (
        <div className={styles.notice} style={{ marginBottom: 16 }}>
          <div
            className={styles.rowLine}
            style={{ justifyContent: 'space-between' }}
          >
            <span>
              A checkout is pending reconciliation:{' '}
              <span className={styles.mono}>
                {orderNumber(journal.requestId)}
              </span>{' '}
              (wallet {shortHex(journal.walletAddress)}, journaled{' '}
              {new Date(journal.savedAt).toLocaleString()}). Paying again could
              charge twice; read its status first.
            </span>
            <span className={styles.rowLine}>
              {journalForWallet ? (
                <button
                  type='button'
                  className={`${styles.btn} ${styles.btnSmall}`}
                  disabled={busy}
                  onClick={() => void work(reconcile)}
                >
                  {phase === 'reconciling' ? 'Reconciling...' : 'Reconcile'}
                </button>
              ) : (
                <span className={styles.small}>
                  Connect that wallet and sign in for Redeem to reconcile.
                </span>
              )}
              <button
                type='button'
                className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                disabled={busy}
                onClick={() => {
                  saveJournal();
                  note('Pending checkout dismissed without reconciliation.');
                }}
              >
                Dismiss
              </button>
            </span>
          </div>
        </div>
      )}

      {cart.length === 0 ? (
        <div className={styles.emptyCard}>
          <span>Your cart is empty</span>
          <span className={`${styles.small} ${styles.muted}`}>
            Add items to your cart to continue
          </span>
          <Link href='/redeem' className={styles.small}>
            ← Back to redeem
          </Link>
        </div>
      ) : (
        <div className={styles.checkoutGrid}>
          <div className={`${styles.col} ${styles.sticky}`}>
            <div className={styles.info}>
              Redeeming these cards will permanently burn the NFTs and cannot be
              undone.
            </div>
            <span className={styles.rainbowText}>
              Total redeem: {cart.length} item{cart.length === 1 ? '' : 's'}
            </span>
            <span className={`${styles.small} ${styles.muted}`}>
              Vault: {vaultNames(cart)}
            </span>
            <div className={styles.summaryList}>
              {cart.map((card) => (
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
                    <div className={styles.rowLine}>
                      <FmvBadge
                        cents={card.fmvPriceInUsd}
                        updatedAt={card.fmvUpdatedAt}
                      />
                      <span className={`${styles.small} ${styles.muted}`}>
                        {card.regionCountryCode}
                      </span>
                      <button
                        type='button'
                        className={styles.linkBtn}
                        disabled={busy}
                        onClick={() => removeItem(card)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 4 && (
              <span className={styles.scrollHint}>Scroll for more items</span>
            )}
          </div>

          <div className={styles.col}>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Shipping address</div>
              <span className={styles.fieldLabel}>Address for this order</span>
              {address ? (
                <div className={`${styles.radioRow} ${styles.radioRowActive}`}>
                  <span className={styles.radioDot} />
                  <span>{addressLabel(address)}</span>
                </div>
              ) : (
                <span className={`${styles.small} ${styles.muted}`}>
                  No address yet. Add one to get courier options.
                </span>
              )}
              <button
                type='button'
                className={`${styles.btn} ${styles.btnOutline}`}
                disabled={busy}
                onClick={() => setAddressDialog(true)}
              >
                {address ? 'Change address' : '+ Add new address'}
              </button>
            </div>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Contact information</div>
              <div className={`${styles.formGrid} ${styles.formGrid2}`}>
                <Field
                  id='redeem-contact-firstName'
                  label='First Name'
                  error={contactErrors.firstName}
                >
                  {(controlProps) => (
                    <input
                      {...controlProps}
                      className={`${styles.input} ${contactErrors.firstName ? styles.inputError : ''}`}
                      maxLength={NAME_MAX}
                      value={contact.firstName}
                      onChange={(e) =>
                        setContact({ ...contact, firstName: e.target.value })
                      }
                    />
                  )}
                </Field>
                <Field
                  id='redeem-contact-lastName'
                  label='Last Name'
                  error={contactErrors.lastName}
                >
                  {(controlProps) => (
                    <input
                      {...controlProps}
                      className={`${styles.input} ${contactErrors.lastName ? styles.inputError : ''}`}
                      maxLength={NAME_MAX}
                      value={contact.lastName}
                      onChange={(e) =>
                        setContact({ ...contact, lastName: e.target.value })
                      }
                    />
                  )}
                </Field>
              </div>
              <span className={styles.fieldHint}>
                First and last name together: {NAME_MAX} characters max.
              </span>
              {address && requiresChineseName(address.countryCode) && (
                <Field
                  id='redeem-contact-chineseName'
                  label='Chinese Recipient Name'
                  tip='The recipient name in Chinese characters.'
                  error={contactErrors.chineseName}
                >
                  {(controlProps) => (
                    <input
                      {...controlProps}
                      className={`${styles.input} ${contactErrors.chineseName ? styles.inputError : ''}`}
                      placeholder='Enter Chinese name'
                      value={contact.chineseName}
                      onChange={(e) =>
                        setContact({ ...contact, chineseName: e.target.value })
                      }
                    />
                  )}
                </Field>
              )}
              <Field
                id='redeem-contact-email'
                label='Email'
                error={contactErrors.email}
              >
                {(controlProps) => (
                  <input
                    {...controlProps}
                    className={`${styles.input} ${contactErrors.email ? styles.inputError : ''}`}
                    type='email'
                    maxLength={EMAIL_MAX}
                    value={contact.email}
                    onChange={(e) =>
                      setContact({ ...contact, email: e.target.value })
                    }
                  />
                )}
              </Field>
              <Field
                id='redeem-contact-phone'
                label='Phone'
                error={contactErrors.phone}
                hint='International format with country code, e.g. +12025550101.'
              >
                {(controlProps) => (
                  <input
                    {...controlProps}
                    className={`${styles.input} ${contactErrors.phone ? styles.inputError : ''}`}
                    type='tel'
                    placeholder='+'
                    value={contact.phone}
                    onChange={(e) =>
                      setContact({ ...contact, phone: e.target.value })
                    }
                  />
                )}
              </Field>
              {address && requiresTaxId(address.countryCode) && (
                <Field
                  id='redeem-contact-taxId'
                  label='Tax ID'
                  error={contactErrors.taxId}
                  hint='Check the tax ID before continuing.'
                >
                  {(controlProps) => (
                    <input
                      {...controlProps}
                      className={`${styles.input} ${contactErrors.taxId ? styles.inputError : ''}`}
                      value={contact.taxId}
                      onChange={(e) =>
                        setContact({ ...contact, taxId: e.target.value })
                      }
                    />
                  )}
                </Field>
              )}
            </div>
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>Delivery</div>
                <button
                  type='button'
                  className={`${styles.btn} ${styles.btnSmall}`}
                  disabled={
                    busy ||
                    !address ||
                    !hasRequiredAddressFields(toForm(address))
                  }
                  onClick={() => void work(getCourierOptions)}
                >
                  {busy && phase === 'idle'
                    ? 'Loading...'
                    : 'Get courier options'}
                </button>
              </div>
              {quoteError && <div className={styles.alert}>{quoteError}</div>}
              {quote ? (
                <>
                  <span className={styles.fieldLabel}>
                    {quote.couriers.length
                      ? 'Select courier'
                      : 'No courier is available for this address'}
                  </span>
                  {quote.couriers.map((option) => (
                    <button
                      type='button'
                      key={option.id}
                      className={`${styles.radioRow} ${courierId === option.id ? styles.radioRowActive : ''}`}
                      onClick={() => setCourierId(option.id)}
                      disabled={busy}
                    >
                      <span className={styles.radioDot} />
                      <CourierLogo
                        name={option.name}
                        logoUrl={option.logoUrl}
                      />
                      <div className={styles.courierBody}>
                        <span className={styles.muted}>
                          Estimated delivery time
                        </span>
                        <span>{option.estimatedDays}</span>
                        <span>
                          USDT {usd(option.shippingFeeInUsd.toString(), 2)} -{' '}
                          {option.name}
                        </span>
                      </div>
                    </button>
                  ))}
                  <span
                    className={`${styles.small} ${quoteExpired ? styles.sGap : styles.muted}`}
                  >
                    {quoteExpired
                      ? 'Quote expired — get courier options again.'
                      : `Quote valid for ${countdown(Date.parse(quote.expiresAt), now)}`}
                  </span>
                </>
              ) : (
                <span className={`${styles.small} ${styles.muted}`}>
                  {address
                    ? 'Get courier options for this address and cart.'
                    : 'Add a shipping address to see courier options.'}
                </span>
              )}
            </div>
            <div className={styles.card}>
              <label className={styles.checkbox}>
                <input
                  type='checkbox'
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                />
                <span>
                  I understand my NFTs will be permanently burned to complete
                  this redemption.
                </span>
              </label>
              <div className={styles.breakdown}>
                <div className={styles.fmvBox}>
                  <span>
                    Total FMV • {cart.length} item{cart.length === 1 ? '' : 's'}
                  </span>
                  <span>
                    {fmv === null ? 'N/A' : `$ ${usd(fmv.toString(), 2)}`}
                  </span>
                </div>
                <label className={styles.checkbox} style={{ color: '#acacac' }}>
                  <input
                    type='checkbox'
                    checked={insurance}
                    disabled={!courier}
                    onChange={(e) => setInsurance(e.target.checked)}
                  />
                  <span>
                    Insurance for{' '}
                    {courier
                      ? `$${usd(courier.insuranceFeeInUsd.toString(), 2)}`
                      : '—'}
                    <Tip>
                      Optional shipping insurance, charged at the quoted amount.
                    </Tip>
                  </span>
                </label>
                <div className={styles.breakdownRow}>
                  <span>Handling fee</span>
                  <span>
                    {quote
                      ? `$ ${usd(quote.handlingFeeInUsd.toString(), 2)}`
                      : '—'}
                  </span>
                </div>
                <div className={styles.breakdownRow}>
                  <span>
                    Shipping cost
                    <Tip>
                      Shipping cost is calculated by courier and total weight.
                    </Tip>
                  </span>
                  <span>
                    {courier
                      ? `$ ${usd(courier.shippingFeeInUsd.toString(), 2)}`
                      : '—'}
                  </span>
                </div>
                <div
                  className={`${styles.breakdownRow} ${styles.breakdownTotal}`}
                >
                  <span>Total</span>
                  <span>
                    {lines ? `$ ${usd(lines.total.toString(), 2)}` : '—'}
                  </span>
                </div>
                {lines && lines.duties > 0n && (
                  <div className={styles.dutyBox}>
                    <div className={styles.breakdownRow}>
                      <span>Estimated duties &amp; taxes</span>
                      <span>$ {usd(lines.duties.toString(), 2)}</span>
                    </div>
                    <span className={styles.muted}>
                      You may need to pay duties/taxes upon receiving your
                      package, depending on the destination country.
                    </span>
                  </div>
                )}
                {region !== address?.countryCode ? (
                  <span className={`${styles.small} ${styles.muted}`}>
                    Additional customs fees may apply.
                  </span>
                ) : null}
                <div className={styles.breakdownRow}>
                  <span>Balance</span>
                  <span>
                    {balance === null ? '—' : `$ ${usdt(balance, 2)} USDT`}
                  </span>
                </div>
                {allowance !== null && (
                  <div className={styles.breakdownRow}>
                    <span>Permit2 allowance</span>
                    <span
                      className={
                        lines && allowance < centsToUsdt(lines.total)
                          ? styles.sUnused
                          : undefined
                      }
                    >
                      $ {usdt(allowance, 2)}
                      {lines && allowance < centsToUsdt(lines.total)
                        ? ' · approval tx will be requested first'
                        : ''}
                    </span>
                  </div>
                )}
              </div>
              {overLimit && (
                <p className={styles.notice}>
                  Your cart has more than {max} cards. Remove some to continue.
                </p>
              )}
              <button
                type='button'
                className={`${styles.btn} ${styles.btnOutline} ${styles.btnTall}`}
                disabled={
                  busy ||
                  overLimit ||
                  !address ||
                  !courier ||
                  quoteExpired ||
                  !terms ||
                  !!journal
                }
                onClick={() => void work(pay)}
              >
                {PHASE_LABEL[phase]}
              </button>
              {phase !== 'idle' && (
                <span className={styles.payPhase}>
                  Keep this tab open. The order is journaled before it is
                  submitted, so an interruption can be reconciled.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {addressDialog && (
        <AddressDialog
          initial={
            address
              ? toForm(address)
              : { ...EMPTY_ADDRESS, countryCode: region ?? '' }
          }
          onClose={() => setAddressDialog(false)}
          onAccept={(next) => {
            setAddress(next);
            setAddressDialog(false);
            note(`Shipping address set: ${addressLabel(next)}`);
          }}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className={styles.page}>
      <Topbar
        title='Redemption cart'
        back={{ href: '/redeem', label: 'Back' }}
      />
      <Messages />
      {children}
      <DeveloperPanel />
    </main>
  );
}

type FieldControlProps = {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': boolean;
};

function Field({
  id,
  label,
  hint,
  tip,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  tip?: ReactNode;
  error?: string;
  children: (props: FieldControlProps) => ReactNode;
}) {
  const describedBy =
    [hint ? `${id}-hint` : undefined, error ? `${id}-error` : undefined]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>
        <label htmlFor={id}>{label}</label>
        {tip && <Tip>{tip}</Tip>}
      </span>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': Boolean(error),
      })}
      {hint && (
        <span id={`${id}-hint`} className={styles.fieldHint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className={styles.fieldError} role='alert'>
          {error}
        </span>
      )}
    </div>
  );
}

function AddressDialog({
  initial,
  onClose,
  onAccept,
}: {
  initial: AddressForm;
  onClose: () => void;
  onAccept: (address: ShippingAddress) => void;
}) {
  const { requireClient, record, note } = useRedeem();
  const [form, setForm] = useState<AddressForm>(initial);
  const [errors, setErrors] = useState<AddressErrors>({});
  const [validating, setValidating] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  function update(patch: Partial<AddressForm>) {
    setForm((previous) => ({ ...previous, ...patch }));
    setWarning(null);
    setAcknowledged(false);
  }

  async function submit() {
    const found = validateAddress(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const address = toShippingAddress(form);
    if (warning && acknowledged) {
      onAccept(address);
      return;
    }
    setValidating(true);
    setFailure(null);
    try {
      const result = await requireClient().validateRedemptionAddress({
        address,
      });
      if (isFailed(result)) {
        const e = getError(result);
        setFailure(`${e.code} (${e.status}): ${e.detail}`);
        return;
      }
      const value = getValue(result);
      record('POST /v2/redeem/address/validate', value);
      if (value.status === 'verified' || value.status === 'corrected') {
        note(`Address ${value.status}.`);
        onAccept(address);
        return;
      }
      setWarning(value.detail || value.status);
    } finally {
      setValidating(false);
    }
  }

  function counter(value: string, max: number) {
    return value.length > max * 0.7 ? (
      <span className={styles.charCount}>
        {value.length}/{max}
      </span>
    ) : null;
  }

  return (
    <Dialog
      title='Add new address'
      wide
      onClose={onClose}
      footer={
        <>
          {warning && (
            <label className={styles.checkbox}>
              <input
                type='checkbox'
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              <span>I understand and want to proceed with this address</span>
            </label>
          )}
          <button
            type='button'
            className={`${styles.btn} ${styles.btnRainbow}`}
            disabled={validating || (!!warning && !acknowledged)}
            onClick={() => void submit()}
          >
            {validating
              ? 'Validating...'
              : warning
                ? 'Proceed with this address'
                : 'Add new address'}
          </button>
        </>
      }
    >
      {failure && <div className={styles.alert}>{failure}</div>}
      {warning && (
        <div className={styles.notice}>
          Incorrect delivery addresses may cause delays or failed deliveries.
          Please verify your address carefully.
          <br />
          <span className={styles.muted}>Validation: {warning}</span>
        </div>
      )}
      <div className={styles.formGrid}>
        <Field
          id='redeem-address-countryCode'
          label='Country code'
          error={errors.countryCode}
          hint='Two letters, for example US.'
        >
          {(controlProps) => (
            <input
              {...controlProps}
              className={`${styles.input} ${errors.countryCode ? styles.inputError : ''}`}
              autoCapitalize='characters'
              autoComplete='country'
              value={form.countryCode}
              onChange={(e) =>
                update({ countryCode: normalizeCountryCode(e.target.value) })
              }
            />
          )}
        </Field>
        <Field
          id='redeem-address-addressLine1'
          label='Address'
          hint='(Please enter the full road address (street name, number))'
          error={errors.addressLine1}
        >
          {(controlProps) => (
            <span className={styles.inputWrap}>
              <input
                {...controlProps}
                className={`${styles.input} ${errors.addressLine1 ? styles.inputError : ''}`}
                maxLength={LINE_MAX}
                value={form.addressLine1}
                onChange={(e) => update({ addressLine1: e.target.value })}
              />
              {counter(form.addressLine1, LINE_MAX)}
            </span>
          )}
        </Field>
        <Field
          id='redeem-address-addressLine2'
          label='Apartment, suite, etc. (optional)'
          error={errors.addressLine2}
        >
          {(controlProps) => (
            <span className={styles.inputWrap}>
              <input
                {...controlProps}
                className={styles.input}
                maxLength={LINE_MAX}
                value={form.addressLine2}
                onChange={(e) => update({ addressLine2: e.target.value })}
              />
              {counter(form.addressLine2, LINE_MAX)}
            </span>
          )}
        </Field>
        <div className={`${styles.formGrid} ${styles.formGrid2}`}>
          <Field
            id='redeem-address-postalCode'
            label='Postal code (if not applicable, leave 0)'
            error={errors.postalCode}
          >
            {(controlProps) => (
              <input
                {...controlProps}
                className={`${styles.input} ${errors.postalCode ? styles.inputError : ''}`}
                maxLength={POSTAL_MAX}
                value={form.postalCode}
                onChange={(e) => update({ postalCode: e.target.value })}
              />
            )}
          </Field>
          <Field id='redeem-address-city' label='City' error={errors.city}>
            {(controlProps) => (
              <input
                {...controlProps}
                className={`${styles.input} ${errors.city ? styles.inputError : ''}`}
                value={form.city}
                onChange={(e) => update({ city: e.target.value })}
              />
            )}
          </Field>
        </div>
        <Field
          id='redeem-address-state'
          label='State / province (optional)'
          error={errors.state}
        >
          {(controlProps) => (
            <input
              {...controlProps}
              className={`${styles.input} ${errors.state ? styles.inputError : ''}`}
              value={form.state}
              onChange={(e) => update({ state: e.target.value })}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}

function Confirmation({ outcome }: { outcome: Outcome }) {
  const { prepared, checkout, courier, cards, submittedAt } = outcome;
  return (
    <div className={styles.confirmGrid}>
      <div className={styles.col}>
        <h2 className={styles.h1}>
          Order placed! {orderNumber(checkout.requestId)}
        </h2>
        <span className={styles.muted}>Submitted: {dateDmy(submittedAt)}</span>
        <p>Your order was received and is pending confirmation.</p>
        {checkout.transactionHash && (
          <span className={styles.small}>
            Transaction{' '}
            <a
              href={explorerTx(checkout.transactionHash)}
              target='_blank'
              rel='noreferrer'
            >
              {shortHex(checkout.transactionHash)}
            </a>
          </span>
        )}
        <div className={styles.rowLine}>
          <Link
            href={`/redeem/orders/${checkout.requestId}`}
            className={`${styles.btn} ${styles.btnSmall}`}
          >
            View order
          </Link>
          <Link
            href='/redeem'
            className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}
          >
            Back to redeem
          </Link>
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Redemption summary</div>
          <span className={styles.rainbowText}>
            Total redeem: {cards.length} item{cards.length === 1 ? '' : 's'}
          </span>
          <span className={`${styles.small} ${styles.muted}`}>
            Vault: {vaultNames(cards)}
          </span>
          <div className={styles.summaryList}>
            {cards.map((card) => (
              <div key={card.tokenId.toString()} className={styles.summaryItem}>
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
        </div>
      </div>
      <div className={`${styles.col} ${styles.sticky}`}>
        <AddressCard
          name={prepared.recipient.name}
          address={prepared.address}
        />
        <ContactCard
          name={prepared.recipient.name}
          email={prepared.recipient.email}
          phone={prepared.recipient.phone}
          chineseName={prepared.recipient.chineseName}
        />
        <DeliveryCard
          courierName={courier.name}
          estimatedDays={courier.estimatedDays}
          logoUrl={courier.logoUrl}
          shippingFeeInUsd={prepared.fees.shippingFeeInUsd}
        />
        <div className={styles.card}>
          <FeeBreakdown
            fees={prepared.fees}
            fmv={sumFmv(cards)}
            count={cards.length}
          />
        </div>
      </div>
    </div>
  );
}
