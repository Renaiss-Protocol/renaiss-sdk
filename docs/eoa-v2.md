# EOA gacha

`createGachaClient` from `@renaiss-protocol/client` uses `/v2/gacha`.
Your application owns login and wallet provisioning. Supply its existing EOA
signer; no renaiss.xyz account, Safe, or separate login signature is required.
External and embedded wallets use the same SDK signer interface. Wallet prompts
and approval policy depend on the wallet provider.

## Consumer flow

```ts
import { BNB_TESTNET, createGachaClient, isFailed, getError, getValue } from '@renaiss-protocol/client';
import { signerFrom } from '@renaiss-protocol/client/viem';

const network = BNB_TESTNET; // Use BNB_MAINNET with https://api.renaiss.xyz.
const client = createGachaClient({
  baseUrl: '/api/renaiss', // your backend forwards only the permitted routes
  network,
  signer: signerFrom(walletClient),
});
const expected = {
  packId: selectedMachine.id,
  onChainPackId: selectedMachine.onChainPackId,
  priceInUsdt: BigInt(selectedMachine.priceInUsdt),
  quantity: 1, // any whole number from 1 to MAX_GACHA_PULL_QUANTITY (10)
};
const preparation = await client.prepareGachaPull({
  buyerWalletAddress,
  machineSlug: selectedMachine.slug,
  expectedPriceInUsdt: expected.priceInUsdt,
  quantity: expected.quantity,
});
if (isFailed(preparation)) return handleError(getError(preparation));
const prepared = getValue(preparation);
// Preparation validated the selected network, fixed types and reviewed price.
// Now check the connected wallet/chain, balance and allowance. Approve
// exactly the reviewed requiredAmount if needed and await success.
const signature = await client.signGachaPull({ prepared, expected });
if (isFailed(signature)) return handleError(getError(signature));
const result = await client.submitGachaPull({
  pull: getValue(signature),
  onEvent(event) {
    if (event.event === 'payment_confirmed') {
      persistFundingHash(event.data.permitFundTxHash);
    }
  },
});
```

To submit without keeping a connection open (a serverless function, a mobile
app sent to the background), use `startGachaPull` instead of `submitGachaPull`
and poll its request:

```ts
const started = await client.startGachaPull({ pull: getValue(signature) });
if (isFailed(started)) return handleError(getError(started));
persistRequestId(getValue(started).requestId);

// About once a second, until RESOLVED or FAILED.
const status = await client.fetchGachaPullStatus({
  requestId: getValue(started).requestId,
});
if (isFailed(status)) return handleError(getError(status));
const request = getValue(status);
if (request.status === EoaPullRequestStatus.Resolved) render(request.result.draws);
if (request.status === EoaPullRequestStatus.Failed) showFailure(request.error); // never charged
```

`PENDING_PAYMENT` and `PENDING_RESOLUTION` mean poll again; once paid, a pull
never becomes `FAILED`. Sending the same signed pull again returns the same
`requestId` and never charges twice, and a `FAILED` request starts again. A
pull still `PENDING_PAYMENT` after 10 minutes is being reconciled: stop polling,
contact Renaiss with the `requestId` and do not sign a new pull for it. A
request can be read for at least 30 days. `startGachaBuyback` and
`fetchGachaBuybackStatus` do the same for a signed buyback (`PENDING`, then
`COMPLETED` with `txHash`, `totalAmountInUsdt` and `itemCount`, or `FAILED`);
each `startGachaBuyback` call is a new request.

The SDK checks the network's contracts and fixed signing types both during
preparation and immediately before signing. Keep `expected` bound to the user's
selection. A changed price or pack requires a new review; never replace the
expectations with values from an unexpected signing response.

