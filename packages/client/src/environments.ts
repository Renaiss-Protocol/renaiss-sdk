/** Default base URL for the Renaiss public API. */
export const DEFAULT_BASE_URL = 'https://api.renaiss.xyz';

/**
 * Resolves the API base URL.
 *
 * Order of precedence: explicit `baseUrl` argument, then the `RENAISS_API_URL`
 * environment variable (when running on a platform that exposes `process.env`),
 * then {@link DEFAULT_BASE_URL}.
 */
export function resolveBaseUrl(baseUrl?: string): string {
  if (baseUrl !== undefined) {
    return baseUrl;
  }

  const fromEnv =
    typeof process !== 'undefined' ? process.env?.RENAISS_API_URL : undefined;

  return fromEnv ?? DEFAULT_BASE_URL;
}
