/** Maps public API fields to screen elements, signing checks and pagination. */
export type FieldStatus = 'shown' | 'sdk' | 'derived' | 'unused';
export type FieldUse = { field: string; status: FieldStatus; use: string };
export type EndpointCoverage = {
  id: string;
  endpoint: string;
  sdk: string;
  fields: FieldUse[];
};

const machineFields: FieldUse[] = [
  { field: 'id', status: 'sdk', use: 'React key; packId for prepare' },
  {
    field: 'slug',
    status: 'shown',
    use: 'Deep link ?machine=',
  },
  { field: 'name', status: 'shown', use: 'List card title; detail header' },
  {
    field: 'packType',
    status: 'shown',
    use: '"Infinite" (v3) / "Limited" (v3-limited) badge; list grouping',
  },
  {
    field: 'stage',
    status: 'shown',
    use: 'Live / Soon / Reloading / Sold out pill; enables the rip button',
  },
  {
    field: 'description',
    status: 'shown',
    use: 'Detail "Pack info"',
  },
  {
    field: 'priceInUsdt',
    status: 'shown',
    use: 'Price per pack; rip button total × quantity',
  },
  {
    field: 'expectedValueInUsd',
    status: 'unused',
    use: "Not displayed; list cards show the detail's activeSetExpectedValueInUsd",
  },
  {
    field: 'onChainPackId',
    status: 'sdk',
    use: 'Permit witness consistency check',
  },
  {
    field: 'vendingMachineAddress',
    status: 'sdk',
    use: 'Permit spender check; buyback EIP-712 domain',
  },
  {
    field: 'packBannerVideoUrl',
    status: 'shown',
    use: 'Hero background of a limited machine on the list page',
  },
  {
    field: 'gachaMachineVideoUrl',
    status: 'shown',
    use: 'Machine media on list card and detail (.webp or .mp4)',
  },
  {
    field: 'gachaRippingPackAnimationVideoUrl',
    status: 'unused',
    use: 'Not displayed',
  },
];

