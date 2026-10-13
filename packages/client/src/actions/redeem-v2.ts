import type { ErrorCode } from '@renaiss-protocol/error-codes';
import {
  type Action,
  action,
  Failed,
  getError,
  getValue,
  isFailed,
  run,
  type StatusCodes,
  Success,
} from '@renaiss-protocol/fp';
import {
  addressSchema,
  bytes32Schema,
  type PreparedRedemption,
  PreparedRedemptionSchema,
  RedeemableCardsResponseSchema,
  type RedemptionAddress,
  RedemptionAddressSchema,
  RedemptionAddressValidationSchema,
  RedemptionChallengeSchema,
  RedemptionCheckoutSchema,
  RedemptionOrderSchema,
  RedemptionOrdersResponseSchema,
  RedemptionQuoteSchema,
  type RedemptionRecipient,
  RedemptionRecipientSchema,
  RedemptionRegionsSchema,
  type RedemptionSession,
  RedemptionSessionSchema,
  type SignedRedemption,
  SignedRedemptionSchema,
} from '@renaiss-protocol/schema-validation';
import { z } from 'zod';
import type { RedemptionConfig } from '../networks-v2';
import {
  decodeOffsetCursor,
  encodeOffsetCursor,
  paginate,
} from '../pagination';
import {
  isServiceConfigurationError,
  type ServiceClient,
} from '../service-client';
import type { RenaissSigner } from '../signers';
import {
  verifyRedemptionChallenge,
  verifyRedemptionPreparation,
} from './redeem-v2-verification';

export type RedemptionContext = {
  service: ServiceClient;
  builderAuth: boolean;
  signer?: RenaissSigner;
  expectedChainId?: number;
  config: RedemptionConfig;
  walletSessionIssuer?: string;
  session?: RedemptionSession & { walletAddress: string; origin: string };
  generation: number;
  connecting?: Promise<void>;
  refreshing?: Promise<void>;
};
export class RedemptionClientError extends Error {
  constructor(
    message: string,
    readonly code: ErrorCode = 'WRONG_REQUEST_PARAMS',
    readonly status: StatusCodes = 400,
  ) {
    super(message);
  }
}
const operation = <T>(fn: () => Promise<T>): Action<T> =>
  action(
    async () => Success(await fn()),
    (error) =>
      error instanceof RedemptionClientError
        ? Failed(error.code, error.status, error.message)
        : Failed('UNKNOWN_ERROR', 503, 'Redemption operation failed'),
  );
export function parse<S extends z.ZodType>(
  schema: S,
  value: unknown,
): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new RedemptionClientError(
      'Invalid redemption input or response',
      'INVALID_SCHEMA',
      422,
    );
  return result.data;
}
export async function response<S extends z.ZodType>(
  schema: S,
  request: Action<unknown>,
): Promise<z.output<S>> {
  const result = await run(request);
  if (isFailed(result)) {
    const error = getError(result);
    if (isServiceConfigurationError(error))
      throw new RedemptionClientError(error.detail, error.code, error.status);
    // Only the known messages below are passed on. Other upstream response
    // bodies are not attached to the error, so personal data and credentials
    // cannot leak through it. Use the status to decide on sign-in or recovery.
    const safeDetail = [
      'Quote expired',
      'Preparation expired',
      'Courier is not part of this quote',
      'Choose cards from a single region',
      'Every card must be owned by the authenticated EOA',
      'A card is not ready for redemption',
      'A card is missing its declared value',
      'State is required for this destination',
      'Shipping destination is not supported',
      'Not found',
      'Not found or expired',
    ].includes(error.detail)
      ? error.detail
      : 'Redemption API request failed';
    throw new RedemptionClientError(
      safeDetail,
      error.code === 'UNKNOWN_ERROR'
        ? 'UNKNOWN_ERROR'
        : 'REDEMPTION_V2_REQUEST_FAILED',
      error.status,
    );
  }
  return parse(schema, getValue(result));
}
async function privateResponse<S extends z.ZodType>(
  ctx: RedemptionContext,
  schema: S,
  request: Action<unknown>,
): Promise<z.output<S>> {
  const generation = ctx.generation;
  const walletAddress = ctx.session?.walletAddress;
  const result = await response(schema, request);
  const settledAddress = await currentAddress(ctx);
  assertLive(ctx, generation);
  if (
    !walletAddress ||
    ctx.session?.walletAddress !== walletAddress ||
    settledAddress !== walletAddress
  )
    throw new RedemptionClientError(
      'Wallet access token changed',
      'REDEMPTION_SESSION_REQUIRED',
      401,
    );
  return result;
}
export function signerFor(ctx: RedemptionContext): RenaissSigner {
  if (!ctx.signer) throw new RedemptionClientError('A signer is required');
  return ctx.signer;
}
const currentAddress = async (ctx: RedemptionContext) =>
  parse(addressSchema, await signerFor(ctx).getAddress()).toLowerCase();
