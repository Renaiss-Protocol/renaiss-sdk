import {
  type Action,
  type ApiError,
  Failed,
  getError,
  getValue,
  isFailed,
  pipe,
  type Result,
  run,
  StatusCodes,
  Success,
  TE,
} from '@renaiss-protocol/fp';
import {
  type AcceptBidQuote,
  type AskQuote,
  addressSchema,
  type BidQuote,
  CardDetailV2Schema,
  CardOrdersV2Schema,
  type MarketplaceCancellationV2,
  MarketplaceCancellationV2Schema,
  MarketplaceCardCategory,
  MarketplaceCardsV2ResponseSchema,
  type MarketplaceCardV2,
  type MarketplaceOrderResult,
  MarketplaceOrderResultSchema,
  MarketplaceSortOrder,
  type MarketplaceTypedData,
  numericStringSchema,
  PrepareAcceptBidResponseSchema,
  PrepareAskResponseSchema,
  PrepareBidResponseSchema,
  PreparedMarketplaceCancellationSchema,
} from '@renaiss-protocol/schema-validation';
import { z } from 'zod';
import type { MarketplaceConfig } from '../networks-v2';
import {
  decodeOffsetCursor,
  encodeOffsetCursor,
  type Paginated,
  type PaginationCursor,
  paginate,
} from '../pagination';
import { validateWith } from '../response';
import {
  isServiceConfigurationError,
  type ServiceClient,
} from '../service-client';
import type { RenaissSigner } from '../signers';

export type MarketplaceV2Context = {
  service: ServiceClient;
  builderAuth: boolean;
  signer?: RenaissSigner;
  expectedChainId?: number;
  /** Explicit SDK network constants, never taken from a preparation response. */
  config: MarketplaceConfig;
};
export enum MarketplaceV2Sort {
  ListDate = 'listDate',
  MintDate = 'mintDate',
  Name = 'name',
  Year = 'year',
  Price = 'priceRange',
  AskPrice = 'askPriceInUSDT',
  Fmv = 'fmvInUsd',
}
export enum MarketplaceLanguage {
  English = 'English',
  Japanese = 'Japanese',
  Chinese = 'Chinese',
  TraditionalChinese = 'Traditional Chinese',
  SimplifiedChinese = 'Simplified Chinese',
  Korean = 'Korean',
  French = 'French',
  German = 'German',
  Italian = 'Italian',
  Spanish = 'Spanish',
  Portuguese = 'Portuguese',
  Indonesian = 'Indonesian',
  Polish = 'Polish',
}
export enum MarketplaceGradingCompany {
  PSA = 'PSA',
  BGS = 'BGS',
  CGC = 'CGC',
  SGC = 'SGC',
}
/** Supported ask-price bands, in USDT. Bounds are inclusive. */
export enum MarketplacePriceRange {
  UpTo100 = '<$100',
  From101To250 = '$101-$250',
  From251To500 = '$251-$500',
  From501To1000 = '$501-$1000',
  From1000 = '$1000+',
}

/** A submitted ask, with the price breakdown the seller signed. */
export type CreateAskResult = MarketplaceOrderResult & { quote: AskQuote };

/** A submitted bid, with the amount and expiry the buyer signed. */
export type CreateBidResult = MarketplaceOrderResult & { quote: BidQuote };

/** A settled buy-now, with the amount the buyer signed. */
export type BuyCardResult = MarketplaceOrderResult & { quote: BidQuote };

/** A settled bid acceptance, with the price breakdown the seller signed. */
export type AcceptBidResult = MarketplaceOrderResult & {
  quote: AcceptBidQuote;
};

