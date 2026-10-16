---
'@renaiss-protocol/client': minor
---

Follow the v2 API's move from "cards" to "collectibles", its FMV rename and its tiered buybacks. Earlier releases now fail against the API: redeemable cards return 404, and pack, card detail, pull reveal and buyback offer responses fail with `INVALID_SCHEMA`. These changes are breaking.

**Renamed fields**

- `fmvPriceInUsd` is now `fmvInUsd` on marketplace cards, card details, redeemable cards and redemption orders.
- `MarketplaceV2Sort.FmvPrice` is now `MarketplaceV2Sort.Fmv`, which sends `sortBy=fmvInUsd`.
- Redemption orders and order summaries list their items in `collectibles` instead of `cards`.

**Marketplace card details**

- `fetchCard` returns `type` (for example `POKEMON`) and `attributes` as `{ key, value }` pairs.
- `setName`, `cardNumber`, `pokemonName`, `gradingCompany`, `grade`, `year` and `frontWithoutStandImageUrl` are removed. Read them from `attributes` by key: `Grader`, `Grade`, `Cert Number`, `Year`, `Set`, `Card Number`, `Character` and `Language`.
- `CardAttribute` (`{ trait, value }`) is now `CollectibleAttribute` (`{ key, value }`).

**Gacha machines and pulls**

- `EoaMachine.featuredCardFmvInUsd` is removed.
- `EoaMachineDetail.buybackPercentage` and `buybackWindowSeconds` are replaced by `buybackConfig`, a list of `{ buybackPercentage, buybackExpiredInSeconds }` tiers. The headline percentage is the highest `buybackPercentage`. The buyback window is the largest `buybackExpiredInSeconds`.
- In a pull reveal (`submitGachaPull`), each draw now carries `tier` and `buybackBaseValueInUSD`. Its `collectible` is `{ type, name, frontImageUrl, fmvInUsd, fmvUpdatedAt, attributes }`. `imageUrl` and `snapshotBuybackValueInUsdt` are removed.

**Tiered buybacks**

- `EoaBuybackOffer` replaces `amountInUsdt` and `expiresAt` with `buybackTiers`, a list of `{ buybackPercentage, amountInUsdt, expiresAt }`, soonest end first.
- The new `currentBuybackTier(offer, at?)` returns the tier that sets the price now.
- `createGachaBuyback` signs the sum of each offer's current tier price at signing time. It refuses an offer that is on hold (a current tier that pays 0) or whose tiers have all ended.
- If a tier ends between signing and submission, `submitGachaBuyback` fails with `GACHA_V2_REQUEST_FAILED` (status 409), keeping `GACHA_V3_BUYBACK_PRICE_CHANGED` in `ApiError.error`. Read the offers again and sign the new amount.
