import { demoNetwork } from '../demo-network';

/**
 * Display helpers for money and percentage values returned by the API.
 *
 * - USD values arrive as integer cents in decimal strings.
 * - USDT values arrive as 18-decimal units in decimal strings.
 * - Display truncates (never rounds) and never pads: $88, $97.41, $474.6.
 */

const CENTS = 100n;
const USDT_UNIT = 10n ** 18n;
const HUNDRED_DOLLARS_IN_CENTS = 10_000n;

function group(whole: bigint) {
  return whole.toLocaleString('en-US');
}

function fraction(rest: bigint, scale: number, decimals: number) {
  const digits = rest.toString().padStart(scale, '0').slice(0, decimals);
  return digits.replace(/0+$/, '');
}

/** Formats USD cents. `usd('47460')` → `474.6`, `usd('47460', 0)` → `474`. */
export function usd(cents: string | number | null | undefined, decimals = 2) {
  if (cents === null || cents === undefined) return '—';
  const value = BigInt(cents);
  const whole = group(value / CENTS);
  const frac = decimals ? fraction(value % CENTS, 2, decimals) : '';
  return frac ? `${whole}.${frac}` : whole;
}

/** Formats 18-decimal USDT. `usdt('20400000000000000000')` → `20.4`. */
export function usdt(units: string | bigint, decimals = 2) {
  const value = BigInt(units);
  const whole = group(value / USDT_UNIT);
  const frac = decimals ? fraction(value % USDT_UNIT, 18, decimals) : '';
  return frac ? `${whole}.${frac}` : whole;
}

/** Converts a USD cent string to 18-decimal USDT units. */
export function usdToUsdt(cents: string) {
  return (BigInt(cents) * USDT_UNIT) / CENTS;
}

/** Minimum and maximum values displayed in a tier chip. */
export function tierRange(min: string, max: string, isHighest: boolean) {
  const minC = BigInt(min);
  const maxC = BigInt(max);
  if (!isHighest) return `$${usd(minC.toString(), 0)}–$${usd(max, 0)}`;
  const floored =
    maxC < HUNDRED_DOLLARS_IN_CENTS
      ? maxC
      : (maxC / HUNDRED_DOLLARS_IN_CENTS) * HUNDRED_DOLLARS_IN_CENTS;
  if (floored <= minC) return `$${usd(min, 0)}+`;
  return `$${usd(min, 0)}–$${usd(floored.toString(), 0)}+`;
}

export function chance(value: number | 'UNDER-1-PERCENT') {
  return value === 'UNDER-1-PERCENT' ? '<1%' : `${value}%`;
}

export function tierColor(name: string) {
  switch (name.toLowerCase()) {
    case 'top':
    case 's':
    case 'legendary':
    case 'crown':
      return '#f5b400';
    case 'a':
    case 'epic':
    case 'bloom':
      return '#ff6f00';
    case 'b':
    case 'rare':
    case 'thorn':
      return '#ff5e86';
    case 'c':
    case 'uncommon':
      return '#8260ff';
    default:
      return '#9aa0ad';
  }
}

export function tierLabel(name: string) {
  return `Tier ${name}`;
}

export function shortHex(value: string, head = 6, tail = 4) {
  return value.length > head + tail + 2
    ? `${value.slice(0, head)}…${value.slice(-tail)}`
    : value;
}

/** `MM:SS`, or `Hh:MMm` past an hour. */
export function countdown(untilMs: number, nowMs: number) {
  const total = Math.max(0, Math.floor((untilMs - nowMs) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h:${String(minutes).padStart(2, '0')}m`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function windowLabel(seconds: number) {
  if (seconds >= 3600 && seconds % 3600 === 0)
    return `${seconds / 3600} hour${seconds === 3600 ? '' : 's'}`;
  return `${Math.round(seconds / 60)} minutes`;
}

export function packTypeLabel(packType: string) {
  return packType === 'v3-limited' ? 'Limited' : 'Infinite';
}

/** Machine availability label. */
export function stageLabel(stage: string) {
  switch (stage) {
    case 'active':
      return 'Live';
    case 'countdown':
      return 'Soon';
    case 'soldout-or-restocking':
      return 'Reloading';
    case 'archived':
      return 'Sold out';
    default:
      return stage;
  }
}

export function isVideo(url: string | null | undefined) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url ?? '');
}

export function explorerTx(hash: string) {
  return `${demoNetwork.chain.blockExplorers.default.url}/tx/${hash}`;
}
