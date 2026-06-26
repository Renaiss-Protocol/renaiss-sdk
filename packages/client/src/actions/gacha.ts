import {
  type Action,
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
  type GachaBuybackAuthorization,
  type GachaBuybackOffer,
  GachaBuybackOfferSchema,
  GachaBuybackOffersResponseSchema,
  type GachaDrawResolved,
  type GachaMachine,
  type GachaMachineContent,
  GachaMachineContentsResponseSchema,
  type GachaMachineDetail,
  GachaMachineResponseSchema,
  GachaMachineStage,
  GachaMachinesResponseSchema,
  type GachaPullResult,
  GachaPullResultSchema,
  GachaQuantity,
  GachaQuantitySchema,
  GachaStreamAction,
  type GachaStreamEvent,
  GachaStreamEventSchema,
  GachaStreamEventStatus,
  type GachaTokenReleased,
  PrepareGachaPullResponseSchema,
  type SubmitGachaBuybackResponse,
  SubmitGachaBuybackResponseSchema,
} from '@renaiss-protocol/schema-validation';
import { z } from 'zod';
import { isPullGachaError } from '../errors';
import {
  decodeOffsetCursor,
  encodeOffsetCursor,
  type Page,
  PageSizeSchema,
  type Paginated,
  type PaginationCursor,
  paginate,
} from '../pagination';
import { validateWith } from '../response';
import type { ServiceClient } from '../service-client';
import type {
  RenaissSigner,
  SafeTypedDataRequest,
  TypedDataPayload,
} from '../signers';
import { fetchAuthenticatedUser } from './auth';

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PULL_QUANTITY = GachaQuantity.Single;
const DEFAULT_PERMIT_DEADLINE_SECONDS = 300;

const ListGachaMachinesRequestSchema = z.object({
  pageSize: PageSizeSchema.max(100).optional(),
  stage: z.enum(GachaMachineStage).optional(),
});

export type ListGachaMachinesRequest = z.input<
  typeof ListGachaMachinesRequestSchema
>;

const FetchGachaMachineRequestSchema = z.object({
  slug: z.string().min(1),
});

export type FetchGachaMachineRequest = z.input<
  typeof FetchGachaMachineRequestSchema
>;

const ListGachaMachineContentsRequestSchema = z.object({
  pageSize: PageSizeSchema.max(100).optional(),
  slug: z.string().min(1),
});

export type ListGachaMachineContentsRequest = z.input<
  typeof ListGachaMachineContentsRequestSchema
>;

const PullGachaRequestFieldsSchema = z.object({
  machineSlug: z.string().min(1),
  permitDeadlineSeconds: z
    .number()
    .int()
    .positive()
    .default(DEFAULT_PERMIT_DEADLINE_SECONDS),
  quantity: GachaQuantitySchema.default(DEFAULT_PULL_QUANTITY),
});

export type PullGachaRequest = z.input<typeof PullGachaRequestFieldsSchema> & {
  onEvent?: (event: GachaStreamEvent) => Promise<void> | void;
  signal?: AbortSignal;
};

const ListGachaBuybackOffersRequestSchema = z.object({
  pageSize: PageSizeSchema.max(100).optional(),
  search: z.string().trim().max(150).optional(),
});

export type ListGachaBuybackOffersRequest = z.input<
  typeof ListGachaBuybackOffersRequestSchema
>;

const BuybackGachaRequestSchema = z.object({
  offers: z.array(GachaBuybackOfferSchema).min(1),
});

export type BuybackGachaRequest = z.input<typeof BuybackGachaRequestSchema> & {
  signal?: AbortSignal;
};

type GachaStreamErrorEvent = Extract<
  GachaStreamEvent,
  { status: GachaStreamEventStatus.Error }
>;

type SafeTypedDataSigner = RenaissSigner & {
  signSafeTypedData(request: SafeTypedDataRequest): Promise<string> | string;
};

