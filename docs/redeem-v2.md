# EOA redemption v2

Use your application's existing EOA signer to sign in for Redeem and to redeem cards. No Renaiss user account or Safe is required.

## Creating the client

`createRedemptionClient({ baseUrl, network, walletSessionIssuer?, builderApiKey?, signer?, expectedChainId: network.chainId })` from `@renaiss-protocol/client` keeps the wallet access token in memory only, so the user signs in again after a reload.

The SDK defaults to `BNB_TESTNET`. Pass `network: BNB_MAINNET` for explicit
mainnet use, with a matching API and `expectedChainId: BNB_MAINNET.chainId`.
The demo selects these from `NEXT_PUBLIC_RENAISS_NETWORK` (testnet by default).
See [demo network selection](demo-networks.md) for verified contracts and
matching API settings.

## Methods

Every method returns a `Result`. The two list methods return a `Paginated` value:
call `.firstPage()` for the first page, or `.from(cursor).firstPage()` to continue
from a saved cursor. Values are SDK values: token ids and amounts are `bigint`,
and timestamps stay ISO strings.

### Network metadata

`network.redemption` holds static metadata for the selected network: the chain
id, the token, Permit2, cashier and manager contract addresses and the cart limit
(`maxCards`). Reading it makes no request. `MAX_REDEMPTION_CARDS` is also
exported. The SDK carries no country list: send a two-letter `countryCode`, and
the API decides at address validation and quote time which destinations it ships
to and whether a state is needed.

### Signing in

`signInRedemptionWallet({ origin })` has the partner's existing signer sign a
sign-in message and returns `{ walletAddress, expiresAt }`. The client keeps the
resulting wallet access token, valid for `redeem:read` and `redeem:write`, in
memory. The origin must be registered for your builder.
`signOutRedemptionWallet()` revokes the tokens from this sign-in and clears them.
The sections below describe the message and its timers.

### Reading eligible cards and regions

`listRedeemableCards` pages through the cards this wallet can redeem. All
parameters are optional: `search` (text up to 200 characters), `countryCode`
(two uppercase letters), `sortBy` (`RedemptionCardSort.Fmv` or `.CreatedAt`),
`sortOrder` (`RedemptionSortOrder.Ascending` or `.Descending`) and `pageSize`
(1 to 50, default 50). Each card has `tokenId`, `name`, `frontImageUrl`,
`fmvInUsd`, `fmvUpdatedAt` and `ownerAcquiredAt` (each can be `null`),
`regionCountryCode` and `vaultDisplayName`. Pages carry `totalCount` and
`hasMore`.

```ts
const cards = client.listRedeemableCards({
  sortBy: RedemptionCardSort.Fmv,
  sortOrder: RedemptionSortOrder.Descending,
});
```

`fetchRedemptionRegions()` counts the wallet's redeemable cards by region and
returns `{ counts }`, a record from a region key to a number of cards.

### Address validation and quotes

`validateRedemptionAddress({ address })` asks the API to check a shipping address
and returns `{ status, detail }`, both strings. Show `detail` to the user and let
them correct the address or confirm it as entered.

`fetchRedemptionQuote({ tokenIds, address })` quotes shipping for 1 to 50
distinct cards to one address. The API refuses a cart whose cards are not in one
region. The result has `quoteId`, `expiresAt`, `handlingFeeInUsd` and a list of
`couriers`. Each courier has an `id`, a `name`, a `logoUrl` (or `null`),
`estimatedDays` and three amounts: `shippingFeeInUsd`, `insuranceFeeInUsd` and
`dutyAndTaxesInUsd`. The server calculates every amount, and rates expire after
ten minutes, so request a new quote once `expiresAt` has passed.

### Fee units

The `...InUsd` fee amounts are USD cents. `totalFeeInUsdt` is in the token's
18-decimal base units: it equals handling, shipping and insurance fees in cents
multiplied by 10^16, and the client rejects a prepared redemption where it does
not. Duties and taxes (`dutyAndTaxesInUsd`) are shown for information only: they
are payable on delivery and are not part of `totalFeeInUsdt`, the amount the
wallet signs.

### Preparing, signing and submitting

`prepareRedemption({ quoteId, courierId, recipient, insurance })` binds a quote
to one courier and a recipient on the server. `insurance` is a required boolean.
The result (`PreparedRedemption`) holds `preparationId`, `requestId`,
`walletAddress`, `tokenIds`, `expiresAt`, the `address`, the `recipient`,
`courierName`, a `fees` breakdown (the four fee amounts and `totalFeeInUsdt`) and
the typed data to sign.

