/**
 * Public API field usage in this SDK example.
 *
 * Statuses:
 * - shown      rendered in this demo
 * - sdk        consumed by the SDK for validation or pagination only
 * - derived    not rendered directly; feeds a computed value or an action
 * - unused     neither rendered nor needed by the SDK
 */
export type FieldStatus = 'shown' | 'sdk' | 'derived' | 'unused';
export type FieldUse = {
  field: string;
  status: FieldStatus;
  use: string;
};
export type EndpointId = 'list' | 'detail' | 'orders' | 'config';
export type EndpointCoverage = {
  id: EndpointId;
  endpoint: string;
  sdk: string;
  fields: FieldUse[];
};

export const coverage: EndpointCoverage[] = [
  {
    id: 'list',
    endpoint: 'GET /v2/marketplace',
    sdk: 'listMarketplaceCards()',
    fields: [
      {
        field: 'collection[].tokenId',
        status: 'shown',
        use: 'React key; deep link ?card=',
      },
      {
        field: 'collection[].name',
        status: 'shown',
        use: 'Split at "#": grey title line + white "#number name" line',
      },
      {
        field: 'collection[].frontImageUrl',
        status: 'shown',
        use: 'Tile slab image',
      },
      {
        field: 'collection[].askPriceInUSDT',
        status: 'shown',
        use: '"Listed" pill, "$ 175.44" / "unlisted", hover button label (Buy now vs Make an offer)',
      },
      {
        field: 'collection[].rixPriceInUsd',
        status: 'shown',
        use: 'Gold "FMV $ 172" badge (hidden when NO-RIX-PRICE)',
      },
      {
        field: 'collection[].rixPriceUpdatedAt',
        status: 'shown',
        use: 'FMV badge hover: "Fair market value · Priced 2 weeks ago"',
      },
      {
        field: 'collection[].ownerAddress',
        status: 'derived',
        use: 'Ownership checks without one detail request per card',
      },
      {
        field: 'pagination.total',
        status: 'sdk',
        use: 'Total matching cards, displayed above the grid',
      },
      { field: 'pagination.limit', status: 'sdk', use: 'Cursor encoding' },
      { field: 'pagination.offset', status: 'sdk', use: 'Cursor encoding' },
      {
        field: 'pagination.hasMore',
        status: 'sdk',
        use: 'Next cursor; "Scroll for more" / "End of list"',
      },
    ],
  },
  {
    id: 'detail',
    endpoint: 'GET /v2/marketplace/collectibles/{tokenId}',
    sdk: 'fetchCard()',
    fields: [
      {
        field: 'collectible.tokenId',
        status: 'shown',
        use: '"Token ID 477043...0477" cell, share URL, explorer NFT link',
      },
      {
        field: 'collectible.name',
        status: 'shown',
        use: 'Image alt, dialog card info; the header uses the parts below instead',
      },
      {
        field: 'collectible.type',
        status: 'shown',
        use: 'Card Details "Type" row (e.g. POKEMON)',
      },
      {
        field: 'collectible.attributes[].key',
        status: 'shown',
        use: 'Card Details row labels, in API order; header rows read Grader, Grade, Year, Set, Card Number and Character by key',
      },
      {
        field: 'collectible.attributes[].value',
        status: 'shown',
        use: 'Header row 1 (grader + grade, year, set) and row 2 ("#number character"); Card Details row values',
      },
      {
        field: 'collectible.ownerAddress',
        status: 'shown',
        use: '"Owned by" fallback (0xF864…5b30 → explorer); owner check that swaps buyer buttons for List/Unlist',
      },
      {
        field: 'collectible.owner.username',
        status: 'shown',
        use: '"Owned by collector" link and avatar initials',
      },
      {
        field: 'collectible.owner.image',
        status: 'shown',
        use: 'Owner avatar',
      },
      {
        field: 'collectible.askPriceInUSDT',
        status: 'shown',
        use: '"$ X" / "Unlisted" header price; "Buy now $X" label; isListed',
      },
      {
        field: 'collectible.askExpiresAt',
        status: 'derived',
        use: 'Listing expiry in the Edit listing form',
      },
      {
        field: 'collectible.rixPriceInUsd',
        status: 'shown',
        use: '"FMV $ 172" pill in the header and in every dialog; 80%-of-FMV warning when accepting an offer',
      },
      {
        field: 'collectible.rixPriceUpdatedAt',
        status: 'shown',
        use: 'FMV pill hover "Priced … ago"',
      },
      {
        field: 'collectible.frontImageUrl',
        status: 'shown',
        use: 'Carousel slide + thumbnail; dialog previews',
      },
      {
        field: 'collectible.backImageUrl',
        status: 'shown',
        use: 'Second carousel slide + thumbnail',
      },
      {
        field: 'pricing.top_offer',
        status: 'shown',
        use: '"Top offer $ --" cell; also equals the highest activeBids[] amount',
      },
      {
        field: 'pricing.last_sale',
        status: 'shown',
        use: '"Last sale $ 1" cell',
      },
      {
        field: 'pricing.price_history[]',
        status: 'shown',
        use: '"Price History for Same Card" chart, "Last N transactions"',
      },
    ],
  },
  {
    id: 'orders',
    endpoint: 'GET /v2/marketplace/collectibles/{tokenId}/orders',
    sdk: 'fetchCardOrders()',
    fields: [
      { field: 'tokenId', status: 'sdk', use: 'Echo of the path parameter' },
      {
        field: 'activeAsk.id',
        status: 'derived',
        use: 'cancelOrder({ orderId }) behind "Unlist item"',
      },
      {
        field: 'activeAsk.amountInUsdt',
        status: 'unused',
        use: 'Not displayed',
      },
      {
        field: 'activeAsk.expiresAt',
        status: 'unused',
        use: 'Not displayed',
      },
      {
        field: 'activeAsk.ownerAddress',
        status: 'unused',
        use: 'Not displayed',
      },
      {
        field: 'activeBids[].id',
        status: 'shown',
        use: 'React key; acceptBid bidId; cancelOrder orderId',
      },
      {
        field: 'activeBids[].ownerAddress',
        status: 'shown',
        use: '"From 0x…" (this route carries addresses, not usernames); "Your offer" cell; cancel-own-bid',
      },
      {
        field: 'activeBids[].amountInUsdt',
        status: 'shown',
        use: '"$ 45.9" per offer; highest = "Accept top offer"',
      },
      {
        field: 'activeBids[].expiresAt',
        status: 'shown',
        use: '"Expires in …" countdown',
      },
      {
        field: 'activeBids[].createdAt',
        status: 'shown',
        use: '"3d ago"; Most recent / Oldest sort',
      },
    ],
  },
  {
    id: 'config',
    endpoint: 'SDK network constants (no request)',
    sdk: 'demoNetwork.network.marketplace',
    fields: [
      {
        field: 'chainId',
        status: 'derived',
        use: 'Checked against the pinned chain before connecting; the SDK also rejects typed data on another chain',
      },
      {
        field: 'platformFeeBps',
        status: 'shown',
        use: '"Platform fee" / "Total Listing Price" rows in List item, Edit listing and Accept offer',
      },
      {
        field: 'contracts.nft',
        status: 'shown',
        use: '"Address" cell with explorer link',
      },
      {
        field: 'contracts.usdt',
        status: 'derived',
        use: 'Balance shown in Buy now / Make offer; approve() target',
      },
      {
        field: 'contracts.permit2',
        status: 'derived',
        use: 'Allowance check and approval spender before createBid / buyCard',
      },
      {
        field: 'contracts.orderbook',
        status: 'sdk',
        use: 'Checked against Ask/cancel verifyingContract and Permit2 spender before signing',
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
export function unmappedPaths(id: EndpointId, wire: unknown) {
  const entry = coverage.find((c) => c.id === id);
  if (!entry) return [];
  const known = entry.fields.map((f) => f.field);
  // A wire path is mapped when a coverage row names it, a parent of it, or a
  // child of it (an empty array on the wire collapses to its parent path).
  return [...collectPaths(wire)].filter(
    (path) =>
      !known.some(
        (field) =>
          path === field ||
          path.startsWith(`${field}.`) ||
          path.startsWith(`${field}[]`) ||
          field.startsWith(`${path}.`) ||
          field.startsWith(`${path}[]`),
      ),
  );
}
