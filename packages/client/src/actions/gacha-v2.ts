import {
  type Action,
  action,
  Failed,
  getError,
  getValue,
  isFailed,
  type Result,
  StatusCodes,
  Success,
} from '@renaiss-protocol/fp';
import {
  addressSchema,
  buildGachaPullTypedData,
  bytes32Schema,
  type EoaBuybackOffer,
  EoaBuybackOfferSchema,
  type EoaBuybackTier,
  EoaContentsResponseSchema,
  EoaHistoryResponseSchema,
  EoaMachineResponseSchema,
  EoaMachinesResponseSchema,
  EoaOffersResponseSchema,
  type EoaPreparedPull,
  EoaPreparedPullSchema,
  EoaPublicHistoryResponseSchema,
  EoaPullSchema,
  type EoaResolvedPull,
  EoaSignedBuybackSchema,
  EoaSignedPullSchema,
  type EoaStreamEvent,
  EoaStreamEventSchema,
  GachaMachineStage,
  GachaQuantitySchema,
  SubmitGachaBuybackResponseSchema,
} from '@renaiss-protocol/schema-validation';
import { z } from 'zod';
import type { RenaissNetwork } from '../networks-v2';
import {
  decodeOffsetCursor,
  encodeOffsetCursor,
  type Page,
  type Paginated,
  paginate,
} from '../pagination';
import {
  isServiceConfigurationError,
  type ServiceClient,
} from '../service-client';
import type { RenaissSigner } from '../signers';

/** Internal workflow context; never exposed by a public client. */
export type EoaContext = {
  service: ServiceClient;
  network: RenaissNetwork;
  builderAuth: boolean;
  signer?: RenaissSigner;
  expectedChainId?: number;
};
const pageRequest = z.object({
  pageSize: z.number().int().min(1).max(100).default(20),
});
const machineRequest = z.object({ slug: z.string().min(1) });
const walletRequest = z.object({ buyerWalletAddress: addressSchema });
const listMachinesRequest = pageRequest.extend({
  stage: z.enum(GachaMachineStage).optional(),
});
const machinePageRequest = pageRequest.extend(machineRequest.shape);
const walletPageRequest = pageRequest.extend(walletRequest.shape);
export type EoaListMachinesRequest = z.input<typeof listMachinesRequest>;
export type EoaMachineRequest = z.input<typeof machineRequest>;
export type EoaMachinePageRequest = z.input<typeof machinePageRequest>;
export type EoaWalletRequest = z.input<typeof walletRequest>;
export type EoaWalletPageRequest = z.input<typeof walletPageRequest>;

function invalid(error: unknown) {
  return Failed(
    'WRONG_REQUEST_PARAMS',
    StatusCodes.BAD_REQUEST,
    typeof error === 'string' ? error : 'Invalid EOA gacha request',
    error,
  );
}

/** Normalize the API's open-ended codes, retaining its original code/body. */
function apiFailure<T>(result: Result<T>): Result<T> {
  if (!isFailed(result)) return result;
  const error = getError(result);
  if (
    isServiceConfigurationError(error) ||
    error.code === 'UNKNOWN_ERROR' ||
    error.code === 'GACHA_STREAM_FAILED'
  )
    return result;
  return Failed('GACHA_V2_REQUEST_FAILED', error.status, error.detail, error);
}

function read<Schema extends z.ZodType>(
  operation: Action<unknown>,
  schema: Schema,
): Action<z.output<Schema>> {
  return async () => {
    const result = apiFailure(await operation());
    if (isFailed(result)) return result;
    const parsed = schema.safeParse(getValue(result));
    return parsed.success
      ? Success(parsed.data)
      : Failed(
          'INVALID_SCHEMA',
          StatusCodes.UNPROCESSABLE_ENTITY,
          'Unexpected v2 response',
          parsed.error,
        );
  };
}

