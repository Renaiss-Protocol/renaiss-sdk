---
name: new-resource
description: Add a bindings resource schema
---

# Create a New Resource

Creates a resource module in `packages/bindings` by investigating a source repo and translating the resource shape into Zod schemas and TypeScript types.

## Usage

```
/new-resource <resource>
/new-resource <repo> <resource>
```

## Inputs

- Use TodoWrite for the main steps
- If the source repo is not explicit, ask the user which repo to investigate before proceeding
- If the resource is not explicit, ask the user which resource to model before proceeding

## Workflow

- Investigate the top-level resource struct and its directly related nested structs
- Create `packages/bindings/src/<resource>.ts`
- Re-export modules from `packages/bindings/src/index.ts` with `export * from './<module>'`

## Schema Rules

- Use `PascalCaseSchema` for exported Zod schemas
- Export the inferred TypeScript type with the plain `PascalCase` name
- Export named reusable nested schemas and their inferred types too
- For every implemented schema with an `id` field, including the top-level resource and named nested resource/reference schemas, use the corresponding branded type from `@renaiss-protocol/types`
- If a branded ID type does not exist, add it to `packages/types/src/ids.ts`, export a matching `to<TypeName>` constructor there, ensure it is re-exported from `packages/types/src/index.ts`, then use that constructor from the Zod schema transform
- Follow the `to<TypeName>` naming pattern for branded constructors so they are easy to discover and consistent across the SDK
- Do not inline `value as SomeId` casts inside bindings schemas; always route branding through the `to<TypeName>` constructor from `@renaiss-protocol/types`
- When a branded type is string-backed or integer-backed and has no extra invariant yet, follow the existing constructor helpers in `packages/types/src/ids.ts` so future tightening happens in one place
- Move overlapping shared schemas to `packages/bindings/src/common.ts`
- Use `common.ts` for shared primitives, shared nested objects, shared reference schemas, and shared branded ID schemas
- If a resource uses another resource or shared schema, import it instead of redefining it
- If two resources reference each other, prefer a shared shallow `*ReferenceSchema` in `common.ts` to avoid circular imports
- Do not re-export shared schemas or shared types from a resource module just to forward them; export them from their owning module and rely on the barrel file
- Keep field names aligned with the external API shape unless the user explicitly asks for normalization
- Be conservative with nullability and optionality; prefer matching observed source shapes over tightening fields aggressively
- Keep nested relation schemas shallow unless the user asks for a full deep model
- Follow the existing package conventions already used in `packages/bindings` and `packages/types`
- Do not add extra package files unless requested

## Validation

- Run `pnpm --filter @renaiss-protocol/types build` if `packages/types` changed
- Run `pnpm --filter @renaiss-protocol/bindings build`
- Run `pnpm --filter @renaiss-protocol/bindings typecheck`
- If the resource is consumed by another workspace package in the same task, build `@renaiss-protocol/bindings` before validating that dependent package. If multiple workspace packages changed or the dependency chain is unclear, prefer `pnpm build` from the repo root first.
