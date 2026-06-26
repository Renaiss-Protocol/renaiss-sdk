import { createWalletClient, custom, type EIP1193Provider } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import { privateKey, signerFrom } from './viem';

const ACCOUNT = '0x1111111111111111111111111111111111111111';
const SAFE_ADDRESS = '0x2222222222222222222222222222222222222222';
const VERIFYING_CONTRACT = '0x3333333333333333333333333333333333333333';
const SIGNATURE = `0x${'11'.repeat(64)}1b`;

describe('viem signer adapters', () => {
  it('adapts an injected provider with Safe typed-data signing', async () => {
    const request = vi.fn(
      async (_payload: unknown, _options?: unknown) => SIGNATURE,
    );
    const provider = {
      on: vi.fn(),
      removeListener: vi.fn(),
      request,
    } as unknown as EIP1193Provider;
    const signer = signerFrom(
      createWalletClient({
        account: ACCOUNT,
        transport: custom(provider),
      }),
    );

    const signature = await signer.signSafeTypedData?.({
      chainId: 56,
      safeAddress: SAFE_ADDRESS,
      typedData: {
        domain: {
          chainId: 56,
          verifyingContract: VERIFYING_CONTRACT,
        },
        message: {
          owner: ACCOUNT,
        },
        primaryType: 'Permit',
        types: {
          Permit: [{ name: 'owner', type: 'address' }],
        },
      },
    });

    expect(signature).toBe(SIGNATURE);
    expect(request.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ method: 'eth_signTypedData_v4' }),
    );
    const payload = request.mock.calls[0]?.[0] as
      | { params?: readonly unknown[] }
      | undefined;
    expect(JSON.parse(String(payload?.params?.[1]))).toEqual(
      expect.objectContaining({
        domain: {
          chainId: 56,
          verifyingContract: SAFE_ADDRESS,
        },
        message: {
          message: expect.stringMatching(/^0x[0-9a-f]{64}$/),
        },
        primaryType: 'SafeMessage',
      }),
    );
  });

  it('validates private key signer input', () => {
    expect(() => privateKey(undefined)).toThrow(
      'Expected a hex-encoded 32-byte private key.',
    );
  });
});
