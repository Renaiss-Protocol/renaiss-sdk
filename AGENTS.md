# AGENTS.md

## Quick orientation

- Primary design doc: `docs/sdk-direction.md`
- SDK packages: `packages/`
- Main client package: `packages/client` _(planned; not yet scaffolded)_
- Result/Action primitives (errors as values, never throw): `packages/fp`
- Shared error codes: `packages/error-codes`
- Zod schemas and validation primitives: `packages/schema-validation`
- Runnable examples: `examples/*` _(planned)_

## Required workflow

- Before finishing, run:
  - `pnpm lint`
  - `pnpm typecheck`
- If `pnpm lint` reports fixable issues, run `pnpm lint:fix`, review the resulting edits, and rerun `pnpm lint`.
- For cross-package changes, build changed dependencies before targeted verification because workspace packages are often consumed through built `dist` outputs.
- Example: if `packages/schema-validation` changes and you are validating the client, run `pnpm --filter @renaiss-protocol/schema-validation build` first.
- If multiple packages changed or the dependency chain is unclear, prefer root-level verification such as `pnpm build` and `pnpm test`.

## Product and API guardrails

- This repo is the home for Renaiss's TypeScript SDK. The first shipping target is `@renaiss-protocol/client`, which lets third-party integrators embed the Renaiss gacha experience (browse machines, pull, stream draw results, read pull history).
- The SDK should present one cohesive consumer interface organized around developer workflows, and hide internal service boundaries where possible. Do not cargo-cult the shape of underlying APIs or ticket wording when a better public SDK shape exists.
- Schemas that parse an API HTTP response, an SSE event payload, or a raw/compact API field shape belong in `packages/schema-validation`, not the client.
- The client may compose schemas into workflows, actions, decorators, clients, auth, pagination, and higher-level SDK ergonomics.
- Only put schemas in the client when they validate SDK user input or client-owned options that do not mirror an API payload.
- When changing exported SDK APIs, first identify the user intent the API should express. Prefer intent-based options over implementation-detail options.
- Before deciding a public API shape for a common SDK pattern, look at comparable SDK/API interfaces or ask a short question. Examples include pagination, signing workflows, balance/allowance handling, idempotency, and retries.
- Defaults are part of the API. Make the default behavior explicit, choose the least surprising default for the common workflow, and document how callers opt into materially different behavior.
- Each action in `packages/client/src/actions/` has a corresponding bound method in a decorator under `packages/client/src/decorators/`. When you change an action — its signature, parameter types, TSDoc, or examples — verify the matching decorator method is also updated. The decorator method is the public surface most consumers see.
- The client root entry point exports decorators, so new public client additions must be re-exported by the corresponding decorator module.
- Keep the HTTP client internal to `ServiceClient`. Do not leak its instances, types, or option shapes; expose Renaiss-specific abstractions instead.
- Wallet-library integrations must stay isolated to their entry points and optional peer dependencies. If `viem` is an optional peer tied to the `viem` entry point, non-`viem` code paths must not import `viem`. Apply the same rule to future entry points for other wallet libraries such as Ethers or Privy.

## Errors as values

- The SDK never throws for expected failures. Functions return `@renaiss-protocol/fp` `Result`/`Action` values; build them with `Success(...)` / `Failed(code, status, detail)` and run/inspect them with `run`, `isSuccess` / `isFailed`, `getValue` / `getError`.
- Error codes come from `@renaiss-protocol/error-codes`. Add new codes there following the existing naming convention (`*_FAILED` for handled failures, `*_ERROR` for unexpected exceptions caught around an operation; prefix by domain).
- For each public SDK action, define an action-level error code list and type in `@renaiss-protocol/error-codes` (for example, `PULL_GACHA_ERROR_CODES` / `PullGachaErrorCode`). Include shared SDK failures such as `WRONG_REQUEST_PARAMS`, `INVALID_SCHEMA`, `UNAUTHORIZED`, and `UNKNOWN_ERROR` only when that action can publicly return them.
- Expose action-specific client guards such as `isPullGachaError(error): error is ApiError<PullGachaErrorCode>` from `@renaiss-protocol/client` so consumers can narrow failed results and use exhaustive `switch (error.code)` handling. Prefer action-level guards over domain-level guards; do not add broad domain guards unless there is a concrete shared-handler use case.
- Keep action implementations on broad `Action<T>` / `Paginated<T>` result types. Do not add action-specific `Failed<SomeActionErrorCode>(...)` casts or `TE.mapLeft(...)` remapping solely to narrow public error types; return normal `Failed(...)` values and let public guards narrow at the client boundary.
- Re-export `isSuccess` / `isFailed` (and the relevant `Result`/error types) from the client so integrators can branch on results without importing internals.
- When translating one failure into another at an action boundary, remap inside the result chain (return a new `Failed(...)`) rather than throwing.

## Pagination and naming

- Method prefixes must reflect SDK behavior, not upstream route names:
  - `list*` means the SDK returns normalized pagination via a `Paginated<T>` / `Page<T>` abstraction.
  - `fetch*` means the SDK returns a direct item or direct collection, with no SDK pagination abstraction.
- Do not expose upstream pagination envelopes directly from the client (offsets, page numbers, service-specific cursor fields). Translate them into SDK-owned pagination or hide them.
- Before adding a public collection method, check whether the endpoint supports continuation and document the chosen SDK behavior in the action/decorator types.

## TypeScript config

- Root `tsconfig.json` and package-level `tsconfig.json` files are for editor tooling and source navigation only.
- `tsconfig.build.json` files drive build and typecheck behavior. When changing build behavior or fixing build issues, update `tsconfig.build.json`, not the root or package `tsconfig.json`.
- When adding a new entry point to a package, add the corresponding alias to `compilerOptions.paths` in the root `tsconfig.json` so IDE resolution keeps working.

## Code conventions

- Prefer `type` over `interface` unless an interface is clearly needed, such as when a class implements it or declaration extensibility is a deliberate requirement.
- Prefer function declarations over arrow functions unless there is a clear reason to use an arrow function.
- When a definition is specific to a single function, such as a one-off params object, request schema, exported request type, error union, or error guard, colocate it directly above the function declaration. Promote definitions upward only when they are reused, part of the public model, or improve the public API surface.
- Do not use indexed-access-derived types like `SomeType['field']` in implementation code, public APIs, examples, TSDoc, or docs. Define and use a named type instead.
- Prefer simple, local code. Accept small duplication when it keeps logic easier to read. Introduce helpers only when they meaningfully improve reuse, safety, or readability.
- Prefer TypeScript enums with `z.enum(MyEnum)` over `z.union([z.literal(...), ...])` for string-valued sets. This gives consumers dot-notation access and keeps the schema and type in sync (`z.nativeEnum` is deprecated in Zod v4).
- Document abstractions at their own layer. Lower-level types, helpers, and modules should describe their own contract and behavior, not higher-level consumers that compose them.
- In TSDoc `@example` blocks, do not include import statements. Keep examples focused on usage only.
- For any public SDK function export, document the public error surface explicitly and include an `@throws`/result note that references the concrete public error codes it can return through its public contract.

## Testing

- Default client tests to integration-style coverage.
- Do not mock API responses unless explicitly requested or unless mocking is necessary to isolate a boundary under test.
- For tests involving async iterators, especially integration tests, prefer idiomatic consumer usage such as `for await (...)` so the test reads like final SDK DX.
- Add tests when they protect user-facing behavior, public API contracts, integration boundaries, or regressions that are likely to recur. Do not add tests reflexively for every small implementation change.
- A good test should catch a plausible future regression, not just prove that the current diff works.

## Response contract

Be concise.
