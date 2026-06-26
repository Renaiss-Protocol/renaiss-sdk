import type {
  ApiErrorCodes,
  GACHA_VRF_PACKS_BY_SLUG_CONTENTS_GET_CODES,
  GACHA_VRF_PACKS_BY_SLUG_GET_CODES,
  GACHA_VRF_PACKS_GET_CODES,
} from '@renaiss-protocol/bindings/api';
import type { ApiError } from '@renaiss-protocol/fp';
import { StatusCodes } from '@renaiss-protocol/fp';
import { describe, expect, it } from 'vitest';
import {
  exhaustive,
  isFetchGachaMachineError,
  isListGachaMachineContentsError,
  isListGachaMachinesError,
  isListUserActivitiesError,
  isPullGachaError,
  isRenaissError,
  type PullGachaErrorCode,
} from './errors';

// True iff X and Y are the exact same type. Used to assert the generated
// contents-code array matches the union openapi-typescript derives for the
// same route — a mismatch means the two regeneration paths disagree.
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

function apiError(code: ApiError['code']): ApiError {
  return {
    code,
    detail: 'test error',
    status: StatusCodes.INTERNAL_SERVER_ERROR,
  };
}

function assertCompletePullGachaSwitch(code: PullGachaErrorCode) {
  switch (code) {
    case 'WRONG_REQUEST_PARAMS':
    case 'INVALID_SCHEMA':
    case 'UNAUTHORIZED':
    case 'CARD_PACK_NOT_FOUND':
    case 'CARD_PACK_NOT_ACTIVE':
    case 'SAFE_ACCOUNT_NOT_FOUND':
    case 'INSUFFICIENT_ALLOWANCE':
    case 'CARD_PACKS_QUERY_FAILED':
    case 'GACHA_V3_VENDING_MACHINE_ADDRESS_NOT_FOUND':
    case 'FUNCTION_ERROR':
    case 'GACHA_SIGNING_FAILED':
    case 'GACHA_STREAM_FAILED':
    case 'INSUFFICIENT_FUNDS':
    case 'UNKNOWN_ERROR':
      return code;
    default:
      return exhaustive(code);
  }
}

function assertIncompletePullGachaSwitch(code: PullGachaErrorCode) {
  switch (code) {
    case 'UNKNOWN_ERROR':
      return code;
    default:
      // @ts-expect-error This intentionally proves omitted cases are not never.
      return exhaustive(code);
  }
}

describe('error guards', () => {
  it('narrows action errors by documented action codes', () => {
    const error = apiError('GACHA_STREAM_FAILED');

    expect(isPullGachaError(error)).toBe(true);

    if (isPullGachaError(error)) {
      expect(assertCompletePullGachaSwitch(error.code)).toBe(
        'GACHA_STREAM_FAILED',
      );
      expect(assertIncompletePullGachaSwitch('UNKNOWN_ERROR')).toBe(
        'UNKNOWN_ERROR',
      );
    }

    expect(isPullGachaError(apiError('OFFER_QUERY_FAILED'))).toBe(false);
  });

  it('rejects unrelated codes for an action guard', () => {
    expect(isPullGachaError(apiError('ACTIVITY_QUERY_FAILED'))).toBe(false);
    expect(isListUserActivitiesError(apiError('ACTIVITY_QUERY_FAILED'))).toBe(
      true,
    );
  });

  it('narrows the contents action by its generated route codes', () => {
    // CARD_PACK_NOT_FOUND comes straight from the OpenAPI contract for the route.
    expect(
      isListGachaMachineContentsError(apiError('CARD_PACK_NOT_FOUND')),
    ).toBe(true);
    // A code not on the route (nor the SDK fallback) is rejected.
    expect(
      isListGachaMachineContentsError(apiError('ACTIVITY_QUERY_FAILED')),
    ).toBe(false);
  });

  it('narrows list and fetch actions by their generated route codes', () => {
    expect(isListGachaMachinesError(apiError('CARD_PACKS_QUERY_FAILED'))).toBe(
      true,
    );
    expect(isListGachaMachinesError(apiError('CARD_PACK_NOT_FOUND'))).toBe(
      false,
    );
    expect(isFetchGachaMachineError(apiError('CARD_PACK_NOT_FOUND'))).toBe(
      true,
    );
    expect(isFetchGachaMachineError(apiError('FUNCTION_ERROR'))).toBe(true);
  });

  it('keeps generated gacha route codes in sync with the OpenAPI types', () => {
    // Fails to compile if the generator's runtime array and openapi-typescript's
    // derived unions disagree about these route error contracts.
    const listInSync: Equal<
      (typeof GACHA_VRF_PACKS_GET_CODES)[number],
      ApiErrorCodes<'/v0/gacha/vrf/packs', 'get'>
    > = true;
    const fetchInSync: Equal<
      (typeof GACHA_VRF_PACKS_BY_SLUG_GET_CODES)[number],
      ApiErrorCodes<'/v0/gacha/vrf/packs/{slug}', 'get'>
    > = true;
    const contentsInSync: Equal<
      (typeof GACHA_VRF_PACKS_BY_SLUG_CONTENTS_GET_CODES)[number],
      ApiErrorCodes<'/v0/gacha/vrf/packs/{slug}/contents', 'get'>
    > = true;
    expect(listInSync).toBe(true);
    expect(fetchInSync).toBe(true);
    expect(contentsInSync).toBe(true);
  });

  it('rejects malformed errors', () => {
    expect(isRenaissError(null)).toBe(false);
    expect(isRenaissError({ code: 'UNKNOWN_ERROR' })).toBe(false);
    expect(
      isRenaissError({
        code: 'UNKNOWN_ERROR',
        detail: 'missing status',
      }),
    ).toBe(false);
  });
});
