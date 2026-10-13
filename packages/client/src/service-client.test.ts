import { getError, isSuccess } from '@renaiss-protocol/fp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceClient } from './service-client';

type FetchCall = {
  body: unknown;
  headers: Headers;
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
    pathname: url.pathname,
  };
}

describe('ServiceClient write authentication', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the builder API key only on builder-authorized requests', async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push(readCall(input, init));

        return jsonResponse({ ok: true });
      }),
    );

    const client = new ServiceClient({
      baseUrl: 'https://api.test',
      // Format examples, not real keys.
      builderApiKey: 'rnbldr_live_fixture',
    });

    const readLikeResult = await client.post('/v2/auth/wallet/nonce', {
      body: {
        chainId: 56,
        origin: 'https://partner.test',
        scopes: ['redeem:read', 'redeem:write'],
        walletAddress: '0x0000000000000000000000000000000000000001',
      },
    })();
    const writeResult = await client.post('/v2/auth/wallet/nonce', {
      body: {
        chainId: 56,
        origin: 'https://partner.test',
        scopes: ['redeem:read', 'redeem:write'],
        walletAddress: '0x0000000000000000000000000000000000000001',
      },
      builderAuth: true,
    })();

    expect(isSuccess(readLikeResult)).toBe(true);
    expect(isSuccess(writeResult)).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.headers.get('x-builder-api-key')).toBeNull();
    expect(calls[1]?.headers.get('x-builder-api-key')).toBe(
      'rnbldr_live_fixture',
    );
  });

  it('rejects builder-authorized calls before fetch when it holds no credential', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = new ServiceClient({ baseUrl: 'https://api.test' });

    const readResult = await client.get('/v2/gacha/pull-history', {
      builderAuth: true,
    })();
    const jsonResult = await client.post('/v2/auth/wallet/nonce', {
      body: {
        chainId: 56,
        origin: 'https://partner.test',
        scopes: ['redeem:read', 'redeem:write'],
        walletAddress: '0x0000000000000000000000000000000000000001',
      },
      builderAuth: true,
    })();
    const streamResult = await client.postSse('/v2/gacha/pull/stream', {
      body: {
        amountPerToken: '1000000',
        buyerWalletAddress: '0x0000000000000000000000000000000000000001',
        deadline: 1_800_000_000,
        nonce: '1',
        numOfTokens: 1,
        packId: '11111111-1111-4111-8111-111111111111',
        permitSignature: `0x${'ab'.repeat(65)}`,
      },
      builderAuth: true,
    })();

    if (
      isSuccess(readResult) ||
      isSuccess(jsonResult) ||
      isSuccess(streamResult)
    ) {
      throw new Error('Expected credential-less requests to fail');
    }

    expect(getError(readResult).code).toBe('WRONG_REQUEST_PARAMS');
    expect(getError(jsonResult).code).toBe('WRONG_REQUEST_PARAMS');
    expect(getError(streamResult).code).toBe('WRONG_REQUEST_PARAMS');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('ServiceClient types', () => {
  it('requires paths from generated OpenAPI bindings', () => {
    const client = new ServiceClient({ baseUrl: 'https://api.test' });

    client.get('/v2/gacha/packs');
    client.post('/v2/auth/wallet/nonce', {
      body: {
        chainId: 56,
        origin: 'https://partner.test',
        scopes: ['redeem:read', 'redeem:write'],
        walletAddress: '0x0000000000000000000000000000000000000001',
      },
    });

    // @ts-expect-error Unknown GET paths must not fall back to Action<unknown>.
    client.get('/not-in-openapi');

    // @ts-expect-error Unknown POST paths must not fall back to Action<unknown>.
    client.post('/not-in-openapi');
  });
});
