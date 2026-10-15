import { z } from 'zod';
import {
  GachaBuybackAuthorizationSchema,
  GachaMachineStage,
  GachaMachineTierSchema,
  GachaMachineType,
  GachaPermit2TypedDataSchema,
  GachaPullHistoryEntrySchema,
  HasMorePaginationResponseSchema,
  PaginationResponseSchema,
  PreparedGachaPullPayloadSchema,
} from './gacha';
import { CardAttributeSchema, CollectibleType } from './marketplace';
import {
  addressSchema,
  bytes32Schema,
  hexSchema,
  numericStringSchema,
} from './wallet';

const EoaMachineSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  packType: z.enum(GachaMachineType),
  stage: z.enum(GachaMachineStage),
  priceInUsdt: numericStringSchema,
  expectedValueInUsd: numericStringSchema.nullable(),
  // Needed to build a pull payload. Non-nullable: the API rejects a v3 pack
  // row missing either identifier, so a half-configured machine cannot exist.
  onChainPackId: bytes32Schema,
  vendingMachineAddress: addressSchema,
  packBannerVideoUrl: z.string().nullable(),
  gachaMachineVideoUrl: z.string().nullable(),
  gachaRippingPackAnimationVideoUrl: z.string().nullable(),
  description: z.string(),
});
const EoaMachineTierSchema = GachaMachineTierSchema.extend({
  priceRangeInUsd: z.object({
    min: numericStringSchema,
    max: numericStringSchema,
  }),
});
export type EoaMachineTier = z.infer<typeof EoaMachineTierSchema>;
const EoaMachineDetailSchema = EoaMachineSchema.extend({
  tiers: z.array(EoaMachineTierSchema),
  activeSetExpectedValueInUsd: numericStringSchema,
  /**
   * The buyback tiers, soonest end first, without a tier that ends at the
   * same time as an earlier one; empty without tiers. A buyback pays the
   * first tier whose buybackExpiredInSeconds has not passed since the draw
   * resolved; the largest is the longest window, after which a collectible
   * is released. A draw keeps the tiers it had when it resolved;
   * fetchGachaBuybackOffers has what a buyback pays.
   */
  buybackConfig: z.array(
    z.object({
      /** Share of the collectible's base value the buyback pays, e.g. 85 for 85%. */
      buybackPercentage: z.number(),
      /** How long after the draw this tier lasts, in seconds. */
      buybackExpiredInSeconds: z.number().int().nonnegative(),
    }),
  ),
});
/** Grader, Grade, Cert Number, Year, Set, Card Number, Character, Language, in that order; empty ones are left out. */
const CollectibleAttributesSchema = z.array(CardAttributeSchema);
const EoaMachineContentSchema = z.object({
  name: z.string(),
  tier: z.string(),
  buybackBaseValueInUsd: numericStringSchema,
  frontImageUrl: z.string(),
  type: z.enum(CollectibleType),
  /** Current market value in USD cents; null without one. */
  fmvInUsd: numericStringSchema.nullable(),
  fmvUpdatedAt: z.string().datetime().nullable(),
  attributes: CollectibleAttributesSchema,
});
export const EoaMachinesResponseSchema = z.object({
  cardPacks: z.array(EoaMachineSchema),
  pagination: PaginationResponseSchema,
});
export const EoaMachineResponseSchema = z.object({
  cardPack: EoaMachineDetailSchema,
});
export const EoaContentsResponseSchema = z.object({
  collectibles: z.array(EoaMachineContentSchema),
  pagination: PaginationResponseSchema,
});
export const EoaPublicHistoryResponseSchema = z.object({
  pulls: z.array(GachaPullHistoryEntrySchema),
  pagination: HasMorePaginationResponseSchema,
});
export const EoaPreparedPullSchema = z.object({
  chainId: z.number().int().positive(),
  buyerWalletAddress: addressSchema,
  pack: z.object({
    id: z.string().uuid(),
    onChainPackId: bytes32Schema,
    priceInUsdt: numericStringSchema,
    vendingMachineAddress: addressSchema,
  }),
  permit2TypedData: GachaPermit2TypedDataSchema,
  unsignedPullPayload: PreparedGachaPullPayloadSchema,
  approval: z.object({
    token: addressSchema,
    spender: addressSchema,
    requiredAmount: numericStringSchema,
  }),
});
export const EoaSignedPullSchema = PreparedGachaPullPayloadSchema.omit({
  builderCode: true,
})
  .extend({
    buyerWalletAddress: addressSchema,
    permitSignature: hexSchema.refine(
      (value) => value.length === 132,
      'Expected a 65-byte EOA signature',
    ),
  })
  .strict();
