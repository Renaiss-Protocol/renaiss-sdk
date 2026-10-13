import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import * as publicClient from './index';
import {
  BNB_MAINNET,
  BNB_TESTNET,
  createGachaClient,
  createMarketplaceClient,
  createRedemptionClient,
} from './index';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it.each([
  BNB_TESTNET,
  BNB_MAINNET,
])('uses the explicitly configured API for each network ($chainId)', async (network) => {
  vi.stubEnv('RENAISS_API_URL', undefined);
  const fetch = vi.fn(async () =>
    Response.json(
      { code: 'UNAVAILABLE', message: 'Fixture boundary' },
      { status: 503 },
    ),
  );
  vi.stubGlobal('fetch', fetch);
  const baseUrl = `https://api-${network.chainId}.example`;
  const options = { network, baseUrl };
  await createGachaClient(options).listGachaMachines().firstPage();
  await createMarketplaceClient(options).listMarketplaceCards().firstPage();
  await createRedemptionClient({
    ...options,
    signer: {
      getAddress: async () => '0x1111111111111111111111111111111111111111',
      signMessage: async () => {
        throw new Error('Must not sign a failed challenge');
      },
      signTypedData: async () => {
        throw new Error('No transaction in this test');
      },
    },
  }).signInRedemptionWallet({ origin: 'https://partner.example' });
  expect(fetch).toHaveBeenCalledTimes(3);
  for (const [url] of fetch.mock.calls as unknown as [string][])
    expect(url.startsWith(`${baseUrl}/v2/`)).toBe(true);
});

it('keeps internal decorator factories and transport out of the public entry point', () => {
  expect(
    Object.keys(publicClient).filter((name) =>
      /decorate|ServiceClient|Context/.test(name),
    ),
  ).toEqual([]);
  expect(publicClient.createGachaClient).toBeTypeOf('function');
  expect(publicClient.createMarketplaceClient).toBeTypeOf('function');
  expect(publicClient.createRedemptionClient).toBeTypeOf('function');
});

it('exports EOA clients only from the root and rejects the removed v2 subpath', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  );
  expect(manifest.exports['./v2']).toBeUndefined();
  expect(manifest.typesVersions['*']).not.toHaveProperty('v2');
  // Native Node resolution exercises package.json and the built files, without
  // Vitest's source aliases. CI builds the client before running this suite.
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `import assert from 'node:assert/strict';
       import * as root from '@renaiss-protocol/client';
       await assert.rejects(import('@renaiss-protocol/client/v2'), {
         code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
       });
       for (const name of ['createGachaClient', 'createMarketplaceClient', 'createRedemptionClient']) {
         assert.equal(typeof root[name], 'function');
       }`,
    ],
    { cwd: new URL('..', import.meta.url), stdio: 'pipe' },
  );
  for (const name of [
    'createPublicClient',
    'createSecureClient',
    'createBuilderClient',
    'createSigningClient',
  ]) {
    expect(publicClient).not.toHaveProperty(name);
  }
});
it.each([
  {
    options: { baseUrl: '' },
    detail: 'Configure an explicit API baseUrl or backend proxy.',
  },
  {
    options: { baseUrl: '   ' },
    detail: 'Configure an explicit API baseUrl or backend proxy.',
  },
  {
    options: { baseUrl: 'https://api.example', builderApiKey: '' },
    detail: 'builderApiKey must be non-empty when supplied.',
  },
  {
    options: { baseUrl: 'https://api.example', builderApiKey: '   ' },
    detail: 'builderApiKey must be non-empty when supplied.',
  },
])('returns actionable configuration errors without HTTP or signing ($options)', async ({
  options,
  detail,
}) => {
  const fetch = vi.fn();
  const signMessage = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const results = await Promise.all([
    createGachaClient(options).listGachaMachines().firstPage(),
    createMarketplaceClient(options).listMarketplaceCards().firstPage(),
    createRedemptionClient({
      ...options,
      signer: {
        getAddress: async () => '0x1111111111111111111111111111111111111111',
        signMessage,
        signTypedData: vi.fn(),
      },
    }).signInRedemptionWallet({ origin: 'https://partner.example' }),
  ]);
  for (const result of results)
    expect(result).toMatchObject({
      _tag: 'Left',
      left: { code: 'WRONG_REQUEST_PARAMS', status: 400, detail },
    });
  expect(fetch).not.toHaveBeenCalled();
  expect(signMessage).not.toHaveBeenCalled();
});