`signRedemption({ prepared, expected })` signs the Permit2 batch with the
wallet. Build `expected` from what the user reviewed (`tokenIds`,
`totalFeeInUsdt`, `address` and `recipient`), not from the server response. Before
asking the wallet to sign, the client checks the card set, amount, address and
recipient against `expected`, the wallet against the signer, the chain and
contracts against the network configuration, and the expiry against the clock.
It also recomputes the
batch witness hash itself. It returns `{ preparationId, requestId, signature }`
and fails with `REDEMPTION_SIGNING_FAILED` if the wallet does not sign.

`submitRedemption({ signed })` sends only the preparation id and the signature
and returns `{ requestId, status, transactionHash? }`. The status is `prepared`,
`submitting`, `succeeded` or `failed`. The client does not retry a submission. If
the outcome is uncertain, do not send it again: read the state with
`fetchRedemptionCheckout`. Before submitting, persist only the preparation id,
request id and wallet address, never the address, signature or tokens.

`fetchRedemptionCheckout({ preparationId })` reconciles a submitted preparation
and returns the same `{ requestId, status, transactionHash? }`. Use it to recover
from an interrupted or uncertain submission.

### Orders and tracking

`listRedemptionOrders({ pageSize? })` pages through this builder's orders for the
wallet. `pageSize` is 1 to 20 and defaults to 10. Pages report `hasMore` but no
total. Each entry has `requestId`, `status`, `trackingNumber`, `shipmentStatus`
and a short `collectibles` list (`tokenId`, `name`, `frontImageUrl`, `fmvInUsd`). A
newly submitted order may not appear until it is indexed; keep using
`fetchRedemptionCheckout` until it does.

`fetchRedemptionOrder({ requestId })` returns one order in full: `status`,
`tokenStatuses`, `address`, `recipient`, `courierName`, the estimated delivery
range in days (`estimatedDeliveryDaysMin` and `Max`, either can be `null`), a
`fees` breakdown without a total, tracking (`trackingNumber`, `trackingUrl`,
`shipmentStatus`, `trackingLastSyncedAt`), `createdAt`, `updatedAt` and `cards`.
The cards have the same fields as eligible cards, without `ownerAcquiredAt`.

`syncRedemptionTracking({ requestId })` asks the API to refresh the order's
tracking and returns the same order shape as `fetchRedemptionOrder`.

Addresses contain country, street, city, state and postal code; recipients include
name, E.164 phone, email and destination-specific tax or Chinese-name fields.
The demo checks field lengths and the two-letter country code format; the API
validates destination eligibility, state requirements and courier requirements.

The demo supports same-region carts, a 50-card limit, courier selection, insurance,
order history and tracking. Quotes calculate shipping and handling fees; duties
are displayed separately. Balance and Permit2 checks use the selected network.
The developer panel maps API fields to the example's UI and signing checks.

Use the selected API deployment's `/v2/docs` for REST request and response contracts. Network metadata is bundled in the SDK; there is no config endpoint.


## Partner login, wallet attachment and signing in for Redeem

The partner owns account login/logout and wallet provisioning (for example,
through its own wallet provider). Give the SDK that existing EOA signer. No renaiss.xyz
customer, SAFE or separate Renaiss login is needed for direct EOA gacha,
marketplace or redemption. External wallets may show confirmation prompts;
embedded-wallet behavior belongs to the partner's wallet configuration.

The demo labels gacha/marketplace attachment **Connect wallet / Disconnect
wallet**. Redemption first attaches the wallet, then asks **Sign in for
Redeem** before private cards/orders or shipping data are requested. **Sign out
of Redeem** revokes the tokens while keeping the wallet attached. Disconnecting
signs out as well. On partner logout, account change or chain change call
`signOutRedemptionWallet()` and clear private UI state. If a sign-in finishes
after the wallet signs out, the newly received tokens are discarded and revoked
on a best-effort basis.
Purchase/listing/redemption signatures still happen at the action being authorized.

```ts
const network = BNB_TESTNET; // Explicit mainnet opt-in: BNB_MAINNET.
const shipping = createRedemptionClient({
  baseUrl: '/api/renaiss', // Same-origin partner backend keeps its builder key.
  network,
  walletSessionIssuer: 'https://your-api-host.example/v2/auth/wallet',
  signer: partnerSigner,
  expectedChainId: network.chainId,
});
const signedIn = await shipping.signInRedemptionWallet({
  origin: window.location.origin,
});
// Later, when the user leaves Redeem or logs out of the partner app:
await shipping.signOutRedemptionWallet();
```

