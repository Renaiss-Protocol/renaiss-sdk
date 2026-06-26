import { z } from 'zod';
import { addressSchema } from './wallet';

const decimalStringSchema = z.string().regex(/^\d+$/);

export enum UserActivityFilter {
  All = 'all',
  Pull = 'pull',
  Mint = 'mint',
  Burn = 'burn',
  Transfer = 'transfer',
  Buyback = 'buyback',
  Buy = 'buy',
  Sell = 'sell',
  PerpPull = 'perp-pull',
  PerpBuyback = 'perp-buyback',
  PerpReleaseToken = 'perp-release-token',
  GachaV3Pull = 'gacha-v3-pull',
  GachaV3Buyback = 'gacha-v3-buyback',
  GachaV3ReleaseToken = 'gacha-v3-release-token',
}

export const UserActivityFilterSchema = z.enum(UserActivityFilter);

export const UserActivityItemSchema = z.object({
  tokenId: decimalStringSchema,
  imageUrl: z.string(),
  title: z.string(),
  subtitle: z.string(),
});

export type UserActivityItem = z.infer<typeof UserActivityItemSchema>;

const UserActivityBaseSchema = z.object({
  user: addressSchema,
  timestamp: decimalStringSchema,
  occurredAt: z.string().datetime(),
  blockNumber: decimalStringSchema,
  txHash: z.string(),
  ordinal: decimalStringSchema,
  item: UserActivityItemSchema.optional(),
});

const PullActivitySchema = UserActivityBaseSchema.extend({
  type: z.literal(UserActivityFilter.Pull),
  checkoutId: z.string(),
  packId: z.string(),
  priceInUsdt: decimalStringSchema,
});

const MintActivitySchema = UserActivityBaseSchema.extend({
  type: z.literal(UserActivityFilter.Mint),
  tokenAmount: decimalStringSchema,
  tokenId: decimalStringSchema,
});

const BurnActivitySchema = UserActivityBaseSchema.extend({
  type: z.literal(UserActivityFilter.Burn),
  tokenAmount: decimalStringSchema,
  tokenId: decimalStringSchema,
});

const TransferActivitySchema = UserActivityBaseSchema.extend({
  type: z.literal(UserActivityFilter.Transfer),
  to: addressSchema,
  tokenId: decimalStringSchema,
});

const BuybackActivitySchema = UserActivityBaseSchema.extend({
  type: z.literal(UserActivityFilter.Buyback),
  checkoutId: z.string(),
  token: addressSchema,
  priceInUsdt: decimalStringSchema,
  fmvPriceInUsd: decimalStringSchema,
});

const BuyActivitySchema = UserActivityBaseSchema.extend({
  type: z.literal(UserActivityFilter.Buy),
  bidder: addressSchema,
  asker: addressSchema,
  nftTokenId: decimalStringSchema,
  erc20Token: addressSchema,
  amount: decimalStringSchema,
  feeAccrued: decimalStringSchema,
});

const SellActivitySchema = UserActivityBaseSchema.extend({
  type: z.literal(UserActivityFilter.Sell),
  bidder: addressSchema,
  asker: addressSchema,
  nftTokenId: decimalStringSchema,
  erc20Token: addressSchema,
  amount: decimalStringSchema,
  feeAccrued: decimalStringSchema,
});

const SbtMintActivitySchema = UserActivityBaseSchema.extend({
  type: z.literal('sbt-mint'),
});

const PerpPullActivitySchema = UserActivityBaseSchema.extend({
  type: z.literal(UserActivityFilter.PerpPull),
  contractAddress: addressSchema,
  checkoutId: z.string(),
  priceInUsdt: decimalStringSchema,
  numOfTokens: z.number().int().optional(),
});

const PerpBuybackActivitySchema = UserActivityBaseSchema.extend({
  type: z.literal(UserActivityFilter.PerpBuyback),
  contractAddress: addressSchema,
  checkoutId: z.string(),
  nftTokenId: decimalStringSchema,
  priceInUsdt: decimalStringSchema,
  fmvPriceInUsd: decimalStringSchema,
});

const PerpReleaseTokenActivitySchema = UserActivityBaseSchema.extend({
  type: z.literal(UserActivityFilter.PerpReleaseToken),
  contractAddress: addressSchema,
  checkoutId: z.string(),
  nftTokenId: decimalStringSchema,
});

const GachaV3PullActivitySchema = UserActivityBaseSchema.extend({
  type: z.literal(UserActivityFilter.GachaV3Pull),
  contractAddress: addressSchema,
  checkoutIds: z.array(decimalStringSchema),
  totalAmount: decimalStringSchema,
  blockHash: z.string(),
});

const GachaV3BuybackActivitySchema = UserActivityBaseSchema.extend({
  type: z.literal(UserActivityFilter.GachaV3Buyback),
  contractAddress: addressSchema,
  checkoutId: decimalStringSchema,
  nftTokenId: decimalStringSchema,
  token: addressSchema,
  priceInUsdt: decimalStringSchema,
  baseValueInUsd: decimalStringSchema,
});

const GachaV3ReleaseTokenActivitySchema = UserActivityBaseSchema.extend({
  type: z.literal(UserActivityFilter.GachaV3ReleaseToken),
  contractAddress: addressSchema,
  checkoutId: decimalStringSchema,
  nftTokenId: decimalStringSchema,
});

export const UserActivitySchema = z.discriminatedUnion('type', [
  PullActivitySchema,
  MintActivitySchema,
  BurnActivitySchema,
  TransferActivitySchema,
  BuybackActivitySchema,
  BuyActivitySchema,
  SellActivitySchema,
  SbtMintActivitySchema,
  PerpPullActivitySchema,
  PerpBuybackActivitySchema,
  PerpReleaseTokenActivitySchema,
  GachaV3PullActivitySchema,
  GachaV3BuybackActivitySchema,
  GachaV3ReleaseTokenActivitySchema,
]);

export type UserActivity = z.infer<typeof UserActivitySchema>;

export const UserActivitiesResponseSchema = z.object({
  activities: z.array(UserActivitySchema),
  nextCursor: decimalStringSchema.nullable(),
});

export type UserActivitiesResponse = z.infer<
  typeof UserActivitiesResponseSchema
>;
