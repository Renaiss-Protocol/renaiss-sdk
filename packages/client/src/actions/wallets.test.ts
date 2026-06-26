import {
  type ApiError,
  getError,
  getValue,
  isFailed,
  isSuccess,
  type Result,
} from '@renaiss-protocol/fp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSecureClient } from '../clients';
import type { RenaissSigner, TypedDataPayload } from '../signers';

const OWNER_ADDRESS = '0x1111111111111111111111111111111111111111';
const SAFE_ADDRESS = '0x2222222222222222222222222222222222222222';
const ENTRY_POINT_ADDRESS = '0x3333333333333333333333333333333333333333';
const VERIFYING_CONTRACT = '0x4444444444444444444444444444444444444444';
const USDT_ADDRESS = '0x5555555555555555555555555555555555555555';
const PERMIT2_ADDRESS = '0x6666666666666666666666666666666666666666';
const TX_HASH = `0x${'ab'.repeat(32)}`;
const USER_OPERATION_HASH = `0x${'bc'.repeat(32)}`;
const SIGNATURE = `0x${'cd'.repeat(65)}`;

type FetchCall = {
  body: unknown;
  pathname: string;
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...Object.fromEntries(new Headers(init.headers).entries()),
    },
  });
}

function readCall(input: RequestInfo | URL, init?: RequestInit): FetchCall {
  const url = new URL(String(input));

  return {
    body:
      typeof init?.body === 'string'
        ? (JSON.parse(init.body) as unknown)
        : undefined,
    pathname: url.pathname,
  };
}

function signer(overrides: Partial<RenaissSigner> = {}): RenaissSigner {
  return {
    getAddress: vi.fn(async () => OWNER_ADDRESS),
    signMessage: vi.fn(async () => SIGNATURE),
    signTypedData: vi.fn(async () => SIGNATURE),
    ...overrides,
  };
}

function expectSuccessResult<T>(result: Result<T>): T {
  expect(isSuccess(result)).toBe(true);
  if (isFailed(result)) {
    throw new Error(`Expected success, got ${result.left.code}`);
  }

  return getValue(result);
}

function expectFailedResult<T>(result: Result<T>): ApiError {
  expect(isFailed(result)).toBe(true);
  if (isSuccess(result)) {
    throw new Error('Expected failure, got success');
  }

  return getError(result);
}

function sponsoredUserOperation() {
  return {
    sender: SAFE_ADDRESS,
    nonce: '1',
    factory: VERIFYING_CONTRACT,
    factoryData: '0x1234',
    callData: '0xabcd',
    callGasLimit: '100000',
    verificationGasLimit: '200000',
    preVerificationGas: '30000',
    maxFeePerGas: '1000',
    maxPriorityFeePerGas: '100',
    paymaster: ENTRY_POINT_ADDRESS,
    paymasterVerificationGasLimit: '40000',
    paymasterPostOpGasLimit: '50000',
    paymasterData: '0x5678',
    signature: '0x',
  };
}

function safeOpTypedData() {
  return {
    domain: {
      chainId: 56,
      verifyingContract: VERIFYING_CONTRACT,
    },
    types: {
      SafeOp: [
        { name: 'safe', type: 'address' },
        { name: 'callData', type: 'bytes' },
      ],
    },
    primaryType: 'SafeOp',
    message: {
      safe: SAFE_ADDRESS,
      callData: '0xabcd',
      nonce: '1',
      initCode: '0x',
      maxFeePerGas: '1000',
      maxPriorityFeePerGas: '100',
      preVerificationGas: '30000',
      verificationGasLimit: '200000',
      callGasLimit: '100000',
      paymasterAndData: '0x',
      validAfter: 0,
      validUntil: 9999999999,
      entryPoint: ENTRY_POINT_ADDRESS,
    },
  };
}

function approval() {
  return {
    tokenAddress: USDT_ADDRESS,
    spenderAddress: PERMIT2_ADDRESS,
    approvalAmount: '1000000000000',
    currentAllowance: '0',
  };
}

function safe() {
  return {
    ownerWalletAddress: OWNER_ADDRESS,
    safeWalletAddress: SAFE_ADDRESS,
  };
}

