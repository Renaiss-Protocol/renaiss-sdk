import { BNB_TESTNET, type RenaissNetwork } from './networks-v2';

export * from './networks-v2';

import { decorateEoaGacha, type EoaGachaActions } from './decorators/gacha-v2';
import { ServiceClient } from './service-client';
import type { RenaissSigner } from './signers';

export {
  type ApiError,
  getError,
  getValue,
  isFailed,
  isSuccess,
  type Result,
} from '@renaiss-protocol/fp';
export {
  type EoaActivity,
  EoaActivityFilter,
  EoaActivityType,
  type EoaBuybackOffer,
  type EoaBuybackTier,
  type EoaCollectionCard,
  EoaCollectionCardStatus,
  EoaCollectionSort,
  type EoaCollectionSummary,
  type EoaDrawnCollectible,
  type EoaDrawStatus,
  type EoaMachine,
  type EoaMachineContent,
  type EoaMachineDetail,
  type EoaMachineTier,
  type EoaPreparedPull,
  type EoaPull,
  type EoaResolvedPull,
  type EoaSignedBuyback,
  type EoaSignedPull,
  EoaSortOrder,
  type EoaStreamEvent,
  GachaMachineStage,
  GachaMachineTierName,
  type GachaPullHistoryEntry,
  getEoaBuybackOfferEndsAt,
  getEoaBuybackTierAt,
  MAX_GACHA_PULL_QUANTITY,
  type SubmitGachaBuybackResponse,
} from '@renaiss-protocol/schema-validation';
export type {
  EoaCreateBuybackRequest,
  EoaDrawStatusRequest,
  EoaGachaActions,
  EoaListMachinesRequest,
  EoaMachineContentsRequest,
  EoaMachinePageRequest,
  EoaMachineRequest,
  EoaPreparePullRequest,
  EoaPullExpectation,
  EoaSignPullRequest,
  EoaSubmitBuybackRequest,
  EoaSubmitPullRequest,
  EoaWalletActivitiesRequest,
  EoaWalletAddressRequest,
  EoaWalletCollectionRequest,
  EoaWalletPageRequest,
  EoaWalletRequest,
} from './decorators/gacha-v2';
export type { Page, Paginated, PaginationCursor } from './pagination';
export type { RenaissSigner, TypedDataPayload } from './signers';
export * from './v2-errors';

export type GachaClientOptions = {
  /** Signing contracts. Defaults to BNB_TESTNET. */
  network?: RenaissNetwork;
  /** Explicit API origin or backend proxy for the selected network. The SDK has no built-in API host. */
  baseUrl: string;
  /** Server secret. Omit in browsers and use your own backend proxy. */
  builderApiKey?: string;
  signer?: RenaissSigner;
  /** Additional chain constraint; the selected network contracts are always checked. */
  expectedChainId?: number;
};
export type GachaClient = EoaGachaActions;
/**
 * EOA client for /v2/gacha, without Renaiss user/Safe onboarding.
 * The constructor performs no I/O. Actions return Result values with the
 * documented action-specific error codes; expected failures are not thrown.
 * Wallet approval and chain switching remain with your wallet library.
 * Builder attribution comes from the server key, never a caller-supplied code.
 *
 * @example
 * const network = BNB_TESTNET; // Use BNB_MAINNET with a mainnet API.
 * const client = createGachaClient({ baseUrl: '/api/renaiss', signer, network });
 * const prepared = await client.prepareGachaPull({ machineSlug, buyerWalletAddress, expectedPriceInUsdt: reviewedPrice });
 */
export function createGachaClient(options: GachaClientOptions): GachaClient {
  const network = options.network ?? BNB_TESTNET;
  const baseUrl = options.baseUrl;
  const service = new ServiceClient({
    baseUrl,
    builderApiKey: options.builderApiKey,
  });
  return decorateEoaGacha({
    network,
    service,
    builderAuth: options.builderApiKey !== undefined,
    signer: options.signer,
    expectedChainId: options.expectedChainId ?? network.chainId,
  });
}

import {
  decorateEoaMarketplace,
  type EoaMarketplaceActions,
} from './decorators/marketplace-v2';

