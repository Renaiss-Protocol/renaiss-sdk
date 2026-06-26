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
  action,
  Failed,
  StatusCodes,
  Success,
} from '@renaiss-protocol/fp';

/** Query parameters for a request. `undefined` and `null` values are omitted. */
export type RequestParams = Record<
  string,
  string | number | boolean | null | undefined
>;

export type ServiceClientOptions = {
  baseUrl: string;
  /** Optional user API key sent as `x-api-key` on authenticated requests. */
  apiKey?: string;
};

type GetOptions<Path extends ApiPath> = {
  headers?: HeadersInit;
  params?: ApiQueryParams<Path, 'get'>;
  path?: ApiPathParams<Path, 'get'>;
  query?: ApiQueryParams<Path, 'get'>;
  signal?: AbortSignal;
};

type PostOptions<Path extends ApiPath> = {
  body?: ApiJsonRequestBody<Path, 'post'>;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

type SsePostOptions<Path extends ApiPath> = {
  body: ApiJsonRequestBody<Path, 'post'>;
  headers?: HeadersInit;
  onEvent?: (event: unknown) => Promise<void> | void;
  signal?: AbortSignal;
};

type JsonResponseWithHeaders<Body = unknown> = {
  body: Body;
  headers: Headers;
  status: number;
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

/**
 * Thin transport over `fetch` for the Renaiss API. Every request returns an
 * {@link Action} that resolves to a `Result` — it never throws. Keep this the
 * only place that touches `fetch`; expose Renaiss abstractions elsewhere.
 */
export class ServiceClient {
  readonly #apiKey: string | undefined;
  readonly #baseUrl: string;

  constructor(options: ServiceClientOptions) {
    this.#apiKey = options.apiKey;
    this.#baseUrl = options.baseUrl.replace(/\/+$/, '');
  }

  get baseUrl(): string {
    return this.#baseUrl;
  }

  get<Path extends ApiPath>(
    path: Path,
    options: GetOptions<Path> = {},
  ): Action<ApiJsonResponse<Path, 'get'>> {
    const url = this.#buildUrl(path, {
      path: options.path as RequestParams,
      query: (options.query ?? options.params) as RequestParams,
    });
    const headers = this.#buildHeaders(options.headers);

    return action(
      async () => {
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
    return async () => {
      const result = await this.postJsonWithResponse(path, options)();

      if ('left' in result) {
        return result;
      }

      return Success(result.right.body);
    };
  }

  postJsonWithResponse<Path extends ApiPath>(
    path: Path,
    options: PostOptions<Path> = {},
  ): Action<JsonResponseWithHeaders<ApiJsonResponse<Path, 'post'>>> {
    const url = this.#buildUrl(path);
    const headers = this.#buildHeaders(options.headers);

    if (options.body !== undefined) {
      headers.set('content-type', 'application/json');
    }

    return action(
      async () => {
        let response: Response;

        try {
          response = await fetch(url, {
            body:
              options.body === undefined
                ? undefined
                : JSON.stringify(options.body),
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

        return Success({
          body,
          headers: response.headers,
          status: response.status,
        });
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

  postSse<Path extends ApiPath>(
    path: Path,
    options: SsePostOptions<Path>,
  ): Action<unknown[]> {
    const url = this.#buildUrl(path);
    const headers = this.#buildHeaders(options.headers);
    headers.set('content-type', 'application/json');

    return action(
      async () => {
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

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const event = this.#parseSsePart(part);
            if (event === undefined) continue;

            events.push(event);
            await options.onEvent?.(event);
          }
        }

        const tail = this.#parseSsePart(buffer);
        if (tail !== undefined) {
          events.push(tail);
          await options.onEvent?.(tail);
        }

        return Success(events);
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

  #applyPathParams(path: string, params?: RequestParams): string {
    if (params === undefined) return path;

    return path.replace(/\{([^}]+)\}/g, (match, key: string) => {
      const value = params[key];
      return value === undefined || value === null
        ? match
        : encodeURIComponent(String(value));
    });
  }

  #buildHeaders(headers?: HeadersInit): Headers {
    const nextHeaders = new Headers(headers);
    if (!nextHeaders.has('accept')) {
      nextHeaders.set('accept', 'application/json');
    }

    if (this.#apiKey !== undefined) {
      nextHeaders.set('x-api-key', this.#apiKey);
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

    return JSON.parse(data) as unknown;
  }
}
