/*
 * Display helpers the marketplace and card pages need beyond ../eoa/format:
 * the "#"-split card name, compact relative times, offer countdowns and the
 * two-decimal USDT input the dialogs accept.
 */

const USDT_UNIT = 10n ** 18n;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type SplitCardName = { title: string; subtitle: string | null };

export function splitCardName(name: string): SplitCardName {
  const normalized = name.trim();
  const index = normalized.indexOf('#');
  if (index === -1) return { title: normalized, subtitle: null };
  return {
    title: normalized.slice(0, index).trim(),
    subtitle: normalized.slice(index).trim(),
  };
}

export function cardDisplayRows(card: {
  attributes: { key: string; value: string }[];
}): { firstRow: string[]; secondRow: string } {
  // The API leaves out empty attributes.
  const trait = (name: string) =>
    card.attributes.find((attribute) => attribute.key === name)?.value ?? '';
  const cardNumber = trait('Card Number');
  return {
    firstRow: [
      `${trait('Grader')} ${trait('Grade')}`.trim(),
      trait('Year'),
      trait('Set'),
    ].filter((row) => row !== ''),
    secondRow: `${cardNumber ? `#${cardNumber} ` : ''}${trait('Character')}`,
  };
}

function parseIso(value: string): number | null {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/** Compact relative time: "3d", "5h", "2mo". */
export function relativeAgo(iso: string, nowMs: number): string {
  const then = parseIso(iso);
  if (then === null) return iso;
  const diff = Math.max(0, nowMs - then);
  if (diff < MINUTE) return `${Math.floor(diff / 1000)}s`;
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)}d`;
  if (diff < 365 * DAY) return `${Math.floor(diff / (30 * DAY))}mo`;
  return `${Math.floor(diff / (365 * DAY))}y`;
}

/** "2 weeks", "3 days", for the FMV hover "Priced {time} ago". */
export function relativeAgoLong(iso: string, nowMs: number): string {
  const then = parseIso(iso);
  if (then === null) return iso;
  const diff = Math.max(0, nowMs - then);
  const unit = (value: number, name: string) =>
    `${value} ${name}${value === 1 ? '' : 's'}`;
  if (diff < HOUR)
    return unit(Math.max(1, Math.floor(diff / MINUTE)), 'minute');
  if (diff < DAY) return unit(Math.floor(diff / HOUR), 'hour');
  if (diff < 14 * DAY) return unit(Math.floor(diff / DAY), 'day');
  if (diff < 60 * DAY) return unit(Math.floor(diff / (7 * DAY)), 'week');
  if (diff < 365 * DAY) return unit(Math.floor(diff / (30 * DAY)), 'month');
  return unit(Math.floor(diff / (365 * DAY)), 'year');
}

/** Offer countdown: "29d 3h", "3h 41m", "12m 05s", or "Expired". */
export function countdownText(iso: string, nowMs: number): string {
  const until = parseIso(iso);
  if (until === null) return iso;
  const left = until - nowMs;
  if (left <= 0) return 'Expired';
  const days = Math.floor(left / DAY);
  const hours = Math.floor((left % DAY) / HOUR);
  const minutes = Math.floor((left % HOUR) / MINUTE);
  const seconds = Math.floor((left % MINUTE) / 1000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export function isExpired(iso: string, nowMs: number): boolean {
  const until = parseIso(iso);
  return until !== null && until <= nowMs;
}

export function formatDateTime(iso: string): string {
  const ms = parseIso(iso);
  return ms === null ? iso : new Date(ms).toLocaleString();
}

/** Smallest offer the API accepts (1 USDT) in 18-decimal units. */
export const MINIMUM_OFFER = USDT_UNIT;

/**
 * Parses the dialogs' amount field (digits, optional "." and up to two
 * decimals, thousands separators allowed) into 18-decimal USDT units.
 */
export function parseUsdtInput(input: string): bigint | null {
  const match = input
    .replaceAll(',', '')
    .trim()
    .match(/^(\d+)(?:\.(\d{0,2}))?$/);
  if (!match) return null;
  const whole = match[1] ?? '0';
  const fraction = (match[2] ?? '').padEnd(18, '0');
  const value = BigInt(whole) * USDT_UNIT + BigInt(fraction);
  return value > 0n ? value : null;
}

/** Two-decimal display of 18-decimal units for prefilling an input. */
export function usdtToInput(units: string | bigint): string {
  const value = BigInt(units);
  const whole = value / USDT_UNIT;
  const cents = ((value % USDT_UNIT) * 100n) / USDT_UNIT;
  return cents === 0n
    ? whole.toString()
    : `${whole}.${cents.toString().padStart(2, '0')}`;
}

export function initials(username: string): string {
  return (
    username
      .split(' ')
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  );
}

export function isSameAddress(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

export function shortTokenId(tokenId: string): string {
  return tokenId.length > 13
    ? `${tokenId.slice(0, 6)}...${tokenId.slice(-4)}`
    : tokenId;
}
