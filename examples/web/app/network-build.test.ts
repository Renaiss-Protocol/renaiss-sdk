import { afterEach, expect, it, vi } from 'vitest';

// Load the actual Next config, including the env passed to DefinePlugin.
const configUrl = new URL('../next.config.mjs', import.meta.url).href;
const { default: createConfig } = await import(configUrl);

afterEach(() => vi.unstubAllEnvs());

it.each([
  undefined,
  'testnet',
  'mainnet',
])('always supplies a build-time public network value (%s)', (value) => {
  vi.stubEnv('NEXT_PUBLIC_RENAISS_NETWORK', value);
  expect(createConfig('phase-production-build').env).toEqual({
    NEXT_PUBLIC_RENAISS_NETWORK: value ?? 'testnet',
  });
});

it.each([
  '',
  'production',
  '56',
  'mainet',
])('rejects invalid settings while loading Next config (%s)', (value) => {
  vi.stubEnv('NEXT_PUBLIC_RENAISS_NETWORK', value);
  expect(() => createConfig('phase-development-server')).toThrow(
    'NEXT_PUBLIC_RENAISS_NETWORK',
  );
  expect(() => createConfig('phase-production-build')).toThrow(
    'NEXT_PUBLIC_RENAISS_NETWORK',
  );
});