`origin` is required, with no implicit API-host fallback. Non-browser callers
supply the exact origin of their signing frontend. Register canonical HTTPS
origins; explicitly registered HTTP loopback origins are supported for local
work. `http://localhost:3100` and `http://127.0.0.1:3100` require separate entries.
No path, trailing slash, credentials, wildcard, query or fragment is accepted.
The SIWE formatter supports dotted DNS hosts with an alphabetic TLD of at least
two letters, IPv4 literals and `localhost`; IPv6, other single-label hosts,
underscores, trailing dots and non-alphabetic TLDs are rejected before requests.
The SDK validates frontend scheme/host/port/URI independently from the API issuer
(`walletSessionIssuer`) and audience, along with wallet, chain, expiry and scopes,
before prompting. Repeated sign-ins reuse or refresh the same tokens without
another signature. If the refresh returns 401 (expired or revoked refresh token),
the same call asks for a fresh signature of a new sign-in message; other
failures are returned without a new prompt. Sign out before selecting a
different origin.

### Readable sign-in message

Sign-in messages requesting exactly `redeem:read` and `redeem:write` explain the
permission and how long the sign-in lasts:

> Sign in to Renaiss for shipping on partner.example. By signing, you allow partner.example to access your Renaiss shipping and redemption requests for this wallet for up to 7 days (access tokens last 15 minutes and can renew within this session). This does not authorize a transaction.

The partner host, the wallet access token lifetime and how long the refresh
token lasts come from server configuration. The signed message keeps standard SIWE fields, including
origin URI, wallet, chain, nonce,
issued/expiry times and request ID. It has no custom `Resources` block.
`POST /v2/auth/wallet/nonce` instead returns SDK metadata in
`context: {builderAppId, issuer, audience, scopes}`. The SDK checks the configured
API identity and the exact Redeem permissions before signing the original
message byte for byte. It never appends context or submits context to `/verify`.
The API authorizes against its stored, single-use sign-in message and current
builder registration, not client-supplied metadata.

The SDK accepts only this format. Before asking the wallet to sign, it refuses a
sign-in message with a `Resources` block or with another statement, and a nonce
response without `context`.

The Renaiss sign-in message lasts five minutes by default and works once. The
wallet access token lasts up to 15 minutes; read `expiresAt`. The refresh token works once and
lasts seven days from the sign-in by default; refreshing does not extend it, and
reusing a refresh token revokes all tokens from that sign-in. A refresh close to
the seven-day limit returns a shorter-lived wallet access token. If a wallet prompt
outlives the sign-in message, call `signInRedemptionWallet()` again for a fresh
one. These are separate timers.

SIWE Resources are [optional](https://eips.ethereum.org/EIPS/eip-4361#message-fields).
For exactly the two Redeem scopes above, validation metadata is returned in
`context` instead.

Deploy with an API that issues wallet access tokens bound to registered origins. Ask Renaiss
to register your builder's exact frontend origins before use. The client gets a
Renaiss wallet access token with the wallet signature.

## Expired or cancelled sign-in

The sign-in message lasts five minutes. Its expiry is separate from the wallet
access token's lifetime (up to 15 minutes; read `expiresAt`). If the wallet prompt remains
open past the sign-in message's expiry, the SDK returns a clear retry error and
does not exchange the expired signature. Call `signInRedemptionWallet()` again
for a fresh sign-in message. Cancellation also leaves the wallet attached but
signed out; retry only after the user's next sign-in action.

The signed message identifies the partner's origin and Redeem permission.
The API binds the builder, issuer/audience and scopes to the saved sign-in message.
The SDK validates the separate context before signing. Configure a stable API issuer
independently of the frontend origin and sign the returned message intact.

The wallet access token and its refresh token stay in memory. Clear private UI state on logout, account
changes and chain changes. Do not store bearer tokens, signatures, addresses or
contact details in a recovery journal; store only the IDs needed to reconcile
an uncertain checkout.

## Network and issuer configuration

Use `network.redemption` for versioned contract and cart-limit metadata.
Set `baseUrl` explicitly to a matching API or partner backend proxy;
network constants do not choose a service hostname. `walletSessionIssuer` is the `/v2/auth/wallet` URL
that issues wallet access tokens. Relative proxies require it set to the API's
canonical URL; never derive that expectation from an incoming sign-in message. See [network references](demo-networks.md).

Wallet access tokens last up to 15 minutes; read `expiresAt`. The signed consent also discloses
the seven-day limit on refreshing. The SDK keeps the tokens in memory and
revokes them on sign-out. Sign-in message and quote validation tolerate up to
two minutes of a slow device clock; larger differences prompt the user to
synchronize the clock. Expired sign-in messages and quotes remain rejected.

If a fresh signing window is already expired when it arrives, your device clock
may be ahead. Synchronize its date and time before retrying. Repeated preparation
alone cannot fix clock skew; the SDK keeps all expiration limits enforced.
