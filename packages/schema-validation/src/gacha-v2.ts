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
import { CollectibleAttributeSchema } from './marketplace';
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
/**
 * One buyback tier of a machine: until `buybackExpiredInSeconds` after a pull
 * resolves, a buyback pays `buybackPercentage` of the collectible's base value.
 * A pull keeps the tiers the machine had when it was drawn.
 */
const EoaMachineBuybackTierSchema = z.object({
  buybackPercentage: z.number(),
  buybackExpiredInSeconds: z.number().int().nonnegative(),
});
export type EoaMachineBuybackTier = z.infer<typeof EoaMachineBuybackTierSchema>;
const EoaMachineDetailSchema = EoaMachineSchema.extend({
  tiers: z.array(EoaMachineTierSchema),
  activeSetExpectedValueInUsd: numericStringSchema,
  buybackConfig: z.array(EoaMachineBuybackTierSchema),
});
const EoaMachineContentSchema = z.object({
  name: z.string(),
  tier: z.string(),
  buybackBaseValueInUsd: numericStringSchema,
  frontImageUrl: z.string(),
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
/** A resolved pull from the stream: no status, and each draw names its collectible. */
const EoaResolvedPullSchema = EoaPullSchema.omit({ status: true }).extend({
  draws: z.array(
    EoaDrawSchema.extend({
      tier: z.string(),
      buybackBaseValueInUSD: numericStringSchema,
      // A plain string: the API adds collectible types (POKEMON, ONE_PIECE,
      // SPORTS today) without a new SDK release.
      type: z.string(),
      name: z.string(),
      frontImageUrl: z.string().url(),
      attributes: z.array(CollectibleAttributeSchema),
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
/**
 * One price step of a buyback offer: `amountInUsdt` (18-decimal base units)
 * applies until `expiresAt`, inclusive.
 */
const EoaBuybackTierSchema = z.object({
  buybackPercentage: z.number(),
  amountInUsdt: numericStringSchema,
  expiresAt: z.string().datetime(),
});
export type EoaBuybackTier = z.infer<typeof EoaBuybackTierSchema>;
export const EoaBuybackOfferSchema = z.object({
  cardPackId: z.string().uuid(),
  settlementId: bytes32Schema,
  tokenId: numericStringSchema,
  vendingMachineAddress: addressSchema,
  buybackTiers: z.array(EoaBuybackTierSchema),
});
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
export type EoaMachine = z.infer<typeof EoaMachineSchema>;
export type EoaMachineDetail = z.infer<typeof EoaMachineDetailSchema>;
export type EoaMachineContent = z.infer<typeof EoaMachineContentSchema>;
export type EoaPreparedPull = z.infer<typeof EoaPreparedPullSchema>;
export type EoaSignedPull = z.infer<typeof EoaSignedPullSchema>;
export type EoaPull = z.infer<typeof EoaPullSchema>;
export type EoaResolvedPull = z.infer<typeof EoaResolvedPullSchema>;
export type EoaStreamEvent = z.infer<typeof EoaStreamEventSchema>;
export type EoaBuybackOffer = z.infer<typeof EoaBuybackOfferSchema>;
export type EoaSignedBuyback = z.infer<typeof EoaSignedBuybackSchema>;
