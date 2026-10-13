import {
  getError,
  getValue,
  isFailed,
  type Result,
} from '@renaiss-protocol/fp';
import {
  buildGachaPullTypedData,
  type EoaPreparedPull,
  type EoaSignedPull,
} from '@renaiss-protocol/schema-validation';
import {
  createWalletClient,
  type Hex,
  http,
  recoverTypedDataAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BNB_TESTNET, createGachaClient } from '../index';
import { signerFrom } from '../viem';

// Publicly known test key: it must never hold funds.
const account = privateKeyToAccount(`0x${'0'.repeat(63)}1`);
const packId = '11111111-1111-4111-8111-111111111111';
const hash = `0x${'ab'.repeat(32)}`;
const token = BNB_TESTNET.marketplace.contracts.usdt;
const spender = BNB_TESTNET.marketplace.contracts.permit2;
const tvm = BNB_TESTNET.vendingMachineAddress;
const amount = '9007199254740993000000000000000';
function prepared(): EoaPreparedPull {
  const deadline = Math.floor(Date.now() / 1000) + 300;
  const builderCode = `0x${'55'.repeat(32)}`;
  const onChainPackId = `0x${'66'.repeat(32)}`;
  return {
    chainId: 97,
    buyerWalletAddress: account.address,
    pack: {
      id: packId,
      onChainPackId,
      priceInUsdt: amount,
      vendingMachineAddress: tvm,
    },
    approval: { token, spender, requiredAmount: amount },
    unsignedPullPayload: {
      packId,
      builderCode,
      numOfTokens: 1,
      amountPerToken: amount,
      nonce: '123',
      deadline,
    },
    permit2TypedData: buildGachaPullTypedData({
      amountPerToken: amount,
      builderCode,
      chainId: 97,
      deadline,
      nonce: '123',
      numOfTokens: 1,
      onChainPackId,
      permit2Address: spender,
      usdtAddress: token,
      vendingMachineAddress: tvm,
    }),
  };
}
function machineDetail() {
  const input = prepared();
  return {
    ...input.pack,
    slug: 'test-pack',
    name: 'Test pack',
    packType: 'v3',
    stage: 'active',
    description: 'Pack description',
    expectedValueInUsd: null,
    featuredCardFmvInUsd: null,
    packBannerVideoUrl: null,
    gachaMachineVideoUrl: null,
    gachaRippingPackAnimationVideoUrl: null,
    tiers: [],
    activeSetExpectedValueInUsd: '1000',
    buybackPercentage: 85,
    buybackWindowSeconds: 600,
  };
}
function expectation() {
  return {
    packId,
    onChainPackId: `0x${'66'.repeat(32)}` as const,
    priceInUsdt: BigInt(amount),
    quantity: 1 as const,
  };
}
function value<T>(result: Result<T>): T {
  if (isFailed(result)) throw new Error(JSON.stringify(getError(result)));
  return getValue(result);
}
const signer = signerFrom(
  createWalletClient({ account, transport: http('http://unused.test') }),
);
const context = {
  buyerWalletAddress: account.address,
  packId,
  nonce: '123',
  numOfTokens: 1,
  message: 'Preparing Pokémon',
};
const resolved = {
  ...context,
  permitFundTxHash: hash,
  packName: 'Test',
  status: 'RESOLVED',
  pulledAt: new Date().toISOString(),
  draws: [
    {
      settlementId: `0x${'88'.repeat(32)}`,
      tokenId: '9007199254740993000',
      releaseTxHash: null,
      buybackTxHash: null,
      collectible: {
        name: 'Pokémon',
        setName: 'Set',
        imageUrl: 'https://test.example/item.png',
        frontImageUrl: 'https://test.example/front.png',
        tier: 'S',
        buybackBaseValueInUSD: '1000',
        snapshotBuybackValueInUsdt: amount,
      },
    },
  ],
};
function frame(event: string, data: unknown) {
  return `event: ${event}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`;
}
function signed(): EoaSignedPull {
  const { builderCode: _, ...payload } = prepared().unsignedPullPayload;
  return {
    ...payload,
    buyerWalletAddress: account.address,
    permitSignature: `0x${'11'.repeat(65)}`,
  };
}

