# @renaiss-protocol/client

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