const EoaDrawSchema = z.object({
  settlementId: bytes32Schema,
  tokenId: numericStringSchema,
  releaseTxHash: bytes32Schema.nullable(),
  buybackTxHash: bytes32Schema.nullable(),
});
export const EoaPullSchema = z.object({
  permitFundTxHash: bytes32Schema,
  buyerWalletAddress: addressSchema,
  packId: z.string().uuid(),
  packName: z.string(),
  status: z.enum(['PENDING_RESOLUTION', 'RESOLVED']),
  numOfTokens: z.number().int().positive(),
  pulledAt: z.string().datetime().nullable(),
  draws: z.array(EoaDrawSchema),
});
/** What a drawn collectible is. */
const EoaDrawnCollectibleSchema = z.object({
  type: z.enum(CollectibleType),
  name: z.string(),
  frontImageUrl: z.string().url(),
  /** Current market value in USD cents; null without one. */
  fmvInUsd: numericStringSchema.nullable(),
  fmvUpdatedAt: z.string().datetime().nullable(),
  attributes: CollectibleAttributesSchema,
});
/** The values frozen for a draw. */
const drawValues = {
  tier: z.string(),
  /** USD cents. */
  buybackBaseValueInUSD: numericStringSchema,
};
/** A pull read by funding hash. A draw's values and collectible are null when they could not be loaded. */
export const EoaDrawStatusSchema = EoaPullSchema.extend({
  draws: z.array(
    EoaDrawSchema.extend({
      tier: drawValues.tier.nullable(),
      buybackBaseValueInUSD: drawValues.buybackBaseValueInUSD.nullable(),
      collectible: EoaDrawnCollectibleSchema.nullable(),
    }),
  ),
});
const EoaResolvedPullSchema = EoaPullSchema.extend({
  status: z.literal('RESOLVED'),
  draws: z.array(
    EoaDrawSchema.extend({
      ...drawValues,
      collectible: EoaDrawnCollectibleSchema,
    }),
  ),
});
const streamContext = z.object({
  buyerWalletAddress: addressSchema,
  packId: z.string().uuid(),
  nonce: numericStringSchema,
  numOfTokens: z.number().int().positive(),
  message: z.string(),
});
export const EoaStreamEventSchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('pull_started'), data: streamContext }),
  z.object({ event: z.literal('payment_queued'), data: streamContext }),
  z.object({ event: z.literal('payment_submitting'), data: streamContext }),
  z.object({
    event: z.literal('payment_confirmed'),
    data: streamContext.extend({ permitFundTxHash: bytes32Schema }),
  }),
  z.object({
    event: z.literal('draws_resolved'),
    data: streamContext.extend(EoaResolvedPullSchema.shape),
  }),
  z.object({
    event: z.literal('pull_failed'),
    data: streamContext.extend({
      code: z.string(),
      error: z.string(),
      permitFundTxHash: bytes32Schema.nullable(),
      fundingConfirmed: z.boolean(),
    }),
  }),
]);
export const EoaHistoryResponseSchema = z.object({
  pulls: z.array(EoaPullSchema),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean(),
});
const EoaBuybackTierSchema = z.object({
  /** Share of the collectible's base value this tier pays, e.g. 90 for 90%. */
  buybackPercentage: z.number(),
  /** Price in USDT with 18 decimals in this tier. */
  amountInUsdt: numericStringSchema,
  /** When this tier ends; it still applies at that moment. */
  expiresAt: z.string().datetime(),
});
export type EoaBuybackTier = z.infer<typeof EoaBuybackTierSchema>;
export const EoaBuybackOfferSchema = z.object({
  cardPackId: z.string().uuid(),
  settlementId: bytes32Schema,
  tokenId: numericStringSchema,
  vendingMachineAddress: addressSchema,
  /**
   * Every buyback tier, past ones too, soonest end first. The tier that
   * prices the offer now is getEoaBuybackTierAt(offer, Date.now()).
   */
  buybackTiers: z.array(EoaBuybackTierSchema),
});
/**
 * The tier that prices an offer at `atMs`: the first whose expiresAt has not
 * passed. Undefined once every tier has ended. A tier with a zero amount
 * pays nothing.
 */
