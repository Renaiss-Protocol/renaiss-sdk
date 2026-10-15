import {
  type GENERATED_ERROR_CODES,
  GENERATED_ERROR_MESSAGES,
} from '@renaiss-protocol/bindings/api';

// should follow BCP 47, see:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#locales_argument
// add more when needed
const SUPPORTED_LOCALES = ['en'] as const;
type SupportedLocales = (typeof SUPPORTED_LOCALES)[number];

// Messages for SDK-surfaced codes the OpenAPI contract does not describe yet:
// codes the SDK produces client-side. As each route gains codes, its entries move into
// GENERATED_ERROR_MESSAGES (via the bindings generator) and are deleted here.
const sdkErrorMessages = {
  REDEMPTION_V2_REQUEST_FAILED: { en: 'Redemption API request failed' },
  REDEMPTION_SESSION_REQUIRED: {
    en: 'Wallet access token required: call signInRedemptionWallet()',
  },
  REDEMPTION_SIGNING_FAILED: { en: 'Redemption signing failed' },
  GACHA_V2_REQUEST_FAILED: { en: 'The EOA gacha API request failed' },
  // Produced by ServiceClient for network failures, unknown API bodies, and unexpected exceptions.
  UNKNOWN_ERROR: { en: 'An unknown error occurred' },
  // Produced by @renaiss-protocol/fp when combining multiple failed Result values.
  // Produced when gacha pull or buyback typed-data signing fails.
  GACHA_SIGNING_FAILED: { en: 'Failed to sign gacha payload' },
  GACHA_PRICE_CHANGED: { en: 'Pack price changed; review the current price' },
  // Produced by ServiceClient and the gacha pull stream for SSE transport/parsing failures.
  GACHA_STREAM_FAILED: { en: 'Failed to read gacha stream' },
  // Wraps an upstream v2 marketplace API failure.
  MARKETPLACE_V2_REQUEST_FAILED: { en: 'Marketplace API request failed' },
  // Produced when marketplace ask or bid typed-data signing fails locally.
  MARKETPLACE_SIGNING_FAILED: { en: 'Failed to sign marketplace order' },
} as const satisfies Record<string, Record<SupportedLocales, string>>;

// The public code universe: codes described by the API contract (generated from
// OpenAPI) plus the SDK-only codes above. `satisfies readonly ErrorCode[]` on
// every action list below holds each action honest against this union.
// Action arrays define each action's public error surface and power client
// guards such as `isFetchRedemptionQuoteError`. `sdkErrorMessages` only provides
// global messages; it does not make a code part of any action guard. If an
// action can return an SDK-local code, include it in that action-specific list.
type GeneratedErrorCode = (typeof GENERATED_ERROR_CODES)[number];
type SdkErrorCode = keyof typeof sdkErrorMessages;
export type ErrorCode = GeneratedErrorCode | SdkErrorCode;

export const errMsg = (
  code: ErrorCode,
  locale: SupportedLocales = 'en',
): string =>
  (code in sdkErrorMessages
    ? sdkErrorMessages[code as SdkErrorCode][locale]
    : (GENERATED_ERROR_MESSAGES as Partial<Record<string, string>>)[code]) ??
  'Something went wrong';

export const errResponse = (code: ErrorCode, detail = '') => ({
  success: false as const,
  code,
  detail: detail || errMsg(code),
});

// v2 currently advertises open-ended upstream error strings. Preserve those in
// ApiError.error while giving consumers a stable, exhaustive SDK error surface.
const v2ReadCodes = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'GACHA_V2_REQUEST_FAILED',
  'UNKNOWN_ERROR',
] as const;
export const V2_LIST_GACHA_MACHINES_ERROR_CODES = v2ReadCodes;
export const V2_FETCH_GACHA_MACHINE_ERROR_CODES = v2ReadCodes;
export const V2_LIST_GACHA_MACHINE_CONTENTS_ERROR_CODES = v2ReadCodes;
export const V2_LIST_GACHA_PULL_HISTORY_ERROR_CODES = v2ReadCodes;
export const V2_LIST_WALLET_PULLS_ERROR_CODES = v2ReadCodes;
export const V2_LIST_WALLET_COLLECTION_ERROR_CODES = v2ReadCodes;
export const V2_FETCH_WALLET_COLLECTION_SUMMARY_ERROR_CODES = v2ReadCodes;
export const V2_LIST_WALLET_ACTIVITIES_ERROR_CODES = v2ReadCodes;
export const V2_FETCH_GACHA_DRAW_STATUS_ERROR_CODES = v2ReadCodes;
export const V2_FETCH_GACHA_BUYBACK_OFFERS_ERROR_CODES = v2ReadCodes;
export const V2_PREPARE_GACHA_PULL_ERROR_CODES = [
  ...v2ReadCodes,
  'GACHA_PRICE_CHANGED',
] as const;
export const V2_SIGN_GACHA_PULL_ERROR_CODES = [
  'WRONG_REQUEST_PARAMS',
  'GACHA_SIGNING_FAILED',
] as const;
export const V2_SUBMIT_GACHA_PULL_ERROR_CODES = [
  ...v2ReadCodes,
  'GACHA_STREAM_FAILED',
] as const;
export const V2_CREATE_GACHA_BUYBACK_ERROR_CODES = [
  'WRONG_REQUEST_PARAMS',
  'GACHA_SIGNING_FAILED',
] as const;
export const V2_SUBMIT_GACHA_BUYBACK_ERROR_CODES = v2ReadCodes;
export type V2ListGachaMachinesErrorCode =
  (typeof V2_LIST_GACHA_MACHINES_ERROR_CODES)[number];
