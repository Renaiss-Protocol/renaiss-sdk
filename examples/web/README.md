# Next.js SDK demo

The default page (`/`, also `/gacha`) uses the EOA client at
`@renaiss-protocol/client` and the `/v2/gacha` API. The `.env.local` setting
`NEXT_PUBLIC_RENAISS_NETWORK` selects BNB testnet (the default) or BNB mainnet.
`/marketplace` uses the EOA-only `/v2/marketplace` API. All demo workflows import
the package root.

From the repository root:

```bash
pnpm install
cp .env.example .env.local
# Select the network, matching API URL and server builder key.
pnpm --filter web dev --hostname 127.0.0.1 --port 3100
```

The `dev` script builds the SDK packages the demo depends on before it starts,
because the demo imports their built `dist` output. After changing SDK code,
restart it to pick up the change.

Open http://127.0.0.1:3100. The page shows the machine list (badge, status,
price, EV, catalog maximum, instant buyback, top tier range), a
detail view (pull-history ticker, machine media, price and set EV, quantity
stepper, rip button, pack info, tier pills, card grid) and the rip flow (no
confirmation dialog; the button label cycles through the stream stages; the
reveal shows tier, name, buyback base value, instant buyback, Keep / Sell and the offer
countdown). Tier percentages are each tier's share of the whole set, and set EV
is the mean value of the whole set.
Deep-link a machine with `?machine=<slug>`.

The rip button checks balance and allowance, uses exact-amount approval (with a
zero reset when needed), waits for approval success, signs the Permit2 permit
and streams the reveal. Offers can be accepted from the reveal or from "Your
pulls & offers". A pending pull is journaled before funding and can be
reconciled by funding hash.

The "Developer" section at the bottom has a field-by-field coverage table for
every `/v2/gacha` response (shown / sdk / derived / unused), a
"Wire vs SDK" fetch that diffs raw JSON against the coverage map so new fields
surface as "unmapped", the SDK-parsed responses and the SSE event log. The map
lives in `app/eoa/api-coverage.ts`.

The supplied `.env.example` targets the API testnet at
`https://dev-api.renaiss.xyz`.

`RENAISS_API_URL` selects the server upstream. `NEXT_PUBLIC_RENAISS_API_URL`
identifies the environment for local recovery storage; browser requests always
use `/api/renaiss`. `RENAISS_BUILDER_API_KEY` stays on the server.
Builder attribution comes from that key. No private key belongs in a
`NEXT_PUBLIC_*` variable.

The proxy allowlists v2 gacha, marketplace and redemption routes, limits request bodies, rejects cross-origin
requests and streams responses without buffering. Public reads (the machine list,
machine detail, content and pull history, and the marketplace card routes) are
forwarded without a key. Every other allowlisted route, including wallet history
and buyback offers for any address, wallet sign-in, pulls, buybacks, marketplace
writes and redemption, is sent with the server's builder key in
`x-builder-api-key`. Redemption routes also require the caller's wallet access
token. The demo has no user system, so anyone who can reach the proxy can use
that key through those routes. A hosted copy needs its own authentication and
quotas and must use a testnet key.

A submission journal is stored before funding and updated on payment confirmation.
A disconnect keeps the pending state across reloads and pauses further purchases.
Recover by funding hash; an empty history does not prove that payment failed.
If the stream was lost before a hash arrived, reconcile the chain before clearing
local storage. Wallet/account changes invalidate unsigned preparations.

## Funded integration check (explicit opt-in)

Store `PK`, `RPC_URL`, `PACK_SLUG`, and `MOCK_TOKEN` in an ignored root
`.env.testnet.local` (mode 0600). The key must be a disposable funded testnet EOA.
With the demo running, execute from `examples/web`:

```bash
node --env-file=../../.env.testnet.local scripts/testnet-flow.mjs
```

The runner uses the built SDK through the running demo proxy. It verifies chain
97 and the mock token, spends the price of one card in mock tokens, sells the
result back, checks status/history and reconciles token balances. It writes
`reports/testnet-flow.json` and refuses to run again while that journal contains
an unresolved submission. It is never invoked by `pnpm test`.

Use `TESTNET_API_URL` to select another local demo port. For a direct API test,
set that variable to the API origin, set `TESTNET_DIRECT=1`, and load the server
builder key as `RENAISS_BUILDER_API_KEY`.

See [the gacha integration guide](../../docs/eoa-v2.md).

For the marketplace bid/cancel check and signing contract, see
[EOA marketplace](../../docs/marketplace-v2.md). The marketplace demo follows
a card grid, filters, detail view and trading forms with this demo's styles.
Its Developer panel maps the exposed fields to where the demo uses them.

## Images