export function getEoaBuybackTierAt(
  offer: { buybackTiers: readonly EoaBuybackTier[] },
  atMs: number,
): EoaBuybackTier | undefined {
  return offer.buybackTiers.find((tier) => Date.parse(tier.expiresAt) >= atMs);
}
/** When an offer ends: the end of its last tier with a positive amount. */
export function getEoaBuybackOfferEndsAt(offer: {
  buybackTiers: readonly EoaBuybackTier[];
}): string | undefined {
  return offer.buybackTiers.findLast((tier) => BigInt(tier.amountInUsdt) > 0n)
    ?.expiresAt;
}
export const EoaOffersResponseSchema = z.object({
  offers: z.array(EoaBuybackOfferSchema),
});
export const EoaSignedBuybackSchema = z
  .object({
    buyerWalletAddress: addressSchema,
    cardPackId: z.string().uuid(),
    buybackAuth: GachaBuybackAuthorizationSchema,
    userSignature: hexSchema.refine(
      (value) => value.length === 132,
      'Expected a 65-byte EOA signature',
    ),
  })
  .strict();

// The wallet reads below are /v2/users/{walletAddress}: what the chain says
// about exactly that address, plus what your builder key sold it. A card the
// wallet pulled with another builder appears once it is delivered on chain.
export enum EoaCollectionSort {
  PulledAt = 'pulledAt',
  Fmv = 'fmvInUsd',
  BuybackExpiry = 'buybackExpiresAt',
}
export enum EoaSortOrder {
  Ascending = 'asc',
  Descending = 'desc',
}
export enum EoaCollectionCardStatus {
  /** The wallet owns the card on chain. */
  InWallet = 'IN_WALLET',
  /** Pulled with your builder key; Renaiss holds it and the wallet can still sell it back. */
  InBuybackWindow = 'IN_BUYBACK_WINDOW',
  /** Pulled with your builder key; no buyback is offered and it is not in the wallet yet. */
  AwaitingDelivery = 'AWAITING_DELIVERY',
}
const EoaCollectionCardSchema = z.object({
  tokenId: numericStringSchema,
  type: z.enum(CollectibleType),
  name: z.string(),
  /** The graded slab in its Renaiss frame, on a dark background. */
  frontImageUrl: z.string(),
  /** Current market value in USD cents; null for a collectible that has none yet. */
  fmvInUsd: numericStringSchema.nullable(),
  fmvUpdatedAt: z.string().datetime().nullable(),
  attributes: CollectibleAttributesSchema,
  state: z.discriminatedUnion('status', [
    z.object({ status: z.literal(EoaCollectionCardStatus.InWallet) }),
    z.object({
      status: z.literal(EoaCollectionCardStatus.InBuybackWindow),
      /** The price of the card's current buyback tier, and when that tier ends. */
      buybackAmountInUsdt: numericStringSchema,
      buybackExpiresAt: z.string().datetime(),
    }),
    z.object({ status: z.literal(EoaCollectionCardStatus.AwaitingDelivery) }),
  ]),
  /** The wallet's pull of this card with your builder key; null for a card it got any other way. */
  pull: z
    .object({
      packId: z.string().uuid(),
      packName: z.string(),
      permitFundTxHash: bytes32Schema,
      pulledAt: z.string().datetime(),
    })
    .nullable(),
});
export const EoaCollectionResponseSchema = z.object({
  collectibles: z.array(EoaCollectionCardSchema),
  pagination: PaginationResponseSchema,
});
export const EoaCollectionSummarySchema = z.object({
  collectibleCount: z.number().int().nonnegative(),
  /** Sum of the collectibles' current market values, in USD cents. */
  totalFmvInUsd: numericStringSchema,
  /** Collectibles counted in collectibleCount that add nothing to the total yet. */
  collectiblesWithoutFmv: z.number().int().nonnegative(),
});

