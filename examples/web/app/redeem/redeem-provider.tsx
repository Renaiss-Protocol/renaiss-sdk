'use client';

import {
  getError,
  getValue,
  isFailed,
  type RedemptionClient,
  type Result,
  type TypedDataPayload,
} from '@renaiss-protocol/client';
import { signerFrom } from '@renaiss-protocol/client/viem';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  custom,
  type EIP1193Provider,
  erc20Abi,
  getAddress,
  http,
  type WalletClient,
} from 'viem';
import { connectWallet } from '../connect-wallet';
import { demoNetwork } from '../demo-network';
import { shortHex, usdt } from '../eoa/format';
import { switchToDemoChain, walletSelectionChanged } from '../wallet-network';
import { createWalletScope, type WalletToken } from '../wallet-scope';
import { CHAIN_ID, createRedemptionTrader } from './redeem-client';
import {
  type CartDecision,
  decideAdd,
  type Journal,
  journalKey,
  parseJournal,
  serializeJournal,
} from './rules';
import type {
  RedeemableCard,
  RedemptionConfig,
  RedemptionSession,
} from './types';

/*
 * Client-side state shared by /redeem, /redeem/cart and /redeem/orders:
 * the wallet, the SDK client that owns the wallet access token in memory, the
 * same-region cart, funds/allowance, the recovery journal and the developer
 * log. Only the journal (opaque ids + wallet) touches localStorage.
 */

export type LogEntry = { at: string; text: string };
export type Wallet = {
  client: WalletClient;
  account: Address;
  token: WalletToken;
};

type RedeemContextValue = {
  config: RedemptionConfig;
  wallet: Wallet | null;
  session: RedemptionSession | null;
  /** Bumped on wallet/account/chain change; screens key their form state on it. */
  generation: number;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  verifyShipping(): Promise<void>;
  endShippingSession(): Promise<void>;
  assertWallet(): Promise<Wallet>;
  /** False once the wallet or chain changed since `connected` was obtained. */
  isCurrentWallet(connected: Wallet): boolean;
  requireClient(): RedemptionClient;
  balance: bigint | null;
  allowance: bigint | null;
  refreshFunds(): Promise<void>;
  /** Fresh on-chain USDT balance of the connected wallet. */
  fetchBalance(): Promise<bigint>;
  ensureAllowance(required: bigint): Promise<void>;
  cart: RedeemableCard[];
  isInCart(tokenId: bigint): boolean;
  addToCart(card: RedeemableCard): CartDecision;
  replaceCart(card: RedeemableCard): void;
  removeFromCart(tokenId: bigint): void;
  clearCart(): void;
  journal: Journal | null;
  saveJournal(value?: Journal): void;
  busy: boolean;
  error: string;
  setError(message: string): void;
  status: string;
  log: LogEntry[];
  responses: Record<string, unknown>;
  note(text: string): void;
  record(label: string, value: unknown): void;
  work(task: () => Promise<void>): Promise<void>;
};

const RedeemContext = createContext<RedeemContextValue | null>(null);

export function unwrap<T>(result: Result<T>): T {
  if (isFailed(result)) {
    const e = getError(result);
    if (
      e.code === 'REDEMPTION_SESSION_REQUIRED' ||
      e.code === 'REDEMPTION_SIGNING_FAILED'
    )
      throw new Error(e.detail);
    throw new Error(`${e.code} (${e.status}): ${e.detail}`);
  }
  return getValue(result);
}

function injected(): EIP1193Provider {
  const provider = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
  if (!provider)
    throw new Error(
      'Open this demo in a browser with an EVM wallet extension.',
    );
  return provider;
}

const config = demoNetwork.network.redemption;
const rpc = createPublicClient({ chain: demoNetwork.chain, transport: http() });
const JOURNAL_KEY = journalKey(
  CHAIN_ID,
  process.env.NEXT_PUBLIC_RENAISS_API_URL ?? 'local',
);

