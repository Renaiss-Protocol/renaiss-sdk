import { expectTypeOf, it } from 'vitest';
import type {
  AcceptBidQuote,
  AcceptBidResult,
  BidQuote,
  BuyCardResult,
  CreateAskResult,
  CreateBidResult,
  GachaClient,
  MarketplaceCancellation,
  MarketplaceClient,
  MarketplaceOrderResult,
  RedemptionCourier,
  RedemptionQuote,
  Result,
  SubmitGachaBuybackResponse,
} from './index';

it('exports named result models for every v2 trading method', () => {
  expectTypeOf<MarketplaceClient>()
    .toHaveProperty('createAsk')
    .returns.toEqualTypeOf<Promise<Result<CreateAskResult>>>();
  expectTypeOf<MarketplaceClient>()
    .toHaveProperty('createBid')
    .returns.toEqualTypeOf<Promise<Result<CreateBidResult>>>();
  expectTypeOf<MarketplaceClient>()
    .toHaveProperty('buyCard')
    .returns.toEqualTypeOf<Promise<Result<BuyCardResult>>>();
  expectTypeOf<MarketplaceClient>()
    .toHaveProperty('acceptBid')
    .returns.toEqualTypeOf<Promise<Result<AcceptBidResult>>>();
  expectTypeOf<MarketplaceClient>()
    .toHaveProperty('cancelOrder')
    .returns.toEqualTypeOf<Promise<Result<MarketplaceCancellation>>>();
  expectTypeOf<GachaClient>()
    .toHaveProperty('submitGachaBuyback')
    .returns.toEqualTypeOf<Promise<Result<SubmitGachaBuybackResponse>>>();
  expectTypeOf<CreateAskResult>().toExtend<MarketplaceOrderResult>();
  expectTypeOf<CreateBidResult>()
    .toHaveProperty('quote')
    .toEqualTypeOf<BidQuote>();
  expectTypeOf<AcceptBidResult>()
    .toHaveProperty('quote')
    .toEqualTypeOf<AcceptBidQuote>();
  expectTypeOf<RedemptionQuote>()
    .toHaveProperty('couriers')
    .toEqualTypeOf<RedemptionCourier[]>();
});
