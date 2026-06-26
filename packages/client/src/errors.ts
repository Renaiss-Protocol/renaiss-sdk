import {
  APPROVE_PERMIT2_USDT_ERROR_CODES,
  type ApprovePermit2UsdtErrorCode,
  BUYBACK_GACHA_ERROR_CODES,
  type BuybackGachaErrorCode,
  CREATE_API_KEY_WITH_SIWE_ERROR_CODES,
  type CreateApiKeyWithSiweErrorCode,
  DEPLOY_SAFE_WALLET_ERROR_CODES,
  type DeploySafeWalletErrorCode,
  ENSURE_SAFE_WALLET_READY_ERROR_CODES,
  type EnsureSafeWalletReadyErrorCode,
  type ErrorCode,
  FETCH_GACHA_MACHINE_ERROR_CODES,
  type FetchGachaMachineErrorCode,
  IS_PERMIT2_USDT_APPROVED_ERROR_CODES,
  IS_SAFE_WALLET_DEPLOYED_ERROR_CODES,
  type IsPermit2UsdtApprovedErrorCode,
  type IsSafeWalletDeployedErrorCode,
  LIST_GACHA_BUYBACK_OFFERS_ERROR_CODES,
  LIST_GACHA_MACHINE_CONTENTS_ERROR_CODES,
  LIST_GACHA_MACHINES_ERROR_CODES,
  LIST_USER_ACTIVITIES_ERROR_CODES,
  type ListGachaBuybackOffersErrorCode,
  type ListGachaMachineContentsErrorCode,
  type ListGachaMachinesErrorCode,
  type ListUserActivitiesErrorCode,
  PULL_GACHA_ERROR_CODES,
  type PullGachaErrorCode,
} from '@renaiss-protocol/error-codes';
import type { ApiError } from '@renaiss-protocol/fp';

export type {
  ApprovePermit2UsdtErrorCode,
  BuybackGachaErrorCode,
  CreateApiKeyWithSiweErrorCode,
  DeploySafeWalletErrorCode,
  EnsureSafeWalletReadyErrorCode,
  FetchGachaMachineErrorCode,
  IsPermit2UsdtApprovedErrorCode,
  IsSafeWalletDeployedErrorCode,
  ListGachaBuybackOffersErrorCode,
  ListGachaMachineContentsErrorCode,
  ListGachaMachinesErrorCode,
  ListUserActivitiesErrorCode,
  PullGachaErrorCode,
};

export function exhaustive(value: never): never {
  throw new Error(`Unhandled case: ${String(value)}`);
}

export function isRenaissError(value: unknown): value is ApiError {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.code === 'string' &&
    typeof record.status === 'number' &&
    typeof record.detail === 'string'
  );
}

function hasActionCode<Code extends ErrorCode>(
  value: unknown,
  codes: readonly Code[],
): value is ApiError<Code> {
  return isRenaissError(value) && codes.includes(value.code as Code);
}

export function isCreateApiKeyWithSiweError(
  value: unknown,
): value is ApiError<CreateApiKeyWithSiweErrorCode> {
  return hasActionCode(value, CREATE_API_KEY_WITH_SIWE_ERROR_CODES);
}

export function isListUserActivitiesError(
  value: unknown,
): value is ApiError<ListUserActivitiesErrorCode> {
  return hasActionCode(value, LIST_USER_ACTIVITIES_ERROR_CODES);
}

export function isListGachaMachinesError(
  value: unknown,
): value is ApiError<ListGachaMachinesErrorCode> {
  return hasActionCode(value, LIST_GACHA_MACHINES_ERROR_CODES);
}

export function isFetchGachaMachineError(
  value: unknown,
): value is ApiError<FetchGachaMachineErrorCode> {
  return hasActionCode(value, FETCH_GACHA_MACHINE_ERROR_CODES);
}

export function isListGachaMachineContentsError(
  value: unknown,
): value is ApiError<ListGachaMachineContentsErrorCode> {
  return hasActionCode(value, LIST_GACHA_MACHINE_CONTENTS_ERROR_CODES);
}

export function isPullGachaError(
  value: unknown,
): value is ApiError<PullGachaErrorCode> {
  return hasActionCode(value, PULL_GACHA_ERROR_CODES);
}

export function isListGachaBuybackOffersError(
  value: unknown,
): value is ApiError<ListGachaBuybackOffersErrorCode> {
  return hasActionCode(value, LIST_GACHA_BUYBACK_OFFERS_ERROR_CODES);
}

export function isBuybackGachaError(
  value: unknown,
): value is ApiError<BuybackGachaErrorCode> {
  return hasActionCode(value, BUYBACK_GACHA_ERROR_CODES);
}

export function isIsSafeWalletDeployedError(
  value: unknown,
): value is ApiError<IsSafeWalletDeployedErrorCode> {
  return hasActionCode(value, IS_SAFE_WALLET_DEPLOYED_ERROR_CODES);
}

export function isDeploySafeWalletError(
  value: unknown,
): value is ApiError<DeploySafeWalletErrorCode> {
  return hasActionCode(value, DEPLOY_SAFE_WALLET_ERROR_CODES);
}

export function isIsPermit2UsdtApprovedError(
  value: unknown,
): value is ApiError<IsPermit2UsdtApprovedErrorCode> {
  return hasActionCode(value, IS_PERMIT2_USDT_APPROVED_ERROR_CODES);
}

export function isApprovePermit2UsdtError(
  value: unknown,
): value is ApiError<ApprovePermit2UsdtErrorCode> {
  return hasActionCode(value, APPROVE_PERMIT2_USDT_ERROR_CODES);
}

export function isEnsureSafeWalletReadyError(
  value: unknown,
): value is ApiError<EnsureSafeWalletReadyErrorCode> {
  return hasActionCode(value, ENSURE_SAFE_WALLET_READY_ERROR_CODES);
}