export function RedeemProvider({
  children,
  walletSessionIssuer,
}: {
  children: ReactNode;
  walletSessionIssuer: string;
}) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [session, setSession] = useState<RedemptionSession | null>(null);
  const [client, setClient] = useState<RedemptionClient | null>(null);
  const [generation, setGeneration] = useState(0);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [cart, setCart] = useState<RedeemableCard[]>([]);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const busyRef = useRef(false);
  // Identifies the connected wallet; results for an older one are dropped.
  const [scope] = useState(createWalletScope);
  const displayGeneration = useRef(0);
  const walletRef = useRef<Wallet | null>(null);
  const clientRef = useRef<RedemptionClient | null>(null);
  walletRef.current = wallet;
  clientRef.current = client;

  const record = useCallback(
    (label: string, value: unknown) => {
      if (generation !== displayGeneration.current) return;
      setResponses((previous) => ({ ...previous, [label]: value }));
    },
    [generation],
  );
  const note = useCallback((text: string) => {
    setStatus(text);
    setLog((previous) => [
      { at: new Date().toISOString(), text },
      ...previous.slice(0, 199),
    ]);
  }, []);
  const work = useCallback(async (task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setStatus('');
      setLog((previous) => [
        { at: new Date().toISOString(), text: `Error: ${message}` },
        ...previous.slice(0, 199),
      ]);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  // Network constants require no request; restore only the recovery journal.
  useEffect(() => {
    record('demoNetwork.network.redemption', config);
    setJournal(parseJournal(localStorage.getItem(JOURNAL_KEY)));
  }, [record]);

  // Account or chain change: drop the session, the cart and every form
  // (screens are keyed on `generation`), and stop in-flight continuations.
  useEffect(() => {
    const provider = (
      window as Window & {
        ethereum?: EIP1193Provider & {
          on?: (event: string, cb: (...args: unknown[]) => void) => void;
          removeListener?: (
            event: string,
            cb: (...args: unknown[]) => void,
          ) => void;
        };
      }
    ).ethereum;
    function changed() {
      scope.clear();
      const previous = clientRef.current;
      setWallet(null);
      setSession(null);
      setClient(null);
      setBalance(null);
      setAllowance(null);
      setCart([]);
      setResponses({});
      setLog([]);
      setError('');
      setGeneration(++displayGeneration.current);
      setStatus(
        'Wallet changed. The wallet access token and cart were cleared; connect again to continue.',
      );
      void previous?.signOutRedemptionWallet().catch(() => undefined);
    }
    // With no wallet connected yet, an event still invalidates a connection
    // attempt that is pending.
    function accountsChanged(accounts: unknown) {
      if (!scope.address()) scope.clear();
      else if (
        walletSelectionChanged(scope.address(), 'accountsChanged', accounts)
      )
        changed();
    }
    function chainChanged(chainId: unknown) {
      if (!scope.address()) scope.clear();
      else if (walletSelectionChanged(scope.address(), 'chainChanged', chainId))
        changed();
    }
    provider?.on?.('accountsChanged', accountsChanged);
    provider?.on?.('chainChanged', chainChanged);
    return () => {
      provider?.removeListener?.('accountsChanged', accountsChanged);
      provider?.removeListener?.('chainChanged', chainChanged);
    };
  }, [scope]);

  const tokenAddress = getAddress(config.tokenAddress);
  const permit2 = getAddress(config.permit2Address);

  const assertWalletFor = useCallback(
    async (connected: Wallet) => {
      const [accounts, chain] = await Promise.all([
        injected().request({ method: 'eth_accounts' }),
        connected.client.getChainId(),
      ]);
      if (
        !scope.isCurrent(connected.token) ||
        chain !== CHAIN_ID ||
        accounts[0]?.toLowerCase() !== connected.account.toLowerCase()
      )
        throw new Error(
          'Wallet changed. Connect again and review the order again.',
        );
      return connected;
    },
    [scope],
  );

  const isCurrentWallet = useCallback(
    (connected: Wallet) => scope.isCurrent(connected.token),
    [scope],
  );

  const assertWallet = useCallback(async () => {
    const connected = walletRef.current;
    if (!connected) throw new Error('Connect your wallet first.');
    return assertWalletFor(connected);
  }, [assertWalletFor]);

  const requireClient = useCallback(() => {
    const current = clientRef.current;
    if (!current) throw new Error('Connect your wallet first.');
    return current;
  }, []);

  const refreshFundsFor = useCallback(
    async (connected: Wallet) => {
      const [funds, approved] = await Promise.all([
        rpc.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [connected.account],
        }),
        rpc.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [connected.account, permit2],
        }),
      ]);
      if (!scope.isCurrent(connected.token)) return;
      setBalance(funds);
      setAllowance(approved);
    },
    [tokenAddress, permit2, scope],
  );

  const refreshFunds = useCallback(async () => {
    const connected = walletRef.current;
    if (connected) await refreshFundsFor(connected);
  }, [refreshFundsFor]);

  const fetchBalance = useCallback(async () => {
    const connected = await assertWallet();
    const funds = await rpc.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [connected.account],
    });
    if (scope.isCurrent(connected.token)) setBalance(funds);
    return funds;
  }, [assertWallet, scope, tokenAddress]);

  const connect = useCallback(async () => {
    if (config.chainId !== CHAIN_ID)
      throw new Error(
        `The redemption config reports chain ${config.chainId}; this demo pins ${CHAIN_ID}.`,
      );
    const provider = injected();
    let connected: Wallet | undefined;
    await connectWallet({
      scope,
      expectedChainId: CHAIN_ID,
      wrongChainMessage: `Switch your wallet to ${demoNetwork.label} (${CHAIN_ID}).`,
      async requestAccess() {
        await provider.request({ method: 'eth_requestAccounts' });
        await switchToDemoChain(
          createWalletClient({ transport: custom(provider) }),
        );
      },
      async readWallet() {
        const probe = createWalletClient({
          chain: demoNetwork.chain,
          transport: custom(provider),
        });
        const [account] = await probe.getAddresses();
        return { account, chainId: await probe.getChainId() };
      },
      publish(token, published) {
        const account = published as Address;
        const walletClient = createWalletClient({
          account,
          chain: demoNetwork.chain,
          transport: custom(provider),
        });
        const next: Wallet = { client: walletClient, account, token };
        const signer = signerFrom(walletClient);
        // Every signature re-checks the wallet so a switched account cannot
        // finish a sign-in message or a Permit2 witness started by another.
        const guarded = {
          ...signer,
          async getAddress() {
            await assertWalletFor(next);
            return account;
          },
          async signMessage(message: string) {
            await assertWalletFor(next);
            const signature = await signer.signMessage(message);
            await assertWalletFor(next);
            return signature;
          },
          async signTypedData(data: TypedDataPayload) {
            await assertWalletFor(next);
            const signature = await signer.signTypedData(data);
            await assertWalletFor(next);
            return signature;
          },
        };
        const trader = createRedemptionTrader(guarded, walletSessionIssuer);
        walletRef.current = next;
        clientRef.current = trader;
        setWallet(next);
        setClient(trader);
        setSession(null);
        connected = next;
        note(
          `Connected ${shortHex(account)} on ${demoNetwork.label}. Sign in for Redeem to continue.`,
        );
      },
    });
    if (connected) await refreshFundsFor(connected);
  }, [assertWalletFor, note, refreshFundsFor, scope, walletSessionIssuer]);

  const verifyShipping = useCallback(async () => {
    const connected = await assertWallet();
    const trader = clientRef.current;
    if (!trader) throw new Error('Connect your wallet first.');
    note('Sign the message to sign in for Redeem...');
    const opened = unwrap(
      await trader.signInRedemptionWallet({ origin: window.location.origin }),
    );
    await assertWalletFor(connected);
    setSession(opened);
    record('POST /v2/auth/wallet/verify (wallet access token)', opened);
    note(`Signed in ${shortHex(connected.account)} for Redeem.`);
  }, [assertWallet, assertWalletFor, note, record]);

  const endShippingSession = useCallback(async () => {
    const current = clientRef.current;
    setSession(null);
    setCart([]);
    setResponses({});
    setLog([]);
    setError('');
    setGeneration(++displayGeneration.current);
    if (current) {
      const result = await current.signOutRedemptionWallet();
      if (isFailed(result)) {
        note(
          'Signed out locally; the server could not confirm that the tokens were revoked.',
        );
        return;
      }
    }
    note('Signed out of Redeem. Your wallet is still connected.');
  }, [note]);

  const disconnect = useCallback(async () => {
    const current = clientRef.current;
    scope.clear();
    setWallet(null);
    setSession(null);
    setClient(null);
    setBalance(null);
    setAllowance(null);
    setCart([]);
    setResponses({});
    setLog([]);
    setError('');
    setGeneration(++displayGeneration.current);
    if (current) {
      const result = await current.signOutRedemptionWallet();
      if (isFailed(result)) {
        const e = getError(result);
        note(`Revoking the tokens failed (${e.code}); cleared locally anyway.`);
        return;
      }
    }
    note('Wallet disconnected; signed out of Redeem.');
  }, [note, scope]);

  /**
   * Redemption fees are a Permit2 witness transfer: the EOA must have
   * approved USDT to Permit2 for at least the amount. Same reset-then-approve
   * dance as the gacha and marketplace demos.
   */
  const ensureAllowance = useCallback(
    async (required: bigint) => {
      const connected = await assertWallet();
      const current = await rpc.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [connected.account, permit2],
      });
      await assertWalletFor(connected);
      if (current >= required) return;
      for (const value of current > 0n ? [0n, required] : [required]) {
        await assertWalletFor(connected);
        note(`Approving $${usdt(value, 2)} USDT to Permit2 in your wallet...`);
        const hash = await connected.client.writeContract({
          account: connected.account,
          chain: demoNetwork.chain,
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [permit2, value],
        });
        const receipt = await rpc.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success')
          throw new Error('Token approval reverted.');
        await assertWalletFor(connected);
        note(`Approved ${usdt(value, 2)} USDT to Permit2 (${shortHex(hash)}).`);
      }
      setAllowance(required);
    },
    [assertWallet, assertWalletFor, note, permit2, tokenAddress],
  );

  const saveJournal = useCallback((value?: Journal) => {
    // Written before any network submit: a checkout never starts unjournaled.
    if (value) localStorage.setItem(JOURNAL_KEY, serializeJournal(value));
    else localStorage.removeItem(JOURNAL_KEY);
    setJournal(value ?? null);
  }, []);

  const value = useMemo<RedeemContextValue>(
    () => ({
      config,
      wallet,
      session,
      generation,
      connect,
      disconnect,
      verifyShipping,
      endShippingSession,
      assertWallet,
      isCurrentWallet,
      requireClient,
      balance,
      allowance,
      refreshFunds,
      fetchBalance,
      ensureAllowance,
      cart,
      isInCart: (tokenId) => cart.some((card) => card.tokenId === tokenId),
      addToCart: (card) => {
        const decision = decideAdd(cart, card, config.maxCards);
        if (decision.kind === 'added') setCart([...cart, card]);
        return decision;
      },
      replaceCart: (card) => setCart([card]),
      removeFromCart: (tokenId) =>
        setCart(cart.filter((card) => card.tokenId !== tokenId)),
      clearCart: () => setCart([]),
      journal,
      saveJournal,
      busy,
      error,
      setError,
      status,
      log,
      responses,
      note,
      record,
      work,
    }),
    [
      wallet,
      session,
      generation,
      connect,
      disconnect,
      verifyShipping,
      endShippingSession,
      assertWallet,
      isCurrentWallet,
      requireClient,
      balance,
      allowance,
      refreshFunds,
      fetchBalance,
      ensureAllowance,
      cart,
      journal,
      saveJournal,
      busy,
      error,
      status,
      log,
      responses,
      note,
      record,
      work,
    ],
  );

  return (
    <RedeemContext.Provider value={value}>{children}</RedeemContext.Provider>
  );
}

export function useRedeem(): RedeemContextValue {
  const value = useContext(RedeemContext);
  if (!value) throw new Error('useRedeem must be used inside RedeemProvider.');
  return value;
}
