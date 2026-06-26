# SDK Direction

This repository is the home for Renaiss's official TypeScript SDK packages.

## Purpose

The TypeScript SDK lets third-party integrators — web apps and mobile wallet apps — embed the Renaiss gacha experience: browse machines, see their status and odds, pull, stream the draw/release result, and read a user's pull history. It should make building on Renaiss simple, typed, and workflow-oriented, organized around developer workflows rather than internal API boundaries.

## Beta Focus

- Iterate on `@renaiss-protocol/client` during beta and move toward a stable public API.
- Support the core gacha workflows: machine discovery, pulling, result streaming, and history.
- Keep `@renaiss-protocol/client` usable from both browser (integrator front-ends) and mobile/automation contexts.
- Use beta feedback to refine developer experience.

## Design Principles

- Prefer workflow-first APIs over endpoint-shaped APIs.
- Keep public models pragmatic, typed, and consistent. Standardize identifier naming on JS/TS-style `...Id` forms.
- **Errors as values, never throw.** Public functions return `@renaiss-protocol/fp` `Result`/`Action` values; integrators branch with the exported `isSuccess` / `isFailed` guards and read error codes from `@renaiss-protocol/error-codes`.
- Validate API responses and SSE event payloads with Zod schemas from `@renaiss-protocol/schema-validation`.
- Use `list*` for SDK-normalized pagination and `fetch*` for direct reads; do not leak upstream pagination envelopes.

## Authentication Direction

- Reuse the Renaiss platform auth (Better Auth). End users prove wallet control via SIWE (L1); the SDK then holds a **non-expiring API key** (L2) sent as a header for user-scoped calls (e.g. pull history).
- Public reads (list machines, machine detail/status) do not require authentication. Token refresh is intentionally out of scope for v1 (keys do not expire); the client keeps a storage hook and a 401 interceptor point so refresh can be added later without breaking integrators.

## Pull Direction

- Pulls are **non-custodial**. The SDK builds the Permit2 typed data, the user signs it via an injected signer (viem / ethers / EIP-1193 / Privy), and the SDK submits the open-pack request.
- After submission, the SDK consumes the Server-Sent Events stream to surface progress (permit funded → draw resolved → token released), with a `getDrawStatus` polling fallback for mobile or dropped connections.

## Package Direction

- `@renaiss-protocol/client` is the headline user-facing package _(planned)_.
- `@renaiss-protocol/fp`, `@renaiss-protocol/error-codes`, and `@renaiss-protocol/schema-validation` are shared primitives that support the client; they are not the main user-facing surface.
- A Next.js demo app and a CLI app are planned under `examples/`.

## Non-Goals

- Mirror internal service boundaries directly in the public SDK surface.
- Expose every underlying endpoint as a public SDK action.
- Build speculative breadth ahead of a concrete, supported workflow.
