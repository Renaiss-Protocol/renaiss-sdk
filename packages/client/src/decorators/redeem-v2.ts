import { type Result, run } from '@renaiss-protocol/fp';
import type {
  PreparedRedemption,
  RedeemableCard,
  RedemptionAddressValidation,
  RedemptionCheckout,
  RedemptionOrder,
  RedemptionOrderSummary,
  RedemptionQuote,
  RedemptionRegions,
  RedemptionWalletSession,
  SignedRedemption,
} from '@renaiss-protocol/schema-validation';
import type {
  FetchRedemptionQuoteRequest,
  ListRedeemableCardsRequest,
  ListRedemptionOrdersRequest,
  PrepareRedemptionRequest,
  RedemptionCheckoutRequest,
  RedemptionOrderRequest,
  SignInRedemptionWalletRequest,
  SignRedemptionRequest,
  SubmitRedemptionRequest,
  ValidateRedemptionAddressRequest,
} from '../actions/redeem-v2';
import * as actions from '../actions/redeem-v2';
import type { Paginated } from '../pagination';

export type {
  FetchRedemptionQuoteRequest,
  ListRedeemableCardsRequest,
  ListRedemptionOrdersRequest,
  PrepareRedemptionRequest,
  RedemptionCheckoutRequest,
  RedemptionExpectation,
  RedemptionOrderRequest,
  SignInRedemptionWalletRequest,
  SignRedemptionRequest,
  SubmitRedemptionRequest,
  ValidateRedemptionAddressRequest,
} from '../actions/redeem-v2';