const ContractAddressesResponseSchema = z.object({
  chainId: z.number().int().positive(),
});

function isSigner(value: unknown): value is RenaissSigner {
  return (
    value !== null &&
    typeof value === 'object' &&
    'getAddress' in value &&
    'signMessage' in value &&
    'signTypedData' in value
  );
}

function supportsSafeTypedData(
  signer: RenaissSigner,
): signer is SafeTypedDataSigner {
  return signer.signSafeTypedData !== undefined;
}

function requireSafeSigner(
  signer: RenaissSigner | undefined,
  actionName: string,
): Result<SafeTypedDataSigner> {
  if (signer === undefined) {
    return Failed(
      'WRONG_REQUEST_PARAMS',
      StatusCodes.BAD_REQUEST,
      `${actionName} requires a signer configured on the secure client`,
      { signerConfigured: false },
    );
  }

  if (!isSigner(signer)) {
    return Failed(
      'WRONG_REQUEST_PARAMS',
      StatusCodes.BAD_REQUEST,
      `${actionName} requires a valid signer configured on the secure client`,
      signer,
    );
  }

  if (!supportsSafeTypedData(signer)) {
    return Failed(
      'WRONG_REQUEST_PARAMS',
      StatusCodes.BAD_REQUEST,
      `${actionName} requires a Safe-aware signer configured on the secure client`,
      { signerSupportsSafeTypedData: false },
    );
  }

  return Success(signer);
}

function toTypedDataPayload(value: unknown): TypedDataPayload {
  return value as TypedDataPayload;
}

function invalidRequest(detail: string, error: unknown) {
  return Failed('WRONG_REQUEST_PARAMS', StatusCodes.BAD_REQUEST, detail, error);
}

async function resolveChainId(client: ServiceClient): Promise<Result<number>> {
  const response = await run(client.get('/v0/config/contract-addresses'));
  if (isFailed(response)) return response;

  const parsed = await run(
    validateWith(ContractAddressesResponseSchema)(getValue(response)),
  );
  if (isFailed(parsed)) return parsed;

  return Success(getValue(parsed).chainId);
}

function toGachaPullResult(events: GachaStreamEvent[]): GachaPullResult {
  const draws: GachaDrawResolved[] = [];
  const released: GachaTokenReleased[] = [];
  const txHashes: string[] = [];

  for (const event of events) {
    if (event.status !== GachaStreamEventStatus.Complete) continue;

    txHashes.push(...event.data.txHashes);

    if (event.data.action === GachaStreamAction.DrawResolved) {
      draws.push(...(event.data.draws ?? []));
    }

    if (event.data.action === GachaStreamAction.TokenReleased) {
      released.push(...(event.data.released ?? []));
    }
  }

  return GachaPullResultSchema.parse({
    draws,
    events,
    released,
    txHashes: [...new Set(txHashes)],
  });
}

function firstStreamError(
  events: GachaStreamEvent[],
): GachaStreamErrorEvent | null {
  return (
    events.find(
      (event): event is GachaStreamErrorEvent =>
        event.status === GachaStreamEventStatus.Error,
    ) ?? null
  );
}

function requireTerminalRelease(events: GachaStreamEvent[]) {
  return events.some(
    (event) =>
      event.status === GachaStreamEventStatus.Complete &&
      event.data.action === GachaStreamAction.TokenReleased,
  );
}

function buildBuybackTypedData(input: {
  auth: GachaBuybackAuthorization;
  chainId: number;
  verifyingContract: string;
}): TypedDataPayload {
  return {
    domain: {
      chainId: input.chainId,
      name: 'TokenVendingMachineV3',
      verifyingContract: input.verifyingContract,
      version: '1',
    },
    message: input.auth,
    primaryType: 'BuybackUserAuthorization',
    types: {
      BuybackUserAuthorization: [
        { name: 'checkoutIds', type: 'uint256[]' },
        { name: 'token', type: 'address' },
        { name: 'amounts', type: 'uint256[]' },
        { name: 'tokenIds', type: 'uint256[]' },
      ],
    },
  };
}

