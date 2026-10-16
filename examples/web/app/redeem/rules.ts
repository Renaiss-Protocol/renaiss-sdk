import type {
  PreparedRedemption,
  Recipient,
  RedeemableCard,
  RedemptionCourier,
  RedemptionQuote,
  ShippingAddress,
} from './types';

const MAX_CART = 50;
export const PAGE_SIZE = 50;
export const ORDERS_PAGE_SIZE = 20;
export const RECORD_STRIP_LIMIT = 6;
export const SEARCH_DEBOUNCE_MS = 300;

/** The regions the API returned, ordered by country code. */
export function orderedRegions(counts: Record<string, number>): string[] {
  return Object.keys(counts).sort((a, b) => a.localeCompare(b));
}

/** The first region, in code order, that has cards; `all` when none has. */
export function initialRegion(counts: Record<string, number>): string {
  return (
    orderedRegions(counts).find((code) => (counts[code] ?? 0) > 0) ?? 'all'
  );
}
export const NAME_MAX = 22;
export const LINE_MAX = 35;
const CITY_MAX = 200;
const STATE_MAX = 200;
export const POSTAL_MAX = 20;
export const EMAIL_MAX = 50;
export const SEARCH_MAX = 200;

const CHINESE_NAME_COUNTRIES = ['TW'] as const;
const TAX_ID_COUNTRIES = [
  'BR',
  'CL',
  'CN',
  'ID',
  'KR',
  'TW',
  'AR',
  'ZA',
  'SA',
  'TR',
  'DE',
] as const;

export function requiresTaxId(countryCode: string): boolean {
  return (TAX_ID_COUNTRIES as readonly string[]).includes(countryCode);
}

export function requiresChineseName(countryCode: string): boolean {
  return (CHINESE_NAME_COUNTRIES as readonly string[]).includes(countryCode);
}

// ---- cart ----

export type CartDecision =
  | { kind: 'added' }
  | { kind: 'already' }
  | { kind: 'region-conflict'; region: string }
  | { kind: 'limit' };

export function decideAdd(
  cart: RedeemableCard[],
  card: RedeemableCard,
  max = MAX_CART,
): CartDecision {
  if (cart.some((item) => item.tokenId === card.tokenId))
    return { kind: 'already' };
  const region = cart[0]?.regionCountryCode;
  if (region !== undefined && region !== card.regionCountryCode)
    return { kind: 'region-conflict', region };
  if (cart.length >= max) return { kind: 'limit' };
  return { kind: 'added' };
}

export function cartRegion(cart: RedeemableCard[]): string | null {
  return cart[0]?.regionCountryCode ?? null;
}

export function vaultNames(
  cards: { vaultDisplayName: string; regionCountryCode: string }[],
): string {
  const names = [
    ...new Set(
      cards.map((card) => card.vaultDisplayName || card.regionCountryCode),
    ),
  ];
  return names.join(' / ');
}

export function sumFmv(cards: { fmvInUsd: bigint | null }[]): bigint | null {
  let total = 0n;
  let any = false;
  for (const card of cards) {
    if (card.fmvInUsd === null) continue;
    total += card.fmvInUsd;
    any = true;
  }
  return any ? total : null;
}

export function sortedTokenIds(cards: { tokenId: bigint }[]): bigint[] {
  return cards
    .map((card) => card.tokenId)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function sameTokenSet(a: bigint[], b: bigint[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  const right = [...b].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  return left.every((value, index) => value === right[index]);
}

// ---- checkout form ----

export type AddressForm = {
  countryCode: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
};

export type ContactForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  taxId: string;
  chineseName: string;
};

export const EMPTY_ADDRESS: AddressForm = {
  countryCode: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
};

export const EMPTY_CONTACT: ContactForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  taxId: '',
  chineseName: '',
};

const E164 = /^\+[1-9]\d{6,14}$/;
const COUNTRY_CODE = /^[A-Z]{2}$/;

