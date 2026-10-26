import {
  getValue,
  isFailed,
  isSuccess,
  type Result,
} from '@renaiss-protocol/fp';
import { PreparedRedemptionSchema } from '@renaiss-protocol/schema-validation';
import { hashTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bscTestnet } from 'viem/chains';
import { createSiweMessage } from 'viem/siwe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BNB_MAINNET,
  BNB_TESTNET,
  createRedemptionClient,
  RedemptionCardSort,
  type RedemptionClientOptions,
  RedemptionSortOrder,
  type RenaissNetwork,
} from '../index';
import { privateKey } from '../viem';

// Publicly known test key: it must never hold funds.
const account = privateKeyToAccount(`0x${'7'.repeat(64)}`);
const origin = 'http://localhost:3100';
const walletSessionIssuer = 'https://api.example/v2/auth/wallet';
const shippingContext = {
  builderAppId: '33333333-3333-4333-8333-333333333333',
  issuer: walletSessionIssuer,
  audience: 'https://api.example/v2',
  scopes: ['redeem:read', 'redeem:write'],
};
const address = {
  countryCode: 'US',
  addressLine1: '1 Test St',
  city: 'Test',
  state: 'CA',
  postalCode: '00000',
};
const recipient = {
  name: 'Test User',
  phone: '+12025550123',
  email: 'test@example.com',
};
const requestId = `0x${'aa'.repeat(32)}`;
const signature = `0x${'ab'.repeat(65)}`;
const json = (data: unknown) =>
  new Response(
    JSON.stringify(data, (_, value) =>
      typeof value === 'bigint' ? String(value) : value,
    ),
    { headers: { 'content-type': 'application/json' } },
  );