function mergeBuybackOffers(offers: GachaBuybackOffer[]) {
  const [first] = offers;
  if (first === undefined) {
    return invalidRequest('At least one buyback offer is required', offers);
  }

  const incompatible = offers.find(
    (offer) =>
      offer.packId !== first.packId ||
      offer.vendingMachineAddress.toLowerCase() !==
        first.vendingMachineAddress.toLowerCase() ||
      offer.buybackAuthorization.token.toLowerCase() !==
        first.buybackAuthorization.token.toLowerCase(),
  );

  if (incompatible !== undefined) {
    return invalidRequest(
      'Buyback offers must share a vending machine and token',
      offers,
    );
  }

  return Success({
    cardPackId: first.packId,
    vendingMachineAddress: first.vendingMachineAddress,
    buybackAuth: {
      amounts: offers.flatMap((offer) => offer.buybackAuthorization.amounts),
      checkoutIds: offers.flatMap(
        (offer) => offer.buybackAuthorization.checkoutIds,
      ),
      token: first.buybackAuthorization.token,
      tokenIds: offers.flatMap((offer) => offer.buybackAuthorization.tokenIds),
    },
  });
}

/**
 * Lists currently supported gacha machines.
 */
export function listGachaMachines(
  client: ServiceClient,
  request: ListGachaMachinesRequest = {},
): Paginated<GachaMachine[]> {
  const parsed = ListGachaMachinesRequestSchema.safeParse(request);
  if (!parsed.success) {
    return paginate(
      () => async () =>
        invalidRequest('Invalid listGachaMachines request', parsed.error),
    );
  }

  const pageSize = parsed.data.pageSize ?? 20;
  const fetchPage = (
    cursor?: PaginationCursor,
  ): Action<Page<GachaMachine[]>> => {
    const cursorResult = decodeOffsetCursor(cursor, pageSize);
    if (isFailed(cursorResult)) return async () => cursorResult;

    const { offset } = getValue(cursorResult);

    return pipe(
      client.get('/v0/gacha/vrf/packs', {
        query: {
          limit: pageSize,
          offset,
          stage: parsed.data.stage,
        },
      }),
      TE.chainW(validateWith(GachaMachinesResponseSchema)),
      TE.map((response) => ({
        hasMore: response.pagination.hasMore,
        items: response.cardPacks,
        nextCursor: response.pagination.hasMore
          ? encodeOffsetCursor({ offset: offset + pageSize, pageSize })
          : undefined,
        totalCount: response.pagination.total,
      })),
    );
  };

  return paginate(fetchPage);
}

/** Fetches one gacha machine by slug. */
export function fetchGachaMachine(
  client: ServiceClient,
  request: FetchGachaMachineRequest,
): Action<GachaMachineDetail> {
  const parsed = FetchGachaMachineRequestSchema.safeParse(request);
  if (!parsed.success) {
    return async () =>
      invalidRequest('Invalid fetchGachaMachine request', parsed.error);
  }

  return pipe(
    client.get('/v0/gacha/vrf/packs/{slug}', {
      path: { slug: parsed.data.slug },
    }),
    TE.chainW(validateWith(GachaMachineResponseSchema)),
    TE.map((response) => response.cardPack),
  );
}