type OffsetPage<T> = { items: T[]; hasMore: boolean; total?: number };
function pages<Schema extends z.ZodType<{ pageSize: number }>, T>(
  schema: Schema,
  request: unknown,
  fetchPage: (
    input: z.output<Schema>,
    offset: number,
    limit: number,
  ) => Action<OffsetPage<T>>,
): Paginated<T[]> {
  return paginate((cursor) => async (): Promise<Result<Page<T[]>>> => {
    const parsed = schema.safeParse(request);
    if (!parsed.success) return invalid(parsed.error);
    const state = decodeOffsetCursor(cursor, parsed.data.pageSize);
    if (isFailed(state)) return state;
    const { offset, pageSize } = getValue(state);
    if (pageSize > 100 || offset > 10000)
      return invalid('Pagination limit exceeded');
    const result = await fetchPage(parsed.data, offset, pageSize)();
    if (isFailed(result)) return result;
    const page = getValue(result);
    return Success({
      items: page.items,
      hasMore: page.hasMore,
      totalCount: page.total,
      nextCursor: page.hasMore
        ? encodeOffsetCursor({ offset: offset + pageSize, pageSize })
        : undefined,
    });
  });
}

/** Lists public machines. Result codes: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, UNKNOWN_ERROR; never throws expected failures. */
export function listEoaMachines(
  ctx: EoaContext,
  request: EoaListMachinesRequest = {},
) {
  return pages(
    listMachinesRequest,
    request,
    (input, offset, limit) => async () => {
      const result = await read(
        ctx.service.get('/v2/gacha/packs', {
          query: { stage: input.stage, limit, offset },
        }),
        EoaMachinesResponseSchema,
      )();
      if (isFailed(result)) return result;
      const { cardPacks, pagination } = getValue(result);
      return Success({ items: cardPacks, ...pagination });
    },
  );
}

/** Fetches machine EV, tier ranges and buyback terms. Result codes: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, UNKNOWN_ERROR. */
export function fetchEoaMachine(ctx: EoaContext, request: EoaMachineRequest) {
  return async () => {
    const parsed = machineRequest.safeParse(request);
    if (!parsed.success) return invalid(parsed.error);
    const result = await read(
      ctx.service.get('/v2/gacha/packs/{slug}', { path: parsed.data }),
      EoaMachineResponseSchema,
    )();
    return isFailed(result) ? result : Success(getValue(result).cardPack);
  };
}

/** Lists display-safe content. Result codes: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, UNKNOWN_ERROR. */
export function listEoaContents(
  ctx: EoaContext,
  request: EoaMachinePageRequest,
) {
  return pages(
    machinePageRequest,
    request,
    (input, offset, limit) => async () => {
      const result = await read(
        ctx.service.get('/v2/gacha/packs/{slug}/content', {
          path: { slug: input.slug },
          query: { offset, limit },
        }),
        EoaContentsResponseSchema,
      )();
      if (isFailed(result)) return result;
      const { collectibles, pagination } = getValue(result);
      return Success({ items: collectibles, ...pagination });
    },
  );
}

/** Lists delayed public machine history. Result codes: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, UNKNOWN_ERROR. */
export function listEoaPublicHistory(
  ctx: EoaContext,
  request: EoaMachinePageRequest,
) {
  return pages(
    machinePageRequest,
    request,
    (input, offset, limit) => async () => {
      const result = await read(
        ctx.service.get('/v2/gacha/packs/{slug}/pull-history', {
          path: { slug: input.slug },
          query: { offset, limit },
        }),
        EoaPublicHistoryResponseSchema,
      )();
      if (isFailed(result)) return result;
      const { pulls, pagination } = getValue(result);
      return Success({ items: pulls, ...pagination });
    },
  );
}

/** Lists resolved pulls attributed to this builder. Empty history does not prove a submission failed. Result codes: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, UNKNOWN_ERROR. */
export function listEoaWalletPulls(
  ctx: EoaContext,
  request: EoaWalletPageRequest,
) {
  return pages(
    walletPageRequest,
    request,
    (input, offset, limit) => async () => {
      const result = await read(
        ctx.service.get('/v2/gacha/pull-history', {
          builderAuth: ctx.builderAuth,
          query: {
            buyerWalletAddress: input.buyerWalletAddress,
            offset,
            limit,
          },
        }),
        EoaHistoryResponseSchema,
      )();
      if (isFailed(result)) return result;
      const { pulls, hasMore } = getValue(result);
      return Success({ items: pulls, hasMore });
    },
  );
}

