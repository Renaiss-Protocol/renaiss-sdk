import {
  GACHA_VRF_BUYBACK_OFFERS_GET_CODES,
  GACHA_VRF_BUYBACK_POST_CODES,
  GACHA_VRF_PACKS_BY_SLUG_CONTENTS_GET_CODES,
  GACHA_VRF_PACKS_BY_SLUG_GET_CODES,
  GACHA_VRF_PACKS_GET_CODES,
  GACHA_VRF_PULL_PREPARE_POST_CODES,
  GENERATED_ERROR_MESSAGES,
  USERS_ME_ACTIVITIES_GET_CODES,
  USERS_ME_GET_CODES,
  WALLETS_PERMIT2_USDT_APPROVAL_POST_CODES,
  WALLETS_PERMIT2_USDT_APPROVAL_PREPARE_POST_CODES,
  WALLETS_SAFE_DEPLOYMENT_POST_CODES,
  WALLETS_SAFE_DEPLOYMENT_PREPARE_POST_CODES,
} from '@renaiss-protocol/bindings/api';

// should follow BCP 47, see:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#locales_argument
// add more when needed
export const SUPPORTED_LOCALES = ['en'] as const;
type SupportedLocales = (typeof SUPPORTED_LOCALES)[number];

// Messages for SDK-surfaced codes the OpenAPI contract does not describe yet:
// codes the SDK produces client-side plus auth routes that have not shipped a
// `Possible codes` contract. As each route gains codes, its entries move into
// GENERATED_ERROR_MESSAGES (via the bindings generator) and are deleted here.
const sdkErrorMessages = {
  // Produced by ServiceClient for network failures, unknown API bodies, and unexpected exceptions.
  UNKNOWN_ERROR: { en: 'An unknown error occurred' },
  // Produced by @renaiss-protocol/fp when combining multiple failed Result values.
  MULTIPLE_ERRORS: { en: 'Multiple errors occurred' },
  // Auth routes do not expose OpenAPI error-code enums yet.
  GACHA_API_KEY_CREATE_FAILED: { en: 'Failed to create gacha API key' },
  // Produced by createApiKeyWithSiwe when SIWE/signing/session exchange fails.
  GACHA_AUTH_FAILED: { en: 'Failed to authenticate gacha session' },
  // Produced by buybackGacha before submission when offers cannot be merged safely.
  GACHA_BUYBACK_OFFERS_INVALID: {
    en: 'Gacha buyback offers are not compatible',
  },
  // Produced when gacha pull or buyback typed-data signing fails.
  GACHA_SIGNING_FAILED: { en: 'Failed to sign gacha payload' },
  // Produced by ServiceClient and pullGacha for SSE transport/parsing failures.
  GACHA_STREAM_FAILED: { en: 'Failed to read gacha stream' },
  // Produced from gacha stream error events; the prepare route cannot describe it.
  INSUFFICIENT_FUNDS: { en: 'Insufficient funds for transaction' },
  // Produced when Safe wallet operation signing fails locally.
  SAFE_WALLET_SIGNING_FAILED: { en: 'Failed to sign Safe wallet operation' },
} as const satisfies Record<string, Record<SupportedLocales, string>>;

// The public code universe: codes described by the API contract (generated from
// OpenAPI) plus the SDK-only codes above. `satisfies readonly ErrorCode[]` on
// every action list below holds each action honest against this union.
// Action arrays define each action's public error surface and power client
// guards such as `isApprovePermit2UsdtError`. `sdkErrorMessages` only provides
// global messages; it does not make a code part of any action guard. If an
// action can return an SDK-local code, include it in that action-specific list.
type GeneratedErrorCode = keyof typeof GENERATED_ERROR_MESSAGES;
type SdkErrorCode = keyof typeof sdkErrorMessages;
export type ErrorCode = GeneratedErrorCode | SdkErrorCode;

const commonSdkErrorCodes = [
  'UNKNOWN_ERROR',
  'UNAUTHORIZED',
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
] as const satisfies readonly ErrorCode[];

export const CREATE_API_KEY_WITH_SIWE_ERROR_CODES = [
  ...commonSdkErrorCodes,
  'GACHA_API_KEY_CREATE_FAILED',
  'GACHA_AUTH_FAILED',
] as const satisfies readonly ErrorCode[];

export type CreateApiKeyWithSiweErrorCode =
  (typeof CREATE_API_KEY_WITH_SIWE_ERROR_CODES)[number];

export const LIST_USER_ACTIVITIES_ERROR_CODES = [
  ...USERS_ME_ACTIVITIES_GET_CODES,
  'UNKNOWN_ERROR',
] as const satisfies readonly ErrorCode[];

export type ListUserActivitiesErrorCode =
  (typeof LIST_USER_ACTIVITIES_ERROR_CODES)[number];

export const LIST_GACHA_MACHINES_ERROR_CODES = [
  ...GACHA_VRF_PACKS_GET_CODES,
  'UNKNOWN_ERROR',
] as const satisfies readonly ErrorCode[];

export type ListGachaMachinesErrorCode =
  (typeof LIST_GACHA_MACHINES_ERROR_CODES)[number];

export const FETCH_GACHA_MACHINE_ERROR_CODES = [
  ...GACHA_VRF_PACKS_BY_SLUG_GET_CODES,
  'UNKNOWN_ERROR',
] as const satisfies readonly ErrorCode[];

