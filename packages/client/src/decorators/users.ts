import type { UserActivity } from '@renaiss-protocol/schema-validation';
import {
  type ListUserActivitiesRequest,
  listUserActivities,
} from '../actions/users';
import type { Paginated } from '../pagination';
import type { ServiceClient } from '../service-client';

export type SecureUserActions = {
  /**
   * Lists the authenticated user's activity feed, paginated.
   *
   * @remarks
   * Each page returns `WRONG_REQUEST_PARAMS`, `INVALID_SCHEMA`,
   * `UNAUTHORIZED`, `SUBGRAPH_QUERY_FAILED`, `ACTIVITY_QUERY_FAILED`, or
   * `UNKNOWN_ERROR` as a `Result`; expected failures are not thrown.
   */
  listUserActivities(
    request?: ListUserActivitiesRequest,
  ): Paginated<UserActivity[]>;
};

export function decorateSecureUsers(client: ServiceClient): SecureUserActions {
  return {
    listUserActivities: (request) => listUserActivities(client, request),
  };
}
