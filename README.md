# Renaiss TypeScript SDK

Build gacha, marketplace and physical-card redemption into your application with
`@renaiss-protocol/client`.

The SDK is in beta (`0.1.0-beta.5`) and supports the v2 HTTP API. Beta versions
are published to the `beta` npm tag. See the
[beta migration guide](docs/migration-beta.md) if you used the earlier alpha.

Install:

```sh
npm install @renaiss-protocol/client@beta
```

```ts
import {
  createGachaClient,
  createMarketplaceClient,
  createRedemptionClient,
} from '@renaiss-protocol/client';
```

## Choose an integration

| Entry point | Clients | Account model |
| --- | --- | --- |
| `@renaiss-protocol/client` | `createGachaClient`, `createMarketplaceClient`, `createRedemptionClient` | Your existing EOA signer |
| `@renaiss-protocol/client/viem` | `signerFrom` | Optional viem wallet adapter |

For a partner integration, keep your own login and wallet system. Pass its EOA
signer to the clients. Gacha and marketplace authorize individual wallet
actions; redemption additionally needs a wallet access token for private
Redeem requests, which the wallet gets by signing in. A builder API key
identifies your integration and stays on your backend.

Start with the [gacha guide](docs/eoa-v2.md), [marketplace guide](docs/marketplace-v2.md)
or [redemption guide](docs/redeem-v2.md). [Network selection](docs/demo-networks.md)
documents testnet/mainnet constants and deployment prerequisites. Public reads
require no credentials. Each method returns a `Result`; use `isFailed`,
`getError` and `getValue` to handle it.

## Run the demo

Use Node.js 24 or newer and pnpm 10 or newer:

```sh
nvm use
corepack install
pnpm install
cp .env.example .env.local
# Set the API environment and server-only builder key in .env.local.
pnpm build
pnpm --filter web dev
```

Open http://localhost:3000. The demo defaults to BNB testnet. Set
`NEXT_PUBLIC_RENAISS_NETWORK=mainnet` and matching API credentials to opt into
mainnet, then restart development or rebuild production. Changing a runtime
variable cannot change the network compiled into a production browser bundle.

The [demo README](examples/web/README.md) covers signing in for Redeem, interrupted
purchases, recovery, mainnet availability and optional funded testnet scripts.

## Repository

| Directory | Purpose |
| --- | --- |
| `packages/client` | Public SDK and optional wallet adapters |
| `packages/schema-validation` | HTTP and stream response schemas |
| `packages/fp` | Result and Action primitives |
| `packages/error-codes` | Error codes and action-specific types |
| `packages/bindings` | Generated API types used during development |
| `examples/web` | Next.js integration demo |

`pnpm build`, `pnpm test`, `pnpm lint` and `pnpm typecheck` validate the workspace.
Build dependencies before checking consumers of their packaged `dist` exports.
See [SDK architecture](docs/sdk-direction.md) for contributor conventions.

## Releases

Changesets record release notes and version changes. The release workflow opens
a version PR; the separately approved tag workflow publishes the client package.
Prereleases use the `beta` npm dist-tag. The root entry now exposes EOA clients
and no longer exports the alpha's v1/Safe clients. This is a breaking prerelease
change; migrate the signing and credential flow before updating an alpha
integration. The [migration guide](docs/migration-beta.md) covers both alpha
consumers and replacing the removed `/v2` package subpath with root imports.
The HTTP API version does not set the npm package's major version.

Pin an existing alpha version exactly while migrating: `^0.1.0-alpha.2` also
matches `0.1.0-beta.5`. The migration guide includes an exact-version install.

Report bugs and integration feedback through this repository's issues. Do not
include API keys, wallet access tokens, refresh tokens, private keys or shipping details in public reports.

## Disclaimer

All Pokémon trademarks, logos, and images are owned by The Pokémon Company. All One Piece and related marks are trademarks of Eiichiro Oda and Shueisha Inc. Renaiss is not affiliated with or endorsed by The Pokémon Company, Nintendo, Shueisha Inc., Eiichiro Oda, or any related entities, nor by the grading companies named in this project.

## License

[MIT](LICENSE). Third-party notices are in [NOTICE](NOTICE).
