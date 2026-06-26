import type { ErrorCode } from '@renaiss-protocol/error-codes';
import {
  type Action,
  Failed,
  getValue,
  isFailed,
  type Result,
  run,
  StatusCodes,
  Success,
} from '@renaiss-protocol/fp';
import { z } from 'zod';

export const PageSizeSchema = z.number().int().positive();

/** An opaque pagination cursor. */
export type PaginationCursor = string;

/** A single page of results. */
export type Page<T> = {
  items: T;
  hasMore: boolean;
  nextCursor?: PaginationCursor;
  totalCount?: number;
};

/**
 * A lazy, paginated result. Each page is surfaced as a `Result` (errors as
 * values, never thrown). Await {@link firstPage} for the first page, or use
 * `for await` to iterate pages until one fails or there are no more.
 */
export type Paginated<T, Code extends ErrorCode = ErrorCode> = AsyncIterable<
  Result<Page<T>, Code>
> & {
  firstPage(): Promise<Result<Page<T>, Code>>;
  from(cursor?: PaginationCursor): Paginated<T, Code>;
};

const OffsetCursorStateSchema = z.object({
  offset: z.number().int().min(0),
  pageSize: PageSizeSchema,
});

type OffsetCursorState = z.infer<typeof OffsetCursorStateSchema>;

/** Encodes offset-based pagination state into an opaque cursor. */
export function encodeOffsetCursor(state: OffsetCursorState): PaginationCursor {
  return btoa(JSON.stringify(OffsetCursorStateSchema.parse(state)));
}

/** Decodes an opaque cursor. Invalid cursors are surfaced as request failures. */
export function decodeOffsetCursor(
  cursor: PaginationCursor | undefined,
  pageSize: number,
): Result<OffsetCursorState, 'WRONG_REQUEST_PARAMS'> {
  if (cursor === undefined) {
    return Success({ offset: 0, pageSize });
  }

  try {
    const parsed = OffsetCursorStateSchema.safeParse(
      JSON.parse(atob(cursor)) as unknown,
    );

    if (parsed.success) {
      return Success(parsed.data);
    }
  } catch (error) {
    return Failed(
      'WRONG_REQUEST_PARAMS',
      StatusCodes.BAD_REQUEST,
      'Invalid pagination cursor',
      error,
    );
  }

  return Failed(
    'WRONG_REQUEST_PARAMS',
    StatusCodes.BAD_REQUEST,
    'Invalid pagination cursor',
    cursor,
  );
}

/**
 * Builds a {@link Paginated} from a page-fetching {@link Action}. The fetcher
 * receives the current cursor and resolves to a `Result<Page<T>>`.
 */
export function paginate<T, Code extends ErrorCode = ErrorCode>(
  fetchPage: (cursor?: PaginationCursor) => Action<Page<T>, Code>,
  initialCursor?: PaginationCursor,
): Paginated<T, Code> {
  function createPaginator(cursor = initialCursor): Paginated<T, Code> {
    return {
      firstPage() {
        return run(fetchPage(cursor));
      },
      from(nextCursor) {
        return createPaginator(nextCursor);
      },
      async *[Symbol.asyncIterator]() {
        let currentCursor = cursor;

        while (true) {
          const result = await run(fetchPage(currentCursor));

          yield result;

          if (isFailed(result)) {
            return;
          }

          const page = getValue(result);

          if (!page.hasMore) {
            return;
          }

          currentCursor = page.nextCursor;
        }
      },
    };
  }

  return createPaginator();
}