/** Lists display-safe card contents for a gacha machine. */
export function listGachaMachineContents(
  client: ServiceClient,
  request: ListGachaMachineContentsRequest,
): Paginated<GachaMachineContent[]> {
  const parsed = ListGachaMachineContentsRequestSchema.safeParse(request);

  if (!parsed.success) {
    return paginate(
      () => async () =>
        invalidRequest(
          'Invalid listGachaMachineContents request',
          parsed.error,
        ),
    );
  }

  const pageSize = parsed.data.pageSize ?? 50;
  const fetchPage = (
    cursor?: PaginationCursor,
  ): Action<Page<GachaMachineContent[]>> => {
    const cursorResult = decodeOffsetCursor(cursor, pageSize);
    if (isFailed(cursorResult)) return async () => cursorResult;

    const { offset } = getValue(cursorResult);

    return pipe(
      client.get('/v0/gacha/vrf/packs/{slug}/contents', {
        path: { slug: parsed.data.slug },
        query: {
          limit: pageSize,
          offset,
        },
      }),
      TE.chainW(validateWith(GachaMachineContentsResponseSchema)),
      TE.map((response) => ({
        hasMore: response.pagination.hasMore,
        items: response.cards,
        nextCursor: response.pagination.hasMore
          ? encodeOffsetCursor({ offset: offset + pageSize, pageSize })
          : undefined,
        totalCount: response.pagination.total,
      })),
    );
  };

  return paginate(fetchPage);
}

/** Prepares, signs, submits, and streams a gacha pull. */
export function pullGacha(
  client: ServiceClient,
  signer: RenaissSigner | undefined,
  request: PullGachaRequest,
): Action<GachaPullResult> {
  const parsed = PullGachaRequestFieldsSchema.safeParse(request);
  if (!parsed.success) {
    return async () =>
      invalidRequest('Invalid pullGacha request', parsed.error);
  }

  const signerResult = requireSafeSigner(signer, 'pullGacha');
  if (isFailed(signerResult)) return async () => signerResult;

  const safeSigner = getValue(signerResult);

  return async () => {
    const preparedResult = await run(
      pipe(
        client.post('/v0/gacha/vrf/pull/prepare', {
          body: {
            packSlug: parsed.data.machineSlug,
            permitDeadlineSeconds: parsed.data.permitDeadlineSeconds,
            quantity: parsed.data.quantity,
          },
          signal: request.signal,
        }),
        TE.chainW(validateWith(PrepareGachaPullResponseSchema)),
      ),
    );
    if (isFailed(preparedResult)) return preparedResult;

    const prepared = getValue(preparedResult);
    let permitSignature: string;
    try {
      permitSignature = await safeSigner.signSafeTypedData({
        chainId: prepared.chainId,
        safeAddress: prepared.buyerWalletAddress,
        typedData: toTypedDataPayload(prepared.permit2TypedData),
      });
    } catch (error) {
      return Failed(
        'GACHA_SIGNING_FAILED',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to sign gacha pull',
        error,
      );
    }

    const streamResult = await run(
      client.postSse(prepared.pullStreamPath, {
        body: {
          ...prepared.unsignedPullPayload,
          permitSignature,
        },
        onEvent: (event) => {
          const parsedEvent = GachaStreamEventSchema.safeParse(event);
          if (!parsedEvent.success) return;

          return request.onEvent?.(parsedEvent.data);
        },
        signal: request.signal,
      }),
    );
    if (isFailed(streamResult)) return streamResult;

    const eventsResult = await run(
      validateWith(z.array(GachaStreamEventSchema))(getValue(streamResult)),
    );
    if (isFailed(eventsResult)) return eventsResult;

    const events = getValue(eventsResult);
    const errorEvent = firstStreamError(events);
    if (errorEvent !== null) {
      const error = {
        code: errorEvent.data.code,
        detail: errorEvent.data.details ?? 'Gacha stream failed',
        status: StatusCodes.INTERNAL_SERVER_ERROR,
      };

      return Failed(
        isPullGachaError(error) ? error.code : 'GACHA_STREAM_FAILED',
        error.status,
        error.detail,
        errorEvent,
      );
    }

    if (!requireTerminalRelease(events)) {
      return Failed(
        'GACHA_STREAM_FAILED',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Gacha stream closed before token release',
        events,
      );
    }

    return Success(toGachaPullResult(events));
  };
}

