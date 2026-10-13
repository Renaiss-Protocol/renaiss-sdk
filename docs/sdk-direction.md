# SDK direction

`@renaiss-protocol/client` is the shipping TypeScript SDK. The repository also
contains internal bindings, response schemas, error codes and Result primitives.
The Next.js examples are under `examples/web`.

Keep workflows typed and explicit, errors as Result values,
wire validation in schema-validation, lazy pagination for `list*`, and wallet
libraries isolated to optional adapter entry points. Currency arithmetic uses
bigint; JSON amounts remain decimal strings.

The root entry point supports direct EOA gacha, marketplace and redemption via
`/v2/gacha`, `/v2/marketplace` and `/v2/redeem`. A server
builder key supplies attribution, public reads require no credential, and each
purchase/buyback requires the buyer's action signature. There is no mandatory
Renaiss user, social onboarding, Safe, or wallet access token for gacha and marketplace. Private Redeem requests
require a wallet access token, which the partner signer gets by signing a
sign-in message. The demo
at `/`, `/gacha` and `/marketplace` defaults to testnet; set
`NEXT_PUBLIC_RENAISS_NETWORK=mainnet` for mainnet with the matching API.
It keeps the key on its backend. See [demo network selection](demo-networks.md).

`createMarketplaceClient` handles public browsing and EOA order workflows.
Each trade prepares, validates, signs and submits once. Only the v2 HTTP API is
supported by the published client. Import EOA clients from the package root;
the `/v2` package subpath has been removed. The old v1/Safe factories are
no longer public; no account-mode parameter switches signing flows.
See the [marketplace guide](marketplace-v2.md) for approvals, cancellation and recovery.

EOA pulls use server preparation, explicit wallet allowance handling, direct
Permit2 signing and one stream submission through card reveal. Keep the funding
hash for recovery; never automatically retry an uncertain payment. Buyback
signatures sum compatible offers with bigint and do not need NFT approval.

See the [gacha](eoa-v2.md), [marketplace](marketplace-v2.md) and
[redemption](redeem-v2.md) guides for the public workflows.
Existing alpha integrations must follow the [beta migration guide](migration-beta.md).