export type FetchGachaMachineErrorCode =
  (typeof FETCH_GACHA_MACHINE_ERROR_CODES)[number];

export const LIST_GACHA_MACHINE_CONTENTS_ERROR_CODES = [
  ...GACHA_VRF_PACKS_BY_SLUG_CONTENTS_GET_CODES,
  'UNKNOWN_ERROR', // SDK fallback for network/unexpected failures, not on the route
] as const satisfies readonly ErrorCode[];

export type ListGachaMachineContentsErrorCode =
  (typeof LIST_GACHA_MACHINE_CONTENTS_ERROR_CODES)[number];

export const PULL_GACHA_ERROR_CODES = [
  ...GACHA_VRF_PULL_PREPARE_POST_CODES,
  'UNKNOWN_ERROR',
  'GACHA_SIGNING_FAILED',
  'GACHA_STREAM_FAILED',
  'INSUFFICIENT_FUNDS',
] as const satisfies readonly ErrorCode[];

export type PullGachaErrorCode = (typeof PULL_GACHA_ERROR_CODES)[number];

export const LIST_GACHA_BUYBACK_OFFERS_ERROR_CODES = [
  ...GACHA_VRF_BUYBACK_OFFERS_GET_CODES,
  'UNKNOWN_ERROR',
] as const satisfies readonly ErrorCode[];

export type ListGachaBuybackOffersErrorCode =
  (typeof LIST_GACHA_BUYBACK_OFFERS_ERROR_CODES)[number];

export const BUYBACK_GACHA_ERROR_CODES = [
  ...USERS_ME_GET_CODES,
  ...GACHA_VRF_BUYBACK_POST_CODES,
  'UNKNOWN_ERROR',
  'GACHA_BUYBACK_OFFERS_INVALID',
  'GACHA_SIGNING_FAILED',
] as const satisfies readonly ErrorCode[];

export type BuybackGachaErrorCode = (typeof BUYBACK_GACHA_ERROR_CODES)[number];

export const IS_SAFE_WALLET_DEPLOYED_ERROR_CODES = [
  ...WALLETS_SAFE_DEPLOYMENT_PREPARE_POST_CODES,
  'UNKNOWN_ERROR',
] as const satisfies readonly ErrorCode[];

export type IsSafeWalletDeployedErrorCode =
  (typeof IS_SAFE_WALLET_DEPLOYED_ERROR_CODES)[number];

export const DEPLOY_SAFE_WALLET_ERROR_CODES = [
  ...WALLETS_SAFE_DEPLOYMENT_PREPARE_POST_CODES,
  ...WALLETS_SAFE_DEPLOYMENT_POST_CODES,
  'UNKNOWN_ERROR',
  'SAFE_WALLET_SIGNING_FAILED',
] as const satisfies readonly ErrorCode[];

export type DeploySafeWalletErrorCode =
  (typeof DEPLOY_SAFE_WALLET_ERROR_CODES)[number];

export const IS_PERMIT2_USDT_APPROVED_ERROR_CODES = [
  ...WALLETS_PERMIT2_USDT_APPROVAL_PREPARE_POST_CODES,
  'UNKNOWN_ERROR',
] as const satisfies readonly ErrorCode[];

export type IsPermit2UsdtApprovedErrorCode =
  (typeof IS_PERMIT2_USDT_APPROVED_ERROR_CODES)[number];

export const APPROVE_PERMIT2_USDT_ERROR_CODES = [
  ...WALLETS_PERMIT2_USDT_APPROVAL_PREPARE_POST_CODES,
  ...WALLETS_PERMIT2_USDT_APPROVAL_POST_CODES,
  'UNKNOWN_ERROR',
  'SAFE_WALLET_SIGNING_FAILED',
] as const satisfies readonly ErrorCode[];

export type ApprovePermit2UsdtErrorCode =
  (typeof APPROVE_PERMIT2_USDT_ERROR_CODES)[number];

export const ENSURE_SAFE_WALLET_READY_ERROR_CODES = [
  ...WALLETS_SAFE_DEPLOYMENT_PREPARE_POST_CODES,
  ...WALLETS_SAFE_DEPLOYMENT_POST_CODES,
  ...WALLETS_PERMIT2_USDT_APPROVAL_PREPARE_POST_CODES,
  ...WALLETS_PERMIT2_USDT_APPROVAL_POST_CODES,
  'UNKNOWN_ERROR',
  'SAFE_WALLET_SIGNING_FAILED',
] as const satisfies readonly ErrorCode[];

export type EnsureSafeWalletReadyErrorCode =
  (typeof ENSURE_SAFE_WALLET_READY_ERROR_CODES)[number];

export const errMsg = (
  code: ErrorCode,
  locale: SupportedLocales = 'en',
): string =>
  (code in sdkErrorMessages
    ? sdkErrorMessages[code as SdkErrorCode][locale]
    : GENERATED_ERROR_MESSAGES[code as GeneratedErrorCode]) ??
  'Something went wrong';

export const errResponse = (code: ErrorCode, detail = '') => ({
  success: false as const,
  code,
  detail: detail || errMsg(code),
});

export type ErrorResponse = ReturnType<typeof errResponse>;
