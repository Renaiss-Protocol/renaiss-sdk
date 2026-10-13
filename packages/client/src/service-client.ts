import type {
  ApiJsonRequestBody,
  ApiJsonResponse,
  ApiPath,
  ApiPathParams,
  ApiQueryParams,
} from '@renaiss-protocol/bindings/api';
import type { ErrorCode } from '@renaiss-protocol/error-codes';
import {
  type Action,
  type ApiError,
  action,
  Failed,
  type Result,
  StatusCodes,
  Success,
} from '@renaiss-protocol/fp';

/** Query parameters for a request. `undefined` and `null` values are omitted. */
export type RequestParams = Record<
  string,
  string | number | boolean | null | undefined
>;

/**
 * Transport options. The builder API key is optional for public requests
 * and required when a request sets `builderAuth`.
 */
export type ServiceClientOptions = {
  baseUrl: string;
  /** Approved builder/app API key sent as `x-builder-api-key` on `builderAuth` requests. */
  builderApiKey?: string;
};

type GetOptions<Path extends ApiPath> = {
  /**
   * Sends the builder API key with the read, for routes that name their
   * subject explicitly.
   */
  builderAuth?: boolean;
  headers?: HeadersInit;
  path?: ApiPathParams<Path, 'get'>;
  query?: ApiQueryParams<Path, 'get'>;
  signal?: AbortSignal;
};

type PostOptions<Path extends ApiPath> = {
  path?: ApiPathParams<Path, 'post'>;
  body?: ApiJsonRequestBody<Path, 'post'>;
  headers?: HeadersInit;
  signal?: AbortSignal;
  builderAuth?: boolean;
};

type JsonRequest = {
  body?: unknown;
  headers?: HeadersInit;
  /** Route template, used to name the request in failures. */
  path: string;
  signal?: AbortSignal;
  url: string;
  builderAuth?: boolean;
};

type SsePostOptions<Path extends ApiPath> = {
  body: ApiJsonRequestBody<Path, 'post'>;
  headers?: HeadersInit;
  /** Return false to stop at a terminal event and release the response. */
  // biome-ignore lint/suspicious/noConfusingVoidType: existing callbacks return void; false is the optional stop signal.
  onEvent?: (event: unknown) => Promise<void | boolean> | void | boolean;
  signal?: AbortSignal;
  builderAuth?: boolean;
};

/** Shape of the standard Renaiss API error body: `{ error, code }`. */
function readErrorBody(body: unknown): { code: ErrorCode; detail?: string } {
  if (body !== null && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const code =
      typeof record.code === 'string' ? (record.code as ErrorCode) : undefined;
    const detail =
      typeof record.error === 'string'
        ? record.error
        : typeof record.message === 'string'
          ? record.message
          : undefined;

    if (code !== undefined) {
      return { code, detail };
    }

    if (detail !== undefined) {
      return { code: 'UNKNOWN_ERROR', detail };
    }
  }

  return { code: 'UNKNOWN_ERROR' };
}

class ServiceConfigurationError extends Error {}

/** Identifies configuration failures created locally, never upstream API errors. */
export function isServiceConfigurationError(error: ApiError): boolean {
  return error.error instanceof ServiceConfigurationError;
}

/**
 * Thin transport over `fetch` for the Renaiss API. Every request returns an
 * {@link Action} that resolves to a `Result` — it never throws. Keep this the
 * only place that touches `fetch`; expose Renaiss abstractions elsewhere.
 */
export class ServiceClient {
  readonly #baseUrl: string;
  readonly #builderApiKey: string | undefined;
  constructor(options: ServiceClientOptions) {
    this.#baseUrl = options.baseUrl?.replace(/\/+$/, '') ?? '';
    this.#builderApiKey = options.builderApiKey;
  }

  get baseUrl(): string {
    return this.#baseUrl;
  }