const listRequest = z.object({
  category: z.enum(MarketplaceCardCategory).optional(),
  listedOnly: z.boolean().optional(),
  pageSize: z.number().int().min(1).max(100).default(25),
  search: z.string().trim().min(3).max(150).optional(),
  sortBy: z.enum(MarketplaceV2Sort).optional(),
  sortOrder: z.enum(MarketplaceSortOrder).optional(),
  character: z.string().optional(),
  language: z.enum(MarketplaceLanguage).optional(),
  gradingCompany: z.enum(MarketplaceGradingCompany).optional(),
  grade: z.string().optional(),
  /** Inclusive four-digit years: YYYY-YYYY or YYYY+ for no upper bound. */
  yearRange: z
    .string()
    .regex(/^\d{4}(?:-\d{4}|\+)$/)
    .refine((range) => {
      const [from, to] = range.split('-');
      return range.endsWith('+') || Number(from) <= Number(to);
    })
    .optional(),
  priceRange: z.enum(MarketplacePriceRange).optional(),
});
export type ListMarketplaceCardsV2Request = z.input<typeof listRequest>;
function normalizeApiFailure(error: ApiError): ApiError {
  if (isServiceConfigurationError(error) || error.code === 'UNKNOWN_ERROR')
    return error;
  return getError(
    Failed('MARKETPLACE_V2_REQUEST_FAILED', error.status, error.detail, error),
  );
}
function invalid(detail: string, error?: unknown) {
  return Failed('WRONG_REQUEST_PARAMS', StatusCodes.BAD_REQUEST, detail, error);
}
/** Browse with marketplace filters. Returns WRONG_REQUEST_PARAMS, INVALID_SCHEMA, MARKETPLACE_V2_REQUEST_FAILED or UNKNOWN_ERROR as values. */
export function listMarketplaceCardsV2(
  ctx: MarketplaceV2Context,
  request: ListMarketplaceCardsV2Request = {},
): Paginated<MarketplaceCardV2[]> {
  const parsed = listRequest.safeParse(request);
  if (!parsed.success)
    return paginate(
      () => async () => invalid('Invalid marketplace filters', parsed.error),
    );
  const input = parsed.data;
  return paginate((cursor?: PaginationCursor) => {
    const decoded = decodeOffsetCursor(cursor, input.pageSize);
    if (isFailed(decoded)) return async () => decoded;
    const { offset } = getValue(decoded);
    return pipe(
      ctx.service.get('/v2/marketplace', {
        query: {
          categoryFilter: input.category,
          listedOnly: input.listedOnly,
          limit: input.pageSize,
          offset,
          search: input.search,
          sortBy: input.sortBy,
          sortOrder: input.sortOrder,
          characterFilter: input.character,
          languageFilter: input.language,
          gradingCompanyFilter: input.gradingCompany,
          gradeFilter: input.grade,
          yearRange: input.yearRange,
          priceRangeFilter: input.priceRange,
        },
      }),
      TE.mapLeft(normalizeApiFailure),
      TE.chainW(validateWith(MarketplaceCardsV2ResponseSchema)),
      TE.map((response) => ({
        items: response.collection,
        totalCount: response.pagination.total,
        hasMore: response.pagination.hasMore,
        nextCursor: response.pagination.hasMore
          ? encodeOffsetCursor({
              offset: offset + input.pageSize,
              pageSize: input.pageSize,
            })
          : undefined,
      })),
    );
  });
}
const tokenRequest = z.object({ tokenId: numericStringSchema });
export type MarketplaceCardV2Request = z.input<typeof tokenRequest> & {
  signal?: AbortSignal;
};
/** Read a visible card and its price history. Returns WRONG_REQUEST_PARAMS, INVALID_SCHEMA, MARKETPLACE_V2_REQUEST_FAILED or UNKNOWN_ERROR as values. */
export function fetchCardV2(
  ctx: MarketplaceV2Context,
  request: MarketplaceCardV2Request,
) {
  const parsed = tokenRequest.safeParse(request);
  if (!parsed.success)
    return async () => invalid('Invalid token ID', parsed.error);
  return pipe(
    ctx.service.get('/v2/marketplace/collectibles/{tokenId}', {
      path: parsed.data,
      signal: request.signal,
    }),
    TE.mapLeft(normalizeApiFailure),
    TE.chainW(validateWith(CardDetailV2Schema)),
  );
}
/** Read the live ask and funded bids. Returns WRONG_REQUEST_PARAMS, INVALID_SCHEMA, MARKETPLACE_V2_REQUEST_FAILED or UNKNOWN_ERROR as values. */
export function fetchCardOrdersV2(
  ctx: MarketplaceV2Context,
  request: MarketplaceCardV2Request,
) {
  const parsed = tokenRequest.safeParse(request);
  if (!parsed.success)
    return async () => invalid('Invalid token ID', parsed.error);
  return pipe(
    ctx.service.get('/v2/marketplace/collectibles/{tokenId}/orders', {
      path: parsed.data,
      signal: request.signal,
    }),
    TE.mapLeft(normalizeApiFailure),
    TE.chainW(validateWith(CardOrdersV2Schema)),
  );
}
// SDK money inputs are bigint; decimal strings exist only at the HTTP boundary.
const positiveAmount = z
  .bigint()
  .positive()
  .max(2n ** 256n - 1n)
  .transform(String);
