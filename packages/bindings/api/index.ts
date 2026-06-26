import type { paths } from './generated';

export * from './error-codes.generated';
export type { components, operations, paths, webhooks } from './generated';

export type ApiPath = keyof paths;
export type ApiMethod = 'delete' | 'get' | 'patch' | 'post' | 'put';

export type ApiOperation<
  Path extends ApiPath,
  Method extends ApiMethod,
> = Method extends keyof paths[Path] ? NonNullable<paths[Path][Method]> : never;

type ApiContent<
  Path extends ApiPath,
  Method extends ApiMethod,
  Status extends number,
> =
  ApiOperation<Path, Method> extends {
    responses: Record<Status, { content: infer Content }>;
  }
    ? Content
    : never;

export type ApiJsonResponse<
  Path extends ApiPath,
  Method extends ApiMethod,
  Status extends number = 200,
> =
  ApiContent<Path, Method, Status> extends {
    'application/json': infer Response;
  }
    ? Response
    : never;

export type ApiTextStreamResponse<
  Path extends ApiPath,
  Method extends ApiMethod,
  Status extends number = 200,
> =
  ApiContent<Path, Method, Status> extends {
    'text/event-stream': infer Response;
  }
    ? Response
    : never;

type ApiResponseCode<Response> = Response extends {
  content: { 'application/json': { code: infer Code } };
}
  ? Code
  : never;

/**
 * Union of the error `code` literals an operation can return, read from its
 * error responses. Distributes over every status entry; success responses have
 * no `code` field and contribute `never`.
 */
export type ApiErrorCodes<Path extends ApiPath, Method extends ApiMethod> =
  ApiOperation<Path, Method> extends { responses: infer Responses }
    ? ApiResponseCode<Responses[keyof Responses]>
    : never;

export type ApiJsonRequestBody<Path extends ApiPath, Method extends ApiMethod> =
  ApiOperation<Path, Method> extends {
    requestBody?: { content: { 'application/json': infer Body } };
  }
    ? Body
    : never;

export type ApiQueryParams<Path extends ApiPath, Method extends ApiMethod> =
  ApiOperation<Path, Method> extends {
    parameters: { query?: infer Query };
  }
    ? Query
    : never;

export type ApiPathParams<Path extends ApiPath, Method extends ApiMethod> =
  ApiOperation<Path, Method> extends {
    parameters: { path: infer Params };
  }
    ? Params
    : never;

export type ApiKeyCreateRequest = ApiJsonRequestBody<
  '/api/auth/api-key/create',
  'post'
>;
export type ApiKeyCreateResponse = ApiJsonResponse<
  '/api/auth/api-key/create',
  'post'
>;
export type SiweNonceRequest = ApiJsonRequestBody<
  '/api/auth/siwe/nonce',
  'post'
>;
export type SiweVerifyRequest = ApiJsonRequestBody<
  '/api/auth/siwe/verify',
  'post'
>;
export type PrepareGachaPullRequest = ApiJsonRequestBody<
  '/v0/gacha/vrf/pull/prepare',
  'post'
>;
export type PrepareGachaPullResponse = ApiJsonResponse<
  '/v0/gacha/vrf/pull/prepare',
  'post'
>;
export type StreamGachaPullRequest = ApiJsonRequestBody<
  '/v0/gacha/vrf/pull/stream',
  'post'
>;
export type GachaBuybackOffersResponse = ApiJsonResponse<
  '/v0/gacha/vrf/buyback/offers',
  'get'
>;
export type SubmitGachaBuybackRequest = ApiJsonRequestBody<
  '/v0/gacha/vrf/buyback',
  'post'
>;
export type SubmitGachaBuybackResponse = ApiJsonResponse<
  '/v0/gacha/vrf/buyback',
  'post'
>;