Production server integrations use `baseUrl: 'https://api.renaiss.xyz'`,
`network: BNB_MAINNET` (56), the matching mainnet constants
and `builderApiKey`. Testnet integrations use their testnet API with
`BNB_TESTNET`. Browser integrations use a same-origin proxy with the builder
key held on the server. The SDK does not import viem outside its optional
`/viem` adapter. Its core signer interface also works with other wallet
libraries. The split prepare/sign/submit flow keeps the wallet local and makes
approval an explicit step, following [viem's typed-data signing interface](https://viem.sh/docs/actions/wallet/signTypedData).

- All operations return Result values. Action-specific `is*Error` guards are
  exported from `@renaiss-protocol/client`. HTTP/domain failures normalize to
  `GACHA_V2_REQUEST_FAILED`, with
  the original API error in `ApiError.error`; validation, signing and stream
  failures retain their documented SDK codes.
- `list*` methods retain the SDK's lazy pages and opaque cursors, including
  `for await`. `fetchGachaBuybackOffers` is a direct
  collection: it reads the API's pages of 100 offers one after another until a
  short page, removes repeated settlement ids and returns the rest. The read has
  no snapshot, so an offer that appears or disappears while it runs can be
  missed; read the offers again before a batch buyback. If any page fails, or the
  SDK cannot confirm the list is complete (the API stops paging at an offset of
  10,000), the call fails instead of returning a partial list.
- Amounts remain decimal strings on the wire. Signing and buyback sums use
  bigint. Neither approval nor signing converts money to Number.
- No user API key, Safe creation, social onboarding or wallet access token is
  needed for the builder-scoped EOA journey. Private Redeem requests use the
  separate `createRedemptionClient` workflow, which needs a wallet access token.
- Builder attribution comes from the key.
- The SDK submits once. It stops and cancels its stream reader at the terminal
  event, supports named SSE frames and fragmented CRLF, and preserves funding
  context on disconnect, parse failure or consumer callback failure. The default
  stream deadline is 180 seconds; a supplied AbortSignal controls cancellation.
- Persist a submission journal *before* submitting, and persist the funding hash
  as soon as received. The stream's `pull_started` event carries a `requestId`;
  a failed `submitGachaPull` returns it in `ApiError.error` with
  `permitFundTxHash` and `fundingConfirmed` when known. Recovery uses
  `fetchGachaPullStatus` (by `requestId`), `fetchGachaDrawStatus` (by funding
  hash) and `listWalletPulls`.
  An empty history is not evidence that payment failed. A fresh nonce creates
  another purchase; never automatically retry a funding request.
- Buybacks take 1–10 unique offers from the same pack and contract. Each offer
  lists every buyback tier in `buybackTiers`, soonest end first. The price now
  is the `amountInUsdt` of the first tier whose `expiresAt` has not passed;
  `getEoaBuybackTierAt(offer, Date.now())` returns that tier, and
  `getEoaBuybackOfferEndsAt(offer)` returns when the offer ends.
  `createGachaBuyback` requires `expectedAmountInUsdt`, the total the user
  confirmed in 18-decimal USDT units. It signs the sum of the current prices
  only when that sum matches; otherwise it returns `WRONG_REQUEST_PARAMS`
  before requesting a signature. Read the offers again, show the updated
  amount and ask the user to confirm before trying again. It refuses an offer
  whose tiers have all ended or whose current tier pays nothing. Pass the chain
  and token from known deployment configuration or a previous preparation, then
  `createGachaBuyback` and `submitGachaBuyback`. No NFT approval is required. If
  a tier ends before the buyback reaches Renaiss, the API error is
  `GACHA_V3_BUYBACK_PRICE_CHANGED`: read the offers again and sign again. Offer
  expiry and delivery can race; refresh after a failed settlement.
- A collectible can carry a buyback bonus. `buybackBonus` is
  `{ originalBuybackBaseValueInUSD, bonusBps }` (2000 means +20%) or `null`.
  The base buyback value next to it and every `buybackTiers` amount already
  include the bonus: show it, but do not apply it again. It is on the reveal,
  `fetchGachaDrawStatus`, `listWalletCollection` (in the buyback window) and
  `listGachaPullHistory` (only when the read sends a builder key).


## Wallet cards, totals and activities

Three builder-key reads describe what a wallet has and did
(`/v2/users/{walletAddress}`). The activities are the address's chain events
with any builder. The cards and totals hold what it pulled with your builder
key and the cards it owns that it did not pull itself. Exactly
the address you give is read: an owner wallet and its Renaiss Safe are two
wallets.

```ts
import { EoaActivityFilter, EoaCollectionSort, EoaSortOrder } from '@renaiss-protocol/client';

const totals = await client.fetchWalletCollectionSummary({ walletAddress });
// { collectibleCount: 10, totalRixPriceInUsd: '28559', collectiblesWithoutRixPrice: 0 }  (USD cents)

const cards = await client
  .listWalletCollection({
    walletAddress,
    sortBy: EoaCollectionSort.RixPrice, // PulledAt (default) | RixPrice | BuybackExpiry
    sortOrder: EoaSortOrder.Descending, // the default
    tokenIds: ['4739…'], // optional: only these cards (1 to 20)
  })
  .firstPage();

for await (const page of client.listWalletActivities({
  walletAddress,
  filter: EoaActivityFilter.GachaV3Buyback, // omit for everything
})) {
  if (isFailed(page)) return handleError(getError(page));
  render(getValue(page).items); // EoaActivity[]
}
```

- A card the wallet pulled **with your builder key** is listed while Renaiss
  holds it (its buyback window, then until delivery) and, once delivered,
  while the wallet owns it on chain. A card the wallet owns on chain but did
  not pull itself, such as a marketplace purchase or a transfer, is listed
  with `pull: null`. A card the wallet pulled with another builder is never
  listed, even after delivery, so the list and the totals of one address
  differ between two builder keys. A card that was sold, sold back,
  transferred away or redeemed is not listed; the activities have what
  happened to it.
- `state.status` says where the card is. `IN_WALLET`: the wallet owns it on
  chain. `IN_BUYBACK_WINDOW` (your pulls only) carries `buybackBaseValueInUSD`
  (USD cents, bonus included), `buybackBonus` and every `buybackTiers` entry,
  past ones too, priced like `fetchGachaBuybackOffers`:
  `getEoaBuybackTierAt(card.state, Date.now())` is the current tier. Sign
  what the offers return, not these display prices. `AWAITING_DELIVERY` (your
  pulls only): no buyback is offered and the card is not delivered yet.
- `pull` is the wallet's pull of the card with your builder key (`packId`,
  `packName`, `permitFundTxHash`, `pulledAt`). It is `null` for a card the
  wallet got any other way. The settlement id is on `listWalletPulls` and the
  reveal. Tier and base value are on the reveal's `draws[]` (`submitGachaPull`)
  and on `fetchGachaDrawStatus`; retain them if you need them later.