/** The chain events listWalletActivities returns. */
export enum EoaActivityType {
  GachaV3Pull = 'gacha-v3-pull',
  GachaV3Buyback = 'gacha-v3-buyback',
  /** A pulled card was delivered to the wallet. */
  GachaV3ReleaseToken = 'gacha-v3-release-token',
  Buy = 'buy',
  Sell = 'sell',
  Transfer = 'transfer',
  Mint = 'mint',
  /** The card was redeemed for the physical card. */
  Burn = 'burn',
}
/** What listWalletActivities can keep: every type, or one. */
export enum EoaActivityFilter {
  All = 'all',
  GachaV3Pull = 'gacha-v3-pull',
  GachaV3Buyback = 'gacha-v3-buyback',
  GachaV3ReleaseToken = 'gacha-v3-release-token',
  Buy = 'buy',
  Sell = 'sell',
  Transfer = 'transfer',
  Mint = 'mint',
  Burn = 'burn',
}
const EoaActivityEventSchema = z.object({
  user: addressSchema,
  /** Block time, in seconds since the epoch. */
  timestamp: numericStringSchema,
  blockNumber: numericStringSchema,
  txHash: z.string(),
});
/** The catalog card of the token id the event names. */
const card = {
  item: z
    .object({
      tokenId: numericStringSchema,
      imageUrl: z.string(),
      title: z.string(),
      subtitle: z.string(),
    })
    .optional(),
};
const trade = {
  bidder: addressSchema,
  asker: addressSchema,
  nftTokenId: numericStringSchema,
  erc20Token: addressSchema,
  amount: numericStringSchema,
  feeAccrued: numericStringSchema,
  ...card,
};
const mintOrBurn = {
  tokenAmount: numericStringSchema,
  tokenId: numericStringSchema,
  ...card,
};
const EoaActivitySchema = z.discriminatedUnion('type', [
  // A pull names no card and a buyback no card, as on chain.
  EoaActivityEventSchema.extend({
    type: z.literal(EoaActivityType.GachaV3Pull),
    contractAddress: addressSchema,
    /** The pack's id on chain (a machine's onChainPackId), not the catalog id. */
    packId: bytes32Schema,
    token: addressSchema,
    checkoutIds: z.array(numericStringSchema),
    /** What the pull paid for all its cards, in 18-decimal USDT units. */
    totalAmount: numericStringSchema,
    blockHash: z.string(),
  }),
  EoaActivityEventSchema.extend({
    type: z.literal(EoaActivityType.GachaV3Buyback),
    contractAddress: addressSchema,
    /** The settlement ids of the cards sold back. */
    buybackIds: z.array(bytes32Schema),
    token: addressSchema,
    /** What the buyback paid for all its cards, in 18-decimal USDT units. */
    priceInUsdt: numericStringSchema,
  }),
  EoaActivityEventSchema.extend({
    type: z.literal(EoaActivityType.GachaV3ReleaseToken),
    contractAddress: addressSchema,
    releaseTokenId: bytes32Schema,
    nftTokenId: numericStringSchema,
    ...card,
  }),
  EoaActivityEventSchema.extend({
    type: z.literal(EoaActivityType.Buy),
    ...trade,
  }),
  EoaActivityEventSchema.extend({
    type: z.literal(EoaActivityType.Sell),
    ...trade,
  }),
  EoaActivityEventSchema.extend({
    type: z.literal(EoaActivityType.Transfer),
    to: addressSchema,
    tokenId: numericStringSchema,
    ...card,
  }),
  EoaActivityEventSchema.extend({
    type: z.literal(EoaActivityType.Mint),
    ...mintOrBurn,
  }),
  EoaActivityEventSchema.extend({
    type: z.literal(EoaActivityType.Burn),
    ...mintOrBurn,
  }),
]);
export const EoaActivitiesResponseSchema = z.object({
  activities: z.array(EoaActivitySchema),
  /** Send it as the next page's cursor; null is the end. */
  nextCursor: z.string().nullable(),
});
export type EoaCollectionCard = z.infer<typeof EoaCollectionCardSchema>;
export type EoaCollectionSummary = z.infer<typeof EoaCollectionSummarySchema>;
export type EoaActivity = z.infer<typeof EoaActivitySchema>;
export type EoaMachine = z.infer<typeof EoaMachineSchema>;
export type EoaMachineDetail = z.infer<typeof EoaMachineDetailSchema>;
export type EoaMachineContent = z.infer<typeof EoaMachineContentSchema>;
export type EoaPreparedPull = z.infer<typeof EoaPreparedPullSchema>;
export type EoaSignedPull = z.infer<typeof EoaSignedPullSchema>;
export type EoaPull = z.infer<typeof EoaPullSchema>;
export type EoaDrawStatus = z.infer<typeof EoaDrawStatusSchema>;
export type EoaDrawnCollectible = z.infer<typeof EoaDrawnCollectibleSchema>;
export type EoaResolvedPull = z.infer<typeof EoaResolvedPullSchema>;
export type EoaStreamEvent = z.infer<typeof EoaStreamEventSchema>;
export type EoaBuybackOffer = z.infer<typeof EoaBuybackOfferSchema>;
export type EoaSignedBuyback = z.infer<typeof EoaSignedBuybackSchema>;
