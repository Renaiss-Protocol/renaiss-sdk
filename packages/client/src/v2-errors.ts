import {
  V2_LIST_GACHA_MACHINES_ERROR_CODES,
  type V2ListGachaMachinesErrorCode,
} from '@renaiss-protocol/error-codes';
import type { ApiError } from '@renaiss-protocol/fp';

export type { V2ListGachaMachinesErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows ListGachaMachines failures to its documented Result codes; never throws. */
export function isListGachaMachinesError(
  error: ApiError,
): error is ApiError<V2ListGachaMachinesErrorCode> {
  return (V2_LIST_GACHA_MACHINES_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  V2_FETCH_GACHA_MACHINE_ERROR_CODES,
  type V2FetchGachaMachineErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2FetchGachaMachineErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows FetchGachaMachine failures to its documented Result codes; never throws. */
export function isFetchGachaMachineError(
  error: ApiError,
): error is ApiError<V2FetchGachaMachineErrorCode> {
  return (V2_FETCH_GACHA_MACHINE_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  V2_LIST_GACHA_MACHINE_CONTENTS_ERROR_CODES,
  type V2ListGachaMachineContentsErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2ListGachaMachineContentsErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows ListGachaMachineContents failures to its documented Result codes; never throws. */
export function isListGachaMachineContentsError(
  error: ApiError,
): error is ApiError<V2ListGachaMachineContentsErrorCode> {
  return (
    V2_LIST_GACHA_MACHINE_CONTENTS_ERROR_CODES as readonly string[]
  ).includes(error.code);
}

import {
  V2_LIST_GACHA_PULL_HISTORY_ERROR_CODES,
  type V2ListGachaPullHistoryErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2ListGachaPullHistoryErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows ListGachaPullHistory failures to its documented Result codes; never throws. */
export function isListGachaPullHistoryError(
  error: ApiError,
): error is ApiError<V2ListGachaPullHistoryErrorCode> {
  return (V2_LIST_GACHA_PULL_HISTORY_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  V2_LIST_WALLET_PULLS_ERROR_CODES,
  type V2ListWalletPullsErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2ListWalletPullsErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows ListWalletPulls failures to its documented Result codes; never throws. */
export function isListWalletPullsError(
  error: ApiError,
): error is ApiError<V2ListWalletPullsErrorCode> {
  return (V2_LIST_WALLET_PULLS_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  V2_LIST_WALLET_COLLECTION_ERROR_CODES,
  type V2ListWalletCollectionErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2ListWalletCollectionErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows ListWalletCollection failures to its documented Result codes; never throws. */
export function isListWalletCollectionError(
  error: ApiError,
): error is ApiError<V2ListWalletCollectionErrorCode> {
  return (V2_LIST_WALLET_COLLECTION_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  V2_FETCH_WALLET_COLLECTION_SUMMARY_ERROR_CODES,
  type V2FetchWalletCollectionSummaryErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2FetchWalletCollectionSummaryErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows FetchWalletCollectionSummary failures to its documented Result codes; never throws. */
export function isFetchWalletCollectionSummaryError(
  error: ApiError,
): error is ApiError<V2FetchWalletCollectionSummaryErrorCode> {
  return (
    V2_FETCH_WALLET_COLLECTION_SUMMARY_ERROR_CODES as readonly string[]
  ).includes(error.code);
}

import {
  V2_LIST_WALLET_ACTIVITIES_ERROR_CODES,
  type V2ListWalletActivitiesErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2ListWalletActivitiesErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows ListWalletActivities failures to its documented Result codes; never throws. */
export function isListWalletActivitiesError(
  error: ApiError,
): error is ApiError<V2ListWalletActivitiesErrorCode> {
  return (V2_LIST_WALLET_ACTIVITIES_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  V2_FETCH_GACHA_DRAW_STATUS_ERROR_CODES,
  type V2FetchGachaDrawStatusErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2FetchGachaDrawStatusErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows FetchGachaDrawStatus failures to its documented Result codes; never throws. */
export function isFetchGachaDrawStatusError(
  error: ApiError,
): error is ApiError<V2FetchGachaDrawStatusErrorCode> {
  return (V2_FETCH_GACHA_DRAW_STATUS_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  V2_FETCH_GACHA_BUYBACK_OFFERS_ERROR_CODES,
  type V2FetchGachaBuybackOffersErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2FetchGachaBuybackOffersErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows FetchGachaBuybackOffers failures to its documented Result codes; never throws. */
export function isFetchGachaBuybackOffersError(
  error: ApiError,
): error is ApiError<V2FetchGachaBuybackOffersErrorCode> {
  return (
    V2_FETCH_GACHA_BUYBACK_OFFERS_ERROR_CODES as readonly string[]
  ).includes(error.code);
}

import {
  V2_PREPARE_GACHA_PULL_ERROR_CODES,
  type V2PrepareGachaPullErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2PrepareGachaPullErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows PrepareGachaPull failures to its documented Result codes; never throws. */
export function isPrepareGachaPullError(
  error: ApiError,
): error is ApiError<V2PrepareGachaPullErrorCode> {
  return (V2_PREPARE_GACHA_PULL_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  V2_SIGN_GACHA_PULL_ERROR_CODES,
  type V2SignGachaPullErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2SignGachaPullErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows SignGachaPull failures to its documented Result codes; never throws. */
export function isSignGachaPullError(
  error: ApiError,
): error is ApiError<V2SignGachaPullErrorCode> {
  return (V2_SIGN_GACHA_PULL_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  V2_SUBMIT_GACHA_PULL_ERROR_CODES,
  type V2SubmitGachaPullErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2SubmitGachaPullErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows SubmitGachaPull failures to its documented Result codes; never throws. */
export function isSubmitGachaPullError(
  error: ApiError,
): error is ApiError<V2SubmitGachaPullErrorCode> {
  return (V2_SUBMIT_GACHA_PULL_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  V2_CREATE_GACHA_BUYBACK_ERROR_CODES,
  type V2CreateGachaBuybackErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2CreateGachaBuybackErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows CreateGachaBuyback failures to its documented Result codes; never throws. */
export function isCreateGachaBuybackError(
  error: ApiError,
): error is ApiError<V2CreateGachaBuybackErrorCode> {
  return (V2_CREATE_GACHA_BUYBACK_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  V2_SUBMIT_GACHA_BUYBACK_ERROR_CODES,
  type V2SubmitGachaBuybackErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2SubmitGachaBuybackErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows SubmitGachaBuyback failures to its documented Result codes; never throws. */
export function isSubmitGachaBuybackError(
  error: ApiError,
): error is ApiError<V2SubmitGachaBuybackErrorCode> {
  return (V2_SUBMIT_GACHA_BUYBACK_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  V2_LIST_MARKETPLACE_CARDS_ERROR_CODES,
  type V2ListMarketplaceCardsErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2ListMarketplaceCardsErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows ListMarketplaceCards failures to its documented Result codes; never throws. */
export function isListMarketplaceCardsError(
  error: ApiError,
): error is ApiError<V2ListMarketplaceCardsErrorCode> {
  return (V2_LIST_MARKETPLACE_CARDS_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  V2_FETCH_CARD_ERROR_CODES,
  type V2FetchCardErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2FetchCardErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows FetchCard failures to its documented Result codes; never throws. */
export function isFetchCardError(
  error: ApiError,
): error is ApiError<V2FetchCardErrorCode> {
  return (V2_FETCH_CARD_ERROR_CODES as readonly string[]).includes(error.code);
}

import {
  V2_FETCH_CARD_ORDERS_ERROR_CODES,
  type V2FetchCardOrdersErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2FetchCardOrdersErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows FetchCardOrders failures to its documented Result codes; never throws. */
export function isFetchCardOrdersError(
  error: ApiError,
): error is ApiError<V2FetchCardOrdersErrorCode> {
  return (V2_FETCH_CARD_ORDERS_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  V2_CREATE_ASK_ERROR_CODES,
  type V2CreateAskErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2CreateAskErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows CreateAsk failures to its documented Result codes; never throws. */
export function isCreateAskError(
  error: ApiError,
): error is ApiError<V2CreateAskErrorCode> {
  return (V2_CREATE_ASK_ERROR_CODES as readonly string[]).includes(error.code);
}

import {
  V2_CREATE_BID_ERROR_CODES,
  type V2CreateBidErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2CreateBidErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows CreateBid failures to its documented Result codes; never throws. */
export function isCreateBidError(
  error: ApiError,
): error is ApiError<V2CreateBidErrorCode> {
  return (V2_CREATE_BID_ERROR_CODES as readonly string[]).includes(error.code);
}

import {
  V2_BUY_CARD_ERROR_CODES,
  type V2BuyCardErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2BuyCardErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows BuyCard failures to its documented Result codes; never throws. */
export function isBuyCardError(
  error: ApiError,
): error is ApiError<V2BuyCardErrorCode> {
  return (V2_BUY_CARD_ERROR_CODES as readonly string[]).includes(error.code);
}

import {
  V2_ACCEPT_BID_ERROR_CODES,
  type V2AcceptBidErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2AcceptBidErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows AcceptBid failures to its documented Result codes; never throws. */
export function isAcceptBidError(
  error: ApiError,
): error is ApiError<V2AcceptBidErrorCode> {
  return (V2_ACCEPT_BID_ERROR_CODES as readonly string[]).includes(error.code);
}

import {
  V2_CANCEL_ORDER_ERROR_CODES,
  type V2CancelOrderErrorCode,
} from '@renaiss-protocol/error-codes';

export type { V2CancelOrderErrorCode } from '@renaiss-protocol/error-codes';
/** Narrows CancelOrder failures to its documented Result codes; never throws. */
export function isCancelOrderError(
  error: ApiError,
): error is ApiError<V2CancelOrderErrorCode> {
  return (V2_CANCEL_ORDER_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  SIGN_IN_REDEMPTION_WALLET_ERROR_CODES,
  type SignInRedemptionWalletErrorCode,
} from '@renaiss-protocol/error-codes';

export type { SignInRedemptionWalletErrorCode } from '@renaiss-protocol/error-codes';
/** Narrow signInRedemptionWallet failures to its documented Result codes. */
export function isSignInRedemptionWalletError(
  error: ApiError,
): error is ApiError<SignInRedemptionWalletErrorCode> {
  return (SIGN_IN_REDEMPTION_WALLET_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  SIGN_OUT_REDEMPTION_WALLET_ERROR_CODES,
  type SignOutRedemptionWalletErrorCode,
} from '@renaiss-protocol/error-codes';

export type { SignOutRedemptionWalletErrorCode } from '@renaiss-protocol/error-codes';
/** Narrow signOutRedemptionWallet failures to its documented Result codes. */
export function isSignOutRedemptionWalletError(
  error: ApiError,
): error is ApiError<SignOutRedemptionWalletErrorCode> {
  return (SIGN_OUT_REDEMPTION_WALLET_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  FETCH_REDEMPTION_REGIONS_ERROR_CODES,
  type FetchRedemptionRegionsErrorCode,
} from '@renaiss-protocol/error-codes';

export type { FetchRedemptionRegionsErrorCode } from '@renaiss-protocol/error-codes';
/** Narrow fetchRedemptionRegions failures to its documented Result codes. */
export function isFetchRedemptionRegionsError(
  error: ApiError,
): error is ApiError<FetchRedemptionRegionsErrorCode> {
  return (FETCH_REDEMPTION_REGIONS_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  VALIDATE_REDEMPTION_ADDRESS_ERROR_CODES,
  type ValidateRedemptionAddressErrorCode,
} from '@renaiss-protocol/error-codes';

export type { ValidateRedemptionAddressErrorCode } from '@renaiss-protocol/error-codes';
/** Narrow validateRedemptionAddress failures to its documented Result codes. */
export function isValidateRedemptionAddressError(
  error: ApiError,
): error is ApiError<ValidateRedemptionAddressErrorCode> {
  return (
    VALIDATE_REDEMPTION_ADDRESS_ERROR_CODES as readonly string[]
  ).includes(error.code);
}

import {
  FETCH_REDEMPTION_QUOTE_ERROR_CODES,
  type FetchRedemptionQuoteErrorCode,
} from '@renaiss-protocol/error-codes';

export type { FetchRedemptionQuoteErrorCode } from '@renaiss-protocol/error-codes';
/** Narrow fetchRedemptionQuote failures to its documented Result codes. */
export function isFetchRedemptionQuoteError(
  error: ApiError,
): error is ApiError<FetchRedemptionQuoteErrorCode> {
  return (FETCH_REDEMPTION_QUOTE_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  PREPARE_REDEMPTION_ERROR_CODES,
  type PrepareRedemptionErrorCode,
} from '@renaiss-protocol/error-codes';

export type { PrepareRedemptionErrorCode } from '@renaiss-protocol/error-codes';
/** Narrow prepareRedemption failures to its documented Result codes. */
export function isPrepareRedemptionError(
  error: ApiError,
): error is ApiError<PrepareRedemptionErrorCode> {
  return (PREPARE_REDEMPTION_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  SIGN_REDEMPTION_ERROR_CODES,
  type SignRedemptionErrorCode,
} from '@renaiss-protocol/error-codes';

export type { SignRedemptionErrorCode } from '@renaiss-protocol/error-codes';
/** Narrow signRedemption failures to its documented Result codes. */
export function isSignRedemptionError(
  error: ApiError,
): error is ApiError<SignRedemptionErrorCode> {
  return (SIGN_REDEMPTION_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  SUBMIT_REDEMPTION_ERROR_CODES,
  type SubmitRedemptionErrorCode,
} from '@renaiss-protocol/error-codes';

export type { SubmitRedemptionErrorCode } from '@renaiss-protocol/error-codes';
/** Narrow submitRedemption failures to its documented Result codes. */
export function isSubmitRedemptionError(
  error: ApiError,
): error is ApiError<SubmitRedemptionErrorCode> {
  return (SUBMIT_REDEMPTION_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  FETCH_REDEMPTION_CHECKOUT_ERROR_CODES,
  type FetchRedemptionCheckoutErrorCode,
} from '@renaiss-protocol/error-codes';

export type { FetchRedemptionCheckoutErrorCode } from '@renaiss-protocol/error-codes';
/** Narrow fetchRedemptionCheckout failures to its documented Result codes. */
export function isFetchRedemptionCheckoutError(
  error: ApiError,
): error is ApiError<FetchRedemptionCheckoutErrorCode> {
  return (FETCH_REDEMPTION_CHECKOUT_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  FETCH_REDEMPTION_ORDER_ERROR_CODES,
  type FetchRedemptionOrderErrorCode,
} from '@renaiss-protocol/error-codes';

export type { FetchRedemptionOrderErrorCode } from '@renaiss-protocol/error-codes';
/** Narrow fetchRedemptionOrder failures to its documented Result codes. */
export function isFetchRedemptionOrderError(
  error: ApiError,
): error is ApiError<FetchRedemptionOrderErrorCode> {
  return (FETCH_REDEMPTION_ORDER_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  SYNC_REDEMPTION_TRACKING_ERROR_CODES,
  type SyncRedemptionTrackingErrorCode,
} from '@renaiss-protocol/error-codes';

export type { SyncRedemptionTrackingErrorCode } from '@renaiss-protocol/error-codes';
/** Narrow syncRedemptionTracking failures to its documented Result codes. */
export function isSyncRedemptionTrackingError(
  error: ApiError,
): error is ApiError<SyncRedemptionTrackingErrorCode> {
  return (SYNC_REDEMPTION_TRACKING_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  LIST_REDEEMABLE_CARDS_ERROR_CODES,
  type ListRedeemableCardsErrorCode,
} from '@renaiss-protocol/error-codes';

export type { ListRedeemableCardsErrorCode } from '@renaiss-protocol/error-codes';
/** Narrow listRedeemableCards failures to its documented Result codes. */
export function isListRedeemableCardsError(
  error: ApiError,
): error is ApiError<ListRedeemableCardsErrorCode> {
  return (LIST_REDEEMABLE_CARDS_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}

import {
  LIST_REDEMPTION_ORDERS_ERROR_CODES,
  type ListRedemptionOrdersErrorCode,
} from '@renaiss-protocol/error-codes';

export type { ListRedemptionOrdersErrorCode } from '@renaiss-protocol/error-codes';
/** Narrow listRedemptionOrders failures to its documented Result codes. */
export function isListRedemptionOrdersError(
  error: ApiError,
): error is ApiError<ListRedemptionOrdersErrorCode> {
  return (LIST_REDEMPTION_ORDERS_ERROR_CODES as readonly string[]).includes(
    error.code,
  );
}
