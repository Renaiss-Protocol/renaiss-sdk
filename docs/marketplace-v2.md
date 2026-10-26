# EOA marketplace

`createMarketplaceClient` from `@renaiss-protocol/client` uses
`/v2/marketplace`. It signs directly with an external EOA. This is the supported
marketplace client; alpha consumers of `createSecureClient` must follow the
[beta migration guide](migration-beta.md). There is no account-type parameter
or silent version fallback.

```ts
import { BNB_TESTNET, createMarketplaceClient, getError, getValue, isFailed,
  MarketplacePriceRange, MarketplaceV2Sort } from '@renaiss-protocol/client';

const network = BNB_TESTNET; // Explicit mainnet opt-in: BNB_MAINNET.
const marketplace = createMarketplaceClient({
  baseUrl: '/api/renaiss', // your backend proxy in browsers
  network,
  signer,
  expectedChainId: network.chainId,
});
const page = await marketplace.listMarketplaceCards({
  listedOnly: true,
  sortBy: MarketplaceV2Sort.Price,
  priceRange: MarketplacePriceRange.UpTo100,
  pageSize: 25,
}).firstPage();
if (isFailed(page)) console.error(getError(page));
else console.log(getValue(page).items);
```

Server integrations can supply `builderApiKey`. Browser integrations must keep
that key in their backend. Public reads carry no credentials. The demo proxy
allowlists v2 routes, strips browser-supplied credentials, checks same-origin
requests and adds the builder key to every route except the public reads. Public
reads are forwarded without it. Production builders must
apply their own user authentication and rate limits to their proxy.

## Reading and displaying cards

- `listMarketplaceCards()` returns SDK pagination with slab front images, so the
  grid needs no per-card detail request. It supports category, search, listed
  status, character, language, grading company, grade, year and price ranges.
- `fetchCard({ tokenId })` returns slab front/back images, metadata, current
  prices and sale price history.
- `fetchCardOrders({ tokenId })` returns the active ask and funded bids. An order
  ID identifies the exact order accepted or cancelled.