// Synthetic responses here isolate the SSE transport/signing boundaries, including
// disconnects and invalid frames that cannot safely be triggered on the live API.
describe('v2 EOA signing and stream boundaries', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it('explains clock skew instead of reporting a different pack', async () => {
    const input = prepared();
    const machine = machineDetail();
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now - 180_000);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        Response.json(url.endsWith('/prepare') ? input : { cardPack: machine }),
      ),
    );
    const signing = vi.fn();
    const sdk = createGachaClient({
      baseUrl: 'https://test.example',
      signer: { ...signer, signTypedData: signing },
    });
    const result = await sdk.prepareGachaPull({
      machineSlug: 'test-pack',
      buyerWalletAddress: account.address,
      expectedPriceInUsdt: BigInt(amount),
    });
    expect(result).toMatchObject({
      _tag: 'Left',
      left: {
        code: 'INVALID_SCHEMA',
        detail: expect.stringContaining('Check the device clock'),
      },
    });
    const signed = await sdk.signGachaPull({
      prepared: input,
      expected: expectation(),
    });
    expect(signed).toMatchObject({
      _tag: 'Left',
      left: {
        code: 'WRONG_REQUEST_PARAMS',
        detail: expect.stringContaining('Check the device clock'),
      },
    });
    expect(signing).not.toHaveBeenCalled();
  });
  it('explains a device clock ten minutes ahead before preparing a pull', async () => {
    const input = prepared();
    const machine = machineDetail();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600_000);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        Response.json(url.endsWith('/prepare') ? input : { cardPack: machine }),
      ),
    );
    const signing = vi.fn();
    const result = await createGachaClient({
      baseUrl: 'https://test.example',
      signer: { ...signer, signTypedData: signing },
    }).prepareGachaPull({
      machineSlug: 'test-pack',
      buyerWalletAddress: account.address,
      expectedPriceInUsdt: BigInt(amount),
    });
    expect(result).toMatchObject({
      _tag: 'Left',
      left: {
        code: 'INVALID_SCHEMA',
        detail: expect.stringContaining('device clock may be ahead'),
      },
    });
    expect(signing).not.toHaveBeenCalled();
  });
  it('asks for fresh preparation if approvals outlive the signing window', async () => {
    const input = prepared();
    const machine = machineDetail();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        Response.json(url.endsWith('/prepare') ? input : { cardPack: machine }),
      ),
    );
    const signing = vi.fn();
    const sdk = createGachaClient({
      baseUrl: 'https://test.example',
      signer: { ...signer, signTypedData: signing },
    });
    const result = await sdk.prepareGachaPull({
      machineSlug: 'test-pack',
      buyerWalletAddress: account.address,
      expectedPriceInUsdt: BigInt(amount),
    });
    expect(isFailed(result)).toBe(false);
    vi.spyOn(Date, 'now').mockReturnValue(
      (input.unsignedPullPayload.deadline + 1) * 1000,
    );
    const signed = await sdk.signGachaPull({
      prepared: value(result),
      expected: expectation(),
    });
    expect(signed).toMatchObject({
      _tag: 'Left',
      left: {
        code: 'WRONG_REQUEST_PARAMS',
        detail: expect.stringContaining('signing window expired'),
      },
    });
    expect(signing).not.toHaveBeenCalled();
  });
  it('reads the reduced v2 responses and signs preparation without routing metadata', async () => {
    const input = prepared();
    const machine = machineDetail();
    const card = {
      name: 'Card',
      tier: 'S',
      buybackBaseValueInUsd: '9007199254740993',
      frontImageUrl: 'https://test.example/front.png',
    };
    const pagination = { total: 1, limit: 20, offset: 0, hasMore: false };
    const fetch = vi.fn(async (url: string | URL | Request) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith('/content'))
        return Response.json({ cards: [card], pagination });
      if (path.endsWith('/pull-history'))
        return Response.json({ pulls: [], pagination });
      if (path.endsWith('/packs'))
        return Response.json({ cardPacks: [machine], pagination });
      if (path.endsWith('/packs/test-pack'))
        return Response.json({ cardPack: machine });
      if (path.endsWith('/pull/prepare')) return Response.json(input);
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetch);
    const client = createGachaClient({
      baseUrl: 'https://test.example',
      // Format examples, not real keys.
      builderApiKey: 'rnbldr_live_fixture',
      signer,
      expectedChainId: 97,
    });
    expect(
      value(await client.listGachaMachines().firstPage()).items[0],
    ).not.toHaveProperty('author');
    expect(
      value(
        await client
          .listGachaMachineContents({ slug: 'test-pack' })
          .firstPage(),
      ).items,
    ).toEqual([card]);
    expect(
      value(
        await client.listGachaPullHistory({ slug: 'test-pack' }).firstPage(),
      ).items,
    ).toEqual([]);
    const result = value(
      await client.prepareGachaPull({
        machineSlug: 'test-pack',
        expectedPriceInUsdt: BigInt(amount),
        buyerWalletAddress: account.address,
      }),
    );
    expect(result).not.toHaveProperty('pullStreamPath');
    expect(result).not.toHaveProperty('accountType');
    const signedPull = value(
      await client.signGachaPull({ prepared: result, expected: expectation() }),
    );
    expect(signedPull.permitSignature).toMatch(/^0x[0-9a-f]{130}$/i);
  });
  it('reports a changed price before preparing or signing a pull', async () => {
    const machine = machineDetail();
    machine.priceInUsdt = '123';
    const fetch = vi.fn(async () => Response.json({ cardPack: machine }));
    vi.stubGlobal('fetch', fetch);
    const signing = vi.spyOn(signer, 'signTypedData');
    const result = await createGachaClient({
      baseUrl: 'https://test.example',
      signer,
    }).prepareGachaPull({
      machineSlug: 'test-pack',
      buyerWalletAddress: account.address,
      expectedPriceInUsdt: BigInt(amount),
    });
    expect(result).toMatchObject({
      _tag: 'Left',
      left: {
        code: 'GACHA_PRICE_CHANGED',
        error: { currentPriceInUsdt: '123' },
      },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(signing).not.toHaveBeenCalled();
    signing.mockRestore();
  });
  it.each([
    'price',
    'far-future-deadline',
    'spender',
    'types',
    'pack',
  ])('rejects an altered preparation %s before returning approval requirements', async (change) => {
    const input = prepared();
    const machine = machineDetail();
    if (change === 'far-future-deadline') {
      const deadline = Math.floor(Date.now() / 1000) + 365 * 86400;
      input.unsignedPullPayload.deadline = deadline;
      input.permit2TypedData.message.deadline = String(deadline);
    }
    if (change === 'price') {
      input.pack.priceInUsdt = '1';
      input.approval.requiredAmount = '1';
      input.unsignedPullPayload.amountPerToken = '1';
      input.permit2TypedData.message.permitted.amount = '1';
    }
    if (change === 'spender') {
      input.pack.vendingMachineAddress = token;
      input.permit2TypedData.message.spender = token;
    }
    if (change === 'types') input.permit2TypedData.types = {};
    if (change === 'pack') {
      input.pack.onChainPackId = hash;
      input.permit2TypedData.message.witness.packId = hash;
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        Response.json(url.endsWith('/prepare') ? input : { cardPack: machine }),
      ),
    );
    const signing = vi.spyOn(signer, 'signTypedData');
    const result = await createGachaClient({
      signer,
      baseUrl: 'https://test.example',
    }).prepareGachaPull({
      machineSlug: 'test-pack',
      buyerWalletAddress: account.address,
      expectedPriceInUsdt: BigInt(amount),
    });
    expect(result).toMatchObject({
      _tag: 'Left',
      left: { code: 'INVALID_SCHEMA' },
    });
    expect(signing).not.toHaveBeenCalled();
    signing.mockRestore();
  });
  it('signs an EOA Permit2 message precisely, without builderCode in submission', async () => {
    const input = prepared();
    const client = createGachaClient({
      baseUrl: 'https://test.example',
      signer,
      expectedChainId: 97,
    });
    const pull = value(
      await client.signGachaPull({ prepared: input, expected: expectation() }),
    );
    expect(pull).not.toHaveProperty('builderCode');
    const recovered = await recoverTypedDataAddress({
      ...input.permit2TypedData,
      signature: pull.permitSignature as Hex,
    });
    expect(recovered).toBe(account.address);
  });
  it.each([
    'consistent-spender',
    'types',
    'reviewed-price',
    'onchain-pack',
    'wallet',
    'chain',
    'amount',
    'expiry',
    'far-future-deadline',
    'spender',
    'builder',
  ] as const)('rejects inconsistent %s before signing', async (kind) => {
    const input = prepared();
    if (kind === 'consistent-spender') {
      input.pack.vendingMachineAddress = token;
      input.permit2TypedData.message.spender = token;
    }
    if (kind === 'types') input.permit2TypedData.types = {};
    if (kind === 'reviewed-price') {
      input.pack.priceInUsdt = '1';
      input.approval.requiredAmount = '1';
      input.unsignedPullPayload.amountPerToken = '1';
      input.permit2TypedData.message.permitted.amount = '1';
    }
    if (kind === 'onchain-pack') {
      input.pack.onChainPackId = hash;
      input.permit2TypedData.message.witness.packId = hash;
    }
    if (kind === 'wallet') input.buyerWalletAddress = token;
    if (kind === 'chain') input.chainId = 56;
    if (kind === 'amount') input.approval.requiredAmount = '1';
    if (kind === 'expiry') input.unsignedPullPayload.deadline = 1;
    if (kind === 'far-future-deadline') {
      const deadline = Math.floor(Date.now() / 1000) + 365 * 86400;
      input.unsignedPullPayload.deadline = deadline;
      input.permit2TypedData.message.deadline = String(deadline);
    }
    if (kind === 'spender') input.permit2TypedData.message.spender = token;
    if (kind === 'builder') input.unsignedPullPayload.builderCode = hash;
    const sign = vi.fn();
    const result = await createGachaClient({
      baseUrl: 'https://test.example',
      signer: { ...signer, signTypedData: sign },
      expectedChainId: 97,
    }).signGachaPull({ prepared: input, expected: expectation() });
    expect(isFailed(result) && getError(result).code).toBe(
      'WRONG_REQUEST_PARAMS',
    );
    expect(sign).not.toHaveBeenCalled();
  });
  it.each([
    400, 401, 403, 404, 413, 422, 429, 409, 500,
  ])('classifies pre-stream HTTP %s without retrying', async (status) => {
    const fetch = vi.fn(async () =>
      Response.json(
        { code: 'EOA_PURCHASE_REJECTED', error: 'Request rejected' },
        { status },
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const result = await createGachaClient({
      baseUrl: 'https://test.example',
    }).submitGachaPull({ pull: signed() });
    expect(result).toMatchObject({
      _tag: 'Left',
      left: {
        detail: 'Request rejected',
        error: {
          rejectedBeforeStream: status !== 409 && status < 500,
          fundingConfirmed: false,
        },
      },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('decodes named CRLF frames split across bytes, stops on resolution and cancels the stream', async () => {
    const cancel = vi.fn();
    const wire = new TextEncoder().encode(
      ': keep-alive\r\n\r\n' +
        frame('payment_confirmed', { ...context, permitFundTxHash: hash }) +
        frame('draws_resolved', resolved),
    );
    const stream = new ReadableStream({
      start(controller) {
        for (let i = 0; i < wire.length; i += 7)
          controller.enqueue(wire.slice(i, i + 7));
      },
      cancel,
    });
    const fetch = vi.fn(async () => new Response(stream));
    vi.stubGlobal('fetch', fetch);
    const events: string[] = [];
    const result = value(
      await createGachaClient({
        baseUrl: 'https://test.example',
        builderApiKey: 'rnbldr_live_fixture',
      }).submitGachaPull({
        pull: signed(),
        onEvent(event) {
          events.push(event.event);
        },
      }),
    );
    expect(events).toEqual(['payment_confirmed', 'draws_resolved']);
    expect(result.draws[0]?.collectible.name).toBe('Pokémon');
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
  });
  it.each([
    'disconnect',
    'malformed',
    'callback',
    'failure',
  ] as const)('retains funding hash on %s and never retries', async (kind) => {
    const start = frame('payment_confirmed', {
      ...context,
      permitFundTxHash: hash,
    });
    const end =
      kind === 'malformed'
        ? 'event: draws_resolved\ndata: {broken}\n\n'
        : kind === 'failure'
          ? frame('pull_failed', {
              ...context,
              code: 'FUTURE_API_CODE',
              error: 'Resolution unavailable',
              permitFundTxHash: hash,
              fundingConfirmed: true,
            })
          : '';
    const fetch = vi.fn(async () => new Response(start + end));
    vi.stubGlobal('fetch', fetch);
    const result = await createGachaClient({
      baseUrl: 'https://test.example',
    }).submitGachaPull({
      pull: signed(),
      onEvent() {
        if (kind === 'callback') throw new Error('Persistence failed');
      },
    });
    expect(isFailed(result)).toBe(true);
    if (!isFailed(result)) return;
    expect(getError(result).error).toMatchObject({
      permitFundTxHash: hash,
      fundingConfirmed: true,
    });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('retains recovery context when a terminal reveal has missing cards', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(frame('draws_resolved', { ...resolved, draws: [] })),
      ),
    );
    const result = await createGachaClient({
      baseUrl: 'https://test.example',
    }).submitGachaPull({ pull: signed() });
    expect(isFailed(result)).toBe(true);
    if (isFailed(result)) {
      expect(getError(result).code).toBe('INVALID_SCHEMA');
      expect(getError(result).error).toMatchObject({
        permitFundTxHash: hash,
        fundingConfirmed: true,
      });
    }
  });
  it('rejects caller-selected builderCode before transport', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const result = await createGachaClient({
      baseUrl: 'https://test.example',
    }).submitGachaPull({
      pull: { ...signed(), builderCode: hash } as EoaSignedPull,
    });
    expect(isFailed(result) && getError(result).code).toBe(
      'WRONG_REQUEST_PARAMS',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it('sums compatible buybacks exactly and rejects duplicate settlement IDs', async () => {
    const offers = [1, 2].map((n) => ({
      cardPackId: packId,
      settlementId: `0x${String(n).repeat(64)}`,
      tokenId: String(n),
      amountInUsdt: amount,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      vendingMachineAddress: tvm,
    }));
    const client = createGachaClient({
      baseUrl: 'https://test.example',
      signer,
      expectedChainId: 97,
    });
    const result = value(
      await client.createGachaBuyback({
        buyerWalletAddress: account.address,
        chainId: 97,
        token,
        offers,
      }),
    );
    expect(result.buybackAuth.amount).toBe((BigInt(amount) * 2n).toString());
    const first = offers[0];
    if (!first) throw new Error('Missing offer fixture');
    const duplicate = await client.createGachaBuyback({
      buyerWalletAddress: account.address,
      chainId: 97,
      token,
      offers: [first, first],
    });
    expect(isFailed(duplicate) && getError(duplicate).code).toBe(
      'WRONG_REQUEST_PARAMS',
    );
  });
  it('normalizes new upstream codes without losing the original code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { code: 'NEW_API_AUTH_CODE', error: 'Rejected' },
          { status: 403 },
        ),
      ),
    );
    const result = await createGachaClient({
      baseUrl: 'https://test.example',
    }).fetchGachaBuybackOffers({ buyerWalletAddress: account.address });
    expect(isFailed(result)).toBe(true);
    if (isFailed(result)) {
      expect(getError(result).code).toBe('GACHA_V2_REQUEST_FAILED');
      expect(getError(result).error).toMatchObject({
        code: 'NEW_API_AUTH_CODE',
      });
    }
  });
  it('preserves page iteration and opaque cursors for builder history', async () => {
    const urls: URL[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = new URL(input);
        urls.push(url);
        const offset = Number(url.searchParams.get('offset'));
        return Response.json({
          pulls: [{ ...resolved, packName: `Page ${offset}` }],
          limit: 1,
          offset,
          hasMore: offset === 0,
        });
      }),
    );
    const items = [];
    for await (const result of createGachaClient({
      baseUrl: 'https://test.example',
    }).listWalletPulls({ buyerWalletAddress: account.address, pageSize: 1 }))
      items.push(...value(result).items);
    expect(items.map((item) => item.packName)).toEqual(['Page 0', 'Page 1']);
    expect(urls.map((url) => url.searchParams.get('offset'))).toEqual([
      '0',
      '1',
    ]);
  });
});

