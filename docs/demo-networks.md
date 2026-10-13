# Demo network selection

Set `NEXT_PUBLIC_RENAISS_NETWORK=testnet` (default) or `mainnet` in root
`.env.local`. Set `RENAISS_API_URL`, `NEXT_PUBLIC_RENAISS_API_URL` and the
server-only builder key for the same API environment. Restart the dev server or
rebuild the app after changing public variables. See the [demo setup](../examples/web/README.md#mainnet-or-testnet).

One selection controls the network badge, chain ID, RPC, wallet switching and
checks, USDT, Permit2, signing contracts, buybacks, explorer links and the chain
portion of recovery-storage keys. The API hostname never implicitly selects
mainnet. Unknown network settings fail startup. No `/config` request is needed.

All three EOA clients default to `BNB_TESTNET` contracts and require an explicit
`baseUrl` for the matching API or partner backend proxy. The SDK has no built-in
API host: testnet is `https://dev-api.renaiss.xyz` and mainnet is
`https://api.renaiss.xyz`. The demo reads the host from `RENAISS_API_URL`.
Mainnet callers select their network explicitly:

```ts
import {
  BNB_MAINNET,
  createGachaClient,
  createMarketplaceClient,
  createRedemptionClient,
} from '@renaiss-protocol/client';

const baseUrl = 'https://api.renaiss.xyz';
const network = BNB_MAINNET;
const gacha = createGachaClient({ baseUrl, network });
const marketplace = createMarketplaceClient({ baseUrl, network });
const redemption = createRedemptionClient({ baseUrl, network });
```

These are read-only clients until a signer and the necessary authentication are
supplied. The demo sends builder credentials through its server proxy and verifies
the gacha token and Permit2 before approval. Marketplace/redemption preserve the
SDK's checks of chain, contracts, wallet, fees and signed data. Signing in for Redeem
also requires the partner browser origin to be registered for that builder.
`walletSessionIssuer` separately sets the `/v2/auth/wallet` URL that issues
wallet access tokens.

### Gacha approval guard

`prepareGachaPull` checks the selected network's chain, token, Permit2 and
vending-machine contract, fixed EIP-712 types, and `expectedPriceInUsdt` before
returning approval requirements. Pass the per-card price displayed to the user.
If it changed, refresh the display and ask the user to review it again.

`signGachaPull` additionally requires `expected` with the reviewed pack ID,
on-chain pack ID, per-card price and quantity. Capture those values from the
selected machine before preparation; do not copy them from the preparation.
See the [complete gacha example](eoa-v2.md). Check the connected wallet and chain,
balance and allowance; approve only the reviewed required amount if needed.

## Mainnet reference (chain 56)

| Setting | Value |
| --- | --- |
| TokenVendingMachineV3 | `0xd4d18607d6111c5fa2f93a4a5b2c0e28f1563f9f` |
| NFT | `0xF8646A3Ca093e97Bb404c3b25e675C0394DD5b30` |
| USDT (18 decimals) | `0x55d398326f99059fF775485246999027B3197955` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| OrderBook | `0xAE3e7268EF5A062946216A44f58A8F685fFD11d0` |
| CollectibleCashier | `0x3F364C839fa0C81485d39E2887917153d95e63AF` |
| CollectibleManager diamond | `0xB95F8867fF54fd16342Cb414c0F57237be7Dc512` |
| Marketplace platform fee | 200 basis points |
| Redemption cart limit | 50 cards |

The cart limit is shared with testnet. The API remains
authoritative for shipping eligibility, quotes and checkout prices. A fee or
contract change requires a coordinated SDK update; never copy new expectations
from a signing response just to make validation pass.

## Testnet reference (chain 97)

| Setting | Value |
| --- | --- |
| TokenVendingMachineV3 | `0xeeddf88d5cb406cc27f6eea4636566b4943e3737` |
| NFT | `0x57eE95884Ac93E6d081Fd9366AFEF9891C8Eceb4` |
| Mock USDT (18 decimals) | `0x3d2745c844cee4a62B66DF18b5Fd93781C26958b` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| OrderBook | `0x2F562bAE70Ea1Efc9BFC7BC9ccE9a4e2d6bE8A6c` |
| CollectibleCashier | `0x34C63BDD63c437aAd7dA28961817DEb981a06A29` |
| CollectibleManager diamond | `0xc3dc2f3a70742c5ec29b82a60a2d0fe1e3b558ed` |
| Marketplace platform fee | 200 basis points |
| Redemption cart limit | 50 cards |

## API availability

The network constants identify contracts; they do not enable routes in an API
deployment. Use the matching API, builder key and registered frontend origin.
Check the selected deployment's `/v2/docs` before offering a feature.

Mainnet addresses were checked against deployed bytecode and contract links at
BNB block 124710740. The funded demo scripts are restricted to testnet and mock
tokens.

## Static metadata

Read `network.marketplace` and `network.redemption` from `BNB_TESTNET` or
`BNB_MAINNET`. `MAX_REDEMPTION_CARDS` is also exported. The network carries no
country list: the API decides at quote and address validation time which
destinations it ships to, so an app supplies its own country input for its address form.
Quotes, shipping eligibility, cart rules and prices remain server-validated.
Contract or fee changes require coordinated SDK and API updates.
