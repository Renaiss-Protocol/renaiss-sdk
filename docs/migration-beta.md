# Migrate to the EOA beta

The `0.x.y-beta.n` releases make `@renaiss-protocol/client` the entry point
for the v2 HTTP API. This is a breaking prerelease change for consumers of the
alpha root API. The npm package version is independent of the HTTP API version.

## Existing EOA integrations

Change the import to the package root:

```ts
import {
  BNB_TESTNET,
  createGachaClient,
  createMarketplaceClient,
  createRedemptionClient,
} from '@renaiss-protocol/client';
import { signerFrom } from '@renaiss-protocol/client/viem';
```

The `@renaiss-protocol/client/v2` package subpath has been removed. Update every
import to `@renaiss-protocol/client`; there is no compatibility alias. This
changes the package import, not the `/v2` HTTP routes. The optional viem adapter
stays separate; only viem consumers need to install `viem`.

Each factory still requires an explicit `baseUrl` for the API or your backend
proxy. Pass the matching network constants and an EOA signer. The builder key
stays on your backend. Existing approval, chain, contract, amount, expiry and
signing-context checks remain in place.

## Existing v1/Safe root integrations

`createPublicClient`, `createSecureClient`, `createBuilderClient` and
`createSigningClient` are no longer exported. Their v1/Safe flows have no
supported compatibility entry in this release. This includes consumers of the
published alpha API.
Keep an exact version of your existing alpha until you complete the migration.

For example, if you currently use `0.1.0-alpha.2`:

```sh
npm install --save-exact @renaiss-protocol/client@0.1.0-alpha.2
```

Your dependency should read `"@renaiss-protocol/client": "0.1.0-alpha.2"`, with
no caret or tilde, and you should retain your lockfile. A range such as
`^0.1.0-alpha.2` also matches `0.1.0-beta.5`; a fresh resolution or update can
therefore select the breaking beta. Pin the alpha version you actually use.

| Previous concern | EOA beta integration |
| --- | --- |
| Public gacha browsing and pulls | `createGachaClient` |
| Marketplace browsing and trading | `createMarketplaceClient` |
| Private shipping and redemption | `createRedemptionClient` |
| Renaiss user API key and Safe signing | Your application's EOA signer and server-side builder key |
| Private Redeem authentication | A wallet access token from `signInRedemptionWallet()`, kept in memory |

This is not a mechanical factory rename. V2 uses direct EOA signatures and
wallet ownership; do not pass a Safe address as though it were the user's EOA
or reuse a v1 signing payload. Follow the [gacha](eoa-v2.md),
[marketplace](marketplace-v2.md) and [redemption](redeem-v2.md) guides. The SDK
does not move assets held by an existing Safe.

Other removed or changed root exports:

- `GachaQuantity` is removed. A pull takes any whole number of cards from 1 to
  `MAX_GACHA_PULL_QUANTITY` (10), so `quantity` is a plain `number`: replace
  `GachaQuantity.Five` with `5`.
- Standalone v1 actions and their response schemas are no longer exported.
  Use methods on the EOA clients; they validate API responses internally.
- `exhaustive`, `isRenaissError` and the broad `ErrorCode` type are removed.
  Use `isFailed` and `getError` to inspect a Result, then an action-specific
  `is*Error` guard and its exported error-code type. Use a local `never` check
  for exhaustive switches.
- Same-named guards such as `isCreateAskError`, `isBuyCardError`,
  `isFetchCardError`, `isListGachaMachinesError` and `isSubmitGachaPullError`
  now narrow v2 error codes. Revisit switches that handle v1-only cases.
- Gacha and marketplace error-code types now have a `V2` prefix:
  `ListGachaMachinesErrorCode` becomes `V2ListGachaMachinesErrorCode`, and
  `CreateAskErrorCode` becomes `V2CreateAskErrorCode`. Their unprefixed type
  names are no longer exported, even where the guard name stays the same.
- `MarketplaceCard`, `CardDetail` and `CardOrders` now describe v2 response
  shapes. Recheck field access when migrating; the old v1-only types and guards
  are not compatibility exports.

The Next.js demo uses the root client for every workflow. `/builder-gacha`,
`/api/user` and `/api/pull` have been removed.

## Install the beta

Beta versions are published under the `beta` npm tag:

```sh
npm install @renaiss-protocol/client@beta
```

The package is at `0.1.0-beta.5`; the publishing workflow derives the `beta` tag
from the `-beta.n` version suffix. No npm major-version-2 bump is part of this
migration.