describe('fetchGachaBuybackOffers pages', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  const offerAt = (n: number) => ({
    cardPackId: packId,
    settlementId: `0x${n.toString(16).padStart(64, '0')}`,
    tokenId: String(n),
    amountInUsdt: amount,
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    vendingMachineAddress: tvm,
  });
  const client = () =>
    createGachaClient({
      baseUrl: 'https://test.example',
      builderApiKey: 'rnbldr_live_fixture',
    });
  function stubPages(total: number, failAtOffset?: number) {
    const urls: URL[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = new URL(input);
        urls.push(url);
        const offset = Number(url.searchParams.get('offset'));
        const limit = Number(url.searchParams.get('limit'));
        if (offset === failAtOffset)
          return Response.json(
            { code: 'API_ERROR', error: 'Server failure' },
            { status: 500 },
          );
        const count = Math.max(0, Math.min(limit, total - offset));
        return Response.json({
          offers: Array.from({ length: count }, (_, i) => offerAt(offset + i)),
        });
      }),
    );
    return urls;
  }

  it('makes one request when the first page is short', async () => {
    const urls = stubPages(3);
    const offers = value(
      await client().fetchGachaBuybackOffers({
        buyerWalletAddress: account.address,
      }),
    );
    expect(offers).toHaveLength(3);
    expect(urls).toHaveLength(1);
    expect(urls[0]?.searchParams.get('limit')).toBe('100');
    expect(urls[0]?.searchParams.get('offset')).toBe('0');
  });

  it('continues by offset after a full page and keeps the order', async () => {
    const urls = stubPages(130);
    const offers = value(
      await client().fetchGachaBuybackOffers({
        buyerWalletAddress: account.address,
      }),
    );
    expect(urls.map((url) => url.searchParams.get('offset'))).toEqual([
      '0',
      '100',
    ]);
    expect(offers.map((offer) => offer.tokenId)).toEqual(
      Array.from({ length: 130 }, (_, i) => String(i)),
    );
  });

  it('makes one more request after an exactly full last page', async () => {
    const urls = stubPages(100);
    const offers = value(
      await client().fetchGachaBuybackOffers({
        buyerWalletAddress: account.address,
      }),
    );
    expect(offers).toHaveLength(100);
    expect(urls).toHaveLength(2);
  });

  it('fails the whole call when a later page fails', async () => {
    stubPages(250, 100);
    const result = await client().fetchGachaBuybackOffers({
      buyerWalletAddress: account.address,
    });
    expect(isFailed(result) && getError(result).code).toBe(
      'GACHA_V2_REQUEST_FAILED',
    );
  });

  it('returns no duplicate when an offer shifts onto the next page', async () => {
    const all = Array.from({ length: 101 }, (_, i) => offerAt(i));
    // Offer 0 is removed after page one was served, so offer 99 appears again.
    const pages = [all.slice(0, 100), all.slice(99)];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const offset = Number(new URL(input).searchParams.get('offset'));
        return Response.json({ offers: pages[offset / 100] ?? [] });
      }),
    );
    const offers = value(
      await client().fetchGachaBuybackOffers({
        buyerWalletAddress: account.address,
      }),
    );
    expect(offers.map((offer) => offer.tokenId)).toEqual(
      Array.from({ length: 101 }, (_, i) => String(i)),
    );
  });

  it('succeeds when an offer disappears between pages, without promising it', async () => {
    const all = Array.from({ length: 150 }, (_, i) => offerAt(i));
    // Offer 0 is removed after page one: offer 100 shifts into page one's range
    // and is skipped. The call still succeeds with only offers that existed.
    const pages = [all.slice(0, 100), all.slice(101)];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const offset = Number(new URL(input).searchParams.get('offset'));
        return Response.json({ offers: pages[offset / 100] ?? [] });
      }),
    );
    const offers = value(
      await client().fetchGachaBuybackOffers({
        buyerWalletAddress: account.address,
      }),
    );
    const ids = new Set(all.map((offer) => offer.settlementId));
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) expect(ids.has(offer.settlementId)).toBe(true);
    expect(new Set(offers.map((offer) => offer.settlementId)).size).toBe(
      offers.length,
    );
  });

  it('returns all 10,099 offers', async () => {
    stubPages(10_099);
    const offers = value(
      await client().fetchGachaBuybackOffers({
        buyerWalletAddress: account.address,
      }),
    );
    expect(offers).toHaveLength(10_099);
  });

  it('fails at 10,100 offers because completeness cannot be confirmed', async () => {
    stubPages(10_100);
    const result = await client().fetchGachaBuybackOffers({
      buyerWalletAddress: account.address,
    });
    expect(isFailed(result)).toBe(true);
    if (isFailed(result)) {
      expect(getError(result).code).toBe('GACHA_V2_REQUEST_FAILED');
      expect(getError(result).detail).toBe(
        'Read 10100 buyback offers and could not confirm the list is complete.',
      );
    }
  });

  it('does not return a partial list when the maximum offset is reached', async () => {
    const urls = stubPages(50_000);
    const result = await client().fetchGachaBuybackOffers({
      buyerWalletAddress: account.address,
    });
    expect(isFailed(result)).toBe(true);
    if (isFailed(result)) {
      expect(getError(result).code).toBe('GACHA_V2_REQUEST_FAILED');
      expect(getError(result).detail).toMatch(/could not confirm/);
    }
    expect(urls.at(-1)?.searchParams.get('offset')).toBe('10000');
  });
});