describe('wallet actions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('checks Safe deployment status from prepare', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        chainId: 56,
        status: 'needs_signature',
        safe: safe(),
        sponsoredUserOperation: sponsoredUserOperation(),
        safeOpTypedData: safeOpTypedData(),
      }),
    );

    const client = createSecureClient({ apiKey: 'api-key' });
    const result = await client.isSafeWalletDeployed();
    const value = expectSuccessResult(result);

    expect(value).toBe(false);
  });

  it('skips Safe deployment signing when already deployed', async () => {
    const signTypedData = vi.fn(
      async (_request: TypedDataPayload) => SIGNATURE,
    );
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        chainId: 56,
        status: 'already_deployed',
        safe: safe(),
        sponsoredUserOperation: null,
        safeOpTypedData: null,
      }),
    );

    const client = createSecureClient({
      apiKey: 'api-key',
      signer: signer({ signTypedData }),
    });
    const result = await client.deploySafeWallet();
    const value = expectSuccessResult(result);

    expect(value.status).toBe('already_deployed');
    expect(value.transactionHash).toBeNull();
    expect(signTypedData).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('signs and submits Safe deployment when needed', async () => {
    const calls: FetchCall[] = [];
    const signTypedData = vi.fn(
      async (_request: TypedDataPayload) => SIGNATURE,
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input, init): Promise<Response> => {
        const call = readCall(input, init);
        calls.push(call);

        if (call.pathname === '/v0/wallets/safe-deployment/prepare') {
          return jsonResponse({
            chainId: 56,
            status: 'needs_signature',
            safe: safe(),
            sponsoredUserOperation: sponsoredUserOperation(),
            safeOpTypedData: safeOpTypedData(),
          });
        }

        if (call.pathname === '/v0/wallets/safe-deployment') {
          return jsonResponse({
            chainId: 56,
            status: 'deployed',
            safe: safe(),
            userOperationHash: USER_OPERATION_HASH,
            transactionHash: TX_HASH,
          });
        }

        return jsonResponse({
          error: 'unexpected path',
          code: 'UNKNOWN_ERROR',
        });
      },
    );

    const client = createSecureClient({
      apiKey: 'api-key',
      signer: signer({ signTypedData }),
    });
    const result = await client.deploySafeWallet();
    const value = expectSuccessResult(result);

    expect(value.status).toBe('deployed');
    expect(signTypedData).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          nonce: 1n,
          safe: SAFE_ADDRESS,
        }),
        primaryType: 'SafeOp',
      }),
    );
    expect(calls[1]?.body).toEqual({
      ownerSignature: SIGNATURE,
      sponsoredUserOperation: sponsoredUserOperation(),
    });
  });

  it('checks Permit2 USDT approval status from prepare', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        chainId: 56,
        status: 'already_approved',
        safe: {
          ...safe(),
          deploymentStatus: 'already_deployed',
          deploymentTxHash: null,
        },
        approval: approval(),
        sponsoredUserOperation: null,
        safeOpTypedData: null,
      }),
    );

    const client = createSecureClient({ apiKey: 'api-key' });
    const result = await client.isPermit2UsdtApproved();
    const value = expectSuccessResult(result);

    expect(value).toBe(true);
  });

  it('signs and submits Permit2 USDT approval when needed', async () => {
    const calls: FetchCall[] = [];
    const signTypedData = vi.fn(
      async (_request: TypedDataPayload) => SIGNATURE,
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input, init): Promise<Response> => {
        const call = readCall(input, init);
        calls.push(call);

        if (call.pathname === '/v0/wallets/permit2/usdt-approval/prepare') {
          return jsonResponse({
            chainId: 56,
            status: 'needs_signature',
            safe: {
              ...safe(),
              deploymentStatus: 'already_deployed',
              deploymentTxHash: null,
            },
            approval: approval(),
            sponsoredUserOperation: sponsoredUserOperation(),
            safeOpTypedData: safeOpTypedData(),
          });
        }

        if (call.pathname === '/v0/wallets/permit2/usdt-approval') {
          return jsonResponse({
            chainId: 56,
            status: 'submitted',
            safe: safe(),
            approval: approval(),
            userOperationHash: USER_OPERATION_HASH,
            transactionHash: TX_HASH,
          });
        }

        return jsonResponse({
          error: 'unexpected path',
          code: 'UNKNOWN_ERROR',
        });
      },
    );

    const client = createSecureClient({
      apiKey: 'api-key',
      signer: signer({ signTypedData }),
    });
    const result = await client.approvePermit2Usdt();
    const value = expectSuccessResult(result);

    expect(value.status).toBe('submitted');
    expect(signTypedData).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          nonce: 1n,
          safe: SAFE_ADDRESS,
        }),
        primaryType: 'SafeOp',
      }),
    );
    expect(calls[1]?.body).toEqual({
      ownerSignature: SIGNATURE,
      sponsoredUserOperation: sponsoredUserOperation(),
    });
  });

  it('ensures Safe readiness by deploying then approving Permit2 USDT', async () => {
    const paths: string[] = [];
    const signTypedData = vi.fn(
      async (_request: TypedDataPayload) => SIGNATURE,
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input, init): Promise<Response> => {
        const call = readCall(input, init);
        paths.push(call.pathname);

        if (call.pathname === '/v0/wallets/safe-deployment/prepare') {
          return jsonResponse({
            chainId: 56,
            status: 'already_deployed',
            safe: safe(),
            sponsoredUserOperation: null,
            safeOpTypedData: null,
          });
        }

        if (call.pathname === '/v0/wallets/permit2/usdt-approval/prepare') {
          return jsonResponse({
            chainId: 56,
            status: 'already_approved',
            safe: {
              ...safe(),
              deploymentStatus: 'already_deployed',
              deploymentTxHash: null,
            },
            approval: approval(),
            sponsoredUserOperation: null,
            safeOpTypedData: null,
          });
        }

        return jsonResponse({
          error: 'unexpected path',
          code: 'UNKNOWN_ERROR',
        });
      },
    );

    const client = createSecureClient({
      apiKey: 'api-key',
      signer: signer({ signTypedData }),
    });
    const result = await client.ensureSafeWalletReady();
    const value = expectSuccessResult(result);

    expect(paths).toEqual([
      '/v0/wallets/safe-deployment/prepare',
      '/v0/wallets/permit2/usdt-approval/prepare',
    ]);
    expect(value.status).toBe('ready');
    expect(value.deployment.status).toBe('already_deployed');
    expect(value.permit2UsdtApproval.status).toBe('already_approved');
  });

  it('rejects missing signers before submitting setup', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        chainId: 56,
        status: 'needs_signature',
        safe: safe(),
        sponsoredUserOperation: sponsoredUserOperation(),
        safeOpTypedData: safeOpTypedData(),
      }),
    );

    const client = createSecureClient({ apiKey: 'api-key' });
    const result = await client.deploySafeWallet();
    const error = expectFailedResult(result);

    expect(error.code).toBe('WRONG_REQUEST_PARAMS');
  });

  it('returns signing failures as wallet setup failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        chainId: 56,
        status: 'needs_signature',
        safe: safe(),
        sponsoredUserOperation: sponsoredUserOperation(),
        safeOpTypedData: safeOpTypedData(),
      }),
    );

    const client = createSecureClient({
      apiKey: 'api-key',
      signer: signer({
        signTypedData: vi.fn(async () => {
          throw new Error('user rejected');
        }),
      }),
    });
    const result = await client.deploySafeWallet();
    const error = expectFailedResult(result);

    expect(error.code).toBe('SAFE_WALLET_SIGNING_FAILED');
  });

  it('rejects missing typed data for needed setup signatures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        chainId: 56,
        status: 'needs_signature',
        safe: safe(),
        sponsoredUserOperation: null,
        safeOpTypedData: null,
      }),
    );

    const client = createSecureClient({
      apiKey: 'api-key',
      signer: signer({ signTypedData: vi.fn(async () => SIGNATURE) }),
    });
    const result = await client.deploySafeWallet();
    const error = expectFailedResult(result);

    expect(error.code).toBe('INVALID_SCHEMA');
  });
});