  validateOptions(): Result<void> {
    const detail = !this.#baseUrl.trim()
      ? 'Configure an explicit API baseUrl or backend proxy.'
      : this.#builderApiKey !== undefined && !this.#builderApiKey.trim()
        ? 'builderApiKey must be non-empty when supplied.'
        : undefined;
    return detail
      ? Failed(
          'WRONG_REQUEST_PARAMS',
          StatusCodes.BAD_REQUEST,
          detail,
          new ServiceConfigurationError(detail),
        )
      : Success(undefined);
  }

  requireBuilderApiKey(actionName: string): Result<void> {
    if (this.#builderApiKey !== undefined && this.#builderApiKey.length > 0) {
      return Success(undefined);
    }

    return Failed(
      'WRONG_REQUEST_PARAMS',
      StatusCodes.BAD_REQUEST,
      `${actionName} requires builderApiKey`,
    );
  }

  get<Path extends ApiPath>(
    path: Path,
    options: GetOptions<Path> = {},
  ): Action<ApiJsonResponse<Path, 'get'>> {
    const url = this.#buildUrl(path, {
      path: options.path as RequestParams,
      query: options.query as RequestParams,
    });
    const headers = this.#buildHeaders(options.headers, {
      builderAuth: options.builderAuth,
    });

    return action(
      async () => {
        const configuration = this.validateOptions();
        if ('left' in configuration) return configuration;
        if (options.builderAuth === true) {
          const credentialResult = this.requireBuilderApiKey(path);
          if ('left' in credentialResult) return credentialResult;
        }

        let response: Response;

        try {
          response = await fetch(url, {
            headers,
            method: 'GET',
            signal: options.signal,
          });
        } catch (error) {
          return Failed(
            'UNKNOWN_ERROR',
            StatusCodes.SERVICE_UNAVAILABLE,
            'Network request failed',
            error,
          );
        }

        const body = await response.json().catch(() => undefined);

        if (!response.ok) {
          const { code, detail } = readErrorBody(body);
          return Failed(
            code,
            response.status as StatusCodes,
            detail ?? response.statusText,
            body,
          );
        }

        return Success(body);
      },
      (error) =>
        Failed(
          'UNKNOWN_ERROR',
          StatusCodes.INTERNAL_SERVER_ERROR,
          'Unexpected request error',
          error,
        ),
    );
  }

  post<Path extends ApiPath>(
    path: Path,
    options: PostOptions<Path> = {},
  ): Action<ApiJsonResponse<Path, 'post'>> {
    return () =>
      this.#sendJson<ApiJsonResponse<Path, 'post'>>({
        body: options.body,
        builderAuth: options.builderAuth,
        headers: options.headers,
        path,
        signal: options.signal,
        url: this.#buildUrl(path, { path: options.path as RequestParams }),
      })();
  }

  postSse<Path extends ApiPath>(
    path: Path,
    options: SsePostOptions<Path>,
  ): Action<unknown[]> {
    const url = this.#buildUrl(path);
    const headers = this.#buildHeaders(options.headers, {
      builderAuth: options.builderAuth,
    });
    headers.set('content-type', 'application/json');
    headers.set('accept', 'text/event-stream');

    return action(
      async () => {
        const configuration = this.validateOptions();
        if ('left' in configuration) return configuration;
        if (options.builderAuth === true) {
          const credentialResult = this.requireBuilderApiKey(path);
          if ('left' in credentialResult) return credentialResult;
        }

        let response: Response;

        try {
          response = await fetch(url, {
            body: JSON.stringify(options.body),
            headers,
            method: 'POST',
            signal: options.signal,
          });
        } catch (error) {
          return Failed(
            'UNKNOWN_ERROR',
            StatusCodes.SERVICE_UNAVAILABLE,
            'Network request failed',
            error,
          );
        }

        if (!response.ok) {
          const body = await response.json().catch(() => undefined);
          const { code, detail } = readErrorBody(body);
          return Failed(
            code,
            response.status as StatusCodes,
            detail ?? response.statusText,
            body,
          );
        }

        const reader = response.body?.getReader();
        if (reader === undefined) {
          return Failed(
            'GACHA_STREAM_FAILED',
            StatusCodes.INTERNAL_SERVER_ERROR,
            'Response body is not readable',
          );
        }

        const decoder = new TextDecoder();
        const events: unknown[] = [];
        let buffer = '';

        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split(/\r?\n\r?\n/);
            buffer = parts.pop() ?? '';

            for (const part of parts) {
              const event = this.#parseSsePart(part);
              if (event === undefined) continue;

              events.push(event);
              if ((await options.onEvent?.(event)) === false)
                return Success(events);
            }
          }

          buffer += decoder.decode();
          const tail = this.#parseSsePart(buffer);
          if (tail !== undefined) {
            events.push(tail);
            await options.onEvent?.(tail);
          }

          return Success(events);
        } finally {
          await reader.cancel().catch(() => undefined);
          reader.releaseLock();
        }
      },
      (error) =>
        Failed(
          'GACHA_STREAM_FAILED',
          StatusCodes.INTERNAL_SERVER_ERROR,
          'Unexpected stream error',
          error,
        ),
    );
  }

  #sendJson<Body>(request: JsonRequest): Action<Body> {
    const headers = this.#buildHeaders(request.headers, {
      builderAuth: request.builderAuth,
    });

    if (request.body !== undefined) {
      headers.set('content-type', 'application/json');
    }

    return action(
      async () => {
        const configuration = this.validateOptions();
        if ('left' in configuration) return configuration;
        if (request.builderAuth === true) {
          const credentialResult = this.requireBuilderApiKey(request.path);
          if ('left' in credentialResult) return credentialResult;
        }

        let response: Response;

        try {
          response = await fetch(request.url, {
            body:
              request.body === undefined
                ? undefined
                : JSON.stringify(request.body),
            headers,
            method: 'POST',
            signal: request.signal,
          });
        } catch (error) {
          return Failed(
            'UNKNOWN_ERROR',
            StatusCodes.SERVICE_UNAVAILABLE,
            'Network request failed',
            error,
          );
        }

        const body = await response.json().catch(() => undefined);

        if (!response.ok) {
          const { code, detail } = readErrorBody(body);
          return Failed(
            code,
            response.status as StatusCodes,
            detail ?? response.statusText,
            body,
          );
        }

        return Success(body as Body);
      },
      (error) =>
        Failed(
          'UNKNOWN_ERROR',
          StatusCodes.INTERNAL_SERVER_ERROR,
          'Unexpected request error',
          error,
        ),
    );
  }

  #applyPathParams(path: string, params?: RequestParams): string {
    if (params === undefined) return path;

    return path.replace(/\{([^}]+)\}/g, (match, key: string) => {
      const value = params[key];
      return value === undefined || value === null
        ? match
        : encodeURIComponent(String(value));
    });
  }

  #buildHeaders(
    headers?: HeadersInit,
    options: { builderAuth?: boolean } = {},
  ): Headers {
    const nextHeaders = new Headers(headers);
    if (!nextHeaders.has('accept')) {
      nextHeaders.set('accept', 'application/json');
    }

    if (options.builderAuth === true && this.#builderApiKey !== undefined) {
      nextHeaders.set('x-builder-api-key', this.#builderApiKey);
    }

    return nextHeaders;
  }

  #buildUrl(
    path: string,
    options: { path?: RequestParams; query?: RequestParams } = {},
  ): string {
    const normalizedPath = this.#applyPathParams(
      path.startsWith('/') ? path : `/${path}`,
      options.path,
    );
    const query = new URLSearchParams();

    if (options.query !== undefined) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          query.set(key, String(value));
        }
      }
    }

    const queryString = query.toString();
    const suffix = queryString.length > 0 ? `?${queryString}` : '';

    return `${this.#baseUrl}${normalizedPath}${suffix}`;
  }

  #parseSsePart(part: string): unknown | undefined {
    const data = part
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trimStart())
      .join('\n');

    if (data.length === 0) {
      return undefined;
    }

    const parsed: unknown = JSON.parse(data);
    const name = part.split('\n').find((line) => line.startsWith('event:'));
    return { event: name?.slice('event:'.length).trim(), data: parsed };
  }
}