/**
 * Removes all whitespace, uppercases and keeps at most two characters, so a
 * typed or pasted " us " becomes "US". A longer entry such as "usa" loses its
 * extra letters ("US") instead of being rejected.
 */
export function normalizeCountryCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase().slice(0, 2);
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HAN = /\p{Script=Han}/u;

export type AddressErrors = Partial<Record<keyof AddressForm, string>>;

/** Address rules. The API decides which countries need a state or are served. */
export function validateAddress(form: AddressForm): AddressErrors {
  const errors: AddressErrors = {};
  if (!COUNTRY_CODE.test(normalizeCountryCode(form.countryCode)))
    errors.countryCode = 'Enter a two-letter country code, for example US.';
  const line1 = form.addressLine1.trim();
  if (!line1) errors.addressLine1 = 'Address is required.';
  else if (line1.length > LINE_MAX)
    errors.addressLine1 = `Address must be ${LINE_MAX} characters or fewer.`;
  if (form.addressLine2.trim().length > LINE_MAX)
    errors.addressLine2 = `Apartment must be ${LINE_MAX} characters or fewer.`;
  const city = form.city.trim();
  if (!city) errors.city = 'City is required.';
  else if (city.length > CITY_MAX)
    errors.city = `City must be ${CITY_MAX} characters or fewer.`;
  const postal = form.postalCode.trim();
  if (!postal) errors.postalCode = 'Postal code is required (use 0 if none).';
  else if (postal.length > POSTAL_MAX)
    errors.postalCode = `Postal code must be ${POSTAL_MAX} characters or fewer.`;
  const state = form.state.trim();
  if (state.length > STATE_MAX)
    errors.state = `State must be ${STATE_MAX} characters or fewer.`;
  return errors;
}

export type ContactErrors = Partial<Record<keyof ContactForm, string>>;

/** Contact rules keyed by the destination country. */
export function validateContact(
  form: ContactForm,
  countryCode: string,
): ContactErrors {
  const errors: ContactErrors = {};
  const first = form.firstName.trim();
  const last = form.lastName.trim();
  if (!first) errors.firstName = 'First name is required.';
  if (!last) errors.lastName = 'Last name is required.';
  if (first && last && `${first} ${last}`.length > NAME_MAX)
    errors.lastName = `First and last name together must be ${NAME_MAX} characters or fewer.`;
  const email = form.email.trim();
  if (!email) errors.email = 'Email is required.';
  else if (email.length > EMAIL_MAX || !EMAIL.test(email))
    errors.email = 'Enter a valid email address.';
  const phone = form.phone.replace(/[\s-]/g, '');
  if (!phone) errors.phone = 'Phone number is required.';
  else if (!E164.test(phone))
    errors.phone = 'Use the international format, e.g. +12025550101.';
  if (requiresTaxId(countryCode) && !form.taxId.trim())
    errors.taxId = 'Tax ID is required for this destination.';
  if (requiresChineseName(countryCode)) {
    const chinese = form.chineseName.trim();
    if (!chinese) errors.chineseName = 'Chinese recipient name is required.';
    else if (!HAN.test(chinese))
      errors.chineseName = 'Enter the recipient name in Chinese characters.';
  }
  return errors;
}

export function hasRequiredAddressFields(form: AddressForm): boolean {
  return Boolean(
    form.countryCode &&
      form.addressLine1.trim() &&
      form.city.trim() &&
      form.postalCode.trim(),
  );
}

/** The form for editing an existing address; every value is kept as stored. */
export function toForm(address: ShippingAddress): AddressForm {
  return {
    countryCode: address.countryCode,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 ?? '',
    city: address.city,
    state: address.state ?? '',
    postalCode: address.postalCode,
  };
}

/** The SDK request shape; blank optional fields are omitted, not sent empty. */
export function toShippingAddress(form: AddressForm): ShippingAddress {
  const line2 = form.addressLine2.trim();
  const state = form.state.trim();
  return {
    countryCode: normalizeCountryCode(form.countryCode),
    addressLine1: form.addressLine1.trim(),
    ...(line2 ? { addressLine2: line2 } : {}),
    city: form.city.trim(),
    ...(state ? { state } : {}),
    postalCode: form.postalCode.trim(),
  };
}

