import { type Result, run } from '@renaiss-protocol/fp';
import type { SafeWalletReadinessResult } from '@renaiss-protocol/schema-validation';
import {
  approvePermit2Usdt,
  deploySafeWallet,
  ensureSafeWalletReady,
  isPermit2UsdtApproved,
  isSafeWalletDeployed,
  type Permit2UsdtApprovalResult,
  type SafeWalletDeploymentResult,
} from '../actions/wallets';
import type { ServiceClient } from '../service-client';
import type { RenaissSigner } from '../signers';

export type SecureWalletActions = {
  /**
   * Checks whether the authenticated user's deterministic Safe wallet is deployed.
   *
   * @remarks
   * Returns `WRONG_REQUEST_PARAMS`, `INVALID_SCHEMA`, `SAFE_ACCOUNT_NOT_FOUND`,
   * `UNAUTHORIZED`, `FUNCTION_ERROR`, or `UNKNOWN_ERROR` as a `Result`;
   * expected failures are not thrown.
   */
  isSafeWalletDeployed(): Promise<Result<boolean>>;

  /**
   * Deploys the authenticated user's deterministic Safe wallet when needed.
   *
   * @remarks
   * Returns Safe deployment route errors, `SAFE_WALLET_SIGNING_FAILED`, or
   * `UNKNOWN_ERROR` as a `Result`; expected failures are not thrown.
   */
  deploySafeWallet(): Promise<Result<SafeWalletDeploymentResult>>;

  /**
   * Checks whether the authenticated user's Safe has Permit2 USDT approval.
   *
   * @remarks
   * Returns `WRONG_REQUEST_PARAMS`, `INVALID_SCHEMA`, `SAFE_ACCOUNT_NOT_FOUND`,
   * `UNAUTHORIZED`, `FUNCTION_ERROR`, or `UNKNOWN_ERROR` as a `Result`;
   * expected failures are not thrown.
   */
  isPermit2UsdtApproved(): Promise<Result<boolean>>;

  /**
   * Approves Permit2 USDT spending from the authenticated user's Safe.
   *
   * @remarks
   * Returns Permit2 approval route errors, `SAFE_WALLET_SIGNING_FAILED`, or
   * `UNKNOWN_ERROR` as a `Result`; expected failures are not thrown.
   */
  approvePermit2Usdt(): Promise<Result<Permit2UsdtApprovalResult>>;

  /**
   * Deploys the Safe and approves Permit2 USDT when needed.
   *
   * @remarks
   * Returns Safe deployment and Permit2 approval route errors,
   * `SAFE_WALLET_SIGNING_FAILED`, or `UNKNOWN_ERROR` as a `Result`; expected
   * failures are not thrown.
   */
  ensureSafeWalletReady(): Promise<Result<SafeWalletReadinessResult>>;
};

export function decorateSecureWallets(
  client: ServiceClient,
  signer: RenaissSigner | undefined,
): SecureWalletActions {
  return {
    approvePermit2Usdt: () => run(approvePermit2Usdt(client, signer)),
    deploySafeWallet: () => run(deploySafeWallet(client, signer)),
    ensureSafeWalletReady: () => run(ensureSafeWalletReady(client, signer)),
    isPermit2UsdtApproved: () => run(isPermit2UsdtApproved(client)),
    isSafeWalletDeployed: () => run(isSafeWalletDeployed(client)),
  };
}
