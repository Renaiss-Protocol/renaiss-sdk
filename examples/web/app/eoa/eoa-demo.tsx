'use client';

import {
  createGachaClient,
  currentBuybackTier,
  type EoaBuybackOffer,
  type EoaBuybackTier,
  type EoaMachine,
  type EoaMachineBuybackTier,
  type EoaMachineContent,
  type EoaMachineDetail,
  type EoaMachineTier,
  type EoaPull,
  type EoaResolvedPull,
  type EoaStreamEvent,
  type GachaPullHistoryEntry,
  getError,
  getValue,
  isFailed,
  type Result,
} from '@renaiss-protocol/client';
import { signerFrom } from '@renaiss-protocol/client/viem';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  custom,
  type EIP1193Provider,
  erc20Abi,
  http,
} from 'viem';
import { connectWallet } from '../connect-wallet';
import { demoNetwork } from '../demo-network';
import { switchToDemoChain, walletSelectionChanged } from '../wallet-network';
import { createWalletScope } from '../wallet-scope';
import {
  DeveloperPanel,
  type LogEntry,
  type StreamLogEntry,
} from './developer-panel';
import styles from './eoa.module.css';
import {
  chance,
  countdown,
  explorerTx,
  isVideo,
  packTypeLabel,
  shortHex,
  stageLabel,
  tierColor,
  tierLabel,
  tierRange,
  usd,
  usdt,
  windowLabel,
} from './format';
import { assertPullNetwork } from './network-guard';
import { PendingPull } from './pending-pull';
import {
  type PullJournal as Journal,
  type RecoveryState,
  watchPendingPull,
} from './pull-recovery';

/*
 * Gacha demo: machine list and detail, the pull flow with streamed reveal,
 * wallet history and buyback offers. The Developer section maps each API field
 * to where this demo uses it.
 */

const CHAIN_ID = demoNetwork.chain.id;
const USDT = demoNetwork.network.marketplace.contracts.usdt;
const QUANTITIES = [1, 5, 10] as const;
type Quantity = 1 | 5 | 10;
const PULL_FEED_LIMIT = 30;
const CONTENT_PAGE = 100;

const reader = createGachaClient({
  network: demoNetwork.network,
  baseUrl: '/api/renaiss',
  expectedChainId: CHAIN_ID,
});
const rpc = createPublicClient({ chain: demoNetwork.chain, transport: http() });

const journalKey = `renaiss:eoa-demo:${CHAIN_ID}:${process.env.NEXT_PUBLIC_RENAISS_API_URL ?? 'local'}:pending`;

type Rip =
  | { phase: 'idle' }
  | { phase: 'working'; label: string }
  | { phase: 'revealed'; pull: EoaResolvedPull; machine: EoaMachineDetail };
type Decision = 'kept' | 'sold';
type Tier = EoaMachineTier;