function configFor(ctx: RedemptionContext) {
  if (
    ctx.expectedChainId !== undefined &&
    ctx.config.chainId !== ctx.expectedChainId
  )
    throw new RedemptionClientError(
      'Redemption chain does not match expectedChainId',
    );
  return ctx.config;
}
function issuerFor(ctx: RedemptionContext): string {
  const configuration = ctx.service.validateOptions();
  if (isFailed(configuration)) {
    const error = getError(configuration);
    throw new RedemptionClientError(error.detail, error.code, error.status);
  }
  if (!ctx.walletSessionIssuer)
    throw new RedemptionClientError(
      'Set walletSessionIssuer when using a relative backend proxy URL',
    );
  return ctx.walletSessionIssuer;
}

function assertLive(ctx: RedemptionContext, generation: number) {
  if (ctx.generation !== generation)
    throw new RedemptionClientError(
      'Wallet access token changed',
      'REDEMPTION_SESSION_REQUIRED',
      401,
    );
}
function liveTokens(tokens: RedemptionSession) {
  if (
    Date.parse(tokens.expiresAt) <= Date.now() ||
    Date.parse(tokens.refreshExpiresAt) < Date.parse(tokens.expiresAt)
  )
    throw new RedemptionClientError(
      'Wallet access token expired',
      'REDEMPTION_SESSION_REQUIRED',
      401,
    );
  return tokens;
}
export type SignInRedemptionWalletRequest = {
  /** Exact registered frontend origin, such as window.location.origin. No path or trailing slash. */
  origin: string;
};

const originSchema = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.origin === value &&
        (url.hostname === 'localhost' ||
          /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(
            url.hostname,
          ) ||
          /^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname)) &&
        (url.protocol === 'https:' ||
          (url.protocol === 'http:' &&
            ['localhost', '127.0.0.1'].includes(url.hostname)))
      );
    } catch {
      return false;
    }
  });

/**
 * Get a wallet access token for private Redeem requests: the partner's existing
 * signer signs the sign-in message. This does not connect/provision a wallet or
 * log the user into a partner account. Reuses/refreshes the tokens for the same
 * wallet and origin; a rejected refresh asks for a fresh signature. Call
 * signOutRedemptionWallet on partner logout or wallet/chain change to clear
 * private data and revoke the tokens.
 * @throws Never; Result failures: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, UNKNOWN_ERROR,
 * REDEMPTION_V2_REQUEST_FAILED, REDEMPTION_SESSION_REQUIRED, REDEMPTION_SIGNING_FAILED.
 */
