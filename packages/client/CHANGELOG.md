# @renaiss-protocol/client

## 0.1.0-beta.5

### Minor Changes

- Follow the v2 API's collectible names and shape and its buyback tiers. This release needs a `/v2` API that serves them; check the deployment's `/v2/docs`. Against an older API the renamed routes get an HTTP 404 (`UNKNOWN_ERROR` with status 404) and the changed reads fail with `INVALID_SCHEMA`.

  Breaking changes:

  - Redemption orders return `collectibles` instead of `cards` on `listRedemptionOrders`, `fetchRedemptionOrder` and `syncRedemptionTracking`.
  - `createGachaBuyback` requires `expectedAmountInUsdt`, the total the user confirmed in 18-decimal USDT units. If the current-tier sum differs, it returns `WRONG_REQUEST_PARAMS` before requesting a signature. Read the offers again and confirm the updated amount before retrying.
  - Every FMV price is `fmvInUsd` (before: `fmvPriceInUsd`) on `MarketplaceCard`, `CardDetail`, `RedeemableCard` and the redemption order cards. `MarketplaceV2Sort.FmvPrice` now sends `fmvInUsd`.
  - `CardDetail` (`fetchCard`) has `type` and an `attributes` list instead of `setName`, `cardNumber`, `pokemonName`, `gradingCompany`, `grade` and `year`. `attributes` is `{ key, value }[]` in the order Grader, Grade, Cert Number, Year, Set, Card Number, Character, Language, with empty values left out; the old `Serial` trait is now the `Cert Number` key. `frontWithoutStandImageUrl` is removed.
  - In the `submitGachaPull` result, `tier` and `buybackBaseValueInUSD` move from `draws[].collectible` onto `draws[]`, and `snapshotBuybackValueInUsdt` is removed: read the payout from `fetchGachaBuybackOffers`. `collectible` adds `type`, `fmvInUsd`, `fmvUpdatedAt` and `attributes`, and no longer has `imageUrl`.
  - `EoaMachine` and `EoaMachineDetail` no longer have `featuredCardFmvInUsd`.
  - `EoaMachineDetail` no longer has `buybackPercentage` or `buybackWindowSeconds`. Read the new `buybackConfig` instead: every tier as `{ buybackPercentage, buybackExpiredInSeconds }`, soonest end first, without a tier that ends at the same time as an earlier one. The smallest `buybackExpiredInSeconds` is the tier in effect when a draw resolves; the largest is the longest window, after which a pull is released and appears in `listGachaPullHistory`.
  - `EoaBuybackOffer` (`fetchGachaBuybackOffers`) no longer has `amountInUsdt` or `expiresAt`. Read `buybackTiers` instead: every tier as `{ buybackPercentage, amountInUsdt, expiresAt }`, soonest end first. The price now is the first tier whose `expiresAt` has not passed. `createGachaBuyback` signs that price for each offer and refuses an offer that pays nothing now.
  - A buyback whose price changed before it reached Renaiss fails with `GACHA_V3_BUYBACK_PRICE_CHANGED` (HTTP 409) in `ApiError.error`; before, it failed with `GACHA_V3_BUYBACK_VERIFY_FAILED` (HTTP 400). Read the offers again and sign again.

  Additions:

  - `listWalletCollection` entries (`EoaCollectionCard`) carry `type`, `fmvInUsd`, `fmvUpdatedAt` and `attributes`, and `fetchWalletCollectionSummary` returns `collectibleCount`, `totalFmvInUsd` and `collectiblesWithoutFmv`.
  - `EoaMachineContent` (`listGachaMachineContents`) adds `type`, `fmvInUsd`, `fmvUpdatedAt` and `attributes`.
  - `fetchGachaDrawStatus` returns `EoaDrawStatus`: each draw also carries `tier`, `buybackBaseValueInUSD` and a `collectible` (`EoaDrawnCollectible`), the same as the reveal. They are `null` when they could not be loaded.
  - `listGachaMachineContents` takes `tiers` (`GachaMachineTierName[]`) to keep only those tiers; the filter applies before paging, so `totalCount` counts only matching entries.
  - `CollectibleType`, `GachaMachineTierName`, `EoaDrawStatus`, `EoaDrawnCollectible` and `EoaMachineContentsRequest` are exported.
  - `getEoaBuybackTierAt`, `getEoaBuybackOfferEndsAt` and `EoaBuybackTier` are exported.
  - A collectible that the gacha inventory contract holds (pack stock, or a drawn collectible awaiting release) can now be read with `fetchCard`; its `ownerAddress` is that contract.

  The bindings are regenerated from the `/v2` API that serves these changes.