function unwrap<T>(result: Result<T>): T {
  if (isFailed(result)) {
    const e = getError(result);
    throw new Error(`${e.code}: ${e.detail}`);
  }
  return getValue(result);
}
function injected() {
  const provider = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
  if (!provider)
    throw new Error(
      'Open this demo in a browser with an EVM wallet extension.',
    );
  return provider;
}
function tiersHighestFirst(machine: EoaMachineDetail): Tier[] {
  return [...machine.tiers].sort((a, b) => b.tier - a.tier);
}
/** The highest price in the machine's catalog. */
function topPrize(machine: EoaMachineDetail) {
  const highest = tiersHighestFirst(machine)[0];
  return highest
    ? { label: 'Catalog max', value: highest.priceRangeInUsd.max }
    : null;
}
/** The headline "Instant buyback" percentage: the best tier, or null without buyback. */
function headlineBuybackPercentage(
  config: EoaMachineBuybackTier[],
): number | null {
  if (config.length === 0) return null;
  return Math.max(...config.map((tier) => tier.buybackPercentage));
}
/** How long a new pull can be sold back: the latest tier end, or null without buyback. */
function buybackWindowSeconds(config: EoaMachineBuybackTier[]): number | null {
  if (config.length === 0) return null;
  return Math.max(...config.map((tier) => tier.buybackExpiredInSeconds));
}
function buybackPercentageText(config: EoaMachineBuybackTier[]) {
  const percentage = headlineBuybackPercentage(config);
  return percentage === null ? 'None' : `${percentage}%`;
}
function stageText(event: EoaStreamEvent) {
  switch (event.event) {
    case 'pull_started':
      return 'Open pack starting...';
    case 'payment_queued':
    case 'payment_submitting':
      return 'Submitting transaction...';
    case 'payment_confirmed':
      return 'Open pack in progress';
    case 'draws_resolved':
      return 'Draw resolved';
    default:
      return event.data.message;
  }
}
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function EoaDemo() {
  const [machines, setMachines] = useState<EoaMachine[]>([]);
  const [details, setDetails] = useState<Record<string, EoaMachineDetail>>({});
  const [slug, setSlug] = useState<string | null>(null);
  const [machine, setMachine] = useState<EoaMachineDetail>();
  const [contents, setContents] = useState<EoaMachineContent[]>([]);
  const [contentTotal, setContentTotal] = useState<number>();
  const [contentDone, setContentDone] = useState(false);
  const [contentFailed, setContentFailed] = useState(false);
  const [tierFilter, setTierFilter] = useState<string>();
  const [feed, setFeed] = useState<GachaPullHistoryEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [quantity, setQuantity] = useState<Quantity>(1);
  const [address, setAddress] = useState<Address>();
  // Identifies the connected wallet; results for an older one are dropped.
  const [scope] = useState(createWalletScope);
  const [walletGeneration, setWalletGeneration] = useState(0);
  const [historyWallet, setHistoryWallet] = useState<Address>();
  const [history, setHistory] = useState<EoaPull[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string>();
  const [offers, setOffers] = useState<EoaBuybackOffer[]>([]);
  const [journal, setJournal] = useState<Journal>();
  const [hashInput, setHashInput] = useState('');
  const journalRef = useRef<Journal | undefined>(undefined);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>('waiting');
  const [recoveryRun, setRecoveryRun] = useState(0);
  const [acknowledgeClear, setAcknowledgeClear] = useState(false);
  const [rip, setRip] = useState<Rip>({ phase: 'idle' });
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const now = useNow(offers.length > 0 || rip.phase === 'revealed');

  const record = useCallback((label: string, value: unknown) => {
    setResponses((previous) => ({ ...previous, [label]: value }));
  }, []);
  const note = useCallback((text: string) => {
    setStatus(text);
    setLog((previous) => [
      { at: new Date().toISOString(), text },
      ...previous.slice(0, 199),
    ]);
  }, []);
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
      if (journalRef.current) {
        setRecoveryState('unavailable');
        note(
          'Your pull is saved. Check its status before opening another pack.',
        );
        record('Interrupted pull operation', {
          at: new Date().toISOString(),
          detail: message,
        });
      } else {
        note(`Error: ${message}`);
      }
      setRip((current) =>
        current.phase === 'working' ? { phase: 'idle' } : current,
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const saveJournal = useCallback((value?: Journal) => {
    // Persist before continuing: a pull must never start without a journal entry.
    if (value) localStorage.setItem(journalKey, JSON.stringify(value));
    else localStorage.removeItem(journalKey);
    journalRef.current = value;
    setJournal(value);
    setHashInput(value?.hash ?? '');
    setAcknowledgeClear(false);
  }, []);
  function open(next: string | null) {
    setSlug(next);
    const url = next
      ? `?machine=${encodeURIComponent(next)}`
      : window.location.pathname;
    window.history.replaceState(null, '', url);
  }

  // Machine list, per-machine detail (the list route lacks tiers and buyback),
  // saved journal and deep link.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const all: EoaMachine[] = [];
        for await (const page of reader.listGachaMachines({ pageSize: 100 }))
          all.push(...unwrap(page).items);
        if (!active) return;
        setMachines(all);
        record('GET /v2/gacha/packs', all);
        const saved = localStorage.getItem(journalKey);
        if (saved) {
          const value: Journal = JSON.parse(saved);
          journalRef.current = value;
          setJournal(value);
          setHashInput(value.hash ?? '');
        }
        const wanted = new URLSearchParams(window.location.search).get(
          'machine',
        );
        if (wanted && all.some((m) => m.slug === wanted)) setSlug(wanted);
        const results = await Promise.all(
          all
            .filter((m) => m.stage === 'active')
            .map(
              async (m) =>
                [
                  m.slug,
                  await reader.fetchGachaMachine({ slug: m.slug }),
                ] as const,
            ),
        );
        if (!active) return;
        const map: Record<string, EoaMachineDetail> = {};
        for (const [key, result] of results)
          if (!isFailed(result)) map[key] = getValue(result);
        setDetails(map);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [record]);

  // Detail page data: machine, first content page, public pull-history feed.
  useEffect(() => {
    if (!slug) return;
    let active = true;
    setMachine(undefined);
    setContents([]);
    setContentTotal(undefined);
    setContentDone(false);
    setContentFailed(false);
    setTierFilter(undefined);
    setFeed([]);
    setExpanded(false);
    void (async () => {
      const detail = await reader.fetchGachaMachine({ slug });
      if (!active) return;
      try {
        const m = unwrap(detail);
        setMachine(m);
        setTierFilter(tiersHighestFirst(m)[0]?.name);
        record('GET /v2/gacha/packs/{slug}', m);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    void (async () => {
      const pulls = await reader
        .listGachaPullHistory({ slug, pageSize: PULL_FEED_LIMIT })
        .firstPage();
      if (!active) return;
      try {
        const feedPage = unwrap(pulls);
        setFeed(feedPage.items);
        record('GET /v2/gacha/packs/{slug}/pull-history', feedPage);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    // Every catalog page is streamed in and the tier filter is applied locally.
    void (async () => {
      try {
        for await (const result of reader.listGachaMachineContents({
          slug,
          pageSize: CONTENT_PAGE,
        })) {
          if (!active) return;
          const page = unwrap(result);
          setContents((previous) => [...previous, ...page.items]);
          setContentTotal(page.totalCount);
          record('GET /v2/gacha/packs/{slug}/content', page);
        }
      } catch (e) {
        if (active) {
          setContentFailed(true);
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (active) setContentDone(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug, record]);

  // Forget everything shown for the connected wallet and invalidate its
  // in-flight requests. The recovery journal is persistence and is kept.
  const clearWalletState = useCallback(() => {
    scope.clear();
    setWalletGeneration(scope.generation());
    setAddress(undefined);
    setOffers([]);
    setHistory([]);
    setHistoryWallet(undefined);
    setHistoryCursor(undefined);
    setDecisions({});
    setEvents([]);
    setRip({ phase: 'idle' });
    setResponses({});
  }, [scope]);

  useEffect(() => {
    const provider = (
      window as Window & {
        ethereum?: EIP1193Provider & {
          on?: (event: string, cb: (value: unknown) => void) => void;
          removeListener?: (
            event: string,
            cb: (value: unknown) => void,
          ) => void;
        };
      }
    ).ethereum;
    function changed() {
      clearWalletState();
      setStatus(
        'Wallet changed. Connect again to continue. A pending pull stays recoverable.',
      );
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
  }, [clearWalletState, scope]);

  async function wallet(expected = address) {
    const client = createWalletClient({
      chain: demoNetwork.chain,
      transport: custom(injected()),
    });
    const [account] = await client.getAddresses();
    if (
      !account ||
      (expected && account.toLowerCase() !== expected.toLowerCase())
    )
      throw new Error('Connect the selected wallet before continuing.');
    if ((await client.getChainId()) !== CHAIN_ID)
      throw new Error(
        `Switch your wallet to ${demoNetwork.label} (${CHAIN_ID}).`,
      );
    return {
      client,
      account,
      sdk: createGachaClient({
        network: demoNetwork.network,
        baseUrl: '/api/renaiss',
        expectedChainId: CHAIN_ID,
        signer: signerFrom(
          createWalletClient({
            account,
            chain: demoNetwork.chain,
            transport: custom(injected()),
          }),
        ),
      }),
    };
  }
  const refresh = useCallback(
    async (
      buyer: Address,
      cursor?: string,
      isActive: () => boolean = () => true,
    ) => {
      // No request for a wallet that is not connected.
      const token = scope.token(buyer);
      if (!token) return;
      const [h, o] = await Promise.all([
        reader
          .listWalletPulls({ buyerWalletAddress: buyer })
          .from(cursor)
          .firstPage(),
        reader.fetchGachaBuybackOffers({ buyerWalletAddress: buyer }),
      ]);
      const page = unwrap(h);
      const offered = unwrap(o);
      // Ignore a response for a wallet or chain that has changed meanwhile.
      if (!isActive() || !scope.isCurrent(token)) return;
      setHistoryWallet(buyer);
      setHistory((previous) =>
        cursor ? [...previous, ...page.items] : page.items,
      );
      setHistoryCursor(page.nextCursor);
      setOffers(offered);
      record('GET /v2/gacha/pull-history?buyerWalletAddress', page);
      record('GET /v2/gacha/buyback/offers', offered);
    },
    [record, scope],
  );
  const canCheckPending =
    !!journal &&
    !!address &&
    address.toLowerCase() === journal.buyerWalletAddress.toLowerCase();
  useEffect(() => {
    if (!journal?.hash || !canCheckPending || busy || rip.phase === 'working')
      return;
    const fundingHash = journal.hash;
    const walletToken = scope.token(journal.buyerWalletAddress);
    if (!walletToken) return;
    let active = true;
    const stop = watchPendingPull({
      journal,
      check: async () => {
        if (!scope.isCurrent(walletToken)) throw new Error('Wallet changed.');
        return unwrap(
          await reader.fetchGachaDrawStatus({
            buyerWalletAddress: journal.buyerWalletAddress,
            permitFundTxHash: fundingHash,
          }),
        );
      },
      onState: setRecoveryState,
      onDiagnostic: (error) => {
        if (!scope.isCurrent(walletToken)) return;
        record('Pending pull status check', {
          at: new Date().toISOString(),
          recoveryRun,
          detail: error instanceof Error ? error.message : String(error),
        });
      },
      onResolved: async (pull) => {
        if (!active || !scope.isCurrent(walletToken)) return;
        record('GET /v2/gacha/draw-status', pull);
        try {
          await refresh(journal.buyerWalletAddress, undefined, () => active);
        } catch (error) {
          if (!active) return;
          record('Recovered pull history refresh', {
            at: new Date().toISOString(),
            detail: error instanceof Error ? error.message : String(error),
          });
        }
        if (!active || !scope.isCurrent(walletToken)) return;
        // Status already confirms the result even if the history index lags.
        setHistoryWallet(journal.buyerWalletAddress);
        setHistory((previous) => [
          pull,
          ...previous.filter(
            (item) =>
              item.permitFundTxHash.toLowerCase() !==
              pull.permitFundTxHash.toLowerCase(),
          ),
        ]);
        saveJournal();
        setError('');
        note('Your previous pull is complete. You can open another pack.');
      },
    });
    return () => {
      active = false;
      stop();
    };
  }, [
    journal,
    canCheckPending,
    busy,
    rip.phase,
    recoveryRun,
    record,
    refresh,
    saveJournal,
    note,
    scope,
  ]);

  async function disconnect() {
    clearWalletState();
    note('Wallet disconnected. A pending pull stays recoverable.');
  }

  async function connect() {
    const provider = injected();
    const token = await connectWallet({
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
        const client = createWalletClient({
          chain: demoNetwork.chain,
          transport: custom(provider),
        });
        const [account] = await client.getAddresses();
        return { account, chainId: await client.getChainId() };
      },
      publish(published, account) {
        setWalletGeneration(published.generation);
        setAddress(account as Address);
        note(`Connected ${shortHex(account)} on ${demoNetwork.label}.`);
      },
    });
    await refresh(token.address as Address);
  }

  async function ripPack() {
    if (!machine || !slug) return;
    if (journal)
      throw new Error('Reconcile the pending pull before ripping again.');
    // Display updates and new requests stop once this wallet is gone. After the
    // journal entry is saved the purchase itself always runs to completion.
    const walletToken = scope.token();
    if (!walletToken) throw new Error('Connect a wallet first.');
    const live = () => scope.isCurrent(walletToken);
    function assertLive() {
      if (!live())
        throw new Error('Wallet changed. Connect again to continue.');
    }
    function working(label: string) {
      if (live()) setRip({ phase: 'working', label });
    }
    working('Preparing transaction...');
    setEvents([]);
    const expected = {
      packId: machine.id,
      onChainPackId: machine.onChainPackId,
      priceInUsdt: BigInt(machine.priceInUsdt),
      quantity,
    };
    const w = await wallet();
    assertLive();
    const preparation = await w.sdk.prepareGachaPull({
      buyerWalletAddress: w.account,
      machineSlug: slug,
      expectedPriceInUsdt: expected.priceInUsdt,
      quantity,
    });
    if (
      isFailed(preparation) &&
      getError(preparation).code === 'GACHA_PRICE_CHANGED'
    ) {
      const refreshed = await reader.fetchGachaMachine({ slug });
      if (!isFailed(refreshed)) setMachine(getValue(refreshed));
    }
    const prepared = unwrap(preparation);
    assertLive();
    record('POST /v2/gacha/pull/prepare', prepared);
    assertPullNetwork(prepared, demoNetwork.network);
    note(
      `Prepared nonce ${prepared.unsignedPullPayload.nonce}; signature valid until ${new Date(prepared.unsignedPullPayload.deadline * 1000).toLocaleTimeString()}.`,
    );
    const { token, spender } = prepared.approval;
    assertLive();
    const required = BigInt(prepared.approval.requiredAmount);
    const balance = await rpc.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [w.account],
    });
    if (balance < required)
      throw new Error(
        `Insufficient ${demoNetwork.tokenLabel}: need ${usdt(required)}, wallet has ${usdt(balance)}.`,
      );
    const allowance = await rpc.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [w.account, spender],
    });
    if (allowance < required) {
      for (const value of allowance > 0n ? [0n, required] : [required]) {
        await wallet(w.account);
        assertLive();
        working('Approving USDT for Permit2...');
        const hash = await w.client.writeContract({
          account: w.account,
          address: token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [spender, value],
        });
        const receipt = await rpc.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success')
          throw new Error('Token approval reverted.');
        note(`Approved ${usdt(value)} USDT to Permit2 (${shortHex(hash)}).`);
      }
    }
    await wallet(w.account);
    assertLive();
    working('Confirm the pack purchase in your wallet…');
    const signed = unwrap(await w.sdk.signGachaPull({ prepared, expected }));
    const pending: Journal = {
      buyerWalletAddress: w.account,
      packId: signed.packId,
      packSlug: slug,
      nonce: signed.nonce,
      quantity,
      submittedAt: new Date().toISOString(),
    };
    saveJournal(pending);
    working('Submitting transaction...');
    let confirmedFailure: string | undefined;
    const result = await w.sdk.submitGachaPull({
      pull: signed,
      onEvent(event) {
        if (event.event === 'pull_failed') confirmedFailure = event.data.error;
        if ('permitFundTxHash' in event.data && event.data.permitFundTxHash) {
          pending.hash = event.data.permitFundTxHash;
          saveJournal({ ...pending });
        }
        if (!live()) return;
        setEvents((previous) => [
          ...previous,
          { at: new Date().toISOString(), event },
        ]);
        working(stageText(event));
      },
    });
    if (live()) record('POST /v2/gacha/pull/stream (result)', result);
    if (isFailed(result)) {
      if (live()) setRip({ phase: 'idle' });
      const failure = getError(result);
      setError(
        confirmedFailure
          ? `Pack opening failed: ${confirmedFailure}`
          : `${failure.code} (${failure.status}): ${failure.detail}`,
      );
      const context = failure.error;
      if (
        context &&
        typeof context === 'object' &&
        'rejectedBeforeStream' in context &&
        context.rejectedBeforeStream === true &&
        !pending.hash
      ) {
        saveJournal();
        note(
          'The request was rejected before payment started. Review the error before trying again.',
        );
      } else {
        setRecoveryState('waiting');
        note(
          pending.hash
            ? 'Your pull is saved. We will check its status before opening another pack.'
            : 'Your pull is saved. Find its funding transaction in your token-transfer history on the explorer before trying another purchase.',
        );
      }
      return;
    }
    const resolved = getValue(result);
    saveJournal();
    if (!live()) {
      note(
        'A pull started by the previous wallet has finished. Connect that wallet to see the result.',
      );
      return;
    }
    setDecisions({});
    setRip({ phase: 'revealed', pull: resolved, machine });
    note(
      `Resolved ${resolved.draws.length} card(s); funding ${shortHex(resolved.permitFundTxHash)}.`,
    );
    await refresh(w.account);
  }

  async function checkPending() {
    if (!journal || !canCheckPending)
      throw new Error('Connect the wallet that started this pull.');
    if (!/^0x[0-9a-fA-F]{64}$/.test(hashInput))
      throw new Error(
        'Enter the funding transaction hash from your token-transfer history on the explorer.',
      );
    if (journal.hash && journal.hash.toLowerCase() !== hashInput.toLowerCase())
      throw new Error(
        'The entered hash differs from the saved funding transaction.',
      );
    if (!journal.hash) saveJournal({ ...journal, hash: hashInput });
    setRecoveryRun((value) => value + 1);
  }

  async function sell(targets: EoaBuybackOffer[]) {
    if (targets.length === 0)
      throw new Error('No offer to sell yet. Refresh offers.');
    const w = await wallet();
    if (w.account.toLowerCase() !== historyWallet?.toLowerCase())
      throw new Error('Connect the wallet that owns these offers.');
    const walletToken = scope.token(w.account);
    if (!walletToken)
      throw new Error('Connect the wallet that owns these offers.');
    // Offers omit token and chain, so use the configured deployment.
    const signed = unwrap(
      await w.sdk.createGachaBuyback({
        buyerWalletAddress: w.account,
        chainId: CHAIN_ID,
        token: USDT,
        offers: targets,
      }),
    );
    const result = unwrap(await w.sdk.submitGachaBuyback(signed));
    if (!scope.isCurrent(walletToken)) {
      note(
        'A sale from the previous wallet has finished. Connect that wallet to see the result.',
      );
      return;
    }
    record('POST /v2/gacha/buyback', result);
    setDecisions((previous) => {
      const next = { ...previous };
      for (const offer of targets) next[offer.settlementId] = 'sold';
      return next;
    });
    note(
      `Successfully sold ${result.itemCount} card(s) for $${usdt(result.totalAmountInUsdt)} (${shortHex(result.txHash)}).`,
    );
    await refresh(w.account);
  }

  const total = machine
    ? (BigInt(machine.priceInUsdt) * BigInt(quantity)).toString()
    : '0';
  const ripLabel =
    rip.phase === 'working'
      ? rip.label
      : !address
        ? 'Connect Wallet'
        : journal
          ? 'Pending pull · check status'
          : machine?.stage !== 'active'
            ? 'Sold Out'
            : quantity > 1
              ? `Rip ${quantity} Packs for $${usdt(total)}`
              : `Rip a Pack for $${usdt(total)}`;
  const ripDisabled =
    busy ||
    rip.phase === 'working' ||
    !machine ||
    (!!address && !journal && machine.stage !== 'active');

  const activeMachines = machines.filter((m) => m.stage === 'active');
  const limited = activeMachines.filter((m) => m.packType === 'v3-limited');
  const infinite = activeMachines.filter((m) => m.packType !== 'v3-limited');
  const archived = machines.length - activeMachines.length;

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.eyebrow}>Renaiss SDK · /v2/gacha · EOA</span>
          <span className={`${styles.muted} ${styles.small}`}>
            Browse machines, pull, and read results through the SDK.
          </span>
        </div>
        <button
          type='button'
          className={`${styles.btn} ${address ? '' : styles.btnSolid}`}
          disabled={busy}
          onClick={() => void work(address ? disconnect : connect)}
        >
          {address
            ? `${shortHex(address)} · Disconnect wallet`
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

      {journal && (
        <PendingPull
          journal={journal}
          processing={rip.phase === 'working'}
          progress={rip.phase === 'working' ? rip.label : undefined}
          recoveryState={recoveryState}
          canCheck={canCheckPending && !busy}
          hashInput={hashInput}
          onHashInput={setHashInput}
          onCheck={() => void work(checkPending)}
        />
      )}

      {slug === null ? (
        <MachineList
          limited={limited}
          infinite={infinite}
          archived={archived}
          details={details}
          loading={machines.length === 0 && !error}
          onOpen={open}
        />
      ) : (
        <section>
          {feed.length > 0 && machine && (
            <div className={styles.ticker}>
              <span
                className={styles.tickerLabel}
                title={pullFeedHint(machine.buybackConfig)}
              >
                Pull history ⓘ
              </span>
              <div className={styles.tickerItems}>
                {feed.map((entry) => (
                  <div key={entry.tokenId} className={styles.tickerItem}>
                    <Image
                      width={32}
                      height={46}
                      className={styles.tickerThumb}
                      src={entry.frontImageUrl}
                      alt={entry.name}
                      title={entry.name}
                    />
                    <div>
                      <div
                        className={styles.tierName}
                        style={{ color: tierColor(entry.tier) }}
                      >
                        {tierLabel(entry.tier)}
                      </div>
                      <span className={styles.chip}>
                        <span className={styles.chipKey}>
                          Buyback base value
                        </span>
                        ${usd(entry.buybackBaseValueInUsd)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className={styles.columns}>
            <div className={styles.breakdown}>
              {machine ? (
                <TierPills
                  tiers={tiersHighestFirst(machine)}
                  selected={tierFilter}
                  onSelect={setTierFilter}
                />
              ) : (
                <p className={styles.muted}>Loading machine…</p>
              )}
              <ContentGrid
                machine={machine}
                contents={contents}
                total={contentTotal}
                tier={tierFilter}
                highest={
                  machine ? tiersHighestFirst(machine)[0]?.name : undefined
                }
                loading={!contentDone}
                failed={contentFailed}
              />
            </div>
            <aside className={styles.panel}>
              <div className={styles.panelTop}>
                <button
                  type='button'
                  className={`${styles.btn} ${styles.btnSmall}`}
                  onClick={() => open(null)}
                >
                  ⊞ All gacha
                </button>
              </div>
              <div className={styles.mediaWrap}>
                <Media
                  src={machine?.gachaMachineVideoUrl ?? null}
                  className={styles.media}
                  sizes='(max-width: 460px) 100vw, 420px'
                  priority
                />
                {machine && (
                  <span className={`${styles.livePill} ${styles.stagePill}`}>
                    {stageLabel(machine.stage)}
                  </span>
                )}
              </div>
              {machine && (
                <>
                  <div className={styles.packHead}>
                    <h1 className={styles.packName}>{machine.name}</h1>
                    <div className={styles.packPrice}>
                      <span className={styles.priceLine}>
                        <span className={styles.price}>
                          ${usdt(machine.priceInUsdt)}
                        </span>
                        <span className={styles.perPack}>/pack</span>
                      </span>
                      <span
                        className={styles.chip}
                        title='activeSetExpectedValueInUsd: mean card value across the whole set, drawn cards included'
                      >
                        <span className={styles.chipKey}>Set EV</span>$
                        {usd(machine.activeSetExpectedValueInUsd)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.stats}>
                    <div className={styles.statCell}>
                      <div className={styles.statLabel}>Pack contains</div>
                      <div className={styles.statValue}>1 Card</div>
                    </div>
                    <div className={styles.statCell}>
                      <div className={styles.statLabel}>Instant buyback</div>
                      <div className={styles.statValue}>
                        {buybackPercentageText(machine.buybackConfig)}
                      </div>
                    </div>
                  </div>
                  <div className={styles.buyRow}>
                    <div className={styles.stepper}>
                      <button
                        type='button'
                        className={styles.stepBtn}
                        aria-label='Fewer packs'
                        disabled={
                          quantity === QUANTITIES[0] || rip.phase === 'working'
                        }
                        onClick={() =>
                          setQuantity(
                            QUANTITIES[
                              Math.max(0, QUANTITIES.indexOf(quantity) - 1)
                            ] ?? quantity,
                          )
                        }
                      >
                        −
                      </button>
                      <span className={styles.stepValue}>{quantity}x</span>
                      <button
                        type='button'
                        className={styles.stepBtn}
                        aria-label='More packs'
                        disabled={
                          quantity === QUANTITIES[QUANTITIES.length - 1] ||
                          rip.phase === 'working'
                        }
                        onClick={() =>
                          setQuantity(
                            QUANTITIES[
                              Math.min(
                                QUANTITIES.length - 1,
                                QUANTITIES.indexOf(quantity) + 1,
                              )
                            ] ?? quantity,
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                    <button
                      type='button'
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      disabled={ripDisabled}
                      onClick={() =>
                        void work(
                          !address ? connect : journal ? checkPending : ripPack,
                        )
                      }
                    >
                      {ripLabel}
                    </button>
                  </div>
                  <div className={styles.packInfo}>
                    <span className={`${styles.muted} ${styles.small}`}>
                      Pack info
                    </span>
                    <p
                      className={`${styles.desc} ${expanded ? '' : styles.descClamped}`}
                    >
                      {machine.description || 'No description.'}
                    </p>
                    {machine.description.length > 160 && (
                      <button
                        type='button'
                        className={styles.linkBtn}
                        onClick={() => setExpanded((v) => !v)}
                      >
                        {expanded ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </aside>
          </div>
          {historyWallet && (
            <YourPulls
              wallet={historyWallet}
              connected={address}
              pulls={history}
              offers={offers}
              machines={machines}
              now={now}
              busy={busy}
              canLoadMore={!!historyCursor}
              onRefresh={() => void work(() => refresh(historyWallet))}
              onLoadMore={() =>
                void work(() => refresh(historyWallet, historyCursor))
              }
              onSell={(offer) => void work(() => sell([offer]))}
            />
          )}
        </section>
      )}

      {rip.phase === 'revealed' && (
        <Reveal
          pull={rip.pull}
          machine={rip.machine}
          offers={offers}
          decisions={decisions}
          now={now}
          busy={busy}
          onKeep={(id) => setDecisions((d) => ({ ...d, [id]: 'kept' }))}
          onSell={(targets) => void work(() => sell(targets))}
          onRefreshOffers={() =>
            void work(() => refresh(rip.pull.buyerWalletAddress))
          }
          onClose={() => setRip({ phase: 'idle' })}
        />
      )}

      <DeveloperPanel
        slug={slug}
        wallet={historyWallet}
        scope={scope}
        walletGeneration={walletGeneration}
        responses={responses}
        events={events}
        log={log}
        recovery={
          journal && (
            <div>
              <p>
                Saved attempt: {journal.quantity}× {journal.packSlug}, started{' '}
                {new Date(journal.submittedAt).toLocaleString()}.
              </p>

              <p>
                Clearing removes only this browser's recovery record. It does
                not cancel a purchase or refund a payment.
              </p>
              <label>
                <input
                  type='checkbox'
                  checked={acknowledgeClear}
                  onChange={(event) =>
                    setAcknowledgeClear(event.target.checked)
                  }
                />
                I have checked the transaction and confirmed its outcome.
              </label>
              <button
                type='button'
                className={`${styles.btn} ${styles.btnSmall}`}
                disabled={
                  busy ||
                  rip.phase === 'working' ||
                  recoveryState === 'checking' ||
                  !acknowledgeClear
                }
                onClick={() => {
                  saveJournal();
                  note('Local recovery record cleared.');
                }}
              >
                Clear local recovery record
              </button>
            </div>
          )
        }
      />
    </main>
  );
}

function Media({
  src,
  className,
  sizes,
  priority,
}: {
  src: string | null;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  if (!src) return <div className={className} />;
  if (isVideo(src))
    return (
      <video className={className} src={src} autoPlay muted loop playsInline />
    );
  return (
    <Image
      className={className}
      src={src}
      alt=''
      width={640}
      height={640}
      sizes={sizes}
      priority={priority}
    />
  );
}

function MachineList({
  limited,
  infinite,
  archived,
  details,
  loading,
  onOpen,
}: {
  limited: EoaMachine[];
  infinite: EoaMachine[];
  archived: number;
  details: Record<string, EoaMachineDetail>;
  loading: boolean;
  onOpen: (slug: string) => void;
}) {
  return (
    <section>
      <div className={styles.overviewHead}>
        <h1 className={styles.h1}>Gacha</h1>
        <p className={styles.muted}>
          Browse every live gacha at a glance — pick one to see its whole-set
          tier percentages, contents and rip options.
        </p>
      </div>
      {loading && <p className={styles.muted}>Loading machines…</p>}
      <h2 className={styles.sectionTitle}>
        Limited Gacha
        <span className={`${styles.countBubble} ${styles.muted}`}>
          Gacha Archive {archived}
        </span>
      </h2>
      <div className={styles.grid2}>
        {limited.map((m) => (
          <MachineCard
            key={m.id}
            machine={m}
            detail={details[m.slug]}
            hero
            onOpen={onOpen}
          />
        ))}
      </div>
      <h2 className={styles.sectionTitle}>
        Infinite Gacha{' '}
        <span className={styles.countBubble}>{infinite.length}</span>
      </h2>
      <div className={styles.grid2}>
        {infinite.map((m) => (
          <MachineCard
            key={m.id}
            machine={m}
            detail={details[m.slug]}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  );
}

function MachineCard({
  machine,
  detail,
  hero,
  onOpen,
}: {
  machine: EoaMachine;
  detail?: EoaMachineDetail;
  hero?: boolean;
  onOpen: (slug: string) => void;
}) {
  const highest = detail ? tiersHighestFirst(detail)[0] : undefined;
  const prize = detail ? topPrize(detail) : null;
  return (
    <button
      type='button'
      className={styles.machineCard}
      onClick={() => onOpen(machine.slug)}
    >
      {hero && machine.packBannerVideoUrl && (
        <Media
          src={machine.packBannerVideoUrl}
          className={styles.heroBg}
          sizes='(max-width: 760px) 100vw, 50vw'
        />
      )}
      <div className={styles.cardTop}>
        <span className={styles.badge}>
          {machine.packType === 'v3-limited' ? '⚡' : '∞'}{' '}
          {packTypeLabel(machine.packType)}
        </span>
        <span className={styles.livePill}>{stageLabel(machine.stage)}</span>
      </div>
      <div className={styles.cardHead}>
        <Media
          src={machine.gachaMachineVideoUrl}
          className={styles.thumb}
          sizes='84px'
        />
        <div>
          <div className={styles.cardName}>{machine.name}</div>
          <div className={styles.priceLine}>
            <span className={styles.price}>${usdt(machine.priceInUsdt)}</span>
            <span className={styles.perPack}>/pack</span>
            <span
              className={styles.chip}
              title='activeSetExpectedValueInUsd: mean card value across the whole set, drawn cards included'
            >
              <span className={styles.chipKey}>Set EV</span>
              {detail ? (
                `$${usd(detail.activeSetExpectedValueInUsd)}`
              ) : (
                <span className={styles.missing}>…</span>
              )}
            </span>
          </div>
        </div>
      </div>
      <div className={styles.stats}>
        <div className={styles.statCell}>
          <div className={styles.statLabel}>
            {prize?.label ?? 'Catalog max'}
          </div>
          <div className={styles.statValue}>
            {prize ? (
              `$${usd(prize.value, 0)}`
            ) : (
              <span className={styles.missing}>…</span>
            )}
          </div>
        </div>
        <div className={styles.statCell}>
          <div className={styles.statLabel}>Instant buyback</div>
          <div className={styles.statValue}>
            {detail ? (
              buybackPercentageText(detail.buybackConfig)
            ) : (
              <span className={styles.missing}>…</span>
            )}
          </div>
        </div>
      </div>
      {highest && (
        <div className={styles.tierLine}>
          <span
            className={styles.tierPillChip}
            style={{ background: tierColor(highest.name) }}
          >
            {tierLabel(highest.name)}
          </span>
          {tierRange(
            highest.priceRangeInUsd.min,
            highest.priceRangeInUsd.max,
            true,
          )}
        </div>
      )}
    </button>
  );
}

function TierPills({
  tiers,
  selected,
  onSelect,
}: {
  tiers: Tier[];
  selected?: string;
  onSelect: (name: string) => void;
}) {
  return (
    <div>
      <div className={styles.tierPills}>
        {tiers.map((tier, index) => {
          const active = tier.name === selected;
          const color = tierColor(tier.name);
          return (
            <button
              type='button'
              key={tier.name}
              className={`${styles.tierPill} ${active ? styles.tierPillActive : ''}`}
              style={
                active ? { background: color, borderColor: color } : undefined
              }
              onClick={() => onSelect(tier.name)}
            >
              <span className={styles.tierPillTop}>
                <span
                  className={styles.dot}
                  style={{ background: active ? '#111' : color }}
                />
                {tierLabel(tier.name)}
              </span>
              <span className={`${styles.small} ${styles.muted}`}>
                {tierRange(
                  tier.priceRangeInUsd.min,
                  tier.priceRangeInUsd.max,
                  index === 0,
                )}{' '}
                {chance(tier.chance)}
              </span>
            </button>
          );
        })}
      </div>
      <p className={`${styles.small} ${styles.muted}`}>
        Percentages are each tier's share of the whole set, drawn cards
        included.
      </p>
    </div>
  );
}

function ContentGrid({
  machine,
  contents,
  total,
  tier,
  highest,
  loading,
  failed,
}: {
  machine?: EoaMachineDetail;
  contents: EoaMachineContent[];
  total?: number;
  tier?: string;
  highest?: string;
  loading: boolean;
  failed: boolean;
}) {
  // Same-name cards collapse into one tile with a copies badge.
  const grouped = new Map<
    string,
    { card: EoaMachineContent; copies: number }
  >();
  for (const card of contents) {
    if (tier && card.tier !== tier) continue;
    const entry = grouped.get(card.name);
    if (entry) entry.copies += 1;
    else grouped.set(card.name, { card, copies: 1 });
  }
  const tiles = [...grouped.values()].sort((a, b) =>
    Number(
      BigInt(b.card.buybackBaseValueInUsd) -
        BigInt(a.card.buybackBaseValueInUsd),
    ),
  );
  const featured = tier === highest ? tiles[0]?.card : undefined;
  return (
    <div className={styles.gridFrame}>
      <div className={styles.gridHead}>
        <span>
          {tier ? `${tierLabel(tier)} · ` : ''}
          {tiles.length} card{tiles.length === 1 ? '' : 's'} · {contents.length}
          {total !== undefined ? ` of ${total}` : ''} catalog entries
          {loading ? ' loading…' : ''}
        </span>
      </div>
      {featured && (
        <div className={styles.showcase}>
          <Image
            src={featured.frontImageUrl}
            alt={featured.name}
            width={180}
            height={250}
            priority
          />
          <div className={styles.showcaseName}>{featured.name}</div>
          <span className={styles.chip}>
            <span className={styles.chipKey}>Buyback base value</span>$
            {usd(featured.buybackBaseValueInUsd)}
          </span>
        </div>
      )}
      {machine && !loading && !failed && contents.length === 0 && (
        <p className={styles.muted}>
          No public catalog entries for this machine.
        </p>
      )}
      <div className={styles.cardGrid}>
        {tiles.map(({ card, copies }) => (
          <div className={styles.slab} key={card.name} title={card.name}>
            <Image
              width={250}
              height={350}
              sizes='(max-width: 760px) 33vw, 160px'
              className={styles.slabImg}
              src={card.frontImageUrl}
              alt={card.name}
            />
            {copies > 1 && <span className={styles.copies}>{copies}×</span>}
            <span className={styles.chip}>
              <span className={styles.chipKey}>Buyback base value</span>$
              {usd(card.buybackBaseValueInUsd)}
            </span>
          </div>
        ))}
      </div>
      {failed && (
        <p className={styles.muted}>
          Catalog loading failed. Reload to try again.
        </p>
      )}
      {loading && tiles.length === 0 && (
        <p className={`${styles.muted} ${styles.center}`}>Loading catalog…</p>
      )}
    </div>
  );
}

function offerFor(offers: EoaBuybackOffer[], settlementId: string) {
  return offers.find(
    (o) => o.settlementId.toLowerCase() === settlementId.toLowerCase(),
  );
}

function pullFeedHint(config: EoaMachineBuybackTier[]) {
  const seconds = buybackWindowSeconds(config);
  return seconds === null
    ? 'Recent pulls from this machine.'
    : `Pulls appear here after their buyback offer period (${windowLabel(seconds)}) has expired.`;
}

type OfferPrice = {
  /** The tier pricing the offer now; undefined once the offer has ended. */
  tier: EoaBuybackTier | undefined;
  /** True when the offer can be sold back now (a positive current price). */
  sellable: boolean;
  /** Countdown line: price change, hold or offer end. */
  status: string;
};

/**
 * Prices an offer at `now` with `currentBuybackTier`. The offer as a whole ends
 * at the last tier with a positive amount; a tier with amount 0 is a hold.
 */
function offerPrice(offer: EoaBuybackOffer, now: number): OfferPrice {
  const tier = currentBuybackTier(offer, new Date(now));
  const ends = offer.buybackTiers
    .filter((t) => BigInt(t.amountInUsdt) > 0n)
    .map((t) => Date.parse(t.expiresAt));
  const offerEnd = ends.length > 0 ? Math.max(...ends) : null;
  if (!tier || offerEnd === null || offerEnd < now)
    return { tier: undefined, sellable: false, status: 'Offer expired' };
  const tierEnd = Date.parse(tier.expiresAt);
  if (BigInt(tier.amountInUsdt) === 0n)
    return {
      tier,
      sellable: false,
      status: `On hold, sellable in ${countdown(tierEnd, now)}`,
    };
  return {
    tier,
    sellable: true,
    status:
      tierEnd >= offerEnd
        ? `Offer expires in ${countdown(offerEnd, now)}`
        : `${tier.buybackPercentage}% price ends in ${countdown(tierEnd, now)}`,
  };
}

function Reveal({
  pull,
  machine,
  offers,
  decisions,
  now,
  busy,
  onKeep,
  onSell,
  onRefreshOffers,
  onClose,
}: {
  pull: EoaResolvedPull;
  machine: EoaMachineDetail;
  offers: EoaBuybackOffer[];
  decisions: Record<string, Decision>;
  now: number;
  busy: boolean;
  onKeep: (settlementId: string) => void;
  onSell: (offers: EoaBuybackOffer[]) => void;
  onRefreshOffers: () => void;
  onClose: () => void;
}) {
  const single = pull.draws.length === 1;
  const undecided = pull.draws.filter((d) => !decisions[d.settlementId]);
  const sellable = undecided
    .map((d) => offerFor(offers, d.settlementId))
    .filter((o): o is EoaBuybackOffer => !!o && offerPrice(o, now).sellable);
  const sellAllTotal = sellable.reduce(
    (sum, o) => sum + BigInt(offerPrice(o, now).tier?.amountInUsdt ?? '0'),
    0n,
  );
  const windowSeconds = buybackWindowSeconds(machine.buybackConfig);
  return (
    <div className={styles.overlay}>
      <div className={styles.reveal} role='dialog' aria-label='Your new cards'>
        <div className={styles.revealHead}>
          <h2>Congratulations!</h2>
          <p className={styles.muted}>
            {single
              ? 'Get ready for your awesome new card!'
              : `Get ready for your awesome ${pull.draws.length} new cards!`}
          </p>
          <p className={`${styles.small} ${styles.muted}`}>
            <a
              href={explorerTx(pull.permitFundTxHash)}
              target='_blank'
              rel='noreferrer'
            >
              Funding {shortHex(pull.permitFundTxHash)} ↗
            </a>
          </p>
        </div>
        <div className={styles.revealCards}>
          {pull.draws.map((draw) => {
            const offer = offerFor(offers, draw.settlementId);
            const decision = decisions[draw.settlementId];
            const c = draw.collectible;
            const price = offer ? offerPrice(offer, now) : null;
            const amount = price?.sellable
              ? price.tier?.amountInUsdt
              : undefined;
            return (
              <div className={styles.revealCard} key={draw.settlementId}>
                <div style={{ color: tierColor(draw.tier), fontWeight: 600 }}>
                  You got a {draw.tier}-tier card!
                </div>
                <Image
                  width={200}
                  height={260}
                  className={styles.revealImg}
                  src={c.frontImageUrl}
                  alt={c.name}
                />
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <span className={styles.chip}>
                  <span className={styles.chipKey}>Buyback base value</span>$
                  {usd(draw.buybackBaseValueInUSD)}
                </span>
                <div className={styles.offerStrip}>
                  <span className={styles.muted}>
                    {price?.tier
                      ? `${price.tier.buybackPercentage}% Instant buyback`
                      : 'Instant buyback'}
                  </span>
                  <span>{amount ? `$${usdt(amount)}` : 'N/A'}</span>
                </div>
                <span className={`${styles.mono} ${styles.muted}`}>
                  token {shortHex(draw.tokenId, 6, 6)}
                </span>
                {decision ? (
                  <span className={styles.decided}>
                    {decision === 'sold' ? 'Sold back' : 'Kept in collectibles'}
                  </span>
                ) : (
                  <>
                    <div className={styles.revealActions}>
                      {single ? (
                        <>
                          <button
                            type='button'
                            className={`${styles.btn} ${styles.btnSolid}`}
                            disabled={busy || !offer || !price?.sellable}
                            onClick={() => offer && onSell([offer])}
                          >
                            {amount
                              ? `Accept for $${usdt(amount)}`
                              : offer
                                ? 'Accept'
                                : 'Offer pending…'}
                          </button>
                          <button
                            type='button'
                            className={styles.btn}
                            disabled={busy}
                            onClick={() => onKeep(draw.settlementId)}
                          >
                            OK
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type='button'
                            className={styles.btn}
                            disabled={busy}
                            onClick={() => onKeep(draw.settlementId)}
                          >
                            Keep
                          </button>
                          <button
                            type='button'
                            className={`${styles.btn} ${styles.btnSolid}`}
                            disabled={busy || !offer || !price?.sellable}
                            onClick={() => offer && onSell([offer])}
                          >
                            {amount
                              ? `Sell for $${usdt(amount)}`
                              : offer
                                ? 'Sell'
                                : 'Offer pending…'}
                          </button>
                        </>
                      )}
                    </div>
                    <span className={`${styles.small} ${styles.muted}`}>
                      {price
                        ? price.status
                        : windowSeconds === null
                          ? 'No instant buyback on this machine'
                          : `Offer not listed yet (window ${windowLabel(windowSeconds)})`}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className={styles.revealFooter}>
          {!single && sellable.length > 1 && (
            <button
              type='button'
              className={`${styles.btn} ${styles.btnSolid}`}
              disabled={busy}
              onClick={() => onSell(sellable)}
            >
              Sell all cards for ${usdt(sellAllTotal)}
            </button>
          )}
          {undecided.length > 0 && sellable.length < undecided.length && (
            <button
              type='button'
              className={styles.btn}
              disabled={busy}
              onClick={onRefreshOffers}
            >
              Refresh offers
            </button>
          )}
          <button
            type='button'
            className={styles.btn}
            disabled={busy}
            onClick={onClose}
          >
            ← Gacha page
          </button>
        </div>
      </div>
    </div>
  );
}

function YourPulls({
  wallet,
  connected,
  pulls,
  offers,
  machines,
  now,
  busy,
  canLoadMore,
  onRefresh,
  onLoadMore,
  onSell,
}: {
  wallet: Address;
  connected?: Address;
  pulls: EoaPull[];
  offers: EoaBuybackOffer[];
  machines: EoaMachine[];
  now: number;
  busy: boolean;
  canLoadMore: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onSell: (offer: EoaBuybackOffer) => void;
}) {
  const owns = connected?.toLowerCase() === wallet.toLowerCase();
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div>
          <h2>Your pulls &amp; offers</h2>
          <span className={`${styles.mono} ${styles.muted}`}>{wallet}</span>
        </div>
        <div className={styles.rowLine}>
          <span className={styles.chip}>{offers.length} open offer(s)</span>
          <button
            type='button'
            className={`${styles.btn} ${styles.btnSmall}`}
            disabled={busy}
            onClick={onRefresh}
          >
            Refresh
          </button>
        </div>
      </div>
      {pulls.length === 0 && (
        <p className={styles.muted}>
          No resolved pulls attributed to this builder yet.
        </p>
      )}
      {pulls.map((pull) => (
        <div className={styles.pullRow} key={pull.permitFundTxHash}>
          <div className={styles.rowLine}>
            <strong>{pull.packName}</strong>
            <span className={styles.chip}>
              {pull.numOfTokens} card{pull.numOfTokens > 1 ? 's' : ''}
            </span>
            <span className={styles.chip}>{pull.status}</span>
            <span className={`${styles.muted} ${styles.small}`}>
              {pull.pulledAt ? new Date(pull.pulledAt).toLocaleString() : '—'}
            </span>
            <a
              className={styles.small}
              href={explorerTx(pull.permitFundTxHash)}
              target='_blank'
              rel='noreferrer'
            >
              Funding tx ↗
            </a>
            <span className={`${styles.muted} ${styles.small}`}>
              {machines.find((m) => m.id === pull.packId)?.slug ?? pull.packId}
            </span>
          </div>
          {pull.draws.map((draw) => {
            const offer = offerFor(offers, draw.settlementId);
            const price = offer ? offerPrice(offer, now) : null;
            const amount = price?.sellable
              ? price.tier?.amountInUsdt
              : undefined;
            return (
              <div className={styles.drawRow} key={draw.settlementId}>
                <div className={styles.grow}>
                  <span className={`${styles.mono} ${styles.muted}`}>
                    token {shortHex(draw.tokenId, 6, 6)}
                  </span>
                </div>
                {draw.buybackTxHash && (
                  <a
                    href={explorerTx(draw.buybackTxHash)}
                    target='_blank'
                    rel='noreferrer'
                  >
                    Sold ↗
                  </a>
                )}
                {draw.releaseTxHash && (
                  <a
                    href={explorerTx(draw.releaseTxHash)}
                    target='_blank'
                    rel='noreferrer'
                  >
                    Released ↗
                  </a>
                )}
                {offer && price && (
                  <>
                    <span className={`${styles.small} ${styles.muted}`}>
                      {price.status}
                    </span>
                    <button
                      type='button'
                      className={`${styles.btn} ${styles.btnSmall} ${styles.btnSolid}`}
                      disabled={busy || !owns || !price.sellable}
                      title={owns ? undefined : 'Connect this wallet to accept'}
                      onClick={() => onSell(offer)}
                    >
                      {amount ? `Accept for $${usdt(amount)}` : 'Accept'}
                    </button>
                  </>
                )}
                {!offer && !draw.buybackTxHash && !draw.releaseTxHash && (
                  <span className={`${styles.small} ${styles.muted}`}>
                    no open offer
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {canLoadMore && (
        <div className={styles.center}>
          <button
            type='button'
            className={styles.btn}
            disabled={busy}
            onClick={onLoadMore}
          >
            Load older pulls
          </button>
        </div>
      )}
    </section>
  );
}