export function signInRedemptionWallet(
  ctx: RedemptionContext,
  request: SignInRedemptionWalletRequest,
) {
  return operation(async () => {
    const { origin } = parse(
      z.object({ origin: originSchema }).strict(),
      request,
    );
    if (ctx.session && ctx.session.origin !== origin)
      throw new RedemptionClientError(
        'Call signOutRedemptionWallet() before changing origin',
      );
    const generation = ctx.generation;
    if (!ctx.connecting) {
      const pending = (async () => {
        const walletAddress = await currentAddress(ctx);
        assertLive(ctx, generation);
        if (
          ctx.session?.walletAddress === walletAddress &&
          ctx.session.origin === origin
        ) {
          try {
            await credentials(ctx);
            return;
          } catch (error) {
            if (
              !(error instanceof RedemptionClientError) ||
              error.status !== 401
            )
              throw error;
            // A dead refresh token needs a new signature. Signing out or an
            // account change must still cancel this attempt before it requests
            // another nonce.
            const retryAddress = await currentAddress(ctx);
            assertLive(ctx, generation);
            if (retryAddress !== walletAddress)
              throw new RedemptionClientError('Wallet changed');
          }
        }
        ctx.session = undefined;
        const config = configFor(ctx);
        const walletSessionIssuer = issuerFor(ctx);
        assertLive(ctx, generation);
        const challenge = await response(
          RedemptionChallengeSchema,
          ctx.service.post('/v2/auth/wallet/nonce', {
            builderAuth: ctx.builderAuth,
            body: {
              walletAddress,
              origin,
              chainId: config.chainId,
              scopes: ['redeem:read', 'redeem:write'],
            },
          }),
        );
        verifyRedemptionChallenge(
          challenge,
          config,
          walletAddress,
          origin,
          walletSessionIssuer,
        );
        const beforeSigning = await currentAddress(ctx);
        assertLive(ctx, generation);
        if (beforeSigning !== walletAddress)
          throw new RedemptionClientError('Wallet changed');
        let signature: string;
        try {
          signature = await signerFor(ctx).signMessage(challenge.message);
        } catch {
          throw new RedemptionClientError(
            'Sign-in message was not signed',
            'REDEMPTION_SIGNING_FAILED',
          );
        }
        const afterSigning = await currentAddress(ctx);
        assertLive(ctx, generation);
        if (afterSigning !== walletAddress)
          throw new RedemptionClientError('Wallet changed');
        // A wallet prompt can remain open past the sign-in message deadline.
        // Never submit a known-expired signature or silently open another
        // signing prompt.
        if (Date.parse(challenge.expiresAt) <= Date.now())
          throw new RedemptionClientError(
            'Sign-in message expired while the wallet prompt was open. Call signInRedemptionWallet() again. If this happens immediately or repeatedly, sync your device clock.',
            'REDEMPTION_SESSION_REQUIRED',
            401,
          );
        let tokens: RedemptionSession;
        try {
          tokens = await response(
            RedemptionSessionSchema,
            ctx.service.post('/v2/auth/wallet/verify', {
              builderAuth: ctx.builderAuth,
              body: {
                challengeId: challenge.challengeId,
                message: challenge.message,
                signature,
              },
            }),
          );
        } catch (error) {
          // Covers expiry in transit, a used sign-in message, or revoked tokens.
          // The next sign-in obtains a fresh sign-in message.
          if (error instanceof RedemptionClientError && error.status === 401)
            throw new RedemptionClientError(
              'This sign-in message is no longer valid. Call signInRedemptionWallet() again.',
              'REDEMPTION_SESSION_REQUIRED',
              401,
            );
          throw error;
        }
        try {
          liveTokens(tokens);
          const verifiedAddress = await currentAddress(ctx);
          // No await may separate the liveness check from storing the tokens.
          assertLive(ctx, generation);
          if (verifiedAddress !== walletAddress)
            throw new RedemptionClientError('Wallet changed');
          ctx.session = { ...tokens, walletAddress, origin };
        } catch (error) {
          // Revoke these discarded tokens only; newer tokens may already exist.
          // Cleanup is best effort and must preserve the original failure.
          await run(
            ctx.service.post('/v2/auth/wallet/revoke', {
              builderAuth: ctx.builderAuth,
              body: { refreshToken: tokens.refreshToken },
            }),
          ).catch(() => undefined);
          throw error;
        }
      })();
      ctx.connecting = pending;
      try {
        await pending;
      } finally {
        if (ctx.connecting === pending) ctx.connecting = undefined;
      }
    } else await ctx.connecting;
    assertLive(ctx, generation);
    if (!ctx.session || ctx.session.origin !== origin)
      throw new RedemptionClientError(
        'Wallet access token required: call signInRedemptionWallet()',
        'REDEMPTION_SESSION_REQUIRED',
        401,
      );
    return {
      walletAddress: ctx.session.walletAddress,
      expiresAt: ctx.session.expiresAt,
    };
  });
}
export function signOutRedemptionWallet(ctx: RedemptionContext) {
  return operation(async () => {
    const session = ctx.session;
    ctx.generation++;
    ctx.session = undefined;
    ctx.connecting = undefined;
    ctx.refreshing = undefined;
    if (session)
      await response(
        z.object({ revoked: z.literal(true) }),
        ctx.service.post('/v2/auth/wallet/revoke', {
          builderAuth: ctx.builderAuth,
          body: { refreshToken: session.refreshToken },
        }),
      );
    return { revoked: true as const };
  });
}
async function credentials(ctx: RedemptionContext) {
  const generation = ctx.generation;
  const walletAddress = await currentAddress(ctx);
  assertLive(ctx, generation);
  if (!ctx.session || ctx.session.walletAddress !== walletAddress) {
    ctx.session = undefined;
    throw new RedemptionClientError(
      'Wallet access token required: call signInRedemptionWallet()',
      'REDEMPTION_SESSION_REQUIRED',
      401,
    );
  }
  if (Date.parse(ctx.session.expiresAt) <= Date.now() + 30_000) {
    if (!ctx.refreshing) {
      const session = ctx.session;
      const pending = (async () => {
        try {
          const tokens = liveTokens(
            await response(
              RedemptionSessionSchema,
              ctx.service.post('/v2/auth/wallet/refresh', {
                builderAuth: ctx.builderAuth,
                body: { refreshToken: session.refreshToken },
              }),
            ),
          );
          const refreshedAddress = await currentAddress(ctx);
          assertLive(ctx, generation);
          if (refreshedAddress !== walletAddress)
            throw new RedemptionClientError('Wallet changed');
          ctx.session = { ...tokens, walletAddress, origin: session.origin };
        } catch (error) {
          if (ctx.session === session) ctx.session = undefined;
          throw error;
        }
      })();
      ctx.refreshing = pending;
      try {
        await pending;
      } finally {
        if (ctx.refreshing === pending) ctx.refreshing = undefined;
      }
    } else await ctx.refreshing;
  }
  const settledAddress = await currentAddress(ctx);
  assertLive(ctx, generation);
  if (!ctx.session || ctx.session.walletAddress !== settledAddress)
    throw new RedemptionClientError(
      'Wallet changed',
      'REDEMPTION_SESSION_REQUIRED',
      401,
    );
  return {
    builderAuth: ctx.builderAuth,
    headers: { authorization: `Bearer ${ctx.session.accessToken}` },
  };
}
const idsSchema = z
  .array(
    z
      .bigint()
      .min(0n)
      .max(2n ** 256n - 1n),
  )
  .min(1)
  .max(50)
  .refine((ids) => new Set(ids).size === ids.length);
