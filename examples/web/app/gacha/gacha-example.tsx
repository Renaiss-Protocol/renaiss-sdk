'use client';

import {
  type ApiError,
  type AuthenticatedUser,
  createPublicClient,
  createSecureClient,
  type GachaBuybackOffer,
  type GachaMachine,
  type GachaMachineContent,
  type GachaMachineDetail,
  type GachaMachineTier,
  type GachaPullResult,
  GachaQuantity,
  type GachaStreamEvent,
  getError,
  getValue,
  isFailed,
  type RenaissSigner,
  type UserActivity,
  UserActivityFilter,
} from '@renaiss-protocol/client';
import { signerFrom } from '@renaiss-protocol/client/viem';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createWalletClient,
  custom,
  type EIP1193Provider,
  getAddress,
} from 'viem';
import { bscTestnet } from 'viem/chains';
import styles from './gacha.module.css';

type ApiConfig = {
  baseUrl?: string;
};

type GachaExampleProps = {
  apiConfig: ApiConfig;
  initialError: string | null;
  initialPacks: GachaMachine[];
};

type PullPhase = 'idle' | 'pulling' | 'ripVideo' | 'result';
type AccountView = 'gacha' | 'activities' | 'offers';
type ActivityViewFilter = 'all' | 'gacha' | 'buyback';
type PrimaryActionStatus =
  | 'idle'
  | 'checkingSetup'
  | 'deployingSafe'
  | 'approvingPermit2'
  | 'ripping';
type WalletSetupStatus =
  | 'unknown'
  | 'checking'
  | 'needsDeployment'
  | 'deploying'
  | 'needsApproval'
  | 'approving'
  | 'ready'
  | 'error';
type Eip1193EventProvider = EIP1193Provider & {
  on?: (event: string, listener: (payload: unknown) => void) => void;
  removeListener?: (
    event: string,
    listener: (payload: unknown) => void,
  ) => void;
};
type BuybackFeedback =
  | {
      message: string;
      status: 'pending';
    }
  | {
      cardName: string;
      frontImageUrl: string | null;
      itemCount: number;
      message: string;
      status: 'success';
      tier: string | null;
      tokenId: string;
      totalAmountInUsdt: string;
      txHash: string;
    }
  | {
      message: string;
      status: 'error';
    };

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

function createBrowserSigner(
  provider: EIP1193Provider,
  account: string,
): RenaissSigner {
  return signerFrom(
    createWalletClient({
      account: getAddress(account),
      chain: bscTestnet,
      transport: custom(provider),
    }),
  );
}

function toHexChainId(chainId: number): `0x${string}` {
  return `0x${chainId.toString(16)}`;
}

function isUnrecognizedChainError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    Number((error as { code: unknown }).code) === 4902
  );
}

const quantityOptions = [
  GachaQuantity.Single,
  GachaQuantity.Five,
  GachaQuantity.Ten,
];

const GACHA_MACHINE_CONTENTS_PREVIEW_PAGE_SIZE = 12;
const GACHA_API_KEY_STORAGE_PREFIX = 'renaiss:gacha-example:api-key';
const accountViews: { label: string; value: AccountView }[] = [
  { label: 'Gacha', value: 'gacha' },
  { label: 'Activities', value: 'activities' },
  { label: 'Offers', value: 'offers' },
];
const activityFilters: { label: string; value: ActivityViewFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Gacha pulls', value: 'gacha' },
  { label: 'Buybacks', value: 'buyback' },
];
const gachaPullActivityTypes = new Set<string>([
  UserActivityFilter.Pull,
  UserActivityFilter.PerpPull,
  UserActivityFilter.GachaV3Pull,
]);
const buybackActivityTypes = new Set<string>([
  UserActivityFilter.Buyback,
  UserActivityFilter.PerpBuyback,
  UserActivityFilter.GachaV3Buyback,
]);

function compactAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function createApiKeyStorageKey(apiConfig: ApiConfig): string {
  return [
    GACHA_API_KEY_STORAGE_PREFIX,
    apiConfig.baseUrl ?? 'default-api',
  ].join(':');
}

function readStoredApiKey(storageKey: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function persistApiKey(storageKey: string, apiKey: string): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(storageKey, apiKey);
  } catch {
    // Session storage may be unavailable in private browsing contexts.
  }
}

function clearStoredApiKey(storageKey: string): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

async function switchWalletChain(provider: EIP1193Provider): Promise<void> {
  const hexChainId = toHexChainId(bscTestnet.id);

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexChainId }],
    });
    return;
  } catch (error) {
    if (!isUnrecognizedChainError(error)) {
      throw error;
    }
  }

  await provider.request({
    method: 'wallet_addEthereumChain',
    params: [
      {
        blockExplorerUrls:
          bscTestnet.blockExplorers === undefined
            ? undefined
            : [bscTestnet.blockExplorers.default.url],
        chainId: hexChainId,
        chainName: bscTestnet.name,
        nativeCurrency: bscTestnet.nativeCurrency,
        rpcUrls: bscTestnet.rpcUrls.default.http,
      },
    ],
  });
}

function getFirstAccount(accounts: unknown): string | null {
  if (!Array.isArray(accounts)) return null;
  const [address] = accounts;

  return typeof address === 'string' ? address : null;
}

function formatIntegerWithSeparators(value: bigint): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatScaledAmount(
  value: string | null | undefined,
  decimals: number,
  fractionDigits = 2,
): string {
  if (value === null || value === undefined) return '-';
  if (!/^\d+$/.test(value)) return value;

  const scale = 10n ** BigInt(decimals);
  const precision = 10n ** BigInt(fractionDigits);
  const rounded = (BigInt(value) * precision + scale / 2n) / scale;
  const whole = rounded / precision;
  const fraction = rounded % precision;
  const fractionText = fraction
    .toString()
    .padStart(fractionDigits, '0')
    .replace(/0+$/, '');

  if (fractionText.length === 0) {
    return formatIntegerWithSeparators(whole);
  }

  return `${formatIntegerWithSeparators(whole)}.${fractionText}`;
}

function formatUsdt(value: string | null | undefined): string {
  const amount = formatScaledAmount(value, 18, 2);
  return amount === '-' ? amount : `${amount} USDT`;
}

function formatUsdtPrice(value: string | null | undefined): string {
  const amount = formatScaledAmount(value, 18, 2);
  return amount === '-' ? amount : `$${amount}`;
}

function formatUsd(value: string | null | undefined): string {
  if (value === null || value === undefined) return '-';
  if (!/^\d+$/.test(value)) return value;

  return `$${Number(value).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })}`;
}

function formatRelativeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const deltaSeconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000),
  );
  const units: { label: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
    { label: 'day', seconds: 86_400 },
    { label: 'hour', seconds: 3_600 },
    { label: 'minute', seconds: 60 },
  ];
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  for (const unit of units) {
    if (deltaSeconds >= unit.seconds) {
      return formatter.format(
        -Math.floor(deltaSeconds / unit.seconds),
        unit.label,
      );
    }
  }

  return 'just now';
}

function formatOfferExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Expiry unavailable';

  const deltaSeconds = Math.max(
    0,
    Math.floor((date.getTime() - Date.now()) / 1000),
  );
  const days = Math.floor(deltaSeconds / 86_400);
  const hours = Math.floor((deltaSeconds % 86_400) / 3_600);

  if (days > 0) return `Offer expires in ${days}d ${hours}h`;
  if (hours > 0) return `Offer expires in ${hours}h`;

  return 'Offer expires soon';
}

function formatApiError(error: ApiError): string {
  return `${error.code} (${error.status}): ${error.detail}`;
}

function isSessionExpiredError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.startsWith('UNAUTHORIZED ') ||
      error.message.includes('(401)'))
  );
}

function isInsufficientUsdtError(error: ApiError): boolean {
  const detail = error.detail.toLowerCase();

  return detail.includes('insufficient') && detail.includes('usdt');
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
}

function eventLabel(event: GachaStreamEvent): string {
  return event.data.action
    .replace('GACHA_V3_', '')
    .replaceAll('_', ' ')
    .toLowerCase();
}

function getPullProgressMessage(events: GachaStreamEvent[]): string {
  const [event] = events.slice(-1);
  if (event === undefined) return 'Confirm wallet signature...';

  if (event.status === 'error') return 'Pull failed. Review the debug stream.';

  switch (event.data.action) {
    case 'GACHA_V3_OPEN_PACK':
      return event.status === 'complete'
        ? 'Pack opened. Waiting for draw...'
        : 'Opening machine on-chain...';
    case 'GACHA_V3_DRAW_RESOLVED':
      return event.status === 'complete'
        ? 'Draw resolved. Releasing card...'
        : 'Resolving random draw...';
    case 'GACHA_V3_TOKEN_RELEASED':
      return event.status === 'complete'
        ? 'Card released. Preparing reveal...'
        : 'Releasing card token...';
    default:
      return `Processing ${eventLabel(event)}...`;
  }
}

