---
'@renaiss-protocol/client': minor
---

Follow the v2 API's collectible names and shape and its buyback tiers. This release needs a `/v2` API that serves them; check the deployment's `/v2/docs`. Against an older API the renamed routes get an HTTP 404 (`UNKNOWN_ERROR` with status 404) and the changed reads fail with `INVALID_SCHEMA`.

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
