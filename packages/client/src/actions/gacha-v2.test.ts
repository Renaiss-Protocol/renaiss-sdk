import {
  getError,
  getValue,
  isFailed,
  type Result,
} from '@renaiss-protocol/fp';
import {
  buildGachaPullTypedData,
  EoaActivityFilter,
  EoaActivityType,
  EoaCollectionCardStatus,
  EoaCollectionSort,
  type EoaPreparedPull,
  type EoaSignedPull,
  EoaSortOrder,
  GachaMachineTierName,
} from '@renaiss-protocol/schema-validation';
import {
  createWalletClient,
  type Hex,
  http,
  recoverTypedDataAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BNB_TESTNET,
  createGachaClient,
  type EoaWalletActivitiesRequest,
  type EoaWalletCollectionRequest,
  getEoaBuybackOfferEndsAt,
  getEoaBuybackTierAt,
} from '../index';
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
    packBannerVideoUrl: null,
    gachaMachineVideoUrl: null,
    gachaRippingPackAnimationVideoUrl: null,
    tiers: [],
    activeSetExpectedValueInUsd: '1000',
    buybackConfig: [
      { buybackPercentage: 85, buybackExpiredInSeconds: 600 },
      { buybackPercentage: 70, buybackExpiredInSeconds: 86400 },
    ],
  };
}
function expectation() {
  return {
    packId,
    onChainPackId: `0x${'66'.repeat(32)}` as const,
    priceInUsdt: BigInt(amount),
    quantity: 1,
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
      tier: 'S',
      buybackBaseValueInUSD: '1000',
      collectible: {
        type: 'POKEMON',
        name: 'Pokémon',
        frontImageUrl: 'https://test.example/front.png',
        fmvInUsd: '1100',
        fmvUpdatedAt: '2026-10-14T00:00:00.000Z',
        attributes: [
          { key: 'Grader', value: 'PSA' },
          { key: 'Grade', value: '10 Gem Mint' },
        ],
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
      type: 'POKEMON',
      fmvInUsd: '9007199254740995',
      fmvUpdatedAt: '2026-10-14T00:00:00.000Z',
      attributes: [{ key: 'Cert Number', value: '12345678' }],
    };
    const pagination = { total: 1, limit: 20, offset: 0, hasMore: false };
    const contentQueries: URLSearchParams[] = [];
    const fetch = vi.fn(async (url: string | URL | Request) => {
      const { pathname: path, searchParams } = new URL(String(url));
      if (path.endsWith('/content')) {
        contentQueries.push(searchParams);
        return Response.json({ collectibles: [card], pagination });
      }
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
    await client
      .listGachaMachineContents({
        slug: 'test-pack',
        tiers: [GachaMachineTierName.S, GachaMachineTierName.A],
      })
      .firstPage();
    // No tier filter unless asked; several tiers go comma-separated.
    expect(contentQueries.map((query) => query.get('tier'))).toEqual([
      null,
      'S,A',
    ]);
    expect(
      value(await client.fetchGachaMachine({ slug: 'test-pack' }))
        .buybackConfig,
    ).toEqual(machine.buybackConfig);
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
    // The frozen values sit on the draw; the collectible says what it is.
    expect(result.draws[0]?.tier).toBe('S');
    expect(result.draws[0]?.collectible.attributes).toEqual(
      resolved.draws[0]?.collectible.attributes,
    );
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
  // An offer lists every tier; the first whose end has not passed prices it.
  const tieredOffer = (
    n: number,
    tiers: { endsInMs: number; amountInUsdt: string }[],
  ) => ({
    cardPackId: packId,
    settlementId: `0x${String(n).repeat(64)}`,
    tokenId: String(n),
    vendingMachineAddress: tvm,
    buybackTiers: tiers.map((tier, index) => ({
      buybackPercentage: 90 - index * 10,
      amountInUsdt: tier.amountInUsdt,
      expiresAt: new Date(Date.now() + tier.endsInMs).toISOString(),
    })),
  });
  it('keeps the ending tier at its exact expiry and advances 1 ms later', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const offer = tieredOffer(1, [
      { endsInMs: 1_000, amountInUsdt: '90' },
      { endsInMs: 60_000, amountInUsdt: '75' },
    ]);
    expect(getEoaBuybackTierAt(offer, now + 1_000)).toEqual(
      offer.buybackTiers[0],
    );
    expect(getEoaBuybackTierAt(offer, now + 1_001)).toEqual(
      offer.buybackTiers[1],
    );
    expect(getEoaBuybackTierAt(offer, now + 60_001)).toBeUndefined();
  });
  it('ends the payable offer at the last positive tier, before a zero hold', () => {
    const offer = tieredOffer(1, [
      { endsInMs: 1_000, amountInUsdt: '90' },
      { endsInMs: 60_000, amountInUsdt: '75' },
      { endsInMs: 120_000, amountInUsdt: '0' },
    ]);
    expect(getEoaBuybackOfferEndsAt(offer)).toBe(
      offer.buybackTiers[1]?.expiresAt,
    );
    expect(getEoaBuybackOfferEndsAt(tieredOffer(1, []))).toBeUndefined();
    expect(
      getEoaBuybackOfferEndsAt(
        tieredOffer(1, [{ endsInMs: 60_000, amountInUsdt: '0' }]),
      ),
    ).toBeUndefined();
  });
  it('signs the ending tier price at its exact expiry', async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const offer = tieredOffer(1, [
      { endsInMs: 1_000, amountInUsdt: '90' },
      { endsInMs: 60_000, amountInUsdt: '75' },
    ]);
    clock.mockReturnValue(now + 1_000);
    const result = value(
      await createGachaClient({
        baseUrl: 'https://test.example',
        signer,
        expectedChainId: 97,
      }).createGachaBuyback({
        buyerWalletAddress: account.address,
        chainId: 97,
        token,
        expectedAmountInUsdt: '90',
        offers: [offer],
      }),
    );
    expect(result.buybackAuth.amount).toBe('90');
  });
  it("signs the price of each offer's current tier", async () => {
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
        expectedAmountInUsdt: '150',
        offers: [1, 2].map((n) =>
          tieredOffer(n, [
            { endsInMs: -60_000, amountInUsdt: '90' },
            { endsInMs: 600_000, amountInUsdt: '75' },
            { endsInMs: 86_400_000, amountInUsdt: '50' },
          ]),
        ),
      }),
    );
    // The ended 90 tier and the later 50 tier are not signed.
    expect(result.buybackAuth.amount).toBe('150');
  });
  it('refuses a changed buyback quote before requesting a signature', async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const offers = [1, 2].map((n) =>
      tieredOffer(n, [
        { endsInMs: 1_000, amountInUsdt: '90' },
        { endsInMs: 60_000, amountInUsdt: '75' },
      ]),
    );
    const signTypedData = vi.spyOn(signer, 'signTypedData');
    clock.mockReturnValue(now + 1_001);
    const result = await createGachaClient({
      baseUrl: 'https://test.example',
      signer,
      expectedChainId: 97,
    }).createGachaBuyback({
      buyerWalletAddress: account.address,
      chainId: 97,
      token,
      expectedAmountInUsdt: '180',
      offers,
    });
    expect(isFailed(result) && getError(result).code).toBe(
      'WRONG_REQUEST_PARAMS',
    );
    expect(signTypedData).not.toHaveBeenCalled();
  });
  it.each([
    {
      name: 'every tier has ended',
      tiers: [{ endsInMs: -60_000, amountInUsdt: '90' }],
    },
    {
      name: 'the current tier pays nothing',
      tiers: [
        { endsInMs: 600_000, amountInUsdt: '0' },
        { endsInMs: 86_400_000, amountInUsdt: '50' },
      ],
    },
  ])('refuses an offer when $name', async ({ tiers }) => {
    const result = await createGachaClient({
      baseUrl: 'https://test.example',
      signer,
      expectedChainId: 97,
    }).createGachaBuyback({
      buyerWalletAddress: account.address,
      chainId: 97,
      token,
      expectedAmountInUsdt: '90',
      offers: [tieredOffer(1, tiers)],
    });
    expect(isFailed(result) && getError(result).code).toBe(
      'WRONG_REQUEST_PARAMS',
    );
  });
  it('sums compatible buybacks exactly and rejects duplicate settlement IDs', async () => {
    const offers = [1, 2].map((n) =>
      tieredOffer(n, [{ endsInMs: 600_000, amountInUsdt: amount }]),
    );
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
        expectedAmountInUsdt: (BigInt(amount) * 2n).toString(),
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
      expectedAmountInUsdt: (BigInt(amount) * 2n).toString(),
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

// Shaped like the testnet API's own responses.
const walletPath = `/v2/users/${account.address.toLowerCase()}`;
const collectionCard = {
  tokenId:
    '9290192362618583476986046631910600140719430898595863842444180055985504940147',
  name: 'PSA 8 NM-MT 2025 Pokemon Japanese M1l-Mega Brave #68 Riolu',
  type: 'POKEMON',
  frontImageUrl: 'https://test.example/renders/nft_image_silver.jpg',
  fmvInUsd: '2200',
  fmvUpdatedAt: '2026-09-29T00:00:00.000Z',
  attributes: [
    { key: 'Grader', value: 'PSA' },
    { key: 'Grade', value: '8 NM-MT' },
    { key: 'Year', value: '2025' },
  ],
};
const cardPull = {
  packId,
  packName: 'PANDORA 28',
  permitFundTxHash: `0x${'71'.repeat(32)}`,
  pulledAt: '2026-09-29T05:26:07.000Z',
};
// One card per state: bought on the market, pulled and in its window, pulled and waiting.
const heldCards = [
  { ...collectionCard, state: { status: 'IN_WALLET' }, pull: null },
  {
    ...collectionCard,
    state: {
      status: 'IN_BUYBACK_WINDOW',
      buybackAmountInUsdt: '17000000000000000000',
      buybackExpiresAt: '2026-09-29T05:36:07.000Z',
    },
    pull: cardPull,
  },
  {
    ...collectionCard,
    fmvInUsd: null,
    fmvUpdatedAt: null,
    state: { status: 'AWAITING_DELIVERY' },
    pull: cardPull,
  },
];
function builderClient() {
  return createGachaClient({
    baseUrl: 'https://test.example',
    builderApiKey: 'test-builder',
  });
}

describe('v2 pull quantity', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  function threeCards() {
    const input = prepared();
    const typed = {
      amountPerToken: amount,
      builderCode: input.unsignedPullPayload.builderCode,
      chainId: 97,
      deadline: input.unsignedPullPayload.deadline,
      nonce: '123',
      numOfTokens: 3,
      onChainPackId: input.pack.onChainPackId,
      permit2Address: spender,
      usdtAddress: token,
      vendingMachineAddress: tvm,
    };
    return {
      ...input,
      approval: {
        ...input.approval,
        requiredAmount: String(BigInt(amount) * 3n),
      },
      unsignedPullPayload: { ...input.unsignedPullPayload, numOfTokens: 3 },
      permit2TypedData: buildGachaPullTypedData(typed),
    };
  }
  it('prepares and signs a pull of three cards for three times the price', async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (!url.endsWith('/prepare'))
          return Response.json({ cardPack: machineDetail() });
        bodies.push(JSON.parse(String(init?.body)));
        return Response.json(threeCards());
      }),
    );
    const client = createGachaClient({
      baseUrl: 'https://test.example',
      signer,
      expectedChainId: 97,
    });
    const result = value(
      await client.prepareGachaPull({
        machineSlug: 'test-pack',
        buyerWalletAddress: account.address,
        expectedPriceInUsdt: BigInt(amount),
        quantity: 3,
      }),
    );
    expect(bodies).toEqual([
      { packId, buyerWalletAddress: account.address, quantity: 3 },
    ]);
    expect(result.unsignedPullPayload.numOfTokens).toBe(3);
    expect(result.approval.requiredAmount).toBe(String(BigInt(amount) * 3n));
    const pull = value(
      await client.signGachaPull({
        prepared: result,
        expected: { ...expectation(), quantity: 3 },
      }),
    );
    expect(pull.numOfTokens).toBe(3);
    expect(
      await recoverTypedDataAddress({
        ...result.permit2TypedData,
        signature: pull.permitSignature as Hex,
      }),
    ).toBe(account.address);
  });
  it('refuses a prepared pull whose quantity is not the one reviewed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        Response.json(
          url.endsWith('/prepare')
            ? threeCards()
            : { cardPack: machineDetail() },
        ),
      ),
    );
    const result = await createGachaClient({
      baseUrl: 'https://test.example',
      signer,
    }).prepareGachaPull({
      machineSlug: 'test-pack',
      buyerWalletAddress: account.address,
      expectedPriceInUsdt: BigInt(amount),
      quantity: 2,
    });
    expect(isFailed(result) && getError(result).code).toBe('INVALID_SCHEMA');
  });
  it.each([
    0, 11, 2.5, -1,
  ])('refuses quantity %s before any request', async (quantity) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const result = await createGachaClient({
      baseUrl: 'https://test.example',
      signer,
    }).prepareGachaPull({
      machineSlug: 'test-pack',
      buyerWalletAddress: account.address,
      expectedPriceInUsdt: BigInt(amount),
      quantity,
    });
    expect(isFailed(result) && getError(result).code).toBe(
      'WRONG_REQUEST_PARAMS',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('v2 wallet cards, totals and activities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it('lists the cards with a sort, page by page, with the builder key', async () => {
    const requests: Request[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const request = new Request(input, init);
        requests.push(request);
        const offset = Number(new URL(input).searchParams.get('offset'));
        return Response.json({
          collectibles: [heldCards[offset]],
          pagination: { limit: 1, offset, hasMore: offset < 2, total: 3 },
        });
      }),
    );
    const pages = [];
    for await (const result of builderClient().listWalletCollection({
      walletAddress: account.address,
      sortBy: EoaCollectionSort.BuybackExpiry,
      sortOrder: EoaSortOrder.Ascending,
      pageSize: 1,
    }))
      pages.push(value(result));
    expect(pages.map((page) => page.totalCount)).toEqual([3, 3, 3]);
    expect(pages.flatMap((page) => page.items)).toEqual(heldCards);
    const [bought] = pages[0]?.items ?? [];
    expect(bought?.state.status).toBe(EoaCollectionCardStatus.InWallet);
    expect(bought?.pull).toBeNull();
    const [card] = pages[1]?.items ?? [];
    if (card?.state.status !== EoaCollectionCardStatus.InBuybackWindow)
      throw new Error('Expected a card in its buyback window');
    expect(card.state.buybackAmountInUsdt).toBe('17000000000000000000');
    expect(card.pull?.packName).toBe('PANDORA 28');
    expect(
      requests.map((request) =>
        Object.fromEntries(new URL(request.url).searchParams),
      ),
    ).toEqual(
      ['0', '1', '2'].map((offset) => ({
        sortBy: 'buybackExpiresAt',
        sortOrder: 'asc',
        offset,
        limit: '1',
      })),
    );
    // The address is in the path, in lowercase, whatever case the caller has.
    expect(account.address).not.toBe(account.address.toLowerCase());
    expect(new URL(requests[0]?.url ?? '').pathname).toBe(
      `${walletPath}/collectibles`,
    );
    expect(requests[0]?.headers.get('x-builder-api-key')).toBe('test-builder');
  });
  it('sends no sort unless asked, so the API defaults apply', async () => {
    const urls: URL[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        urls.push(new URL(input));
        return Response.json({
          collectibles: [],
          pagination: { limit: 20, offset: 0, hasMore: false, total: 0 },
        });
      }),
    );
    const page = value(
      await builderClient()
        .listWalletCollection({ walletAddress: account.address })
        .firstPage(),
    );
    expect(page).toMatchObject({ items: [], totalCount: 0, hasMore: false });
    expect([...(urls[0]?.searchParams.keys() ?? [])].sort()).toEqual([
      'limit',
      'offset',
    ]);
  });
  it.each([
    ['a search, which the API does not have', { search: 'riolu' }],
    ['an unknown sort', { sortBy: 'costInUsd' }],
    ['an unknown direction', { sortOrder: 'up' }],
    ["a builder of the caller's choosing", { builderCode: hash }],
    ['the field of the builder-scoped reads', { buyerWalletAddress: hash }],
    ['a malformed wallet', { walletAddress: '0x1234' }],
  ])('refuses %s before any request', async (_, extra) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const result = await builderClient()
      .listWalletCollection({
        walletAddress: account.address,
        ...extra,
      } as EoaWalletCollectionRequest)
      .firstPage();
    expect(isFailed(result) && getError(result).code).toBe(
      'WRONG_REQUEST_PARAMS',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it('reads the totals as exact strings', async () => {
    const urls: URL[] = [];
    const totals = {
      collectibleCount: 4,
      totalFmvInUsd: '9007199254740993',
      collectiblesWithoutFmv: 1,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        urls.push(new URL(input));
        return Response.json(totals);
      }),
    );
    expect(
      value(
        await builderClient().fetchWalletCollectionSummary({
          walletAddress: account.address,
        }),
      ),
    ).toEqual(totals);
    expect(urls[0]?.pathname).toBe(walletPath);
    expect(urls[0]?.search).toBe('');
  });
  it('lists the activities as chain events and follows the cursor of the API', async () => {
    const urls: URL[] = [];
    const event = {
      user: account.address.toLowerCase(),
      timestamp: '1790659567',
      blockNumber: '133805652',
      txHash: `0x${'c3'.repeat(32)}`,
    };
    const item = {
      tokenId: collectionCard.tokenId,
      imageUrl: collectionCard.frontImageUrl,
      title: 'Riolu',
      subtitle: 'PSA 8 NM-MT',
    };
    const contract = '0x7777777777777777777777777777777777777777';
    const first = [
      {
        ...event,
        type: 'gacha-v3-pull',
        contractAddress: contract,
        packId: hash,
        token: contract,
        checkoutIds: ['41', '42', '43'],
        totalAmount: '144000000000000000000',
        blockHash: hash,
      },
      {
        ...event,
        type: 'gacha-v3-buyback',
        contractAddress: contract,
        buybackIds: [hash],
        token: contract,
        priceInUsdt: '17000000000000000000',
      },
    ];
    const second = [
      {
        ...event,
        item,
        type: 'sell',
        bidder: contract,
        asker: event.user,
        nftTokenId: item.tokenId,
        erc20Token: contract,
        amount: '30000000000000000000',
        feeAccrued: '600000000000000000',
      },
      { ...event, item, type: 'transfer', to: contract, tokenId: item.tokenId },
      { ...event, item, type: 'mint', tokenAmount: '1', tokenId: item.tokenId },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = new URL(input);
        urls.push(url);
        return Response.json(
          url.searchParams.has('cursor')
            ? { activities: second, nextCursor: null }
            : { activities: first, nextCursor: '133805652000072' },
        );
      }),
    );
    const pages = [];
    for await (const result of builderClient().listWalletActivities({
      walletAddress: account.address,
      pageSize: 2,
    }))
      pages.push(value(result));
    expect(pages.map((page) => page.items)).toEqual([first, second]);
    expect(pages.map((page) => [page.hasMore, page.nextCursor])).toEqual([
      [true, '133805652000072'],
      [false, undefined],
    ]);
    const paid = pages.flatMap((page) =>
      page.items.flatMap((activity) =>
        activity.type === EoaActivityType.GachaV3Buyback
          ? [activity.priceInUsdt]
          : activity.type === EoaActivityType.Sell
            ? [activity.amount]
            : [],
      ),
    );
    expect(paid).toEqual(['17000000000000000000', '30000000000000000000']);
    expect(urls.map((url) => url.pathname)).toEqual([
      `${walletPath}/activities`,
      `${walletPath}/activities`,
    ]);
    expect(urls.map((url) => Object.fromEntries(url.searchParams))).toEqual([
      { limit: '2' },
      { cursor: '133805652000072', limit: '2' },
    ]);
  });
  it('fails on an activity type the API no longer serves', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          activities: [
            {
              user: account.address.toLowerCase(),
              timestamp: '1790659567',
              blockNumber: '133805652',
              txHash: hash,
              type: 'perp-pull',
            },
          ],
          nextCursor: null,
        }),
      ),
    );
    const result = await builderClient()
      .listWalletActivities({ walletAddress: account.address })
      .firstPage();
    expect(isFailed(result) && getError(result).code).toBe('INVALID_SCHEMA');
  });
  it('keeps one kind of activity with a filter', async () => {
    const urls: URL[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        urls.push(new URL(input));
        return Response.json({ activities: [], nextCursor: null });
      }),
    );
    const page = value(
      await builderClient()
        .listWalletActivities({
          walletAddress: account.address,
          filter: EoaActivityFilter.GachaV3Buyback,
        })
        .firstPage(),
    );
    expect(page).toEqual({ items: [], hasMore: false, nextCursor: undefined });
    expect(Object.fromEntries(urls[0]?.searchParams ?? [])).toEqual({
      filter: 'gacha-v3-buyback',
      limit: '20',
    });
  });
  it.each([
    ['an unknown filter', { filter: 'everything' }, undefined],
    ['a retired filter', { filter: 'perp-pull' }, undefined],
    ['a page over 50', { pageSize: 51 }, undefined],
    ['the type of the builder-scoped read', { type: 'buyback' }, undefined],
    ['a cursor that is not from the API', {}, 'eyJvZmZzZXQiOjF9'],
  ])('refuses %s before any request', async (_, extra, cursor) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const result = await builderClient()
      .listWalletActivities({
        walletAddress: account.address,
        ...extra,
      } as EoaWalletActivitiesRequest)
      .from(cursor)
      .firstPage();
    expect(isFailed(result) && getError(result).code).toBe(
      'WRONG_REQUEST_PARAMS',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    [
      'a card state it does not know',
      () =>
        builderClient()
          .listWalletCollection({ walletAddress: account.address })
          .firstPage(),
      {
        collectibles: [{ ...heldCards[0], state: { status: 'SOLD' } }],
        pagination: { limit: 20, offset: 0, hasMore: false, total: 1 },
      },
    ],
    [
      'an activity type it does not know',
      () =>
        builderClient()
          .listWalletActivities({ walletAddress: account.address })
          .firstPage(),
      {
        activities: [{ type: 'airdrop', user: account.address }],
        nextCursor: null,
      },
    ],
  ])('reports %s as INVALID_SCHEMA', async (_, read, body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(body)),
    );
    const result = await read();
    expect(isFailed(result) && getError(result).code).toBe('INVALID_SCHEMA');
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
    vendingMachineAddress: tvm,
    buybackTiers: [
      {
        buybackPercentage: 90,
        amountInUsdt: amount,
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      },
    ],
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

describe('v2 draw status', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it('reads each draw with its values and collectible, and nulls for what could not be loaded', async () => {
    const [loaded] = resolved.draws;
    const status = {
      permitFundTxHash: hash,
      buyerWalletAddress: account.address.toLowerCase(),
      packId,
      packName: 'Test',
      status: 'RESOLVED',
      numOfTokens: 2,
      pulledAt: resolved.pulledAt,
      draws: [
        loaded,
        {
          ...loaded,
          settlementId: `0x${'89'.repeat(32)}`,
          tier: null,
          buybackBaseValueInUSD: null,
          collectible: null,
        },
      ],
    };
    const urls: URL[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        urls.push(new URL(input));
        return Response.json(status);
      }),
    );
    expect(
      value(
        await builderClient().fetchGachaDrawStatus({
          buyerWalletAddress: account.address,
          permitFundTxHash: hash,
        }),
      ),
    ).toEqual(status);
    expect(urls[0]?.pathname).toBe('/v2/gacha/draw-status');
  });
});
