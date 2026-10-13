import type { paths } from './v2.generated';

export * from './error-codes.generated';
export type { components, operations, paths, webhooks } from './v2.generated';

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
