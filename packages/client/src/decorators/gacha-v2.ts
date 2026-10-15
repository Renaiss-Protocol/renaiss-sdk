import { type Result, run } from '@renaiss-protocol/fp';
import type {
  EoaActivity,
  EoaBuybackOffer,
  EoaCollectionCard,
  EoaCollectionSummary,
  EoaDrawStatus,
  EoaMachine,
  EoaMachineContent,
  EoaMachineDetail,
  EoaPreparedPull,
  EoaPull,
  EoaResolvedPull,
  EoaSignedBuyback,
  EoaSignedPull,
  GachaPullHistoryEntry,
  SubmitGachaBuybackResponse,
} from '@renaiss-protocol/schema-validation';
import {
  createEoaBuyback,
  type EoaContext,
  type EoaCreateBuybackRequest,
  type EoaDrawStatusRequest,
  type EoaListMachinesRequest,
  type EoaMachineContentsRequest,
  type EoaMachinePageRequest,
  type EoaMachineRequest,
  type EoaPreparePullRequest,
  type EoaSignPullRequest,
  type EoaSubmitBuybackRequest,
  type EoaSubmitPullRequest,
  type EoaWalletActivitiesRequest,
  type EoaWalletAddressRequest,
  type EoaWalletCollectionRequest,
  type EoaWalletPageRequest,
  type EoaWalletRequest,
  fetchEoaDrawStatus,
  fetchEoaMachine,
  fetchEoaOffers,
  fetchEoaWalletCollectionSummary,
  listEoaContents,
  listEoaMachines,
  listEoaPublicHistory,
  listEoaWalletActivities,
  listEoaWalletCollection,
  listEoaWalletPulls,
  prepareEoaPull,
  signEoaPull,
  submitEoaBuyback,
  submitEoaPull,
} from '../actions/gacha-v2';
import type { Paginated } from '../pagination';

export type {
  EoaCreateBuybackRequest,
  EoaDrawStatusRequest,
  EoaListMachinesRequest,
  EoaMachineContentsRequest,
  EoaMachinePageRequest,
  EoaMachineRequest,
  EoaPreparePullRequest,
  EoaPullExpectation,
  EoaSignPullRequest,
  EoaSubmitBuybackRequest,
  EoaSubmitPullRequest,
  EoaWalletActivitiesRequest,
  EoaWalletAddressRequest,
  EoaWalletCollectionRequest,
  EoaWalletPageRequest,
  EoaWalletRequest,
} from '../actions/gacha-v2';

/**
 * Gacha client methods for an EOA wallet: browse machines, prepare, sign and
 * submit a pull, recover a paid pull, and sell a card back through a buyback
 * offer. The methods are bound to the client's `baseUrl`, optional builder key
 * and optional signer. Expected failures are returned as `Result` values; each
 * method names its error codes and the guard that narrows them.
 */
