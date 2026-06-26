import {
  type ApiError,
  getError,
  getValue,
  isFailed,
  isSuccess,
  type Result,
} from '@renaiss-protocol/fp';
import {
  type UserActivity,
  UserActivityFilter,
} from '@renaiss-protocol/schema-validation';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSecureClient } from '../clients';
import { isListUserActivitiesError } from '../errors';

const USER_ADDRESS = '0x1111111111111111111111111111111111111111';
const CONTRACT_ADDRESS = '0x2222222222222222222222222222222222222222';
const TX_HASH = `0x${'ab'.repeat(32)}`;
const BLOCK_HASH = `0x${'cd'.repeat(32)}`;

type FetchCall = {
  headers: Headers;
  pathname: string;
  searchParams: URLSearchParams;
};

type GachaV3PullUserActivity = Extract<
  UserActivity,
  { type: UserActivityFilter.GachaV3Pull }
>;

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
    headers: new Headers(init?.headers),
    pathname: url.pathname,
    searchParams: url.searchParams,
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

function activity(
  overrides: Partial<GachaV3PullUserActivity> = {},
): GachaV3PullUserActivity {
  return {
    type: UserActivityFilter.GachaV3Pull,
    user: USER_ADDRESS,
    timestamp: '1782200000',
    occurredAt: '2026-06-23T05:46:40.000Z',
    blockNumber: '123456789',
    txHash: TX_HASH,
    ordinal: '123456789000004',
    contractAddress: CONTRACT_ADDRESS,
    checkoutIds: ['11'],
    totalAmount: '8010000000000000000',
    blockHash: BLOCK_HASH,
    ...overrides,
  };
}

describe('user actions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists user activities through SDK pagination', async () => {
    const calls: FetchCall[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const call = readCall(input, init);
        calls.push(call);

        return jsonResponse({
          activities: [activity()],
          nextCursor: '123456789000004',
        });
      }),
    );

    const client = createSecureClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.test',
    });
    const result = await client
      .listUserActivities({
        filter: UserActivityFilter.GachaV3Pull,
        pageSize: 2,
      })
      .firstPage();

    const page = expectSuccessResult(result);
    expect(page.items[0]?.type).toBe(UserActivityFilter.GachaV3Pull);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe('123456789000004');
    expect(calls[0]?.pathname).toBe('/v0/users/me/activities');
    expect(calls[0]?.headers.get('x-api-key')).toBe('api-key');
    expect(calls[0]?.searchParams.get('filter')).toBe('gacha-v3-pull');
    expect(calls[0]?.searchParams.get('limit')).toBe('2');
    expect(calls[0]?.searchParams.get('cursor')).toBeNull();
  });

  it('passes API cursors back through from(cursor)', async () => {
    const calls: FetchCall[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const call = readCall(input, init);
        calls.push(call);
        const cursor = call.searchParams.get('cursor') ?? '0';

        return jsonResponse({
          activities: [activity({ ordinal: cursor })],
          nextCursor: null,
        });
      }),
    );

    const client = createSecureClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.test',
    });
    const result = await client
      .listUserActivities({ pageSize: 1 })
      .from('123456789000004')
      .firstPage();

    const page = expectSuccessResult(result);
    expect(page.items[0]?.ordinal).toBe('123456789000004');
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeUndefined();
    expect(calls[0]?.searchParams.get('cursor')).toBe('123456789000004');
    expect(calls[0]?.searchParams.get('filter')).toBe('all');
    expect(calls[0]?.searchParams.get('limit')).toBe('1');
  });

  it('rejects invalid page sizes before fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = createSecureClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.test',
    });
    const result = await client
      .listUserActivities({ pageSize: 51 })
      .firstPage();

    expect(expectFailedResult(result).code).toBe('WRONG_REQUEST_PARAMS');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns schema failures for invalid activity responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ activities: [{ type: 'bad' }] })),
    );

    const client = createSecureClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.test',
    });
    const result = await client.listUserActivities().firstPage();

    expect(expectFailedResult(result).code).toBe('INVALID_SCHEMA');
  });

  it('keeps documented and unrelated API error codes broad', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(
            { error: 'activity query failed', code: 'ACTIVITY_QUERY_FAILED' },
            { status: 500 },
          ),
        )
        .mockResolvedValueOnce(
          jsonResponse(
            { error: 'wrong action', code: 'ORDER_NOT_FOUND' },
            { status: 500 },
          ),
        ),
    );

    const client = createSecureClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.test',
    });
    const documented = await client.listUserActivities().firstPage();
    const undocumented = await client.listUserActivities().firstPage();

    const documentedError = expectFailedResult(documented);
    expect(documentedError.code).toBe('ACTIVITY_QUERY_FAILED');
    expect(isListUserActivitiesError(documentedError)).toBe(true);

    const undocumentedError = expectFailedResult(undocumented);
    expect(undocumentedError.code).toBe('ORDER_NOT_FOUND');
    expect(isListUserActivitiesError(undocumentedError)).toBe(false);
  });
});
