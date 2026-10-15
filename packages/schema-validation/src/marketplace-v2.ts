import { z } from 'zod';
import {
  CardAttributeSchema,
  CollectibleType,
  MarketplaceOrderSchema,
  MarketplaceOrderStatus,
  MarketplacePaginationSchema,
  MarketplaceTypedDataSchema,
  PriceSchema,
} from './marketplace';
import { addressSchema, numericStringSchema } from './wallet';

const wireCard = z.object({
  tokenId: numericStringSchema,
  type: z.enum(CollectibleType),
  name: z.string(),
  ownerAddress: addressSchema,
  askPriceInUSDT: z.union([numericStringSchema, z.literal('NO-ASK-PRICE')]),
  askExpiresAt: z.string().nullish(),
  fmvInUsd: z.union([numericStringSchema, z.literal('NO-FMV-PRICE')]),
  fmvUpdatedAt: z.string().nullish(),
  frontImageUrl: z.string(),
  /** Grader, Grade, Cert Number, Year, Set, Card Number, Character, Language, in that order; empty ones are left out. */
  attributes: z.array(CardAttributeSchema),
  owner: z
    .object({ username: z.string(), image: z.string().optional() })
    .nullable(),
});
function normalizeCard(card: z.infer<typeof wireCard>) {
  const { askPriceInUSDT, fmvInUsd, askExpiresAt, fmvUpdatedAt, ...rest } =
    card;
  return {
    ...rest,
    askPriceInUsdt: askPriceInUSDT === 'NO-ASK-PRICE' ? null : askPriceInUSDT,
    fmvInUsd: fmvInUsd === 'NO-FMV-PRICE' ? null : fmvInUsd,
    askExpiresAt: askExpiresAt ?? null,
    fmvUpdatedAt: fmvUpdatedAt ?? null,
  };
}
/** V2 tiles include their display image. USD is cents; USDT is 18-decimal base units. */
const MarketplaceCardV2Schema = wireCard
  .pick({
    tokenId: true,
    name: true,
    ownerAddress: true,
    askPriceInUSDT: true,
    fmvInUsd: true,
    fmvUpdatedAt: true,
    frontImageUrl: true,
  })
  .transform(({ askPriceInUSDT, fmvInUsd, fmvUpdatedAt, ...card }) => ({
    ...card,
    askPriceInUsdt: askPriceInUSDT === 'NO-ASK-PRICE' ? null : askPriceInUSDT,
    fmvInUsd: fmvInUsd === 'NO-FMV-PRICE' ? null : fmvInUsd,
    fmvUpdatedAt: fmvUpdatedAt ?? null,
  }));
export type MarketplaceCardV2 = z.infer<typeof MarketplaceCardV2Schema>;
export const MarketplaceCardsV2ResponseSchema = z.object({
  collection: z.array(MarketplaceCardV2Schema),
  pagination: MarketplacePaginationSchema,
});
export const CardDetailV2Schema = z
  .object({
    collectible: wireCard.extend({
      backImageUrl: z.string().nullish(),
    }),
    pricing: z.object({
      top_offer: PriceSchema.nullable(),
      last_sale: PriceSchema.nullable(),
      price_history: z.array(
        z.object({ timestamp: z.string(), amount: PriceSchema }),
      ),
    }),
  })
  .transform(({ collectible, pricing }) => ({
    ...normalizeCard(collectible),
    backImageUrl: collectible.backImageUrl ?? null,
    pricing: {
      topBid: pricing.top_offer,
      lastSale: pricing.last_sale,
      priceHistory: pricing.price_history,
    },
  }));
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