export type EoaGachaActions = {
  /**
   * Page through the public gacha machines. Optional `stage` filters by machine
   * stage and `pageSize` (1 to 100, default 20) sets the page size. Requires no
   * builder key or signer. Paginated; Result failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, UNKNOWN_ERROR. Narrow with isListGachaMachinesError.
   * @throws Never; errors are Result values.
   */
  listGachaMachines(request?: EoaListMachinesRequest): Paginated<EoaMachine[]>;
  /**
   * Read one machine by `slug`, including its tiers with whole-set percentages
   * and price ranges, `activeSetExpectedValueInUsd` (the mean card value of the
   * whole set) and buyback terms. Requires no builder key or signer. Result
   * failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, UNKNOWN_ERROR. Narrow with isFetchGachaMachineError.
   * @throws Never; errors are Result values.
   */
  fetchGachaMachine(
    request: EoaMachineRequest,
  ): Promise<Result<EoaMachineDetail>>;
  /**
   * Page through the collectibles a machine can draw: name, tier, image,
   * buyback base value, `type`, current market value (`fmvInUsd`, USD cents)
   * and `attributes`. `slug` selects the machine; `tiers` keeps only those
   * tiers (names from the machine's `tiers`; every tier when omitted), and is
   * applied before paging. `pageSize` is 1 to 100 (default 20). Requires no
   * builder key or signer. Paginated; Result
   * failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, UNKNOWN_ERROR. Narrow with isListGachaMachineContentsError.
   * @throws Never; errors are Result values.
   */
  listGachaMachineContents(
    request: EoaMachineContentsRequest,
  ): Paginated<EoaMachineContent[]>;
  /**
   * Page through the cards recently pulled from a machine, newest first. A pull
   * appears only after its buyback window has closed, so the feed runs behind
   * live activity, and a limited machine has no public pull history. Requires no
   * builder key or signer. Paginated; Result failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, UNKNOWN_ERROR. Narrow with
   * isListGachaPullHistoryError.
   * @throws Never; errors are Result values.
   */
  listGachaPullHistory(
    request: EoaMachinePageRequest,
  ): Paginated<GachaPullHistoryEntry[]>;
  /**
   * Page through the resolved pulls of `buyerWalletAddress` that were made
   * through this builder. An empty history does not prove that a payment failed:
   * use `fetchGachaDrawStatus` with the funding hash. Requires the builder key.
   * Paginated; Result failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, UNKNOWN_ERROR. Narrow with isListWalletPullsError.
   * @throws Never; errors are Result values.
   */
  listWalletPulls(request: EoaWalletPageRequest): Paginated<EoaPull[]>;
  /**
   * Page through the cards `walletAddress` has: the cards it owns on chain,
   * however it got them, and the cards it pulled with your builder key that
   * Renaiss still holds for it (in the buyback window, then awaiting delivery).
   * A card it pulled with another builder appears once it is delivered on
   * chain, so two builders can get different lists for one address. `pull` is
   * the wallet's pull of the card with your builder key, null otherwise.
   * `sortBy` and `sortOrder` apply to the whole list; `pageSize` is 1 to 100
   * (default 20). Exactly the address given is read: an owner wallet and its
   * Renaiss Safe are two wallets. Requires the builder key. Paginated; Result
   * failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, UNKNOWN_ERROR. Narrow with isListWalletCollectionError.
   * @throws Never; errors are Result values.
   */
  listWalletCollection(
    request: EoaWalletCollectionRequest,
  ): Paginated<EoaCollectionCard[]>;
  /**
   * Read the collectible count and the total market value (USD cents) of exactly the
   * collectibles `listWalletCollection` lists for `walletAddress`. Requires the
   * builder key. Result failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, UNKNOWN_ERROR. Narrow with
   * isFetchWalletCollectionSummaryError.
   * @throws Never; errors are Result values.
   */
  fetchWalletCollectionSummary(
    request: EoaWalletAddressRequest,
  ): Promise<Result<EoaCollectionSummary>>;
  /**
   * Page through what `walletAddress` did on chain with cards, newest first,
   * whichever builder it used: gacha pulls, buybacks and deliveries,
   * marketplace buys and sells, transfers, mints and redemptions; `filter`
   * keeps one `EoaActivityFilter`. A pull names its pack's on-chain id and a
   * buyback its settlement ids; neither names a card. Pages follow the API's
   * cursor with up to `pageSize` events (1 to 50, default 20). A transaction's
   * entries can span pages. Requires the builder key. Paginated; Result failures:
   * WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, UNKNOWN_ERROR. Narrow with isListWalletActivitiesError.
   * @throws Never; errors are Result values.
   */
  listWalletActivities(
    request: EoaWalletActivitiesRequest,
  ): Paginated<EoaActivity[]>;
  /**
   * Read the outcome of a pull by `buyerWalletAddress` and its funding
   * transaction hash (`permitFundTxHash`). Use it to recover after an
   * interrupted `submitGachaPull`. It reads only; it never submits or pays
   * again. A resolved draw carries its frozen values (`tier`,
   * `buybackBaseValueInUSD`) and `collectible`
   * (`type`, name, image, `fmvInUsd`, `attributes`); they are null when they
   * could not be loaded. Needs the builder key, set as `builderApiKey` or added by your proxy. Result failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, UNKNOWN_ERROR. Narrow with
   * isFetchGachaDrawStatusError.
   * @throws Never; errors are Result values.
   */
  fetchGachaDrawStatus(
    request: EoaDrawStatusRequest,
  ): Promise<Result<EoaDrawStatus>>;
  /**
   * Fetch the buyback offers currently open for `buyerWalletAddress` under this
   * builder as one array. The SDK reads the API's pages of 100 one after
   * another until a short page and removes repeated `settlementId`s (first seen
   * wins, in order). The read has no snapshot, so an offer that appears or
   * disappears while it runs can be missed: read the offers again before a
   * batch buyback. A failure on any page fails the whole call, with that
   * page's code. A wallet with so many offers that the SDK cannot confirm the
   * list is complete (the API stops paging at an offset of 10,000) fails with
   * GACHA_V2_REQUEST_FAILED instead of returning a partial list. Needs the
   * builder key, set as `builderApiKey` or added by your proxy. Result
   * failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED,
   * UNKNOWN_ERROR. Narrow with isFetchGachaBuybackOffersError.
   * @throws Never; errors are Result values.
   */
  fetchGachaBuybackOffers(
    request: EoaWalletRequest,
  ): Promise<Result<EoaBuybackOffer[]>>;
  /**
   * Ask the API to prepare a pull of `quantity` cards (1 to 10, default 1) from the
   * machine `machineSlug` for `buyerWalletAddress`. `expectedPriceInUsdt` is the
   * per-card price the user saw, in token base units. Before anything is
   * approved, the SDK compares the preparation with that price, the selected
   * network's contracts and signing types, and the expected chain. It neither
   * approves nor signs. Needs the builder key, set as `builderApiKey` or added by your proxy. Result failures:
   * GACHA_PRICE_CHANGED (the price differs: show the new price and let the user
   * review it), WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, UNKNOWN_ERROR. Narrow with isPrepareGachaPullError.
   * @throws Never; errors are Result values.
   */
  prepareGachaPull(
    request: EoaPreparePullRequest,
  ): Promise<Result<EoaPreparedPull>>;
  /**
   * Sign a prepared pull with the signer. `expected` (`packId`, `onChainPackId`,
   * `priceInUsdt`, `quantity`) must come from what the user reviewed, not from
   * the preparation. The SDK refuses to sign when the preparation does not match
   * it or has expired. Approve the token to Permit2 before this call; the SDK
   * does not. Requires a signer. Result failures: WRONG_REQUEST_PARAMS,
   * GACHA_SIGNING_FAILED. Narrow with isSignGachaPullError.
   * @throws Never; errors are Result values.
   */
  signGachaPull(request: EoaSignPullRequest): Promise<Result<EoaSignedPull>>;
  /**
   * Submit a signed pull and follow its server-sent events until the draws are
   * resolved or the pull fails. `onEvent` receives each event: save the funding
   * hash from `payment_confirmed` there before showing anything. The SDK sends
   * the pull once and never retries it. After an interrupted stream, recover
   * with `fetchGachaDrawStatus` or `listWalletPulls` before submitting again.
   * A failure carries `permitFundTxHash` and `fundingConfirmed` in
   * `ApiError.error` when they are known. Needs the builder key, set as `builderApiKey` or added by your proxy. Result
   * failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED,
   * GACHA_STREAM_FAILED, UNKNOWN_ERROR. Narrow with isSubmitGachaPullError.
   * @throws Never; errors are Result values.
   */
  submitGachaPull(
    request: EoaSubmitPullRequest,
  ): Promise<Result<EoaResolvedPull>>;
  /**
   * Sign a buyback of 1 to 10 offers from `fetchGachaBuybackOffers`. The offers
   * must be unique and from one pack and contract, and each must pay a positive
   * price in its current tier. `chainId`, `token` and the signer must match the
   * selected network. The signed amount is the exact sum of each offer's
   * current-tier price, and must equal the required `expectedAmountInUsdt`
   * (the total the user confirmed, in 18-decimal USDT units). A changed quote
   * fails with WRONG_REQUEST_PARAMS before requesting a signature; read the
   * offers again and confirm the updated amount. No NFT approval is needed.
   * Requires a signer. Result failures: WRONG_REQUEST_PARAMS,
   * GACHA_SIGNING_FAILED. Narrow with isCreateGachaBuybackError.
   * @throws Never; errors are Result values.
   */
  createGachaBuyback(
    request: EoaCreateBuybackRequest,
  ): Promise<Result<EoaSignedBuyback>>;
  /**
   * Submit a signed buyback once. If it fails because a buyback tier ended
   * (`GACHA_V3_BUYBACK_PRICE_CHANGED`), an offer expired, or the delivery is in
   * doubt, read the offers again with `fetchGachaBuybackOffers` before you sign
   * a new buyback. Needs the builder key, set as `builderApiKey` or added by your proxy. Result failures:
   * WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, UNKNOWN_ERROR. Narrow with isSubmitGachaBuybackError.
   * @throws Never; errors are Result values.
   */
  submitGachaBuyback(
    request: EoaSubmitBuybackRequest,
  ): Promise<Result<SubmitGachaBuybackResponse>>;
};