export const coverage: EndpointCoverage[] = [
  {
    id: 'packs',
    endpoint: 'GET /v2/gacha/packs',
    sdk: 'listGachaMachines()',
    fields: [
      ...machineFields.map((f) => ({ ...f, field: `cardPacks[].${f.field}` })),
      { field: 'pagination.total', status: 'sdk', use: 'Page count' },
      { field: 'pagination.limit', status: 'sdk', use: 'Cursor encoding' },
      { field: 'pagination.offset', status: 'sdk', use: 'Cursor encoding' },
      { field: 'pagination.hasMore', status: 'sdk', use: 'Next cursor' },
    ],
  },
  {
    id: 'pack',
    endpoint: 'GET /v2/gacha/packs/{slug}',
    sdk: 'fetchGachaMachine()',
    fields: [
      ...machineFields.map((f) => ({ ...f, field: `cardPack.${f.field}` })),
      {
        field: 'cardPack.tiers[].tier',
        status: 'derived',
        use: 'Sort order, highest first',
      },
      {
        field: 'cardPack.tiers[].name',
        status: 'shown',
        use: '"Tier S" pill label and colour',
      },
      {
        field: 'cardPack.tiers[].chance',
        status: 'shown',
        use: '"<1%" / "3%" on the pill (share of the whole set)',
      },
      {
        field: 'cardPack.tiers[].priceRangeInUsd.min',
        status: 'shown',
        use: '"$min–$max+" pill range; lower bound of the grid tier filter',
      },
      {
        field: 'cardPack.tiers[].priceRangeInUsd.max',
        status: 'shown',
        use: 'Pill range (rounded down to a whole $100 with "+" on the top tier); grid filter upper bound',
      },
      {
        field: 'cardPack.activeSetExpectedValueInUsd',
        status: 'shown',
        use: 'Detail and list "Set EV" chip (mean value of the whole set, drawn cards included)',
      },
      {
        field: 'cardPack.buybackConfig[]',
        status: 'derived',
        use: 'The smallest window is the current tier: "Instant buyback" percentage cell. The largest is the longest: pull-history hint ("after their buyback offer period"); offer expiry window',
      },
    ],
  },
  {
    id: 'content',
    endpoint: 'GET /v2/gacha/packs/{slug}/content',
    sdk: 'listGachaMachineContents()',
    fields: [
      {
        field: 'collectibles[].name',
        status: 'shown',
        use: 'Showcase caption; tile title',
      },
      {
        field: 'collectibles[].tier',
        status: 'derived',
        use: 'Tier filter, applied in the browser over every loaded page',
      },
      {
        field: 'collectibles[].buybackBaseValueInUsd',
        status: 'shown',
        use: '"Buyback base value $X" pill; sort key',
      },
      {
        field: 'collectibles[].frontImageUrl',
        status: 'shown',
        use: 'Slab render in the grid',
      },
      {
        field: 'collectibles[].{type,fmvInUsd,fmvUpdatedAt,attributes}',
        status: 'unused',
        use: 'Not displayed: category, market value and attributes for a collectible popup',
      },
      {
        field: 'pagination.total',
        status: 'shown',
        use: 'Catalog entry count',
      },
      { field: 'pagination.limit', status: 'sdk', use: 'Cursor' },
      { field: 'pagination.offset', status: 'sdk', use: 'Cursor' },
      { field: 'pagination.hasMore', status: 'sdk', use: '"Load more"' },
    ],
  },
  {
    id: 'pull-history',
    endpoint: 'GET /v2/gacha/packs/{slug}/pull-history',
    sdk: 'listGachaPullHistory()',
    fields: [
      { field: 'pulls[].tokenId', status: 'sdk', use: 'React key' },
      { field: 'pulls[].name', status: 'shown', use: 'Thumbnail title/alt' },
      {
        field: 'pulls[].tier',
        status: 'shown',
        use: '"Tier C" coloured label',
      },
      {
        field: 'pulls[].buybackBaseValueInUsd',
        status: 'shown',
        use: '"Buyback base value $X" pill',
      },
      {
        field: 'pulls[].frontImageUrl',
        status: 'shown',
        use: 'Slab thumbnail',
      },
      {
        field: 'pulls[].imageUrl',
        status: 'unused',
        use: 'The card alone (no slab, frame or background). The demo keeps the slab thumbnail',
      },
      { field: 'pagination.limit', status: 'sdk', use: 'Cursor' },
      { field: 'pagination.offset', status: 'sdk', use: 'Cursor' },
      { field: 'pagination.hasMore', status: 'sdk', use: 'Cursor' },
    ],
  },
  {
    id: 'prepare',
    endpoint: 'POST /v2/gacha/pull/prepare',
    sdk: 'prepareGachaPull()',
    fields: [
      {
        field: 'chainId',
        status: 'shown',
        use: 'expectedChainId guard; configured-network wallet message',
      },
      {
        field: 'buyerWalletAddress',
        status: 'sdk',
        use: 'Must equal the signer',
      },
      {
        field: 'pack.id',
        status: 'sdk',
        use: 'Must equal the selected machine (also read from the machine detail)',
      },
      {
        field: 'pack.onChainPackId',
        status: 'sdk',
        use: 'Witness check (also read from the machine detail)',
      },
      {
        field: 'pack.priceInUsdt',
        status: 'sdk',
        use: 'amountPerToken check (also read from the machine detail)',
      },
      {
        field: 'pack.vendingMachineAddress',
        status: 'sdk',
        use: 'Permit spender check (also read from the machine detail)',
      },
      {
        field: 'approval.token',
        status: 'shown',
        use: 'ERC-20 balance/allowance reads; configured token label',
      },
      {
        field: 'approval.spender',
        status: 'derived',
        use: 'Permit2 allowance target',
      },
      {
        field: 'approval.requiredAmount',
        status: 'shown',
        use: 'Balance check; rip button total',
      },
      { field: 'permit2TypedData.domain', status: 'sdk', use: 'Signed' },
      { field: 'permit2TypedData.types', status: 'sdk', use: 'Signed' },
      { field: 'permit2TypedData.primaryType', status: 'sdk', use: 'Signed' },
      {
        field: 'permit2TypedData.message',
        status: 'sdk',
        use: 'Signed; cross-checked against unsignedPullPayload',
      },
      { field: 'unsignedPullPayload.packId', status: 'sdk', use: 'Submitted' },
      {
        field: 'unsignedPullPayload.builderCode',
        status: 'sdk',
        use: 'Signed in the witness, stripped before submit',
      },
      {
        field: 'unsignedPullPayload.numOfTokens',
        status: 'sdk',
        use: 'Submitted',
      },
      {
        field: 'unsignedPullPayload.amountPerToken',
        status: 'sdk',
        use: 'Submitted',
      },
      {
        field: 'unsignedPullPayload.nonce',
        status: 'sdk',
        use: 'Submitted; recovery journal',
      },
      {
        field: 'unsignedPullPayload.deadline',
        status: 'shown',
        use: 'Submitted; "signature valid until" in the developer log',
      },
    ],
  },
  {
    id: 'stream',
    endpoint: 'POST /v2/gacha/pull/stream (SSE)',
    sdk: 'submitGachaPull()',
    fields: [
      {
        field: 'pull_started / payment_queued / payment_submitting',
        status: 'shown',
        use: 'Rip button label stages',
      },
      { field: '*.data.message', status: 'shown', use: 'Button label text' },
      {
        field: '*.data.{buyerWalletAddress,packId,nonce,numOfTokens}',
        status: 'sdk',
        use: 'Stream must match the submitted pull',
      },
      {
        field: 'payment_confirmed.data.permitFundTxHash',
        status: 'shown',
        use: 'Recovery journal; BscScan link',
      },
      {
        field: 'draws_resolved.data.draws[].settlementId',
        status: 'derived',
        use: 'Matches the buyback offer; buybackIds',
      },
      {
        field: 'draws_resolved.data.draws[].tokenId',
        status: 'shown',
        use: 'Short token id under the card',
      },
      {
        field: 'draws_resolved.data.draws[].releaseTxHash',
        status: 'shown',
        use: 'History "Released ↗" (null at reveal time)',
      },
      {
        field: 'draws_resolved.data.draws[].buybackTxHash',
        status: 'shown',
        use: 'History "Sold ↗" (null at reveal time)',
      },
      {
        field: 'draws_resolved.data.draws[].collectible.name',
        status: 'shown',
        use: 'Reveal card name',
      },
      {
        field: 'draws_resolved.data.draws[].tier',
        status: 'shown',
        use: '"You got a C-tier card!"',
      },
      {
        field: 'draws_resolved.data.draws[].buybackBaseValueInUSD',
        status: 'shown',
        use: '"Buyback base value $X"; instant buyback %',
      },
      {
        field:
          'draws_resolved.data.draws[].collectible.{type,fmvInUsd,fmvUpdatedAt,attributes}',
        status: 'unused',
        use: 'Not displayed',
      },
      {
        field: 'draws_resolved.data.draws[].collectible.frontImageUrl',
        status: 'shown',
        use: 'Reveal image: graded PSA slab, including its label',
      },
      {
        field:
          'draws_resolved.data.{permitFundTxHash,packId,packName,status,numOfTokens,pulledAt}',
        status: 'shown',
        use: 'Same shape as wallet history',
      },
      {
        field: 'pull_failed.data.{code,error}',
        status: 'shown',
        use: 'Error banner',
      },
      {
        field: 'pull_failed.data.{permitFundTxHash,fundingConfirmed}',
        status: 'shown',
        use: 'Recovery banner',
      },
    ],
  },
  {
    id: 'wallet-history',
    endpoint:
      'GET /v2/gacha/pull-history?buyerWalletAddress  ·  GET /v2/gacha/draw-status',
    sdk: 'listWalletPulls()  ·  fetchGachaDrawStatus()',
    fields: [
      {
        field: 'pulls[].permitFundTxHash',
        status: 'shown',
        use: 'BscScan link; recovery lookup key',
      },
      {
        field: 'pulls[].buyerWalletAddress',
        status: 'sdk',
        use: 'Echo of the query',
      },
      {
        field: 'pulls[].packId',
        status: 'derived',
        use: 'Machine lookup',
      },
      { field: 'pulls[].packName', status: 'shown', use: 'Row title' },
      {
        field: 'pulls[].status',
        status: 'shown',
        use: 'RESOLVED / PENDING_RESOLUTION',
      },
      { field: 'pulls[].numOfTokens', status: 'shown', use: '"1 card"' },
      { field: 'pulls[].pulledAt', status: 'shown', use: 'Row timestamp' },
      {
        field: 'pulls[].draws[].settlementId',
        status: 'derived',
        use: 'Offer match',
      },
      {
        field: 'pulls[].draws[].tokenId',
        status: 'shown',
        use: 'Short token id',
      },
      {
        field: 'pulls[].draws[].releaseTxHash',
        status: 'shown',
        use: '"Released ↗"',
      },
      {
        field: 'pulls[].draws[].buybackTxHash',
        status: 'shown',
        use: '"Sold ↗"',
      },
      { field: 'limit / offset / hasMore', status: 'sdk', use: 'Cursor' },
    ],
  },
  {
    id: 'offers',
    endpoint: 'GET /v2/gacha/buyback/offers',
    sdk: 'fetchGachaBuybackOffers()',
    fields: [
      {
        field: 'offers',
        status: 'sdk',
        use: 'Read in pages of 100 and joined into one list',
      },
      {
        field: 'offers[].cardPackId',
        status: 'sdk',
        use: 'Offers in one buyback must share a pack',
      },
      {
        field: 'offers[].settlementId',
        status: 'sdk',
        use: 'buybackIds; matches a draw',
      },
      {
        field: 'offers[].tokenId',
        status: 'derived',
        use: 'Matches a reveal / history row',
      },
      {
        field: 'offers[].buybackTiers[].buybackPercentage',
        status: 'shown',
        use: '"90% Instant buyback" (current tier)',
      },
      {
        field: 'offers[].buybackTiers[].amountInUsdt',
        status: 'shown',
        use: '"Accept for $X" (current tier); signed amount',
      },
      {
        field: 'offers[].buybackTiers[].expiresAt',
        status: 'shown',
        use: '"Price changes in" / "Offer expires in MM:SS"',
      },
      {
        field: 'offers[].vendingMachineAddress',
        status: 'sdk',
        use: 'EIP-712 verifying contract',
      },
    ],
  },
  {
    id: 'buyback',
    endpoint: 'POST /v2/gacha/buyback',
    sdk: 'submitGachaBuyback()',
    fields: [
      { field: 'txHash', status: 'shown', use: 'BscScan link' },
      { field: 'totalAmountInUsdt', status: 'shown', use: '"Sold for $X"' },
      {
        field: 'itemCount',
        status: 'shown',
        use: '"Successfully sold N card(s)"',
      },
    ],
  },
];

/** Every dotted key path in a JSON value; arrays contribute `key[]`. */
export function collectPaths(
  value: unknown,
  prefix = '',
  out = new Set<string>(),
) {
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 25))
      collectPaths(item, `${prefix}[]`, out);
    if (value.length === 0 && prefix) out.add(prefix);
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (child && typeof child === 'object') collectPaths(child, path, out);
      else out.add(path);
    }
    return out;
  }
  if (prefix) out.add(prefix);
  return out;
}

/** Wire paths that no coverage row describes, so new API fields surface here. */
export function unmappedPaths(id: string, wire: unknown) {
  const entry = coverage.find((c) => c.id === id);
  if (!entry) return [];
  const known = entry.fields.map((f) => f.field);
  return [...collectPaths(wire)].filter(
    (path) =>
      !known.some(
        (field) =>
          path === field ||
          path.startsWith(`${field}.`) ||
          path.startsWith(`${field}[]`),
      ),
  );
}
