import { z } from 'zod';
import {
  addressSchema,
  bytes32Schema,
  hexSchema,
  numericStringSchema,
} from './wallet';

export enum GachaMachineType {
  Limited = 'limited',
  Perpetual = 'perpetual',
  V3 = 'v3',
  V3Limited = 'v3-limited',
}

export enum GachaMachineStage {
  Countdown = 'countdown',
  Active = 'active',
  SoldOutOrRestocking = 'soldout-or-restocking',
  Archived = 'archived',
}

/** The most cards one /v2 pull takes. */
export const MAX_GACHA_PULL_QUANTITY = 10;

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
/** Cards in one /v2 pull: any whole number from 1 to MAX_GACHA_PULL_QUANTITY. */
export const GachaQuantitySchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_GACHA_PULL_QUANTITY);
const GachaMachineTierChanceSchema = z.union([
  z.number(),
  z.literal('UNDER-1-PERCENT'),
]);
export const GachaMachineTierSchema = z.object({
  tier: z.number().int(),
  name: z.enum(GachaMachineTierName),
  chance: GachaMachineTierChanceSchema,
});

export const PaginationResponseSchema = z.object({
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean(),
});

/**
 * One card that has left a gacha machine. Carries no pull time: an entry
 * surfaces only after its buyback window closes, so any timestamp would
 * describe the reveal rather than the pull.
 */
export const GachaPullHistoryEntrySchema = z.object({
  tokenId: numericStringSchema,
  name: z.string(),
  tier: z.string(),
  buybackBaseValueInUsd: numericStringSchema,
  frontImageUrl: z.string(),
  /** The card alone: no slab, grade label, frame or background. */
  imageUrl: z.string(),
});

export type GachaPullHistoryEntry = z.infer<typeof GachaPullHistoryEntrySchema>;

// The pull-history feed has no cheap total, so the API paginates by hasMore only.
export const HasMorePaginationResponseSchema = PaginationResponseSchema.omit({
  total: true,
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
      packId: bytes32Schema,
      builder: bytes32Schema,
      numOfTokens: numericStringSchema,
    }),
  }),
});

export type GachaPermit2TypedData = z.infer<typeof GachaPermit2TypedDataSchema>;

export const PreparedGachaPullPayloadSchema = z.object({
  packId: z.string().uuid(),
  builderCode: bytes32Schema,
  numOfTokens: GachaQuantitySchema,
  amountPerToken: numericStringSchema,
  nonce: numericStringSchema,
  deadline: z.number().int().positive(),
});

export const GachaBuybackAuthorizationSchema = z.object({
  buybackIds: z.array(bytes32Schema).min(1).max(10),
  token: addressSchema,
  amount: numericStringSchema,
});

export const SubmitGachaBuybackResponseSchema = z.object({
  txHash: hexSchema,
  totalAmountInUsdt: numericStringSchema,
  itemCount: z.number().int().nonnegative(),
});

export type SubmitGachaBuybackResponse = z.infer<
  typeof SubmitGachaBuybackResponseSchema
>;
