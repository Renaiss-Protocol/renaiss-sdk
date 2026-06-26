import {
  type AuthActions,
  decorateAuth,
  decorateSecureAuth,
  type SecureAuthActions,
} from './decorators/auth';
import {
  decoratePublicGacha,
  decorateSecureGacha,
  type PublicGachaActions,
  type SecureGachaActions,
} from './decorators/gacha';
import {
  decorateSecureUsers,
  type SecureUserActions,
} from './decorators/users';
import {
  decorateSecureWallets,
  type SecureWalletActions,
} from './decorators/wallets';
import { resolveBaseUrl } from './environments';
import { ServiceClient } from './service-client';
import type { RenaissSigner } from './signers';

export type PublicClientOptions = {
  /** Override the API base URL. Defaults to the `RENAISS_API_URL` env var or the production URL. */
  baseUrl?: string;
};

/** A read-only Renaiss client. */
export type PublicClient = AuthActions & PublicGachaActions;

export type SecureClientOptions = PublicClientOptions & {
  /** User API key returned by `createApiKeyWithSiwe` or the Renaiss API. */
  apiKey: string;
  /** Wallet-library adapter used to sign secure gacha write flows. */
  signer?: RenaissSigner;
};

/** A Renaiss client for secure user gacha workflows. */
export type SecureClient = PublicClient &
  SecureAuthActions &
  SecureGachaActions &
  SecureUserActions &
  SecureWalletActions;

/**
 * Creates a read-only Renaiss client for public endpoints.
 *
 * @example
 * ```ts
 * const client = createPublicClient();
 * const result = await client.listGachaMachines().firstPage();
 * ```
 */
export function createPublicClient(
  options: PublicClientOptions = {},
): PublicClient {
  const service = new ServiceClient({
    baseUrl: resolveBaseUrl(options.baseUrl),
  });

  return {
    ...decorateAuth(service),
    ...decoratePublicGacha(service),
  };
}

/**
 * Creates a secure Renaiss client for user gacha workflows.
 *
 * @example
 * ```ts
 * const client = createSecureClient({ apiKey, signer });
 * const result = await client.pullGacha({ machineSlug });
 * ```
 */
export function createSecureClient(options: SecureClientOptions): SecureClient {
  const service = new ServiceClient({
    apiKey: options.apiKey,
    baseUrl: resolveBaseUrl(options.baseUrl),
  });

  return {
    ...decorateAuth(service),
    ...decorateSecureAuth(service),
    ...decorateSecureGacha(service, options.signer),
    ...decorateSecureUsers(service),
    ...decorateSecureWallets(service, options.signer),
    ...decoratePublicGacha(service),
  };
}