export enum RedemptionCardSort {
  Fmv = 'fmv',
  CreatedAt = 'createdAt',
}
export enum RedemptionSortOrder {
  Ascending = 'asc',
  Descending = 'desc',
}
const listSchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    countryCode: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    sortBy: z.enum(RedemptionCardSort).optional(),
    sortOrder: z.enum(RedemptionSortOrder).optional(),
    pageSize: z.number().int().min(1).max(50).default(50),
  })
  .strict();
export type ListRedeemableCardsRequest = z.input<typeof listSchema>;
export function listRedeemableCards(
  ctx: RedemptionContext,
  request: ListRedeemableCardsRequest = {},
) {
  return paginate((cursor) =>
    operation(async () => {
      const { pageSize, ...query } = parse(listSchema, request);
      const decoded = decodeOffsetCursor(cursor, pageSize);
      if (
        isFailed(decoded) ||
        decoded.right.pageSize !== pageSize ||
        decoded.right.offset % pageSize !== 0
      )
        throw new RedemptionClientError('Invalid pagination cursor');
      const offset = decoded.right.offset;
      const result = await privateResponse(
        ctx,
        RedeemableCardsResponseSchema,
        ctx.service.get('/v2/redeem/cards', {
          ...(await credentials(ctx)),
          query: { ...query, page: offset / pageSize + 1, limit: pageSize },
        }),
      );
      if (result.hasMore && result.page * pageSize <= offset)
        throw new RedemptionClientError(
          'Invalid pagination response',
          'INVALID_SCHEMA',
          422,
        );
      return {
        items: result.cards,
        totalCount: result.total,
        hasMore: result.hasMore,
        nextCursor: result.hasMore
          ? encodeOffsetCursor({ pageSize, offset: result.page * pageSize })
          : undefined,
      };
    }),
  );
}
export function fetchRedemptionRegions(ctx: RedemptionContext) {
  return operation(async () =>
    privateResponse(
      ctx,
      RedemptionRegionsSchema,
      ctx.service.get('/v2/redeem/regions', await credentials(ctx)),
    ),
  );
}
export type ValidateRedemptionAddressRequest = { address: RedemptionAddress };
export function validateRedemptionAddress(
  ctx: RedemptionContext,
  request: ValidateRedemptionAddressRequest,
) {
  return operation(async () =>
    privateResponse(
      ctx,
      RedemptionAddressValidationSchema,
      ctx.service.post('/v2/redeem/address/validate', {
        ...(await credentials(ctx)),
        body: parse(RedemptionAddressSchema, request.address),
      }),
    ),
  );
}
export type FetchRedemptionQuoteRequest = {
  tokenIds: bigint[];
  address: RedemptionAddress;
};
export function fetchRedemptionQuote(
  ctx: RedemptionContext,
  request: FetchRedemptionQuoteRequest,
) {
  return operation(async () =>
    privateResponse(
      ctx,
      RedemptionQuoteSchema,
      ctx.service.post('/v2/redeem/quotes', {
        ...(await credentials(ctx)),
        body: {
          tokenIds: parse(idsSchema, request.tokenIds).map(String),
          address: parse(RedemptionAddressSchema, request.address),
        },
      }),
    ),
  );
}
const prepareSchema = z
  .object({
    quoteId: z.uuid(),
    courierId: z.string().min(1),
    recipient: RedemptionRecipientSchema,
    insurance: z.boolean(),
  })
  .strict();