- `rixPriceInUsd` is the card's RIX price (its market value, as on
  renaiss.xyz) in USD cents and moves with the market; it is `null` for a card
  that has none yet, and `rixPriceUpdatedAt` is when it was last updated. The
  summary's `totalRixPriceInUsd` adds the current prices, and
  `collectiblesWithoutRixPrice` says how many counted cards add nothing yet.
- `tokenIds` keeps only those cards (1 to 20 decimal strings) and applies before
  sorting and paging, so `totalCount` counts only the matches. Sorting and
  paging apply to the whole list on the server; there is no text search. A card
  without the sorted value (no pull with your builder key, no RIX price, or no
  open buyback window) sorts last in both directions. The cards page carries
  `totalCount`.
- Activities are the wallet's chain events, newest first, with an entry tied
  to a pack your key cannot see left out; one
  `EoaActivityType` each: `gacha-v3-pull`, `gacha-v3-buyback`,
  `gacha-v3-release-token` (a delivery), marketplace `buy` and `sell`,
  `transfer`, `mint` and `burn` (a redemption). Narrow on `type` to read an
  entry's own fields. `item` is the catalog card (`tokenId`, `title`,
  `subtitle`, `imageUrl`) of the token id an event names. A pull and a buyback
  name no card, as on chain: a pull has its pack's on-chain id (`packId`, a
  machine's `onChainPackId`), `checkoutIds` and `totalAmount` for the whole
  payment, and a buyback its `buybackIds` (the `settlementId` of your own
  draws) and `priceInUsdt` for the whole event.