export type V2FetchGachaMachineErrorCode =
  (typeof V2_FETCH_GACHA_MACHINE_ERROR_CODES)[number];
export type V2ListGachaMachineContentsErrorCode =
  (typeof V2_LIST_GACHA_MACHINE_CONTENTS_ERROR_CODES)[number];
export type V2ListGachaPullHistoryErrorCode =
  (typeof V2_LIST_GACHA_PULL_HISTORY_ERROR_CODES)[number];
export type V2ListWalletPullsErrorCode =
  (typeof V2_LIST_WALLET_PULLS_ERROR_CODES)[number];
export type V2ListWalletCollectionErrorCode =
  (typeof V2_LIST_WALLET_COLLECTION_ERROR_CODES)[number];
export type V2FetchWalletCollectionSummaryErrorCode =
  (typeof V2_FETCH_WALLET_COLLECTION_SUMMARY_ERROR_CODES)[number];
export type V2ListWalletActivitiesErrorCode =
  (typeof V2_LIST_WALLET_ACTIVITIES_ERROR_CODES)[number];
export type V2FetchGachaDrawStatusErrorCode =
  (typeof V2_FETCH_GACHA_DRAW_STATUS_ERROR_CODES)[number];
export type V2FetchGachaBuybackOffersErrorCode =
  (typeof V2_FETCH_GACHA_BUYBACK_OFFERS_ERROR_CODES)[number];
export type V2PrepareGachaPullErrorCode =
  (typeof V2_PREPARE_GACHA_PULL_ERROR_CODES)[number];
export type V2SignGachaPullErrorCode =
  (typeof V2_SIGN_GACHA_PULL_ERROR_CODES)[number];
export type V2SubmitGachaPullErrorCode =
  (typeof V2_SUBMIT_GACHA_PULL_ERROR_CODES)[number];
export type V2CreateGachaBuybackErrorCode =
  (typeof V2_CREATE_GACHA_BUYBACK_ERROR_CODES)[number];
export type V2SubmitGachaBuybackErrorCode =
  (typeof V2_SUBMIT_GACHA_BUYBACK_ERROR_CODES)[number];

const v2MarketplaceReadCodes = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'MARKETPLACE_V2_REQUEST_FAILED',
  'UNKNOWN_ERROR',
] as const;
const v2MarketplaceWriteCodes = [
  ...v2MarketplaceReadCodes,
  'MARKETPLACE_SIGNING_FAILED',
] as const;
export const V2_LIST_MARKETPLACE_CARDS_ERROR_CODES = v2MarketplaceReadCodes;
export type V2ListMarketplaceCardsErrorCode =
  (typeof V2_LIST_MARKETPLACE_CARDS_ERROR_CODES)[number];
export const V2_FETCH_CARD_ERROR_CODES = v2MarketplaceReadCodes;
export type V2FetchCardErrorCode = (typeof V2_FETCH_CARD_ERROR_CODES)[number];
export const V2_FETCH_CARD_ORDERS_ERROR_CODES = v2MarketplaceReadCodes;
export type V2FetchCardOrdersErrorCode =
  (typeof V2_FETCH_CARD_ORDERS_ERROR_CODES)[number];
export const V2_CREATE_ASK_ERROR_CODES = v2MarketplaceWriteCodes;
export type V2CreateAskErrorCode = (typeof V2_CREATE_ASK_ERROR_CODES)[number];
export const V2_CREATE_BID_ERROR_CODES = v2MarketplaceWriteCodes;
export type V2CreateBidErrorCode = (typeof V2_CREATE_BID_ERROR_CODES)[number];
export const V2_BUY_CARD_ERROR_CODES = v2MarketplaceWriteCodes;
export type V2BuyCardErrorCode = (typeof V2_BUY_CARD_ERROR_CODES)[number];
export const V2_ACCEPT_BID_ERROR_CODES = v2MarketplaceWriteCodes;
export type V2AcceptBidErrorCode = (typeof V2_ACCEPT_BID_ERROR_CODES)[number];
export const V2_CANCEL_ORDER_ERROR_CODES = v2MarketplaceWriteCodes;
export type V2CancelOrderErrorCode =
  (typeof V2_CANCEL_ORDER_ERROR_CODES)[number];

export const SIGN_IN_REDEMPTION_WALLET_ERROR_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'UNKNOWN_ERROR',
  'REDEMPTION_V2_REQUEST_FAILED',
  'REDEMPTION_SESSION_REQUIRED',
  'REDEMPTION_SIGNING_FAILED',
] as const satisfies readonly ErrorCode[];
export type SignInRedemptionWalletErrorCode =
  (typeof SIGN_IN_REDEMPTION_WALLET_ERROR_CODES)[number];

