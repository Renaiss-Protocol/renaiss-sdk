import { z } from 'zod';
import {
  CollectibleAttributeSchema,
  MarketplaceOrderSchema,
  MarketplaceOrderStatus,
  MarketplacePaginationSchema,
  MarketplaceTypedDataSchema,
  PriceSchema,
} from './marketplace';
import { addressSchema, numericStringSchema } from './wallet';

const wireAskPrice = z.union([numericStringSchema, z.literal('NO-ASK-PRICE')]);
const wireRixPrice = z.union([numericStringSchema, z.literal('NO-RIX-PRICE')]);
/** V2 tiles include their display image. USD is cents; USDT is 18-decimal base units. */
const MarketplaceCardV2Schema = z
  .object({
    tokenId: numericStringSchema,
    name: z.string(),
    ownerAddress: addressSchema,
    askPriceInUSDT: wireAskPrice,
    rixPriceInUsd: wireRixPrice,
    rixPriceUpdatedAt: z.string().nullish(),
    frontImageUrl: z.string(),
  })
  .transform(
    ({ askPriceInUSDT, rixPriceInUsd, rixPriceUpdatedAt, ...card }) => ({
      ...card,
      askPriceInUsdt: askPriceInUSDT === 'NO-ASK-PRICE' ? null : askPriceInUSDT,
      rixPriceInUsd: rixPriceInUsd === 'NO-RIX-PRICE' ? null : rixPriceInUsd,
      rixPriceUpdatedAt: rixPriceUpdatedAt ?? null,
    }),
  );
export type MarketplaceCardV2 = z.infer<typeof MarketplaceCardV2Schema>;
export const MarketplaceCardsV2ResponseSchema = z.object({
  collection: z.array(MarketplaceCardV2Schema),
  pagination: MarketplacePaginationSchema,
});
export const CardDetailV2Schema = z
  .object({
    collectible: z.object({
      tokenId: numericStringSchema,
      name: z.string(),
      ownerAddress: addressSchema,
      askPriceInUSDT: wireAskPrice,
      askExpiresAt: z.string().nullish(),
      rixPriceInUsd: wireRixPrice,
      rixPriceUpdatedAt: z.string().nullish(),
      frontImageUrl: z.string(),
      backImageUrl: z.string().nullish(),
      // A plain string: the API adds collectible types (POKEMON, ONE_PIECE,
      // SPORTS today) without a new SDK release.
      type: z.string(),
      attributes: z.array(CollectibleAttributeSchema),
      owner: z
        .object({ username: z.string(), image: z.string().optional() })
        .nullable(),
    }),
    pricing: z.object({
      top_offer: PriceSchema.nullable(),
      last_sale: PriceSchema.nullable(),
      price_history: z.array(
        z.object({ timestamp: z.string(), amount: PriceSchema }),
      ),
    }),
  })
  .transform(({ collectible, pricing }) => {
    const {
      askPriceInUSDT,
      askExpiresAt,
      rixPriceInUsd,
      rixPriceUpdatedAt,
      backImageUrl,
      ...rest
    } = collectible;
    return {
      ...rest,
      askPriceInUsdt: askPriceInUSDT === 'NO-ASK-PRICE' ? null : askPriceInUSDT,
      askExpiresAt: askExpiresAt ?? null,
      rixPriceInUsd: rixPriceInUsd === 'NO-RIX-PRICE' ? null : rixPriceInUsd,
      rixPriceUpdatedAt: rixPriceUpdatedAt ?? null,
      backImageUrl: backImageUrl ?? null,
      pricing: {
        topBid: pricing.top_offer,
        lastSale: pricing.last_sale,
        priceHistory: pricing.price_history,
      },
    };
  });
export type CardDetailV2 = z.infer<typeof CardDetailV2Schema>;
export const CardOrdersV2Schema = z.object({
  tokenId: numericStringSchema,
  activeAsk: MarketplaceOrderSchema.omit({ createdAt: true }).nullable(),
  activeBids: z.array(MarketplaceOrderSchema),
});
export type CardOrdersV2 = z.infer<typeof CardOrdersV2Schema>;
export const PreparedMarketplaceCancellationSchema = z.object({
  payload: z.object({
    orderId: z.string().uuid(),
    walletAddress: addressSchema,
    deadline: numericStringSchema,
  }),
  typedData: MarketplaceTypedDataSchema,
});
export const MarketplaceCancellationV2Schema = z.object({
  orderId: z.string().uuid(),
  status: z.literal(MarketplaceOrderStatus.Cancelled),
});
export type MarketplaceCancellationV2 = z.infer<
  typeof MarketplaceCancellationV2Schema
>;
