# AGENTS.md

Guidance for people and coding agents working in this repository.

## Layout

- `packages/client`: `@renaiss-protocol/client`, the only published package. It bundles the other packages at build time.
  - `src/actions/*-v2.ts`: workflow implementations (gacha, marketplace, redemption).
  - `src/decorators/*-v2.ts`: the bound methods consumers call on the clients.
  - `src/v2.ts`: client factories and the public exports of the root entry (`src/index.ts`).
  - `src/viem.ts`: the optional `@renaiss-protocol/client/viem` signer adapter.
  - `src/service-client.ts`: the internal `fetch` transport.
  - `src/pagination.ts`, `src/v2-errors.ts`, `src/networks-v2.ts`: pagination, action error guards, network constants.
- `packages/fp`: `Result` and `Action` primitives (errors as values).
- `packages/error-codes`: shared error codes and the per-action code lists.
- `packages/schema-validation`: Zod schemas for API responses and stream events.
- `packages/bindings`: types and error-code lists generated from the v2 OpenAPI document (see its README).
- `examples/web`: Next.js demo.
- `docs/`: integration guides. `docs/sdk-direction.md` is the design overview.

## Workflow

- Use Node.js 24 or newer and pnpm 10 or newer.
- Before sending a change, run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`. If `pnpm lint` reports fixable issues, run `pnpm lint:fix`, review the edits and rerun `pnpm lint`.
- Workspace packages are consumed through their built `dist` outputs, so build changed dependencies before checking their consumers, for example `pnpm --filter @renaiss-protocol/schema-validation build` before validating the client. When several packages changed, run `pnpm build` at the root.
- Record user-visible changes to `@renaiss-protocol/client` with a changeset (`pnpm changeset`). Write it as release notes for SDK users.

## API guardrails

- Present one cohesive interface organized around developer workflows. Do not copy the shape of the underlying HTTP API when a better SDK shape exists.
- Identify the intent an API should express before choosing its shape; prefer intent-based options over implementation details. For common patterns (pagination, signing, allowances, idempotency, retries) look at comparable SDKs first.
- Defaults are part of the API. Make them explicit, pick the least surprising one, and document how callers opt out.
- Schemas that parse an HTTP response, a stream event or a raw API field shape belong in `packages/schema-validation`. Put a schema in the client only to validate SDK user input or client-owned options.
- Every action in `packages/client/src/actions/` has a bound method in the matching decorator under `packages/client/src/decorators/`. When an action's signature, types, documentation or examples change, update the decorator method too: it is the surface most consumers see. New public additions must be exported from `packages/client/src/v2.ts`.
- Keep `fetch` inside `ServiceClient`. Do not leak its types or options.
- Wallet-library integrations stay behind their own entry point and optional peer dependency. Code outside `src/viem.ts` must not import `viem` at runtime.
- When adding an entry point to a package, add its alias to `compilerOptions.paths` in the root `tsconfig.json`.

## Errors as values

- Expected failures are never thrown. Functions return `Result` or `Action` values from `@renaiss-protocol/fp`: build them with `Success(...)` and `Failed(code, status, detail)`, run actions with `run`, and inspect results with `isSuccess`, `isFailed`, `getValue` and `getError`.
- Error codes live in `@renaiss-protocol/error-codes`. Use `*_FAILED` for handled failures and `*_ERROR` for unexpected exceptions caught around an operation, prefixed by domain.
- Each public action has a code list and type in `error-codes` (for example `V2_LIST_GACHA_MACHINES_ERROR_CODES` and `V2ListGachaMachinesErrorCode`) and a guard in `packages/client/src/v2-errors.ts` (for example `isListGachaMachinesError`), so consumers can narrow a failure and switch exhaustively on `error.code`. Prefer per-action guards over broad domain guards.
- Keep action implementations on the broad `Action<T>` and `Paginated<T>` types; narrowing happens in the public guards.
- To turn one failure into another, return a new `Failed(...)` inside the result chain.

## Pagination and naming

- `list*` methods return normalized pagination (`Paginated<T>`, `Page<T>`). `fetch*` methods return a direct item or collection.
- Do not expose upstream pagination fields (offsets, page numbers, cursors). Translate them into SDK cursors or hide them.
- Before adding a public collection method, check whether the endpoint supports continuation and document the choice in the action and decorator types.

## TypeScript config

- `tsconfig.base.json` holds the shared compiler options.
- Each package's `tsconfig.build.json` extends it and sets the package's build options. `tsup` reads it for `pnpm build`, including the bundled type declarations.
- Each package's `tsconfig.json` extends its `tsconfig.build.json` and the root `tsconfig.json`. Package `typecheck` scripts run `tsc -p tsconfig.json --noEmit`, and editors use it, so workspace imports resolve to source.
- The root `tsconfig.json` defines the `paths` aliases for workspace packages and entry points. `examples/web` has a standalone `tsconfig.json`, used by `tsc --noEmit` and Next.js. It resolves workspace packages through their built `dist`, so build them first.
- Change build behavior in `tsconfig.build.json`; change aliases or editor resolution in the root `tsconfig.json`.

## Code conventions

- Prefer `type` over `interface` unless a class implements it or declaration merging is intended.
- Prefer function declarations over arrow functions unless there is a reason.
- Put one-off definitions (a request type, schema, error union or guard used by one function) directly above that function. Move them up only when reused or part of the public model.
- Do not use indexed-access types such as `SomeType['field']` in code, public APIs, examples, TSDoc or docs; define a named type.
- Prefer simple, local code. Accept small duplication over a helper that does not clearly help.
- Prefer TypeScript enums with `z.enum(MyEnum)` over unions of literals for string sets.
- Document each abstraction at its own layer, not in terms of what consumes it.
- In TSDoc `@example` blocks, omit import statements.
- Document the public error surface of every public function: name the concrete error codes it can return.

## Testing

- Run tests with `pnpm test` (Vitest). Client tests exercise the public client methods and stub the global `fetch` at the transport boundary. Do not mock internal modules.
- For async iterators, consume them as a caller would, with `for await (...)`.
- Add tests for user-facing behavior, public contracts, integration boundaries and regressions likely to recur. A good test would catch a plausible future bug, not only prove the current diff works.
