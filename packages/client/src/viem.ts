import {
  type Account,
  type Address,
  type Chain,
  createWalletClient,
  custom,
  type EIP1193Provider,
  getAddress,
  type Hex,
  hashTypedData,
  isAddress,
  isHex,
  type Transport,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { RenaissSigner, TypedDataPayload } from './signers';

type ViemAccount = Account | Address;

export type ViemSignerOptions = {
  account?: ViemAccount;
  walletClient: WalletClient;
};

export type PrivateKeySignerOptions = {
  /** Chain attached to the wallet client. Signing does not need it. */
  chain?: Chain;
  /**
   * Transport for the wallet client. Defaults to one that never reaches a
   * network and rejects any RPC request, because the Renaiss signer only
   * signs with the local key. The signer does not expose its wallet client:
   * for chain reads, create your own viem client and adapt it with
   * `signerFrom(walletClient)`.
   */
  transport?: Transport;
};

export type InjectedViemSignerOptions = {
  account: Address;
  provider: EIP1193Provider;
};

function assertAddress(value: string | undefined, label: string): Address {
  if (value === undefined || !isAddress(value)) {
    throw new Error(`${label} must be a valid EVM address.`);
  }

  return getAddress(value);
}

function assertHex(value: string, label: string): Hex {
  if (!isHex(value)) {
    throw new Error(`${label} must be a 0x-prefixed hex string.`);
  }

  return value;
}

function assertPrivateKey(value: Hex | string | undefined): Hex {
  if (value === undefined || !isHex(value) || value.length !== 66) {
    throw new Error('Expected a hex-encoded 32-byte private key.');
  }

  return value;
}

function resolveAccountAddress(account: ViemAccount | undefined): Address {
  if (account === undefined) {
    throw new Error('A viem account is required for signing.');
  }

  return typeof account === 'string'
    ? assertAddress(account, 'account')
    : assertAddress(account.address, 'account.address');
}

function resolveViemAccount(account: ViemAccount | undefined): ViemAccount {
  if (account === undefined) {
    throw new Error('A viem account is required for signing.');
  }

  return account;
}

function toViemTypedData(typedData: TypedDataPayload) {
  return {
    domain: typedData.domain,
    message: typedData.message,
    primaryType: typedData.primaryType,
    types: typedData.types,
  } as Parameters<typeof hashTypedData>[0];
}

/**
 * Adapts a viem wallet client to the generic Renaiss signer interface.
 */
export function createViemSigner(options: ViemSignerOptions): RenaissSigner {
  const account = options.account ?? options.walletClient.account;

  return {
    getAddress() {
      return resolveAccountAddress(account);
    },
    async signMessage(message) {
      const signingAccount = resolveViemAccount(account);

      return assertHex(
        await options.walletClient.signMessage({
          account: signingAccount,
          message,
        }),
        'message signature',
      );
    },
    hashTypedData(typedData) {
      return hashTypedData(toViemTypedData(typedData));
    },
    async signTypedData(typedData) {
      const signingAccount = resolveViemAccount(account);

      return assertHex(
        await options.walletClient.signTypedData({
          account: signingAccount,
          ...toViemTypedData(typedData),
        }),
        'typed data signature',
      );
    },
  };
}

/**
 * Adapts a viem wallet client to the generic Renaiss signer interface.
 *
 * @example
 * const signer = signerFrom(walletClient);
 */
export function signerFrom(walletClient: WalletClient): RenaissSigner {
  return createViemSigner({ walletClient });
}

const offlineTransport: Transport = custom({
  async request({ method }) {
    throw new Error(
      `privateKey() signs locally and has no RPC endpoint, so it cannot send ${method}. Pass a transport option to enable RPC requests.`,
    );
  },
});

/**
 * Creates a Renaiss signer from a private key.
 *
 * The key signs messages and typed data locally. By default the signer has no
 * RPC endpoint and makes no network requests. If you also need chain reads,
 * create your own viem wallet client and use `signerFrom(walletClient)`.
 *
 * @throws Throws an `Error` when `value` is not a 0x-prefixed 32-byte hex
 * string. Signing failures surface as rejected promises from the returned
 * signer's methods.
 *
 * @example
 * const signer = privateKey(process.env.PRIVATE_KEY);
 */
export function privateKey(
  value: Hex | string | undefined,
  options: PrivateKeySignerOptions = {},
): RenaissSigner {
  const account = privateKeyToAccount(assertPrivateKey(value));

  return createViemSigner({
    account,
    walletClient: createWalletClient({
      account,
      chain: options.chain,
      transport: options.transport ?? offlineTransport,
    }),
  });
}

/**
 * Adapts an injected browser wallet provider to the generic Renaiss signer
 * interface.
 */
export function createInjectedViemSigner(
  options: InjectedViemSignerOptions,
): RenaissSigner {
  return createViemSigner({
    account: options.account,
    walletClient: createWalletClient({
      account: options.account,
      transport: custom(options.provider),
    }),
  });
}
