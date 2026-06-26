import {
  type ApiError,
  getError,
  getValue,
  isFailed,
  isSuccess,
  type Result,
} from '@renaiss-protocol/fp';
import {
  type GachaBuybackOffer,
  GachaMachineStage,
  GachaQuantity,
  GachaStreamAction,
  GachaStreamEventStatus,
} from '@renaiss-protocol/schema-validation';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPublicClient, createSecureClient } from '../clients';
import type { RenaissSigner, SafeTypedDataRequest } from '../signers';

const OWNER_ADDRESS = '0x1111111111111111111111111111111111111111';
const SAFE_ADDRESS = '0x2222222222222222222222222222222222222222';
const USDT_ADDRESS = '0x3333333333333333333333333333333333333333';
const TVM_ADDRESS = '0x4444444444444444444444444444444444444444';
const PACK_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PACK_ID = '22222222-2222-4222-8222-222222222222';
const TX_HASH = `0x${'ab'.repeat(32)}`;
const SIGNATURE = `0x${'cd'.repeat(65)}`;

type FetchCall = {
  body: unknown;
  headers: Headers;
  pathname: string;
  searchParams: URLSearchParams;
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

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream' },
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
    searchParams: url.searchParams,
  };
}

function sseEvent(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
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

function pack(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'gacha-pack',
    name: 'Gacha Pack',
    packType: 'v3',
    stage: 'active',
    description: null,
    author: 'Renaiss',
    priceInUsdt: '1000000',
    expectedValueInUsd: '100',
    featuredCardFmvInUsd: null,
    packBannerVideoUrl: null,
    gachaMachineVideoUrl: null,
    gachaRippingPackAnimationVideoUrl: null,
    ...overrides,
  };
}