- `prepareGachaPull` and `signGachaPull` take any whole quantity from 1 to 10 (`MAX_GACHA_PULL_QUANTITY`), not only 1, 5 and 10. The `GachaQuantity` enum is removed: pass the number. Three builder-key reads are added to the gacha client. They read `/v2/users/{walletAddress}` and take `{ walletAddress }`: `listWalletCollection` (the cards the address owns on chain, plus the cards it pulled with your builder key that Renaiss still holds; sort by pull time, market value or buyback expiry), `fetchWalletCollectionSummary` (card count and total market value) and `listWalletActivities` (the wallet's chain events with any builder: gacha pulls, buybacks and deliveries, trades, transfers, mints and redemptions, optionally one `EoaActivityFilter`, paged by the API's cursor), with their `is*Error` guards. `listGachaPullHistory` entries carry `imageUrl`, the card alone without slab, frame or background. The bindings are regenerated for these routes. This release needs a `/v2` API that serves these routes and fields; check the deployment's `/v2/docs`. Against an older API the three new reads get an HTTP 404 (`UNKNOWN_ERROR` with status 404), a quantity other than 1, 5 or 10 is refused by the API (`GACHA_V2_REQUEST_FAILED`, status 400), and `listGachaPullHistory` fails with `INVALID_SCHEMA` because its entries have no `imageUrl`.

## 0.1.0-beta.4

### Patch Changes

- `signInRedemptionWallet` now accepts only the current wallet sign-in message: the readable statement, no `Resources` block, and `context` in the nonce response. It refuses the two older formats before asking the wallet to sign, so it needs an API that serves the current format. It also refuses a sign-in message that expires before it was issued, or whose statement gives the access token a longer lifetime than the sign-in.
- `fetchGachaBuybackOffers` now returns every open offer it can read. The API returns at most 20 offers per request by default, so a wallet with more offers used to get only the first 20. The SDK now reads pages of 100 until a short page and removes repeated settlement ids. The pages are read without a snapshot, so read again before a batch buyback. If a page fails, the call fails with that page's code (`GACHA_V2_REQUEST_FAILED` for an API error, `INVALID_SCHEMA` for an unexpected response, `UNKNOWN_ERROR` for a network failure). If the SDK cannot confirm the list is complete, it fails with `GACHA_V2_REQUEST_FAILED` instead of returning a partial list.
- Fix marketplace bids and purchases: the SDK now signs the Permit2 witness type as `Bid`, the name the v2 API and the order book use. Before, `createBid` and `buyCard` failed with `Unexpected marketplace signing types`. Order expiry is capped at 180 days, the API's limit: both `expiresAt` and `expiresInSeconds` are refused beyond it.
- Default error messages that describe a single route's situation are replaced by a neutral sentence, so `ApiError.detail` no longer shows another route's advice when the API sends a code without a message.
- The v2 API no longer returns `accountType` from `prepareGachaPull`. `EoaPreparedPull` no longer has the `accountType` property.
- `privateKey(process.env.PRIVATE_KEY)` no longer throws `UrlRequiredError`. The signer signs locally and needs no RPC URL.
- Accept redeem order responses without `shipmentProvider`. The v2 API stops returning the field. `RedemptionOrder` and `RedemptionOrderSummary` no longer have the `shipmentProvider` property.
- The v2 bindings and error-code lists are regenerated from the `/v2` API release. The API documents every 5xx of the public pack routes as one open server failure, so for those reads treat any 5xx as "retry later" by status, not by code. Reconcile writes and transaction state before submitting again.
- Remove backward-compatibility scaffolding. The SDK is EOA-only.

  Breaking removals from the public surface:

  - `CardDetail.custodyProvider` is removed. Remove references to this property.
  - `RenaissSigner.signSafeTypedData` and the `SafeTypedDataRequest` type.
  - From `@renaiss-protocol/client/viem`: the `safeAddress` option of `ViemSignerOptions`, `PrivateKeySignerOptions` and `InjectedViemSignerOptions`, the deprecated `createViemPrivateKeySigner` alias and its `ViemPrivateKeySignerOptions` type (use `privateKey(value, options)`), and the Safe typed-data signing of the signers they return. Signers sign EOA typed data only.
  - Error codes that no v2 route returns are removed from the public `ApiError` code union. Remove cases for them from exhaustive error handlers. Retry failed reads when appropriate; reconcile writes and transaction state before submitting again.

  Removed internal code that no public entry point reached: the v1 root client factories and their actions, decorators and tests, the v1 error guards, the user API key path of the internal transport (`x-api-key`), its `strictConfiguration` and `params` options, and the non-envelope SSE mode. Configuration checks (explicit `baseUrl`, non-empty `builderApiKey`) now always apply. The marketplace result types (`CreateAskResult`, `CreateBidResult`, `BuyCardResult`, `AcceptBidResult`) are unchanged and keep their exports.

  Also removed unused v1 schemas and error-code lists from the internal, bundled `schema-validation` and `error-codes` packages. The internal bindings are now generated from the v2 OpenAPI document only.

