import { z } from 'zod';
import { addressSchema, hexSchema } from './wallet';

const numericStringSchema = z.string().regex(/^\d+$/);

export enum GachaMachineType {
  Limited = 'limited',
  Perpetual = 'perpetual',
  V3 = 'v3',
}

export enum GachaMachineStage {
  Countdown = 'countdown',
  Active = 'active',
  SoldOutOrRestocking = 'soldout-or-restocking',
  Archived = 'archived',
}

export enum GachaQuantity {
  Single = 1,
  Five = 5,
  Ten = 10,
}

export enum GachaMachineTierName {
  Top = 'TOP',
  S = 'S',
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  Epic = 'epic',
  Rare = 'rare',
  Uncommon = 'uncommon',
  Common = 'common',
  Legendary = 'legendary',
  Thorn = 'thorn',
  Bloom = 'bloom',
  Crown = 'crown',
}

export const SupportedGachaMachineTypeSchema = z.literal(GachaMachineType.V3);
export const GachaQuantitySchema = z.union([
  z.literal(GachaQuantity.Single),
  z.literal(GachaQuantity.Five),
  z.literal(GachaQuantity.Ten),
]);
export const GachaMachineTierChanceSchema = z.union([
  z.number(),
  z.literal('UNDER-1-PERCENT'),
]);
export const GachaMachineTierSchema = z.object({
  tier: z.number().int(),
  name: z.enum(GachaMachineTierName),
  chance: GachaMachineTierChanceSchema,
});

export type GachaMachineTier = z.infer<typeof GachaMachineTierSchema>;

export const GachaMachineSchema = z.object({
  slug: z.string(),
  name: z.string(),
  packType: z.enum(GachaMachineType),
  stage: z.enum(GachaMachineStage),
  description: z.string().nullable(),
  author: z.string(),
  priceInUsdt: numericStringSchema,
  expectedValueInUsd: numericStringSchema.nullable(),
  featuredCardFmvInUsd: numericStringSchema.nullable(),
  packBannerVideoUrl: z.string().nullable(),
  gachaMachineVideoUrl: z.string().nullable(),
  gachaRippingPackAnimationVideoUrl: z.string().nullable(),
});

export type GachaMachine = z.infer<typeof GachaMachineSchema>;

export const GachaMachineDetailSchema = GachaMachineSchema.extend({
  tiers: z.array(GachaMachineTierSchema),
});

export type GachaMachineDetail = z.infer<typeof GachaMachineDetailSchema>;

export const GachaMachineContentSchema = z.object({
  name: z.string(),
  tier: z.string(),
  buybackBaseValueInUsd: numericStringSchema,
  frontImageUrl: z.string().nullable(),
});

export type GachaMachineContent = z.infer<typeof GachaMachineContentSchema>;

export const PaginationResponseSchema = z.object({
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean(),
});

export const GachaMachinesResponseSchema = z.object({
  cardPacks: z.array(GachaMachineSchema),
  pagination: PaginationResponseSchema,
});

export const GachaMachineResponseSchema = z.object({
  cardPack: GachaMachineDetailSchema,
});

export const GachaMachineContentsResponseSchema = z.object({
  cardPack: GachaMachineSchema,
  cards: z.array(GachaMachineContentSchema),
  pagination: PaginationResponseSchema,
});

const TypedDataFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
});

export const GachaPermit2TypedDataSchema = z.object({
  domain: z.object({
    name: z.literal('Permit2'),
    chainId: z.number().int().positive(),
    verifyingContract: addressSchema,
  }),
  types: z.record(z.string(), z.array(TypedDataFieldSchema)),
  primaryType: z.literal('PermitWitnessTransferFrom'),
  message: z.object({
    permitted: z.object({
      token: addressSchema,
      amount: numericStringSchema,
    }),
    spender: addressSchema,
    nonce: numericStringSchema,
    deadline: numericStringSchema,
    witness: z.object({
      numOfTokens: numericStringSchema,
    }),
  }),
});

export type GachaPermit2TypedData = z.infer<typeof GachaPermit2TypedDataSchema>;

export const PreparedGachaPullPayloadSchema = z.object({
  packId: z.string().uuid(),
  numOfTokens: GachaQuantitySchema,
  amountPerToken: numericStringSchema,
  nonce: numericStringSchema,
  deadline: z.number().int().positive(),
});

export type PreparedGachaPullPayload = z.infer<
  typeof PreparedGachaPullPayloadSchema
>;

export const PrepareGachaPullResponseSchema = z.object({
  chainId: z.number().int().positive(),
  pullStreamPath: z.literal('/v0/gacha/vrf/pull/stream'),
  buyerWalletAddress: addressSchema,
  pack: z.object({
    id: z.string().uuid(),
    priceInUsdt: numericStringSchema,
    vendingMachineAddress: addressSchema,
  }),
  permit2TypedData: GachaPermit2TypedDataSchema,
  unsignedPullPayload: PreparedGachaPullPayloadSchema,
});

export type PrepareGachaPullResponse = z.infer<
  typeof PrepareGachaPullResponseSchema