const orderCard = {
  tokenId: '1',
  name: 'Test Card',
  frontImageUrl: 'https://img.example/1.png',
  rixPriceInUsd: '1000',
};
const listedOrder = {
  requestId,
  status: 'Shipped',
  trackingNumber: 'TRK1',
  shipmentStatus: 'in transit',
  collectibles: [orderCard],
};
const orderDetail = {
  ...listedOrder,
  tokenStatuses: { '1': 'REDEMPTION_VAULT_DISPATCHED' },
  address,
  recipient,
  courierName: 'US domestic shipping',
  estimatedDeliveryDaysMin: 2,
  estimatedDeliveryDaysMax: 5,
  fees: {
    handlingFeeInUsd: '400',
    shippingFeeInUsd: '899',
    insuranceFeeInUsd: '300',
    dutyAndTaxesInUsd: '0',
  },
  trackingUrl: null,
  trackingLastSyncedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: null,
  collectibles: [
    {
      ...orderCard,
      rixPriceUpdatedAt: null,
      regionCountryCode: 'US',
      vaultDisplayName: 'Test Vault',
    },
  ],
};
let requests: { path: string; query: URLSearchParams; init: RequestInit }[];
let listedOrderWire: Record<string, unknown>[];
let listedCollectiblesWire: Record<string, unknown>[];
let challengeOrigin: string;
let challengeEdit: (s: string) => string;
let challengeContext: unknown;
let sessionLifetime: number;
let checkoutFailures: boolean;
function signInMessage(id: string, issuedAt: Date, expirationTime: Date) {
  const { protocol, host } = new URL(challengeOrigin);
  return createSiweMessage({
    scheme: protocol.slice(0, -1),
    domain: host,
    uri: challengeOrigin,
    version: '1',
    address: account.address,
    chainId: 97,
    nonce: 'abcdefgh12345678',
    issuedAt,
    expirationTime,
    requestId: id,
    statement: `Sign in to Renaiss for shipping on ${host}. By signing, you allow ${host} to access your Renaiss shipping and redemption requests for this wallet for up to 7 days (access tokens last 15 minutes and can renew within this session). This does not authorize a transaction.`,
  });
}
function makePreparation(network: RenaissNetwork = BNB_TESTNET) {
  const config = network.redemption;
  const expiry = new Date(Date.now() + 300_000).toISOString();
  const batch = {
    domain: {
      name: 'CollectibleManager',
      version: '1',
      chainId: network.chainId,
      verifyingContract: config.managerAddress,
    },
    primaryType: 'BatchRedemption' as const,
    types: {
      BatchRedemption: [
        { name: 'requestId', type: 'bytes32' },
        { name: 'user', type: 'address' },
        { name: 'tokenIds', type: 'uint256[]' },
        { name: 'salt', type: 'uint256' },
      ],
    },
    message: {
      requestId,
      user: account.address,
      tokenIds: ['1', '2'],
      salt: '9',
    },
  };
  const permit = {
    domain: {
      name: 'Permit2',
      chainId: network.chainId,
      verifyingContract: config.permit2Address,
    },
    primaryType: 'PermitWitnessTransferFrom',
    types: {
      PermitWitnessTransferFrom: [
        { name: 'permitted', type: 'TokenPermissions' },
        { name: 'spender', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'witness', type: 'bytes32' },
      ],
      TokenPermissions: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
    },
    message: {
      permitted: {
        token: config.tokenAddress,
        amount: String(1599n * 10n ** 16n),
      },
      spender: config.cashierAddress,
      nonce: '8',
      deadline: String(Math.floor(Date.parse(expiry) / 1000)),
      witness: hashTypedData(batch as Parameters<typeof hashTypedData>[0]),
    },
  };
  return PreparedRedemptionSchema.parse({
    preparationId: crypto.randomUUID(),
    requestId,
    walletAddress: account.address,
    tokenIds: ['1', '2'],
    expiresAt: expiry,
    address,
    recipient,
    courierName: 'US domestic shipping',
    fees: {
      handlingFeeInUsd: '400',
      shippingFeeInUsd: '899',
      insuranceFeeInUsd: '300',
      dutyAndTaxesInUsd: '0',
      totalFeeInUsdt: String(1599n * 10n ** 16n),
    },
    redemptionTypedData: batch,
    permitTypedData: permit,
  });
}
const expected = {
  tokenIds: [1n, 2n],
  totalFeeInUsdt: 1599n * 10n ** 16n,
  address,
  recipient,
};
beforeEach(() => {
  requests = [];
  listedOrderWire = [];
  listedCollectiblesWire = [];
  challengeEdit = (s) => s;
  challengeContext = { ...shippingContext };
  challengeOrigin = origin;
  sessionLifetime = 900_000;
  checkoutFailures = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = new URL(input);
      const path = url.pathname;
      requests.push({ path, query: url.searchParams, init });
      if (path === '/v2/auth/wallet/nonce') {
        const id = crypto.randomUUID();
        const expires = new Date(Date.now() + 300_000);
        return json({
          challengeId: id,
          expiresAt: expires.toISOString(),
          context: challengeContext,
          message: challengeEdit(signInMessage(id, new Date(), expires)),
        });
      }
      if (
        path === '/v2/auth/wallet/verify' ||
        path === '/v2/auth/wallet/refresh'
      )
        return json({
          tokenType: 'Bearer',
          accessToken: 'rnws_at_fixture',
          refreshToken: 'rnws_rt_fixture',
          expiresAt: new Date(
            Date.now() + (path.endsWith('refresh') ? 900_000 : sessionLifetime),
          ).toISOString(),
          refreshExpiresAt: new Date(Date.now() + 86400_000).toISOString(),
          scopes: ['redeem:read', 'redeem:write'],
        });
      if (path === '/v2/auth/wallet/revoke') return json({ revoked: true });
      if (path === '/v2/redeem/collectibles')
        return json({
          collectibles: listedCollectiblesWire,
          total: listedCollectiblesWire.length,
          page: 1,
          hasMore: false,
        });
      if (path === '/v2/redeem/regions') return json({ counts: { US: 2 } });
      if (path === '/v2/redeem/orders')
        return json({
          orders: listedOrderWire,
          hasMore: Number(url.searchParams.get('offset')) === 0,
        });
      if (path === `/v2/redeem/orders/${requestId}`) return json(orderDetail);
      if (path === '/v2/redeem/checkout') {
        if (checkoutFailures) throw new Error('lost response');
        return json({
          requestId,
          status: 'succeeded',
          transactionHash: requestId,
        });
      }
      if (path.endsWith('/tracking'))
        return new Response('{}', { status: 404 });
      throw new Error(`Unmocked request: ${path}`);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function client(options: Partial<RedemptionClientOptions> = {}) {
  // Publicly known test key: it must never hold funds.
  const signer = privateKey(`0x${'7'.repeat(64)}`, { chain: bscTestnet });
  const sign = vi.spyOn(signer, 'signTypedData');
  const signIn = vi.spyOn(signer, 'signMessage');
  return {
    sdk: createRedemptionClient({
      baseUrl: 'https://api.example',
      // Format examples, not real keys.
      builderApiKey: 'rnbldr_live_fixture',
      signer,
      expectedChainId: 97,
      ...options,
    }),
    signer,
    sign,
    signIn,
  };
}
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
describe('wallet sessions', () => {
  it.each([
    '15 minutes',
    '90 seconds',
  ])('signs the exact readable %s challenge while validating separate API context', async (lifetime) => {
    challengeEdit = (message) =>
      message.replace(
        'access tokens last 15 minutes',
        `access tokens last ${lifetime}`,
      );
    const { sdk, signIn } = client({
      baseUrl: 'https://alias.example',
      walletSessionIssuer,
    });
    expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    const message = signIn.mock.calls[0]?.[0];
    expect(message).toContain('Sign in to Renaiss for shipping on');
    expect(message).not.toContain('Resources:');
    expect(message).not.toContain('urn:renaiss:');
    const submitted = JSON.parse(
      String(requests.find((r) => r.path.endsWith('/verify'))?.init.body),
    );
    expect(Object.keys(submitted).sort()).toEqual([
      'challengeId',
      'message',
      'signature',
    ]);
    expect(submitted.message).toBe(message);
  });
  it.each([
    'issuer',
    'audience',
    'builder',
    'extra-scope',
    'missing-scope',
    'duplicate-scope',
  ])('rejects %s shipping context before requesting a signature', async (change) => {
    const context = { ...shippingContext };
    if (change === 'issuer')
      context.issuer = 'https://other.example/v2/auth/wallet';
    if (change === 'audience') context.audience = 'https://other.example/v2';
    if (change === 'builder') context.builderAppId = 'invalid-builder';
    if (change === 'extra-scope')
      context.scopes = [...context.scopes, 'gacha:read'];
    if (change === 'missing-scope') context.scopes = ['redeem:read'];
    if (change === 'duplicate-scope')
      context.scopes = ['redeem:read', 'redeem:read'];
    challengeContext = context;
    const { sdk, signIn } = client();
    expect(isFailed(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    expect(signIn).not.toHaveBeenCalled();
  });
  it('rejects a nonce response without context as an invalid schema before requesting a signature', async () => {
    challengeContext = undefined;
    const { sdk, signIn } = client();
    expect(await sdk.signInRedemptionWallet({ origin })).toMatchObject({
      _tag: 'Left',
      left: {
        code: 'INVALID_SCHEMA',
        status: 422,
        detail: 'Invalid redemption input or response',
      },
    });
    expect(signIn).not.toHaveBeenCalled();
    expect(requests.map((r) => r.path)).toEqual(['/v2/auth/wallet/nonce']);
  });
  it.each([
    'chain',
    'wallet',
    'origin',
    'uri',
    'expiry',
    'nonce',
    'statement',
    'extra-field',
    'extra-resource',
  ])('rejects a readable challenge with a substituted %s', async (change) => {
    challengeEdit = (message) => {
      if (change === 'chain')
        return message.replace('Chain ID: 97', 'Chain ID: 56');
      if (change === 'wallet')
        return message.replace(
          account.address,
          '0x9999999999999999999999999999999999999999',
        );
      if (change === 'origin')
        return message.replace(
          'http://localhost:3100 wants',
          'https://other.example wants',
        );
      if (change === 'uri')
        return message.replace(
          'URI: http://localhost:3100',
          'URI: https://api.example',
        );
      if (change === 'expiry')
        return message.replace(
          /Expiration Time: .+/,
          'Expiration Time: 2020-01-01T00:00:00.000Z',
        );
      if (change === 'nonce')
        return message.replace('Nonce: abcdefgh12345678', 'Nonce: a');
      if (change === 'statement')
        return message.replace(
          /^Sign in to .+$/m,
          'Sign in to Renaiss. This does not authorize a transaction.',
        );
      if (change === 'extra-field')
        return `${message}\nNot Before: 2020-01-01T00:00:00.000Z`;
      return `${message}\nResources:\n- urn:extra:permission`;
    };
    const { sdk, signIn } = client();
    expect(isFailed(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    expect(signIn).not.toHaveBeenCalled();
  });
  it.each([
    'legacy resources',
    'previous shipping statement',
  ])('rejects the %s sign-in format before opening the wallet', async (format) => {
    challengeEdit = (message) => {
      if (format === 'previous shipping statement')
        return message.replace(
          /^Sign in to .+$/m,
          'Sign in to Renaiss to authenticate your shipping session. By signing, you authorize localhost:3100 to issue you a 15-minute access token. This does not authorize a transaction.',
        );
      return [
        message.replace(
          /^Sign in to .+$/m,
          'Sign in to Test Builder with your EOA. Permissions: redeem:read, redeem:write. This does not authorize a transaction.',
        ),
        'Resources:',
        `- urn:renaiss:builder:${shippingContext.builderAppId}`,
        `- urn:renaiss:audience:${encodeURIComponent(shippingContext.audience)}`,
        `- urn:renaiss:issuer:${encodeURIComponent(walletSessionIssuer)}`,
        '- urn:renaiss:scope:redeem%3Aread',
        '- urn:renaiss:scope:redeem%3Awrite',
      ].join('\n');
    };
    const { sdk, signIn } = client();
    expect(isFailed(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    expect(signIn).not.toHaveBeenCalled();
    expect(requests.map((r) => r.path)).toEqual(['/v2/auth/wallet/nonce']);
  });
  it('accepts a mainnet challenge only with the explicit mainnet network', async () => {
    challengeEdit = (s) => s.replace('Chain ID: 97', 'Chain ID: 56');
    const { sdk, signIn } = client({
      network: BNB_MAINNET,
      expectedChainId: 56,
    });
    expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    expect(signIn).toHaveBeenCalledOnce();
    expect(signIn.mock.calls[0]?.[0]).toContain('Chain ID: 56');
    const defaultNetwork = client();
    expect(
      isFailed(await defaultNetwork.sdk.signInRedemptionWallet({ origin })),
    ).toBe(true);
    expect(defaultNetwork.signIn).not.toHaveBeenCalled();
  });
  it('rejects a testnet challenge in mainnet mode before signing', async () => {
    const { sdk, signIn } = client({
      network: BNB_MAINNET,
      expectedChainId: 56,
    });
    expect(isFailed(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('does not submit a proof signed after challenge expiry and allows a fresh explicit attempt', async () => {
    const started = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(started);
    const { sdk, signIn } = client();
    signIn.mockImplementationOnce(async (message) => {
      clock.mockReturnValue(started + 300_001);
      return account.signMessage({ message });
    });
    expect(await sdk.signInRedemptionWallet({ origin })).toMatchObject({
      _tag: 'Left',
      left: {
        code: 'REDEMPTION_SESSION_REQUIRED',
        status: 401,
        detail: expect.stringContaining(
          'expired while the wallet prompt was open',
        ),
      },
    });
    expect(requests.filter((r) => r.path.endsWith('/verify'))).toHaveLength(0);
    expect(signIn).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(started);
    expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    expect(requests.filter((r) => r.path.endsWith('/nonce'))).toHaveLength(2);
    expect(signIn).toHaveBeenCalledTimes(2);
  });
  it('makes a server-rejected proof actionable without retrying its signature', async () => {
    const original = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) =>
        input.endsWith('/verify')
          ? Response.json(
              { error: 'Invalid authentication credential' },
              { status: 401 },
            )
          : original(input, init),
      ),
    );
    const { sdk, signIn } = client();
    expect(await sdk.signInRedemptionWallet({ origin })).toMatchObject({
      _tag: 'Left',
      left: {
        code: 'REDEMPTION_SESSION_REQUIRED',
        status: 401,
        detail: expect.stringContaining('Call signInRedemptionWallet() again'),
      },
    });
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(requests.filter((r) => r.path.endsWith('/nonce'))).toHaveLength(1);
  });
  it.each([
    [
      'both hosts wrong',
      (message: string) =>
        message
          .replace('shipping on localhost:3100', 'shipping on attacker.example')
          .replace('you allow localhost:3100', 'you allow attacker.example'),
    ],
    [
      'wrong shipping host',
      (message: string) =>
        message.replace(
          'shipping on localhost:3100',
          'shipping on attacker.example',
        ),
    ],
    [
      'wrong allowed host',
      (message: string) =>
        message.replace(
          'you allow localhost:3100',
          'you allow attacker.example',
        ),
    ],
    [
      'zero sign-in lifetime',
      (message: string) => message.replace('up to 7 days', 'up to 0 days'),
    ],
    [
      'zero access token lifetime',
      (message: string) =>
        message.replace(
          'access tokens last 15 minutes',
          'access tokens last 0 minutes',
        ),
    ],
    [
      'an access token lifetime longer than the sign-in',
      (message: string) =>
        message.replace(
          'access tokens last 15 minutes',
          'access tokens last 8 days',
        ),
    ],
    [
      'an access token lifetime longer than the sign-in, in numbers of 305 digits',
      (message: string) =>
        message
          .replace('up to 7 days', `up to 1${'0'.repeat(304)} days`)
          .replace(
            'access tokens last 15 minutes',
            `access tokens last 2${'0'.repeat(304)} days`,
          ),
    ],
    [
      'an access token lifetime longer than the sign-in by a fraction',
      (message: string) =>
        message
          .replace('up to 7 days', 'up to 9007199254740991 seconds')
          .replace(
            'access tokens last 15 minutes',
            'access tokens last 9007199254740991.1 seconds',
          ),
    ],
  ])('rejects a shipping statement with %s before opening the wallet', async (_name, edit) => {
    challengeEdit = edit;
    const { sdk, signIn } = client();
    expect(isFailed(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    expect(signIn).not.toHaveBeenCalled();
  });
  it('accepts an access token lifetime equal to the sign-in in different units', async () => {
    challengeEdit = (message) =>
      message.replace(
        'access tokens last 15 minutes',
        'access tokens last 168 hours',
      );
    const { sdk } = client({
      baseUrl: 'https://alias.example',
      walletSessionIssuer,
    });
    expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
  });
  it.each([
    '7 days',
    '1 hour',
  ])('accepts shipping consent disclosing a %s renewable session', async (lifetime) => {
    challengeEdit = (message) =>
      message.replace(
        /^Sign in to .+$/m,
        `Sign in to Renaiss for shipping on localhost:3100. By signing, you allow localhost:3100 to access your Renaiss shipping and redemption requests for this wallet for up to ${lifetime} (access tokens last 15 minutes and can renew within this session). This does not authorize a transaction.`,
      );
    const { sdk, signIn } = client();
    expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    expect(signIn).toHaveBeenCalledOnce();
  });
  it.each([
    60_000, 121_000,
  ])('handles a device clock %s ms behind the server', async (skew) => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() - skew);
    const { sdk, signIn } = client();
    const result = await sdk.signInRedemptionWallet({ origin });
    if (skew > 120_000) {
      expect(result).toMatchObject({
        _tag: 'Left',
        left: { detail: expect.stringContaining('device clock') },
      });
      expect(signIn).not.toHaveBeenCalled();
    } else expect(isSuccess(result)).toBe(true);
  });
  it('explains a device clock ten minutes ahead before shipping verification', async () => {
    const serverNow = Date.now();
    const id = crypto.randomUUID();
    const expiresAt = new Date(serverNow + 300_000).toISOString();
    const message = signInMessage(id, new Date(serverNow), new Date(expiresAt));
    const fetch = vi.fn(async () =>
      json({ challengeId: id, message, expiresAt, context: shippingContext }),
    );
    vi.stubGlobal('fetch', fetch);
    vi.spyOn(Date, 'now').mockReturnValue(serverNow + 600_000);
    const { sdk, signIn } = client();
    const result = await sdk.signInRedemptionWallet({ origin });
    expect(result).toMatchObject({
      _tag: 'Left',
      left: { detail: expect.stringContaining('device clock') },
    });
    expect(signIn).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('rejects a sign-in message that expires before it was issued before opening the wallet', async () => {
    const now = Date.now();
    const id = crypto.randomUUID();
    const expiresAt = new Date(now + 60_000).toISOString();
    const message = signInMessage(
      id,
      new Date(now + 110_000),
      new Date(expiresAt),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({ challengeId: id, message, expiresAt, context: shippingContext }),
      ),
    );
    const { sdk, signIn } = client();
    expect(isFailed(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    expect(signIn).not.toHaveBeenCalled();
  });
  it('sorts redeemable cards by RIX price and reads it as a bigint', async () => {
    listedCollectiblesWire = [
      {
        tokenId: '1',
        name: 'Test Card',
        frontImageUrl: 'https://img.example/1.png',
        rixPriceInUsd: '9007199254740993',
        rixPriceUpdatedAt: null,
        ownerAcquiredAt: null,
        regionCountryCode: 'HK',
        vaultDisplayName: 'Test Vault',
      },
    ];
    const { sdk } = client();
    expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    const page = await sdk
      .listRedeemableCards({
        countryCode: 'HK',
        sortBy: RedemptionCardSort.RixPrice,
        sortOrder: RedemptionSortOrder.Descending,
      })
      .firstPage();
    expect(isSuccess(page) && page.right.items[0]?.rixPriceInUsd).toBe(
      9007199254740993n,
    );
    const query = requests.find((r) => r.path.endsWith('/collectibles'))?.query;
    expect(query?.get('sortBy')).toBe('rixPriceInUsd');
    expect(query?.get('sortOrder')).toBe('desc');
    expect(query?.get('countryCode')).toBe('HK');
  });
  it('signs the exact constrained SIWE message and forwards credentials only on private reads', async () => {
    const { sdk, signIn } = client();
    expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(isSuccess(await sdk.listRedeemableCards().firstPage())).toBe(true);
    expect(requests.some((r) => r.path.endsWith('/config'))).toBe(false);
    const headers = new Headers(
      requests.find((r) => r.path.endsWith('/collectibles'))?.init.headers,
    );
    expect(headers.get('authorization')).toBe('Bearer rnws_at_fixture');
    expect(headers.get('x-builder-api-key')).toBe('rnbldr_live_fixture');
    expect(isSuccess(await sdk.signOutRedemptionWallet())).toBe(true);
    expect(isFailed(await sdk.fetchRedemptionRegions())).toBe(true);
  });
  it('requires an explicit issuer for a relative proxy before requesting or signing a challenge', async () => {
    const { sdk, signIn } = client({ baseUrl: '/api/renaiss' });
    const result = await sdk.signInRedemptionWallet({ origin });
    expect(isFailed(result)).toBe(true);
    if (isFailed(result)) expect(result.left.code).toBe('WRONG_REQUEST_PARAMS');
    expect(requests).toEqual([]);
    expect(signIn).not.toHaveBeenCalled();
  });
  it('verifies the explicit canonical issuer when using a different API alias', async () => {
    const wrong = client({ baseUrl: 'https://alias.example' });
    expect(isFailed(await wrong.sdk.signInRedemptionWallet({ origin }))).toBe(
      true,
    );
    expect(wrong.signIn).not.toHaveBeenCalled();
    const matched = client({
      baseUrl: 'https://alias.example',
      walletSessionIssuer,
    });
    expect(
      isSuccess(await matched.sdk.signInRedemptionWallet({ origin })),
    ).toBe(true);
    expect(matched.signIn).toHaveBeenCalledTimes(1);
    expect(requests.some((request) => request.path.endsWith('/config'))).toBe(
      false,
    );
  });
  it('refuses a chain that differs from the selected static network before requesting a challenge', async () => {
    const { sdk, signIn } = client({ expectedChainId: 56 });
    expect(isFailed(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    expect(requests).toEqual([]);
    expect(signIn).not.toHaveBeenCalled();
  });
  it.each([
    (s: string) => s.replace('Chain ID: 97', 'Chain ID: 56'),
    (s: string) =>
      s.replace('http://localhost:3100 wants', 'https://localhost:3100 wants'),
    (s: string) => s.replace('localhost:3100', 'localhost:3101'),
    (s: string) =>
      s.replace(
        'URI: http://localhost:3100',
        'URI: https://api.example/v2/auth/wallet',
      ),
    (s: string) =>
      s.replace(
        'http://localhost:3100 wants',
        'https://attacker.example wants',
      ),
    (s: string) =>
      s.replace(account.address, '0x9999999999999999999999999999999999999999'),
  ])('rejects a tampered sign-in challenge before signing', async (edit) => {
    challengeEdit = edit;
    const { sdk, signIn } = client();
    expect(isFailed(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    expect(signIn).not.toHaveBeenCalled();
  });
  it.each([
    'https://partner.example',
    'https://partner.example:444',
    'http://127.0.0.1:3100',
  ])('signs for the selected frontend %s independently of the API issuer', async (selectedOrigin) => {
    challengeOrigin = selectedOrigin;
    const { sdk, signIn } = client();
    expect(
      isSuccess(await sdk.signInRedemptionWallet({ origin: selectedOrigin })),
    ).toBe(true);
    const nonce = requests.find((r) => r.path.endsWith('/nonce'));
    expect(JSON.parse(String(nonce?.init.body))).toMatchObject({
      origin: selectedOrigin,
      chainId: 97,
      scopes: ['redeem:read', 'redeem:write'],
    });
    expect(signIn.mock.calls[0]?.[0]).toContain(`URI: ${selectedOrigin}`);
    expect(signIn.mock.calls[0]?.[0]).toContain(
      `Sign in to Renaiss for shipping on ${new URL(selectedOrigin).host}.`,
    );
  });
  it.each([
    'http://partner.example',
    'https://partner.example/',
    'https://partner.example/path',
    'https://user@partner.example',
    'https://*.partner.example',
    'http://[::1]:3100',
    'https://[::1]:3100',
    'https://intranet',
    'https://my_app.example',
    'https://partner.example.',
    'https://partner.x1',
    'null',
  ])('rejects invalid frontend input %s before any request or signature', async (selectedOrigin) => {
    const { sdk, signIn } = client();
    expect(
      isFailed(await sdk.signInRedemptionWallet({ origin: selectedOrigin })),
    ).toBe(true);
    expect(signIn).not.toHaveBeenCalled();
    expect(requests).toHaveLength(0);
  });
  it('reuses and refreshes verification without prompting for another signature', async () => {
    sessionLifetime = 10_000;
    const { sdk, signIn } = client();
    expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(requests.filter((r) => r.path.endsWith('/refresh'))).toHaveLength(1);
  });
  it.each([
    401, 503,
  ])('handles a refresh rejection (%s) without a second caller retry', async (status) => {
    sessionLifetime = 10_000;
    const { sdk, signIn } = client();
    expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    const original = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        if (new URL(input).pathname.endsWith('/refresh'))
          return new Response('{}', { status });
        return original(input, init);
      }),
    );
    const result = await sdk.signInRedemptionWallet({ origin });
    expect(isSuccess(result)).toBe(status === 401);
    expect(signIn).toHaveBeenCalledTimes(status === 401 ? 2 : 1);
    expect(requests.filter((r) => r.path.endsWith('/nonce'))).toHaveLength(
      status === 401 ? 2 : 1,
    );
  });
  it('does not restart verification after disconnect during a rejected refresh', async () => {
    sessionLifetime = 10_000;
    const { sdk, signIn } = client();
    expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    const original = globalThis.fetch;
    let release: (value: Response) => void = () => undefined;
    let started: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      started = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        if (new URL(input).pathname.endsWith('/refresh')) {
          started();
          return new Promise<Response>((resolve) => {
            release = resolve;
          });
        }
        return original(input, init);
      }),
    );
    const connecting = sdk.signInRedemptionWallet({ origin });
    await pending;
    await sdk.signOutRedemptionWallet();
    release(new Response('{}', { status: 401 }));
    expect(isFailed(await connecting)).toBe(true);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(requests.filter((r) => r.path.endsWith('/nonce'))).toHaveLength(1);
    expect(isFailed(await sdk.fetchRedemptionRegions())).toBe(true);
  });
  it.each([
    'nonce',
    'verify',
    'refresh',
    'regions',
  ])('cancels when disconnect lands during the signer address check after %s', async (endpoint) => {
    if (endpoint === 'refresh') sessionLifetime = 10_000;
    const { sdk, signer, signIn } = client();
    const reading = endpoint === 'refresh' || endpoint === 'regions';
    if (reading)
      expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(
        true,
      );
    const entered = deferred<void>();
    const address = deferred<string>();
    let paused = false;
    vi.spyOn(signer, 'getAddress').mockImplementation(() => {
      if (!paused && requests.at(-1)?.path.endsWith(`/${endpoint}`)) {
        paused = true;
        entered.resolve();
        return address.promise;
      }
      return account.address;
    });
    const pending = reading
      ? sdk.fetchRedemptionRegions()
      : sdk.signInRedemptionWallet({ origin });
    await entered.promise;
    expect(isSuccess(await sdk.signOutRedemptionWallet())).toBe(true);
    address.resolve(account.address);
    const result = await pending;
    expect(isFailed(result)).toBe(true);
    if (isFailed(result))
      expect(result.left.code).toBe('REDEMPTION_SESSION_REQUIRED');
    const afterDisconnect = await sdk.fetchRedemptionRegions();
    expect(isFailed(afterDisconnect)).toBe(true);
    if (isFailed(afterDisconnect))
      expect(afterDisconnect.left.code).toBe('REDEMPTION_SESSION_REQUIRED');
    expect(signIn).toHaveBeenCalledTimes(endpoint === 'nonce' ? 0 : 1);
    expect(requests.filter((r) => r.path.endsWith('/regions'))).toHaveLength(
      endpoint === 'regions' ? 1 : 0,
    );
    if (endpoint === 'verify') {
      const revocations = requests.filter((r) => r.path.endsWith('/revoke'));
      expect(revocations).toHaveLength(1);
      expect(JSON.parse(String(revocations[0]?.init.body))).toEqual({
        refreshToken: 'rnws_rt_fixture',
      });
    }
  });
  it.each([
    200, 503,
  ])('revokes a late verify response after disconnect, preserving cancellation if cleanup returns %s', async (cleanupStatus) => {
    const { sdk } = client();
    const original = globalThis.fetch;
    const entered = deferred<void>();
    const release = deferred<void>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const response = await original(input, init);
        const path = new URL(input).pathname;
        if (path.endsWith('/verify')) {
          entered.resolve();
          await release.promise;
        }
        if (path.endsWith('/revoke') && cleanupStatus !== 200)
          return new Response('{}', { status: cleanupStatus });
        return response;
      }),
    );
    const pending = sdk.signInRedemptionWallet({ origin });
    await entered.promise;
    expect(isSuccess(await sdk.signOutRedemptionWallet())).toBe(true);
    release.resolve();
    const result = await pending;
    expect(isFailed(result)).toBe(true);
    if (isFailed(result))
      expect(result.left.code).toBe('REDEMPTION_SESSION_REQUIRED');
    const revocations = requests.filter((r) => r.path.endsWith('/revoke'));
    expect(revocations).toHaveLength(1);
    expect(JSON.parse(String(revocations[0]?.init.body))).toEqual({
      refreshToken: 'rnws_rt_fixture',
    });
    expect(isFailed(await sdk.fetchRedemptionRegions())).toBe(true);
  });
  it('keeps concurrent verification callers bound to their own requested origin', async () => {
    const { sdk, signIn } = client();
    const [first, other] = await Promise.all([
      sdk.signInRedemptionWallet({ origin }),
      sdk.signInRedemptionWallet({ origin: 'https://other.example' }),
    ]);
    expect(isSuccess(first)).toBe(true);
    expect(isFailed(other)).toBe(true);
    expect(signIn).toHaveBeenCalledTimes(1);
  });
  it('does not reuse a session for a different origin', async () => {
    const { sdk, signIn } = client();
    expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    expect(
      isFailed(
        await sdk.signInRedemptionWallet({ origin: 'https://other.example' }),
      ),
    ).toBe(true);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(isSuccess(await sdk.signOutRedemptionWallet())).toBe(true);
    expect(isFailed(await sdk.fetchRedemptionRegions())).toBe(true);
  });
  it('refreshes once for concurrent reads', async () => {
    sessionLifetime = 10_000;
    const { sdk } = client();
    await sdk.signInRedemptionWallet({ origin });
    const results = await Promise.all([
      sdk.fetchRedemptionRegions(),
      sdk.listRedeemableCards().firstPage(),
    ]);
    expect(results.every((result) => result._tag === 'Right')).toBe(true);
    expect(requests.filter((r) => r.path.endsWith('/refresh'))).toHaveLength(1);
  });
  it('clears private access after an account change', async () => {
    const { sdk, signer } = client();
    await sdk.signInRedemptionWallet({ origin });
    vi.spyOn(signer, 'getAddress').mockReturnValue(
      '0x9999999999999999999999999999999999999999',
    );
    expect(isFailed(await sdk.fetchRedemptionRegions())).toBe(true);
    expect(requests.some((r) => r.path.endsWith('/regions'))).toBe(false);
  });
});
describe('in-flight private data', () => {
  it('drops an order/inventory response when the session is revoked while it is loading', async () => {
    const { sdk } = client();
    expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    const original = globalThis.fetch;
    let release: (value: Response) => void = () => undefined;
    let started: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      started = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        if (new URL(input).pathname.endsWith('/regions')) {
          started();
          return new Promise<Response>((resolve) => {
            release = resolve;
          });
        }
        return original(input, init);
      }),
    );
    const reading = sdk.fetchRedemptionRegions();
    await pending;
    await sdk.signOutRedemptionWallet();
    release(json({ counts: { US: 9 } }));
    const result = await reading;
    expect(isFailed(result)).toBe(true);
    if (isFailed(result))
      expect(result.left.code).toBe('REDEMPTION_SESSION_REQUIRED');
  });
});

describe('EOA payment verification', () => {
  it.each([
    'before',
    'after',
  ])('cancels when disconnect lands in the address check %s payment signing', async (stage) => {
    const { sdk, signer, sign } = client();
    expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    const hash = vi.spyOn(signer, 'hashTypedData');
    const entered = deferred<void>();
    const address = deferred<string>();
    let paused = false;
    vi.spyOn(signer, 'getAddress').mockImplementation(() => {
      const reached =
        stage === 'before' ? hash.mock.calls.length : sign.mock.calls.length;
      if (!paused && reached > 0) {
        paused = true;
        entered.resolve();
        return address.promise;
      }
      return account.address;
    });
    const pending = sdk.signRedemption({
      prepared: makePreparation(),
      expected,
    });
    await entered.promise;
    expect(isSuccess(await sdk.signOutRedemptionWallet())).toBe(true);
    address.resolve(account.address);
    const result = await pending;
    expect(isFailed(result)).toBe(true);
    if (isFailed(result))
      expect(result.left.code).toBe('REDEMPTION_SESSION_REQUIRED');
    expect(sign).toHaveBeenCalledTimes(stage === 'before' ? 0 : 1);
  });
  it.each([
    BNB_TESTNET,
    BNB_MAINNET,
  ])('accepts equivalent address casing on chain $chainId without relaxing typed data checks', async (network) => {
    challengeEdit = (s) =>
      s.replace('Chain ID: 97', `Chain ID: ${network.chainId}`);
    const { sdk, sign } = client({ network, expectedChainId: network.chainId });
    expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    const prepared = makePreparation(network);
    prepared.walletAddress = `0x${account.address.slice(2).toLowerCase()}`;
    prepared.redemptionTypedData.domain.verifyingContract =
      network.redemption.managerAddress.toLowerCase();
    prepared.redemptionTypedData.message.user = account.address.toLowerCase();
    prepared.permitTypedData.domain.verifyingContract =
      network.redemption.permit2Address.toLowerCase();
    prepared.permitTypedData.message.permitted = {
      token: network.redemption.tokenAddress.toLowerCase(),
      amount: String(expected.totalFeeInUsdt),
    };
    prepared.permitTypedData.message.spender =
      network.redemption.cashierAddress.toLowerCase();
    expect(isSuccess(await sdk.signRedemption({ prepared, expected }))).toBe(
      true,
    );
    expect(sign).toHaveBeenCalledWith(prepared.permitTypedData);
    sign.mockClear();
    const differentAddress = structuredClone(prepared);
    differentAddress.permitTypedData.message.spender = account.address;
    expect(
      isFailed(
        await sdk.signRedemption({ prepared: differentAddress, expected }),
      ),
    ).toBe(true);
    expect(sign).not.toHaveBeenCalled();
    const extraField = structuredClone(prepared);
    extraField.redemptionTypedData.domain.extra =
      network.redemption.managerAddress;
    expect(
      isFailed(await sdk.signRedemption({ prepared: extraField, expected })),
    ).toBe(true);
    expect(sign).not.toHaveBeenCalled();
    const changedContact = structuredClone(prepared);
    changedContact.recipient.name = recipient.name.toLowerCase();
    expect(
      isFailed(
        await sdk.signRedemption({ prepared: changedContact, expected }),
      ),
    ).toBe(true);
    expect(sign).not.toHaveBeenCalled();
  });
  it.each([
    60_000, 121_000,
  ])('checks quote expiry with a device clock %s ms slow', async (skew) => {
    const { sdk, sign } = client();
    expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    const prepared = makePreparation();
    prepared.expiresAt = new Date(Date.now() + 600_000).toISOString();
    prepared.permitTypedData.message.deadline = String(
      Math.floor(Date.parse(prepared.expiresAt) / 1000),
    );
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() - skew);
    const result = await sdk.signRedemption({ prepared, expected });
    if (skew > 120_000) {
      expect(result).toMatchObject({
        _tag: 'Left',
        left: { detail: expect.stringContaining('device clock') },
      });
      expect(sign).not.toHaveBeenCalled();
    } else {
      expect(isSuccess(result)).toBe(true);
      expect(sign).toHaveBeenCalledOnce();
    }
  });
  it.each([
    'expired quote',
    'fast clock',
  ])('explains %s before redemption signing', async (scenario) => {
    const { sdk, sign } = client();
    expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    const prepared = makePreparation();
    if (scenario === 'expired quote')
      prepared.expiresAt = new Date(Date.now() - 1000).toISOString();
    else vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600_000);
    const result = await sdk.signRedemption({ prepared, expected });
    expect(result).toMatchObject({
      _tag: 'Left',
      left: {
        code: 'WRONG_REQUEST_PARAMS',
        detail: expect.stringContaining('The quote expired'),
      },
    });
    expect(isFailed(result) && result.left.detail).toContain(
      'device clock may be ahead',
    );
    expect(sign).not.toHaveBeenCalled();
  });
  it('signs a mainnet redemption and rejects testnet contracts on mainnet', async () => {
    challengeEdit = (s) => s.replace('Chain ID: 97', 'Chain ID: 56');
    const { sdk, sign } = client({ network: BNB_MAINNET, expectedChainId: 56 });
    expect(isSuccess(await sdk.signInRedemptionWallet({ origin }))).toBe(true);
    const prepared = makePreparation(BNB_MAINNET);
    expect(isSuccess(await sdk.signRedemption({ prepared, expected }))).toBe(
      true,
    );
    expect(sign).toHaveBeenCalledWith(prepared.permitTypedData);
    for (const field of ['token', 'cashier', 'manager', 'chain']) {
      sign.mockClear();
      const wrong = makePreparation(BNB_MAINNET);
      if (field === 'token')
        wrong.permitTypedData.message.permitted = {
          token: BNB_TESTNET.redemption.tokenAddress,
          amount: String(expected.totalFeeInUsdt),
        };
      if (field === 'cashier')
        wrong.permitTypedData.message.spender =
          BNB_TESTNET.redemption.cashierAddress;
      if (field === 'manager')
        wrong.redemptionTypedData.domain.verifyingContract =
          BNB_TESTNET.redemption.managerAddress;
      if (field === 'chain') wrong.permitTypedData.domain.chainId = 97;
      expect(
        isFailed(await sdk.signRedemption({ prepared: wrong, expected })),
      ).toBe(true);
      expect(sign).not.toHaveBeenCalled();
    }
  });
  it('hashes the visible card batch and signs a direct Permit2 witness', async () => {
    const { sdk, sign } = client();
    await sdk.signInRedemptionWallet({ origin });
    const prepared = makePreparation();
    const signed = await sdk.signRedemption({ prepared, expected });
    expect(isSuccess(signed)).toBe(true);
    expect(sign).toHaveBeenCalledWith(prepared.permitTypedData);
    expect(
      isSuccess(await sdk.submitRedemption({ signed: unwrap(signed) })),
    ).toBe(true);
    const submitted = JSON.parse(
      String(requests.find((r) => r.path === '/v2/redeem/checkout')?.init.body),
    );
    expect(Object.keys(submitted).sort()).toEqual([
      'preparationId',
      'signature',
    ]);
  });
  it.each([
    (p: ReturnType<typeof makePreparation>) => {
      p.tokenIds = [3n];
    },
    (p: ReturnType<typeof makePreparation>) => {
      p.address.city = 'Another city';
    },
    (p: ReturnType<typeof makePreparation>) => {
      p.fees.totalFeeInUsdt = 1n;
    },
    (p: ReturnType<typeof makePreparation>) => {
      p.permitTypedData.domain.chainId = 56;
    },
    (p: ReturnType<typeof makePreparation>) => {
      p.permitTypedData.message.witness = requestId;
    },
    (p: ReturnType<typeof makePreparation>) => {
      p.permitTypedData.message.spender = account.address;
    },
    (p: ReturnType<typeof makePreparation>) => {
      p.redemptionTypedData.types.BatchRedemption?.push({
        name: 'extra',
        type: 'address',
      });
    },
    (p: ReturnType<typeof makePreparation>) => {
      p.expiresAt = new Date(Date.now() - 1000).toISOString();
    },
  ])('refuses a changed authorization before the wallet prompt', async (mutate) => {
    const { sdk, sign } = client();
    await sdk.signInRedemptionWallet({ origin });
    const prepared = makePreparation();
    mutate(prepared);
    expect(isFailed(await sdk.signRedemption({ prepared, expected }))).toBe(
      true,
    );
    expect(sign).not.toHaveBeenCalled();
  });
  it('requires the hash capability instead of trusting an opaque server witness', async () => {
    const { sdk, signer, sign } = client();
    await sdk.signInRedemptionWallet({ origin });
    delete signer.hashTypedData;
    expect(
      isFailed(
        await sdk.signRedemption({ prepared: makePreparation(), expected }),
      ),
    ).toBe(true);
    expect(sign).not.toHaveBeenCalled();
  });
  it('never retries checkout on an uncertain network response', async () => {
    const { sdk } = client();
    await sdk.signInRedemptionWallet({ origin });
    checkoutFailures = true;
    expect(
      isFailed(
        await sdk.submitRedemption({
          signed: { preparationId: crypto.randomUUID(), requestId, signature },
        }),
      ),
    ).toBe(true);
    expect(
      requests.filter((r) => r.path === '/v2/redeem/checkout'),
    ).toHaveLength(1);
  });
  it('reads an order and the order list', async () => {
    listedOrderWire = [listedOrder];
    const { sdk } = client();
    await sdk.signInRedemptionWallet({ origin });
    const order = unwrap(await sdk.fetchRedemptionOrder({ requestId }));
    expect(order.trackingNumber).toBe('TRK1');
    const listed = unwrap(await sdk.listRedemptionOrders().firstPage());
    expect(listed.items[0]?.trackingNumber).toBe('TRK1');
  });
  it('advances an empty index-lag page using the scanned offset', async () => {
    const { sdk } = client();
    await sdk.signInRedemptionWallet({ origin });
    const pager = sdk.listRedemptionOrders({ pageSize: 2 });
    const first = unwrap(await pager.firstPage());
    expect(first.hasMore).toBe(true);
    const second = unwrap(await pager.from(first.nextCursor).firstPage());
    expect(second.hasMore).toBe(false);
  });
});

function unwrap<T>(result: Result<T>): T {
  if (isFailed(result)) throw new Error(result.left.detail);
  return getValue(result);
}
