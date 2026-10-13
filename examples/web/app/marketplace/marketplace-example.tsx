'use client';

import {
  type AskQuote,
  type CardDetail,
  type CardOrders,
  getError,
  getValue,
  isFailed,
  type MarketplaceCard,
  type MarketplaceOrder,
} from '@renaiss-protocol/client';
import { signerFrom } from '@renaiss-protocol/client/viem';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type Address,
  createPublicClient as createRpcClient,
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
import { CardDetailView } from './card-detail';
import { CardGrid, FilterBar } from './card-grid';
import { DeveloperPanel, type LogEntry } from './developer-panel';
import {
  type Filters,
  listKey,
  SEARCH_DEBOUNCE_MS,
  serializeState,
  toListRequest,
} from './filters';
import styles from './marketplace.module.css';
import {
  CHAIN_ID,
  createMarketplaceReader,
  createMarketplaceTrader,
  type MarketplaceTrader,
} from './marketplace-client';
import {
  AcceptOfferDialog,
  BuyNowDialog,
  CancelBidDialog,
  type DialogState,
  ListCardDialog,
  MakeOfferDialog,
  UnlistDialog,
} from './trading-forms';

/*
 * Marketplace demo: card grid with filters, card detail, and the trading
 * forms. The Developer section maps each API field to where this demo uses it.
 */

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

type InitialPage = {
  items: MarketplaceCard[];
  hasMore: boolean;
  nextCursor?: string;
  totalCount?: number;
};

/** First page fetched on the server, or why it could not be. */
export type InitialResult =
  | { page: InitialPage; error: null }
  | { page: null; error: string }
  | null;

const config = demoNetwork.network.marketplace;
const rpc = createRpcClient({ chain: demoNetwork.chain, transport: http() });

type Wallet = {
  client: WalletClient;
  account: Address;
  token: WalletToken;
};

function describe(error: { code: string; status: number; detail: string }) {
  return `${error.code} (${error.status}): ${error.detail}`;
}

