// Auto-generated from the Renaiss OpenAPI document. Do not edit by hand.
// Regenerate with: pnpm --filter @renaiss-protocol/bindings generate:error-codes

/** Error codes for `GET /v0/gacha/vrf/buyback/offers`. */
export const GACHA_VRF_BUYBACK_OFFERS_GET_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'UNAUTHORIZED',
  'OFFER_QUERY_FAILED',
] as const;

/** Error codes for `POST /v0/gacha/vrf/buyback`. */
export const GACHA_VRF_BUYBACK_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'PERPETUAL_GACHA_PACK_VERIFY_BUYBACK_FAILED',
  'GACHA_V3_TOKEN_STATUS_INVALID',
  'GACHA_V3_BUYBACK_VERIFY_FAILED',
  'GACHA_V3_BUYBACK_EXPIRED',
  'UNAUTHORIZED',
  'PERPETUAL_GACHA_PACK_NOT_FOUND',
  'GACHA_V3_DRAW_RECORD_NOT_FOUND',
  'PERPETUAL_GACHA_VENDING_MACHINE_ADDRESS_NOT_FOUND',
  'PERPETUAL_GACHA_BUYBACK_CONFIG_NOT_FOUND',
  'GACHA_V3_BUYBACK_START_TIME_NOT_FOUND',
  'COLLECTIBLE_NOT_FOUND',
  'BUYBACK_BASE_VALUE_NOT_FOUND',
  'INTERNAL_SERVER_ERROR',
  'GACHA_V3_BUYBACK_FAILED',
  'GACHA_V3_TIMESTAMP_MISSING',
] as const;

/** Error codes for `GET /v0/gacha/vrf/packs/{slug}/contents`. */
export const GACHA_VRF_PACKS_BY_SLUG_CONTENTS_GET_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'CARD_PACK_NOT_FOUND',
  'CARD_PACKS_QUERY_FAILED',
  'FUNCTION_ERROR',
] as const;

/** Error codes for `GET /v0/gacha/vrf/packs/{slug}`. */
export const GACHA_VRF_PACKS_BY_SLUG_GET_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'CARD_PACK_NOT_FOUND',
  'CARD_PACKS_QUERY_FAILED',
  'FUNCTION_ERROR',
] as const;

/** Error codes for `GET /v0/gacha/vrf/packs`. */
export const GACHA_VRF_PACKS_GET_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'CARD_PACKS_QUERY_FAILED',
] as const;

/** Error codes for `POST /v0/gacha/vrf/pull/prepare`. */
export const GACHA_VRF_PULL_PREPARE_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'CARD_PACK_NOT_FOUND',
  'CARD_PACK_NOT_ACTIVE',
  'SAFE_ACCOUNT_NOT_FOUND',
  'INSUFFICIENT_ALLOWANCE',
  'UNAUTHORIZED',
  'CARD_PACKS_QUERY_FAILED',
  'GACHA_V3_VENDING_MACHINE_ADDRESS_NOT_FOUND',
  'FUNCTION_ERROR',
] as const;

/** Error codes for `GET /v0/users/me/activities`. */
export const USERS_ME_ACTIVITIES_GET_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'UNAUTHORIZED',
  'SUBGRAPH_QUERY_FAILED',
  'ACTIVITY_QUERY_FAILED',
] as const;

/** Error codes for `GET /v0/users/me`. */
export const USERS_ME_GET_CODES = [
  'UNAUTHORIZED',
] as const;

/** Error codes for `POST /v0/wallets/permit2/usdt-approval`. */
export const WALLETS_PERMIT2_USDT_APPROVAL_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'FUNCTION_ERROR',
  'UNAUTHORIZED',
] as const;

/** Error codes for `POST /v0/wallets/permit2/usdt-approval/prepare`. */
export const WALLETS_PERMIT2_USDT_APPROVAL_PREPARE_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'SAFE_ACCOUNT_NOT_FOUND',
  'UNAUTHORIZED',
  'FUNCTION_ERROR',
] as const;

/** Error codes for `POST /v0/wallets/safe-deployment`. */
export const WALLETS_SAFE_DEPLOYMENT_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'FUNCTION_ERROR',
  'UNAUTHORIZED',
] as const;

/** Error codes for `POST /v0/wallets/safe-deployment/prepare`. */
export const WALLETS_SAFE_DEPLOYMENT_PREPARE_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'SAFE_ACCOUNT_NOT_FOUND',
  'UNAUTHORIZED',
  'FUNCTION_ERROR',
] as const;

/** Messages parsed from each route's `Possible codes` description. */
export const GENERATED_ERROR_MESSAGES = {
  ACTIVITY_QUERY_FAILED: "Failed to query activities",
  BUYBACK_BASE_VALUE_NOT_FOUND: "Buyback base value not found",
  CARD_PACK_NOT_ACTIVE: "Card pack is not active yet",
  CARD_PACK_NOT_FOUND: "Card pack not found",
  CARD_PACKS_QUERY_FAILED: "Failed to query card packs",
  COLLECTIBLE_NOT_FOUND: "Collectible not found",
  FUNCTION_ERROR: "Function error",
  GACHA_V3_BUYBACK_EXPIRED: "buyback expired",
  GACHA_V3_BUYBACK_FAILED: "Failed to perform gacha V3 buyback",
  GACHA_V3_BUYBACK_START_TIME_NOT_FOUND: "buyback start time not found",
  GACHA_V3_BUYBACK_VERIFY_FAILED: "buyback owner does not match",
  GACHA_V3_DRAW_RECORD_NOT_FOUND: "No pack_draw_records row found for batch pull checkoutId",
  GACHA_V3_TIMESTAMP_MISSING: "Transaction mined but its block timestamp is missing",
  GACHA_V3_TOKEN_STATUS_INVALID: "token status is invalid",
  GACHA_V3_VENDING_MACHINE_ADDRESS_NOT_FOUND: "Gacha v3 vending machine address not found for this pack",
  INSUFFICIENT_ALLOWANCE: "Insufficient token allowance for Permit2",
  INTERNAL_SERVER_ERROR: "An internal server error occurred",
  INVALID_SCHEMA: "Invalid schema",
  OFFER_QUERY_FAILED: "Failed to query offers",
  PERPETUAL_GACHA_BUYBACK_CONFIG_NOT_FOUND: "Buyback config not found on this pack",
  PERPETUAL_GACHA_PACK_NOT_FOUND: "Perpetual gacha pack not found",
  PERPETUAL_GACHA_PACK_VERIFY_BUYBACK_FAILED: "Failed to verify buyback authorization for perpetual gacha pack",
  PERPETUAL_GACHA_VENDING_MACHINE_ADDRESS_NOT_FOUND: "Perpetual gacha vending machine address not found for this pack",
  SAFE_ACCOUNT_NOT_FOUND: "Safe account not found",
  SUBGRAPH_QUERY_FAILED: "Failed to query subgraph",
  UNAUTHORIZED: "You are not authorized to perform this action",
  WRONG_REQUEST_PARAMS: "The request payload is invalid",
} as const;
