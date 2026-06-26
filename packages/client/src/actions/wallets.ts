import {
  type Action,
  Failed,
  getValue,
  isFailed,
  type Result,
  run,
  StatusCodes,
  Success,
} from '@renaiss-protocol/fp';
import {
  type ApprovePermit2UsdtResponse,
  ApprovePermit2UsdtResponseSchema,
  type DeploySafeWalletResponse,
  DeploySafeWalletResponseSchema,
  type Permit2UsdtApproval,
  Permit2UsdtApprovalStatus,
  type PreparePermit2UsdtApprovalResponse,
  PreparePermit2UsdtApprovalResponseSchema,
  type PrepareSafeWalletDeploymentResponse,
  PrepareSafeWalletDeploymentResponseSchema,
  type SafeWallet,
  SafeWalletDeploymentStatus,
  type SafeWalletReadinessResult,
  SafeWalletReadinessResultSchema,
  SafeWalletReadinessStatus,
} from '@renaiss-protocol/schema-validation';
import { validateWith } from '../response';
import type { ServiceClient } from '../service-client';
import type { RenaissSigner, TypedDataPayload } from '../signers';

export type SafeWalletDeploymentResult =
  | {
      chainId: number;
      safe: SafeWallet;
      status: SafeWalletDeploymentStatus.AlreadyDeployed;
      transactionHash: null;
      userOperationHash: null;
    }
  | DeploySafeWalletResponse;

export type Permit2UsdtApprovalResult =
  | {
      approval: Permit2UsdtApproval;
      chainId: number;
      safe: SafeWallet;
      status: Permit2UsdtApprovalStatus.AlreadyApproved;
      transactionHash: null;
      userOperationHash: null;
    }
  | ApprovePermit2UsdtResponse;

function isSigner(value: unknown): value is RenaissSigner {
  return (
    value !== null &&
    typeof value === 'object' &&
    'getAddress' in value &&
    'signMessage' in value &&
    'signTypedData' in value
  );
}

function requireSafeSigner(
  signer: RenaissSigner | undefined,
  actionName: string,
): Result<RenaissSigner> {
  if (signer === undefined) {
    return Failed(
      'WRONG_REQUEST_PARAMS',
      StatusCodes.BAD_REQUEST,
      `${actionName} requires a signer configured on the secure client`,
      { signerConfigured: false },
    );
  }

  if (!isSigner(signer)) {
    return Failed(
      'WRONG_REQUEST_PARAMS',
      StatusCodes.BAD_REQUEST,
      `${actionName} requires a valid signer configured on the secure client`,
      signer,
    );
  }

  return Success(signer);
}

function toSafeOpTypedDataPayload(value: unknown): TypedDataPayload {
  const typedData = value as TypedDataPayload;
  const message = typedData.message;

  return {
    domain: typedData.domain,
    types: typedData.types,
    primaryType: typedData.primaryType,
    message: {
      ...message,
      nonce: BigInt(String(message.nonce)),
      maxFeePerGas: BigInt(String(message.maxFeePerGas)),
      maxPriorityFeePerGas: BigInt(String(message.maxPriorityFeePerGas)),
      preVerificationGas: BigInt(String(message.preVerificationGas)),
      verificationGasLimit: BigInt(String(message.verificationGasLimit)),
      callGasLimit: BigInt(String(message.callGasLimit)),
      validAfter: BigInt(String(message.validAfter)),
      validUntil: BigInt(String(message.validUntil)),
    },
  };
}

function invalidSchema(detail: string, error: unknown) {
  return Failed('INVALID_SCHEMA', StatusCodes.BAD_REQUEST, detail, error);
}

async function prepareSafeWalletDeployment(
  client: ServiceClient,
): Promise<Result<PrepareSafeWalletDeploymentResponse>> {
  const response = await run(
    client.post('/v0/wallets/safe-deployment/prepare'),
  );
  if (isFailed(response)) return response;

  return run(
    validateWith(PrepareSafeWalletDeploymentResponseSchema)(getValue(response)),
  );
}

async function preparePermit2UsdtApproval(
  client: ServiceClient,
): Promise<Result<PreparePermit2UsdtApprovalResponse>> {
  const response = await run(
    client.post('/v0/wallets/permit2/usdt-approval/prepare'),
  );
  if (isFailed(response)) return response;

  return run(
    validateWith(PreparePermit2UsdtApprovalResponseSchema)(getValue(response)),
  );
}

/** Checks whether the authenticated user's deterministic Safe is deployed. */
export function isSafeWalletDeployed(client: ServiceClient): Action<boolean> {
  return async () => {
    const preparedResult = await prepareSafeWalletDeployment(client);
    if (isFailed(preparedResult)) return preparedResult;

    return Success(
      getValue(preparedResult).status ===
        SafeWalletDeploymentStatus.AlreadyDeployed,
    );
  };
}