export const SIGN_OUT_REDEMPTION_WALLET_ERROR_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'UNKNOWN_ERROR',
  'REDEMPTION_V2_REQUEST_FAILED',
  'REDEMPTION_SESSION_REQUIRED',
] as const satisfies readonly ErrorCode[];
export type SignOutRedemptionWalletErrorCode =
  (typeof SIGN_OUT_REDEMPTION_WALLET_ERROR_CODES)[number];

export const FETCH_REDEMPTION_REGIONS_ERROR_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'UNKNOWN_ERROR',
  'REDEMPTION_V2_REQUEST_FAILED',
  'REDEMPTION_SESSION_REQUIRED',
] as const satisfies readonly ErrorCode[];
export type FetchRedemptionRegionsErrorCode =
  (typeof FETCH_REDEMPTION_REGIONS_ERROR_CODES)[number];

export const VALIDATE_REDEMPTION_ADDRESS_ERROR_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'UNKNOWN_ERROR',
  'REDEMPTION_V2_REQUEST_FAILED',
  'REDEMPTION_SESSION_REQUIRED',
] as const satisfies readonly ErrorCode[];
export type ValidateRedemptionAddressErrorCode =
  (typeof VALIDATE_REDEMPTION_ADDRESS_ERROR_CODES)[number];

export const FETCH_REDEMPTION_QUOTE_ERROR_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'UNKNOWN_ERROR',
  'REDEMPTION_V2_REQUEST_FAILED',
  'REDEMPTION_SESSION_REQUIRED',
] as const satisfies readonly ErrorCode[];
export type FetchRedemptionQuoteErrorCode =
  (typeof FETCH_REDEMPTION_QUOTE_ERROR_CODES)[number];

export const PREPARE_REDEMPTION_ERROR_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'UNKNOWN_ERROR',
  'REDEMPTION_V2_REQUEST_FAILED',
  'REDEMPTION_SESSION_REQUIRED',
] as const satisfies readonly ErrorCode[];
export type PrepareRedemptionErrorCode =
  (typeof PREPARE_REDEMPTION_ERROR_CODES)[number];

export const SIGN_REDEMPTION_ERROR_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'UNKNOWN_ERROR',
  'REDEMPTION_V2_REQUEST_FAILED',
  'REDEMPTION_SESSION_REQUIRED',
  'REDEMPTION_SIGNING_FAILED',
] as const satisfies readonly ErrorCode[];
export type SignRedemptionErrorCode =
  (typeof SIGN_REDEMPTION_ERROR_CODES)[number];

export const SUBMIT_REDEMPTION_ERROR_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'UNKNOWN_ERROR',
  'REDEMPTION_V2_REQUEST_FAILED',
  'REDEMPTION_SESSION_REQUIRED',
] as const satisfies readonly ErrorCode[];
export type SubmitRedemptionErrorCode =
  (typeof SUBMIT_REDEMPTION_ERROR_CODES)[number];

export const FETCH_REDEMPTION_CHECKOUT_ERROR_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'UNKNOWN_ERROR',
  'REDEMPTION_V2_REQUEST_FAILED',
  'REDEMPTION_SESSION_REQUIRED',
] as const satisfies readonly ErrorCode[];
export type FetchRedemptionCheckoutErrorCode =
  (typeof FETCH_REDEMPTION_CHECKOUT_ERROR_CODES)[number];

export const FETCH_REDEMPTION_ORDER_ERROR_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'UNKNOWN_ERROR',
  'REDEMPTION_V2_REQUEST_FAILED',
  'REDEMPTION_SESSION_REQUIRED',
] as const satisfies readonly ErrorCode[];
export type FetchRedemptionOrderErrorCode =
  (typeof FETCH_REDEMPTION_ORDER_ERROR_CODES)[number];

export const SYNC_REDEMPTION_TRACKING_ERROR_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'UNKNOWN_ERROR',
  'REDEMPTION_V2_REQUEST_FAILED',
  'REDEMPTION_SESSION_REQUIRED',
] as const satisfies readonly ErrorCode[];
export type SyncRedemptionTrackingErrorCode =
  (typeof SYNC_REDEMPTION_TRACKING_ERROR_CODES)[number];

export const LIST_REDEEMABLE_CARDS_ERROR_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'UNKNOWN_ERROR',
  'REDEMPTION_V2_REQUEST_FAILED',
  'REDEMPTION_SESSION_REQUIRED',
] as const satisfies readonly ErrorCode[];
export type ListRedeemableCardsErrorCode =
  (typeof LIST_REDEEMABLE_CARDS_ERROR_CODES)[number];

export const LIST_REDEMPTION_ORDERS_ERROR_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'UNKNOWN_ERROR',
  'REDEMPTION_V2_REQUEST_FAILED',
  'REDEMPTION_SESSION_REQUIRED',
] as const satisfies readonly ErrorCode[];
export type ListRedemptionOrdersErrorCode =
  (typeof LIST_REDEMPTION_ORDERS_ERROR_CODES)[number];
