---
name: new-action
description: Add a new client action
---

# Create a New Action

Creates a new action in `packages/client/src/actions` and exposes it through a
decorator on the client.

## Usage

```
/new-action <action>
```

## Inputs

- Use TodoWrite for the main steps.
- If the action is not explicit, ask the user which action to add before proceeding.
- Reference how `~/code/renaiss-cli-internal` calls the same backend endpoint to model the request params and response shape.

## Workflow

- Create or update `packages/client/src/actions/<module>.ts`. Colocate related actions in one module (e.g. discovery reads in `markets.ts`).
- Re-export nothing from `actions/index.ts` directly to consumers; the public surface is the decorator.
- Add or update the matching decorator in `packages/client/src/decorators/<group>.ts`, and bind the action there (`<name>: (request) => <name>(client, request)`).
- Compose the decorator into the client in `packages/client/src/clients.ts` so `client.<name>(...)` works.
- Re-export public types/functions from `packages/client/src/index.ts`.

## Action rules

- **Errors as values, never throw.** Actions return `@renaiss-protocol/fp` values (`Action`/`Result`). Build them with `Success(...)` / `Failed(code, status, detail)`; pick `code` from `@renaiss-protocol/error-codes`. Do not throw and do not surface raw `fetch`/transport details.
- Accept the internal `ServiceClient` as the first parameter; never leak it or `fetch` to the public API.
- Validate request input with a Zod schema via `safeParse`; on failure return `Failed('WRONG_REQUEST_PARAMS', StatusCodes.BAD_REQUEST, ...)`.
- Make the request with `client.get(path, { params })`, then compose with `pipe(..., TE.chain(validateWith(ResponseSchema)), TE.map(...))` from `@renaiss-protocol/fp`.
- Put the response Zod schema next to the action (colocated). Use `@renaiss-protocol/schema-validation` only for generic, reusable primitives.
- **Naming:** `list*` for SDK-normalized pagination (return `Paginated<T>` via `paginate(...)` with offset cursors); `fetch*` for a direct item or collection.
- Map upstream pagination (`limit`/`offset`/`hasMore`) into the SDK `Paginated`/`Page` abstraction; do not expose raw envelopes.
- Document the action with TSDoc: a one-line summary, a `@remarks` note that it never throws (results are values), and a usage `@example` (no import statements).

## Validation

- `pnpm --filter @renaiss-protocol/client build`
- `pnpm --filter @renaiss-protocol/client typecheck`
- `pnpm lint:fix` then `pnpm lint`
- If a workspace dependency changed, build it first; if unclear, run `pnpm build` from the repo root.