function formatStageLabel(stage: string | undefined): string {
  if (stage === undefined) return 'Unknown';

  return stage.replaceAll('-', ' ');
}

function formatPackTypeLabel(packType: string | undefined): string {
  if (packType === 'v3') return 'Infinite';
  if (packType === undefined) return 'Gacha';

  return packType;
}

function multiplyNumericString(
  value: string | null | undefined,
  multiplier: number,
): string | null | undefined {
  if (value === null || value === undefined || !/^\d+$/.test(value)) {
    return value;
  }

  return (BigInt(value) * BigInt(multiplier)).toString();
}

function tierClassName(tier: string | null | undefined): string {
  const normalizedTier = tier?.toLowerCase() ?? '';
  if (normalizedTier.includes('top') || normalizedTier.includes('s')) {
    return styles.rarityRainbow ?? '';
  }
  if (normalizedTier.includes('a')) return styles.rarityPurple ?? '';
  if (normalizedTier.includes('b')) return styles.rarityPink ?? '';
  if (normalizedTier.includes('c')) return styles.rarityGold ?? '';

  return styles.rarityWhite ?? '';
}

function findOfferForReleasedToken(
  offers: GachaBuybackOffer[],
  item: GachaPullResult['released'][number],
): GachaBuybackOffer | null {
  return (
    offers.find(
      (offer) =>
        offer.checkoutId === String(item.checkoutId) ||
        offer.tokenId === item.collectible.tokenId,
    ) ?? null
  );
}

function getBuybackSuccess(
  feedbackByCheckoutId: Record<string, BuybackFeedback>,
) {
  return (
    Object.values(feedbackByCheckoutId).find(
      (feedback): feedback is Extract<BuybackFeedback, { status: 'success' }> =>
        feedback.status === 'success',
    ) ?? null
  );
}

function isVisibleAccountActivity(activity: UserActivity): boolean {
  return (
    gachaPullActivityTypes.has(activity.type) ||
    buybackActivityTypes.has(activity.type)
  );
}

function activityMatchesFilter(
  activity: UserActivity,
  filter: ActivityViewFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'gacha') return gachaPullActivityTypes.has(activity.type);

  return buybackActivityTypes.has(activity.type);
}

function getActivityActionLabel(activity: UserActivity): string {
  if (gachaPullActivityTypes.has(activity.type)) return 'Gacha';
  if (buybackActivityTypes.has(activity.type)) return 'Buyback';

  return activity.type;
}

function getActivityValue(activity: UserActivity): string {
  if ('totalAmount' in activity) return formatUsdtPrice(activity.totalAmount);
  if ('priceInUsdt' in activity) return formatUsdtPrice(activity.priceInUsdt);

  return '-';
}

type TierSummary = {
  chance: GachaMachineTier['chance'];
  name: string;
  tier: number;
};

function formatTierLabel(tier: string): string {
  if (tier.length === 1 || tier.toUpperCase() === 'TOP') {
    return `Tier ${tier.toUpperCase()}`;
  }

  return `Tier ${tier
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')}`;
}

