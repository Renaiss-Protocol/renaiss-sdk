import { type Result, run } from '@renaiss-protocol/fp';
import type {
  CardDetailV2,
  CardOrdersV2,
  MarketplaceCancellationV2,
  MarketplaceCardV2,
} from '@renaiss-protocol/schema-validation';
import type {
  AcceptBidResult,
  BuyCardResult,
  CreateAskResult,
  CreateBidResult,
} from '../actions/marketplace-v2';
import {
  acceptBidV2,
  buyCardV2,
  cancelOrderV2,
  createAskV2,
  createBidV2,
  type EoaAcceptBidRequest,
  type EoaBuyCardRequest,
  type EoaCancelOrderRequest,
  type EoaCreateAskRequest,
  type EoaCreateBidRequest,
  fetchCardOrdersV2,
  fetchCardV2,
  type ListMarketplaceCardsV2Request,
  listMarketplaceCardsV2,
  type MarketplaceCardV2Request,
  type MarketplaceV2Context,
} from '../actions/marketplace-v2';
import type { Paginated } from '../pagination';

export type {
  EoaAcceptBidRequest,
  EoaBuyCardRequest,
  EoaCancelOrderRequest,
  EoaCreateAskRequest,
  EoaCreateBidRequest,
  ListMarketplaceCardsV2Request,
  MarketplaceCardV2Request,
} from '../actions/marketplace-v2';
export {
  MarketplaceGradingCompany,
  MarketplaceLanguage,
  MarketplacePriceRange,
  MarketplaceV2Sort,
} from '../actions/marketplace-v2';

export type EoaMarketplaceActions = {
  /** Browse public cards with images and marketplace filters. Each page returns WRONG_REQUEST_PARAMS, INVALID_SCHEMA, MARKETPLACE_V2_REQUEST_FAILED or UNKNOWN_ERROR as Result values. */
  listMarketplaceCards(
    request?: ListMarketplaceCardsV2Request,
  ): Paginated<MarketplaceCardV2[]>;
  /** Read a visible card, images and price history. Returns WRONG_REQUEST_PARAMS, INVALID_SCHEMA, MARKETPLACE_V2_REQUEST_FAILED or UNKNOWN_ERROR as values. */
  fetchCard(request: MarketplaceCardV2Request): Promise<Result<CardDetailV2>>;
  /** Read the active ask and funded bids. Returns WRONG_REQUEST_PARAMS, INVALID_SCHEMA, MARKETPLACE_V2_REQUEST_FAILED or UNKNOWN_ERROR as values. */
  fetchCardOrders(
    request: MarketplaceCardV2Request,
  ): Promise<Result<CardOrdersV2>>;
  /** Prepare, directly sign and submit a listing. Uses the configured EOA. Returns WRONG_REQUEST_PARAMS, INVALID_SCHEMA, MARKETPLACE_V2_REQUEST_FAILED, MARKETPLACE_SIGNING_FAILED or UNKNOWN_ERROR as values; never retries. */
  createAsk(request: EoaCreateAskRequest): Promise<Result<CreateAskResult>>;
  /** Prepare, directly sign and submit a bid. The EOA must approve USDT to Permit2 first. Returns WRONG_REQUEST_PARAMS, INVALID_SCHEMA, MARKETPLACE_V2_REQUEST_FAILED, MARKETPLACE_SIGNING_FAILED or UNKNOWN_ERROR as values. */
  createBid(request: EoaCreateBidRequest): Promise<Result<CreateBidResult>>;
  /** Buy at the displayed price. Requires expectedTotalPriceInUsdt. Returns WRONG_REQUEST_PARAMS, INVALID_SCHEMA, MARKETPLACE_V2_REQUEST_FAILED, MARKETPLACE_SIGNING_FAILED or UNKNOWN_ERROR as values. Reconcile interrupted trades before retrying. */
  buyCard(request: EoaBuyCardRequest): Promise<Result<BuyCardResult>>;
  /** Sign acceptance of one bid at the reviewed expectedTotalPriceInUsdt. Returns WRONG_REQUEST_PARAMS, INVALID_SCHEMA, MARKETPLACE_V2_REQUEST_FAILED, MARKETPLACE_SIGNING_FAILED or UNKNOWN_ERROR as values. */
  acceptBid(request: EoaAcceptBidRequest): Promise<Result<AcceptBidResult>>;
  /** Sign cancellation of an exact ask or bid ID. Removes the off-chain order; does not revoke its on-chain permit. Returns WRONG_REQUEST_PARAMS, INVALID_SCHEMA, MARKETPLACE_V2_REQUEST_FAILED, MARKETPLACE_SIGNING_FAILED or UNKNOWN_ERROR as values. */
  cancelOrder(
    request: EoaCancelOrderRequest,
  ): Promise<Result<MarketplaceCancellationV2>>;
};
export function decorateEoaMarketplace(
  context: MarketplaceV2Context,
): EoaMarketplaceActions {
  return {
    listMarketplaceCards: (request) => listMarketplaceCardsV2(context, request),
    fetchCard: (request) => run(fetchCardV2(context, request)),
    fetchCardOrders: (request) => run(fetchCardOrdersV2(context, request)),
    createAsk: (request) => run(createAskV2(context, request)),
    createBid: (request) => run(createBidV2(context, request)),
    buyCard: (request) => run(buyCardV2(context, request)),
    acceptBid: (request) => run(acceptBidV2(context, request)),
    cancelOrder: (request) => run(cancelOrderV2(context, request)),
  };
}