export function toRecipient(form: ContactForm, countryCode: string): Recipient {
  const taxId = form.taxId.trim();
  const chineseName = form.chineseName.trim();
  return {
    name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
    phone: form.phone.replace(/[\s-]/g, ''),
    email: form.email.trim(),
    ...(requiresTaxId(countryCode) && taxId ? { taxId } : {}),
    ...(requiresChineseName(countryCode) && chineseName ? { chineseName } : {}),
  };
}

/** Address label: "line1, line2, city, state, postal, country code". */
export function addressLabel(address: ShippingAddress): string {
  return [
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.state,
    address.postalCode,
    address.countryCode,
  ]
    .filter((part) => part?.trim())
    .join(', ');
}

/** A stable key for "did the quoted address or cart change". */
export function quoteKey(address: ShippingAddress, tokenIds: bigint[]): string {
  return JSON.stringify([
    address.countryCode,
    address.addressLine1,
    address.addressLine2 ?? '',
    address.city,
    address.state ?? '',
    address.postalCode,
    sortedTokenIds(tokenIds.map((tokenId) => ({ tokenId }))).map(String),
  ]);
}

// ---- pricing (display only; the server owns every amount) ----

type FeeLines = {
  handling: bigint;
  shipping: bigint;
  insurance: bigint;
  duties: bigint;
  /** Handling + shipping (+ insurance when chosen); duties are paid on delivery. */
  total: bigint;
};

export function feeLines(
  quote: RedemptionQuote,
  courier: RedemptionCourier,
  insurance: boolean,
): FeeLines {
  const insuranceFee = insurance ? courier.insuranceFeeInUsd : 0n;
  return {
    handling: quote.handlingFeeInUsd,
    shipping: courier.shippingFeeInUsd,
    insurance: insuranceFee,
    duties: courier.dutyAndTaxesInUsd,
    total: quote.handlingFeeInUsd + courier.shippingFeeInUsd + insuranceFee,
  };
}

const USDT_UNIT = 10n ** 18n;
const CENTS = 100n;

export function centsToUsdt(cents: bigint): bigint {
  return (cents * USDT_UNIT) / CENTS;
}

export function isExpired(iso: string, nowMs: number): boolean {
  const at = Date.parse(iso);
  return Number.isNaN(at) || at <= nowMs;
}

/**
 * What the user reviewed on screen, handed to `signRedemption` so the SDK
 * refuses to sign a preparation that drifted from the checkout form.
 */
export type ExpectedRedemption = {
  tokenIds: bigint[];
  totalFeeInUsdt: bigint;
  address: ShippingAddress;
  recipient: Recipient;
};

type PreparationMismatch = string | null;

/** UI-level cross-check before balance, approval and signing. */
export function checkPrepared(
  prepared: PreparedRedemption,
  expected: ExpectedRedemption,
  walletAddress: string,
  nowMs: number,
): PreparationMismatch {
  if (prepared.walletAddress.toLowerCase() !== walletAddress.toLowerCase())
    return 'The preparation is for a different wallet.';
  if (!sameTokenSet(prepared.tokenIds, expected.tokenIds))
    return 'The preparation does not match the cards in your cart.';
  if (prepared.fees.totalFeeInUsdt !== expected.totalFeeInUsdt)
    return 'The server total differs from the reviewed total.';
  if (isExpired(prepared.expiresAt, nowMs))
    return 'The quote expired. Get courier options again.';
  if (
    prepared.address.countryCode !== expected.address.countryCode ||
    prepared.address.addressLine1 !== expected.address.addressLine1 ||
    prepared.address.postalCode !== expected.address.postalCode ||
    prepared.address.city !== expected.address.city
  )
    return 'The preparation does not match the shipping address.';
  if (
    prepared.recipient.name !== expected.recipient.name ||
    prepared.recipient.email !== expected.recipient.email ||
    prepared.recipient.phone !== expected.recipient.phone
  )
    return 'The preparation does not match the contact information.';
  return null;
}

