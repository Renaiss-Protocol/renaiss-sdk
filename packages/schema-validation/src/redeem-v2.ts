import { z } from 'zod';
import { addressSchema, bytes32Schema } from './wallet';

/** REST money/token IDs are decimal strings; public SDK values are bigint. */
const RedemptionUintSchema = z
  .string()
  .regex(/^\d{1,78}$/)
  .refine((v) => BigInt(v) < 2n ** 256n)
  .transform(BigInt);
export const RedemptionAddressSchema = z
  .object({
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    addressLine1: z.string().trim().min(1).max(35),
    addressLine2: z.string().trim().max(35).optional(),
    city: z.string().trim().min(1).max(200),
    state: z.string().trim().max(200).optional(),
    postalCode: z.string().trim().min(1).max(20),
  })
  .strict();
export const RedemptionRecipientSchema = z
  .object({
    name: z.string().trim().min(1).max(22),
    phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
    email: z.email().max(50),
    taxId: z.string().trim().max(100).optional(),
    chineseName: z.string().trim().max(100).optional(),
  })
  .strict();
export type RedemptionAddress = z.infer<typeof RedemptionAddressSchema>;
export type RedemptionRecipient = z.infer<typeof RedemptionRecipientSchema>;
const RedeemableCardSchema = z.object({
  tokenId: RedemptionUintSchema,
  name: z.string(),
  frontImageUrl: z.url(),
  fmvInUsd: RedemptionUintSchema.nullable(),
  fmvUpdatedAt: z.iso.datetime().nullable(),
  ownerAcquiredAt: z.iso.datetime().nullable(),
  regionCountryCode: z.string(),
  vaultDisplayName: z.string(),
});
export type RedeemableCard = z.infer<typeof RedeemableCardSchema>;
export const RedeemableCardsResponseSchema = z.object({
  collectibles: z.array(RedeemableCardSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  hasMore: z.boolean(),
});
const RedemptionFeesSchema = z.object({
  handlingFeeInUsd: RedemptionUintSchema,
  shippingFeeInUsd: RedemptionUintSchema,
  insuranceFeeInUsd: RedemptionUintSchema,
  dutyAndTaxesInUsd: RedemptionUintSchema,
  totalFeeInUsdt: RedemptionUintSchema,
});
const RedemptionOrderFeesSchema = RedemptionFeesSchema.omit({
  totalFeeInUsdt: true,
});
export type RedemptionOrderFees = z.infer<typeof RedemptionOrderFeesSchema>;
export type RedemptionFees = z.infer<typeof RedemptionFeesSchema>;
const RedemptionCourierSchema = z.object({
  id: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  estimatedDays: z.string(),
  shippingFeeInUsd: RedemptionUintSchema,
  insuranceFeeInUsd: RedemptionUintSchema,
  dutyAndTaxesInUsd: RedemptionUintSchema,
});
export type RedemptionCourier = z.infer<typeof RedemptionCourierSchema>;
export const RedemptionQuoteSchema = z.object({
  quoteId: z.uuid(),
  expiresAt: z.iso.datetime(),
  handlingFeeInUsd: RedemptionUintSchema,
  couriers: z.array(RedemptionCourierSchema),
});
export type RedemptionQuote = z.infer<typeof RedemptionQuoteSchema>;
const RedemptionTypedDataSchema = z
  .object({
    domain: z.record(z.string(), z.unknown()),
    types: z.record(
      z.string(),
      z.array(z.object({ name: z.string(), type: z.string() }).strict()),
    ),
    primaryType: z.string(),
    message: z.record(z.string(), z.unknown()),
  })
  .strict();
export const PreparedRedemptionSchema = z.object({
  preparationId: z.uuid(),
  requestId: bytes32Schema,
  walletAddress: addressSchema,
  tokenIds: z.array(RedemptionUintSchema).min(1).max(50),
  expiresAt: z.iso.datetime(),
  address: RedemptionAddressSchema,
  recipient: RedemptionRecipientSchema,
  courierName: z.string(),
  fees: RedemptionFeesSchema,
  redemptionTypedData: RedemptionTypedDataSchema,
  permitTypedData: RedemptionTypedDataSchema,
});
export type PreparedRedemption = z.infer<typeof PreparedRedemptionSchema>;
export const SignedRedemptionSchema = z
  .object({
    preparationId: z.uuid(),
    requestId: bytes32Schema,
    signature: z.string().regex(/^0x(?:[a-fA-F0-9]{128}|[a-fA-F0-9]{130})$/),
  })
  .strict();
export type SignedRedemption = z.infer<typeof SignedRedemptionSchema>;
export const RedemptionCheckoutSchema = z.object({
  requestId: bytes32Schema,
  status: z.enum(['prepared', 'submitting', 'succeeded', 'failed']),
  transactionHash: bytes32Schema.optional(),
});
export type RedemptionCheckout = z.infer<typeof RedemptionCheckoutSchema>;
export const RedemptionOrderSchema = z.object({
  requestId: bytes32Schema,
  status: z.string(),
  tokenStatuses: z.record(z.string(), z.string()),
  address: RedemptionAddressSchema,
  recipient: RedemptionRecipientSchema.omit({ taxId: true }),
  courierName: z.string(),
  estimatedDeliveryDaysMin: z.number().nullable(),
  estimatedDeliveryDaysMax: z.number().nullable(),
  fees: RedemptionOrderFeesSchema,
  trackingNumber: z.string().nullable(),
  trackingUrl: z.string().nullable(),
  shipmentStatus: z.string().nullable(),
  trackingLastSyncedAt: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().nullable(),
  collectibles: z.array(RedeemableCardSchema.omit({ ownerAcquiredAt: true })),
});
export type RedemptionOrder = z.infer<typeof RedemptionOrderSchema>;
const RedemptionOrderSummarySchema = RedemptionOrderSchema.pick({
  requestId: true,
  status: true,
  trackingNumber: true,
  shipmentStatus: true,
}).extend({
  collectibles: z.array(
    RedeemableCardSchema.pick({
      tokenId: true,
      name: true,
      frontImageUrl: true,
      fmvInUsd: true,
    }),
  ),
});
export type RedemptionOrderSummary = z.infer<
  typeof RedemptionOrderSummarySchema
>;
export const RedemptionOrdersResponseSchema = z.object({
  orders: z.array(RedemptionOrderSummarySchema),
  hasMore: z.boolean(),
});
export const RedemptionRegionsSchema = z.object({
  counts: z.record(z.string(), z.number().int().nonnegative()),
});
export const RedemptionAddressValidationSchema = z.object({
  status: z.string(),
  detail: z.string(),
});
export const RedemptionChallengeSchema = z.object({
  challengeId: z.uuid(),
  message: z.string().max(8192),
  expiresAt: z.iso.datetime(),
  context: z
    .object({
      builderAppId: z.uuid(),
      issuer: z.url(),
      audience: z.url(),
      scopes: z.array(z.string()).min(1).max(32),
    })
    .strict(),
});
export type RedemptionChallenge = z.infer<typeof RedemptionChallengeSchema>;
export const RedemptionSessionSchema = z
  .object({
    tokenType: z.literal('Bearer'),
    accessToken: z.string().min(1).max(128),
    refreshToken: z.string().min(1).max(128),
    expiresAt: z.iso.datetime(),
    refreshExpiresAt: z.iso.datetime(),
    scopes: z.array(z.string()),
  })
  .refine(
    (s) =>
      s.scopes.length === 2 &&
      s.scopes.includes('redeem:read') &&
      s.scopes.includes('redeem:write'),
  );
export type RedemptionSession = z.infer<typeof RedemptionSessionSchema>;

export type RedemptionWalletSession = {
  walletAddress: string;
  expiresAt: string;
};
export type RedemptionRegions = z.infer<typeof RedemptionRegionsSchema>;
export type RedemptionAddressValidation = z.infer<
  typeof RedemptionAddressValidationSchema
>;
