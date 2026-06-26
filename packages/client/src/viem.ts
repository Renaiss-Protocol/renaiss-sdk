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
  http,
  isAddress,
  isHex,
  type Transport,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type {
  RenaissSigner,
  SafeTypedDataRequest,
  TypedDataPayload,
} from './signers';

type ViemAccount = Account | Address;

export type ViemSignerOptions = {
  account?: ViemAccount;
  safeAddress?: Address;
  walletClient: WalletClient;
};

export type ViemPrivateKeySignerOptions = {
  chain?: Chain;
  privateKey: Hex;
  safeAddress?: Address;
  transport?: Transport;
};

export type PrivateKeySignerOptions = {
  chain?: Chain;
  safeAddress?: Address;
  transport?: Transport;
};

export type InjectedViemSignerOptions = {
  account: Address;
  provider: EIP1193Provider;
  safeAddress?: Address;
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

function createSafeMessageTypedData(request: {
  chainId: number;
  messageHash: Hex;
  safeAddress: Address;
}) {
  return {
    domain: {
      chainId: request.chainId,
      verifyingContract: request.safeAddress,
    },
    message: {
      message: request.messageHash,
    },
    primaryType: 'SafeMessage',
    types: {
      SafeMessage: [{ name: 'message', type: 'bytes' }],
    },
  } as const;
}

function resolveSafeAddress(
  request: SafeTypedDataRequest,
  safeAddress: Address | undefined,
): Address {
  return assertAddress(safeAddress ?? request.safeAddress, 'safeAddress');
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
    async signSafeTypedData(request) {
      const signingAccount = resolveViemAccount(account);
      const safeAddress = resolveSafeAddress(request, options.safeAddress);
      const messageHash = hashTypedData(toViemTypedData(request.typedData));
      const safeMessageTypedData = createSafeMessageTypedData({
        chainId: request.chainId,
        messageHash,
        safeAddress,
      });

      return assertHex(
        await options.walletClient.signTypedData({
          ...safeMessageTypedData,
          account: signingAccount,
        }),
        'Safe signature',
      );
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

/**
 * Creates a Renaiss signer from a private key.
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
    safeAddress: options.safeAddress,
    walletClient: createWalletClient({
      account,
      chain: options.chain,
      transport: options.transport ?? http(),
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
    safeAddress: options.safeAddress,
    walletClient: createWalletClient({
      account: options.account,
      transport: custom(options.provider),
    }),
  });
}

/**
 * Adapts a private key to the generic Renaiss signer interface.
 */
export function createViemPrivateKeySigner(
  options: ViemPrivateKeySignerOptions,
): RenaissSigner {
  return privateKey(options.privateKey, {
    chain: options.chain,
    safeAddress: options.safeAddress,
    transport: options.transport,
  });
}
