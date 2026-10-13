# Renaiss TypeScript client

Embed gacha, marketplace and physical-card redemption using your application's
existing EOA wallet. The client uses the v2 HTTP API; npm releases use independent
`0.x.y-beta.n` versions.

Install the beta:

```sh
npm install @renaiss-protocol/client@beta
```

For a browser application with its own backend proxy:

```ts
import {
  BNB_TESTNET,
  createGachaClient,
  createMarketplaceClient,
  createRedemptionClient,
  getValue,
  isFailed,
} from '@renaiss-protocol/client';

const gacha = createGachaClient({
  baseUrl: '/api/renaiss', // Your backend proxy to the selected Renaiss API.
  network: BNB_TESTNET,
});

const result = await gacha.listGachaMachines().firstPage();
if (!isFailed(result)) console.log(getValue(result));
```

Public reads require no credentials. For wallet actions, pass an EOA signer.
Keep the builder API key on your backend. Private Redeem requests additionally
require a wallet access token: the wallet signs in with `signInRedemptionWallet()`. Use `@renaiss-protocol/client/viem` for the optional
viem adapter; install `viem` when using that entry point. Node.js 24 or newer is
required.

The `@renaiss-protocol/client/v2` package subpath has been removed; update
existing EOA imports to `@renaiss-protocol/client`. The
v1/Safe clients and their standalone actions, schemas and generic error helpers
are no longer exported. Some same-named types and error guards now describe v2.
Existing v1 integrations must migrate before upgrading; pin an existing alpha
version exactly while doing so, because an alpha caret range can match the beta.

See the [repository guides](https://github.com/Renaiss-Protocol/renaiss-sdk#readme)
and [migration notes](https://github.com/Renaiss-Protocol/renaiss-sdk/blob/main/docs/migration-beta.md).

## License

MIT, see [LICENSE](https://github.com/Renaiss-Protocol/renaiss-sdk/blob/main/LICENSE). Third-party notices are in [NOTICE](https://github.com/Renaiss-Protocol/renaiss-sdk/blob/main/NOTICE).

## Disclaimer

All Pokémon trademarks, logos, and images are owned by The Pokémon Company. All One Piece and related marks are trademarks of Eiichiro Oda and Shueisha Inc. Renaiss is not affiliated with or endorsed by The Pokémon Company, Nintendo, Shueisha Inc., Eiichiro Oda, or any related entities, nor by the grading companies named in this project.
