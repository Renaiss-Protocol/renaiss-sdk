import type {
  PreparedRedemption,
  RedeemableCard,
  RedemptionAddress,
  RedemptionCheckout,
  RedemptionConfig,
  RedemptionCourier,
  RedemptionOrder,
  RedemptionOrderFees,
  RedemptionOrderSummary,
  RedemptionQuote,
  RedemptionRecipient,
  RedemptionWalletSession,
} from '@renaiss-protocol/client';

/*
 * SDK value shapes used by the redeem screens. Token IDs and amounts are
 * bigint, timestamps are ISO strings. The SDK exports the response models;
 * screen-specific aliases keep the display code independent of transport details.
 */

export type {
  PreparedRedemption,
  RedeemableCard,
  RedemptionCheckout,
  RedemptionConfig,
  RedemptionCourier,
  RedemptionOrder,
  RedemptionOrderFees,
  RedemptionOrderSummary,
  RedemptionQuote,
};

export type ShippingAddress = RedemptionAddress;
export type Recipient = RedemptionRecipient;

/** Wallet access token metadata; the tokens stay inside the SDK. */
export type RedemptionSession = RedemptionWalletSession;
