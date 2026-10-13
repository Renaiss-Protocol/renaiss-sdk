import {
  createWalletClient,
  custom,
  type EIP1193Provider,
  type Hex,
  recoverMessageAddress,
  recoverTypedDataAddress,
} from 'viem';
import { privateKeyToAddress } from 'viem/accounts';
import { describe, expect, it, vi } from 'vitest';
import type { TypedDataPayload } from './signers';
import { privateKey, signerFrom } from './viem';

const ACCOUNT = '0x1111111111111111111111111111111111111111';
const VERIFYING_CONTRACT = '0x3333333333333333333333333333333333333333';
// Publicly known test key: it must never hold funds.
const PRIVATE_KEY = `0x${'ab'.repeat(32)}` as const;
const TYPED_DATA: TypedDataPayload = {
  domain: { chainId: 56, verifyingContract: VERIFYING_CONTRACT },
  message: { owner: ACCOUNT },
  primaryType: 'Permit',
  types: { Permit: [{ name: 'owner', type: 'address' }] },
};
const SIGNATURE = `0x${'11'.repeat(64)}1b`;

describe('viem signer adapters', () => {
  it('adapts an injected provider with EOA typed-data signing', async () => {
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

    const signature = await signer.signTypedData({
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
        domain: { chainId: 56, verifyingContract: VERIFYING_CONTRACT },
        message: { owner: ACCOUNT },
        primaryType: 'Permit',
      }),
    );
  });

  it('signs EOA typed data and messages from a private key alone', async () => {
    const signer = privateKey(PRIVATE_KEY);
    const address = privateKeyToAddress(PRIVATE_KEY);

    expect(signer.getAddress()).toBe(address);

    const typedSignature = await signer.signTypedData(TYPED_DATA);
    expect(
      await recoverTypedDataAddress({
        ...TYPED_DATA,
        signature: typedSignature as Hex,
      }),
    ).toBe(address);

    const messageSignature = await signer.signMessage('hello');
    expect(
      await recoverMessageAddress({
        message: 'hello',
        signature: messageSignature as Hex,
      }),
    ).toBe(address);
  });

  it('signs locally and never uses an explicit transport', async () => {
    const request = vi.fn(async () => '0x1');
    const signer = privateKey(PRIVATE_KEY, {
      transport: custom({ request }),
    });

    const signature = await signer.signTypedData(TYPED_DATA);

    expect(
      await recoverTypedDataAddress({
        ...TYPED_DATA,
        signature: signature as Hex,
      }),
    ).toBe(privateKeyToAddress(PRIVATE_KEY));
    expect(request).not.toHaveBeenCalled();
  });

  it('validates private key signer input', () => {
    expect(() => privateKey(undefined)).toThrow(
      'Expected a hex-encoded 32-byte private key.',
    );
  });
});
