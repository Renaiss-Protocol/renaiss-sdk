/**
 * Public API field usage in this SDK example.
 *
 * Statuses:
 * - shown    rendered in this demo
 * - sdk      consumed by the SDK for validation, paging or the wallet access token only
 * - signing  used only to build, cross-check or verify the Permit2 witness
 * - derived  not rendered directly; feeds a computed value or an action
 */
export type FieldStatus = 'shown' | 'sdk' | 'signing' | 'derived';
export type FieldUse = {
  field: string;
  status: FieldStatus;
  use: string;
};
export type EndpointId =
  | 'config'
  | 'session'
  | 'collectibles'
  | 'regions'
  | 'validate'
  | 'quotes'
  | 'prepare'
  | 'submit'
  | 'status'
  | 'orders'
  | 'order'
  | 'tracking';
export type EndpointCoverage = {
  id: EndpointId;
  endpoint: string;
  sdk: string;
  fields: FieldUse[];
};

function cardFields(prefix: string, withAcquired: boolean): FieldUse[] {
  return [
    {
      field: `${prefix}.tokenId`,
      status: 'derived',
      use: 'React key; cart identity; quote/prepare tokenIds',
    },
    {
      field: `${prefix}.name`,
      status: 'shown',
      use: 'Split "#" name on tiles; table item; cart rows',
    },
    {
      field: `${prefix}.frontImageUrl`,
      status: 'shown',
      use: 'Slab image on tiles, table, cart, summary',
    },
    {
      field: `${prefix}.rixPriceInUsd`,
      status: 'shown',
      use: 'FMV pill; Total FMV box (summed)',
    },
    {
      field: `${prefix}.rixPriceUpdatedAt`,
      status: 'shown',
      use: 'FMV pill hover "Priced … ago" freshness',
    },
    ...(withAcquired
      ? [
          {
            field: `${prefix}.ownerAcquiredAt`,
            status: 'shown' as const,
            use: 'Table "Purchase / Mint date" (dd/mm/yyyy, — when null)',
          },
        ]
      : []),
    {
      field: `${prefix}.regionCountryCode`,
      status: 'shown',
      use: 'Vault label on tiles (all regions); same-region cart rule; cart "Location"',
    },
    {
      field: `${prefix}.vaultDisplayName`,
      status: 'shown',
      use: 'Vault label when a region is selected; table Location; "Vault: …"',
    },
  ];
}