function preparedPullResponse() {
  return {
    chainId: 56,
    pullStreamPath: '/v0/gacha/vrf/pull/stream',
    buyerWalletAddress: SAFE_ADDRESS,
    pack: {
      id: PACK_ID,
      priceInUsdt: '1000000',
      vendingMachineAddress: TVM_ADDRESS,
    },
    permit2TypedData: {
      domain: {
        name: 'Permit2',
        chainId: 56,
        verifyingContract: USDT_ADDRESS,
      },
      types: {
        PermitWitnessTransferFrom: [
          { name: 'permitted', type: 'TokenPermissions' },
          { name: 'spender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'witness', type: 'PermitFundWitness' },
        ],
        TokenPermissions: [
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        PermitFundWitness: [{ name: 'numOfTokens', type: 'uint256' }],
      },
      primaryType: 'PermitWitnessTransferFrom',
      message: {
        permitted: {
          token: USDT_ADDRESS,
          amount: '1000000',
        },
        spender: TVM_ADDRESS,
        nonce: '1',
        deadline: '1800000000',
        witness: {
          numOfTokens: '1',
        },
      },
    },
    unsignedPullPayload: {
      packId: PACK_ID,
      numOfTokens: GachaQuantity.Single,
      amountPerToken: '1000000',
      nonce: '1',
      deadline: 1_800_000_000,
    },
  };
}

function drawResolvedEvent() {
  return {
    status: GachaStreamEventStatus.Complete,
    id: SAFE_ADDRESS,
    data: {
      action: GachaStreamAction.DrawResolved,
      timestamp: '2026-06-23T00:00:01.000Z',
      txHashes: [],
      draws: [
        {
          checkoutId: 1,
          randomness: TX_HASH,
          proof: TX_HASH,
          blockHash: TX_HASH,
          collectible: { tokenId: '1', name: 'Pikachu' },
        },
      ],
    },
  };
}

function tokenReleasedEvent() {
  return {
    status: GachaStreamEventStatus.Complete,
    id: SAFE_ADDRESS,
    data: {
      action: GachaStreamAction.TokenReleased,
      timestamp: '2026-06-23T00:00:02.000Z',
      txHashes: [TX_HASH],
      released: [
        {
          checkoutId: 1,
          releaseTxHash: TX_HASH,
          blockNumber: 123,
          collectible: { tokenId: '1', name: 'Pikachu' },
        },
      ],
    },
  };
}

function buybackOffer(
  overrides: Partial<GachaBuybackOffer> = {},
): GachaBuybackOffer {
  return {
    packId: PACK_ID,
    packSlug: 'gacha-pack',
    checkoutId: '1',
    tokenId: '1',
    cardName: 'Pikachu',
    setName: 'Base',
    cardNumber: '58',
    tier: 'rare',
    frontImageUrl: null,
    buybackAmountInUsd: '100',
    buybackAmountInUsdt: '100000000',
    buybackBaseValueInUsd: null,
    expiresAt: '2026-06-24T00:00:00.000Z',
    vendingMachineAddress: TVM_ADDRESS,
    buybackAuthorization: {
      checkoutIds: ['1'],
      token: USDT_ADDRESS,
      amounts: ['100000000'],
      tokenIds: ['1'],
    },
    ...overrides,
  };
}

describe('gacha actions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists machines through SDK pagination with requested stage', async () => {
    const calls: FetchCall[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const call = readCall(input, init);
        calls.push(call);

        return jsonResponse({
          cardPacks: [pack()],
          pagination: {
            total: 1,
            limit: 2,
            offset: 0,
            hasMore: false,
          },
        });
      }),
    );

    const client = createPublicClient({ baseUrl: 'https://api.test' });
    const result = await client
      .listGachaMachines({
        pageSize: 2,
        stage: GachaMachineStage.Active,
      })
      .firstPage();

    expect(expectSuccessResult(result).items.map((item) => item.slug)).toEqual([
      'gacha-pack',
    ]);
    expect(calls[0]?.pathname).toBe('/v0/gacha/vrf/packs');
    expect(calls[0]?.searchParams.get('limit')).toBe('2');
    expect(calls[0]?.searchParams.get('offset')).toBe('0');
    expect(calls[0]?.searchParams.get('stage')).toBe(GachaMachineStage.Active);
  });

  it('fetches one machine by slug', async () => {
    const calls: FetchCall[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const call = readCall(input, init);
        calls.push(call);

        return jsonResponse({
          cardPack: pack(),
        });
      }),
    );

    const client = createPublicClient({ baseUrl: 'https://api.test' });
    const result = await client.fetchGachaMachine({
      slug: 'gacha-pack',
    });

    expect(expectSuccessResult(result).slug).toBe('gacha-pack');
    expect(calls[0]?.pathname).toBe('/v0/gacha/vrf/packs/gacha-pack');
  });

  it('lists machine contents through SDK pagination', async () => {
    const calls: FetchCall[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const call = readCall(input, init);
        calls.push(call);

        return jsonResponse({
          cardPack: pack(),
          cards: [
            {
              name: 'Charizard #4 Base Set',
              tier: 'legendary',
              buybackBaseValueInUsd: '500',
              frontImageUrl: null,
            },
          ],
          pagination: {
            total: 1,
            limit: 3,
            offset: 0,
            hasMore: false,
          },
        });
      }),
    );

    const client = createPublicClient({ baseUrl: 'https://api.test' });
    const result = await client
      .listGachaMachineContents({
        pageSize: 3,
        slug: 'gacha-pack',
      })
      .firstPage();

    expect(expectSuccessResult(result).items[0]?.name).toBe(
      'Charizard #4 Base Set',
    );
    expect(calls[0]?.pathname).toBe('/v0/gacha/vrf/packs/gacha-pack/contents');
    expect(calls[0]?.searchParams.get('limit')).toBe('3');
    expect(calls[0]?.searchParams.get('offset')).toBe('0');
  });

  it('returns request failures for invalid machine cursors before fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = createPublicClient({ baseUrl: 'https://api.test' });
    const result = await client
      .listGachaMachines({
        stage: GachaMachineStage.Active,
      })
      .from('not-a-cursor')
      .firstPage();

    expect(expectFailedResult(result).code).toBe('WRONG_REQUEST_PARAMS');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns schema failures for invalid machine responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          cardPacks: [{ slug: 'bad' }],
          pagination: {
            total: 1,
            limit: 20,
            offset: 0,
            hasMore: false,
          },
        }),
      ),
    );

    const client = createPublicClient({ baseUrl: 'https://api.test' });
    const result = await client.listGachaMachines().firstPage();

    expect(expectFailedResult(result).code).toBe('INVALID_SCHEMA');
  });

  it('prepares, signs, streams, and returns the terminal pull result', async () => {
    const calls: FetchCall[] = [];
    const signSafeTypedData = vi.fn(
      async (_request: SafeTypedDataRequest) => SIGNATURE,
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const call = readCall(input, init);
        calls.push(call);

        if (call.pathname === '/v0/gacha/vrf/pull/prepare') {
          return jsonResponse(preparedPullResponse());
        }

        if (call.pathname === '/v0/gacha/vrf/pull/stream') {
          return sseResponse([
            sseEvent({
              status: GachaStreamEventStatus.Start,
              id: SAFE_ADDRESS,
              data: {
                action: GachaStreamAction.OpenPack,
                timestamp: '2026-06-23T00:00:00.000Z',
              },
            }),
            sseEvent(drawResolvedEvent()),
            sseEvent(tokenReleasedEvent()),
          ]);
        }

        return jsonResponse(
          { error: 'not found', code: 'UNKNOWN_ERROR' },
          {
            status: 404,
          },
        );
      }),
    );

    const events: GachaStreamAction[] = [];
    const client = createSecureClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.test',
      signer: signer({ signSafeTypedData }),
    });
    const result = await client.pullGacha({
      machineSlug: 'gacha-pack',
      onEvent: (event) => {
        events.push(event.data.action);
      },
    });

    expect(expectSuccessResult(result).released).toHaveLength(1);
    expect(calls[0]?.body).toEqual({
      packSlug: 'gacha-pack',
      permitDeadlineSeconds: 300,
      quantity: 1,
    });
    expect(calls[0]?.headers.get('x-api-key')).toBe('api-key');
    expect(calls[1]?.body).toEqual({
      ...preparedPullResponse().unsignedPullPayload,
      permitSignature: SIGNATURE,
    });
    expect(signSafeTypedData).toHaveBeenCalledWith(
      expect.objectContaining({ safeAddress: SAFE_ADDRESS }),
    );
    expect(events).toEqual([
      GachaStreamAction.OpenPack,
      GachaStreamAction.DrawResolved,
      GachaStreamAction.TokenReleased,
    ]);
  });

  it('rejects missing pull signers before preparing a pull', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = createSecureClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.test',
    });
    const result = await client.pullGacha({
      machineSlug: 'gacha-pack',
    });

    const error = expectFailedResult(result);
    expect(error.code).toBe('WRONG_REQUEST_PARAMS');
    expect(error.detail).toContain('signer configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects raw-only pull signers before preparing a pull', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = createSecureClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.test',
      signer: signer(),
    });
    const result = await client.pullGacha({
      machineSlug: 'gacha-pack',
    });

    const error = expectFailedResult(result);
    expect(error.code).toBe('WRONG_REQUEST_PARAMS');
    expect(error.detail).toContain('Safe-aware signer');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps stream error events to failed results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const { pathname } = new URL(String(input));

        if (pathname === '/v0/gacha/vrf/pull/prepare') {
          return jsonResponse(preparedPullResponse());
        }

        return sseResponse([
          sseEvent({
            status: GachaStreamEventStatus.Error,
            id: SAFE_ADDRESS,
            data: {
              action: GachaStreamAction.OpenPack,
              timestamp: '2026-06-23T00:00:00.000Z',
              code: 'INSUFFICIENT_FUNDS',
              details: 'Insufficient funds',
            },
          }),
        ]);
      }),
    );

    const client = createSecureClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.test',
      signer: signer({ signSafeTypedData: vi.fn(async () => SIGNATURE) }),
    });
    const result = await client.pullGacha({
      machineSlug: 'gacha-pack',
    });

    expect(expectFailedResult(result).code).toBe('INSUFFICIENT_FUNDS');
  });

  it('returns schema failures for invalid stream events with live callbacks', async () => {
    const onEvent = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const { pathname } = new URL(String(input));

        if (pathname === '/v0/gacha/vrf/pull/prepare') {
          return jsonResponse(preparedPullResponse());
        }

        return sseResponse([
          sseEvent({
            status: GachaStreamEventStatus.Complete,
            id: SAFE_ADDRESS,
            data: {
              action: GachaStreamAction.TokenReleased,
              timestamp: '2026-06-23T00:00:02.000Z',
              txHashes: ['not-a-hex-string'],
              released: [],
            },
          }),
        ]);
      }),
    );

    const client = createSecureClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.test',
      signer: signer({ signSafeTypedData: vi.fn(async () => SIGNATURE) }),
    });
    const result = await client.pullGacha({
      machineSlug: 'gacha-pack',
      onEvent,
    });

    expect(expectFailedResult(result).code).toBe('INVALID_SCHEMA');
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('lists buyback offers through SDK pagination', async () => {
    const calls: FetchCall[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const call = readCall(input, init);
        calls.push(call);

        return jsonResponse({
          offers: [buybackOffer()],
          pagination: {
            total: 1,
            limit: 2,
            offset: 0,
            hasMore: false,
          },
        });
      }),
    );

    const client = createSecureClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.test',
    });
    const result = await client
      .listGachaBuybackOffers({ pageSize: 2, search: 'pikachu' })
      .firstPage();

    expect(expectSuccessResult(result).items[0]?.cardName).toBe('Pikachu');
    expect(calls[0]?.pathname).toBe('/v0/gacha/vrf/buyback/offers');
    expect(calls[0]?.searchParams.get('limit')).toBe('2');
    expect(calls[0]?.searchParams.get('offset')).toBe('0');
    expect(calls[0]?.searchParams.get('search')).toBe('pikachu');
  });

  it('returns request failures for invalid buyback offer cursors before fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = createSecureClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.test',
    });
    const result = await client
      .listGachaBuybackOffers()
      .from('not-a-cursor')
      .firstPage();

    expect(expectFailedResult(result).code).toBe('WRONG_REQUEST_PARAMS');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects mixed buyback offer sets before submitting', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = createSecureClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.test',
      signer: signer(),
    });
    const result = await client.buybackGacha({
      offers: [
        buybackOffer(),
        buybackOffer({ packId: OTHER_PACK_ID, checkoutId: '2' }),
      ],
    });

    expect(expectFailedResult(result).code).toBe(
      'GACHA_BUYBACK_OFFERS_INVALID',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects missing buyback signers before fetching Safe context', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = createSecureClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.test',
    });
    const result = await client.buybackGacha({
      offers: [buybackOffer()],
    });

    const error = expectFailedResult(result);
    expect(error.code).toBe('WRONG_REQUEST_PARAMS');
    expect(error.detail).toContain('signer configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects raw-only buyback signers before fetching Safe context', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = createSecureClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.test',
      signer: signer(),
    });
    const result = await client.buybackGacha({
      offers: [buybackOffer()],
    });

    const error = expectFailedResult(result);
    expect(error.code).toBe('WRONG_REQUEST_PARAMS');
    expect(error.detail).toContain('Safe-aware signer');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signs and submits merged buyback authorization payloads', async () => {
    const calls: FetchCall[] = [];
    const signSafeTypedData = vi.fn(
      async (_request: SafeTypedDataRequest) => SIGNATURE,
    );

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
              usdtAddress: USDT_ADDRESS,
            },
          });
        }

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

        return jsonResponse({
          txHash: TX_HASH,
          totalAmountInUsdt: '200000000',
          itemCount: 2,
        });
      }),
    );

    const client = createSecureClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.test',
      signer: signer({ signSafeTypedData }),
    });
    const result = await client.buybackGacha({
      offers: [
        buybackOffer(),
        buybackOffer({
          checkoutId: '2',
          tokenId: '2',
          buybackAuthorization: {
            checkoutIds: ['2'],
            token: USDT_ADDRESS,
            amounts: ['100000000'],
            tokenIds: ['2'],
          },
        }),
      ],
    });

    expectSuccessResult(result);
    expect(signSafeTypedData).toHaveBeenCalledWith(
      expect.objectContaining({
        safeAddress: SAFE_ADDRESS,
        typedData: expect.objectContaining({
          primaryType: 'BuybackUserAuthorization',
        }),
      }),
    );
    expect(calls[2]?.body).toEqual({
      cardPackId: PACK_ID,
      userSignature: SIGNATURE,
      buybackAuth: {
        checkoutIds: ['1', '2'],
        token: USDT_ADDRESS,
        amounts: ['100000000', '100000000'],
        tokenIds: ['1', '2'],
      },
    });
  });
});