// ---- orders ----

export const TRACKING_STAGES = [
  'Initiated',
  'Released from vault',
  'In transit',
  'Delivered',
] as const;

const CANCELED_TOKEN_STATUS = 'REDEMPTION_OWNER_CANCELED';

function normalizeShipment(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

const IN_TRANSIT = new Set([
  'exception',
  'in transit',
  'in_transit',
  'in-transit',
  'in transit to customer',
  'out for delivery',
  'failed delivery attempt',
]);

/** Tracking stage: -1 for cancelled/failed orders, otherwise 0..3. */
export function trackingStageIndex(
  status: string,
  shipmentStatus: string | null | undefined,
): number {
  if (status === 'Canceled' || status === 'Failed') return -1;
  if (status !== 'Shipped') return 0;
  const s = normalizeShipment(shipmentStatus);
  if (s === 'delivered') return 3;
  return IN_TRANSIT.has(s) ? 2 : 1;
}

/** Human-readable tracking stage, including delivery exceptions. */
export function trackingLabel(
  status: string,
  shipmentStatus: string | null | undefined,
): string {
  const index = trackingStageIndex(status, shipmentStatus);
  if (index === -1) return status === 'Canceled' ? 'Cancelled' : 'Failed';
  if (status === 'Shipped' && normalizeShipment(shipmentStatus) === 'exception')
    return 'Exception';
  return TRACKING_STAGES[index] ?? status;
}

export function isCancelledOrder(status: string): boolean {
  return status === 'Canceled' || status === 'Failed';
}

/** Order number: first 6 and last 4 characters of the request id. */
export function orderNumber(requestId: string): string {
  return `${requestId.slice(0, 6)}...${requestId.slice(-4)}`;
}

export function isRequestId(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

/** dd/mm/yyyy (en-GB) order dates. */
export function dateDmy(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(ms));
}

export function estimatedDays(
  min: number | null,
  max: number | null,
): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null && min !== max)
    return `${min}-${max} working days`;
  return `${min ?? max} working days`;
}

type SplitOrderCards<T> = { available: T[]; cancelled: T[] };

/** Order detail: items marked owner-cancelled render in the warning box. */
export function splitOrderCards<T extends { tokenId: bigint }>(
  cards: T[],
  tokenStatuses: Record<string, string>,
): SplitOrderCards<T> {
  const available: T[] = [];
  const cancelled: T[] = [];
  for (const card of cards) {
    if (tokenStatuses[card.tokenId.toString()] === CANCELED_TOKEN_STATUS)
      cancelled.push(card);
    else available.push(card);
  }
  return { available, cancelled };
}

// ---- recovery journal ----

/**
 * The only thing written to localStorage: opaque server ids plus the wallet
 * they belong to. No address, contact, signature or token data.
 */
export type Journal = {
  preparationId: string;
  requestId: string;
  walletAddress: string;
  savedAt: string;
};

const JOURNAL_KEYS: (keyof Journal)[] = [
  'preparationId',
  'requestId',
  'walletAddress',
  'savedAt',
];

export function journalKey(chainId: number, apiBase: string): string {
  return `renaiss:redeem-demo:${chainId}:${apiBase}:pending`;
}

export function serializeJournal(journal: Journal): string {
  const clean: Journal = {
    preparationId: journal.preparationId,
    requestId: journal.requestId,
    walletAddress: journal.walletAddress,
    savedAt: journal.savedAt,
  };
  return JSON.stringify(clean);
}

export function parseJournal(raw: string | null): Journal | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    if (JOURNAL_KEYS.some((key) => typeof record[key] !== 'string'))
      return null;
    return {
      preparationId: record.preparationId as string,
      requestId: record.requestId as string,
      walletAddress: record.walletAddress as string,
      savedAt: record.savedAt as string,
    };
  } catch {
    return null;
  }
}
