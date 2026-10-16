import {
  getError,
  getValue,
  isFailed,
  type Result,
} from '@renaiss-protocol/fp';
import {
  createWalletClient,
  http,
  recoverTypedDataAddress,
  type TypedDataDefinition,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BNB_MAINNET,
  BNB_TESTNET,
  createMarketplaceClient,
  isCreateAskError,
  isListMarketplaceCardsError,
  MarketplacePriceRange,
  MarketplaceV2Sort,
  type RenaissNetwork,
} from '../index';
import { signerFrom } from '../viem';

// Publicly known test key: it must never hold funds.
const account = privateKeyToAccount(`0x${'17'.repeat(32)}`);
const signer = signerFrom(
  createWalletClient({ account, transport: http('http://unused.test') }),
);
const id = '11111111-1111-4111-8111-111111111111';
const contract = BNB_TESTNET.marketplace.contracts.orderbook;
const amount = '9007199254740993123000000000000000';
const tokenId = '9007199254740993123';
function value<T>(result: Result<T>): T {
  if (isFailed(result)) throw new Error(JSON.stringify(getError(result)));
  return getValue(result);
}
function ask(network: RenaissNetwork = BNB_TESTNET) {
  const data = {
    salt: '0x12345678',
    owner: account.address,
    tokenId,
    usdcAmount: amount,
    deadline: String(Math.floor(Date.now() / 1000) + 600),
  };
  return {
    operation: 'ask',
    collectibleId: id,
    tokenId,
    sellerWalletAddress: account.address,
    quote: {
      sellerReceivesInUsdt: String(
        (BigInt(amount) * 10000n) /
          (10000n + BigInt(network.marketplace.platformFeeBps)),
      ),
      totalPriceInUsdt: amount,
      platformFeeInUsdt: String(
        BigInt(amount) -
          (BigInt(amount) * 10000n) /
            (10000n + BigInt(network.marketplace.platformFeeBps)),
      ),
      expiresAt: new Date(Number(data.deadline) * 1000).toISOString(),
    },
    payload: { collectibleId: id, askData: data },
    typedData: {
      domain: {
        name: 'Orderbook',
        version: '1',
        chainId: network.chainId,
        verifyingContract: network.marketplace.contracts.orderbook,
      },
      primaryType: 'Ask',
      types: {
        Ask: [
          { name: 'salt', type: 'bytes4' },
          { name: 'deadline', type: 'uint256' },
          { name: 'usdcAmount', type: 'uint256' },
          { name: 'owner', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
        ],
      },
      message: { ...data },
    },
  };
}
function bid(network: RenaissNetwork = BNB_TESTNET) {
  const data = {
    bidder: account.address,
    feeBps: String(network.marketplace.platformFeeBps),
    tokenId,
    amount,
    nonce: '1',
    deadline: String(Math.floor(Date.now() / 1000) + 600),
  };
  return {
    operation: 'bid',
    collectibleId: id,
    tokenId,
    buyerWalletAddress: account.address,
    quote: {
      amountInUsdt: amount,
      expiresAt: new Date(Number(data.deadline) * 1000).toISOString(),
    },
    payload: { collectibleId: id, bidData: data },
    typedData: {
      domain: {
        name: 'Permit2',
        chainId: network.chainId,
        verifyingContract: network.marketplace.contracts.permit2,
      },
      primaryType: 'PermitWitnessTransferFrom',
      types: {
        PermitWitnessTransferFrom: [
          { name: 'permitted', type: 'TokenPermissions' },
          { name: 'spender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'witness', type: 'Bid' },
        ],
        TokenPermissions: [
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        Bid: [
          { name: 'bidder', type: 'address' },
          { name: 'feeBps', type: 'uint256' },
          { name: 'tokenId', type: 'uint256' },
        ],
      },
      message: {
        permitted: { token: network.marketplace.contracts.usdt, amount },
        spender: network.marketplace.contracts.orderbook,
        nonce: data.nonce,
        deadline: data.deadline,
        witness: { bidder: data.bidder, feeBps: data.feeBps, tokenId },
      },
    },
  };
}
function client() {
  return createMarketplaceClient({
    baseUrl: 'https://api.example',
    // Format examples, not real keys.
    builderApiKey: 'rnbldr_live_fixture',
    signer,
    expectedChainId: 97,
  });
}
// Synthetic responses isolate the signing and credential boundaries.
describe('v2 marketplace boundaries', () => {
  it.each([
    BNB_TESTNET,
    BNB_MAINNET,
  ])('signs against the selected network ($chainId)', async (network) => {
    const prepared = ask(network);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/prepare')) return Response.json(prepared);
        return Response.json({
          operation: 'ask',
          orderId: id,
          status: 'ACTIVE',
          executed: false,
        });
      }),
    );
    const signing = vi.spyOn(signer, 'signTypedData');
    try {
      const c = createMarketplaceClient({
        baseUrl: 'https://api.example',
        signer,
        network,
      });
      expect(
        isFailed(
          await c.createAsk({ tokenId, totalPriceInUsdt: BigInt(amount) }),
        ),
      ).toBe(false);
      expect(signing).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: expect.objectContaining({
            chainId: network.chainId,
            verifyingContract: network.marketplace.contracts.orderbook,
          }),
        }),
      );
    } finally {
      signing.mockRestore();
    }
  });
  it.each([
    'chain',
    'token',
    'spender',
    'contract',
    'fee',
  ])('rejects a mainnet bid with an altered %s before signing', async (change) => {
    const prepared = bid(BNB_MAINNET);
    if (change === 'chain') prepared.typedData.domain.chainId = 97;
    if (change === 'token')
      prepared.typedData.message.permitted.token =
        BNB_TESTNET.marketplace.contracts.usdt;
    if (change === 'spender')
      prepared.typedData.message.spender =
        BNB_TESTNET.marketplace.contracts.orderbook;
    if (change === 'contract')
      prepared.typedData.domain.verifyingContract = contract;
    if (change === 'fee') {
      prepared.payload.bidData.feeBps = '9000';
      prepared.typedData.message.witness.feeBps = '9000';
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(prepared)),
    );
    const signing = vi.fn();
    const c = createMarketplaceClient({
      baseUrl: 'https://api.example',
      network: BNB_MAINNET,
      signer: { ...signer, signTypedData: signing },
    });
    expect(
      isFailed(await c.createBid({ tokenId, amountInUsdt: BigInt(amount) })),
    ).toBe(true);
    expect(signing).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it('reads a collectible with its attributes and no FMV', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(new URL(url).pathname).toBe(
          `/v2/marketplace/collectibles/${tokenId}`,
        );
        return Response.json({
          collectible: {
            tokenId,
            name: 'Card',
            ownerAddress: account.address,
            askPriceInUSDT: 'NO-ASK-PRICE',
            fmvInUsd: 'NO-FMV-PRICE',
            fmvUpdatedAt: null,
            frontImageUrl: 'https://example.com/slab.png',
            type: 'POKEMON',
            attributes: [
              { key: 'Grader', value: 'PSA' },
              { key: 'Year', value: '2025' },
            ],
            owner: null,
          },
          pricing: { top_offer: null, last_sale: null, price_history: [] },
        });
      }),
    );
    const card = value(await client().fetchCard({ tokenId }));
    expect(card).toMatchObject({
      type: 'POKEMON',
      askPriceInUsdt: null,
      fmvInUsd: null,
      backImageUrl: null,
      attributes: [
        { key: 'Grader', value: 'PSA' },
        { key: 'Year', value: '2025' },
      ],
    });
  });
  it.each([
    '2021-2025',
    '2026+',
  ])('sends public filters (%s) without builder credentials and preserves precise card prices and images', async (yearRange) => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      expect(new Headers(init?.headers).has('x-builder-api-key')).toBe(false);
      expect(u.pathname).toBe('/v2/marketplace');
      expect(u.searchParams.get('sortBy')).toBe('priceRange');
      expect(u.searchParams.get('characterFilter')).toBe('Pikachu');
      expect(u.searchParams.get('listedOnly')).toBe('false');
      expect(u.searchParams.get('priceRangeFilter')).toBe('<$100');
      expect(u.searchParams.get('yearRange')).toBe(yearRange);
      return Response.json({
        collection: [
          {
            tokenId,
            name: 'Card',
            ownerAddress: account.address,
            askPriceInUSDT: amount,
            fmvInUsd: '9007199254740993123',
            fmvUpdatedAt: null,
            frontImageUrl: 'https://example.com/slab.png',
          },
        ],
        pagination: {
          total: 2,
          limit: 1,
          offset: Number(u.searchParams.get('offset')),
          hasMore: u.searchParams.get('offset') === '0',
        },
      });
    });
    vi.stubGlobal('fetch', fetch);
    const pages = client().listMarketplaceCards({
      pageSize: 1,
      sortBy: MarketplaceV2Sort.Price,
      character: 'Pikachu',
      listedOnly: false,
      priceRange: MarketplacePriceRange.UpTo100,
      yearRange,
    });
    const first = value(await pages.firstPage());
    expect(first.items[0]?.askPriceInUsdt).toBe(amount);
    expect(first.items[0]?.frontImageUrl).toContain('slab');
    expect(first.items[0]?.fmvInUsd).toBe('9007199254740993123');
    expect(first.nextCursor).toBeDefined();
    const all = [];
    for await (const page of pages) all.push(value(page));
    expect(all).toHaveLength(2);
  });
  it('signs an ask directly with the EOA, directly, and submits once', async () => {
    const prepared = ask();
    let submissions = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(new Headers(init?.headers).get('x-builder-api-key')).toBe(
          'rnbldr_live_fixture',
        );
        const body = JSON.parse(String(init?.body));
        if (url.endsWith('/prepare')) {
          expect(body.walletAddress).toBe(account.address.toLowerCase());
          return Response.json(prepared);
        }
        submissions++;
        const recovered = await recoverTypedDataAddress({
          ...(prepared.typedData as TypedDataDefinition),
          signature: body.askSignature,
        });
        expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
        return Response.json({
          operation: 'ask',
          orderId: id,
          status: 'ACTIVE',
          executed: false,
        });
      }),
    );
    const result = value(
      await client().createAsk({ tokenId, totalPriceInUsdt: BigInt(amount) }),
    );
    expect(result.quote.totalPriceInUsdt).toBe(amount);
    expect(submissions).toBe(1);
  });
  it.each([
    'chain',
    'amount',
    'wallet',
    'message',
  ])('rejects a mismatched prepared %s before signing', async (change) => {
    const prepared = ask();
    if (change === 'chain') prepared.typedData.domain.chainId = 56;
    if (change === 'amount') prepared.payload.askData.usdcAmount = '1';
    if (change === 'wallet') prepared.sellerWalletAddress = contract;
    if (change === 'message') prepared.typedData.message.tokenId = '999';
    const fetch = vi.fn(async () => Response.json(prepared));
    vi.stubGlobal('fetch', fetch);
    const signing = vi.fn();
    const c = createMarketplaceClient({
      baseUrl: 'https://api.example',
      builderApiKey: 'rnbldr_live_fixture',
      signer: { ...signer, signTypedData: signing },
      expectedChainId: 97,
    });
    const result = await c.createAsk({
      tokenId,
      totalPriceInUsdt: BigInt(amount),
    });
    expect(isFailed(result)).toBe(true);
    expect(signing).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    false,
    true,
  ])('pins seller-receives asks to the configured fee (tampered=%s)', async (tampered) => {
    const prepared = ask();
    const total = (BigInt(amount) * 10200n) / 10000n;
    prepared.quote = {
      ...prepared.quote,
      sellerReceivesInUsdt: amount,
      totalPriceInUsdt: String(total),
      platformFeeInUsdt: String(total - BigInt(amount)),
    };
    prepared.payload.askData.usdcAmount = String(total);
    prepared.typedData.message.usdcAmount = String(total);
    if (tampered) {
      prepared.quote.totalPriceInUsdt = '1';
      prepared.quote.platformFeeInUsdt = '0';
      prepared.payload.askData.usdcAmount = '1';
      prepared.typedData.message.usdcAmount = '1';
    }
    const signing = vi.spyOn(signer, 'signTypedData');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/prepare')
          ? Response.json(prepared)
          : Response.json({
              operation: 'ask',
              orderId: id,
              status: 'ACTIVE',
              executed: false,
            }),
      ),
    );
    const result = await client().createAsk({
      tokenId,
      sellerReceivesInUsdt: BigInt(amount),
    });
    expect(isFailed(result)).toBe(tampered);
    expect(signing).toHaveBeenCalledTimes(tampered ? 0 : 1);
    signing.mockRestore();
  });
  it.each([
    false,
    true,
  ])('binds a sale to the reviewed bid price (tampered=%s)', async (tampered) => {
    const base = ask();
    const prepared = {
      ...base,
      operation: 'sell',
      payload: { ...base.payload, bidOrderId: id },
      quote: {
        ...base.quote,
        bidOrderId: id,
        bidderWalletAddress: contract,
        amountInUsdt: amount,
      },
    };
    if (tampered) {
      prepared.quote.totalPriceInUsdt = '1';
      prepared.quote.amountInUsdt = '1';
      prepared.quote.sellerReceivesInUsdt = '0';
      prepared.quote.platformFeeInUsdt = '1';
      prepared.payload.askData.usdcAmount = '1';
      prepared.typedData.message.usdcAmount = '1';
    }
    const signing = vi.spyOn(signer, 'signTypedData');
    const fetch = vi.fn(async (url: string, _init?: RequestInit) =>
      url.endsWith('/prepare')
        ? Response.json(prepared)
        : Response.json({
            operation: 'sell',
            orderId: id,
            status: 'EXECUTED',
            executed: true,
          }),
    );
    vi.stubGlobal('fetch', fetch);
    const result = await client().acceptBid({
      tokenId,
      bidId: id,
      expectedTotalPriceInUsdt: BigInt(amount),
    });
    expect(isFailed(result)).toBe(tampered);
    expect(signing).toHaveBeenCalledTimes(tampered ? 0 : 1);
    expect(
      JSON.parse(String(fetch.mock.calls[0]?.[1]?.body ?? '{}')),
    ).not.toHaveProperty('expectedTotalPriceInUsdt');
    signing.mockRestore();
  });
  it.each([
    'ask',
    'bid',
  ])('refuses altered %s types before signing', async (kind) => {
    const prepared = kind === 'ask' ? ask() : bid();
    prepared.typedData.types = {} as never;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(prepared)),
    );
    const signing = vi.spyOn(signer, 'signTypedData');
    const result =
      kind === 'ask'
        ? await client().createAsk({
            tokenId,
            totalPriceInUsdt: BigInt(amount),
          })
        : await client().createBid({ tokenId, amountInUsdt: BigInt(amount) });
    expect(isFailed(result)).toBe(true);
    expect(signing).not.toHaveBeenCalled();
    signing.mockRestore();
  });
  it('requires the displayed buy price before I/O', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    // Runtime JS callers receive a Result too.
    const result = await client().buyCard({ tokenId } as never);
    expect(isFailed(result)).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('retains upstream failure detail behind stable action error guards', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { code: 'API_AUTH_INVALID_ACTION', error: 'Wrong wallet signature' },
          { status: 403 },
        ),
      ),
    );
    const result = await client().createAsk({
      tokenId,
      totalPriceInUsdt: BigInt(amount),
    });
    expect(isFailed(result)).toBe(true);
    if (!isFailed(result)) return;
    expect(isCreateAskError(getError(result))).toBe(true);
    expect(getError(result)).toMatchObject({
      code: 'MARKETPLACE_V2_REQUEST_FAILED',
      status: 403,
      error: { code: 'API_AUTH_INVALID_ACTION' },
    });
  });
  it('validates filters before I/O and exposes the matching read error guard', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const result = await client()
      .listMarketplaceCards({ search: 'ab' })
      .firstPage();
    expect(isFailed(result)).toBe(true);
    if (!isFailed(result)) return;
    expect(isListMarketplaceCardsError(getError(result))).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    { priceRange: 'not-a-band' as MarketplacePriceRange },
    { yearRange: '2025-2021' },
    { yearRange: '2025' },
    { yearRange: '2025-xx' },
    { yearRange: '2025-2026junk' },
  ])('rejects unsupported or malformed ranges before I/O: %j', async (filters) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const result = await client().listMarketplaceCards(filters).firstPage();
    expect(isFailed(result)).toBe(true);
    if (isFailed(result))
      expect(getError(result).code).toBe('WRONG_REQUEST_PARAMS');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not retry an interrupted signed submission', async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/prepare')) return Response.json(ask());
      throw new Error('disconnect');
    });
    vi.stubGlobal('fetch', fetch);
    expect(
      isFailed(
        await client().createAsk({ tokenId, totalPriceInUsdt: BigInt(amount) }),
      ),
    ).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([
    'token',
    'spender',
    'contract',
    'deadline',
    'fee',
  ])('rejects altered Permit2 %s before signing', async (change) => {
    const prepared = bid();
    const wrong = '0x2222222222222222222222222222222222222222';
    if (change === 'token') prepared.typedData.message.permitted.token = wrong;
    if (change === 'spender') prepared.typedData.message.spender = wrong;
    if (change === 'contract')
      prepared.typedData.domain.verifyingContract = wrong;
    if (change === 'deadline') {
      prepared.payload.bidData.deadline = '1';
      prepared.typedData.message.deadline = '1';
    }
    if (change === 'fee') {
      prepared.payload.bidData.feeBps = '9000';
      prepared.typedData.message.witness.feeBps = '9000';
    }
    const fetch = vi.fn(async () => Response.json(prepared));
    vi.stubGlobal('fetch', fetch);
    const signing = vi.fn();
    const c = createMarketplaceClient({
      baseUrl: 'https://api.example',
      signer: { ...signer, signTypedData: signing },
    });
    const result = await c.createBid({ tokenId, amountInUsdt: BigInt(amount) });
    expect(isFailed(result)).toBe(true);
    if (isFailed(result))
      expect(getError(result).code).toBe('WRONG_REQUEST_PARAMS');
    expect(signing).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects an altered ask verifying contract before signing', async () => {
    const prepared = ask();
    prepared.typedData.domain.verifyingContract =
      '0x2222222222222222222222222222222222222222';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(prepared)),
    );
    const signing = vi.fn();
    const c = createMarketplaceClient({
      baseUrl: 'https://api.example',
      signer: { ...signer, signTypedData: signing },
    });
    expect(
      isFailed(
        await c.createAsk({ tokenId, totalPriceInUsdt: BigInt(amount) }),
      ),
    ).toBe(true);
    expect(signing).not.toHaveBeenCalled();
  });
  it('distinguishes an API price conflict from local input validation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { code: 'WRONG_REQUEST_PARAMS', error: 'Ask price changed' },
          { status: 409 },
        ),
      ),
    );
    const result = await client().buyCard({
      tokenId,
      expectedTotalPriceInUsdt: BigInt(amount),
    });
    expect(isFailed(result)).toBe(true);
    if (isFailed(result))
      expect(getError(result)).toMatchObject({
        code: 'MARKETPLACE_V2_REQUEST_FAILED',
        status: 409,
        error: { code: 'WRONG_REQUEST_PARAMS' },
      });
  });
  it.each([
    { offset: -180_000, detail: 'Check the device clock' },
    { offset: 601_000, detail: 'signing window expired' },
  ])('explains marketplace deadline failures ($detail)', async ({
    offset,
    detail,
  }) => {
    const prepared = ask();
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + offset);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(prepared)),
    );
    const signing = vi.spyOn(signer, 'signTypedData');
    const result = await client().createAsk({
      tokenId,
      totalPriceInUsdt: BigInt(amount),
      expiresInSeconds: 600,
    });
    expect(result).toMatchObject({
      _tag: 'Left',
      left: {
        code: 'WRONG_REQUEST_PARAMS',
        detail: expect.stringContaining(detail),
      },
    });
    expect(signing).not.toHaveBeenCalled();
  });
  it('explains a device clock ten minutes ahead before cancelling an order', async () => {
    const deadline = String(Math.floor(Date.now() / 1000) + 300);
    const payload = { orderId: id, walletAddress: account.address, deadline };
    const prepared = {
      payload,
      typedData: {
        domain: {
          name: 'Renaiss Marketplace',
          version: '1',
          chainId: 97,
          verifyingContract: BNB_TESTNET.marketplace.contracts.orderbook,
        },
        primaryType: 'CancelMarketplaceOrder',
        types: {
          CancelMarketplaceOrder: [
            { name: 'orderId', type: 'string' },
            { name: 'owner', type: 'address' },
            { name: 'builderCode', type: 'bytes32' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        message: {
          orderId: id,
          owner: account.address,
          builderCode: `0x${'55'.repeat(32)}`,
          deadline,
        },
      },
    };
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600_000);
    const fetch = vi.fn(async () => Response.json(prepared));
    vi.stubGlobal('fetch', fetch);
    const signing = vi.spyOn(signer, 'signTypedData');
    const result = await client().cancelOrder({ orderId: id });
    expect(result).toMatchObject({
      _tag: 'Left',
      left: {
        code: 'WRONG_REQUEST_PARAMS',
        detail: expect.stringContaining('device clock may be ahead'),
      },
    });
    expect(signing).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledOnce();
  });
  const day = 86_400_000;
  for (const kind of ['ask', 'bid'] as const) {
    it.each([
      { form: 'expiresAt', aheadMs: 181 * day, refused: true },
      { form: 'expiresAt', aheadMs: 180 * day - 60_000, refused: false },
      { form: 'expiresInSeconds', aheadMs: 181 * day, refused: true },
      { form: 'expiresInSeconds', aheadMs: 180 * day, refused: false },
    ])(`caps a ${kind} $form expiry at 180 days (refused=$refused)`, async ({
      form,
      aheadMs,
      refused,
    }) => {
      const expiresAt = new Date(Date.now() + aheadMs);
      const deadline = String(Math.floor(expiresAt.getTime() / 1000));
      const preparedAsk = ask();
      preparedAsk.payload.askData.deadline = deadline;
      preparedAsk.typedData.message.deadline = deadline;
      const preparedBid = bid();
      preparedBid.payload.bidData.deadline = deadline;
      preparedBid.typedData.message.deadline = deadline;
      const fetch = vi.fn(async (url: string) =>
        Response.json(
          url.endsWith('/prepare')
            ? kind === 'ask'
              ? preparedAsk
              : preparedBid
            : {
                operation: kind,
                orderId: id,
                status: 'ACTIVE',
                executed: false,
              },
        ),
      );
      vi.stubGlobal('fetch', fetch);
      const sdk = client();
      const expiry =
        form === 'expiresAt'
          ? { expiresAt: expiresAt.toISOString() }
          : { expiresInSeconds: aheadMs / 1000 };
      const result =
        kind === 'ask'
          ? await sdk.createAsk({
              tokenId,
              totalPriceInUsdt: BigInt(amount),
              ...expiry,
            })
          : await sdk.createBid({
              tokenId,
              amountInUsdt: BigInt(amount),
              ...expiry,
            });
      expect(isFailed(result)).toBe(refused);
      if (isFailed(result))
        expect(getError(result).code).toBe('WRONG_REQUEST_PARAMS');
      expect(fetch).toHaveBeenCalledTimes(refused ? 0 : 2);
    });
  }
  for (const operation of ['ask', 'bid', 'buy', 'sell'] as const) {
    for (const absolute of [false, true]) {
      it.each([
        false,
        true,
      ])(`binds ${operation} expiry (absolute=${absolute}, extended=%s)`, async (extended) => {
        const requested = Math.floor(Date.now() / 1000) + 600;
        const deadline = String(extended ? requested + 365 * 86400 : requested);
        const preparedAsk = ask();
        preparedAsk.payload.askData.deadline = deadline;
        preparedAsk.typedData.message.deadline = deadline;
        const preparedBid = bid();
        preparedBid.payload.bidData.deadline = deadline;
        preparedBid.typedData.message.deadline = deadline;
        const prepared =
          operation === 'ask'
            ? preparedAsk
            : operation === 'bid'
              ? preparedBid
              : operation === 'buy'
                ? { ...preparedBid, operation: 'buy' }
                : {
                    ...preparedAsk,
                    operation: 'sell',
                    payload: { ...preparedAsk.payload, bidOrderId: id },
                    quote: {
                      ...preparedAsk.quote,
                      bidOrderId: id,
                      bidderWalletAddress: contract,
                      amountInUsdt: amount,
                    },
                  };
        vi.stubGlobal(
          'fetch',
          vi.fn(async (url: string) =>
            Response.json(
              url.endsWith('/prepare')
                ? prepared
                : { operation, orderId: id, status: 'ACTIVE', executed: false },
            ),
          ),
        );
        const signing = vi.spyOn(signer, 'signTypedData');
        const expiry = absolute
          ? { expiresAt: new Date(requested * 1000).toISOString() }
          : { expiresInSeconds: 600 };
        const sdk = client();
        const result =
          operation === 'ask'
            ? await sdk.createAsk({
                tokenId,
                totalPriceInUsdt: BigInt(amount),
                ...expiry,
              })
            : operation === 'bid'
              ? await sdk.createBid({
                  tokenId,
                  amountInUsdt: BigInt(amount),
                  ...expiry,
                })
              : operation === 'buy'
                ? await sdk.buyCard({
                    tokenId,
                    expectedTotalPriceInUsdt: BigInt(amount),
                    ...expiry,
                  })
                : await sdk.acceptBid({
                    tokenId,
                    bidId: id,
                    expectedTotalPriceInUsdt: BigInt(amount),
                    ...expiry,
                  });
        expect(isFailed(result)).toBe(extended);
        expect(signing).toHaveBeenCalledTimes(extended ? 0 : 1);
        signing.mockRestore();
      });
    }
  }
});
