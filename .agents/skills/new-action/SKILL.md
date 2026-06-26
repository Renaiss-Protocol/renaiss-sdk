---
name: new-action
description: Add a new client action
---

# Create a New Action

Creates a new action in `packages/client/src/actions` for the unified client surface.

## Usage

```
/new-action <action>
/new-action <repo> <action>
```

## Inputs

- Use TodoWrite for the main steps
- If the action is not explicit, ask the user which action to add before proceeding

## Workflow

- When provided, investigate the target API implementation in the source repo before modeling request and response shapes
- Create or update `packages/client/src/actions/<module>.ts`
- Prefer colocating related actions in the same module, such as market read actions in `markets.ts` and event read actions in `events.ts`
- Create a new module only when the action does not have a natural existing home
- If the module grouping or singular/plural module name is unclear, ask the user
- Re-export the action from `packages/client/src/actions/index.ts`
- Do not re-export actions from `packages/client/src/index.ts`; actions are consumed from `@renaiss-protocol/client/actions`
- Add or update an integration-style test in `packages/client/src/actions/<module>.test.ts`
- Reuse `packages/client/src/testing.ts` for the shared test client when tests need a client instance
- If the action needs bindings that do not exist yet, use `/new-resource` first to add the missing schemas and types in `packages/bindings`

## Action Rules

- Keep the public action API Renaiss-shaped and do not leak `ky` types, instances, hooks, or option shapes
- Accept `RenaissClient` as the first parameter
- Prefer verb-led names for action functions; use `list<Resource>` for collection reads unless the user asks otherwise
- Use the docs navigation (for example `docs/docs.json`) to cross-reference what is public; use docs OpenAPI YAML files only as a secondary aid for locating paths or coverage; the implementation is the source of truth
- Avoid composing response schemas inside action code; parse responses with schemas exported from `@renaiss-protocol/bindings`
- Use the exported resource schema directly for 1:1 responses, and add a dedicated `...ResponseSchema` in `@renaiss-protocol/bindings` only when the transport shape differs from the resource shape, such as wrappers, pagination envelopes, or extra metadata
- Do not hand-roll missing response models in the client package; add them to `@renaiss-protocol/bindings` first
- Reuse types re-exported by `@renaiss-protocol/client` instead of creating redundant local type aliases for bindings types
- If request input benefits from runtime validation or normalization, use Zod in the action module
- Prefer inline Zod transforms with well-named helpers such as `.transform(toISODateString)`
- Keep helpers small and local; do not add a new helper or abstraction unless it is really necessary and materially improves reuse, safety, or readability
- Document every public action with full TSDoc in the richer style used by established actions such as `fetchMarket`: include a short summary sentence, an `@throws` block, and a practical `@example` block showing a realistic call and returned shape; keep examples usage-focused and omit import statements
- When documenting `@throws`, trace the full call path instead of only the top-level function body: inspect local `throw` statements, helpers invoked before the request, and anything unwrapped from `Result`/`ResultAsync`
- `parseUserInput(...)` throws `UserInputError`
- `unwrap(Result<T, E> | ResultAsync<T, E>)` throws `E`
- In current client actions, `unwrap(client.<service>.get(...))` throws `RateLimitError`, `ServerError`, or `InvalidResponseError`
- If a helper catches and remaps errors, document the remapped public errors rather than the helper's internal implementation details

## Testing Rules

- Default to integration-style tests
- Do not mock API responses unless the user explicitly asks for it or mocking is necessary to isolate a boundary under test
- Prefer light assertions over brittle full payload snapshots when testing live responses

## Validation

- If action work changes a workspace dependency used by `@renaiss-protocol/client`, build that dependency first. If multiple workspace packages changed or the dependency chain is unclear, prefer `pnpm build` from the repo root before the steps below.
- Run `pnpm --filter @renaiss-protocol/client build`
- Run `pnpm --filter @renaiss-protocol/client typecheck`
- Run `pnpm test:client`
- Run `pnpm lint:fix`