>;

export enum GachaStreamEventStatus {
  Start = 'start',
  Progress = 'progress',
  Complete = 'complete',
  Error = 'error',
}

export enum GachaStreamAction {
  OpenPack = 'GACHA_V3_OPEN_PACK',
  DrawResolved = 'GACHA_V3_DRAW_RESOLVED',
  TokenReleased = 'GACHA_V3_TOKEN_RELEASED',
}

const GachaCollectibleSummarySchema = z
  .object({
    tokenId: z.string(),
    name: z.string(),
  })
  .passthrough();

export const GachaDrawResolvedSchema = z.object({
  checkoutId: z.number().int().nonnegative(),
  randomness: hexSchema,
  proof: hexSchema,
  blockHash: hexSchema,
  collectible: GachaCollectibleSummarySchema,
});

export type GachaDrawResolved = z.infer<typeof GachaDrawResolvedSchema>;

export const GachaTokenReleasedSchema = z.object({
  checkoutId: z.number().int().nonnegative(),
  releaseTxHash: hexSchema,
  blockNumber: z.number().int().nonnegative(),
  collectible: GachaCollectibleSummarySchema,
});

export type GachaTokenReleased = z.infer<typeof GachaTokenReleasedSchema>;

export const GachaStreamEventSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal(GachaStreamEventStatus.Start),
    id: z.string(),
    data: z.object({
      action: z.enum(GachaStreamAction),
      timestamp: z.string().datetime(),
    }),
  }),
  z.object({
    status: z.literal(GachaStreamEventStatus.Progress),
    id: z.string(),
    data: z.object({
      action: z.enum(GachaStreamAction),
      timestamp: z.string().datetime(),
      message: z.string().optional(),
    }),
  }),
  z.object({
    status: z.literal(GachaStreamEventStatus.Complete),
    id: z.string(),
    data: z
      .object({
        action: z.enum(GachaStreamAction),
        timestamp: z.string().datetime(),
        txHashes: z.array(hexSchema),
        draws: z.array(GachaDrawResolvedSchema).optional(),
        released: z.array(GachaTokenReleasedSchema).optional(),
      })
      .passthrough(),
  }),
  z.object({
    status: z.literal(GachaStreamEventStatus.Error),
    id: z.string(),
    data: z.object({
      action: z.enum(GachaStreamAction),
      timestamp: z.string().datetime(),
      code: z.string().optional(),
      details: z.string().optional(),
    }),
  }),
]);

export type GachaStreamEvent = z.infer<typeof GachaStreamEventSchema>;

export const GachaPullResultSchema = z.object({
  events: z.array(GachaStreamEventSchema),
  draws: z.array(GachaDrawResolvedSchema),
  released: z.array(GachaTokenReleasedSchema),
  txHashes: z.array(hexSchema),
});

export type GachaPullResult = z.infer<typeof GachaPullResultSchema>;

export const GachaBuybackAuthorizationSchema = z.object({
  checkoutIds: z.array(numericStringSchema).min(1),
  token: addressSchema,
  amounts: z.array(numericStringSchema).min(1),
  tokenIds: z.array(numericStringSchema).min(1),
});

export type GachaBuybackAuthorization = z.infer<
  typeof GachaBuybackAuthorizationSchema
>;

export const GachaBuybackOfferSchema = z.object({
  packId: z.string().uuid(),
  packSlug: z.string(),
  checkoutId: z.string(),
  tokenId: numericStringSchema,
  cardName: z.string(),
  setName: z.string().nullable(),
  cardNumber: z.string().nullable(),
  tier: z.string().nullable(),
  frontImageUrl: z.string().nullable(),
  buybackAmountInUsd: numericStringSchema,
  buybackAmountInUsdt: numericStringSchema,
  buybackBaseValueInUsd: numericStringSchema.nullable(),
  expiresAt: z.string().datetime(),
  vendingMachineAddress: addressSchema,
  buybackAuthorization: GachaBuybackAuthorizationSchema,
});

export type GachaBuybackOffer = z.infer<typeof GachaBuybackOfferSchema>;

export const GachaBuybackOffersResponseSchema = z.object({
  offers: z.array(GachaBuybackOfferSchema),
  pagination: z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  }),
});

export const SubmitGachaBuybackResponseSchema = z.object({
  txHash: hexSchema,
  totalAmountInUsdt: numericStringSchema,
  itemCount: z.number().int().nonnegative(),
});

export type SubmitGachaBuybackResponse = z.infer<
  typeof SubmitGachaBuybackResponseSchema
>;

export const ApiKeyResponseSchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  name: z.string().nullable().optional(),
  prefix: z.string().nullable().optional(),
  start: z.string().nullable().optional(),
  key: z.string().min(1),
  enabled: z.boolean(),
  expiresAt: z.string().datetime().nullable().optional(),
  referenceId: z.string(),
  rateLimitEnabled: z.boolean(),
  requestCount: z.number(),
});

export type ApiKeyResponse = z.infer<typeof ApiKeyResponseSchema>;