const statusRequest = walletRequest.extend({ permitFundTxHash: bytes32Schema });
export type EoaDrawStatusRequest = z.input<typeof statusRequest>;
/** Recovers a paid pull by funding hash; never resubmits funding. Result codes: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, UNKNOWN_ERROR. */
export function fetchEoaDrawStatus(
  ctx: EoaContext,
  request: EoaDrawStatusRequest,
) {
  return async () => {
    const parsed = statusRequest.safeParse(request);
    if (!parsed.success) return invalid(parsed.error);
    return read(
      ctx.service.get('/v2/gacha/draw-status', {
        builderAuth: ctx.builderAuth,
        query: parsed.data,
      }),
      EoaPullSchema,
    )();
  };
}

// The offers route pages by `limit` (at most 100) and `offset` (at most 10000)
// and reports no total or `hasMore`: a page shorter than `limit` is the last.
const OFFERS_PAGE_SIZE = 100;
const OFFERS_MAX_OFFSET = 10_000;

/**
 * Fetches the currently offered buybacks for this wallet and builder, reading
 * pages of 100 until a short page and removing repeated settlement ids (first
 * seen wins, in order). The pages are read one after another without a
 * snapshot, so an offer that appears or disappears during the read can be
 * missed: read again before a batch buyback. If the API's maximum offset is
 * reached with a full page, the SDK cannot confirm the list is complete and
 * the call fails instead of returning a partial list.
 *
 * A failure on any page fails the whole call with the code that page's request
 * would have: WRONG_REQUEST_PARAMS for an invalid request, GACHA_V2_REQUEST_FAILED
 * for an API error or an unconfirmable list, INVALID_SCHEMA for an unexpected
 * response, UNKNOWN_ERROR for a network failure or an unknown API body.
 */
export function fetchEoaOffers(ctx: EoaContext, request: EoaWalletRequest) {
  return async () => {
    const parsed = walletRequest.safeParse(request);
    if (!parsed.success) return invalid(parsed.error);
    const offers: EoaBuybackOffer[] = [];
    const seen = new Set<string>();
    let received = 0;
    for (
      let offset = 0;
      offset <= OFFERS_MAX_OFFSET;
      offset += OFFERS_PAGE_SIZE
    ) {
      const result = await read(
        ctx.service.get('/v2/gacha/buyback/offers', {
          builderAuth: ctx.builderAuth,
          query: { ...parsed.data, limit: OFFERS_PAGE_SIZE, offset },
        }),
        EoaOffersResponseSchema,
      )();
      if (isFailed(result)) return result;
      const page = getValue(result).offers;
      received += page.length;
      for (const offer of page) {
        const id = offer.settlementId.toLowerCase();
        if (seen.has(id)) continue;
        seen.add(id);
        offers.push(offer);
      }
      if (page.length < OFFERS_PAGE_SIZE) return Success(offers);
    }
    return Failed(
      'GACHA_V2_REQUEST_FAILED',
      StatusCodes.BAD_GATEWAY,
      `Read ${received} buyback offers and could not confirm the list is complete.`,
      { offersRead: received },
    );
  };
}

const pullExpectation = z.object({
  packId: z.string().uuid(),
  onChainPackId: bytes32Schema,
  priceInUsdt: z
    .bigint()
    .positive()
    .max(2n ** 256n - 1n),
  quantity: GachaQuantitySchema,
});
/** The pack and price the user reviewed, captured before preparation or signing. */
export type EoaPullExpectation = z.input<typeof pullExpectation>;
function canonicalPermit(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalPermit).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalPermit(child)}`)
      .join(',')}}`;
  return JSON.stringify(
    typeof value === 'string' && /^0x[\da-fA-F]+$/.test(value)
      ? value.toLowerCase()
      : value,
  );
}
// The API permits at most five minutes; allow two minutes of clock skew.
const MAX_GACHA_PERMIT_SECONDS = 300 + 120;

function pullDeadlineError(
  deadline: number,
  fresh = false,
): string | undefined {
  const now = Math.floor(Date.now() / 1000);
  if (deadline <= now)
    return fresh
      ? 'The signing window has already expired. Your device clock may be ahead; sync its date and time, then prepare the pull again.'
      : 'The signing window expired; prepare the pull again. An existing token approval remains valid. If this repeats immediately after preparation, check the device clock.';
  if (deadline > now + MAX_GACHA_PERMIT_SECONDS)
    return 'Permit deadline is outside the allowed window. Check the device clock, then prepare the pull again.';
  return undefined;
}

