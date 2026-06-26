import { type Result, run } from '@renaiss-protocol/fp';
import type {
  ApiKeyResponse,
  AuthenticatedUser,
} from '@renaiss-protocol/schema-validation';
import {
  type CreateApiKeyWithSiweRequest,
  createApiKeyWithSiwe,
  fetchAuthenticatedUser,
} from '../actions/auth';
import type { ServiceClient } from '../service-client';

export type AuthActions = {
  /**
   * Creates a user API key by signing a SIWE message and exchanging the
   * verified session for a key. The key is returned once and is not persisted.
   *
   * @remarks
   * Returns `GACHA_AUTH_FAILED`, `GACHA_API_KEY_CREATE_FAILED`,
   * `WRONG_REQUEST_PARAMS`, `INVALID_SCHEMA`, `UNAUTHORIZED`, or
   * `UNKNOWN_ERROR` as a `Result`; expected failures are not thrown.
   */
  createApiKeyWithSiwe(
    request: CreateApiKeyWithSiweRequest,
  ): Promise<Result<ApiKeyResponse>>;
};

export type SecureAuthActions = {
  /**
   * Fetches the authenticated API key user and wallet addresses.
   *
   * @remarks
   * Returns `UNAUTHORIZED`, `INVALID_SCHEMA`, or `UNKNOWN_ERROR` as a `Result`;
   * expected failures are not thrown.
   */
  fetchAuthenticatedUser(): Promise<Result<AuthenticatedUser>>;
};

export function decorateAuth(client: ServiceClient): AuthActions {
  return {
    createApiKeyWithSiwe: (request) =>
      run(createApiKeyWithSiwe(client, request)),
  };
}

export function decorateSecureAuth(client: ServiceClient): SecureAuthActions {
  return {
    fetchAuthenticatedUser: () => run(fetchAuthenticatedUser(client)),
  };
}
