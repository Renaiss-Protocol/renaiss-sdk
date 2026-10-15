import { z } from 'zod';
import { addressSchema, hexSchema, numericStringSchema } from './wallet';

export enum MarketplaceCardCategory {
  Pokemon = 'POKEMON',
  OnePiece = 'ONE_PIECE',
}

export enum MarketplaceSortOrder {
  Ascending = 'asc',
  Descending = 'desc',
}

export enum MarketplaceOrderType {
  Ask = 'ASK',
  Bid = 'BID',
}

export enum MarketplaceOrderStatus {
  Active = 'ACTIVE',
  Pending = 'PENDING',
  Accepted = 'ACCEPTED',
  Cancelled = 'CANCELLED',
}

/** Outcome of a submitted order: resting on the book, or matched and settled on-chain. */
enum MarketplaceOrderResultStatus {
  Active = 'ACTIVE',
  Executed = 'EXECUTED',
}

enum MarketplaceOperation {
  Ask = 'ask',
  Bid = 'bid',
  Buy = 'buy',
  Sell = 'sell',
}

export enum PriceToken {
  Usdt = 'USDT',
  Usd = 'USD',
}

export const CardAttributeSchema = z.object({
  key: z.string(),
  value: z.string(),
});

export type CardAttribute = z.infer<typeof CardAttributeSchema>;

/** A collectible's category. */
export enum CollectibleType {
  Pokemon = 'POKEMON',
  OnePiece = 'ONE_PIECE',
  Sports = 'SPORTS',
}

const CardOwnerSchema = z.object({
  username: z.string(),
});

export type CardOwner = z.infer<typeof CardOwnerSchema>;

export const MarketplacePaginationSchema = z.object({
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean(),
});

export const PriceSchema = z.object({
  value: z.string(),
  token: z.enum(PriceToken),
});

export type Price = z.infer<typeof PriceSchema>;

/** An order resting on the marketplace book. Amounts are USDT base units. */
export const MarketplaceOrderSchema = z.object({
  id: z.string().uuid(),
  ownerAddress: addressSchema,
  amountInUsdt: numericStringSchema,
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export type MarketplaceOrder = z.infer<typeof MarketplaceOrderSchema>;

const TypedDataFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
});

/**
 * EIP-712 payload quoted by a marketplace prepare route. The domain always
 * names the chain and verifying contract, which the SDK checks before signing.
 */
export const MarketplaceTypedDataSchema = z.object({
  domain: z.looseObject({
    chainId: z.number().int().positive(),
    verifyingContract: addressSchema,
  }),
  types: z.record(z.string(), z.array(TypedDataFieldSchema)),
  primaryType: z.string(),
  message: z.record(z.string(), z.unknown()),
});

export type MarketplaceTypedData = z.infer<typeof MarketplaceTypedDataSchema>;

/** Ask struct signed by the seller and stored with the order. */
const AskDataSchema = z.object({
  salt: hexSchema,
  deadline: numericStringSchema,
  usdcAmount: numericStringSchema,
  owner: addressSchema,
  tokenId: numericStringSchema,
});

/** Permit2 witness struct signed by the buyer and stored with the order. */
const BidDataSchema = z.object({
  bidder: addressSchema,
  feeBps: numericStringSchema,
  tokenId: numericStringSchema,
  amount: numericStringSchema,
  nonce: numericStringSchema,
  deadline: numericStringSchema,
});

/**
 * Price breakdown for an ask. The buyer pays `totalPriceInUsdt`; the platform
 * fee comes out of that, and the seller receives the remainder.
 */
const AskQuoteSchema = z.object({
  sellerReceivesInUsdt: numericStringSchema,
  platformFeeInUsdt: numericStringSchema,
  totalPriceInUsdt: numericStringSchema,
  expiresAt: z.string().datetime(),
});

export type AskQuote = z.infer<typeof AskQuoteSchema>;

export const PrepareAskResponseSchema = z.object({
  operation: z.literal(MarketplaceOperation.Ask),
  tokenId: numericStringSchema,
  sellerWalletAddress: addressSchema,
  quote: AskQuoteSchema,
  typedData: MarketplaceTypedDataSchema,
  payload: z.object({
    collectibleId: z.string().uuid(),
    askData: AskDataSchema,
  }),
});

/** The executable amount and expiry for a bid or buy-now. */
const BidQuoteSchema = z.object({
  amountInUsdt: numericStringSchema,
  expiresAt: z.string().datetime(),
});

export type BidQuote = z.infer<typeof BidQuoteSchema>;

export const PrepareBidResponseSchema = z.object({
  operation: z.enum([MarketplaceOperation.Bid, MarketplaceOperation.Buy]),
  tokenId: numericStringSchema,
  buyerWalletAddress: addressSchema,
  quote: BidQuoteSchema,
  typedData: MarketplaceTypedDataSchema,
  payload: z.object({
    collectibleId: z.string().uuid(),
    bidData: BidDataSchema,
  }),
});

/** Price breakdown for accepting a bid: the bid amount, less the platform fee. */
const AcceptBidQuoteSchema = AskQuoteSchema.extend({
  bidOrderId: z.string().uuid(),
  bidderWalletAddress: addressSchema,
  amountInUsdt: numericStringSchema,
}).transform(({ bidOrderId, ...quote }) => ({ ...quote, bidId: bidOrderId }));

export type AcceptBidQuote = z.infer<typeof AcceptBidQuoteSchema>;

export const PrepareAcceptBidResponseSchema = z.object({
  operation: z.literal(MarketplaceOperation.Sell),
  tokenId: numericStringSchema,
  sellerWalletAddress: addressSchema,
  quote: AcceptBidQuoteSchema,
  typedData: MarketplaceTypedDataSchema,
  payload: z.object({
    bidOrderId: z.string().uuid(),
    collectibleId: z.string().uuid(),
    askData: AskDataSchema,
  }),
});

/**
 * Result of submitting a signed order.
 *
 * `executed` is `true` when the order matched a resting counter-order and the
 * trade settled on-chain in `executionTxHash`; `matchedOrderId` names the
 * counter-order. Otherwise the order rests on the book as `orderId`.
 */
export const MarketplaceOrderResultSchema = z
  .object({
    operation: z.enum(MarketplaceOperation),
    orderId: z.string(),
    status: z.enum(MarketplaceOrderResultStatus),
    executed: z.boolean(),
    executionTxHash: z.string().optional(),
    matchedOrderId: z.string().optional(),
  })
  .transform(({ executionTxHash, matchedOrderId, ...result }) => ({
    ...result,
    executionTxHash: executionTxHash ?? null,
    matchedOrderId: matchedOrderId ?? null,
  }));

export type MarketplaceOrderResult = z.infer<
  typeof MarketplaceOrderResultSchema
>;