function formatChance(value: GachaMachineTier['chance']): string {
  if (value === 'UNDER-1-PERCENT') return 'Under 1% chance';

  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value > 0 && value < 1 ? 2 : 1,
  }).format(value)}% chance`;
}

function summarizeTiers(tiers: GachaMachineTier[]): TierSummary[] {
  return tiers
    .map((tier) => ({
      chance: tier.chance,
      name: tier.name,
      tier: tier.tier,
    }))
    .sort((a, b) => b.tier - a.tier);
}

function getPrimaryActionText(input: {
  isPulling: boolean;
  isWalletReady: boolean;
  primaryActionStatus: PrimaryActionStatus;
  pullProgressMessage: string;
  selectedPackTotalPrice: string | null | undefined;
  secureClient: ReturnType<typeof createSecureClient> | null;
  walletSetupStatus: WalletSetupStatus;
  quantity: GachaQuantity;
}): string {
  if (input.secureClient === null) return 'Connect wallet to rip';

  switch (input.primaryActionStatus) {
    case 'checkingSetup':
      return 'Checking Safe...';
    case 'deployingSafe':
      return 'Confirm Safe deployment';
    case 'approvingPermit2':
      return 'Confirm Permit2 approval';
    case 'ripping':
      return input.isPulling
        ? input.pullProgressMessage
        : 'Confirm wallet signature';
    case 'idle':
      break;
  }

  if (!input.isWalletReady) {
    switch (input.walletSetupStatus) {
      case 'checking':
        return 'Checking Safe...';
      case 'deploying':
        return 'Confirm Safe deployment';
      case 'needsApproval':
        return 'Approve Permit2';
      case 'approving':
        return 'Confirm Permit2 approval';
      case 'error':
        return 'Check Safe setup';
      case 'unknown':
        return 'Check Safe setup';
      case 'needsDeployment':
        return 'Deploy Safe';
      case 'ready':
        break;
    }
  }

  if (input.isPulling) return input.pullProgressMessage;

  return `Rip ${input.quantity}x for ${formatUsdtPrice(
    input.selectedPackTotalPrice,
  )}`;
}

function getActivityDestination(activity: UserActivity): string {
  if (gachaPullActivityTypes.has(activity.type)) return 'Gacha';
  if (buybackActivityTypes.has(activity.type)) return 'Buyback';

  return '-';
}

export function GachaExample({
  apiConfig,
  initialError,
  initialPacks,
}: GachaExampleProps) {
  const [packs] = useState(initialPacks);
  const [selectedSlug, setSelectedSlug] = useState(initialPacks[0]?.slug ?? '');
  const [packDetail, setPackDetail] = useState<GachaMachineDetail | null>(null);
  const [machineContents, setMachineContents] = useState<GachaMachineContent[]>(
    [],
  );
  const [packError, setPackError] = useState(initialError);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [safeWalletAddress, setSafeWalletAddress] = useState<string | null>(
    null,
  );
  const [signer, setSigner] = useState<RenaissSigner | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<GachaQuantity>(GachaQuantity.Single);
  const [streamEvents, setStreamEvents] = useState<GachaStreamEvent[]>([]);
  const [pullResult, setPullResult] = useState<GachaPullResult | null>(null);
  const [buybackOffers, setBuybackOffers] = useState<GachaBuybackOffer[]>([]);
  const [buybackFeedbackByCheckoutId, setBuybackFeedbackByCheckoutId] =
    useState<Record<string, BuybackFeedback>>({});
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [accountView, setAccountView] = useState<AccountView>('gacha');
  const [activityFilter, setActivityFilter] =
    useState<ActivityViewFilter>('all');
  const [offerSearch, setOfferSearch] = useState('');
  const [status, setStatus] = useState('Ready to browse gacha machines.');
  const [isBusy, setIsBusy] = useState(false);
  const [primaryActionStatus, setPrimaryActionStatus] =
    useState<PrimaryActionStatus>('idle');
  const [isActivitiesLoading, setIsActivitiesLoading] = useState(false);
  const [isOffersLoading, setIsOffersLoading] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [walletSetupStatus, setWalletSetupStatus] =
    useState<WalletSetupStatus>('unknown');
  const [pullPhase, setPullPhase] = useState<PullPhase>('idle');
  const [revealedCardIds, setRevealedCardIds] = useState<Set<string>>(
    () => new Set(),
  );
  const restoredWalletSetupKeyRef = useRef<string | null>(null);

  const apiBaseUrl = apiConfig.baseUrl;
  const clientConfig = useMemo<ApiConfig>(
    () => ({ baseUrl: apiBaseUrl }),
    [apiBaseUrl],
  );
  const publicClient = useMemo(
    () => createPublicClient(clientConfig),
    [clientConfig],
  );
  const apiKeyStorageKey = useMemo(
    () => createApiKeyStorageKey(clientConfig),
    [clientConfig],
  );
  const ensureExpectedWalletChain = useCallback(async () => {
    const provider = window.ethereum;
    if (provider === undefined) {
      throw new Error(
        'No injected wallet found. Install a browser wallet first.',
      );
    }

    const currentChainId = Number(
      await provider.request({ method: 'eth_chainId' }),
    );
    if (currentChainId === bscTestnet.id) return;

    setStatus(`Switch wallet to ${bscTestnet.name}.`);
    await switchWalletChain(provider);
  }, []);
  const secureClient = useMemo(() => {
    if (apiKey === null) return null;

    return createSecureClient({
      ...clientConfig,
      apiKey,
      signer: signer ?? undefined,
    });
  }, [clientConfig, apiKey, signer]);

  const selectedPack =
    packs.find((pack) => pack.slug === selectedSlug) ?? packs[0] ?? null;
  const inspectedPack = packDetail ?? selectedPack;
  const visibleOffers = buybackOffers.filter(
    (offer) => offer.packSlug === selectedSlug,
  );
  const visibleAccountActivities = userActivities.filter(
    (activity) =>
      isVisibleAccountActivity(activity) &&
      activityMatchesFilter(activity, activityFilter),
  );
  const normalizedOfferSearch = offerSearch.trim().toLowerCase();
  const visibleAccountOffers = buybackOffers.filter((offer) => {
    if (normalizedOfferSearch.length === 0) return true;

    return [offer.cardName, offer.setName, offer.cardNumber, offer.tokenId]
      .filter((value): value is string => value !== null)
      .some((value) => value.toLowerCase().includes(normalizedOfferSearch));
  });
  const previewContents = useMemo(
    () => machineContents.slice(0, 12),
    [machineContents],
  );
  const previewContentCards = useMemo(() => {
    const seen = new Map<string, number>();
    const machineSlug = selectedPack?.slug ?? 'machine';

    return previewContents.slice(0, 8).map((item) => {
      const signature = [
        machineSlug,
        item.name,
        item.tier,
        item.buybackBaseValueInUsd,
        item.frontImageUrl ?? 'no-image',
      ].join(':');
      const occurrence = seen.get(signature) ?? 0;
      seen.set(signature, occurrence + 1);

      return {
        item,
        key: `${signature}:${occurrence}`,
      };
    });
  }, [previewContents, selectedPack?.slug]);
  const tierSummaries = useMemo(
    () => summarizeTiers(packDetail?.tiers ?? []),
    [packDetail?.tiers],
  );
  const selectedPackTotalPrice =
    selectedPack === null
      ? null
      : multiplyNumericString(selectedPack.priceInUsdt, quantity);
  const isWalletConnected = walletAddress !== null;
  const isAuthenticated = apiKey !== null;
  const isWalletReady = walletSetupStatus === 'ready';
  const isWalletSetupInFlight =
    walletSetupStatus === 'checking' ||
    walletSetupStatus === 'deploying' ||
    walletSetupStatus === 'approving';
  const resultCards =
    pullResult?.released.map((item) => ({
      item,
      offer: findOfferForReleasedToken(visibleOffers, item),
    })) ?? [];
  const unrevealedResultCount = resultCards.filter(
    ({ item }) => !revealedCardIds.has(String(item.checkoutId)),
  ).length;
  const selectedMachineMediaUrl = inspectedPack?.gachaMachineVideoUrl ?? null;
  const selectedRipVideoUrl =
    inspectedPack?.gachaRippingPackAnimationVideoUrl ?? null;
  const selectedInstantBuybackPercentage = 85;
  const isPulling = pullPhase === 'pulling';
  const pullProgressMessage = getPullProgressMessage(streamEvents);
  const pullButtonText = getPrimaryActionText({
    isPulling,
    isWalletReady,
    primaryActionStatus,
    pullProgressMessage,
    quantity,
    secureClient,
    selectedPackTotalPrice,
    walletSetupStatus,
  });
  const walletSetupLabel =
    walletSetupStatus === 'ready'
      ? safeWalletAddress === null
        ? 'Safe ready'
        : `Safe ${compactAddress(safeWalletAddress)} ready`
      : walletSetupStatus === 'checking'
        ? 'Checking Safe setup'
        : walletSetupStatus === 'needsDeployment'
          ? 'Deploy Safe wallet to enable pulls'
          : walletSetupStatus === 'deploying'
            ? 'Confirm Safe deployment'
            : walletSetupStatus === 'needsApproval'
              ? safeWalletAddress === null
                ? 'Approve Permit2 USDT to enable pulls'
                : `Safe ${compactAddress(
                    safeWalletAddress,
                  )} needs Permit2 approval`
              : walletSetupStatus === 'approving'
                ? 'Confirm Permit2 approval'
                : walletSetupStatus === 'error'
                  ? 'Safe setup check failed'
                  : !isAuthenticated
                    ? 'Safe setup pending'
                    : 'Check Safe setup to enable pulls';
  const buybackSuccess = getBuybackSuccess(buybackFeedbackByCheckoutId);

  const loadAuthenticatedUser = useCallback(
    async (
      apiKeyValue: string,
      walletAddressOverride = walletAddress,
    ): Promise<AuthenticatedUser> => {
      const client = createSecureClient({
        ...clientConfig,
        apiKey: apiKeyValue,
      });
      const result = await client.fetchAuthenticatedUser();
      if (isFailed(result)) {
        throw new Error(formatApiError(getError(result)));
      }

      const authenticatedUser = getValue(result);
      setSafeWalletAddress(authenticatedUser.wallets.safeWalletAddress);

      const provider = window.ethereum;
      if (provider !== undefined && walletAddressOverride !== null) {
        setSigner(createBrowserSigner(provider, walletAddressOverride));
      }

      return authenticatedUser;
    },
    [clientConfig, walletAddress],
  );

  const refreshWalletSetupStatus = useCallback(
    async (
      apiKeyValue: string,
      safeWalletAddressOverride = safeWalletAddress,
    ): Promise<WalletSetupStatus> => {
      setWalletSetupStatus('checking');
      setStatus('Checking Safe wallet setup...');

      const client = createSecureClient({
        ...clientConfig,
        apiKey: apiKeyValue,
      });

      const deployedResult = await client.isSafeWalletDeployed();
      if (isFailed(deployedResult)) {
        setWalletSetupStatus('error');
        throw new Error(formatApiError(getError(deployedResult)));
      }

      if (!getValue(deployedResult)) {
        setWalletSetupStatus('needsDeployment');
        setStatus('Deploy Safe wallet to enable pulls.');
        return 'needsDeployment';
      }

      const approvedResult = await client.isPermit2UsdtApproved();
      if (isFailed(approvedResult)) {
        setWalletSetupStatus('error');
        throw new Error(formatApiError(getError(approvedResult)));
      }

      const currentSafeWalletAddress =
        safeWalletAddressOverride ?? safeWalletAddress;
      if (!getValue(approvedResult)) {
        setWalletSetupStatus('needsApproval');
        setStatus(
          currentSafeWalletAddress === null
            ? 'Approve Permit2 USDT to enable pulls.'
            : `Approve Permit2 USDT for Safe ${compactAddress(
                currentSafeWalletAddress,
              )}.`,
        );
        return 'needsApproval';
      }

      setWalletSetupStatus('ready');
      setStatus(
        currentSafeWalletAddress === null
          ? 'Safe wallet is ready for pulls and buybacks.'
          : `Safe ${compactAddress(
              currentSafeWalletAddress,
            )} is ready for pulls and buybacks.`,
      );
      return 'ready';
    },
    [clientConfig, safeWalletAddress],
  );

  const loadPackDetail = useCallback(
    async (slug: string) => {
      if (slug.length === 0) return;

      setPackError(null);
      const result = await publicClient.fetchGachaMachine({ slug });
      if (isFailed(result)) {
        setPackDetail(null);
        setMachineContents([]);
        setPackError(formatApiError(getError(result)));
        return;
      }

      const contentsResult = await publicClient
        .listGachaMachineContents({
          pageSize: GACHA_MACHINE_CONTENTS_PREVIEW_PAGE_SIZE,
          slug,
        })
        .firstPage();
      if (isFailed(contentsResult)) {
        setMachineContents([]);
        setPackError(formatApiError(getError(contentsResult)));
        setPackDetail(getValue(result));
        return;
      }

      setPackDetail(getValue(result));
      setMachineContents(getValue(contentsResult).items);
    },
    [publicClient],
  );

  const loadBuybackOffers = useCallback(
    async (client = secureClient) => {
      if (client === null) return [];

      setIsOffersLoading(true);
      const result = await client
        .listGachaBuybackOffers({ pageSize: 12 })
        .firstPage();
      setIsOffersLoading(false);
      if (isFailed(result)) {
        setStatus(formatApiError(getError(result)));
        return [];
      }

      const offers = getValue(result).items;
      setBuybackOffers(offers);
      return offers;
    },
    [secureClient],
  );

  const loadUserActivities = useCallback(
    async (client = secureClient) => {
      if (client === null) return [];

      setIsActivitiesLoading(true);
      const result = await client
        .listUserActivities({
          filter: UserActivityFilter.All,
          pageSize: 20,
        })
        .firstPage();
      setIsActivitiesLoading(false);
      if (isFailed(result)) {
        setStatus(formatApiError(getError(result)));
        return [];
      }

      const activities = getValue(result).items.filter(
        isVisibleAccountActivity,
      );
      setUserActivities(activities);
      return activities;
    },
    [secureClient],
  );

  const clearAuthenticatedSession = useCallback(
    (message: string) => {
      clearStoredApiKey(apiKeyStorageKey);
      setApiKey(null);
      setBuybackOffers([]);
      setUserActivities([]);
      setBuybackFeedbackByCheckoutId({});
      setSafeWalletAddress(null);
      setPrimaryActionStatus('idle');
      setWalletSetupStatus('unknown');
      setPullResult(null);
      setPullPhase('idle');
      setIsDepositModalOpen(false);
      setStatus(message);
    },
    [apiKeyStorageKey],
  );

  const disconnectWallet = useCallback(async () => {
    const provider = window.ethereum;
    let didRevokeWalletPermission = false;

    if (provider !== undefined) {
      try {
        await provider.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }],
        });
        didRevokeWalletPermission = true;
      } catch {
        // Some injected wallets do not support programmatic permission revokes.
      }
    }

    clearAuthenticatedSession(
      didRevokeWalletPermission
        ? 'Wallet disconnected. Session cleared.'
        : 'Session cleared. Revoke site access in your wallet if it still shows connected.',
    );
    restoredWalletSetupKeyRef.current = null;
    setWalletAddress(null);
    setSigner(null);
    setIsDepositModalOpen(false);
  }, [clearAuthenticatedSession]);

  const markWalletUnavailable = useCallback((message: string) => {
    restoredWalletSetupKeyRef.current = null;
    setWalletAddress(null);
    setSigner(null);
    setSafeWalletAddress(null);
    setPrimaryActionStatus('idle');
    setWalletSetupStatus('unknown');
    setStatus(message);
  }, []);

  useEffect(() => {
    void loadPackDetail(selectedSlug);
  }, [loadPackDetail, selectedSlug]);

  useEffect(() => {
    const storedApiKey = readStoredApiKey(apiKeyStorageKey);
    if (storedApiKey !== null) {
      setApiKey(storedApiKey);
      setStatus('Restored session. Checking connected wallet...');
    }
  }, [apiKeyStorageKey]);

  useEffect(() => {
    const provider = window.ethereum as Eip1193EventProvider | undefined;
    if (provider === undefined) {
      if (apiKey !== null) {
        markWalletUnavailable(
          'Wallet unavailable. Reconnect wallet to continue.',
        );
      }
      return;
    }

    const walletProvider = provider;
    let isCurrent = true;

    async function syncConnectedAccount() {
      try {
        const address = getFirstAccount(
          await walletProvider.request({ method: 'eth_accounts' }),
        );
        if (!isCurrent) return;

        if (address === null) {
          if (apiKey !== null || walletAddress !== null) {
            markWalletUnavailable(
              'Wallet disconnected. Reconnect wallet to continue.',
            );
          }
          return;
        }

        const checksummedAddress = getAddress(address);
        const nextSigner = createBrowserSigner(
          walletProvider,
          checksummedAddress,
        );
        setWalletAddress(checksummedAddress);
        setSigner(nextSigner);

        const setupKey =
          apiKey === null
            ? null
            : `${apiKey}:${checksummedAddress.toLowerCase()}`;
        if (
          apiKey !== null &&
          walletSetupStatus === 'unknown' &&
          restoredWalletSetupKeyRef.current !== setupKey
        ) {
          restoredWalletSetupKeyRef.current = setupKey;
          setPrimaryActionStatus('checkingSetup');
          setWalletSetupStatus('checking');
          try {
            let restoredSafeWalletAddress: string | null = null;
            try {
              const authenticatedUser = await loadAuthenticatedUser(
                apiKey,
                checksummedAddress,
              );
              restoredSafeWalletAddress =
                authenticatedUser.wallets.safeWalletAddress;
            } catch (error) {
              if (!isCurrent) return;
              if (isSessionExpiredError(error)) {
                clearAuthenticatedSession(
                  error instanceof Error
                    ? `Stored session expired: ${error.message}`
                    : 'Stored session expired.',
                );
              } else {
                setWalletSetupStatus('error');
                setStatus(
                  error instanceof Error
                    ? `Session check failed: ${error.message}`
                    : 'Session check failed.',
                );
              }
              return;
            }

            try {
              await refreshWalletSetupStatus(apiKey, restoredSafeWalletAddress);
            } catch (error) {
              if (!isCurrent) return;
              setWalletSetupStatus('error');
              setStatus(
                error instanceof Error
                  ? `Wallet setup check failed: ${error.message}`
                  : 'Wallet setup check failed.',
              );
            }

            const restoredClient = createSecureClient({
              ...clientConfig,
              apiKey,
              signer: nextSigner,
            });
            await Promise.all([
              loadBuybackOffers(restoredClient),
              loadUserActivities(restoredClient),
            ]);
          } finally {
            if (isCurrent) {
              setPrimaryActionStatus('idle');
            }
          }
        }
      } catch (error) {
        if (!isCurrent) return;
        setStatus(
          error instanceof Error
            ? `Wallet session check failed: ${error.message}`
            : 'Wallet session check failed.',
        );
      }
    }

    function handleAccountsChanged(payload: unknown) {
      const address = getFirstAccount(payload);
      if (address === null) {
        markWalletUnavailable(
          'Wallet disconnected. Reconnect wallet to continue.',
        );
        return;
      }

      const checksummedAddress = getAddress(address);
      if (
        walletAddress !== null &&
        checksummedAddress.toLowerCase() !== walletAddress.toLowerCase()
      ) {
        clearAuthenticatedSession('Wallet changed. Sign in again.');
      }
      restoredWalletSetupKeyRef.current = null;
      setWalletAddress(checksummedAddress);
      setSafeWalletAddress(null);
      setPrimaryActionStatus('idle');
      setWalletSetupStatus('unknown');
      setSigner(createBrowserSigner(walletProvider, checksummedAddress));
    }

    function handleDisconnect() {
      markWalletUnavailable(
        'Wallet disconnected. Reconnect wallet to continue.',
      );
    }

    if (apiKey !== null || walletAddress !== null) {
      void syncConnectedAccount();
    }
    walletProvider.on?.('accountsChanged', handleAccountsChanged);
    walletProvider.on?.('disconnect', handleDisconnect);

    return () => {
      isCurrent = false;
      walletProvider.removeListener?.('accountsChanged', handleAccountsChanged);
      walletProvider.removeListener?.('disconnect', handleDisconnect);
    };
  }, [
    apiKey,
    walletAddress,
    clearAuthenticatedSession,
    clientConfig,
    loadBuybackOffers,
    loadAuthenticatedUser,
    loadUserActivities,
    markWalletUnavailable,
    refreshWalletSetupStatus,
    walletSetupStatus,
  ]);

  async function connectWallet() {
    const provider = window.ethereum;
    if (provider === undefined) {
      setStatus('No injected wallet found. Install a browser wallet first.');
      return;
    }

    setIsBusy(true);
    try {
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as string[];
      const [address] = accounts;
      if (address === undefined) {
        setStatus('Wallet did not return an account.');
        return;
      }

      const checksummedAddress = getAddress(address);
      if (
        apiKey !== null &&
        walletAddress !== null &&
        checksummedAddress.toLowerCase() !== walletAddress.toLowerCase()
      ) {
        clearAuthenticatedSession('Wallet changed. Sign in again.');
      }
      restoredWalletSetupKeyRef.current = null;
      setWalletAddress(checksummedAddress);
      setSafeWalletAddress(null);
      setPrimaryActionStatus('idle');
      setWalletSetupStatus('unknown');
      setSigner(createBrowserSigner(provider, checksummedAddress));
      setStatus(`Connected ${compactAddress(checksummedAddress)}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Wallet rejected.');
    } finally {
      setIsBusy(false);
    }
  }

  async function signIn() {
    if (signer === null) {
      setStatus('Connect a wallet before signing in.');
      return;
    }

    setIsBusy(true);
    setStatus('Waiting for SIWE signature...');
    try {
      await ensureExpectedWalletChain();
      const result = await publicClient.createApiKeyWithSiwe({
        name: 'Renaiss SDK web example',
        prefix: 'web-example',
        signer,
      });
      if (isFailed(result)) {
        setStatus(formatApiError(getError(result)));
        return;
      }

      const key = getValue(result).key;
      const nextSigner = signer;
      const nextClient = createSecureClient({
        ...clientConfig,
        apiKey: key,
        signer: nextSigner,
      });
      persistApiKey(apiKeyStorageKey, key);
      setPrimaryActionStatus('checkingSetup');
      setApiKey(key);

      try {
        const authenticatedUser = await loadAuthenticatedUser(key);
        await refreshWalletSetupStatus(
          key,
          authenticatedUser.wallets.safeWalletAddress,
        );
        await Promise.all([
          loadBuybackOffers(nextClient),
          loadUserActivities(nextClient),
        ]);
      } catch (error) {
        setStatus(
          error instanceof Error
            ? `Authenticated, but setup check failed: ${error.message}`
            : 'Authenticated, but setup check failed.',
        );
        setWalletSetupStatus('error');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Sign in failed.');
    } finally {
      setPrimaryActionStatus('idle');
      setIsBusy(false);
    }
  }

  async function deploySafeWalletForUser() {
    if (secureClient === null || signer === null || apiKey === null) {
      setStatus('Connect and sign in before deploying Safe wallet.');
      return;
    }

    setPrimaryActionStatus('deployingSafe');
    setIsBusy(true);
    try {
      await ensureExpectedWalletChain();
      setWalletSetupStatus('deploying');
      setStatus('Confirm Safe deployment in your wallet.');
      const deploymentResult = await secureClient.deploySafeWallet();
      if (isFailed(deploymentResult)) {
        setWalletSetupStatus('error');
        setStatus(formatApiError(getError(deploymentResult)));
        return;
      }

      const deployment = getValue(deploymentResult);
      setSafeWalletAddress(deployment.safe.safeWalletAddress);
      setPrimaryActionStatus('checkingSetup');
      await refreshWalletSetupStatus(apiKey, deployment.safe.safeWalletAddress);
    } catch (error) {
      setWalletSetupStatus('error');
      setStatus(
        error instanceof Error
          ? error.message
          : 'Safe wallet deployment failed.',
      );
    } finally {
      setPrimaryActionStatus('idle');
      setIsBusy(false);
    }
  }

  async function approvePermit2ForUser() {
    if (secureClient === null || signer === null || apiKey === null) {
      setStatus('Connect and sign in before approving Permit2.');
      return;
    }

    setPrimaryActionStatus('approvingPermit2');
    setIsBusy(true);
    try {
      await ensureExpectedWalletChain();
      setWalletSetupStatus('approving');
      setStatus('Confirm Permit2 approval in your wallet.');
      const approvalResult = await secureClient.approvePermit2Usdt();
      if (isFailed(approvalResult)) {
        setWalletSetupStatus('error');
        setStatus(formatApiError(getError(approvalResult)));
        return;
      }

      const approval = getValue(approvalResult);
      setSafeWalletAddress(approval.safe.safeWalletAddress);
      setWalletSetupStatus('ready');
      setStatus(
        `Safe ${compactAddress(
          approval.safe.safeWalletAddress,
        )} is ready for pulls and buybacks.`,
      );
    } catch (error) {
      setWalletSetupStatus('error');
      setStatus(
        error instanceof Error ? error.message : 'Permit2 approval failed.',
      );
    } finally {
      setPrimaryActionStatus('idle');
      setIsBusy(false);
    }
  }

  async function handlePrimaryGachaAction() {
    if (secureClient === null || apiKey === null) {
      setStatus('Connect and sign in before ripping.');
      return;
    }

    if (walletSetupStatus === 'ready') {
      await pullGacha();
      return;
    }

    if (walletSetupStatus === 'needsDeployment') {
      await deploySafeWalletForUser();
      return;
    }

    if (walletSetupStatus === 'needsApproval') {
      await approvePermit2ForUser();
      return;
    }

    setPrimaryActionStatus('checkingSetup');
    setIsBusy(true);
    try {
      const authenticatedUser = await loadAuthenticatedUser(apiKey);
      const nextWalletSetupStatus = await refreshWalletSetupStatus(
        apiKey,
        authenticatedUser.wallets.safeWalletAddress,
      );
      if (nextWalletSetupStatus === 'ready') {
        await pullGacha({ skipWalletReadyCheck: true });
        return;
      }
    } catch (error) {
      setWalletSetupStatus('error');
      setStatus(
        error instanceof Error
          ? `Wallet setup check failed: ${error.message}`
          : 'Wallet setup check failed.',
      );
    } finally {
      setPrimaryActionStatus('idle');
      setIsBusy(false);
    }
  }

  async function copySafeWalletAddress() {
    if (safeWalletAddress === null) return;

    try {
      await navigator.clipboard.writeText(safeWalletAddress);
      setStatus('Safe wallet address copied. Deposit USDT to this Safe.');
    } catch {
      setStatus(`Safe wallet address: ${safeWalletAddress}`);
    }
  }

  async function pullGacha(options: { skipWalletReadyCheck?: boolean } = {}) {
    if (secureClient === null || signer === null || apiKey === null) {
      setStatus('Connect and sign in before pulling.');
      return;
    }
    if (selectedSlug.length === 0) {
      setStatus('Select a gacha machine first.');
      return;
    }
    if (!options.skipWalletReadyCheck && !isWalletReady) {
      setStatus('Complete Safe wallet setup before ripping.');
      return;
    }

    setPrimaryActionStatus('ripping');
    setIsBusy(true);
    setPullResult(null);
    setBuybackFeedbackByCheckoutId({});
    setStreamEvents([]);
    setRevealedCardIds(new Set());
    try {
      await ensureExpectedWalletChain();
      let currentSafeWalletAddress = safeWalletAddress;
      if (currentSafeWalletAddress === null) {
        try {
          const authenticatedUser = await loadAuthenticatedUser(apiKey);
          currentSafeWalletAddress =
            authenticatedUser.wallets.safeWalletAddress;
        } catch {
          // Keep the pull flow moving; insufficient-balance handling will still
          // fetch the Safe address when it needs deposit guidance.
        }
      }

      setPullPhase('pulling');
      setStatus('Confirm wallet signature to start the pull.');
      const result = await secureClient.pullGacha({
        onEvent(event) {
          setStreamEvents((current) => [...current, event]);
          setStatus(getPullProgressMessage([event]));
        },
        machineSlug: selectedSlug,
        quantity,
      });
      if (isFailed(result)) {
        const error = getError(result);
        if (isInsufficientUsdtError(error)) {
          if (currentSafeWalletAddress === null) {
            try {
              const authenticatedUser = await loadAuthenticatedUser(apiKey);
              currentSafeWalletAddress =
                authenticatedUser.wallets.safeWalletAddress;
            } catch {
              // Keep the original insufficient-balance guidance visible.
            }
          }
          setSafeWalletAddress(currentSafeWalletAddress);
          setIsDepositModalOpen(true);
          setStatus('Insufficient USDT in your Safe. Deposit USDT and retry.');
        } else {
          setStatus(formatApiError(error));
        }
        setPullPhase('idle');
        return;
      }

      setPullResult(getValue(result));
      await loadBuybackOffers();
      await loadUserActivities();
      setPullPhase(selectedRipVideoUrl === null ? 'result' : 'ripVideo');
      setStatus(
        selectedRipVideoUrl === null
          ? 'Cards are ready.'
          : 'Cards are ready. Watch the pack rip reveal.',
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Pull failed.');
      setPullPhase('idle');
    } finally {
      setPrimaryActionStatus('idle');
      setIsBusy(false);
    }
  }

  async function acceptBuybackOffer(
    offer: GachaBuybackOffer,
    resultId = offer.checkoutId,
  ) {
    if (secureClient === null || signer === null) {
      setStatus('Connect and sign in before accepting buyback.');
      return;
    }
    if (!isWalletReady) {
      setStatus('Wait for Safe wallet setup before accepting buyback.');
      return;
    }

    setIsBusy(true);
    setBuybackFeedbackByCheckoutId((current) => ({
      ...current,
      [resultId]: {
        message: 'Confirm buyback signature in your wallet...',
        status: 'pending',
      },
    }));
    setStatus('Waiting for buyback signature...');
    try {
      await ensureExpectedWalletChain();
      const result = await secureClient.buybackGacha({
        offers: [offer],
      });
      if (isFailed(result)) {
        const message = formatApiError(getError(result));
        setBuybackFeedbackByCheckoutId((current) => ({
          ...current,
          [resultId]: {
            message,
            status: 'error',
          },
        }));
        setStatus(message);
        return;
      }

      const response = getValue(result);
      setBuybackFeedbackByCheckoutId((current) => ({
        ...current,
        [resultId]: {
          cardName: offer.cardName,
          frontImageUrl: offer.frontImageUrl,
          itemCount: response.itemCount,
          message: `Buyback accepted for ${offer.cardName}.`,
          status: 'success',
          tier: offer.tier,
          tokenId: offer.tokenId,
          totalAmountInUsdt: response.totalAmountInUsdt,
          txHash: response.txHash,
        },
      }));
      setStatus(`Buyback accepted for ${offer.cardName}.`);
      await loadBuybackOffers();
      await loadUserActivities();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Buyback failed.';
      setBuybackFeedbackByCheckoutId((current) => ({
        ...current,
        [resultId]: {
          message,
          status: 'error',
        },
      }));
      setStatus(message);
    } finally {
      setIsBusy(false);
    }
  }

  function revealResultCard(checkoutId: number) {
    setRevealedCardIds((current) => {
      const next = new Set(current);
      next.add(String(checkoutId));
      return next;
    });
  }

  function showPullResult() {
    setRevealedCardIds(
      new Set(resultCards.map(({ item }) => String(item.checkoutId))),
    );
    setPullPhase('result');
  }

  function shareBuybackSuccess(feedback: NonNullable<typeof buybackSuccess>) {
    const text = `I sold ${feedback.cardName} for ${formatUsdtPrice(
      feedback.totalAmountInUsdt,
    )} on Renaiss.`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  return (
    <main className={styles.shell}>
      <div className={styles.page}>
        <header className={styles.topBar}>
          <div className={styles.sessionCluster}>
            <button
              className={styles.debugButton}
              onClick={() => setIsDebugOpen(true)}
              type='button'
            >
              Debug
            </button>
            {isAuthenticated ? (
              <button
                className={styles.depositButton}
                disabled={safeWalletAddress === null}
                onClick={() => setIsDepositModalOpen(true)}
                type='button'
              >
                Deposit
              </button>
            ) : null}
            <span
              className={`${styles.sessionPill} ${
                isWalletConnected ? styles.sessionPillActive : ''
              }`}
            >
              {walletAddress === null
                ? 'Wallet disconnected'
                : compactAddress(walletAddress)}
            </span>
            <span
              className={`${styles.sessionPill} ${
                isAuthenticated ? styles.sessionPillActive : ''
              }`}
            >
              {isAuthenticated ? 'Signed in' : 'SIWE required'}
            </span>
            {isWalletConnected || isAuthenticated ? (
              <button
                className={styles.debugButton}
                disabled={isBusy}
                onClick={disconnectWallet}
                type='button'
              >
                Disconnect
              </button>
            ) : null}
          </div>
        </header>

        <nav className={styles.accountTabs} aria-label='Gacha account views'>
          {accountViews.map((view) => (
            <button
              aria-current={accountView === view.value ? 'page' : undefined}
              className={
                accountView === view.value
                  ? styles.accountTabActive
                  : styles.accountTab
              }
              key={view.value}
              onClick={() => setAccountView(view.value)}
              type='button'
            >
              {view.label}
              {view.value === 'activities' ? (
                <span>{userActivities.length}</span>
              ) : null}
              {view.value === 'offers' ? (
                <span>{buybackOffers.length}</span>
              ) : null}
            </button>
          ))}
        </nav>

        {accountView === 'gacha' ? (
          <>
            <section
              className={styles.packSection}
              aria-label='Active gacha machines'
            >
              {packs.length === 0 ? (
                <p className={styles.empty}>
                  {packError ?? 'No active gacha machines returned by the API.'}
                </p>
              ) : (
                <div className={styles.packRail}>
                  {packs.map((pack, index) => {
                    const isSelected = pack.slug === selectedSlug;
                    const bannerUrl = pack.packBannerVideoUrl;
                    return (
                      <button
                        aria-pressed={isSelected}
                        className={[
                          styles.packPromo,
                          styles[`packTone${(index % 4) + 1}`],
                          isSelected ? styles.selectedPackPromo : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        key={pack.slug}
                        onClick={() => setSelectedSlug(pack.slug)}
                        type='button'
                      >
                        {bannerUrl === null ? null : isVideoUrl(bannerUrl) ? (
                          <video
                            autoPlay
                            className={styles.packPromoMedia}
                            loop
                            muted
                            playsInline
                            src={bannerUrl}
                          />
                        ) : (
                          <Image
                            alt=''
                            className={styles.packPromoMedia}
                            fill
                            sizes='330px'
                            src={bannerUrl}
                            unoptimized
                          />
                        )}
                        <span className={styles.packPromoTop}>
                          <span className={styles.packTypePill}>
                            <span className={styles.liveDot} />
                            {formatPackTypeLabel(pack.packType)}
                          </span>
                          <span className={styles.stagePill}>
                            {formatStageLabel(pack.stage)}
                          </span>
                        </span>
                        <span className={styles.packPromoBody}>
                          <strong>{pack.name}</strong>
                          <small>{formatUsdtPrice(pack.priceInUsdt)}</small>
                        </span>
                        <span className={styles.packPromoBottom}>
                          <span>Top prize</span>
                          <b>{formatUsd(pack.featuredCardFmvInUsd)}</b>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <div className={styles.viewToolbar}>
              <section className={styles.statusBar} aria-live='polite'>
                <span>Status</span>
                <p>{status}</p>
              </section>
            </div>

            <section className={styles.experienceGrid}>
              <div className={`${styles.panel} ${styles.loadedPanel}`}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.eyebrow}>Inventory</p>
                    <h2>Machine contents</h2>
                  </div>
                  <span>{inspectedPack?.stage ?? 'unknown'}</span>
                </div>

                {selectedPack === null ? (
                  <p className={styles.empty}>Select a machine to inspect.</p>
                ) : (
                  <>
                    {packError !== null ? (
                      <p className={styles.errorText}>{packError}</p>
                    ) : null}

                    <div className={styles.loadedHeader}>
                      <h3>Pack contents</h3>
                      <span>
                        {previewContents.length > 0
                          ? `${previewContents.length} cards`
                          : `${formatUsd(selectedPack.featuredCardFmvInUsd)} top prize`}
                      </span>
                    </div>
                    {previewContents.length === 0 ? (
                      <p className={styles.empty}>
                        Card previews appear after machine contents load.
                      </p>
                    ) : (
                      <div className={styles.machineCardGrid}>
                        {previewContentCards.map(({ item, key }) => (
                          <article className={styles.machineCard} key={key}>
                            <div className={styles.machineCardImage}>
                              {item.frontImageUrl === null ? (
                                <span
                                  className={`${styles.cardFrame} ${tierClassName(
                                    item.tier,
                                  )}`}
                                >
                                  <b>{item.tier}</b>
                                </span>
                              ) : (
                                <Image
                                  alt={item.name}
                                  height={210}
                                  src={item.frontImageUrl}
                                  unoptimized
                                  width={150}
                                />
                              )}
                            </div>
                            <strong>{item.name}</strong>
                            <span>{formatUsd(item.buybackBaseValueInUsd)}</span>
                          </article>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className={`${styles.panel} ${styles.machinePanel}`}>
                <div className={styles.machineBanner}>
                  {selectedMachineMediaUrl === null ? null : isVideoUrl(
                      selectedMachineMediaUrl,
                    ) ? (
                    <video
                      autoPlay
                      className={styles.machineVideo}
                      loop
                      muted
                      playsInline
                      preload='auto'
                      src={selectedMachineMediaUrl}
                    />
                  ) : (
                    <Image
                      alt={`${selectedPack?.name ?? 'Gacha'} vending machine`}
                      className={styles.machineVideo}
                      height={900}
                      src={selectedMachineMediaUrl}
                      unoptimized
                      width={900}
                    />
                  )}
                </div>

                <div className={styles.machineControls}>
                  <div className={styles.machineTitleRow}>
                    <div>
                      <h2>{selectedPack?.name ?? 'No machine selected'}</h2>
                      <span>{formatPackTypeLabel(selectedPack?.packType)}</span>
                    </div>
                    <div className={styles.priceStack}>
                      <strong>
                        {formatUsdtPrice(selectedPack?.priceInUsdt)}/machine
                      </strong>
                      <span>
                        Expected value{' '}
                        <b>{formatUsd(selectedPack?.expectedValueInUsd)}</b>
                      </span>
                    </div>
                  </div>

                  <div className={styles.machineStats}>
                    <div>
                      <span>Pack contains</span>
                      <strong>
                        {quantity} Card{quantity > 1 ? 's' : ''}
                      </strong>
                    </div>
                    <div>
                      <span>Instant buyback</span>
                      <strong>{selectedInstantBuybackPercentage}%</strong>
                    </div>
                  </div>

                  <div className={styles.walletActions}>
                    <button
                      className={styles.secondaryButton}
                      disabled={isBusy}
                      onClick={connectWallet}
                      type='button'
                    >
                      {walletAddress === null
                        ? 'Connect wallet'
                        : compactAddress(walletAddress)}
                    </button>
                    <button
                      className={styles.secondaryButton}
                      disabled={isBusy || signer === null || apiKey !== null}
                      onClick={signIn}
                      type='button'
                    >
                      {apiKey === null ? 'Sign in' : 'Signed in'}
                    </button>
                    <span className={styles.walletSetupStatus}>
                      {walletSetupLabel}
                    </span>
                  </div>

                  <fieldset className={styles.quantityGroup}>
                    <legend className={styles.visuallyHidden}>
                      Pack quantity
                    </legend>
                    {quantityOptions.map((option) => (
                      <button
                        aria-pressed={option === quantity}
                        className={
                          option === quantity
                            ? styles.selectedQuantityButton
                            : styles.quantityButton
                        }
                        key={option}
                        onClick={() => setQuantity(option)}
                        type='button'
                      >
                        {option}x
                      </button>
                    ))}
                  </fieldset>

                  <button
                    className={
                      isPulling
                        ? `${styles.primaryButton} ${styles.rippingButton}`
                        : styles.primaryButton
                    }
                    disabled={
                      isBusy ||
                      secureClient === null ||
                      signer === null ||
                      primaryActionStatus !== 'idle' ||
                      isWalletSetupInFlight
                    }
                    onClick={handlePrimaryGachaAction}
                    type='button'
                  >
                    {pullButtonText}
                  </button>

                  <div className={styles.packInfo}>
                    <span>Pack info</span>
                    <p>
                      {selectedPack?.description ??
                        'This machine uses the Renaiss gacha flow with wallet sign-in, pull streaming, and buyback settlement through the SDK.'}
                    </p>
                  </div>

                  <div className={styles.machineStatList}>
                    {tierSummaries.length === 0 ? (
                      <p className={styles.empty}>
                        Tier breakdown appears after machine details load.
                      </p>
                    ) : (
                      tierSummaries.map((summary) => (
                        <div key={summary.tier}>
                          <span
                            className={`${styles.rarityDot} ${tierClassName(
                              summary.name,
                            )}`}
                          />
                          <strong>{formatTierLabel(summary.name)}</strong>
                          <b>{formatChance(summary.chance)}</b>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : accountView === 'activities' ? (
          <section className={styles.accountPage} aria-label='User activities'>
            <div className={styles.accountPageHeader}>
              <div>
                <p className={styles.eyebrow}>Activities</p>
                <h1>Gacha history</h1>
              </div>
              <button
                className={`${styles.secondaryButton} ${styles.accountRefreshButton}`}
                disabled={secureClient === null || isActivitiesLoading}
                onClick={() => {
                  void loadUserActivities();
                }}
                type='button'
              >
                {isActivitiesLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            <div className={styles.accountFilterBar}>
              {activityFilters.map((filter) => (
                <button
                  aria-pressed={activityFilter === filter.value}
                  className={
                    activityFilter === filter.value
                      ? styles.filterChipActive
                      : styles.filterChip
                  }
                  key={filter.value}
                  onClick={() => setActivityFilter(filter.value)}
                  type='button'
                >
                  {filter.label}
                  <span>
                    {
                      userActivities.filter(
                        (activity) =>
                          isVisibleAccountActivity(activity) &&
                          activityMatchesFilter(activity, filter.value),
                      ).length
                    }
                  </span>
                </button>
              ))}
            </div>

            {secureClient === null ? (
              <div className={styles.accountEmptyState}>
                <strong>Sign in to view your activities.</strong>
                <div className={styles.accountEmptyActions}>
                  <button
                    className={styles.secondaryButton}
                    disabled={isBusy}
                    onClick={connectWallet}
                    type='button'
                  >
                    {walletAddress === null
                      ? 'Connect wallet'
                      : compactAddress(walletAddress)}
                  </button>
                  <button
                    className={styles.primaryButton}
                    disabled={isBusy || signer === null || apiKey !== null}
                    onClick={signIn}
                    type='button'
                  >
                    {apiKey === null ? 'Sign in' : 'Signed in'}
                  </button>
                </div>
              </div>
            ) : visibleAccountActivities.length === 0 ? (
              <p className={styles.empty}>
                {isActivitiesLoading
                  ? 'Loading activities...'
                  : 'No gacha pull or buyback activity returned yet.'}
              </p>
            ) : (
              <div className={styles.activityTableWrap}>
                <table className={styles.activityTable}>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Items</th>
                      <th>Value</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAccountActivities.map((activity) => (
                      <tr key={`${activity.txHash}-${activity.ordinal}`}>
                        <td>
                          <span
                            className={
                              buybackActivityTypes.has(activity.type)
                                ? styles.actionBadgeBuyback
                                : styles.actionBadgeGacha
                            }
                          >
                            {getActivityActionLabel(activity)}
                          </span>
                        </td>
                        <td>
                          <div className={styles.activityItem}>
                            <span className={styles.activityItemImage}>
                              {activity.item === undefined ? (
                                <b>?</b>
                              ) : (
                                <Image
                                  alt={activity.item.title}
                                  height={64}
                                  src={activity.item.imageUrl}
                                  unoptimized
                                  width={46}
                                />
                              )}
                            </span>
                            <span>
                              <strong>
                                {activity.item?.title ?? 'Gacha item'}
                              </strong>
                              <small>
                                {activity.item?.subtitle ??
                                  `Tx ${compactAddress(activity.txHash)}`}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td>{getActivityValue(activity)}</td>
                        <td>{compactAddress(activity.user)}</td>
                        <td>{getActivityDestination(activity)}</td>
                        <td>{formatRelativeDate(activity.occurredAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <section className={styles.accountPage} aria-label='Buyback offers'>
            <div className={styles.accountPageHeader}>
              <div>
                <p className={styles.eyebrow}>Offers</p>
                <h1>Buyback offers</h1>
              </div>
              <button
                className={`${styles.secondaryButton} ${styles.accountRefreshButton}`}
                disabled={secureClient === null || isOffersLoading}
                onClick={() => {
                  void loadBuybackOffers();
                }}
                type='button'
              >
                {isOffersLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            <div className={styles.offerToolbar}>
              <label className={styles.searchField}>
                <span className={styles.visuallyHidden}>Search offers</span>
                <input
                  onChange={(event) => setOfferSearch(event.target.value)}
                  placeholder='Search cards by name, set, or token'
                  type='search'
                  value={offerSearch}
                />
              </label>
              <span className={styles.offerCount}>
                {visibleAccountOffers.length} available
              </span>
            </div>

            {secureClient === null ? (
              <div className={styles.accountEmptyState}>
                <strong>Sign in to view buyback offers.</strong>
                <div className={styles.accountEmptyActions}>
                  <button
                    className={styles.secondaryButton}
                    disabled={isBusy}
                    onClick={connectWallet}
                    type='button'
                  >
                    {walletAddress === null
                      ? 'Connect wallet'
                      : compactAddress(walletAddress)}
                  </button>
                  <button
                    className={styles.primaryButton}
                    disabled={isBusy || signer === null || apiKey !== null}
                    onClick={signIn}
                    type='button'
                  >
                    {apiKey === null ? 'Sign in' : 'Signed in'}
                  </button>
                </div>
              </div>
            ) : visibleAccountOffers.length === 0 ? (
              <p className={styles.empty}>
                {isOffersLoading
                  ? 'Loading buyback offers...'
                  : 'No buyback offers match this view.'}
              </p>
            ) : (
              <div className={styles.offerCardList}>
                {visibleAccountOffers.map((offer) => {
                  const feedback =
                    buybackFeedbackByCheckoutId[offer.checkoutId];
                  return (
                    <article
                      className={styles.offerCard}
                      key={offer.checkoutId}
                    >
                      <div className={styles.offerCardImage}>
                        {offer.frontImageUrl === null ? (
                          <span
                            className={`${styles.cardFrame} ${tierClassName(
                              offer.tier,
                            )}`}
                          >
                            <b>{offer.tier ?? '?'}</b>
                          </span>
                        ) : (
                          <Image
                            alt={offer.cardName}
                            height={240}
                            src={offer.frontImageUrl}
                            unoptimized
                            width={172}
                          />
                        )}
                      </div>
                      <div className={styles.offerCardBody}>
                        <div className={styles.offerCardTitleRow}>
                          <span
                            className={`${styles.rarityDot} ${tierClassName(
                              offer.tier,
                            )}`}
                            aria-hidden='true'
                          />
                          <span>{offer.tier ?? 'Card'}</span>
                          <b>FMV {formatUsd(offer.buybackBaseValueInUsd)}</b>
                        </div>
                        <h2>{offer.cardName}</h2>
                        <div className={styles.offerValueBar}>
                          <span>Buyback offer</span>
                          <strong>{formatUsd(offer.buybackAmountInUsd)}</strong>
                        </div>
                        <button
                          className={styles.primaryButton}
                          disabled={
                            isBusy ||
                            !isWalletReady ||
                            feedback?.status === 'pending'
                          }
                          onClick={() => {
                            void acceptBuybackOffer(offer);
                          }}
                          type='button'
                        >
                          {feedback?.status === 'pending'
                            ? 'Accepting...'
                            : `Accept for ${formatUsd(
                                offer.buybackAmountInUsd,
                              )}`}
                        </button>
                        <span className={styles.offerExpiry}>
                          {feedback?.status === 'error'
                            ? feedback.message
                            : formatOfferExpiry(offer.expiresAt)}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {pullPhase === 'ripVideo' &&
        pullResult !== null &&
        selectedRipVideoUrl !== null ? (
          <div
            aria-label='Opening gacha machine'
            aria-modal='true'
            className={styles.pullOverlay}
            role='dialog'
          >
            <div className={styles.pullLoader}>
              <video
                autoPlay
                className={styles.ripVideo}
                muted
                onEnded={showPullResult}
                playsInline
                preload='auto'
                src={selectedRipVideoUrl}
              />
              <button
                className={styles.skipRipButton}
                onClick={showPullResult}
                type='button'
              >
                Skip <span aria-hidden='true'>&gt;</span>
              </button>
              <div className={styles.ripProgress} aria-hidden='true'>
                {[
                  'Permit',
                  'Open machine',
                  'Resolve draw',
                  'Release token',
                ].map((step, index) => (
                  <span
                    className={
                      streamEvents.length > index
                        ? styles.ripProgressDotActive
                        : styles.ripProgressDot
                    }
                    key={step}
                  />
                ))}
              </div>
              <p className={styles.visuallyHidden}>
                Opening machine. Waiting for the pull stream to resolve, release
                the token, and refresh buyback offers.
              </p>
            </div>
          </div>
        ) : null}

        {pullPhase === 'result' && pullResult !== null ? (
          <div aria-modal='true' className={styles.resultOverlay} role='dialog'>
            {buybackSuccess === null ? (
              <div className={styles.resultModal}>
                <div className={styles.resultHeader}>
                  <div>
                    <p className={styles.eyebrow}>Reveal</p>
                    <h2>
                      {unrevealedResultCount > 0
                        ? 'Click to reveal'
                        : 'Pull result'}
                    </h2>
                  </div>
                  <div className={styles.resultActions}>
                    {unrevealedResultCount > 0 ? (
                      <button
                        className={styles.secondaryButton}
                        onClick={() => {
                          setRevealedCardIds(
                            new Set(
                              resultCards.map(({ item }) =>
                                String(item.checkoutId),
                              ),
                            ),
                          );
                        }}
                        type='button'
                      >
                        Reveal all
                      </button>
                    ) : null}
                    <button
                      aria-label='Close pull result'
                      className={styles.closeButton}
                      onClick={() => setPullPhase('idle')}
                      type='button'
                    >
                      x
                    </button>
                  </div>
                </div>

                <div className={styles.resultCardGrid}>
                  {resultCards.map(({ item, offer }) => {
                    const resultId = String(item.checkoutId);
                    const isRevealed = revealedCardIds.has(resultId);
                    const buybackFeedback =
                      buybackFeedbackByCheckoutId[resultId];

                    return (
                      <article className={styles.resultCard} key={resultId}>
                        <button
                          aria-pressed={isRevealed}
                          className={
                            isRevealed
                              ? styles.revealedCardButton
                              : styles.hiddenCardButton
                          }
                          onClick={() => revealResultCard(item.checkoutId)}
                          type='button'
                        >
                          {offer?.frontImageUrl ? (
                            <Image
                              alt={offer.cardName}
                              height={420}
                              src={offer.frontImageUrl}
                              unoptimized
                              width={300}
                            />
                          ) : (
                            <span
                              className={`${styles.resultCardFallback} ${tierClassName(
                                offer?.tier,
                              )}`}
                            >
                              {offer?.tier ?? '?'}
                            </span>
                          )}
                          {!isRevealed ? (
                            <span className={styles.revealPrompt}>
                              Click to reveal
                            </span>
                          ) : null}
                        </button>

                        {isRevealed ? (
                          <div className={styles.resultCardBody}>
                            <strong>
                              {offer?.cardName ?? item.collectible.name}
                            </strong>
                            <span>Token #{item.collectible.tokenId}</span>
                            {buybackFeedback?.status === 'pending' ? (
                              <div className={styles.resultBox}>
                                <strong>Submitting buyback</strong>
                                <span>{buybackFeedback.message}</span>
                              </div>
                            ) : buybackFeedback?.status === 'error' ? (
                              <div className={styles.resultBox}>
                                <strong>Buyback failed</strong>
                                <span>{buybackFeedback.message}</span>
                              </div>
                            ) : offer === null ? (
                              <p>
                                Buyback offer is not available yet. Refresh the
                                Buyback tab if the API is still indexing it.
                              </p>
                            ) : (
                              <div className={styles.offerRibbon}>
                                <span>
                                  Instant offer{' '}
                                  <b>{formatUsdt(offer.buybackAmountInUsdt)}</b>
                                </span>
                                <button
                                  className={styles.primaryButton}
                                  disabled={isBusy}
                                  onClick={() => {
                                    void acceptBuybackOffer(offer, resultId);
                                  }}
                                  type='button'
                                >
                                  {isBusy ? 'Processing...' : 'Accept offer'}
                                </button>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>

                <div className={styles.resultFooter}>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => setPullPhase('idle')}
                    type='button'
                  >
                    Back to gacha
                  </button>
                  <button
                    className={styles.primaryButton}
                    disabled={isBusy || secureClient === null}
                    onClick={() => {
                      void pullGacha();
                    }}
                    type='button'
                  >
                    Rip again
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`${styles.resultModal} ${styles.buybackSuccessModal}`}
              >
                <button
                  aria-label='Close buyback success'
                  className={`${styles.closeButton} ${styles.buybackSuccessCloseButton}`}
                  onClick={() => setPullPhase('idle')}
                  type='button'
                >
                  x
                </button>
                <h2 className={styles.buybackSuccessTitle}>
                  You successfully sold the item for{' '}
                  <strong>
                    {formatUsdtPrice(buybackSuccess.totalAmountInUsdt)}
                  </strong>
                  .
                </h2>
                <div className={styles.buybackSuccessMedia}>
                  {buybackSuccess.frontImageUrl === null ? (
                    <span
                      className={`${styles.resultCardFallback} ${
                        styles.buybackSuccessFallback
                      } ${tierClassName(buybackSuccess.tier)}`}
                    >
                      {buybackSuccess.tier ?? '?'}
                    </span>
                  ) : (
                    <Image
                      alt={buybackSuccess.cardName}
                      height={520}
                      src={buybackSuccess.frontImageUrl}
                      unoptimized
                      width={372}
                    />
                  )}
                  <button
                    className={styles.shareButton}
                    onClick={() => shareBuybackSuccess(buybackSuccess)}
                    type='button'
                  >
                    Share to X
                  </button>
                </div>
                <h3 className={styles.buybackSuccessCardName}>
                  {buybackSuccess.cardName}
                </h3>
                <div className={styles.buybackSuccessActions}>
                  <button
                    className={styles.primaryButton}
                    disabled={isBusy || secureClient === null}
                    onClick={() => {
                      void pullGacha();
                    }}
                    type='button'
                  >
                    Rip Another Pack For{' '}
                    {formatUsdtPrice(selectedPackTotalPrice)}
                  </button>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => setPullPhase('idle')}
                    type='button'
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {isDebugOpen ? (
          <div aria-modal='true' className={styles.debugOverlay} role='dialog'>
            <div className={styles.debugPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.eyebrow}>Debug</p>
                  <h2>Pull stream</h2>
                </div>
                <button
                  aria-label='Close debug overlay'
                  className={styles.closeButton}
                  onClick={() => setIsDebugOpen(false)}
                  type='button'
                >
                  x
                </button>
              </div>
              <div className={styles.timeline}>
                {streamEvents.length === 0 ? (
                  <p className={styles.empty}>Stream events appear here.</p>
                ) : (
                  streamEvents.map((event) => (
                    <div
                      className={styles.timelineItem}
                      key={`${event.id}-${event.status}-${event.data.action}`}
                    >
                      <span>{event.status}</span>
                      <p>{eventLabel(event)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {isDepositModalOpen ? (
          <div
            aria-label='Deposit USDT to Safe'
            aria-modal='true'
            className={styles.resultOverlay}
            role='dialog'
          >
            <div className={styles.depositModal}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.eyebrow}>Deposit</p>
                  <h2>Deposit USDT to your Safe</h2>
                </div>
                <button
                  aria-label='Close deposit dialog'
                  className={styles.closeButton}
                  onClick={() => setIsDepositModalOpen(false)}
                  type='button'
                >
                  x
                </button>
              </div>
              <p className={styles.depositHelp}>
                Your gacha pulls spend USDT from this Safe wallet. Send enough
                USDT to the address below, then try ripping again.
              </p>
              <div className={styles.depositAddressBox}>
                <span>Safe wallet address</span>
                <strong>
                  {safeWalletAddress ?? 'Safe wallet unavailable'}
                </strong>
              </div>
              <div className={styles.resultActions}>
                <button
                  className={styles.primaryButton}
                  disabled={safeWalletAddress === null}
                  onClick={() => {
                    void copySafeWalletAddress();
                  }}
                  type='button'
                >
                  Copy address
                </button>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setIsDepositModalOpen(false)}
                  type='button'
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