The demo uses Next.js `Image` for card and pack artwork, with responsive sizes.
Detail-page artwork is prioritized; other images load lazily. Its optimizer
accepts the Renaiss media host configured in
`next.config.mjs`. If your API serves artwork from another host, add that exact
origin to `images.remotePatterns` before rebuilding; avoid a wildcard hostname.
Owner avatars and courier logos use `unoptimized` because their URLs can belong
to external providers. They still use `Image` with explicit dimensions.

## Marketplace and redemption constants

Both screens use the selected `BNB_TESTNET` or `BNB_MAINNET` from
`@renaiss-protocol/client`; neither fetches
`/config`. The constants include the signing contracts, marketplace fee and
redemption cart limit. See [network constants](../../docs/demo-networks.md). The
Redeem address form takes a two-letter country code and an optional state as
plain text, and shows countries as the codes the API returns. The API decides
at quote and validation time which destinations it ships to and whether a state
is needed, and the form shows its error text when it refuses an address.

For redemption through this demo proxy, the server layout passes only the public
API identity to the browser. During sign-in the SDK compares the issuer and
audience that the API returns in the sign-in challenge with
`RENAISS_WALLET_SESSION_ISSUER`, which must be the exact `/v2/auth/wallet` URL
of the API that issues the wallet access tokens (for example
`https://dev-api.renaiss.xyz/v2/auth/wallet`), and refuses a mismatch. By
default it is `${RENAISS_API_URL origin}/v2/auth/wallet`. Set it only when
`RENAISS_API_URL` is a different address from the API's own, such as a proxy in
front of the API.

## Mainnet or testnet

Set these together in the repository root `.env.local`, then restart `pnpm --filter web dev`.
For a production build, rebuild with `pnpm build` before `pnpm --filter web start`.
Dev, build and start all load root `.env.local` before `.env`; exported shell variables take precedence.

```dotenv
NEXT_PUBLIC_RENAISS_NETWORK=mainnet
RENAISS_API_URL=https://api.renaiss.xyz
NEXT_PUBLIC_RENAISS_API_URL=https://api.renaiss.xyz
RENAISS_BUILDER_API_KEY=<builder key for this API environment>
```

Use `NEXT_PUBLIC_RENAISS_NETWORK=testnet` and the matching testnet API URLs/key
for mock funds. An omitted network defaults to testnet; an invalid value fails
startup. The resolved default is also inlined at build time: setting a network
only at `next start` cannot change the compiled badge or signing network.
`RENAISS_API_URL` does not change the selected chain automatically.
Custom API aliases and local proxies are supported; they must serve the selected
network. `NEXT_PUBLIC_RENAISS_API_URL` is the public upstream identity used to
isolate recovery records, including when `RENAISS_API_URL` points at a proxy in front
of the API.

The navigation shows one network badge. Developer panels show the chain ID.
The selected network also controls RPC reads, wallet switching/checks, USDT and
Permit2 approvals, marketplace and redemption signing contracts, buybacks and
BscScan links. Preparations from another network fail before signing. Gacha also
checks the configured token and Permit2 before approval. Mainnet uses real USDT
and BNB; the automated funded runner remains **testnet-only**.

To sign in for Redeem, register the demo's exact browser origin (including
its port) with the builder in the target API environment. Configure the canonical
`RENAISS_WALLET_SESSION_ISSUER` separately if the API uses a different issuer.
A testnet builder key or origin registration does not configure production.
See [mainnet verification and network selection](../../docs/demo-networks.md).

## Signing in for Redeem and recovery

On `/redeem`, connect the existing wallet, then choose **Sign in for Redeem**.
This gets a wallet access token for private Redeem requests without creating a
Renaiss account. The API's sign-in message expires after five minutes. If it
expires while a wallet prompt is open, sign in again for a new sign-in message;
the demo explains the retry instead of treating it as a failed transaction.

Pending gacha pulls with a funding hash recover automatically with bounded
status polling. The screen shows progress and a transaction link. If automatic
recovery cannot finish, reconcile the transaction before using manual clearing
in Developer controls. See [gacha recovery](../../docs/eoa-v2.md#interrupted-purchases).

For a hosted demo, set `DEMO_ALLOWED_ORIGINS` to its exact frontend origin
(or a comma-separated list). When unset the proxy accepts only localhost and
127.0.0.1 at the request port, preventing remote Host/Origin pairs from using
the server builder key. Production partner backends must authenticate their
own users and apply their own authorization and CSRF policy.

## Disclaimer

All Pokémon trademarks, logos, and images are owned by The Pokémon Company. All One Piece and related marks are trademarks of Eiichiro Oda and Shueisha Inc. Renaiss is not affiliated with or endorsed by The Pokémon Company, Nintendo, Shueisha Inc., Eiichiro Oda, or any related entities, nor by the grading companies named in this project.
