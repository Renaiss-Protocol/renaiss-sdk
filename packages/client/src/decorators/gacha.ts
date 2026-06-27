import { type Result, run } from '@renaiss-protocol/fp';
import type {
  GachaBuybackOffer,
  GachaMachine,
  GachaMachineContent,
  GachaMachineDetail,
  GachaPullResult,
  GachaStreamEvent,
  SubmitGachaBuybackResponse,
} from '@renaiss-protocol/schema-validation';
import {
  type BuybackGachaRequest,
  buybackGacha,
  type FetchGachaMachineRequest,
  fetchGachaMachine,
  type ListGachaBuybackOffersRequest,
  type ListGachaMachineContentsRequest,
  type ListGachaMachinesRequest,
  listGachaBuybackOffers,
  listGachaMachineContents,
  listGachaMachines,
  type PullGachaRequest,
  pullGacha,
} from '../actions/gacha';
import type { Paginated } from '../pagination';
import type { ServiceClient } from '../service-client';
import type { RenaissSigner } from '../signers';

export type PublicGachaActions = {
  /**
   * Lists currently supported gacha machines.
   *
   * @remarks
   * Returns `WRONG_REQUEST_PARAMS`, `INVALID_SCHEMA`,
   * `CARD_PACKS_QUERY_FAILED`, or `UNKNOWN_ERROR` as a `Result`; expected
   * failures are not thrown.
   */
  listGachaMachines(
    request?: ListGachaMachinesRequest,
  ): Paginated<GachaMachine[]>;

  /**
   * Fetches one gacha machine by slug.
   *
   * @remarks
   * Returns `CARD_PACK_NOT_FOUND`, `CARD_PACKS_QUERY_FAILED`,
   * `FUNCTION_ERROR`, `WRONG_REQUEST_PARAMS`, `INVALID_SCHEMA`, or
   * `UNKNOWN_ERROR` as a `Result`; expected failures are not thrown.
   */
  fetchGachaMachine(
    request: FetchGachaMachineRequest,
  ): Promise<Result<GachaMachineDetail>>;

  /**
   * Lists display-safe card contents for one gacha machine.
   *
   * @remarks
   * Each page returns `WRONG_REQUEST_PARAMS`, `INVALID_SCHEMA`,
   * `CARD_PACK_NOT_FOUND`, `CARD_PACKS_QUERY_FAILED`, `FUNCTION_ERROR`, or
   * `UNKNOWN_ERROR` as a `Result`; expected failures are not thrown.
   */
  listGachaMachineContents(
    request: ListGachaMachineContentsRequest,
  ): Paginated<GachaMachineContent[]>;
};

export type SecureGachaActions = {
  /**
   * Prepares, signs, submits, and streams a gacha pull.
   *
   * @remarks
   * Returns prepare-route errors, `GACHA_SIGNING_FAILED`,
   * `GACHA_STREAM_FAILED`, or `UNKNOWN_ERROR` as a `Result`; expected failures
   * are not thrown. `onEvent` receives validated stream events in arrival
   * order.
   */
  pullGacha(
    request: PullGachaRequest & {
      onEvent?: (event: GachaStreamEvent) => Promise<void> | void;
    },
  ): Promise<Result<GachaPullResult>>;

  /**
   * Lists buyback offers for the authenticated user.
   *
   * @remarks
   * Each page returns `WRONG_REQUEST_PARAMS`, `INVALID_SCHEMA`,
   * `UNAUTHORIZED`, `OFFER_QUERY_FAILED`, or `UNKNOWN_ERROR` as a `Result`;
   * expected failures are not thrown.
   */
  listGachaBuybackOffers(
    request?: ListGachaBuybackOffersRequest,
  ): Paginated<GachaBuybackOffer[]>;

  /**
   * Signs and submits a buyback for a non-empty compatible offer set.
   *
   * @remarks
   * Returns buyback-route errors, `GACHA_BUYBACK_OFFERS_INVALID`,
   * `GACHA_SIGNING_FAILED`, or `UNKNOWN_ERROR` as a `Result`; expected
   * failures are not thrown.
   */
  buybackGacha(
    request: BuybackGachaRequest,
  ): Promise<Result<SubmitGachaBuybackResponse>>;
};

export function decoratePublicGacha(client: ServiceClient): PublicGachaActions {
  return {
    fetchGachaMachine: (request) => run(fetchGachaMachine(client, request)),
    listGachaMachineContents: (request) =>
      listGachaMachineContents(client, request),
    listGachaMachines: (request) => listGachaMachines(client, request),
  };
}

export function decorateSecureGacha(
  client: ServiceClient,
  signer: RenaissSigner | undefined,
): SecureGachaActions {
  return {
    buybackGacha: (request) => run(buybackGacha(client, signer, request)),
    listGachaBuybackOffers: (request) =>
      listGachaBuybackOffers(client, request),
    pullGacha: (request) => run(pullGacha(client, signer, request)),
  };
}