function matchesPullExpectation(
  ctx: EoaContext,
  prepared: EoaPreparedPull,
  expected: EoaPullExpectation,
): boolean {
  const payload = prepared.unsignedPullPayload;
  const network = ctx.network;
  const { usdt, permit2 } = network.marketplace.contracts;
  const fixed = buildGachaPullTypedData({
    chainId: network.chainId,
    amountPerToken: String(expected.priceInUsdt),
    numOfTokens: expected.quantity,
    onChainPackId: expected.onChainPackId,
    builderCode: payload.builderCode,
    nonce: payload.nonce,
    deadline: payload.deadline,
    permit2Address: permit2,
    usdtAddress: usdt,
    vendingMachineAddress: network.vendingMachineAddress,
  });
  return (
    prepared.chainId === network.chainId &&
    prepared.pack.id === expected.packId &&
    payload.packId === expected.packId &&
    prepared.pack.onChainPackId.toLowerCase() ===
      expected.onChainPackId.toLowerCase() &&
    prepared.pack.vendingMachineAddress.toLowerCase() ===
      network.vendingMachineAddress.toLowerCase() &&
    BigInt(prepared.pack.priceInUsdt) === expected.priceInUsdt &&
    BigInt(payload.amountPerToken) === expected.priceInUsdt &&
    payload.numOfTokens === expected.quantity &&
    prepared.approval.token.toLowerCase() === usdt.toLowerCase() &&
    prepared.approval.spender.toLowerCase() === permit2.toLowerCase() &&
    BigInt(prepared.approval.requiredAmount) ===
      expected.priceInUsdt * BigInt(expected.quantity) &&
    canonicalPermit(prepared.permit2TypedData) === canonicalPermit(fixed)
  );
}

const prepareRequest = walletRequest.extend({
  machineSlug: z.string().min(1),
  /** Per-card price shown to the user, in token base units. */
  expectedPriceInUsdt: z
    .bigint()
    .positive()
    .max(2n ** 256n - 1n),
  quantity: GachaQuantitySchema.default(1),
});
export type EoaPreparePullRequest = z.input<typeof prepareRequest>;
/** Prepares an EOA permit and validates fixed signing types, network contracts and the reviewed per-card price before approval. Does not approve or sign. Result codes: GACHA_PRICE_CHANGED (refresh the reviewed price), WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, UNKNOWN_ERROR. */
export function prepareEoaPull(
  ctx: EoaContext,
  request: EoaPreparePullRequest,
) {
  return async () => {
    const parsed = prepareRequest.safeParse(request);
    if (!parsed.success) return invalid(parsed.error);
    const machine = await fetchEoaMachine(ctx, {
      slug: parsed.data.machineSlug,
    })();
    if (isFailed(machine)) return machine;
    if (
      BigInt(getValue(machine).priceInUsdt) !== parsed.data.expectedPriceInUsdt
    )
      return Failed(
        'GACHA_PRICE_CHANGED',
        StatusCodes.CONFLICT,
        'Pack price changed. Review the current price before trying again.',
        { currentPriceInUsdt: getValue(machine).priceInUsdt },
      );
    const result = await read(
      ctx.service.post('/v2/gacha/pull/prepare', {
        builderAuth: ctx.builderAuth,
        body: {
          packId: getValue(machine).id,
          buyerWalletAddress: parsed.data.buyerWalletAddress,
          quantity: parsed.data.quantity,
        },
      }),
      EoaPreparedPullSchema,
    )();
    if (isFailed(result)) return result;
    const prepared = getValue(result);
    const deadlineError = pullDeadlineError(
      prepared.unsignedPullPayload.deadline,
      true,
    );
    if (deadlineError)
      return Failed(
        'INVALID_SCHEMA',
        StatusCodes.UNPROCESSABLE_ENTITY,
        deadlineError,
      );
    if (
      (ctx.expectedChainId !== undefined &&
        prepared.chainId !== ctx.expectedChainId) ||
      prepared.buyerWalletAddress.toLowerCase() !==
        parsed.data.buyerWalletAddress.toLowerCase() ||
      !matchesPullExpectation(ctx, prepared, {
        packId: getValue(machine).id,
        onChainPackId: getValue(machine).onChainPackId,
        priceInUsdt: parsed.data.expectedPriceInUsdt,
        quantity: parsed.data.quantity,
      }) ||
      prepared.pack.id !== getValue(machine).id ||
      prepared.unsignedPullPayload.numOfTokens !== parsed.data.quantity
    )
      return Failed(
        'INVALID_SCHEMA',
        StatusCodes.UNPROCESSABLE_ENTITY,
        'Preparation does not match the requested wallet, chain or pack',
      );
    return result;
  };
}