export const coverage: EndpointCoverage[] = [
  {
    id: 'config',
    endpoint: 'SDK network constants (no request)',
    sdk: 'demoNetwork.network.redemption',
    fields: [
      {
        field: 'chainId',
        status: 'sdk',
        use: 'Selected network checked before connecting; SDK expectedChainId',
      },
      {
        field: 'tokenAddress',
        status: 'derived',
        use: 'USDT balanceOf / allowance reads; Permit2 approve target token',
      },
      {
        field: 'permit2Address',
        status: 'derived',
        use: 'Allowance spender; SDK verifies permit domain',
      },
      {
        field: 'cashierAddress',
        status: 'signing',
        use: 'SDK verifies the Permit2 spender in the prepared typed data',
      },
      {
        field: 'managerAddress',
        status: 'signing',
        use: 'SDK hashes the BatchRedemption witness in the Manager domain',
      },
      {
        field: 'maxCards',
        status: 'shown',
        use: '"Card limit reached" dialog; over-limit hint',
      },
    ],
  },
  {
    id: 'session',
    endpoint: 'POST /v2/auth/wallet/{nonce,verify,refresh,revoke}',
    sdk: 'signInRedemptionWallet({ origin }) / signOutRedemptionWallet()',
    fields: [
      {
        field: 'walletAddress',
        status: 'shown',
        use: 'Top bar address; must equal the connected account',
      },
      {
        field: 'expiresAt',
        status: 'shown',
        use: 'Developer panel recovery tab; recorded sign-in response',
      },
      {
        field: 'accessToken / refreshToken',
        status: 'sdk',
        use: 'Held in SDK memory only; never persisted or displayed',
      },
      {
        field: 'scopes (redeem:read, redeem:write)',
        status: 'sdk',
        use: 'Requested by the SDK in the sign-in request; not rendered',
      },
    ],
  },
  {
    id: 'collectibles',
    endpoint: 'GET /v2/redeem/collectibles',
    sdk: 'listRedeemableCards()',
    fields: [
      ...cardFields('collectibles[]', true),
      {
        field: 'total',
        status: 'shown',
        use: '"Showing X of Y cards"; page count',
      },
      {
        field: 'page',
        status: 'sdk',
        use: 'Offset cursor bookkeeping',
      },
      {
        field: 'hasMore',
        status: 'sdk',
        use: 'Next button enabled',
      },
    ],
  },
  {
    id: 'regions',
    endpoint: 'GET /v2/redeem/regions',
    sdk: 'fetchRedemptionRegions()',
    fields: [
      {
        field: 'counts[code]',
        status: 'shown',
        use: 'Chip count bubbles; default region = first of HK/MY/US with cards',
      },
    ],
  },
  {
    id: 'validate',
    endpoint: 'POST /v2/redeem/address/validate',
    sdk: 'validateRedemptionAddress()',
    fields: [
      {
        field: 'status',
        status: 'shown',
        use: '"verified"/"corrected" accept; otherwise the soft warning + acknowledgement',
      },
      {
        field: 'detail',
        status: 'shown',
        use: 'Shown under the warning',
      },
    ],
  },
  {
    id: 'quotes',
    endpoint: 'POST /v2/redeem/quotes',
    sdk: 'fetchRedemptionQuote()',
    fields: [
      {
        field: 'quoteId',
        status: 'sdk',
        use: 'Sent to prepare; never rendered',
      },
      {
        field: 'expiresAt',
        status: 'shown',
        use: '"Quote valid for mm:ss"; Pay disabled when expired',
      },
      {
        field: 'handlingFeeInUsd',
        status: 'shown',
        use: '"Handling fee" row and total (server value, no client constant)',
      },
      {
        field: 'couriers[].id',
        status: 'derived',
        use: 'Radio selection; prepare courierId',
      },
      {
        field: 'couriers[].name',
        status: 'shown',
        use: '"USDT price - name" row; logo fallback text',
      },
      {
        field: 'couriers[].logoUrl',
        status: 'shown',
        use: '80×48 white logo box',
      },
      {
        field: 'couriers[].estimatedDays',
        status: 'shown',
        use: '"Estimated delivery time"',
      },
      {
        field: 'couriers[].shippingFeeInUsd',
        status: 'shown',
        use: 'Courier row price; "Shipping cost" row; total',
      },
      {
        field: 'couriers[].insuranceFeeInUsd',
        status: 'shown',
        use: '"Insurance for $x" checkbox; total when checked',
      },
      {
        field: 'couriers[].dutyAndTaxesInUsd',
        status: 'shown',
        use: 'Grey "Estimated duties & taxes" box; excluded from total',
      },
    ],
  },
  {
    id: 'prepare',
    endpoint: 'POST /v2/redeem/checkout/prepare',
    sdk: 'prepareRedemption()',
    fields: [
      {
        field: 'preparationId',
        status: 'sdk',
        use: 'Journaled before submit; recovery status key',
      },
      {
        field: 'requestId',
        status: 'shown',
        use: '"Order placed! {6…4}"; journaled; witness message',
      },
      {
        field: 'walletAddress',
        status: 'signing',
        use: 'Cross-checked against the connected account before signing',
      },
      {
        field: 'tokenIds',
        status: 'signing',
        use: 'Cross-checked against the cart; witness message',
      },
      {
        field: 'expiresAt',
        status: 'signing',
        use: 'Refuse to sign an expired preparation',
      },
      {
        field: 'address',
        status: 'signing',
        use: 'Cross-checked against the typed address; confirmation cards',
      },
      {
        field: 'recipient',
        status: 'signing',
        use: 'Cross-checked against the contact form; confirmation cards',
      },
      {
        field: 'courierName',
        status: 'shown',
        use: 'Confirmation "Delivery" card',
      },
      {
        field: 'fees.*InUsd',
        status: 'shown',
        use: 'Confirmation fee breakdown',
      },
      {
        field: 'fees.totalFeeInUsdt',
        status: 'signing',
        use: 'Balance check; Permit2 approval amount; expected amount for signRedemption',
      },
      {
        field: 'redemptionTypedData',
        status: 'signing',
        use: 'SDK hashes the readable BatchRedemption and compares to the witness',
      },
      {
        field: 'permitTypedData',
        status: 'signing',
        use: 'SDK verifies domain/spender/token/amount/witness, then the wallet signs it',
      },
    ],
  },
  {
    id: 'submit',
    endpoint: 'POST /v2/redeem/checkout',
    sdk: 'submitRedemption()',
    fields: [
      {
        field: 'requestId',
        status: 'shown',
        use: 'Confirmation header; "View order" link',
      },
      {
        field: 'status',
        status: 'shown',
        use: 'succeeded → confirmation; submitting → keep journal; failed → error',
      },
      {
        field: 'transactionHash',
        status: 'shown',
        use: 'Confirmation explorer link',
      },
    ],
  },
  {
    id: 'status',
    endpoint: 'GET /v2/redeem/checkout/{preparationId}',
    sdk: 'fetchRedemptionCheckout()',
    fields: [
      {
        field: 'requestId',
        status: 'shown',
        use: 'Recovery panel',
      },
      {
        field: 'status',
        status: 'shown',
        use: 'Reconcile outcome; order detail fallback while unindexed',
      },
      {
        field: 'transactionHash',
        status: 'shown',
        use: 'Reconcile note',
      },
    ],
  },
  {
    id: 'orders',
    endpoint: 'GET /v2/redeem/orders',
    sdk: 'listRedemptionOrders()',
    fields: [
      {
        field: 'orders[].requestId',
        status: 'shown',
        use: '"Order {6…4}"; card link',
      },
      {
        field: 'orders[].status',
        status: 'derived',
        use: 'Stage label with shipmentStatus',
      },
      {
        field: 'orders[].trackingNumber',
        status: 'shown',
        use: '"Tracking no." line (blank when null)',
      },
      {
        field: 'orders[].shipmentStatus',
        status: 'derived',
        use: 'Stage label',
      },
      {
        field: 'orders[].collectibles[].tokenId',
        status: 'derived',
        use: 'React key',
      },
      {
        field: 'orders[].collectibles[].name',
        status: 'shown',
        use: 'Image alt text only',
      },
      {
        field: 'orders[].collectibles[].frontImageUrl',
        status: 'shown',
        use: 'Image grid (first 3 + "+N")',
      },
      {
        field: 'orders[].collectibles[].rixPriceInUsd',
        status: 'shown',
        use: 'Summed FMV pill ("N/A" when none)',
      },
      {
        field: 'hasMore',
        status: 'sdk',
        use: 'Next button; "more on next page" / "end of list"',
      },
    ],
  },
  {
    id: 'order',
    endpoint: 'GET /v2/redeem/orders/{requestId}',
    sdk: 'fetchRedemptionOrder()',
    fields: [
      {
        field: 'requestId',
        status: 'shown',
        use: '"Order no. {6…4}"',
      },
      {
        field: 'status',
        status: 'shown',
        use: '"Cancelled" pill; stage index',
      },
      {
        field: 'tokenStatuses',
        status: 'shown',
        use: 'Owner-cancelled cards move to the warning box',
      },
      {
        field: 'address',
        status: 'shown',
        use: '"Shipping address" card',
      },
      {
        field: 'recipient.name',
        status: 'shown',
        use: 'Address + contact cards',
      },
      {
        field: 'recipient.phone',
        status: 'shown',
        use: 'Contact card',
      },
      {
        field: 'recipient.email',
        status: 'shown',
        use: 'Contact card',
      },
      {
        field: 'recipient.chineseName',
        status: 'shown',
        use: 'Contact card when present',
      },
      {
        field: 'courierName',
        status: 'shown',
        use: '"Delivery" card',
      },
      {
        field: 'estimatedDeliveryDaysMin/Max',
        status: 'shown',
        use: '"Delivery" card estimate',
      },
      {
        field: 'fees.handling/shipping/insuranceFeeInUsd',
        status: 'shown',
        use: 'Read-only fee breakdown; total recomputed',
      },
      {
        field: 'fees.dutyAndTaxesInUsd',
        status: 'shown',
        use: 'Duties box when > 0',
      },
      {
        field: 'trackingNumber',
        status: 'shown',
        use: '"Tracking no {n}" title',
      },
      {
        field: 'trackingUrl',
        status: 'shown',
        use: 'Tracking number link',
      },
      {
        field: 'shipmentStatus',
        status: 'shown',
        use: 'Stage index; "Courier status" line',
      },
      {
        field: 'trackingLastSyncedAt',
        status: 'shown',
        use: '"synced …" note',
      },
      {
        field: 'createdAt',
        status: 'shown',
        use: '"Created on"; Initiated stage date',
      },
      {
        field: 'updatedAt',
        status: 'shown',
        use: '"last record update" only; not shown as vault-release date',
      },
      ...cardFields('collectibles[]', false).map((f) =>
        f.field.endsWith('regionCountryCode') ||
        f.field.endsWith('vaultDisplayName')
          ? { ...f, use: '"Vault: …" line' }
          : { ...f },
      ),
    ],
  },
  {
    id: 'tracking',
    endpoint: 'POST /v2/redeem/orders/{requestId}/tracking',
    sdk: 'syncRedemptionTracking()',
    fields: [
      {
        field: '(order)',
        status: 'shown',
        use: 'Same order projection, re-rendered after "Refresh tracking"',
      },
    ],
  },
];
