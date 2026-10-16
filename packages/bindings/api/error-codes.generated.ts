// Auto-generated from the Renaiss OpenAPI document. Do not edit by hand.
// Regenerate with: pnpm --filter @renaiss-protocol/bindings generate:error-codes

/** Error codes for `POST /v2/auth/wallet/nonce`. */
export const V2_AUTH_WALLET_NONCE_POST_CODES = [
  'API_AUTH_INVALID_INPUT',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/auth/wallet/refresh`. */
export const V2_AUTH_WALLET_REFRESH_POST_CODES = [
  'API_AUTH_INVALID_INPUT',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/auth/wallet/revoke`. */
export const V2_AUTH_WALLET_REVOKE_POST_CODES = [
  'API_AUTH_INVALID_INPUT',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/auth/wallet/verify`. */
export const V2_AUTH_WALLET_VERIFY_POST_CODES = [
  'API_AUTH_INVALID_INPUT',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `GET /v2/gacha/buyback/offers`. */
export const V2_GACHA_BUYBACK_OFFERS_GET_CODES = [
  'WRONG_REQUEST_PARAMS',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/gacha/buyback`. */
export const V2_GACHA_BUYBACK_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_INVALID_ACTION',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `GET /v2/gacha/draw-status`. */
export const V2_GACHA_DRAW_STATUS_GET_CODES = [
  'WRONG_REQUEST_PARAMS',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'EOA_PURCHASE_REJECTED',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `GET /v2/gacha/packs/{slug}/content`. */
export const V2_GACHA_PACKS_BY_SLUG_CONTENT_GET_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'CARD_PACK_NOT_FOUND',
  'SUBGRAPH_RATE_LIMITED',
] as const;

/** Error codes for `GET /v2/gacha/packs/{slug}`. */
export const V2_GACHA_PACKS_BY_SLUG_GET_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'CARD_PACK_NOT_FOUND',
  'SUBGRAPH_RATE_LIMITED',
] as const;

/** Error codes for `GET /v2/gacha/packs/{slug}/pull-history`. */
export const V2_GACHA_PACKS_BY_SLUG_PULL_HISTORY_GET_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
  'CARD_PACK_NOT_FOUND',
  'SUBGRAPH_RATE_LIMITED',
] as const;

/** Error codes for `GET /v2/gacha/packs`. */
export const V2_GACHA_PACKS_GET_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_SCHEMA',
] as const;