- `REDEMPTION_COUNTRIES`, `RedemptionCountry` and `network.redemption.countries` are removed. The API decides which destinations it ships to (an unsupported country returns `WRONG_REQUEST_PARAMS`); supply your own country list for an address form.
- The package now ships its `LICENSE` and `NOTICE` files.
- Rename `connectRedemptionWallet` and `disconnectRedemptionWallet` to `signInRedemptionWallet` and `signOutRedemptionWallet`, and likewise `SignInRedemptionWalletRequest`, `isSignInRedemptionWalletError` / `isSignOutRedemptionWalletError`, and the types `SignInRedemptionWalletErrorCode` / `SignOutRedemptionWalletErrorCode` (before: `ConnectRedemptionWalletErrorCode` / `DisconnectRedemptionWalletErrorCode`). The old names are removed. Error messages, docs and the demo now call the credential for private Redeem requests the wallet access token; error codes are unchanged, but the text of `REDEMPTION_SESSION_REQUIRED` and several other redemption errors changed.

## 0.1.0-beta.3

### Minor Changes

- Export `BNB_MAINNET` for explicit v2 mainnet selection, with verified BNB contracts and marketplace fee. Preserve the default BNB testnet network and all signing checks.
- Add a root-exported EOA gacha client for the v2 HTTP API with server preparation, direct Permit2 signing, named SSE reveal events, funding-hash recovery, builder-scoped history and buyback. The Next.js demo now exercises the v2 flow on the explicitly selected BNB network (testnet by default), with its builder key kept on the server. The root entry also exports the `GachaPullHistoryEntry` type returned by `listGachaPullHistory`.
- Add a root-exported EOA marketplace client for the v2 HTTP API: public browsing with images and marketplace filters, card pricing/order reads, direct ask/bid/buy/sell signing, and signed exact-order cancellation. Keep builder credentials server-side in the Next.js marketplace demo and show graded slab images in gacha reveals.
- Add a root-exported EOA redemption client for the v2 HTTP API with in-memory wallet sessions, eligible cards, server-priced quotes, independently verified Permit2 batch witnesses, one-shot submission/recovery, and private order/tracking reads. The Next.js network-configurable demo covers card selection, cart, checkout and orders.
- Align EOA gacha and marketplace response types with the v2 HTTP API. Marketplace
  lists contain tile fields and the owner address; structured names remain on
  card detail. Remove redemption-only marketplace fields, duplicate pricing and
  constant order metadata. Gacha reveals no longer include unused `setName` or
  `backImageUrl` fields. Use the matching API deployment and follow the beta
  migration guide when updating response-field access.
- Import the EOA gacha, marketplace and redemption clients directly from
  `@renaiss-protocol/client`. They use the v2 HTTP API. The
  `@renaiss-protocol/client/v2` package subpath is removed without a compatibility
  alias; update existing EOA imports to the root. The optional `/viem` adapter
  stays separate. npm versions remain on the independent 0.x beta release line.

  Breaking prerelease change: v1/Safe clients, standalone actions, schemas and
  generic error helpers are no longer root exports. Same-named response types and
  action error guards now describe v2. Migrate your signing, credential, response
  and error-handling code before upgrading. While migrating, pin your existing
  alpha version exactly: `^0.1.0-alpha.2` also matches `0.1.0-beta.3`.

  The demo uses EOA clients throughout; `/builder-gacha`, `/api/user` and `/api/pull`
  are retired. See the [migration guide](https://github.com/Renaiss-Protocol/renaiss-sdk/blob/main/docs/migration-beta.md).

## 0.1.0-alpha.2

### Minor Changes

- Allow gacha pulls to supply an optional on-chain `builderCode` and preserve the API-resolved zero-code fallback through signing and streaming.
- Expose gacha machine tier summaries through `fetchGachaMachine` and the web example.
- Target the Renaiss API `v1` namespace. Requests to the gacha, config, wallet and user routes now use `/v1/*` (authentication routes are unchanged), and the user resource moved from `/v0/users/*` to `/v1/user/*`. Request and response shapes are unchanged, so no consumer code changes are required.
- Support builder-authorized writes and the multi-pack gacha flow, including builder-bound canonical Permit2 witnesses, settlement-ID buybacks, draw-resolved streams, and draw-status recovery.