export type RedemptionActions = {
  /** Get a wallet access token for private Redeem requests: the existing signer signs a sign-in message for its registered frontend origin. Reuses or refreshes the tokens, or asks for a new signature if the refresh returns 401. Does not log into a partner account or connect a wallet. Result failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, UNKNOWN_ERROR, REDEMPTION_V2_REQUEST_FAILED, REDEMPTION_SESSION_REQUIRED, REDEMPTION_SIGNING_FAILED. @throws Never; errors are Result values. */
  signInRedemptionWallet(
    request: SignInRedemptionWalletRequest,
  ): Promise<Result<RedemptionWalletSession>>;
  /** Revoke the tokens from this sign-in and clear them from memory. Result failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, UNKNOWN_ERROR, REDEMPTION_V2_REQUEST_FAILED, REDEMPTION_SESSION_REQUIRED. @throws Never; errors are Result values. */
  signOutRedemptionWallet(): Promise<Result<{ revoked: true }>>;
  /** Count this wallet's redeemable cards by region. Resolves to `{ counts }`, a record from region key to card count. Requires a wallet access token from `signInRedemptionWallet`. Result failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, UNKNOWN_ERROR, REDEMPTION_V2_REQUEST_FAILED, REDEMPTION_SESSION_REQUIRED. Narrow with isFetchRedemptionRegionsError. @throws Never; errors are Result values. */
  fetchRedemptionRegions(): Promise<Result<RedemptionRegions>>;
  /** Ask the API to check a shipping address (`countryCode`, `addressLine1`, optional `addressLine2`, `city`, optional `state`, `postalCode`). Resolves to `{ status, detail }`, both strings: show `detail` to the user and let them correct or confirm the address. The SDK does not interpret `status`. Requires a wallet access token. Result failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, UNKNOWN_ERROR, REDEMPTION_V2_REQUEST_FAILED, REDEMPTION_SESSION_REQUIRED. Narrow with isValidateRedemptionAddressError. @throws Never; errors are Result values. */
  validateRedemptionAddress(
    request: ValidateRedemptionAddressRequest,
  ): Promise<Result<RedemptionAddressValidation>>;
  /** Quote shipping for the exact cart: 1 to 50 distinct `tokenIds` to one `address`. Resolves to `quoteId`, `expiresAt`, `handlingFeeInUsd` and the available `couriers`, each with `shippingFeeInUsd`, `insuranceFeeInUsd` and `dutyAndTaxesInUsd`. Fees are USD cents as `bigint`. The server calculates every amount; rates expire after ten minutes. Duties and taxes are payable on delivery and are not part of the checkout total. The API refuses carts whose cards are not in one region. Requires a wallet access token. Result failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, UNKNOWN_ERROR, REDEMPTION_V2_REQUEST_FAILED, REDEMPTION_SESSION_REQUIRED. Narrow with isFetchRedemptionQuoteError. @throws Never; errors are Result values. */
  fetchRedemptionQuote(
    request: FetchRedemptionQuoteRequest,
  ): Promise<Result<RedemptionQuote>>;
  /** Bind a quote to one courier and recipient on the server (`quoteId`, `courierId`, `recipient`, and `insurance` as a required boolean). Resolves to a `PreparedRedemption` with `preparationId`, `requestId`, the `fees` breakdown (`totalFeeInUsdt` is in 18-decimal token base units) and the typed data to sign. Nothing is signed or charged yet. Pass the result to `signRedemption`. Requires a wallet access token. Result failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, UNKNOWN_ERROR, REDEMPTION_V2_REQUEST_FAILED, REDEMPTION_SESSION_REQUIRED. Narrow with isPrepareRedemptionError. @throws Never; errors are Result values. */
  prepareRedemption(
    request: PrepareRedemptionRequest,
  ): Promise<Result<PreparedRedemption>>;
  /** Verify a prepared redemption and sign its Permit2 batch with the wallet. `expected` must come from what the user reviewed (`tokenIds`, `totalFeeInUsdt`, `address`, `recipient`), not from the server response. Before the wallet is asked, the SDK checks the card set, amount, address and recipient against `expected`, the wallet against the signer, the chain and contracts against the network configuration and the expiry against the clock, and recomputes the batch witness hash. Resolves to `{ preparationId, requestId, signature }`. Requires a wallet access token. Result failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, UNKNOWN_ERROR, REDEMPTION_V2_REQUEST_FAILED, REDEMPTION_SESSION_REQUIRED, REDEMPTION_SIGNING_FAILED. Narrow with isSignRedemptionError. @throws Never; errors are Result values. */
  signRedemption(
    request: SignRedemptionRequest,
  ): Promise<Result<SignedRedemption>>;
  /** Submit a signed redemption. Sends only the preparation id and the signature. Resolves to `{ requestId, status, transactionHash? }` with status `prepared`, `submitting`, `succeeded` or `failed`. The SDK does not retry: when the outcome is uncertain, call `fetchRedemptionCheckout` instead of submitting again. Requires a wallet access token. Result failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, UNKNOWN_ERROR, REDEMPTION_V2_REQUEST_FAILED, REDEMPTION_SESSION_REQUIRED. Narrow with isSubmitRedemptionError. @throws Never; errors are Result values. */
  submitRedemption(
    request: SubmitRedemptionRequest,
  ): Promise<Result<RedemptionCheckout>>;
  /** Reconcile a submitted preparation by `preparationId`. Resolves to the same `{ requestId, status, transactionHash? }` as `submitRedemption`; use it to recover from an interrupted or uncertain submission. Requires a wallet access token. Result failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, UNKNOWN_ERROR, REDEMPTION_V2_REQUEST_FAILED, REDEMPTION_SESSION_REQUIRED. Narrow with isFetchRedemptionCheckoutError. @throws Never; errors are Result values. */
  fetchRedemptionCheckout(
    request: RedemptionCheckoutRequest,
  ): Promise<Result<RedemptionCheckout>>;
  /** Read one of this wallet's orders by `requestId`: status, per-token statuses, address, recipient, courier, estimated delivery range, fees (without a total), tracking fields, `createdAt`, `updatedAt` and `collectibles`. Requires a wallet access token. Result failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, UNKNOWN_ERROR, REDEMPTION_V2_REQUEST_FAILED, REDEMPTION_SESSION_REQUIRED. Narrow with isFetchRedemptionOrderError. @throws Never; errors are Result values. */
  fetchRedemptionOrder(
    request: RedemptionOrderRequest,
  ): Promise<Result<RedemptionOrder>>;
  /** Ask the API to refresh the tracking of an order by `requestId`. Resolves to the same order shape as `fetchRedemptionOrder`. Requires a wallet access token. Result failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, UNKNOWN_ERROR, REDEMPTION_V2_REQUEST_FAILED, REDEMPTION_SESSION_REQUIRED. Narrow with isSyncRedemptionTrackingError. @throws Never; errors are Result values. */
  syncRedemptionTracking(
    request: RedemptionOrderRequest,
  ): Promise<Result<RedemptionOrder>>;
  /** Page through the cards this wallet can redeem. Optional `search`, `countryCode`, `sortBy` (`RedemptionCardSort`), `sortOrder` (`RedemptionSortOrder`) and `pageSize` (1 to 50, default 50). Each card has `tokenId`, `name`, `frontImageUrl`, `rixPriceInUsd`, `rixPriceUpdatedAt`, `ownerAcquiredAt`, `regionCountryCode` and `vaultDisplayName`; pages carry `totalCount` and `hasMore`. Requires a wallet access token. Paginated; Result failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, UNKNOWN_ERROR, REDEMPTION_V2_REQUEST_FAILED, REDEMPTION_SESSION_REQUIRED. Narrow with isListRedeemableCardsError. @throws Never; errors are Result values. */
  listRedeemableCards(
    request?: ListRedeemableCardsRequest,
  ): Paginated<RedeemableCard[]>;
  /** Page through this builder's orders for the wallet. Optional `pageSize` (1 to 20, default 10). Pages report `hasMore` but no total. A newly submitted order may not appear until it is indexed; use `fetchRedemptionCheckout` meanwhile. Requires a wallet access token. Paginated; Result failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, UNKNOWN_ERROR, REDEMPTION_V2_REQUEST_FAILED, REDEMPTION_SESSION_REQUIRED. Narrow with isListRedemptionOrdersError. @throws Never; errors are Result values. */
  listRedemptionOrders(
    request?: ListRedemptionOrdersRequest,
  ): Paginated<RedemptionOrderSummary[]>;
};
/** Bind one signer and its in-memory wallet access token to the redemption workflow. */
export function decorateRedemption(
  ctx: actions.RedemptionContext,
): RedemptionActions {
  return {
    signInRedemptionWallet: (request: SignInRedemptionWalletRequest) =>
      run(actions.signInRedemptionWallet(ctx, request)),
    signOutRedemptionWallet: () => run(actions.signOutRedemptionWallet(ctx)),
    fetchRedemptionRegions: () => run(actions.fetchRedemptionRegions(ctx)),
    validateRedemptionAddress: (request: ValidateRedemptionAddressRequest) =>
      run(actions.validateRedemptionAddress(ctx, request)),
    fetchRedemptionQuote: (request: FetchRedemptionQuoteRequest) =>
      run(actions.fetchRedemptionQuote(ctx, request)),
    prepareRedemption: (request: PrepareRedemptionRequest) =>
      run(actions.prepareRedemption(ctx, request)),
    signRedemption: (request: SignRedemptionRequest) =>
      run(actions.signRedemption(ctx, request)),
    submitRedemption: (request: SubmitRedemptionRequest) =>
      run(actions.submitRedemption(ctx, request)),
    fetchRedemptionCheckout: (request: RedemptionCheckoutRequest) =>
      run(actions.fetchRedemptionCheckout(ctx, request)),
    fetchRedemptionOrder: (request: RedemptionOrderRequest) =>
      run(actions.fetchRedemptionOrder(ctx, request)),
    syncRedemptionTracking: (request: RedemptionOrderRequest) =>
      run(actions.syncRedemptionTracking(ctx, request)),
    listRedeemableCards: (request: ListRedeemableCardsRequest = {}) =>
      actions.listRedeemableCards(ctx, request),
    listRedemptionOrders: (request: ListRedemptionOrdersRequest = {}) =>
      actions.listRedemptionOrders(ctx, request),
  };
}

export { RedemptionCardSort, RedemptionSortOrder } from '../actions/redeem-v2';