const signPullRequest = z.object({
  prepared: EoaPreparedPullSchema,
  expected: pullExpectation,
});
export type EoaSignPullRequest = z.input<typeof signPullRequest>;
/** Signs an EOA permit only when it matches the independently reviewed pack, quantity and price. Approve required tokens first. Result codes: WRONG_REQUEST_PARAMS, GACHA_SIGNING_FAILED. */
export function signEoaPull(ctx: EoaContext, request: EoaSignPullRequest) {
  return action(
    async () => {
      const parsed = signPullRequest.safeParse(request);
      if (!parsed.success) return invalid(parsed.error);
      if (!ctx.signer) return invalid('A signer is required');
      const { prepared, expected } = parsed.data;
      const deadlineError = pullDeadlineError(
        prepared.unsignedPullPayload.deadline,
      );
      if (deadlineError) return invalid(deadlineError);
      if (!matchesPullExpectation(ctx, prepared, expected))
        return invalid(
          'Preparation does not match the reviewed pack, price or network',
        );
      const buyer = (await ctx.signer.getAddress()).toLowerCase();
      const p = prepared.unsignedPullPayload;
      const t = prepared.permit2TypedData;
      const m = t.message;
      const same = (a: string, b: string) =>
        a.toLowerCase() === b.toLowerCase();
      if (
        !same(buyer, prepared.buyerWalletAddress) ||
        (ctx.expectedChainId !== undefined &&
          prepared.chainId !== ctx.expectedChainId) ||
        prepared.chainId !== t.domain.chainId ||
        p.packId !== prepared.pack.id ||
        p.amountPerToken !== prepared.pack.priceInUsdt ||
        !same(prepared.approval.token, m.permitted.token) ||
        !same(prepared.approval.spender, t.domain.verifyingContract) ||
        !same(prepared.pack.vendingMachineAddress, m.spender) ||
        !same(prepared.pack.onChainPackId, m.witness.packId) ||
        !same(p.builderCode, m.witness.builder) ||
        BigInt(p.nonce) !== BigInt(m.nonce) ||
        BigInt(p.deadline) !== BigInt(m.deadline) ||
        BigInt(p.numOfTokens) !== BigInt(m.witness.numOfTokens) ||
        BigInt(prepared.approval.requiredAmount) !==
          BigInt(m.permitted.amount) ||
        BigInt(p.amountPerToken) * BigInt(p.numOfTokens) !==
          BigInt(m.permitted.amount)
      )
        return invalid(
          'Prepared permit is expired or inconsistent with the buyer, chain, pack or approval',
        );
      const latestDeadlineError = pullDeadlineError(p.deadline);
      if (latestDeadlineError) return invalid(latestDeadlineError);
      const signature = await ctx.signer.signTypedData({
        ...t,
        message: {
          ...m,
          permitted: { ...m.permitted, amount: BigInt(m.permitted.amount) },
          nonce: BigInt(m.nonce),
          deadline: BigInt(m.deadline),
          witness: { ...m.witness, numOfTokens: BigInt(m.witness.numOfTokens) },
        },
      });
      const { builderCode: _builderCode, ...payload } = p;
      const signed = EoaSignedPullSchema.safeParse({
        ...payload,
        buyerWalletAddress: prepared.buyerWalletAddress,
        permitSignature: signature,
      });
      return signed.success ? Success(signed.data) : invalid(signed.error);
    },
    (error) =>
      Failed(
        'GACHA_SIGNING_FAILED',
        StatusCodes.BAD_REQUEST,
        'EOA signing failed',
        error,
      ),
  );
}