export function decorateEoaGacha(context: EoaContext): EoaGachaActions {
  return {
    listGachaMachines: (request?: EoaListMachinesRequest) =>
      listEoaMachines(context, request),
    fetchGachaMachine: (request: EoaMachineRequest) =>
      run(fetchEoaMachine(context, request)),
    listGachaMachineContents: (request: EoaMachineContentsRequest) =>
      listEoaContents(context, request),
    listGachaPullHistory: (request: EoaMachinePageRequest) =>
      listEoaPublicHistory(context, request),
    listWalletPulls: (request: EoaWalletPageRequest) =>
      listEoaWalletPulls(context, request),
    listWalletCollection: (request: EoaWalletCollectionRequest) =>
      listEoaWalletCollection(context, request),
    fetchWalletCollectionSummary: (request: EoaWalletAddressRequest) =>
      run(fetchEoaWalletCollectionSummary(context, request)),
    listWalletActivities: (request: EoaWalletActivitiesRequest) =>
      listEoaWalletActivities(context, request),
    fetchGachaDrawStatus: (request: EoaDrawStatusRequest) =>
      run(fetchEoaDrawStatus(context, request)),
    fetchGachaBuybackOffers: (request: EoaWalletRequest) =>
      run(fetchEoaOffers(context, request)),
    prepareGachaPull: (request: EoaPreparePullRequest) =>
      run(prepareEoaPull(context, request)),
    signGachaPull: (request: EoaSignPullRequest) =>
      run(signEoaPull(context, request)),
    submitGachaPull: (request: EoaSubmitPullRequest) =>
      run(submitEoaPull(context, request)),
    createGachaBuyback: (request: EoaCreateBuybackRequest) =>
      run(createEoaBuyback(context, request)),
    submitGachaBuyback: (request: EoaSubmitBuybackRequest) =>
      run(submitEoaBuyback(context, request)),
  };
}