/** Deploys the authenticated user's deterministic Safe when needed. */
export function deploySafeWallet(
  client: ServiceClient,
  signer: RenaissSigner | undefined,
): Action<SafeWalletDeploymentResult> {
  return async () => {
    const preparedResult = await prepareSafeWalletDeployment(client);
    if (isFailed(preparedResult)) return preparedResult;

    const prepared = getValue(preparedResult);
    if (prepared.status === SafeWalletDeploymentStatus.AlreadyDeployed) {
      return Success({
        chainId: prepared.chainId,
        safe: prepared.safe,
        status: SafeWalletDeploymentStatus.AlreadyDeployed,
        transactionHash: null,
        userOperationHash: null,
      });
    }

    if (
      prepared.safeOpTypedData === null ||
      prepared.sponsoredUserOperation === null
    ) {
      return invalidSchema(
        'Safe deployment requires typed data and a sponsored UserOperation',
        prepared,
      );
    }

    const signerResult = requireSafeSigner(signer, 'deploySafeWallet');
    if (isFailed(signerResult)) return signerResult;

    let ownerSignature: string;
    try {
      ownerSignature = await getValue(signerResult).signTypedData(
        toSafeOpTypedDataPayload(prepared.safeOpTypedData),
      );
    } catch (error) {
      return Failed(
        'SAFE_WALLET_SIGNING_FAILED',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to sign Safe wallet deployment',
        error,
      );
    }

    const deployedResult = await run(
      client.post('/v0/wallets/safe-deployment', {
        body: {
          ownerSignature,
          sponsoredUserOperation: prepared.sponsoredUserOperation,
        },
      }),
    );
    if (isFailed(deployedResult)) return deployedResult;

    return run(
      validateWith(DeploySafeWalletResponseSchema)(getValue(deployedResult)),
    );
  };
}

/** Checks whether the authenticated user's Safe has Permit2 USDT approval. */
export function isPermit2UsdtApproved(client: ServiceClient): Action<boolean> {
  return async () => {
    const preparedResult = await preparePermit2UsdtApproval(client);
    if (isFailed(preparedResult)) return preparedResult;

    return Success(
      getValue(preparedResult).status ===
        Permit2UsdtApprovalStatus.AlreadyApproved,
    );
  };
}

/** Approves Permit2 USDT spending from the authenticated user's Safe. */
export function approvePermit2Usdt(
  client: ServiceClient,
  signer: RenaissSigner | undefined,
): Action<Permit2UsdtApprovalResult> {
  return async () => {
    const preparedResult = await preparePermit2UsdtApproval(client);
    if (isFailed(preparedResult)) return preparedResult;

    const prepared = getValue(preparedResult);
    if (prepared.status === Permit2UsdtApprovalStatus.AlreadyApproved) {
      return Success({
        approval: prepared.approval,
        chainId: prepared.chainId,
        safe: {
          ownerWalletAddress: prepared.safe.ownerWalletAddress,
          safeWalletAddress: prepared.safe.safeWalletAddress,
        },
        status: Permit2UsdtApprovalStatus.AlreadyApproved,
        transactionHash: null,
        userOperationHash: null,
      });
    }

    if (
      prepared.safeOpTypedData === null ||
      prepared.sponsoredUserOperation === null
    ) {
      return invalidSchema(
        'Permit2 USDT approval requires typed data and a sponsored UserOperation',
        prepared,
      );
    }

    const signerResult = requireSafeSigner(signer, 'approvePermit2Usdt');
    if (isFailed(signerResult)) return signerResult;

    let ownerSignature: string;
    try {
      ownerSignature = await getValue(signerResult).signTypedData(
        toSafeOpTypedDataPayload(prepared.safeOpTypedData),
      );
    } catch (error) {
      return Failed(
        'SAFE_WALLET_SIGNING_FAILED',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to sign Permit2 USDT approval',
        error,
      );
    }

    const approvedResult = await run(
      client.post('/v0/wallets/permit2/usdt-approval', {
        body: {
          ownerSignature,
          sponsoredUserOperation: prepared.sponsoredUserOperation,
        },
      }),
    );
    if (isFailed(approvedResult)) return approvedResult;

    return run(
      validateWith(ApprovePermit2UsdtResponseSchema)(getValue(approvedResult)),
    );
  };
}

/** Deploys the authenticated user's Safe and approves Permit2 USDT when needed. */
export function ensureSafeWalletReady(
  client: ServiceClient,
  signer: RenaissSigner | undefined,
): Action<SafeWalletReadinessResult> {
  return async () => {
    const deploymentResult = await run(deploySafeWallet(client, signer));
    if (isFailed(deploymentResult)) return deploymentResult;

    const approvalResult = await run(approvePermit2Usdt(client, signer));
    if (isFailed(approvalResult)) return approvalResult;

    const deployment = getValue(deploymentResult);
    const approval = getValue(approvalResult);

    return run(
      validateWith(SafeWalletReadinessResultSchema)({
        status: SafeWalletReadinessStatus.Ready,
        safe: approval.safe,
        deployment: {
          status: deployment.status,
          transactionHash: deployment.transactionHash,
          userOperationHash: deployment.userOperationHash,
        },
        permit2UsdtApproval: {
          status: approval.status,
          approval: approval.approval,
          transactionHash: approval.transactionHash,
          userOperationHash: approval.userOperationHash,
        },
      }),
    );
  };
}