export {
  type AcceptBidQuote,
  type AskQuote,
  type BidQuote,
  type CardAttribute,
  type CardDetailV2 as CardDetail,
  type CardOrdersV2 as CardOrders,
  type CardOwner,
  CollectibleType,
  type MarketplaceCancellationV2 as MarketplaceCancellation,
  MarketplaceCardCategory,
  type MarketplaceCardV2 as MarketplaceCard,
  type MarketplaceOrder,
  type MarketplaceOrderResult,
  MarketplaceOrderStatus,
  MarketplaceOrderType,
  MarketplaceSortOrder,
  type Price,
  PriceToken,
} from '@renaiss-protocol/schema-validation';
export type {
  AcceptBidResult,
  BuyCardResult,
  CreateAskResult,
  CreateBidResult,
} from './actions/marketplace-v2';
export type {
  EoaAcceptBidRequest,
  EoaBuyCardRequest,
  EoaCancelOrderRequest,
  EoaCreateAskRequest,
  EoaCreateBidRequest,
  EoaMarketplaceActions,
  ListMarketplaceCardsV2Request,
  MarketplaceCardV2Request,
} from './decorators/marketplace-v2';
export {
  MarketplaceGradingCompany,
  MarketplaceLanguage,
  MarketplacePriceRange,
  MarketplaceV2Sort,
} from './decorators/marketplace-v2';
export type MarketplaceClientOptions = {
  /** Versioned deployment constants. Defaults to BNB_TESTNET (chain 97). */
  network?: RenaissNetwork;
  /** Explicit API origin or backend proxy. Pair it with the same network; testnet has no implicit service hostname. */
  baseUrl: string;
  /** Server-only secret; use a backend proxy from the browser. */
  builderApiKey?: string;
  /** Direct EOA signing only. */
  signer?: RenaissSigner;
  expectedChainId?: number;
};
export type MarketplaceClient = EoaMarketplaceActions;
/**
 * EOA-only marketplace client for /v2/marketplace. Browsing is anonymous;
 * writes require the builder backend plus the EOA's action signature.
 * Construction does no I/O. Actions return Result values; see each method's
 * error codes. No user creation or Safe setup occurs.
 */
export function createMarketplaceClient(
  options: MarketplaceClientOptions,
): MarketplaceClient {
  const network = options.network ?? BNB_TESTNET;
  const baseUrl = options.baseUrl;
  const service = new ServiceClient({
    baseUrl,
    builderApiKey: options.builderApiKey,
  });
  return decorateEoaMarketplace({
    service,
    config: network.marketplace,
    builderAuth: options.builderApiKey !== undefined,
    signer: options.signer,
    expectedChainId: options.expectedChainId ?? network.chainId,
  });
}

import {
  decorateRedemption,
  type RedemptionActions,
} from './decorators/redeem-v2';

export type {
  PreparedRedemption,
  RedeemableCard,
  RedemptionAddress,
  RedemptionAddressValidation,
  RedemptionCheckout,
  RedemptionCourier,
  RedemptionFees,
  RedemptionOrder,
  RedemptionOrderFees,
  RedemptionOrderSummary,
  RedemptionQuote,
  RedemptionRecipient,
  RedemptionRegions,
  RedemptionWalletSession,
  SignedRedemption,
} from '@renaiss-protocol/schema-validation';
export type {
  FetchRedemptionQuoteRequest,
  ListRedeemableCardsRequest,
  ListRedemptionOrdersRequest,
  PrepareRedemptionRequest,
  RedemptionActions,
  RedemptionCheckoutRequest,
  RedemptionExpectation,
  RedemptionOrderRequest,
  SignInRedemptionWalletRequest,
  SignRedemptionRequest,
  SubmitRedemptionRequest,
  ValidateRedemptionAddressRequest,
} from './decorators/redeem-v2';
export {
  RedemptionCardSort,
  RedemptionSortOrder,
} from './decorators/redeem-v2';
export type RedemptionClientOptions = MarketplaceClientOptions & {
  /** The /v2/auth/wallet URL that issues wallet access tokens, separate from the
   * partner frontend origin. Defaults to the absolute baseUrl origin +
   * /v2/auth/wallet. Required for relative proxies or aliases whose canonical
   * API issuer differs from their request URL. */
  walletSessionIssuer?: string;
};
function defaultWalletSessionIssuer(baseUrl: string): string | undefined {
  try {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    return new URL('/v2/auth/wallet', url).href;
  } catch {
    return undefined;
  }
}
export type RedemptionClient = RedemptionActions;
/** EOA redemption, with an in-memory wallet access token for private Redeem requests.
 * Builder secrets stay server-side. Call signInRedemptionWallet before private
 * actions. Approvals stay in the wallet adapter; submit is never retried
 * automatically. */
export function createRedemptionClient(
  options: RedemptionClientOptions,
): RedemptionClient {
  const network = options.network ?? BNB_TESTNET;
  const baseUrl = options.baseUrl;
  return decorateRedemption({
    config: network.redemption,
    walletSessionIssuer:
      options.walletSessionIssuer ?? defaultWalletSessionIssuer(baseUrl),
    service: new ServiceClient({
      baseUrl,
      builderApiKey: options.builderApiKey,
    }),
    builderAuth: options.builderApiKey !== undefined,
    signer: options.signer,
    expectedChainId: options.expectedChainId ?? network.chainId,
    generation: 0,
  });
}