function injected(): EIP1193Provider {
  const provider = window.ethereum;
  if (!provider)
    throw new Error(
      'Open this demo in a browser with an EVM wallet extension.',
    );
  return provider;
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function MarketplaceExample({
  browserBaseUrl,
  initial,
  initialFilters,
  initialTokenId,
}: {
  browserBaseUrl: string;
  /** First page for `initialFilters`, fetched on the server. */
  initial: InitialResult;
  initialFilters: Filters;
  initialTokenId: string | null;
}) {
  const reader = useMemo(
    () => createMarketplaceReader(browserBaseUrl),
    [browserBaseUrl],
  );

  // ---- list state ----
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [debouncedQ, setDebouncedQ] = useState(initialFilters.q);
  const [ready, setReady] = useState(false);
  const [cards, setCards] = useState<MarketplaceCard[]>(
    initial?.page?.items ?? [],
  );
  const [cursor, setCursor] = useState(initial?.page?.nextCursor);
  const [hasMore, setHasMore] = useState(initial?.page?.hasMore ?? false);
  const [total, setTotal] = useState(initial?.page?.totalCount);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(
    initial?.error ?? null,
  );
  const loadedKey = useRef<string | null>(
    initial?.page ? listKey(toListRequest(initialFilters)) : null,
  );
  const requestSeq = useRef(0);
  const detailSeq = useRef(0);
  const selectedToken = useRef(initialTokenId);
  // Identifies the connected wallet; results for an older one are dropped.
  const [scope] = useState(createWalletScope);

  // ---- detail state ----
  const [tokenId, setTokenId] = useState<string | null>(initialTokenId);
  const [detail, setDetail] = useState<CardDetail | null>(null);
  const [orders, setOrders] = useState<CardOrders | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [askResult, setAskResult] = useState<AskQuote | null>(null);

  // ---- marketplace config + wallet ----
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [trader, setTrader] = useState<MarketplaceTrader | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);

  // ---- feedback ----
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const now = useNow(tokenId !== null && (orders?.activeBids.length ?? 0) > 0);

  const record = useCallback((label: string, value: unknown) => {
    setResponses((previous) => ({ ...previous, [label]: value }));
  }, []);
  function note(text: string) {
    setStatus(text);
    setLog((previous) => [
      { at: new Date().toISOString(), text },
      ...previous.slice(0, 199),
    ]);
  }
  async function work(task: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      note(`Error: ${message}`);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  // The server parsed the URL into `initialFilters` / `initialTokenId`; from
  // here on the client owns the URL.
  useEffect(() => {
    setReady(true);
  }, []);

  // state → URL (filter keys, plus ?card= for the detail)
  useEffect(() => {
    if (!ready) return;
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${serializeState(filters, tokenId)}`,
    );
  }, [ready, filters, tokenId]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(filters.q), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [filters.q]);

  // Search reaches the request only through the debounced value, so typing
  // changes `filters` but not `key`, and the list effect below stays put.
  const request = useMemo(
    () => toListRequest({ ...filters, q: debouncedQ }),
    [filters, debouncedQ],
  );
  const key = listKey(request);

  // Versioned SDK constants, also used by the signing client.
  useEffect(() => {
    record('demoNetwork.network.marketplace', config);
  }, [record]);

  // First page for the current query. The server-rendered page is reused
  // when the query still matches it.
  useEffect(() => {
    if (!ready || loadedKey.current === key) return;
    const seq = ++requestSeq.current;
    // Once a replacement starts, returning to the previous filters must also
    // start a request so the in-flight replacement cannot become current.
    loadedKey.current = null;
    setLoading(true);
    setLoadingMore(false);
    setListError(null);
    void (async () => {
      const result = await reader.listMarketplaceCards(request).firstPage();
      if (seq !== requestSeq.current) return;
      setLoading(false);
      if (isFailed(result)) {
        setListError(describe(getError(result)));
        setCards([]);
        setHasMore(false);
        setCursor(undefined);
        setTotal(undefined);
        return;
      }
      const page = getValue(result);
      loadedKey.current = key;
      setCards(page.items);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setTotal(page.totalCount);
      record('listMarketplaceCards().firstPage()', page);
    })();
  }, [ready, key, request, reader, record]);

  const loadMore = useCallback(() => {
    if (!cursor || loading || loadingMore || loadedKey.current !== key) return;
    const seq = requestSeq.current;
    setLoadingMore(true);
    void (async () => {
      const result = await reader
        .listMarketplaceCards(request)
        .from(cursor)
        .firstPage();
      if (seq !== requestSeq.current) return;
      setLoadingMore(false);
      if (isFailed(result)) {
        setListError(describe(getError(result)));
        return;
      }
      const page = getValue(result);
      setCards((previous) => [...previous, ...page.items]);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
      record('listMarketplaceCards().from(cursor).firstPage()', page);
    })();
  }, [cursor, loading, loadingMore, key, reader, request, record]);

  // Detail + live orders for the open card.
  const loadDetail = useCallback(
    async (id: string) => {
      const seq = ++detailSeq.current;
      setDetailLoading(true);
      const [detailResult, ordersResult] = await Promise.all([
        reader.fetchCard({ tokenId: id }),
        reader.fetchCardOrders({ tokenId: id }),
      ]);
      if (seq !== detailSeq.current || selectedToken.current !== id) return;
      setDetailLoading(false);
      if (isFailed(detailResult)) {
        setDetailError(describe(getError(detailResult)));
        setDetail(null);
        setOrders(null);
        return;
      }
      const card = getValue(detailResult);
      setDetail(card);
      setDetailError(null);
      record('fetchCard()', card);
      if (isFailed(ordersResult)) {
        setOrders(null);
        setDetailError(describe(getError(ordersResult)));
      } else {
        setOrders(getValue(ordersResult));
        record('fetchCardOrders()', getValue(ordersResult));
      }
    },
    [reader, record],
  );

  useEffect(() => {
    selectedToken.current = tokenId;
    setDetail(null);
    setOrders(null);
    if (!tokenId) {
      setDetail(null);
      setOrders(null);
      setDetailError(null);
      setDialog(null);
      return;
    }
    void loadDetail(tokenId);
    return () => {
      detailSeq.current++;
    };
  }, [tokenId, loadDetail]);

  // ---- wallet ----
  // Forget everything tied to the connected wallet and invalidate its
  // in-flight requests.
  const clearWalletState = useCallback(() => {
    scope.clear();
    setWallet(null);
    setTrader(null);
    setBalance(null);
    setAllowance(null);
    setDialog(null);
    setAskResult(null);
    setResponses({});
  }, [scope]);

  useEffect(() => {
    const provider = window.ethereum as
      | (EIP1193Provider & {
          on?: (event: string, cb: (value: unknown) => void) => void;
          removeListener?: (
            event: string,
            cb: (value: unknown) => void,
          ) => void;
        })
      | undefined;
    function changed() {
      clearWalletState();
      setStatus('Wallet changed. Connect again to continue.');
    }
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
  }, [clearWalletState, scope]);

  const usdtAddress = getAddress(config.contracts.usdt);
  const permit2 = getAddress(config.contracts.permit2);
  const feeBps = BigInt(config.platformFeeBps);

  async function refreshFunds(connected: Wallet) {
    const { account, token } = connected;
    if (!scope.isCurrent(token)) return;
    const [funds, approved] = await Promise.all([
      rpc.readContract({
        address: usdtAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account],
      }),
      rpc.readContract({
        address: usdtAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account, permit2],
      }),
    ]);
    if (!scope.isCurrent(token)) return;
    setBalance(funds);
    setAllowance(approved);
  }

  async function disconnect() {
    clearWalletState();
    note('Wallet disconnected.');
  }

  async function connect() {
    if (config.chainId !== CHAIN_ID)
      throw new Error(
        `The marketplace config reports chain ${config.chainId}; this demo pins ${CHAIN_ID}.`,
      );
    const provider = injected();
    let connectedWallet: Wallet | undefined;
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
        const client = createWalletClient({
          account,
          chain: demoNetwork.chain,
          transport: custom(provider),
        });
        const connected = { client, account, token };
        const signer = signerFrom(client);
        setWallet(connected);
        setTrader(
          createMarketplaceTrader({
            ...signer,
            async getAddress() {
              await assertWallet(connected);
              return account;
            },
            async signTypedData(data) {
              await assertWallet(connected);
              const signature = await signer.signTypedData(data);
              await assertWallet(connected);
              return signature;
            },
          }),
        );
        connectedWallet = connected;
        note(`Connected ${shortHex(account)} on ${demoNetwork.label}.`);
      },
    });
    if (connectedWallet) await refreshFunds(connectedWallet);
  }

  async function assertWallet(connected: Wallet) {
    const [accounts, chain] = await Promise.all([
      injected().request({ method: 'eth_accounts' }),
      connected.client.getChainId(),
    ]);
    if (
      !scope.isCurrent(connected.token) ||
      chain !== CHAIN_ID ||
      accounts[0]?.toLowerCase() !== connected.account.toLowerCase()
    )
      throw new Error('Wallet changed. Reconnect and review the order again.');
  }

  /**
   * Bids and buys are Permit2 witness transfers: the EOA must have approved
   * USDT to Permit2 for at least the amount. Same reset-then-approve dance as
   * the gacha demo, because some USDT deployments reject non-zero → non-zero.
   */
  async function ensureAllowance(required: bigint) {
    if (!wallet) throw new Error('Connect a wallet first.');
    await assertWallet(wallet);
    const current = await rpc.readContract({
      address: usdtAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [wallet.account, permit2],
    });
    await assertWallet(wallet);
    if (current >= required) return;
    for (const value of current > 0n ? [0n, required] : [required]) {
      await assertWallet(wallet);
      note(`Approving $${usdt(value, 2)} USDT to Permit2 in your wallet...`);
      const hash = await wallet.client.writeContract({
        account: wallet.account,
        chain: demoNetwork.chain,
        address: usdtAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [permit2, value],
      });
      const receipt = await rpc.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success')
        throw new Error('Token approval reverted.');
      await assertWallet(wallet);
      note(`Approved ${usdt(value, 2)} USDT to Permit2 (${shortHex(hash)}).`);
    }
    setAllowance(required);
  }

  // ---- trading ----
  function requireTrader(): MarketplaceTrader {
    if (!trader) throw new Error('Connect a wallet to trade.');
    return trader;
  }
  /** True while the wallet that started a trade is still the connected one. */
  function walletLive(): () => boolean {
    const token = scope.token();
    if (!token) throw new Error('Connect a wallet to trade.');
    return () => scope.isCurrent(token);
  }
  async function afterTrade(id: string) {
    if (selectedToken.current === id) await loadDetail(id);
    loadedKey.current = null;
    setFilters((previous) => ({ ...previous }));
    if (wallet) await refreshFunds(wallet);
  }

  async function buy(card: CardDetail) {
    const live = walletLive();
    if (card.askPriceInUsdt === null) return;
    await ensureAllowance(BigInt(card.askPriceInUsdt));
    note('Sign the purchase in your wallet...');
    const result = await requireTrader().buyCard({
      tokenId: card.tokenId,
      expectedTotalPriceInUsdt: BigInt(card.askPriceInUsdt),
    });
    if (live()) record('buyCard()', result);
    if (isFailed(result)) throw new Error(describe(getError(result)));
    const trade = getValue(result);
    note(
      trade.executed
        ? `Bought ${card.name} for $${usdt(trade.quote.amountInUsdt, 18)} (tx ${trade.executionTxHash ?? '?'}).`
        : `Buy order ${trade.orderId} is ${trade.status.toLowerCase()}.`,
    );
    if (live()) setDialog(null);
    await afterTrade(card.tokenId);
  }

  async function offer(
    card: CardDetail,
    amountInUsdt: bigint,
    expiresInSeconds: number,
  ) {
    const live = walletLive();
    await ensureAllowance(amountInUsdt);
    note('Sign the offer in your wallet...');
    const result = await requireTrader().createBid({
      tokenId: card.tokenId,
      amountInUsdt: BigInt(amountInUsdt.toString()),
      expiresInSeconds,
    });
    if (live()) record('createBid()', result);
    if (isFailed(result)) throw new Error(describe(getError(result)));
    const bid = getValue(result);
    note(
      bid.executed
        ? 'Your offer matched the ask and settled.'
        : `Offer placed for $${usdt(bid.quote.amountInUsdt, 18)}, expires ${new Date(bid.quote.expiresAt).toLocaleString()}.`,
    );
    if (live()) setDialog(null);
    await afterTrade(card.tokenId);
  }

  async function list(card: CardDetail, sellerReceivesInUsdt: bigint) {
    const live = walletLive();
    note('Sign the listing in your wallet...');
    const result = await requireTrader().createAsk({
      tokenId: card.tokenId,
      sellerReceivesInUsdt: BigInt(sellerReceivesInUsdt.toString()),
    });
    if (live()) record('createAsk()', result);
    if (isFailed(result)) throw new Error(describe(getError(result)));
    const ask = getValue(result);
    if (live()) setAskResult(ask.quote);
    note(
      `Listed ${card.name} for $${usdt(ask.quote.totalPriceInUsdt, 18)} (you receive $${usdt(ask.quote.sellerReceivesInUsdt, 18)}).`,
    );
    await afterTrade(card.tokenId);
  }

  async function cancelOrder(card: CardDetail, orderId: string, what: string) {
    const live = walletLive();
    note(`Sign the ${what} cancellation in your wallet...`);
    const result = await requireTrader().cancelOrder({ orderId });
    if (live()) record('cancelOrder()', result);
    if (isFailed(result)) throw new Error(describe(getError(result)));
    note(`Cancelled ${what} ${getValue(result).orderId}.`);
    if (live()) setDialog(null);
    await afterTrade(card.tokenId);
  }

  async function accept(card: CardDetail, bid: MarketplaceOrder) {
    const live = walletLive();
    note('Sign the sale in your wallet...');
    const result = await requireTrader().acceptBid({
      tokenId: card.tokenId,
      bidId: bid.id,
      expectedTotalPriceInUsdt: BigInt(bid.amountInUsdt),
    });
    if (live()) record('acceptBid()', result);
    if (isFailed(result)) throw new Error(describe(getError(result)));
    const sale = getValue(result);
    note(
      `Sold ${card.name} for $${usdt(sale.quote.amountInUsdt, 18)}; you receive $${usdt(sale.quote.sellerReceivesInUsdt, 18)}.`,
    );
    if (live()) setDialog(null);
    await afterTrade(card.tokenId);
  }

  function open(id: string | null) {
    selectedToken.current = id;
    detailSeq.current++;
    setDetail(null);
    setOrders(null);
    setDialog(null);
    setAskResult(null);
    setTokenId(id);
    window.scrollTo({ top: 0 });
  }

  async function share(id: string) {
    const url = `${window.location.origin}${window.location.pathname}?card=${id}`;
    try {
      await navigator.clipboard.writeText(url);
      note('Copied the card link.');
    } catch {
      note(url);
    }
  }

  const canSubmit = trader !== null;
  const askOrderId = orders?.activeAsk?.id ?? null;

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.eyebrow}>
            Renaiss SDK · marketplace · EOA
          </span>
          <span className={`${styles.muted} ${styles.small}`}>
            Browse cards, list, bid and buy through the SDK.
          </span>
        </div>
        <button
          type='button'
          className={`${styles.btn} ${wallet ? '' : styles.btnSolid}`}
          disabled={busy}
          onClick={() => void work(wallet ? disconnect : connect)}
        >
          {wallet
            ? `${shortHex(wallet.account)} · Disconnect wallet`
            : 'Connect wallet'}
        </button>
      </header>
      {error && (
        <p role='alert' className={styles.alert}>
          {error}
        </p>
      )}
      {status && (
        <p role='status' className={styles.status}>
          {busy ? 'Working · ' : ''}
          {status}
        </p>
      )}

      {tokenId === null ? (
        <section>
          <div className={styles.titleRow}>
            <h1 className={styles.h1}>Marketplace</h1>
          </div>
          <FilterBar
            filters={filters}
            onChange={(next) =>
              setFilters((previous) => ({ ...previous, ...next }))
            }
          />
          {listError && cards.length > 0 && (
            <p role='alert' className={styles.alert}>
              {listError}
            </p>
          )}
          <div className={styles.gridNote}>
            <span>
              {total !== undefined ? `${total.toLocaleString()} cards` : ''}
              {loading ? ' · loading…' : ''}
            </span>
          </div>
          <CardGrid
            cards={cards}
            loading={loading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            error={listError}
            onOpen={open}
            onLoadMore={loadMore}
            onRetry={() => {
              loadedKey.current = null;
              setFilters((previous) => ({ ...previous }));
            }}
          />
        </section>
      ) : detail ? (
        <CardDetailView
          detail={detail}
          orders={orders}
          config={config}
          address={wallet?.account}
          now={now}
          busy={busy}
          onBack={() => open(null)}
          onDialog={(state) => {
            setAskResult(null);
            setDialog(state);
          }}
          onShare={() => void share(detail.tokenId)}
        />
      ) : (
        <section>
          <div className={styles.detailTop}>
            <button
              type='button'
              className={`${styles.btn} ${styles.btnSmall}`}
              onClick={() => open(null)}
            >
              ⊞ All cards
            </button>
          </div>
          {detailLoading ? (
            <div className={styles.loader}>Loading card…</div>
          ) : (
            <div
              className={styles.emptyCard}
              style={{
                position: 'static',
                transform: 'none',
                margin: '48px auto',
              }}
            >
              <span>{detailError ?? 'Card not found.'}</span>
              <button
                type='button'
                className={styles.btn}
                onClick={() => void loadDetail(tokenId)}
              >
                Try again
              </button>
            </div>
          )}
        </section>
      )}

      {detail && dialog?.kind === 'buy' && (
        <BuyNowDialog
          card={detail}
          balance={balance}
          allowance={allowance}
          busy={busy}
          canSubmit={canSubmit}
          onClose={() => setDialog(null)}
          onConfirm={() => void work(() => buy(detail))}
        />
      )}
      {detail && dialog?.kind === 'offer' && (
        <MakeOfferDialog
          card={detail}
          balance={balance}
          allowance={allowance}
          busy={busy}
          canSubmit={canSubmit}
          onClose={() => setDialog(null)}
          onConfirm={(amount, seconds) =>
            void work(() => offer(detail, amount, seconds))
          }
          onBuyNow={() => setDialog({ kind: 'buy' })}
        />
      )}
      {detail && dialog?.kind === 'list' && (
        <ListCardDialog
          card={detail}
          orders={orders}
          mode={dialog.mode}
          feeBps={feeBps}
          result={askResult}
          busy={busy}
          canSubmit={canSubmit}
          onClose={() => setDialog(null)}
          onConfirm={(receive) => void work(() => list(detail, receive))}
        />
      )}
      {detail && dialog?.kind === 'unlist' && (
        <UnlistDialog
          card={detail}
          askOrderId={askOrderId}
          busy={busy}
          canSubmit={canSubmit}
          onClose={() => setDialog(null)}
          onConfirm={() =>
            void work(async () => {
              if (!askOrderId)
                throw new Error('No active ask order to cancel.');
              await cancelOrder(detail, askOrderId, 'ask');
            })
          }
        />
      )}
      {detail && dialog?.kind === 'accept' && (
        <AcceptOfferDialog
          card={detail}
          bid={dialog.bid}
          feeBps={feeBps}
          busy={busy}
          canSubmit={canSubmit}
          onClose={() => setDialog(null)}
          onConfirm={() => void work(() => accept(detail, dialog.bid))}
        />
      )}
      {detail && dialog?.kind === 'cancel-bid' && (
        <CancelBidDialog
          card={detail}
          bid={dialog.bid}
          busy={busy}
          canSubmit={canSubmit}
          onClose={() => setDialog(null)}
          onConfirm={() =>
            void work(() => cancelOrder(detail, dialog.bid.id, 'offer'))
          }
        />
      )}

      <DeveloperPanel
        wireBase={browserBaseUrl}
        tokenId={tokenId}
        responses={responses}
        log={log}
      />
    </main>
  );
}
