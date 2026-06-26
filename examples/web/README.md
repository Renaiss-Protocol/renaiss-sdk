# Renaiss SDK - Next.js example

A minimal Next.js app that demonstrates the `@renaiss-protocol/client` gacha workflow
from server and browser flows:

- fetch active gacha machines and machine details
- connect an injected browser wallet
- create an API key with SIWE
- pull gacha and render SSE progress events
- list and submit buyback offers

The page renders error code/detail values when a request fails. Expected failures
are returned as values, not thrown.

## Run it

From the repo root (build the workspace packages first, then start the app):

```bash
pnpm install
pnpm build
pnpm --filter web dev
```

Then open http://localhost:3000.

By default it calls `https://api.renaiss.xyz`.

Server-rendered examples read `RENAISS_API_URL`. Browser-side gacha actions read
`NEXT_PUBLIC_RENAISS_API_URL`.