The demo uses the network selected by `NEXT_PUBLIC_RENAISS_NETWORK` (testnet by
default). Contract addresses and fees come from the SDK's versioned network
constants; see [Network constants](#network-constants).

Use `MarketplacePriceRange` for the five supported ask-price bands. `yearRange`
accepts inclusive four-digit year ranges such as `2021-2025`, or `2026+` with
no upper bound. Invalid price bands, malformed years and reversed year ranges
fail locally before any request. Omit a range to browse all values.

USDT values are strings of 18-decimal base units. USD values are integer cents.
Keep them as `bigint` for arithmetic; never convert balances/prices through
`Number`. Missing ask and RIX prices normalize to `null`.

## Trading

`createAsk`, `createBid`, `buyCard` and `acceptBid` prepare an order, check the
quoted wallet/chain/token/amount, cross-check signing contracts and fees against
versioned SDK network constants, reject expired deadlines, request the EOA signature and submit once.
No Renaiss user registration, login signature, Safe creation or Safe signature
wrapper is involved. The EOA holds its own tokens and NFTs.

Configuration is bundled in the SDK. After an announced contract or fee change,
update the SDK, inspect the published network constants, and review the order again. A mismatch fails before signing; the SDK does not automatically
replace trusted constants or retry a signed submission. These checks use the
client's selected `network.marketplace` (default `BNB_TESTNET`);
`expectedChainId` independently pins the chain. Mainnet callers explicitly pass
`network: BNB_MAINNET` and `expectedChainId: BNB_MAINNET.chainId`.

`buyCard` and `acceptBid` require `expectedTotalPriceInUsdt`, the price the UI displayed (use the selected bid's `amountInUsdt` when selling). The
backend rejects a changed ask during preparation. Ask and bid expiries default
to 30 days; pass `expiresAt` (ISO timestamp) or `expiresInSeconds`, up to 180 days.
A standing bid must be at least 1 USDT.

Bids and purchases require the EOA's USDT allowance to Permit2. Check the chain,
token and spender from the same selected `network.marketplace.contracts` and
handle any approval using your wallet library before calling the trading action.
The SDK does not silently send
approval transactions. The demo performs explicit wallet confirmation when an
approval is needed.

Permit2 allowance and the wallet balance are shared across resting bids. An
exact-amount approval may cover either of two bids without covering both; after
one settles, another can become unfunded. Check the funded order book again
after settlement or an allowance change.

`cancelOrder({ orderId })` prepares and signs a five-minute authorization bound
to the exact order, wallet, builder and chain. This removes a resting order from
the off-chain book. It does **not** revoke its underlying on-chain Ask/Permit2
signature. On-chain invalidation is a separate wallet operation.

After an interrupted write, reconcile the order book and transaction state before retrying. Cancellation
responses are uncached; public book reads may lag briefly behind a mutation.

## Errors

Every method returns a `Result`. Use its matching guard, such as
`isCreateBidError` or `isFetchCardError`, to narrow the stable error codes.
`MARKETPLACE_V2_REQUEST_FAILED` retains the upstream code and detail inside
`ApiError.error`. Local validation, schema, wallet-signing and transport failures
remain distinct. Expected failures are not thrown and signed submissions are
never automatically retried.

## Testnet integration check

After building the packages, from `examples/web` run:

```sh
node --env-file=../../.env.local --env-file=../../.env.testnet.local scripts/testnet-marketplace.mjs
```

The ignored local environment must contain the authorized test EOA, RPC URL
and mock token address. The Permit2 address comes from the SDK's network
configuration. The script verifies chain 97 and the mock token address before
mutation, places a five-minute bid for 1 mock USDT, signs its
cancellation and verifies the token balance did not change. It requires an
existing Permit2 allowance and never grants a new one. An ignored journal in
`reports/testnet-marketplace.json` blocks repeating an unreconciled submission.

## Network constants

`BNB_TESTNET` from `@renaiss-protocol/client` is the default v2 network.
Select it explicitly with `network: BNB_TESTNET`, or opt into mainnet with
`network: BNB_MAINNET` from the same entry point. Set `expectedChainId` to the
selected network's `chainId`. Read static metadata from `network.marketplace`. The SDK
checks preparations against these versioned constants, never fetched addresses.
See [demo network selection](demo-networks.md) for both deployments, matching
API settings.
The [local mainnet reference](demo-networks.md#mainnet-reference-chain-56) and
SDK constants record addresses and the 200 bps platform fee. A contract or fee change requires a
coordinated API deployment, SDK release, and documentation update.

## Amounts and signature expiry

All SDK money inputs use `bigint` token base units, including `totalPriceInUsdt`,
`sellerReceivesInUsdt`, `amountInUsdt` and `expectedTotalPriceInUsdt`. HTTP fields
remain decimal strings. Supply `baseUrl` explicitly for the selected network.

Ask and bid signatures must match the exact requested `expiresAt`, rounded down
to seconds, or stay within `expiresInSeconds` (default 30 days) plus 120 seconds
of clock tolerance from preparation. The SDK checks the payload and typed data
before signing. Off-chain cancellation does not revoke an on-chain signature.

## Signing-window recovery

An expired preparation returns an error explaining that the signing window
expired. Prepare the order again after any token approval completes; the existing
approval remains valid. The SDK never signs an expired preparation. If the error
says the deadline is outside the allowed window, check the device clock, then
prepare again. Relative signing windows allow up to two minutes of clock skew;
the SDK does not extend the API's deadline.

If a fresh signing window is already expired when it arrives, your device clock
may be ahead. Synchronize its date and time before retrying. Repeated preparation
alone cannot fix clock skew; the SDK keeps all expiration limits enforced.
