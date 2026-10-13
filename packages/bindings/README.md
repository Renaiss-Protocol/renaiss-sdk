# Generating API bindings

The bindings target the v2 API only. Generation reads one OpenAPI document and
never silently falls back to a deployment that may have a different route set.
Use the API's v2 document, or a downloaded JSON snapshot for an offline
rebuild:

```sh
RENAISS_OPENAPI_SOURCE=https://dev-api.renaiss.xyz/v2/openapi.json \
pnpm --filter @renaiss-protocol/bindings generate
```

`generate` runs `generate:api` (types in `api/v2.generated.ts`) and
`generate:error-codes` (runtime error-code lists in `api/error-codes.generated.ts`);
both read `RENAISS_OPENAPI_SOURCE`. The committed bindings cover the v2
`/gacha`, `/marketplace`, `/redeem` and wallet-auth routes; the SDK supplies
network metadata statically. Check these paths in the
source document before regenerating.

Current generation source:

- `api/v2.generated.ts` and `api/error-codes.generated.ts`:
  `https://dev-api.renaiss.xyz/v2/openapi.json` on 2026-10-10, SHA-256
  `20eb248825f0e9f2c81e9fe984f24752fc7afe0aecfd0ad6f77787b6c5362881`.