export type EoaSubmitPullRequest = {
  pull: z.input<typeof EoaSignedPullSchema>;
  onEvent?: (event: EoaStreamEvent) => void | Promise<void>;
  signal?: AbortSignal;
};
/** Submits once, stopping at resolution/failure. Save payment_confirmed before rendering. An interrupted stream never retries funding. Result codes: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, GACHA_STREAM_FAILED, UNKNOWN_ERROR. Failure error carries permitFundTxHash when known. */
export function submitEoaPull(
  ctx: EoaContext,
  request: EoaSubmitPullRequest,
): Action<EoaResolvedPull> {
  return async () => {
    const parsed = EoaSignedPullSchema.safeParse(request?.pull);
    if (!parsed.success) return invalid(parsed.error);
    let resolved: EoaResolvedPull | undefined;
    let failure: Result<never> | undefined;
    let permitFundTxHash: string | undefined;
    let receivedEvent = false;
    const stream = await ctx.service.postSse('/v2/gacha/pull/stream', {
      body: parsed.data,
      builderAuth: ctx.builderAuth,
      signal: request.signal ?? AbortSignal.timeout(180_000),
      async onEvent(raw) {
        receivedEvent = true;
        const event = EoaStreamEventSchema.safeParse(raw);
        if (!event.success) {
          failure = Failed(
            'INVALID_SCHEMA',
            StatusCodes.UNPROCESSABLE_ENTITY,
            'Invalid v2 stream event',
            event.error,
          );
          return false;
        }
        const value = event.data;
        if (
          value.data.buyerWalletAddress.toLowerCase() !==
            parsed.data.buyerWalletAddress.toLowerCase() ||
          value.data.packId !== parsed.data.packId ||
          value.data.nonce !== parsed.data.nonce ||
          value.data.numOfTokens !== parsed.data.numOfTokens
        ) {
          failure = Failed(
            'INVALID_SCHEMA',
            StatusCodes.UNPROCESSABLE_ENTITY,
            'Stream does not match submitted pull',
          );
          return false;
        }
        if ('permitFundTxHash' in value.data && value.data.permitFundTxHash)
          permitFundTxHash = value.data.permitFundTxHash;
        if (value.event === 'draws_resolved') {
          if (
            value.data.draws.length !== parsed.data.numOfTokens ||
            new Set(
              value.data.draws.map((draw) => draw.settlementId.toLowerCase()),
            ).size !== value.data.draws.length
          ) {
            failure = Failed(
              'INVALID_SCHEMA',
              StatusCodes.UNPROCESSABLE_ENTITY,
              'Resolved draw count or settlement IDs do not match the purchase',
            );
            return false;
          }
          resolved = value.data;
        }
        if (value.event === 'pull_failed')
          failure = Failed(
            'GACHA_V2_REQUEST_FAILED',
            StatusCodes.BAD_GATEWAY,
            value.data.error,
            value.data,
          );
        await request.onEvent?.(value);
        return (
          value.event !== 'draws_resolved' && value.event !== 'pull_failed'
        );
      },
    })();
    // A callback or transport failure after payment must retain recovery context.
    const failed =
      failure ?? (isFailed(stream) ? apiFailure(stream) : undefined);
    if (failed && isFailed(failed)) {
      const error = getError(failed);
      return Failed(error.code, error.status, error.detail, {
        cause: error.error,
        rejectedBeforeStream:
          !receivedEvent &&
          !permitFundTxHash &&
          [400, 401, 403, 404, 413, 422, 429].includes(error.status),
        permitFundTxHash,
        fundingConfirmed: permitFundTxHash !== undefined,
      });
    }
    if (resolved) return Success(resolved);
    return Failed(
      'GACHA_STREAM_FAILED',
      StatusCodes.BAD_GATEWAY,
      'Stream ended before resolution. Recover using draw status or wallet history before another pull.',
      { permitFundTxHash, fundingConfirmed: permitFundTxHash !== undefined },
    );
  };
}

/**
 * The buyback tier that prices `offer` at `at` (default: now): the tier with
 * the soonest `expiresAt` that has not passed, since a tier still applies at
 * its `expiresAt`. On a same-end tie the lower amount applies. Returns
 * `undefined` once every tier has ended. A tier with an `amountInUsdt` of 0 is
 * a hold: the offer cannot be sold back until a later tier starts.
 */
export function currentBuybackTier(
  offer: EoaBuybackOffer,
  at: Date = new Date(),
): EoaBuybackTier | undefined {
  const now = at.getTime();
  return [...offer.buybackTiers]
    .sort((a, b) => {
      const byEnd = Date.parse(a.expiresAt) - Date.parse(b.expiresAt);
      if (byEnd !== 0) return byEnd;
      const x = BigInt(a.amountInUsdt);
      const y = BigInt(b.amountInUsdt);
      return x < y ? -1 : x > y ? 1 : 0;
    })
    .find((tier) => Date.parse(tier.expiresAt) >= now);
}

