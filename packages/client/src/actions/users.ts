import {
  type Action,
  Failed,
  pipe,
  StatusCodes,
  TE,
} from '@renaiss-protocol/fp';
import {
  UserActivitiesResponseSchema,
  type UserActivity,
  UserActivityFilter,
  UserActivityFilterSchema,
} from '@renaiss-protocol/schema-validation';
import { z } from 'zod';
import {
  type Page,
  PageSizeSchema,
  type Paginated,
  type PaginationCursor,
  paginate,
} from '../pagination';
import { validateWith } from '../response';
import type { ServiceClient } from '../service-client';

const DEFAULT_PAGE_SIZE = 20;

const ListUserActivitiesRequestSchema = z.object({
  filter: UserActivityFilterSchema.default(UserActivityFilter.All),
  pageSize: PageSizeSchema.max(50).optional(),
});

export type ListUserActivitiesRequest = z.input<
  typeof ListUserActivitiesRequestSchema
>;

/**
 * Lists the authenticated user's activity feed, paginated.
 *
 * @remarks
 * This is a low-level function. Most consumers should prefer the client
 * instance method `client.listUserActivities(...)`. Each page returns
 * `WRONG_REQUEST_PARAMS`, `INVALID_SCHEMA`, or transport/API failures as a
 * `Result`; expected failures are not thrown.
 *
 * @example
 * ```ts
 * const activities = client.listUserActivities({
 *   filter: UserActivityFilter.GachaV3Pull,
 *   pageSize: 20,
 * });
 * const page = await activities.firstPage();
 * if (isSuccess(page)) {
 *   // getValue(page).items: UserActivity[]
 * }
 * ```
 */
export function listUserActivities(
  client: ServiceClient,
  request: ListUserActivitiesRequest = {},
): Paginated<UserActivity[]> {
  const parsed = ListUserActivitiesRequestSchema.safeParse(request);

  if (!parsed.success) {
    return paginate(
      () => async () =>
        Failed(
          'WRONG_REQUEST_PARAMS',
          StatusCodes.BAD_REQUEST,
          'Invalid listUserActivities request',
          parsed.error,
        ),
    );
  }

  const pageSize = parsed.data.pageSize ?? DEFAULT_PAGE_SIZE;
  const fetchPage = (cursor?: PaginationCursor): Action<Page<UserActivity[]>> =>
    pipe(
      client.get('/v0/users/me/activities', {
        query: {
          cursor,
          filter: parsed.data.filter,
          limit: pageSize,
        },
      }),
      TE.chainW(validateWith(UserActivitiesResponseSchema)),
      TE.map((response) => ({
        hasMore: response.nextCursor !== null,
        items: response.activities,
        nextCursor: response.nextCursor ?? undefined,
      })),
    );

  return paginate(fetchPage);
}
