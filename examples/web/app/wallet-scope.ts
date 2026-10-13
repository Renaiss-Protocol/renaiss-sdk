import { isConnectedWallet } from './wallet-network';

/** Identifies one connection of one wallet; it stops matching after any change. */
export type WalletToken = {
  readonly generation: number;
  readonly address: string;
};

/**
 * Tracks which wallet is connected. Every connect and clear starts a new
 * generation, so an async result can be checked against the token captured when
 * its request began and dropped when the wallet or chain changed meanwhile.
 */
export type WalletScope = {
  address(): string | undefined;
  generation(): number;
  /** Starts a new generation for `address`. */
  connect(address: string): WalletToken;
  /** Forgets the wallet and invalidates every earlier token. */
  clear(): void;
  /**
   * A token for the connected wallet, or undefined when no wallet is connected
   * or it is not `expected`. A request must not be issued without a token.
   */
  token(expected?: string): WalletToken | undefined;
  /** True while `token` still describes the connected wallet. */
  isCurrent(token: WalletToken): boolean;
};

export function createWalletScope(): WalletScope {
  let generation = 0;
  let address: string | undefined;
  return {
    address: () => address,
    generation: () => generation,
    connect(next) {
      generation += 1;
      address = next;
      return { generation, address: next };
    },
    clear() {
      generation += 1;
      address = undefined;
    },
    token(expected) {
      if (!address) return undefined;
      if (expected !== undefined && !isConnectedWallet(address, expected))
        return undefined;
      return { generation, address };
    },
    isCurrent(token) {
      return token.generation === generation && address !== undefined;
    },
  };
}