const buybackRequest = walletRequest.extend({
  chainId: z.number().int().positive(),
  token: addressSchema,
  offers: z.array(EoaBuybackOfferSchema).min(1).max(10),
});
export type EoaCreateBuybackRequest = z.input<typeof buybackRequest>;
/** Signs compatible offers for the exact bigint sum of each offer's current tier price. Result codes: WRONG_REQUEST_PARAMS, GACHA_SIGNING_FAILED. No NFT approval is required. */
export function createEoaBuyback(
  ctx: EoaContext,
  request: EoaCreateBuybackRequest,
) {
  return action(
    async () => {
      const parsed = buybackRequest.safeParse(request);
      if (!parsed.success) return invalid(parsed.error);
      if (!ctx.signer) return invalid('A signer is required');
      const { offers, buyerWalletAddress, chainId, token } = parsed.data;
      const first = offers[0];
      // Priced once, at signing time: a tier that ends before the API receives
      // the buyback makes it fail with GACHA_V3_BUYBACK_PRICE_CHANGED.
      const signedAt = new Date();
      const prices = offers.map(
        (offer) => currentBuybackTier(offer, signedAt)?.amountInUsdt,
      );
      if (
        !first ||
        chainId !== ctx.network.chainId ||
        token.toLowerCase() !==
          ctx.network.marketplace.contracts.usdt.toLowerCase() ||
        first.vendingMachineAddress.toLowerCase() !==
          ctx.network.vendingMachineAddress.toLowerCase() ||
        (ctx.expectedChainId !== undefined &&
          chainId !== ctx.expectedChainId) ||
        (await ctx.signer.getAddress()).toLowerCase() !==
          buyerWalletAddress.toLowerCase() ||
        new Set(offers.map((o) => o.settlementId.toLowerCase())).size !==
          offers.length ||
        offers.some(
          (o) =>
            o.cardPackId !== first.cardPackId ||
            o.vendingMachineAddress.toLowerCase() !==
              first.vendingMachineAddress.toLowerCase(),
        ) ||
        prices.some((price) => price === undefined || BigInt(price) <= 0n)
      )
        return invalid(
          'Offers must be unique, priced above zero now, from one pack and contract, and signed by the buyer on the expected chain',
        );
      const amount = prices.reduce(
        (sum, price) => sum + BigInt(price ?? 0),
        0n,
      );
      const buybackIds = offers.map((offer) => offer.settlementId);
      const userSignature = await ctx.signer.signTypedData({
        domain: {
          name: 'TokenVendingMachineV3',
          version: '1',
          chainId,
          verifyingContract: first.vendingMachineAddress,
        },
        primaryType: 'BuybackUserAuthorization',
        types: {
          BuybackUserAuthorization: [
            { name: 'buybackIds', type: 'bytes32[]' },
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
        },
        message: { buybackIds, token, amount },
      });
      const signed = EoaSignedBuybackSchema.safeParse({
        buyerWalletAddress,
        cardPackId: first.cardPackId,
        buybackAuth: { buybackIds, token, amount: amount.toString() },
        userSignature,
      });
      return signed.success ? Success(signed.data) : invalid(signed.error);
    },
    (error) =>
      Failed(
        'GACHA_SIGNING_FAILED',
        StatusCodes.BAD_REQUEST,
        'EOA buyback signing failed',
        error,
      ),
  );
}

export type EoaSubmitBuybackRequest = z.input<typeof EoaSignedBuybackSchema>;
/** Submits a signed buyback once. Result codes: WRONG_REQUEST_PARAMS, INVALID_SCHEMA, GACHA_V2_REQUEST_FAILED, UNKNOWN_ERROR. */
export function submitEoaBuyback(
  ctx: EoaContext,
  request: EoaSubmitBuybackRequest,
) {
  return async () => {
    const parsed = EoaSignedBuybackSchema.safeParse(request);
    if (!parsed.success) return invalid(parsed.error);
    return read(
      ctx.service.post('/v2/gacha/buyback', {
        builderAuth: ctx.builderAuth,
        body: parsed.data,
      }),
      SubmitGachaBuybackResponseSchema,
    )();
  };
}