export type PrepareRedemptionRequest = z.input<typeof prepareSchema>;
export function prepareRedemption(
  ctx: RedemptionContext,
  request: PrepareRedemptionRequest,
) {
  return operation(async () =>
    privateResponse(
      ctx,
      PreparedRedemptionSchema,
      ctx.service.post('/v2/redeem/checkout/prepare', {
        ...(await credentials(ctx)),
        body: parse(prepareSchema, request),
      }),
    ),
  );
}
export type RedemptionExpectation = {
  tokenIds: bigint[];
  totalFeeInUsdt: bigint;
  address: RedemptionAddress;
  recipient: RedemptionRecipient;
};
export type SignRedemptionRequest = {
  prepared: PreparedRedemption;
  expected: RedemptionExpectation;
};
export function signRedemption(
  ctx: RedemptionContext,
  request: SignRedemptionRequest,
) {
  return operation(async () => {
    const generation = ctx.generation;
    const config = configFor(ctx);
    const signer = signerFor(ctx);
    const wallet = await currentAddress(ctx);
    assertLive(ctx, generation);
    await credentials(ctx);
    const prepared = parse(
      PreparedRedemptionSchema,
      JSON.parse(
        JSON.stringify(request.prepared, (_, value) =>
          typeof value === 'bigint' ? String(value) : value,
        ),
      ),
    );
    await verifyRedemptionPreparation(
      prepared,
      request.expected,
      config,
      wallet,
      signer,
    );
    const beforeSigning = await currentAddress(ctx);
    assertLive(ctx, generation);
    if (wallet !== beforeSigning)
      throw new RedemptionClientError('Wallet changed');
    let signature: string;
    try {
      signature = await signer.signTypedData(prepared.permitTypedData);
    } catch {
      throw new RedemptionClientError(
        'Redemption was not signed',
        'REDEMPTION_SIGNING_FAILED',
      );
    }
    const afterSigning = await currentAddress(ctx);
    assertLive(ctx, generation);
    if (wallet !== afterSigning)
      throw new RedemptionClientError('Wallet changed');
    return parse(SignedRedemptionSchema, {
      preparationId: prepared.preparationId,
      requestId: prepared.requestId,
      signature,
    });
  });
}
export type SubmitRedemptionRequest = { signed: SignedRedemption };
export function submitRedemption(
  ctx: RedemptionContext,
  request: SubmitRedemptionRequest,
) {
  return operation(async () => {
    const signed = parse(SignedRedemptionSchema, request.signed);
    const result = await privateResponse(
      ctx,
      RedemptionCheckoutSchema,
      ctx.service.post('/v2/redeem/checkout', {
        ...(await credentials(ctx)),
        body: {
          preparationId: signed.preparationId,
          signature: signed.signature,
        },
      }),
    );
    if (result.requestId.toLowerCase() !== signed.requestId.toLowerCase())
      throw new RedemptionClientError(
        'Checkout request ID mismatch',
        'INVALID_SCHEMA',
        422,
      );
    return result;
  });
}
export type RedemptionCheckoutRequest = { preparationId: string };
export function fetchRedemptionCheckout(
  ctx: RedemptionContext,
  request: RedemptionCheckoutRequest,
) {
  return operation(async () =>
    privateResponse(
      ctx,
      RedemptionCheckoutSchema,
      ctx.service.get('/v2/redeem/checkout/{preparationId}', {
        ...(await credentials(ctx)),
        path: { preparationId: parse(z.uuid(), request.preparationId) },
      }),
    ),
  );
}
export type ListRedemptionOrdersRequest = { pageSize?: number };
export function listRedemptionOrders(
  ctx: RedemptionContext,
  request: ListRedemptionOrdersRequest = {},
) {
  return paginate((cursor) =>
    operation(async () => {
      const pageSize = parse(
        z.number().int().min(1).max(20),
        request.pageSize ?? 10,
      );
      const decoded = decodeOffsetCursor(cursor, pageSize);
      if (isFailed(decoded) || decoded.right.pageSize !== pageSize)
        throw new RedemptionClientError('Invalid pagination cursor');
      const result = await privateResponse(
        ctx,
        RedemptionOrdersResponseSchema,
        ctx.service.get('/v2/redeem/orders', {
          ...(await credentials(ctx)),
          query: { limit: pageSize, offset: decoded.right.offset },
        }),
      );
      return {
        items: result.orders,
        hasMore: result.hasMore,
        nextCursor: result.hasMore
          ? encodeOffsetCursor({
              pageSize,
              offset: decoded.right.offset + pageSize,
            })
          : undefined,
      };
    }),
  );
}
export type RedemptionOrderRequest = { requestId: string };
export function fetchRedemptionOrder(
  ctx: RedemptionContext,
  request: RedemptionOrderRequest,
) {
  return operation(async () =>
    privateResponse(
      ctx,
      RedemptionOrderSchema,
      ctx.service.get('/v2/redeem/orders/{requestId}', {
        ...(await credentials(ctx)),
        path: { requestId: parse(bytes32Schema, request.requestId) },
      }),
    ),
  );
}
export function syncRedemptionTracking(
  ctx: RedemptionContext,
  request: RedemptionOrderRequest,
) {
  return operation(async () =>
    privateResponse(
      ctx,
      RedemptionOrderSchema,
      ctx.service.post('/v2/redeem/orders/{requestId}/tracking', {
        ...(await credentials(ctx)),
        path: { requestId: parse(bytes32Schema, request.requestId) },
      }),
    ),
  );
}