/** Error codes for `GET /v2/gacha/pull-history`. */
export const V2_GACHA_PULL_HISTORY_GET_CODES = [
  'WRONG_REQUEST_PARAMS',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/gacha/pull/prepare`. */
export const V2_GACHA_PULL_PREPARE_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'API_AUTH_INVALID_INPUT',
  'CARD_PACK_NOT_ACTIVE',
  'CONTRACT_WALLET_CANNOT_RECEIVE_NFT',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'CARD_PACK_NOT_FOUND',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/gacha/pull/stream`. */
export const V2_GACHA_PULL_STREAM_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'API_AUTH_INVALID_INPUT',
  'EOA_PURCHASE_REJECTED',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_INVALID_ACTION',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/marketplace/asks`. */
export const V2_MARKETPLACE_ASKS_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'ASK_AMOUNT_NOT_POSITIVE',
  'OFFER_EXPIRY_TOO_LONG',
  'ASK_HAS_ALREADY_EXPIRED',
  'INVALID_ASK_SIGNATURE',
  'ASK_TOKEN_ID_MISMATCH',
  'COLLECTIBLE_ONCHAIN_OWNER_MISMATCH',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_INVALID_ACTION',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'COLLECTIBLE_NOT_FOUND',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/marketplace/asks/prepare`. */
export const V2_MARKETPLACE_ASKS_PREPARE_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'UNAUTHORIZED',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'COLLECTIBLE_NOT_FOUND',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/marketplace/bids`. */
export const V2_MARKETPLACE_BIDS_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'OFFER_EXPIRY_TOO_LONG',
  'BID_HAS_ALREADY_EXPIRED',
  'INVALID_BID_SIGNATURE',
  'BID_BELOW_MINIMUM',
  'BID_TOKEN_ID_MISMATCH',
  'INVALID_BID_FEE_BPS',
  'INSUFFICIENT_ALLOWANCE',
  'BID_INSUFFICIENT_BALANCE',
  'TOO_MANY_ACTIVE_BIDS',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_INVALID_ACTION',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'COLLECTIBLE_NOT_FOUND',
  'BID_AUTHORIZATION_ALREADY_USED',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/marketplace/bids/prepare`. */
export const V2_MARKETPLACE_BIDS_PREPARE_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'COLLECTIBLE_NOT_FOUND',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/marketplace/buy`. */
export const V2_MARKETPLACE_BUY_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'BID_HAS_ALREADY_EXPIRED',
  'INVALID_BID_SIGNATURE',
  'BID_TOKEN_ID_MISMATCH',
  'INVALID_BID_FEE_BPS',
  'INSUFFICIENT_ALLOWANCE',
  'MATCHING_ASK_NOT_FOUND',
  'MATCHING_ASK_PERMIT_NOT_FOUND',
  'ASK_HAS_ALREADY_EXPIRED',
  'INVALID_ASK_SIGNATURE',
  'BID_LOWER_THAN_ASK',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_INVALID_ACTION',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'COLLECTIBLE_NOT_FOUND',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/marketplace/buy/prepare`. */
export const V2_MARKETPLACE_BUY_PREPARE_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'MATCHING_ASK_NOT_FOUND',
  'MATCHING_ASK_PERMIT_NOT_FOUND',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'COLLECTIBLE_NOT_FOUND',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/marketplace/orders/cancel`. */
export const V2_MARKETPLACE_ORDERS_CANCEL_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_INVALID_ACTION',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'ORDER_NOT_FOUND',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/marketplace/orders/cancel/prepare`. */
export const V2_MARKETPLACE_ORDERS_CANCEL_PREPARE_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'ORDER_NOT_FOUND',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/marketplace/sell`. */
export const V2_MARKETPLACE_SELL_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'INVALID_OFFER_TYPE',
  'INVALID_OFFER_STATUS',
  'MATCHING_BID_PERMIT_NOT_FOUND',
  'ASK_HAS_ALREADY_EXPIRED',
  'INVALID_ASK_SIGNATURE',
  'ASK_TOKEN_ID_MISMATCH',
  'COLLECTIBLE_ONCHAIN_OWNER_MISMATCH',
  'BID_TOKEN_ID_MISMATCH',
  'INVALID_BID_FEE_BPS',
  'INSUFFICIENT_ALLOWANCE',
  'BID_HAS_ALREADY_EXPIRED',
  'INVALID_BID_SIGNATURE',
  'BID_LOWER_THAN_ASK',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_INVALID_ACTION',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'COLLECTIBLE_NOT_FOUND',
  'OFFER_NOT_FOUND',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/marketplace/sell/prepare`. */
export const V2_MARKETPLACE_SELL_PREPARE_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'MATCHING_BID_PERMIT_NOT_FOUND',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'UNAUTHORIZED',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'COLLECTIBLE_NOT_FOUND',
  'ORDER_NOT_FOUND',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/redeem/address/validate`. */
export const V2_REDEEM_ADDRESS_VALIDATE_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'REDEEM_ADDRESS_VALIDATION_API_ERROR',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_INSUFFICIENT_SCOPE',
  'API_AUTH_INTEGRATION_MISMATCH',
  'API_AUTH_SUBJECT_MISMATCH',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `GET /v2/redeem/checkout/{preparationId}`. */
export const V2_REDEEM_CHECKOUT_BY_PREPARATIONID_GET_CODES = [
  'WRONG_REQUEST_PARAMS',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_INSUFFICIENT_SCOPE',
  'API_AUTH_INTEGRATION_MISMATCH',
  'API_AUTH_SUBJECT_MISMATCH',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'REDEMPTION_ORDER_NOT_FOUND',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/redeem/checkout`. */
export const V2_REDEEM_CHECKOUT_POST_CODES = [
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_INVALID_ACTION',
  'API_AUTH_INSUFFICIENT_SCOPE',
  'API_AUTH_INTEGRATION_MISMATCH',
  'API_AUTH_SUBJECT_MISMATCH',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'REDEMPTION_ORDER_NOT_FOUND',
  'REDEMPTION_ORDER_CHECKOUT_STILL_ACTIVE',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/redeem/checkout/prepare`. */
export const V2_REDEEM_CHECKOUT_PREPARE_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_INSUFFICIENT_SCOPE',
  'API_AUTH_INTEGRATION_MISMATCH',
  'API_AUTH_SUBJECT_MISMATCH',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'REDEMPTION_ORDER_NOT_FOUND',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `GET /v2/redeem/collectibles`. */
export const V2_REDEEM_COLLECTIBLES_GET_CODES = [
  'WRONG_REQUEST_PARAMS',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_INSUFFICIENT_SCOPE',
  'API_AUTH_INTEGRATION_MISMATCH',
  'API_AUTH_SUBJECT_MISMATCH',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `GET /v2/redeem/orders/{requestId}`. */
export const V2_REDEEM_ORDERS_BY_REQUESTID_GET_CODES = [
  'WRONG_REQUEST_PARAMS',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_INSUFFICIENT_SCOPE',
  'API_AUTH_INTEGRATION_MISMATCH',
  'API_AUTH_SUBJECT_MISMATCH',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'REDEMPTION_ORDER_NOT_FOUND',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/redeem/orders/{requestId}/tracking`. */
export const V2_REDEEM_ORDERS_BY_REQUESTID_TRACKING_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_INSUFFICIENT_SCOPE',
  'API_AUTH_INTEGRATION_MISMATCH',
  'API_AUTH_SUBJECT_MISMATCH',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'REDEMPTION_ORDER_NOT_FOUND',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `GET /v2/redeem/orders`. */
export const V2_REDEEM_ORDERS_GET_CODES = [
  'WRONG_REQUEST_PARAMS',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_INSUFFICIENT_SCOPE',
  'API_AUTH_INTEGRATION_MISMATCH',
  'API_AUTH_SUBJECT_MISMATCH',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `POST /v2/redeem/quotes`. */
export const V2_REDEEM_QUOTES_POST_CODES = [
  'WRONG_REQUEST_PARAMS',
  'REDEEM_COURIER_RATES_FETCH_FAILED',
  'REDEMPTION_VAULT_RESOLUTION_FAILED',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_INSUFFICIENT_SCOPE',
  'API_AUTH_INTEGRATION_MISMATCH',
  'API_AUTH_SUBJECT_MISMATCH',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `GET /v2/redeem/regions`. */
export const V2_REDEEM_REGIONS_GET_CODES = [
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_INSUFFICIENT_SCOPE',
  'API_AUTH_INTEGRATION_MISMATCH',
  'API_AUTH_SUBJECT_MISMATCH',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `GET /v2/users/{walletAddress}/activities`. */
export const V2_USERS_BY_WALLETADDRESS_ACTIVITIES_GET_CODES = [
  'WRONG_REQUEST_PARAMS',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `GET /v2/users/{walletAddress}/collectibles`. */
export const V2_USERS_BY_WALLETADDRESS_COLLECTIBLES_GET_CODES = [
  'WRONG_REQUEST_PARAMS',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Error codes for `GET /v2/users/{walletAddress}`. */
export const V2_USERS_BY_WALLETADDRESS_GET_CODES = [
  'WRONG_REQUEST_PARAMS',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'API_AUTH_RATE_LIMITED',
] as const;

/** Every error code any v2 route can return, including codes with no parsed message. */
export const GENERATED_ERROR_CODES = [
  'API_AUTH_CREDENTIAL_NOT_ALLOWED',
  'API_AUTH_ERROR',
  'API_AUTH_INSUFFICIENT_SCOPE',
  'API_AUTH_INTEGRATION_MISMATCH',
  'API_AUTH_INVALID_ACTION',
  'API_AUTH_INVALID_CREDENTIAL',
  'API_AUTH_INVALID_INPUT',
  'API_AUTH_MISSING_CREDENTIAL',
  'API_AUTH_RATE_LIMITED',
  'API_AUTH_SUBJECT_MISMATCH',
  'ASK_AMOUNT_NOT_POSITIVE',
  'ASK_HAS_ALREADY_EXPIRED',
  'ASK_TOKEN_ID_MISMATCH',
  'BID_AUTHORIZATION_ALREADY_USED',
  'BID_BELOW_MINIMUM',
  'BID_HAS_ALREADY_EXPIRED',
  'BID_INSUFFICIENT_BALANCE',
  'BID_LOWER_THAN_ASK',
  'BID_TOKEN_ID_MISMATCH',
  'CARD_PACK_NOT_ACTIVE',
  'CARD_PACK_NOT_FOUND',
  'COLLECTIBLE_NOT_FOUND',
  'COLLECTIBLE_ONCHAIN_OWNER_MISMATCH',
  'CONTRACT_REVERT',
  'CONTRACT_WALLET_CANNOT_RECEIVE_NFT',
  'EOA_PURCHASE_REJECTED',
  'FUNCTION_ERROR',
  'GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API',
  'GACHA_V3_BUYBACK_EXPIRED',
  'GACHA_V3_BUYBACK_PRICE_CHANGED',
  'GACHA_V3_BUYBACK_VERIFY_FAILED',
  'GACHA_V3_CHECKOUT_ALREADY_PROCESSED',
  'GACHA_V3_DRAW_REVEAL_FAILED',
  'GACHA_V3_DRAW_UPDATES_UNAVAILABLE',
  'GACHA_V3_NOT_ENOUGH_CARDS_IN_SET',
  'GACHA_V3_NO_SELLABLE_LINEUP',
  'GACHA_V3_PRICE_MISMATCH',
  'GACHA_V3_RESOLVE_DRAWS_FAILED',
  'GACHA_V3_STREAM_TIMEOUT',
  'GACHA_V3_TOKEN_STATUS_INVALID',
  'INSUFFICIENT_ALLOWANCE',
  'INSUFFICIENT_USDT_AMOUNT',
  'INVALID_ASK_SIGNATURE',
  'INVALID_BID_FEE_BPS',
  'INVALID_BID_SIGNATURE',
  'INVALID_OFFER_STATUS',
  'INVALID_OFFER_TYPE',
  'INVALID_SCHEMA',
  'MATCHING_ASK_NOT_FOUND',
  'MATCHING_ASK_PERMIT_NOT_FOUND',
  'MATCHING_BID_PERMIT_NOT_FOUND',
  'OFFER_EXPIRY_TOO_LONG',
  'OFFER_NOT_FOUND',
  'ORDER_NOT_FOUND',
  'PERMIT2_NONCE_ALREADY_USED',
  'PERMIT_EXPIRED',
  'PERPETUAL_GACHA_PACK_VERIFY_BUYBACK_FAILED',
  'REDEEM_ADDRESS_VALIDATION_API_ERROR',
  'REDEEM_COURIER_RATES_FETCH_FAILED',
  'REDEMPTION_ORDER_CHECKOUT_STILL_ACTIVE',
  'REDEMPTION_ORDER_NOT_FOUND',
  'REDEMPTION_ORDER_VALIDATION_FAILED',
  'REDEMPTION_VAULT_RESOLUTION_FAILED',
  'SUBGRAPH_RATE_LIMITED',
  'TOO_MANY_ACTIVE_BIDS',
  'UNAUTHORIZED',
  'WRONG_REQUEST_PARAMS',
] as const;

/** Messages from the routes' `Possible codes` descriptions: the shared text when every route documents the same one, otherwise a neutral sentence. Not every code has one. */
export const GENERATED_ERROR_MESSAGES = {
  API_AUTH_CREDENTIAL_NOT_ALLOWED: "Something went wrong.",
  API_AUTH_ERROR: "The signature could not be checked because the chain could not be read. Retry the request.",
  API_AUTH_INSUFFICIENT_SCOPE: "The wallet access token lacks the scope this route needs: `redeem:read` to read, `redeem:write` to change. Have the wallet sign in again and ask for the scope.",
  API_AUTH_INTEGRATION_MISMATCH: "The wallet access token was issued to another builder than the key. Use the key of the builder that issued the token.",
  API_AUTH_INVALID_ACTION: "Something went wrong.",
  API_AUTH_INVALID_CREDENTIAL: "Something went wrong.",
  API_AUTH_INVALID_INPUT: "Something went wrong.",
  API_AUTH_MISSING_CREDENTIAL: "Something went wrong.",
  API_AUTH_RATE_LIMITED: "The builder key hit its rate limit. Wait a little, then retry at a lower rate.",
  API_AUTH_SUBJECT_MISMATCH: "The wallet access token is not for the chain of this API. Have the wallet sign in again for the right chain.",
  ASK_AMOUNT_NOT_POSITIVE: "The price is zero. Send a price above zero.",
  ASK_HAS_ALREADY_EXPIRED: "Something went wrong.",
  ASK_TOKEN_ID_MISMATCH: "Something went wrong.",
  BID_AUTHORIZATION_ALREADY_USED: "This signed bid was already submitted. Check the collectible and the wallet's orders first: the earlier bid may be active, cancelled or already filled. Sign a new bid only if you still want one.",
  BID_BELOW_MINIMUM: "The bid is below the smallest bid allowed. Prepare again with a higher amount.",
  BID_HAS_ALREADY_EXPIRED: "Something went wrong.",
  BID_INSUFFICIENT_BALANCE: "The wallet holds less USDT than the bid. Add funds or bid less.",
  BID_LOWER_THAN_ASK: "Something went wrong.",
  BID_TOKEN_ID_MISMATCH: "Something went wrong.",
  CARD_PACK_NOT_ACTIVE: "The pack is not on sale. Do not retry; show the pack as unavailable.",
  CARD_PACK_NOT_FOUND: "Something went wrong.",
  COLLECTIBLE_NOT_FOUND: "The token id is unknown or the collectible is not available on this API. Check the token id. Do not retry with the same id.",
  COLLECTIBLE_ONCHAIN_OWNER_MISMATCH: "The wallet does not own the collectible. Use the wallet that owns it.",
  CONTRACT_REVERT: "Something went wrong.",
  CONTRACT_WALLET_CANNOT_RECEIVE_NFT: "Something went wrong.",
  EOA_PURCHASE_REJECTED: "Something went wrong.",
  FUNCTION_ERROR: "Something went wrong.",
  GACHA_V3_BUILDER_NOT_ACCEPTED_ON_PUBLIC_API: "This builder key cannot be used on this API. Do not retry; contact Renaiss.",
  GACHA_V3_BUYBACK_EXPIRED: "No tier pays for a collectible now (window closed or a zero-percent hold). Read `GET /v2/gacha/buyback/offers` again and retry only the collectibles it returns.",
  GACHA_V3_BUYBACK_PRICE_CHANGED: "The signed amount is not the price now: a buyback tier ended after you read the offers. Read `GET /v2/gacha/buyback/offers` again and sign the new amount.",
  GACHA_V3_BUYBACK_VERIFY_FAILED: "The wallet does not own a collectible in the request. Read `GET /v2/gacha/buyback/offers` and sign only the collectibles it returns.",
  GACHA_V3_CHECKOUT_ALREADY_PROCESSED: "Something went wrong.",
  GACHA_V3_DRAW_REVEAL_FAILED: "The collectible details could not be loaded. The payment was confirmed. Do not pull again: read `GET /v2/gacha/draw-status` with the funding transaction hash.",
  GACHA_V3_DRAW_UPDATES_UNAVAILABLE: "Live updates are not available. The payment was confirmed. Do not pull again: read `GET /v2/gacha/draw-status` with the funding transaction hash.",
  GACHA_V3_NO_SELLABLE_LINEUP: "The pack has no collectibles ready to sell. Try again later.",
  GACHA_V3_NOT_ENOUGH_CARDS_IN_SET: "The pack has fewer collectibles left than you asked for. Try a smaller quantity or try again later.",
  GACHA_V3_PRICE_MISMATCH: "The pack price changed after you prepared the pull. Prepare again and sign the new data.",
  GACHA_V3_RESOLVE_DRAWS_FAILED: "The collectibles could not be assigned yet. The payment was confirmed. Do not pull again: read `GET /v2/gacha/draw-status` with the funding transaction hash.",
  GACHA_V3_STREAM_TIMEOUT: "The stream ran for 90 seconds without a result. The payment may still be going through.",
  GACHA_V3_TOKEN_STATUS_INVALID: "A collectible in the request was already sold back or sent to the wallet. Read `GET /v2/gacha/buyback/offers` and sign again for the collectibles that are still offered.",
  INSUFFICIENT_ALLOWANCE: "Something went wrong.",
  INSUFFICIENT_USDT_AMOUNT: "Something went wrong.",
  INVALID_ASK_SIGNATURE: "Something went wrong.",
  INVALID_BID_FEE_BPS: "Something went wrong.",
  INVALID_BID_SIGNATURE: "Something went wrong.",
  INVALID_OFFER_STATUS: "The bid is no longer active, has expired or was already used. Read the bids again; do not retry this request.",
  INVALID_OFFER_TYPE: "The order you sent is not a bid. Read the bids again; do not retry this request.",
  INVALID_SCHEMA: "Invalid schema.",
  MATCHING_ASK_NOT_FOUND: "The collectible has no active listing. Read the listings again; do not retry this request.",
  MATCHING_ASK_PERMIT_NOT_FOUND: "The listing cannot be bought. Read the listings again; do not retry this request.",
  MATCHING_BID_PERMIT_NOT_FOUND: "The bid cannot be accepted. Read the bids again; do not retry this request.",
  OFFER_EXPIRY_TOO_LONG: "Something went wrong.",
  OFFER_NOT_FOUND: "The bid does not exist. Read the bids again; do not retry this request.",
  ORDER_NOT_FOUND: "Something went wrong.",
  PERMIT_EXPIRED: "The signed pull expired before it was sent, so no payment was made. You can prepare a new pull and sign it again.",
  PERMIT2_NONCE_ALREADY_USED: "Something went wrong.",
  PERPETUAL_GACHA_PACK_VERIFY_BUYBACK_FAILED: "The signed token is not USDT. Prepare the buyback again from the offers list.",
  REDEEM_ADDRESS_VALIDATION_API_ERROR: "The address check did not give an answer. Try again later.",
  REDEEM_COURIER_RATES_FETCH_FAILED: "Shipping rates could not be fetched for this cart and destination. Check the address, or try again later.",
  REDEMPTION_ORDER_CHECKOUT_STILL_ACTIVE: "A checkout for these collectibles is already in progress. Do not send it again. Read `GET /v2/redeem/checkout/{preparationId}` to follow it.",
  REDEMPTION_ORDER_NOT_FOUND: "Something went wrong.",
  REDEMPTION_ORDER_VALIDATION_FAILED: "The prepared redemption is no longer valid. Prepare again from a new quote.",
  REDEMPTION_VAULT_RESOLUTION_FAILED: "Shipping could not be priced for these collectibles right now. Retry later.",
  SUBGRAPH_RATE_LIMITED: "Too many requests right now. Retry after a short wait.",
  TOO_MANY_ACTIVE_BIDS: "The wallet already has the most active bids it can hold. Cancel a bid first.",
  UNAUTHORIZED: "Something went wrong.",
  WRONG_REQUEST_PARAMS: "Something went wrong.",
} as const;
