import {
  type ApiError,
  getError,
  getValue,
  isFailed,
  isSuccess,
  type Result,
} from '@renaiss-protocol/fp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPublicClient, createSecureClient } from '../clients';
import type { RenaissSigner } from '../signers';

const OWNER_ADDRESS = '0x1111111111111111111111111111111111111111';
const SAFE_ADDRESS = '0x2222222222222222222222222222222222222222';
const SIGNATURE = `0x${'aa'.repeat(65)}`;

type FetchCall = {
  body: unknown;
  headers: Headers;
  method: string | undefined;
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
    headers: new Headers(init?.headers),
    method: init?.method,
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

describe('createApiKeyWithSiwe', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('verifies SIWE and creates an API key with the bearer session', async () => {
    const calls: FetchCall[] = [];
    const testSigner = signer();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const call = readCall(input, init);
        calls.push(call);

        if (call.pathname === '/v0/config/contract-addresses') {
          return jsonResponse({
            chainId: 56,
            contractAddresses: {
              nftAddress: OWNER_ADDRESS,
              usdtAddress: OWNER_ADDRESS,
            },
          });
        }

        if (call.pathname === '/api/auth/siwe/nonce') {
          return jsonResponse({ nonce: 'nonce-1' });
        }

        if (call.pathname === '/api/auth/siwe/verify') {
          return jsonResponse(
            {},
            { headers: { 'set-auth-token': 'session-token' } },
          );
        }

        if (call.pathname === '/api/auth/api-key/create') {
          expect(call.headers.get('authorization')).toBe(
            'Bearer session-token',
          );

          return jsonResponse({
            id: 'key-id',
            createdAt: '2026-06-23T00:00:00.000Z',
            updatedAt: '2026-06-23T00:00:00.000Z',
            name: 'sdk',
            prefix: 'ren',
            key: 'ren_secret',
            enabled: true,
            referenceId: 'user-id',
            rateLimitEnabled: true,
            requestCount: 0,
          });
        }

        return jsonResponse(
          { error: 'not found', code: 'UNKNOWN_ERROR' },
          {
            status: 404,
          },
        );
      }),
    );

    const client = createPublicClient({ baseUrl: 'https://api.test' });
    const result = await client.createApiKeyWithSiwe({
      name: 'sdk',
      prefix: 'ren',
      signer: testSigner,
    });

    expect(expectSuccessResult(result).key).toBe('ren_secret');
    expect(calls.map((call) => call.pathname)).toEqual([
      '/v0/config/contract-addresses',
      '/api/auth/siwe/nonce',
      '/api/auth/siwe/verify',
      '/api/auth/api-key/create',
    ]);
    expect(calls[1]?.body).toEqual({
      chainId: 56,
      walletAddress: OWNER_ADDRESS,
    });
    expect(testSigner.signMessage).toHaveBeenCalledWith(
      expect.stringContaining('Nonce: nonce-1'),
    );
  });

  it('returns an auth failure when SIWE verify does not return a token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const { pathname } = new URL(String(input));

        if (pathname === '/api/auth/siwe/nonce') {
          return jsonResponse({ nonce: 'nonce-1' });
        }

        return jsonResponse({});
      }),
    );

    const client = createPublicClient({ baseUrl: 'https://api.test' });
    const result = await client.createApiKeyWithSiwe({
      chainId: 56,
      signer: signer(),
    });

    expect(expectFailedResult(result).code).toBe('GACHA_AUTH_FAILED');
  });
});

describe('fetchAuthenticatedUser', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the authenticated user wallets', async () => {
    const calls: FetchCall[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const call = readCall(input, init);
        calls.push(call);

        if (call.pathname === '/v0/users/me') {
          return jsonResponse({
            user: {
              id: '11111111-1111-4111-8111-111111111111',
              username: 'sdk-user',
              avatarUrl: null,
            },
            wallets: {
              ownerWalletAddress: OWNER_ADDRESS,
              safeWalletAddress: SAFE_ADDRESS,
            },
          });
        }

        return jsonResponse(
          { error: 'not found', code: 'UNKNOWN_ERROR' },
          {
            status: 404,
          },
        );
      }),
    );

    const client = createSecureClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.test',
    });
    const result = await client.fetchAuthenticatedUser();

    expect(expectSuccessResult(result).wallets.safeWalletAddress).toBe(
      SAFE_ADDRESS,
    );
    expect(calls[0]?.pathname).toBe('/v0/users/me');
    expect(calls[0]?.headers.get('x-api-key')).toBe('api-key');
  });
});