- Activities page by event using the API's cursor, with no total. A page holds
  up to `pageSize` events (1 to 50); one transaction's entries can span pages.
- A wallet Renaiss operates (its pack stock and the cards waiting for delivery)
  reads as a wallet with nothing.
- Every wallet card carries `frontImageUrl` (the graded slab in its Renaiss
  frame, on a dark background) and `type` (`CollectibleType`). The reveal's
  and `fetchGachaDrawStatus`'s `collectible` and the marketplace `fetchCard`
  also carry `attributes`: a `{ key, value }` list in the order Grader, Grade,
  Cert Number, Year, Set, Card Number, Character, Language, with empty values
  left out. Read a wallet card's attributes with `fetchCard`.
  `listGachaMachineContents` returns only `tokenId` (a decimal string),
  `name`, `tier`, `buybackBaseValueInUsd`, `frontImageUrl` and `type`.
  `listGachaPullHistory` also has `imageUrl`: the card cut out of its slab
  photo, with no slab, grade label, frame or background. It is the catalog
  photo, which can show another graded copy of the same card, and it is
  `frontImageUrl` when there is no cutout.

## Interrupted purchases

Record the wallet, chain, pack, quantity and submission time before sending a
signed pull. When `payment_confirmed` arrives, persist `permitFundTxHash`.
After a stream disconnect, use `fetchGachaDrawStatus` with that hash and the same
wallet, or `fetchGachaPullStatus` with the `requestId` of `pull_started`, then
refresh history/offers. A resolved draw there has the same fields as the
reveal: `tier`, `buybackBaseValueInUSD`, `buybackBonus`, `buybackTiers` and
`collectible`. The values, bonus and collectible are `null` when they could not
be loaded; read again later. The payout is only on
`fetchGachaBuybackOffers`. Do not purchase again just because an index
has not caught up.

The demo automatically checks a known funding hash immediately and then every
five seconds, up to six attempts. It preserves resolved cards even if history
still lags. Changing wallets or unmounting cancels obsolete recovery updates.
Without a hash, use the submitted transaction and wallet activity to reconcile
before clearing the pending record. Manual clearing is in Developer controls
and requires an acknowledgement that payment was checked.

## Compatibility

The root entry point exposes the EOA workflows. Replace the removed
`@renaiss-protocol/client/v2` import with `@renaiss-protocol/client`. The
alpha's v1/Safe client factories are no longer exported. Their consumers must
migrate their signing and credential flow; changing an import alone is not
sufficient. See the [beta migration guide](migration-beta.md).

`/v2` is the HTTP protocol version. The SDK uses independent `0.x.y-beta.n`
release versions; no npm major-version-2 bump is required.

`prepareGachaPull` returns `GACHA_PRICE_CHANGED` before requesting preparation
when the machine price differs from `expectedPriceInUsdt`. Refresh the machine
and have the user review the new price; do not automatically sign at the new
price. The error includes `currentPriceInUsdt` as a decimal string in `error`.
All EOA factories require an explicit `baseUrl` for the selected network.

The SDK rejects a gacha Permit2 deadline more than 420 seconds ahead of the local clock (the API maximum of 300 seconds plus 120 seconds of clock skew). It checks this both when preparing the pull and immediately before signing.

## Signing-window recovery

An expired preparation returns an error explaining that the signing window
expired. Prepare the pull again after any token approval completes; the existing
approval remains valid. The SDK never signs an expired preparation. If the error
says the deadline is outside the allowed window, check the device clock, then
prepare again. Relative signing windows allow up to two minutes of clock skew;
the SDK does not extend the API's deadline.

If a fresh signing window is already expired when it arrives, your device clock
may be ahead. Synchronize its date and time before retrying. Repeated preparation
alone cannot fix clock skew; the SDK keeps all expiration limits enforced.
