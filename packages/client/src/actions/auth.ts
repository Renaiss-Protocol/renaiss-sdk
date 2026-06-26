import {
  type Action,
  Failed,
  getValue,
  isFailed,
  pipe,
  type Result,
  run,
  StatusCodes,
  Success,
  TE,
} from '@renaiss-protocol/fp';
import {
  type ApiKeyResponse,
  ApiKeyResponseSchema,
  type AuthenticatedUser,
  AuthenticatedUserSchema,
} from '@renaiss-protocol/schema-validation';
import { z } from 'zod';
import { validateWith } from '../response';
import type { ServiceClient } from '../service-client';
import type { RenaissSigner } from '../signers';
import { resolveSignerAddress } from '../signers';

const DEFAULT_SIWE_EXPIRATION_MS = 5 * 60 * 1000;
const SIWE_STATEMENT = 'Sign in to Renaiss API.';

const CreateApiKeyWithSiweRequestSchema = z.object({
  chainId: z.number().int().positive().optional(),
  expiresIn: z.number().int().positive().optional(),
  name: z.string().min(1).max(255).optional(),
  prefix: z.string().min(1).max(32).optional(),
  signer: z.custom<RenaissSigner>(
    (value) =>
      value !== null &&
      typeof value === 'object' &&
      'getAddress' in value &&
      'signMessage' in value,
    'Expected a Renaiss signer',
  ),
});

export type CreateApiKeyWithSiweRequest = z.input<
  typeof CreateApiKeyWithSiweRequestSchema
>;

const NonceResponseSchema = z
  .object({
    data: z.object({ nonce: z.string().min(1) }).optional(),
    nonce: z.string().min(1).optional(),
  })
  .transform((value) => value.nonce ?? value.data?.nonce)
  .pipe(z.string().min(1));

const ContractAddressesResponseSchema = z.object({
  chainId: z.number().int().positive(),
});

function buildSiweMessage(input: {
  address: string;
  apiUrl: string;
  chainId: number;
  nonce: string;
}): string {
  const url = new URL(input.apiUrl);
  const origin = url.origin;
  const issuedAt = new Date();
  const expirationTime = new Date(
    issuedAt.getTime() + DEFAULT_SIWE_EXPIRATION_MS,
  );

  return [
    `${url.host} wants you to sign in with your Ethereum account:`,
    input.address,
    '',
    SIWE_STATEMENT,
    '',
    `URI: ${origin}`,
    'Version: 1',
    `Chain ID: ${input.chainId}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expiration Time: ${expirationTime.toISOString()}`,
  ].join('\n');
}

async function resolveChainId(
  client: ServiceClient,
  chainId: number | undefined,
): Promise<Result<number>> {
  if (chainId !== undefined) {
    return Success(chainId);
  }

  const response = await run(client.get('/v0/config/contract-addresses'));
  if (isFailed(response)) return response;

  const parsed = await run(
    validateWith(ContractAddressesResponseSchema)(getValue(response)),
  );
  if (isFailed(parsed)) return parsed;

  return Success(getValue(parsed).chainId);
}

/**
 * Creates a user API key by signing in with SIWE and exchanging the bearer
 * session for an API key. The SDK returns the key once and does not persist it.
 */
export function createApiKeyWithSiwe(
  client: ServiceClient,
  request: CreateApiKeyWithSiweRequest,
): Action<ApiKeyResponse> {
  const parsed = CreateApiKeyWithSiweRequestSchema.safeParse(request);
  if (!parsed.success) {
    return async () =>
      Failed(
        'WRONG_REQUEST_PARAMS',
        StatusCodes.BAD_REQUEST,
        'Invalid createApiKeyWithSiwe request',
        parsed.error,
      );
  }

  return async () => {
    try {
      const address = await resolveSignerAddress(parsed.data.signer);
      const chainIdResult = await resolveChainId(client, parsed.data.chainId);
      if (isFailed(chainIdResult)) return chainIdResult;

      const chainId = getValue(chainIdResult);
      const nonceResponse = await run(
        client.post('/api/auth/siwe/nonce', {
          body: {
            chainId,
            walletAddress: address,
          },
        }),
      );
      if (isFailed(nonceResponse)) {
        return nonceResponse;
      }

      const nonceResult = await run(
        validateWith(NonceResponseSchema)(getValue(nonceResponse)),
      );
      if (isFailed(nonceResult)) {
        return nonceResult;
      }

      const message = buildSiweMessage({
        address,
        apiUrl: client.baseUrl,
        chainId,
        nonce: getValue(nonceResult),
      });
      const signature = await parsed.data.signer.signMessage(message);
      const verifyResponse = await run(
        client.postJsonWithResponse('/api/auth/siwe/verify', {
          body: {
            chainId,
            message,
            signature,
            walletAddress: address,
          },
        }),
      );
      if (isFailed(verifyResponse)) {
        return verifyResponse;
      }

      const token = getValue(verifyResponse).headers.get('set-auth-token');
      if (!token) {
        return Failed(
          'GACHA_AUTH_FAILED',
          StatusCodes.UNAUTHORIZED,
          'SIWE verify succeeded but did not return a session token',
        );
      }

      const keyResponse = await run(
        client.post('/api/auth/api-key/create', {
          body: {
            expiresIn: parsed.data.expiresIn,
            name: parsed.data.name,
            prefix: parsed.data.prefix,
          },
          headers: {
            authorization: `Bearer ${token}`,
          },
        }),
      );
      if (isFailed(keyResponse)) {
        return keyResponse;
      }

      return run(validateWith(ApiKeyResponseSchema)(getValue(keyResponse)));
    } catch (error) {
      return Failed(
        'GACHA_AUTH_FAILED',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to authenticate with SIWE',
        error,
      );
    }
  };
}

/** Fetches the authenticated API key user and wallet addresses. */
export function fetchAuthenticatedUser(
  client: ServiceClient,
): Action<AuthenticatedUser> {
  return pipe(
    client.get('/v0/users/me'),
    TE.chainW(validateWith(AuthenticatedUserSchema)),
  );
}
