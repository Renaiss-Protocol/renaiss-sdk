// Result helpers re-exported so integrators can branch on results without
// reaching into @renaiss-protocol/fp internals.

export type { ErrorCode } from '@renaiss-protocol/error-codes';
export type { ApiError, Result } from '@renaiss-protocol/fp';
export { getError, getValue, isFailed, isSuccess } from '@renaiss-protocol/fp';
export {
  type ApiKeyResponse,
  type AuthenticatedUser,
  type GachaBuybackOffer,
  type GachaMachine,
  type GachaMachineContent,
  GachaMachineSchema,
  GachaMachineStage,
  GachaMachineType,
  type GachaPullResult,
  GachaQuantity,
  GachaStreamAction,
  type GachaStreamEvent,
  GachaStreamEventStatus,
  type Permit2UsdtApproval,
  Permit2UsdtApprovalSchema,
  Permit2UsdtApprovalStatus,
  type SafeWallet,
  SafeWalletDeploymentStatus,
  type SafeWalletReadinessResult,
  SafeWalletReadinessResultSchema,
  SafeWalletReadinessStatus,
  SafeWalletSchema,
  type SubmitGachaBuybackResponse,
  type UserActivitiesResponse,
  UserActivitiesResponseSchema,
  type UserActivity,
  UserActivityFilter,
  UserActivityFilterSchema,
  type UserActivityItem,
  UserActivityItemSchema,
  UserActivitySchema,
} from '@renaiss-protocol/schema-validation';

export {
  type CreateApiKeyWithSiweRequest,
  createApiKeyWithSiwe,
  fetchAuthenticatedUser,
} from './actions/auth';
export {
  type BuybackGachaRequest,
  buybackGacha,
  type FetchGachaMachineRequest,
  fetchGachaMachine,
  type ListGachaBuybackOffersRequest,
  type ListGachaMachineContentsRequest,
  type ListGachaMachinesRequest,
  listGachaBuybackOffers,
  listGachaMachineContents,
  listGachaMachines,
  type PullGachaRequest,
  pullGacha,
} from './actions/gacha';
export {
  type ListUserActivitiesRequest,
  listUserActivities,
} from './actions/users';
export {
  approvePermit2Usdt,
  deploySafeWallet,
  ensureSafeWalletReady,
  isPermit2UsdtApproved,
  isSafeWalletDeployed,
  type Permit2UsdtApprovalResult,
  type SafeWalletDeploymentResult,
} from './actions/wallets';
export type {
  PublicClient,
  PublicClientOptions,
  SecureClient,
  SecureClientOptions,
} from './clients';
export { createPublicClient, createSecureClient } from './clients';
export type { AuthActions, SecureAuthActions } from './decorators/auth';
export type {
  PublicGachaActions,
  SecureGachaActions,
} from './decorators/gacha';
export type { SecureUserActions } from './decorators/users';
export type { SecureWalletActions } from './decorators/wallets';
export {
  type ApprovePermit2UsdtErrorCode,
  type BuybackGachaErrorCode,
  type CreateApiKeyWithSiweErrorCode,
  type DeploySafeWalletErrorCode,
  type EnsureSafeWalletReadyErrorCode,
  exhaustive,
  type FetchGachaMachineErrorCode,
  type IsPermit2UsdtApprovedErrorCode,
  type IsSafeWalletDeployedErrorCode,
  isApprovePermit2UsdtError,
  isBuybackGachaError,
  isCreateApiKeyWithSiweError,
  isDeploySafeWalletError,
  isEnsureSafeWalletReadyError,
  isFetchGachaMachineError,
  isIsPermit2UsdtApprovedError,
  isIsSafeWalletDeployedError,
  isListGachaBuybackOffersError,
  isListGachaMachineContentsError,
  isListGachaMachinesError,
  isListUserActivitiesError,
  isPullGachaError,
  isRenaissError,
  type ListGachaBuybackOffersErrorCode,
  type ListGachaMachineContentsErrorCode,
  type ListGachaMachinesErrorCode,
  type ListUserActivitiesErrorCode,
  type PullGachaErrorCode,
} from './errors';
export type { Page, Paginated, PaginationCursor } from './pagination';
export type {
  RenaissSigner,
  SafeTypedDataRequest,
  TypedDataField,
  TypedDataPayload,
} from './signers';
