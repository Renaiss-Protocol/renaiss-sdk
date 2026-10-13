import type { WalletScope, WalletToken } from './wallet-scope';

export type WalletReading = { account: string | undefined; chainId: number };

/**
 * Connects a wallet without publishing a stale one. Account and chain events
 * that arrive while the attempt is pending must bump the scope (see
 * `WalletScope.clear`), which aborts the attempt. The wallet is read twice and
 * must agree both times, and nothing is awaited between the last check and the
 * synchronous `publish`.
 */
export async function connectWallet({
  scope,
  expectedChainId,
  wrongChainMessage,
  requestAccess,
  readWallet,
  publish,
}: {
  scope: WalletScope;
  expectedChainId: number;
  wrongChainMessage: string;
  /** Asks the wallet for access and switches it to the expected chain. */
  requestAccess(): Promise<void>;
  readWallet(): Promise<WalletReading>;
  /** Stores the connection. `token` is already current. */
  publish(token: WalletToken, account: string): void;
}): Promise<WalletToken> {
  await requestAccess();
  const started = scope.generation();
  const changed = () =>
    new Error('Wallet changed while connecting. Try again.');
  function accepted(reading: WalletReading): string {
    if (!reading.account) throw new Error('Wallet did not return an account.');
    if (reading.chainId !== expectedChainId) throw new Error(wrongChainMessage);
    return reading.account;
  }
  const account = accepted(await readWallet());
  if (scope.generation() !== started) throw changed();
  const confirmed = accepted(await readWallet());
  if (
    scope.generation() !== started ||
    confirmed.toLowerCase() !== account.toLowerCase()
  )
    throw changed();
  const token = scope.connect(confirmed);
  publish(token, confirmed);
  return token;
}