/** Lists buyback offers for the authenticated user. */
export function listGachaBuybackOffers(
  client: ServiceClient,
  request: ListGachaBuybackOffersRequest = {},
): Paginated<GachaBuybackOffer[]> {
  const parsed = ListGachaBuybackOffersRequestSchema.safeParse(request);

  if (!parsed.success) {
    return paginate(
      () => async () =>
        invalidRequest('Invalid listGachaBuybackOffers request', parsed.error),
    );
  }

  const pageSize = parsed.data.pageSize ?? DEFAULT_PAGE_SIZE;
  const fetchPage = (
    cursor?: PaginationCursor,
  ): Action<Page<GachaBuybackOffer[]>> => {
    const cursorResult = decodeOffsetCursor(cursor, pageSize);
    if (isFailed(cursorResult)) return async () => cursorResult;

    const { offset } = getValue(cursorResult);

    return pipe(
      client.get('/v0/gacha/vrf/buyback/offers', {
        query: {
          limit: pageSize,
          offset,
          search: parsed.data.search,
        },
      }),
      TE.chainW(validateWith(GachaBuybackOffersResponseSchema)),
      TE.map((response) => ({
        hasMore: response.pagination.hasMore,
        items: response.offers,
        nextCursor: response.pagination.hasMore
          ? encodeOffsetCursor({ offset: offset + pageSize, pageSize })
          : undefined,
        totalCount: response.pagination.total,
      })),
    );
  };

  return paginate(fetchPage);
}

/** Signs and submits a buyback for compatible gacha offers. */
export function buybackGacha(
  client: ServiceClient,
  signer: RenaissSigner | undefined,
  request: BuybackGachaRequest,
): Action<SubmitGachaBuybackResponse> {
  const parsed = BuybackGachaRequestSchema.safeParse(request);
  if (!parsed.success) {
    return async () =>
      invalidRequest('Invalid buybackGacha request', parsed.error);
  }

  return async () => {
    const mergedResult = mergeBuybackOffers(parsed.data.offers);
    if (isFailed(mergedResult)) {
      return Failed(
        'GACHA_BUYBACK_OFFERS_INVALID',
        StatusCodes.BAD_REQUEST,
        getError(mergedResult).detail,
        getError(mergedResult).error,
      );
    }

    const signerResult = requireSafeSigner(signer, 'buybackGacha');
    if (isFailed(signerResult)) return signerResult;

    const chainIdResult = await resolveChainId(client);
    if (isFailed(chainIdResult)) return chainIdResult;

    const authenticatedUserResult = await run(fetchAuthenticatedUser(client));
    if (isFailed(authenticatedUserResult)) return authenticatedUserResult;

    const safeAddress = getValue(authenticatedUserResult).wallets
      .safeWalletAddress;
    if (safeAddress === null) {
      return Failed(
        'WRONG_REQUEST_PARAMS',
        StatusCodes.BAD_REQUEST,
        'buybackGacha requires a Safe wallet for the authenticated user',
        { safeWalletAddress: null },
      );
    }

    const merged = getValue(mergedResult);
    const chainId = getValue(chainIdResult);
    const safeSigner = getValue(signerResult);
    let userSignature: string;
    try {
      userSignature = await safeSigner.signSafeTypedData({
        chainId,
        safeAddress,
        typedData: buildBuybackTypedData({
          auth: merged.buybackAuth,
          chainId,
          verifyingContract: merged.vendingMachineAddress,
        }),
      });
    } catch (error) {
      return Failed(
        'GACHA_SIGNING_FAILED',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to sign gacha buyback',
        error,
      );
    }

    return run(
      pipe(
        client.post('/v0/gacha/vrf/buyback', {
          body: {
            buybackAuth: merged.buybackAuth,
            cardPackId: merged.cardPackId,
            userSignature,
          },
          signal: request.signal,
        }),
        TE.chainW(validateWith(SubmitGachaBuybackResponseSchema)),
      ),
    );
  };
}