// The API refuses an order that expires more than 180 days from now.
const MAX_ORDER_EXPIRY_SECONDS = 180 * 86400;
const expiry = {
  expiresAt: z
    .string()
    .datetime()
    .refine(
      (at) => Date.parse(at) <= Date.now() + MAX_ORDER_EXPIRY_SECONDS * 1000,
    )
    .optional(),
  expiresInSeconds: z
    .number()
    .int()
    .positive()
    .max(MAX_ORDER_EXPIRY_SECONDS)
    .optional(),
};
const askRequest = tokenRequest
  .extend({
    ...expiry,
    totalPriceInUsdt: positiveAmount.optional(),
    sellerReceivesInUsdt: positiveAmount.optional(),
  })
  .refine(
    (i) =>
      (i.totalPriceInUsdt !== undefined) !==
      (i.sellerReceivesInUsdt !== undefined),
  );
const bidRequest = tokenRequest.extend({
  ...expiry,
  amountInUsdt: positiveAmount,
});
const buyRequest = tokenRequest.extend({
  ...expiry,
  expectedTotalPriceInUsdt: positiveAmount,
});
const sellRequest = tokenRequest.extend({
  ...expiry,
  bidId: z.string().uuid(),
  /** Total bid price the seller reviewed, in token base units. */
  expectedTotalPriceInUsdt: positiveAmount,
});
export type EoaCreateAskRequest = z.input<typeof askRequest> & {
  signal?: AbortSignal;
};
export type EoaCreateBidRequest = z.input<typeof bidRequest> & {
  signal?: AbortSignal;
};
export type EoaBuyCardRequest = z.input<typeof buyRequest> & {
  signal?: AbortSignal;
};
export type EoaAcceptBidRequest = z.input<typeof sellRequest> & {
  signal?: AbortSignal;
};
async function signerAddress(
  ctx: MarketplaceV2Context,
): Promise<Result<string>> {
  if (!ctx.signer) return invalid('Configure an EOA signer to trade');
  try {
    const address = addressSchema.safeParse(await ctx.signer.getAddress());
    return address.success
      ? Success(address.data.toLowerCase())
      : invalid('Invalid signer address');
  } catch (e) {
    return Failed(
      'MARKETPLACE_SIGNING_FAILED',
      StatusCodes.BAD_REQUEST,
      'Could not read the signing wallet',
      e,
    );
  }
}
const askTypes = {
  Ask: [
    { name: 'salt', type: 'bytes4' },
    { name: 'deadline', type: 'uint256' },
    { name: 'usdcAmount', type: 'uint256' },
    { name: 'owner', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
  ],
};
const bidTypes = {
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
};
const cancelTypes = {
  CancelMarketplaceOrder: [
    { name: 'orderId', type: 'string' },
    { name: 'owner', type: 'address' },
    { name: 'builderCode', type: 'bytes32' },
    { name: 'deadline', type: 'uint256' },
  ],
};
function fixedTypesMatch(
  actual: Record<string, { name: string; type: string }[]>,
  expected: Record<string, { name: string; type: string }[]>,
): boolean {
  return (
    Object.keys(actual).length === Object.keys(expected).length &&
    Object.entries(expected).every(
      ([name, fields]) =>
        actual[name]?.length === fields.length &&
        fields.every(
          (field, i) =>
            actual[name]?.[i]?.name === field.name &&
            actual[name]?.[i]?.type === field.type,
        ),
    )
  );
}
async function sign(
  ctx: MarketplaceV2Context,
  walletAddress: string,
  typedData: MarketplaceTypedData,
): Promise<Result<string>> {
  if (
    !ctx.signer ||
    (ctx.expectedChainId !== undefined &&
      typedData.domain.chainId !== ctx.expectedChainId)
  )
    return invalid('Unexpected marketplace signing chain');
  const config = ctx.config;
  const permit = typedData.primaryType === 'PermitWitnessTransferFrom';
  const types = permit
    ? bidTypes
    : typedData.primaryType === 'Ask'
      ? askTypes
      : typedData.primaryType === 'CancelMarketplaceOrder'
        ? cancelTypes
        : undefined;
  if (
    !types ||
    !fixedTypesMatch(typedData.types, types) ||
    (permit && typedData.domain.name !== 'Permit2')
  )
    return invalid('Unexpected marketplace signing types');
  const expectedContract = permit
    ? config.contracts.permit2
    : config.contracts.orderbook;
  const deadline = typedData.message.deadline;
  if (
    typeof deadline === 'string' &&
    /^\d+$/.test(deadline) &&
    BigInt(deadline) <= BigInt(Math.floor(Date.now() / 1000))
  )
    return invalid(
      'The signing window expired. Check the device clock, then prepare the order again.',
    );
  if (
    typedData.domain.chainId !== config.chainId ||
    String(typedData.domain.verifyingContract).toLowerCase() !==
      expectedContract.toLowerCase() ||
    typeof deadline !== 'string' ||
    !/^\d+$/.test(deadline) ||
    BigInt(deadline) <= BigInt(Math.floor(Date.now() / 1000)) ||
    (permit &&
      !matchesMessage(typedData.message, {
        permitted: { token: config.contracts.usdt },
        spender: config.contracts.orderbook,
        witness: { feeBps: String(config.platformFeeBps) },
      }))
  )
    return invalid(
      'Prepared signature has unexpected contracts, chain, fee or expiry. Check your SDK version and selected network before reviewing the order again.',
    );
  try {
    if ((await ctx.signer.getAddress()).toLowerCase() !== walletAddress)
      return invalid('Wallet changed while preparing the order');
    return Success(await ctx.signer.signTypedData({ ...typedData, types }));
  } catch (e) {
    return Failed(
      'MARKETPLACE_SIGNING_FAILED',
      StatusCodes.BAD_REQUEST,
      'Marketplace signature rejected',
      e,
    );
  }
}
function validExpiry(request: {
  expiresAt?: string;
  expiresInSeconds?: number;
}) {
  return (
    request.expiresAt === undefined || request.expiresInSeconds === undefined
  );
}
type RequestedExpiry = { expiresAt?: string; expiresInSeconds?: number };
function requestedExpiryError(
  deadline: string,
  request: RequestedExpiry,
  preparedAt: number,
): string | undefined {
  if (!/^\d+$/.test(deadline)) return 'Prepared order deadline is invalid.';
  const actual = BigInt(deadline);
  if (actual <= BigInt(Math.floor(Date.now() / 1000)))
    return 'The signing window expired; prepare the order again. An existing token approval remains valid. If this happens immediately, your device clock may be ahead; sync its date and time.';
  if (request.expiresAt !== undefined)
    return actual === BigInt(Math.floor(Date.parse(request.expiresAt) / 1000))
      ? undefined
      : 'Prepared order expiry differs from the requested expiry. Review the expiry and prepare again.';
  return actual <=
    BigInt(preparedAt + (request.expiresInSeconds ?? 30 * 86400) + 120)
    ? undefined
    : 'Permit deadline is outside the allowed window. Check the device clock, then prepare the order again.';
}
function matchesMessage(
  message: Record<string, unknown>,
  expected: Record<string, unknown>,
): boolean {
  return Object.entries(expected).every(([key, value]) =>
    typeof value === 'object' && value !== null
      ? typeof message[key] === 'object' &&
        message[key] !== null &&
        matchesMessage(
          message[key] as Record<string, unknown>,
          value as Record<string, unknown>,
        )
      : String(message[key]).toLowerCase() === String(value).toLowerCase(),
  );
}
/** List the signer's card. Returns WRONG_REQUEST_PARAMS, INVALID_SCHEMA, MARKETPLACE_V2_REQUEST_FAILED, MARKETPLACE_SIGNING_FAILED or UNKNOWN_ERROR as values. Never retries a submission. */
export function createAskV2(
  ctx: MarketplaceV2Context,
  request: EoaCreateAskRequest,
): Action<CreateAskResult> {
  return async () => {
    const parsed = askRequest.safeParse(request);
    if (!parsed.success || !validExpiry(parsed.data))
      return invalid('Invalid ask request');
    const who = await signerAddress(ctx);
    if (isFailed(who)) return who;
    const walletAddress = getValue(who);
    const preparedAt = Math.floor(Date.now() / 1000);
    const prepared = await run(
      pipe(
        ctx.service.post('/v2/marketplace/asks/prepare', {
          body: { ...parsed.data, walletAddress },
          builderAuth: ctx.builderAuth,
          signal: request.signal,
        }),
        TE.mapLeft(normalizeApiFailure),
        TE.chainW(validateWith(PrepareAskResponseSchema)),
      ),
    );
    if (isFailed(prepared)) return prepared;
    const p = getValue(prepared);
    const feeBps = BigInt(ctx.config.platformFeeBps);
    const total =
      parsed.data.totalPriceInUsdt !== undefined
        ? BigInt(parsed.data.totalPriceInUsdt)
        : (BigInt(parsed.data.sellerReceivesInUsdt ?? '0') *
            (10000n + feeBps)) /
          10000n;
    const net =
      parsed.data.sellerReceivesInUsdt !== undefined
        ? BigInt(parsed.data.sellerReceivesInUsdt)
        : (total * 10000n) / (10000n + feeBps);
    const deadlineError = requestedExpiryError(
      p.payload.askData.deadline,
      parsed.data,
      preparedAt,
    );
    if (deadlineError) return invalid(deadlineError);
    if (
      BigInt(p.quote.totalPriceInUsdt) !== total ||
      BigInt(p.quote.sellerReceivesInUsdt) !== net ||
      BigInt(p.quote.platformFeeInUsdt) !== total - net ||
      p.tokenId !== parsed.data.tokenId ||
      p.sellerWalletAddress.toLowerCase() !== walletAddress ||
      p.payload.askData.owner.toLowerCase() !== walletAddress ||
      p.payload.askData.tokenId !== parsed.data.tokenId ||
      p.payload.askData.usdcAmount !== p.quote.totalPriceInUsdt ||
      p.typedData.primaryType !== 'Ask' ||
      !matchesMessage(p.typedData.message, p.payload.askData) ||
      (parsed.data.totalPriceInUsdt !== undefined &&
        parsed.data.totalPriceInUsdt !== p.quote.totalPriceInUsdt) ||
      (parsed.data.sellerReceivesInUsdt !== undefined &&
        parsed.data.sellerReceivesInUsdt !== p.quote.sellerReceivesInUsdt)
    )
      return invalid('Prepared ask does not match the request');
    const signature = await sign(ctx, walletAddress, p.typedData);
    if (isFailed(signature)) return signature;
    const result = await run(
      pipe(
        ctx.service.post('/v2/marketplace/asks', {
          body: { ...p.payload, askSignature: getValue(signature) },
          builderAuth: ctx.builderAuth,
          signal: request.signal,
        }),
        TE.mapLeft(normalizeApiFailure),
        TE.chainW(validateWith(MarketplaceOrderResultSchema)),
      ),
    );
    return isFailed(result)
      ? result
      : Success({ ...getValue(result), quote: p.quote });
  };
}
async function executeBid(
  ctx: MarketplaceV2Context,
  request: EoaCreateBidRequest | EoaBuyCardRequest,
  operation: 'bid' | 'buy',
): Promise<Result<CreateBidResult | BuyCardResult>> {
  const parsed =
    operation === 'bid'
      ? bidRequest.safeParse(request)
      : buyRequest.safeParse(request);
  if (!parsed.success || !validExpiry(parsed.data))
    return invalid('Invalid bid or buy request');
  const who = await signerAddress(ctx);
  if (isFailed(who)) return who;
  const walletAddress = getValue(who);
  const preparedAt = Math.floor(Date.now() / 1000);
  const prepared = await run(
    pipe(
      ctx.service.post(
        operation === 'bid'
          ? '/v2/marketplace/bids/prepare'
          : '/v2/marketplace/buy/prepare',
        {
          body: { ...parsed.data, walletAddress },
          builderAuth: ctx.builderAuth,
          signal: request.signal,
        },
      ),
      TE.mapLeft(normalizeApiFailure),
      TE.chainW(validateWith(PrepareBidResponseSchema)),
    ),
  );
  if (isFailed(prepared)) return prepared;
  const p = getValue(prepared);
  const bid = p.payload.bidData;
  const expectedAmount =
    'amountInUsdt' in parsed.data
      ? parsed.data.amountInUsdt
      : parsed.data.expectedTotalPriceInUsdt;
  const deadlineError = requestedExpiryError(
    bid.deadline,
    parsed.data,
    preparedAt,
  );
  if (deadlineError) return invalid(deadlineError);
  if (
    p.operation !== operation ||
    p.tokenId !== parsed.data.tokenId ||
    p.buyerWalletAddress.toLowerCase() !== walletAddress ||
    bid.bidder.toLowerCase() !== walletAddress ||
    bid.tokenId !== parsed.data.tokenId ||
    bid.amount !== expectedAmount ||
    p.quote.amountInUsdt !== expectedAmount ||
    p.typedData.primaryType !== 'PermitWitnessTransferFrom' ||
    !matchesMessage(p.typedData.message, {
      permitted: { amount: bid.amount },
      nonce: bid.nonce,
      deadline: bid.deadline,
      witness: { bidder: bid.bidder, feeBps: bid.feeBps, tokenId: bid.tokenId },
    })
  )
    return invalid('Prepared bid does not match the request');
  const signature = await sign(ctx, walletAddress, p.typedData);
  if (isFailed(signature)) return signature;
  const result = await run(
    pipe(
      ctx.service.post(
        operation === 'bid' ? '/v2/marketplace/bids' : '/v2/marketplace/buy',
        {
          body: { ...p.payload, bidSignature: getValue(signature) },
          builderAuth: ctx.builderAuth,
          signal: request.signal,
        },
      ),
      TE.mapLeft(normalizeApiFailure),
      TE.chainW(validateWith(MarketplaceOrderResultSchema)),
    ),
  );
  return isFailed(result)
    ? result
    : Success({ ...getValue(result), quote: p.quote });
}
/** Bid directly from the EOA; approve USDT to Permit2 first. Returns WRONG_REQUEST_PARAMS, INVALID_SCHEMA, MARKETPLACE_V2_REQUEST_FAILED, MARKETPLACE_SIGNING_FAILED or UNKNOWN_ERROR as values. */
export function createBidV2(
  ctx: MarketplaceV2Context,
  request: EoaCreateBidRequest,
): Action<CreateBidResult> {
  return () => executeBid(ctx, request, 'bid');
}
/** Buy at the displayed ask; expectedTotalPriceInUsdt is required. Returns WRONG_REQUEST_PARAMS, INVALID_SCHEMA, MARKETPLACE_V2_REQUEST_FAILED, MARKETPLACE_SIGNING_FAILED or UNKNOWN_ERROR as values. Do not blindly retry an interrupted submission. */
export function buyCardV2(
  ctx: MarketplaceV2Context,
  request: EoaBuyCardRequest,
): Action<BuyCardResult> {
  return () => executeBid(ctx, request, 'buy');
}
/** Sell to a specific funded bid at the reviewed expectedTotalPriceInUsdt. Returns WRONG_REQUEST_PARAMS, INVALID_SCHEMA, MARKETPLACE_V2_REQUEST_FAILED, MARKETPLACE_SIGNING_FAILED or UNKNOWN_ERROR as values. */
export function acceptBidV2(
  ctx: MarketplaceV2Context,
  request: EoaAcceptBidRequest,
): Action<AcceptBidResult> {
  return async () => {
    const parsed = sellRequest.safeParse(request);
    if (!parsed.success || !validExpiry(parsed.data))
      return invalid('Invalid bid acceptance');
    const who = await signerAddress(ctx);
    if (isFailed(who)) return who;
    const walletAddress = getValue(who);
    const { bidId, expectedTotalPriceInUsdt, ...input } = parsed.data;
    const preparedAt = Math.floor(Date.now() / 1000);
    const prepared = await run(
      pipe(
        ctx.service.post('/v2/marketplace/sell/prepare', {
          body: { ...input, bidOrderId: bidId, walletAddress },
          builderAuth: ctx.builderAuth,
          signal: request.signal,
        }),
        TE.mapLeft(normalizeApiFailure),
        TE.chainW(validateWith(PrepareAcceptBidResponseSchema)),
      ),
    );
    if (isFailed(prepared)) return prepared;
    const p = getValue(prepared);
    const total = BigInt(expectedTotalPriceInUsdt);
    const net = (total * 10000n) / (10000n + BigInt(ctx.config.platformFeeBps));
    const deadlineError = requestedExpiryError(
      p.payload.askData.deadline,
      parsed.data,
      preparedAt,
    );
    if (deadlineError) return invalid(deadlineError);
    if (
      BigInt(p.quote.totalPriceInUsdt) !== total ||
      BigInt(p.quote.amountInUsdt) !== total ||
      BigInt(p.quote.sellerReceivesInUsdt) !== net ||
      BigInt(p.quote.platformFeeInUsdt) !== total - net ||
      p.tokenId !== input.tokenId ||
      p.sellerWalletAddress.toLowerCase() !== walletAddress ||
      p.payload.askData.owner.toLowerCase() !== walletAddress ||
      p.payload.askData.tokenId !== input.tokenId ||
      p.payload.bidOrderId !== bidId ||
      p.quote.bidId !== bidId ||
      p.payload.askData.usdcAmount !== p.quote.totalPriceInUsdt ||
      p.typedData.primaryType !== 'Ask' ||
      !matchesMessage(p.typedData.message, p.payload.askData)
    )
      return invalid('Prepared sale does not match the request');
    const signature = await sign(ctx, walletAddress, p.typedData);
    if (isFailed(signature)) return signature;
    const result = await run(
      pipe(
        ctx.service.post('/v2/marketplace/sell', {
          body: { ...p.payload, askSignature: getValue(signature) },
          builderAuth: ctx.builderAuth,
          signal: request.signal,
        }),
        TE.mapLeft(normalizeApiFailure),
        TE.chainW(validateWith(MarketplaceOrderResultSchema)),
      ),
    );
    return isFailed(result)
      ? result
      : Success({ ...getValue(result), quote: p.quote });
  };
}
export type EoaCancelOrderRequest = { orderId: string; signal?: AbortSignal };
/** Sign removal of one exact order from the off-chain book. Does not revoke its on-chain permit. Returns WRONG_REQUEST_PARAMS, INVALID_SCHEMA, MARKETPLACE_V2_REQUEST_FAILED, MARKETPLACE_SIGNING_FAILED or UNKNOWN_ERROR as values. */
export function cancelOrderV2(
  ctx: MarketplaceV2Context,
  request: EoaCancelOrderRequest,
): Action<MarketplaceCancellationV2> {
  return async () => {
    const parsed = z.string().uuid().safeParse(request.orderId);
    if (!parsed.success) return invalid('Invalid order ID');
    const who = await signerAddress(ctx);
    if (isFailed(who)) return who;
    const walletAddress = getValue(who);
    const prepared = await run(
      pipe(
        ctx.service.post('/v2/marketplace/orders/cancel/prepare', {
          body: { orderId: parsed.data, walletAddress },
          builderAuth: ctx.builderAuth,
          signal: request.signal,
        }),
        TE.mapLeft(normalizeApiFailure),
        TE.chainW(validateWith(PreparedMarketplaceCancellationSchema)),
      ),
    );
    if (isFailed(prepared)) return prepared;
    const p = getValue(prepared);
    if (BigInt(p.payload.deadline) <= BigInt(Math.floor(Date.now() / 1000)))
      return invalid(
        'The signing window expired. Your device clock may be ahead; sync its date and time, then prepare the cancellation again.',
      );
    if (
      p.payload.orderId !== parsed.data ||
      p.payload.walletAddress.toLowerCase() !== walletAddress ||
      p.typedData.primaryType !== 'CancelMarketplaceOrder' ||
      !matchesMessage(p.typedData.message, {
        orderId: parsed.data,
        owner: walletAddress,
        deadline: p.payload.deadline,
      })
    )
      return invalid('Prepared cancellation does not match the request');
    const signature = await sign(ctx, walletAddress, p.typedData);
    if (isFailed(signature)) return signature;
    return run(
      pipe(
        ctx.service.post('/v2/marketplace/orders/cancel', {
          body: { ...p.payload, signature: getValue(signature) },
          builderAuth: ctx.builderAuth,
          signal: request.signal,
        }),
        TE.mapLeft(normalizeApiFailure),
        TE.chainW(validateWith(MarketplaceCancellationV2Schema)),
      ),
    );
  };
}
