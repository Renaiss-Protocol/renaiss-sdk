import type { ApiJsonResponse } from '@renaiss-protocol/bindings/api';
import * as api from '@renaiss-protocol/bindings/api';
import { type ErrorCode, errMsg } from '@renaiss-protocol/error-codes';
import type { ApiError } from '@renaiss-protocol/fp';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { isCreateAskError, isListGachaMachineContentsError } from './v2-errors';

type RouteCodeListName = Extract<keyof typeof api, `V2_${string}_CODES`>;
type EveryRouteCode = (typeof api)[RouteCodeListName][number];

function failure(code: string): ApiError {
  return { code: code as ErrorCode, status: 400, detail: code };
}

const routeCodeLists: [string, readonly string[]][] = Object.entries(
  api as Record<string, unknown>,
).flatMap(([name, value]) =>
  /^V2_.*_CODES$/.test(name) && Array.isArray(value)
    ? [[name, value as readonly string[]] as [string, readonly string[]]]
    : [],
);

describe('v2 error codes', () => {
  it('keeps every generated route code inside ErrorCode', () => {
    // Fails to compile when a code a v2 route can return is missing from the
    // public ErrorCode union.
    expectTypeOf<EveryRouteCode>().toExtend<ErrorCode>();

    const known = new Set<string>(api.GENERATED_ERROR_CODES);
    expect(routeCodeLists.length).toBeGreaterThan(0);
    for (const [name, codes] of routeCodeLists) {
      for (const code of codes) {
        expect(known.has(code), `${name}: ${code}`).toBe(true);
        expect(errMsg(code as ErrorCode)).not.toBe('');
      }
    }
  });

  it('carries the create-ask codes the API documents', () => {
    expect(api.V2_MARKETPLACE_ASKS_POST_CODES).toContain(
      'ASK_AMOUNT_NOT_POSITIVE',
    );
    expect(api.V2_MARKETPLACE_ASKS_POST_CODES).toContain(
      'OFFER_EXPIRY_TOO_LONG',
    );
    expectTypeOf<'ASK_AMOUNT_NOT_POSITIVE'>().toExtend<ErrorCode>();
    expectTypeOf<'OFFER_EXPIRY_TOO_LONG'>().toExtend<ErrorCode>();
  });

  it('keeps the content route codes in sync with its documented 4xx responses', () => {
    // The 500 and 502 responses of this route type `code` as a plain string, so
    // only the documented 4xx responses carry literal codes to compare. 401
    // and 403 answer an optional builder key that the API does not accept.
    type Documented =
      ApiJsonResponse<
        '/v2/gacha/packs/{slug}/content',
        'get',
        400 | 401 | 403 | 404 | 429
      > extends { code: infer Code }
        ? Code
        : never;
    expectTypeOf<
      (typeof api.V2_GACHA_PACKS_BY_SLUG_CONTENT_GET_CODES)[number]
    >().toEqualTypeOf<Documented>();

    const codes: readonly string[] =
      api.V2_GACHA_PACKS_BY_SLUG_CONTENT_GET_CODES;
    expect(codes).toContain('CARD_PACK_NOT_FOUND');
    expect(codes).not.toContain('SUBGRAPH_NETWORK_ERROR');
  });

  it('narrows v2 action errors by their SDK-visible codes', () => {
    expect(isCreateAskError(failure('MARKETPLACE_SIGNING_FAILED'))).toBe(true);
    expect(isCreateAskError(failure('GACHA_STREAM_FAILED'))).toBe(false);
    expect(
      isListGachaMachineContentsError(failure('GACHA_V2_REQUEST_FAILED')),
    ).toBe(true);
    // Retired v1 codes and open 5xx strings are not part of the content guard.
    expect(
      isListGachaMachineContentsError(failure('SUBGRAPH_NETWORK_ERROR')),
    ).toBe(false);
    expect(isListGachaMachineContentsError(failure('SOME_NEW_5XX_CODE'))).toBe(
      false,
    );
  });
});
